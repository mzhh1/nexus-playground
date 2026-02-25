export const workerIndexTemplate = `import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { GameState, Action, InitContext } from '@nexusgame/game-sdk';
import logic from '../../logic/index';

type AssetFetcher = { fetch: (request: Request) => Promise<Response> };

type Bindings = {
  ASSETS: AssetFetcher;
  UI_BASE_URL?: string;
};

const app = new Hono<{ Bindings: Bindings }>();
const WORKER_VERIFY_SIGNATURE = 'NEXUS_GAME_WORKER_VERIFIED_V1';

app.use('/*', cors());

app.get('/game-ui.js', async (c) => {
  const url = new URL(c.req.url);
  url.pathname = '/_ui.js';
  const response = await c.env.ASSETS.fetch(new Request(url, c.req.raw));
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('Access-Control-Allow-Origin', '*');
  newResponse.headers.set('Content-Type', 'application/javascript');
  return newResponse;
});

app.get('/style.css', async (c) => {
  const url = new URL(c.req.url);
  const response = await c.env.ASSETS.fetch(new Request(url, c.req.raw));
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('Access-Control-Allow-Origin', '*');
  newResponse.headers.set('Content-Type', 'text/css');
  return newResponse;
});

app.get('/game-ui.html', async (c) => {
  const url = new URL(c.req.url);
  const response = await c.env.ASSETS.fetch(new Request(url, c.req.raw));
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('Access-Control-Allow-Origin', '*');
  newResponse.headers.set('Content-Type', 'text/html');
  return newResponse;
});

app.get('/metadata', (c) => {
  const metadata = logic.getMetadata();
  const uiBaseUrl = c.env.UI_BASE_URL || new URL(c.req.url).origin;
  return c.json({
    ...metadata,
    ui: {
      mode: 'url',
      url: \`\${uiBaseUrl}/game-ui.html\`,
    },
  });
});

app.get('/__nexus_worker_verify', (c) =>
  c.text(WORKER_VERIFY_SIGNATURE, 200, { 'Content-Type': 'text/plain; charset=utf-8' })
);

app.post('/init', async (c) => {
  const body = await c.req.json<InitContext>();
  try {
    return c.json(logic.initState(body));
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

app.post('/legal-actions', async (c) => {
  const body = await c.req.json<{ state: GameState; roleId: string }>();
  try {
    return c.json(logic.getLegalActions(body.state, body.roleId));
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

app.post('/action', async (c) => {
  const body = await c.req.json<{ state: GameState; action: Action }>();
  try {
    // Use validateAndApply for automatic Zod schema validation when actionSchemas defined
    const result = ('validateAndApply' in logic)
      ? (logic as any).validateAndApply(body.state, body.action)
      : logic.applyAction(body.state, body.action);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

app.post('/is-terminal', async (c) => {
  const body = await c.req.json<{ state: GameState }>();
  try {
    const isTerminal = logic.isTerminal(body.state);
    const winners = isTerminal ? logic.getWinners(body.state) : null;
    return c.json({ isTerminal, winners });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

app.post('/perspective', async (c) => {
  const body = await c.req.json<{
    state: GameState;
    roleId: string;
    wholeHistory: any[];
    diffHistory: any[];
  }>();
  try {
    const perspective = logic.toRolePerspective(
      body.state,
      body.roleId,
      body.wholeHistory || [],
      body.diffHistory || []
    );
    return c.json(perspective);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

app.post('/state-prompt', async (c) => {
  const body = await c.req.json<{ perspective: any }>();
  try {
    const statePrompt =
      typeof logic.generateStatePrompt === 'function'
        ? logic.generateStatePrompt(body.perspective)
        : undefined;
    return c.json({ statePrompt });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

app.post('/current-role', async (c) => {
  const body = await c.req.json<{ state: GameState }>();
  try {
    return c.json({ roleId: logic.getCurrentRole(body.state) });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

export default app;
`;

