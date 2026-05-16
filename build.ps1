#Requires -Version 5.1
<#
.SYNOPSIS
    Nexus Playground 构建脚本 (Windows PowerShell 版)
.DESCRIPTION
    等同于 Makefile 的 PowerShell 脚本。用法:
        .\build.ps1 <target> [-G <game>] [-OTP <code>]
    不传 target 时默认显示帮助。
.EXAMPLE
    .\build.ps1 help
    .\build.ps1 build-game -G gomoku
    .\build.ps1 deploy-game -G gomoku
    .\build.ps1 publish-sdk -OTP 123456
.NOTES
    Makefile -> PowerShell 翻译版，目标名保持原样。
#>

param(
    [Parameter(Position = 0)]
    [string]$Target = "help",

    [Parameter()]
    [string]$G,

    [Parameter()]
    [string]$OTP
)

$ErrorActionPreference = "Stop"

# ============================================================
# 颜色辅助函数
# ============================================================
function Write-ColorLine {
    param([ConsoleColor]$Color, [string]$Message)
    Write-Host $Message -ForegroundColor $Color
}

$BLUE   = [ConsoleColor]::Blue
$GREEN  = [ConsoleColor]::Green
$YELLOW = [ConsoleColor]::Yellow
$WHITE  = [ConsoleColor]::White

# ============================================================
# 收集所有目标函数及其 SYNOPSIS 注释
# ============================================================
function Get-TargetHelp {
    $myScript = $MyInvocation.MyCommand.Path
    $content = Get-Content $myScript -Raw
    $lines = $content -split "`r?`n"
    $targets = [ordered]@{}
    $inSection = ""
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        # 检测 ##@ 区域标题
        if ($line -match '^function HelpSection_(\S+)') {
            # 不重要，用注释拾取区域名
            continue
        }
        # 匹配函数定义
        if ($line -match '^function\s+([a-zA-Z_-]+)\s*\{') {
            $fnName = $Matches[1]
            # 回溯找 ## 翻译注释（格式: ## 中文说明）
            for ($j = $i - 1; $j -ge 0; $j--) {
                if ($lines[$j] -match '^\s*##\s+(.+)') {
                    $targets[$fnName] = $Matches[1]
                    break
                }
                if ($lines[$j] -notmatch '^\s*(#|$)') { break }
            }
        }
    }
    return $targets
}

# ============================================================
# 帮助目标
# ============================================================
## 显示帮助信息
function help {
    Write-ColorLine $BLUE "Nexus Playground - 常用命令"
    Write-Host ""
    Write-ColorLine $WHITE "使用方法: .\build.ps1 <target> [-G <game>] [-OTP <code>]"
    Write-Host ""

    # 手动分组以匹配原 Makefile 布局
    $groups = [ordered]@{
        "构建与检查" = @(
            @{Name = "build-engine";      Desc = "构建 nexus-engine"}
            @{Name = "build-backend";     Desc = "构建 backend"}
            @{Name = "build-frontend";    Desc = "构建 frontend"}
            @{Name = "build-monitor";     Desc = "构建 monitor"}
            @{Name = "build-game";        Desc = "构建指定游戏 (用法: .\build.ps1 build-game -G <game_dir>)"}
            @{Name = "build-games";       Desc = "构建所有游戏"}
            @{Name = "build-cli-engine";  Desc = "编译 nexus-engine 为单文件并同步到 cli/dist"}
            @{Name = "typecheck";         Desc = "运行核心项目类型检查"}
        )
        "部署" = @(
            @{Name = "deploy-engine";     Desc = "部署 nexus-engine 到 Cloudflare"}
            @{Name = "deploy-backend";    Desc = "部署 backend 到 Cloudflare"}
            @{Name = "deploy-frontend";   Desc = "部署 frontend 到 Vercel"}
            @{Name = "deploy-monitor";    Desc = "部署 monitor 到 Vercel"}
            @{Name = "deploy-game";       Desc = "部署指定游戏 (用法: .\build.ps1 deploy-game -G <game_dir>)"}
            @{Name = "deploy-games";      Desc = "部署所有游戏"}
            @{Name = "set-engine-secret"; Desc = "手动设置 nexus-engine 的 CF Worker Secret"}
            @{Name = "set-backend-secret";Desc = "手动设置 backend 的 CF Worker Secret"}
        )
        "数据库" = @(
            @{Name = "d1-migrate";        Desc = "应用 backend 的 D1 迁移 (本地)"}
            @{Name = "d1-migrate-remote"; Desc = "应用 backend 的 D1 迁移 (线上)"}
        )
        "发布" = @(
            @{Name = "publish-sdk";       Desc = "构建并发布 @nexusgame/game-sdk (npm)"}
            @{Name = "publish-cli";       Desc = "构建并发布 @nexusgame/cli (npm)"}
        )
    }

    foreach ($section in $groups.Keys) {
        Write-ColorLine $BLUE $section
        foreach ($t in $groups[$section]) {
            $pad = "    " + $t.Name.PadRight(24)
            Write-ColorLine $WHITE "$pad  $($t.Desc)"
        }
        Write-Host ""
    }
}

