# Claude Code Router 深度解析与高级指南

本文档旨在提供一个比官方 `README.md` 更为详尽的指南，内容涵盖 Claude Code Router 的核心概念、配置文件深度解析、工作原理、高级定制化开发以及开发者调试方法。本文档整合了我们之前的讨论，并引用了关键源代码作为依据，以帮助您完全掌握这个强大的工具。

## 核心概念：一个智能请求代理

从本质上讲，`claude-code-router` 并不是一个独立的 AI 模型，而是一个位于您和各种大型语言模型（LLM）之间的**智能代理服务器（Proxy）**。

当您在 `claude-code` 工具中输入一个指令时，这个请求首先会被发送到本地运行的 `claude-code-router`。路由器会拦截这个请求，然后像一个经验丰富的调度员，根据您预设的规则，决定将这个请求"转发"给哪个最合适的 LLM 服务（例如 OpenRouter, DeepSeek, 或本地的 Ollama）。

这种设计的核心优势在于**灵活性**和**成本效益**：
- **物尽其用**：让强大的模型处理复杂任务（如深度思考和规划），让轻量级、廉价甚至免费的模型处理常规或后台任务。
- **高度定制**：您可以根据自己的需求，为任何模型（只要它兼容 OpenAI API 格式）添加定制化的适配逻辑。
- **无缝体验**：对于使用者来说，这一切都是在后台自动发生的，提供了无缝切换的流畅体验。

---

## 配置文件深度解析 (`~/.claude-code-router/config.json`)

配置文件是路由器的"大脑"，所有行为都由此文件定义。下面我们对其进行详细解析。

### `providers`: 定义您的模型库

`providers` 是一个数组，用于定义您可以使用的所有模型。

```json
"providers": [
  {
    "id": "gemini-2.5-pro",
    "api_base_url": "https://openrouter.ai/api/v1",
    "api_key": "sk-xxx",
    "model": "google/gemini-2.5-pro-preview"
  },
  {
    "id": "qwen-coder",
    "api_base_url": "http://localhost:11434/v1",
    "api_key": "ollama",
    "model": "qwen2.5-coder:latest"
  }
]
```
- `id`: 模型的唯一标识符，在 `Router` 规则中会用到。
- `api_base_url`: 该提供商的 API 端点地址。
- `api_key`: 对应的 API 密钥。
- `model`: 实际使用的模型名称。

### `Router`: 设置智能路由规则

`Router` 对象是路由功能的核心，它定义了在特定场景下应该使用哪个模型。

```json
"Router": {
  "background": "qwen-coder",
  "think": "deepseek-reasoner",
  "longContext": "gemini-2.5-pro"
}
```

- **`background`**: 用于处理 `claude-code` 的一些内部后台任务。
    - **触发逻辑**: 当 `claude-code` 请求的模型是 `claude-3-5-haiku` 时触发。
    - **关键代码** (`src/middlewares/router.ts`):
      ```typescript
      if (req.body.model?.startsWith("claude-3-5-haiku")) {
        log("Using background model for ", req.body.model);
        const modelId = req.config.Router!.background;
        return {
          provider: modelId,
          model: modelId,
        };
      }
      ```

- **`think`**: 用于处理需要深度思考和规划的复杂任务。
    - **触发逻辑**: 当 `claude-code` 在请求体中包含了 `thinking: true` 标志时触发。
    - **关键代码** (`src/middlewares/router.ts`):
      ```typescript
      if (req.body.thinking) {
        log("Using think model for ", req.body.thinking);
        const modelId = req.config.Router!.think;
        return {
          provider: modelId,
          model: modelId,
        };
      }
      ```

- **`longContext`**: 用于处理超长上下文的请求。
    - **触发逻辑**: 当整个请求的 token 数量超过 32,000 时触发。
    - **关键代码** (`src/middlewares/router.ts`):
      ```typescript
      // 首先计算 tokenCount
      if (tokenCount > 1000 * 32) {
        log("Using long context model due to token count:", tokenCount);
        const modelId = req.config.Router!.longContext;
        return {
          provider: modelId,
          model: modelId,
        };
      }
      ```

### 高级 Provider 配置选项

