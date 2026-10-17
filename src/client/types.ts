/**
 * Zara 库存监控系统 TypeScript 类型定义
 */

export type AvailabilityStatus = 'in_stock' | 'out_of_stock' | 'low_on_stock' | 'back_soon' | string;

export interface ZaraSize {
  sizeId: string;
  name: string;
  sku: number;
  availability: AvailabilityStatus;
}

export interface ZaraColor {
  colorId: string;
  name: string;
  reference: string;
  price: number; // 人民币 元 (保留2位小数)
  oldPrice?: number;
  sizes: ZaraSize[];
}

export interface ZaraProduct {
  productId: number;
  name: string;
  reference: string;
  url: string;
  colors: ZaraColor[];
  updateTime: string;
}

export interface ZaraPhysicalStore {
  id: number;
  name: string;
  city: string;
  address: string;
  lat?: number;
  lng?: number;
}

export interface SizeStockBreakdown {
  sizeId: string;
  sizeName: string;
  stock: number;
  salesArea: number;
  warehouse: number;
}

export interface ZaraStoreStock {
  storeId: number;
  storeName: string;
  city: string;
  address: string;
  sizesStock: Record<string, SizeStockBreakdown>;
}

export interface WatchTarget {
  name?: string;
  url: string;
  targetSizes?: string[];
  targetPrice?: number;
  notifyRestock?: boolean;
  notifyPriceDrop?: boolean;
  checkStores?: boolean;
  preferredCity?: string;
  enabled?: boolean;
}

export interface NotifyConfig {
  BARK_KEY?: string;
  SERVERCHAN_KEY?: string;
  PUSHDEER_KEY?: string;
  FEISHU_WEBHOOK?: string;
  DINGTALK_WEBHOOK?: string;
  TG_BOT_TOKEN?: string;
  TG_CHAT_ID?: string;
}

export interface AppConfig {
  targets: WatchTarget[];
  notify: NotifyConfig;
  intervalSeconds: number;
  proxy?: string;
}
