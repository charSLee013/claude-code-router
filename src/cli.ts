#!/usr/bin/env node
import { run } from "./index";
import { closeService } from "./utils/close";
import { showStatus } from "./utils/status";
import { executeCodeCommand } from "./utils/codeCommand";
import { cleanupServiceState, isServiceRunning, getServiceState } from "./utils/processCheck";
import { version } from "../package.json";

const command = process.argv[2];

const HELP_TEXT = `
Usage: ccb [command] [options]

Commands:
  start         Start service for current workspace
  stop          Stop service for current workspace
  status        Show service status for current workspace
  code          Execute code command
  -v, version   Show version information
  -h, help      Show help information

Example:
  ccb start
  ccb code "Write a Hello World"
  ccb status
`;

async function waitForService(
  cwd: string,
  timeout = 10000,
  initialDelay = 1000
): Promise<boolean> {
  // Wait for an initial period to let the service initialize
  await new Promise((resolve) => setTimeout(resolve, initialDelay));

  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (isServiceRunning(cwd)) {
      // Wait for an additional short period to ensure service is fully ready
      await new Promise((resolve) => setTimeout(resolve, 500));
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

import { spawn } from "child_process";
import { REFERENCE_COUNT_FILE } from "./constants";
import { existsSync } from "fs";

// 将在下一步创建的gitignore utility
async function updateGitignore(cwd: string): Promise<void> {
  // 这个函数将在第8步创建
  // 临时空实现，避免编译错误
  console.log(`准备更新 ${cwd} 的 .gitignore 文件（功能即将实现）`);
}

async function main() {
  // 获取当前工作目录
  const cwd = process.cwd();

  switch (command) {
    case "start":
      // 在启动服务前更新 .gitignore
      await updateGitignore(cwd);
      await run(cwd);
      break;
    case "stop":
      try {
        const state = getServiceState(cwd);
        if (state) {
          process.kill(state.pid);
          cleanupServiceState(cwd);
          console.log(
            "ccb service has been successfully stopped for this workspace."
          );
        } else {
          console.log("No service is running for this workspace.");
        }
        
        // 清理全局引用计数文件（如果存在）
        if (existsSync(REFERENCE_COUNT_FILE)) {
          try {
            require("fs").unlinkSync(REFERENCE_COUNT_FILE);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      } catch (e) {
        console.log(
          "Failed to stop the service. It may have already been stopped."
        );
        cleanupServiceState(cwd);
      }
      break;
    case "status":
      await showStatus(cwd);
      break;
    case "code":
      if (!isServiceRunning(cwd)) {
        console.log("Service not running for this workspace, starting service...");
        // 更新 .gitignore
        await updateGitignore(cwd);
        spawn("ccb", ["start"], {
          detached: true,
          stdio: "ignore",
        }).unref();
        if (await waitForService(cwd)) {
          executeCodeCommand(cwd, process.argv.slice(3));
        } else {
          console.error(
            "Service startup timeout, please manually run ccb start to start the service"
          );
          process.exit(1);
        }
      } else {
        executeCodeCommand(cwd, process.argv.slice(3));
      }
      break;
    case "-v":
    case "version":
      console.log(`ccb version: ${version}`);
      break;
    case "-h":
    case "help":
      console.log(HELP_TEXT);
      break;
    default:
      console.log(HELP_TEXT);
      process.exit(1);
  }
}

main().catch(console.error);
