/**
 * useNexusEngine Hook — v4.0 Heavy Engine
 *
 * THE single hook for all room interactions. Manages WebSocket
 * connection to Engine DO, receives SYNC_STATE updates, and
 * exposes Admin + Lobby + Game action methods.
 *
 * Replaces: useRoom (partially), usePerspective (entirely)
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useGameAPI } from '../lib/api-client';

// ─── Types matching Engine's ClientEngineState ───────────────

export interface ClientPlayerInfo {
    displayName: string;
    connected: boolean;
    isOwner: boolean;
    type: 'human' | 'llm';
    role: string | null;
    modelName?: string;
}

export interface ClientEngineState {
    roomId: string;
    ownerId: string;
    ownerDisplayName: string;
    phase: 'lobby' | 'playing' | 'paused' | 'finished';
    players: Record<string, ClientPlayerInfo>;
    gameConfig: {
        gameId: string;
        maxPlayers: number;
        roleIds: string[];
        auto_save_mode?: 'enabled' | 'disabled';
    } | null;
    stateHistory: {
        index: number;
        name: string;
        timestamp: number;
    }[];
    you: {
        userId: string;
        isOwner: boolean;
        role: string | null;
        isAuthorized: boolean;
    };
}

// ─── Hook ────────────────────────────────────────────────────

interface UseNexusEngineProps {
    roomId: string | null;
    onJoinRequest?: (userId: string, displayName: string) => void;
}

export function useNexusEngine({ roomId, onJoinRequest }: UseNexusEngineProps) {
    // Unified state (from SYNC_STATE)
    const [engineState, setEngineState] = useState<ClientEngineState | null>(null);
    const lastEngineStateRef = useRef<ClientEngineState | null>(null);
    const [gameState, setGameState] = useState<any>(null);
    const lastGameStateRef = useRef<any>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [actionThrottled, setActionThrottled] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectAttemptRef = useRef(0);
    const isConnectingRef = useRef(false);
    const actionThrottleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onJoinRequestRef = useRef(onJoinRequest);
    const gameApi = useGameAPI();

    // Update refs when state changes to preserve them during disconnects
    useEffect(() => {
        if (engineState) lastEngineStateRef.current = engineState;
    }, [engineState]);
    useEffect(() => {
        if (gameState) lastGameStateRef.current = gameState;
    }, [gameState]);

    // ─── Connect to Engine ────────────────────────────────

    const connectToEngine = useCallback(async () => {
        if (!roomId || isConnectingRef.current) return;
        if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
            return;
        }

        isConnectingRef.current = true;
        setIsConnecting(true);
        setIsRetrying(reconnectAttemptRef.current > 0);

        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }

        try {
            const connectionInfo = await gameApi.getEngineConnection(roomId);

            const { url, token } = connectionInfo;
            const wsUrl = new URL(url);
            wsUrl.searchParams.set('token', token);

            const ws = new WebSocket(wsUrl.toString());
            wsRef.current = ws;

            ws.onopen = () => {
                if (wsRef.current !== ws) {
                    ws.close(1000, 'stale connection');
                    return;
                }

                console.log("[NexusEngine] Connected");
                isConnectingRef.current = false;
                setIsConnecting(false);
                reconnectAttemptRef.current = 0;
                setIsConnected(true);
                setIsRetrying(false);
                setError(null);
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    switch (msg.type) {
                        case 'SYNC_STATE':
                            setEngineState(msg.payload.engine);
                            setGameState(msg.payload.game);
                            break;
                        case 'JOIN_REQUEST_INTERNAL':
                            if (onJoinRequestRef.current) {
                                onJoinRequestRef.current(msg.payload.userId, msg.payload.displayName);
                            }
                            break;
                        case 'KICKED':
                            setError(msg.payload || "You were removed by the room owner");
                            ws.close(1000, 'kicked');
                            break;
                        case 'ERROR':
                            console.error("[NexusEngine] Error:", msg.payload);
                            setError(msg.payload);
                            // Clear error after 5s for transient errors
                            setTimeout(() => setError(null), 5000);
                            break;
                        default:
                            console.log("[NexusEngine] Unknown message:", msg);
                    }
                } catch (e) {
                    console.error("[NexusEngine] Failed to parse message", e);
                }
            };

            ws.onclose = (event) => {
                console.log("[NexusEngine] Disconnected", event.code, event.reason);
                if (wsRef.current === ws) {
                    wsRef.current = null;
                }
                isConnectingRef.current = false;
                setIsConnecting(false);
                setIsConnected(false);

                const NON_RETRYABLE_CLOSE_CODES = new Set([1000, 1008]);
                if (!NON_RETRYABLE_CLOSE_CODES.has(event.code)) {
                    scheduleReconnect(`close code ${event.code}`);
                }
            };

            ws.onerror = (event) => {
                console.error("[NexusEngine] WebSocket error", event);
            };
        } catch (e: any) {
            console.error("[NexusEngine] Connection failed", e);
            isConnectingRef.current = false;
            setIsConnecting(false);
            setIsConnected(false);
            setError(e.message || "Connection failed");
            scheduleReconnect('connection setup failed');
        }
    }, [roomId, gameApi]);

    const scheduleReconnect = useCallback((reason: string) => {
        if (reconnectTimerRef.current || isConnectingRef.current) return;

        reconnectAttemptRef.current += 1;

        // Only show persistent error after the 2nd attempt fails (allow 1 auto-retry)
        if (reconnectAttemptRef.current > 1) {
            setIsRetrying(false);
            // Error is already set by catch/close logic
        } else {
            setIsRetrying(true);
            setError(null); // Clear error on first auto-retry attempt to keep UI clean
        }

        const getReconnectDelayMs = (attempt: number) => {
            const baseDelayMs = 1000;
            const maxDelayMs = 15000;
            const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * (2 ** Math.min(attempt - 1, 4)));
            const jitterMs = Math.floor(Math.random() * 300);
            return exponentialDelay + jitterMs;
        };

        const delayMs = getReconnectDelayMs(reconnectAttemptRef.current);
        console.warn(`[NexusEngine] Scheduling reconnect #${reconnectAttemptRef.current} in ${delayMs}ms (${reason})`);

        reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            void connectToEngine();
        }, delayMs);
    }, [connectToEngine]);

    // Sync ref
    useEffect(() => {
        onJoinRequestRef.current = onJoinRequest;
    }, [onJoinRequest]);

    // ─── Initial Connect & Cleanup ────────────────────────────────

    useEffect(() => {
        if (!roomId) return;

        void connectToEngine();

        return () => {
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
            reconnectAttemptRef.current = 0;
            isConnectingRef.current = false;
            if (actionThrottleTimerRef.current) {
                clearTimeout(actionThrottleTimerRef.current);
                actionThrottleTimerRef.current = null;
            }
            if (wsRef.current) {
                wsRef.current.close(1000, 'cleanup');
                wsRef.current = null;
            }
        };
    }, [roomId, connectToEngine]);

    // ─── Manual Reconnect ────────────────────────────────

    const retry = useCallback(() => {
        reconnectAttemptRef.current = 0;
        setError(null);
        void connectToEngine();
    }, [connectToEngine]);

    // ─── Helper: send WS message ─────────────────────────

    const send = useCallback((type: string, payload?: any) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(payload !== undefined ? { type, payload } : { type }));
        } else {
            console.error("[NexusEngine] WebSocket not connected");
        }
    }, []);

    // ─── Lobby Actions ───────────────────────────────────

    const selectRole = useCallback((roleId: string | null) => {
        send('LOBBY_SELECT_ROLE', { roleId });
    }, [send]);

    const leaveRoom = useCallback(() => {
        send('LOBBY_LEAVE');
    }, [send]);

    const requestJoin = useCallback((displayName: string) => {
        send('LOBBY_JOIN_REQUEST', { displayName });
    }, [send]);

    // ─── Admin Actions (owner only) ──────────────────────

    const setGame = useCallback((gameId: string, gameWorkerUrl: string, selectedPlayerCount?: number) => {
        send('ADMIN_SET_GAME', { gameId, gameWorkerUrl, selectedPlayerCount });
    }, [send]);

    const addBot = useCallback((config: {
        display_name: string;
        model_name: string;
        system_prompt?: string;
        temperature?: number;
    }) => {
        // Map to Engine's expected camelCase if necessary, 
        // but the Engine DO currently expects exactly what it gets.
        // Let's keep it consistent with the protocol defined in game-do.ts
        send('ADMIN_ADD_BOT', {
            displayName: config.display_name,
            modelName: config.model_name,
            systemPrompt: config.system_prompt,
            temperature: config.temperature
        });
    }, [send]);

    const removePlayer = useCallback((userId: string) => {
        send('ADMIN_REMOVE_PLAYER', { userId });
    }, [send]);

    const assignRole = useCallback((roleId: string, userId: string) => {
        send('ADMIN_ASSIGN_ROLE', { roleId, userId });
    }, [send]);

    const approveJoin = useCallback((userId: string, displayName: string) => {
        send('ADMIN_APPROVE_JOIN', { userId, displayName });
    }, [send]);

    const startGame = useCallback(() => {
        send('ADMIN_START_GAME');
    }, [send]);

    const stopGame = useCallback(() => {
        send('ADMIN_STOP_GAME');
    }, [send]);

    const restartGame = useCallback(() => {
        send('ADMIN_RESTART_GAME');
    }, [send]);

    const pauseGame = useCallback(() => {
        send('ADMIN_PAUSE_GAME');
    }, [send]);

    const resumeGame = useCallback(() => {
        send('ADMIN_RESUME_GAME');
    }, [send]);

    const backtrackState = useCallback((index: number) => {
        send('ADMIN_BACKTRACK_STATE', { index });
    }, [send]);

    // ─── Game Actions ────────────────────────────────────

    const sendAction = useCallback((action_id: string, params?: Record<string, any>, throttle?: boolean) => {
        if (throttle && actionThrottleTimerRef.current) {
            console.log("[NexusEngine] Action throttled, ignoring duplicate submission");
            return;
        }
        send('ACT', { action_id, params });
        if (throttle) {
            setActionThrottled(true);
            actionThrottleTimerRef.current = setTimeout(() => {
                actionThrottleTimerRef.current = null;
                setActionThrottled(false);
            }, 300);
        }
    }, [send]);

    // ─── Return ──────────────────────────────────────────

    return {
        // Connection
        isConnected,
        isConnecting,
        isRetrying,
        error,
        retry,
        actionThrottled,

        // Unified state (from SYNC_STATE)
        engineState: engineState || lastEngineStateRef.current,
        gameState: gameState || lastGameStateRef.current,

        // Convenience derived state
        phase: (engineState || lastEngineStateRef.current)?.phase ?? null,
        ownerId: (engineState || lastEngineStateRef.current)?.ownerId ?? null,
        ownerDisplayName: (engineState || lastEngineStateRef.current)?.ownerDisplayName ?? null,
        isOwner: (engineState || lastEngineStateRef.current)?.you.isOwner ?? false,
        myRole: (engineState || lastEngineStateRef.current)?.you.role ?? null,
        myUserId: (engineState || lastEngineStateRef.current)?.you.userId ?? null,

        // Lobby actions
        selectRole,
        leaveRoom,
        requestJoin,

        // Admin actions (owner only)
        setGame,
        addBot,
        removePlayer,
        assignRole,
        approveJoin,
        startGame,
        stopGame,
        restartGame,
        pauseGame,
        resumeGame,
        backtrackState,

        // Game actions
        sendAction,
    };
}
