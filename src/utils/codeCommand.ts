import { spawn } from "child_process";
import { getServiceState, cleanupServiceState } from "./processCheck";
import { closeService } from "./close";
import { log } from "./log";
import { loadConfig } from "./config";

/**
 * 执行代码命令（工作区特定）
 * @param cwd 当前工作目录
 * @param args 命令参数
 */
export async function executeCodeCommand(cwd: string, args: string[] = []) {
  // 加载工作区配置
  const config = loadConfig(cwd);
  
  // 获取服务状态
  const serviceState = getServiceState(cwd);
  
  if (!serviceState) {
    console.error("❌ 服务未运行，无法执行代码命令");
    log(cwd, "错误: 尝试执行代码命令但服务未运行");
    process.exit(1);
  }

  // 设置环境变量
  const env = {
    ...process.env,
    DISABLE_PROMPT_CACHING: "1",
    ANTHROPIC_AUTH_TOKEN: "test",
    ANTHROPIC_BASE_URL: `http://127.0.0.1:${serviceState.port}`,
    API_TIMEOUT_MS: config.timeout?.toString() || "600000",
  };

  // 记录命令执行
  log(cwd, `开始执行代码命令: ${args.join(' ')}`);
  log(cwd, `服务端口: ${serviceState.port}`);
  log(cwd, `工作区: ${cwd}`);

  // 执行claude命令
  const claudePath = process.env.CLAUDE_PATH || "claude";
  const claudeProcess = spawn(claudePath, args, {
    env,
    stdio: "inherit",
    shell: true,
    cwd: cwd // 确保在正确的工作目录中执行
  });

  claudeProcess.on("error", (error) => {
    const errorMessage = `启动claude命令失败: ${error.message}`;
    console.error(`❌ ${errorMessage}`);
    console.log("请确保已安装 Claude Code: npm install -g @anthropic-ai/claude-code");
    
    log(cwd, `错误: ${errorMessage}`);
    process.exit(1);
  });

  claudeProcess.on("close", (code) => {
    const exitMessage = `代码命令执行完成，退出代码: ${code || 0}`;
    console.log(`✅ ${exitMessage}`);
    log(cwd, exitMessage);
    
    // 注意：不自动关闭服务，让服务继续运行以供后续使用
    // 用户可以手动使用 'ccb stop' 命令停止服务
    process.exit(code || 0);
  });

  // 处理进程信号
  process.on('SIGINT', () => {
    console.log('\n🛑 接收到中断信号，正在停止代码命令...');
    log(cwd, '代码命令被用户中断');
    claudeProcess.kill('SIGINT');
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 接收到终止信号，正在停止代码命令...');
    log(cwd, '代码命令被系统终止');
    claudeProcess.kill('SIGTERM');
  });
}

/**
 * 检查Claude Code是否已安装
 * @returns Promise<boolean> 是否已安装
 */
export async function checkClaudeInstallation(): Promise<boolean> {
  return new Promise((resolve) => {
    const claudePath = process.env.CLAUDE_PATH || "claude";
    const checkProcess = spawn(claudePath, ['--version'], {
      stdio: 'pipe',
      shell: true
    });

    checkProcess.on('error', () => {
      resolve(false);
    });

    checkProcess.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

/**
 * 获取Claude Code版本信息
 * @returns Promise<string | null> 版本信息或null
 */
export async function getClaudeVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    const claudePath = process.env.CLAUDE_PATH || "claude";
    const versionProcess = spawn(claudePath, ['--version'], {
      stdio: 'pipe',
      shell: true
    });

    let output = '';
    
    versionProcess.stdout?.on('data', (data) => {
      output += data.toString();
    });

    versionProcess.on('error', () => {
      resolve(null);
    });

    versionProcess.on('close', (code) => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        resolve(null);
      }
    });
  });
}
