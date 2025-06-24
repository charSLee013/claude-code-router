import { MessageCreateParamsBase } from "@anthropic-ai/sdk/resources/messages";
import { Request, Response, NextFunction } from "express";
import { get_encoding } from "tiktoken";
import { log } from "../utils/log";

const enc = get_encoding("cl100k_base");

const getUseModel = (req: Request, tokenCount: number) => {
  // if tokenCount is greater than 32K, use the long context model
  if (tokenCount > 1000 * 32) {
    log("Using long context model due to token count:", tokenCount);
    const modelId = req.config.Router!.longContext;
    return {
      provider: modelId,
      model: modelId,
    };
  }
  // If the model is claude-3-5-haiku, use the background model
  if (req.body.model?.startsWith("claude-3-5-haiku")) {
    log("Using background model for ", req.body.model);
    const modelId = req.config.Router!.background;
    return {
      provider: modelId,
      model: modelId,
    };
  }
  // if exits thinking, use the think model
  if (req.body.thinking) {
    log("Using think model for ", req.body.thinking);
    const modelId = req.config.Router!.think;
    return {
      provider: modelId,
      model: modelId,
    };
  }
  const [provider, model] = req.body.model.split(",");
  if (provider && model) {
    return {
      provider,
      model,
    };
  }
  // Use Router.default as fallback
  const defaultModelId = req.config.Router?.default;
  if (defaultModelId) {
    log("Using default router model:", defaultModelId);
    return {
      provider: defaultModelId,
      model: defaultModelId,
    };
  }
  // Final fallback to "default" provider if Router.default is not configured
  return {
    provider: "default",
    model: req.config.OPENAI_MODEL,
  };
};

export const router = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { messages, system = [], tools }: MessageCreateParamsBase = req.body;
  try {
    let tokenCount = 0;
    if (Array.isArray(messages)) {
      messages.forEach((message) => {
        if (typeof message.content === "string") {
          tokenCount += enc.encode(message.content).length;
        } else if (Array.isArray(message.content)) {
          message.content.forEach((contentPart) => {
            if (contentPart.type === "text") {
              tokenCount += enc.encode(contentPart.text).length;
            } else if (contentPart.type === "tool_use") {
              tokenCount += enc.encode(
                JSON.stringify(contentPart.input)
              ).length;
            } else if (contentPart.type === "tool_result") {
              const content = contentPart.content;
              if (typeof content === "string") {
                tokenCount += enc.encode(content).length;
              }
            }
          });
        }
      });
    }
    if (typeof system === "string") {
      tokenCount += enc.encode(system).length;
    } else if (Array.isArray(system)) {
      system.forEach((item) => {
        if (item.type !== "text") return;
        if (typeof item.text === "string") {
          tokenCount += enc.encode(item.text).length;
        } else if (Array.isArray(item.text)) {
          (item.text as any[]).forEach((textPart: any) => {
            tokenCount += enc.encode(textPart || "").length;
          });
        }
      });
    }
    if (tools) {
      tools.forEach((tool: any) => {
        if (tool.description) {
          tokenCount += enc.encode(tool.name + tool.description).length;
        }
        if (tool.input_schema) {
          tokenCount += enc.encode(JSON.stringify(tool.input_schema)).length;
        }
      });
    }
    const { provider, model } = getUseModel(req, tokenCount);
    req.provider = provider;
    req.body.model = model;
  } catch (error: any) {
    log("Error in router middleware:", error.message);
    req.provider = "default";
    req.body.model = req.config.OPENAI_MODEL;
  } finally {
    next();
  }
};
