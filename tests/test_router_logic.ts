import { Request, Response, NextFunction } from 'express';
import { router } from '../src/middlewares/router';
import * as fs from 'fs';
import { log } from '../src/utils/log';

// TypeScript interface extensions for custom Request properties
declare global {
  namespace Express {
    interface Request {
      config?: any;
      provider?: string;
    }
  }
}

// 加载测试配置
const testConfig = JSON.parse(fs.readFileSync('test.config.json', 'utf-8'));

// 模拟Request对象的类型扩展
interface TestRequest extends Partial<Request> {
  config?: any;
  provider?: string;
  body: any;
}

// 创建模拟的请求对象
const createMockRequest = (body: any, config = testConfig): TestRequest => ({
  body,
  config,
  provider: undefined,
});

// 创建模拟的响应对象
const createMockResponse = (): Partial<Response> => ({});

// 创建模拟的next函数
const createMockNext = (): NextFunction => () => {};

// 测试用例定义
const testCases = [
  {
    name: "测试 think 路由 - 包含 thinking 字段",
    request: createMockRequest({
      model: "default-model",
      thinking: true,
      messages: [{ role: "user", content: "简单测试消息" }]
    }),
    expectedProvider: "qwen3-8b",
    expectedModel: "qwen3-8b",
    description: "当请求包含 thinking 字段时，应该使用 think 路由配置的模型"
  },
  {
    name: "测试 background 路由 - claude-3-5-haiku 模型",
    request: createMockRequest({
      model: "claude-3-5-haiku-20241022",
      messages: [{ role: "user", content: "测试 haiku 模型路由" }]
    }),
    expectedProvider: "qwen3-8b",
    expectedModel: "qwen3-8b",
    description: "当模型名以 claude-3-5-haiku 开头时，应该使用 background 路由配置的模型"
  },
  {
    name: "测试 longContext 路由 - 大量token",
    request: createMockRequest({
      model: "default-model",
      messages: [{ 
        role: "user", 
        content: "这是一个非常长的消息".repeat(4001) // 4001次重复确保超过32K token
      }]
    }),
    expectedProvider: "qwen3-8b",
    expectedModel: "qwen3-8b",
    description: "当token数量超过32K时，应该使用 longContext 路由配置的模型"
  },
  {
    name: "测试默认路由",
    request: createMockRequest({
      model: "some-other-model",
      messages: [{ role: "user", content: "普通测试消息" }]
    }),
    expectedProvider: "default",
    expectedModel: testConfig.OPENAI_MODEL,
    description: "当不满足特殊条件时，应该使用默认配置"
  }
];

// 执行测试
async function runTests() {
  console.log("🧪 开始执行路由逻辑测试...\n");
  
  let passedTests = 0;
  let totalTests = testCases.length;

  for (const testCase of testCases) {
    console.log(`📋 测试: ${testCase.name}`);
    console.log(`📝 描述: ${testCase.description}`);
    
    try {
      const req = testCase.request as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      // 执行路由中间件
      await router(req, res, next);

      // 检查结果
      const actualProvider = req.provider;
      const actualModel = req.body.model;

      console.log(`🎯 期望: provider="${testCase.expectedProvider}", model="${testCase.expectedModel}"`);
      console.log(`✅ 实际: provider="${actualProvider}", model="${actualModel}"`);

      if (actualProvider === testCase.expectedProvider && actualModel === testCase.expectedModel) {
        console.log("✅ 测试通过!\n");
        passedTests++;
      } else {
        console.log("❌ 测试失败!\n");
      }
    } catch (error: any) {
      console.log(`❌ 测试执行出错: ${error?.message || error}\n`);
    }
  }

  console.log(`📊 测试结果: ${passedTests}/${totalTests} 通过`);
  if (passedTests === totalTests) {
    console.log("🎉 所有测试都通过了!");
  } else {
    console.log("⚠️  部分测试失败，请检查路由逻辑");
  }
}

// 验证配置文件结构
function validateConfig() {
  console.log("🔍 验证测试配置文件结构...");
  
  const requiredFields = ['providers', 'Router', 'OPENAI_MODEL'];
  const requiredRoutes = ['background', 'think', 'longContext'];
  
  for (const field of requiredFields) {
    if (!testConfig[field]) {
      throw new Error(`配置文件缺少必需字段: ${field}`);
    }
  }
  
  for (const route of requiredRoutes) {
    if (!testConfig.Router[route]) {
      throw new Error(`路由配置缺少必需路由: ${route}`);
    }
  }
  
  console.log("✅ 配置文件结构验证通过");
  console.log(`📝 配置的路由:`);
  console.log(`  - background: ${testConfig.Router.background}`);
  console.log(`  - think: ${testConfig.Router.think}`);
  console.log(`  - longContext: ${testConfig.Router.longContext}`);
  console.log("");
}

// 主执行函数
async function main() {
  try {
    validateConfig();
    await runTests();
  } catch (error: any) {
    console.error("❌ 测试执行失败:", error?.message || error);
    process.exit(1);
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  main();
}

export { runTests, validateConfig }; 