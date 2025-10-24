import { buildAuthorizeUrl, BuildAuthorizeUrlParams } from '../utils/url';
import { consumeVerifier } from '../utils/pkce';

const ACCESS_TOKEN_KEY = 'autolab_oauth_access_token';
const REFRESH_TOKEN_KEY = 'autolab_oauth_refresh_token';

export type StartAuthorizationParams = BuildAuthorizeUrlParams;

export async function getAuthorizeUrl(params: StartAuthorizationParams): Promise<URL> {
  return buildAuthorizeUrl(params);
}

export async function startAuthorization(params: StartAuthorizationParams): Promise<void> {
  const url = await getAuthorizeUrl(params);
  window.location.assign(url.toString());
}

export interface HandleRedirectCallbackParams {
  authServiceUrl: string;
  clientId: string;
  redirectUri: string;
  fetchUserinfo?: boolean;
}

function joinUrl(base: string, path: string): string {
  const normalizedBase = base.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export async function handleRedirectCallback(params: HandleRedirectCallbackParams): Promise<{ accessToken: string; refreshToken?: string; userinfo?: any; state: string; }>{
  const { authServiceUrl, clientId, redirectUri, fetchUserinfo = true } = params;

  const search = new URLSearchParams(window.location.search);
  const error = search.get('error');
  const errorDescription = search.get('error_description');
  if (error) {
    throw new Error(`OAuth error: ${error}${errorDescription ? ` - ${errorDescription}` : ''}`);
  }

  const code = search.get('code');
  const state = search.get('state') || '';
  if (!code || !state) {
    throw new Error('Missing authorization code or state in redirect URL');
  }

  const verifier = consumeVerifier(state);
  if (!verifier) {
    throw new Error('Missing PKCE verifier for the given state');
  }

  const tokenResp = await fetch(joinUrl(authServiceUrl, '/oauth/token'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: verifier,
    }),
  });

  if (!tokenResp.ok) {
    const text = await tokenResp.text().catch(() => '');
    throw new Error(`Token exchange failed: ${tokenResp.status} ${text}`);
  }
  const tokenJson = await tokenResp.json();
  const accessToken = tokenJson.access_token as string | undefined;
  const refreshToken = tokenJson.refresh_token as string | undefined;
  if (!accessToken) {
    throw new Error('Invalid token response');
  }

  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } catch (_e) {}

  let userinfo: any | undefined;
  if (fetchUserinfo) {
    try {
      const uiResp = await fetch(joinUrl(authServiceUrl, '/oauth/userinfo'), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (uiResp.ok) userinfo = await uiResp.json();
    } catch (_e) {}
  }

  return { accessToken, refreshToken, userinfo, state };
}


