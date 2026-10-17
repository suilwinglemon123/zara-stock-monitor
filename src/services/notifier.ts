import { exec } from 'node:child_process';
import fs from 'node:fs';
import type { NotifyConfig } from '../client/types.js';

export class Notifier {
  private config: NotifyConfig;

  constructor(config: NotifyConfig = {}) {
    this.config = config;
  }

  async notify(title: string, content: string, url?: string): Promise<void> {
    // 1. macOS 桌面通知与系统提示音
    this.notifyMacOS(title, content, url);

    // 2. Bark (iOS 极速推送)
    const barkKey = this.config.BARK_KEY || process.env.BARK_KEY;
    if (barkKey) {
      await this.notifyBark(barkKey, title, content, url);
    }

    // 3. Server酱 (微信通知)
    const serverChanKey = this.config.SERVERCHAN_KEY || process.env.SERVERCHAN_KEY;
    if (serverChanKey) {
      await this.notifyServerChan(serverChanKey, title, content, url);
    }

    // 4. PushDeer
    const pushDeerKey = this.config.PUSHDEER_KEY || process.env.PUSHDEER_KEY;
    if (pushDeerKey) {
      await this.notifyPushDeer(pushDeerKey, title, content, url);
    }

    // 5. 飞书自定义机器人 Webhook
    const feishuWebhook = this.config.FEISHU_WEBHOOK || process.env.FEISHU_WEBHOOK;
    if (feishuWebhook) {
      await this.notifyFeishu(feishuWebhook, title, content, url);
    }

    // 6. Telegram Bot
    const tgToken = this.config.TG_BOT_TOKEN || process.env.TG_BOT_TOKEN;
    const tgChatId = this.config.TG_CHAT_ID || process.env.TG_CHAT_ID;
    if (tgToken && tgChatId) {
      await this.notifyTelegram(tgToken, tgChatId, title, content, url);
    }
  }

  private notifyMacOS(title: string, content: string, _url?: string): void {
    try {
      const soundPath = '/System/Library/Sounds/Glass.aiff';
      if (fs.existsSync(soundPath)) {
        exec(`afplay "${soundPath}"`);
      }
      const safeTitle = title.replace(/"/g, '\\"');
      const safeContent = content.replace(/"/g, '\\"');
      const script = `display notification "${safeContent}" with title "${safeTitle}"`;
      exec(`osascript -e "${script}"`);
    } catch (e) {
      // ignore
    }
  }

  private async notifyBark(key: string, title: string, content: string, url?: string): Promise<void> {
    try {
      const encTitle = encodeURIComponent(title);
      const encContent = encodeURIComponent(content);
      let target = `https://api.day.app/${key}/${encTitle}/${encContent}?sound=alarm.caf&group=ZaraMonitor`;
      if (url) {
        target += `&url=${encodeURIComponent(url)}`;
      }
      await fetch(target, { signal: AbortSignal.timeout(5000) });
    } catch (err) {
      console.warn('[Notifier] Bark 推送失败:', err);
    }
  }

  private async notifyServerChan(key: string, title: string, content: string, url?: string): Promise<void> {
    try {
      const desp = url ? `${content}\n\n[点击前往购买](${url})` : content;
      await fetch(`https://sctapi.ftqq.com/${key}.send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ title, desp }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (err) {
      console.warn('[Notifier] Server酱推送失败:', err);
    }
  }

  private async notifyPushDeer(key: string, title: string, content: string, url?: string): Promise<void> {
    try {
      const desp = url ? `${content}\n\n[点击前往购买](${url})` : content;
      await fetch('https://api2.pushdeer.com/message/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          pushkey: key,
          text: title,
          desp,
          type: 'markdown',
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (err) {
      console.warn('[Notifier] PushDeer 推送失败:', err);
    }
  }

  private async notifyFeishu(webhookUrl: string, title: string, content: string, url?: string): Promise<void> {
    try {
      const payload = {
        msg_type: 'interactive',
        card: {
          header: { title: { tag: 'plain_text', content: title } },
          elements: [
            { tag: 'div', text: { tag: 'lark_md', content } },
            ...(url
              ? [
                  {
                    tag: 'action',
                    actions: [
                      {
                        tag: 'button',
                        text: { tag: 'plain_text', content: '🔗 立即前往 Zara' },
                        type: 'primary',
                        url,
                      },
                    ],
                  },
                ]
              : []),
          ],
        },
      };
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
    } catch (err) {
      console.warn('[Notifier] 飞书推送失败:', err);
    }
  }

  private async notifyTelegram(token: string, chatId: string, title: string, content: string, url?: string): Promise<void> {
    try {
      let text = `*${title}*\n\n${content}`;
      if (url) text += `\n\n[点击前往购买](${url})`;
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (err) {
      console.warn('[Notifier] Telegram 推送失败:', err);
    }
  }
}
