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
  // 任意坐标点 → 某座车站的直线距离（公里）
  function kmToPoint(p, n) {
    var b = n && STATION[n];
    if (!p || !b) return null;
    var dx = b.x - p.x, dy = b.y - p.y;
    return Math.sqrt(dx * dx + dy * dy) * METRO.unit / 1000;
  }
  /** 当前参考点：中间点优先，其次定位到的地铁站（与展览页同一套规则） */
  function refPoint() {
    if (state.mid) return state.mid;
    if (state.loc && state.loc.station && STATION[state.loc.station]) {
      var s = STATION[state.loc.station];
      return { x: s.x, y: s.y, label: state.loc.station };
    }
    return null;
  }
  function refLabel() {
    if (state.mid) return '「' + escShow(state.mid.a) + ' ↔ ' + escShow(state.mid.b) + '」中间点';
    if (state.loc && state.loc.station) return escShow(state.loc.station);
    return '';
  }
  /** 两个地点的中点：坐标取平均 + 找最近车站作为「大概在哪」的锚点 */
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
  function distOfShow(a) {
    var p = refPoint();
    if (!p) return null;
    return kmToPoint(p, stationOfShow(a));
  }
  function gradeOf(km) {
    if (km == null) return null;
    if (km < 1.2) return { txt: '就在附近', sub: '步行或 1 站内', cls: 'd1' };
    if (km < 3.5) return { txt: '很近', sub: '地铁约 15 分钟', cls: 'd2' };
    if (km < 8) return { txt: '不远', sub: '地铁约 30 分钟', cls: 'd3' };
    if (km < 16) return { txt: '跨区', sub: '地铁约 45 分钟', cls: 'd4' };
    return { txt: '较远', sub: '地铁 1 小时起', cls: 'd5' };
  }
  /** 生成候选写法：原样 → 去「上海」前缀 / 「市」「地铁」「站」后缀（与展览页同一套规则） */
  function locCandidates(raw) {
    var out = [];
    function push(v) { if (v && out.indexOf(v) < 0) out.push(v); }
    var base = (raw || '').trim().replace(/\s+/g, '');
    push(base);
    push(base.replace(/^上海市?/, ''));
    push(base.replace(/市$/, ''));
    push(base.replace(/^上海市?/, '').replace(/市$/, ''));
    out.slice().forEach(function (v) { push(v.replace(/地铁/g, '')); });
    out.slice().forEach(function (v) { if (/站$/.test(v) && v.length > 1) push(v.replace(/站$/, '')); });
    return out;
  }
  /** 输入地点 → 最近地铁站（与展览页同一套规则） */
  function locate(raw) {
    var tries = locCandidates(raw);
    if (!tries.length) return null;

    for (var i = 0; i < tries.length; i++) {
      if (STATION[tries[i]]) return { station: tries[i], how: '定位到地铁站「' + tries[i] + '」' };
    }

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

    var hit = null;
    tries.forEach(function (t) {
      names.forEach(function (n) {
        if (n.length >= 2 && t.indexOf(n) >= 0 && (!hit || n.length > hit.length)) hit = n;
      });
    });
    if (hit) return { station: hit, how: '匹配到地铁站「' + hit + '」' };

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

    var dqs = [];
    tries.forEach(function (t) { dqs.push(t, t.replace(/新区$/, ''), t.replace(/区$/, '')); });
    for (var j = 0; j < dqs.length; j++) {
      var dq = dqs[j];
      if (dq && METRO.district[dq] !== undefined) {
        var st = METRO.district[dq];
        if (st) return { station: st, how: '按「' + dq + '区」中心定位到 ' + st + '站' };
        return { station: null, how: dq + ' 暂无地铁直达，试试附近的区' };
      }
    }

    return { station: null, how: '没找到「' + (raw || '').trim() + '」，换个写法试试：地铁站名（漕盈路）/ 商圈（五角场）/ 道路（武康路）/ 区名（浦东）' };
  }
  // 中点落在哪儿的白话说人话：离最近站很近才说「XX 附近」
  function midAnchorText(m) {
    if (!m.near) return '';
    var km = m.nearKm == null ? null : m.nearKm;
    if (km != null && km <= 1.5) return '大概在 <b>' + escShow(m.near) + '</b> 附近（离该站约 ' + km.toFixed(1) + ' km）';
    if (km != null) return '中间点附近没有地铁站，最近是 <b>' + escShow(m.near) + '</b> 站（约 ' + km.toFixed(1) + ' km）';
    return '大概在 <b>' + escShow(m.near) + '</b> 一带';
  }
  function distLineShow(a) {
    if (!refPoint()) return '';
    var km = distOfShow(a);
    if (km == null) return '';
    var g = gradeOf(km);
    return '<div class="dist ' + g.cls + '">📍 距 ' + refLabel() + ' 约 ' + km.toFixed(1) + ' 公里　<b>' + g.txt + '</b>　<span>' + g.sub + '</span></div>';
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

  var state = { type: 'all', status: 'all', district: 'all', band: 'all', loc: null, mid: null, nearBy: false };

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
    // 定位 + 就近优先：纯按距离排（中间点模式同样适用）
    if (refPoint() && state.nearBy) {
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

  /* ---------- 「你在哪」记忆（与展览页共用同一个 key） ---------- */
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
  /* 中间点的记忆：与单点分开存，换页不丢、互不覆盖 */
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

    // 中间点模式
    if (state.mid) {
      box.innerHTML = '<span class="loc-ok">✅ 中间点：' + escShow(state.mid.a) + ' ↔ ' + escShow(state.mid.b) +
        (state.mid.near ? '　·　' + midAnchorText(state.mid) : '') +
        '</span><span class="hint" style="margin-left:8px">已按「到中间点」的距离重排，每张卡片标了路程。</span>';
      syncChip();
      return;
    }

    if (!state.loc || !state.loc.station) {
      box.innerHTML = state.loc
        ? '<span class="loc-bad">' + escShow(state.loc.how) + '</span>'
        : '<span class="hint">不填也能用，下面是全部剧目。</span>';
      syncChip();
      return;
    }
    var st = STATION[state.loc.station];
    box.innerHTML = '<span class="loc-ok">✅ ' + escShow(state.loc.how) +
      (st ? '　·　' + st.lines + ' 号线　·　' + st.d : '') + '</span>' +
      '<span class="hint" style="margin-left:8px">已按距离重排，每张卡片标了路程。</span>';
    syncChip();
  }
  function applyLoc() {
    var v = document.getElementById('locInput').value;
    var r = locate(v);
    state.loc = r;
    state.mid = null;                    // 单点模式覆盖中间点
    dropLocMid();
    state.nearBy = !!(r && r.station);
    if (r && r.station) saveLoc(v);      // 记住地点，点「🎪 展览 · 市集」回展览页也生效
    renderLoc();
    var pr = document.getElementById('pickResult'); if (pr) pr.style.display = 'none';
    render();
  }
  /** 两个地点 → 中间点；之后所有剧目的距离都改从中间点算 */
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
      if (box) box.innerHTML = '<span class="loc-bad">中间点没算出来 —— ' + escShow(bad) + '</span>';
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

  /* 页头互链带「你在哪」：剧页 → 展览页曾漏掉，导致定位丢失 */
  function carryLoc() {
    var links = document.querySelectorAll('.nav a, nav a, a.block');
    Array.prototype.forEach.call(links, function (a) {
      a.addEventListener('click', function (ev) {
        var inp = document.getElementById('locInput');
        var v = inp ? (inp.value || '').trim() : '';
        var ea = document.getElementById('locInputA'), eb = document.getElementById('locInputB');
        var va = ((ea && ea.value) || '').trim();
        var vb = ((eb && eb.value) || '').trim();
        var midOn = !!(state.mid && va && vb);          // 中间点模式优先带 ?mid=
        if (!midOn && !v) return;
        try {
          var u = new URL(a.getAttribute('href'), location.href);
          if (midOn) { u.searchParams.set('mid', va + ',' + vb); u.searchParams.delete('here'); }
          else { u.searchParams.set('here', v); u.searchParams.delete('mid'); }
          a.setAttribute('href', u.toString());
          ev.preventDefault();
          location.href = u.toString();
        } catch (e) {}
      });
    });
  }
  /** 从 ?mid=A,B 解析两个地点（容忍全角逗号） */
  function parseMidParam(raw) {
    if (!raw) return null;
    var parts = String(raw).split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (parts.length < 2) return null;
    return { a: parts[0], b: parts.slice(1).join(',') };
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

  /* ---------- Giscus 评论（与展览页共用同一仓库，按 pathname 分成不同讨论串） ---------- */
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

    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (document.querySelector('iframe.giscus-frame')) {
        if (hint) hint.style.display = 'none';
        clearInterval(iv);
      } else if (tries > 40) { clearInterval(iv); }
    }, 500);

    // 按错误类型翻译成对应的可操作指引
    window.addEventListener('message', function (ev) {
      if (ev.origin !== 'https://giscus.app') return;
      var d = ev.data && ev.data.giscus;
      if (!d || !d.error) return;
      if (!hint) return;
      var err = String(d.error);
      var advice;
      if (/not installed/i.test(err)) {
        advice = '这个仓库还没装 giscus App —— ' +
          '<a href="https://github.com/apps/giscus/installations/new" target="_blank" rel="noopener noreferrer">点这里安装</a>' +
          '（一下授权，免费），装完刷新本页即可，不用改代码。';
      } else if (/discussion not found/i.test(err)) {
        advice = '多半是 <code>window.GISCUS_CFG.category</code> 填的分类名和仓库里真实的' +
          '分类对不上（搜不到就报这个）。到仓库 Discussions 里核对分类名；' +
          '如果本页只是还没有讨论，直接在下面的框里发第一条即可，giscus 会自动建。';
      } else {
        advice = '核对：① 仓库 Settings 里 <b>Discussions</b> 是否勾选；' +
          '② <code>category</code> 是否是该仓库真实存在的分类；③ 仓库是否 public。';
      }
      hint.className = 'giscus-bad';
      hint.innerHTML = '评论区没加载成功：<code>' + err + '</code><br>' + advice;
      hint.style.display = '';
    });
  }

  /* ---------- 打赏：收款码没到位就把整块收起来 ---------- */
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

  function bind() {
    // 只绑真正带 data-group 的筛选芯片；快捷站点 / 「就近优先」芯片由各自的处理函数负责
    document.querySelectorAll('.chip[data-group]').forEach(function (el) {
      el.addEventListener('click', function () {
        var g = el.getAttribute('data-group');
        var v = el.getAttribute('data-val');
        if (!g) return;
        document.querySelectorAll('.chip[data-group="' + g + '"]').forEach(function (o) { o.classList.remove('on'); });
        el.classList.add('on');
        state[g] = v;
        var pr = document.getElementById('pickResult'); if (pr) pr.style.display = 'none';
        render();
      });
    });
    document.getElementById('btnDecide').addEventListener('click', pick);

    // 地点定位
    var bl = document.getElementById('btnLoc'); if (bl) bl.addEventListener('click', applyLoc);
    var bc = document.getElementById('btnLocClear'); if (bc) bc.addEventListener('click', clearLoc);
    var li = document.getElementById('locInput');
    if (li) li.addEventListener('keydown', function (e) { if (e.key === 'Enter') applyLoc(); });

    // 中间点：两个地点 + 回车也能算
    var bm = document.getElementById('btnMid');
    if (bm) bm.addEventListener('click', applyMid);
    ['locInputA', 'locInputB'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('keydown', function (e) { if (e.key === 'Enter') applyMid(); });
    });
    // 记住最后聚焦的地点输入框 —— 快捷站点芯片按它来填
    var locFocus = 'locInput';
    ['locInput', 'locInputA', 'locInputB'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('focus', function () { locFocus = id; });
    });

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
        // 中间点模式：两个都填好了才算
        var ea = document.getElementById('locInputA'), eb = document.getElementById('locInputB');
        if (state.mid || ((ea && ea.value.trim()) && (eb && eb.value.trim()))) applyMid();
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
    carryLoc();
    setupGiscus();
    setupReward();
    render();
    // 续上「你在哪」：URL 里 ?mid=（两地点中间点）/ ?here= ?loc=（单点）最优先，其次本机记住的（当天有效）
    try {
      var q = new URLSearchParams(location.search);
      var rmid = parseMidParam(q.get('mid'));
      var h = q.get('here') || q.get('loc');
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
  });
})();
