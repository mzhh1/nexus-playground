# State Formatter 模块说明

## 概述

`stateFormatter.ts` 是专门用于将狼人杀游戏状态（state json）转换为LLM更易理解的自然语言描述的模块。

## 核心功能

### 1. 明确区分信息类型

该模块将游戏状态信息分为两大类：

#### 全局信息（公开信息）
所有玩家都能看到的公开信息，包括：
- 当前游戏阶段（第几天/夜，处于什么阶段）
- 存活和死亡玩家列表
- 已死亡玩家的身份
- 各身份的存活数量统计
- 昨晚死亡情况
- 昨天放逐情况
- 今日发言记录
- 遗言记录
- 当前投票状态

#### 视角信息（私有信息）
特定玩家视角的私有信息，根据身份不同而异：

- **狼人**：狼队友名单、狼人投票情况、击杀目标
- **预言家**：历史查验记录、本轮查验结果
- **女巫**：药品使用状态、今晚狼人目标、毒药目标
- **守卫**：上次守护目标（防止连续守护）
- **猎人**：技能是否可用
- **平民**：无特殊私有信息
- **观战者**：全知视角，包括所有玩家身份、夜晚行动历史、投票历史等

### 2. 自然语言转换

原来的实现：
```
# 当前游戏状态
{"phase":"night","day":1,"night_sub_phase":"werewolf",...}
```

现在的实现：
```
# 全局信息（公开信息）
**第 1 夜 - 狼人击杀**

存活玩家（8人）：player1、player2、player3...
存活身份分布：狼人×2、预言家×1、女巫×1、守卫×1、平民×3

# 你的视角信息（私有信息）
**【你的身份：狼人】**
你可以在夜晚与狼队友协商并投票击杀一名玩家。
你的狼队友：player3
当前狼人投票：player1 → player5
```

### 3. 智能处理各种游戏逻辑

模块能够智能处理：
- 不同游戏阶段的信息展示
- 不同身份角色的私有信息
- 历史记录的格式化（发言、投票、死亡、夜晚行动等）
- 空值和缺失数据的处理
- 复杂数据结构的转换（投票统计、身份分布等）

## 使用方式

在 `perspective.ts` 中的 `generateStatePrompt` 函数已经自动使用了这个模块：

```typescript
import { formatStateToNaturalLanguage } from './stateFormatter.js';

export function generateStatePrompt(perspective: RolePerspective): string {
  const formattedState = formatStateToNaturalLanguage(perspective.current_state);
  
  // formattedState.globalInfo - 全局信息
  // formattedState.perspectiveInfo - 视角信息
}
```

## 优势

1. **提高LLM理解能力**：自然语言描述比JSON更容易理解
2. **清晰的信息分类**：明确区分公开信息和私有信息
3. **易于维护**：所有格式化逻辑集中在一个文件中
4. **可扩展性**：容易添加新的格式化规则
5. **类型安全**：完全使用TypeScript编写，有完整的类型检查

## 文件结构

- `formatStateToNaturalLanguage()` - 主导出函数
- `formatGlobalInfo()` - 格式化全局信息
- `formatPerspectiveInfo()` - 格式化视角信息
- 多个辅助函数 - 处理具体的格式化任务（游戏阶段、存活状态、投票等）
- 翻译函数 - 将内部标识转换为中文描述

## 示例输出

完整的state prompt示例：

```
# 游戏规则
[游戏规则内容...]

# 你的身份
ID: player1
角色: 狼人
目标: 隐藏身份，与狼队友协作击杀所有好人阵营角色。
**现在轮到你行动**

# 全局信息（公开信息）
**第 2 天 - 白天讨论阶段**

存活玩家（7人）：player1、player2、player4、player5、player6、player7、player8
已出局玩家：player3（预言家）
存活身份分布：狼人×2、女巫×1、猎人×1、守卫×1、平民×2

昨晚死亡的玩家：player3

**今日发言记录：**
1. player4：我认为player1昨晚的发言很可疑...
2. player5：我同意，player1的逻辑有问题...

# 你的视角信息（私有信息）
**【你的身份：狼人】**
你可以在夜晚与狼队友协商并投票击杀一名玩家。
你的狼队友：player2
```


