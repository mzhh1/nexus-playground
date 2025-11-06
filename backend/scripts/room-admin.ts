import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (parent directory of backend/)
config({ path: resolve(__dirname, '../../.env') });

// Override host settings for local script execution
// (Docker containers use service names, local scripts use localhost)
process.env.POSTGRES_HOST = process.env.POSTGRES_HOST_LOCAL || 'localhost';
process.env.REDIS_HOST = process.env.REDIS_HOST_LOCAL || 'localhost';

import Fastify from 'fastify';
import { stdin as input, stdout as output } from 'node:process';
import readline from 'node:readline/promises';

import postgresPlugin from '../src/plugins/postgres';
import redisPlugin from '../src/plugins/redis';
import { createRoomDAO } from '../src/db/rooms';
import { createStateManager } from '../src/runtime/state-manager';
import type { Room } from '../src/db/rooms';
import type { RoomState } from '../src/games/types';
import logger from '../src/utils/logger';

interface CliArgs {
  roomId?: string;
  ownerUid?: string;
  limit?: number;
  list: boolean;
  reset: boolean;
  force: boolean;
  help: boolean;
}

const USAGE = `Usage: tsx backend/scripts/room-admin.ts [options]

Options:
  --room-id <id>       Room ID to inspect
  --owner <uid>        Owner UID to locate room (ignored if --room-id provided)
  --list               List recent rooms (optionally filter by owner)
  --limit <n>          Maximum rooms to return with --list (default 20)
  --reset              Reinitialize room state in Redis and reset Postgres metadata
  --force              Skip confirmation prompt when using --reset
  --help               Show this message

Examples:
  tsx backend/scripts/room-admin.ts --room-id ROOM123
  tsx backend/scripts/room-admin.ts --owner user-abc
  tsx backend/scripts/room-admin.ts --list --limit 10
  tsx backend/scripts/room-admin.ts --room-id ROOM123 --reset --force
`;

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    reset: false,
    force: false,
    help: false,
    list: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    switch (token) {
      case '--room-id':
      case '-r': {
        args.roomId = argv[++i];
        break;
      }
      case '--owner':
      case '-o': {
        args.ownerUid = argv[++i];
        break;
      }
      case '--list':
      case '-l': {
        args.list = true;
        break;
      }
      case '--limit':
      case '-n': {
        const value = argv[++i];
        if (!value) {
          throw new Error('--limit requires a numeric value');
        }
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed <= 0) {
          throw new Error('--limit must be a positive integer');
        }
        args.limit = parsed;
        break;
      }
      case '--reset':
        args.reset = true;
        break;
      case '--force':
        args.force = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        if (token.startsWith('-')) {
          throw new Error(`Unknown option: ${token}`);
        }
        break;
    }
  }

  return args;
}

function assertRoomTarget(args: CliArgs): void {
  if (!args.list && !args.roomId && !args.ownerUid) {
    throw new Error('You must provide either --room-id or --owner');
  }
}

async function confirmReset(force: boolean): Promise<boolean> {
  if (force) {
    return true;
  }

  const rl = readline.createInterface({ input, output });
  const answer = await rl.question(
    'This will reinitialize the room. Type "yes" to continue: '
  );
  rl.close();

  return answer.trim().toLowerCase() === 'yes';
}

function summarizeRoom(room: Room | null): Record<string, unknown> | null {
  if (!room) {
    return null;
  }

  return {
    room_id: room.room_id,
    owner_uid: room.owner_uid,
    game_id: room.game_id,
    room_status: room.room_status,
    created_at: room.created_at,
    updated_at: room.updated_at,
  };
}

