# 已出局玩家信息格式优化

## 修改时间
2025-11-07

## 修改原因
用户希望在提示词中将已出局玩家的身份和遗言整合在一起显示，使信息更加清晰直观。

## 修改内容

### 1. 优化 `formatAliveStatus` 函数
- **修改文件**: `games/werewolf/logic/stateFormatter.ts`
- **修改内容**:
  - 添加 `lastWords` 参数，接收遗言历史数组
  - 创建遗言映射表，将每个玩家的遗言与其关联
  - 在显示已出局玩家时，如果该玩家有遗言，则紧跟在身份后面显示
  - 格式：
    ```
    **已出局玩家：**
      - player3（预言家）
        遗言："我是预言家，昨晚查验player1是好人"
      - player6（平民）
        遗言："我是平民，请大家相信player3的话"
    ```

### 2. 更新 `formatGlobalInfo` 函数
- **修改内容**:
  - 调用 `formatAliveStatus` 时传入遗言历史：`formatAliveStatus(state, state.last_words_history || [])`
  - 移除单独的遗言历史显示部分（原来的第6项）
  - 更新注释序号

### 3. 代码清理
- 删除未使用的导入语句：
  - `import type { Identity, Camp, NightSubPhase, WerewolfState } from './types.js'`
  - `import { getCamp } from './utils.js'`
- 删除未使用的函数 `formatLastWordsHistory`（功能已整合到 `formatAliveStatus` 中）

## 效果对比

### 修改前
```
存活玩家（6人）：player1、player2、player4、player5、player7、player8
已出局玩家：player3（预言家）、player6（平民）
存活身份分布：狼人×2、女巫×1、猎人×1、守卫×1、平民×1

**遗言记录：**
- player3：我是预言家，昨晚查验player1是好人
- player6：我是平民，请大家相信player3的话
```

### 修改后
```
存活玩家（6人）：player1、player2、player4、player5、player7、player8

**已出局玩家：**
  - player3（预言家）
    遗言："我是预言家，昨晚查验player1是好人"
  - player6（平民）
    遗言："我是平民，请大家相信player3的话"

存活身份分布：狼人×2、女巫×1、猎人×1、守卫×1、平民×1
```

## 优势

1. **信息关联性更强**：每个出局玩家的身份和遗言紧密关联，不需要在不同部分之间跳转查找
2. **结构更清晰**：使用缩进和层级结构，视觉上更容易区分
3. **便于推理**：LLM可以更容易地理解每个出局玩家留下的信息，有助于游戏局势分析
4. **代码更简洁**：删除了重复的格式化逻辑，减少了代码冗余

## 特殊情况处理

1. **玩家没有遗言**：只显示玩家ID和身份，不显示遗言行
2. **没有出局玩家**：不显示"已出局玩家"部分
3. **遗言数据缺失**：使用空数组作为默认值，确保不会出现错误

## 测试建议

建议测试以下场景：
1. 游戏初期，没有出局玩家
2. 有出局玩家但没有遗言（如夜晚被击杀）
3. 有出局玩家且有遗言（如白天被放逐）
4. 多个出局玩家，部分有遗言部分没有
5. 遗言内容包含特殊字符（引号、换行等）

## 相关文件

- `games/werewolf/logic/stateFormatter.ts` - 主要修改文件
- `games/werewolf/logic/FORMATTING_EXAMPLE.md` - 格式示例文档
- `games/werewolf/logic/STATE_FORMATTER_README.md` - 模块说明文档

