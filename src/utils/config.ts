import fs from "node:fs";
import path from "node:path";
import { DEFAULT_CONFIG, GLOBAL_CONFIG_FILE, getWorkspacePaths } from "../constants";

/**
 * 配置类型定义
 */
export interface Config {
  port?: number;
  log?: boolean;
  timeout?: number;
  maxRetries?: number;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
  basePort?: number;
  logEnabled?: boolean;
  autoStart?: boolean;
  providers?: Array<{
    id: string;
    api_base_url: string;
    api_key: string;
    model: string;
    extra_body?: Record<string, any>;
    force_stream_for_thinking?: boolean;
  }>;
  Router?: {
    background?: string;
    think?: string;
    longContext?: string;
  };
  usePlugins?: string[];
  features?: {
    autostart?: boolean;
    enableLogging?: boolean;
    enableTelemetry?: boolean;
  };
  [key: string]: any;
}

/**
 * 配置层级枚举
 */
export enum ConfigLevel {
  DEFAULT = 'default',
  GLOBAL = 'global', 
  WORKSPACE = 'workspace'
}

/**
 * 安全地读取和解析JSON配置文件
 * @param filePath 配置文件路径
 * @returns 解析后的配置对象，如果文件不存在或解析失败则返回空对象
 */
function safeReadConfig(filePath: string): Record<string, any> {
  try {
    if (!fs.existsSync(filePath)) {
      return {};
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`警告：读取配置文件 ${filePath} 失败:`, error);
    return {};
  }
}

/**
 * 安全地写入JSON配置文件
 * @param filePath 配置文件路径
 * @param config 配置对象
 */
function safeWriteConfig(filePath: string, config: Record<string, any>): void {
  try {
    // 确保目录存在
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // 写入配置文件，格式化JSON
    const content = JSON.stringify(config, null, 2);
    fs.writeFileSync(filePath, content, 'utf-8');
  } catch (error) {
    console.error(`错误：写入配置文件 ${filePath} 失败:`, error);
    throw error;
  }
}

/**
 * 深度合并配置对象
 * @param target 目标对象
 * @param source 源对象
 * @returns 合并后的对象
 */
function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  const result = { ...target };
  
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (
        typeof source[key] === 'object' && 
        source[key] !== null && 
        !Array.isArray(source[key]) &&
        typeof target[key] === 'object' && 
        target[key] !== null && 
        !Array.isArray(target[key])
      ) {
        result[key] = deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }
  
  return result;
}

/**
 * 验证配置对象的基本结构
 * @param config 要验证的配置对象
 * @returns 验证结果和错误信息
 */
