import express, { RequestHandler } from "express";
import { log } from "./utils/log";
import { Config } from "./utils/config";

// 扩展 Express 的 Request 类型
declare global {
  namespace Express {
    interface Request {
      cwd?: string;
      config?: Config;
    }
  }
}

interface Server {
  app: express.Application;
  useMiddleware: (middleware: RequestHandler) => void;
  start: () => void;
  stop: () => void;
}

interface ServerOptions {
  port: number;
  cwd: string;
  config: Config;
}

export const createServer = async (options: ServerOptions): Promise<Server> => {
  const { port, cwd, config } = options;
  const app = express();
  
  // 配置JSON解析中间件
  app.use(express.json({ limit: "500mb" }));
  
  // 注入cwd和config到请求对象
  app.use((req, res, next) => {
    req.cwd = cwd;
    req.config = config;
    next();
  });
  
  // 请求日志中间件
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    log(cwd, `[${timestamp}] ${req.method} ${req.url} - ${req.ip}`);
    next();
  });
  
  // 健康检查端点
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      workspace: cwd,
      port: port
    });
  });
  
  // 服务器实例引用（用于停止服务器）
  let serverInstance: any = null;
  
  return {
    app,
    useMiddleware: (middleware: RequestHandler) => {
      app.use("/v1/messages", middleware);
    },
    start: () => {
      serverInstance = app.listen(port, () => {
        const message = `🚀 CCB服务器已启动`;
        console.log(message);
        console.log(`   工作区: ${cwd}`);
        console.log(`   端口: ${port}`);
        console.log(`   访问地址: http://localhost:${port}`);
        console.log(`   健康检查: http://localhost:${port}/health`);
        
        // 记录启动日志
        log(cwd, `服务器启动成功 - 端口: ${port}, 工作区: ${cwd}`);
        log(cwd, `配置信息:`, JSON.stringify(config, null, 2));
      });
      
      // 错误处理
      serverInstance.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`❌ 端口 ${port} 已被占用`);
          log(cwd, `错误: 端口 ${port} 已被占用`);
        } else {
          console.error(`❌ 服务器启动失败:`, error);
          log(cwd, `服务器启动失败:`, error);
        }
      });
    },
    stop: () => {
      if (serverInstance) {
        serverInstance.close(() => {
          console.log(`🛑 CCB服务器已停止`);
          log(cwd, `服务器已停止 - 端口: ${port}`);
        });
        serverInstance = null;
      }
    }
  };
};
