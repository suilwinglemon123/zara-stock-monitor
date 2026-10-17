import chalk from 'chalk';
import { ZaraClient } from '../client/zara-client.js';
import { ZaraMonitorEngine } from '../services/monitor-engine.js';
import { Notifier } from '../services/notifier.js';

export async function cmdStore(
  options: { url: string; city: string; size?: string; radius?: string },
  baseDir: string
): Promise<void> {
  const client = new ZaraClient();
  const engine = new ZaraMonitorEngine(baseDir);
  const sizeFilter = options.size ? options.size.split(',').map((s) => s.trim()) : undefined;
  const radiusKm = options.radius ? parseInt(options.radius, 10) : 50;

  console.log(chalk.cyan('正在解析 Zara 商品详情...'));
  const product = await client.getProduct(options.url);
  if (!product) {
    console.log(chalk.red('获取商品详情失败，请检查链接有效性。'));
    return;
  }

  console.log(`${chalk.bold(`🛍️  商品: ${product.name}`)} (Ref: ${product.reference})`);
  for (const c of product.colors) {
    console.log(`  🎨 款式: ${c.name} | 官方售价: ¥${c.price}`);
  }

  await engine.queryStoresStock(product.productId, product.name, options.city, sizeFilter, radiusKm);
  console.log();
}

export async function cmdAdd(
  options: {
    url: string;
    name?: string;
    size?: string;
    price?: string;
    city?: string;
    noRestock?: boolean;
    noPrice?: boolean;
    checkStores?: boolean;
  },
  baseDir: string
): Promise<void> {
  const engine = new ZaraMonitorEngine(baseDir);
  const config = engine.getConfig();
  const client = new ZaraClient();

  const targetSizes = options.size ? options.size.split(',').map((s) => s.trim()) : [];
  const targetPrice = options.price ? parseFloat(options.price) : undefined;

  let displayName = options.name;
  console.log(chalk.cyan('正在校验并识别目标商品...'));
  const p = await client.getProduct(options.url);
  if (p) {
    displayName = displayName || p.name;
    console.log(`${chalk.green('✔ 成功识别商品:')} ${p.name} (Ref: ${p.reference})`);
  }

  const newTarget = {
    name: displayName || '未命名商品',
    url: options.url.trim(),
    targetSizes,
    targetPrice,
    notifyRestock: !options.noRestock,
    notifyPriceDrop: !options.noPrice,
    checkStores: Boolean(options.checkStores),
    preferredCity: options.city || '上海',
    enabled: true,
  };

  config.targets.push(newTarget);
  engine.saveConfig();

  console.log(chalk.green('✔ 成功添加监控目标至 config.json！'));
  console.log(`  - 目标尺码: ${targetSizes.length > 0 ? targetSizes.join(', ') : '全尺码'}`);
  if (targetPrice) {
    console.log(`  - 降价心理线: ¥${targetPrice}`);
  }
  console.log(`  - 实体店查询城市: ${newTarget.preferredCity}`);
}

export function cmdList(baseDir: string): void {
  const engine = new ZaraMonitorEngine(baseDir);
  const config = engine.getConfig();
  const targets = config.targets || [];

  console.log(`\n${chalk.cyan('='.repeat(60))}`);
  console.log(chalk.bold(`📋 当前监控商品列表 (共 ${targets.length} 项)`));
  console.log(chalk.cyan('-'.repeat(60)));

  if (targets.length === 0) {
    console.log(chalk.yellow('  暂无任何监控商品。'));
    console.log('  使用 npm run add -- --url <URL> 快速添加。');
  }

  targets.forEach((t, idx) => {
    const statusTag = t.enabled !== false ? chalk.green('[已启用]') : chalk.gray('[已停用]');
    console.log(`[${idx + 1}] ${chalk.bold(t.name || '未命名商品')} ${statusTag}`);
    console.log(`    链接: ${t.url}`);
    console.log(`    关注尺码: ${t.targetSizes && t.targetSizes.length > 0 ? t.targetSizes.join(', ') : '全部尺码'}`);
    console.log(`    降价报警: ${t.targetPrice ? `低于 ¥${t.targetPrice}` : '仅跟随官方原价降幅'}`);
    console.log(`    实体门店: ${t.checkStores ? `已开启 (${t.preferredCity || '上海'})` : '关闭'}`);
  });
  console.log(`\n${chalk.cyan('='.repeat(60))}\n`);
}

export async function cmdTestNotify(baseDir: string): Promise<void> {
  const engine = new ZaraMonitorEngine(baseDir);
  const notifier = new Notifier(engine.getConfig().notify);

  console.log(chalk.cyan('正在发送测试消息至所有已配置渠道...'));
  await notifier.notify(
    '🔔 Zara 监控系统通知测试',
    '这是一条来自 TypeScript 版 Zara 智能监控系统的测试消息，说明 macOS 桌面弹窗/提示音以及移动推送已配置成功！',
    'https://www.zara.cn/cn/zh/'
  );
  console.log(chalk.green('✔ 测试消息发送完毕，请检查您的桌面或手机推送。'));
}
