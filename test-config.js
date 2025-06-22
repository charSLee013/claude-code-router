const { loadConfig } = require('./dist/utils/config');
const cwd = process.cwd();

console.log('当前工作目录:', cwd);
console.log('加载的配置:', JSON.stringify(loadConfig(cwd), null, 2)); 