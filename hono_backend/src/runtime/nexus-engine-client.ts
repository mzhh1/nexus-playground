import { SignJWT } from 'jose';
import type { Env } from '../config.js';

interface CreateRoomParams {
  roomId: string;
  ownerId: string;
  ownerDisplayName?: string;
  gameWorkerUrl?: string;
  config?: unknown;
  context?: unknown;
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

  constructor(private env: Env) {
    this.jwtSecret = new TextEncoder().encode(env.NEXUS_ENGINE_JWT_SECRET);
  }

  async createRoom(params: CreateRoomParams): Promise<CreateRoomResponse> {
    const endpoint = `${this.env.NEXUS_ENGINE_URL.replace(/\/$/, '')}/api/engine/create`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.env.NEXUS_ENGINE_ADMIN_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Nexus Engine create room failed: ${response.status} ${errorText}`);
    }

    return response.json<CreateRoomResponse>();
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
    return `${toWsUrl(this.env.NEXUS_ENGINE_URL.replace(/\/$/, ''))}/connect/${roomId}`;
  }
}

export function createNexusEngineClient(env: Env): NexusEngineClient {
  return new NexusEngineClient(env);
}
