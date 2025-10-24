# **星枢 (Nexus) 子游戏 SDK 开发文档 (V1.0)**

## **1\. 简介**

### **1.1. 设计哲学**

欢迎使用星枢 (Nexus) 子游戏 SDK！本 SDK 旨在让您（游戏开发者）能够快速、低成本地将您的游戏创意接入星枢平台。

我们的核心设计哲学是\*\*“关注点分离” (Separation of Concerns)\*\*。您作为游戏开发者，只需要专注于两件事：

1. **游戏核心逻辑 (Engine):** 您的游戏规则、状态如何变更、谁赢了。  
2. **游戏交互界面 (Client):** 您的游戏看起来是什么样子、玩家如何操作。

您**不需要**关心：

* 服务器架设、数据库或网络通信 (WebSocket)。  
* 玩家房间管理、身份验证或连接状态。  
* 大型语言模型 (LLM) 的 API 调用、Prompt 封装、Token 成本或错误重试。

平台将处理所有这些复杂的底层服务。

### **1.2. SDK 构成**

本 SDK 主要由三个 NPM 包组成：

* @nexus-playground/engine: (后端) 用于定义游戏核心逻辑的 TypeScript/Node.js 库。  
* @nexus-playground/client: (前端) 用于构建游戏 UI 的 React 库 (Hooks)。  
* @nexus-playground/cli: (工具) 用于初始化、测试和打包项目的命令行工具。

## **2\. 核心概念**

在开始之前，请理解以下几个核心概念，它们是平台架构的基石：

* **游戏引擎 (Game Engine)**  
  * 您使用 @nexus-playground/engine 开发的后端逻辑。  
  * 它是一个**无状态的**“规则即服务”。平台会托管它，并在需要时调用它的接口来计算游戏状态。  
* **游戏客户端 (Game Client)**  
  * 您使用 @nexus-playground/client 开发的 React 应用。  
  * 这是一个纯粹的“皮肤”，它唯一的任务是**渲染**平台推送来的数据，并**发送**玩家的操作。  
* GameState (游戏状态)  
  * **“上帝视角”的 JSON 对象，是游戏的唯一真实数据源**。  
  * 它包含了所有信息（例如，所有玩家的手牌）。  
  * **它只存在于服务器端**，永远不会直接发送给任何客户端。  
* RolePerspective (角色视角)  
  * \*\*“玩家视角”\*\*的 JSON 对象。  
  * 它是您的**引擎**根据 GameState 和特定 roleId **过滤生成**的数据。  
  * 它只包含该角色**应该知道**的信息（例如，只包含“我的手牌”，而不包含“对手的手牌”）。  
  * 这是**前端 UI 的唯一数据源**，也是**平台用来询问 LLM 的 Prompt**。  
* ActionJSON (行动)  
  * 一个描述玩家操作的 JSON 对象（例如 {"type": "play\_card", "cardId": 123}）。  
  * 这是**改变 GameState 的唯一方式**。  
  * 无论是人类玩家点击 UI，还是 LLM 玩家做出决策，都必须提交一个 ActionJSON。

## **3\. 快速开发工作流**

1. **初始化项目**  
   $ npm install \-g @nexus-playground/cli  
   $ nexus-cli init my-awesome-game

   这将创建 my-awesome-game/ 目录，包含 engine/ 和 client/ 两个子项目。  
2. **实现后端逻辑 (Engine)**  
   * 进入 engine/ 目录。  
   * 打开 src/engine.ts，实现 IGameEngine 接口（详见 5.0）。  
   * 您需要定义 GameState 结构，并实现 processAction (状态变更) 和 generatePerspective (视角生成) 等函数。  
3. **实现前端界面 (Client)**  
   * 进入 client/ 目录。  
   * 打开 src/App.tsx，使用 useNexus React Hook（详见 6.0）。  
   * 根据 useNexus 返回的 perspective 数据来渲染您的 UI。  
   * 在玩家操作时，调用 sendAction 提交 ActionJSON。  
4. **本地测试**  
   * 在项目根目录运行：

   $ nexus-cli serve

   * 此命令会启动一个**本地模拟平台**，同时运行您的 Engine 和 Client。  
   * 它提供热重载，并会模拟一个“随机AI”来扮演其他玩家，方便您进行端到端测试。  
