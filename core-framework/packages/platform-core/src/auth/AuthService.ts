/**
 * AuthService - 用户认证服务
 * 
 * 封装 @autolabz/oauth-sdk，提供服务端认证功能
 */

import type { AuthBridge } from '@autolabz/oauth-sdk';
import { Player } from '@nexus/shared-types';

export interface AuthConfig {
  /** OAuth服务基础URL */
  authServiceUrl: string;
  
  /** OAuth Client ID */
  clientId: string;
  
  /** OAuth Client Secret（仅服务端使用） */
  clientSecret: string;
  
  /** Token验证端点 */
  tokenVerifyEndpoint?: string;
  
  /** 用户信息端点 */
  userinfoEndpoint?: string;
}

export interface TokenPayload {
  sub: string;
  email?: string;
  nickname?: string;
  exp: number;
  iat: number;
}

/**
 * 认证服务
 */
export class AuthService {
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = {
      tokenVerifyEndpoint: '/oauth/token/verify',
      userinfoEndpoint: '/oauth/userinfo',
      ...config,
    };
  }

  /**
   * 验证Access Token
   */
  async verifyToken(token: string): Promise<TokenPayload | null> {
    try {
      const response = await fetch(
        `${this.config.authServiceUrl}${this.config.tokenVerifyEndpoint}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data as TokenPayload;
    } catch (error) {
      console.error('[AuthService] Token verification failed:', error);
      return null;
    }
  }

  /**
   * 获取用户信息
   */
  async getUserInfo(token: string): Promise<Player | null> {
    try {
      const response = await fetch(
        `${this.config.authServiceUrl}${this.config.userinfoEndpoint}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return this.mapToPlayer(data);
    } catch (error) {
      console.error('[AuthService] Failed to get user info:', error);
      return null;
    }
  }

  /**
   * 从Token中提取用户ID
   */
  async extractUserId(token: string): Promise<string | null> {
    const payload = await this.verifyToken(token);
    return payload ? payload.sub : null;
  }

  /**
   * 检查Token是否过期
   */
  isTokenExpired(payload: TokenPayload): boolean {
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  }

  /**
   * 中间件：验证请求中的Token
   */
  createAuthMiddleware() {
    return async (req: any, res: any, next: any) => {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Missing or invalid authorization header',
        });
      }

      const token = authHeader.substring(7);
      const payload = await this.verifyToken(token);

      if (!payload) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid or expired token',
        });
      }

      if (this.isTokenExpired(payload)) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Token expired',
        });
      }

      // 附加用户信息到请求对象
      req.user = {
        uid: payload.sub,
        email: payload.email,
        nickname: payload.nickname,
      };

      next();
    };
  }

  /**
   * 从OAuth响应映射到Player对象
   */
  private mapToPlayer(data: any): Player {
    return {
      uid: data.sub || data.id || data.uid,
      nickname: data.nickname || data.name,
      email: data.email,
      avatar: data.avatar || data.picture,
    };
  }

  /**
   * 获取 AuthBridge（用于 LLM/Data/Points SDK）
   * 
   * 注意：后端服务使用 OAuth Client Credentials Flow
   */
  getAuthBridge(): AuthBridge {
    let cachedToken: string | null = null;
    let tokenExpiry: number = 0;

    return {
      getAccessToken: async () => {
        // 检查缓存的 token 是否过期
        if (cachedToken && Date.now() < tokenExpiry) {
          return cachedToken;
        }

        // 使用 Client Credentials Flow 获取 token
        const response = await fetch(`${this.config.authServiceUrl}/oauth/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            scope: 'llmapi data points',
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to get access token: ${response.statusText}`);
        }

        const data = await response.json();
        cachedToken = data.access_token;
        // 设置过期时间为 token 有效期的 90%（预留一些时间）
        tokenExpiry = Date.now() + (data.expires_in || 3600) * 900;

        return cachedToken;
      },

      getClientId: async () => {
        return this.config.clientId;
      },

      refreshAccessToken: async (): Promise<string> => {
        // 对于 Client Credentials Flow，直接重新获取即可
        cachedToken = null;
        tokenExpiry = 0;
        
        // 递归调用获取新 token
        const response = await fetch(`${this.config.authServiceUrl}/oauth/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            scope: 'llmapi data points',
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to refresh access token: ${response.statusText}`);
        }

        const data = await response.json();
        cachedToken = data.access_token;
        tokenExpiry = Date.now() + (data.expires_in || 3600) * 900;

        if (!cachedToken) {
          throw new Error('No access token received');
        }

        return cachedToken;
      },

      onUnauthorized: () => {
        console.error('[AuthService] Unauthorized - clearing cached token');
        cachedToken = null;
      },
    };
  }
}

/**
 * 创建认证服务实例
 */
export function createAuthService(config: AuthConfig): AuthService {
  return new AuthService(config);
}

