import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { ZaraClient } from '../client/zara-client.js';
import type { AppConfig, WatchTarget, ZaraProduct, ZaraStoreStock } from '../client/types.js';
import { Notifier } from './notifier.js';
import { StateManager, type ColorState, type ProductState } from './state-manager.js';

export class ZaraMonitorEngine {
  private baseDir: string;
  private configPath: string;
  private client: ZaraClient;
  private notifier: Notifier;
  private stateManager: StateManager;
  private config: AppConfig;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    this.configPath = path.join(baseDir, 'config.json');
    this.client = new ZaraClient();
    this.stateManager = new StateManager(baseDir);
    this.config = this.loadConfig();
    this.notifier = new Notifier(this.config.notify || {});
  }

  private loadConfig(): AppConfig {
    if (fs.existsSync(this.configPath)) {
      try {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        return JSON.parse(raw);
      } catch (err) {
        console.error('[Engine] 加载 config.json 失败:', err);
      }
    }
    return {
      targets: [],
      notify: {},
      intervalSeconds: 60,
    };
  }

  saveConfig(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Engine] 保存 config.json 失败:', err);
    }
  }

  getConfig(): AppConfig {
    return this.config;
  }

  async checkTarget(target: WatchTarget): Promise<void> {
    const product = await this.client.getProduct(target.url);
    if (!product) {
      console.log(chalk.red(`✘ 抓取商品失败: ${target.url}`));
      return;
    }

    const displayName = target.name || product.name;
    const prodKey = product.productId;
    const savedState = this.stateManager.getProductState(prodKey);
    const newColorsState: Record<string, ColorState> = {};

    console.log(`\n${chalk.cyan('='.repeat(65))}`);
    console.log(`${chalk.bold(`🛍️  商品: ${displayName}`)} ${chalk.gray(`(Ref: ${product.reference})`)}`);
    console.log(chalk.gray(`   链接: ${target.url}`));
    console.log(chalk.cyan('-'.repeat(65)));

    for (const color of product.colors) {
      const savedColor = savedState?.colors[color.colorId];
      const currentPrice = color.price;
      const oldPrice = color.oldPrice;

      let priceTag = `¥${currentPrice}`;
      if (oldPrice && oldPrice > currentPrice) {
        const discount = Math.round((1 - currentPrice / oldPrice) * 100);
        priceTag += chalk.red(` (原价 ¥${oldPrice} -${discount}%)`);
      }

      console.log(`\n  🎨 款式: ${chalk.bold(color.name)} | 现价: ${chalk.green(priceTag)}`);

      // 1. 降价检测
      let isPriceDrop = false;
      let dropReason = '';

      if (target.notifyPriceDrop !== false) {
        if (target.targetPrice && currentPrice <= target.targetPrice) {
          if (savedColor?.priceAlertSent !== currentPrice) {
            isPriceDrop = true;
            dropReason = `现价 ¥${currentPrice} 已低于或等于您的心理预期价 ¥${target.targetPrice}！`;
          }
        } else if (savedColor && currentPrice < savedColor.price) {
          isPriceDrop = true;
          const diff = Math.round((savedColor.price - currentPrice) * 100) / 100;
          dropReason = `相比上次检查降价了 ¥${diff} (现价 ¥${currentPrice}，原价 ¥${savedColor.price})！`;
        }
      }

      if (isPriceDrop) {
        const alertTitle = `🏷️ Zara 降价提醒: ${displayName}`;
        const alertMsg = `【款式】${color.name}\n【降价详情】${dropReason}\n【当前价格】¥${currentPrice}`;
        console.log(`    ${chalk.red.bold(`🔥 触发降价告警! ${dropReason}`)}`);
        await this.notifier.notify(alertTitle, alertMsg, target.url);
      }

      // 2. 尺码库存与到货补货检测
      const colorSizesMap: Record<string, string> = {};

      for (const size of color.sizes) {
        const sName = size.name;
        const sId = size.sizeId;
        const currentAvail = size.availability;
        colorSizesMap[sName] = currentAvail;

        // 尺码过滤
        const isMonitored =
          !target.targetSizes ||
          target.targetSizes.length === 0 ||
          target.targetSizes.some(
            (t) =>
              sName.toLowerCase().includes(t.toLowerCase()) ||
              t === sId ||
              t.toUpperCase() === 'ALL'
          );

        let statusText = '';
        if (currentAvail === 'in_stock') statusText = chalk.green('🟢 有货 (In Stock)');
        else if (currentAvail === 'low_on_stock') statusText = chalk.yellow('🟡 少量 (Low Stock)');
        else if (currentAvail === 'back_soon') statusText = chalk.blue('⏳ 即将补货 (Back Soon)');
        else statusText = chalk.gray('🔴 缺货 (Out of Stock)');

        if (isMonitored) {
          statusText = `${chalk.bold(statusText)} ${chalk.yellow('★[监控目标]')}`;
        }

        console.log(`    • 尺码 ${sName.padEnd(16)} : ${statusText}`);

        // 到货告警判断
        if (target.notifyRestock !== false && isMonitored) {
          const lastAvail = savedColor?.sizes[sName];
          const isNowInStock = currentAvail === 'in_stock' || currentAvail === 'low_on_stock';
          if (
            (lastAvail === 'out_of_stock' || lastAvail === 'back_soon') &&
            isNowInStock
          ) {
            const alertTitle = `🎉 Zara 到货补货提醒: ${displayName}`;
            const alertMsg = `您关注的尺码已恢复现货！\n【款式】${color.name}\n【尺码】${sName}\n【当前价格】¥${currentPrice}`;
            console.log(`      ${chalk.green.bold(`🚀 触发补货告警! 尺码 ${sName} 恢复现货!`)}`);
            await this.notifier.notify(alertTitle, alertMsg, target.url);
          }
        }
      }

      newColorsState[color.colorId] = {
        name: color.name,
        price: currentPrice,
        oldPrice,
        sizes: colorSizesMap,
        priceAlertSent: isPriceDrop ? currentPrice : savedColor?.priceAlertSent,
      };
    }

    // 3. 线下实体店库存查询
    if (target.checkStores) {
      await this.queryStoresStock(
        product.productId,
        displayName,
        target.preferredCity || '上海',
        target.targetSizes
      );
    }

    this.stateManager.setProductState(prodKey, {
      name: displayName,
      colors: newColorsState,
    });
  }

  async queryStoresStock(
    productId: number,
    productName: string,
    city: string = '上海',
    targetSizes?: string[],
    radiusKm: number = 50
  ): Promise<void> {
    console.log(`\n  🏢 ${chalk.bold(`正在查询线下实体店库存 [${city}]...`)}`);
    const stores = await this.client.searchPhysicalStores(city, radiusKm);
    if (stores.length === 0) {
      console.log(chalk.yellow(`    未找到 ${city} 的相关 Zara 实体门店或网络超时。`));
      return;
    }

    const storeIds = stores.slice(0, 15).map((s) => s.id);
    const stocks = await this.client.getStoreStock(productId, storeIds, targetSizes);
    const storeMap = new Map<number, (typeof stores)[0]>(stores.map((s) => [s.id, s]));

    let hasStockCount = 0;
    for (const st of stocks) {
      const meta = storeMap.get(st.storeId);
      const sName = meta?.name || `门店 #${st.storeId}`;
      const sAddr = meta?.address || '';
      const sCity = meta?.city || city;

      const totalItems = Object.values(st.sizesStock).reduce((acc, v) => acc + v.stock, 0);
      if (totalItems > 0) {
        hasStockCount++;
        console.log(`    📍 ${chalk.green.bold(sName)} (${sCity}) - 总计现货: ${chalk.bold(String(totalItems))} 件`);
        if (sAddr) {
          console.log(`       地址: ${chalk.gray(sAddr)}`);
        }
        for (const [sLabel, details] of Object.entries(st.sizesStock)) {
          if (details.stock > 0) {
            const locDesc = `在售区: ${details.salesArea}件 | 内仓: ${details.warehouse}件`;
            console.log(`       • 尺码 ${sLabel.padEnd(14)} : ${chalk.green(`${details.stock} 件`)} (${chalk.gray(locDesc)})`);
          }
        }
      } else {
        console.log(`    📍 ${chalk.gray(`${sName} - 暂无现货`)}`);
      }
    }

    if (hasStockCount === 0) {
      console.log(chalk.yellow(`    ⚠ ${city} 暂无任何门店有该商品现货。`));
    }
  }

  async runOnce(): Promise<void> {
    const targets = (this.config.targets || []).filter((t) => t.enabled !== false);
    if (targets.length === 0) {
      console.log(chalk.yellow('config.json 中未配置任何监控商品！'));
      console.log('提示: 使用 npm run add -- --url <商品URL> 快速添加。');
      return;
    }

    console.log(chalk.cyan(`开始执行 Zara 全量库存与价格巡检 (共 ${targets.length} 个目标)...`));
    for (const t of targets) {
      try {
        await this.checkTarget(t);
      } catch (err) {
        console.error(`处理目标 ${t.url} 异常:`, err);
      }
    }
    console.log(`\n${chalk.green('✔ 所有目标巡检完成！')}\n`);
  }

  async runWatch(): Promise<void> {
    const interval = (this.config.intervalSeconds || 60) * 1000;
    console.log(`\n${chalk.cyan('='.repeat(65))}`);
    console.log(`${chalk.bold.green('🚀 Zara 实时库存与降价监控守护进程已启动 (TypeScript)')}`);
    console.log(chalk.cyan('-'.repeat(65)));
    console.log(`  • 轮询间隔: ${this.config.intervalSeconds || 60} 秒`);
    console.log(`  • 监控目标数: ${this.config.targets?.length || 0}`);
    console.log(chalk.cyan('='.repeat(65)));

    const loop = async () => {
      const targets = (this.config.targets || []).filter((t) => t.enabled !== false);
      for (const t of targets) {
        try {
          await this.checkTarget(t);
        } catch (err) {
          console.error(`巡检异常:`, err);
        }
      }
    };

    await loop();
    setInterval(loop, interval);
  }
}
