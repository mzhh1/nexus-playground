import fs from 'fs';
import path from 'path';
import readline from 'readline';
import chalk from 'chalk';
import {
    workerIndexTemplate,
    wranglerTomlTemplate,
    packageJsonTemplate,
    tsconfigJsonTemplate,
    tsconfigNodeJsonTemplate,
    tsupConfigTemplate,
    viteConfigTemplate,
    gameUiHtmlTemplate,
    uiTemplate,
    uiModuleCssTemplate,
    uiTypesDtsTemplate,
    iframeEntryTemplate,
    logicTemplate,
    readmeTemplate,
} from './_templates/index.js';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const prompt = (question: string): Promise<string> => {
    return new Promise((resolve) => rl.question(question, resolve));
};

export async function createGameCommand() {
    console.log(chalk.cyan('\n🎮 欢迎使用星枢沙盒游戏构建向导！\n'));

    const gameId = (await prompt(chalk.bold('1. 游戏英文 ID (只能包含小写字母、数字和中划线，如 my-game): '))) || 'my-game';

    if (!/^[a-z0-9-]+$/.test(gameId)) {
        console.error(chalk.red('❌ 游戏 ID 格式错误！只能包含小写字母、数字和中划线。'));
        process.exit(1);
    }

    const gameName = (await prompt(chalk.bold('2. 游戏展示名称 (如 我的棒棒游戏): '))) || '我的棒棒游戏';
    const minPlayersStr = (await prompt(chalk.bold('3. 最小玩家数 (默认: 2): '))) || '2';
    const maxPlayersStr = (await prompt(chalk.bold('4. 最大玩家数 (默认: 2): '))) || '2';

    const defaultDir = path.resolve(process.cwd(), gameId);
    const customDir = await prompt(chalk.bold(`5. 输出目录 (默认: ${defaultDir}): `));

    const minPlayers = parseInt(minPlayersStr, 10) || 2;
    const maxPlayers = parseInt(maxPlayersStr, 10) || 2;

    rl.close();

    const gameDir = customDir ? path.resolve(process.cwd(), customDir) : defaultDir;

    if (fs.existsSync(gameDir)) {
        console.error(chalk.red(`\n❌ 目录 ${gameDir} 已存在，请换一个游戏 ID 或输出路径！`));
        process.exit(1);
    }

    console.log(chalk.blue(`\n✨ 正在为你生成 ${gameId} 的基础代码到 ${gameDir}...\n`));

    // 创建目录
    fs.mkdirSync(path.join(gameDir, 'logic'), { recursive: true });
    fs.mkdirSync(path.join(gameDir, 'ui'), { recursive: true });
    fs.mkdirSync(path.join(gameDir, 'worker/src'), { recursive: true });
    fs.mkdirSync(path.join(gameDir, 'worker/public'), { recursive: true });

    // 写入文件
    const writeTemplate = (filePath: string, content: string) => {
        fs.writeFileSync(path.join(gameDir, filePath), content, 'utf-8');
        console.log(chalk.green(`  ✔ ${filePath}`));
    };

    writeTemplate('package.json', packageJsonTemplate(gameId));
    writeTemplate('tsconfig.json', tsconfigJsonTemplate);
    writeTemplate('tsconfig.node.json', tsconfigNodeJsonTemplate);
    writeTemplate('tsup.config.ts', tsupConfigTemplate);
    writeTemplate('vite.config.ui.ts', viteConfigTemplate);
    writeTemplate('README.md', readmeTemplate(gameId));

    writeTemplate('logic/index.ts', logicTemplate(gameId, gameName, minPlayers, maxPlayers));

    writeTemplate('ui/ui.tsx', uiTemplate(gameName));
    writeTemplate('ui/ui.module.css', uiModuleCssTemplate);
    writeTemplate('ui/types.d.ts', uiTypesDtsTemplate);
    writeTemplate('ui/iframe-entry.tsx', iframeEntryTemplate(gameName));
    writeTemplate('ui/game-ui.html', gameUiHtmlTemplate);
    writeTemplate('worker/public/game-ui.html', gameUiHtmlTemplate);

    writeTemplate('worker/src/index.ts', workerIndexTemplate);
    writeTemplate('worker/wrangler.toml', wranglerTomlTemplate(gameId));

    console.log(chalk.magenta(`\n🎉 游戏 [${gameName}] 脚手架生成成功！\n`));
    console.log('👉 下一步你应该:');
    console.log(chalk.yellow(`   cd ${gameDir}`));
    console.log(chalk.yellow('   pnpm install'));
    console.log(chalk.yellow('   pnpm run dev\n'));
}
