import { EngineClient } from "../client.js";
import { DEFAULT_PORT } from "../constants.js";

export async function setupCommand(options: {
    workerUrl: string;
    port?: string;
    players?: string;
}) {
    const port = parseInt(options.port || String(DEFAULT_PORT), 10);
    const client = new EngineClient(port);

    try {
        // Step 1: Check if room exists
        console.log("🔍 检查房间状态...");
        let roomExists = false;
        let currentPhase = "";

        try {
            const stateRes = await client.getState();
            if (stateRes?.data?.roomId) {
                roomExists = true;
                currentPhase = stateRes.data.phase;
                console.log(`  房间已存在, phase: ${currentPhase}`);
            }
        } catch {
            // Room doesn't exist
        }

        // If room exists and is playing/paused, stop first
        if (roomExists && (currentPhase === "playing" || currentPhase === "paused")) {
            console.log("⏹️  停止当前游戏...");
            const stopRes = await client.stopGame();
            if (stopRes.error) {
                console.error(`❌ 停止失败: ${stopRes.error}`);
                process.exit(1);
            }
            console.log("  游戏已停止");
        }

        // If room doesn't exist, create it
        if (!roomExists) {
            console.log("📦 创建房间...");
            const createRes = await client.createRoom();
            if (createRes.error) {
                console.error(`❌ 创建失败: ${createRes.error}`);
                process.exit(1);
            }
            console.log(`  房间已创建: ${createRes.roomId}`);
        }

        // Step 2: Set game
        console.log(`🎮 设置游戏 (${options.workerUrl})...`);
        const players = options.players ? parseInt(options.players, 10) : undefined;
        const setRes = await client.setGame(options.workerUrl, undefined, players);
        if (setRes.error) {
            console.error(`❌ 设置游戏失败: ${setRes.error}`);
            process.exit(1);
        }
        console.log(`  游戏: ${setRes.gameId} (角色: ${setRes.roleIds?.join(", ")})`);

        // Step 3: Start game
        console.log("▶️  开始游戏...");
        const startRes = await client.startGame();
        if (startRes.error) {
            console.error(`❌ 启动失败: ${startRes.error}`);
            process.exit(1);
        }
        console.log("  游戏已开始!");

        // Print available commands
        console.log("\n可用命令:");
        console.log(`  npx @nexusgame/cli state                           查看房间状态`);
        console.log(`  npx @nexusgame/cli perspective <roleId>             查看角色视角`);
        console.log(`  npx @nexusgame/cli action <roleId> '<action_json>'  执行行动`);
    } catch (e: any) {
        if (e.cause?.code === "ECONNREFUSED") {
            console.error(`❌ 无法连接到引擎 (localhost:${port})。请先运行: npx @nexusgame/cli start`);
        } else {
            console.error(`❌ 错误: ${e.message}`);
        }
        process.exit(1);
    }
}
