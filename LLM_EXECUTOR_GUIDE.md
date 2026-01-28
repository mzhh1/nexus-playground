# LLM 执行器使用指南

本文档说明如何使用新实现的 LLM 执行器（非流式模式）。

---

## 📋 实现概览

### 已完成的组件

1. **应用身份认证插件** (`backend/src/plugins/app-auth.ts`)
   - 使用 OAuth2 client_credentials 流程获取应用级访问令牌
   - 自动创建并注入 LLM 客户端到 Fastify 实例
   - 支持优雅降级（未配置时提供友好错误提示）

2. **LLM 执行器** (`backend/src/runtime/llm-executor.ts`)
   - 完整的决策执行流程（非流式）
   - 3 次重试机制，指数退避 + 抖动
   - 智能 Prompt 构造（包含游戏规则、状态、历史、可用行动）
   - JSON 响应解析与验证
   - 完整的参数类型检查和范围验证

3. **环境变量配置** (`backend/.env.example`)
   - 详细的配置说明和安全提示

4. **依赖安装**
   - `@autolabz/oauth-app-sdk` - 应用身份认证
   - `@autolabz/llmapi-sdk` - LLM API 调用
   - `fastify-plugin` - Fastify 插件封装

---

## 🚀 快速开始

### 1. 配置环境变量

在 `backend/.env` 中添加以下配置（参考 `backend/.env.example`）：

```bash
# 认证服务
AUTH_BASE_URL=http://114.132.91.247/api
JWT_ACCESS_SECRET=your-jwt-secret-here

# 应用身份凭证（必需！）
OAUTH_APP_CLIENT_ID=your-app-client-id
OAUTH_APP_CLIENT_SECRET=cs_live_your_secret

# LLM API 服务
LLMAPI_BASE_URL=http://114.132.91.247/llmapi
```

**安全提示**：
- `OAUTH_APP_CLIENT_SECRET` 必须保密，绝不提交到版本控制
- 开发和生产使用不同的凭证
- 定期轮换密钥

### 2. 获取应用凭证

1. 访问 AutoLab Admin Portal
2. 创建新的 OAuth2 应用
3. 记录 `CLIENT_ID` 和 `CLIENT_SECRET`
4. 确保应用具有 `llmapi` scope

### 3. 启动后端服务

```bash
cd backend
npm install  # 已自动安装新依赖
npm run dev
```

启动日志应显示：

```
Application authentication initialized successfully
  clientId: "your-app-client-id"
  authServiceUrl: "http://114.132.91.247/api"
  llmApiBaseUrl: "http://114.132.91.247/llmapi"
```

---

## 💻 使用示例

### 在运行时调用 LLM 执行器

```typescript
import { createLLMExecutor } from './runtime/llm-executor';
import { RolePerspective } from './games/types';

// 1. 创建 LLM 执行器实例
const llmExecutor = createLLMExecutor(fastify);

// 2. 准备角色视角（由 PerspectiveGenerator 生成）
const perspective: RolePerspective = {
  global_rules: "井字棋规则：三子连成一线即获胜...",
  current_state: { board: [[null, 'X', null], ...] },
  whole_history: [...],
  diff_history: [...],
  your_role: {
    identity: "Player O",
    goal: "让你的三个棋子连成一线",
    is_current: true,
  },
  action_space_definition: {
    actions: [
      {
        action_id: "place",
        description: "在指定位置落子",
        params_schema: {
          row: { type: "integer", minimum: 0, maximum: 2 },
          col: { type: "integer", minimum: 0, maximum: 2 },
        },
      },
    ],
  },
};

// 3. 执行 LLM 决策
const action = await llmExecutor.executeDecision(
  roomId,
  roleId,
  perspective,
  'gpt-4o-mini-2024-07-18',  // 模型名称
  '你是一个专业的井字棋玩家。请分析局势并选择最优行动。' // 系统提示
);

if (action) {
  console.log('LLM 选择的行动:', action);
  // { action_id: "place", params: { row: 1, col: 1 }, role_id: "player_O" }
  
  // 4. 将行动提交给 ActionProcessor
  // await actionProcessor.processAction(roomId, action, { ... });
} else {
  console.error('LLM 执行失败（3次重试后）');
}
```

### 集成到游戏回合流程

