import fs from "node:fs";
import path from "node:path";
import { getWorkspacePaths } from "../constants";

/**
 * 确保日志目录存在
 * @param logFilePath 日志文件路径
 */
function ensureLogDir(logFilePath: string): void {
  const logDir = path.dirname(logFilePath);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

/**
 * 工作区特定的日志函数
 * @param cwd 当前工作目录
 * @param args 要记录的参数
 */
export function log(cwd: string, ...args: any[]) {
  // Check if logging is enabled via environment variable or config
  const isLogEnabled = process.env.LOG === "true";

  if (!isLogEnabled) {
    return;
  }

  const workspacePaths = getWorkspacePaths(cwd);
  
  // Ensure log directory exists
  ensureLogDir(workspacePaths.logFile);

  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${
    Array.isArray(args)
      ? args
          .map((arg) =>
            typeof arg === "object" ? JSON.stringify(arg) : String(arg)
          )
          .join(" ")
      : ""
  }\n`;

  // Append to workspace-specific log file
  try {
    fs.appendFileSync(workspacePaths.logFile, logMessage, "utf8");
  } catch (error) {
    console.warn(`警告：无法写入日志文件 ${workspacePaths.logFile}:`, error);
  }
}

/**
 * 配置感知的日志函数（从配置中读取日志设置）
 * @param cwd 当前工作目录
 * @param config 配置对象
 * @param args 要记录的参数
 */
export function logWithConfig(cwd: string, config: any, ...args: any[]) {
  // 调试信息
  console.log(`[DEBUG] logWithConfig called - config.log: ${config?.log}, process.env.LOG: ${process.env.LOG}`);
  
  // Check if logging is enabled via config or environment variable
  const isLogEnabled = config?.log === true || config?.logEnabled === true || process.env.LOG === "true";

  console.log(`[DEBUG] isLogEnabled: ${isLogEnabled}`);

  if (!isLogEnabled) {
    return;
  }

  const workspacePaths = getWorkspacePaths(cwd);
  
  console.log(`[DEBUG] Log file path: ${workspacePaths.logFile}`);
  
  // Ensure log directory exists
  ensureLogDir(workspacePaths.logFile);

  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${
    Array.isArray(args)
      ? args
          .map((arg) =>
            typeof arg === "object" ? JSON.stringify(arg) : String(arg)
          )
          .join(" ")
      : ""
  }\n`;

  // Append to workspace-specific log file
  try {
    fs.appendFileSync(workspacePaths.logFile, logMessage, "utf8");
    console.log(`[DEBUG] Successfully wrote to log file: ${workspacePaths.logFile}`);
  } catch (error) {
    console.warn(`警告：无法写入日志文件 ${workspacePaths.logFile}:`, error);
  }
}

/**
 * 获取工作区的日志文件路径
 * @param cwd 当前工作目录
 * @returns 日志文件路径
 */
export function getLogFilePath(cwd: string): string {
  const workspacePaths = getWorkspacePaths(cwd);
  return workspacePaths.logFile;
}

/**
 * 清理工作区的日志文件
 * @param cwd 当前工作目录
 */
export function clearWorkspaceLogs(cwd: string): void {
  const workspacePaths = getWorkspacePaths(cwd);
  
  try {
    if (fs.existsSync(workspacePaths.logFile)) {
      fs.unlinkSync(workspacePaths.logFile);
      console.log(`已清理工作区日志文件: ${workspacePaths.logFile}`);
    }
  } catch (error) {
    console.warn(`警告：清理日志文件失败 ${workspacePaths.logFile}:`, error);
  }
}
