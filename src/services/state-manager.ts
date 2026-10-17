import fs from 'node:fs';
import path from 'node:path';

export interface ColorState {
  name: string;
  price: number;
  oldPrice?: number;
  sizes: Record<string, string>; // sizeName -> availability
  priceAlertSent?: number;
}

export interface ProductState {
  name: string;
  colors: Record<string, ColorState>;
}

export class StateManager {
  private filePath: string;
  private state: Record<string, ProductState> = {};

  constructor(baseDir: string) {
    this.filePath = path.join(baseDir, 'state.json');
    this.load();
  }

  load(): void {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.state = JSON.parse(raw);
      } catch {
        this.state = {};
      }
    }
  }

  save(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      console.error('[StateManager] 保存 state.json 失败:', err);
    }
  }

  getProductState(productId: number): ProductState | undefined {
    return this.state[String(productId)];
  }

  setProductState(productId: number, state: ProductState): void {
    this.state[String(productId)] = state;
    this.save();
  }
}
