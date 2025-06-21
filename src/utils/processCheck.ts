import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { REFERENCE_COUNT_FILE, getWorkspacePaths } from '../constants';

export function incrementReferenceCount() {
    let count = 0;
    if (existsSync(REFERENCE_COUNT_FILE)) {
        count = parseInt(readFileSync(REFERENCE_COUNT_FILE, 'utf-8')) || 0;
    }
    count++;
    writeFileSync(REFERENCE_COUNT_FILE, count.toString());
}

export function decrementReferenceCount() {
    let count = 0;
    if (existsSync(REFERENCE_COUNT_FILE)) {
        count = parseInt(readFileSync(REFERENCE_COUNT_FILE, 'utf-8')) || 0;
    }
    count = Math.max(0, count - 1);
    writeFileSync(REFERENCE_COUNT_FILE, count.toString());
}

export function getReferenceCount(): number {
    if (!existsSync(REFERENCE_COUNT_FILE)) {
        return 0;
    }
    return parseInt(readFileSync(REFERENCE_COUNT_FILE, 'utf-8')) || 0;
}

export interface ServiceState {
    pid: number;
    port: number;
    startTime: number;
    cwd: string;
}

export function isServiceRunning(cwd: string): boolean {
    const workspacePaths = getWorkspacePaths(cwd);
    
    if (!existsSync(workspacePaths.stateFile)) {
        return false;
    }

    try {
        const state = getServiceState(cwd);
        if (!state) {
            return false;
        }
        
        process.kill(state.pid, 0);
        return true;
    } catch (e) {
        cleanupServiceState(cwd);
        return false;
    }
}

export function getServiceState(cwd: string): ServiceState | null {
    const workspacePaths = getWorkspacePaths(cwd);
    
    if (!existsSync(workspacePaths.stateFile)) {
        return null;
    }
    
    try {
        const content = readFileSync(workspacePaths.stateFile, 'utf-8');
        const state = JSON.parse(content) as ServiceState;
        
        if (typeof state.pid === 'number' && typeof state.port === 'number') {
            return state;
        }
        
        return null;
    } catch (e) {
        console.warn(`警告：读取服务状态文件失败: ${workspacePaths.stateFile}`, e);
        return null;
    }
}

export function saveServiceState(cwd: string, pid: number, port: number): void {
    const workspacePaths = getWorkspacePaths(cwd);
    
    const state: ServiceState = {
        pid,
        port,
        startTime: Date.now(),
        cwd
    };
    
    try {
        writeFileSync(workspacePaths.stateFile, JSON.stringify(state, null, 2));
    } catch (e) {
        console.error(`错误：无法保存服务状态到 ${workspacePaths.stateFile}`, e);
    }
}

export function cleanupServiceState(cwd: string): void {
    const workspacePaths = getWorkspacePaths(cwd);
    
    if (existsSync(workspacePaths.stateFile)) {
        try {
            unlinkSync(workspacePaths.stateFile);
        } catch (e) {
            console.warn(`警告：清理服务状态文件失败: ${workspacePaths.stateFile}`, e);
        }
    }
}

export function getServicePid(cwd: string): number | null {
    const state = getServiceState(cwd);
    return state ? state.pid : null;
}

export function getServiceInfo(cwd: string) {
    const state = getServiceState(cwd);
    const running = isServiceRunning(cwd);
    const workspacePaths = getWorkspacePaths(cwd);
    
    return {
        running,
        pid: state?.pid || null,
        port: state?.port || null,
        endpoint: state ? `http://127.0.0.1:${state.port}` : null,
        stateFile: workspacePaths.stateFile,
        startTime: state?.startTime || null,
        cwd: state?.cwd || cwd,
        referenceCount: getReferenceCount()
    };
}

export function savePid(pid: number) {
    console.warn('savePid() 已弃用，请使用 saveServiceState(cwd, pid, port)');
}

/**
 * @deprecated 使用 cleanupServiceState(cwd) 代替
 */
export function cleanupPidFile() {
    console.warn('cleanupPidFile() 已弃用，请使用 cleanupServiceState(cwd)');
}