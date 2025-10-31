#!/bin/bash

echo "===== 验证角色ID动态化实现 ====="
echo ""

echo "1. 检查后端 GameMetadata 是否包含 roleIds 字段..."
if grep -q "roleIds: string\[\]" backend/src/games/types.ts; then
  echo "   ✓ 后端类型定义已更新"
else
  echo "   ✗ 后端类型定义未找到 roleIds"
  exit 1
fi

echo ""
echo "2. 检查 TicTacToeLogic 是否定义了 roleIds..."
if grep -q "roleIds: \['player_X', 'player_O'\]" games/tic-tac-toe/logic/index.ts; then
  echo "   ✓ TicTacToe 逻辑已添加 roleIds"
else
  echo "   ✗ TicTacToe 逻辑未找到 roleIds"
  exit 1
fi

echo ""
echo "3. 检查前端 GameMetadata 是否包含 roleIds 字段..."
if grep -q "roleIds: string\[\]" frontend/src/lib/types.ts; then
  echo "   ✓ 前端类型定义已更新"
else
  echo "   ✗ 前端类型定义未找到 roleIds"
  exit 1
fi

echo ""
echo "4. 检查 Room.tsx 是否移除了硬编码..."
if grep -q "gameMetadata?.roleIds" frontend/src/pages/room/Room.tsx; then
  echo "   ✓ Room.tsx 已实现动态获取"
else
  echo "   ✗ Room.tsx 未找到动态获取逻辑"
  exit 1
fi

if grep -q "hardcoded for tic-tac-toe" frontend/src/pages/room/Room.tsx; then
  echo "   ✗ Room.tsx 仍包含硬编码注释"
  exit 1
else
  echo "   ✓ 硬编码注释已移除"
fi

echo ""
echo "5. 检查设计文档是否已更新..."
if grep -q "roleIds: string\[\]" game_integration_guide.md; then
  echo "   ✓ 设计文档已更新"
else
  echo "   ✗ 设计文档未更新"
  exit 1
fi

echo ""
echo "===== 所有验证通过！ ====="
echo ""
echo "下一步："
echo "1. 启动后端: cd backend && npm run dev"
echo "2. 启动前端: cd frontend && npm run dev"
echo "3. 访问 http://localhost:5173/my-nexus"
echo "4. 选择井字棋游戏，验证角色映射界面正确显示 player_X 和 player_O"
