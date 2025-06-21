import { getServiceState, cleanupServiceState } from './processCheck';
import { log } from './log';

/**
 * 关闭工作区特定的服务
 * @param cwd 当前工作目录
 * @param force 是否强制关闭（跳过优雅关闭）
 */
export async function closeService(cwd: string, force: boolean = false) {
    const serviceState = getServiceState(cwd);
    
    if (!serviceState) {
        console.log("❌ 当前工作区没有运行的服务");
        log(cwd, "尝试关闭服务，但服务未运行");
        return { success: false, message: "服务未运行" };
    }

    console.log(`🛑 正在停止服务 (PID: ${serviceState.pid}, 端口: ${serviceState.port})...`);
    log(cwd, `开始停止服务 - PID: ${serviceState.pid}, 端口: ${serviceState.port}`);

    try {
        // 首先检查进程是否还存在
        try {
            process.kill(serviceState.pid, 0);
        } catch (error) {
            console.log("⚠️  进程已经不存在，清理状态文件");
            log(cwd, `进程 ${serviceState.pid} 已不存在，清理状态文件`);
            cleanupServiceState(cwd);
            return { success: true, message: "服务已停止（进程不存在）" };
        }

        if (force) {
            // 强制关闭 - 直接发送 SIGKILL
            console.log("⚡ 强制停止服务...");
            log(cwd, `强制停止服务 - PID: ${serviceState.pid}`);
            process.kill(serviceState.pid, 'SIGKILL');
        } else {
            // 优雅关闭 - 先发送 SIGTERM，等待一段时间后发送 SIGKILL
            console.log("🤝 尝试优雅停止服务...");
            log(cwd, `优雅停止服务 - PID: ${serviceState.pid}`);
            
            process.kill(serviceState.pid, 'SIGTERM');
            
            // 等待进程自然退出
            await new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    try {
                        process.kill(serviceState.pid, 0);
                        // 进程仍然存在
                    } catch (error) {
                        // 进程已经退出
                        clearInterval(checkInterval);
                        resolve(true);
                    }
                }, 100);
                
                // 5秒后强制终止
                setTimeout(() => {
                    clearInterval(checkInterval);
                    try {
                        process.kill(serviceState.pid, 0);
                        console.log("⚡ 优雅停止超时，强制终止服务");
                        log(cwd, `优雅停止超时，强制终止服务 - PID: ${serviceState.pid}`);
                        process.kill(serviceState.pid, 'SIGKILL');
                    } catch (error) {
                        // 进程已经退出
                    }
                    resolve(true);
                }, 5000);
            });
        }

        // 清理状态文件
        cleanupServiceState(cwd);
        
        const message = "✅ CCB服务已成功停止";
        console.log(message);
        log(cwd, `服务停止成功 - PID: ${serviceState.pid}, 端口: ${serviceState.port}`);
        
        return { success: true, message: "服务已停止" };
        
    } catch (error) {
        const errorMessage = `停止服务失败: ${error}`;
        console.log(`❌ ${errorMessage}`);
        log(cwd, `停止服务失败: ${error}`);
        
        // 即使停止失败，也尝试清理状态文件
        console.log("🧹 清理状态文件...");
        cleanupServiceState(cwd);
        
        return { success: false, message: errorMessage };
    }
}

/**
 * 停止所有工作区的服务（全局清理）
 * 注意：这个函数会扫描并停止所有可能的CCB服务
 */
export async function closeAllServices(): Promise<{ stopped: number; errors: string[] }> {
    // 这个函数需要扫描所有可能的工作区
    // 由于我们无法轻易枚举所有工作区，这里提供一个基本实现
    console.log("⚠️  全局服务停止功能需要手动指定工作区");
    console.log("💡 请在每个项目目录中运行 'ccb stop' 来停止对应的服务");
    
    return { stopped: 0, errors: ["全局停止功能未实现"] };
}

/**
 * 检查并清理僵尸进程状态
 * @param cwd 当前工作目录
 */
export function cleanupZombieState(cwd: string): boolean {
    const serviceState = getServiceState(cwd);
    
    if (!serviceState) {
        return false; // 没有状态文件，无需清理
    }
    
    try {
        // 检查进程是否还存在
        process.kill(serviceState.pid, 0);
        return false; // 进程存在，不是僵尸状态
    } catch (error) {
        // 进程不存在，清理状态文件
        console.log(`🧹 清理僵尸状态文件 (PID: ${serviceState.pid})`);
        log(cwd, `清理僵尸状态文件 - PID: ${serviceState.pid}`);
        cleanupServiceState(cwd);
        return true;
    }
}

/**
 * 等待服务停止
 * @param cwd 当前工作目录
 * @param timeoutMs 超时时间（毫秒）
 * @returns Promise<boolean> 是否成功停止
 */
export async function waitForServiceStop(cwd: string, timeoutMs: number = 10000): Promise<boolean> {
    return new Promise((resolve) => {
        const startTime = Date.now();
        
        const checkStop = () => {
            const serviceState = getServiceState(cwd);
            
            if (!serviceState) {
                resolve(true); // 服务已停止
                return;
            }
            
            if (Date.now() - startTime > timeoutMs) {
                resolve(false); // 超时
                return;
            }
            
            setTimeout(checkStop, 200);
        };
        
        checkStop();
    });
}
