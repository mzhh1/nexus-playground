/**
 * Game UI Container (iframe Sandbox)
 * Loads game UI in a sandboxed iframe and communicates via postMessage.
 *
 * Security: iframe uses sandbox="allow-scripts" WITHOUT allow-same-origin
 * or allow-top-navigation, ensuring complete isolation from the parent.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { RolePerspective, Action } from '../lib/types';
import type { SyncStateMessage, ActMessage } from '../lib/game-ui-types';

interface GameUIContainerProps {
  gameId: string;
  perspective: RolePerspective | null;
  onAction: (action: Action) => void;
  isMyTurn: boolean;
  readonly: boolean;
  metadata?: {
    roomId: string;
    roleId: string;
    playerId?: string;
  };
  uiUrl?: string; // Full URL to the game-ui.html page on the game worker
}

export const GameUIContainer: React.FC<GameUIContainerProps> = ({
  gameId,
  perspective,
  onAction,
  isMyTurn,
  readonly,
  metadata,
  uiUrl,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [iframeReady, setIframeReady] = useState(false);

  // Derive the expected origin from the uiUrl for security validation
  const expectedOrigin = useRef<string | null>(null);
  useEffect(() => {
    if (uiUrl) {
      try {
        const url = new URL(uiUrl);
        expectedOrigin.current = url.origin;
      } catch {
        expectedOrigin.current = null;
      }
    }
  }, [uiUrl]);

  // ─── Listen for messages from iframe ───────────────────
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      // Security: In sandboxed iframes without allow-same-origin,
      // event.origin is 'null' (the string "null"). We accept this
      // because the sandbox itself provides the isolation guarantee.
      // We still validate message structure.
      if (!event.data || typeof event.data !== 'object') return;

      const msg = event.data as ActMessage;

      if (msg.type === 'ACT' && msg.payload) {
        const { action_id, role_id, params } = msg.payload;

        // Validate required fields
        if (typeof action_id !== 'string' || typeof role_id !== 'string') {
          console.warn('[GameUI] Invalid ACT message from iframe:', msg);
          return;
        }

        console.log('[GameUI] Received ACT from iframe:', msg.payload);

        onAction({
          action_id,
          role_id,
          params,
        });
      } else if (msg.type === 'IFRAME_READY') {
        console.log('[GameUI] iframe reports ready');
        setIframeReady(true);
        setLoading(false);
      }
    },
    [onAction]
  );

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // ─── Send state to iframe via postMessage ──────────────
  useEffect(() => {
    if (!iframeReady || !perspective || !iframeRef.current?.contentWindow) return;

    const message: SyncStateMessage = {
      type: 'SYNC_STATE',
      payload: {
        perspective,
        isMyTurn,
        readonly,
        metadata,
      },
    };

    // Use '*' as targetOrigin because sandboxed iframes have origin 'null'
    iframeRef.current.contentWindow.postMessage(message, '*');
  }, [perspective, isMyTurn, readonly, metadata, iframeReady]);

  // ─── Handle iframe load event ──────────────────────────
  const handleIframeLoad = useCallback(() => {
    // Give the iframe a moment to initialize its message listener.
    // The iframe will send IFRAME_READY when it's fully set up.
    // As a fallback, if no IFRAME_READY after 3s, consider it loaded.
    const fallbackTimer = setTimeout(() => {
      if (!iframeReady) {
        console.log('[GameUI] iframe fallback: marking as ready after timeout');
        setIframeReady(true);
        setLoading(false);
      }
    }, 3000);

    return () => clearTimeout(fallbackTimer);
  }, [iframeReady]);

  const handleIframeError = useCallback(() => {
    setError(`Failed to load game UI for: ${gameId}`);
    setLoading(false);
  }, [gameId]);

  // ─── Render ────────────────────────────────────────────

  if (!uiUrl) {
    return (
      <div className="game-ui-container error">
        <div className="error-message">
          <h3>Game UI Not Available</h3>
          <p>No UI URL configured for game: {gameId}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="game-ui-container error">
        <div className="error-message">
          <h3>Failed to Load Game UI</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!perspective) {
    return (
      <div className="game-ui-container waiting">
        <p>Waiting for game perspective...</p>
      </div>
    );
  }

  return (
    <div className="game-ui-container" style={{ width: '100%', height: '100%', position: 'relative' }}>
      {loading && (
        <div className="game-ui-container loading" style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1,
        }}>
          <div className="spinner"></div>
          <p>Loading game UI...</p>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={uiUrl}
        sandbox="allow-scripts"
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
        title={`Game UI: ${gameId}`}
      />
    </div>
  );
};
