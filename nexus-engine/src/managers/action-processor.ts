import { EngineRoomState } from "../types";
import { IRoomContext } from "./types";

type ActionPayload = {
    action_id: string;
    params?: Record<string, any>;
};

type WorkerCommand = {
    type: string;
    name?: string;
};

type TriggerMode = "await" | "waitUntil";

export async function applySuccessfulAction(opts: {
    room: IRoomContext;
    roleId: string;
    action: ActionPayload;
    nextState: any;
    commands?: WorkerCommand[];
    persistExtraKeys?: (keyof EngineRoomState)[];
    triggerMode?: TriggerMode;
}): Promise<void> {
    const {
        room,
        roleId,
        action,
        nextState,
        commands,
        persistExtraKeys = [],
        triggerMode = "await",
    } = opts;

    room.gameState = nextState;
    room.history.push({
        turn: room.history.length,
        stateIndex: room.stateIndex,
        roleId,
        action: {
            action_id: action.action_id,
            params: action.params || {},
        },
        timestamp: Date.now(),
    });
    room.stateIndex++;

    let explicitSave = false;
    if (commands && Array.isArray(commands)) {
        for (const cmd of commands) {
            if (cmd.type === "SAVE_STATE") {
                room.stateHistory.push({
                    index: room.stateIndex,
                    name: cmd.name || `${roleId}:${action.action_id}`,
                    state: room.gameState,
                    timestamp: Date.now(),
                });
                explicitSave = true;
            } else if (cmd.type === "CLEAR_HISTORY") {
                room.stateHistory = [{
                    index: 0,
                    name: "Reset Base",
                    state: room.gameState,
                    timestamp: Date.now(),
                }];
                room.stateIndex = 0;
            }
        }
    }

    if (!explicitSave && room.gameConfig?.auto_save_mode === "enabled") {
        room.stateHistory.push({
            index: room.stateIndex,
            name: `${roleId}:${action.action_id}`,
            state: room.gameState,
            timestamp: Date.now(),
        });
    }

    const persistKeys = new Set<keyof EngineRoomState>([
        "gameState",
        "history",
        "stateHistory",
        "stateIndex",
        ...persistExtraKeys,
    ]);

    // Broadcast immediately so the user sees their move reflected
    room.broadcastSyncState();

    // Background persistence and next turn triggering
    room.waitUntil((async () => {
        await room.persist(...Array.from(persistKeys));
        await room.checkAndTriggerNextTurn();
    })());
}
