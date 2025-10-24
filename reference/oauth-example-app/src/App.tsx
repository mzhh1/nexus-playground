import { OAuthProvider, useOAuth, AuthAvatar, createAuthBridgeFromContext } from '@autolabz/oauth-sdk';
import { createDataClient } from '@autolabz/data-sdk';
import { createPointsClient } from '@autolabz/points-sdk';
import { createLLMClient } from '@autolabz/llmapi-sdk';
import { useEffect, useMemo, useState, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import '@autolabz/oauth-sdk/dist/style.css';
import './App.css';

function CallbackPage() {
  const { handleRedirect, isAuthenticated, user } = useOAuth();
  const navigate = useNavigate();
  const didRunRef = useRef(false);
  useEffect(() => {
    if (didRunRef.current) return;
    didRunRef.current = true;
    handleRedirect({ fetchUserinfo: true, redirectUri: (import.meta as any).env?.VITE_OAUTH_REDIRECT_URI }).catch((e) => console.error('OAuth 回调失败:', e));
  }, [handleRedirect]);
  useEffect(() => {
    if (!isAuthenticated) return;
    // 登录成功后跳回首页
    navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);
  if (!isAuthenticated) return <div style={{ padding: 24 }}>正在登录...</div>;
  return <div style={{ padding: 24 }}>欢迎回来，{user?.nickname || user?.email}</div>;
}

function AppContent() {
  const auth = useOAuth();
  const { isAuthenticated, user } = auth;
  const data = useMemo(() => {
    const baseURL = (import.meta as any).env?.VITE_DATA_BASE_URL;
    const bridge = createAuthBridgeFromContext(auth);
    const adapted = {
      getAccessToken: () => bridge.getAccessToken(),
      getClientId: async () => {
        const v = await Promise.resolve(bridge.getClientId());
        return v ?? null;
      },
      refreshAccessToken: () => bridge.refreshAccessToken(),
      onUnauthorized: bridge.onUnauthorized,
    };
    return createDataClient({ baseURL, auth: adapted as any });
  }, [auth]);

  const points = useMemo(() => {
    const baseURL = (import.meta as any).env?.VITE_POINTS_BASE_URL;
    const bridge = createAuthBridgeFromContext(auth);
    const adapted = {
      getAccessToken: () => bridge.getAccessToken(),
      getClientId: async () => {
        const v = await Promise.resolve(bridge.getClientId());
        return v ?? null;
      },
      refreshAccessToken: () => bridge.refreshAccessToken(),
      onUnauthorized: bridge.onUnauthorized,
    };
    return createPointsClient({ baseURL, auth: adapted as any });
  }, [auth]);

  const llm = useMemo(() => {
    const baseURL = (import.meta as any).env?.VITE_LLMAPI_BASE_URL;
    const bridge = createAuthBridgeFromContext(auth);
    const adapted = {
      getAccessToken: () => bridge.getAccessToken(),
      getClientId: async () => {
        const v = await Promise.resolve(bridge.getClientId());
        return v ?? null;
      },
      refreshAccessToken: () => bridge.refreshAccessToken(),
      onUnauthorized: bridge.onUnauthorized,
    };
    return createLLMClient({ baseURL, auth: adapted as any });
  }, [auth]);

  const [kvKey, setKvKey] = useState('demo-key');
  const [kvValue, setKvValue] = useState('');
  const [kvResult, setKvResult] = useState<string | null>(null);

  const [amount, setAmount] = useState<string>('1');
  const [pointsResult, setPointsResult] = useState<string | null>(null);

  const [model, setModel] = useState<string>('gpt-4o-mini');
  const [messagesText, setMessagesText] = useState<string>(
    JSON.stringify([
      { role: 'user', content: 'Say hello from AutoLab.' },
    ], null, 2)
  );
  const [stream, setStream] = useState<boolean>(false);
  const [llmResult, setLlmResult] = useState<string | null>(null);
  const [llmStreamText, setLlmStreamText] = useState<string>('');

  async function handlePointsHealth() {
    try {
      const health = await points.health();
      setPointsResult(`Health: ${JSON.stringify(health)}`);
    } catch (e: any) {
      setPointsResult(`Health check failed: ${e?.message || 'Unknown error'}`);
    }
  }

  async function handleGetBalance() {
    try {
      const res = await points.getMyBalance();
      setPointsResult(`Balance: ${JSON.stringify(res)}`);
    } catch (e: any) {
      setPointsResult(`Get balance failed: ${e?.message || 'Unknown error'}`);
    }
  }

  async function handleConsumePoints() {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || !Number.isInteger(amt) || amt <= 0) {
      alert('消费积分数量必须为正整数');
      return;
    }
    try {
      const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      const res = await points.consume({ amount: amt, reason: 'demo', requestId });
      setPointsResult(`Consume: ${JSON.stringify(res)}`);
    } catch (e: any) {
      setPointsResult(`Consume failed: ${e?.message || 'Unknown error'}`);
    }
  }

  async function handleLLMHealth() {
    try {
      const health = await llm.health();
      setLlmResult(`Health: ${JSON.stringify(health)}`);
    } catch (e: any) {
      setLlmResult(`Health check failed: ${e?.message || 'Unknown error'}`);
    }
  }

  async function handleSendLLM() {
    try {
      const body = { model, messages: JSON.parse(messagesText), stream } as any;
      if (stream) {
        setLlmStreamText('');
        setLlmResult(null);
        await llm.chatStream({ ...body, stream: true }, {
          onEvent: (line: string) => setLlmStreamText((s) => s + line + '\n'),
          onError: (e: Error) => setLlmResult(`Stream error: ${e.message}`),
          onDone: () => setLlmResult('Stream done'),
        });
      } else {
        const res = await llm.chat({ ...body, stream: false });
        setLlmResult(JSON.stringify(res));
      }
    } catch (e: any) {
      setLlmResult(`Send failed: ${e?.message || 'Unknown error'}`);
    }
  }

  async function handleCheckHealth() {
    try {
      const health = await data.health();
      setKvResult(`Health: ${JSON.stringify(health)}`);
    } catch (e: any) {
      setKvResult(`Health check failed: ${e?.message || 'Unknown error'}`);
    }
  }

  // OAuth login handled by AuthAvatar (oauthLogin)

  async function handlePutKV() {
    if (!kvKey) {
      alert('请输入 Key');
      return;
    }
    try {
      const res = await data.put(`/v1/data/${encodeURIComponent(kvKey)}`, { value: kvValue });
      setKvResult(`保存成功：${JSON.stringify(res)}`);
    } catch (e: any) {
      setKvResult(`保存失败：${e?.message || 'Unknown error'}`);
    }
  }

  async function handleGetKV() {
    if (!kvKey) {
      alert('请输入 Key');
      return;
    }
    try {
      const res: any = await data.get(`/v1/data/${encodeURIComponent(kvKey)}`);
      if (res && typeof res.value !== 'undefined') setKvValue(String(res.value));
      setKvResult(`读取成功：${JSON.stringify(res)}`);
    } catch (e: any) {
      setKvResult(`读取失败：${e?.message || 'Unknown error'}`);
    }
  }

  async function handleDeleteKV() {
    if (!kvKey) {
      alert('请输入 Key');
      return;
    }
    try {
      const res = await data.delete(`/v1/data/${encodeURIComponent(kvKey)}`);
      setKvResult(`删除成功：${JSON.stringify(res)}`);
    } catch (e: any) {
      setKvResult(`删除失败：${e?.message || 'Unknown error'}`);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>AutoLab OAuth 示例应用</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <AuthAvatar
            redirectUri={((import.meta as any).env?.VITE_OAUTH_REDIRECT_URI) || `${window.location.origin}/oauth-app/callback`}
            scope={(import.meta as any).env?.VITE_OAUTH_SCOPE ?? 'openid profile email data points llmapi'}
            additionalParams={{ prompt: 'consent' }}
            profileUrl={(import.meta as any).env?.VITE_OAUTH_PROFILE_URL}
          />
        </div>
      </header>

      <main className="app-main">
        <div className="welcome-card">
          <h2>OAuth 授权码（PKCE）登录</h2>
          {isAuthenticated ? (
            <div>
              <p>你好，{user?.nickname || user?.email}！</p>
              <p>这是一个使用 @autolabz/oauth-sdk 的示例应用</p>
              <div style={{ marginTop: 16, padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
                <h3 style={{ marginTop: 0 }}>数据服务示例：KV 存储</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    value={kvKey}
                    onChange={(e) => setKvKey(e.target.value)}
                    placeholder="Key"
                    style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6 }}
                  />
                  <input
                    value={kvValue}
                    onChange={(e) => setKvValue(e.target.value)}
                    placeholder="Value"
                    style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6, minWidth: 240 }}
                  />
                  <button onClick={handleCheckHealth}>检查数据服务健康</button>
                  <button onClick={handlePutKV}>保存/更新</button>
                  <button onClick={handleGetKV}>读取</button>
                  <button onClick={handleDeleteKV}>删除</button>
                </div>
                {kvResult ? (
                  <pre style={{ background: '#f8fafc', padding: 8, borderRadius: 6, marginTop: 8, whiteSpace: 'pre-wrap' }}>{kvResult}</pre>
                ) : null}
              </div>

              <div style={{ marginTop: 16, padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
                <h3 style={{ marginTop: 0 }}>LLM 服务示例：Chat Completions</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="model（如 gpt-4o-mini）"
                    style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6, minWidth: 200 }}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={stream} onChange={(e) => setStream(e.target.checked)} />
                    流式（SSE）
                  </label>
                  <button onClick={handleLLMHealth}>检查 LLMAPI 健康</button>
                  <button onClick={handleSendLLM}>发送 ChatCompletions</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                  <textarea
                    value={messagesText}
                    onChange={(e) => setMessagesText(e.target.value)}
                    placeholder='messages（JSON 数组）'
                    rows={10}
                    style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6, fontFamily: 'monospace' }}
                  />
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>流式输出（原始 data 行）</div>
                    <pre style={{ background: '#f8fafc', padding: 8, borderRadius: 6, marginTop: 4, whiteSpace: 'pre-wrap', minHeight: 180 }}>{llmStreamText}</pre>
                  </div>
                </div>
                {llmResult ? (
                  <pre style={{ background: '#f8fafc', padding: 8, borderRadius: 6, marginTop: 8, whiteSpace: 'pre-wrap' }}>{llmResult}</pre>
                ) : null}
              </div>

              <div style={{ marginTop: 16, padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
                <h3 style={{ marginTop: 0 }}>积分服务示例：余额与消费</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="消费积分数量（正整数）"
                    style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6, minWidth: 160 }}
                  />
                  <button onClick={handlePointsHealth}>检查积分服务健康</button>
                  <button onClick={handleGetBalance}>查询余额</button>
                  <button onClick={handleConsumePoints}>消费积分</button>
                </div>
                {pointsResult ? (
                  <pre style={{ background: '#f8fafc', padding: 8, borderRadius: 6, marginTop: 8, whiteSpace: 'pre-wrap' }}>{pointsResult}</pre>
                ) : null}
              </div>
            </div>
          ) : (
            <div>
              <p>你尚未登录</p>
              <p>点击右上角头像按钮开始登录</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function App() {
  const rawAuthServiceUrl = (import.meta as any).env?.VITE_AUTH_API_BASE_URL;
  const clientId = (import.meta as any).env?.VITE_OAUTH_CLIENT_ID
    || new URLSearchParams(window.location.search).get('client_id')
    || sessionStorage.getItem('autolab_client_id')
    || undefined;

  // Normalize to absolute or rooted path
  const authServiceUrl = (() => {
    try {
      if (!rawAuthServiceUrl) return '/api';
      if (/^https?:\/\//i.test(rawAuthServiceUrl)) return rawAuthServiceUrl.replace(/\/$/, '');
      const path = rawAuthServiceUrl.startsWith('/') ? rawAuthServiceUrl : `/${rawAuthServiceUrl}`;
      return path;
    } catch (e) {
      console.warn('[oauth-example] failed to normalize VITE_AUTH_API_BASE_URL:', e);
      return rawAuthServiceUrl;
    }
  })();

  const redirectUri = (import.meta as any).env?.VITE_OAUTH_REDIRECT_URI
    || `${window.location.origin}/oauth-app/callback`;

  // Expose runtime debug for port 51001
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__OAUTH_EXAMPLE_DEBUG__ = { authServiceUrl, clientId, redirectUri, href: window.location.href };
  console.info('[oauth-example] OAuth env', { rawAuthServiceUrl, authServiceUrl, clientId, redirectUri });
  if (!clientId) console.error('[oauth-example] VITE_OAUTH_CLIENT_ID missing - login will fail.');

  return (
    <OAuthProvider authServiceUrl={authServiceUrl} clientId={clientId}>
      <BrowserRouter basename="/oauth-app">
        <Routes>
          <Route path="/" element={<AppContent />} />
          <Route path="/callback" element={<CallbackPage />} />
        </Routes>
      </BrowserRouter>
    </OAuthProvider>
  );
}

export default App;


