# Claude Code Bridge (CCB) 深度解析与高级指南

本文档提供 Claude Code Bridge 的深入技术解析，涵盖核心架构、配置系统、工作区管理、高级定制开发以及调试方法。本指南基于最新的实现，为开发者和高级用户提供完整的技术参考。

## 核心概念：工作区级智能代理架构

Claude Code Bridge (CCB) 是一个**工作区级的智能代理服务器**，它为每个项目目录提供独立的服务实例，实现真正的项目隔离和个性化配置。

### 架构特点

1. **工作区隔离**: 每个项目目录运行独立的服务进程，拥有独立的配置、日志和状态管理
2. **智能路由**: 根据请求特征自动选择最合适的 LLM 模型
3. **动态端口分配**: 自动分配随机可用端口，避免项目间冲突
4. **三层配置系统**: 灵活的配置优先级管理，支持全局、工作区和环境变量配置

### 工作原理

当您在项目目录中执行 `ccb code "your prompt"` 时，CCB 会：

1. **检查工作区服务**: 确认当前工作区是否已有运行的服务实例
2. **启动独立服务**: 如果没有，则为当前工作区启动独立的代理服务
3. **加载配置**: 按优先级加载环境变量、工作区配置和全局配置
4. **分配端口**: 随机分配可用端口并保存到工作区状态文件
5. **路由请求**: 根据请求特征智能选择合适的 LLM 提供商
6. **返回结果**: 将响应流式传输回 Claude Code 客户端

---

## 三层配置系统深度解析

CCB 实现了灵活的三层配置系统，提供强大的配置管理能力。

### 配置优先级

1. **环境变量** (最高优先级)
2. **工作区配置**: `<project-dir>/.claude/ccb-config.json`
3. **全局配置**: `~/.claude/ccb-config.json` (最低优先级)

### 配置加载机制

**关键代码** (`src/utils/config.ts`):
```typescript
export function loadConfig(cwd: string): any {
  // 1. 加载默认配置
  let config = { ...DEFAULT_CONFIG };
  
  // 2. 合并全局配置
  const globalConfig = loadGlobalConfig();
  if (globalConfig) {
    config = { ...config, ...globalConfig };
  }
  
  // 3. 合并工作区配置  
  const workspaceConfig = loadWorkspaceConfig(cwd);
  if (workspaceConfig) {
    config = { ...config, ...workspaceConfig };
  }
  
  // 4. 应用环境变量（最高优先级）
  applyEnvironmentVariables(config);
  
  return config;
}
```

### 工作区目录结构

```
your-project/
├── .claude/
│   ├── ccb-config.json      # 工作区配置文件
│   ├── service.log      # 服务日志文件
│   └── service.json     # 服务状态文件
├── .gitignore           # 自动更新以忽略 .claude/ 目录
└── your-source-files/
```

### 配置文件格式

#### 基础配置选项

```json
{
  "OPENAI_API_KEY": "sk-xxx",
  "OPENAI_BASE_URL": "https://api.deepseek.com",
  "OPENAI_MODEL": "deepseek-chat",
  "basePort": 3456,
  "timeout": 30000,
  "maxRetries": 3,
  "logEnabled": false,
  "autoStart": false
}
```

#### 高级路由配置

```json
{
  "providers": [
    {
      "id": "local-qwen",
      "api_base_url": "http://localhost:11434/v1",
      "api_key": "ollama",
      "model": "qwen2.5-coder:latest",
      "extra_body": {
        "enable_thinking": true,
        "temperature": 0.1
      },
      "force_stream_for_thinking": true
    }
  ],
  "Router": {
    "background": "local-qwen",
    "think": "deepseek-reasoner", 
    "longContext": "gemini-2.5-pro"
  }
}
```

---

## 智能路由系统详解

### 路由决策流程

**关键代码** (`src/middlewares/router.ts`):
```typescript
export const router = async (req, res, next) => {
  const config = req.config;
  
  // 1. 长上下文检测（最高优先级）
  if (tokenCount > 32000) {
    const modelId = config.Router.longContext;
    req.provider = modelId;
    req.body.model = modelId;
    return next();
  }
  
  // 2. 后台任务检测
  if (req.body.model?.startsWith("claude-3-5-haiku")) {
    const modelId = config.Router.background;
    req.provider = modelId;
    req.body.model = modelId;
    return next();
  }
  
  // 3. 思考模式检测
  if (req.body.thinking) {
    const modelId = config.Router.think;
    req.provider = modelId;
    req.body.model = modelId;
    return next();
  }
  
  // 4. 默认路由
  req.provider = "default";
  next();
};
```