function summarizeState(state: RoomState | null): Record<string, unknown> | null {
  if (!state) {
    return null;
  }

  return {
    room_id: state.room_id,
    room_status: state.room_status,
    resume_locked: state.resume_locked,
    version: state.version,
    has_players: Object.keys(state.player_list).length > 0,
    player_count: Object.keys(state.player_list).length,
    game_id: state.game_id,
    history_events: state.history.length,
    updated_at: state.updated_at,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(USAGE);
    return;
  }

  if (args.list && args.reset) {
    console.error('Cannot combine --list with --reset');
    process.exitCode = 1;
    return;
  }

  if (!args.list) {
    try {
      assertRoomTarget(args);
    } catch (error: any) {
      console.error(error.message);
      console.log();
      console.log(USAGE);
      process.exitCode = 1;
      return;
    }
  }

  const fastify = Fastify({ logger: false });

  try {
    await fastify.register(postgresPlugin);
    await fastify.register(redisPlugin);

    const roomDAO = createRoomDAO(fastify);
    const stateManager = createStateManager(fastify);

    if (args.list) {
      const limit = args.limit ?? 20;
      const rooms = await roomDAO.list({ ownerUid: args.ownerUid, limit });

      if (rooms.length === 0) {
        console.log('No rooms found.');
        return;
      }

      const states = await Promise.all(
        rooms.map((room) => stateManager.getRoomState(room.room_id))
      );

      const summaries = rooms.map((room, index) => {
        const state = states[index] ?? null;
        return {
          room: summarizeRoom(room),
          redis_state: summarizeState(state),
          warnings: state ? [] : ['Room state missing in Redis'],
        };
      });

      console.log(
        `=== Room List (count=${summaries.length}, limit=${limit}${
          args.ownerUid ? `, owner=${args.ownerUid}` : ''
        }) ===`
      );
      console.log(JSON.stringify(summaries, null, 2));
      return;
    }

    let room: Room | null = null;

    if (args.roomId) {
      room = await roomDAO.getById(args.roomId);
    }

    if (!room && args.ownerUid) {
      room = await roomDAO.getByOwnerUid(args.ownerUid);
    }

    if (!room) {
      console.error('Room not found.');
      process.exitCode = 1;
      return;
    }

    if (args.roomId && room.room_id !== args.roomId) {
      logger.warn(
        { requested: args.roomId, resolved: room.room_id },
        'Resolved room ID differs from requested ID'
      );
    }

    let roomState = await stateManager.getRoomState(room.room_id);
    const actions: string[] = [];

    if (args.reset) {
      const ok = await confirmReset(args.force);
      if (!ok) {
        console.log('Reset cancelled.');
      } else {
        logger.info({ roomId: room.room_id }, 'Reinitializing room state');

        roomState = await stateManager.initializeRoomState(
          room.room_id,
          room.owner_uid,
          null
        );

        await roomDAO.updateGameId(room.room_id, null);
        await roomDAO.updateStatus(room.room_id, 'open');
        actions.push('Room state reinitialized');
        actions.push('Postgres metadata reset (game_id=null, status=open)');
      }
    }

    const outputPayload = {
      room: summarizeRoom(room),
      redis_state: summarizeState(roomState),
      raw_redis_state: roomState,
      actions,
      warnings: roomState ? [] : ['Room state missing in Redis'],
    };

    console.log('=== Room Metadata (Postgres) ===');
    console.log(JSON.stringify(outputPayload.room, null, 2));

    console.log('\n=== Room State (Redis) ===');
    if (roomState) {
      console.log(JSON.stringify(roomState, null, 2));
    } else {
      console.log('null');
    }

    if (actions.length > 0) {
      console.log('\n=== Actions Applied ===');
      for (const action of actions) {
        console.log(`- ${action}`);
      }
    }

    if (!roomState) {
      console.log('\nWARNING: No Redis state found for this room.');
    }

    console.log('\n=== Summary ===');
    console.log(
      JSON.stringify(
        {
          room: outputPayload.room,
          redis_state: outputPayload.redis_state,
          actions,
          warnings: outputPayload.warnings,
        },
        null,
        2
      )
    );
  } catch (error: any) {
    logger.error({ error }, 'Room admin script failed');
    console.error('Error:', error.message);
    process.exitCode = 1;
  } finally {
    await fastify.close();
  }
}

void main();

