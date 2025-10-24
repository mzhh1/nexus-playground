# **可拓展LLM原生游戏平台：项目设计与构想 (V2.0)**

## **1\. 项目愿景**

旨在构建一个具有高度可拓展性的在线游戏平台。该平台的核心设计理念是将大型语言模型（LLM）作为原生参与者深度集成到游戏逻辑中。我们致力于打造一个生态系统，让开发者能够快速、低成本地将新游戏规则转化为可供人类与AI共同参与的在线游戏，并通过LLM的加入，创造前所未有的动态、智能和拟人化的游戏体验。

## **2\. 核心设计原则**

我们致力于构建一个满足以下核心目标的平台：

### **2.1. 子项目易于开发 (Rapid Development)**

**目标：** 开发者在理解一个新游戏的规则后，能迅速将其转化为平台上可运行的游戏项目，而无需关心底层通用服务的复杂性。

### **2.2. LLM原生适配性 (LLM-Native Adaptability)**

**目标：** LLM能无缝地理解任何接入平台的游戏规则，并作为任何角色（玩家、NPC）参与其中，尤其要能优雅地处理不完美信息游戏。

### **2.3. 可复现与可介入性 (Reproducibility & Intervenability)**

**目标:** 平台原生支持从任意一个有效的游戏局面启动一局游戏，并允许玩家（人类或LLM）在游戏过程中的任意时刻无缝接管或切换角色。

## **3\. 核心架构**

为了实现上述设计原则，我们设计了以下核心架构，它由游戏开发套件、明确的核心概念和状态驱动的游戏流程共同构成。

### **3.1. 游戏开发套件 (Game SDK)**

为了实现快速开发，平台将提供一个功能完备的SDK，将底层通用服务与游戏逻辑开发分离。SDK将包含：

* **游戏循环模板 (Game Loop Template):** 提供标准化的回合制游戏流程框架（如：onGameStart, onTurnStart, handleAction, onTurnEnd, onGameEnd），开发者只需填充钩子函数中的具体逻辑。  
* **统一状态管理器 (Unified State Manager):** 提供标准化的数据结构和方法来定义、更新和查询游戏的核心权威状态（即 **全局状态**），确保状态变更的原子性、一致性与可追溯性。  
* **事件总线 (Event Bus):** 建立一套解耦的事件发布/订阅系统，用于处理游戏中发生的各类事件（如“玩家A出牌”、“玩家B生命值-10”），便于模块间通信和功能扩展。  
* **通用服务API:** 封装用户认证、匹配、房间管理、数据存储等通用功能，开发者通过简单调用即可使用。

### **3.2. USADL核心体系定义**

本平台架构的核心是一个名为USADL（Universal State and Action Description Language）的统一描述体系。它由三个核心数据实体驱动：全局状态、角色视角 和 角色映射。

1. **全局状态 (Global State)**  
   * **定义:** 游戏在服务器端的唯一真实数据源，即“上帝视角”。它包含了游戏的所有权威信息。  
   * **作用:** 由平台后端的 **游戏状态管理器** 维护，用于执行游戏逻辑、验证玩家行动的合法性、以及判断游戏胜负。**此JSON永远不会直接发送给任何玩家**。  
   * **结构定义:**  
     * game\_rules: (String) 游戏规则的自然语言描述。  
     * history: (Array) 从游戏开始到当前所有已执行的行动日志。  
     * current\_state: (Object) 包含当前游戏局面的所有权威信息，如棋盘状态、所有玩家手牌等。  
2. **角色视角 (Role Perspective)**  
   * **定义:** 这是根据“全局状态”为**特定角色**生成的、经过过滤和处理的“客户端视图”。它只包含该角色在该时间点 **应该知道** 的信息。  
   * **作用:** 这是平台与玩家（无论是人类前端还是LLM AI）之间通信的**核心协议**。它将复杂的全局状态，转化为特定角色易于理解的决策上下文。  
   * **结构定义:**  
     * global\_rules: (String) 游戏的核心玩法、目标和胜利/失败条件的自然语言描述。  
     * whole\_history: (Array) 完整的游戏历史，以事件日志的形式为LLM提供完整的决策上下文。  
     * diff\_history: (Array) 差异历史，记录了从该角色上次行动（包含该次行动）至今的所有行动，用于帮助LLM快速理解近期局势变化。  
     * current\_state: (Object) 描述该角色**视角下**的游戏局面。  
     * your\_role: (Object) 明确告知LLM其当前扮演的角色和目标。  
     * action\_space\_definition: (Object) 分为“显式列表”和“行动模板”两种模式，定义当前可执行的动作。  
