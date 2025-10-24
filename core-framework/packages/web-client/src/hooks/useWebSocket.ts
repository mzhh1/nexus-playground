/**
 * useWebSocket - WebSocket连接Hook
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { WebSocketClient } from '../services';

export interface UseWebSocketOptions {
  url: string;
  token?: string;
  autoConnect?: boolean;
  reconnect?: boolean;
  reconnectDelay?: number;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const clientRef = useRef<WebSocketClient | null>(null);

  useEffect(() => {
    if (!options.autoConnect) {
      return;
    }

    const client = new WebSocketClient({
      url: options.url,
      token: options.token,
      reconnect: options.reconnect ?? true,
      reconnectDelay: options.reconnectDelay ?? 3000,
    });

    client.on('connect', () => {
      setIsConnected(true);
      setError(null);
    });

    client.on('disconnect', () => {
      setIsConnected(false);
    });

    client.on('error', (err) => {
      setError(err);
    });

    client.connect();
    clientRef.current = client;

    return () => {
      client.disconnect();
    };
  }, [options.url, options.token, options.autoConnect, options.reconnect, options.reconnectDelay]);

  const connect = useCallback(() => {
    if (!clientRef.current) {
      const client = new WebSocketClient({
        url: options.url,
        token: options.token,
        reconnect: options.reconnect ?? true,
        reconnectDelay: options.reconnectDelay ?? 3000,
      });

      client.on('connect', () => {
        setIsConnected(true);
        setError(null);
      });

      client.on('disconnect', () => {
        setIsConnected(false);
      });

      client.on('error', (err) => {
        setError(err);
      });

      client.connect();
      clientRef.current = client;
    } else {
      clientRef.current.connect();
    }
  }, [options.url, options.token, options.reconnect, options.reconnectDelay]);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  const emit = useCallback((event: string, data: any) => {
    if (!clientRef.current) {
      throw new Error('WebSocket client not initialized');
    }
    clientRef.current.emit(event, data);
  }, []);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    if (!clientRef.current) {
      throw new Error('WebSocket client not initialized');
    }
    return clientRef.current.on(event, handler);
  }, []);

  return {
    isConnected,
    error,
    connect,
    disconnect,
    emit,
    on,
    client: clientRef.current,
  };
}

