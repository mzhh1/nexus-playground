export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export function createLogger(debug: boolean): Logger {
  return {
    debug(message: string, ...args: unknown[]) {
      if (debug) {
        console.log(`[DEBUG] ${message}`, ...args);
      }
    },
    info(message: string, ...args: unknown[]) {
      console.log(`[INFO] ${message}`, ...args);
    },
    error(message: string, ...args: unknown[]) {
      console.error(`[ERROR] ${message}`, ...args);
    },
  };
}

export function logAuthSuccess(logger: Logger, debug: boolean, payload: { sub?: string; iss?: string }) {
  if (debug) {
    logger.debug('JWT 验证成功', { sub: payload.sub, iss: payload.iss });
  } else {
    logger.info('用户认证成功', { sub: payload.sub, iss: payload.iss });
  }
}

export function logAuthFailure(logger: Logger, debug: boolean, reason: string, payload?: { sub?: string; iss?: string }, cause?: unknown) {
  const baseInfo = { reason, ...payload };

  if (debug && cause) {
    logger.error('JWT 验证失败', { ...baseInfo, cause });
  } else {
    logger.error('用户认证失败', baseInfo);
  }
}