3. **角色映射 (Role Mapping)**  
   * **定义**: 一个JSON对象，它定义了游戏内的每一个逻辑角色 (role\_id) 由谁来扮演。扮演者可以是一个注册的人类用户 (human\_uid)，也可以是一个由模型和指令定义的LLM。  
   * **作用**: 将游戏内的逻辑角色与外部的真实玩家（或AI）进行动态绑定，是实现人机协作、动态难度和无缝切换的关键。  
   * **结构与示例:**  
     {  
       "role\_mapping": {  
         "player\_X": { "type": "human", "uid": "user\_12345" },  
         "player\_O": {  
           "type": "llm",  
           "model\_name": "gemini-pro",  
           "system\_prompt": "你是一个谨慎的井字棋选手，总是优先防守..."  
         }  
       }  
     }

### **3.3. 统一的游戏实例化与核心流程**

本平台的核心驱动逻辑是：**任何一个游戏实例，都由一个全局状态JSON和一个角色映射JSON唯一确定。** 这取代了传统的“开始新游戏”和“加载游戏”的分离模式，提供了一个更为强大和统一的入口。

#### **核心游戏流程**

1. **游戏实例化:** 游戏从一个给定的 **全局状态** 和一个 **角色映射** 开始实例化。  
2. **进入回合/阶段:** 引擎根据全局状态确定当前是哪个角色 (role\_id) 的行动阶段。  
3. **生成视角:** 引擎调用“视角生成器”，为当前行动角色生成其专属的 **角色视角**。  
4. **路由与决策:** 引擎查询角色映射，确定当前role\_id的扮演者。  
5. **提交行动:** 玩家（人类或LLM）决策后，向平台提交一个 **行动JSON**。  
6. **验证与执行:** 平台的“行动处理器”根据 **全局状态** 验证该行动的合法性，并更新 **全局状态**。  
7. **广播更新:** 游戏状态发生变化，引擎为所有相关的玩家重新生成他们最新的 **角色视角**，并根据角色映射推送给他们。  
8. **检查结束条件:** 引擎判断 **全局状态** 是否满足了游戏结束条件。

### **3.4. USADL应用示例**

#### **示例1：完美信息游戏 (井字棋)**

**场景描述:** 游戏进行到第二回合，轮到玩家'O'（一个LLM）行动。玩家'X'（人类）已在(1,1)位置下了一子。

* **全局状态 (Global State \- 服务器端):**  
  {  
    "game\_rules": "在一个3x3的棋盘上，两位玩家轮流下棋，先将自己的三个棋子连成一线者获胜。",  
    "history": \[  
      { "turn": 1, "role\_id": "player\_X", "action": "place\_1\_1" }  
    \],  
    "current\_state": {  
       "board": \[\[null, null, null\], \[null, "X", null\], \[null, null, null\]\],  
       "current\_role": "player\_O",  
       "turn": 2  
    }  
  }

