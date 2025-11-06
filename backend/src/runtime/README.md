# Runtime Components

This directory contains the core runtime components for the Nexus Playground platform.

## 📁 Directory Structure

```
runtime/
├── state-manager.ts           # Game state management (Redis)
├── action-processor.ts        # Action validation and processing
├── perspective-generator.ts   # Role perspective generation
├── event-bus.ts              # SSE event broadcasting
├── llm-executor.ts           # LLM API integration (non-streaming)
├── auto-player-executor.ts   # Auto player interface
├── llm-player-executor.ts    # LLM player implementation
└── auto-player-coordinator.ts # Auto player orchestration
```

## 🤖 Auto Player System

The auto player system is built on a modular architecture that supports multiple types of automated players:

### Core Components

1. **AutoPlayerExecutor** (Interface)
   - Defines the contract for all auto player implementations
   - Methods: `getName()`, `canHandle()`, `executeTurn()`

2. **LLMPlayerExecutor** (Implementation)
   - Handles LLM-controlled players
   - Integrates with `llm-executor.ts` for AI decision-making

3. **AutoPlayerCoordinator** (Orchestrator)
   - Maintains registry of auto player executors
   - Triggers execution at appropriate times
   - Handles recursive auto-play for consecutive auto players

### Quick Start: Adding a Custom Auto Player

```typescript
// 1. Create your executor
export class MyCustomPlayerExecutor implements AutoPlayerExecutor {
  getName(): string {
    return 'MyCustomPlayerExecutor';
  }

  canHandle(roomState: RoomState, currentRoleId: string): boolean {
    const playerId = roomState.role_mapping[currentRoleId];
    const player = roomState.player_list[playerId];
    return player?.type === 'my_custom_type';
  }

  async executeTurn(roomId: string, currentRoleId: string): Promise<boolean> {
    // Your logic here
    // 1. Get game state
    // 2. Make decision
    // 3. Submit action via ActionProcessor
    return true;
  }
}

// 2. Register it in auto-player-coordinator.ts
private registerDefaultExecutors(): void {
  this.registerExecutor(createLLMPlayerExecutor(this.fastify));
  this.registerExecutor(new MyCustomPlayerExecutor(this.fastify)); // Add here
}
```

### Trigger Points

Auto players are automatically triggered at:

1. **Game Start** - When `room_status` becomes `'playing'`
2. **After Action** - When any player submits an action
3. **On Resume** - When game resumes from pause

No manual intervention needed! 🎉

## 📚 Documentation

See [AUTO_PLAYER_SYSTEM.md](../../AUTO_PLAYER_SYSTEM.md) for comprehensive documentation on:
- Architecture design
- Implementation details
- Extension guide
- Testing strategies

See [LLM_EXECUTOR_GUIDE.md](../../LLM_EXECUTOR_GUIDE.md) for LLM-specific features:
- Prompt construction
- Retry logic
- Parameter validation
- Configuration

## 🔧 Key Features

### State Management
- Redis-based state storage
- Distributed locking for concurrency
- Optimistic version control

### Action Processing
- Turn validation
- Legal action checking
- History recording
- Error handling

### Perspective Generation
- Role-specific views
- Partial observability support
- Caching with invalidation
- Efficient serialization

### Event Broadcasting
- SSE-based real-time updates
- Per-room channels
- Automatic client cleanup
- Graceful disconnection

### Auto Player System
- Pluggable executor architecture
- Chain of responsibility pattern
- Recursive turn handling
- Asynchronous, non-blocking execution

## 🚀 Usage Examples

### Starting a Game with LLM Player

```typescript
// 1. Create room
const roomId = await createRoom(ownerId);

// 2. Add LLM player
await addPlayer(roomId, {
  player_type: 'llm',
  display_name: 'AI Opponent',
  model_name: 'gpt-4o-mini-2024-07-18',
  system_prompt: 'You are a strategic game player.'
});

// 3. Add human player
await addPlayer(roomId, {
  player_type: 'human',
  uid: userId,
  display_name: 'Player 1'
});

// 4. Start game - Auto player will trigger automatically!
await startGame(roomId, {
  role_mapping: {
    player_1: 'human_player_id',
    player_2: 'llm_player_id'
  }
});

// No further action needed - auto player will execute when it's their turn
```

### Monitoring Auto Player Execution

Check logs for auto player activity:

```bash
# INFO level logs
[INFO] AutoPlayerCoordinator: Auto player turn detected, triggering executor
[INFO] LLMPlayerExecutor: Starting LLM turn execution
[INFO] LLMExecutor: Successfully generated valid action
[INFO] AutoPlayerCoordinator: Turn executed successfully

# DEBUG level logs (set LOG_LEVEL=debug)
[DEBUG] AutoPlayerCoordinator: Checking current turn
[DEBUG] LLMExecutor: Calling LLM API
[DEBUG] LLMExecutor: Received LLM response
```

## 🧪 Testing

Run tests for runtime components:

```bash
# All runtime tests
npm test -- --testPathPattern=runtime

# Specific component
npm test -- state-manager.test.ts
npm test -- action-processor.test.ts
npm test -- auto-player-coordinator.test.ts
```

## 🔒 Security Considerations

- **Distributed Locking**: Prevents race conditions in concurrent action processing
- **State Validation**: All state transitions are validated before persistence
- **Action Authorization**: Turn validation ensures only current role can act
- **LLM API Security**: Application-level OAuth2 credentials (never exposed to client)

## 📈 Performance

- **State Caching**: Redis-based caching with automatic invalidation
- **Perspective Caching**: Generated perspectives are cached per role
- **Async Execution**: Auto players execute asynchronously without blocking HTTP responses
- **Token Reuse**: LLM application tokens are cached and auto-refreshed

## 🐛 Troubleshooting

### Auto Player Not Executing

1. Check room status is `'playing'`
2. Verify player type is set correctly (e.g., `'llm'`)
3. Check logs for executor matching
4. Ensure LLM credentials are configured (for LLM players)

### Action Processing Fails

1. Check if it's the correct role's turn
2. Verify action is in legal action space
3. Check distributed lock acquisition
4. Review action processor logs

### LLM Execution Fails

1. Verify `OAUTH_APP_CLIENT_ID` and `OAUTH_APP_CLIENT_SECRET` are set
2. Check LLM API service availability
3. Review LLM executor retry logs
4. Ensure sufficient API credits

See logs for detailed error messages and stack traces.

---

**Questions?** Check the comprehensive documentation in `AUTO_PLAYER_SYSTEM.md` and `LLM_EXECUTOR_GUIDE.md`!







