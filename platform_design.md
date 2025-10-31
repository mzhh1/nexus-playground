# **星枢沙盒 (Nexus Playground):可拓展LLM原生游戏平台项目设计与构想 (V3.0)**

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

## **3\.星枢(nexus):以用户为中心的游戏容器**

星枢类似一个房间，与用户一一对应，每个用户拥有自己的星枢。

用户对于自己的星枢有绝对的管理权限，是星枢的主人。

### **属性**

1. **主人ID（Onwer ID）**(持久化)
  
主人的uid

2. **星枢序列 (Room Id)**(持久化)

固定长度的随机字符。
  
每个星枢具有一个id，通过id对应的网址可以访问他人的星枢。(预留id更换功能)

3. **玩家列表(Player List)**

星枢可以容纳一定数量的玩家。玩家包括LLM玩家，人类玩家。

当前用户自己默认在自己的星枢的玩家列表，但预留后期自己不在自己星枢的玩家列表的可能。

    * **定义**: 一个JSON对象，它定义了参与游戏的玩家。玩家可以是一个注册的人类用户 (human\_uid)，也可以是一个由模型和指令定义的LLM。  
    
    room_player_id格式为{roomid}_{固定长度随机字符串}

    * **结构与示例:**  
    {
      {room_player_id1}: {
        "user_alice": {
          "type": "human",
          "uid": "user_alice", 
          "display_name": "Alice",
          "join_time": "2024-10-24T10:30:00Z",
          "status": "online"  // online, offline, banned
        },
      {room_player_id2}: {
        "type": "human", 
        "uid": "user_bob",
        "display_name": "Bob",
        "join_time": "2024-10-24T10:31:00Z", 
        "status": "online"
      },
      {room_player_id3}: {
          "type": "llm",
          "model_name": "gemini-pro",
          "system_prompt": "你是一个谨慎的井字棋选手...",
          "display_name": "AI助手",
          "join_time": "2024-10-24T10:32:00Z",
          "status": "active"
        },
    }

4. **房间状态(Room State)**

open / playing / paused（其中 paused 同时包含「临时暂停」与「终局暂停」，终局暂停会锁定状态，无法继续播放）

5. **游戏ID(Game ID)**

选择的游戏的ID

5. **游戏状态(Game State)**
   * **定义:** 游戏在服务器端的唯一真实数据源，即“上帝视角”。它包含了游戏的所有权威信息。  
   * **作用:** 由平台后端的 **游戏状态管理器** 维护，用于执行游戏逻辑、验证玩家行动的合法性、以及判断游戏胜负。**此JSON永远不会直接发送给任何玩家**。  
   * **结构定义:**  
     * game\_rules: (String) 游戏规则的自然语言描述。  
     * history: (Array) 从游戏开始到当前所有已执行的行动日志。  
     * current\_state: (Object) 包含当前游戏局面的所有权威信息，如棋盘状态、所有玩家手牌等。   

6. **角色映射(Role Mapping)**
   * **定义**: 一个JSON对象，它定义了游戏内的每一个逻辑角色 (role\_id) 由谁来扮演。扮演者可以是一个注册的人类用户 (human\_uid)，也可以是一个由模型和指令定义的LLM。  
   * **作用**: 将游戏内的逻辑角色与外部的真实玩家（或AI）进行动态绑定，是实现人机协作、动态难度和无缝切换的关键。  
   * **结构与示例:**  
     {   
        "player\_X":{room_player_id1},  
        "player\_O":{room_player_id2}
     }

### **开放阶段**

#### **确定Game ID**

主人可以为星枢选择一个游戏，确定Game ID

#### **确定PlayerList**
主人可以删除LLM玩家或人类玩家。
主人可以添加LLM玩家

其他人类玩家可以通过星枢的网址加入星枢。

#### **确定GameState**
在确定Game ID后主人可以选择一个GameState，默认为游戏最初提供的初始GameState。注意如果游戏允许不同的游戏人数那么主人需要选取对应游戏人数的初始GameState。也可以选择从保存的GameState中加载，要求是对应游戏的GameState。

#### **开始**
如果PlaerList的玩家数量不少于GameState的游戏人数，主人可以开始游戏


### **游戏阶段**

#### **状态与状态转换**

推演和暂停。

UI为播放和暂停键。

暂停时可以编辑角色映射。

未来预留部分游戏编辑GameState的功能。（例如从5人游戏变成6人游戏）

主人可以随时停止游戏。

如果满足游戏的条件，可以从暂停转变为播放。

**一般的暂停转推演条件如下**

游戏不处于结束。

GameState中的角色都有PlayerList中的玩家。(不要求PlayerList中的玩家都有角色)

#### **玩家属性**

**角色视角 (Role Perspective)**  
   * **定义:** 这是根据“游戏状态”为**特定角色**生成的、经过过滤和处理的“客户端视图”。它只包含该角色在该时间点 **应该知道** 的信息。  
   * **作用:** 这是平台与玩家（无论是人类前端还是LLM AI）之间通信的**核心协议**。它将复杂的游戏状态，转化为特定角色易于理解的决策上下文。  
   * **结构定义:**  
     * global\_rules: (String) 游戏的核心玩法、目标和胜利/失败条件的自然语言描述。  
     * whole\_history: (Array) 完整的游戏历史，以事件日志的形式为LLM提供完整的决策上下文。  
     * diff\_history: (Array) 差异历史，记录了从该角色上次行动（包含该次行动）至今的所有行动，用于帮助LLM快速理解近期局势变化。  
     * current\_state: (Object) 描述该角色**视角下**的游戏局面。  
     * your\_role: (Object) 明确告知LLM其当前扮演的角色和目标。  
     * action\_space\_definition: (Object) 分为“显式列表”和“行动模板”两种模式，定义当前可执行的动作。 

#### **游戏开始时**

默认为暂停状态。
主人此时需编辑角色映射。
提供拖动连线的交互式方式。

#### **游戏进行中**
  
1. **进入回合/阶段:** 引擎根据游戏状态确定当前是哪个角色 (role\_id) 的行动阶段。  
2. **生成视角:** 引擎调用“视角生成器”，为当前行动角色生成其专属的 **角色视角**。  
3. **路由与决策:** 引擎查询角色映射，确定当前role\_id的扮演者。  
4. **提交行动:** 玩家（人类或LLM）决策后，向平台提交一个 **行动JSON**。  
5. **验证与执行:** 平台的“行动处理器”根据 **游戏状态** 验证该行动的合法性，并更新 **游戏状态**。  
6. **广播更新:** 游戏状态发生变化，引擎为所有相关的玩家重新生成他们最新的 **角色视角**，并根据角色映射推送给他们。  
7. **检查结束条件:** 引擎判断 **游戏状态** 是否满足了游戏结束条件。否则重新跳转1

#### **游戏结束时**

暂停状态，且无法继续推演。
显示胜利者等游戏结束时提示。

## **4. 应用示例**

#### **示例1：完美信息游戏 (井字棋)**

**场景描述:** 游戏进行到第二回合，轮到玩家'O'（一个LLM）行动。玩家'X'（人类）已在(1,1)位置下了一子。

* **游戏状态 (Global State \- 服务器端):**  
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

* **游戏状态 (Global State \- 服务器端):**  
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