5. **打包与部署**  
   * 当您完成开发和测试后，运行：

   $ nexus-cli package

   * 这将生成 engine.tar.gz 和 client.zip 两个文件。  
   * 将这两个文件上传到星枢开发者平台即可。

## **4\. @nexus-playground/cli (CLI 工具)**

### **nexus-cli init \<project-name\>**

* **作用:** 创建一个标准的游戏项目脚手架。  
* **目录结构:**  
  \<project-name\>/  
  ├── engine/             \# 后端 Engine (Node.js/TypeScript)  
  │   ├── src/  
  │   │   ├── engine.ts   \# \[\!\] 你的核心逻辑实现  
  │   │   └── types.ts    \# \[\!\] 你的类型定义 (GameState, ActionJSON)  
  │   └── package.json  
  ├── client/             \# 前端 Client (React/TypeScript)  
  │   ├── src/  
  │   │   └── App.tsx     \# \[\!\] 你的 UI 实现  
  │   └── package.json  
  └── package.json

### **nexus-cli serve**

* **作用:** 在本地启动一个完整的模拟开发环境 (http://localhost:3000)。  
* **功能:**  
  * 编译和运行您的 engine 服务。  
  * 编译和运行您的 client 应用 (Vite)。  
  * 提供一个**模拟的星枢平台**，处理 Engine 和 Client 之间的通信。  
  * 提供热重载 (Hot-Reloading)。  
  * **模拟 LLM 玩家**: 自动使用一个“随机AI”（从 action\_space\_definition 中随机选择一个动作）来填充空缺的玩家席位。

### **nexus-cli test-engine**

* **作用:** 启动一个命令行 REPL (读取-求值-输出循环)，用于**单独测试您的 Engine 逻辑**，而无需启动 UI。  
* **示例:**  
  Engine Loaded. Initializing game...  
  Current State: { "board": \[null, null\], "currentPlayer": "role\_A" }

  \> role role\_A action {"type": "play", "index": 0}  
  Action OK.  
  New State: { "board": \["X", null\], "currentPlayer": "role\_B" }

  \> role role\_A action {"type": "play", "index": 0}  
  Action Error: "Invalid move: cell is already taken."  
  Current State: { "board": \["X", null\], "currentPlayer": "role\_B" }

### **nexus-cli package**

* **作用:** 构建并打包您的 Engine 和 Client，用于生产部署。  
* **输出:**  
  * engine.tar.gz: 包含 Engine 服务的 Docker 镜像包。  
  * client.zip: 包含已构建的静态 React 资源。

## **5\. @nexus-playground/engine (后端 SDK)**

您的核心任务是实现 IGameEngine 接口 (engine/src/engine.ts)。

### **5.1. 核心接口 IGameEngine**

// engine/src/types.ts  
// 您需要首先定义这些类型  
type GameState \= any;       // 示例: { board: string\[\]\[\], currentPlayer: string }  
type ActionJSON \= any;    // 示例: { type: 'place', x: number, y: number }  
type RolePerspective \= any; // 示例: { board: string\[\]\[\], mySymbol: 'X', legalMoves: ... }  
type GameOptions \= any;     // 示例: { playerCount: number }  
type GameResults \= any;     // 示例: { winner: 'role\_A' }

// engine/src/engine.ts  
import { GameState, ActionJSON, RolePerspective, GameOptions, GameResults } from './types';

export interface IGameEngine {

  /\*\*  
   \* 返回游戏的元数据，用于平台展示  
   \*/  
  getGameMetadata(): {  
    name: string;  
    description: string;  
    // 支持的玩家人数选项，例如 \[2\] 或 \[3, 4, 5\]  
    supportedPlayerCounts: number\[\];  
  };

  /\*\*  
   \* (核心) 创建一个指定选项的初始游戏状态  
   \* @param options 游戏选项，例如 { playerCount: 2 }  
   \* @param roles 一个按顺序分配的角色ID数组, 例如 \["role\_A", "role\_B"\]  
   \* @returns 初始的 "上帝视角" GameState  
   \*/  
  getInitialState(options: GameOptions, roles: string\[\]): GameState;

  /\*\*  
   \* (核心) 处理一个行动 (游戏规则的核心)  
   \* 这是一个纯函数，它接收当前状态和行动，返回新状态或错误。  
   \* \* @param state 当前的 "上帝视角" GameState  
   \* @param action 玩家 (人类或LLM) 提交的 ActionJSON  
   \* @param roleId 提交该行动的角色 ID  
   \* @returns 如果行动合法，返回新的 GameState；如果非法，返回错误信息。  
   \*/  
  processAction(  
    state: GameState,  
    action: ActionJSON,  
    roleId: string  
  ): { newState: GameState; error?: null } | { newState: null; error: string };

  /\*\*  
   \* (核心) 生成特定角色的 "角色视角"  
   \* 这是不完美信息处理和 UI/LLM 数据源的核心。  
   \*  
   \* @param state 当前的 "上帝视角" GameState  
   \* @param roleId   
   \* @returns 该角色应该看到的 RolePerspective  
   \*/  
  generatePerspective(state: GameState, roleId: string): RolePerspective;

  /\*\*  
   \* (核心) 检查游戏是否结束  
   \* @param state 当前的 "上帝视角" GameState  
   \* @returns 返回游戏是否结束，以及结束时的结果。  
   \*/  
  checkEndCondition(  
    state: GameState  
  ): { isEnded: boolean; results: GameResults | null };  
}

### **5.2. RolePerspective 的重要性**

RolePerspective 是您**指导 LLM** 和**驱动 UI** 的唯一工具。一个设计良好的 RolePerspective 是游戏成功的关键。

**强烈建议** 在 RolePerspective 中包含以下字段：

// 一个设计良好的 RolePerspective 示例 (井字棋)  
type TicTacToePerspective \= {  
  // 1\. 游戏规则 (给 LLM 和人类的提示)  
  global\_rules: string;  
    
  // 2\. 你的角色信息  
  your\_role: {  
    identity: string; // "你是玩家 X"  
    goal: string;     // "你的目标是连成三子"  
  };  
    
  // 3\. 当前局面 (你可见的)  
  current\_state: {  
    board: (string | null)\[\]\[\];  
    currentPlayer: string;  
  };  
    
  // 4\. (至关重要) 行动空间定义，用于 UI 渲染和 LLM 约束  
  action\_space\_definition: {  
    type: 'explicit\_list'; // 或 'template'  
    actions: {  
      action\_id: string; // 唯一标识  
      description: string; // "在 (0,0) 位置落子"  
        
      // 对应的 ActionJSON，UI 和 LLM 将会提交这个  
      payload: { type: 'place', x: 0, y: 0 };   
    }\[\];  
  };  
    
  // 5\. (可选) 错误信息  
  last\_action\_error?: string; // "你上一步的行动非法：(1,1) 已被占据"  
};

**为什么 action\_space\_definition 如此重要？**

* **对于 UI:** 您的 React 客户端可以直接遍历 actions 列表来渲染按钮，onClick 时直接调用 sendAction(action.payload)。  
* **对于 LLM:** 平台会告诉 LLM：“你必须从以下列表中选择一个 action\_id 或生成一个符合 payload 格式的 JSON”。这极大地提高了 LLM 决策的准确性。

## **6\. @nexus-playground/client (前端 SDK)**

您的 Client 是一个 React 应用。SDK 提供了必要的 Hooks 来与平台通信。

### **6.1. NexusProvider**

您必须在应用的根组件使用 NexusProvider。

// client/src/main.tsx  
import React from 'react';  
import ReactDOM from 'react-dom/client';  
import { NexusProvider } from '@nexus-playground/client';  
import App from './App';

ReactDOM.createRoot(document.getElementById('root')\!).render(  
  \<React.StrictMode\>  
    \<NexusProvider\>  
      \<App /\>  
    \</NexusProvider\>  
  \</React.StrictMode\>  
);

### **6.2. useNexus() Hook**

这是您在 UI 中获取所有数据和发送所有操作的**唯一**途径。

// client/src/App.tsx  
import { useNexus } from '@nexus-playground/client';  
import { ActionJSON, RolePerspective } from '../../engine/src/types'; // 从 engine 导入类型

function GameUI() {  
  const {  
    perspective,  
    sendAction,  
    error,  
    isLoading,  
    gameContext  
  } \= useNexus\<RolePerspective, ActionJSON\>(); // 传入你的类型

  // 1\. 等待平台连接和数据加载  
  if (isLoading || \!perspective || \!gameContext) {  
    return \<div\>正在加载游戏... (您是 {gameContext?.myRoleId || '...'})\</div\>;  
  }

  // 2\. 显示平台返回的错误（例如，非法操作）  
  if (error) {  
    return \<div style={{ color: 'red' }}\>错误: {error}\</div\>;  
  }

  // 3\. 从 perspective 中获取数据并渲染 UI  
  const { board } \= perspective.current\_state;  
  const legalMoves \= perspective.action\_space\_definition.actions;

  return (  
    \<div\>  
      \<h1\>井字棋 (你是: {perspective.your\_role.identity})\</h1\>  
      \<div className="board"\>  
        {board.map((row, r) \=\> (  
          row.map((cell, c) \=\> (  
            \<div key={\`${r}-${c}\`} className="cell"\>  
              {cell}  
            \</div\>  
          ))  
        ))}  
      \</div\>

      {/\* 4\. 使用 action\_space\_definition 来渲染可交互按钮 \*/}  
      \<h3\>你的回合，请选择:\</h3\>  
      \<div className="actions"\>  
        {legalMoves.map(move \=\> (  
          \<button  
            key={move.action\_id}  
            // 5\. 调用 sendAction 提交行动  
            onClick={() \=\> sendAction(move.payload)}   
          \>  
            {move.description}  
          \</button\>  
        ))}  
      \</div\>  
    \</div\>  
  );  
}

export default GameUI;

#### **useNexus 返回值详解：**

* perspective: RolePerspective | null:  
  * 您的 engine.generatePerspective() 返回的 JSON 对象。  
  * 这是驱动 UI 渲染的**核心数据**。  
  * 每当游戏状态变化时，平台会重新计算并推送最新的 perspective，您的 UI 将自动重渲染。  
* sendAction: (action: ActionJSON) \=\> void:  
  * 您调用此函数来**提交一个行动**。  
  * SDK 会将其发送给平台，平台再调用您的 engine.processAction()。  
* error: string | null:  
  * 如果 processAction 返回了错误，或者平台出现网络错误，这里会显示错误信息。  
* isLoading: boolean:  
  * 在 perspective 首次加载或等待对手/LLM 行动时为 true。您可以用它来显示加载指示器或禁用 UI。  
* gameContext: GameContext | null:  
  * 包含游戏房间的上下文信息，例如：  
    * myRoleId: string (您在此游戏中的角色 ID, 如 "role\_A")  
    * allRoles: string\[\] (所有角色的 ID 列表)  
    * roleMap: Record\<string, { type: 'human' | 'llm', displayName: string }\> (角色与玩家的映射)  
    * isGamePaused: boolean

## **7\. 最佳实践**

* **保持 Engine 无状态**: 您的 IGameEngine 实现的**所有函数都必须是纯函数**。它们不应该依赖任何外部状态、数据库或 this 成员变量。所有状态都必须在 GameState 对象中传递。  
* **不完美信息的处理**:  
  * **黄金法则:** 永远不要将一个角色不该知道的信息放入 generatePerspective 的返回值中。  
  * **示例:** 在卡牌游戏中，GameState 包含 allPlayerHands。但 generatePerspective(state, "role\_A") 返回的 RolePerspective 中，只应包含 myHand: \[...\] 和 opponentHandCount: 3，绝不能包含 opponentHand: \[...\]。  
* **清晰的错误反馈**: 在 processAction 中，当一个行动非法时，返回一个**对用户友好**的 error 字符串（例如：“您不能在被占用的格子上落子”）。平台会自动将此消息通过 useNexus 的 error 字段显示给人类玩家，或通过 RolePerspective 的 last\_action\_error 字段反馈给 LLM，帮助其纠正决策。