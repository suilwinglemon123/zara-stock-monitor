import net from 'node:net';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
import { getCityCoordinates } from './geo-data.js';
import type {
  ZaraColor,
  ZaraPhysicalStore,
  ZaraProduct,
  ZaraSize,
  ZaraStoreStock,
  SizeStockBreakdown,
} from './types.js';

export class ZaraClient {
  private cookies: Map<string, string> = new Map();
  private timeoutMs: number;
  private proxyChecked: boolean = false;

  constructor(timeoutMs: number = 15000) {
    this.timeoutMs = timeoutMs;
  }

  /**
   * 自动检测本地 127.0.0.1:1082 代理，连通时挂载全局 ProxyAgent
   */
  private async ensureProxy(): Promise<void> {
    if (this.proxyChecked) return;
    this.proxyChecked = true;

    const isPortOpen = await new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(400);
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      socket.once('error', () => {
        socket.destroy();
        resolve(false);
      });
      socket.connect(1082, '127.0.0.1');
    });

    if (isPortOpen) {
      setGlobalDispatcher(new ProxyAgent('http://127.0.0.1:1082'));
    }
  }

  private getCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  private saveCookies(res: Response): void {
    const rawHeaders: string[] =
      typeof res.headers.getSetCookie === 'function'
        ? res.headers.getSetCookie()
        : [res.headers.get('set-cookie') || ''];

    for (const header of rawHeaders) {
      if (!header) continue;
      const parts = header.split(';')[0]?.trim();
      if (parts) {
        const eqIdx = parts.indexOf('=');
        if (eqIdx > 0) {
          const name = parts.slice(0, eqIdx).trim();
          const val = parts.slice(eqIdx + 1).trim();
          this.cookies.set(name, val);
        }
      }
    }
  }

  private getHeaders(referer?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    };
    if (referer) {
      headers['Referer'] = referer;
      headers['X-Requested-With'] = 'XMLHttpRequest';
    }
    const cookieStr = this.getCookieHeader();
    if (cookieStr) {
      headers['Cookie'] = cookieStr;
    }
    return headers;
  }

  /**
   * 获取 Zara 商品款式、价格与线上尺码库存
   */
  async getProduct(urlOrId: string): Promise<ZaraProduct | null> {
    await this.ensureProxy();
    let targetUrl = urlOrId.trim();
    if (!targetUrl.startsWith('http')) {
      const cleanId = targetUrl.replace(/^[pP]/, '');
      targetUrl = `https://www.zara.cn/cn/zh/-p${cleanId}.html`;
    }

    try {
      const res = await fetch(targetUrl, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!res.ok) {
        console.error(`[ZaraClient] 获取商品失败: HTTP ${res.status}`);
        return null;
      }

      this.saveCookies(res);
      const html = await res.text();
      const match = html.match(/window\.zara\.viewPayload\s*=\s*(\{.*?\});/);
      if (!match || !match[1]) {
        console.error('[ZaraClient] 页面未包含 window.zara.viewPayload 数据体');
        return null;
      }

      const payload = JSON.parse(match[1]);
      const prod = payload.product;
      if (!prod) return null;

      const colors: ZaraColor[] = (prod.detail?.colors || []).map((c: any) => {
        const rawPrice = c.price ?? 0;
        const rawOldPrice = c.oldPrice;
        const price = Math.round((rawPrice / 100) * 100) / 100;
        const oldPrice = rawOldPrice ? Math.round((rawOldPrice / 100) * 100) / 100 : undefined;

        const sizes: ZaraSize[] = (c.sizes || []).map((s: any) => ({
          sizeId: String(s.id ?? ''),
          name: String(s.name ?? ''),
          sku: Number(s.sku ?? 0),
          availability: String(s.availability ?? 'out_of_stock'),
        }));

        return {
          colorId: String(c.id ?? ''),
          name: String(c.name ?? ''),
          reference: String(c.reference ?? ''),
          price,
          oldPrice,
          sizes,
        };
      });

      return {
        productId: Number(prod.id),
        name: String(prod.name || '未命名商品'),
        reference: String(prod.detail?.reference || ''),
        url: targetUrl,
        colors,
        updateTime: new Date().toLocaleString('zh-CN'),
      };
    } catch (err) {
      console.error('[ZaraClient] 抓取商品数据异常:', err);
      return null;
    }
  }

  /**
   * 检索指定城市周边的 Zara 线下实体门店列表
   */
  async searchPhysicalStores(cityName: string = '上海', radiusKm: number = 50): Promise<ZaraPhysicalStore[]> {
    await this.ensureProxy();
    const [lat, lng] = getCityCoordinates(cityName);
    const url = `https://www.zara.cn/cn/zh/stores-locator/extended/search?lat=${lat}&lng=${lng}&radius=${radiusKm}&ajax=true`;

    try {
      const res = await fetch(url, {
        headers: this.getHeaders('https://www.zara.cn/cn/zh/z-stores-st1404.html'),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!res.ok) {
        console.error(`[ZaraClient] 检索门店列表失败: HTTP ${res.status}`);
        return [];
      }

      this.saveCookies(res);
      const data: any = await res.json();
      if (!Array.isArray(data)) return [];

      return data.map((item: any) => {
        const addrLines = item.addressLines || item.address?.addressLines || [];
        const cityNameResolved = item.city || item.address?.city || cityName;
        const addrStr = addrLines.length > 0 ? addrLines.join(' ') : cityNameResolved;
        return {
          id: Number(item.id),
          name: String(item.name || 'Zara 门店'),
          city: String(cityNameResolved),
          address: addrStr,
          lat: item.latitude ?? item.geoLocation?.latitude,
          lng: item.longitude ?? item.geoLocation?.longitude,
        };
      });
    } catch (err) {
      console.error('[ZaraClient] 检索门店异常:', err);
      return [];
    }
  }

  /**
   * 查询指定商品在各线下实体门店的实时现货分布 (在售区 / 内仓)
   */
  async getStoreStock(
    productId: number,
    storeIds: number[],
    sizeFilter?: string[]
  ): Promise<ZaraStoreStock[]> {
    await this.ensureProxy();
    if (storeIds.length === 0) return [];

    const storeQuery = storeIds.map((sid) => `physicalStoreIds=${sid}`).join('&');
    const url = `https://www.zara.cn/cn/zh/store-product-availability?productId=${productId}&${storeQuery}&ajax=true`;

    try {
      const res = await fetch(url, {
        headers: this.getHeaders(`https://www.zara.cn/cn/zh/-p${productId}.html`),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!res.ok) {
        console.error(`[ZaraClient] 查询实体店库存失败: HTTP ${res.status}`);
        return [];
      }

      this.saveCookies(res);
      const data: any = await res.json();
      const storeList = data.sizesAvailableAndLocationsByPhysicalStores || [];
      const results: ZaraStoreStock[] = [];

      for (const sEntry of storeList) {
        const sid = Number(sEntry.physicalStoreId);
        const sizesMap: Record<string, SizeStockBreakdown> = {};

        for (const sItem of sEntry.sizesAvailability || []) {
          const sLabel = String(sItem.size || '');
          const sId = String(sItem.sizeId || '');
          const stock = Number(sItem.stock || 0);

          // 尺码过滤
          if (sizeFilter && sizeFilter.length > 0) {
            const matched = sizeFilter.some(
              (f) => sLabel.toLowerCase().includes(f.toLowerCase()) || f === sId
            );
            if (!matched) continue;
          }

          let salesArea = 0;
          let warehouse = 0;
          for (const loc of sItem.stockByLocations || []) {
            if (loc.location === 'SALES_AREA') salesArea = Number(loc.stock || 0);
            if (loc.location === 'INTERNAL_WAREHOUSE') warehouse = Number(loc.stock || 0);
          }

          sizesMap[sLabel] = {
            sizeId: sId,
            sizeName: sLabel,
            stock,
            salesArea,
            warehouse,
          };
        }

        results.push({
          storeId: sid,
          storeName: '',
          city: '',
          address: '',
          sizesStock: sizesMap,
        });
      }

      return results;
    } catch (err) {
      console.error('[ZaraClient] 获取实体店库存异常:', err);
      return [];
    }
  }
}
