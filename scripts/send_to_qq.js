import fs from 'fs';

/**
 * 通过本机 QQ 机器人向用户推送消息
 * @param {string} content 消息内容
 */
export async function sendQQNotification(content) {
  const configPath = '/Users/lemon/01-Projects/agy-qq-bot/config.json';
  const sessionsPath = '/Users/lemon/01-Projects/agy-qq-bot/sessions.json';

  if (!fs.existsSync(configPath)) {
    throw new Error('未找到 QQ 机器人配置文件: ' + configPath);
  }

  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  let userId = '726621884C7222C8EA8661B581EB9864';

  if (fs.existsSync(sessionsPath)) {
    const sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'));
    const firstKey = Object.keys(sessions)[0];
    if (firstKey && firstKey.startsWith('c2c:')) {
      userId = firstKey.replace('c2c:', '');
    }
  }

  // 获取 Token
  const tokenRes = await fetch('https://bots.qq.com/app/getAppAccessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appId: cfg.appId,
      clientSecret: cfg.appSecret
    })
  });

  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;
  if (!token) {
    throw new Error('获取 QQ AccessToken 失败: ' + JSON.stringify(tokenData));
  }

  const targetUrl = `https://api.sgroup.qq.com/v2/users/${userId}/messages`;
  const res = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `QQBot ${token}`
    },
    body: JSON.stringify({
      content,
      msg_type: 0
    })
  });

  const result = await res.json();
  return result;
}

if (process.argv[1]?.endsWith('send_to_qq.js')) {
  const msg = process.argv.slice(2).join(' ') || 'Zara 监控推送测试';
  sendQQNotification(msg)
    .then(r => console.log('发送成功:', r.id))
    .catch(console.error);
}
