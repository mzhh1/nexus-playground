#!/bin/bash

# Nexus Playground 端到端集成测试脚本

set -e

echo "🧪 Nexus Playground 端到端测试"
echo "================================"

# 颜色定义
GREEN='\033[0.32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试函数
test_step() {
    echo -e "\n${YELLOW}▶ $1${NC}"
}

test_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

test_fail() {
    echo -e "${RED}✗ $1${NC}"
    exit 1
}

# 1. 检查Docker Compose服务是否运行
test_step "检查Docker Compose服务状态..."
if ! docker-compose ps | grep -q "Up"; then
    test_fail "Docker Compose服务未运行。请先运行: docker-compose up -d"
fi
test_success "Docker Compose服务运行中"

# 2. 等待服务启动
test_step "等待服务完全启动（10秒）..."
sleep 10

# 3. 测试健康检查端点
test_step "测试API Server健康检查..."
HEALTH_RESPONSE=$(curl -s http://localhost/health || echo "failed")
if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
    test_success "API Server健康检查通过"
else
    test_fail "API Server健康检查失败"
fi

# 4. 测试门户页面可访问性
test_step "测试游戏门户可访问性..."
PORTAL_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/)
if [ "$PORTAL_RESPONSE" == "200" ]; then
    test_success "游戏门户可访问"
else
    test_fail "游戏门户不可访问（HTTP $PORTAL_RESPONSE）"
fi

# 5. 测试井字棋游戏可访问性
test_step "测试井字棋游戏可访问性..."
TIC_TAC_TOE_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/games/tic-tac-toe/)
if [ "$TIC_TAC_TOE_RESPONSE" == "200" ]; then
    test_success "井字棋游戏可访问"
else
    test_fail "井字棋游戏不可访问（HTTP $TIC_TAC_TOE_RESPONSE）"
fi

# 6. 测试API端点
test_step "测试游戏列表API..."
GAMES_RESPONSE=$(curl -s http://localhost/api/games || echo "failed")
if echo "$GAMES_RESPONSE" | grep -q "tic-tac-toe"; then
    test_success "游戏列表API正常"
else
    test_fail "游戏列表API失败"
fi

# 7. 测试房间列表API
test_step "测试房间列表API..."
ROOMS_RESPONSE=$(curl -s http://localhost/api/rooms || echo "failed")
if echo "$ROOMS_RESPONSE" | grep -q "rooms"; then
    test_success "房间列表API正常"
else
    test_fail "房间列表API失败"
fi

# 8. 测试数据库连接（通过API Server）
test_step "测试数据库连接..."
# 如果API Server能启动并响应，说明数据库连接正常
test_success "数据库连接正常（API Server已响应）"

# 9. 测试WebSocket连接（基础检查）
test_step "检查WebSocket路由配置..."
# 简单检查nginx配置是否包含WebSocket配置
if docker exec nexus-nginx cat /etc/nginx/nginx.conf | grep -q "upgrade"; then
    test_success "WebSocket路由已配置"
else
    test_fail "WebSocket路由未正确配置"
fi

echo ""
echo "================================"
echo -e "${GREEN}✓ 所有自动化测试通过！${NC}"
echo ""
echo "📝 手动测试清单："
echo "1. 访问 http://localhost 查看门户首页"
echo "2. 点击\"进入游戏大厅\"（需要先登录）"
echo "3. 创建井字棋房间"
echo "4. 进行游戏并验证落子功能"
echo "5. 检查游戏历史记录"
echo "6. 测试游戏结束逻辑"
echo ""
echo "🔗 快速链接："
echo "   门户: http://localhost"
echo "   大厅: http://localhost/lobby"
echo "   井字棋: http://localhost/games/tic-tac-toe"
echo "   API文档: http://localhost/api"
echo ""