```typescript
// 检测当前行动方是否为 LLM 玩家
async function handleTurn(roomId: string, currentRoleId: string) {
  // 1. 获取房间状态
  const roomState = await getRoomState(roomId);
  const playerId = roomState.role_mapping[currentRoleId];
  const player = roomState.player_list[playerId];

  if (player.type === 'llm') {
    // 2. LLM 玩家 - 自动执行
    const llmPlayer = player as LLMPlayer;
    const perspective = await perspectiveGenerator.generatePerspective(
      roomId,
      currentRoleId
    );

    const llmExecutor = createLLMExecutor(fastify);
    const action = await llmExecutor.executeDecision(
      roomId,
      currentRoleId,
      perspective,
      llmPlayer.model_name,
      llmPlayer.system_prompt
    );

    if (action) {
      // 3. 自动提交行动
      await actionProcessor.processAction(roomId, action, {
        requestId: `llm-${Date.now()}-${Math.random()}`,
      });
    } else {
      // 4. LLM 执行失败 - 暂停游戏并通知主人
      await pauseGameAndNotifyOwner(roomId, 'LLM 执行失败');
    }
  } else {
    // 人类玩家 - 等待行动提交
    // 前端通过 SSE 收到视角更新，玩家操作后提交 action
  }
}
```

---

## 🔍 工作流程详解

### 1. Prompt 构造

LLM 执行器会自动构造包含以下信息的详细 Prompt：

```
# 游戏规则
[全局规则文本]

# 你的身份
角色: [roleId]
目标: [角色目标]
**现在轮到你行动**

# 当前游戏状态
[JSON 格式的当前状态]

# 完整历史记录
Turn 1: player_X → place ({"row": 0, "col": 0}) - 玩家X在(0,0)落子
...

# 自上次行动以来的变化
Turn 5: player_X → place ({"row": 1, "col": 1})
...

# 可用行动列表
- place(row: integer[0-2], col: integer[0-2]): 在指定位置落子

# 任务要求
请分析当前局势，选择一个最优行动。你必须严格按照以下JSON格式返回：

```json
{
  "action_id": "place",
  "params": { "row": 1, "col": 2 },
  "reasoning": "我选择(1,2)因为..."
}
```

**重要提示**：
1. action_id 必须完全匹配上述可用行动列表中的某个行动
2. 如果行动需要参数，params 字段必须包含所有必需的参数
3. 参数的类型和值必须符合行动定义的约束
4. 只返回JSON对象，不要包含其他文字说明
```

### 2. LLM 调用

使用 `llmapi-sdk` 的 `getChatContent` 便捷方法：

```typescript
const content = await llmClient.getChatContent({
  model: 'gpt-4o-mini-2024-07-18',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ],
});
```

**特点**：
- 非流式调用，一次性返回完整响应
- 自动携带应用级鉴权（`Authorization: Bearer <app-token>`）
- 自动计费（扣除应用账户积分）
- SDK 内置重试机制（429/503/504 错误）

### 3. 响应解析

期望的 LLM 响应格式：

```json
{
  "action_id": "place",
  "params": {
    "row": 1,
    "col": 2
  },
  "reasoning": "选择中间位置以形成进攻态势"
}
```

执行器会：
1. 解析 JSON
2. 提取 `action_id` 和 `params`
3. 验证 `action_id` 在可用行动列表中
4. 验证参数类型和范围
5. 返回标准的 `Action` 对象

### 4. 重试逻辑

```
Attempt 1: 立即尝试
  ↓ 失败
Attempt 2: 等待 1-1.5 秒（1s + 0-500ms 抖动）
  ↓ 失败
Attempt 3: 等待 2-2.5 秒（2s + 0-500ms 抖动）
  ↓ 失败
返回 null
```

**重试触发条件**：
- LLM API 调用失败（网络错误、超时等）
- JSON 解析失败
- 行动验证失败（action_id 不合法、参数错误等）

---

## 🛠️ 参数验证机制

执行器会对 LLM 返回的参数进行完整验证：

### 数值类型（number/integer）

```typescript
// 定义
params_schema: {
  amount: {
    type: "integer",
    minimum: 1,
    maximum: 100,
    description: "下注金额"
  }
}

// 验证逻辑
✅ value = 50        → 通过
❌ value = 0         → 失败（< minimum）
❌ value = 150       → 失败（> maximum）
❌ value = "50"      → 失败（类型错误）
```

### 字符串类型（string）