### 路由规则详解

#### `background` 路由
- **触发条件**: `req.body.model` 以 `claude-3-5-haiku` 开头
- **使用场景**: Claude Code 内部后台任务和轻量级操作
- **推荐模型**: 本地 Ollama 模型或免费 API

#### `think` 路由
- **触发条件**: `req.body.thinking === true`
- **使用场景**: 需要深度推理的复杂任务、规划模式
- **推荐模型**: DeepSeek-R1、Claude-4 等强推理模型

#### `longContext` 路由
- **触发条件**: 请求总 token 数量超过 32,000
- **使用场景**: 处理大型代码库、长文档分析
- **推荐模型**: Gemini-2.5-Pro 等长上下文模型

---

## 工作区管理系统

### 服务生命周期管理

**关键代码** (`src/utils/processCheck.ts`):
```typescript
// 保存服务状态
export function saveServiceState(cwd: string, pid: number, port: number): void {
  const { serviceStateFile } = getWorkspacePaths(cwd);
  const state = { pid, port, startTime: Date.now() };
  fs.writeFileSync(serviceStateFile, JSON.stringify(state, null, 2));
}

// 检查服务运行状态
export function isServiceRunning(cwd: string): boolean {
  const state = getServiceState(cwd);
  if (!state) return false;
  
  try {
    process.kill(state.pid, 0); // 检查进程是否存在
    return true;
  } catch {
    cleanupServiceState(cwd);
    return false;
  }
}
```

### 动态端口分配

**关键代码** (`src/utils/port.ts`):
```typescript
export async function findRandomAvailablePort(
  minPort: number = 3000,
  maxPort: number = 65535,
  maxAttempts: number = 100
): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = Math.floor(Math.random() * (maxPort - minPort + 1)) + minPort;
    
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  
  throw new Error(`无法找到可用端口：已尝试 ${maxAttempts} 次随机分配`);
}
```

### 日志系统

