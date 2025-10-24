/**
 * APIClient - HTTP API客户端封装
 */

export interface APIClientOptions {
  baseUrl: string;
  token?: string;
  timeout?: number;
}

export interface APIResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

/**
 * API客户端
 */
export class APIClient {
  private baseUrl: string;
  private token?: string;
  private timeout: number;

  constructor(options: APIClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.token = options.token;
    this.timeout = options.timeout || 30000;
  }

  /**
   * 设置认证Token
   */
  setToken(token: string): void {
    this.token = token;
  }

  /**
   * GET请求
   */
  async get<T = any>(path: string, params?: Record<string, any>): Promise<APIResponse<T>> {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<T>('GET', `${path}${queryString}`);
  }

  /**
   * POST请求
   */
  async post<T = any>(path: string, body?: any): Promise<APIResponse<T>> {
    return this.request<T>('POST', path, body);
  }

  /**
   * PUT请求
   */
  async put<T = any>(path: string, body?: any): Promise<APIResponse<T>> {
    return this.request<T>('PUT', path, body);
  }

  /**
   * DELETE请求
   */
  async delete<T = any>(path: string): Promise<APIResponse<T>> {
    return this.request<T>('DELETE', path);
  }

  /**
   * 发送HTTP请求
   */
  private async request<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<APIResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type');
      const hasJson = contentType?.includes('application/json');

      const data = hasJson ? await response.json() : await response.text();

      if (!response.ok) {
        return {
          error: data.error || data.message || `HTTP ${response.status}`,
          status: response.status,
        };
      }

      return {
        data,
        status: response.status,
      };
    } catch (error) {
      console.error('[APIClient] Request failed:', error);
      return {
        error: error instanceof Error ? error.message : 'Request failed',
        status: 0,
      };
    }
  }
}