export const wranglerTomlTemplate = (gameId: string) => `name = "${gameId}-worker"
main = "src/index.ts"
compatibility_date = "2024-03-20"
compatibility_flags = [ "nodejs_compat" ]

[build]
command = "pnpm run build"

[assets]
directory = "./public"
binding = "ASSETS"

[observability]
enabled = true
`;

export const packageJsonTemplate = (gameId: string) => `{
  "name": "@nexusgame/${gameId}",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "pnpm build:logic && pnpm build:ui",
    "build:logic": "tsup",
    "build:ui": "vite build -c vite.config.ui.ts",
    "dev": "wrangler dev -c worker/wrangler.toml",
    "deploy": "wrangler deploy -c worker/wrangler.toml"
  },
  "dependencies": {
    "hono": "^4.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@nexusgame/game-sdk": "workspace:*",
    "@types/react": "^18.2.48",
    "@types/react-dom": "^18.2.18",
    "@vitejs/plugin-react": "^4.2.1",
    "tsup": "^8.0.2",
    "typescript": "^5.3.3",
    "vite": "^5.0.12",
    "wrangler": "^3.30.1"
  }
}
`;

export const tsconfigJsonTemplate = `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["logic", "ui", "worker/src"],
  "exclude": ["node_modules", "dist"]
}
`;

export const tsconfigNodeJsonTemplate = `{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ui.ts", "tsup.config.ts"]
}
`;

export const tsupConfigTemplate = `import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['worker/src/index.ts', 'logic/index.ts'],
  format: ['esm'],
  target: 'esnext',
  clean: false,
  dts: false,
  outDir: 'dist/logic',
});
`;

export const viteConfigTemplate = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    // Output goes to worker/public/ for serving via the Worker
    outDir: 'worker/public',
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, 'ui/iframe-entry.tsx'),
      output: {
        entryFileNames: '_ui.js',
        assetFileNames: 'style.css',
      }
    }
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  server: {
    port: 5173,
    strictPort: true,
    cors: true
  }
});
`;

export const gameUiHtmlTemplate = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Nexus Game UI</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./iframe-entry.tsx"></script>
  </body>
</html>
`;

export const uiTemplate = (gameName: string) => `import React from 'react';
import styles from './ui.module.css';

interface Action {
  action_id: string;
  role_id: string;
  params?: any;
}

interface GameUIProps {
  perspective: any;
  onAction: (action: Action) => void;
  isMyTurn: boolean;
  readonly: boolean;
  metadata?: {
    roleId?: string;
    players?: Record<string, any>;
    roleDisplayMapping?: Record<string, { displayName: string, avatarUrl?: string, name: string }>;
  };
}

const ${gameName.replace(/[^a-zA-Z0-9]/g, '')}UI: React.FC<GameUIProps> = ({ perspective, onAction, isMyTurn, readonly, metadata }) => {
  const { current_state, your_role } = perspective;
  const roleId = metadata?.roleId ?? perspective.your_role.identity;
  
  // Helper to get display name
  const getDisplayName = (pid: string) => {
    if (metadata?.roleDisplayMapping && metadata.roleDisplayMapping[pid]) {
      return metadata.roleDisplayMapping[pid].name;
    }
    return pid;
  };

  const handleAction = () => {
    if (!isMyTurn || readonly) return;
    
    onAction({
      action_id: 'example_action',
      role_id: roleId,
      params: {}
    });
  };

  return (
    <div className={styles.container}>
      <h2>${gameName}</h2>
      <div className={styles.board}>
        <p>Your Role: {getDisplayName(roleId)}</p>
        <p>Current Turn: {current_state.turn}</p>
        <button 
          onClick={handleAction} 
          disabled={!isMyTurn || readonly}
          className={styles.button}
        >
          Do Action
        </button>
      </div>
    </div>
  );
};

export default ${gameName.replace(/[^a-zA-Z0-9]/g, '')}UI;
`;

