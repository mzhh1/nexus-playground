/**
 * 统一 HTTP 错误模型 + 认证错误检测
 * 参考 oauth-template：区分 insufficient_scope / 401 / TokenAcquisitionError
 */

export class ApiHttpError extends Error {
  readonly status: number;
  readonly errorCode?: string;
  readonly errorDescription?: string;
  readonly isUnauthorized: boolean;
  readonly isForbidden: boolean;
  readonly isInsufficientScope: boolean;
  /** 401 且非 insufficient_scope 时建议重新登录 */
  readonly shouldReauthenticate: boolean;

  constructor(
    status: number,
    errorCode?: string,
    errorDescription?: string,
    bodyText?: string,
  ) {
    let message = `HTTP ${status}`;
    if (errorCode) message += `: ${errorCode}`;
    if (errorDescription) message += ` — ${errorDescription}`;
    else if (bodyText) message += `: ${bodyText.slice(0, 500)}`;

    super(message);
    this.name = 'ApiHttpError';
    this.status = status;
    this.errorCode = errorCode;
    this.errorDescription = errorDescription;
    this.isUnauthorized = status === 401;
    this.isForbidden = status === 403;

    const descLower = (errorDescription ?? '').toLowerCase();
    this.isInsufficientScope =
      errorCode === 'insufficient_scope' ||
      /insufficient_scope/.test(descLower) ||
      (bodyText ? /insufficient_scope/.test(bodyText.toLowerCase()) : false);

    this.shouldReauthenticate = this.isUnauthorized && !this.isInsufficientScope;
  }
}

export class TokenAcquisitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenAcquisitionError';
  }
}

/**
 * 供 UI 层根据错误决定是否触发重新登录
 */
export function needsReauthentication(err: unknown): boolean {
  if (err instanceof TokenAcquisitionError) return true;
  if (err instanceof ApiHttpError) return err.shouldReauthenticate;
  return false;
}

export function describeError(err: unknown): string {
  if (err instanceof ApiHttpError) {
    if (err.isInsufficientScope) {
      return `缺少所需权限（insufficient_scope）${err.errorDescription ? `：${err.errorDescription}` : ''}`;
    }
    if (err.isUnauthorized) {
      return `登录已失效（401）${err.errorDescription ? `：${err.errorDescription}` : ''}`;
    }
    if (err.isForbidden) {
      return `无权访问（403）${err.errorDescription ? `：${err.errorDescription}` : ''}`;
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unknown error';
}
