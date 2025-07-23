import { getServiceState } from './processCheck';
import { loadConfig } from './config';
import { getLogFilePath } from './log';
import { checkClaudeInstallation, getClaudeVersion } from './codeCommand';
import { getWorkspacePaths } from '../constants';
import { checkProviders, ProviderStatus } from './providerCheck';
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
    
    // 服务状态
    if (serviceState) {
        console.log(`Service: Running (PID: ${serviceState.pid}, Port: ${serviceState.port})`);
    } else {
        console.log('Service: Stopped');
    }
    
    // 文件状态
    console.log(`Config: ${fs.existsSync(workspacePaths.configFile) ? 'Found' : 'Not found'}`);
    console.log(`Log: ${fs.existsSync(workspacePaths.logFile) ? 'Found' : 'Not found'}`);
    
    // Claude Code 状态
    const claudeInstalled = await checkClaudeInstallation();
    console.log(`Claude Code: ${claudeInstalled ? 'Installed' : 'Not installed'}`);
    
    // Provider 状态
    try {
        const providerStatuses = await checkProviders(config);
        const accessibleProviders = providerStatuses.filter(p => p.accessible === '✅').length;
        console.log(`Providers: ${accessibleProviders}/${providerStatuses.length} accessible`);
    } catch (error: any) {
        console.log(`Providers: Check failed - ${error.message}`);
    }
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
