import { Request, Response, NextFunction } from 'express';
import { formatRequest } from '../src/middlewares/formatRequest';
import * as fs from 'fs';

// TypeScript interface extensions for custom Request properties
declare global {
  namespace Express {
    interface Request {
      config?: any;
      provider?: string;
      _simulate_non_stream?: boolean;
      cwd?: string;
    }
  }
}

// 模拟Request对象的类型扩展
interface TestRequest extends Partial<Request> {
  config?: any;
  provider?: string;
  body: any;
  _simulate_non_stream?: boolean;
  cwd?: string;
}

// 创建模拟的请求对象
const createMockRequest = (body: any, provider: string, config: any): TestRequest => ({
  body,
  provider,
  config,
  cwd: "/test/workspace",
});

// 创建模拟的响应对象
const createMockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.setHeader = () => res as Response;
  res.write = () => true;
  res.end = () => res as Response;
  res.json = () => res as Response;
  return res;
};

// 创建模拟的next函数
const createMockNext = (): NextFunction => () => {};

// 测试配置
const testConfig = {
  providers: [
    {
      id: "standard",
      api_base_url: "https://api-inference.modelscope.cn/v1",
      api_key: "test-key",
      model: "Qwen/Qwen3-Coder-480B-A35B-Instruct"
    }
  ],
  Router: {
    background: "standard",
    think: "standard",
    longContext: "standard",
    default: "standard"
  }
};

// 测试用例定义
const maxNewTokensTestCases = [
  {
    name: "测试 max_new_tokens 参数 - 标准提供商",
    request: createMockRequest({
      model: "standard",
      max_new_tokens: 1024,
      messages: [{ role: "user", content: "测试 max_new_tokens 参数" }]
    }, "standard", testConfig),
    expectedField: "max_new_tokens",
    expectedValue: 1024,
    description: "当使用非 OpenAI/Anthropic 提供商时，应该保留 max_new_tokens 参数"
  },
  {
    name: "测试 max_new_tokens 转换为 max_tokens - OpenAI 提供商",
    request: createMockRequest({
      model: "gpt-4",
      max_new_tokens: 512,
      messages: [{ role: "user", content: "测试 max_new_tokens 转换" }]
    }, "standard", {
      ...testConfig,
      providers: [
        {
          id: "standard",
          api_base_url: "https://api.openai.com/v1",
          api_key: "test-key",
          model: "gpt-4"
        }
      ]
    }),
    expectedField: "max_tokens",
    expectedValue: 512,
    description: "当使用 OpenAI 提供商时，max_new_tokens 应该转换为 max_tokens"
  },
  {
    name: "测试 max_new_tokens 转换为 max_tokens - Anthropic 提供商",
    request: createMockRequest({
      model: "claude-3-sonnet",
      max_new_tokens: 256,
      messages: [{ role: "user", content: "测试 max_new_tokens 转换" }]
    }, "standard", {
      ...testConfig,
      providers: [
        {
          id: "standard",
          api_base_url: "https://api.anthropic.com/v1",
          api_key: "test-key",
          model: "claude-3-sonnet"
        }
      ]
    }),
    expectedField: "max_tokens",
    expectedValue: 256,
    description: "当使用 Anthropic 提供商时，max_new_tokens 应该转换为 max_tokens"
  },
  {
    name: "测试 max_tokens 参数不被覆盖",
    request: createMockRequest({
      model: "standard",
      max_tokens: 2048,
      messages: [{ role: "user", content: "测试 max_tokens 参数" }]
    }, "standard", testConfig),
    expectedField: "max_tokens",
    expectedValue: 2048,
    description: "当提供 max_tokens 但没有 max_new_tokens 时，应该保留 max_tokens"
  },
  {
    name: "测试同时提供 max_new_tokens 和 max_tokens",
    request: createMockRequest({
      model: "standard",
      max_new_tokens: 1024,
      max_tokens: 2048,
      messages: [{ role: "user", content: "测试参数优先级" }]
    }, "standard", testConfig),
    expectedField: "max_new_tokens",
    expectedValue: 1024,
    description: "当同时提供 max_new_tokens 和 max_tokens 时，应该优先使用 max_new_tokens，并且 max_tokens 应该被移除"
  }
];

// 执行测试
async function runMaxNewTokensTests() {
  console.log("🧪 开始执行 max_new_tokens 参数处理测试...\n");
  
  let passedTests = 0;
  let totalTests = maxNewTokensTestCases.length;

  for (const testCase of maxNewTokensTestCases) {
    console.log(`📋 测试: ${testCase.name}`);
    console.log(`📝 描述: ${testCase.description}`);
    
    try {
      const req = testCase.request as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      // 执行格式化请求中间件
      await formatRequest(req, res, next);

      // 检查结果
      const actualValue = req.body[testCase.expectedField];
      
      // For the test case with both max_new_tokens and max_tokens, also check that max_tokens is removed
      let additionalCheckPassed = true;
      if (testCase.name === "测试同时提供 max_new_tokens 和 max_tokens") {
        // Check that max_tokens is removed when both are present
        const maxTokensExists = req.body.hasOwnProperty('max_tokens');
        additionalCheckPassed = !maxTokensExists;
        console.log(`🔧 额外检查: max_tokens 应该被移除=${additionalCheckPassed}`);
      }

      console.log(`🎯 期望: ${testCase.expectedField}=${testCase.expectedValue}`);
      console.log(`✅ 实际: ${testCase.expectedField}=${actualValue}`);

      if (actualValue === testCase.expectedValue && additionalCheckPassed) {
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
    console.log("🎉 所有 max_new_tokens 参数处理测试都通过了!");
  } else {
    console.log("⚠️  部分测试失败，请检查 max_new_tokens 参数处理逻辑");
  }
  
  return passedTests === totalTests;
}

// 主执行函数
async function main() {
  try {
    const success = await runMaxNewTokensTests();
    process.exit(success ? 0 : 1);
  } catch (error: any) {
    console.error("❌ max_new_tokens 测试执行失败:", error?.message || error);
    process.exit(1);
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  main();
}

export { runMaxNewTokensTests };