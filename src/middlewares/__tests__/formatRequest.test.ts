import { Request, Response, NextFunction } from 'express';
import { formatRequest } from '../formatRequest';

// Mock the stream module
jest.mock('../../utils/stream', () => ({
  streamOpenAIResponse: jest.fn(),
}));

// Mock the log module
jest.mock('../../utils/log', () => ({
  log: jest.fn(),
}));

describe('formatRequest middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockNext = jest.fn();
    mockRes = {
      setHeader: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };
    
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('extra_body parameter handling', () => {
    it('should merge extra_body from provider config into request body', async () => {
      // 准备测试数据
      mockReq = {
        body: {
          model: 'test-model',
          messages: [{ role: 'user', content: 'test message' }],
          stream: false,
        },
        provider: 'qwen3-8b',
        config: {
          providers: [
            {
              id: 'qwen3-8b',
              extra_body: {
                enable_thinking: true,
                custom_param: 'test_value'
              }
            }
          ]
        }
      };

      await formatRequest(mockReq as Request, mockRes as Response, mockNext);

      // 验证 extra_body 被正确合并
      expect(mockReq.body.extra_body).toEqual({
        enable_thinking: true,
        custom_param: 'test_value'
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should merge extra_body with existing extra_body in request', async () => {
      mockReq = {
        body: {
          model: 'test-model',
          messages: [{ role: 'user', content: 'test message' }],
          stream: false,
          extra_body: {
            existing_param: 'existing_value'
          }
        },
        provider: 'qwen3-8b',
        config: {
          providers: [
            {
              id: 'qwen3-8b',
              extra_body: {
                enable_thinking: true
              }
            }
          ]
        }
      };

      await formatRequest(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body.extra_body).toEqual({
        existing_param: 'existing_value',
        enable_thinking: true
      });
    });

    it('should not add extra_body if provider does not have it', async () => {
      mockReq = {
        body: {
          model: 'test-model',
          messages: [{ role: 'user', content: 'test message' }],
          stream: false,
        },
        provider: 'other-provider',
        config: {
          providers: [
            {
              id: 'other-provider'
              // no extra_body
            }
          ]
        }
      };

      await formatRequest(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body.extra_body).toBeUndefined();
    });
  });

  describe('force_stream_for_thinking functionality', () => {
    it('should force streaming for think requests when force_stream_for_thinking is true', async () => {
      mockReq = {
        body: {
          model: 'test-model',
          messages: [{ role: 'user', content: 'test message' }],
          stream: false, // 原始请求是非流式的
        },
        provider: 'qwen3-8b',
        config: {
          providers: [
            {
              id: 'qwen3-8b',
              force_stream_for_thinking: true
            }
          ],
          Router: {
            think: 'qwen3-8b'
          }
        },
        _simulate_non_stream: undefined
      };

      await formatRequest(mockReq as Request, mockRes as Response, mockNext);

      // 验证流式被强制开启，模拟标志被设置
      expect(mockReq.body.stream).toBe(true);
      expect(mockReq._simulate_non_stream).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not set _simulate_non_stream if request is already streaming', async () => {
      mockReq = {
        body: {
          model: 'test-model',
          messages: [{ role: 'user', content: 'test message' }],
          stream: true, // 原始请求已经是流式的
        },
        provider: 'qwen3-8b',
        config: {
          providers: [
            {
              id: 'qwen3-8b',
              force_stream_for_thinking: true
            }
          ],
          Router: {
            think: 'qwen3-8b'
          }
        },
        _simulate_non_stream: undefined
      };

      await formatRequest(mockReq as Request, mockRes as Response, mockNext);

      // 验证流式保持开启，但模拟标志不被设置
      expect(mockReq.body.stream).toBe(true);
      expect(mockReq._simulate_non_stream).toBeUndefined();
    });

    it('should not force streaming for non-think requests', async () => {
      mockReq = {
        body: {
          model: 'test-model',
          messages: [{ role: 'user', content: 'test message' }],
          stream: false,
        },
        provider: 'other-provider', // 不是 think provider
        config: {
          providers: [
            {
              id: 'other-provider',
              force_stream_for_thinking: true
            }
          ],
          Router: {
            think: 'qwen3-8b' // think provider 是不同的
          }
        },
        _simulate_non_stream: undefined
      };

      await formatRequest(mockReq as Request, mockRes as Response, mockNext);

      // 验证流式状态保持原样
      expect(mockReq.body.stream).toBe(false);
      expect(mockReq._simulate_non_stream).toBeUndefined();
    });

    it('should not force streaming if force_stream_for_thinking is false', async () => {
      mockReq = {
        body: {
          model: 'test-model',
          messages: [{ role: 'user', content: 'test message' }],
          stream: false,
        },
        provider: 'qwen3-8b',
        config: {
          providers: [
            {
              id: 'qwen3-8b',
              force_stream_for_thinking: false
            }
          ],
          Router: {
            think: 'qwen3-8b'
          }
        },
        _simulate_non_stream: undefined
      };

      await formatRequest(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body.stream).toBe(false);
      expect(mockReq._simulate_non_stream).toBeUndefined();
    });
  });

  describe('combined functionality', () => {
    it('should handle both extra_body and force_stream_for_thinking together', async () => {
      mockReq = {
        body: {
          model: 'test-model',
          messages: [{ role: 'user', content: 'test message' }],
          stream: false,
        },
        provider: 'qwen3-8b',
        config: {
          providers: [
            {
              id: 'qwen3-8b',
              extra_body: {
                enable_thinking: true
              },
              force_stream_for_thinking: true
            }
          ],
          Router: {
            think: 'qwen3-8b'
          }
        },
        _simulate_non_stream: undefined
      };

      await formatRequest(mockReq as Request, mockRes as Response, mockNext);

      // 验证两个功能都正常工作
      expect(mockReq.body.extra_body).toEqual({
        enable_thinking: true
      });
      expect(mockReq.body.stream).toBe(true);
      expect(mockReq._simulate_non_stream).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });
  });
}); 