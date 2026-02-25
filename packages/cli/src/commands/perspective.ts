import { EngineClient } from "../client.js";
import { DEFAULT_PORT } from "../constants.js";

export async function perspectiveCommand(
    roleId: string,
    options: { port?: string },
) {
    const port = parseInt(options.port || String(DEFAULT_PORT), 10);
    const client = new EngineClient(port);

    try {
        const result = await client.getPerspective(roleId);
        console.log(JSON.stringify(result, null, 2));

        try {
            const stateRes = await client.getState();
            const uiUrl = stateRes?.data?.gameConfig?.gameWorkerUrl;
            if (uiUrl) {
                console.log(`\n📺 调试 GUI 页面:`);
                // Fixed constants imported/manually defined
                const ADMIN_SECRET = process.env.ADMIN_SECRET || "nexus-dev-secret";
                const FIXED_ROOM_ID = "dev-room";
                const stateUrl = encodeURIComponent(`http://127.0.0.1:${port}/api/monitor/room/${FIXED_ROOM_ID}/perspective?roleId=${roleId}`);
                const actionUrl = encodeURIComponent(`http://127.0.0.1:${port}/api/monitor/room/${FIXED_ROOM_ID}/action`);
                const token = encodeURIComponent(ADMIN_SECRET);
                console.log(`${uiUrl}/game-ui.html?stateUrl=${stateUrl}&actionUrl=${actionUrl}&token=${token}`);
            }
        } catch (ignored) { }
    } catch (e: any) {
        if (e.cause?.code === "ECONNREFUSED") {
            console.error(`❌ 无法连接到引擎 (localhost:${port})。请先运行: npx @nexusgame/cli start`);
        } else {
            console.error(`❌ 错误: ${e.message}`);
        }
        process.exit(1);
    }
}
