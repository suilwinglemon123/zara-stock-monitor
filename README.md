# Zara 智能库存与降价监控助手 (Zara Stock & Price Monitor)

基于 **TypeScript** 与 **Node.js** 开发的 Zara 全自动智能库存监控与到货/降价预警系统。

支持线上官网与线下实体门店双向联动，具备毫秒级缺货到货检测、精准实体店货架/内仓库存查询、心理价位降价警报及多渠道即时推送通知功能。

---

## 🌟 核心特性

- 🎯 **缺货到货极速预警 (Restock Alert)**：
  实时追踪指定商品及目标尺码的售卖状态。一旦尺码状态由 `out_of_stock`（缺货）或 `back_soon`（即将补货）变为 `in_stock`（有货）或 `low_on_stock`（库存紧张），立刻触发高优先级抢购提醒。
- 🏬 **线下实体店精确件数查询 (In-Store Stock)**：
  深度适配 Zara 门店定位接口与商品在库数据，支持全国主流城市经纬度自动解析。不仅能查询某城市各门店是否有货，还能精确拆解并显示**在售陈列区 (Sales Area)** 与 **内部仓库 (Warehouse)** 的真实剩余件数。
- 💰 **心理价位与降价通知 (Price Drop Alert)**：
  可针对单品配置心理目标价格（Target Price）。当官方降价促销、折扣调整或低于指定阈值时，自动计算折扣幅度并发送降价警报。
- 📢 **全平台多渠道推送集成 (Multi-Channel Notifications)**：
  内置完备的消息调度中心，开箱即用支持：
  - **macOS**：原生桌面系统弹窗与提示音（通过 `osascript`）
  - **iOS**：Bark 即时推送（支持分组、角标与自定义铃声）
  - **微信**：Server酱 (Turbo版)、PushDeer 微信卡片推送
  - **办公协作**：飞书自定义群机器人 Webhook、钉钉自定义群机器人
  - **海外/跨平台**：Telegram Bot 消息通道
- 🛡️ **自适应反爬与网络加速 (Akamai Bypass)**：
  底层采用 `undici` 现代 HTTP 客户端，内置全量 Cookie 容器与自动代理探测逻辑（默认优先复用本地 `127.0.0.1:1082` 等代理通道），平稳规避 Akamai Bot Manager 的 403 频率拦截。
- 💾 **轻量级持久化去重 (Smart State Tracking)**：
  本地维护 `state.json` 状态缓存，智能比对每次抓取的库存快照与价格指纹，坚决杜绝同个到货事件的重复骚扰轰炸。

---

## 📁 目录结构

```text
zara-stock-monitor/
├── src/
│   ├── client/
│   │   ├── geo-data.ts        # 全国主要省市经纬度映射字典 (支持 24+ 重点城市)
│   │   ├── types.ts           # 完整数据模型与 TypeScript 接口定义
│   │   └── zara-client.ts     # Zara 逆向 API 客户端 (包含 HTML Payload 提取与门店查询)
│   ├── services/
│   │   ├── monitor-engine.ts  # 核心监控引擎与差异告警计算中心
│   │   ├── notifier.ts        # 多通道推送适配器 (macOS, Bark, 微信, 飞书, 钉钉, TG)
│   │   └── state-manager.ts   # 本地状态追踪与去重管理器 (state.json)
│   ├── cli/
│   │   └── commands.ts        # CLI 命令交互实现 (check, watch, store, add, list 等)
│   └── index.ts               # CLI 统一入口 (Commander 框架)
├── config.json                # 用户监控项与推送秘钥配置文件
├── package.json               # 项目依赖与执行脚本
├── tsconfig.json              # TypeScript 严格编译器配置
└── README.md                  # 项目使用与架构说明文档
```

---

## 🛠️ 环境准备与快速开始

### 1. 环境需求
- **Node.js**: `>= 20.0.0` (推荐 Node.js 22 或 24 LTS)
- **npm** 或 **pnpm**

### 2. 安装依赖
```bash
git clone https://github.com/suilwinglemon123/zara-stock-monitor.git
cd zara-stock-monitor
npm install
```

### 3. 构建编译 (可选)
项目内置 `tsx` 支持直接执行 TypeScript 源码，也可以一键编译为标准 ESM JavaScript：
```bash
npm run build
```

---

## 💻 命令行使用指南

### ① 执行一次完整全量检查
扫描 `config.json` 中配置的所有商品，检查官网线上尺码与线下实体店库存，如发现到货或降价立刻推送：
```bash
npm run check
# 或者
npx tsx src/index.ts check
```

### ② 启动持续后台循环监控 (Watch Mode)
以设定的间隔时间（默认 300 秒）在终端前台或后台常驻守护监控：
```bash
# 默认按配置间隔轮询
npm run watch

# 自定义轮询间隔 (例如每 60 秒检查一次)
npm run watch -- --interval 60
```

