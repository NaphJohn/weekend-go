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
  var state = { cat: 'all', free: 'all', book: 'all', conf: 'all', sort: 'rec' };
  var located = null;          // 站名；null = 没定位
  var distCache = {};

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function idxOf(v) { return DATA.indexOf(v); }

  /* 场馆 → 用于算距离的站名。字段里没写就退回「区」兜底，认不出来返回 null */
  function stationOf(v) {
    if (v.metro && window.WG && window.WG.stations[v.metro]) return v.metro;
    var d = window.WG && window.WG.meta && window.WG.meta.district;
    if (d && v.district && d[v.district]) return d[v.district];
    return null;
  }
  function distOf(v) {
    if (!located) return null;
    if (distCache[v.id] !== undefined) return distCache[v.id];
    var st = stationOf(v);
    var km = st && window.WG ? window.WG.km(located, st) : null;
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
    if (state.sort === 'dist' && located) {
      if (a.free !== b.free) return a.free ? -1 : 1;      // 同距离先推免费的
      var da = distOf(a), db = distOf(b);
      if (da == null && db == null) return idxOf(a) - idxOf(b);
      if (da == null) return 1;
      if (db == null) return -1;
      if (Math.abs(da - db) > 0.3) return da - db;
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
    if (!located || !window.WG) return '';
    var km = distOf(v);
    if (km == null) return '<div class="dist d3">📍 距 <b>' + esc(located) + '</b> 较远（跨区）</div>';
    var g = window.WG.grade(km);
    if (!g) return '';
    return '<div class="dist ' + g.cls + '">📍 距 <b>' + esc(located) + '</b> 约 ' +
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

  /* ===== 定位（复用 index 页那套记忆，跨页带得过去） ===== */
  function renderLoc(result, cls) {
    var box = document.getElementById('locResult');
    if (!box) return;
    box.innerHTML = result ? '<div class="' + (cls || 'loc-ok') + '">' + result + '</div>' : '';
  }

  function applyLoc(name, fromUrl) {
    if (!window.WG) return;
    if (!name) { located = null; renderLoc(''); }
    else {
      var r = window.WG.locate(name);
      if (!r || !r.station) {
        located = null;
        renderLoc((r && r.how) || '认不出这个地点，试试填地铁站名（例如「徐家汇」「张江路」）。', 'loc-bad');
      } else {
        located = r.station;
        renderLoc('已定位到 <b>' + esc(r.station) + '</b> 站　·　' + esc(r.how) +
          (fromUrl ? '' : '　·　下面按「离 ' + esc(r.station) + ' 远近」重排'));
        if (!fromUrl) window.WG.saveLoc(name);
      }
    }
    distCache = {};
    document.querySelectorAll('.chip[data-sort]').forEach(function (o) {
      if (o.getAttribute('data-sort') === 'dist') o.style.display = located ? '' : 'none';
    });
    if (located) {
      state.sort = 'dist';
      document.querySelectorAll('.chip[data-sort]').forEach(function (o) {
        o.classList.toggle('on', o.getAttribute('data-sort') === 'dist');
      });
    } else if (state.sort === 'dist') {
      state.sort = 'rec';
      document.querySelectorAll('.chip[data-sort]').forEach(function (o) {
        o.classList.toggle('on', o.getAttribute('data-sort') === 'rec');
      });
    }
    var chip = document.getElementById('chipNear');
    if (chip) chip.style.display = located ? '' : 'none';
    render();
  }

  function bindLoc() {
    if (!window.WG) return;
    var input = document.getElementById('locInput');
    var btn = document.getElementById('btnLoc');
    var clr = document.getElementById('btnLocClear');
    var quick = document.getElementById('quickStations');
    if (quick && window.WG.meta && window.WG.meta.quick) {
      quick.innerHTML = window.WG.meta.quick.map(function (s) {
        return '<span class="chip sm" data-st="' + esc(s) + '">' + esc(s) + '</span>';
      }).join('') + '<span class="chip sm" data-st="张江路">张江路</span>';
      quick.addEventListener('click', function (ev) {
        var el = ev.target.closest ? ev.target.closest('[data-st]') : null;
        if (!el) return;
        var s = el.getAttribute('data-st');
        if (input) input.value = s;
        applyLoc(s, false);
      });
    }
    if (btn) btn.addEventListener('click', function () {
      var q = input ? input.value : '';
      if (!q) { renderLoc('先填一个地点，比如「徐家汇」或「张江路」。', 'loc-bad'); return; }
      applyLoc(q, false);
    });
    if (input) input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); if (btn) btn.click(); }
    });
    if (clr) clr.addEventListener('click', function () {
      if (input) input.value = '';
      window.WG.dropLoc(); window.WG.dropLocMid();
      located = null; distCache = {};
      renderLoc('');
      var chip = document.getElementById('chipNear'); if (chip) chip.style.display = 'none';
      state.sort = 'rec';
      document.querySelectorAll('.chip[data-sort]').forEach(function (o) {
        o.classList.toggle('on', o.getAttribute('data-sort') === 'rec');
        if (o.getAttribute('data-sort') === 'dist') o.style.display = 'none';
      });
      render();
    });
    var chip = document.getElementById('chipNear');
    if (chip) chip.addEventListener('click', function () {
      if (!located) return;
      if (input && !input.value) input.value = located;
      applyLoc(located, false);
    });

    /* 首次进入：URL 参数优先，其次读记忆 */
    var here = window.WG.urlHere();
    var saved = window.WG.readLoc();
    if (here) { if (input) input.value = here; applyLoc(here, true); }
    else if (saved) { if (input) input.value = saved; applyLoc(saved, true); }
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
