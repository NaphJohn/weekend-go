/**
 * weekend-go 每周维护脚本（.github/workflows/weekly-maintain.yml 调用）
 *
 * 定位：**兜底维护**，不生成内容。真正的内容检索由 WorkBuddy 每周自动化负责；
 * 这个脚本保证「即使内容没人更新，站点也不会挂着过期档期装作还新鲜」。
 *
 * 做四件事：
 *   1. 把 WEEKEND_META.range / updatedAt / verifiedAt 推到「下一个周末」
 *   2. 剔除过期超过 14 天的条目（渲染层本来就会隐藏，这里只是别让文件一直长）
 *   3. bump 全站 ?v= 版本号（Pages 有 max-age=600，不 bump 用户看不到更新）
 *   4. 输出 summary.json 给邮件 step 用
 *
 * 用法：node scripts/weekly-maintain.mjs [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');
const KEEP_EXPIRED_DAYS = 14;

const log = (...a) => console.log('[maintain]', ...a);
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => { if (!DRY) fs.writeFileSync(path.join(ROOT, p), s, 'utf8'); };

/* ---------- 日期 ---------- */
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s) => {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
};
const midnight = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const daysBetween = (a, b) => Math.round((midnight(a) - midnight(b)) / 86400000);

/** 下一个周末：今天周六/周日 → 本周末；否则 → 下个周六+周日 */
function nextWeekend(now = new Date()) {
  const t = midnight(now);
  const dow = t.getDay(); // 0=日 1=一 …… 6=六
  let sat;
  if (dow === 6) sat = new Date(t);
  else if (dow === 0) sat = new Date(t.getTime() - 86400000);
  else sat = new Date(t.getTime() + (6 - dow) * 86400000);
  return { sat: ymd(sat), sun: ymd(new Date(sat.getTime() + 86400000)) };
}

/* ---------- 版本号 ---------- */
function currentVersion() {
  const m = read('index.html').match(/\?v=(\d{8}[a-z])/);
  if (!m) throw new Error('index.html 里找不到 ?v=YYYYMMDDx 版本号');
  return m[1];
}
function bumpVersion(old) {
  const today = ymd(new Date()).replace(/-/g, '');
  const oldDate = old.slice(0, 8);
  const oldLetter = old.slice(8);
  if (today === oldDate) {
    const next = String.fromCharCode(oldLetter.charCodeAt(0) + 1);
    return next <= 'z' ? today + next : today + 'z';
  }
  // 跨天就重置为 a；若同一天连跑多次（字母已到 z）也不至于崩溃
  return today + 'a';
}

/* ---------- 数据文件读写（不 eval，用文本精确替换 META 字段） ---------- */
function loadData() {
  const src = read('data/weekend.js');
  const sandbox = { window: {} };
  // 数据文件是纯字面量 + window 赋值，用 Function 注入 window 即可，无副作用
  new Function('window', src)(sandbox.window);
  return { src, items: sandbox.window.WEEKEND || [], meta: sandbox.window.WEEKEND_META || {} };
}

function patchMeta(src, patch) {
  let out = src;
  for (const [k, v] of Object.entries(patch)) {
    if (typeof v === 'string') {
      const re = new RegExp(`(\\n\\s*${k}:\\s*)'[^']*'`, 'm');
      if (re.test(out)) out = out.replace(re, `$1'${v}'`);
      else out = out.replace(/(\n\s*verifiedAt:)/, `\n  ${k}: '${v}',$1`); // 兜底插入
    } else {
      const re = new RegExp(`(\\n\\s*${k}:\\s*)\\{[^}]*\\}`, 'm');
      const body = Object.entries(v).map(([kk, vv]) => `${kk}: '${vv}'`).join(', ');
      if (re.test(out)) out = out.replace(re, `$1{ ${body} }`);
    }
  }
  return out;
}

/* ---------- 剔除过期条目（按 id 整段删） ---------- */
function dropExpired(src, ids) {
  let out = src;
  for (const id of ids) {
    const re = new RegExp(`\\n\\s*\\{\\s*\\n(?:[^{}]*?\\n)*?\\s*id:\\s*'${id}',(?:[^{}]*?\\n)*?\\s*\\},?`, 'm');
    if (re.test(out)) out = out.replace(re, '');
  }
  return out;
}

/* ---------- 主流程 ---------- */
function main() {
  const oldVer = currentVersion();
  const { src, items, meta } = loadData();
  const wk = nextWeekend();
  const today = midnight(new Date());

  const expired = [];
  const live = [];
  for (const it of items) {
    if (!it.end) { live.push(it); continue; }
    const dl = daysBetween(parseYmd(it.end), today);
    if (dl < -KEEP_EXPIRED_DAYS) expired.push(it);
    else live.push(it);
  }
  const stillLive = live.filter((it) => !it.end || daysBetween(parseYmd(it.end), today) >= 0);
  const picks = stillLive.filter((it) => it.pick);
  const subs = stillLive.filter((it) => !it.pick);

  log(`条目：收录 ${items.length}，未过期 ${stillLive.length}（主推 ${picks.length} / 顺路 ${subs.length}），删除过期 ${expired.length}`);
  log(`周末区间：${meta.range?.sat || '?'} ~ ${meta.range?.sun || '?'}  →  ${wk.sat} ~ ${wk.sun}`);

  /* 数据陈旧判定：主推 < 3 条说明这周没人补内容 → 让页面显示黄条 */
  const stale = picks.length < 3;
  log(stale ? '⚠️ 主推不足 3 条 —— 页面会显示「数据未更新」黄条' : '✅ 主推条数充足');

  let out = src;
  if (expired.length) out = dropExpired(out, expired.map((x) => x.id));
  out = patchMeta(out, {
    updatedAt: ymd(new Date()),
    range: wk,
  });
  write('data/weekend.js', out);

  const newVer = bumpVersion(oldVer);
  const htmls = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
  let bumped = 0;
  for (const f of htmls) {
    const s = read(f);
    if (!s.includes(oldVer)) continue;
    write(f, s.split(oldVer).join(newVer));
    bumped++;
  }
  log(`版本号：${oldVer} → ${newVer}（${bumped} 个 HTML）`);

  /* 给邮件 step 用 */
  const summary = {
    oldVer, newVer,
    range: wk,
    total: items.length,
    live: stillLive.length,
    picks: picks.length,
    subs: subs.length,
    removed: expired.map((x) => ({ name: x.name, end: x.end })),
    stale,
    pickList: picks.map((x) => ({
      name: x.name, dateText: x.dateText, place: x.place, free: !!x.free, end: x.end,
    })),
    generatedAt: new Date().toISOString(),
    changed: expired.length > 0 || oldVer !== newVer,
  };
  if (!DRY) fs.writeFileSync(path.join(ROOT, 'scripts/summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  log('summary.json 已写入');
  console.log(JSON.stringify(summary, null, 2));
}

main();
