# 如约打卡后端镜像构建脚本（Windows PowerShell 版）
# 用法: .\build.ps1 [版本号]
#   版本号默认: v1.0

param(
    [string]$Version = "v1.0"
)

$ErrorActionPreference = "Stop"

Write-Host "======================================" -ForegroundColor Green
Write-Host "  如约打卡后端镜像构建"
Write-Host "======================================" -ForegroundColor Green
Write-Host "版本: $Version" -ForegroundColor Yellow
Write-Host ""

# 检查 Docker
if (-not (docker version 2>$null)) {
    Write-Host "错误: Docker 未运行!" -ForegroundColor Red
    exit 1
}

# 获取项目根目录（scripts/ → docker/ → packages/ → 项目根，上 3 层）
$ProjectRoot = Resolve-Path "$PSScriptRoot\..\..\.."
Set-Location $ProjectRoot

Write-Host "项目根目录: $ProjectRoot" -ForegroundColor Cyan
Write-Host ""

# 构建
Write-Host "正在构建后端镜像（linux/amd64）..." -ForegroundColor Cyan
Write-Host "⚠️  --no-cache 强制重新构建" -ForegroundColor Yellow
Write-Host ""

docker build --platform linux/amd64 --no-cache `
    -f packages/docker/backend/Dockerfile `
    -t "checkin-backend:$Version" `
    .

if ($LASTEXITCODE -ne 0) {
    Write-Host "构建失败!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "构建成功!" -ForegroundColor Green
docker images | Select-String "checkin-backend"
Write-Host ""

# 导出镜像
$exportChoice = Read-Host "是否导出镜像为 .tar 文件? (y/N)"
if ($exportChoice -eq "y" -or $exportChoice -eq "Y") {
    $ExportDir = "$ProjectRoot\docker-images"
    $ExportPath = "$ExportDir\checkin-backend-$Version.tar"

    New-Item -ItemType Directory -Force -Path $ExportDir | Out-Null
    Write-Host ""
    Write-Host "正在导出镜像到: $ExportPath" -ForegroundColor Cyan
    Write-Host "（镜像较大，请耐心等待...）" -ForegroundColor Yellow

    docker save -o $ExportPath "checkin-backend:$Version"

    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $ExportPath)) {
        Write-Host "导出失败!" -ForegroundColor Red
        exit 1
    }

    Write-Host ""
    Write-Host "镜像已导出:" -ForegroundColor Green
    Get-Item $ExportPath | Format-List Name, Length, FullName
    Write-Host ""
    Write-Host "部署步骤:" -ForegroundColor Cyan
    Write-Host "  1. 上传 checkin-backend-$Version.tar 到服务器"
    Write-Host "  2. scp checkin-backend-$Version.tar root@服务器IP:/opt/promise-checkin/Docker/"
    Write-Host "  3. 服务器上: docker load -i checkin-backend-$Version.tar"
    Write-Host "  4. 服务器上: cd /opt/promise-checkin/Docker && docker compose up -d"
}

Write-Host ""
Write-Host "完成!" -ForegroundColor Green
