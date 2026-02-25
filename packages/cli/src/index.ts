#!/usr/bin/env node
import { Command } from "commander";
import { startCommand } from "./commands/start.js";
import { setupCommand } from "./commands/setup.js";
import { stateCommand } from "./commands/state.js";
import { perspectiveCommand } from "./commands/perspective.js";
import { actionCommand } from "./commands/action.js";
import { createGameCommand } from "./commands/create-game.js";

const program = new Command();

program
    .name("nexus-dev")
    .description("星枢沙盒 — 本地游戏开发调试工具")
    .version("0.1.0");

program
    .command("start")
    .description("启动本地引擎 (前台运行, Ctrl+C 停止)")
    .option("-p, --port <port>", "引擎端口", "56512")
    .action(startCommand);

program
    .command("setup")
    .description("创建房间 + 设置游戏 + 开始 (一条龙)")
    .requiredOption("-w, --worker-url <url>", "Game Worker URL (如 http://localhost:8788)")
    .option("-p, --port <port>", "引擎端口", "56512")
    .option("-n, --players <count>", "指定参与游戏的人数 (适用于UNO等可选人数游戏)")
    .action(setupCommand);

program
    .command("state")
    .description("查看房间全局状态")
    .option("-p, --port <port>", "引擎端口", "56512")
    .action(stateCommand);

program
    .command("perspective")
    .description("查看指定角色的视角")
    .argument("<roleId>", "角色 ID")
    .option("-p, --port <port>", "引擎端口", "56512")
    .action(perspectiveCommand);

program
    .command("action")
    .description("以指定角色执行行动")
    .argument("<roleId>", "角色 ID")
    .argument("<actionJson>", "行动 JSON (如 '{\"action_id\":\"place\",\"params\":{\"x\":7,\"y\":7}}')")
    .option("-p, --port <port>", "引擎端口", "56512")
    .action(actionCommand);

program
    .command("create-game")
    .description("脚手架生成：交互式创建新游戏项目")
    .action(createGameCommand);

program.parse();
