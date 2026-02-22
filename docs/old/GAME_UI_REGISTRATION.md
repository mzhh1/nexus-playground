# Game UI Registration Guide

## Overview

This guide explains how to register a new game's UI component with the Nexus Playground frontend.

## Registration Process

When you create a new game with a UI component, you need to register it in the game UI loader.

### Step 1: Create Your Game UI Component

Create your UI component at:
```
games/<game-id>/ui/ui.tsx
```

The component must:
1. Export a default React component
2. Accept `GameUIProps` as props
3. Implement the game's visual interface

Example structure:
```typescript
import React from 'react';
import type { GameUIProps } from '../../../frontend/src/lib/game-ui-types';

const MyGameUI: React.FC<GameUIProps> = ({
  perspective,
  onAction,
  isMyTurn,
  readonly,
}) => {
  // Your UI implementation
  return <div>My Game UI</div>;
};

export default MyGameUI;
```

### Step 2: Register the Game UI

Open `frontend/src/lib/game-ui-loader.ts` and add your game to the `gameUIRegistry`:

```typescript
const gameUIRegistry: Record<string, () => Promise<{ default: GameUIComponent }>> = {
  'tic-tac-toe': () => import('../../../games/tic-tac-toe/ui/ui.tsx'),
  'your-game-id': () => import('../../../games/your-game-id/ui/ui.tsx'),  // Add this line
  // Add more games here as they are created
};
```

**Important**: The key must match your game's ID exactly as it appears in the database and game manifest.

### Step 3: Test Your UI

1. Start the development server:
   ```bash
   make dev
   ```

2. Create a game session with your game ID

3. Navigate to the room page to see your UI in action

## Why Manual Registration?

Vite requires dynamic imports to be statically analyzable at build time. While Vite supports glob imports, they can be finicky with path aliases and TypeScript. Manual registration provides:

- **Reliability**: Guaranteed to work in all environments
- **Type Safety**: Full TypeScript support with proper error checking
- **Clarity**: Easy to see which games are registered
- **Performance**: Only loads the UI when needed (code splitting)

## Troubleshooting

### UI Not Loading

If your UI doesn't load, check:

1. **Registration**: Is your game ID in `gameUIRegistry`?
2. **File Path**: Does the import path match your file location?
3. **Export**: Does your component have a default export?
4. **Console**: Check browser console for error messages

### TypeScript Errors

If you get TypeScript errors:

1. Ensure your component implements `GameUIProps`
2. Check that imports use correct relative paths
3. Verify `vite-env.d.ts` exists in `frontend/src/`

### Build Errors

If the build fails:

1. Run `npm run typecheck` in the frontend directory
2. Fix any TypeScript errors
3. Ensure all imports are valid

## Best Practices

1. **Keep UI Lightweight**: Only import what you need
2. **Use CSS Modules**: Keep styles scoped to your component
3. **Handle Loading States**: Show appropriate feedback while actions process
4. **Validate Actions**: Check action validity before submission
5. **Accessibility**: Use semantic HTML and ARIA labels

## Example: Complete Registration

Here's a complete example for a new "chess" game:

1. Create the UI component:
```typescript
// games/chess/ui/ui.tsx
import React from 'react';
import type { GameUIProps } from '../../../frontend/src/lib/game-ui-types';
import './ui.module.css';

const ChessUI: React.FC<GameUIProps> = (props) => {
  // Implementation
  return <div className="chess-ui">Chess Board</div>;
};

export default ChessUI;
```

2. Register in `game-ui-loader.ts`:
```typescript
const gameUIRegistry: Record<string, () => Promise<{ default: GameUIComponent }>> = {
  'tic-tac-toe': () => import('../../../games/tic-tac-toe/ui/ui.tsx'),
  'chess': () => import('../../../games/chess/ui/ui.tsx'),
};
```

3. Test and verify!

## Related Documentation

- [Game Integration Guide](../game_integration_guide.md)
- [Frontend Best Practices](../frontend_best_practices.md)
- [Quick Start Guide](./QUICK_START.md)

