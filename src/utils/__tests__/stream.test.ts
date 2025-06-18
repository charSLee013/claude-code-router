import { Response, Request } from 'express';
import { streamOpenAIResponse } from '../stream';

// Mock the log module
jest.mock('../log', () => ({
  log: jest.fn(),
}));

describe('streamOpenAIResponse', () => {
  let mockRes: Partial<Response>;
  let mockReq: Partial<Request>;

  beforeEach(() => {
    mockRes = {
      json: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      setHeader: jest.fn(),
    };
    
    mockReq = {};
    
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('non-streaming response (original behavior)', () => {
    it('should handle non-streaming response with text content', async () => {
      const mockCompletion = {
        choices: [
          {
            message: {
              content: 'This is a test response',
            },
            finish_reason: 'stop',
          },
        ],
      };

      const body = { stream: false };

      await streamOpenAIResponse(
        mockRes as Response,
        mockCompletion,
        'test-model',
        body,
        mockReq as Request
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        id: expect.stringMatching(/^msg_\d+$/),
        type: 'message',
        role: 'assistant',
        content: 'This is a test response',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 100,
          output_tokens: 50,
        },
      });
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should handle non-streaming response with tool calls', async () => {
      const mockCompletion = {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: 'call_123',
                  function: {
                    name: 'test_function',
                    arguments: '{"param": "value"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      };

      const body = { stream: false };

      await streamOpenAIResponse(
        mockRes as Response,
        mockCompletion,
        'test-model',
        body,
        mockReq as Request
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        id: expect.stringMatching(/^msg_\d+$/),
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'call_123',
            name: 'test_function',
            input: { param: 'value' },
          },
        ],
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: {
          input_tokens: 100,
          output_tokens: 50,
        },
      });
    });
  });

  describe('simulated non-streaming response (_simulate_non_stream: true)', () => {
    it('should collect and merge text chunks into single response', async () => {
      // 创建模拟的流式响应分块
      const mockCompletion = (async function* () {
        yield {
          choices: [
            {
              delta: { content: 'Hello' },
              finish_reason: null,
            },
          ],
        };
        yield {
          choices: [
            {
              delta: { content: ' world' },
              finish_reason: null,
            },
          ],
        };
        yield {
          choices: [
            {
              delta: { content: '!' },
              finish_reason: 'stop',
            },
          ],
        };
      })();

      mockReq._simulate_non_stream = true;
      const body = { stream: true };

      await streamOpenAIResponse(
        mockRes as Response,
        mockCompletion,
        'test-model',
        body,
        mockReq as Request
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        id: expect.stringMatching(/^msg_\d+$/),
        type: 'message',
        role: 'assistant',
        content: 'Hello world!',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 100,
          output_tokens: 15, // 粗略估计：3 chunks * 5
        },
      });
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should collect and merge tool call chunks into single response', async () => {
      const mockCompletion = (async function* () {
        yield {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    id: 'call_123',
                    function: {
                      name: 'test_function',
                      arguments: '{"param"',
                    },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        };
        yield {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    id: 'call_123',
                    function: {
                      arguments: ': "value"}',
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        };
      })();

      mockReq._simulate_non_stream = true;
      const body = { stream: true };

      await streamOpenAIResponse(
        mockRes as Response,
        mockCompletion,
        'test-model',
        body,
        mockReq as Request
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        id: expect.stringMatching(/^msg_\d+$/),
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'call_123',
            name: 'test_function',
            input: { param: 'value' },
          },
        ],
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: {
          input_tokens: 100,
          output_tokens: 10, // 2 chunks * 5
        },
      });
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should handle mixed content and tool calls in chunks', async () => {
      const mockCompletion = (async function* () {
        yield {
          choices: [
            {
              delta: { content: 'I will help you with ' },
              finish_reason: null,
            },
          ],
        };
        yield {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    id: 'call_456',
                    function: {
                      name: 'helper_function',
                      arguments: '{"action": "help"}',
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        };
      })();

      mockReq._simulate_non_stream = true;
      const body = { stream: true };

      await streamOpenAIResponse(
        mockRes as Response,
        mockCompletion,
        'test-model',
        body,
        mockReq as Request
      );

      // 在有工具调用的情况下，应该优先返回工具调用
      expect(mockRes.json).toHaveBeenCalledWith({
        id: expect.stringMatching(/^msg_\d+$/),
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'call_456',
            name: 'helper_function',
            input: { action: 'help' },
          },
        ],
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: {
          input_tokens: 100,
          output_tokens: 10,
        },
      });
    });

    it('should handle error in chunk processing gracefully', async () => {
      const mockCompletion = (async function* () {
        yield {
          choices: [
            {
              delta: { content: 'Start' },
              finish_reason: null,
            },
          ],
        };
        throw new Error('Simulated error');
      })();

      mockReq._simulate_non_stream = true;
      const body = { stream: true };

      await streamOpenAIResponse(
        mockRes as Response,
        mockCompletion,
        'test-model',
        body,
        mockReq as Request
      );

      // 错误情况下应该继续正常的流式处理，不会调用 res.json
      expect(mockRes.json).not.toHaveBeenCalled();
      // 应该调用 res.write 进行流式处理
      expect(mockRes.write).toHaveBeenCalled();
    });
  });

  describe('regular streaming response', () => {
    it('should handle regular streaming without _simulate_non_stream', async () => {
      const mockCompletion = (async function* () {
        yield {
          choices: [
            {
              delta: { content: 'Hello' },
              finish_reason: null,
            },
          ],
        };
        yield {
          choices: [
            {
              delta: { content: ' world!' },
              finish_reason: 'stop',
            },
          ],
        };
      })();

      const body = { stream: true };

      await streamOpenAIResponse(
        mockRes as Response,
        mockCompletion,
        'test-model',
        body,
        mockReq as Request
      );

      // 正常流式响应应该使用 res.write
      expect(mockRes.write).toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
      expect(mockRes.end).toHaveBeenCalled();
    });
  });
}); 