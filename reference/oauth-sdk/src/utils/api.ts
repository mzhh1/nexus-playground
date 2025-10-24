import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

export interface ApiConfig {
  baseURL: string;
  onTokenRefreshed?: (accessToken: string, refreshToken: string) => void;
  onRefreshFailed?: () => void;
  clientIdProvider?: () => string | null;
}

const ACCESS_TOKEN_KEY = 'autolab_oauth_access_token';
const REFRESH_TOKEN_KEY = 'autolab_oauth_refresh_token';

export class OAuthAPIClient {
  private client: AxiosInstance;
  private isRefreshing = false;
  private failedQueue: Array<{ resolve: (value?: any) => void; reject: (error?: any) => void; }> = [];
  private onTokenRefreshed?: (accessToken: string, refreshToken: string) => void;
  private onRefreshFailed?: () => void;
  private clientIdProvider?: () => string | null;

  constructor(config: ApiConfig) {
    this.onTokenRefreshed = config.onTokenRefreshed;
    this.onRefreshFailed = config.onRefreshFailed;
    this.clientIdProvider = config.clientIdProvider;

    this.client = axios.create({
      baseURL: config.baseURL,
      headers: { 'Content-Type': 'application/json' },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
        if (accessToken && !config.headers.Authorization) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
          // 避免对 OAuth 换令牌/撤销接口自身做刷新
          if (originalRequest.url?.includes('/oauth/token') || originalRequest.url?.includes('/oauth/revoke')) {
            return Promise.reject(error);
          }

          if (this.isRefreshing) {
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            })
              .then(token => {
                if (originalRequest.headers) {
                  originalRequest.headers.Authorization = `Bearer ${token}`;
                }
                return this.client(originalRequest);
              })
              .catch(err => Promise.reject(err));
          }

          originalRequest._retry = true;
          this.isRefreshing = true;
          try {
            const newTokens = await this.performTokenRefresh();
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
            }
            this.processQueue(null, newTokens.accessToken);
            return this.client(originalRequest);
          } catch (refreshError) {
            this.processQueue(refreshError as AxiosError, null);
            if (this.onRefreshFailed) this.onRefreshFailed();
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private processQueue(error: AxiosError | null, token: string | null = null) {
    this.failedQueue.forEach(prom => {
      if (error) prom.reject(error);
      else prom.resolve(token);
    });
    this.failedQueue = [];
  }

  private async performTokenRefresh(): Promise<{ accessToken: string; refreshToken: string; }> {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) throw new Error('No refresh token available');
    const newTokens = await this.refreshToken(refreshToken);
    localStorage.setItem(ACCESS_TOKEN_KEY, newTokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, newTokens.refreshToken);
    if (this.onTokenRefreshed) this.onTokenRefreshed(newTokens.accessToken, newTokens.refreshToken);
    return newTokens;
  }

  async revoke(accessToken: string): Promise<void> {
    try {
      await this.client.post('/oauth/revoke', {
        token: accessToken,
        token_type_hint: 'access_token',
        ...(this.clientIdProvider?.() ? { client_id: this.clientIdProvider!() } : {}),
      });
    } catch (_e) {
      // 撤销按 RFC7009 幂等，忽略错误
    }
  }

  async revokeAll(): Promise<void> {
    const rt = localStorage.getItem(REFRESH_TOKEN_KEY);
    const at = localStorage.getItem(ACCESS_TOKEN_KEY);
    try {
      if (at) {
        await this.client.post('/oauth/revoke', {
          token: at,
          token_type_hint: 'access_token',
          ...(this.clientIdProvider?.() ? { client_id: this.clientIdProvider!() } : {}),
        });
      }
      if (rt) {
        await this.client.post('/oauth/revoke', {
          token: rt,
          token_type_hint: 'refresh_token',
          ...(this.clientIdProvider?.() ? { client_id: this.clientIdProvider!() } : {}),
        });
      }
    } catch (_e) {
      // 忽略撤销异常
    }
  }

  private async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; }> {
    const response = await axios.post(`${this.client.defaults.baseURL}/oauth/token`, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      ...(this.clientIdProvider?.() ? { client_id: this.clientIdProvider!() } : {}),
    }, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.data?.access_token || !response.data?.refresh_token) {
      throw new Error('Invalid refresh token response');
    }
    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
    };
  }

  getClient(): AxiosInstance {
    return this.client;
  }

  async refreshAccessToken(): Promise<string> {
    const tokens = await this.performTokenRefresh();
    return tokens.accessToken;
  }
}


