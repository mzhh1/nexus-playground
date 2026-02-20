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
    private lastProcessedTs: number = Date.now();
    private isPolling: boolean = false;

    constructor(state: DurableObjectState, env: Env) {
        super(state, env);
        this.setupRoutes();
        this.startHeartbeat();
    }

    private startHeartbeat(): void {
        if (this.heartbeatTimer !== null) return;
        this.heartbeatTimer = setInterval(() => {
            this.broadcast("heartbeat", { ts: Date.now() });
            this.checkAndStartPolling();
        }, 20000) as unknown as number;
    }

    private checkAndStartPolling(): void {
        if (this.subscribers.size > 0 && !this.isPolling) {
            this.isPolling = true;
            void this.pollD1();
        }
    }

    private async pollD1(): Promise<void> {
        while (this.subscribers.size > 0) {
            try {
                // Query D1 for new logs since lastProcessedTs
                const sql = `
                    SELECT * FROM player_action_logs 
                    WHERE event_ts > ? 
                    ORDER BY event_ts ASC 
                    LIMIT 20
                `;
                const result = await this.env.DB.prepare(sql).bind(this.lastProcessedTs).all<MonitorLogRecord>();

                if (result.results && result.results.length > 0) {
                    for (const record of result.results) {
                        await this.broadcastRecord(record);
                        this.lastProcessedTs = Math.max(this.lastProcessedTs, record.event_ts);
                    }
                }
            } catch (e) {
                console.error("[MonitorDO] Polling D1 failed:", e);
            }

            // Wait for a short interval before next poll
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
        this.isPolling = false;
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
            this.checkAndStartPolling();

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
