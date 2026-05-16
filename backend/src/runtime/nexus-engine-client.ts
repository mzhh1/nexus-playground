import { SignJWT } from 'jose';
import type { ParsedConfig } from '../config/env';

interface CreateRoomParams {
  roomId: string;
  ownerId: string;
  ownerDisplayName?: string;
  roomMetaHookUrl?: string;
}

interface CreateRoomResponse {
  roomId: string;
  connectUrl: string;
}

function toWsUrl(httpUrl: string): string {
  const url = new URL(httpUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.origin;
}

export class NexusEngineClient {
  private jwtSecret: Uint8Array;

  constructor(private config: ParsedConfig) {
    if (!config.nexusEngineUrl) {
      throw new Error('NexusEngineClient 缺少必填配置: NEXUS_ENGINE_URL');
    }
    if (!config.nexusEngineAdminSecret) {
      throw new Error('NexusEngineClient 缺少必填配置: NEXUS_ENGINE_ADMIN_SECRET');
    }
    if (!config.nexusEngineJwtSecret) {
      throw new Error('NexusEngineClient 缺少必填配置: NEXUS_ENGINE_JWT_SECRET');
    }
    this.jwtSecret = new TextEncoder().encode(config.nexusEngineJwtSecret);
  }

  async createRoom(params: CreateRoomParams): Promise<CreateRoomResponse> {
    const endpoint = `${this.config.nexusEngineUrl!.replace(/\/$/, '')}/api/engine/create`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.nexusEngineAdminSecret!}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Nexus Engine create room failed: ${response.status} ${errorText}`);
    }

    return response.json() as Promise<CreateRoomResponse>;
  }

  async generateToken(roomId: string, userId: string, displayName: string): Promise<string> {
    return new SignJWT({ roomId, name: displayName })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(this.jwtSecret);
  }

  getConnectUrl(roomId: string): string {
    return `${toWsUrl(this.config.nexusEngineUrl!.replace(/\/$/, ''))}/connect/${roomId}`;
  }
}
