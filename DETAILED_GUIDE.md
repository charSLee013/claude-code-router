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
  const providers = new Map(req.config.providers?.map(p => [p.id, p]) || []);
  const currentProvider = providers.get(req.provider);
  
  if (currentProvider) {
    // 应用 extra_body 配置
    if (currentProvider.extra_body) {
      req.body = { ...req.body, ...currentProvider.extra_body };
    }
    
    // 处理 force_stream_for_thinking
    if (req.body.thinking && currentProvider.force_stream_for_thinking) {
      req.body.stream = true;
      req._simulate_non_stream = true;
    }
    
    // 设置模型名称
    req.body.model = currentProvider.model;
  }
  
  next();
};
```

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
- `src/middlewares/router.ts:15` - 路由决策点
- `src/middlewares/formatRequest.ts:20` - 请求格式化点
- `src/utils/config.ts:45` - 配置加载点

#### 2. 日志调试

启用详细日志：
```json
{
  "logEnabled": true
}
```

日志文件位置: `<workspace>/.claude/service.log`

#### 3. 网络调试

监控 HTTP 请求：
```bash
# 查看服务状态
ccb status

# 测试健康检查
curl http://localhost:<port>/health

# 监控网络流量
netstat -an | grep <port>
```

### 常见调试场景

#### 1. 配置不生效
- 检查配置文件优先级
- 验证 JSON 格式正确性
- 确认环境变量设置

#### 2. 路由异常
- 在 `router.ts` 中添加日志输出
- 检查 token 计算逻辑
- 验证 provider 配置

#### 3. 端口冲突
- 检查随机端口分配逻辑
- 查看系统端口占用情况
- 调整端口范围配置

---

## 性能优化指南

### 配置优化

1. **合理配置超时时间**:
```json
{
  "timeout": 30000,
  "maxRetries": 3
}
```

2. **选择合适的模型组合**:
- `background`: 轻量级本地模型
- `think`: 强推理模型
- `longContext`: 长上下文专用模型

3. **启用缓存机制**:
```typescript
const providerCache = new LRUCache<string, OpenAI>({
  max: 10,
  ttl: 2 * 60 * 60 * 1000, // 2小时
});
```

### 监控和分析

1. **启用日志监控**:
```bash
tail -f <workspace>/.claude/service.log
```

2. **性能指标收集**:
- 请求响应时间
- 模型切换频率
- 错误率统计

3. **资源使用监控**:
```bash
# 查看进程资源使用
ps aux | grep node

# 监控端口使用
lsof -i :<port>
```

---

## 故障排除

### 常见问题解决

#### 1. 服务启动失败
```bash
# 检查服务状态
ccb status

# 查看详细错误日志
cat <workspace>/.claude/service.log

# 手动清理服务状态
rm <workspace>/.claude/service.json
```

#### 2. 配置不生效
```bash
# 验证配置文件语法
cat <workspace>/.claude/ccb-config.json | jq .

# 检查环境变量
env | grep OPENAI
```

#### 3. 网络连接问题
```bash
# 测试 API 连接
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     $OPENAI_BASE_URL/models

# 检查代理设置
echo $HTTP_PROXY $HTTPS_PROXY
```

### 错误代码参考

| 错误类型 | 原因 | 解决方案 |
|----------|------|----------|
| `EADDRINUSE` | 端口被占用 | 自动重新分配端口 |
| `ENOENT` | 配置文件不存在 | 使用默认配置 |
| `SyntaxError` | JSON 格式错误 | 检查配置文件语法 |
| `ECONNREFUSED` | API 连接失败 | 检查网络和 API 配置 |

---

## 最佳实践

### 项目组织

1. **全局配置**: 设置通用的 API 密钥和默认模型
2. **工作区配置**: 为特定项目定制 provider 组合
3. **环境变量**: 管理敏感信息和临时覆盖

### 安全考虑

1. **API 密钥管理**:
   - 使用环境变量存储敏感信息
   - 避免在配置文件中硬编码密钥
   - 定期轮换 API 密钥

2. **网络安全**:
   - 使用 HTTPS 端点
   - 配置适当的代理设置
   - 监控异常网络活动

### 成本控制

1. **模型选择策略**:
   - 后台任务使用免费/低成本模型
   - 复杂任务选择性使用高端模型
   - 长上下文场景使用专门优化的模型

2. **使用监控**:
   - 跟踪不同模型的使用频率
   - 分析成本效益比
   - 优化路由规则

### 团队协作

1. **配置模板**:
   - 提供标准化的配置模板
   - 文档化最佳实践
   - 版本控制配置文件

2. **环境一致性**:
   - 统一开发环境配置
   - 使用环境变量管理差异
   - 自动化部署配置

通过本深度指南，您应该能够完全掌握 Claude Code Bridge 的各个方面，从基础使用到高级定制开发。如果您有任何问题或需要进一步的技术支持，请参考项目的 GitHub 仓库或联系维护团队。 