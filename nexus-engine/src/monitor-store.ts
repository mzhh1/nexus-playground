import type {
    InteractionStatus,
    MonitorListResponse,
    MonitorLogRecord,
    PlayerType,
} from "./types";

interface MonitorLogRow {
    interaction_id: string;
    interaction_group_id: string;
    room_id: string;
    game_id: string | null;
    game_name: string | null;
    role_id: string;
    user_id: string | null;
    player_type: PlayerType;
    model_name: string | null;
    system_prompt: string | null;
    user_prompt: string | null;
    response: string | null;
    action_id: string | null;
    action_params_json: string | null;
    status: InteractionStatus;
    attempt: number;
    outer_attempt: number;
    max_attempts: number;
    previous_error: string | null;
    error_message: string | null;
    response_time_ms: number | null;
    event_ts: number;
    created_at: string;
    updated_at: string;
}

export interface ListMonitorLogParams {
    roomId: string;
    playerType?: PlayerType;
    status?: InteractionStatus;
    roleId?: string;
    gameId?: string;
    startDate?: string;
    endDate?: string;
    limit: number;
    offset: number;
    order: "asc" | "desc";
}

export interface InsertMonitorLogInput {
    interactionId: string;
    interactionGroupId: string;
    roomId: string;
    gameId?: string | null;
    gameName?: string | null;
    roleId: string;
    userId?: string | null;
    playerType: PlayerType;
    modelName?: string | null;
    systemPrompt?: string | null;
    userPrompt?: string | null;
    response?: string | null;
    actionId?: string | null;
    actionParams?: Record<string, unknown> | null;
    status: InteractionStatus;
    attempt: number;
    outerAttempt: number;
    maxAttempts: number;
    previousError?: string | null;
    errorMessage?: string | null;
    responseTimeMs?: number | null;
    eventTs: number;
}

export interface UpdateMonitorLogInput {
    status?: InteractionStatus;
    userPrompt?: string | null;
    response?: string | null;
    actionId?: string | null;
    actionParams?: Record<string, unknown> | null;
    previousError?: string | null;
    errorMessage?: string | null;
    responseTimeMs?: number | null;
    eventTs?: number;
}

function mapRow(row: MonitorLogRow): MonitorLogRecord {
    return {
        ...row,
        attempt: Number(row.attempt),
        outer_attempt: Number(row.outer_attempt),
        max_attempts: Number(row.max_attempts),
        response_time_ms: row.response_time_ms == null ? null : Number(row.response_time_ms),
        event_ts: Number(row.event_ts),
    };
}

function parseDateToEpochMs(value: string): number | null {
    const ts = Date.parse(value);
    return Number.isNaN(ts) ? null : ts;
}