export const uiModuleCssTemplate = `.container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  container-type: size;
  font-family: system-ui, -apple-system, sans-serif;
  background-color: #f8fafc;
  color: #334155;
}

.board {
  padding: 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  text-align: center;
}

.button {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: opacity 0.2s;
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.button:not(:disabled):hover {
  opacity: 0.9;
}
`;

export const uiTypesDtsTemplate = `declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
`;

export const iframeEntryTemplate = (gameName: string) => `import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ${gameName.replace(/[^a-zA-Z0-9]/g, '')}UI from './ui';

interface GameState {
  perspective: any;
  isMyTurn: boolean;
  readonly: boolean;
  metadata?: {
    roomId: string;
    roleId: string;
    playerId?: string;
    roleDisplayMapping?: Record<string, { displayName: string, avatarUrl?: string, name: string }>;
  };
}

const IframeApp: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stateUrl = params.get('stateUrl');
    const token = params.get('token');

    if (stateUrl && token) {
      const headers = { Authorization: \`Bearer \${token}\` };
      fetch(stateUrl, { headers })
        .then(res => res.json())
        .then(data => {
          if (data.data) {
            setGameState({
              perspective: data.data,
              isMyTurn: data.data.your_role.is_current,
              readonly: false,
              metadata: { 
                roleId: new URL(stateUrl).searchParams.get('roleId') as string, 
                roomId: 'dev-room' 
              }
            });
          }
        })
        .catch(err => console.error("Failed to fetch state:", err));
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.type === 'SYNC_STATE' && event.data.payload) {
        setGameState(event.data.payload);
      }
    };

    window.addEventListener('message', handleMessage);
    window.parent.postMessage({ type: 'IFRAME_READY' }, '*');

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleAction = async (action: { action_id: string; role_id: string; params?: any }) => {
    const params = new URLSearchParams(window.location.search);
    const actionUrl = params.get('actionUrl');
    const token = params.get('token');

    if (actionUrl && token) {
      const headers = { "Content-Type": "application/json", Authorization: \`Bearer \${token}\` };
      try {
        const res = await fetch(actionUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ roleId: action.role_id, action })
        });
        const data = await res.json();
        if (data.success) {
          console.log("Action succeeded. Please refresh the page manually.");
          alert("行动成功！请手动刷新页面查看最新状态。");
        } else {
          console.error("Action failed:", data);
          alert("行动失败: " + (data.error || JSON.stringify(data)));
        }
      } catch (err) {
        console.error("Failed to submit action:", err);
        alert("网络请求失败");
      }
      return;
    }

    window.parent.postMessage({ type: 'ACT', payload: action }, '*');
  };

  if (!gameState) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#666' }}>
        等待游戏数据...
      </div>
    );
  }

  return (
    <${gameName.replace(/[^a-zA-Z0-9]/g, '')}UI
      perspective={gameState.perspective}
      onAction={handleAction}
      isMyTurn={gameState.isMyTurn}
      readonly={gameState.readonly}
      metadata={gameState.metadata}
    />
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<IframeApp />);
`;

