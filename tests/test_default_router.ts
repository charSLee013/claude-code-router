import { Request, Response, NextFunction } from 'express';
import { router } from '../src/middlewares/router';
import * as fs from 'fs';

// TypeScript interface extensions for custom Request properties
declare global {
  namespace Express {
    interface Request {
      config?: any;
      provider?: string;
    }
  }
}

// 模拟Request对象的类型扩展
interface TestRequest extends Partial<Request> {
  config?: any;
  provider?: string;
  body: any;
}

// 创建模拟的请求对象
const createMockRequest = (body: any, config: any): TestRequest => ({
  body,
  config,
  provider: undefined,
});

// 创建模拟的响应对象
const createMockResponse = (): Partial<Response> => ({});

// 创建模拟的next函数
const createMockNext = (): NextFunction => () => {};

// 测试配置
const defaultRouterTestConfig = {
  providers: [
    {
      id: "qwen3-8b",
      api_base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      api_key: "sk-test-key",
      model: "qwen3-8b"
    },
    {
      id: "gpt-4o-mini",
      api_base_url: "https://api.openai.com/v1",
      api_key: "sk-test-openai-key",
      model: "gpt-4o-mini"
    }
  ],
  Router: {
    background: "qwen3-8b",
    think: "qwen3-8b",
    longContext: "qwen3-8b",
    default: "gpt-4o-mini"
  },
  OPENAI_MODEL: "should-not-be-used"
};

// 测试用例定义
const defaultRouterTestCases = [
  {
    name: "测试 default 路由 - 普通请求",
    request: createMockRequest({
      model: "some-unknown-model",
      messages: [{ role: "user", content: "这是一个普通的测试消息" }]
    }, defaultRouterTestConfig),
    expectedProvider: "gpt-4o-mini",
    expectedModel: "gpt-4o-mini",
    description: "当请求不匹配任何特殊条件时，应该使用 Router.default 配置的模型"
  },
  {
    name: "测试 default 路由 - 空模型",
    request: createMockRequest({
      model: "",
      messages: [{ role: "user", content: "空模型测试" }]
    }, defaultRouterTestConfig),
    expectedProvider: "gpt-4o-mini",
    expectedModel: "gpt-4o-mini",
    description: "当模型为空时，应该使用 Router.default 配置的模型"
  },
  {
    name: "测试 default 路由优先级 - 不覆盖特定路由",
    request: createMockRequest({
      model: "default-model",
      thinking: true,
      messages: [{ role: "user", content: "思考模式测试" }]
    }, defaultRouterTestConfig),
    expectedProvider: "qwen3-8b",
    expectedModel: "qwen3-8b",
    description: "即使配置了 default 路由，特定路由（如 think）仍应优先"
  },
  {
    name: "测试 default 路由优先级 - 不覆盖背景路由",
    request: createMockRequest({
      model: "claude-3-5-haiku-20241022",
      messages: [{ role: "user", content: "haiku 模型测试" }]
    }, defaultRouterTestConfig),
    expectedProvider: "qwen3-8b",
    expectedModel: "qwen3-8b",
    description: "即使配置了 default 路由，背景路由仍应优先"
  },
  {
    name: "测试无 default 配置的 fallback",
    request: createMockRequest({
      model: "unknown-model",
      messages: [{ role: "user", content: "没有默认配置的测试" }]
    }, {
      ...defaultRouterTestConfig,
      Router: {
        background: "qwen3-8b",
        think: "qwen3-8b",
        longContext: "qwen3-8b"
        // 没有 default 字段
      }
    }),
    expectedProvider: "default",
    expectedModel: "should-not-be-used",
    description: "当没有配置 Router.default 时，应该 fallback 到原有逻辑"
  },
  {
    name: "测试 provider,model 格式不受影响",
    request: createMockRequest({
      model: "custom-provider,custom-model",
      messages: [{ role: "user", content: "自定义provider测试" }]
    }, defaultRouterTestConfig),
    expectedProvider: "custom-provider",
    expectedModel: "custom-model",
    description: "provider,model 格式的请求不应该被 default 路由影响"
  }
];

// 执行测试
async function runDefaultRouterTests() {
  console.log("🧪 开始执行 Router.default 功能测试...\n");
  
  let passedTests = 0;
  let totalTests = defaultRouterTestCases.length;

  for (const testCase of defaultRouterTestCases) {
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
    console.log("🎉 所有 Router.default 测试都通过了!");
  } else {
    console.log("⚠️  部分测试失败，请检查 Router.default 逻辑");
  }
  
  return passedTests === totalTests;
}

// 验证配置文件结构
function validateDefaultRouterConfig() {
  console.log("🔍 验证 Router.default 配置结构...");
  
  const requiredFields = ['providers', 'Router'];
  const requiredRoutes = ['background', 'think', 'longContext', 'default'];
  
  for (const field of requiredFields) {
    if (!(defaultRouterTestConfig as any)[field]) {
      throw new Error(`配置文件缺少必需字段: ${field}`);
    }
  }
  
  for (const route of requiredRoutes) {
    if (!(defaultRouterTestConfig.Router as any)[route]) {
      console.log(`⚠️  路由配置缺少字段: ${route} (某些测试会测试这种情况)`);
    }
  }
  
  console.log("✅ Router.default 配置文件结构验证完成");
  console.log(`📝 配置的路由:`);
  console.log(`  - background: ${defaultRouterTestConfig.Router.background}`);
  console.log(`  - think: ${defaultRouterTestConfig.Router.think}`);
  console.log(`  - longContext: ${defaultRouterTestConfig.Router.longContext}`);
  console.log(`  - default: ${defaultRouterTestConfig.Router.default}`);
  console.log("");
}

// 主执行函数
async function main() {
  try {
    validateDefaultRouterConfig();
    const success = await runDefaultRouterTests();
    process.exit(success ? 0 : 1);
  } catch (error: any) {
    console.error("❌ Router.default 测试执行失败:", error?.message || error);
    process.exit(1);
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  main();
}

 