除了基本字段外，`providers` 对象还支持一些高级选项，以提供更强的定制能力。

#### `extra_body`: 注入额外请求参数

- **作用**: `extra_body` 允许您为某个特定的 `provider` 定义一个 JSON 对象。这个对象的内容将会与原始请求的 `body` 进行深度合并。如果原始请求和 `extra_body` 中存在相同的键，`extra_body` 中的值将覆盖原始请求中的值。
- **使用场景**: 当某个模型需要特定的、非标准的参数时，此功能非常有用。例如，某些模型可能需要一个特殊的 `enable_thinking: true` 参数来激活其思维链能力。
- **配置示例**:
  ```json
  {
    "id": "qwen-coder-thinking",
    "api_base_url": "http://localhost:11434/v1",
    "api_key": "ollama",
    "model": "qwen:latest",
    "extra_body": {
      "enable_thinking": true,
      "temperature": 0.1
    }
  }
  ```
- **关键代码** (`src/middlewares/formatRequest.ts`):
  ```typescript
  // 确保 req.body.extra_body 被初始化
  const initialExtraBody = req.body.extra_body || {};
  const providerExtraBody = currentProvider?.extra_body || {};

  // 合并 provider 的 extra_body
  const mergedExtraBody = { ...initialExtraBody, ...providerExtraBody };

  if (Object.keys(mergedExtraBody).length > 0) {
    req.body = { ...req.body, ...mergedExtraBody };
    log("Merged extra_body:", mergedExtraBody);
  }
  // 删除临时字段
  delete req.body.extra_body;
  ```

#### `force_stream_for_thinking`: 强制开启思考模式流式传输

- **作用**: 当此选项设置为 `true` 时，如果一个请求被 `Router` 路由到了 `think` 模型，即使原始请求本身是**非流式**的（`stream: false`），代理服务也会强制以**流式**方式向上游 LLM 发起请求。然后，代理会在内部将所有流式数据块（chunks）聚合成一个完整的、非流式的响应，再返回给客户端。
- **使用场景**: 这个功能主要用于改善用户体验。某些工具（如 `claude-code` 的某些版本）在执行"思考"任务时可能会发送非流式请求。如果 `think` 模型（通常是较慢、较强的模型）处理时间很长，客户端可能会因为超时而断开连接。通过强制流式传输，客户端可以立即收到数据流，避免超时，同时代理服务在后台完成聚合，最终返回一个与原始非流式请求格式兼容的响应。
- **关键代码** (`src/middlewares/formatRequest.ts`):
  ```typescript
  if (req.body.thinking && currentProvider?.force_stream_for_thinking) {
    log("Forcing stream for thinking request.");
    req.body.stream = true;
    req._simulate_non_stream = true; // 设置一个内部标志
  }
  ```
- **关键代码** (`src/utils/stream.ts`):
  ```typescript
  // 在 streamOpenAIResponse 函数中
  if (req?._simulate_non_stream) {
    // ... 此处省略聚合所有 chunks 的逻辑 ...
    // 最后构建一个非流式的 JSON 响应并返回
    res.json(finalResponse);
  }
  ```

### `LOG`: 开启文件日志

当设置为 `true` 时，此选项会开启详细的文件日志记录功能。

- **工作原理**:
    1.  **注入环境变量**: 程序启动时，`initConfig` 函数会将 `config.json` 的内容注入到环境变量中。
        - **关键代码** (`src/utils/index.ts`):
          ```typescript
          export const initConfig = async () => {
            const config = await readConfigFile();
            Object.assign(process.env, config); // <-- 此处注入
            return config;
          };
          ```
    2.  **写入日志**: 程序中每次调用 `log()` 函数时，它会检查环境变量 `process.env.LOG` 是否为 `"true"`。如果是，则将日志信息追加写入到 `~/.claude-code-router/claude-code-router.log` 文件。
        - **关键代码** (`src/utils/log.ts`):
          ```typescript
          export function log(...args: any[]) {
            const isLogEnabled = process.env.LOG === "true"; // <-- 检查开关
            if (!isLogEnabled) {
              return;
            }
            // ...
            fs.appendFileSync(LOG_FILE, logMessage, "utf8"); // <-- 写入文件
          }
          ```

