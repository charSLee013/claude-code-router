import { getServiceState } from './processCheck';
import { loadConfig } from './config';
import { getLogFilePath } from './log';
import { checkClaudeInstallation, getClaudeVersion } from './codeCommand';
import { getWorkspacePaths } from '../constants';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 显示工作区特定的服务状态
 * @param cwd 当前工作目录
 */
export async function showStatus(cwd: string) {
    const serviceState = getServiceState(cwd);
    const config = loadConfig(cwd);
    const workspacePaths = getWorkspacePaths(cwd);
    
    console.log('\n📊 CCB (Claude Code Bridge) 状态');
    console.log('═'.repeat(50));
    console.log(`📁 工作区: ${cwd}`);
    console.log('');
    
    // 服务状态
    if (serviceState) {
        console.log('✅ 服务状态: 运行中');
        console.log(`🆔 进程ID: ${serviceState.pid}`);
        console.log(`🌐 端口: ${serviceState.port}`);
        console.log(`📡 API端点: http://localhost:${serviceState.port}`);
        console.log(`🏥 健康检查: http://localhost:${serviceState.port}/health`);
        console.log(`📄 状态文件: ${workspacePaths.stateFile}`);
        
        // 检查进程是否真的在运行
        try {
            process.kill(serviceState.pid, 0);
            console.log('✅ 进程验证: 正常运行');
        } catch (error) {
            console.log('⚠️  进程验证: 进程可能已停止，状态文件需要清理');
        }
    } else {
        console.log('❌ 服务状态: 未运行');
    }
    
    console.log('');
    
    // 配置信息
    console.log('⚙️  配置信息:');
    console.log(`   默认端口: ${config.port || 'N/A'}`);
    console.log(`   日志启用: ${config.log ? '是' : '否'}`);
    console.log(`   超时设置: ${config.timeout || 'N/A'}ms`);
    console.log(`   最大重试: ${config.maxRetries || 'N/A'}`);
    console.log(`   自动启动: ${config.features?.autostart ? '是' : '否'}`);
    console.log('');
    
    // 文件路径信息
    console.log('📂 文件路径:');
    console.log(`   配置文件: ${workspacePaths.configFile}`);
    console.log(`   日志文件: ${workspacePaths.logFile}`);
    console.log(`   状态文件: ${workspacePaths.stateFile}`);
    console.log(`   工作区目录: ${workspacePaths.ccbDir}`);
    console.log('');
    
    // 文件存在性检查
    console.log('📋 文件状态:');
    console.log(`   配置文件: ${fs.existsSync(workspacePaths.configFile) ? '✅ 存在' : '❌ 不存在'}`);
    console.log(`   日志文件: ${fs.existsSync(workspacePaths.logFile) ? '✅ 存在' : '❌ 不存在'}`);
    console.log(`   状态文件: ${fs.existsSync(workspacePaths.stateFile) ? '✅ 存在' : '❌ 不存在'}`);
    console.log(`   工作区目录: ${fs.existsSync(workspacePaths.ccbDir) ? '✅ 存在' : '❌ 不存在'}`);
    console.log('');
    
    // Claude Code 安装检查
    console.log('🔧 依赖检查:');
    const claudeInstalled = await checkClaudeInstallation();
    if (claudeInstalled) {
        const claudeVersion = await getClaudeVersion();
        console.log(`   Claude Code: ✅ 已安装 ${claudeVersion ? `(${claudeVersion})` : ''}`);
    } else {
        console.log('   Claude Code: ❌ 未安装');
        console.log('   安装命令: npm install -g @anthropic-ai/claude-code');
    }
    console.log('');
    
    // 日志文件大小（如果存在）
    if (fs.existsSync(workspacePaths.logFile)) {
        const logStats = fs.statSync(workspacePaths.logFile);
        const logSize = (logStats.size / 1024).toFixed(2);
        console.log(`📄 日志文件大小: ${logSize} KB`);
        console.log('');
    }
    
    // 操作建议
    console.log('💡 可用命令:');
    if (serviceState) {
        console.log('   ccb code [args]  # 使用Claude Code开始编程');
        console.log('   ccb stop         # 停止服务');
        console.log('   ccb status       # 显示状态信息');
    } else {
        console.log('   ccb start        # 启动服务');
        console.log('   ccb status       # 显示状态信息');
    }
    console.log('   ccb --help       # 显示帮助信息');
    console.log('   ccb --version    # 显示版本信息');
    console.log('');
}

/**
 * 显示简短的服务状态（用于脚本）
 * @param cwd 当前工作目录
 * @returns 状态信息对象
 */
export function getStatusSummary(cwd: string): {
    running: boolean;
    pid?: number;
    port?: number;
    workspace: string;
    configExists: boolean;
    logExists: boolean;
} {
    const serviceState = getServiceState(cwd);
    const workspacePaths = getWorkspacePaths(cwd);
    
    return {
        running: !!serviceState,
        pid: serviceState?.pid,
        port: serviceState?.port,
        workspace: cwd,
        configExists: fs.existsSync(workspacePaths.configFile),
        logExists: fs.existsSync(workspacePaths.logFile)
    };
}

/**
 * 以JSON格式输出状态信息
 * @param cwd 当前工作目录
 */
export async function showStatusJson(cwd: string) {
    const serviceState = getServiceState(cwd);
    const config = loadConfig(cwd);
    const workspacePaths = getWorkspacePaths(cwd);
    const claudeInstalled = await checkClaudeInstallation();
    const claudeVersion = claudeInstalled ? await getClaudeVersion() : null;
    
    const status = {
        service: {
            running: !!serviceState,
            pid: serviceState?.pid,
            port: serviceState?.port,
            endpoint: serviceState ? `http://localhost:${serviceState.port}` : null,
            healthCheck: serviceState ? `http://localhost:${serviceState.port}/health` : null
        },
        workspace: {
            path: cwd,
            configFile: workspacePaths.configFile,
            logFile: workspacePaths.logFile,
            stateFile: workspacePaths.stateFile,
            ccbDir: workspacePaths.ccbDir
        },
        config: {
            port: config.port,
            log: config.log,
            timeout: config.timeout,
            maxRetries: config.maxRetries,
            autostart: config.features?.autostart
        },
        files: {
            configExists: fs.existsSync(workspacePaths.configFile),
            logExists: fs.existsSync(workspacePaths.logFile),
            stateExists: fs.existsSync(workspacePaths.stateFile),
            ccbDirExists: fs.existsSync(workspacePaths.ccbDir),
            logSize: fs.existsSync(workspacePaths.logFile) ? 
                fs.statSync(workspacePaths.logFile).size : 0
        },
        dependencies: {
            claudeInstalled,
            claudeVersion
        },
        timestamp: new Date().toISOString()
    };
    
    console.log(JSON.stringify(status, null, 2));
}
