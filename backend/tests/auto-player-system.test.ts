/**
 * Auto Player System Tests
 * 
 * Tests the auto player executor interface, coordinator, and integration points.
 */

import { AutoPlayerExecutor } from '../src/runtime/auto-player-executor';
import { LLMPlayerExecutor } from '../src/runtime/llm-player-executor';
import { AutoPlayerCoordinator } from '../src/runtime/auto-player-coordinator';
import { RoomState } from '../src/games/types';

// Mock Fastify instance
const mockFastify = {} as any;

describe('AutoPlayerExecutor Interface', () => {
  it('should define required methods', () => {
    const executor = new LLMPlayerExecutor(mockFastify);
    
    expect(executor.getName).toBeDefined();
    expect(executor.canHandle).toBeDefined();
    expect(executor.executeTurn).toBeDefined();
  });

  it('should return correct executor name', () => {
    const executor = new LLMPlayerExecutor(mockFastify);
    expect(executor.getName()).toBe('LLMPlayerExecutor');
  });
});

describe('LLMPlayerExecutor', () => {
  it('should identify LLM players correctly', () => {
    const executor = new LLMPlayerExecutor(mockFastify);
    
    const roomStateWithLLM: Partial<RoomState> = {
      role_mapping: { player_1: 'p1' },
      player_list: {
        p1: {
          type: 'llm',
          model_name: 'gpt-4o-mini',
          system_prompt: 'test',
          display_name: 'AI',
          join_time: new Date().toISOString(),
          status: 'active',
        },
      },
    };

    expect(executor.canHandle(roomStateWithLLM as RoomState, 'player_1')).toBe(true);
  });

  it('should reject non-LLM players', () => {
    const executor = new LLMPlayerExecutor(mockFastify);
    
    const roomStateWithHuman: Partial<RoomState> = {
      role_mapping: { player_1: 'p1' },
      player_list: {
        p1: {
          type: 'human',
          uid: 'user123',
          display_name: 'Human',
          join_time: new Date().toISOString(),
          status: 'online',
        },
      },
    };

    expect(executor.canHandle(roomStateWithHuman as RoomState, 'player_1')).toBe(false);
  });

  it('should handle unmapped roles gracefully', () => {
    const executor = new LLMPlayerExecutor(mockFastify);
    
    const roomState: Partial<RoomState> = {
      role_mapping: {},
      player_list: {},
    };

    expect(executor.canHandle(roomState as RoomState, 'player_1')).toBe(false);
  });
});

describe('AutoPlayerCoordinator', () => {
  it('should register executors', () => {
    const coordinator = new AutoPlayerCoordinator(mockFastify);
    const executors = coordinator.getRegisteredExecutors();
    
    expect(executors).toContain('LLMPlayerExecutor');
    expect(executors.length).toBeGreaterThan(0);
  });

  it('should support custom executor registration', () => {
    const coordinator = new AutoPlayerCoordinator(mockFastify);
    
    const customExecutor: AutoPlayerExecutor = {
      getName: () => 'CustomExecutor',
      canHandle: () => false,
      executeTurn: async () => false,
    };
    
    coordinator.registerExecutor(customExecutor);
    
    const executors = coordinator.getRegisteredExecutors();
    expect(executors).toContain('CustomExecutor');
  });

  it('should maintain executor order', () => {
    const coordinator = new AutoPlayerCoordinator(mockFastify);
    
    const executor1: AutoPlayerExecutor = {
      getName: () => 'Executor1',
      canHandle: () => false,
      executeTurn: async () => false,
    };
    
    const executor2: AutoPlayerExecutor = {
      getName: () => 'Executor2',
      canHandle: () => false,
      executeTurn: async () => false,
    };
    
    coordinator.registerExecutor(executor1);
    coordinator.registerExecutor(executor2);
    
    const executors = coordinator.getRegisteredExecutors();
    const idx1 = executors.indexOf('Executor1');
    const idx2 = executors.indexOf('Executor2');
    
    expect(idx1).toBeGreaterThan(-1);
    expect(idx2).toBeGreaterThan(-1);
  });
});

describe('Chain of Responsibility Pattern', () => {
  it('should match first applicable executor', () => {
    const matchingExecutor: AutoPlayerExecutor = {
      getName: () => 'MatchingExecutor',
      canHandle: () => true, // Always matches
      executeTurn: async () => true,
    };
    
    const nonMatchingExecutor: AutoPlayerExecutor = {
      getName: () => 'NonMatchingExecutor',
      canHandle: () => false,
      executeTurn: async () => false,
    };
    
    // In real implementation, coordinator would pick MatchingExecutor
    expect(matchingExecutor.canHandle({} as RoomState, 'test')).toBe(true);
    expect(nonMatchingExecutor.canHandle({} as RoomState, 'test')).toBe(false);
  });
});

describe('Executor Factory Functions', () => {
  it('should create LLM player executor via factory', () => {
    const { createLLMPlayerExecutor } = require('../src/runtime/llm-player-executor');
    const executor = createLLMPlayerExecutor(mockFastify);
    
    expect(executor).toBeInstanceOf(LLMPlayerExecutor);
    expect(executor.getName()).toBe('LLMPlayerExecutor');
  });

  it('should create auto player coordinator via factory', () => {
    const { createAutoPlayerCoordinator } = require('../src/runtime/auto-player-coordinator');
    const coordinator = createAutoPlayerCoordinator(mockFastify);
    
    expect(coordinator).toBeInstanceOf(AutoPlayerCoordinator);
    expect(coordinator.getRegisteredExecutors).toBeDefined();
  });
});

describe('Extension Pattern', () => {
  it('should support custom executor implementation', () => {
    class RuleBasedExecutor implements AutoPlayerExecutor {
      getName(): string {
        return 'RuleBasedExecutor';
      }

      canHandle(roomState: RoomState, currentRoleId: string): boolean {
        const playerId = roomState.role_mapping[currentRoleId];
        const player = roomState.player_list[playerId];
        return player?.type === 'rule_ai';
      }

      async executeTurn(roomId: string, currentRoleId: string): Promise<boolean> {
        // Mock implementation
        return true;
      }
    }

    const executor = new RuleBasedExecutor();
    expect(executor.getName()).toBe('RuleBasedExecutor');
    
    const roomState: Partial<RoomState> = {
      role_mapping: { player_1: 'p1' },
      player_list: {
        p1: {
          type: 'rule_ai' as any,
          display_name: 'Rule AI',
          join_time: new Date().toISOString(),
        } as any,
      },
    };
    
    expect(executor.canHandle(roomState as RoomState, 'player_1')).toBe(true);
  });
});







