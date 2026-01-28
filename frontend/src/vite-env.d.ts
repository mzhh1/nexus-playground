/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GAME_CDN_BASE: string;
  readonly VITE_ENABLED_GAMES: string;
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
