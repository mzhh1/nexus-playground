import { useEffect, useState } from 'react';
import { useLogto, type UserInfoResponse, type IdTokenClaims } from '@logto/react';

const AUTH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function validateCache() {
  const cachedTime = localStorage.getItem('last_auth_timestamp');
  if (!cachedTime) return false;
  return Date.now() - parseInt(cachedTime, 10) <= AUTH_CACHE_TTL_MS;
}

export function useCurrentUser(fetchRemote: boolean = false) {
  const {
    isAuthenticated: logtoIsAuthenticated,
    isLoading: logtoIsLoading,
    getIdTokenClaims,
    fetchUserInfo,
    error: logtoError,
    clearAllTokens,
  } = useLogto();

  const [optimisticAuth, setOptimisticAuth] = useState<boolean>(() => {
    if (!validateCache()) return false;
    return localStorage.getItem('last_auth_state') === 'true';
  });

  const [user, setUser] = useState<UserInfoResponse | IdTokenClaims | null>(() => {
    if (!validateCache()) return null;
    try {
      const cached = localStorage.getItem('last_auth_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  // Load user data when authenticated
  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const claims = await getIdTokenClaims();
        if (active && claims) {
          setUser(claims);
        }
      } catch (e) {
        console.warn('Failed to get ID token claims:', e);
      }

      if (fetchRemote) {
        try {
          const freshUserInfo = await fetchUserInfo();
          if (active && freshUserInfo) {
            setUser(freshUserInfo);
          }
        } catch {
          // fallback to id token claims
        }
      }
    }

    if (logtoIsAuthenticated) {
      loadData();
    }

    return () => {
      active = false;
    };
  }, [logtoIsAuthenticated, getIdTokenClaims, fetchUserInfo, fetchRemote]);

  // Clear user data when logged out
  useEffect(() => {
    if (!logtoIsLoading && !logtoIsAuthenticated) {
      setUser(null);
    }
  }, [logtoIsLoading, logtoIsAuthenticated]);

  // Handle token invalidation
  useEffect(() => {
    if (logtoError && clearAllTokens) {
      const msg = (logtoError.message || JSON.stringify(logtoError)).toLowerCase();
      if (msg.includes('401') || msg.includes('invalid token')) {
        clearAllTokens().catch(console.error);
        localStorage.removeItem('last_auth_user');
        localStorage.removeItem('last_auth_state');
        localStorage.removeItem('last_auth_timestamp');
      }
    }
  }, [logtoError, clearAllTokens]);

  const strictAuthenticated = logtoIsAuthenticated && !logtoError;

  // Sync cache to localStorage
  useEffect(() => {
    if (!logtoIsLoading) {
      localStorage.setItem('last_auth_state', String(strictAuthenticated));
      localStorage.setItem('last_auth_timestamp', String(Date.now()));
      setOptimisticAuth(strictAuthenticated);

      if (strictAuthenticated && user) {
        localStorage.setItem('last_auth_user', JSON.stringify(user));
      } else if (!strictAuthenticated) {
        localStorage.removeItem('last_auth_user');
      }
    }
  }, [strictAuthenticated, logtoIsLoading, user]);

  const isAuthenticated = logtoIsLoading ? optimisticAuth : strictAuthenticated;

  return { user, isAuthenticated, error: logtoError, isLoading: logtoIsLoading };
}
