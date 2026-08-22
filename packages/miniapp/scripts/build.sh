#!/bin/bash
# 如约打卡小程序前端打包脚本
# 用法: ./build.sh [--local | --api <url>] [--zip]
#   无参数      生产环境包（env/.env.production → checkin.itwxg.com）
#   --local     连本地后端（http://localhost:3000/api/v1），配合本地起 server 测全流程
#   --api <url> 自定义后端地址（完整到 /api/v1）
#   --zip       额外压缩一份 zip（发给别人 / 存档体验版用；默认只出目录）
#
# 产物目录: packages/miniapp/dist/build/mp-weixin/
# 测试方式: 微信开发者工具导入该目录 → AppID 填真实 AppID →
#           详情 → 本地设置 → 取消勾选「不校验合法域名」→ 预览/上传体验版
#
# 原理: Vite 中 shell 环境变量优先级高于 env/ 目录下的 .env 文件，
#       所以 VITE_SERVER_BASEURL=xxx 前缀可以在不改配置文件的情况下切换后端。

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ---------- 参数解析 ----------
API_OVERRIDE=""
ZIP=0
while [[ $# -gt 0 ]]; do
    case "$1" in
        --local)
            API_OVERRIDE="http://localhost:3000/api/v1"
            shift
            ;;
        --api)
            if [[ -z "$2" ]]; then
                echo -e "${RED}错误: --api 需要跟一个 URL 参数${NC}"
                exit 1
            fi
            API_OVERRIDE="$2"
            shift 2
            ;;
        --zip)
            ZIP=1
            shift
            ;;
        *)
            echo -e "${RED}未知参数: $1${NC}"
            echo "用法: ./build.sh [--local | --api <url>] [--zip]"
            exit 1
            ;;
    esac
done

# ---------- 目录定位（scripts/ → miniapp/ 是 1 层；miniapp/ → packages/ → 项目根 是 2 层）----------
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
MINIAPP_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$(dirname "$MINIAPP_DIR")")"
cd "$PROJECT_ROOT"

OUTPUT_DIR="$MINIAPP_DIR/dist/build/mp-weixin"

echo -e "${GREEN}======================================"
echo "如约打卡小程序前端打包"
echo -e "======================================${NC}"

# ---------- 目标后端 ----------
if [[ -n "$API_OVERRIDE" ]]; then
    echo -e "${YELLOW}后端地址（覆盖）: $API_OVERRIDE${NC}"
else
    # 从 env/.env.production 读取实际生效的地址，展示出来防止打错包
    PROD_API="$(grep '^VITE_SERVER_BASEURL=' "$MINIAPP_DIR/env/.env.production" 2>/dev/null | cut -d= -f2)"
    if [[ -z "$PROD_API" ]]; then
        echo -e "${RED}错误: 未找到 env/.env.production 或其中没有 VITE_SERVER_BASEURL${NC}"
        exit 1
    fi
    echo -e "${CYAN}后端地址（生产）: $PROD_API${NC}"
fi

# ---------- 依赖检查 ----------
if [[ ! -d "$MINIAPP_DIR/node_modules" || ! -d node_modules ]]; then
    echo -e "${CYAN}依赖未安装，先执行 pnpm install ...${NC}"
    pnpm install || { echo -e "${RED}依赖安装失败${NC}"; exit 1; }
fi

# ---------- 构建 ----------
echo ""
echo -e "${CYAN}正在编译（uni build -p mp-weixin）...${NC}"
echo ""

if [[ -n "$API_OVERRIDE" ]]; then
    VITE_SERVER_BASEURL="$API_OVERRIDE" pnpm --filter @promise-checkin/miniapp build:mp-weixin
else
    pnpm --filter @promise-checkin/miniapp build:mp-weixin
fi

if [[ $? -ne 0 ]]; then
    echo -e "${RED}构建失败!${NC}"
    exit 1
fi

# ---------- 产物检查 ----------
if [[ ! -f "$OUTPUT_DIR/app.json" ]]; then
    echo -e "${RED}构建异常: $OUTPUT_DIR 下没有 app.json${NC}"
    exit 1
fi

FILE_COUNT="$(find "$OUTPUT_DIR" -type f | wc -l | tr -d ' ')"
SIZE="$(du -sh "$OUTPUT_DIR" | cut -f1)"

echo ""
echo -e "${GREEN}构建成功!${NC}"
echo -e "  产物目录: ${CYAN}$OUTPUT_DIR${NC}"
echo -e "  文件数: $FILE_COUNT，大小: $SIZE"
echo ""

# ---------- 可选压缩 ----------
if [[ $ZIP -eq 1 ]]; then
    TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
    ZIP_PATH="$MINIAPP_DIR/dist/checkin-miniapp-$TIMESTAMP.zip"
    mkdir -p "$MINIAPP_DIR/dist"
    # -x 排除 macOS 垃圾文件
    (cd "$OUTPUT_DIR" && zip -rq "$ZIP_PATH" . -x "*.DS_Store")
    if [[ $? -ne 0 || ! -s "$ZIP_PATH" ]]; then
        echo -e "${RED}压缩失败!${NC}"
        exit 1
    fi
    echo -e "${GREEN}已压缩:${NC}"
    ls -lh "$ZIP_PATH" | awk '{print "  " $9 " (" $5 ")"}'
    echo ""
fi

echo -e "${CYAN}下一步（微信开发者工具）:${NC}"
echo "  1. 导入项目，目录选: $OUTPUT_DIR"
echo "  2. AppID 填真实 AppID"
echo "  3. 详情 → 本地设置 → 取消勾选「不校验合法域名」"
echo "  4. 预览（真机扫码）或上传体验版"
echo ""
echo -e "${GREEN}完成!${NC}"
