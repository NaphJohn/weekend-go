/**
 * 「周末运动」页渲染层（sports.html）。
 * 依赖 data/sports.js（window.SPORTS / window.SPORTS_META）、data/metro.js、assets/locate.js。
 *
 * ⚠️ 和 assets/venues.js 的关系：定位 / 中间点 / syncCarry / applyLoc / applyMid / clearLoc
 *    这一整套是原样搬过来的（DOM id 也一致），只改了「卡片里放什么」：
 *      venues 放 free / fee / hours / closed / book
 *      sports 放 slots（早 / 午 / 晚三段单价）+ howTo（怎么过去）+ 预约按钮
 *    改定位那部分时**两边一起改**，别让两页的「你在哪」手感分叉。
 */
(function () {
  'use strict';

  var DATA = window.SPORTS || [];
  var META = window.SPORTS_META || {};

  var SPORT_TEXT = { badminton: '羽毛球', hike: '登山' };
  var SPORT_ICON = { badminton: '🏸', hike: '⛰️' };

  var state = {
    sport: 'all', free: 'all', conf: 'all', sort: 'rec',
    slot: 'all',        // 只影响「高亮哪一段」+ 卡片里加一行摘要，不做筛选（每条都有三段）
    loc: null, midA: null, midB: null,   // 单点 / 中间点（互斥）
    ref: null                            // 唯一距离基准（中点优先，否则单点）
  };
  var distCache = {};

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function idxOf(v) { return DATA.indexOf(v); }

  /**
   * 时段归属：数据里 slots 的 k 字段统一以这三个图标开头（🌅 早上 / ☀️ 下午 / 🌙+🌚 晚上）。
   * ⚠️ 新增时段务必沿用这三个图标，否则该段不会被「我想这时候去」高亮命中。
   */
  function bandOf(slot) {
    var k = slot && slot.k || '';
    if (k.indexOf('🌅') >= 0) return 'am';
    if (k.indexOf('☀️') >= 0) return 'pm';
    return 'night';
  }
  /** 这一条在这个时段有没有可用的价（「未公示」算没有） */
  function slotOf(v, band) {
    var list = v.slots || [];
    for (var i = 0; i < list.length; i++) if (bandOf(list[i]) === band) return list[i];
    return null;
  }
  function pricedSlot(v, band) {
    var s = slotOf(v, band);
    if (!s) return null;
    return /未公示/.test(s.p || '') ? null : s;
  }

  /* ===== 距离基准（与 venues.js / eats.js 完全一致，只读 state.ref） ===== */
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
  function refName() {
    if (!state.ref) return '';
    return state.ref.kind === 'mid' ? '「' + state.ref.label + '」中间点' : '「' + state.ref.label + '」';
  }
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
    if (state.sport !== 'all' && v.sport !== state.sport) return false;
    if (state.free !== 'all') {
      if (state.free === 'free' && !v.free) return false;
      if (state.free === 'paid' && v.free) return false;
    }
    if (state.conf === 'high' && v.conf !== 'high') return false;
    return true;
  }

  function sortFn(a, b) {
    if (state.sort === 'dist' && state.ref) {
      /* ⚠️ 「离我最近」是**纯距离**排序：差不到 0.3 km 时才让免费的插前面。
         和 venues.js 2026-09-23 的修正保持同一口径 —— 不要让 40 km 外的免费山
         排到 1 km 内的球馆前面。 */
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

  /* ===== 徽章 ===== */
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
  function sportBadge(v) {
    return '<span class="pill-type">' + (SPORT_ICON[v.sport] || '') + ' ' +
      (SPORT_TEXT[v.sport] || '') + '</span>';
  }

  function row(k, val) {
    if (!val || val === '—') return '';
    return '<div class="fact"><span class="fact-k">' + k + '</span><span class="fact-v">' + esc(val) + '</span></div>';
  }

  /* ===== 分时段价表格（本页的核心） ===== */
  function slotsHTML(v) {
    var list = v.slots || [];
    if (!list.length) return '';
    var body = list.map(function (s) {
      var on = state.slot !== 'all' && bandOf(s) === state.slot;
      var pending = /未公示/.test(s.p || '');
      return '<div class="slot' + (on ? ' on' : '') + (pending ? ' pending' : '') + '">' +
        '<span class="slot-k">' + esc(s.k) + '</span>' +
        '<span class="slot-t">' + esc(s.t) + '</span>' +
        '<span class="slot-p">' + esc(s.p) + '</span>' +
        (s.n ? '<span class="slot-n">' + esc(s.n) + '</span>' : '') +
        '</div>';
    }).join('');
    return '<div class="slots">' +
      '<div class="slots-h">🕐 分时段价 <span>（一片场地 · 一小时）</span></div>' +
      body + '</div>';
  }

  /** 选了时段时，在卡片顶部加一行「你打算这时候去」的摘要 */
  function wantLine(v) {
    if (state.slot === 'all') return '';
    var s = slotOf(v, state.slot);
    if (!s) return '';
    var label = { am: '早上', pm: '下午', night: '晚上' }[state.slot];
    return '<div class="want">你想' + label + '去 → <b>' + esc(s.p) + '</b>' +
      (s.n ? '　·　' + esc(s.n) : '') + '</div>';
  }

  /* ===== 怎么过去 ===== */
  function howHTML(v) {
    if (!v.howTo) return '';
    return '<div class="sport-go"><b>🧭 怎么过去</b><br>' + esc(v.howTo) + '</div>';
  }

  /* ===== 预约按钮 =====
     有官方 / 电话入口就是按钮；没有就降级成一句「无公开线上入口」的提示，绝不放第三方聚合页。 */
  function bookHTML(v) {
    var href = v.bookHref || '';
    var btn = href
      ? '<a class="btn-book" href="' + esc(href) + '">' + esc(v.bookLabel || '去预约') + '</a>'
      : '<span class="btn-book disabled">无公开线上入口 · 需电话确认</span>';
    return '<div class="book-row">' + btn +
      '<span class="book-note">' + esc(v.book) + '</span></div>';
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
    return '<div class="card card-sport" data-id="' + esc(v.id) + '">' +
      '<div class="top"><h3>' + esc(v.name) + '</h3>' + freeBadge(v) + '</div>' +
      '<div class="meta-line">' + sportBadge(v) + ' ' + confBadge(v) + '</div>' +
      wantLine(v) +
      '<div class="meta-line">📍 ' + esc(v.addr) + '</div>' +
      (v.metroNote ? '<div class="meta-line">🚇 ' + esc(v.metroNote) + '</div>' : '') +
      slotsHTML(v) +
      '<div class="facts">' +
        row('门票', v.fee) +
        row('开放', v.hours === '—' ? '以场馆公告为准' : v.hours) +
        row('休息', v.closed) +
      '</div>' +
      bookHTML(v) +
      distHTML(v) +
      howHTML(v) +
      (v.tip ? '<div class="detail"><div class="tip">' + esc(v.tip) + '</div></div>' : '') +
      '</div>';
  }

  function render() {
    var list = DATA.filter(match).sort(sortFn);
    var grid = document.getElementById('grid');
    if (!grid) return;
    grid.innerHTML = list.length
      ? list.map(cardHTML).join('')
      : '<div class="empty">没有符合条件的场地，把筛选放宽一点试试。</div>';
    var c = document.getElementById('count');
    if (c) c.textContent = list.length;
    if (window.Annotate) window.Annotate.apply();
  }

  /* ===== 统计 / 计数 ===== */
  function hasPriced(v) {
    return (v.slots || []).some(function (s) { return !/未公示/.test(s.p || ''); });
  }
  function renderStats() {
    function set(id, val) { var e = document.getElementById(id); if (e) e.textContent = val; }
    set('s-total', DATA.length);
    set('s-free', DATA.filter(function (v) { return v.free; }).length);
    set('s-price', DATA.filter(hasPriced).length);
    set('s-book', DATA.filter(function (v) { return !!v.bookHref; }).length);
  }
  function renderCounts() {
    var groups = {
      sport: { all: DATA.slice(), badminton: [], hike: [] },
      free: { all: DATA.slice(), free: [], paid: [] },
      conf: { all: DATA.slice(), high: [] }
    };
    DATA.forEach(function (v) {
      if (groups.sport[v.sport]) groups.sport[v.sport].push(v);
      (v.free ? groups.free.free : groups.free.paid).push(v);
      if (v.conf === 'high') groups.conf.high.push(v);
    });
    document.querySelectorAll('[data-cnt]').forEach(function (el) {
      var p = el.getAttribute('data-cnt').split(':');
      var gr = groups[p[0]];
      if (!gr) return;
      el.textContent = (gr[p[1]] || []).length;
    });
  }

  /* ===== 帮我选一个 ===== */
  function pick() {
    var pool = DATA.filter(match);
    if (!pool.length) { alert('当前筛选下没有可推荐的场地，放宽条件试试。'); return; }
    var weighted = [];
    pool.forEach(function (v) {
      var w = 2;
      if (v.free) w += 2;                                     // 免费的先推
      if (hasPriced(v)) w += 2;                               // 分时价写得清楚，敢推
      if (v.conf === 'high') w += 1;                          // 信息确定
      if (state.slot !== 'all' && pricedSlot(v, state.slot)) w += 2; // 你要的时段它有场
      for (var i = 0; i < w; i++) weighted.push(v);
    });
    var v = weighted[Math.floor(Math.random() * weighted.length)];
    var why = [];
    var ws = state.slot !== 'all' ? pricedSlot(v, state.slot) : null;
    if (ws) why.push('你想' + ({ am: '早上', pm: '下午', night: '晚上' })[state.slot] + '去，这一段 ' + ws.p);
    why.push(v.free ? '免费，说走就走' : '要花钱（' + v.fee + '）');
    if (state.ref && distOf(v) != null) why.push('距' + refName() + '约 ' + distOf(v).toFixed(1) + ' km');
    why.push('预约：' + v.book);
    var box = document.getElementById('pickResult');
    if (!box) return;
    box.style.display = 'block';
    box.innerHTML = '<div class="pick-card">' +
      '<div class="pk-name">' + (SPORT_ICON[v.sport] || '') + ' ' + esc(v.name) + '　' + freeBadge(v) + '</div>' +
      '<div class="pk-line">' + (SPORT_TEXT[v.sport] || '') + '　·　' + esc(v.addr) + '</div>' +
      '<div class="pk-line">🚇 ' + esc(v.metroNote || '—') + '</div>' +
      '<div class="pk-line">🕐 ' + esc(v.slots && v.slots.length ? v.slots.map(function (s) {
        return s.k + ' ' + s.p;
      }).join('　·　') : '分时价未公示') + '</div>' +
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
    /* ⚠️ note 里带 <b>，用 innerHTML —— 与 venues.js 一致（内容是本地写死的，不是用户输入） */
    var n = document.getElementById('metaNote');
    if (n && META.note) n.innerHTML = '⚠️ ' + META.note;
    var t = document.getElementById('metaTotal');
    if (t) t.textContent = DATA.length;
    cards('howTo', META.howTo);
    warnCards('notFree', META.notFree);
    cards('freeHow', META.freeHow);
    list('care', META.care);
  }

  /* ===== 定位（复用 index / venues 那套，DOM id 一致） ===== */
  function renderLoc(result, cls) {
    var box = document.getElementById('locResult');
    if (!box) return;
    box.innerHTML = result ? '<div class="' + (cls || 'loc-ok') + '">' + result + '</div>' : '';
  }
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
      renderLoc('先填一个地点，比如「张江」「广兰路」或「佘山」。', 'loc-bad');
    } else {
      var r = window.WG.locate(q);
      if (!r || !r.station) {
        state.loc = null; refreshRef();
        renderLoc((r && r.how) || '认不出这个地点，试试填地铁站名（例如「张江高科」「佘山」）。', 'loc-bad');
      } else {
        state.loc = r.station; refreshRef();
        var inp = document.getElementById('locInput');
        if (inp) inp.value = q;
        renderLoc('已定位到 <b>' + esc(r.station) + '</b> 站　·　' + esc(r.how) +
          (fromUrl ? '' : '　·　下面按「离 ' + esc(r.station) + ' 远近」重排'));
        if (!fromUrl) window.WG.saveLoc(q);
      }
    }
    if (state.ref) { state.sort = 'dist'; }
    else if (state.sort === 'dist') { state.sort = 'rec'; }
    setSortChip(state.sort);
    quickChipPush();
    render();
    if (state.ref) syncCarry();
  }
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
        A.value = ra.station; B.value = rb.station;
        var li = document.getElementById('locInput'); if (li) li.value = '';
        var r = refreshRef();
        var extra = r && r.near ? '　·　中间点离 <b>' + esc(r.near.name) + '</b> 站约 ' +
          r.near.km.toFixed(1) + ' km' : '';
        renderLoc('中间点：<b>' + esc(ra.station) + ' ↔ ' + esc(rb.station) + '</b>' + extra +
          (fromUrl ? '' : '　·　下面按「离中间点远近」重排'));
        if (!fromUrl) window.WG.saveLocMid(ra.station, rb.station);
      }
    }
    if (state.ref) { state.sort = 'dist'; }
    else if (state.sort === 'dist') { state.sort = 'rec'; }
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
  /** 跨页携带：?here= 单点 / ?mid=A,B 中点。⚠️ 用 data-href 留档才幂等 */
  function syncCarry() {
    var q = '';
    if (state.midA && state.midB) q = 'mid=' + encodeURIComponent(state.midA + ',' + state.midB);
    else if (state.loc) q = 'here=' + encodeURIComponent(state.loc);
    document.querySelectorAll('.nav a, .subtabs a, footer a').forEach(function (a) {
      if (!a.getAttribute('data-href')) {
        var h0 = a.getAttribute('href');
        if (!h0 || /^(https?:|mailto:|tel:|#)/.test(h0)) return;
        a.setAttribute('data-href', h0);
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

    if (quick && window.WG.meta && window.WG.meta.quick) {
      var qs = window.WG.meta.quick.slice();
      /* 运动页把「张江高科」「佘山」顶到最前面 —— 这两站覆盖了本页一半以上的条目 */
      ['佘山', '张江高科'].forEach(function (s) {
        var i = qs.indexOf(s);
        if (i >= 0) qs.splice(i, 1);
        qs.unshift(s);
      });
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

    /* 首进顺序：?mid= → ?here= → 本地记忆 */
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
    /* 时段芯片：只做高亮 + 摘要，不过滤（每条都有三段，过滤反而看不出差别） */
    document.querySelectorAll('.chip[data-slot]').forEach(function (el) {
      el.addEventListener('click', function () {
        document.querySelectorAll('.chip[data-slot]').forEach(function (o) { o.classList.remove('on'); });
        el.classList.add('on');
        state.slot = el.getAttribute('data-slot');
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
