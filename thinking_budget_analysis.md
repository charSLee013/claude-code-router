# Context
Filename: thinking_budget_analysis.md
Created On: 2024-12-19
Created By: AI Assistant
Associated Protocol: RIPER-5 + Multidimensional + Agent Protocol

# Task Description
用户希望在Claude Code Router项目中配置thinking_budget参数来约束深度思考模型的推理过程最大长度，以解决推理过程冗长、耗时长、消耗Token多的问题。

# Project Overview
Claude Code Router是一个智能请求代理服务器，拦截claude-code工具的请求并根据配置规则路由到不同的LLM提供商。项目通过中间件链处理请求，支持通过extra_body机制为特定模型注入额外参数。

---
*The following sections are maintained by the AI during protocol execution*
---

# Analysis (Populated by RESEARCH mode)

## 当前项目架构分析
1. **中间件链结构**：
   - `rewriteBody`: 初步重写请求体
   - `router`: 核心路由决策，通过检查`req.body.thinking`字段识别thinking请求
   - `formatRequest`: 最终格式化适配，处理extra_body参数合并

2. **thinking请求识别机制**：
   - 在`router.ts`中，当`req.body.thinking`存在时，路由到`think`模型
   - 触发条件：`if (req.body.thinking)`
   - 路由目标：`req.config.Router.think`配置的模型ID

3. **extra_body参数处理机制**：
   - 在`formatRequest.ts`中实现
   - 合并逻辑：`{ ...initialExtraBody, ...providerExtraBody }`
   - 支持在provider配置中预设extra_body，也支持请求时动态添加

4. **用户当前配置分析**：
   ```json
   {
     "providers": [
       {
         "id": "qwen3-8b",
         "api_base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
         "api_key": "sk-5f018f0e3f4841efbd01a2d8f9771b63",
         "model": "qwen3-8b",
         "extra_body": {
           "enable_thinking": true,      // 已正确开启thinking功能
           "thinking_budget": 4096       // 已正确设置thinking_budget
         },
         "force_stream_for_thinking": true
       }
     ],
     "Router": {
       "background": "qwen3-8b",
       "think": "qwen3-8b",      // think路由指向qwen3-8b
       "longContext": "qwen3-8b"
     }
   }
   ```

## 关键发现
1. **配置已正确**：用户已经正确设置了`"enable_thinking": true`和`"thinking_budget": 4096`
2. **API兼容性确认**：通义千问API支持thinking_budget参数，通过extra_body传递
3. **现有机制完备**：项目已有完整的extra_body处理机制，无需修改代码

## 启动问题分析
**问题根源**：`spawn ccb ENOENT` 错误表明系统找不到 `ccb` 命令

**执行流程分析**：
1. **命令定义**：在 `package.json` 中定义了 `"ccb": "./dist/cli.js"`
2. **调用位置**：在 `cli.ts` 第82行，当服务未运行时尝试执行 `spawn("ccb", ["start"])`
3. **问题原因**：用户直接运行 `./dist/cli.js` 而不是通过npm全局安装的 `ccb` 命令
4. **循环依赖**：cli.js试图调用ccb命令启动服务，但ccb命令本身就是cli.js

**解决方案**：
1. **方案一**：全局安装包，使ccb命令可用
2. **方案二**：直接启动服务而不是通过code命令
3. **方案三**：修改启动逻辑避免循环调用

## 技术约束
1. thinking_budget参数对QwQ与DeepSeek-R1模型无效（根据官方文档）
2. 用户使用的是qwen3-8b模型，应该支持thinking_budget参数
3. 参数需要与enable_thinking: true配合使用

## 配置路径分析
用户配置文件位于：`~/.ccb/config.json`（注意：现在使用统一的CCB配置目录） 