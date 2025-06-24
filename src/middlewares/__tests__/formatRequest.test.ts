import { Request, Response, NextFunction } from 'express';
import { formatRequest } from '../formatRequest';

// Mock the stream module
jest.mock('../../utils/stream', () => ({
  streamOpenAIResponse: jest.fn(),
}));

// Mock the log module
jest.mock('../../utils/log', () => ({
  logWithConfig: jest.fn(),
}));

describe('模型名称修复测试', () => {
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

  describe('provider ID 到真实模型名称的转换', () => {
    it('应该将 provider ID 转换为真实的 API 模型名称', async () => {
      // 准备测试数据 - 模拟配置中的真实情况
      mockReq = {
        body: {
          model: 'qwen-32b-standard', // 这是 router 设置的 provider ID
          messages: [{ role: 'user', content: 'test message' }],
          stream: false,
        },
        provider: 'qwen-32b-standard',
        config: {
          providers: [
            {
              id: 'qwen-32b-standard',
              api_base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
              api_key: 'sk-test-key',
              model: 'qwen3-30b-a3b' // 这是真实的 API 模型名称
            }
          ]
        },
        cwd: '/test'
      };

      await formatRequest(mockReq as Request, mockRes as Response, mockNext);

      // 验证模型名称被正确转换
      expect(mockReq.body.model).toBe('qwen3-30b-a3b');
      expect(mockNext).toHaveBeenCalled();
    });

    it('应该正确处理 think provider 的模型名称转换', async () => {
      mockReq = {
        body: {
          model: 'qwen-32b-thinker',
          messages: [{ role: 'user', content: 'test thinking message' }],
          stream: false,
        },
        provider: 'qwen-32b-thinker',
        config: {
          providers: [
            {
              id: 'qwen-32b-thinker',
              api_base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
              api_key: 'sk-test-key',
              model: 'qwen3-30b-a3b',
              extra_body: {
                enable_thinking: true,
                thinking_budget: 16384
              }
            }
          ],
          Router: {
            think: 'qwen-32b-thinker'
          }
        },
        cwd: '/test'
      };

      await formatRequest(mockReq as Request, mockRes as Response, mockNext);

      // 验证 think provider 的模型名称也被正确转换
      expect(mockReq.body.model).toBe('qwen3-30b-a3b');
      expect(mockReq.body.extra_body).toEqual({
        enable_thinking: true,
        thinking_budget: 16384
      });
    });

    it('当找不到对应 provider 时应该保持原始模型名称', async () => {
      mockReq = {
        body: {
          model: 'unknown-provider',
          messages: [{ role: 'user', content: 'test message' }],
          stream: false,
        },
        provider: 'unknown-provider',
        config: {
          providers: [
            {
              id: 'different-provider',
              api_base_url: 'https://example.com/v1',
              api_key: 'sk-test-key',
              model: 'different-model'
            }
          ]
        },
        cwd: '/test'
      };

      await formatRequest(mockReq as Request, mockRes as Response, mockNext);

      // 验证当找不到对应 provider 时保持原始模型名称
      expect(mockReq.body.model).toBe('unknown-provider');
    });
  });

  describe('完整的路由和格式化流程测试', () => {
    it('应该模拟完整的请求处理流程', async () => {
      // 模拟从 router 中间件传递过来的请求
      mockReq = {
        body: {
          model: 'qwen-32b-standard', // router 设置的 provider ID
          messages: [
            { role: 'user', content: 'Hello, how are you?' }
          ],
          temperature: 0.7,
          stream: false,
        },
        provider: 'qwen-32b-standard', // router 设置的 provider
        config: {
          providers: [
            {
              id: 'qwen-32b-standard',
              api_base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
              api_key: 'sk-test-key',
              model: 'qwen3-30b-a3b'
            },
            {
              id: 'qwen-32b-thinker',
              api_base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
              api_key: 'sk-test-key',
              model: 'qwen3-30b-a3b',
              extra_body: {
                enable_thinking: true
              }
            }
          ],
          Router: {
            default: 'qwen-32b-standard',
            think: 'qwen-32b-thinker'
          }
        },
        cwd: '/test'
      };

      await formatRequest(mockReq as Request, mockRes as Response, mockNext);

      // 验证最终的请求体包含正确的模型名称
      expect(mockReq.body.model).toBe('qwen3-30b-a3b');
      expect(mockReq.body.messages).toHaveLength(1);
      expect(mockReq.body.temperature).toBe(0.7);
      expect(mockNext).toHaveBeenCalled();
    });
  });
}); 