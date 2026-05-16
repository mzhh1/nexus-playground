import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AuthenticationError, AuthorizationError, ServerError } from './error';
import { createLogger } from './logger';
import { parseConfig } from './config/env';
import publicRoutes from './routes/public';
import protectedRoutes from './routes/protected';
import hookRoutes from './routes/hook';
import llmWebhookRoutes from './routes/llm-webhook';
import monitorRoutes from './routes/monitor';
import type { Env, Variables } from './types';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use('/api/*', async (c, next) => {
  const rawConfig = parseConfig(c.env);
  const allowedOrigins = rawConfig.corsAllowOrigins;
  const origin = c.req.header('origin');

  if (allowedOrigins.length === 0) {
    return next();
  }

  const isMonitorApi = c.req.path.startsWith('/api/monitor');

  if (!isMonitorApi && origin && !allowedOrigins.includes(origin)) {
    return c.json({ error: 'CORS origin not allowed' }, 403);
  }

  const corsMiddleware = cors({
    origin: (requestOrigin) => {
      if (isMonitorApi && requestOrigin) return requestOrigin;
      if (!requestOrigin) return allowedOrigins[0];
      return allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type', 'X-Requested-With', 'x-client-id', 'x-guest-id'],
    maxAge: 86400,
  });

  return corsMiddleware(c, next);
});

app.route('/', publicRoutes);
app.route('/', protectedRoutes);
app.route('/', hookRoutes);
app.route('/', llmWebhookRoutes);
app.route('/api/monitor/backendroom', monitorRoutes);

app.onError((err, c) => {
  let rawConfig: ReturnType<typeof parseConfig>;
  try {
    rawConfig = parseConfig(c.env);
  } catch {
    rawConfig = {
      issuerEndpoint: '',
      resourceIndicator: '',
      debug: false,
      workerUrls: [],
      corsAllowOrigins: [],
    };
  }
  const logger = createLogger(rawConfig.debug);

  if (err instanceof AuthenticationError) {
    logger.error('认证错误', {
      message: err.message,
      ...(rawConfig.debug && err.cause ? { cause: err.cause } : {})
    });
    return c.json({ error: 'Unauthorized', message: err.message }, 401);
  }

  if (err instanceof AuthorizationError) {
    logger.error('授权错误', { message: err.message });
    return c.json({ error: 'Forbidden', message: err.message }, 403);
  }

  if (err instanceof ServerError) {
    logger.error('服务器错误', {
      message: err.message,
      ...(rawConfig.debug && err.cause ? { cause: err.cause } : {})
    });
    return c.json({ error: 'Server Error', message: err.message }, 500);
  }

  logger.error('未知错误', {
    name: err.name,
    message: err.message,
    ...(rawConfig.debug ? { stack: err.stack } : {})
  });
  return c.json({ error: 'Internal Server Error', message: 'Something went wrong.' }, 500);
});

app.notFound((c) => {
  return c.json({ error: 'Not Found', path: c.req.path }, 404);
});

export default app;
