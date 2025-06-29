/**
 * 响应格式化工具模块
 * 专门处理 OpenAI 格式到 Anthropic 格式的转换，确保数据类型一致性
 */

import { logWithConfig } from "./log";
import { isArrayLike } from "./dataTransform";

export interface AnthropicToolUse {
  type: "tool_use";
  id: string;
  name: string;
  input: any;
}

export interface AnthropicResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: string | AnthropicToolUse[];
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface OpenAIToolCall {
  id: string;
  type: string;
  function: {
    name?: string;
    arguments: string | any;
  };
}

/**
 * 将 OpenAI 格式的响应转换为 Anthropic 格式
 * @param openAIResponse OpenAI API 的响应对象
 * @param messageId 消息ID
 * @param cwd 当前工作目录（用于日志）
 * @param config 配置对象（用于日志）
 * @returns 标准化的 Anthropic 格式响应
 */
export function formatAnthropicResponse(
  openAIResponse: any,
  messageId: string,
  cwd?: string,
  config?: any
): AnthropicResponse {
  // 便捷日志函数
  const log = (...args: any[]) => {
    if (cwd && config) {
      logWithConfig(cwd, config, "[ResponseFormat]", ...args);
    }
  };

  log("开始格式化OpenAI响应为Anthropic格式");
  
  // 安全获取响应数据
  const choice = openAIResponse.choices?.[0];
  if (!choice) {
    log("警告：OpenAI响应中没有choices数据，返回空响应");
    return createEmptyResponse(messageId);
  }

  const message = choice.message;
  const finishReason = choice.finish_reason;
  
  // 处理content字段
  let content: string | AnthropicToolUse[];
  
  // 优先处理工具调用
  if (message.tool_calls && isArrayLike(message.tool_calls) && message.tool_calls.length > 0) {
    log("检测到工具调用，转换为Anthropic格式");
    content = convertToolCalls(message.tool_calls, log);
  } else {
    // 处理文本内容
    content = message.content || "";
    log("处理文本内容，长度:", content.length);
  }

  // 确定停止原因
  const stopReason = finishReason === 'tool_calls' ? "tool_use" : "end_turn";
  
  log("格式化完成，content类型:", Array.isArray(content) ? "array" : "string");

  return {
    id: messageId,
    type: "message",
    role: "assistant",
    content: content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: openAIResponse.usage?.prompt_tokens || 100,
      output_tokens: openAIResponse.usage?.completion_tokens || 50,
    },
  };
}

/**
 * 将 OpenAI 工具调用转换为 Anthropic 格式
 * @param toolCalls OpenAI 格式的工具调用数组
 * @param log 日志函数
 * @returns Anthropic 格式的工具使用数组
 */
function convertToolCalls(
  toolCalls: OpenAIToolCall[],
  log: (...args: any[]) => void
): AnthropicToolUse[] {
  // 安全地处理工具调用数组
  if (!isArrayLike(toolCalls)) {
    log("工具调用不是数组格式，返回空数组");
    return [];
  }
  
  return toolCalls.map((toolCall: any, index: number) => {
    try {
      // 安全解析参数
      let input = {};
      if (toolCall.function?.arguments) {
        if (typeof toolCall.function.arguments === 'string') {
          try {
            input = JSON.parse(toolCall.function.arguments);
          } catch (e) {
            log("工具调用参数JSON解析失败，索引:", index, "错误:", e instanceof Error ? e.message : String(e));
            input = {};
          }
        } else {
          input = toolCall.function.arguments;
        }
      }

      return {
        type: "tool_use" as const,
        id: toolCall.id || `tool_${Date.now()}_${index}`,
        name: toolCall.function?.name || "unknown_tool",
        input: input,
      };
    } catch (e) {
      log("转换工具调用失败，索引:", index, "错误:", e instanceof Error ? e.message : String(e));
      return {
        type: "tool_use" as const,
        id: `tool_error_${Date.now()}_${index}`,
        name: "error_tool",
        input: {},
      };
    }
  });
}

/**
 * 创建空的 Anthropic 响应
 * @param messageId 消息ID
 * @returns 空的响应对象
 */
function createEmptyResponse(messageId: string): AnthropicResponse {
  return {
    id: messageId,
    type: "message",
    role: "assistant",
    content: "",
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: 0,
      output_tokens: 0,
    },
  };
}

/**
 * 聚合流式响应块为完整响应
 * @param chunks 流式响应块数组
 * @param messageId 消息ID
 * @param cwd 当前工作目录（用于日志）
 * @param config 配置对象（用于日志）
 * @returns 聚合后的 Anthropic 格式响应
 */
export function aggregateStreamChunks(
  chunks: any[],
  messageId: string,
  cwd?: string,
  config?: any
): AnthropicResponse {
  // 便捷日志函数
  const log = (...args: any[]) => {
    if (cwd && config) {
      logWithConfig(cwd, config, "[StreamAggregator]", ...args);
    }
  };

  log("开始聚合", chunks.length, "个流式数据块");

  let mergedContent = "";
  let toolCalls: OpenAIToolCall[] = [];
  let finishReason = "end_turn";
  let validChunksProcessed = 0;

  for (const chunk of chunks) {
    try {
      // 检查数据块的有效性
      if (!chunk || typeof chunk !== 'object') {
        log("跳过无效数据块:", chunk);
        continue;
      }

      const delta = chunk.choices?.[0]?.delta;
      if (!delta) {
        log("跳过没有delta的数据块");
        continue;
      }

      validChunksProcessed++;

      // 收集文本内容
      if (delta.content) {
        mergedContent += delta.content;
        log("收集文本内容:", delta.content);
      }

      // 收集工具调用
      if (delta.tool_calls && isArrayLike(delta.tool_calls)) {
        for (const toolCall of delta.tool_calls) {
          const existingToolCall = toolCalls.find(t => t.id === toolCall.id);
          if (existingToolCall) {
            // 合并参数
            if (toolCall.function?.arguments) {
              existingToolCall.function.arguments += toolCall.function.arguments;
            }
          } else if (toolCall.id) {
            // 添加新的工具调用
            toolCalls.push({
              id: toolCall.id,
              type: "function",
              function: {
                name: toolCall.function?.name,
                arguments: toolCall.function?.arguments || ""
              }
            });
          }
        }
        finishReason = "tool_use";
      }

      // 检查完成原因
      if (chunk.choices?.[0]?.finish_reason) {
        finishReason = chunk.choices[0].finish_reason === 'tool_calls' ? "tool_use" : "end_turn";
      }
    } catch (e) {
      log("处理数据块失败:", e instanceof Error ? e.message : String(e));
    }
  }

  log("聚合统计: 总数据块", chunks.length, "有效数据块", validChunksProcessed);

  // 构造响应
  let content: string | AnthropicToolUse[];
  
  if (toolCalls.length > 0) {
    content = convertToolCalls(toolCalls, log);
    log("聚合完成，构造工具调用响应，包含", toolCalls.length, "个工具");
  } else {
    content = mergedContent;
    log("聚合完成，构造文本响应，长度:", content.length);
  }

  return {
    id: messageId,
    type: "message",
    role: "assistant",
    content: content,
    stop_reason: finishReason,
    stop_sequence: null,
    usage: {
      input_tokens: 100,
      output_tokens: Math.max(chunks.length * 5, 1), // 确保至少有1个token
    },
  };
} 