---

## 工作原理解析：请求的生命周期

一个请求从您按下回车到获得返回，经历了以下流程：

1.  **入口 (`cli.ts`)**: 您执行 `ccr code "your prompt"`。`cli.ts` 负责解析命令，如果代理服务未启动，则先在后台启动它，然后将您的 prompt 发送给代理服务。

2.  **服务初始化 (`index.ts`)**: 代理服务启动时，`index.ts` 中的 `run()` 函数会执行。它负责读取配置、初始化 providers，并创建服务器实例。最重要的是，它在这里**注册了中间件链**。
    - **关键代码** (`src/index.ts`):
      ```typescript
      const server = await createServer(servicePort);
      // ...
      server.useMiddleware(rewriteBody);
      if (config.Router?.background && ...) { // 检查Router配置
        server.useMiddleware(router);
      }
      // ...
      server.useMiddleware(formatRequest);
      ```

3.  **中间件链 (Middleware Chain)**: 请求像流水线一样依次通过以下中间件：
    - `rewriteBody`: 对请求体进行初步的、标准化的重写。
    - `router`: **核心决策者**。根据我们上面讨论的优先级规则（长上下文 > 后台 > 思考 > 手动指定 > 默认），决定最终使用哪个 `provider` 和 `model`。
    - `formatRequest`: **最终适配器**。在请求即将被发往目标 LLM 之前，进行最后一次修改，以适配特定模型的需求。

4.  **请求发送与返回**: 请求经过所有中间件的处理后，被发送到由 `router` 决定的目标 LLM API。收到响应后，再通过流式传输返回给 `claude-code` 客户端。

---

## 高级定制化开发：适配任何模型

如果某个模型需要特殊的参数或不支持某些标准参数，您可以通过修改 `formatRequest` 中间件来轻松适配。

**核心文件**: `src/middlewares/formatRequest.ts`

**场景举例**: 假设您有一个名为 `my-special-model` 的模型，它不支持 `system` prompt，但需要一个 `custom_instruction` 字段。

您可以这样修改 `formatRequest.ts`:

```typescript
// src/middlewares/formatRequest.ts

export const formatRequest = async (req, res, next) => {
  // ... 其他代码 ...

  // 在函数末尾, next() 之前, 添加您的定制逻辑
  if (req.provider === 'my-model-id' && req.body.model === 'my-special-model') {
    // 检查是否存在 system prompt
    if (req.body.system) {
        const systemPrompt = Array.isArray(req.body.system) ? req.body.system.join(' ') : req.body.system;
        req.body.custom_instruction = `Follow this instruction: ${systemPrompt}`;
        // 删掉原来的 system 字段，避免 API 报错
        delete req.body.system; 
    }
  }

  next();
};
```

---

## 开发者调试指南

您可以使用 VS Code 内置的调试工具进行断点调试。

1.  **修改 `package.json`**:
    在 `scripts` 对象中添加一个 `debug` 脚本：
    ```json
    "scripts": {
      "start": "node dist/cli.js",
      "dev": "ts-node src/cli.ts",
      "build": "tsc",
      "debug": "node --inspect-brk -r ts-node/register src/cli.ts"
    },
    ```

2.  **配置 VS Code (`.vscode/launch.json`)**:
    创建或修改 `.vscode/launch.json` 文件：
    ```json
    {
      "version": "0.2.0",
      "configurations": [
        {
          "type": "node",
          "request": "launch",
          "name": "Debug Claude Code Router",
          "runtimeExecutable": "pnpm", // 或 npm/yarn
          "runtimeArgs": [
            "run",
            "debug",
            "--",
            "start" // 调试 start 命令
          ],
          "console": "integratedTerminal",
          "internalConsoleOptions": "neverOpen",
          "port": 9229
        }
      ]
    }
    ```

3.  **开始调试**:
    - 在您的代码中（如 `src/middlewares/router.ts`）设置断点。
    - 切换到 VS Code 的"运行和调试"侧边栏。
    - 从下拉菜单中选择 "Debug Claude Code Router"，然后按 `F5` 启动。

程序将在您的断点处暂停，您可以检查变量、单步执行，深入了解代码的每一个细节。 