function normalizeLimit(value: string | null): number {
    const parsed = Number.parseInt(value ?? "50", 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return 50;
    return Math.min(parsed, 200);
}

function normalizeOffset(value: string | null): number {
    const parsed = Number.parseInt(value ?? "0", 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
}

export function parseListParams(searchParams: URLSearchParams): ListMonitorLogParams {
    const orderRaw = searchParams.get("order");
    const order: "asc" | "desc" = orderRaw === "asc" ? "asc" : "desc";
    const roomId = searchParams.get("roomId") ?? "";
    const playerType = searchParams.get("playerType");
    const status = searchParams.get("status");

    return {
        roomId,
        playerType: playerType === "llm" || playerType === "human" ? playerType : undefined,
        status: isStatus(status) ? status : undefined,
        roleId: searchParams.get("roleId") || undefined,
        gameId: searchParams.get("gameId") || undefined,
        startDate: searchParams.get("startDate") || undefined,
        endDate: searchParams.get("endDate") || undefined,
        limit: normalizeLimit(searchParams.get("limit")),
        offset: normalizeOffset(searchParams.get("offset")),
        order,
    };
}

function isStatus(value: string | null): value is InteractionStatus {
    return value === "pending"
        || value === "retrying"
        || value === "success"
        || value === "failed"
        || value === "rejected";
}

function buildWhereClause(params: ListMonitorLogParams): { whereSql: string; binds: unknown[] } {
    const clauses: string[] = ["room_id = ?"];
    const binds: unknown[] = [params.roomId];

    if (params.playerType) {
        clauses.push("player_type = ?");
        binds.push(params.playerType);
    }
    if (params.status) {
        clauses.push("status = ?");
        binds.push(params.status);
    }
    if (params.roleId) {
        clauses.push("role_id = ?");
        binds.push(params.roleId);
    }
    if (params.gameId) {
        clauses.push("game_id = ?");
        binds.push(params.gameId);
    }
    if (params.startDate) {
        const startTs = parseDateToEpochMs(params.startDate);
        if (startTs !== null) {
            clauses.push("event_ts >= ?");
            binds.push(startTs);
        }
    }
    if (params.endDate) {
        const endTs = parseDateToEpochMs(params.endDate);
        if (endTs !== null) {
            clauses.push("event_ts <= ?");
            binds.push(endTs);
        }
    }

    return {
        whereSql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
        binds,
    };
}

export async function listMonitorLogs(
    db: D1Database,
    params: ListMonitorLogParams,
): Promise<MonitorListResponse> {
    const { whereSql, binds } = buildWhereClause(params);
    const orderSql = params.order === "asc" ? "ASC" : "DESC";

    const countSql = `SELECT COUNT(*) AS count FROM player_action_logs ${whereSql}`;
    const countRow = await db.prepare(countSql).bind(...binds).first<{ count: number }>();
    const totalCount = Number(countRow?.count ?? 0);

    const dataSql = `
      SELECT
        interaction_id, interaction_group_id, room_id, game_id, game_name, role_id, user_id,
        player_type, model_name, system_prompt, user_prompt, response, action_id, action_params_json,
        status, attempt, outer_attempt, max_attempts, previous_error, error_message,
        response_time_ms, event_ts, created_at, updated_at
      FROM player_action_logs
      ${whereSql}
      ORDER BY event_ts ${orderSql}, interaction_id ${orderSql}
      LIMIT ? OFFSET ?
    `;
    const dataResult = await db.prepare(dataSql).bind(...binds, params.limit, params.offset).all<MonitorLogRow>();
    const rows = (dataResult.results || []).map(mapRow);

    return {
        data: rows,
        pagination: {
            limit: params.limit,
            offset: params.offset,
            count: totalCount,
            hasMore: params.offset + rows.length < totalCount,
        },
        filters: {
            roomId: params.roomId,
            playerType: params.playerType,
            status: params.status,
            gameId: params.gameId,
            roleId: params.roleId,
            startDate: params.startDate,
            endDate: params.endDate,
            order: params.order,
        },
    };
}

export async function getMonitorLogById(
    db: D1Database,
    interactionId: string,
): Promise<MonitorLogRecord | null> {
    const sql = `
      SELECT
        interaction_id, interaction_group_id, room_id, game_id, game_name, role_id, user_id,
        player_type, model_name, system_prompt, user_prompt, response, action_id, action_params_json,
        status, attempt, outer_attempt, max_attempts, previous_error, error_message,
        response_time_ms, event_ts, created_at, updated_at
      FROM player_action_logs
      WHERE interaction_id = ?
      LIMIT 1
    `;
    const row = await db.prepare(sql).bind(interactionId).first<MonitorLogRow>();
    return row ? mapRow(row) : null;
}

export async function getMonitorLogsByGroup(
    db: D1Database,
    groupId: string,
): Promise<MonitorLogRecord[]> {
    const sql = `
      SELECT
        interaction_id, interaction_group_id, room_id, game_id, game_name, role_id, user_id,
        player_type, model_name, system_prompt, user_prompt, response, action_id, action_params_json,
        status, attempt, outer_attempt, max_attempts, previous_error, error_message,
        response_time_ms, event_ts, created_at, updated_at
      FROM player_action_logs
      WHERE interaction_group_id = ?
      ORDER BY attempt ASC, event_ts ASC
    `;
    const result = await db.prepare(sql).bind(groupId).all<MonitorLogRow>();
    return (result.results || []).map(mapRow);
}

export async function insertMonitorLog(
    db: D1Database,
    input: InsertMonitorLogInput,
): Promise<MonitorLogRecord | null> {
    const sql = `
      INSERT INTO player_action_logs (
        interaction_id, interaction_group_id, room_id, game_id, game_name, role_id, user_id,
        player_type, model_name, system_prompt, user_prompt, response, action_id, action_params_json,
        status, attempt, outer_attempt, max_attempts, previous_error, error_message,
        response_time_ms, event_ts, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        datetime('now'), datetime('now')
      )
    `;

    await db.prepare(sql).bind(
        input.interactionId,
        input.interactionGroupId,
        input.roomId,
        input.gameId ?? null,
        input.gameName ?? null,
        input.roleId,
        input.userId ?? null,
        input.playerType,
        input.modelName ?? null,
        input.systemPrompt ?? null,
        input.userPrompt ?? null,
        input.response ?? null,
        input.actionId ?? null,
        input.actionParams ? JSON.stringify(input.actionParams) : null,
        input.status,
        input.attempt,
        input.outerAttempt,
        input.maxAttempts,
        input.previousError ?? null,
        input.errorMessage ?? null,
        input.responseTimeMs ?? null,
        input.eventTs,
    ).run();

    return getMonitorLogById(db, input.interactionId);
}

export async function updateMonitorLog(
    db: D1Database,
    interactionId: string,
    patch: UpdateMonitorLogInput,
): Promise<MonitorLogRecord | null> {
    const setClauses: string[] = ["updated_at = datetime('now')"];
    const binds: unknown[] = [];

    if (patch.status !== undefined) {
        setClauses.push("status = ?");
        binds.push(patch.status);
    }
    if (patch.userPrompt !== undefined) {
        setClauses.push("user_prompt = ?");
        binds.push(patch.userPrompt);
    }
    if (patch.response !== undefined) {
        setClauses.push("response = ?");
        binds.push(patch.response);
    }
    if (patch.actionId !== undefined) {
        setClauses.push("action_id = ?");
        binds.push(patch.actionId);
    }
    if (patch.actionParams !== undefined) {
        setClauses.push("action_params_json = ?");
        binds.push(patch.actionParams ? JSON.stringify(patch.actionParams) : null);
    }
    if (patch.previousError !== undefined) {
        setClauses.push("previous_error = ?");
        binds.push(patch.previousError);
    }
    if (patch.errorMessage !== undefined) {
        setClauses.push("error_message = ?");
        binds.push(patch.errorMessage);
    }
    if (patch.responseTimeMs !== undefined) {
        setClauses.push("response_time_ms = ?");
        binds.push(patch.responseTimeMs);
    }
    if (patch.eventTs !== undefined) {
        setClauses.push("event_ts = ?");
        binds.push(patch.eventTs);
    }

    if (setClauses.length > 0) {
        const sql = `UPDATE player_action_logs SET ${setClauses.join(", ")} WHERE interaction_id = ?`;
        await db.prepare(sql).bind(...binds, interactionId).run();
    }

    return getMonitorLogById(db, interactionId);
}