# ============================================================
# 构建与检查
# ============================================================

## 构建 nexus-engine
function build-engine {
    Write-ColorLine $BLUE "🔨 构建 nexus-engine..."
    Push-Location nexus-engine
    try { pnpm run build } finally { Pop-Location }
}

## 构建 backend
function build-backend {
    Write-ColorLine $BLUE "🔨 构建 backend..."
    pnpm --filter ./backend run build
}

## 构建 frontend
function build-frontend {
    Write-ColorLine $BLUE "🔨 构建 frontend..."
    pnpm --filter ./frontend run build
}

## 构建 monitor
function build-monitor {
    Write-ColorLine $BLUE "🔨 构建 monitor..."
    pnpm --filter ./monitor run build
}

## 构建指定游戏
function build-game {
    if (-not $G) {
        Write-ColorLine $YELLOW "⚠️ 请指定游戏目录名，例如: .\build.ps1 build-game -G gomoku"
        exit 1
    }
    Write-ColorLine $BLUE "🔨 正在构建游戏: $G..."
    Push-Location "games\$G"
    try { pnpm run build } finally { Pop-Location }
}

## 构建所有游戏
function build-games {
    Write-ColorLine $BLUE "🔨 正在构建所有游戏..."
    Get-ChildItem -Directory "games" | ForEach-Object {
        $gameName = $_.Name
        Write-ColorLine $BLUE "  -> 构建 $gameName..."
        Push-Location "games\$gameName"
        try { pnpm run build } finally { Pop-Location }
    }
}

## 编译 nexus-engine 为单文件并同步到 cli/dist
function build-cli-engine {
    Write-ColorLine $BLUE "🔨 正在编译 nexus-engine 并同步到 cli..."
    Push-Location nexus-engine
    try { pnpm run build:bundle } finally { Pop-Location }
    New-Item -Force -ItemType Directory -Path "packages\cli\dist" | Out-Null
    Copy-Item -Force "nexus-engine\dist\engine-worker.js" "packages\cli\dist\engine-worker.js"
    Write-ColorLine $GREEN "✅ Engine 已成功同步到 packages\cli\dist\engine-worker.js"
}

## 运行核心项目类型检查
function typecheck {
    Write-ColorLine $BLUE "🧪 Typecheck frontend..."
    Push-Location frontend
    try { pnpm run typecheck } finally { Pop-Location }

    Write-ColorLine $BLUE "🧪 Typecheck backend..."
    Push-Location backend
    try { pnpm run typecheck } finally { Pop-Location }

    Write-ColorLine $BLUE "🧪 Typecheck nexus-engine..."
    Push-Location nexus-engine
    try { pnpm run build } finally { Pop-Location }

    Write-ColorLine $BLUE "🧪 Typecheck monitor..."
    Push-Location monitor
    try { pnpm run typecheck } finally { Pop-Location }
}

# ============================================================
# 部署
# ============================================================

## 部署 nexus-engine 到 Cloudflare
function deploy-engine {
    Write-ColorLine $BLUE "🚀 部署 nexus-engine 到 Cloudflare..."
    Push-Location nexus-engine
    try { pnpm run deploy } finally { Pop-Location }
}

## 部署 backend 到 Cloudflare
function deploy-backend {
    Write-ColorLine $BLUE "🚀 部署 backend 到 Cloudflare..."
    pnpm --filter ./backend run deploy
}

## 部署 frontend 到 Vercel
function deploy-frontend {
    Write-ColorLine $BLUE "🚀 部署 frontend 到 Vercel..."
    Push-Location frontend
    try { vercel --prod --yes --token $env:VERCEL_TOKEN } finally { Pop-Location }
}

## 部署 monitor 到 Vercel
function deploy-monitor {
    Write-ColorLine $BLUE "🚀 部署 monitor 到 Vercel..."
    Push-Location monitor
    try { vercel --prod --yes --token $env:VERCEL_TOKEN } finally { Pop-Location }
}

