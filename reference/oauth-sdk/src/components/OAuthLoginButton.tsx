import { MouseEventHandler, useMemo } from 'react';
import { useOAuth } from './OAuthProvider';

interface OAuthLoginButtonProps {
  redirectUri: string;
  scope?: string;
  usePkce?: boolean;
  additionalParams?: Record<string, string | number | boolean>;
  label?: string;
  className?: string;
  onError?: (error: Error) => void;
}

export function OAuthLoginButton({
  redirectUri,
  scope,
  usePkce = true,
  additionalParams,
  label,
  className,
  onError,
}: OAuthLoginButtonProps) {
  const { startLogin } = useOAuth();

  const buttonLabel = useMemo(() => label || '登录', [label]);

  const handleClick: MouseEventHandler<HTMLButtonElement> = async (e) => {
    e.preventDefault();
    try {
      await startLogin({
        redirectUri,
        scope: scope || 'openid profile email',
        usePkce,
        additionalParams,
      });
    } catch (err: any) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (onError) onError(error);
      else console.error('OAuth login failed:', error);
    }
  };

  return (
    <button className={className} onClick={handleClick}>{buttonLabel}</button>
  );
}


