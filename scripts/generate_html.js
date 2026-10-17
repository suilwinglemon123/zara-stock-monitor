import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseDir = path.resolve(__dirname, '..');

const jsonPath = path.join(baseDir, 'xinjiekou_sale_stock.json');
const list = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zara 南京新街口旗舰店 · 特价现货速查看板</title>
  <style>
    :root {
      --bg: #0b0d13;
      --card-bg: #151821;
      --card-border: #232736;
      --text-main: #f3f4f6;
      --text-muted: #94a3b8;
      --accent: #ff4757;
      --accent-green: #10b981;
      --accent-blue: #38bdf8;
      --tag-bg: rgba(255, 71, 87, 0.15);
      --shelf-bg: rgba(16, 185, 129, 0.12);
      --wh-bg: rgba(56, 189, 248, 0.12);
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background-color: var(--bg);
      color: var(--text-main);
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "PingFang SC", "Segoe UI", Roboto, sans-serif;
      padding: 24px 20px 60px 20px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    header {
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--card-border);
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 16px;
    }
    h1 {
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.5px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .badge-live {
      background: var(--accent-green);
      color: #0b0d13;
      font-size: 11px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .subtitle {
      color: var(--text-muted);
      font-size: 13px;
      margin-top: 6px;
    }
    .stats-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 12px;
      margin-top: 18px;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 12px 16px;
    }
    .stat-label {
      font-size: 11px;
      color: var(--text-muted);
      margin-bottom: 3px;
    }
    .stat-value {
      font-size: 20px;
      font-weight: 700;
      color: var(--text-main);
    }
    .stat-value.red { color: var(--accent); }
    .stat-value.green { color: var(--accent-green); }
    .stat-value.blue { color: var(--accent-blue); }

    .controls {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      margin-bottom: 24px;
      background: var(--card-bg);
      padding: 12px 16px;
      border-radius: 14px;
      border: 1px solid var(--card-border);
    }
    .filter-tabs {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .tab-btn {
      background: #1e2230;
      border: 1px solid var(--card-border);
      color: var(--text-muted);
      padding: 7px 14px;
      border-radius: 20px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s ease;
    }
    .tab-btn:hover {
      color: var(--text-main);
      border-color: #3b4259;
    }
    .tab-btn.active {
      background: var(--text-main);
      color: #0b0d13;
      border-color: var(--text-main);
      font-weight: 600;
    }
    .search-input {
      background: #1e2230;
      border: 1px solid var(--card-border);
      color: var(--text-main);
      padding: 7px 14px;
      border-radius: 20px;
      font-size: 13px;
      min-width: 220px;
      outline: none;
      transition: border-color 0.2s;
    }
    .search-input:focus {
      border-color: var(--accent-blue);
    }
    .sort-select {
      background: #1e2230;
      border: 1px solid var(--card-border);
      color: var(--text-main);
      padding: 7px 12px;
      border-radius: 20px;
      font-size: 13px;
      outline: none;
      cursor: pointer;
    }

    .product-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
    }
    .product-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
    }
    .product-card:hover {
      transform: translateY(-4px);
      border-color: #3b4259;
      box-shadow: 0 14px 28px rgba(0,0,0,0.5);
    }
    .img-wrap {
      position: relative;
      width: 100%;
      height: 360px;
      background: #11141c;
      overflow: hidden;
    }
    .img-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top center;
      transition: transform 0.35s ease;
    }
    .product-card:hover .img-wrap img {
      transform: scale(1.04);
    }
    .tag-section {
      position: absolute;
      top: 10px;
      left: 10px;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      background: rgba(11, 13, 19, 0.85);
      backdrop-filter: blur(8px);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .tag-section.men { color: #38bdf8; }
    .tag-section.women { color: #f472b6; }
    .tag-discount {
      position: absolute;
      top: 10px;
      right: 10px;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 800;
      background: var(--accent);
      color: #fff;
      box-shadow: 0 4px 10px rgba(255,71,87,0.4);
    }
    .stock-badge-total {
      position: absolute;
      bottom: 10px;
      right: 10px;
      background: rgba(11, 13, 19, 0.85);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: var(--accent-green);
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 20px;
    }

    .card-body {
      padding: 14px;
      display: flex;
      flex-direction: column;
      flex-grow: 1;
    }
    .product-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-main);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      min-height: 42px;
      line-height: 1.4;
    }
    .ref-code {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 3px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .price-row {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin: 8px 0 12px 0;
    }
    .current-price {
      font-size: 20px;
      font-weight: 800;
      color: var(--accent);
    }
    .old-price {
      font-size: 12px;
      color: var(--text-muted);
      text-decoration: line-through;
    }
    .sizes-box {
      background: #0f121a;
      border-radius: 8px;
      padding: 8px 10px;
      margin-top: auto;
      margin-bottom: 12px;
      border: 1px solid rgba(255,255,255,0.04);
    }
    .sizes-title {
      font-size: 10px;
      color: var(--text-muted);
      font-weight: 600;
      margin-bottom: 5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .size-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      padding: 3px 0;
      border-bottom: 1px dashed rgba(255,255,255,0.05);
    }
    .size-item:last-child {
      border-bottom: none;
    }
    .size-name {
      font-weight: 600;
      color: #cbd5e1;
    }
    .size-locs {
      font-size: 10px;
      display: flex;
      gap: 5px;
    }
    .loc-shelf {
      background: var(--shelf-bg);
      color: #10b981;
      padding: 1px 5px;
      border-radius: 4px;
    }
    .loc-wh {
      background: var(--wh-bg);
      color: #38bdf8;
      padding: 1px 5px;
      border-radius: 4px;
    }
    .btn-buy {
      display: block;
      width: 100%;
      text-align: center;
      background: #1e2230;
      border: 1px solid var(--card-border);
      color: var(--text-main);
      padding: 8px 0;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s;
    }
    .btn-buy:hover {
      background: #2a3145;
      border-color: #4a5578;
      color: #fff;
    }
    footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid var(--card-border);
      color: var(--text-muted);
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-top">
        <div>
          <h1>Zara 南京新街口旗舰店 · 特价现货速查看板 <span class="badge-live">LIVE</span></h1>
          <p class="subtitle">📍 门店地址：江苏省南京市秦淮区中山南路 49 号 (新街口商圈) | 仅呈现店内当前有真实在库现货的官方特价折扣商品</p>
        </div>
      </div>

      <div class="stats-bar">
        <div class="stat-card">
          <div class="stat-label">新街口店内打折款</div>
          <div class="stat-value">41 款</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">男士特价在库</div>
          <div class="stat-value blue">13 款</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">女士特价在库</div>
          <div class="stat-value red">28 款</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">新街口店内总件数</div>
          <div class="stat-value green">236 件</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">统一折扣力度</div>
          <div class="stat-value red">40% OFF (6折)</div>
        </div>
      </div>
    </header>

    <div class="controls">
      <div class="filter-tabs">
        <button class="tab-btn active" data-filter="all">全部商品 (41)</button>
        <button class="tab-btn" data-filter="男士">👔 男士专区 (13)</button>
        <button class="tab-btn" data-filter="女士">👗 女士专区 (28)</button>
        <button class="tab-btn" data-filter="外套">🧥 外套 / 夹克 / 西装</button>
        <button class="tab-btn" data-filter="裤">👖 裤装 / 牛仔</button>
        <button class="tab-btn" data-filter="鞋">👠 鞋靴</button>
      </div>
      <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
        <input type="text" class="search-input" id="searchInput" placeholder="搜索商品名、款号、尺码...">
        <select class="sort-select" id="sortSelect">
          <option value="stock-desc">按店内现货件数 ↓</option>
          <option value="price-asc">按折后价格 ↑ (便宜在前)</option>
          <option value="price-desc">按折后价格 ↓</option>
        </select>
      </div>
    </div>

    <div class="product-grid" id="productGrid"></div>

    <footer>
      <p>数据来源：Zara 官方生产服务实时直连 | 在售陈列区与内仓实时件数解析 | 编写与生成：Zara Stock Monitor</p>
    </footer>
  </div>

  <script>
    const PRODUCTS = __PRODUCTS_JSON__;

    let activeFilter = 'all';
    let searchQuery = '';
    let sortMode = 'stock-desc';

    function renderProducts() {
      const grid = document.getElementById('productGrid');
      
      let filtered = PRODUCTS.filter(item => {
        if (activeFilter === '男士' && item.section !== '男士') return false;
        if (activeFilter === '女士' && item.section !== '女士') return false;
        if (activeFilter === '外套' && !['WIND-JACKET', 'BLAZER', 'CARDIGAN'].includes(item.familyName) && !item.name.includes('外套') && !item.name.includes('夹克') && !item.name.includes('西装')) return false;
        if (activeFilter === '裤' && !item.familyName.includes('TROUSERS') && !item.name.includes('裤')) return false;
        if (activeFilter === '鞋' && !item.familyName.includes('SHOES') && !item.familyName.includes('BOOT') && !item.name.includes('鞋') && !item.name.includes('靴')) return false;

        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchName = (item.name || '').toLowerCase().includes(q);
          const matchRef = (item.ref || '').toLowerCase().includes(q);
          const matchSizes = Object.keys(item.sizesStock || {}).some(s => s.toLowerCase().includes(q));
          if (!matchName && !matchRef && !matchSizes) return false;
        }

        return true;
      });

      filtered.sort((a, b) => {
        if (sortMode === 'stock-desc') return b.totalStock - a.totalStock;
        if (sortMode === 'price-asc') return a.price - b.price;
        if (sortMode === 'price-desc') return b.price - a.price;
        return 0;
      });

      if (filtered.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px 0; color: var(--text-muted); font-size: 15px;">没有找到匹配的现货商品</div>';
        return;
      }

      grid.innerHTML = filtered.map(item => {
        const sizesHtml = Object.entries(item.sizesStock).map(([sz, loc]) => {
          return '<div class="size-item">' +
            '<span class="size-name">' + sz + '</span>' +
            '<div class="size-locs">' +
              '<span class="loc-shelf">架上 ' + loc.salesArea + '</span>' +
              '<span class="loc-wh">内仓 ' + loc.warehouse + '</span>' +
            '</div>' +
          '</div>';
        }).join('');

        const isMen = item.section === '男士';
        const imgUrl = item.imageUrl || 'https://static.zara.net/assets/public/9508/1026/d3a248e3af9c/09567096e064/04344654732-h1/04344654732-h1.jpg';

        return '<div class="product-card">' +
          '<div class="img-wrap">' +
            '<span class="tag-section ' + (isMen ? 'men' : 'women') + '">' + item.section + '</span>' +
            '<span class="tag-discount">-' + item.discountRate + '% OFF</span>' +
            '<span class="stock-badge-total">现货 ' + item.totalStock + ' 件</span>' +
            '<img src="' + imgUrl + '" alt="' + item.name + '" loading="lazy">' +
          '</div>' +
          '<div class="card-body">' +
            '<div class="card-header">' +
              '<div class="product-name" title="' + item.name + '">' + item.name + '</div>' +
              '<div class="ref-code">Ref: ' + item.ref + (item.colorName ? ' · ' + item.colorName : '') + '</div>' +
            '</div>' +
            '<div class="price-row">' +
              '<span class="current-price">¥' + item.price + '</span>' +
              (item.oldPrice ? '<span class="old-price">¥' + item.oldPrice + '</span>' : '') +
            '</div>' +
            '<div class="sizes-box">' +
              '<div class="sizes-title">店内各尺码在售 / 内仓分布</div>' +
              sizesHtml +
            '</div>' +
            '<a href="' + item.url + '" target="_blank" class="btn-buy">官网详情 ↗</a>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        renderProducts();
      });
    });

    document.getElementById('searchInput').addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      renderProducts();
    });

    document.getElementById('sortSelect').addEventListener('change', (e) => {
      sortMode = e.target.value;
      renderProducts();
    });

    renderProducts();
  </script>
</body>
</html>`;

const finalHtml = htmlContent.replace('__PRODUCTS_JSON__', JSON.stringify(list));

const desktopFile = '/Users/lemon/Desktop/nanjing_xinjiekou_sale.html';
const projectFile = path.join(baseDir, 'nanjing_xinjiekou_sale.html');

fs.writeFileSync(desktopFile, finalHtml, 'utf8');
fs.writeFileSync(projectFile, finalHtml, 'utf8');

console.log('Successfully written to:', desktopFile);
console.log('Successfully written to:', projectFile);
