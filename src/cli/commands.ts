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

export async function cmdScanSale(
  options: { city?: string; section?: string; output?: string },
  baseDir: string
): Promise<void> {
  const client = new ZaraClient();
  const city = options.city || '南京';
  console.log(chalk.cyan(`正在检索 ${city} 线下实体门店...`));
  const stores = await client.searchPhysicalStores(city, 50);
  if (stores.length === 0) {
    console.log(chalk.red(`未找到 ${city} 线下门店。`));
    return;
  }

  const primaryStore = stores[0];
  console.log(chalk.green(`✔ 选定目标门店: ${primaryStore.name} (ID: ${primaryStore.id}, 地址: ${primaryStore.address})`));

  console.log(chalk.cyan('正在从 Zara 官方全品类索引同步特价精选商品池...'));
  const catTasks: { catId: number; section: string }[] = [];
  if (!options.section || options.section.includes('女')) {
    catTasks.push({ catId: 2419737, section: '女士' });
  }
  if (!options.section || options.section.includes('男')) {
    catTasks.push({ catId: 2436823, section: '男士' });
  }

  const allProds = new Map<number, any>();
  for (const { catId, section } of catTasks) {
    try {
      const res = await fetch(`https://www.zara.cn/cn/zh/category/${catId}/products?ajax=true`, {
        headers: client.getHeaders('https://www.zara.cn/cn/zh/'),
      });
      if (!res.ok) continue;
      const data: any = await res.json();
      const elements = data.productGroups?.[0]?.elements || [];
      for (const el of elements) {
        for (const comp of el.commercialComponents || []) {
          if (comp.id && comp.name && !allProds.has(comp.id)) {
            const colors = comp.detail?.colors || [];
            const oldPrice = colors[0]?.oldPrice ? colors[0].oldPrice / 100 : comp.oldPrice ? comp.oldPrice / 100 : undefined;
            const price = colors[0]?.price ? colors[0].price / 100 : comp.price ? comp.price / 100 : 0;
            const discountRate = oldPrice ? Math.round((1 - price / oldPrice) * 100) : 0;
            const seoKeyword = comp.seo?.keyword || '';
            const seoId = comp.seo?.seoProductId || '';
            const url = `https://www.zara.cn/cn/zh/${seoKeyword ? decodeURIComponent(seoKeyword) : 'product'}-p${seoId}.html`;
            allProds.set(comp.id, {
              id: comp.id,
              section,
              name: comp.name,
              ref: comp.reference || comp.detail?.reference || '',
              familyName: comp.familyName || '',
              price,
              oldPrice,
              discountRate,
              url,
            });
          }
        }
      }
    } catch {}
  }

  const prods = Array.from(allProds.values());
  console.log(chalk.cyan(`获取到 ${prods.length} 款特价打折商品，正在并发扫描 ${primaryStore.name} 真实库存分布...`));

  const inStockResults: any[] = [];
  const chunkSize = 6;
  for (let i = 0; i < prods.length; i += chunkSize) {
    const chunk = prods.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (p) => {
        try {
          const stocks = await client.getStoreStock(p.id, [primaryStore.id]);
          const storeStock = stocks[0];
          if (storeStock) {
            const totalStock = Object.values(storeStock.sizesStock).reduce((acc, v) => acc + v.stock, 0);
            if (totalStock > 0) {
              inStockResults.push({
                ...p,
                totalStock,
                sizesStock: storeStock.sizesStock,
              });
            }
          }
        } catch {}
      })
    );
    await new Promise((r) => setTimeout(r, 100));
  }

  inStockResults.sort((a, b) => b.totalStock - a.totalStock);
  console.log(`\n${chalk.green.bold(`✔ 扫描完成！${primaryStore.name} 当前共有 ${inStockResults.length} 款特价打折商品有现货：`)}\n`);

  for (const [idx, item] of inStockResults.entries()) {
    console.log(`[${idx + 1}] ${chalk.bold(item.name)} [${item.section}] (Ref: ${item.ref})`);
    console.log(`    💰 现价: ${chalk.green(`¥${item.price}`)} ${item.oldPrice ? chalk.gray(`(原价 ¥${item.oldPrice}, 立省 ${item.discountRate}%)`) : ''} | 店内现货: ${chalk.yellow.bold(`${item.totalStock} 件`)}`);
    console.log(`    🔗 链接: ${chalk.blue(item.url)}`);
    const szDesc = Object.entries(item.sizesStock)
      .map(([s, d]: [string, any]) => `${s}: ${d.stock}件 (架上:${d.salesArea}/内仓:${d.warehouse})`)
      .join(' | ');
    console.log(`    📏 尺码: ${chalk.gray(szDesc)}`);
    console.log();
  }

  if (options.output) {
    const fs = await import('fs');
    fs.writeFileSync(options.output, JSON.stringify(inStockResults, null, 2), 'utf8');
    console.log(chalk.green(`✔ 完整结果已保存至: ${options.output}`));
  }
}

