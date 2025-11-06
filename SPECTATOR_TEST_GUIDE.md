# 观战者功能测试指南

## 🧪 快速测试步骤

### 方式 1：使用浏览器测试（推荐）

#### 1. 准备测试账号
- 账号 1: 玩家 A（例如 Alice）
- 账号 2: 玩家 B（例如 Bob）  
- 账号 3: 观战者（例如 Carol）

#### 2. 创建并开始游戏
1. 用账号 1 登录，创建房间
2. 选择游戏（推荐 Gomoku 或 Tic-Tac-Toe）
3. 添加两个玩家（可以是 Human 或 LLM）
4. 分配角色（Assign Roles）
5. 开始游戏（Start Game）

#### 3. 观战者加入
1. 用账号 3（观战者）在另一个浏览器/窗口登录
2. 在首页找到刚创建的房间（如果是 public）
3. 点击进入房间
4. **不要分配角色**，直接点击 "View Game"

#### 4. 验证实时更新
1. 在玩家的窗口执行一个操作（如下一步棋）
2. **立即检查**观战者窗口是否同步更新
3. 重复多次操作，确认每次都能实时更新

#### 5. 验证观战者视角
观战者应该看到：
- ✅ "👀 观战模式" 的消息提示
- ✅ 完整的游戏棋盘状态
- ✅ 当前轮到哪个玩家
- ✅ 没有操作按钮（因为不能下棋）
- ✅ 实时更新（每次玩家行动后立即更新）

---

### 方式 2：使用 SSE 端点直接测试

#### 1. 创建房间并开始游戏
```bash
# 假设房间 ID 是 test123
ROOM_ID="test123"
```

#### 2. 使用 curl 监听 SSE 流（作为观战者）
```bash
# 连接到 spectator 角色的 SSE 端点
curl -N -H "Accept: text/event-stream" \
  "http://localhost:3000/api/v1/perspectives/${ROOM_ID}/spectator/stream"
```

#### 3. 在另一个终端执行游戏操作
```bash
# 执行一个游戏操作（需要有效的 player_id 和 action）
curl -X POST http://localhost:3000/api/v1/actions \
  -H "Content-Type: application/json" \
  -d '{
    "room_id": "test123",
    "player_id": "test123_player001",
    "action": {
      "role_id": "player_X",
      "action_id": "place_0_0"
    }
  }'
```

#### 4. 观察 SSE 流
你应该在第一个终端看到：
```
event: perspective
data: {"current_state": {...}, "message": "👀 观战模式 - ...", ...}
```

---

## 🔍 验证清单

### 基本功能
- [ ] 观战者能连接到房间
- [ ] 观战者能看到游戏初始状态
- [ ] 观战者能实时收到游戏更新
- [ ] 观战者看到的状态与玩家一致（除了视角提示）

### 消息显示
- [ ] 观战者看到 "👀 观战模式" 前缀
- [ ] Tic-Tac-Toe: "👀 观战模式 - 轮到玩家 X"
- [ ] Gomoku: "👀 观战模式 - 轮到黑棋"
- [ ] Xiangqi: "👀 观战模式 - 轮到红方"

### 边缘情况
- [ ] 多个观战者同时观看
- [ ] 观战者中途加入（应该看到当前状态）
- [ ] 观战者中途离开（不影响游戏）
- [ ] 游戏结束时观战者看到正确的结束消息

### 性能测试
- [ ] 10 个观战者同时观看，游戏仍流畅
- [ ] SSE 连接稳定，不会频繁断开
- [ ] 服务器资源占用正常

---

## 🐛 常见问题排查

### 问题 1：观战者连接但不更新
**症状**：SSE 连接成功，但玩家行动后观战者不更新

**排查步骤**：
1. 检查后端日志：`npm run dev:backend`
   - 查找 "Perspective broadcasted to role clients"
   - 确认 `roleId: 'spectator'` 出现在日志中

2. 检查 Redis：
   ```bash
   redis-cli
   > KEYS room:*:state
   > GET room:<room_id>:state
   ```
   - 确认 `player_list` 包含观战者

3. 检查浏览器 Network 面板：
   - SSE 连接状态是 "pending"（正常）
   - 能收到 "connected" 事件

### 问题 2：观战者看到错误的视角
**症状**：观战者看到玩家视角（没有 👀 图标）

**排查步骤**：
1. 检查前端是否正确使用 `roleId: 'spectator'`
2. 检查游戏逻辑的 `toRolePerspective` 方法
3. 确认 `isSpectator` 判断逻辑正确

### 问题 3：多个观战者只有第一个更新
**症状**：多个观战者连接，只有第一个收到更新

**排查步骤**：
1. 检查 EventBus 的 `generateClientId` 方法
2. 确认每个观战者有唯一的 `clientId`
3. 检查 `broadcastPerspective` 是否正确遍历所有 clients

---

## 📊 日志示例

### 正常的日志输出

#### 1. 观战者连接
```json
{
  "level": "info",
  "msg": "SSE client registered",
  "clientId": "room123:spectator:player003",
  "roomId": "room123",
  "roleId": "spectator",
  "playerId": "room123_player003"
}
```

#### 2. 玩家行动后广播
```json
{
  "level": "debug",
  "msg": "Perspective broadcasted to role clients",
  "roomId": "room123",
  "roleId": "player_X",
  "sentCount": 1
}
{
  "level": "debug",
  "msg": "Perspective broadcasted to role clients",
  "roomId": "room123",
  "roleId": "player_O",
  "sentCount": 1
}
{
  "level": "debug",
  "msg": "Perspective broadcasted to role clients",
  "roomId": "room123",
  "roleId": "spectator",
  "sentCount": 1  // ✅ 观战者收到更新
}
```

---

## 🎯 自动化测试（TODO）

未来可以添加的自动化测试：

```typescript
describe('Spectator Broadcasting', () => {
  it('should broadcast to spectator when player makes a move', async () => {
    // 1. Create room with 2 players
    // 2. Add a spectator to player_list
    // 3. Start game
    // 4. Execute action
    // 5. Verify spectator receives perspective update
  });
  
  it('should support multiple spectators', async () => {
    // Test with 3+ spectators
  });
  
  it('should show correct spectator messages', async () => {
    // Verify message contains "👀 观战模式"
  });
});
```

---

## ✅ 测试完成标准

全部验证通过后，观战者功能即为正常工作：

- [x] 后端代码修改完成
- [x] 所有游戏逻辑支持观战者
- [x] 服务器成功重启
- [ ] 浏览器手动测试通过
- [ ] SSE 端点测试通过
- [ ] 多观战者测试通过
- [ ] 所有游戏类型测试通过

**测试负责人**: _________  
**测试日期**: _________  
**测试结果**: _________