## 部署指定游戏
function deploy-game {
    if (-not $G) {
        Write-ColorLine $YELLOW "⚠️ 请指定游戏目录名，例如: .\build.ps1 deploy-game -G gomoku"
        exit 1
    }
    Write-ColorLine $BLUE "🚀 正在构建并部署游戏: $G..."
    Push-Location "games\$G"
    try {
        pnpm run build
        pnpm run deploy
    } finally { Pop-Location }
}

## 部署所有游戏
function deploy-games {
    Write-ColorLine $BLUE "🚀 正在部署所有游戏..."
    Get-ChildItem -Directory "games" | ForEach-Object {
        $gameName = $_.Name
        Write-ColorLine $BLUE "  -> 部署 $gameName..."
        Push-Location "games\$gameName"
        try {
            pnpm run build
            pnpm run deploy
        } finally { Pop-Location }
    }
}

## 手动设置 nexus-engine 的 CF Worker Secret
function set-engine-secret {
    Write-ColorLine $BLUE "🔐 设置 nexus-engine Secret"
    $VAR_NAME = Read-Host "变量名 (例如 LLM_WEBHOOK_SECRET)"
    Push-Location nexus-engine
    try { pnpm exec wrangler secret put $VAR_NAME } finally { Pop-Location }
}

## 手动设置 backend 的 CF Worker Secret
function set-backend-secret {
    Write-ColorLine $BLUE "🔐 设置 backend Secret"
    $VAR_NAME = Read-Host "变量名 (例如 OPENAI_API_KEY)"
    Push-Location backend
    try { pnpm exec wrangler secret put $VAR_NAME } finally { Pop-Location }
}

# ============================================================
# 数据库
# ============================================================

## 应用 backend 的 D1 迁移 (本地)
function d1-migrate {
    Write-ColorLine $BLUE "🗄️ 应用 D1 迁移..."
    Push-Location backend
    try { pnpm exec wrangler d1 migrations apply np-backend-db --local } finally { Pop-Location }
}

## 应用 backend 的 D1 迁移 (线上)
function d1-migrate-remote {
    Write-ColorLine $BLUE "🗄️ 应用 D1 线上迁移..."
    Push-Location backend
    try { pnpm exec wrangler d1 execute np-backend-db --remote --file=./migrations/0001_rooms.sql } finally { Pop-Location }
}

# ============================================================
# 发布
# ============================================================

## 构建并发布 @nexusgame/game-sdk (npm)
function publish-sdk {
    Write-ColorLine $BLUE "📦 正在发布 @nexusgame/game-sdk..."
    Push-Location packages\game-sdk
    try {
        pnpm run build
        if ($OTP) {
            pnpm publish --no-git-checks --access public --otp=$OTP
        } else {
            pnpm publish --no-git-checks --access public
        }
    } finally { Pop-Location }
}

## 构建并发布 @nexusgame/cli (npm)
function publish-cli {
    build-cli-engine
    Write-ColorLine $BLUE "📦 正在发布 @nexusgame/cli..."
    Push-Location packages\cli
    try {
        pnpm run build
        if ($OTP) {
            pnpm publish --no-git-checks --access public --otp=$OTP
        } else {
            pnpm publish --no-git-checks --access public
        }
    } finally { Pop-Location }
}

# ============================================================
# 入口调度
# ============================================================

# 目标列表 (与 Makefile 保持一致)
$validTargets = @(
    "help", "build-engine", "build-backend", "build-frontend", "build-monitor",
    "build-game", "build-games", "build-cli-engine", "typecheck",
    "deploy-engine", "deploy-backend", "deploy-frontend", "deploy-monitor",
    "deploy-game", "deploy-games", "set-engine-secret", "set-backend-secret",
    "d1-migrate", "d1-migrate-remote", "publish-sdk", "publish-cli"
)

if ($Target -notin $validTargets) {
    Write-ColorLine $YELLOW "⚠️ 未知目标: $Target"
    Write-Host ""
}

# 通过 Get-Command -CommandType Function 精准获取函数 (避免 'help' 和内置 alias 冲突)
$func = Get-Command -Name $Target -CommandType Function -ErrorAction SilentlyContinue
if ($func) {
    & $func
} else {
    if ($Target -in $validTargets) {
        Write-ColorLine $YELLOW "内部错误: 函数 '$Target' 未定义"
    }
    help
    exit 1
}

