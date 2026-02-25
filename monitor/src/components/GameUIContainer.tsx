import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Game UI Container for Monitor
 * Based on frontend/src/components/GameUIContainer.tsx
 */

interface GameUIContainerProps {
    gameId: string;
    perspective: any;
    onAction: (action: any) => void;
    isMyTurn: boolean;
    readonly: boolean;
    metadata?: {
        roomId: string;
        roleId: string;
        playerId?: string;
        roleDisplayMapping?: Record<string, { name: string }>;
    };
    uiUrl?: string;
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
    // const expectedOrigin = useRef<string | null>(null);
    // useEffect(() => {
    //   if (uiUrl) {
    //     try {
    //       const url = new URL(uiUrl);
    //       expectedOrigin.current = url.origin;
    //     } catch {
    //       expectedOrigin.current = null;
    //     }
    //   }
    // }, [uiUrl]);

    // Listen for messages from iframe
    const handleMessage = useCallback(
        (event: MessageEvent) => {
            // In sandboxed iframes without allow-same-origin, event.origin is 'null'
            if (!event.data || typeof event.data !== 'object') return;

            const msg = event.data;

            if (msg.type === 'ACT' && msg.payload) {
                const { action_id, role_id, params } = msg.payload;

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

    // Send state to iframe via postMessage
    useEffect(() => {
        if (!iframeReady || !perspective || !iframeRef.current?.contentWindow) return;

        const message = {
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

    const handleIframeLoad = useCallback(() => {
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

    return (
        <div className="game-ui-container" style={{ width: '100%', height: '100%', position: 'relative', background: '#f8fafc' }}>
            {loading && (
                <div className="game-ui-container loading" style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1,
                    background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(4px)'
                }}>
                    <div className="spinner"></div>
                    <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading game UI...</p>
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
