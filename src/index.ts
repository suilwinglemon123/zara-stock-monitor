#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { ZaraMonitorEngine } from './services/monitor-engine.js';
import { cmdAdd, cmdList, cmdStore, cmdTestNotify } from './cli/commands.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseDir = path.resolve(__dirname, '..');

const program = new Command();

program
  .name('zara-monitor')
  .description('Zara 智能库存与降价监控系统 (TypeScript 版)')
  .version('1.0.0');

// 1. check
program
  .command('check')
  .description('立即巡检所有监控商品并打印当前尺码库存与价格')
  .action(async () => {
    const engine = new ZaraMonitorEngine(baseDir);
    await engine.runOnce();
  });

// 2. watch
program
  .command('watch')
  .description('启动后台常驻守护进程，自动监听缺货到货与降价推送')
  .action(async () => {
    const engine = new ZaraMonitorEngine(baseDir);
    await engine.runWatch();
  });

// 3. store
program
  .command('store')
  .description('一键查询指定商品在全国线下实体门店的精准库存 (在售区 / 内仓)')
  .requiredOption('-u, --url <url>', 'Zara 商品页面 URL 或货号')
  .option('-c, --city <city>', '查询城市名称 (默认: 上海)', '上海')
  .option('-s, --size <sizes>', '过滤指定尺码 (例如: 36 或 M，逗号分隔)')
  .option('-r, --radius <radius>', '搜索半径公里数 (默认: 50)', '50')
  .action(async (options) => {
    await cmdStore(options, baseDir);
  });

// 4. add
program
  .command('add')
  .description('添加新的商品监控目标至配置文件')
  .requiredOption('-u, --url <url>', 'Zara 商品页面 URL 或货号')
  .option('-n, --name <name>', '商品自定义备注名')
  .option('-s, --size <sizes>', '关注尺码 (例如: 36,38 或 S，逗号分隔)')
  .option('-p, --price <price>', '降价心理预期阈值 (低于此价格报警)')
  .option('-c, --city <city>', '实体店查询城市 (默认: 上海)', '上海')
  .option('--no-restock', '不监控到货补货')
  .option('--no-price', '不监控降价')
  .option('--check-stores', '巡检时一并查询实体门店库存')
  .action(async (options) => {
    await cmdAdd(options, baseDir);
  });

// 5. list
program
  .command('list')
  .description('查看当前所有监控目标商品')
  .action(() => {
    cmdList(baseDir);
  });

// 6. test-notify
program
  .command('test-notify')
  .description('发送测试通知验证各个推送通道配置')
  .action(async () => {
    await cmdTestNotify(baseDir);
  });

// 默认无参数时执行单次检查
if (process.argv.length <= 2) {
  const engine = new ZaraMonitorEngine(baseDir);
  await engine.runOnce();
} else {
  program.parse(process.argv);
}
