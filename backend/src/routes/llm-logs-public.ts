import { FastifyPluginAsync } from 'fastify';
import {
  createLLMLogDAO,
  LLMInteractionRow,
  LLMInteractionStatus,
} from '../db/llm-logs.js';
import { getAllGamesMetadata } from '../games/registry.js';
import logger from '../utils/logger.js';

const allowedStatuses: LLMInteractionStatus[] = [
  'pending',
  'retrying',
  'success',
  'failed',
  'rejected',
];

const gameNameMap = new Map<string, string>();
for (const metadata of getAllGamesMetadata()) {
  gameNameMap.set(metadata.id, metadata.name);
}

type ListQuerystring = {
  status?: string;
  limit?: string;
  offset?: string;
  order?: 'asc' | 'desc';
  roomId?: string;
  gameId?: string;
  roleId?: string;
  interactionGroupId?: string;
};

type GroupParams = {
  groupId: string;
};

type DetailParams = {
  interactionId: string;
};

function normalizeTimestamp(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function decorateInteraction(row: LLMInteractionRow) {
  return {
    interaction_id: row.interaction_id,
    interaction_group_id: row.interaction_group_id,
    room_id: row.room_id,
    game_id: row.game_id,
    game_name: row.game_id ? gameNameMap.get(row.game_id) ?? row.game_id : null,
    role_id: row.role_id,
    model_name: row.model_name,
    system_prompt: row.system_prompt,
    user_prompt: row.user_prompt,
    response: row.response,
    status: row.status,
    attempt: row.attempt,
    outer_attempt: row.outer_attempt,
    max_attempts: row.max_attempts,
    previous_error: row.previous_error,
    error_message: row.error_message,
    response_time_ms: row.response_time_ms,
    created_at: normalizeTimestamp(row.created_at),
    updated_at: normalizeTimestamp(row.updated_at),
  };
}

const llmLogsPublicRoutes: FastifyPluginAsync = async (fastify) => {
  const llmLogDAO = createLLMLogDAO(fastify);

  fastify.get<{ Querystring: ListQuerystring }>('/llm-logs', async (request, reply) => {
    try {
      const {
        status,
        limit = '50',
        offset = '0',
        order = 'desc',
        roomId,
        gameId,
        roleId,
        interactionGroupId,
      } = request.query;

      let normalizedStatus: LLMInteractionStatus | undefined;
      if (status) {
        if (!allowedStatuses.includes(status as LLMInteractionStatus)) {
          return reply.code(400).send({ error: 'Invalid status filter' });
        }
        normalizedStatus = status as LLMInteractionStatus;
      }

      const parsedLimit = Number.parseInt(limit, 10);
      const parsedOffset = Number.parseInt(offset, 10);

      if (Number.isNaN(parsedLimit) || parsedLimit <= 0) {
        return reply.code(400).send({ error: 'Invalid limit parameter' });
      }

      if (Number.isNaN(parsedOffset) || parsedOffset < 0) {
        return reply.code(400).send({ error: 'Invalid offset parameter' });
      }

      const normalizedLimit = Math.min(parsedLimit, 200);
      const normalizedOffset = parsedOffset;
      const normalizedOrder = order === 'asc' ? 'asc' : 'desc';

      const interactions = await llmLogDAO.listInteractions({
        limit: normalizedLimit,
        offset: normalizedOffset,
        status: normalizedStatus,
        roomId,
        gameId,
        roleId,
        interactionGroupId,
        order: normalizedOrder,
      });

      const data = interactions.map(decorateInteraction);

      return reply.send({
        data,
        pagination: {
          limit: normalizedLimit,
          offset: normalizedOffset,
          count: data.length,
          hasMore: data.length === normalizedLimit,
        },
        filters: {
          status: normalizedStatus,
          roomId,
          gameId,
          roleId,
          interactionGroupId,
          order: normalizedOrder,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to list LLM interaction logs');
      return reply.code(500).send({ error: 'Failed to list LLM interaction logs' });
    }
  });

  fastify.get<{ Params: GroupParams }>('/llm-logs/groups/:groupId', async (request, reply) => {
    const { groupId } = request.params;

    if (!groupId) {
      return reply.code(400).send({ error: 'interactionGroupId is required' });
    }

    try {
      const interactions = await llmLogDAO.listInteractions({
        interactionGroupId: groupId,
        order: 'asc',
        limit: 200,
      });

      return reply.send({
        interaction_group_id: groupId,
        data: interactions.map(decorateInteraction),
      });
    } catch (error) {
      logger.error({ error, groupId }, 'Failed to fetch LLM interaction group');
      return reply.code(500).send({ error: 'Failed to fetch LLM interaction group' });
    }
  });

  fastify.get<{ Params: DetailParams }>('/llm-logs/:interactionId', async (request, reply) => {
    const { interactionId } = request.params;

    try {
      const interaction = await llmLogDAO.getInteractionById(interactionId);

      if (!interaction) {
        return reply.code(404).send({ error: 'Interaction not found' });
      }

      return reply.send({ data: decorateInteraction(interaction) });
    } catch (error) {
      logger.error({ error, interactionId }, 'Failed to fetch LLM interaction by id');
      return reply.code(500).send({ error: 'Failed to fetch LLM interaction' });
    }
  });
};

export default llmLogsPublicRoutes;