* **角色视角 (Role Perspective \- 发送给玩家'O'的LLM):**  
  {  
    "global\_rules": "在一个3x3的棋盘上，两位玩家轮流下棋，先将自己的三个棋子连成一线者获胜。",  
    "whole\_history": \[  
      { "turn": 1, "role\_id": "player\_X", "action": "place\_1\_1" }  
    \],  
    "diff\_history": \[  
      { "turn": 1, "role\_id": "player\_X", "action": "place\_1\_1" }  
    \],  
    "current\_state": {   
      "board": \[\[null, null, null\], \[null, "X", null\], \[null, null, null\]\]   
    },  
    "your\_role": {   
      "identity": "Player O",  
      "goal": "在棋盘的空位上放置一个'O'，并尝试将三个'O'连成一线以获胜。"  
    },  
    "action\_space\_definition": {  
      "type": "explicit\_list",  
      "actions": \[  
        { "action\_id": "place\_0\_0", "description": "在(0,0)位置落子" },  
        { "action\_id": "place\_0\_1", "description": "在(0,1)位置落子" },  
        { "action\_id": "place\_0\_2", "description": "在(0,2)位置落子" },  
        { "action\_id": "place\_1\_0", "description": "在(1,0)位置落子" },  
        { "action\_id": "place\_1\_2", "description": "在(1,2)位置落子" },  
        { "action\_id": "place\_2\_0", "description": "在(2,0)位置落子" },  
        { "action\_id": "place\_2\_1", "description": "在(2,1)位置落子" },  
        { "action\_id": "place\_2\_2", "description": "在(2,2)位置落子" }  
      \]  
    }  
  }

#### **示例2：不完美信息游戏 (暗牌对战)**

**场景描述:** 一个简化的卡牌游戏，玩家A和B各有3张手牌，互相不可见。现在是第一回合，轮到玩家A（人类）出牌。

* **全局状态 (Global State \- 服务器端):**  
  {  
    "game\_rules": "双方各有3张手牌，每回合各出一张，点数大者得1分，3回合后分高者胜。",  
    "history": \[\],  
    "current\_state": {  
      "player\_A": { "hand": \[8, 5, 2\], "score": 0 },  
      "player\_B": { "hand": \[7, 6, 1\], "score": 0 },  
      "board": { "player\_A\_card": null, "player\_B\_card": null },  
      "current\_role": "player\_A",  
      "turn": 1  
    }  
  }

* **角色视角 (Role Perspective \- 发送给玩家'A'的客户端):**  
  {  
    "global\_rules": "双方各有3张手牌，每回合各出一张，点数大者得1分，3回合后分高者胜。",  
    "whole\_history": \[\],  
    "diff\_history": \[\],  
    "current\_state": {  
      "my\_hand": \[8, 5, 2\],  
      "my\_score": 0,  
      "opponent\_hand\_count": 3,  
      "opponent\_score": 0,  
      "board": {}  
    },  
    "your\_role": { "identity": "Player A", "goal": "获得比对手更高的分数。" },  
    "action\_space\_definition": {  
      "type": "explicit\_list",  
      "actions": \[  
        { "action\_id": "play\_8", "description": "打出手牌 8" },  
        { "action\_id": "play\_5", "description": "打出手牌 5" },  
        { "action\_id": "play\_2", "description": "打出手牌 2" }  
      \]  
    }  
  }

#### **示例3：巨大行动空间游戏 (围棋)**

**场景描述:** 轮到黑方（一个LLM）行动，由于可行动作数量巨大，平台使用“行动模板”来定义行动空间。

* **角色视角 (Role Perspective \- 发送给黑方LLM):**  
  {  
    "global\_rules": "围棋是一种策略棋类...",  
    "whole\_history": \[ ... \],  
    "diff\_history": \[ ... \],  
    "current\_state": {  
      "board": \[/\* 19x19 棋盘状态 \*/\],  
      "captured\_by\_black": 0,  
      "captured\_by\_white": 0  
    },  
    "your\_role": { "identity": "Black", "goal": "包围比对手更多的领地以获胜。" },  
    "action\_space\_definition": {  
      "type": "template",  
      "templates": \[  
        {  
          "template\_id": "place\_stone",  
          "description": "在棋盘的合法空点上落下一子。",  
          "params\_schema": {  
            "row": { "type": "integer", "description": "棋盘行坐标", "minimum": 0, "maximum": 18 },  
            "col": { "type": "integer", "description": "棋盘列坐标", "minimum": 0, "maximum": 18 }  
          }  
        },  
        {   
          "template\_id": "pass",  
          "description": "本回合选择“停一手”。"  
        }  
      \]  
    }  
  }  
