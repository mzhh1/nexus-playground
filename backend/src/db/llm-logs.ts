import { FastifyInstance } from 'fastify';
import logger from '../utils/logger.js';

export type LLMInteractionStatus =
  | 'pending'
  | 'retrying'
  | 'success'
  | 'failed'
  | 'rejected';

export interface LLMInteractionRow {
  interaction_id: string;
  interaction_group_id: string;
  room_id: string;
  game_id: string | null;
  role_id: string;
  model_name: string;
  system_prompt: string;
  user_prompt: string;
  response: string | null;
  status: LLMInteractionStatus;
  attempt: number;
  outer_attempt: number;
  max_attempts: number;
  previous_error: string | null;
  error_message: string | null;
  response_time_ms: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateLLMInteractionInput {
  interactionGroupId: string;
  roomId: string;
  gameId: string | null;
  roleId: string;
  modelName: string;
  systemPrompt: string;
  userPrompt: string;
  attempt: number;
  outerAttempt: number;
  maxAttempts: number;
  status?: LLMInteractionStatus;
  previousError?: string | null;
  response?: string | null;
  errorMessage?: string | null;
  responseTimeMs?: number | null;
}

export interface UpdateLLMInteractionInput {
  status?: LLMInteractionStatus;
  response?: string | null;
  errorMessage?: string | null;
  responseTimeMs?: number | null;
  attempt?: number;
  outerAttempt?: number;
  maxAttempts?: number;
  previousError?: string | null;
}

export interface ListLLMInteractionsOptions {
  limit?: number;
  offset?: number;
  status?: LLMInteractionStatus;
  roomId?: string;
  gameId?: string;
  roleId?: string;
  interactionGroupId?: string;
  order?: 'asc' | 'desc';
}

export class LLMLogDAO {
  constructor(private fastify: FastifyInstance) {}

  async createInteraction(
    input: CreateLLMInteractionInput
  ): Promise<LLMInteractionRow> {
    const {
      interactionGroupId,
      roomId,
      gameId,
      roleId,
      modelName,
      systemPrompt,
      userPrompt,
      attempt,
      outerAttempt,
      maxAttempts,
      status = 'pending',
      previousError = null,
      response = null,
      errorMessage = null,
      responseTimeMs = null,
    } = input;

    try {
      const result = await this.fastify.pg.query<LLMInteractionRow>(
        `INSERT INTO llm_interactions (
            interaction_group_id,
            room_id,
            game_id,
            role_id,
            model_name,
            system_prompt,
            user_prompt,
            response,
            status,
            attempt,
            outer_attempt,
            max_attempts,
            previous_error,
            error_message,
            response_time_ms
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        RETURNING *`,
        [
          interactionGroupId,
          roomId,
          gameId,
          roleId,
          modelName,
          systemPrompt,
          userPrompt,
          response,
          status,
          attempt,
          outerAttempt,
          maxAttempts,
          previousError,
          errorMessage,
          responseTimeMs,
        ]
      );

      const row = result.rows[0];
      logger.debug(
        { interactionId: row.interaction_id, roomId, roleId, attempt },
        'Created LLM interaction log entry'
      );
      return row;
    } catch (error) {
      logger.error(
        {
          error,
          interactionGroupId,
          roomId,
          roleId,
          attempt,
        },
        'Failed to create LLM interaction log entry'
      );
      throw error;
    }
  }

  async updateInteraction(
    interactionId: string,
    updates: UpdateLLMInteractionInput
  ): Promise<void> {
    const fields: string[] = [];
    const values: Array<string | number | null> = [];

    const pushField = (field: string, value: string | number | null) => {
      fields.push(`${field} = $${fields.length + 1}`);
      values.push(value);
    };

    if (updates.status !== undefined) {
      pushField('status', updates.status);
    }
    if (updates.response !== undefined) {
      pushField('response', updates.response);
    }
    if (updates.errorMessage !== undefined) {
      pushField('error_message', updates.errorMessage);
    }
    if (updates.responseTimeMs !== undefined) {
      pushField('response_time_ms', updates.responseTimeMs);
    }
    if (updates.attempt !== undefined) {
      pushField('attempt', updates.attempt);
    }
    if (updates.maxAttempts !== undefined) {
      pushField('max_attempts', updates.maxAttempts);
    }
    if (updates.outerAttempt !== undefined) {
      pushField('outer_attempt', updates.outerAttempt);
    }
    if (updates.previousError !== undefined) {
      pushField('previous_error', updates.previousError);
    }

    if (fields.length === 0) {
      logger.warn(
        { interactionId },
        'updateInteraction called with no fields to update'
      );
      return;
    }

    try {
      await this.fastify.pg.query(
        `UPDATE llm_interactions
         SET ${fields.join(', ')}
         WHERE interaction_id = $${fields.length + 1}`,
        [...values, interactionId]
      );
    } catch (error) {
      logger.error(
        { error, interactionId, updates },
        'Failed to update LLM interaction log entry'
      );
      throw error;
    }
  }

  async getInteractionById(interactionId: string): Promise<LLMInteractionRow | null> {
    try {
      const result = await this.fastify.pg.query<LLMInteractionRow>(
        'SELECT * FROM llm_interactions WHERE interaction_id = $1',
        [interactionId]
      );
      return result.rows[0] ?? null;
    } catch (error) {
      logger.error(
        { error, interactionId },
        'Failed to fetch LLM interaction log entry by ID'
      );
      throw error;
    }
  }

  async listInteractions(
    options: ListLLMInteractionsOptions = {}
  ): Promise<LLMInteractionRow[]> {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    const order = options.order ?? 'desc';

    if (!Number.isInteger(limit) || limit <= 0 || limit > 500) {
      throw new Error('Invalid limit for listing LLM interactions');
    }
    if (!Number.isInteger(offset) || offset < 0) {
      throw new Error('Invalid offset for listing LLM interactions');
    }

    const clauses: string[] = [];
    const values: Array<string | number> = [];

    if (options.status) {
      clauses.push(`status = $${values.length + 1}`);
      values.push(options.status);
    }
    if (options.roomId) {
      clauses.push(`room_id = $${values.length + 1}`);
      values.push(options.roomId);
    }
    if (options.gameId) {
      clauses.push(`game_id = $${values.length + 1}`);
      values.push(options.gameId);
    }
    if (options.roleId) {
      clauses.push(`role_id = $${values.length + 1}`);
      values.push(options.roleId);
    }
    if (options.interactionGroupId) {
      clauses.push(`interaction_group_id = $${values.length + 1}`);
      values.push(options.interactionGroupId);
    }

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

    try {
      const result = await this.fastify.pg.query<LLMInteractionRow>(
        `SELECT *
         FROM llm_interactions
         ${whereClause}
         ORDER BY created_at ${order === 'asc' ? 'ASC' : 'DESC'}, attempt ${order === 'asc' ? 'ASC' : 'DESC'}
         LIMIT $${values.length + 1}
         OFFSET $${values.length + 2}`,
        [...values, limit, offset]
      );
      return result.rows;
    } catch (error) {
      logger.error(
        { error, options },
        'Failed to list LLM interaction logs'
      );
      throw error;
    }
  }
}

export function createLLMLogDAO(fastify: FastifyInstance): LLMLogDAO {
  return new LLMLogDAO(fastify);
}

