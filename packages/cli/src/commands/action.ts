import { EngineClient } from "../client.js";
import { DEFAULT_PORT } from "../constants.js";

export async function actionCommand(
    roleId: string,
    actionJson: string,
    options: { port?: string },
) {
    const port = parseInt(options.port || String(DEFAULT_PORT), 10);
    const client = new EngineClient(port);

    let action: { action_id: string; params?: Record<string, any> };
    try {
        action = JSON.parse(actionJson);
    } catch {
        console.error(`❌ 无效的 JSON: ${actionJson}`);
        process.exit(1);
    }

    if (!action.action_id) {
        console.error(`❌ action_json 必须包含 action_id 字段`);
        process.exit(1);
    }

    try {
        const result = await client.submitAction(roleId, action);
        if (result.success) {
            console.log("✅ 行动成功");
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.error(`❌ 行动失败: ${result.error}`);
        }
    } catch (e: any) {
        if (e.cause?.code === "ECONNREFUSED") {
            console.error(`❌ 无法连接到引擎 (localhost:${port})。请先运行: npx @nexusgame/cli start`);
        } else {
            console.error(`❌ 错误: ${e.message}`);
        }
        process.exit(1);
    }
}
