import { existsSync } from "fs";
import { writeFile } from "fs/promises";
import { getOpenAICommonOptions } from "./utils";
import { createServer } from "./server";
import { formatRequest } from "./middlewares/formatRequest";
import { rewriteBody } from "./middlewares/rewriteBody";
import { router } from "./middlewares/router";
import OpenAI from "openai";
import { streamOpenAIResponse } from "./utils/stream";
import {
  cleanupServiceState,
  isServiceRunning,
  saveServiceState,
} from "./utils/processCheck";
import { LRUCache } from "lru-cache";
import { log } from "./utils/log";
import { loadConfig, ensureWorkspaceDir, validateThinkingModeConfig, Config } from "./utils/config";
import { findAvailablePort, findRandomAvailablePort } from "./utils/port";

// TypeScript interface extensions for custom Request properties
declare global {
  namespace Express {
    interface Request {
      config?: Config;
      provider?: string;
    }
  }
}

async function initializeClaudeConfig() {
  const homeDir = process.env.HOME;
  const configPath = `${homeDir}/.claude.json`;
  if (!existsSync(configPath)) {
    const userID = Array.from(
      { length: 64 },
      () => Math.random().toString(16)[2]
    ).join("");
    const configContent = {
      numStartups: 184,
      autoUpdaterStatus: "enabled",
      userID,
      hasCompletedOnboarding: true,
      lastOnboardingVersion: "1.0.17",
      projects: {},
    };
    await writeFile(configPath, JSON.stringify(configContent, null, 2));
  }
}

async function initDir() {
  // This function is kept for compatibility but may be empty
  // Workspace-specific directory initialization is handled by ensureWorkspaceDir
}

interface RunOptions {
  port?: number;
}

interface ModelProvider {
  id: string;
  api_base_url: string;
  api_key: string;
  model: string;
}

async function run(cwd: string, options: RunOptions = {}) {
  // Check if service is already running for this workspace
  if (isServiceRunning(cwd)) {
    console.log("✅ Service is already running in the background for this workspace.");
    return;
  }

  // Ensure workspace directory structure exists
  ensureWorkspaceDir(cwd);

  await initializeClaudeConfig();
  await initDir();
  
  // Load configuration using the new three-tier system
  const config = loadConfig(cwd);

  // 验证思考模式配置
  console.log("🔍 验证思考模式配置...");
  const validation = validateThinkingModeConfig(config);
  
  if (validation.errors.length > 0) {
    console.error("❌ 配置错误:");
    validation.errors.forEach(error => console.error(`   - ${error}`));
    console.error("请修复配置错误后重新启动服务");
    return;
  }
  
  if (validation.warnings.length > 0) {
    console.warn("⚠️  配置警告:");
    validation.warnings.forEach(warning => console.warn(`   - ${warning}`));
    console.warn("服务将继续启动，但建议修复上述配置问题");
  }
  
  if (validation.errors.length === 0 && validation.warnings.length === 0) {
    console.log("✅ 配置验证通过");
  }

  const Providers = new Map<string, ModelProvider>();
  const providerCache = new LRUCache<string, OpenAI>({
    max: 10,
    ttl: 2 * 60 * 60 * 1000,
  });

  function getProviderInstance(providerName: string): OpenAI {
    const provider: ModelProvider | undefined = Providers.get(providerName);
    if (provider === undefined) {
      throw new Error(`Provider ${providerName} not found`);
    }
    let openai = providerCache.get(provider.id);
    if (!openai) {
      openai = new OpenAI({
        baseURL: provider.api_base_url,
        apiKey: provider.api_key,
        ...getOpenAICommonOptions(config),
      });
      providerCache.set(provider.id, openai);
    }
    return openai;
  }

  if (Array.isArray(config.providers)) {
    config.providers.forEach((provider: ModelProvider) => {
      try {
        Providers.set(provider.id, provider);
      } catch (error) {
        console.error("Failed to parse model provider:", error);
      }
    });
  }

  if (config.OPENAI_API_KEY && config.OPENAI_BASE_URL && config.OPENAI_MODEL) {
    const defaultProvider = {
      id: "default",
      api_base_url: config.OPENAI_BASE_URL,
      api_key: config.OPENAI_API_KEY,
      model: config.OPENAI_MODEL,
    };
    Providers.set("default", defaultProvider);
  } else if (Providers.size > 0) {
    const defaultProvider = Providers.values().next().value!;
    Providers.set("default", defaultProvider);
  }

  // Use dynamic port allocation
  const basePort = options.port || config.basePort || 3456;
  const allocatedPort = await findRandomAvailablePort(basePort, 65535);

  // Save the service state (PID and port) for this workspace
  saveServiceState(cwd, process.pid, allocatedPort);

  // Handle SIGINT (Ctrl+C) to clean up workspace state
  process.on("SIGINT", () => {
    console.log("Received SIGINT, cleaning up workspace state...");
    cleanupServiceState(cwd);
    process.exit(0);
  });

  // Handle SIGTERM to clean up workspace state
  process.on("SIGTERM", () => {
    cleanupServiceState(cwd);
    process.exit(0);
  });

  const server = await createServer({
    port: allocatedPort,
    cwd: cwd,
    config: config
  });
  server.useMiddleware((req, res, next) => {
    console.log("Middleware triggered for request:", req.body.model);
    req.config = config;
    next();
  });
  server.useMiddleware(rewriteBody);
  if (
    config.Router?.background &&
    config.Router?.think &&
    config?.Router?.longContext
  ) {
    server.useMiddleware(router);
  } else {
    // Always use router middleware to handle routing logic
    server.useMiddleware(router);
  }
  server.useMiddleware(formatRequest);

  server.app.post("/v1/messages", async (req, res) => {
    try {
      const provider = getProviderInstance(req.provider || "default");
      const completion: any = await provider.chat.completions.create(req.body);
      await streamOpenAIResponse(res, completion, req.body.model, req.body, req);
    } catch (e) {
      console.error("Error in OpenAI API call:", e);
    }
  });
  server.start();
  console.log(`🚀 Claude Code Router is running on port ${allocatedPort} for workspace: ${cwd}`);
}

export { run };
