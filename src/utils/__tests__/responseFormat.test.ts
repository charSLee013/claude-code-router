/**
 * responseFormat 模块的单元测试
 * 专门测试 OpenAI 到 Anthropic 格式转换的正确性
 */

import { formatAnthropicResponse, aggregateStreamChunks } from '../responseFormat';

describe('responseFormat', () => {
  describe('formatAnthropicResponse', () => {
    it('应该正确处理工具调用响应', () => {
      const openAIResponse = {
        choices: [{
          message: {
            content: null,
            tool_calls: [{
              id: 'call_123',
              type: 'function',
              function: {
                name: 'test_function',
                arguments: '{"param": "value"}'
              }
            }]
          },
          finish_reason: 'tool_calls'
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50
        }
      };

      const result = formatAnthropicResponse(openAIResponse, 'test_msg_123');

      expect(result.content).toBeInstanceOf(Array);
      expect(result.content).toHaveLength(1);
      expect((result.content as any[])[0]).toMatchObject({
        type: 'tool_use',
        id: 'call_123',
        name: 'test_function',
        input: { param: 'value' }
      });
      expect(result.stop_reason).toBe('tool_use');
    });

    it('应该正确处理文本响应', () => {
      const openAIResponse = {
        choices: [{
          message: {
            content: 'This is a text response',
            tool_calls: null
          },
          finish_reason: 'stop'
        }]
      };

      const result = formatAnthropicResponse(openAIResponse, 'test_msg_456');

      expect(typeof result.content).toBe('string');
      expect(result.content).toBe('This is a text response');
      expect(result.stop_reason).toBe('end_turn');
    });

    it('应该处理空响应不抛出"A.map is not a function"错误', () => {
      const openAIResponse = {
        choices: [{
          message: {
            content: null,
            tool_calls: null
          },
          finish_reason: 'stop'
        }]
      };

      const result = formatAnthropicResponse(openAIResponse, 'test_msg_789');

      expect(typeof result.content).toBe('string');
      expect(result.content).toBe('');
      expect(result.stop_reason).toBe('end_turn');
    });

    it('应该处理无效的 tool_calls 数据', () => {
      const openAIResponse = {
        choices: [{
          message: {
            content: null,
            tool_calls: "invalid_string_instead_of_array" // 这种情况可能导致 "A.map is not a function"
          },
          finish_reason: 'tool_calls'
        }]
      };

      expect(() => {
        const result = formatAnthropicResponse(openAIResponse, 'test_msg_error');
        // 应该安全处理，不抛出错误
        expect(typeof result.content).toBe('string');
      }).not.toThrow();
    });

    it('应该处理 JSON 解析失败的工具参数', () => {
      const openAIResponse = {
        choices: [{
          message: {
            content: null,
            tool_calls: [{
              id: 'call_invalid',
              type: 'function',
              function: {
                name: 'test_function',
                arguments: '{invalid json' // 无效的 JSON
              }
            }]
          },
          finish_reason: 'tool_calls'
        }]
      };

      const result = formatAnthropicResponse(openAIResponse, 'test_msg_json_error');

      expect(result.content).toBeInstanceOf(Array);
      expect((result.content as any[])[0].input).toEqual({});
    });
  });

  describe('aggregateStreamChunks', () => {
    it('应该正确聚合流式工具调用响应', () => {
      const chunks = [
        {
          choices: [{
            delta: {
              tool_calls: [{
                id: 'call_stream_123',
                function: {
                  name: 'stream_function',
                  arguments: '{"pa'
                }
              }]
            }
          }]
        },
        {
          choices: [{
            delta: {
              tool_calls: [{
                id: 'call_stream_123',
                function: {
                  arguments: 'ram": "value"}'
                }
              }]
            }
          }]
        },
        {
          choices: [{
            finish_reason: 'tool_calls'
          }]
        }
      ];

      const result = aggregateStreamChunks(chunks, 'stream_msg_123');

      expect(result.content).toBeInstanceOf(Array);
      expect((result.content as any[])[0]).toMatchObject({
        type: 'tool_use',
        id: 'call_stream_123',
        name: 'stream_function',
        input: { param: 'value' }
      });
    });

    it('应该正确聚合流式文本响应', () => {
      const chunks = [
        {
          choices: [{
            delta: { content: 'Hello ' }
          }]
        },
        {
          choices: [{
            delta: { content: 'World!' }
          }]
        },
        {
          choices: [{
            finish_reason: 'stop'
          }]
        }
      ];

      const result = aggregateStreamChunks(chunks, 'stream_msg_456');

      expect(typeof result.content).toBe('string');
      expect(result.content).toBe('Hello World!');
    });

    it('应该安全处理无效的数据块', () => {
      const chunks = [
        null,
        undefined,
        { invalid: 'chunk' },
        {
          choices: [{
            delta: { content: 'Valid content' }
          }]
        }
      ];

      expect(() => {
        const result = aggregateStreamChunks(chunks, 'stream_msg_safe');
        expect(typeof result.content).toBe('string');
        expect(result.content).toBe('Valid content');
      }).not.toThrow();
    });
  });

  describe('防止 "A.map is not a function" 错误', () => {
    it('应该处理各种异常的 tool_calls 格式', () => {
      const testCases = [
        null,
        undefined,
        'string_instead_of_array',
        123,
        {},
        []
      ];

      testCases.forEach((toolCalls, index) => {
        const openAIResponse = {
          choices: [{
            message: {
              content: null,
              tool_calls: toolCalls
            },
            finish_reason: 'stop'
          }]
        };

        expect(() => {
          const result = formatAnthropicResponse(openAIResponse, `test_${index}`);
          // 所有情况都应该安全处理，返回字符串类型的content
          expect(typeof result.content).toBe('string');
        }).not.toThrow();
      });
    });

    it('应该处理各种异常的流式数据块', () => {
      const invalidChunks = [
        { choices: [{ delta: { tool_calls: 'not_array' } }] },
        { choices: [{ delta: { tool_calls: 123 } }] },
        { choices: [{ delta: { tool_calls: {} } }] },
        { malformed: 'chunk' }
      ];

      expect(() => {
        const result = aggregateStreamChunks(invalidChunks, 'safe_test');
        // 应该返回安全的默认值
        expect(typeof result.content === 'string' || Array.isArray(result.content)).toBe(true);
      }).not.toThrow();
    });
  });
}); 