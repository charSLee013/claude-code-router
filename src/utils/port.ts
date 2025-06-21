import { createServer } from 'node:net';

/**
 * 检查指定端口是否可用
 * @param port 要检查的端口号
 * @returns Promise<boolean> 端口是否可用
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    
    server.listen(port, () => {
      server.close(() => {
        resolve(true);
      });
    });
    
    server.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * 从基础端口开始查找可用端口
 * @param basePort 基础端口号
 * @param maxAttempts 最大尝试次数，默认为50
 * @returns Promise<number> 可用的端口号
 */
export async function findAvailablePort(basePort: number, maxAttempts: number = 50): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = basePort + i;
    
    // 跳过一些系统保留端口范围
    if (port > 65535) {
      throw new Error(`无法找到可用端口：已超过最大端口号 65535`);
    }
    
    try {
      const available = await isPortAvailable(port);
      if (available) {
        return port;
      }
    } catch (error) {
      console.warn(`检查端口 ${port} 时出错:`, error);
      continue;
    }
  }
  
  throw new Error(`无法找到可用端口：已尝试从 ${basePort} 到 ${basePort + maxAttempts - 1}`);
}

/**
 * 随机查找可用端口
 * @param minPort 最小端口号，默认为3000
 * @param maxPort 最大端口号，默认为65535
 * @param maxAttempts 最大尝试次数，默认为100
 * @returns Promise<number> 可用的端口号
 */
export async function findRandomAvailablePort(
  minPort: number = 3000, 
  maxPort: number = 65535, 
  maxAttempts: number = 100
): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    // 生成随机端口号
    const port = Math.floor(Math.random() * (maxPort - minPort + 1)) + minPort;
    
    try {
      const available = await isPortAvailable(port);
      if (available) {
        return port;
      }
    } catch (error) {
      console.warn(`检查端口 ${port} 时出错:`, error);
      continue;
    }
  }
  
  throw new Error(`无法找到可用端口：已尝试 ${maxAttempts} 次随机分配`);
}

/**
 * 获取端口范围内的所有可用端口
 * @param startPort 起始端口
 * @param endPort 结束端口
 * @returns Promise<number[]> 可用端口列表
 */
export async function getAvailablePorts(startPort: number, endPort: number): Promise<number[]> {
  const availablePorts: number[] = [];
  
  for (let port = startPort; port <= endPort; port++) {
    try {
      const available = await isPortAvailable(port);
      if (available) {
        availablePorts.push(port);
      }
    } catch (error) {
      // 忽略单个端口检查错误，继续检查其他端口
      continue;
    }
  }
  
  return availablePorts;
}

/**
 * 验证端口号是否有效
 * @param port 端口号
 * @returns boolean 端口号是否有效
 */
export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
} 