export const logicTemplate = (gameId: string, gameName: string, minPlayers: number, maxPlayers: number) => `import {
  GameLogic, GameMetadata, GameState, InitContext, ActionSpec,
  Action, ActionResult, HistoryEvent, RolePerspective,
  isSpectator
} from '@nexusgame/game-sdk';

interface MyGameState extends GameState {
  currentRole: string;
  turn: number;
  winner: string | null;
}

export class ${gameName.replace(/[^a-zA-Z0-9]/g, '')}Logic implements GameLogic {
  
  getMetadata(): GameMetadata {
    return {
      id: '${gameId}',
      name: '${gameName}',
      description: '这是一个由脚手架生成的基础游戏模板。',
      minPlayers: ${minPlayers},
      maxPlayers: ${maxPlayers},
      roleIds: Array.from({ length: ${maxPlayers} }, (_, i) => \`player_\${i + 1}\`),
      enable_llm_memory: false,
      getStatusText: (perspective) => {
        if (perspective.current_state.winner) return '游戏结束';
        return \`第 \${perspective.current_state.turn} 回合\`;
      }
    };
  }

  initState(ctx: InitContext): GameState {
    return {
      currentRole: ctx.players[0],
      turn: 1,
      winner: null
    };
  }

  getCurrentRole(state: GameState): string {
    return (state as MyGameState).currentRole;
  }

  getLegalActions(state: GameState, roleId: string): ActionSpec {
    if ((state as MyGameState).currentRole !== roleId || (state as MyGameState).winner) {
      return { actions: [] };
    }

    return {
      actions: [
        { action_id: 'example_action', description: '示例行动', params_schema: null }
      ]
    };
  }

  applyAction(state: GameState, action: Action): ActionResult {
    const s = JSON.parse(JSON.stringify(state)) as MyGameState;
    
    if (s.currentRole !== action.role_id) {
      return { success: false, error: '不是你的回合' };
    }

    if (action.action_id === 'example_action') {
      s.turn += 1;
      // TODO: 实现由谁进行下一回合的逻辑
    }

    return { success: true, nextState: s };
  }

  isTerminal(state: GameState): boolean {
    return (state as MyGameState).winner !== null;
  }

  getWinners(state: GameState): string[] | null {
    const s = state as MyGameState;
    return s.winner ? [s.winner] : null;
  }

  toRolePerspective(state: GameState, roleId: string, wholeHistory: HistoryEvent[], diffHistory: HistoryEvent[]): RolePerspective {
    const s = state as MyGameState;
    const spectator = isSpectator(roleId);
    
    let message = '';
    if (spectator) {
      message = s.winner ? '👀 观战模式 - 游戏结束' : \`👀 观战模式 - 轮到 \${s.currentRole}\`;
    } else {
      if (s.winner) message = s.winner === roleId ? '🎉 胜利！' : '😔 失败';
      else if (s.currentRole === roleId) message = '✨ 轮到你了，请选择行动';
      else message = '⏳ 等待对手行动...';
    }

    return {
      global_rules: this.getMetadata().description,
      whole_history: wholeHistory,
      diff_history: diffHistory,
      current_state: s,
      your_role: {
        identity: spectator ? 'Spectator' : roleId,
        goal: '你的游戏目标说明',
        is_current: spectator ? false : s.currentRole === roleId
      },
      action_space_definition: this.getLegalActions(state, roleId),
      message
    };
  }

  generateStatePrompt(perspective: RolePerspective): string {
    const s = perspective.current_state as MyGameState;
    return \`
# 游戏状态
当前回合：\${s.turn}
当前轮到：\${s.currentRole}
你的身份：\${perspective.your_role.identity}
    \`;
  }
}

export default new ${gameName.replace(/[^a-zA-Z0-9]/g, '')}Logic();
`;

export const readmeTemplate = (gameId: string) => `# ${gameId}

这是一个通过 \`nexus-dev create-game\` 生成的云原生桌游沙盒游戏项目。

## 目录结构

\`\`\`
├── logic/
│   └── index.ts            # (你需要实现) 游戏逻辑层，必须为纯函数
├── ui/
│   ├── ui.tsx              # (你需要实现) 游戏核心 UI
│   ├── ui.module.css       # UI 样式
│   ├── iframe-entry.tsx    # (已生成) 自动处理平台通信的外壳
│   └── game-ui.html        # UI 承载页
└── worker/
    ├── src/index.ts        # (已生成) 提供平台底层对接 API 和资源路由
    └── wrangler.toml       # (已生成) Cloudflare Worker 部署配置
\`\`\`

## 如何开发

1. **安装依赖**
   \`\`\`bash
   pnpm install
   \`\`\`

2. **本地调试**
   \`\`\`bash
   pnpm run dev
   \`\`\`
   启动本地 Worker 后，在 Nexus Admin 管理后台中将游戏的 \`gameWorkerUrl\` 指向本地地址即可全链路测试。

3. **打包发布**
   在根目录下执行：
   \`\`\`bash
   make deploy-game G=${gameId}
   \`\`\`
`;
