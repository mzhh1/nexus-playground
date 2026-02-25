import { EngineClient } from "../client.js";
import { DEFAULT_PORT } from "../constants.js";

export async function stateCommand(options: { port?: string }) {
    const port = parseInt(options.port || String(DEFAULT_PORT), 10);
    const client = new EngineClient(port);

    try {
        const result = await client.getState();
        console.log(JSON.stringify(result, null, 2));
    } catch (e: any) {
        if (e.cause?.code === "ECONNREFUSED") {
            console.error(`❌ 无法连接到引擎 (localhost:${port})。请先运行: npx @nexusgame/cli start`);
        } else {
            console.error(`❌ 错误: ${e.message}`);
        }
        process.exit(1);
    }
}
