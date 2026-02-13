# Tic-Tac-Toe Game

A classic 3x3 tic-tac-toe game implementation for Nexus Playground.

## Game Rules

- Two players take turns placing their marks (X or O) on a 3x3 grid
- The first player to get three of their marks in a row (horizontally, vertically, or diagonally) wins
- If all cells are filled and no player has three in a row, the game is a draw

## Game Logic

**Location**: `logic/index.ts`

Implements the `GameLogic` interface with:
- State management for the 3x3 board
- Turn-based player switching
- Win/draw detection
- Legal action generation

## Game UI

**Location**: `ui/ui.tsx`

A React component that:
- Renders the 3x3 grid
- Handles player clicks for placing marks
- Highlights the current player's turn
- Shows win/draw status

## Technical Details

- **Game ID**: `tic-tac-toe`
- **Players**: Exactly 2
- **Information**: Perfect information (all players see the complete board)
- **Action Space**: Fixed options (one action per empty cell)
- **State**: Immutable, pure functional updates

## Example Game State

```json
{
  "board": [
    ["X", null, "O"],
    [null, "X", null],
    ["O", null, null]
  ],
  "currentRole": "player_X",
  "turn": 5,
  "winner": null,
  "isDraw": false
}
```

## Example Role Perspective

```json
{
  "global_rules": "在3x3棋盘上，两位玩家轮流下棋，先将自己的三个棋子连成一线者获胜。",
  "whole_history": [...],
  "diff_history": [...],
  "current_state": {
    "board": [["X", null, "O"], ...],
    "currentRole": "player_X",
    "turn": 5,
    "winner": null,
    "isDraw": false
  },
  "your_role": {
    "identity": "Player X",
    "goal": "在棋盘的空位上放置你的棋子，尝试将三个棋子连成一线以获胜。",
    "is_current": true
  },
  "action_space_definition": {
    "actions": [
      { "action_id": "place_0_1", "description": "在位置 (0,1) 落子", "params_schema": null },
      { "action_id": "place_1_0", "description": "在位置 (1,0) 落子", "params_schema": null },
      ...
    ]
  }
}
```

