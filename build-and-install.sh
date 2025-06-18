#!/bin/bash

# Claude Code Router 构建与安装脚本
# 此脚本用于自动化 Claude Code Router 的构建和安装过程

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
echo -e "${BLUE}  Claude Code Router 构建与安装脚本  ${NC}"
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
    pnpm run buildserver
elif [ "$PACKAGE_MANAGER" = "yarn" ]; then
    yarn build
    yarn buildserver
else
    npm run build
    npm run buildserver
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
log_info "全局安装 Claude Code Router..."
# 优先使用 npm link，因为它对于 bin 文件链接更可靠
npm link

if [ $? -ne 0 ]; then
    log_error "全局安装失败"
    exit 1
fi
log_success "全局安装完成"

# 创建配置目录和文件
CONFIG_DIR="$HOME/.claude-code-router"
CONFIG_FILE="$CONFIG_DIR/config.json"

log_info "创建配置目录和文件..."
if [ ! -d "$CONFIG_DIR" ]; then
    mkdir -p "$CONFIG_DIR"
    log_success "已创建配置目录: $CONFIG_DIR"
fi

if [ ! -f "$CONFIG_FILE" ]; then
    cat > "$CONFIG_FILE" << EOF
{
  "providers": [
    {
      "id": "default-model",
      "api_base_url": "https://api.openai.com/v1",
      "api_key": "your-api-key",
      "model": "gpt-3.5-turbo"
    },
    {
      "id": "qwen-coder",
      "api_base_url": "http://localhost:11434/v1",
      "api_key": "ollama",
      "model": "qwen:latest",
      "extra_body": {
        "enable_thinking": true
      },
      "force_stream_for_thinking": true
    }
  ],
  "Router": {
    "background": "qwen-coder",
    "think": "default-model",
    "longContext": "default-model"
  }
}
EOF
    log_success "已创建默认配置文件: $CONFIG_FILE"
    log_warning "请编辑配置文件，填入您的 API 密钥和其他设置"
else
    log_info "配置文件已存在: $CONFIG_FILE"
fi

# 显示使用说明
echo ""
echo -e "${GREEN}====================================${NC}"
echo -e "${GREEN}  Claude Code Router 安装成功!  ${NC}"
echo -e "${GREEN}====================================${NC}"
echo ""
echo "配置文件位置: $CONFIG_FILE"
echo ""
echo "使用方法:"
echo "1. 编辑配置文件，设置您的 API 密钥和模型配置"
echo "2. 运行命令: ccr code"
echo ""
echo "更多信息，请参考项目文档。"
echo ""

exit 0 