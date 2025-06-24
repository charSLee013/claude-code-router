# Claude Code Bridge (CCB)

> 一个智能的 Claude Code 请求路由工具，支持工作区级服务管理和多模型动态切换。

![](screenshoots/claude-code.png)

## 核心特性

- 🚀 **工作区级服务隔离**: 每个项目目录独立运行服务，互不干扰
- 🎯 **智能模型路由**: 根据任务类型自动选择最合适的模型
- 🔀 **随机端口分配**: 自动分配可用端口，避免冲突
- ⚙️ **三层配置系统**: 灵活的配置优先级管理
- 🔧 **完全兼容**: 与现有 Claude Code 工作流无缝集成

## 安装使用

### 1. 安装 Claude Code

```shell
npm install -g @anthropic-ai/claude-code
```

### 2. 安装 Claude Code Bridge

```shell
# 安装 Claude Code Bridge (CCB)
npm install -g @musistudio/claude-code-router
```

> 注意：包名称保持为 `claude-code-router`，但项目已重命名为 Claude Code Bridge (CCB)，命令行工具为 `ccb`。

### 3. 启动服务

在任意项目目录下执行：

```shell
ccb start
```

### 4. 使用 Claude Code

```shell
ccb code "你的编程任务"
```

### 5. 管理服务

```shell
# 查看当前工作区服务状态
ccb status

# 停止当前工作区服务
ccb stop

# 查看帮助信息
ccb --help
```

## 配置系统

CCB 使用三层配置系统，优先级从高到低：

1. **环境变量** (最高优先级)
2. **工作区配置**: `<your-project>/.claude/ccb-config.json`
3. **全局配置**: `~/.claude/ccb-config.json` (最低优先级)

### 基础配置示例

创建配置文件 `~/.claude/ccb-config.json` 或在项目目录下创建 `.claude/ccb-config.json`：

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

### 高级路由配置

```json
{
  "OPENAI_API_KEY": "sk-xxx",
  "OPENAI_BASE_URL": "https://api.deepseek.com", 
  "OPENAI_MODEL": "deepseek-chat",
  "providers": [
    {
      "id": "gemini-2.5-pro",
      "api_base_url": "https://openrouter.ai/api/v1",
      "api_key": "sk-xxx",
      "model": "google/gemini-2.5-pro-preview"
    },
    {
      "id": "claude-sonnet-4",
      "api_base_url": "https://openrouter.ai/api/v1", 
      "api_key": "sk-xxx",
      "model": "anthropic/claude-sonnet-4"
    },
    {
      "id": "deepseek-reasoner",
      "api_base_url": "https://api.deepseek.com",
      "api_key": "sk-xxx",
      "model": "deepseek-reasoner"
    },
    {
      "id": "qwen-coder",
      "api_base_url": "http://localhost:11434/v1",
      "api_key": "ollama",
      "model": "qwen:latest",
      "extra_body": {
        "enable_thinking": true
      },
      "force_stream_for_thinking": true
    }
  ],
  "Router": {
    "background": "qwen-coder",
    "think": "deepseek-reasoner", 
    "longContext": "gemini-2.5-pro"
  }
}
```

## 路由规则详解

### 智能路由场景

- **`background`**: 处理后台任务和轻量级操作
  - 触发条件: Claude Code 内部后台任务 (`claude-3-5-haiku` 模型请求)
  - 推荐: 本地 Ollama 模型或免费 API

- **`think`**: 处理需要深度推理的复杂任务  
  - 触发条件: 请求包含 `thinking: true` 标志
  - 推荐: DeepSeek-R1, Claude-4 等强推理模型

- **`longContext`**: 处理超长上下文场景
  - 触发条件: 请求 token 数量 > 32,000
  - 推荐: Gemini-2.5-Pro 等长上下文模型

### 手动切换模型

在 Claude Code 中使用 `/model` 命令：

```
/model claude-sonnet-4,anthropic/claude-sonnet-4
```

格式: `/model provider_id,model_name`

**重要提示：模型名称配置**

在配置 provider 时，`model` 字段应该填写真实的 API 模型名称，而不是 provider ID。例如：

```json
{
  "id": "qwen-32b-standard",
  "api_base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1", 
  "api_key": "your-api-key",
  "model": "qwen3-30b-a3b"  // 这里是真实的API模型名称
}
```

这样配置确保：
- API 请求使用正确的模型名称
- 日志和错误信息显示真实的模型名称  
- 避免因模型名称不匹配导致的调用失败

## 工作区特性

### 独立服务管理

每个项目目录都拥有独立的服务实例：

- 独立的进程和端口
- 独立的配置文件 (`.claude/ccb-config.json`)
- 独立的日志文件 (`.claude/service.log`)
- 独立的状态管理 (`.claude/service.json`)

### 自动端口分配

- 服务启动时自动分配随机可用端口
- 避免多项目间的端口冲突
- 支持自定义端口范围配置

### 工作区目录结构

```
your-project/
├── .claude/
│   ├── ccb-config.json      # 工作区配置
│   ├── service.log      # 服务日志  
│   └── service.json     # 服务状态
├── .gitignore           # 自动更新忽略 .claude/ 目录
└── your-code-files...
```

## 配置选项详解

### 基础配置

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `basePort` | number | 3456 | 端口分配起始范围 |
| `timeout` | number | 30000 | 请求超时时间(ms) |
| `maxRetries` | number | 3 | 最大重试次数 |
| `logEnabled` | boolean | false | 是否启用文件日志 |
| `autoStart` | boolean | false | 是否自动启动服务 |

### Provider 高级选项

- **`extra_body`**: 注入额外请求参数，与原始请求合并
- **`force_stream_for_thinking`**: 强制推理任务使用流式传输

## 使用技巧

### 成本优化

- 使用本地 Ollama 模型处理 `background` 任务
- 选择性地为复杂任务启用强大模型
- 利用 DeepSeek 等低成本 API 替代昂贵的 Claude API

### 性能优化

- 为不同项目配置不同的 provider 组合
- 使用工作区配置覆盖全局设置
- 启用日志调试性能瓶颈

### 多项目协作

- 每个项目独立配置，互不影响
- 共享全局配置，项目特殊配置覆盖
- 使用环境变量进行敏感信息管理

## 故障排除

### 常见问题

1. **端口被占用**: CCB 会自动分配随机端口，无需手动处理
2. **配置不生效**: 检查配置文件优先级，工作区配置会覆盖全局配置
3. **服务启动失败**: 使用 `ccb status` 查看详细状态信息

### 调试模式

启用日志查看详细信息：

```json
{
  "logEnabled": true
}
```

日志文件位置: `<workspace>/.claude/service.log`

## 支持作者

如果这个项目对你有帮助，欢迎支持作者：
[Buy me a coffee](http://paypal.me/musistudio1999)