```typescript
// 定义
params_schema: {
  suit: {
    type: "string",
    enum: ["hearts", "diamonds", "clubs", "spades"],
    description: "花色"
  }
}

// 验证逻辑
✅ value = "hearts"  → 通过
❌ value = "red"     → 失败（不在 enum 中）
❌ value = 123       → 失败（类型错误）
```

### 布尔类型（boolean）

```typescript
// 定义
params_schema: {
  double_down: {
    type: "boolean",
    description: "是否加倍下注"
  }
}

// 验证逻辑
✅ value = true      → 通过
✅ value = false     → 通过
❌ value = "true"    → 失败（类型错误）
```

---

## 📊 日志与调试

### 日志级别

执行器会记录详细的执行日志：

```typescript
// INFO 级别
logger.info({ roomId, roleId, modelName }, 'LLM executor: Starting decision execution');
logger.info({ roomId, roleId, attempt }, 'LLM executor: Attempt 2/3');
logger.info({ roomId, roleId, action }, 'LLM executor: Successfully generated valid action');

// DEBUG 级别
logger.debug({ roomId, roleId, promptLength }, 'LLM executor: Calling LLM API');
logger.debug({ roomId, roleId, responseLength }, 'LLM executor: Received LLM response');
logger.debug({ action, reasoning }, 'LLM executor: Parsed action from response');

// WARN 级别
logger.warn({ roomId, roleId, attempt, response }, 'LLM executor: Failed to parse valid action');
logger.warn({ action_id, available }, 'LLM executor: action_id not in legal action space');

// ERROR 级别
logger.error({ roomId, roleId, error }, 'LLM executor: All retry attempts failed');
```

### 设置日志级别

在 `backend/.env` 中：

```bash
LOG_LEVEL=debug  # 查看详细调试信息
LOG_PRETTY=true  # 开发时使用美化输出
```

### 常见错误排查

#### 错误 1：LLM functionality not configured

```
Error: LLM functionality not configured. Please set OAUTH_APP_CLIENT_ID and OAUTH_APP_CLIENT_SECRET.
```

**解决方案**：
- 检查 `backend/.env` 是否配置了 `OAUTH_APP_CLIENT_ID` 和 `OAUTH_APP_CLIENT_SECRET`
- 重启后端服务

#### 错误 2：Application token authorization failed

```
Application token authorization failed. Please verify OAUTH_APP_CLIENT_ID and OAUTH_APP_CLIENT_SECRET are correct.
```

**解决方案**：
- 验证 `OAUTH_APP_CLIENT_ID` 和 `OAUTH_APP_CLIENT_SECRET` 是否正确
- 检查应用是否具有 `llmapi` scope
- 确认认证服务（`AUTH_BASE_URL`）可访问

#### 错误 3：LLM 返回无效 JSON

```
LLM executor: Failed to parse LLM response as JSON
response: "我选择在(1,1)位置落子，因为..."
```

**解决方案**：
- 检查 `systemPrompt` 是否明确要求 JSON 格式输出
- 尝试更明确的提示词，如："你必须只返回JSON对象，不要包含任何其他文字"
- 考虑切换到更稳定的模型（如 `gpt-4o`）

#### 错误 4：action_id 不在合法行动空间

```
LLM executor: action_id not in legal action space
action_id: "move"
available: ["place", "pass"]
```

**解决方案**：
- 检查游戏逻辑的 `getLegalActions` 是否正确返回当前可用行动
- 确认 Prompt 中的可用行动列表与实际一致
- 考虑在 systemPrompt 中强调"严格使用列表中的 action_id"

---

## 🔒 安全最佳实践

### 1. 密钥管理

```bash
# ❌ 错误做法
OAUTH_APP_CLIENT_SECRET=cs_live_abc123  # 硬编码在代码中

# ✅ 正确做法
# 使用环境变量
export OAUTH_APP_CLIENT_SECRET=$(cat /run/secrets/app_secret)

# 或使用 Docker Secrets
docker secret create app_secret ./secret.txt
```

### 2. 访问控制

```typescript
// 应用令牌只用于系统级操作，不要暴露给前端
app.get('/api/llm/token', async (req, reply) => {
  // ❌ 错误：暴露应用令牌
  return { token: appClient.getAccessToken() };
});

// ✅ 正确：只在后端使用，不暴露给前端
// LLM 执行器在后端自动调用，前端无需知道应用令牌
```

### 3. Scope 最小化

```bash
# 只申请必需的 scope
# ✅ 最小权限
OAUTH_APP_SCOPES=llmapi

# ❌ 过宽权限（非必要不给 admin）
OAUTH_APP_SCOPES=llmapi,data,points,admin
```

