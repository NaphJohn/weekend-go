(function () {
  'use strict';

  var DATA = window.SHOWS || [];
  var META = window.SHOWS_META || {};
  var TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);

  var TYPE_TEXT = {
    musical: '音乐剧', opera: '歌剧', dance: '舞剧/芭蕾',
    theatre: '话剧', concert: '音乐会', resident: '驻演·小剧场'
  };

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
  /** 划词批注用的卡片 id 写到属性里，先做最小转义 */
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

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

  var WG = window.WG || {};
  var METRO = window.METRO || {};

  function stationOf(s) { return (METRO.showVenue && METRO.showVenue[s.id]) || null; }

  /**
   * 距离基准 state.ref —— 中间点优先，否则单点定位。
   * ⚠️ 所有跟距离有关的地方（distOf / distLine / sortFn / 帮我选一部）
   *    都必须只读 state.ref，改基准一律走 refreshRef()。
   */
  function refreshRef() {
    var r = null;
    if (state.midA && state.midB && WG.midPoint) {
      var mp = WG.midPoint(state.midA, state.midB);
      if (mp) r = { kind: 'mid', pt: mp.M, label: mp.A + ' ↔ ' + mp.B, near: mp.near };
    }
    if (!r && state.loc && state.loc.station && WG.station) {
      var p = WG.station(state.loc.station);
      if (p) r = { kind: 'loc', pt: p, label: state.loc.station, near: { name: state.loc.station, km: 0 } };
    }
    state.ref = r;
    return r;
  }
  function refLabel() {
    if (!state.ref) return '';
    return state.ref.kind === 'mid' ? '「' + state.ref.label + '」中间点' : '「' + state.ref.label + '」';
  }

  function distOf(s) {
    if (!state.ref) return null;
    var st = stationOf(s);
    if (!st) return null;
    return WG.ptKm ? WG.ptKm(state.ref.pt, st) : null;
  }

  var state = {
    type: 'all', status: 'all', district: 'all', band: 'all',
    loc: null,          // {station, how} 单点定位
    midA: null,         // 中间点 A、B 的【站名】；与 loc 互斥
    midB: null,
    midErr: '',
    ref: null,          // 唯一距离基准
    nearBy: false
  };

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
    var a = ORD[statusOf(x)], b = ORD[statusOf(y)];
    if (a !== b) return a - b;
    // 定位 + 就近优先：同状态内按距离排（已结束的不参与距离排序）
    if (state.ref && state.nearBy && a !== 3) {
      var d1 = distOf(x), d2 = distOf(y);
      if (d1 != null && d2 != null && Math.abs(d1 - d2) > 0.2) return d1 - d2;
      if (d1 == null && d2 != null) return 1;
      if (d1 != null && d2 == null) return -1;
    }
    var sx = x.start ? parse(x.start).getTime() : 9e15;
    var sy = y.start ? parse(y.start).getTime() : 9e15;
    if (statusOf(x) === 'ended') { sx = -sx; sy = -sy; } // 已结束：近的在前
    return sx - sy;
  }

  function distLine(s) {
    if (!state.ref || statusOf(s) === 'ended') return '';
    var km = distOf(s);
    if (km == null) return '';
    var g = WG.grade ? WG.grade(km) : null;
    if (!g) return '';
    return '<div class="dist ' + g.cls + '">📍 距 ' + esc(refLabel()) + ' 约 ' + km.toFixed(1) +
      ' 公里　<b>' + g.txt + '</b>　<span>' + g.sub + '</span></div>';
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
    // data-id 是「划词批注」的定位锚：每次重渲染后靠它把批注画回原处
    return '<div class="card' + cls + '" data-id="' + esc(s.id) + '">' +
      '<div class="top"><h3>' + s.name + '</h3><span class="badge ' + b.cls + '">' + b.txt + '</span></div>' +
      '<div class="meta-line"><span class="pill-type">' + (TYPE_TEXT[s.type] || '') + '</span>　<b>' + s.venue + '</b>　<span style="color:var(--sub)">' + s.district + '</span></div>' +
      '<div class="meta-line">' + dateLine(s) + '</div>' +
      '<div class="price">🎫 <b>' + (s.price && s.price.text ? s.price.text : '以官方为准') + '</b>' +
        (s.language ? '　<span style="color:var(--sub)">· ' + s.language + '</span>' : '') + '</div>' +
      (s.duration ? '<div class="meta-line">⏱ ' + s.duration + '　<span style="color:var(--sub)">· ' + (s.platform || '') + '</span></div>' : '') +
      distLine(s) +
      '<div class="tags">' + tags + '</div>' +
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
    if (window.Annotate) window.Annotate.apply();   // 划词批注重新上色
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

  /* ---------- 地点定位 ---------- */
  function renderLoc() {
    var box = document.getElementById('locResult');
    var chip = document.getElementById('chipNear');
    if (!box) return;
    refreshRef();

    if (!state.ref) {
      var bad = (state.loc && state.loc.how) || state.midErr || '';
      box.innerHTML = bad
        ? '<span class="loc-bad">' + esc(bad) + '</span>'
        : '<span class="hint">不填也能用，下面是全部剧目。</span>';
      if (chip) { chip.style.display = 'none'; state.nearBy = false; chip.classList.remove('on'); }
      syncCarry();
      return;
    }

    var html;
    if (state.ref.kind === 'mid') {
      var nr = state.ref.near;
      var where = '';
      if (nr) {
        where = nr.km <= 1.5
          ? '　·　大概在 <b>' + esc(nr.name) + '</b> 附近（离该站约 ' + nr.km.toFixed(1) + ' 公里）'
          : '　·　中间点附近没有地铁站，最近是 <b>' + esc(nr.name) + '</b> 站（约 ' + nr.km.toFixed(1) + ' 公里）';
      }
      html = '<span class="loc-ok">✅ 中间点：' + esc(state.ref.label) + where + '</span>' +
        '<span class="hint" style="margin-left:8px">已按「到两人中间点」的距离重排，每张卡片标了路程。</span>';
    } else {
      var st = WG.station ? WG.station(state.loc.station) : null;
      html = '<span class="loc-ok">✅ ' + esc(state.loc.how) +
        (st ? '　·　' + st.lines + ' 号线　·　' + st.d : '') + '</span>' +
        '<span class="hint" style="margin-left:8px">已按距离重排，每张卡片标了路程。</span>';
    }
    box.innerHTML = html;
    if (chip) {
      chip.style.display = '';
      chip.classList.toggle('on', state.nearBy);
      chip.textContent = state.nearBy ? '📍 就近优先：开（点一下关掉）' : '📍 就近优先：关（点一下开启）';
    }
    syncCarry();
  }

  /** 进页面时恢复距离基准：?mid= → ?here= → 记忆（中点优先）。不 render */
  function bootRef() {
    var m = WG.urlMid ? WG.urlMid() : null;
    if (m && setMidState(m.A, m.B)) { WG.saveLocMid(state.midA, state.midB); return; }
    var h = WG.urlHere ? WG.urlHere() : null;
    if (h && setLocState(h)) { WG.saveLoc(state.loc.station); return; }
    var m2 = WG.readLocMid ? WG.readLocMid() : null;
    if (m2 && setMidState(m2.A, m2.B)) return;
    var l2 = WG.readLoc ? WG.readLoc() : null;
    if (l2) setLocState(l2);
  }

  function setMidState(a, b) {
    var mp = WG.midPoint ? WG.midPoint(a, b) : null;
    if (!mp) return false;
    state.midA = mp.A; state.midB = mp.B; state.loc = null; state.midErr = '';
    var A = document.getElementById('locInputA'), B = document.getElementById('locInputB');
    if (A) A.value = mp.A;
    if (B) B.value = mp.B;
    state.nearBy = true;
    return true;
  }

  function setLocState(name) {
    if (!WG.station || !WG.station(name)) return false;
    state.loc = { station: name, how: '定位到地铁站「' + name + '」' };
    state.midA = null; state.midB = null; state.midErr = '';
    var el = document.getElementById('locInput');
    if (el) el.value = name;
    state.nearBy = true;
    return true;
  }

  function applyLoc() {
    var v = document.getElementById('locInput').value;
    var r = WG.locate ? WG.locate(v) : null;
    // 单点与中点互斥
    state.midA = null; state.midB = null; state.midErr = '';
    var A = document.getElementById('locInputA'), B = document.getElementById('locInputB');
    if (A) A.value = '';
    if (B) B.value = '';
    state.loc = r;
    if (r && r.station) { state.nearBy = true; WG.saveLoc(r.station); }
    else { state.nearBy = false; WG.dropLoc(); WG.dropLocMid(); }
    renderLoc();
    var pr = document.getElementById('pickResult'); if (pr) pr.style.display = 'none';
    render();
  }

  /** 中间点：填两个地点，所有剧目改按「到中间点」的距离排 */
  function applyMid() {
    var A = document.getElementById('locInputA'), B = document.getElementById('locInputB');
    if (!A || !B) return;
    var a = (A.value || '').trim(), b = (B.value || '').trim();
    if (!a || !b) {
      state.midA = null; state.midB = null; state.loc = null;
      state.midErr = '中间点要填两个地点：左边填一个人在哪，右边填另一个人在哪。';
      renderLoc(); render();
      return;
    }
    var ra = WG.locate ? WG.locate(a) : null;
    var rb = WG.locate ? WG.locate(b) : null;
    if (!ra || !ra.station) {
      state.midA = null; state.midB = null;
      state.midErr = '中间点左边「' + a + '」没认出来，换个更常见的地名或地铁站名试试。';
      renderLoc(); render(); return;
    }
    if (!rb || !rb.station) {
      state.midA = null; state.midB = null;
      state.midErr = '中间点右边「' + b + '」没认出来，换个更常见的地名或地铁站名试试。';
      renderLoc(); render(); return;
    }
    state.midErr = '';
    state.midA = ra.station; state.midB = rb.station;
    state.loc = null;
    var li = document.getElementById('locInput'); if (li) li.value = '';
    A.value = ra.station; B.value = rb.station;
    WG.saveLocMid(ra.station, rb.station);
    state.nearBy = true;
    renderLoc();
    var pr = document.getElementById('pickResult'); if (pr) pr.style.display = 'none';
    render();
  }

  function clearLoc() {
    ['locInput', 'locInputA', 'locInputB'].forEach(function (id) {
      var e = document.getElementById(id); if (e) e.value = '';
    });
    state.loc = null; state.midA = null; state.midB = null; state.midErr = '';
    state.nearBy = false;
    WG.dropLoc(); WG.dropLocMid();
    renderLoc();
    render();
  }

  /** 跨页携带：把当前基准写进所有站内链接（?here= 单点 / ?mid=A,B 中点） */
  function refQuery() {
    if (state.midA && state.midB) return 'mid=' + encodeURIComponent(state.midA + ',' + state.midB);
    if (state.loc && state.loc.station) return 'here=' + encodeURIComponent(state.loc.station);
    return '';
  }
  function syncCarry() {
    var links = document.querySelectorAll('a.block, .nav a, nav a, .scope-bar a');
    var q = refQuery();
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (!a.getAttribute('data-href')) {
        var h0 = a.getAttribute('href');
        if (!h0) continue;
        a.setAttribute('data-href', h0);
      }
      var base = a.getAttribute('data-href').split('#')[0];
      var parts = base.split('?');
      var keep = (parts[1] || '').split('&').filter(function (kv) {
        return kv && !/^(here|mid)=/.test(kv);
      });
      if (q) keep.push(q);
      a.setAttribute('href', parts[0] + (keep.length ? '?' + keep.join('&') : ''));
    }
  }

  function renderQuick() {
    var box = document.getElementById('quickStations');
    if (!box || !METRO.quick) return;
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
      if (state.ref) {
        var k = distOf(s);
        if (k != null) { if (k < 2) w += 4; else if (k < 5) w += 2; else if (k < 10) w += 1; }
      }
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
    if (box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function bind() {
    // 快捷站点芯片是「填最后聚焦的那一栏」，所以得先记住焦点在哪
    var focus = 'locInput';
    ['locInput', 'locInputA', 'locInputB'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('focus', function () { focus = id; });
    });

    // ⚠️ 只绑筛选芯片，别用 querySelectorAll('.chip')——会把快捷站点芯片
    //    和「就近优先」也绑上，导致 state[null]=null
    document.querySelectorAll('.chip[data-group]').forEach(function (el) {
      el.addEventListener('click', function () {
        var g = el.getAttribute('data-group');
        var v = el.getAttribute('data-val');
        if (!g) return;
        document.querySelectorAll('.chip[data-group="' + g + '"]').forEach(function (o) { o.classList.remove('on'); });
        el.classList.add('on');
        state[g] = v;
        document.getElementById('pickResult').style.display = 'none';
        render();
      });
    });
    document.getElementById('btnDecide').addEventListener('click', pick);

    document.getElementById('btnLoc').addEventListener('click', applyLoc);
    document.getElementById('btnLocClear').addEventListener('click', clearLoc);
    document.getElementById('locInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') applyLoc();
    });

    // 「中间点」那一行
    var btnMid = document.getElementById('btnMid');
    if (btnMid) btnMid.addEventListener('click', applyMid);
    ['locInputA', 'locInputB'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('keydown', function (e) { if (e.key === 'Enter') applyMid(); });
    });

    var chipNear = document.getElementById('chipNear');
    if (chipNear) {
      chipNear.addEventListener('click', function () {
        if (!state.ref) return;
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
        var el = document.getElementById(focus) || document.getElementById('locInput');
        if (!el) return;
        el.value = t.getAttribute('data-quick');
        if (focus === 'locInputA' || focus === 'locInputB') {
          var A = document.getElementById('locInputA'), B = document.getElementById('locInputB');
          if (A && B && (A.value || '').trim() && (B.value || '').trim()) applyMid();
        } else {
          applyLoc();
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('verifiedAt').textContent = META.verifiedAt || '';
    document.getElementById('weekRange').textContent = fmt(WS) + ' ~ ' + fmt(WE);
    renderQuick();
    renderStats();
    renderWeek();
    bind();
    bootRef();          // 恢复「你在哪 / 中间点」：URL 优先，其次本机记忆
    renderLoc();
    render();
  });
})();
