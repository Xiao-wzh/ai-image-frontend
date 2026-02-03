# 微信支付 V3 Native 扫码支付集成指南

## 目录

1. [配置指南](#配置指南)
2. [本地调试](#本地调试)
3. [API 接口说明](#api-接口说明)
4. [验收步骤](#验收步骤)
5. [常见问题](#常见问题)

---

## 配置指南

### 1. 准备证书文件

从微信支付商户平台获取以下文件：

- **商户 API 私钥**：`apiclient_key.pem`
- **微信支付公钥**：`wechatpay_public.pem`（用于验证回调签名）

> [!IMPORTANT]
> 这些文件是敏感信息，已在 `.gitignore` 中配置忽略，不会进入 git 仓库。

### 2. 放置证书文件

在项目根目录创建 `secrets/` 目录，按商户组织：

```
secrets/
├── mch_indi/                    # 个体户商户
│   ├── apiclient_key.pem        # 商户私钥
│   └── wechatpay_public.pem     # 微信支付公钥
└── mch_company/                 # 公司商户
    ├── apiclient_key.pem
    └── wechatpay_public.pem
```

### 3. 配置环境变量

在 `.env` 文件中添加以下配置：

```env
# 默认商户标识
WECHAT_DEFAULT_MERCHANT_KEY=mch_indi

# 微信支付回调地址（必须是公网 HTTPS）
WECHAT_NOTIFY_URL=https://your-domain.com/api/pay/wechat/notify

# 多商户配置 JSON
WECHAT_MERCHANTS_JSON={"mch_indi":{"mchid":"1234567890","appid":"wxXXXXXXXXXXXXXXXX","apiV3Key":"your-32-chars-api-v3-key-here!!","merchantSerial":"MERCHANT_CERT_SERIAL","merchantPrivateKeyPath":"secrets/mch_indi/apiclient_key.pem","wechatpayPublicKeyPath":"secrets/mch_indi/wechatpay_public.pem","wechatpayCertSerial":"WECHATPAY_CERT_SERIAL"}}
```

**配置字段说明：**

| 字段 | 说明 |
|------|------|
| `mchid` | 微信支付商户号 |
| `appid` | 公众号/小程序 AppID |
| `apiV3Key` | API v3 密钥（32位） |
| `merchantSerial` | 商户 API 证书序列号 |
| `merchantPrivateKeyPath` | 商户私钥文件路径 |
| `wechatpayPublicKeyPath` | 微信支付公钥文件路径 |
| `wechatpayCertSerial` | 微信支付公钥证书序列号（用于回调验签优先匹配） |

---

## 本地调试

### 1. 运行数据库迁移

```bash
npx prisma migrate dev --name add_order_table
```

### 2. 启动开发服务器

```bash
npm run dev
```

### 3. 使用内网穿透（用于接收微信回调）

微信支付回调需要公网地址，推荐使用 ngrok 或 natapp：

```bash
ngrok http 3000
```

将获得的 HTTPS 地址更新到 `WECHAT_NOTIFY_URL`。

---

## API 接口说明

### 创建 Native 订单

**POST** `/api/pay/wechat/native/create`

**请求体：**
```json
{
  "amount": 100,        // 金额（分），100 = 1元
  "title": "购买积分",   // 订单标题
  "merchantKey": "mch_indi"  // 可选，指定商户
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "outTradeNo": "WX_1234567890123_ABCD1234",
    "codeUrl": "weixin://wxpay/bizpayurl?pr=xxx",
    "merchantKey": "mch_indi",
    "mchid": "1234567890"
  }
}
```

> [!TIP]
> 使用 `codeUrl` 生成二维码供用户扫码支付。

### 查询订单状态

**GET** `/api/pay/order/:outTradeNo`

**响应：**
```json
{
  "success": true,
  "data": {
    "outTradeNo": "WX_1234567890123_ABCD1234",
    "status": "PAID",
    "amount": 100,
    "title": "购买积分",
    "paidAt": "2026-02-02T10:30:00.000Z",
    "createdAt": "2026-02-02T10:25:00.000Z"
  }
}
```

**订单状态：**
- `CREATED` - 已创建
- `PAYING` - 待支付
- `PAID` - 已支付
- `CLOSED` - 已关闭
- `REFUND` - 已退款

### 微信回调通知

**POST** `/api/pay/wechat/notify`

> [!CAUTION]
> 此接口由微信支付系统调用，无法模拟。

---

## 验收步骤

### 1. 验证配置

确保以下文件/配置正确：

- [ ] `secrets/` 目录存在且包含证书文件
- [ ] `.env` 中 `WECHAT_MERCHANTS_JSON` 配置正确
- [ ] `WECHAT_NOTIFY_URL` 指向公网可访问地址

### 2. 测试创建订单

```bash
curl -X POST http://localhost:3000/api/pay/wechat/native/create \
  -H "Content-Type: application/json" \
  -d '{"amount": 1, "title": "测试订单"}'
```

预期返回包含 `outTradeNo` 和 `codeUrl`。

### 3. 扫码支付

1. 使用 `codeUrl` 生成二维码
2. 用微信扫码支付（建议测试环境使用 1 分钱）
3. 完成支付

### 4. 验证回调处理

支付完成后：

```bash
curl http://localhost:3000/api/pay/order/WX_xxx
```

预期 `status` 变为 `PAID`。

### 5. 验证数据库

```sql
SELECT * FROM "Order" WHERE "outTradeNo" = 'WX_xxx';
```

确认：
- `status` = `PAID`
- `payPlatformTradeNo` 有值
- `paidAt` 有值
- `notifyProcessedAt` 有值

---

## 常见问题

### Q: 回调验签失败？

1. 检查 `wechatpayCertSerial` 是否与微信回调 header 中的 serial 匹配
2. 确认 `wechatpay_public.pem` 内容正确

### Q: 解密失败？

1. 确认 `apiV3Key` 是 32 位字符
2. 检查是否与商户平台设置的 API v3 密钥一致

### Q: 订单金额不匹配？

这是安全检查。确保创建订单时的 `amount` 与实际支付金额一致。

### Q: 如何支持多商户？

在 `WECHAT_MERCHANTS_JSON` 中配置多个商户，创建订单时通过 `merchantKey` 指定：

```json
{"amount": 100, "title": "商品", "merchantKey": "mch_company"}
```

---

## 文件结构

```
src/
├── lib/
│   └── pay/
│       └── wechat/
│           ├── types.ts      # 类型定义
│           ├── config.ts     # 多商户配置
│           ├── client.ts     # WxPay 客户端
│           ├── crypto.ts     # 加密工具
│           └── service.ts    # 核心服务
└── app/
    └── api/
        └── pay/
            ├── wechat/
            │   ├── native/create/route.ts  # 创建订单
            │   └── notify/route.ts         # 回调通知
            └── order/[outTradeNo]/route.ts # 查询订单
```
