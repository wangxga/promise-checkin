#!/bin/bash
# 如约打卡后端镜像构建脚本
# 用法: ./build.sh [版本号]
#   版本号默认: v1.0
#
# 功能：
#   1. 构建 Docker 镜像（linux/amd64 架构，适配阿里云服务器）
#   2. 询问是否导出为 .tar 文件（用于手工上传到服务器）
#
# 部署流程：
#   本地运行此脚本 → 生成 checkin-backend-v1.0.tar → 上传到服务器 → docker load 导入 → docker compose up

VERSION=${1:-"v1.0"}

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${GREEN}======================================"
echo "如约打卡后端镜像构建"
echo "======================================${NC}"
echo -e "${YELLOW}版本: $VERSION${NC}"
echo ""

# 检查 Docker
if ! docker version > /dev/null 2>&1; then
    echo -e "${RED}错误: Docker 未运行!${NC}"
    exit 1
fi

# 获取项目根目录（scripts/ → docker/ → packages/ → 项目根，上 3 层）
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"
cd "$PROJECT_ROOT"

echo -e "${CYAN}项目根目录: $PROJECT_ROOT${NC}"
echo ""

# 构建
echo -e "${CYAN}正在构建后端镜像（linux/amd64）...${NC}"
echo -e "${YELLOW}⚠️  --no-cache 强制重新构建${NC}"
echo ""

docker build --platform linux/amd64 --no-cache \
    -f packages/docker/backend/Dockerfile \
    -t "checkin-backend:$VERSION" \
    .

if [ $? -ne 0 ]; then
    echo -e "${RED}构建失败!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}构建成功!${NC}"
docker images | grep "checkin-backend"
echo ""

# 导出镜像
read -p "是否导出镜像为 .tar 文件? (y/N): " export_choice
if [[ "$export_choice" == "y" || "$export_choice" == "Y" ]]; then
    EXPORT_DIR="$PROJECT_ROOT/docker-images"
    EXPORT_PATH="$EXPORT_DIR/checkin-backend-$VERSION.tar"

    mkdir -p "$EXPORT_DIR"
    echo ""
    echo -e "${CYAN}正在导出镜像到: $EXPORT_PATH${NC}"
    echo -e "${YELLOW}（镜像较大，请耐心等待...）${NC}"

    if ! docker save -o "$EXPORT_PATH" "checkin-backend:$VERSION"; then
        echo -e "${RED}导出失败!${NC}"
        exit 1
    fi

    if [ ! -s "$EXPORT_PATH" ]; then
        echo -e "${RED}导出失败: 未生成镜像文件${NC}"
        exit 1
    fi

    echo ""
    echo -e "${GREEN}镜像已导出:${NC}"
    ls -lh "$EXPORT_PATH"
    echo ""
    echo -e "${CYAN}部署步骤:${NC}"
    echo "  1. 上传 checkin-backend-$VERSION.tar 到服务器"
    echo "  2. scp checkin-backend-$VERSION.tar root@服务器IP:/opt/promise-checkin/Docker/"
    echo "  3. 服务器上: docker load -i checkin-backend-$VERSION.tar"
    echo "  4. 服务器上: cd /opt/promise-checkin/Docker && docker compose up -d"
fi

echo ""
echo -e "${GREEN}完成!${NC}"