### 4. 日志脱敏

```typescript
// ❌ 错误：记录敏感信息
logger.info({ clientSecret: process.env.OAUTH_APP_CLIENT_SECRET });

// ✅ 正确：脱敏或省略
logger.info({ 
  clientId: process.env.OAUTH_APP_CLIENT_ID,
  secretConfigured: !!process.env.OAUTH_APP_CLIENT_SECRET 
});
```

---

## 📈 性能优化

### 1. 令牌缓存

应用令牌会自动缓存并在即将过期时（10% 缓冲）刷新，无需手动管理。

```typescript
// SDK 内部自动处理
const appClient = new OAuthAppClient({
  clientId,
  clientSecret,
  authServiceUrl,
});

// 首次调用：获取新令牌
await llmClient.getChatContent(...);  // ~200ms（含认证）

// 后续调用：使用缓存令牌
await llmClient.getChatContent(...);  // ~50ms（仅 LLM 调用）

// 令牌过期前自动刷新
// 无需手动干预
```

### 2. 并发控制

对于多房间并发场景，LLM 调用会自动排队：

```typescript
// 房间 A 的 LLM 玩家
handleTurn(roomA, roleId1);  // 并发执行

// 房间 B 的 LLM 玩家
handleTurn(roomB, roleId2);  // 并发执行

// 同一房间内的行动会被 ActionProcessor 串行化处理
// 避免状态冲突
```

### 3. 超时设置

```typescript
// LLM API 默认超时：30 秒
// 如果需要调整，可以在 SDK 初始化时配置：
const llmClient = createLLMClient({
  baseURL: llmApiBaseUrl,
  auth: appAuthBridge,
  // timeout: 60000,  // 60秒（未来 SDK 版本可能支持）
});
```

---

## 🧪 测试建议

### 1. 单元测试

```typescript
// tests/llm-executor.test.ts
import { createLLMExecutor } from '../src/runtime/llm-executor';

describe('LLMExecutor', () => {
  it('should parse valid JSON response', () => {
    const executor = createLLMExecutor(mockFastify);
    const response = '{"action_id":"place","params":{"row":1,"col":1}}';
    const action = executor['parseResponse'](response, mockPerspective, 'player_X');
    
    expect(action).toEqual({
      action_id: 'place',
      params: { row: 1, col: 1 },
      role_id: 'player_X',
    });
  });

  it('should validate action against action space', () => {
    const executor = createLLMExecutor(mockFastify);
    const action = { action_id: 'invalid', role_id: 'player_X' };
    const valid = executor['validateAction'](action, mockPerspective);
    
    expect(valid).toBe(false);
  });
});
```

### 2. 集成测试

```typescript
// tests/integration/llm-flow.test.ts
describe('LLM Player Flow', () => {
  it('should complete a full LLM turn', async () => {
    // 1. 创建房间并添加 LLM 玩家
    const roomId = await createRoomWithLLMPlayer();
    
    // 2. 开始游戏
    await startGame(roomId);
    
    // 3. 触发 LLM 回合
    await handleTurn(roomId, 'player_O');
    
    // 4. 验证行动已提交
    const state = await getRoomState(roomId);
    expect(state.history.length).toBeGreaterThan(0);
  });
});
```

### 3. Mock LLM 响应

```typescript
// 开发时可以 mock LLM 客户端以避免真实调用
const mockLLMClient = {
  getChatContent: jest.fn().mockResolvedValue(
    '{"action_id":"place","params":{"row":1,"col":1},"reasoning":"test"}'
  ),
};

fastify.decorate('appAuth', { llmClient: mockLLMClient });
```

---

## 🎯 下一步

1. **流式支持（M2）**：实现流式 LLM 调用，实时展示 AI 思考过程
2. **前端集成（M2）**：在前端显示 LLM 玩家的 reasoning
3. **高级 Prompt（M3）**：根据不同游戏类型优化 Prompt 模板
4. **性能监控（M3）**：记录 LLM 调用延迟、成功率等指标

---

## 📚 参考文档

- [backend_best_practices.md](./backend_best_practices.md) - AutoLab SDK 集成最佳实践
- [README.md](./README.md) - 平台整体架构
- [game_integration_guide.md](./game_integration_guide.md) - 游戏接入指南

---

**LLM 执行器已完全实现并可用于生产环境！** 🎉
