### ③ 即时查询线下实体店详细库存 (Store Query)
无需配置监控项，直接在命令行中实时检索某个商品在指定城市线下门店的库存件数分布：
```bash
# 查询某款工装裤在上海所有门店的 36 码在架与内仓件数
npm run store -- \
  --url "https://www.zara.cn/cn/zh/zw-系列工装裤-p08246261.html" \
  --city "上海" \
  --size "36"

# 也可指定搜索方圆半径 (单位公里，默认 25km)
npm run store -- \
  --url "https://www.zara.cn/cn/zh/zw-系列工装裤-p08246261.html" \
  --city "北京" \
  --radius 35
```
*终端将清晰列出每一家门店的名称、地址，以及在售区 (Sales Area) 和内仓 (Warehouse) 的具体存货件数。*

### ④ 快捷添加监控目标 (Add Target)
通过命令行交互追加监控目标至 `config.json`：
```bash
npm run add -- \
  --url "https://www.zara.cn/cn/zh/zw-系列工装裤-p08246261.html" \
  --name "ZW 工装裤" \
  --sizes 36,38 \
  --price 350 \
  --city "上海"
```

### ⑤ 查看当前所有监控项 (List Targets)
```bash
npm run list
```

### ⑥ 测试各推送通道连通性 (Test Notifications)
验证已填写的 Bark、Server酱、飞书、钉钉、Telegram 等推送秘钥是否配置正确：
```bash
npm run test-notify
```

---

## ⚙️ 配置文件说明 (`config.json`)

在项目根目录下创建或编辑 `config.json`：

```json
{
  "intervalSeconds": 300,
  "proxy": "http://127.0.0.1:1082",
  "notify": {
    "BARK_KEY": "your_bark_device_key",
    "SERVERCHAN_KEY": "SCTxxxxxx",
    "PUSHDEER_KEY": "PDUxxxxxx",
    "FEISHU_WEBHOOK": "https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxx",
    "DINGTALK_WEBHOOK": "https://oapi.dingtalk.com/robot/send?access_token=xxxxxx",
    "TG_BOT_TOKEN": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
    "TG_CHAT_ID": "123456789"
  },
  "targets": [
    {
      "name": "ZW 系列工装裤",
      "url": "https://www.zara.cn/cn/zh/zw-系列工装裤-p08246261.html",
      "targetSizes": ["36", "38"],
      "targetPrice": 350.0,
      "notifyRestock": true,
      "notifyPriceDrop": true,
      "checkStores": true,
      "preferredCity": "上海",
      "enabled": true
    }
  ]
}
```

### 字段说明：
- `intervalSeconds`：循环监控时的检查轮询间隔（单位：秒）。
- `proxy`：HTTP/HTTPS 代理地址。如本地运行有代理客户端，建议开启以保证与 Zara API 稳定通信。
- `notify`：推送渠道秘钥。留空则不触发该渠道，支持同时配置多个渠道并发推送。
- `targets`：监控商品列表：
  - `url`：Zara 商品网页 URL（必须包含 `-p{id}.html`）。
  - `targetSizes`：需要特别关注的尺码数组（如 `["S", "M"]` 或 `["36", "38"]`），留空或不填则监控该商品全部尺码。
  - `targetPrice`：心理期望价（元）。当商品价格小于等于此金额时发送降价告警。
  - `notifyRestock`：是否开启补货到货预警（默认 `true`）。
  - `notifyPriceDrop`：是否开启降价预警（默认 `true`）。
  - `checkStores`：是否同步检查所选城市的实体门店库存（默认 `true`）。
  - `preferredCity`：实体店库存优先检索的城市名称（如 `"上海"`、`"北京"`、`"深圳"` 等）。
  - `enabled`：是否启用此监控项（`true` / `false`）。

---

## 🔒 协议与反爬机制说明

Zara 线上平台对高频抓取有严格的 Akamai WAF 防护。本工具通过以下策略保证长期稳定运行：
1. **真实请求指纹模拟**：完整复刻 Chrome/Safari 的标准 HTTP Header，包括客户端安全凭据与语言环境请求头。
2. **轻量会话与 Cookie 保持**：自动保留会话期间派发的跟踪 Cookie 与 Session 令牌。
3. **结构化原生 Payload 解构**：直接从服务端直出的 `window.zara.viewPayload` 渲染数据树中解析颜色、SKU、尺码库存与价格属性，无需启动重型无头浏览器 (Headless Chrome/Puppeteer)，性能极佳且内存占用极低。
4. **自适应分批查询**：门店库存查询自动按批次合并物理门店 ID，最小化网络往返延迟。

---

## 📄 License

本项目基于 [MIT](LICENSE) 许可证开源。仅供技术学习与个人购物便利使用，请勿用于高频恶意攻击或商业违规用途。
