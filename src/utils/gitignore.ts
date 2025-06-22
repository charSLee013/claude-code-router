import fs from "node:fs";
import path from "node:path";

/**
 * 检查.gitignore文件中是否已包含指定的条目
 * @param gitignorePath .gitignore文件路径
 * @param entry 要检查的条目
 * @returns boolean 是否已包含该条目
 */
function hasGitignoreEntry(gitignorePath: string, entry: string): boolean {
  if (!fs.existsSync(gitignorePath)) {
    return false;
  }
  
  try {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    const lines = content.split('\n').map(line => line.trim());
    
    // 检查是否存在完全匹配的条目
    return lines.includes(entry);
  } catch (error) {
    console.warn(`警告：读取 .gitignore 文件失败: ${gitignorePath}`, error);
    return false;
  }
}

/**
 * 向.gitignore文件添加条目
 * @param gitignorePath .gitignore文件路径
 * @param entry 要添加的条目
 */
function addGitignoreEntry(gitignorePath: string, entry: string): void {
  try {
    let content = '';
    
    // 如果文件存在，读取现有内容
    if (fs.existsSync(gitignorePath)) {
      content = fs.readFileSync(gitignorePath, 'utf-8');
    }
    
    // 确保内容以换行符结尾（如果不为空）
    if (content && !content.endsWith('\n')) {
      content += '\n';
    }
    
    // 添加新条目
    content += `${entry}\n`;
    
    // 写入文件
    fs.writeFileSync(gitignorePath, content, 'utf-8');
    
    console.log(`✅ 已将 "${entry}" 添加到 .gitignore 文件`);
  } catch (error) {
    console.warn(`警告：无法更新 .gitignore 文件: ${gitignorePath}`, error);
  }
}

/**
 * 更新工作区的.gitignore文件，添加.claude目录
 * @param cwd 当前工作目录
 */
export function updateGitignore(cwd: string): void {
  const gitignorePath = path.join(cwd, '.gitignore');
  const claudeEntry = '.claude/';
  
  // 检查.gitignore文件是否存在
  if (!fs.existsSync(gitignorePath)) {
    console.log('未找到 .gitignore 文件，跳过添加 .claude/ 条目');
    return;
  }
  
  // 检查是否已包含.claude条目
  if (hasGitignoreEntry(gitignorePath, claudeEntry)) {
    console.log('✅ .gitignore 文件中已包含 .claude/ 条目');
    return;
  }
  
  // 添加.claude条目
  addGitignoreEntry(gitignorePath, claudeEntry);
}

/**
 * 创建标准的.gitignore文件（如果不存在）
 * @param cwd 当前工作目录
 * @param includeCommonEntries 是否包含常见的忽略条目
 */
export function createGitignore(cwd: string, includeCommonEntries: boolean = false): void {
  const gitignorePath = path.join(cwd, '.gitignore');
  
  if (fs.existsSync(gitignorePath)) {
    console.log('.gitignore 文件已存在，跳过创建');
    return;
  }
  
  let content = '';
  
  if (includeCommonEntries) {
    content = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# IDE
.vscode/
.idea/

# CCB workspace data
.claude/
`;
  } else {
    content = `# CCB workspace data
.claude/
`;
  }
  
  try {
    fs.writeFileSync(gitignorePath, content, 'utf-8');
    console.log('✅ 已创建 .gitignore 文件');
  } catch (error) {
    console.warn(`警告：无法创建 .gitignore 文件: ${gitignorePath}`, error);
  }
}

/**
 * 检查工作区是否为Git仓库
 * @param cwd 当前工作目录
 * @returns boolean 是否为Git仓库
 */
export function isGitRepository(cwd: string): boolean {
  const gitDir = path.join(cwd, '.git');
  return fs.existsSync(gitDir);
}

/**
 * 智能更新.gitignore文件
 * 如果是Git仓库且存在.gitignore文件，则添加.claude/条目
 * @param cwd 当前工作目录
 */
export function smartUpdateGitignore(cwd: string): void {
  if (!isGitRepository(cwd)) {
    console.log('当前目录不是 Git 仓库，跳过 .gitignore 更新');
    return;
  }
  
  updateGitignore(cwd);
} 