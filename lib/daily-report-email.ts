/**
 * 每日营运数据汇总邮件 HTML 模板
 *
 * 纯函数 buildDailyReportHtml(data) → 返回完整 HTML 字符串
 * 使用内联 CSS，复用项目渐变色 #667eea → #764ba2
 */

export interface DailyReportData {
  /** 东八区日期，如 "2026-04-08" */
  date: string
  /** 星期几，如 "星期二" */
  weekday: string

  // A. 用户大盘
  /** 今日新增注册用户数 */
  newUsers: number
  /** 今日活跃生图用户数（去重） */
  activeUsers: number
  /** 今日完成生成次数 */
  completedGenerations: number

  // B. 转化数据
  /** 今日首登转化人数（新用户中已充值的人数） */
  newConvertedUsers: number
  /** 今日首登转化充值次数 */
  newConvertedOrders: number
  /** 新用户充值总额（分） */
  newConvertedAmount: number
  /** 套餐分布：[{ name, count }] */
  planBreakdown: { name: string; count: number }[]

  // C. 营收流水
  /** 今日总营收（分） */
  totalRevenue: number
  /** 新用户贡献营收（分） */
  newUserRevenue: number
  /** 老用户贡献营收（分） */
  oldUserRevenue: number
  /** 今日已付订单数 */
  paidOrderCount: number
  /** 今日申诉退款总额（分） */
  refundAmount: number
  /** 算力成本估算（元），= completedGenerations × 0.3 */
  aiCost: number
}

/** 分 → 元，保留两位小数 */
function fenToYuan(fen: number): string {
  return (fen / 100).toFixed(2)
}

/** 数值为 0 时的灰色样式 */
function zeroClass(val: number): string {
  return val === 0 ? 'color:#999;' : ''
}

/** 单个指标卡片 */
function metricCard(label: string, value: string, color: string, extraStyle: string = ''): string {
  return `
    <td style="width:50%;padding:6px;">
      <div style="background:#fff;border-radius:12px;padding:20px;text-align:center;
                  border:1px solid #f0f0f0;${extraStyle}">
        <div style="font-size:13px;color:#888;margin-bottom:8px;">${label}</div>
        <div style="font-size:28px;font-weight:700;color:${color};">${value}</div>
      </div>
    </td>`
}

export function buildDailyReportHtml(data: DailyReportData): string {
  const planTagsHtml = data.planBreakdown.length > 0
    ? data.planBreakdown
        .map(p => `<span style="display:inline-block;background:#f0f2ff;color:#667eea;
          border-radius:20px;padding:4px 14px;font-size:13px;margin:4px 4px 4px 0;">
          ${p.name} × ${p.count}</span>`)
        .join('')
    : '<span style="color:#999;font-size:13px;">暂无数据</span>'

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,
  'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:0;overflow:hidden;">

  <!-- 渐变头部 -->
  <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:36px 30px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">📊 每日营运数据汇总</h1>
    <p style="margin:8px 0 0;color:rgba(255,255,255,.85);font-size:15px;">
      ${data.date} ${data.weekday}
    </p>
  </div>

  <!-- A. 用户大盘 -->
  <div style="padding:24px 20px 12px;">
    <h2 style="margin:0 0 12px;font-size:16px;color:#333;border-left:4px solid #667eea;padding-left:10px;">
      A. 用户大盘
    </h2>
    <table style="width:100%;border-collapse:collapse;border-spacing:0;">
      <tr>
        ${metricCard('今日新增注册', String(data.newUsers), '#667eea', zeroClass(data.newUsers))}
        ${metricCard('活跃生图用户', String(data.activeUsers), '#764ba2', zeroClass(data.activeUsers))}
      </tr>
      <tr>
        ${metricCard('完成生成次数', String(data.completedGenerations), '#f59e0b', zeroClass(data.completedGenerations))}
        ${metricCard('已付订单数', String(data.paidOrderCount), '#10b981', zeroClass(data.paidOrderCount))}
      </tr>
    </table>
  </div>

  <!-- B. 转化数据 -->
  <div style="padding:12px 20px;">
    <h2 style="margin:0 0 12px;font-size:16px;color:#333;border-left:4px solid #764ba2;padding-left:10px;">
      B. 新用户首登转化
    </h2>
    <table style="width:100%;border-collapse:collapse;border-spacing:0;">
      <tr>
        ${metricCard('转化人数', String(data.newConvertedUsers), '#667eea', zeroClass(data.newConvertedUsers))}
        ${metricCard('转化充值次数', String(data.newConvertedOrders), '#764ba2', zeroClass(data.newConvertedOrders))}
      </tr>
    </table>
    <div style="margin-top:12px;background:#fafafa;border-radius:10px;padding:16px;border:1px solid #f0f0f0;">
      <div style="font-size:13px;color:#888;margin-bottom:8px;">新用户充值金额</div>
      <div style="font-size:24px;font-weight:700;color:#667eea;${data.newConvertedAmount === 0 ? 'color:#999;' : ''}">
        ¥${fenToYuan(data.newConvertedAmount)}
      </div>
      <div style="margin-top:12px;">
        <div style="font-size:13px;color:#888;margin-bottom:6px;">套餐分布</div>
        ${planTagsHtml}
      </div>
    </div>
  </div>

  <!-- C. 营收流水 -->
  <div style="padding:12px 20px 24px;">
    <h2 style="margin:0 0 12px;font-size:16px;color:#333;border-left:4px solid #10b981;padding-left:10px;">
      C. 营收流水
    </h2>
    <table style="width:100%;border-collapse:collapse;border-spacing:0;font-size:14px;">
      <thead>
        <tr style="background:#f7f8fa;">
          <th style="padding:10px 12px;text-align:left;color:#666;font-weight:500;border-bottom:1px solid #eee;">指标</th>
          <th style="padding:10px 12px;text-align:right;color:#666;font-weight:500;border-bottom:1px solid #eee;">金额（元）</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f5f5f5;color:#333;">总营收</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f5f5f5;text-align:right;font-weight:600;
            ${data.totalRevenue === 0 ? 'color:#999;' : 'color:#10b981;'}">¥${fenToYuan(data.totalRevenue)}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f5f5f5;color:#333;">　新用户贡献</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f5f5f5;text-align:right;
            ${data.newUserRevenue === 0 ? 'color:#999;' : 'color:#667eea;'}">¥${fenToYuan(data.newUserRevenue)}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f5f5f5;color:#333;">　老用户贡献</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f5f5f5;text-align:right;
            ${data.oldUserRevenue === 0 ? 'color:#999;' : 'color:#764ba2;'}">¥${fenToYuan(data.oldUserRevenue)}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f5f5f5;color:#333;">申诉退款</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f5f5f5;text-align:right;
            ${data.refundAmount === 0 ? 'color:#999;' : 'color:#ef4444;'}">¥${fenToYuan(data.refundAmount)}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;color:#333;">算力成本（估算）</td>
          <td style="padding:10px 12px;text-align:right;
            ${data.aiCost === 0 ? 'color:#999;' : 'color:#f59e0b;'}">¥${data.aiCost.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- 页脚 -->
  <div style="background:#f7f7f7;padding:24px 30px;text-align:center;color:#999;font-size:13px;line-height:1.6;">
    <p style="margin:0;">此邮件由 <strong>AI-Species</strong> 系统自动发送，请勿回复。</p>
    <p style="margin:6px 0 0;">© ${new Date().getFullYear()} AI-Species. All rights reserved.</p>
  </div>

</div>
</body>
</html>`
}
