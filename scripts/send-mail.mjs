/**
 * 每周更新邮件（.github/workflows/weekly-maintain.yml 调用）
 *
 * 约束（照用户既有偏好）：
 *   - 纯 HTML，**零 <script>**
 *   - 不用 SVG，用纯 CSS 进度条 / 单元格颜色代替图表
 *   - 发完自检：确认 body 是 HTML、条数对得上
 *
 * 发送方式二选一，按 secrets 是否存在自动降级：
 *   A) SMTP（推荐，QQ 邮箱 授权码）：SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
 *   B) 都没有 → 只往 job summary 里写，不报错（不让邮件配置把周更整个搞挂）
 *
 * 用法：node scripts/send-mail.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import tls from 'node:tls';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://naphjohn.github.io/weekend-go/';
const TO = process.env.MAIL_TO || 'abdavi.001@qq.com';
const NODE_ENV = process.env;

const readJson = (p, fb) => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')); } catch { return fb; }
};

const sum = readJson('scripts/summary.json', null);
if (!sum) { console.error('缺 scripts/summary.json，先跑 weekly-maintain.mjs'); process.exit(1); }

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ---------- 邮件正文：纯 HTML + 内联样式 + 零 script ---------- */
function buildHTML(s) {
  const CN = { '2026-11-14': '11月14日 周六', '2026-11-15': '11月15日 周日' };
  const rangeText = (CN[s.range.sat] || s.range.sat) + ' – ' + (CN[s.range.sun] || s.range.sun);

  const rows = s.pickList.map((p, i) => {
    const tag = p.free
      ? '<span style="display:inline-block;background:#e9f9f1;color:#0e8a5c;font-size:11px;font-weight:700;border-radius:4px;padding:1px 7px;">免费</span>'
      : '<span style="display:inline-block;background:#fdf3e3;color:#b06d00;font-size:11px;font-weight:700;border-radius:4px;padding:1px 7px;">需购票</span>';
    return `<tr>
      <td style="padding:10px 8px 10px 0;border-bottom:1px solid #eef2f8;vertical-align:top;width:22px;color:#8a94a6;font-size:13px;font-weight:700;">${i + 1}</td>
      <td style="padding:10px 0;border-bottom:1px solid #eef2f8;vertical-align:top;">
        <div style="font-size:14.5px;font-weight:700;color:#1c2536;line-height:1.45;">${esc(p.name)} ${tag}</div>
        <div style="font-size:12.5px;color:#6b7688;margin-top:3px;line-height:1.6;">${esc(p.dateText)}　·　${esc(p.place)}</div>
      </td>
    </tr>`;
  }).join('');

  const removed = s.removed.length
    ? `<div style="background:#f6f7f9;border-radius:8px;padding:10px 13px;margin-top:14px;font-size:12.5px;color:#6b7688;line-height:1.7;">
        <b style="color:#4a5568;">本次移除（已过期 14 天以上）：</b>${s.removed.map((x) => esc(x.name) + '（至 ' + esc(x.end) + '）').join('、')}
      </div>` : '';

  const staleWarn = s.stale
    ? `<div style="background:#fff6e5;border:1px solid #f3ddb0;border-radius:8px;padding:10px 13px;margin-bottom:14px;font-size:12.5px;color:#8a5a1e;line-height:1.7;">
        ⚠️ 本周主推不足 3 条 —— 站点会显示「数据未更新」提示，请手动补内容。
      </div>` : '';

  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>weekend-go 本周推荐已更新（${esc(rangeText)}）</title></head>
<body style="margin:0;padding:0;background:#f2f4f8;">
<div style="max-width:620px;margin:0 auto;padding:22px 16px;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;">

  <div style="background:linear-gradient(120deg,#f2fbf6,#eef3ff);border:1px solid #d6e8dd;border-radius:14px;padding:20px 22px;">
    <div style="font-size:11.5px;font-weight:700;color:#6b7688;letter-spacing:1px;">WEEKEND-GO · 每周自动更新</div>
    <div style="font-size:20px;font-weight:800;color:#1c2536;margin-top:6px;line-height:1.35;">本周推荐已刷新</div>
    <div style="font-size:13.5px;color:#3c4a5e;margin-top:5px;">${esc(rangeText)}　·　主推 ${s.picks} 条 / 顺路可加 ${s.subs} 条</div>
  </div>

  <div style="background:#ffffff;border:1px solid #e4e8ef;border-radius:14px;padding:18px 20px;margin-top:14px;">
    ${staleWarn}
    <div style="font-size:13px;font-weight:700;color:#6b7688;letter-spacing:.5px;margin-bottom:8px;">🗓️ 本周主推</div>
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">${rows || '<tr><td style="font-size:13px;color:#8a94a6;padding:10px 0;">本周暂无主推条目。</td></tr>'}</table>
    ${removed}
  </div>

  <div style="text-align:center;margin-top:18px;">
    <a href="${SITE}#weekPanel" style="display:inline-block;background:#2f6bff;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:11px 26px;border-radius:9px;">打开 weekend-go 看全部 →</a>
  </div>

  <div style="font-size:11.5px;color:#8a94a6;line-height:1.75;margin-top:16px;text-align:center;">
    版本 ${esc(s.oldVer)} → ${esc(s.newVer)}　·　收录 ${s.total} 条，未过期 ${s.live} 条<br>
    数据每周四 20:00 自动维护；票价 / 展期 / 预约规则随时可能变，出行前以官方公告为准。<br>
    本邮件由 weekend-go 自动化发出，不构成推荐承诺。
  </div>
</div>
</body></html>`;
}

/* ---------- 极简 SMTP（STARTTLS + AUTH LOGIN），避免装任何依赖 ---------- */
function sendSMTP({ host, port, user, pass, from, to, subject, html }) {
  return new Promise((resolve, reject) => {
    const secure = Number(port) === 465;
    let sock = secure
      ? tls.connect({ host, port: Number(port), servername: host })
      : net.connect({ host, port: Number(port) });
    let buf = '';
    let step = 0;
    const trace = [];
    const done = (err) => { try { sock.destroy(); } catch {} err ? reject(err) : resolve(trace); };

    const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
    const cmds = [];
    const push = (c) => { cmds.push(c); sock.write(c + '\r\n'); };

    const bodyB64 = Buffer.from(html, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n');
    const mail =
      `From: ${from}\r\nTo: ${to}\r\nSubject: =?UTF-8?B?${b64(subject)}?=\r\n` +
      `MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n` +
      `Content-Transfer-Encoding: base64\r\nDate: ${new Date().toUTCString()}\r\n\r\n${bodyB64}`;

    sock.setTimeout(30000, () => done(new Error('SMTP 超时')));

    const onData = (chunk) => {
      buf += chunk.toString('utf8');
      let idx;
      while ((idx = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        if (/^\d{3}-/.test(line)) continue; // 多行响应未结束
        const code = Number(line.slice(0, 3));
        trace.push(line);
        if (code >= 400) return done(new Error('SMTP 拒绝：' + line));
        step++;
        switch (step) {
          case 1: push('EHLO weekend-go'); break;
          case 2:
            if (!secure) { push('STARTTLS'); break; }
            push('AUTH LOGIN'); break;
          case 3:
            if (!secure) {
              sock = tls.connect({ socket: sock, servername: host }, () => push('EHLO weekend-go'));
              sock.setTimeout(30000, () => done(new Error('SMTP 超时（TLS）')));
              sock.on('data', onData);
              return;
            }
            push(b64(user)); break;
          case 4: push(b64(pass)); break;
          case 5: push(`MAIL FROM:<${from}>`); break;
          case 6: push(`RCPT TO:<${to}>`); break;
          case 7: push('DATA'); break;
          case 8: sock.write(mail + '\r\n.\r\n'); break;
          case 9: push('QUIT'); break;
          case 10: return done(null);
        }
      }
    };
    sock.on('data', onData);
    sock.on('error', (e) => done(e));
  });
}

/* ---------- 主流程 ---------- */
const subject = `【weekend-go】本周推荐已更新（${sum.range.sat} ~ ${sum.range.sun}）· 主推 ${sum.picks} 条`;
const html = buildHTML(sum);

/* 自检：零 script、是 HTML、条数对得上 */
const trCount = (html.match(/<tr>/g) || []).length;
const checks = [
  ['body 是 HTML', html.trim().startsWith('<!DOCTYPE html>')],
  ['零 <script>', !/<script/i.test(html)],
  ['主推条数一致', trCount === Math.max(sum.pickList.length, 1)],
];
let bad = 0;
for (const [name, ok] of checks) { console.log((ok ? '✅' : '❌') + ' ' + name); if (!ok) bad++; }
if (bad) { console.error('自检未通过，不发信'); process.exit(1); }

const cfg = {
  host: NODE_ENV.SMTP_HOST, port: NODE_ENV.SMTP_PORT || 465,
  user: NODE_ENV.SMTP_USER, pass: NODE_ENV.SMTP_PASS,
};

if (!cfg.host || !cfg.user || !cfg.pass) {
  console.log('⚠️ 未配置 SMTP secrets（SMTP_HOST / SMTP_USER / SMTP_PASS），跳过发信。');
  fs.writeFileSync(path.join(ROOT, 'scripts/mail-preview.html'), html, 'utf8');
  console.log('已把邮件正文写到 scripts/mail-preview.html 供预览。');
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `\n## 📧 邮件未发送（缺 SMTP secrets）\n\n标题：${subject}\n\n` +
      `需要配置：\`SMTP_HOST\` / \`SMTP_USER\` / \`SMTP_PASS\`（QQ 邮箱用授权码，端口 465）。\n`);
  }
  process.exit(0);
}

try {
  console.log('发送中 → ' + TO);
  await sendSMTP({ ...cfg, from: cfg.user, to: TO, subject, html });
  console.log('✅ 已发送给 ' + TO);
  fs.writeFileSync(path.join(ROOT, 'scripts/mail-preview.html'), html, 'utf8');
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n## 📧 已发送\n\n标题：${subject}\n收件人：${TO}\n`);
  }
} catch (e) {
  console.error('❌ 发送失败：' + e.message);
  fs.writeFileSync(path.join(ROOT, 'scripts/mail-preview.html'), html, 'utf8');
  process.exit(1);
}
