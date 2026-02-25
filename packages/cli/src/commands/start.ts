import { Miniflare } from "miniflare";
import path from "path";
import { fileURLToPath } from "url";
import { ADMIN_SECRET, JWT_SECRET, DEFAULT_PORT } from "../constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function startCommand(options: { port?: string }) {
    const port = parseInt(options.port || String(DEFAULT_PORT), 10);
    const persistDir = path.resolve(process.cwd(), ".nexus");

    console.log("🚀 启动星枢沙盒引擎...");

    const mf = new Miniflare({
        modules: true,
        scriptPath: path.join(__dirname, "engine-worker.js"),
        port,
        durableObjects: { GAME_DO: "GameDO" },
        durableObjectsPersist: path.join(persistDir, "do"),
        bindings: {
            ADMIN_SECRET,
            JWT_SECRET,
        },
        compatibilityDate: "2024-02-08",
        outboundService(req) {
            // Bypass workerd's localhost blockage by using Node's native fetch
            return fetch(req.url, {
                method: req.method,
                headers: req.headers as any,
                body: req.method === "GET" || req.method === "HEAD" ? undefined : (req.body as any),
                redirect: "manual",
                duplex: "half"
            });
        },
    });

    // Wait for Miniflare to start
    const url = await mf.ready;
    console.log(`✅ Engine 已启动: ${url}`);
    console.log(`📂 持久化目录: ${persistDir}`);
    console.log(`\n按 Ctrl+C 停止引擎\n`);

    // Handle graceful shutdown
    const shutdown = async () => {
        console.log("\n🛑 正在关闭引擎...");
        await mf.dispose();
        console.log("👋 引擎已关闭");
        process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    // Keep the process alive
    await new Promise(() => { });
}
