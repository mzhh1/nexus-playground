# Werewolf Game

`games/werewolf` contains the migrated Werewolf implementation for Nexus.

- `logic/`: game state machine and perspective generation
- `ui/`: iframe React UI
- `worker/`: Cloudflare Worker wrapper API and static hosting

Build:

```bash
pnpm --filter @nexusgame/game-werewolf build
```

Run worker locally:

```bash
cd games/werewolf/worker
pnpm run dev
```