function validateConfig(config: Record<string, any>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // 验证端口号
  if (config.port !== undefined) {
    if (typeof config.port !== 'number' || config.port < 1 || config.port > 65535) {
      errors.push('端口号必须是1-65535之间的数字');
    }
  }
  
  // 验证超时设置
  if (config.timeout !== undefined) {
    if (typeof config.timeout !== 'number' || config.timeout < 0) {
      errors.push('超时设置必须是非负数');
    }
  }
  
  // 验证重试次数
  if (config.maxRetries !== undefined) {
    if (typeof config.maxRetries !== 'number' || config.maxRetries < 0) {
      errors.push('最大重试次数必须是非负整数');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 加载和合并配置
 * 按顺序加载：默认配置 -> 全局配置 -> 工作区配置
 * @param cwd 当前工作目录
 * @returns 合并后的最终配置对象
 */
export function loadConfig(cwd: string): Config {
  const workspacePaths = getWorkspacePaths(cwd);
  
  // 第一层：默认配置
  let config = { ...DEFAULT_CONFIG };
  
  // 第二层：全局用户配置
  const globalConfig = safeReadConfig(GLOBAL_CONFIG_FILE);
  config = deepMerge(config, globalConfig);
  
  // 第三层：工作区配置
  const workspaceConfig = safeReadConfig(workspacePaths.configFile);
  config = deepMerge(config, workspaceConfig);
  
  // 验证最终配置
  const validation = validateConfig(config);
  if (!validation.valid) {
    console.warn('配置验证失败:', validation.errors.join(', '));
  }
  
  return config as Config;
}

/**
 * 保存配置到指定层级
 * @param cwd 当前工作目录
 * @param config 要保存的配置对象
 * @param level 配置层级
 */
export function saveConfig(cwd: string, config: Partial<Config>, level: ConfigLevel = ConfigLevel.WORKSPACE): void {
  // 验证配置
  const validation = validateConfig(config);
  if (!validation.valid) {
    throw new Error(`配置验证失败: ${validation.errors.join(', ')}`);
  }
  
  let configPath: string;
  
  switch (level) {
    case ConfigLevel.GLOBAL:
      configPath = GLOBAL_CONFIG_FILE;
      break;
    case ConfigLevel.WORKSPACE:
      const workspacePaths = getWorkspacePaths(cwd);
      configPath = workspacePaths.configFile;
      break;
    default:
      throw new Error(`不支持保存到 ${level} 层级的配置`);
  }
  
  // 读取现有配置并合并
  const existingConfig = safeReadConfig(configPath);
  const mergedConfig = deepMerge(existingConfig, config);
  
  // 保存配置
  safeWriteConfig(configPath, mergedConfig);
  
  console.log(`✅ 配置已保存到 ${level} 层级: ${configPath}`);
}

/**
 * 获取特定层级的配置
 * @param cwd 当前工作目录
 * @param level 配置层级
 * @returns 指定层级的配置对象
 */
export function getConfigByLevel(cwd: string, level: ConfigLevel): Config {
  switch (level) {
    case ConfigLevel.DEFAULT:
      return { ...DEFAULT_CONFIG } as Config;
    case ConfigLevel.GLOBAL:
      return safeReadConfig(GLOBAL_CONFIG_FILE) as Config;
    case ConfigLevel.WORKSPACE:
      const workspacePaths = getWorkspacePaths(cwd);
      return safeReadConfig(workspacePaths.configFile) as Config;
    default:
      throw new Error(`不支持的配置层级: ${level}`);
  }
}

/**
 * 删除配置项
 * @param cwd 当前工作目录
 * @param keys 要删除的配置键路径（支持嵌套，如 'providers.openai.apiKey'）
 * @param level 配置层级
 */
export function removeConfigKeys(cwd: string, keys: string[], level: ConfigLevel = ConfigLevel.WORKSPACE): void {
  let configPath: string;
  
  switch (level) {
    case ConfigLevel.GLOBAL:
      configPath = GLOBAL_CONFIG_FILE;
      break;
    case ConfigLevel.WORKSPACE:
      const workspacePaths = getWorkspacePaths(cwd);
      configPath = workspacePaths.configFile;
      break;
    default:
      throw new Error(`不支持删除 ${level} 层级的配置`);
  }
  
  const config = safeReadConfig(configPath);
  
  // 删除指定的配置项
  for (const keyPath of keys) {
    const keys = keyPath.split('.');
    let current = config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (current[keys[i]] && typeof current[keys[i]] === 'object') {
        current = current[keys[i]];
      } else {
        break;
      }
    }
    
    if (current && current.hasOwnProperty(keys[keys.length - 1])) {
      delete current[keys[keys.length - 1]];
      console.log(`✅ 已删除配置项: ${keyPath}`);
    }
  }
  
  // 保存更新后的配置
  safeWriteConfig(configPath, config);
}

/**
 * 确保工作区目录存在
 * @param cwd 当前工作目录
 */
export function ensureWorkspaceDir(cwd: string): void {
  const workspacePaths = getWorkspacePaths(cwd);
  
  // 确保 .ccb 目录存在
  if (!fs.existsSync(workspacePaths.ccbDir)) {
    fs.mkdirSync(workspacePaths.ccbDir, { recursive: true });
  }
  
  // 确保 logs 目录存在
  if (!fs.existsSync(workspacePaths.logsDir)) {
    fs.mkdirSync(workspacePaths.logsDir, { recursive: true });
  }
}

/**
 * 初始化工作区配置（如果不存在）
 * @param cwd 当前工作目录
 */
export function initWorkspaceConfig(cwd: string): void {
  ensureWorkspaceDir(cwd);
  
  const workspacePaths = getWorkspacePaths(cwd);
  
  // 如果工作区配置文件不存在，创建一个基本的配置文件
  if (!fs.existsSync(workspacePaths.configFile)) {
    const initialConfig: Partial<Config> = {
      // 工作区特定的初始配置
      features: {
        autostart: true,
        enableLogging: false
      }
    };
    
    safeWriteConfig(workspacePaths.configFile, initialConfig);
    console.log(`✅ 已初始化工作区配置文件: ${workspacePaths.configFile}`);
  }
} 