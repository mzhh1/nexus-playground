import { computeS256CodeChallenge, generateCodeVerifier, generateState, persistVerifier } from './pkce';

export interface BuildAuthorizeUrlParams {
  authServiceUrl: string;
  clientId: string;
  redirectUri: string;
  scope?: string;
  state?: string;
  usePkce?: boolean; // default true
  additionalParams?: Record<string, string | number | boolean>;
}

function joinUrl(base: string, path: string): string {
  const normalizedBase = base.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export async function buildAuthorizeUrl(params: BuildAuthorizeUrlParams): Promise<URL> {
  const { authServiceUrl, clientId, redirectUri, scope, usePkce = true, additionalParams } = params;
  const state = params.state || generateState(24);

  let codeChallenge: string | undefined;
  if (usePkce) {
    const verifier = generateCodeVerifier();
    persistVerifier(state, verifier);
    codeChallenge = await computeS256CodeChallenge(verifier);
  }

  // Support both absolute and relative authServiceUrl by providing a base URL.
  // If the first argument is absolute, the base is ignored by URL().
  const url = new URL(joinUrl(authServiceUrl, '/oauth/authorize'), window.location.origin);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  if (scope) url.searchParams.set('scope', scope);
  if (usePkce && codeChallenge) {
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
  }
  if (additionalParams) {
    const reserved = new Set(['response_type','client_id','redirect_uri','state','scope','code_challenge','code_challenge_method']);
    for (const [key, value] of Object.entries(additionalParams)) {
      if (!reserved.has(key)) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url;
}


