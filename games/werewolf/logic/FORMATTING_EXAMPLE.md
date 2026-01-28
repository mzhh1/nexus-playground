# 已出局玩家信息格式示例

## 修改前的格式

```
存活玩家（6人）：player1、player2、player4、player5、player7、player8
已出局玩家：player3（预言家）、player6（平民）
存活身份分布：狼人×2、女巫×1、猎人×1、守卫×1、平民×1

**遗言记录：**
- player3：我是预言家，昨晚查验player1是好人
- player6：我是平民，请大家相信player3的话
```

**问题**：已出局玩家的身份和遗言分散在不同位置，不够直观。

## 修改后的格式

```
存活玩家（6人）：player1、player2、player4、player5、player7、player8

**已出局玩家：**
  - player3（预言家）
    遗言："我是预言家，昨晚查验player1是好人"
  - player6（平民）
    遗言："我是平民，请大家相信player3的话"

存活身份分布：狼人×2、女巫×1、猎人×1、守卫×1、平民×1
```

**优势**：
- ✅ 每个出局玩家的身份和遗言紧密关联
- ✅ 信息更加结构化和清晰
- ✅ LLM更容易理解玩家出局时留下的信息
- ✅ 便于推理和分析游戏局势

## 特殊情况处理

### 情况1：玩家没有留下遗言

```
**已出局玩家：**
  - player3（狼人）
  - player5（女巫）
    遗言："狼人是player1和player2"
```

### 情况2：游戏初期，还没有出局玩家

```
存活玩家（8人）：player1、player2、player3、player4、player5、player6、player7、player8
存活身份分布：狼人×2、预言家×1、女巫×1、猎人×1、守卫×1、平民×2
```

（不显示"已出局玩家"部分）

## 代码实现

在 `stateFormatter.ts` 中的 `formatAliveStatus` 函数：

```typescript
function formatAliveStatus(state: Record<string, any>, lastWords: any[] = []): string {
  // ...
  
  // 已死亡玩家及其身份和遗言
  if (state.dead_players && Object.keys(state.dead_players).length > 0) {
    // 创建遗言映射表，方便查找
    const lastWordsMap = new Map<string, string>();
    if (lastWords && Array.isArray(lastWords)) {
      lastWords.forEach((words: any) => {
        lastWordsMap.set(words.speaker, words.content);
      });
    }

    const deadInfoLines: string[] = [];
    Object.entries(state.dead_players).forEach(([player, identity]) => {
      const identityStr = translateIdentity(identity as string);
      const lastWord = lastWordsMap.get(player);
      
      if (lastWord) {
        deadInfoLines.push(`  - ${player}（${identityStr}）\n    遗言："${lastWord}"`);
      } else {
        deadInfoLines.push(`  - ${player}（${identityStr}）`);
      }
    });
    
    sections.push(`**已出局玩家：**\n${deadInfoLines.join('\n')}`);
  }
  
  // ...
}
```

调用时传入遗言历史：
```typescript
sections.push(formatAliveStatus(state, state.last_words_history || []));
```


