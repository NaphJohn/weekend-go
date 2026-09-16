(function () {
  'use strict';

  var DATA = window.SHOWS || [];
  var META = window.SHOWS_META || {};
  var TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);

  var TYPE_TEXT = {
    musical: '音乐剧', opera: '歌剧', dance: '舞剧/芭蕾',
    theatre: '话剧', concert: '音乐会', resident: '驻演·小剧场'
  };

  // ===== 地点定位（与展览页共用逻辑，按区中心估距）=====
  var METRO = window.METRO || { stations: [], places: [], district: {}, venue: {}, quick: [] };
  var STATION = {};
  METRO.stations.forEach(function (s) { STATION[s[0]] = { x: s[1], y: s[2], lines: s[3], d: s[4] }; });
  function escShow(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function stationOfShow(a) {
    if (a.metro) return a.metro;
    if (METRO.venue[a.id]) return METRO.venue[a.id];
    if (a.district && METRO.district[a.district]) return METRO.district[a.district];
    return null;
  }
  function kmBetween(n1, n2) {
    var a = STATION[n1], b = STATION[n2];
    if (!a || !b) return null;
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy) * METRO.unit / 1000;
  }
  function distOfShow(a) {
    if (!state.loc) return null;
    return kmBetween(state.loc.station, stationOfShow(a));
  }
  function gradeOf(km) {
    if (km == null) return null;
    if (km < 1.2) return { txt: '就在附近', sub: '步行或 1 站内', cls: 'd1' };
    if (km < 3.5) return { txt: '很近', sub: '地铁约 15 分钟', cls: 'd2' };
    if (km < 8) return { txt: '不远', sub: '地铁约 30 分钟', cls: 'd3' };
    if (km < 16) return { txt: '跨区', sub: '地铁约 45 分钟', cls: 'd4' };
    return { txt: '较远', sub: '地铁 1 小时起', cls: 'd5' };
  }
  function locate(raw) {
    var q0 = (raw || '').trim();
    if (!q0) return null;
    var q = q0.replace(/\s+/g, '').replace(/^上海市?/, '').replace(/市$/, '');
    if (!q) return null;
    if (STATION[q]) return { station: q, how: '定位到地铁站「' + q + '」' };
    var best = null, score = 0;
    METRO.places.forEach(function (p) {
      p[1].forEach(function (kw) {
        if (q.indexOf(kw) >= 0 && kw.length > score) { score = kw.length; best = { station: p[0], how: '按「' + kw + '」定位到 ' + p[0] + '站' }; }
      });
    });
    if (best) return best;
    var cand = null, diff = 1e9;
    Object.keys(STATION).forEach(function (n) {
      if (q.length >= 2 && n.indexOf(q) >= 0) { var d = n.length - q.length; if (d < diff) { diff = d; cand = n; } }
    });
    if (cand) return { station: cand, how: '匹配到地铁站「' + cand + '」' };
    var dq = q.replace(/区$/, '');
    if (METRO.district[dq] !== undefined) {
      var st = METRO.district[dq];
      if (st) return { station: st, how: '按「' + dq + '区」中心定位到 ' + st + '站' };
      return { station: null, how: dq + ' 暂无地铁直达，试试附近的区' };
    }
    return null;
  }
  function distLineShow(a) {
    if (!state.loc) return '';
    var km = distOfShow(a);
    if (km == null) return '';
    var g = gradeOf(km);
    return '<div class="dist ' + g.cls + '">📍 距 ' + escShow(state.loc.station) + ' 约 ' + km.toFixed(1) + ' 公里　<b>' + g.txt + '</b>　<span>' + g.sub + '</span></div>';
  }

  // 本周（周一 ~ 周日）
  function weekStart() {
    var d = new Date(TODAY);
    var w = (d.getDay() + 6) % 7; // 周一=0
    d.setDate(d.getDate() - w);
    return d;
  }
  var WS = weekStart();
  var WE = new Date(WS); WE.setDate(WE.getDate() + 6);

  function parse(s) { if (!s) return null; var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function daysTo(d) { return Math.round((parse(d) - TODAY) / 86400000); }
  function fmt(d) { return d.getFullYear() + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + ('0' + d.getDate()).slice(-2); }

  function statusOf(s) {
    if (!s.start || !s.end) return 'tbd';
    var st = parse(s.start), en = parse(s.end);
    if (en < TODAY) return 'ended';
    if (st <= TODAY) return 'running';
    return 'upcoming';
  }
  function runningNow(s) {
    var st = statusOf(s);
    return st === 'running' || st === 'upcoming';
  }
  function inThisWeek(s) {
    if (!s.start || !s.end) return false;
    var st = parse(s.start), en = parse(s.end);
    return st <= WE && en >= WS && en >= TODAY;
  }

  function badgeOf(s) {
    var st = statusOf(s);
    if (st === 'running') return { cls: 'b-run', txt: '在演中' };
    if (st === 'upcoming') {
      var d = daysTo(s.start);
      var md = s.start.slice(5).replace('-', '.');
      return { cls: d <= 14 ? 'b-urgent' : 'b-soon', txt: md + ' 开演' };
    }
    if (st === 'ended') return { cls: 'b-end', txt: '已结束' };
    return { cls: 'b-tbd', txt: '档期待定' };
  }

  var state = { type: 'all', status: 'all', district: 'all', band: 'all', loc: null, nearBy: false };

  function match(s) {
    if (state.type !== 'all' && s.type !== state.type) return false;
    if (state.status !== 'all' && statusOf(s) !== state.status) return false;
    if (state.district !== 'all' && s.district !== state.district) return false;
    if (state.band !== 'all') {
      var p = s.price || {};
      if (p.min == null || p.max == null) return false;
      if (state.band === 'low' && p.min > 200) return false;
      if (state.band === 'high' && p.max < 800) return false;
    }
    return true;
  }

  var ORD = { running: 0, upcoming: 1, tbd: 2, ended: 3 };
  function sortFn(x, y) {
    // 定位 + 就近优先：纯按距离排
    if (state.loc && state.nearBy) {
      var d1 = distOfShow(x), d2 = distOfShow(y);
      if (d1 != null && d2 != null && Math.abs(d1 - d2) > 0.2) return d1 - d2;
      if (d1 == null && d2 != null) return 1;
      if (d1 != null && d2 == null) return -1;
    }
    var a = ORD[statusOf(x)], b = ORD[statusOf(y)];
    if (a !== b) return a - b;
    var sx = x.start ? parse(x.start).getTime() : 9e15;
    var sy = y.start ? parse(y.start).getTime() : 9e15;
    if (statusOf(x) === 'ended') { sx = -sx; sy = -sy; } // 已结束：近的在前
    return sx - sy;
  }

  function dateLine(s) {
    if (!s.start || !s.end) return '<span style="color:var(--sub)">档期待定 · 以官方开票为准</span>';
    var r = s.start === s.end ? s.start : (s.start + ' ~ ' + s.end);
    var extra = '';
    if (statusOf(s) === 'running') extra = '（在演）';
    else if (statusOf(s) === 'upcoming') extra = '（' + daysTo(s.start) + ' 天后开演）';
    return r + '　' + extra + (s.sessions ? '<br><span style="color:var(--sub)">' + s.sessions + '</span>' : '');
  }

  // 组装展开区
  function detailHTML(s) {
    var out = '';
    if (s.platform) out += '<div><b>购票渠道：</b>' + s.platform + '</div>';
    if (s.sessions) out += '<div><b>场次：</b>' + s.sessions + '</div>';
    if (s.duration) out += '<div><b>时长：</b>' + s.duration + '</div>';
    if (s.highlight) out += '<div class="hl"><b>看点：</b>' + s.highlight + '</div>';
    if (s.price && s.price.note) out += '<div class="tip">' + s.price.note + '</div>';
    if (s.address) out += '<div class="hl">地址：' + s.address + '</div>';
    return out;
  }

  function cardHTML(s) {
    var b = badgeOf(s);
    var tags = (s.tags || []).map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('');
    var cls = statusOf(s) === 'ended' ? ' done' : '';
    return '<div class="card' + cls + '">' +
      '<div class="top"><h3>' + s.name + '</h3><span class="badge ' + b.cls + '">' + b.txt + '</span></div>' +
      '<div class="meta-line"><span class="pill-type">' + (TYPE_TEXT[s.type] || '') + '</span>　<b>' + s.venue + '</b>　<span style="color:var(--sub)">' + s.district + '</span></div>' +
      '<div class="meta-line">' + dateLine(s) + '</div>' +
      '<div class="price">🎫 <b>' + (s.price && s.price.text ? s.price.text : '以官方为准') + '</b>' +
        (s.language ? '　<span style="color:var(--sub)">· ' + s.language + '</span>' : '') + '</div>' +
      (s.duration ? '<div class="meta-line">⏱ ' + s.duration + '　<span style="color:var(--sub)">· ' + (s.platform || '') + '</span></div>' : '') +
      '<div class="tags">' + tags + '</div>' +
      distLineShow(s) +
      '<details><summary>展开：怎么买票 / 值不值得看</summary><div class="detail">' +
      detailHTML(s) +
      '</div></details>' +
      '</div>';
  }

  function render() {
    var list = DATA.filter(match).sort(sortFn);
    document.getElementById('grid').innerHTML = list.length
      ? list.map(cardHTML).join('')
      : '<div class="empty">没有符合条件的剧目，把筛选放宽一点试试。</div>';
    document.getElementById('count').textContent = list.length;
  }

  function renderStats() {
    var live = DATA.filter(function (s) { return statusOf(s) === 'running'; });
    var soon = DATA.filter(function (s) { return statusOf(s) === 'upcoming'; });
    document.getElementById('s-run').textContent = live.length;
    document.getElementById('s-soon').textContent = soon.length;
    document.getElementById('s-total').textContent = DATA.length;
    document.getElementById('s-week').textContent = DATA.filter(inThisWeek).length;
  }

  function renderWeek() {
    var pool = DATA.filter(function (s) { return inThisWeek(s); }).sort(sortFn);
    var box = document.getElementById('weekBox');
    if (!pool.length) {
      // 没有本周在演 → 提示最近开演
      var nxt = DATA.filter(function (s) { return statusOf(s) === 'upcoming'; }).sort(sortFn)[0];
      box.innerHTML = '<div class="week-empty">本周（' + fmt(WS) + '~' + fmt(WE) + '）暂无剧目开演，' +
        (nxt ? '最近一部是 <b>' + nxt.name + '</b>，' + nxt.start + ' 开演（' + daysTo(nxt.start) + ' 天后）。' : '近期暂无已官宣档期。') +
        '</div>';
      return;
    }
    box.innerHTML = pool.map(function (s) {
      var b = badgeOf(s);
      return '<div class="week-item"><span class="badge ' + b.cls + '">' + b.txt + '</span>' +
        '<b>' + s.name + '</b>　<span style="color:var(--sub)">' + s.venue + ' · ' + (TYPE_TEXT[s.type] || '') + '</span>' +
        '<div class="week-meta">' + (s.sessions || '') + '　·　' + (s.price && s.price.text ? s.price.text : '以官方为准') + '</div></div>';
    }).join('');
  }

  /* ---------- 地点面板 ---------- */
  function renderLoc() {
    var box = document.getElementById('locResult');
    var chip = document.getElementById('chipNear');
    if (!box) return;
    if (!state.loc || !state.loc.station) {
      box.innerHTML = state.loc
        ? '<span class="loc-bad">' + escShow(state.loc.how) + '</span>'
        : '<span class="hint">不填也能用，下面是全部剧目。</span>';
      if (chip) { chip.style.display = 'none'; state.nearBy = false; chip.classList.remove('on'); }
      return;
    }
    var st = STATION[state.loc.station];
    box.innerHTML = '<span class="loc-ok">✅ ' + escShow(state.loc.how) +
      (st ? '　·　' + st.lines + ' 号线　·　' + st.d : '') + '</span>' +
      '<span class="hint" style="margin-left:8px">已按距离重排，每张卡片标了路程。</span>';
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
    var pr = document.getElementById('pickResult'); if (pr) pr.style.display = 'none';
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

  function pick() {
    var pool = DATA.filter(function (s) { return match(s) && runningNow(s); });
    if (!pool.length) { alert('当前筛选下没有可推荐的剧目，放宽条件试试。'); return; }
    var weighted = [];
    pool.forEach(function (s) {
      var w = (s.rating || 3);
      if (statusOf(s) === 'running') w += 3;
      var d = s.start ? daysTo(s.start) : 999;
      if (d >= 0 && d <= 14) w += 2; else if (d <= 45) w += 1;
      for (var i = 0; i < w; i++) weighted.push(s);
    });
    var s = weighted[Math.floor(Math.random() * weighted.length)];
    var b = badgeOf(s);
    var why = [];
    if (statusOf(s) === 'running') why.push('正在上演，这周就能看');
    else if (s.start) why.push(daysTo(s.start) + ' 天后开演');
    if ((s.rating || 0) >= 5) why.push('这批里口碑最高的之一');
    if (s.price && s.price.min != null && s.price.min <= 200) why.push('有 200 元以内的票');
    if (s.type === 'resident') why.push('小剧场沉浸式，时长友好');
    var box = document.getElementById('pickResult');
    box.style.display = 'block';
    box.innerHTML = '<div class="pick-card">' +
      '<div class="pk-name">' + s.name + ' <span class="badge ' + b.cls + '" style="margin-left:6px">' + b.txt + '</span></div>' +
      '<div class="pk-line">' + (TYPE_TEXT[s.type] || '') + ' · ' + s.venue + '（' + s.district + '）</div>' +
      '<div class="pk-line">' + (s.start ? (s.start === s.end ? s.start : s.start + ' ~ ' + s.end) : '档期待定') + '　' + (s.sessions || '') + '</div>' +
      '<div class="pk-line">' + (s.price && s.price.text ? s.price.text : '以官方为准') + '　·　' + (s.duration || '') + '</div>' +
      (why.length ? '<div class="pk-why"><b>为什么是它：</b>' + why.join('；') + '。</div>' : '') +
      '</div>';
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function bind() {
    document.querySelectorAll('.chip').forEach(function (el) {
      el.addEventListener('click', function () {
        var g = el.getAttribute('data-group');
        var v = el.getAttribute('data-val');
        document.querySelectorAll('.chip[data-group="' + g + '"]').forEach(function (o) { o.classList.remove('on'); });
        el.classList.add('on');
        state[g] = v;
        document.getElementById('pickResult').style.display = 'none';
        render();
      });
    });
    document.getElementById('btnDecide').addEventListener('click', pick);

    // 地点定位
    var bl = document.getElementById('btnLoc'); if (bl) bl.addEventListener('click', applyLoc);
    var bc = document.getElementById('btnLocClear'); if (bc) bc.addEventListener('click', clearLoc);
    var li = document.getElementById('locInput');
    if (li) li.addEventListener('keydown', function (e) { if (e.key === 'Enter') applyLoc(); });
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
    var qbox = document.getElementById('quickStations');
    if (qbox) {
      qbox.addEventListener('click', function (e) {
        var t = e.target.closest('[data-quick]');
        if (!t) return;
        document.getElementById('locInput').value = t.getAttribute('data-quick');
        applyLoc();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('grid')) return; // 仅在本页（shows.html）运行
    document.getElementById('verifiedAt').textContent = META.verifiedAt || '';
    document.getElementById('weekRange').textContent = fmt(WS) + ' ~ ' + fmt(WE);
    renderStats();
    renderWeek();
    renderQuick();
    renderLoc();
    bind();
    render();
    // 从总览带 ?here= 进来 → 预填定位，让「你在哪」延续
    try {
      var h = new URLSearchParams(location.search).get('here') || new URLSearchParams(location.search).get('loc');
      if (h) { var inp = document.getElementById('locInput'); if (inp) { inp.value = h; applyLoc(); } }
    } catch (e) {}
  });
})();
