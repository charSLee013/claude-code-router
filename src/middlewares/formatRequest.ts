import { Request, Response, NextFunction } from "express";
import { MessageCreateParamsBase } from "@anthropic-ai/sdk/resources/messages";
import OpenAI from "openai";
import { streamOpenAIResponse } from "../utils/stream";
import { logWithConfig } from "../utils/log";

// 扩展 Express 的 Request 类型，添加 _simulate_non_stream 属性
declare global {
  namespace Express {
    interface Request {
      _simulate_non_stream?: boolean;
      cwd?: string;
    }
  }
}

export const formatRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // 创建便捷的日志函数
  const log = (...args: any[]) => {
    if (req.cwd && req.config) {
      logWithConfig(req.cwd, req.config, ...args);
    }
  };

  let {
    model,
    max_tokens,
    messages,
    system = [],
    temperature,
    metadata,
    tools,
    stream,
  }: MessageCreateParamsBase = req.body;
  log("formatRequest: ", req.body);
  try {
    // @ts-ignore
    const openAIMessages = Array.isArray(messages)
      ? messages.flatMap((anthropicMessage) => {
          const openAiMessagesFromThisAnthropicMessage = [];

          if (!Array.isArray(anthropicMessage.content)) {
            // Handle simple string content
            if (typeof anthropicMessage.content === "string") {
              openAiMessagesFromThisAnthropicMessage.push({
                role: anthropicMessage.role,
                content: anthropicMessage.content,
              });
            }
            // If content is not string and not array (e.g. null/undefined), it will result in an empty array, effectively skipping this message.
            return openAiMessagesFromThisAnthropicMessage;
          }

          // Handle array content
          if (anthropicMessage.role === "assistant") {
            const assistantMessage = {
              role: "assistant",
              content: null, // Will be populated if text parts exist
            };
            let textContent = "";
            // @ts-ignore
            const toolCalls = []; // Corrected type here

            anthropicMessage.content.forEach((contentPart) => {
              if (contentPart.type === "text") {
                textContent +=
                  (typeof contentPart.text === "string"
                    ? contentPart.text
                    : JSON.stringify(contentPart.text)) + "\\n";
              } else if (contentPart.type === "tool_use") {
                toolCalls.push({
                  id: contentPart.id,
                  type: "function",
                  function: {
                    name: contentPart.name,
                    arguments: JSON.stringify(contentPart.input),
                  },
                });
              }
            });

            const trimmedTextContent = textContent.trim();
            if (trimmedTextContent.length > 0) {
              // @ts-ignore
              assistantMessage.content = trimmedTextContent;
            }
            if (toolCalls.length > 0) {
              // @ts-ignore
              assistantMessage.tool_calls = toolCalls;
            }
            // @ts-ignore
            if (
              assistantMessage.content ||
              // @ts-ignore
              (assistantMessage.tool_calls &&
                // @ts-ignore
                assistantMessage.tool_calls.length > 0)
            ) {
              openAiMessagesFromThisAnthropicMessage.push(assistantMessage);
            }
          } else if (anthropicMessage.role === "user") {
            // For user messages, text parts are combined into one message.
            // Tool results are transformed into subsequent, separate 'tool' role messages.
            let userTextMessageContent = "";
            // @ts-ignore
            const subsequentToolMessages = [];

            anthropicMessage.content.forEach((contentPart) => {
              if (contentPart.type === "text") {
                userTextMessageContent +=
                  (typeof contentPart.text === "string"
                    ? contentPart.text
                    : JSON.stringify(contentPart.text)) + "\\n";
              } else if (contentPart.type === "tool_result") {
                // Each tool_result becomes a separate 'tool' message
                subsequentToolMessages.push({
                  role: "tool",
                  tool_call_id: contentPart.tool_use_id,
                  content:
                    typeof contentPart.content === "string"
                      ? contentPart.content
                      : JSON.stringify(contentPart.content),
                });
              }
            });

            const trimmedUserText = userTextMessageContent.trim();
            if (trimmedUserText.length > 0) {
              openAiMessagesFromThisAnthropicMessage.push({
                role: "user",
                content: trimmedUserText,
              });
            }
            // @ts-ignore
            openAiMessagesFromThisAnthropicMessage.push(
              // @ts-ignore
              ...subsequentToolMessages
            );
          } else {
            // Fallback for other roles (e.g. system, or custom roles if they were to appear here with array content)
            // This will combine all text parts into a single message for that role.
            let combinedContent = "";
            anthropicMessage.content.forEach((contentPart) => {
              if (contentPart.type === "text") {
                combinedContent +=
                  (typeof contentPart.text === "string"
                    ? contentPart.text
                    : JSON.stringify(contentPart.text)) + "\\n";
              } else {
                // For non-text parts in other roles, stringify them or handle as appropriate
                combinedContent += JSON.stringify(contentPart) + "\\n";
              }
            });
            const trimmedCombinedContent = combinedContent.trim();
            if (trimmedCombinedContent.length > 0) {
              openAiMessagesFromThisAnthropicMessage.push({
                role: anthropicMessage.role, // Cast needed as role could be other than 'user'/'assistant'
                content: trimmedCombinedContent,
              });
            }
          }
          return openAiMessagesFromThisAnthropicMessage;
        })
      : [];
    const systemMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      Array.isArray(system)
        ? system.map((item) => ({
            role: "system",
            content: item.text,
          }))
        : [{ role: "system", content: system }];
    const data: any = {
      model,
      messages: [...systemMessages, ...openAIMessages],
      temperature,
      stream,
    };
    if (tools) {
      data.tools = tools
        .filter((tool) => !["StickerRequest"].includes(tool.name))
        .map((item: any) => ({
          type: "function",
          function: {
            name: item.name,
            description: item.description,
            parameters: item.input_schema,
          },
        }));
    }
    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
    }
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    
    // 获取当前 provider 的配置
    const currentProvider = req.config?.providers?.find((p: { id: string }) => p.id === req.provider);

    // 确定真实的模型名称
    const realModelName = currentProvider?.model || model;

    // 更新 data 对象中的模型名称为真实模型名称
    data.model = realModelName;

    // 合并请求中的 extra_body 和 provider 配置中的 extra_body
    const initialExtraBody = req.body.extra_body || {};
    const providerExtraBody = currentProvider?.extra_body || {};
    const mergedExtraBody = { ...initialExtraBody, ...providerExtraBody };

    if (Object.keys(mergedExtraBody).length > 0) {
      data.extra_body = mergedExtraBody;
      log(`添加 extra_body 参数: ${JSON.stringify(data.extra_body)}`);
    }

    // 如果是思考请求且需要强制流式传输
    const isThinkRequest = req.provider === req.config?.Router?.think;
    const hasThinkingField = req.body.thinking === true;
    const hasThinkingInExtraBody = mergedExtraBody.enable_thinking === true;
    
    log(`[思考模式检测] req.provider="${req.provider}", config.Router.think="${req.config?.Router?.think}", isThinkRequest=${isThinkRequest}`);
    log(`[思考模式检测] hasThinkingField=${hasThinkingField}, hasThinkingInExtraBody=${hasThinkingInExtraBody}`);
    log(`[配置检查] currentProvider存在=${!!currentProvider}, force_stream_for_thinking=${currentProvider?.force_stream_for_thinking}, 原始stream=${data.stream}`);
    
    // 综合判断是否为思考请求（需要满足路由条件或明确的thinking标志）
    const shouldForceStream = (isThinkRequest || hasThinkingField) && 
                              currentProvider?.force_stream_for_thinking && 
                              !data.stream;
    
    if (shouldForceStream) {
      // 记录原始的非流式请求状态
      req._simulate_non_stream = true;
      // 强制开启流式
      data.stream = true;
      log(`[强制流式转换] 已将非流式请求转换为流式处理，provider: ${req.provider}`);
      log(`[强制流式转换] _simulate_non_stream标志已设置为true，将在响应时聚合返回`);
    } else if ((isThinkRequest || hasThinkingField || hasThinkingInExtraBody) && !currentProvider?.force_stream_for_thinking) {
      log(`[思考模式警告] 检测到思考请求但未配置force_stream_for_thinking，可能导致API错误`);
      log(`[思考模式警告] 建议在provider配置中添加 "force_stream_for_thinking": true`);
    } else if (!isThinkRequest && !hasThinkingField && data.stream === false) {
      log(`[常规请求] 非思考请求，保持原始流式设置: ${data.stream}`);
    }
    
    req.body = data;
    console.log(JSON.stringify(data.messages, null, 2));
  } catch (error) {
    console.error("Error in request processing:", error);
    
    // 检查是否是超时错误
    let errorMessage = (error as Error).message;
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      errorMessage = `API 请求超时 (${req.config?.timeout || 30000}ms)，请检查网络连接或增加超时设置`;
    }
    
    // 确定真实的模型名称用于错误处理
    const currentProvider = req.config?.providers?.find((p: { id: string }) => p.id === req.provider);
    const realModelName = currentProvider?.model || model;
    
    const errorCompletion: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk> =
      {
        async *[Symbol.asyncIterator]() {
          yield {
            id: `error_${Date.now()}`,
            created: Math.floor(Date.now() / 1000),
            model: realModelName,
            object: "chat.completion.chunk",
            choices: [
              {
                index: 0,
                delta: {
                  content: `Error: ${errorMessage}`,
                },
                finish_reason: "stop",
              },
            ],
          };
        },
      };
    await streamOpenAIResponse(res, errorCompletion, realModelName, req.body, req);
  }
  next();
};
