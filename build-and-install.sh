#!/bin/bash

# Claude Code Bridge (CCB) 构建与安装脚本
# 此脚本用于自动化 Claude Code Bridge 的构建和安装过程

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        log_error "$1 未安装。请先安装 $1。"
        exit 1
    fi
}

# 显示脚本头部
echo -e "${BLUE}====================================${NC}"
echo -e "${BLUE}  Claude Code Bridge (CCB) 构建与安装脚本  ${NC}"
echo -e "${BLUE}====================================${NC}"
echo ""

# 检查必要的依赖
log_info "检查必要的依赖..."
check_command node
check_command npm

# 检查 Node.js 版本
NODE_VERSION=$(node -v | cut -d 'v' -f 2)
REQUIRED_VERSION="14.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    log_warning "Node.js 版本 ($NODE_VERSION) 可能过低。推荐使用 v14.0.0 或更高版本。"
    read -p "是否继续？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 检测包管理器
if command -v pnpm &> /dev/null; then
    PACKAGE_MANAGER="pnpm"
elif command -v yarn &> /dev/null; then
    PACKAGE_MANAGER="yarn"
else
    PACKAGE_MANAGER="npm"
fi

log_info "将使用 $PACKAGE_MANAGER 作为包管理器"

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# 清理旧的构建文件
log_info "清理旧的构建文件..."
if [ -d "dist" ]; then
    rm -rf dist
    log_success "已清理 dist 目录"
fi

# 安装依赖
log_info "安装项目依赖..."
if [ "$PACKAGE_MANAGER" = "pnpm" ]; then
    pnpm install
elif [ "$PACKAGE_MANAGER" = "yarn" ]; then
    yarn install
else
    npm install
fi

if [ $? -ne 0 ]; then
    log_error "依赖安装失败"
    exit 1
fi
log_success "依赖安装完成"

# 构建项目
log_info "构建项目..."
if [ "$PACKAGE_MANAGER" = "pnpm" ]; then
    pnpm run build
elif [ "$PACKAGE_MANAGER" = "yarn" ]; then
    yarn build
else
    npm run build
fi

if [ $? -ne 0 ]; then
    log_error "项目构建失败"
    exit 1
fi
log_success "项目构建完成"

# 确保 CLI 文件具有执行权限
CLI_FILE="$SCRIPT_DIR/dist/cli.js"
if [ ! -f "$CLI_FILE" ]; then
    log_error "CLI 文件不存在: $CLI_FILE"
    exit 1
fi

chmod +x "$CLI_FILE"
log_success "已设置 CLI 文件执行权限"

# 全局安装
log_info "全局安装 Claude Code Bridge (CCB)..."
# 优先使用 npm link，因为它对于 bin 文件链接更可靠
npm link

if [ $? -ne 0 ]; then
    log_error "全局安装失败"
    exit 1
fi
log_success "全局安装完成"

# 创建全局配置目录和文件
GLOBAL_CONFIG_DIR="$HOME/.ccb"
GLOBAL_CONFIG_FILE="$GLOBAL_CONFIG_DIR/config.json"

log_info "创建全局配置目录和文件..."
if [ ! -d "$GLOBAL_CONFIG_DIR" ]; then
    mkdir -p "$GLOBAL_CONFIG_DIR"
    log_success "已创建全局配置目录: $GLOBAL_CONFIG_DIR"
fi

if [ ! -f "$GLOBAL_CONFIG_FILE" ]; then
    cat > "$GLOBAL_CONFIG_FILE" << EOF
{
  "OPENAI_API_KEY": "your-api-key",
  "OPENAI_BASE_URL": "https://api.deepseek.com",
  "OPENAI_MODEL": "deepseek-chat",
  "basePort": 3456,
  "timeout": 30000,
  "maxRetries": 3,
  "logEnabled": false,
  "autoStart": false,
  "providers": [
    {
      "id": "deepseek-chat",
      "api_base_url": "https://api.deepseek.com",
      "api_key": "your-deepseek-api-key",
      "model": "deepseek-chat"
    },
    {
      "id": "qwen-coder",
      "api_base_url": "http://localhost:11434/v1",
      "api_key": "ollama",
      "model": "qwen2.5-coder:latest",
      "extra_body": {
        "enable_thinking": true,
        "temperature": 0.1
      },
      "force_stream_for_thinking": true
    },
    {
      "id": "deepseek-reasoner",
      "api_base_url": "https://api.deepseek.com",
      "api_key": "your-deepseek-api-key",
      "model": "deepseek-reasoner"
    },
    {
      "id": "gemini-2.5-pro",
      "api_base_url": "https://openrouter.ai/api/v1",
      "api_key": "your-openrouter-api-key",
      "model": "google/gemini-2.5-pro-preview"
    }
  ],
  "Router": {
    "background": "qwen-coder",
    "think": "deepseek-reasoner",
    "longContext": "gemini-2.5-pro"
  }
}
EOF
    log_success "已创建默认全局配置文件: $GLOBAL_CONFIG_FILE"
    log_warning "请编辑配置文件，填入您的 API 密钥和其他设置"
else
    log_info "全局配置文件已存在: $GLOBAL_CONFIG_FILE"
fi

# 清理旧的配置目录 (如果存在)
OLD_CONFIG_DIR="$HOME/.claude-code-router"
if [ -d "$OLD_CONFIG_DIR" ]; then
    log_warning "检测到旧的配置目录: $OLD_CONFIG_DIR"
    read -p "是否要删除旧的配置目录？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$OLD_CONFIG_DIR"
        log_success "已删除旧的配置目录"
    fi
fi

# 显示使用说明
echo ""
echo -e "${GREEN}====================================${NC}"
echo -e "${GREEN}  Claude Code Bridge (CCB) 安装成功!  ${NC}"
echo -e "${GREEN}====================================${NC}"
echo ""
echo "全局配置文件位置: $GLOBAL_CONFIG_FILE"
echo ""
echo "使用方法:"
echo "1. 编辑全局配置文件，设置您的 API 密钥和模型配置"
echo "2. 在项目目录中运行: ccb start"
echo "3. 使用 Claude Code: ccb code \"your prompt\""
echo "4. 查看服务状态: ccb status"
echo "5. 停止服务: ccb stop"
echo ""
echo "工作区特性:"
echo "- 每个项目目录独立运行服务"
echo "- 自动创建 .ccb/ 目录存储工作区配置和日志"
echo "- 支持工作区级配置覆盖全局配置"
echo ""
echo "更多信息，请参考 README.md 和 DETAILED_GUIDE.md 文档。"
echo ""

exit 0 