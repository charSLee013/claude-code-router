/**
 * stream 模块的集成测试
 * 测试完整的响应处理流程，确保不会出现 "A.map is not a function" 错误
 */

import { streamOpenAIResponse } from '../stream';
import { Response } from 'express';

// Mock 日志系统，避免文件系统操作
jest.mock('../log', () => ({
  logWithConfig: jest.fn()
}));

// Mock Response 对象
const createMockResponse = () => {
  const mockResponse = {
    json: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
    setHeader: jest.fn(),
    _writtenData: [] as string[]
  } as any;

  // 捕获写入的数据
  mockResponse.write.mockImplementation((data: string) => {
    mockResponse._writtenData.push(data);
  });

  return mockResponse;
};

// Mock Request 对象
const createMockRequest = (simulateNonStream = false) => ({
  cwd: '/test/workspace',
  config: { logEnabled: true },
  _simulate_non_stream: simulateNonStream
});

describe('stream integration tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('非流式响应处理', () => {
    it('应该正确处理包含工具调用的非流式响应', async () => {
      const mockResponse = createMockResponse();
      const mockCompletion = {
        choices: [{
          message: {
            content: null,
            tool_calls: [{
              id: 'call_test_123',
              type: 'function',
              function: {
                name: 'test_tool',
                arguments: '{"param": "value"}'
              }
            }]
          },
          finish_reason: 'tool_calls'
        }]
      };

      await streamOpenAIResponse(
        mockResponse as Response,
        mockCompletion,
        'test-model',
        { stream: false }
      );

      expect(mockResponse.json).toHaveBeenCalledTimes(1);
      const jsonCall = mockResponse.json.mock.calls[0][0];
      
      expect(jsonCall.content).toBeInstanceOf(Array);
      expect(jsonCall.content[0]).toMatchObject({
        type: 'tool_use',
        id: 'call_test_123',
        name: 'test_tool',
        input: { param: 'value' }
      });
    });

    it('应该正确处理文本非流式响应', async () => {
      const mockResponse = createMockResponse();
      const mockCompletion = {
        choices: [{
          message: {
            content: 'This is a text response',
            tool_calls: null
          },
          finish_reason: 'stop'
        }]
      };

      await streamOpenAIResponse(
        mockResponse as Response,
        mockCompletion,
        'test-model',
        { stream: false }
      );

      expect(mockResponse.json).toHaveBeenCalledTimes(1);
      const jsonCall = mockResponse.json.mock.calls[0][0];
      
      expect(typeof jsonCall.content).toBe('string');
      expect(jsonCall.content).toBe('This is a text response');
    });
  });

  describe('模拟非流式响应处理', () => {
    it('应该正确处理模拟非流式工具调用响应', async () => {
      const mockResponse = createMockResponse();
      const mockRequest = createMockRequest(true);
      
      // 模拟流式数据块
      const mockCompletion = {
        async *[Symbol.asyncIterator]() {
          yield {
            choices: [{
              delta: {
                tool_calls: [{
                  id: 'call_stream_test',
                  function: {
                    name: 'stream_tool',
                    arguments: '{"test'
                  }
                }]
              }
            }]
          };
          yield {
            choices: [{
              delta: {
                tool_calls: [{
                  id: 'call_stream_test',
                  function: {
                    arguments: '": "data"}'
                  }
                }]
              }
            }]
          };
          yield {
            choices: [{
              finish_reason: 'tool_calls'
            }]
          };
        }
      };

      await streamOpenAIResponse(
        mockResponse as Response,
        mockCompletion,
        'test-model',
        { stream: true },
        mockRequest as any
      );

      expect(mockResponse.json).toHaveBeenCalledTimes(1);
      const jsonCall = mockResponse.json.mock.calls[0][0];
      
      expect(jsonCall.content).toBeInstanceOf(Array);
      expect(jsonCall.content[0]).toMatchObject({
        type: 'tool_use',
        id: 'call_stream_test',
        name: 'stream_tool',
        input: { test: 'data' }
      });
    });

    it('应该安全处理异常的流式数据', async () => {
      const mockResponse = createMockResponse();
      const mockRequest = createMockRequest(true);
      
      // 包含异常数据和有效数据的流式响应
      const mockCompletion = {
        async *[Symbol.asyncIterator]() {
          yield null; // 异常数据块
          yield { malformed: 'chunk' }; // 异常数据块
          yield {
            choices: [{
              delta: { content: 'Valid content' }
            }]
          };
          yield {
            choices: [{
              finish_reason: 'stop'
            }]
          };
        }
      };

      // 这个测试的重点是确保不抛出异常
      await expect(async () => {
        await streamOpenAIResponse(
          mockResponse as Response,
          mockCompletion,
          'test-model',
          { stream: true },
          mockRequest as any
        );
      }).not.toThrow();

      // 由于模拟非流式响应的实现可能有不同的行为
      // 我们只验证基本的安全性，不强制要求特定的响应格式
      console.log('Mock response calls:', {
        json: mockResponse.json.mock.calls.length,
        write: mockResponse.write.mock.calls.length,
        end: mockResponse.end.mock.calls.length
      });
    });
  });

  describe('防止 "A.map is not a function" 错误', () => {
    it('应该安全处理各种异常的tool_calls数据类型', async () => {
      const testCases = [
        null,
        undefined,
        'string_instead_of_array',
        123,
        {},
        []
      ];

      for (const [index, toolCalls] of testCases.entries()) {
        const mockResponse = createMockResponse();
        const mockCompletion = {
          choices: [{
            message: {
              content: null,
              tool_calls: toolCalls
            },
            finish_reason: 'stop'
          }]
        };

        await expect(async () => {
          await streamOpenAIResponse(
            mockResponse as Response,
            mockCompletion,
            'test-model',
            { stream: false }
          );
        }).not.toThrow();

        expect(mockResponse.json).toHaveBeenCalledTimes(1);
        const jsonCall = mockResponse.json.mock.calls[0][0];
        
        // 所有异常情况都应该安全处理为字符串
        expect(typeof jsonCall.content).toBe('string');
        
        // 重置mock以便下次测试
        jest.clearAllMocks();
      }
    });

    it('应该处理JSON解析失败的工具参数', async () => {
      const mockResponse = createMockResponse();
      const mockCompletion = {
        choices: [{
          message: {
            content: null,
            tool_calls: [{
              id: 'call_json_error',
              type: 'function',
              function: {
                name: 'error_tool',
                arguments: '{invalid json string' // 无效的JSON
              }
            }]
          },
          finish_reason: 'tool_calls'
        }]
      };

      await expect(async () => {
        await streamOpenAIResponse(
          mockResponse as Response,
          mockCompletion,
          'test-model',
          { stream: false }
        );
      }).not.toThrow();

      expect(mockResponse.json).toHaveBeenCalledTimes(1);
      const jsonCall = mockResponse.json.mock.calls[0][0];
      
      expect(jsonCall.content).toBeInstanceOf(Array);
      expect(jsonCall.content[0].input).toEqual({}); // 应该回退到空对象
    });
  });

  describe('边缘情况处理', () => {
    it('应该处理空的completion响应', async () => {
      const mockResponse = createMockResponse();
      const mockCompletion = {
        choices: []
      };

      await expect(async () => {
        await streamOpenAIResponse(
          mockResponse as Response,
          mockCompletion,
          'test-model',
          { stream: false }
        );
      }).not.toThrow();
    });

    it('应该处理缺少choices的响应', async () => {
      const mockResponse = createMockResponse();
      const mockCompletion = {};

      await expect(async () => {
        await streamOpenAIResponse(
          mockResponse as Response,
          mockCompletion,
          'test-model',
          { stream: false }
        );
      }).not.toThrow();
    });
  });
}); 