(function () {
  'use strict';

  var DATA = (window.ACTIVITIES || []).concat(window.FOOD || []);
  var META = window.DATA_META || {};
  var METRO = window.METRO || { stations: [], places: [], district: {}, venue: {}, quick: [] };
  var TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);

  var LEVEL_TEXT = {
    none: '不用预约',
    easy: '预约很简单',
    medium: '需预约',
    hard: '需实名抢约',
    unknown: '预约待开放'
  };
  var TYPE_TEXT = { exhibition: '展览', market: '市集', event: '活动/节庆', trip: '周边游', food: '美食' };
  var TRIPLEN_TEXT = { day: '当天往返', '2d': '2天1夜', '3d': '3天以上' };

  /* ================= 地铁站索引 ================= */
  var STATION = {};
  METRO.stations.forEach(function (s) {
    STATION[s[0]] = { x: s[1], y: s[2], lines: s[3], d: s[4] };
  });

  // 卡片 → 最近地铁站：优先卡片自带 metro，其次场馆映射，最后按所在区中心兜底
  // （区中心兜底保证「展览」这类没写场馆映射的卡片也能算出距离，不再整片空白）
  function stationOf(a) {
    if (a.metro) return a.metro;
    if (METRO.venue[a.id]) return METRO.venue[a.id];
    var d = a.district && METRO.district[a.district];
    if (d && STATION[d]) return d;
    return null;
  }

  // 两点直线距离（公里）。坐标为示意坐标，只用于「谁近谁远」的粗排
  function kmBetween(n1, n2) {
    var a = STATION[n1], b = STATION[n2];
    if (!a || !b) return null;
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy) * METRO.unit / 1000;
  }

  // 任意坐标点 → 某座车站的直线距离（公里）
  function kmToPoint(p, n) {
    var b = n && STATION[n];
    if (!p || !b) return null;
    var dx = b.x - p.x, dy = b.y - p.y;
    return Math.sqrt(dx * dx + dy * dy) * METRO.unit / 1000;
  }

  /**
   * 当前「参考点」——所有卡片距离都从它算起，中间点优先。
   *   中间点模式：两个地点坐标的算术平均（本坐标系是等比平面直角坐标，取平均即中点）
   *   普通模式：定位到的那座地铁站
   */
  function refPoint() {
    if (state.mid) return state.mid;
    if (state.loc && state.loc.station && STATION[state.loc.station]) {
      var s = STATION[state.loc.station];
      return { x: s.x, y: s.y, label: state.loc.station };
    }
    return null;
  }

  // 距离标签里「距 XX」的文字：中间点模式要写清是哪两点的中点
  function refLabel() {
    if (state.mid) return '「' + esc(state.mid.a) + ' ↔ ' + esc(state.mid.b) + '」中间点';
    if (state.loc && state.loc.station) return esc(state.loc.station);
    return '';
  }

  /** 两个地点的中点：坐标取平均，并找出离中点最近的地铁站作为「大概在哪」的锚点 */
  function midpointOf(ra, rb) {
    if (!ra || !ra.station || !rb || !rb.station) return null;
    var A = STATION[ra.station], B = STATION[rb.station];
    if (!A || !B) return null;
    var mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    var name = null, best = Infinity;
    Object.keys(STATION).forEach(function (n) {
      var s = STATION[n];
      var d = Math.sqrt((s.x - mx) * (s.x - mx) + (s.y - my) * (s.y - my));
      if (d < best) { best = d; name = n; }
    });
    return {
      x: mx, y: my,
      a: ra.station, b: rb.station,
      near: name, nearKm: best === Infinity ? null : best * METRO.unit / 1000
    };
  }

  function distOf(a) {
    var p = refPoint();
    if (!p) return null;
    return kmToPoint(p, stationOf(a));
  }

  function gradeOf(km) {
    if (km == null) return null;
    if (km < 1.2) return { txt: '就在附近', sub: '步行或 1 站内', cls: 'd1' };
    if (km < 3.5) return { txt: '很近', sub: '地铁约 15 分钟', cls: 'd2' };
    if (km < 8) return { txt: '不远', sub: '地铁约 30 分钟', cls: 'd3' };
    if (km < 16) return { txt: '跨区', sub: '地铁约 45 分钟', cls: 'd4' };
    return { txt: '较远', sub: '地铁 1 小时起', cls: 'd5' };
  }

  /** 生成候选写法：原样 → 去「上海」前缀 / 「市」「地铁」「站」后缀，按优先级依次试 */
  function locCandidates(raw) {
    var out = [];
    function push(v) { if (v && out.indexOf(v) < 0) out.push(v); }
    var base = (raw || '').trim().replace(/\s+/g, '');
    push(base);                                            // 「上海大学」「漕盈路站」先按原样试，避免把站名削掉
    push(base.replace(/^上海市?/, ''));
    push(base.replace(/市$/, ''));
    push(base.replace(/^上海市?/, '').replace(/市$/, ''));
    out.slice().forEach(function (v) { push(v.replace(/地铁/g, '')); });
    out.slice().forEach(function (v) { if (/站$/.test(v) && v.length > 1) push(v.replace(/站$/, '')); });
    return out;
  }

  /**
   * 输入地点 → 最近地铁站。依次尝试：
   *   1) 站名完全一致（「上海大学」「漕盈路站」都能对上）
   *   2) 地标 / 道路 / 商圈关键词（取最长命中）
   *   3) 输入里包含某个站名（如「五角场万达」→ 五角场）
   *   4) 站名包含输入（如「漕河泾」→ 漕河泾开发区）
   *   5) 只输区名（含「浦东新区」写法）
   * 全都失败时返回 station:null + 明确提示，不再静默无反应。
   */
  function locate(raw) {
    var tries = locCandidates(raw);
    if (!tries.length) return null;

    // 1) 正好是地铁站名
    for (var i = 0; i < tries.length; i++) {
      if (STATION[tries[i]]) return { station: tries[i], how: '定位到地铁站「' + tries[i] + '」' };
    }

    // 2) 地标 / 道路 / 商圈 关键词命中（取最长关键词）
    var best = null, score = 0;
    METRO.places.forEach(function (p) {
      p[1].forEach(function (kw) {
        tries.forEach(function (t) {
          if (kw && t.indexOf(kw) >= 0 && kw.length > score) {
            score = kw.length;
            best = { station: p[0], how: '按「' + kw + '」定位到 ' + p[0] + '站' };
          }
        });
      });
    });
    if (best) return best;

    var names = Object.keys(STATION);

    // 3) 输入里包含某个站名（如「五角场万达」→ 五角场），取最长的那个
    var hit = null;
    tries.forEach(function (t) {
      names.forEach(function (n) {
        if (n.length >= 2 && t.indexOf(n) >= 0 && (!hit || n.length > hit.length)) hit = n;
      });
    });
    if (hit) return { station: hit, how: '匹配到地铁站「' + hit + '」' };

    // 4) 站名部分包含输入（如「漕河泾」→ 漕河泾开发区）
    var cand = null, diff = 1e9;
    tries.forEach(function (t) {
      if (t.length < 2) return;
      names.forEach(function (n) {
        if (n.indexOf(t) >= 0) {
          var d = n.length - t.length;
          if (d < diff) { diff = d; cand = n; }
        }
      });
    });
    if (cand) return { station: cand, how: '匹配到地铁站「' + cand + '」' };

    // 5) 只输了区名（兼容「浦东新区」「徐汇区」这类写法）
    var dqs = [];
    tries.forEach(function (t) {
      dqs.push(t, t.replace(/新区$/, ''), t.replace(/区$/, ''));
    });
    for (var j = 0; j < dqs.length; j++) {
      var dq = dqs[j];
      if (dq && METRO.district[dq] !== undefined) {
        var st = METRO.district[dq];
        if (st) return { station: st, how: '按「' + dq + '区」中心定位到 ' + st + '站' };
        return { station: null, how: dq + ' 暂无地铁直达，试试附近的区' };
      }
    }

    // 6) 没找到 —— 明确告诉用户怎么改，别静默
    return { station: null, how: '没找到「' + (raw || '').trim() + '」，换个写法试试：地铁站名（漕盈路）/ 商圈（五角场）/ 道路（武康路）/ 区名（浦东）' };
  }

  /* ================= 笔记 / 评论（localStorage） ================= */
  var NOTE_KEY = 'weekendgo_notes_v1';

  function loadNotes() {
    try { return JSON.parse(localStorage.getItem(NOTE_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function saveNotes(n) {
    try { localStorage.setItem(NOTE_KEY, JSON.stringify(n)); }
    catch (e) { alert('浏览器不允许本地存储，笔记无法保存。'); }
  }
  var notes = loadNotes();

  function noteList(id) { return notes[id] || []; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmtTime(ts) {
    var d = new Date(ts);
    function p(n) { return n < 10 ? '0' + n : '' + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* ================= 状态 ================= */
  var state = {
    type: 'all',
    onlyFree: false,
    onlyNoBooking: false,
    hideEnded: true,
    district: 'all',
    tripLen: 'all',
    loc: null,      // {station, how} 单点定位（车站）
    mid: null,      // {x,y,a,b,near,nearKm} 两地点中间点，优先于 loc
    nearBy: false   // 就近优先
  };

  function parse(d) { var p = d.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function isTrip(a) { return a.type === 'trip'; }
  function isFood(a) { return a.type === 'food'; }
  function tier(a) { return isTrip(a) ? 2 : (isFood(a) ? 1 : 0); }
  function daysLeft(end) { return Math.round((parse(end) - TODAY) / 86400000); }
  function isEnded(a) { return (isTrip(a) || isFood(a)) ? false : daysLeft(a.end) < 0; }

  function badgeOf(a) {
    if (isFood(a)) return { cls: 'b-food', txt: '常年可去' };
    if (isTrip(a)) return { cls: 'b-trip', txt: a.tripDays || '周边游' };
    if (isEnded(a)) return { cls: 'b-end', txt: '已结束' };
    var d = daysLeft(a.end);
    if (d <= 7) return { cls: 'b-urgent', txt: '仅剩 ' + d + ' 天' };
    if (d <= 21) return { cls: 'b-soon', txt: '剩 ' + d + ' 天' };
    if (d <= 90) return { cls: 'b-ok', txt: '剩 ' + d + ' 天' };
    return { cls: 'b-long', txt: '长期展' };
  }

  function match(a) {
    if (state.hideEnded && isEnded(a)) return false;
    // city = 「市内」：展览 / 市集 / 活动 / 美食，把周边游排除掉（第二块入口用）
    if (state.type === 'city') {
      if (isTrip(a)) return false;
    } else if (state.type !== 'all' && a.type !== state.type) {
      return false;
    }
    if (state.onlyFree && !a.price.free) return false;
    if (state.onlyNoBooking && a.booking.required) return false;
    if (state.district !== 'all' && a.district !== state.district) return false;
    if (state.tripLen !== 'all') {
      if (!isTrip(a) || a.tripLen !== state.tripLen) return false;
    }
    return true;
  }

  function bookLine(a) {
    var lv = a.booking.level;
    return '<span class="lv lv-' + lv + '">' + (LEVEL_TEXT[lv] || '—') + '</span>　' +
      (a.booking.channel || '');
  }

  function fact(label, val) {
    if (!val) return '';
    return '<div class="fact"><span class="fact-k">' + label + '</span><span class="fact-v">' + val + '</span></div>';
  }

  function noteHTML(a) {
    var list = noteList(a.id);
    var items = list.map(function (n, i) {
      return '<div class="note-item"><span class="note-time">' + fmtTime(n.t) + '</span>' +
        '<span class="note-txt">' + esc(n.txt) + '</span>' +
        '<span class="note-del" data-del="' + a.id + '" data-i="' + i + '" title="删除">×</span></div>';
    }).join('');
    return '<div class="notes">' +
      '<button class="note-btn" data-note="' + a.id + '">💬 我的笔记' + (list.length ? ' <b>(' + list.length + ')</b>' : '') + '</button>' +
      '<div class="note-box" id="nb-' + a.id + '" style="display:none">' +
      (items || '<div class="note-empty">还没写过。去过之后记一句，下次就不用重新查。</div>') +
      '<textarea class="note-input" id="ni-' + a.id + '" rows="2" placeholder="记一句：几点去不排队 / 和谁去 / 踩坑提醒…"></textarea>' +
      '<div class="note-ops"><button class="mini" data-save="' + a.id + '">保存笔记</button>' +
      (list.length ? '<button class="mini ghost" data-clear="' + a.id + '">清空</button>' : '') +
      '</div></div></div>';
  }

  function detailHTML(a) {
    var steps = (a.booking.steps || []).map(function (s) { return '<li>' + s + '</li>'; }).join('');

    if (isFood(a)) {
      var must = (a.must || []).map(function (m) { return '<li>' + m + '</li>'; }).join('');
      return '<details><summary>展开：吃什么 / 花多少 / 怎么去</summary><div class="detail">' +
        '<div class="facts">' +
        fact('人均', a.budget || a.price.amount) +
        fact('营业', a.hours) +
        fact('最佳时段', a.best) +
        fact('交通', '地铁 ' + (stationOf(a) || '—') + '站') +
        fact('预约', a.booking.channel) +
        '</div>' +
        (must ? '<div class="sec-title">值得点的</div><ol>' + must + '</ol>' : '') +
        '<div class="sec-title">怎么吃</div><ol>' + steps + '</ol>' +
        (a.tips ? '<div class="tip">' + a.tips + '</div>' : '') +
        (a.highlight ? '<div class="hl"><b>为什么值得：</b>' + a.highlight + '</div>' : '') +
        (a.address ? '<div class="hl">地址：' + a.address + '</div>' : '') +
        '<div class="hl">营业时间与价格以店家当日公告为准。</div>' +
        '</div></details>';
    }

    if (!isTrip(a)) {
      return '<details><summary>展开：怎么预约 / 值不值得去</summary><div class="detail">' +
        '<ol>' + steps + '</ol>' +
        (a.booking.realName ? '<div class="hl">实名要求：' + a.booking.realName + '</div>' : '') +
        (a.booking.tip ? '<div class="tip">' + a.booking.tip + '</div>' : '') +
        (a.highlight ? '<div class="hl"><b>看点：</b>' + a.highlight + '</div>' : '') +
        (a.address ? '<div class="hl">地址：' + a.address + '</div>' : '') +
        (stationOf(a) ? '<div class="hl">最近地铁：' + stationOf(a) + '站（' + (STATION[stationOf(a)] ? STATION[stationOf(a)].lines + ' 号线' : '') + '）</div>' : '') +
        '</div></details>';
    }

    var itin = (a.itinerary || []).map(function (s) { return '<li>' + s + '</li>'; }).join('');
    return '<details><summary>展开：怎么去 / 花多少 / 值不值得</summary><div class="detail">' +
      '<div class="facts">' +
      fact('车程', a.distance) +
      fact('最佳季节', a.bestSeason) +
      fact('预算', a.budget) +
      fact('交通', a.transport) +
      fact('订票', a.booking.channel) +
      '</div>' +
      (itin ? '<div class="sec-title">建议行程</div><ol>' + itin + '</ol>' : '') +
      '<div class="sec-title">订票 / 预约</div><ol>' + steps + '</ol>' +
      (a.booking.realName ? '<div class="hl">预约要求：' + a.booking.realName + '</div>' : '') +
      (a.booking.tip ? '<div class="tip">' + a.booking.tip + '</div>' : '') +
      (a.highlight ? '<div class="hl"><b>看点：</b>' + a.highlight + '</div>' : '') +
      (a.address ? '<div class="hl">地址：' + a.address + '</div>' : '') +
      '</div></details>';
  }

  // 中点落在哪儿的白话说人话：离最近站很近才说「XX 附近」，否则别硬说成 XX 一带
  function midAnchorText(m) {
    if (!m.near) return '';
    var km = m.nearKm == null ? null : m.nearKm;
    if (km != null && km <= 1.5) return '大概在 <b>' + esc(m.near) + '</b> 附近（离该站约 ' + km.toFixed(1) + ' km）';
    if (km != null) return '中间点附近没有地铁站，最近是 <b>' + esc(m.near) + '</b> 站（约 ' + km.toFixed(1) + ' km）';
    return '大概在 <b>' + esc(m.near) + '</b> 一带';
  }

  function distLine(a) {
    if (isTrip(a)) return '';
    if (!refPoint()) return '';
    var km = distOf(a);
    if (km == null) return '';
    var g = gradeOf(km);
    return '<div class="dist ' + g.cls + '">📍 距 ' + refLabel() + ' 约 ' + km.toFixed(1) + ' 公里　<b>' + g.txt + '</b>　<span>' + g.sub + '</span></div>';
  }

  function cardHTML(a) {
    var b = badgeOf(a);
    var tags = (a.tags || []).map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('');
    var price = a.price.free
      ? '<span class="free">免费</span>'
      : '<span class="paid">' + a.price.amount + '</span>';
    if (a.price.note) price += ' <span style="color:var(--sub)">· ' + a.price.note + '</span>';

    var period;
    if (isTrip(a)) {
      period = '<b>' + (TRIPLEN_TEXT[a.tripLen] || a.tripDays || '') + '</b>　<span style="color:var(--sub)">常年可去</span>';
    } else if (isFood(a)) {
      period = '<b>常年可去</b>　<span style="color:var(--sub)">' + (a.hours || '') + '</span>';
    } else {
      period = a.start + ' ~ ' + a.end + (a.closedDay ? '　<span style="color:var(--sub)">' + a.closedDay + '</span>' : '');
    }

    var cls = 'card' + (isTrip(a) ? ' card-trip' : '') + (isFood(a) ? ' card-food' : '') + (isEnded(a) ? ' done' : '');

    return '<div class="' + cls + '">' +
      '<div class="top"><h3>' + a.name + '</h3>' +
      '<span class="badge ' + b.cls + '">' + b.txt + '</span></div>' +
      '<div class="meta-line"><b>' + a.venue + '</b>　<span style="color:var(--sub)">' + a.district + '</span></div>' +
      '<div class="meta-line">' + period + '</div>' +
      (isTrip(a) && a.distance ? '<div class="meta-line"><span style="color:var(--sub)">' + a.distance + '</span></div>' : '') +
      distLine(a) +
      '<div class="price">' + price + '</div>' +
      '<div class="book">' + bookLine(a) + '</div>' +
      '<div class="tags">' + tags + '</div>' +
      detailHTML(a) +
      noteHTML(a) +
      '</div>';
  }

  /* ================= 渲染 ================= */
  function sortList(x, y) {
    var tx = tier(x), ty = tier(y);

    // 周边游永远沉底，按推荐度排
    if (tx === 2 || ty === 2) {
      if (tx !== ty) return tx - ty;
      return (y.rating || 0) - (x.rating || 0);
    }

    // 定位 + 就近优先：市内活动和美食混在一起，纯按距离排（中间点模式同样适用）
    if (refPoint() && state.nearBy) {
      var d1 = distOf(x), d2 = distOf(y);
      if (d1 != null && d2 != null && Math.abs(d1 - d2) > 0.2) return d1 - d2;
      if (d1 == null && d2 != null) return 1;
      if (d1 != null && d2 == null) return -1;
    }

    if (tx !== ty) return tx - ty;                       // 没定位时：市内 → 美食
    if (tx === 1) return (y.rating || 0) - (x.rating || 0);

    var ex = isEnded(x) ? 1 : 0, ey = isEnded(y) ? 1 : 0;
    if (ex !== ey) return ex - ey;
    return daysLeft(x.end) - daysLeft(y.end);
  }

  function render() {
    var list = DATA.filter(match).sort(sortList);

    document.getElementById('grid').innerHTML = list.length
      ? list.map(cardHTML).join('')
      : '<div class="empty">没有符合条件的，把筛选放宽一点试试。</div>';
    document.getElementById('count').textContent = list.length;
    renderMyNotes();
  }

  /** 各类型数量，写在筛选 chip 上——让「周边游」这类沉底的内容也能被看见 */
  function renderCounts() {
    var c = { all: 0 };
    DATA.forEach(function (a) {
      if (state.hideEnded && isEnded(a)) return;
      c[a.type] = (c[a.type] || 0) + 1;
      if (!isTrip(a)) c.city = (c.city || 0) + 1;   // 市内（不含周边游）
      c.all++;
    });
    document.querySelectorAll('[data-cnt]').forEach(function (el) {
      el.textContent = c[el.getAttribute('data-cnt')] || 0;
    });
  }

  function renderStats() {
    renderCounts();
    var live = DATA.filter(function (a) { return !isTrip(a) && !isFood(a) && !isEnded(a); });
    document.getElementById('s-total').textContent = live.length;
    document.getElementById('s-free').textContent = live.filter(function (a) { return a.price.free; }).length;
    document.getElementById('s-nobook').textContent = live.filter(function (a) { return !a.booking.required; }).length;
    document.getElementById('s-urgent').textContent = live.filter(function (a) { return daysLeft(a.end) <= 10; }).length;
    var t = document.getElementById('s-trip'); if (t) t.textContent = DATA.filter(isTrip).length;
    var f = document.getElementById('s-food'); if (f) f.textContent = DATA.filter(isFood).length;
  }

  /* ---------- 「你在哪」记忆：同一设备当天有效，切页面/板块不用重填 ---------- */
  var LOC_KEY = 'weekendgo_loc_v1';
  var LOC_TTL = 12 * 3600 * 1000;

  function saveLoc(v) {
    try { if (v) localStorage.setItem(LOC_KEY, JSON.stringify({ v: v, t: Date.now() })); } catch (e) {}
  }
  function readLoc() {
    try {
      var o = JSON.parse(localStorage.getItem(LOC_KEY) || 'null');
      if (o && o.v && (Date.now() - o.t) < LOC_TTL) return o.v;
    } catch (e) {}
    return '';
  }
  function dropLoc() { try { localStorage.removeItem(LOC_KEY); } catch (e) {} }

  /* 中间点的记忆：与单点分开存，换页 / 换板块都不丢，且不会互相覆盖 */
  var LOC_MID_KEY = 'weekendgo_loc_mid_v1';
  function saveLocMid(a, b) {
    try { if (a && b) localStorage.setItem(LOC_MID_KEY, JSON.stringify({ a: a, b: b, t: Date.now() })); } catch (e) {}
  }
  function readLocMid() {
    try {
      var o = JSON.parse(localStorage.getItem(LOC_MID_KEY) || 'null');
      if (o && o.a && o.b && (Date.now() - o.t) < LOC_TTL) return o;
    } catch (e) {}
    return null;
  }
  function dropLocMid() { try { localStorage.removeItem(LOC_MID_KEY); } catch (e) {} }

  /* ---------- 地点面板 ---------- */
  function syncChip() {
    var chip = document.getElementById('chipNear');
    if (!chip) return;
    var has = !!refPoint();
    chip.style.display = has ? '' : 'none';
    if (!has) { state.nearBy = false; chip.classList.remove('on'); }
    chip.classList.toggle('on', has && state.nearBy);
    chip.textContent = state.nearBy ? '📍 就近优先：开（点一下关掉）' : '📍 就近优先：关（点一下开启）';
  }

  function renderLoc() {
    var box = document.getElementById('locResult');
    if (!box) return;

    // 中间点模式：写清是哪两点的中点，并给出「大概在哪一站附近」的白话锚点
    if (state.mid) {
      box.innerHTML = '<span class="loc-ok">✅ 中间点：' + esc(state.mid.a) + ' ↔ ' + esc(state.mid.b) +
        (state.mid.near ? '　·　' + midAnchorText(state.mid) : '') +
        '</span><span class="hint" style="margin-left:8px">已按「到中间点」的距离重排，下面每张卡片标了路程。</span>';
      syncChip();
      return;
    }

    if (!state.loc || !state.loc.station) {
      box.innerHTML = state.loc
        ? '<span class="loc-bad">' + esc(state.loc.how) + '</span>'
        : '<span class="hint">不填也能用，下面是全部内容。</span>';
      syncChip();
      return;
    }
    var st = STATION[state.loc.station];
    box.innerHTML = '<span class="loc-ok">✅ ' + esc(state.loc.how) +
      (st ? '　·　' + st.lines + ' 号线　·　' + st.d : '') + '</span>' +
      '<span class="hint" style="margin-left:8px">已按距离重排，下面每张卡片标了路程。</span>';
    syncChip();
  }

  function applyLoc() {
    var v = document.getElementById('locInput').value;
    var r = locate(v);
    state.loc = r;
    state.mid = null;                    // 单点模式覆盖中间点
    dropLocMid();
    state.nearBy = !!(r && r.station);
    if (r && r.station) saveLoc(v);      // 记住地点，切到剧页 / 周边游也生效
    renderLoc();
    document.getElementById('pickResult').style.display = 'none';
    render();
  }

  /** 两个地点 → 中间点；之后所有展览 / 美食的距离都改从中间点算 */
  function applyMid() {
    var ea = document.getElementById('locInputA'), eb = document.getElementById('locInputB');
    var va = ((ea && ea.value) || '').trim();
    var vb = ((eb && eb.value) || '').trim();
    var ra = va ? locate(va) : null;
    var rb = vb ? locate(vb) : null;
    var bad = null;
    if (!va) bad = '还差第一个地点';
    else if (!ra || !ra.station) bad = '第一个地点 ' + (ra ? ra.how : '没找到');
    else if (!vb) bad = '还差第二个地点';
    else if (!rb || !rb.station) bad = '第二个地点 ' + (rb ? rb.how : '没找到');

    if (bad) {
      state.mid = null; state.loc = null; state.nearBy = false;
      dropLocMid();
      var box = document.getElementById('locResult');
      if (box) box.innerHTML = '<span class="loc-bad">中间点没算出来 —— ' + esc(bad) + '</span>';
      syncChip();
      render();
      return;
    }

    state.mid = midpointOf(ra, rb);
    state.loc = null;                    // 中间点模式覆盖单点
    dropLoc();
    state.nearBy = true;
    saveLocMid(va, vb);
    renderLoc();
    var pr = document.getElementById('pickResult'); if (pr) pr.style.display = 'none';
    render();
  }

  function clearLoc() {
    ['locInput', 'locInputA', 'locInputB'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    state.loc = null; state.mid = null; state.nearBy = false;
    dropLoc(); dropLocMid();
    renderLoc();
    render();
  }

  function renderQuick() {
    var box = document.getElementById('quickStations');
    if (!box) return;
    box.innerHTML = METRO.quick.map(function (n) {
      return '<span class="chip sm" data-quick="' + n + '">' + n + '</span>';
    }).join('');
  }

  /* ---------- 我的笔记汇总 ---------- */
  function renderMyNotes() {
    var box = document.getElementById('myNotes');
    if (!box) return;
    var ids = Object.keys(notes).filter(function (id) { return (notes[id] || []).length; });
    if (!ids.length) {
      box.innerHTML = '<div class="note-empty">还没有笔记。在任意卡片下面点「💬 我的笔记」就能写，存在这台设备的浏览器里。</div>';
      return;
    }
    var html = '';
    ids.forEach(function (id) {
      var a = DATA.filter(function (x) { return x.id === id; })[0];
      var name = a ? a.name : id;
      html += '<div class="mn-group"><div class="mn-name">' + esc(name) + '</div>';
      notes[id].forEach(function (n, i) {
        html += '<div class="note-item"><span class="note-time">' + fmtTime(n.t) + '</span>' +
          '<span class="note-txt">' + esc(n.txt) + '</span>' +
          '<span class="note-del" data-del="' + id + '" data-i="' + i + '" title="删除">×</span></div>';
      });
      html += '</div>';
    });
    box.innerHTML = html;
  }

  function exportNotes() {
    var txt = JSON.stringify(notes, null, 2);
    var blob = new Blob([txt], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'weekendgo-notes.json';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  /* ---------- Giscus 评论（存在仓库的 GitHub Discussions 里） ---------- */
  function setupGiscus() {
    var cfg = window.GISCUS_CFG || {};
    var box = document.getElementById('giscusBox');
    var hint = document.getElementById('giscusHint');
    if (!box) return;

    if (!cfg.enabled || !cfg.repo) {
      if (hint) hint.style.display = '';
      box.innerHTML = '<div class="note-empty">评论区还没开：把 <code>window.GISCUS_CFG.enabled</code> 改成 true。</div>';
      return;
    }

    var s = document.createElement('script');
    s.src = 'https://giscus.app/client.js';
    s.setAttribute('data-repo', cfg.repo);
    if (cfg.repoId) s.setAttribute('data-repo-id', cfg.repoId);
    if (cfg.category) s.setAttribute('data-category', cfg.category);
    if (cfg.categoryId) s.setAttribute('data-category-id', cfg.categoryId);
    s.setAttribute('data-mapping', 'pathname');
    s.setAttribute('data-strict', '0');
    s.setAttribute('data-reactions-enabled', '1');
    s.setAttribute('data-emit-metadata', '0');
    s.setAttribute('data-input-position', 'bottom');
    s.setAttribute('data-theme', 'light');
    s.setAttribute('data-lang', 'zh-CN');
    s.setAttribute('crossorigin', 'anonymous');
    s.async = true;
    box.appendChild(s);

    // 成功加载 → 收起配置提示；约 20 秒还没出 iframe 就保留提示（说明配置缺失）
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (document.querySelector('iframe.giscus-frame')) {
        if (hint) hint.style.display = 'none';
        clearInterval(iv);
      } else if (tries > 40) { clearInterval(iv); }
    }, 500);

    // giscus 会把真实错误 postMessage 出来，直接翻译成可操作的指引
    window.addEventListener('message', function (ev) {
      if (ev.origin !== 'https://giscus.app') return;
      var d = ev.data && ev.data.giscus;
      if (!d || !d.error) return;
      if (!hint) return;
      hint.className = 'giscus-bad';
      hint.innerHTML = '评论区没加载成功：<code>' + String(d.error) + '</code><br>' +
        '最常见就是这个仓库还没装 giscus App —— ' +
        '<a href="https://github.com/apps/giscus/installations/new" target="_blank" rel="noopener noreferrer">点这里安装</a>' +
        '（一下授权，免费），装完刷新本页即可，不用改代码。<br>' +
        '若已安装仍失败，再核对：① 仓库 Settings 里 <b>Discussions</b> 是否勾选；' +
        '② <code>category</code> 填的是否是该仓库真实存在的分类。';
      hint.style.display = '';
    });
  }

  /* ---------- 打赏：收款码没到位就把整块收起来，别留破图 ---------- */
  function setupReward() {
    var panel = document.getElementById('rewardPanel');
    if (!panel) return;
    var imgs = panel.querySelectorAll('img');
    if (!imgs.length) { panel.style.display = 'none'; return; }
    Array.prototype.forEach.call(imgs, function (im) {
      function kill() { panel.style.display = 'none'; }
      im.addEventListener('error', kill);
      if (im.complete && im.naturalWidth === 0) kill();
    });
  }

  /* ================= 帮我选一个 ================= */
  function pick() {
    var pool = DATA.filter(function (a) { return match(a) && !isEnded(a); });
    if (!pool.length) { alert('当前筛选下没有可推荐的项目，放宽条件试试。'); return; }
    var weighted = [];
    pool.forEach(function (a) {
      var w = (a.rating || 3);
      if (isTrip(a)) {
        if (a.tripLen === 'day') w += 2; else if (a.tripLen === '2d') w += 1;
      } else if (isFood(a)) {
        w += 1;
      } else {
        var d = daysLeft(a.end);
        if (d <= 10) w += 2; else if (d <= 30) w += 1;
      }
      if (a.price.free) w += 1;
      // 定位后：近的加权（中间点模式同样算）
      if (refPoint()) {
        var km = distOf(a);
        if (km != null) {
          if (km < 2) w += 4;
          else if (km < 5) w += 2;
          else if (km < 10) w += 1;
        }
      }
      for (var i = 0; i < w; i++) weighted.push(a);
    });
    var a = weighted[Math.floor(Math.random() * weighted.length)];
    var b = badgeOf(a);
    var why = [];
    if (a.price.free) why.push('免费');
    if (!a.booking.required) why.push('不用预约，说走就走');
    if (refPoint()) {
      var km2 = distOf(a);
      if (km2 != null) why.push('离' + refLabel() + '约 ' + km2.toFixed(1) + ' 公里，' + (gradeOf(km2).txt));
    }
    if (isTrip(a)) {
      if (a.tripLen === 'day') why.push('当天就能来回，不用请假');
      else if (a.tripLen === '2d') why.push('请一天假就能走');
      else why.push('需要凑个三天，适合小长假');
      if (a.budget) why.push('预算：' + a.budget);
    } else if (isFood(a)) {
      if (a.best) why.push('最佳时段是' + a.best);
      if (a.budget) why.push(a.budget);
    } else {
      var d2 = daysLeft(a.end);
      if (d2 <= 10) why.push('只剩 ' + d2 + ' 天，再不去就没了');
      else if (d2 > 180) why.push('展期很长，可以从容挑个工作日');
    }
    if ((a.rating || 0) >= 5) why.push('这批里口碑最高的一个');

    var metaLine;
    if (isTrip(a)) {
      metaLine = '<div class="pk-line">' + TYPE_TEXT[a.type] + ' · ' + a.venue + '（' + a.district + '）　' + (a.tripDays || '') + '</div>' +
        '<div class="pk-line">' + (a.distance || '') + '</div>';
    } else if (isFood(a)) {
      metaLine = '<div class="pk-line">美食 · ' + a.venue + '（' + a.district + '）　' + (a.hours || '') + '</div>' +
        '<div class="pk-line">' + (a.budget || a.price.amount) + '　·　' + (stationOf(a) || '') + '站</div>';
    } else {
      metaLine = '<div class="pk-line">' + TYPE_TEXT[a.type] + ' · ' + a.venue + '（' + a.district + '）</div>' +
        '<div class="pk-line">' + a.start + ' ~ ' + a.end + '　' + (a.closedDay || '') + '</div>';
    }

    var box = document.getElementById('pickResult');
    box.style.display = 'block';
    box.innerHTML = '<div class="pick-card">' +
      '<div class="pk-name">' + a.name + ' <span class="badge ' + b.cls + '" style="margin-left:6px">' + b.txt + '</span></div>' +
      metaLine +
      '<div class="pk-line">' + (a.price.free ? '免费' : a.price.amount) + '　·　' + (LEVEL_TEXT[a.booking.level] || '') + '　·　' + (a.booking.channel || '') + '</div>' +
      (why.length ? '<div class="pk-why"><b>为什么是它：</b>' + why.join('；') + '。</div>' : '') +
      '</div>';
    if (box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ================= 事件 ================= */
  function bind() {
    document.querySelectorAll('.chip[data-group]').forEach(function (el) {
      el.addEventListener('click', function () {
        var g = el.getAttribute('data-group');
        var v = el.getAttribute('data-val');
        if (g === 'toggle') {
          state[v] = !state[v];
          el.classList.toggle('on', state[v]);
        } else {
          document.querySelectorAll('.chip[data-group="' + g + '"]').forEach(function (o) { o.classList.remove('on'); });
          el.classList.add('on');
          state[g] = v;
        }
        document.getElementById('pickResult').style.display = 'none';
        render();
      });
    });

    document.getElementById('btnDecide').addEventListener('click', pick);
    document.getElementById('btnLoc').addEventListener('click', applyLoc);
    document.getElementById('btnLocClear').addEventListener('click', clearLoc);

    // 快速跳转：直接筛出某一类型并滚到列表
    document.querySelectorAll('[data-jump]').forEach(function (el) {
      el.addEventListener('click', function () {
        var v = el.getAttribute('data-jump');
        var target = document.querySelector('.chip[data-group="type"][data-val="' + v + '"]');
        if (target) target.click();
        var g = document.getElementById('grid');
        if (g && g.scrollIntoView) g.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    document.getElementById('locInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') applyLoc();
    });

    // 中间点：两个地点 + 回车也能算
    var bm = document.getElementById('btnMid');
    if (bm) bm.addEventListener('click', applyMid);
    ['locInputA', 'locInputB'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('keydown', function (e) { if (e.key === 'Enter') applyMid(); });
    });

    // 记住最后聚焦的是哪个地点输入框 —— 快捷站点芯片按它来填
    var locFocus = 'locInput';
    ['locInput', 'locInputA', 'locInputB'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('focus', function () { locFocus = id; });
    });
    var exp = document.getElementById('btnExport');
    if (exp) exp.addEventListener('click', exportNotes);

    // 就近优先开关
    var chipNear = document.getElementById('chipNear');
    if (chipNear) {
      chipNear.addEventListener('click', function () {
        if (!refPoint()) return;
        state.nearBy = !state.nearBy;
        chipNear.classList.toggle('on', state.nearBy);
        chipNear.textContent = state.nearBy ? '📍 就近优先：开（点一下关掉）' : '📍 就近优先：关（点一下开启）';
        render();
      });
    }

    // 快捷站点：填进「最后点过的那一栏」；在中间点模式下填 A/B 并自动重算
    var qbox = document.getElementById('quickStations');
    if (qbox) {
      qbox.addEventListener('click', function (e) {
        var t = e.target.closest('[data-quick]');
        if (!t) return;
        var name = t.getAttribute('data-quick');
        var id = locFocus;
        if (id !== 'locInputA' && id !== 'locInputB') id = 'locInput';
        var el = document.getElementById(id);
        if (!el) return;
        el.value = name;
        if (id === 'locInput') { applyLoc(); return; }
        // 中间点模式：两个都填好了才算，否则等用户补另一个
        var ea = document.getElementById('locInputA'), eb = document.getElementById('locInputB');
        if (state.mid || ((ea && ea.value.trim()) && (eb && eb.value.trim()))) applyMid();
      });
    }

    // 卡片内的笔记交互（事件委托）
    var grid = document.getElementById('grid');
    grid.addEventListener('click', function (e) {
      var t;

      t = e.target.closest('[data-note]');
      if (t) {
        var idn = t.getAttribute('data-note');
        var box = document.getElementById('nb-' + idn);
        if (box) box.style.display = (box.style.display === 'none') ? 'block' : 'none';
        return;
      }

      t = e.target.closest('[data-save]');
      if (t) {
        var ids = t.getAttribute('data-save');
        var ta = document.getElementById('ni-' + ids);
        var txt = (ta.value || '').trim();
        if (!txt) { ta.focus(); return; }
        if (!notes[ids]) notes[ids] = [];
        notes[ids].push({ t: Date.now(), txt: txt });
        saveNotes(notes);
        render();
        var b2 = document.getElementById('nb-' + ids);
        if (b2) b2.style.display = 'block';
        return;
      }

      t = e.target.closest('[data-clear]');
      if (t) {
        var idc = t.getAttribute('data-clear');
        if (confirm('清空这条的所有笔记？')) { delete notes[idc]; saveNotes(notes); render(); }
        return;
      }

      t = e.target.closest('[data-del]');
      if (t) {
        var idd = t.getAttribute('data-del'), i = +t.getAttribute('data-i');
        if (notes[idd]) { notes[idd].splice(i, 1); if (!notes[idd].length) delete notes[idd]; saveNotes(notes); render(); }
        return;
      }
    });

    var mn = document.getElementById('myNotes');
    if (mn) {
      mn.addEventListener('click', function (e) {
        var t = e.target.closest('[data-del]');
        if (!t) return;
        var idd = t.getAttribute('data-del'), i = +t.getAttribute('data-i');
        if (notes[idd]) { notes[idd].splice(i, 1); if (!notes[idd].length) delete notes[idd]; saveNotes(notes); render(); }
      });
    }
  }

  /* ---------- 深链：?jump=trip 等，直接筛出某类型并滚到列表 ---------- */
  function applyJump() {
    try {
      var v = new URLSearchParams(location.search).get('jump');
      if (!v) return;
      var target = document.querySelector('.chip[data-group="type"][data-val="' + v + '"]');
      if (target) {
        target.click();
        var g = document.getElementById('grid');
        if (g && g.scrollIntoView) g.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (e) {}
  }

  /* ---------- 换页 / 换板块时，把「你在哪」一起带上（?here= 或 ?mid=A,B） ---------- */
  function carryLoc() {
    // a.block 是总览三块入口；.nav a 是页头互链（剧页 → 展览页这条路曾漏掉，导致定位丢失）
    var links = document.querySelectorAll('a.block, .nav a, nav a');
    Array.prototype.forEach.call(links, function (a) {
      a.addEventListener('click', function (ev) {
        var inp = document.getElementById('locInput');
        var v = inp ? (inp.value || '').trim() : '';
        var ea = document.getElementById('locInputA'), eb = document.getElementById('locInputB');
        var va = ((ea && ea.value) || '').trim();
        var vb = ((eb && eb.value) || '').trim();
        var midOn = !!(state.mid && va && vb);         // 中间点模式下优先带 ?mid=
        if (!midOn && !v) return;                      // 什么都没填就按原链接跳
        try {
          var u = new URL(a.getAttribute('href'), location.href);
          if (midOn) { u.searchParams.set('mid', va + ',' + vb); u.searchParams.delete('here'); }
          else { u.searchParams.set('here', v); u.searchParams.delete('mid'); }
          a.setAttribute('href', u.toString());   // 链接本身也带上，方便「复制链接地址」/ 中键新窗口
          ev.preventDefault();
          location.href = u.toString();
        } catch (e) {}
      });
    });
  }

  /** 从 ?mid=A,B 解析出两个地点（容忍全角逗号与多余空格） */
  function parseMidParam(raw) {
    if (!raw) return null;
    var parts = String(raw).split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (parts.length < 2) return null;
    return { a: parts[0], b: parts.slice(1).join(',') };
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('verifiedAt').textContent = META.verifiedAt || '';
    renderQuick();
    renderStats();
    renderLoc();
    bind();
    carryLoc();
    setupGiscus();
    setupReward();
    render();
    // 续上「你在哪」：URL 里 ?mid=（两地点中间点）/ ?here=（单点）最优先，其次本机记住的（当天有效）
    try {
      var q = new URLSearchParams(location.search);
      var rmid = parseMidParam(q.get('mid'));
      var h = q.get('here');
      if (!rmid && !h) {                 // URL 没指定才读本机记忆
        rmid = readLocMid();
        if (!rmid) h = readLoc();
      }
      if (rmid) {
        var ia = document.getElementById('locInputA'), ib = document.getElementById('locInputB');
        if (ia) ia.value = rmid.a;
        if (ib) ib.value = rmid.b;
        applyMid();
      } else if (h) {
        var inp = document.getElementById('locInput');
        if (inp) { inp.value = h; applyLoc(); }
      }
    } catch (e) {}
    applyJump();
  });
})();
