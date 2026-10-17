import fs from 'fs';
import { exec } from 'child_process';
import { ZaraClient } from '../dist/client/zara-client.js';

/**
 * Zara 网页端/API 自动下单与支付链接生成脚本
 * 
 * 流程：
 * 1. 登录 Zara 账号（获取 WCToken / WCTrustedToken / wcCookies）
 * 2. 检查或添加指定商品至购物车
 * 3. 创建结账子购物车会话（Sub-cart Session）
 * 4. 模拟并绑定送货地址（送货上门）
 * 5. 选择独立支付渠道（Alipay / 托管收银台 HPP）
 * 6. 执行预检并提交结账，生成无 OpenID 限制的通用支付链接
 */
export async function createOrderAndGetPaymentLink(options = {}) {
  const {
    logonId = '86-18895369060',
    password = 'Zara123@321',
    sku = 545428588,
    parentId = 545436653,
    autoOpen = false
  } = options;

  const client = new ZaraClient();
  await client.ensureProxy();

  console.log(`[1/6] 正在登录账号: ${logonId}...`);
  const loginUrl = 'https://www.zara.cn/itxrest/1/oam/store/11716/launch?languageId=-7&version=12.16.13.02';
  const loginRes = await fetch(loginUrl, {
    method: 'POST',
    headers: {
      ...client.getHeaders('https://www.zara.cn/'),
      'Content-Type': 'application/json',
      'apikey': '186e68fad9bd145e0cf965f2dc6d25ff708f10cf'
    },
    body: JSON.stringify({
      logonId,
      password,
      device: {
        osVersion: 'Android 15',
        brand: 'OnePlus',
        model: 'ONEPLUS A5010',
        os: 'android',
        id: 'b2ccbbfb-7b66-42b6-8c77-b779ace579c9'
      }
    })
  });

  const loginData = await loginRes.json();
  if (!loginData.identity) {
    throw new Error(`登录失败: ${JSON.stringify(loginData)}`);
  }

  const ident = loginData.identity;
  console.log(`登录成功！用户 ID: ${ident.userId}`);

  const cookieStr = Object.entries(ident.wcCookies || {})
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');

  const authHeaders = {
    ...client.getHeaders('https://www.zara.cn/'),
    'Content-Type': 'application/json',
    'Cookie': cookieStr,
    'userId': String(ident.userId),
    'WCToken': ident.WCToken,
    'WCTrustedToken': ident.WCTrustedToken
  };

  console.log('[2/6] 检查购物车与商品状态...');
  const cartRes = await fetch('https://www.zara.cn/itxrest/3/order/store/11716/cart?languageId=-7', {
    headers: authHeaders
  });
  const cart = await cartRes.json();
  
  let targetItem = cart.items?.find(it => it.sku === sku);
  if (!targetItem) {
    console.log(`购物车中未找到 SKU ${sku}，正在添加...`);
    const addRes = await fetch('https://www.zara.cn/itxrest/1/order/store/11716/cart?languageId=-7', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        cartItems: [{
          datatype: 'product',
          parentId,
          sku,
          quantity: 1
        }]
      })
    });
    const addData = await addRes.json();
    targetItem = addData.items?.[0];
  }

  if (!targetItem) {
    throw new Error('无法将商品放入购物车');
  }

  console.log(`[3/6] 创建结账子购物车会话 (LineId: ${targetItem.id})...`);
  const subCartRes = await fetch('https://www.zara.cn/itxrest/1/order/store/11716/cart?languageId=-7', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      purpose: 'sub-cart',
      cartItems: [{
        datatype: 'product',
        parentId: targetItem.parentId,
        quantity: 1,
        sku: targetItem.sku,
        originalMediaName: 'p',
        originLineId: targetItem.id,
        description: 'select multiple cart items to checkout',
        userContext: {},
        cartId: targetItem.id
      }]
    })
  });

  const draftOrder = await subCartRes.json();
  const orderId = draftOrder.id;
  if (!orderId) {
    throw new Error(`创建结账草稿失败: ${JSON.stringify(draftOrder)}`);
  }
  console.log(`草稿订单创建成功，订单 ID: ${orderId}`);

  console.log('[4/6] 获取地址并匹配最优配送方案...');
  const addrRes = await fetch('https://www.zara.cn/itxrest/1/user/store/11716/address?languageId=-7', {
    headers: authHeaders
  });
  const addrData = await addrRes.json();
  const address = addrData.addresses?.[0];
  if (!address) {
    throw new Error('用户账号下未找到有效收货地址');
  }

  const simDelRes = await fetch(`https://www.zara.cn/itxrest/1/order/store/11716/order/${orderId}/simulateDelivery?languageId=-7`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({})
  });
  const simDelData = await simDelRes.json();
  const homeGroup = simDelData.deliveryGroups?.find(g => g.kind === 'home');
  const method = homeGroup?.deliveries?.[0]?.shippingMethods?.[0];
  if (!method) {
    throw new Error('未获取到有效配送方式');
  }

  const checkPayload = {
    shippingBundle: {
      shippingData: {
        options: [],
        datatype: 'shippingDelivery',
        addressId: address.id
      },
      deliveriesSelection: [
        {
          deliveryProposalId: method.deliveryProposalId,
          deliveryPlanProposalId: method.deliveryPlanProposalId,
          deliveryMethodId: method.deliveryMethodId,
          isOptionSelected: true,
          shippingData: {
            options: [],
            datatype: 'shippingDelivery',
            addressId: address.id
          }
        }
      ]
    },
    billingAddress: {
      ...address,
      isBilling: true
    },
    paymentBundle: {
      datatype: 'paymentBundle',
      paymentData: {},
      paymentGiftCards: [],
      paymentMethodType: 'Alipay'
    }
  };

  // 绑定配送
  await fetch(`https://www.zara.cn/itxrest/4/order/store/11716/order/${orderId}?languageId=-7`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(checkPayload)
  });

  console.log('[5/6] 设定支付方式为 Alipay (支付宝收银台)...');
  await fetch(`https://www.zara.cn/itxrest/2/order/store/11716/order/${orderId}/payment?languageId=-7`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      paymentData: {},
      paymentMethodType: 'Alipay'
    })
  });

  // 预检
  await fetch(`https://www.zara.cn/itxrest/2/order/store/11716/order/${orderId}/check?languageId=-7`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(checkPayload)
  });

  console.log('[6/6] 提交结账，生成独立收银台支付链接...');
  const checkoutRes = await fetch(`https://www.zara.cn/itxrest/3/order/store/11716/order/${orderId}/checkout?languageId=-7`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(checkPayload)
  });

  const checkoutData = await checkoutRes.json();
  const paymentUrl = checkoutData.paymentUrl;

  if (!paymentUrl) {
    throw new Error(`结账未能返回支付链接: ${JSON.stringify(checkoutData)}`);
  }

  console.log('\n======================================================');
  console.log('✅ 下单流程已完成，支付链接生成成功！');
  console.log(`订单 ID: ${orderId}`);
  console.log(`商品名称: ${checkoutData.order?.suborders?.[0]?.items?.[0]?.detail?.name || '测试商品'}`);
  console.log(`订单金额: ¥${((checkoutData.order?.orderTotalAmount || 0) / 100).toFixed(2)}`);
  console.log(`收货地址: ${address.state} ${address.city} ${address.addressLines?.join(' ')} (${address.firstName} 收)`);
  console.log(`支付类型: 支付宝通用收银台 (HPP - Hosted Payment Page)`);
  console.log(`支付链接: ${paymentUrl}`);
  console.log('======================================================\n');
  console.log('说明：该链接不受微信个人 OpenID 限制，任何设备均可直接打开并唤起支付宝完成付款。');

  if (autoOpen) {
    console.log('正在浏览器中打开支付链接...');
    exec(`open "${paymentUrl}"`);
  }

  // 尝试通过本机 QQ 机器人推送
  try {
    const { sendQQNotification } = await import('./send_to_qq.js');
    const qqMsg = `【Zara 订单支付链接】\n` +
      `订单编号：${orderId}\n` +
      `商品名称：${checkoutData.order?.suborders?.[0]?.items?.[0]?.detail?.name || '商品'}\n` +
      `实付金额：¥${((checkoutData.order?.orderTotalAmount || 0) / 100).toFixed(2)}\n` +
      `收货人：${address.firstName} (${address.addressLines?.join(' ')})\n\n` +
      `🔗 支付链接（支付宝通用收银台）：\n${paymentUrl}\n\n` +
      `提示：此链接无 OpenID 限制，手机/电脑打开均可直接唤起付款或代付。`;
    await sendQQNotification(qqMsg);
    console.log('已成功通过本机 QQ 机器人将支付链接推送至您的 QQ！');
  } catch (qqErr) {
    console.log('QQ 机器人自动推送提示:', qqErr.message);
  }

  return {
    orderId,
    paymentUrl,
    checkoutData
  };
}

// 命令行直接执行
if (process.argv[1]?.endsWith('zara_web_checkout.js')) {
  createOrderAndGetPaymentLink({ autoOpen: false }).catch(err => {
    console.error('执行出错:', err);
    process.exit(1);
  });
}
