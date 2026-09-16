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

  function stationOf(a) { return a.metro || METRO.venue[a.id] || null; }

  // 两点直线距离（公里）。坐标为示意坐标，只用于「谁近谁远」的粗排
  function kmBetween(n1, n2) {
    var a = STATION[n1], b = STATION[n2];
    if (!a || !b) return null;
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy) * METRO.unit / 1000;
  }

  function distOf(a) {
    if (!state.loc) return null;
    return kmBetween(state.loc.station, stationOf(a));
  }

  function gradeOf(km) {
    if (km == null) return null;
    if (km < 1.2) return { txt: '就在附近', sub: '步行或 1 站内', cls: 'd1' };
    if (km < 3.5) return { txt: '很近', sub: '地铁约 15 分钟', cls: 'd2' };
    if (km < 8) return { txt: '不远', sub: '地铁约 30 分钟', cls: 'd3' };
    if (km < 16) return { txt: '跨区', sub: '地铁约 45 分钟', cls: 'd4' };
    return { txt: '较远', sub: '地铁 1 小时起', cls: 'd5' };
  }

  /** 输入地点 → 最近地铁站 */
  function locate(raw) {
    var q0 = (raw || '').trim();
    if (!q0) return null;
    var q = q0.replace(/\s+/g, '').replace(/^上海市?/, '').replace(/市$/, '');
    if (!q) return null;

    // 1) 正好是地铁站名
    if (STATION[q]) return { station: q, how: '定位到地铁站「' + q + '」' };

    // 2) 地标 / 道路 / 商圈 关键词命中（取最长关键词）
    var best = null, score = 0;
    METRO.places.forEach(function (p) {
      p[1].forEach(function (kw) {
        if (q.indexOf(kw) >= 0 && kw.length > score) {
          score = kw.length;
          best = { station: p[0], how: '按「' + kw + '」定位到 ' + p[0] + '站' };
        }
      });
    });
    if (best) return best;

    // 3) 地铁站名部分匹配
    var cand = null, diff = 1e9;
    Object.keys(STATION).forEach(function (n) {
      if (q.length >= 2 && n.indexOf(q) >= 0) {
        var d = n.length - q.length;
        if (d < diff) { diff = d; cand = n; }
      }
    });
    if (cand) return { station: cand, how: '匹配到地铁站「' + cand + '」' };

    // 4) 只输了区名
    var dq = q.replace(/区$/, '');
    if (METRO.district[dq] !== undefined) {
      var st = METRO.district[dq];
      if (st) return { station: st, how: '按「' + dq + '区」中心定位到 ' + st + '站' };
      return { station: null, how: dq + ' 暂无地铁直达，试试附近的区' };
    }
    return null;
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
    loc: null,      // {station, how}
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
    if (state.type !== 'all' && a.type !== state.type) return false;
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

  function distLine(a) {
    if (!state.loc || isTrip(a)) return '';
    var km = distOf(a);
    if (km == null) return '';
    var g = gradeOf(km);
    return '<div class="dist ' + g.cls + '">📍 距 ' + esc(state.loc.station) + ' 约 ' + km.toFixed(1) + ' 公里　<b>' + g.txt + '</b>　<span>' + g.sub + '</span></div>';
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

    // 定位 + 就近优先：市内活动和美食混在一起，纯按距离排
    if (state.loc && state.nearBy) {
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

  /* ---------- 地点面板 ---------- */
  function renderLoc() {
    var box = document.getElementById('locResult');
    var chip = document.getElementById('chipNear');
    if (!state.loc || !state.loc.station) {
      box.innerHTML = state.loc
        ? '<span class="loc-bad">' + esc(state.loc.how) + '</span>'
        : '<span class="hint">不填也能用，下面是全部内容。</span>';
      if (chip) { chip.style.display = 'none'; state.nearBy = false; chip.classList.remove('on'); }
      return;
    }
    var st = STATION[state.loc.station];
    box.innerHTML = '<span class="loc-ok">✅ ' + esc(state.loc.how) +
      (st ? '　·　' + st.lines + ' 号线　·　' + st.d : '') + '</span>' +
      '<span class="hint" style="margin-left:8px">已按距离重排，下面每张卡片标了路程。</span>';
    if (chip) {
      chip.style.display = '';
      chip.classList.toggle('on', state.nearBy);
      chip.textContent = state.nearBy ? '📍 就近优先：开（点一下关掉）' : '📍 就近优先：关（点一下开启）';
    }
  }

  function applyLoc() {
    var v = document.getElementById('locInput').value;
    var r = locate(v);
    state.loc = r;
    state.nearBy = !!(r && r.station);
    renderLoc();
    document.getElementById('pickResult').style.display = 'none';
    render();
  }

  function clearLoc() {
    document.getElementById('locInput').value = '';
    state.loc = null; state.nearBy = false;
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

  /* ---------- Giscus 全局讨论（可选） ---------- */
  function setupGiscus() {
    var cfg = window.GISCUS_CFG || {};
    var box = document.getElementById('giscusBox');
    if (!box) return;
    if (cfg.enabled && cfg.repo) {
      var s = document.createElement('script');
      s.src = 'https://giscus.app/client.js';
      s.setAttribute('data-repo', cfg.repo);
      s.setAttribute('data-repo-id', cfg.repoId || '');
      s.setAttribute('data-category', cfg.category || 'General');
      s.setAttribute('data-category-id', cfg.categoryId || '');
      s.setAttribute('data-mapping', 'pathname');
      s.setAttribute('data-strict', '0');
      s.setAttribute('data-reactions-enabled', '1');
      s.setAttribute('data-emit-metadata', '0');
      s.setAttribute('data-input-position', 'bottom');
      s.setAttribute('data-theme', 'light');
      s.setAttribute('data-lang', 'zh-CN');
      s.setAttribute('crossorigin', 'anonymous');
      s.async = true;
      box.innerHTML = '';
      box.appendChild(s);
    } else {
      box.innerHTML = '<div class="note-empty">全局讨论区还没接。想让访客用 GitHub 账号直接留言：' +
        '① 仓库 Settings → 勾选 Discussions；② 到 giscus.app 授权并拿到 repo-id / category-id；' +
        '③ 填进 index.html 里的 <code>GISCUS_CFG</code>，把 <code>enabled</code> 改成 true。</div>';
    }
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
      // 定位后：近的加权
      if (state.loc && state.loc.station) {
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
    if (state.loc && state.loc.station) {
      var km2 = distOf(a);
      if (km2 != null) why.push('离「' + state.loc.station + '」约 ' + km2.toFixed(1) + ' 公里，' + (gradeOf(km2).txt));
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
    var exp = document.getElementById('btnExport');
    if (exp) exp.addEventListener('click', exportNotes);

    // 就近优先开关
    var chipNear = document.getElementById('chipNear');
    if (chipNear) {
      chipNear.addEventListener('click', function () {
        if (!state.loc || !state.loc.station) return;
        state.nearBy = !state.nearBy;
        chipNear.classList.toggle('on', state.nearBy);
        chipNear.textContent = state.nearBy ? '📍 就近优先：开（点一下关掉）' : '📍 就近优先：关（点一下开启）';
        render();
      });
    }

    // 快捷站点
    var qbox = document.getElementById('quickStations');
    if (qbox) {
      qbox.addEventListener('click', function (e) {
        var t = e.target.closest('[data-quick]');
        if (!t) return;
        document.getElementById('locInput').value = t.getAttribute('data-quick');
        applyLoc();
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

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('verifiedAt').textContent = META.verifiedAt || '';
    renderQuick();
    renderStats();
    renderLoc();
    bind();
    setupGiscus();
    render();
    applyJump();
  });
})();