**关键代码** (`src/utils/log.ts`):
```typescript
export function log(cwd: string, ...args: any[]): void {
  const config = loadConfig(cwd);
  if (!config.logEnabled) return;
  
  const { serviceLogFile } = getWorkspacePaths(cwd);
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ${args.join(' ')}\n`;
  
  ensureLogDir(cwd);
  fs.appendFileSync(serviceLogFile, message, 'utf8');
}
```

---

## 请求处理生命周期

### 中间件链架构

CCB 使用中间件链模式处理每个请求：

**关键代码** (`src/index.ts`):
```typescript
// 注册中间件链
server.useMiddleware(rewriteBody);
if (config.Router?.background && config.Router?.think && config.Router?.longContext) {
  server.useMiddleware(router);
} else {
  server.useMiddleware((req, res, next) => {
    req.provider = "default";
    req.body.model = config.OPENAI_MODEL;
    next();
  });
}
server.useMiddleware(formatRequest);
```

### 中间件详解

#### 1. `rewriteBody` 中间件
- **功能**: 标准化和预处理请求体
- **位置**: `src/middlewares/rewriteBody.ts`

#### 2. `router` 中间件
- **功能**: 智能路由决策，选择最适合的模型
- **位置**: `src/middlewares/router.ts`

#### 3. `formatRequest` 中间件
- **功能**: 最终请求格式化，应用 provider 特定配置
- **位置**: `src/middlewares/formatRequest.ts`

**关键代码** (`src/middlewares/formatRequest.ts`):
```typescript
export const formatRequest = async (req, res, next) => {
  const { model } = req.body;
  
  // 获取当前provider配置，使用空值安全检查
  const currentProvider = req.config?.providers?.find((p: { id: string }) => p.id === req.provider);
  
  // 确定真实的API模型名称（重要：区分provider ID和真实模型名称）
  const realModelName = currentProvider?.model || model;
  
  const data = {
    model: realModelName,  // 使用真实的API模型名称而非provider ID
    messages: req.body.messages,
    temperature: req.body.temperature || 0.7,
    stream: req.body.stream || false,
    // ... 其他参数
  };
  
  // 应用provider的extra_body配置
  const mergedExtraBody = {
    ...(req.body.extra_body || {}),
    ...(currentProvider?.extra_body || {})
  };
  
  // 处理思考模式的强制流式传输
  const isThinkRequest = req.provider === req.config?.Router?.think;
  if (isThinkRequest && currentProvider?.force_stream_for_thinking && req.body.thinking) {
    data.stream = true;
    req._simulate_non_stream = true;
  }
  
  // 更新请求体
  req.body = { ...data, ...mergedExtraBody };
  
  next();
};
```

**重要说明**：
- `realModelName`变量确保API调用使用正确的模型名称，而不是provider ID
- 空值安全检查（`?.`）防止配置不存在时的运行时错误  
- 模型名称映射逻辑确保日志和错误信息显示真实的API模型名称

**为什么需要区分 Provider ID 和真实模型名称？**

1. **Provider ID** (`qwen-32b-standard`): 内部路由标识，用于配置管理和路由决策
2. **真实模型名称** (`qwen3-30b-a3b`): API 提供商要求的实际模型标识

这种分离设计的优势：
- **配置灵活性**: 可以为同一个 API 模型创建多个不同配置的 provider
- **错误追踪**: 日志显示真实的 API 模型名称，便于问题定位
- **API 兼容性**: 确保发送给 API 提供商的请求使用正确的模型标识
- **向后兼容**: 如果 provider 未配置 model 字段，自动回退到原始模型名称

---

## 高级定制开发

### Provider 扩展配置

#### `extra_body` 深度合并

```json
{
  "id": "custom-model",
  "api_base_url": "http://localhost:8080/v1",
  "api_key": "custom-key",
  "model": "custom-model-name",
  "extra_body": {
    "enable_reasoning": true,
    "temperature": 0.1,
    "custom_params": {
      "thinking_depth": 3
    }
  }
}
```

#### `force_stream_for_thinking` 机制

**工作原理**:
1. 当请求被路由到 `think` 模型且 provider 设置了 `force_stream_for_thinking: true`
2. 强制将 `req.body.stream` 设置为 `true`
3. 设置内部标志 `req._simulate_non_stream = true`
4. 在响应处理中聚合所有流式数据块
5. 返回完整的非流式响应格式

**关键代码** (`src/utils/stream.ts`):
```typescript
export async function streamOpenAIResponse(res, completion, model, requestBody, req) {
  if (req?._simulate_non_stream) {
    // 聚合流式响应
    const chunks = [];
    for await (const chunk of completion) {
      chunks.push(chunk);
    }
    
    // 构建完整响应
    const aggregatedResponse = aggregateStreamChunks(chunks);
    res.json(aggregatedResponse);
  } else {
    // 正常流式传输
    for await (const chunk of completion) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
    res.end();
  }
}
```

### 自定义中间件开发

您可以在 `formatRequest` 中间件中添加自定义逻辑：

```typescript
// 在 src/middlewares/formatRequest.ts 的末尾添加
if (req.provider === 'my-custom-provider') {
  // 自定义处理逻辑
  if (req.body.system) {
    // 转换 system prompt 格式
    req.body.instruction = req.body.system;
    delete req.body.system;
  }
  
  // 添加特殊参数
  req.body.custom_mode = "enhanced";
}
```

---

## 开发者调试指南

### VS Code 调试配置

#### 1. 添加调试脚本

**修改 `package.json`**:
```json
{
  "scripts": {
    "start": "node dist/cli.js",
    "dev": "ts-node src/cli.ts", 
    "build": "esbuild src/cli.ts --bundle --platform=node --outfile=dist/cli.js",
    "debug": "node --inspect-brk -r ts-node/register src/cli.ts"
  }
}
```

#### 2. 配置 VS Code 调试

**创建 `.vscode/launch.json`**:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug CCB Start",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "debug", "--", "start"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "port": 9229,
      "cwd": "${workspaceFolder}"
    },
    {
      "type": "node", 
      "request": "launch",
      "name": "Debug CCB Code Command",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "debug", "--", "code", "test prompt"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "port": 9229,
      "cwd": "${workspaceFolder}"
    }
  ]
}
```

### 调试技巧

#### 1. 中间件调试

在关键中间件中设置断点：
- `