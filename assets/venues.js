/**
 * 「常年可去」场馆页渲染层（venues.html）。
 * 依赖 data/venues.js（window.VENUES / window.VENUES_META）、data/metro.js、assets/locate.js。
 *
 * ⚠️ 和 assets/games.js 的关系：两边结构刻意保持同一套（芯片筛选 + 推荐排序 + 帮我选一个 +
 *    黄色护栏块），改动时顺手对齐，别让两页的手感分叉。
 */
(function () {
  'use strict';

  var DATA = window.VENUES || [];
  var META = window.VENUES_META || {};

  var CAT_TEXT = {
    museum: '博物馆 / 美术馆', library: '图书馆 / 书院', park: '公园',
    temple: '寺庙 / 教堂', town: '古镇 / 老街', hill: '登山 / 郊野', street: '文艺街区'
  };
  var state = { cat: 'all', free: 'all', book: 'all', conf: 'all', sort: 'rec',
                loc: null, midA: null, midB: null,   // 单点 / 中间点（互斥）
                ref: null };                          // 唯一距离基准（中点优先，否则单点）
  var distCache = {};

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function idxOf(v) { return DATA.indexOf(v); }

  /**
   * 距离基准 state.ref —— 中间点优先，否则单点定位。语义与 assets/eats.js 的 refreshRef() 完全一致。
   *
   * ⚠️ 所有跟距离有关的地方（distOf / sortFn / 卡片文案 / 帮我选一个）都必须只读 state.ref，
   *    不能各自去读 state.loc，否则会出现「有的卡按中点算、有的按单点算」。
   */
  function refreshRef() {
    var r = null;
    if (state.midA && state.midB && window.WG && window.WG.midPoint) {
      var mp = window.WG.midPoint(state.midA, state.midB);
      if (mp) r = { kind: 'mid', pt: mp.M, label: mp.A + ' ↔ ' + mp.B, near: mp.near };
    }
    if (!r && state.loc && window.WG && window.WG.station) {
      var p = window.WG.station(state.loc);
      if (p) r = { kind: 'loc', pt: p, label: state.loc, near: { name: state.loc, km: 0 } };
    }
    state.ref = r;
    distCache = {};
    return r;
  }
  /** 距离基准的说明名：单点 →「张江路」；中点 →「漕河泾 ↔ 张江路」中间点 */
  function refName() {
    if (!state.ref) return '';
    return state.ref.kind === 'mid' ? '「' + state.ref.label + '」中间点' : '「' + state.ref.label + '」';
  }

  /* 场馆 → 用于算距离的站名。字段里没写就退回「区」兜底，认不出来返回 null */
  function stationOf(v) {
    if (v.metro && window.WG && window.WG.stations[v.metro]) return v.metro;
    var d = window.WG && window.WG.meta && window.WG.meta.district;
    if (d && v.district && d[v.district]) return d[v.district];
    return null;
  }
  function distOf(v) {
    if (!state.ref) return null;
    if (distCache[v.id] !== undefined) return distCache[v.id];
    var st = stationOf(v);
    var km = st && window.WG && window.WG.ptKm ? window.WG.ptKm(state.ref.pt, st) : null;
    distCache[v.id] = km;
    return km;
  }

  function match(v) {
    if (state.cat !== 'all' && v.cat !== state.cat) return false;
    if (state.free !== 'all') {
      if (state.free === 'free' && !v.free) return false;
      if (state.free === 'paid' && v.free) return false;
    }
    if (state.book === 'nobook' && /需预约|需提前|需购票/.test(v.book || '')) return false;
    if (state.conf === 'high' && v.conf !== 'high') return false;
    return true;
  }

  function sortFn(a, b) {
    if (state.sort === 'dist' && state.ref) {
      /* ⚠️ 「📏 离我最近」必须是**纯距离**排序：免费优先是另一颗芯片（free-first）的事。
         这里只保留注释里写的那点偏好 —— **差不到 0.3 km 时**才让免费的插到前面。
         （2026-09-23 修：旧写法 `if (a.free !== b.free) return ...` 是无条件免费优先，
          会把 40 km 外的免费馆排到 1 km 内的收费馆前面，和「离我最近」这块牌子自相矛盾。） */
      var da = distOf(a), db = distOf(b);
      if (da == null && db == null) return idxOf(a) - idxOf(b);
      if (da == null) return 1;
      if (db == null) return -1;
      if (Math.abs(da - db) > 0.3) return da - db;
      if (a.free !== b.free) return a.free ? -1 : 1;
      return idxOf(a) - idxOf(b);
    }
    if (state.sort === 'free-first' && a.free !== b.free) return a.free ? -1 : 1;
    return idxOf(a) - idxOf(b);
  }

  function freeBadge(v) {
    return v.free
      ? '<span class="badge b-d1">🆓 免费</span>'
      : '<span class="badge b-d3">🎫 收费</span>';
  }

  function confBadge(v) {
    return v.conf === 'mid'
      ? '<span class="badge b-d3">🟡 口径待核</span>'
      : '<span class="badge b-d2">✅ 已核实</span>';
  }

  function row(k, val) {
    if (!val || val === '—') return '';
    return '<div class="fact"><span class="fact-k">' + k + '</span><span class="fact-v">' + esc(val) + '</span></div>';
  }

  function distHTML(v) {
    if (!state.ref || !window.WG) return '';
    var km = distOf(v);
    if (km == null) return '<div class="dist d3">📍 距' + esc(refName()) + '较远（跨区）</div>';
    var g = window.WG.grade(km);
    if (!g) return '';
    return '<div class="dist ' + g.cls + '">📍 距' + esc(refName()) + '约 ' +
      km.toFixed(1) + ' km <span>· ' + g.txt + ' · ' + g.sub + '</span></div>';
  }

  function cardHTML(v) {
    return '<div class="card card-venue" data-id="' + esc(v.id) + '">' +
      '<div class="top"><h3>' + esc(v.name) + '</h3>' + freeBadge(v) + '</div>' +
      '<div class="meta-line">' + '<span class="pill-type">' + (CAT_TEXT[v.cat] || '') + '</span> ' +
        confBadge(v) + '</div>' +
      '<div class="meta-line">📍 ' + esc(v.addr) + '</div>' +
      (v.metroNote ? '<div class="meta-line">🚇 ' + esc(v.metroNote) + '</div>' : '') +
      '<div class="facts">' +
        row('门票', v.fee) +
        row('开放', v.hours === '—' ? '以馆方公告为准' : v.hours) +
        row('闭馆', v.closed) +
        row('入馆', v.book) +
      '</div>' +
      distHTML(v) +
      (v.tip ? '<div class="detail"><div class="tip">' + esc(v.tip) + '</div></div>' : '') +
      '</div>';
  }

  function render() {
    var list = DATA.filter(match).sort(sortFn);
    var grid = document.getElementById('grid');
    if (!grid) return;
    grid.innerHTML = list.length
      ? list.map(cardHTML).join('')
      : '<div class="empty">没有符合条件的场馆，把筛选放宽一点试试。</div>';
    var c = document.getElementById('count');
    if (c) c.textContent = list.length;
    if (window.Annotate) window.Annotate.apply();
  }

  function renderStats() {
    function set(id, val) { var e = document.getElementById(id); if (e) e.textContent = val; }
    set('s-total', DATA.length);
    set('s-free', DATA.filter(function (v) { return v.free; }).length);
    set('s-nobook', DATA.filter(function (v) { return !/需预约|需提前|需购票/.test(v.book || ''); }).length);
    set('s-open', DATA.filter(function (v) { return /^无/.test(v.closed || ''); }).length);
  }

  /** 芯片计数：忽略本组筛选后的剩余集合，和别页手感一致 */
  function renderCounts() {
    var groups = {
      cat: { all: DATA.slice(), museum: [], library: [], park: [], temple: [], town: [], hill: [], street: [] },
      free: { all: DATA.slice(), free: [], paid: [] },
      book: { all: DATA.slice(), nobook: [] },
      conf: { all: DATA.slice(), high: [] }
    };
    DATA.forEach(function (v) {
      if (groups.cat[v.cat]) groups.cat[v.cat].push(v);
      (v.free ? groups.free.free : groups.free.paid).push(v);
      if (!/需预约|需提前|需购票/.test(v.book || '')) groups.book.nobook.push(v);
      if (v.conf === 'high') groups.conf.high.push(v);
    });
    document.querySelectorAll('[data-cnt]').forEach(function (el) {
      var p = el.getAttribute('data-cnt').split(':');
      var gr = groups[p[0]];
      if (!gr) return;
      el.textContent = (gr[p[1]] || []).length;
    });
  }

  function pick() {
    var pool = DATA.filter(match);
    if (!pool.length) { alert('当前筛选下没有可推荐的场馆，放宽条件试试。'); return; }
    var weighted = [];
    pool.forEach(function (v) {
      var w = 2;
      if (v.free) w += 2;                                   // 免费的先推
      if (!/需预约|需提前|需购票/.test(v.book || '')) w += 1; // 不用预约，说走就走
      if (v.conf === 'high') w += 1;                         // 信息越确定越敢推
      for (var i = 0; i < w; i++) weighted.push(v);
    });
    var v = weighted[Math.floor(Math.random() * weighted.length)];
    var why = [];
    why.push(v.free ? '免费，说走就走' : '要买票（' + v.fee + '），但值得');
    if (!/需预约|需提前|需购票/.test(v.book || '')) why.push('不用预约，' + v.book);
    else why.push('⚠️ ' + v.book);
    if (/^无/.test(v.closed || '')) why.push('全年开放，没有闭馆日');
    else why.push('⚠️ ' + v.closed);
    var box = document.getElementById('pickResult');
    if (!box) return;
    box.style.display = 'block';
    box.innerHTML = '<div class="pick-card">' +
      '<div class="pk-name">' + esc(v.name) + '　' + freeBadge(v) + '</div>' +
      '<div class="pk-line">' + (CAT_TEXT[v.cat] || '') + '　·　' + esc(v.addr) + '</div>' +
      '<div class="pk-line">🚇 ' + esc(v.metroNote || '—') + '</div>' +
      (state.ref && distOf(v) != null
        ? '<div class="pk-line">📍 距' + esc(refName()) + '约 ' + distOf(v).toFixed(1) + ' km</div>' : '') +
      '<div class="pk-line">🕐 ' + esc(v.hours === '—' ? '以馆方公告为准' : v.hours) + '　·　🛑 ' + esc(v.closed) + '</div>' +
      '<div class="pk-why"><b>为什么是它：</b>' + esc(why.join('；')) + '。</div>' +
      '</div>';
    if (box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ===== 页头 / 护栏文案 ===== */
  function renderMetaBlocks() {
    function cards(id, rows) {
      var box = document.getElementById(id);
      if (!box || !rows) return;
      box.innerHTML = rows.map(function (r) {
        return '<div class="scene-card"><b>' + esc(r.k) + '</b>　<span style="color:var(--blue);font-weight:700">' +
          esc(r.v) + '</span><br><span style="color:var(--sub)">' + esc(r.d) + '</span></div>';
      }).join('');
    }
    function warnCards(id, rows) {
      var box = document.getElementById(id);
      if (!box || !rows) return;
      box.innerHTML = rows.map(function (r) {
        return '<div class="scene-card" style="background:#fdf6e9;border-color:#f3e2c4">' +
          '<b style="color:#a3670a">' + esc(r.k) + '</b>　<span style="color:#c0443f;font-weight:700">' +
          esc(r.v) + '</span><br><span style="color:#7a5310">' + esc(r.d) + '</span></div>';
      }).join('');
    }
    function list(id, rows) {
      var box = document.getElementById(id);
      if (!box || !rows) return;
      box.innerHTML = rows.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
    }
    var v = document.getElementById('verifiedAt');
    if (v) v.textContent = META.verifiedAt || '';
    var n = document.getElementById('metaNote');
    if (n && META.note) n.innerHTML = '⚠️ ' + META.note;
    var t = document.getElementById('metaTotal');
    if (t) t.textContent = DATA.length;
    cards('howTo', META.howTo);
    warnCards('notFree', META.notFree);
    cards('freeHow', META.freeHow);
    list('care', META.care);
  }

  /* ===== 定位（复用 index 页那套记忆，跨页带得过去）
     单点「你在哪」+ 中间点「两个人约在中间」。两者互斥，距离基准一律走 state.ref。 ===== */
  function renderLoc(result, cls) {
    var box = document.getElementById('locResult');
    if (!box) return;
    box.innerHTML = result ? '<div class="' + (cls || 'loc-ok') + '">' + result + '</div>' : '';
  }
  /** 排序芯片：dist 只在有基准时出现，并保证「当前排序」只有一个高亮 */
  function setSortChip(s) {
    document.querySelectorAll('.chip[data-sort]').forEach(function (o) {
      if (o.getAttribute('data-sort') === 'dist') o.style.display = state.ref ? '' : 'none';
      o.classList.toggle('on', o.getAttribute('data-sort') === s);
    });
  }
  function quickChipPush() {
    var chip = document.getElementById('chipNear');
    if (chip) chip.style.display = state.ref ? '' : 'none';
  }
  /** 单点定位：中间点会被清掉（互斥） */
  function applyLoc(raw, fromUrl) {
    if (!window.WG) return;
    var a = document.getElementById('locInputA'), b = document.getElementById('locInputB');
    if (a) a.value = '';
    if (b) b.value = '';
    state.midA = null; state.midB = null;
    var q = (raw == null ? (document.getElementById('locInput') || {}).value : raw) || '';
    q = String(q).trim();
    if (!q) {
      state.loc = null; refreshRef();
      renderLoc('先填一个地点，比如「徐家汇」或「张江路」。', 'loc-bad');
    } else {
      var r = window.WG.locate(q);
      if (!r || !r.station) {
        state.loc = null; refreshRef();
        renderLoc((r && r.how) || '认不出这个地点，试试填地铁站名（例如「徐家汇」「张江路」）。', 'loc-bad');
      } else {
        state.loc = r.station; refreshRef();
        var inp = document.getElementById('locInput');
        if (inp) inp.value = q;
        renderLoc('已定位到 <b>' + esc(r.station) + '</b> 站　·　' + esc(r.how) +
          (fromUrl ? '' : '　·　下面按「离 ' + esc(r.station) + ' 远近」重排'));
        if (!fromUrl) window.WG.saveLoc(q);
      }
    }
    if (state.ref) state.sort = 'dist';
    else if (state.sort === 'dist') state.sort = 'rec';
    setSortChip(state.sort);
    quickChipPush();
    render();
    if (state.ref) syncCarry();
  }
  /** 中间点：填两个地点，全部卡片改按「到两人中间点」的距离排 */
  function applyMid(fromUrl) {
    if (!window.WG || !window.WG.midPoint) return;
    var A = document.getElementById('locInputA'), B = document.getElementById('locInputB');
    if (!A || !B) return;
    var a = (A.value || '').trim(), b = (B.value || '').trim();
    if (!a || !b) {
      state.midA = null; state.midB = null; state.loc = null; refreshRef();
      renderLoc('中间点要填两个地点：左边一个人在哪，右边另一个人在哪。两边都填上再点「算中间点」。', 'loc-bad');
    } else {
      var ra = window.WG.locate(a), rb = window.WG.locate(b);
      if (!ra || !ra.station || !rb || !rb.station) {
        state.midA = null; state.midB = null; state.loc = null; refreshRef();
        var bad = (!ra || !ra.station) ? a : b;
        renderLoc('中间点这一侧「' + esc(bad) + '」没认出来，换个更常见的地名或地铁站名试试。', 'loc-bad');
      } else {
        state.midA = ra.station; state.midB = rb.station; state.loc = null;
        A.value = ra.station; B.value = rb.station;   // 回填规范站名，方便确认认对了
        var li = document.getElementById('locInput'); if (li) li.value = '';
        var r = refreshRef();
        var extra = r && r.near ? '　·　中间点离 <b>' + esc(r.near.name) + '</b> 站约 ' +
          r.near.km.toFixed(1) + ' km' : '';
        renderLoc('中间点：<b>' + esc(ra.station) + ' ↔ ' + esc(rb.station) + '</b>' + extra +
          (fromUrl ? '' : '　·　下面按「离中间点远近」重排'));
        if (!fromUrl) window.WG.saveLocMid(ra.station, rb.station);
      }
    }
    if (state.ref) state.sort = 'dist';
    else if (state.sort === 'dist') state.sort = 'rec';
    setSortChip(state.sort);
    quickChipPush();
    render();
    if (state.ref) syncCarry();
  }
  function clearLoc() {
    ['locInput', 'locInputA', 'locInputB'].forEach(function (id) {
      var e = document.getElementById(id); if (e) e.value = '';
    });
    state.loc = null; state.midA = null; state.midB = null;
    refreshRef();
    renderLoc('');
    state.sort = 'rec';
    setSortChip('rec');
    var chip = document.getElementById('chipNear'); if (chip) chip.style.display = 'none';
    window.WG && window.WG.dropLoc && window.WG.dropLoc();
    window.WG && window.WG.dropLocMid && window.WG.dropLocMid();
    syncCarry();
    render();
  }
  /** 跨页携带：把当前基准写进所有站内链接（?here= 单点 / ?mid=A,B 中点） */
  function syncCarry() {
    var q = '';
    if (state.midA && state.midB) q = 'mid=' + encodeURIComponent(state.midA + ',' + state.midB);
    else if (state.loc) q = 'here=' + encodeURIComponent(state.loc);
    document.querySelectorAll('.nav a, .subtabs a, footer a').forEach(function (a) {
      if (!a.getAttribute('data-href')) {
        var h0 = a.getAttribute('href');
        if (!h0 || /^(https?:|mailto:|#)/.test(h0)) return;
        a.setAttribute('data-href', h0);          // 原链接留档，反复调用才是幂等的
      }
      var base = a.getAttribute('data-href').split('#')[0];
      var parts = base.split('?');
      var keep = (parts[1] || '').split('&').filter(function (kv) {
        return kv && !/^(here|mid)=/.test(kv);
      });
      if (q) keep.push(q);
      a.setAttribute('href', parts[0] + (keep.length ? '?' + keep.join('&') : ''));
    });
  }
  function bindLoc() {
    if (!window.WG) return;
    var input = document.getElementById('locInput');
    var btn = document.getElementById('btnLoc');
    var clr = document.getElementById('btnLocClear');
    var btnMid = document.getElementById('btnMid');
    var quick = document.getElementById('quickStations');
    var A = document.getElementById('locInputA'), B = document.getElementById('locInputB');

    /* 快捷站填「最后聚焦的那一栏」：焦点在中点 A/B 上就填那一栏，两栏都填好就重算 */
    if (quick && window.WG.meta && window.WG.meta.quick) {
      var qs = window.WG.meta.quick.slice();
      if (qs.indexOf('张江路') < 0) qs.push('张江路');
      quick.innerHTML = qs.map(function (s) {
        return '<span class="chip sm" data-st="' + esc(s) + '">' + esc(s) + '</span>';
      }).join('');
      quick.addEventListener('click', function (ev) {
        var el = ev.target.closest ? ev.target.closest('[data-st]') : null;
        if (!el) return;
        var s = el.getAttribute('data-st');
        var focus = document.activeElement;
        if (focus === A) { A.value = s; if ((B.value || '').trim()) applyMid(false); return; }
        if (focus === B) { B.value = s; if ((A.value || '').trim()) applyMid(false); return; }
        if (input) input.value = s;
        applyLoc(s, false);
      });
    }
    if (btn) btn.addEventListener('click', function () { applyLoc(null, false); });
    if (btnMid) btnMid.addEventListener('click', function () { applyMid(false); });
    if (input) input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); if (btn) btn.click(); }
    });
    [A, B].forEach(function (el) {
      if (el) el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); applyMid(false); }
      });
    });
    if (clr) clr.addEventListener('click', clearLoc);
    var chip = document.getElementById('chipNear');
    if (chip) chip.addEventListener('click', function () {
      if (!state.ref) return;
      if (state.midA && state.midB) applyMid(false);
      else applyLoc(state.loc, false);
    });

    /* 首次进入：?mid= → ?here= → 本地记忆（与首页 / 美食页一致） */
    var mid = window.WG.urlMid(), here = window.WG.urlHere();
    if (mid && A && B) { A.value = mid.A; B.value = mid.B; applyMid(true); }
    else if (here) { if (input) input.value = here; applyLoc(here, true); }
    else {
      var savedMid = window.WG.readLocMid && window.WG.readLocMid();
      var saved = window.WG.readLoc && window.WG.readLoc();
      if (savedMid && A && B) { A.value = savedMid.A; B.value = savedMid.B; applyMid(true); }
      else if (saved) { if (input) input.value = saved; applyLoc(saved, true); }
    }
    syncCarry();
  }

  function bindFilters() {
    document.querySelectorAll('.chip[data-group]').forEach(function (el) {
      el.addEventListener('click', function () {
        var g = el.getAttribute('data-group'), val = el.getAttribute('data-val');
        if (!g) return;
        document.querySelectorAll('.chip[data-group="' + g + '"]').forEach(function (o) { o.classList.remove('on'); });
        el.classList.add('on');
        state[g] = val;
        var pr = document.getElementById('pickResult'); if (pr) pr.style.display = 'none';
        render();
      });
    });
    document.querySelectorAll('.chip[data-sort]').forEach(function (el) {
      el.addEventListener('click', function () {
        var s = el.getAttribute('data-sort');
        if (!s) return;
        document.querySelectorAll('.chip[data-sort]').forEach(function (o) { o.classList.remove('on'); });
        el.classList.add('on');
        state.sort = s;
        render();
      });
    });
    var d = document.querySelector('.chip[data-sort="dist"]');
    if (d) d.style.display = 'none';
    var btn = document.getElementById('btnDecide');
    if (btn) btn.addEventListener('click', pick);
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderMetaBlocks();
    renderStats();
    renderCounts();
    bindFilters();
    bindLoc();
    render();
  });
})();
