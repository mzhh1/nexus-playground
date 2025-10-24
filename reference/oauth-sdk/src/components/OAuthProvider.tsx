import { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { OAuthAPIClient } from '../utils/api';
import { startAuthorization, handleRedirectCallback } from '../core/authorization';

export interface User {
  id: string;
  email: string;
  nickname: string | null;
  avatarUrl: string | null;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
}

interface AuthContextValue extends AuthState {
  isInitialized: boolean;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => Promise<void>;
  refreshAuth: () => void;
  getAccessToken: () => string | null;
  updateAccessToken: (newAccessToken: string) => void;
  getClientId: () => string | null;
  apiClient: OAuthAPIClient;
  // allow passing arbitrary oauth/oidc parameters
  // e.g. { prompt: 'consent', login_hint: 'user@example.com' }
  startLogin: (options: { redirectUri: string; scope?: string; state?: string; usePkce?: boolean; clientIdOverride?: string; additionalParams?: Record<string, string | number | boolean>; }) => Promise<void>;
  handleRedirect: (options?: { redirectUri?: string; fetchUserinfo?: boolean; clientIdOverride?: string; }) => Promise<{ accessToken: string; refreshToken?: string; userinfo?: any; state: string; }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface OAuthProviderProps {
  children: ReactNode;
  authServiceUrl: string; // 认证服务 API 基础地址（如 /api）
  clientId?: string;
  clientIdProvider?: () => string | null;
}

const STORAGE_KEY = 'autolab_oauth_state';
const REFRESH_TOKEN_KEY = 'autolab_oauth_refresh_token';
const ACCESS_TOKEN_KEY = 'autolab_oauth_access_token';

export function OAuthProvider({ children, authServiceUrl, clientId, clientIdProvider }: OAuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    accessToken: null,
  });
  const [isInitialized, setIsInitialized] = useState(false);

  const handleTokenRefreshed = useCallback((newAccessToken: string, _newRefreshToken: string) => {
    setAuthState(prev => ({
      ...prev,
      accessToken: newAccessToken,
    }));
  }, []);

  const handleRefreshFailed = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setAuthState({ isAuthenticated: false, user: null, accessToken: null });
  }, []);

  const apiClientRef = useRef<OAuthAPIClient | null>(null);

  const resolveClientId = useCallback((): string | null => {
    if (clientId) return clientId;
    if (clientIdProvider) {
      try {
        const provided = clientIdProvider();
        if (provided) return provided;
      } catch (_e) {}
    }
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get('client_id') || params.get('clientId');
      if (fromUrl) {
        console.warn('[autolab][oauth-sdk] clientId resolved from URL query. For production, pass a fixed clientId via <OAuthProvider clientId=...> or clientIdProvider().');
        return fromUrl;
      }
    } catch (_e) {}
    try {
      const fromSession = sessionStorage.getItem('autolab_client_id') || null;
      if (fromSession) {
        console.warn('[autolab][oauth-sdk] clientId resolved from sessionStorage. For production, pass a fixed clientId via <OAuthProvider clientId=...> or clientIdProvider().');
        return fromSession;
      }
    } catch (_e) {}
    return null;
  }, [clientId, clientIdProvider]);

  if (!apiClientRef.current) {
    apiClientRef.current = new OAuthAPIClient({
      baseURL: authServiceUrl,
      onTokenRefreshed: handleTokenRefreshed,
      onRefreshFailed: handleRefreshFailed,
      clientIdProvider: resolveClientId,
    });
  }

  const apiClient = apiClientRef.current;

  const didValidateRef = useRef(false);

  useEffect(() => {
    const storedState = localStorage.getItem(STORAGE_KEY);
    const storedAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (storedState) {
      try {
        const state = JSON.parse(storedState);
        setAuthState({
          ...state,
          accessToken: storedAccessToken,
        });
      } catch (error) {
        console.error('Failed to parse auth state:', error);
      }
    }
    setIsInitialized(true);
  }, []);

  // One-time validation on mount to ensure tokens are still valid after refresh
  useEffect(() => {
    if (!isInitialized || didValidateRef.current) return;
    didValidateRef.current = true;
    let cancelled = false;

    async function validateTokens() {
      const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

      // Nothing to validate
      if (!accessToken && !refreshToken) return;

      // If we have an access token, try a lightweight userinfo call
      if (accessToken) {
        try {
          await apiClient.getClient().get('/oauth/userinfo');
          return; // valid access token
        } catch (_e) {
          // fall through to try refresh
        }
      }

      // Try refresh if we have a refresh token
      if (refreshToken) {
        try {
          const newAccessToken = await apiClient.refreshAccessToken();
          if (!cancelled) {
            setAuthState(prev => ({ ...prev, isAuthenticated: true, accessToken: newAccessToken }));
          }
          return;
        } catch (_e) {
          // refresh failed; clear local state
        }
      }

      if (!cancelled) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        setAuthState({ isAuthenticated: false, user: null, accessToken: null });
      }
    }

    validateTokens();
    return () => {
      cancelled = true;
    };
  }, [isInitialized, apiClient]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const newState = JSON.parse(e.newValue);
          const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
          setAuthState({
            ...newState,
            accessToken,
          });
        } catch (error) {
          console.error('Failed to parse storage event:', error);
        }
      } else if (e.key === STORAGE_KEY && !e.newValue) {
        setAuthState({ isAuthenticated: false, user: null, accessToken: null });
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const login = (user: User, accessToken: string, refreshToken: string) => {
    const newState: AuthState = {
      isAuthenticated: true,
      user,
      accessToken,
    };
    const stateToStore = { isAuthenticated: true, user };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToStore));
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    setAuthState(newState);
  };

  const logout = async () => {
    const currentAccessToken = authState.accessToken || localStorage.getItem(ACCESS_TOKEN_KEY);
    if (currentAccessToken) {
      try {
        await apiClient.revokeAll();
      } catch (error) {
        console.error('Revoke failed:', error);
      }
    }
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setAuthState({ isAuthenticated: false, user: null, accessToken: null });
  };

  const refreshAuth = () => {
    const storedState = localStorage.getItem(STORAGE_KEY);
    const storedAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (storedState) {
      const state = JSON.parse(storedState);
      setAuthState({
        ...state,
        accessToken: storedAccessToken,
      });
    }
  };

  const getAccessToken = (): string | null => {
    return authState.accessToken || localStorage.getItem(ACCESS_TOKEN_KEY);
  };

  const updateAccessToken = (newAccessToken: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, newAccessToken);
    setAuthState(prev => ({
      ...prev,
      accessToken: newAccessToken,
    }));
  };

  const startLogin = useCallback(async (options: { redirectUri: string; scope?: string; state?: string; usePkce?: boolean; clientIdOverride?: string; additionalParams?: Record<string, string | number | boolean>; }) => {
    const resolvedClientId = options.clientIdOverride || resolveClientId();
    if (!resolvedClientId) throw new Error('Missing client_id');
    await startAuthorization({
      authServiceUrl,
      clientId: resolvedClientId,
      redirectUri: options.redirectUri,
      scope: options.scope,
      state: options.state,
      usePkce: options.usePkce ?? true,
      additionalParams: options.additionalParams,
    });
  }, [authServiceUrl, resolveClientId]);

  const handleRedirect = useCallback(async (options?: { redirectUri?: string; fetchUserinfo?: boolean; clientIdOverride?: string; }) => {
    const resolvedClientId = options?.clientIdOverride || resolveClientId();
    if (!resolvedClientId) throw new Error('Missing client_id');
    const redirectUri = options?.redirectUri || `${window.location.origin}${window.location.pathname}`;
    const result = await handleRedirectCallback({
      authServiceUrl,
      clientId: resolvedClientId,
      redirectUri,
      fetchUserinfo: options?.fetchUserinfo ?? true,
    });

    if (result.userinfo) {
      const user = result.userinfo as User;
      const rt = result.refreshToken || localStorage.getItem(REFRESH_TOKEN_KEY) || '';
      login(user, result.accessToken, rt);
    } else {
      // Fallback: persist tokens, mark authenticated without user object
      localStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken);
      if (result.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, result.refreshToken);
      const stateToStore = { isAuthenticated: true, user: null };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToStore));
      setAuthState({ isAuthenticated: true, user: null, accessToken: result.accessToken });
    }

    return result;
  }, [authServiceUrl, resolveClientId, login]);

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        isInitialized,
        login,
        logout,
        refreshAuth,
        getAccessToken,
        updateAccessToken,
        getClientId: resolveClientId,
        apiClient,
        startLogin,
        handleRedirect,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useOAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useOAuth must be used within OAuthProvider');
  }
  return context;
}


