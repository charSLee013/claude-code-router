import path from "node:path";
import os from "node:os";

export const HOME_DIR = path.join(os.homedir(), ".ccb");

// 全局配置文件路径
export const GLOBAL_CONFIG_FILE = `${HOME_DIR}/config.json`;

export const PLUGINS_DIR = `${HOME_DIR}/plugins`;

// 移除硬编码的PID_FILE，改为工作区特定的路径管理
// export const PID_FILE = path.join(HOME_DIR, '.claude-code-router.pid');

export const REFERENCE_COUNT_FILE = '/tmp/claude-code-reference-count.txt';

/**
 * 获取工作区特定的路径配置
 * @param cwd 当前工作目录
 * @returns 包含所有工作区特定路径的对象
 */
export function getWorkspacePaths(cwd: string) {
  const ccbDir = path.join(cwd, '.ccb');
  return {
    ccbDir,
    configFile: path.join(ccbDir, 'config.json'),
    logFile: path.join(ccbDir, 'service.log'),
    stateFile: path.join(ccbDir, 'service.json'), // 存储PID和端口信息
    logsDir: path.join(ccbDir, 'logs')
  };
}

export const DEFAULT_CONFIG = {
  log: false,
  OPENAI_API_KEY: "",
  OPENAI_BASE_URL: "",
  OPENAI_MODEL: "",
  basePort: 3456, // 新增基础端口配置
  timeout: 30000,
  maxRetries: 3,
  logEnabled: false,
  autoStart: false,
  providers: [
    {
      id: "default",
      api_base_url: "",
      api_key: "",
      model: "gpt-3.5-turbo"
    }
  ],
  Router: {
    background: "",
    think: "",
    longContext: ""
  }
};
