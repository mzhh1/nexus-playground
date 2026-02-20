import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";
import type { Env, MonitorLogRecord, MonitorStreamEvent } from "./types";

interface StreamFilter {
    roomId: string;
    playerType?: "llm" | "human";
    status?: "pending" | "retrying" | "success" | "failed" | "rejected";
    roleId?: string;
    gameId?: string;
    startTs?: number;
    endTs?: number;
}

interface Subscriber {
    id: string;
    filter: StreamFilter;
    writer: WritableStreamDefaultWriter<Uint8Array>;
}

const encoder = new TextEncoder();

function parseDateToEpochMs(value: string | null | undefined): number | undefined {
    if (!value) return undefined;
    const ts = Date.parse(value);
    return Number.isNaN(ts) ? undefined : ts;
}

function encodeSse(event: string, data: unknown, id?: string): Uint8Array {
    const lines: string[] = [];
    if (id) lines.push(`id: ${id}`);
    lines.push(`event: ${event}`);
    lines.push(`data: ${JSON.stringify(data)}`);
    lines.push("");
    return encoder.encode(`${lines.join("\n")}\n`);
}

function matchesFilter(record: MonitorLogRecord, filter: StreamFilter): boolean {
    if (record.room_id !== filter.roomId) return false;
    if (filter.playerType && record.player_type !== filter.playerType) return false;
    if (filter.status && record.status !== filter.status) return false;
    if (filter.roleId && record.role_id !== filter.roleId) return false;
    if (filter.gameId && record.game_id !== filter.gameId) return false;
    if (filter.startTs !== undefined && record.event_ts < filter.startTs) return false;
    if (filter.endTs !== undefined && record.event_ts > filter.endTs) return false;
    return true;
}

export class MonitorDO extends DurableObject {
    private app: Hono = new Hono();
    private subscribers = new Map<string, Subscriber>();
    private heartbeatTimer: number | null = null;

    constructor(state: DurableObjectState, env: Env) {
        super(state, env);
        this.setupRoutes();
        this.startHeartbeat();
    }

    private startHeartbeat(): void {
        if (this.heartbeatTimer !== null) return;
        this.heartbeatTimer = setInterval(() => {
            this.broadcast("heartbeat", { ts: Date.now() });
        }, 20000) as unknown as number;
    }

    private setupRoutes(): void {
        this.app.get("/stream", async (c) => {
            const roomId = c.req.query("roomId");
            if (!roomId) return c.json({ error: "roomId is required" }, 400);

            const stream = new TransformStream<Uint8Array, Uint8Array>();
            const writer = stream.writable.getWriter();
            const subscriberId = crypto.randomUUID();
            const filter: StreamFilter = {
                roomId,
                playerType: c.req.query("playerType") as StreamFilter["playerType"] | undefined,
                status: c.req.query("status") as StreamFilter["status"] | undefined,
                roleId: c.req.query("roleId") || undefined,
                gameId: c.req.query("gameId") || undefined,
                startTs: parseDateToEpochMs(c.req.query("startDate")),
                endTs: parseDateToEpochMs(c.req.query("endDate")),
            };

            this.subscribers.set(subscriberId, { id: subscriberId, filter, writer });
            await writer.write(encodeSse("ready", { connected: true }));
            const lastEventId = c.req.header("last-event-id") || "";
            await writer.write(encodeSse("replay_end", { lastEventId }));

            const cleanup = async () => {
                const sub = this.subscribers.get(subscriberId);
                if (!sub) return;
                this.subscribers.delete(subscriberId);
                try {
                    await sub.writer.close();
                } catch (_) {
                    // ignore close errors
                }
            };
            c.req.raw.signal.addEventListener("abort", () => {
                void cleanup();
            }, { once: true });

            return new Response(stream.readable, {
                headers: {
                    "Content-Type": "text/event-stream; charset=utf-8",
                    "Cache-Control": "no-cache, no-transform",
                    Connection: "keep-alive",
                },
            });
        });

        this.app.post("/publish", async (c) => {
            const body = await c.req.json<MonitorStreamEvent>();
            if (!body || body.kind !== "upsert" || !body.data) {
                return c.json({ error: "Invalid publish payload" }, 400);
            }
            await this.broadcastRecord(body.data);
            return c.json({ ok: true });
        });
    }

    private async broadcast(event: string, payload: unknown): Promise<void> {
        const deadIds: string[] = [];
        const chunk = encodeSse(event, payload);

        for (const [id, subscriber] of this.subscribers.entries()) {
            try {
                await subscriber.writer.write(chunk);
            } catch (_) {
                deadIds.push(id);
            }
        }

        for (const id of deadIds) {
            const dead = this.subscribers.get(id);
            this.subscribers.delete(id);
            try {
                await dead?.writer.close();
            } catch (_) {
                // ignore
            }
        }
    }

    private async broadcastRecord(record: MonitorLogRecord): Promise<void> {
        const deadIds: string[] = [];
        for (const [id, subscriber] of this.subscribers.entries()) {
            if (!matchesFilter(record, subscriber.filter)) continue;
            try {
                await subscriber.writer.write(
                    encodeSse("log", { kind: "upsert", data: record }, record.interaction_id),
                );
            } catch (_) {
                deadIds.push(id);
            }
        }

        for (const id of deadIds) {
            const dead = this.subscribers.get(id);
            this.subscribers.delete(id);
            try {
                await dead?.writer.close();
            } catch (_) {
                // ignore
            }
        }
    }

    async fetch(request: Request): Promise<Response> {
        return this.app.fetch(request);
    }
}
