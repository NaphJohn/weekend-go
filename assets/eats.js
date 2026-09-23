/**
 * 「美食 · 按菜系挑」页渲染层（food.html）。
 * 依赖 data/eats.js（window.EATS / EATS_META）、data/metro.js、assets/locate.js。
 *
 * ⚠️ 和 assets/venues.js、assets/games.js 是同一套骨架（芯片筛选 + 定位距离 + 帮我选一个 +
 *    知识块），三边改动时顺手对齐，别让手感分叉。
 *
 * 这一页和别页最大的不同：卡片上带的是**第三方公开评分**（大众点评必吃榜页当天的分），
 * 不是本站打的标签。所以文案里一律写「平台评分」而不是「评分」，并标死查看日期。
 */
(function () {
  'use strict';

  var DATA = window.EATS || [];
  var META = window.EATS_META || {};

  var CN = {
    benbang: '本帮·上海菜', jiangzhe: '江浙·杭帮·淮扬', yue: '粤菜·潮汕',
    chuan: '川菜', xiang: '湘菜·湖南', huoguo: '火锅·锅物', riliao: '日料',
    kaorou: '烤肉·烧烤', hancan: '韩餐', dongnanya: '东南亚菜', xican: '西餐',
    miandian: '面点·小吃', vegetarian: '素食·斋菜', qita: '其他各地菜'
  };
  /* 菜系芯片顺序：用户最常问的先排 */
  var ORDER = ['benbang', 'jiangzhe', 'yue', 'chuan', 'xiang', 'huoguo', 'riliao',
               'kaorou', 'hancan', 'dongnanya', 'xican', 'miandian', 'vegetarian', 'qita'];
  var PRICE_TEXT = { p50: '人均 ¥50 以内', p100: '人均 ¥50–100', p200: '人均 ¥100–200', p300: '人均 ¥200 以上' };

  var state = { cuisine: 'all', price: 'all', rank: 'all', sort: 'rec' };
  var located = null;
  var distCache = {};

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function idxOf(v) { return DATA.indexOf(v); }

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
    if (state.cuisine !== 'all' && v.cuisine !== state.cuisine) return false;
    if (state.rank === 'long' && v.rankYear < 5) return false;
    if (state.rank === 'new' && v.rankYear !== 1) return false;
    if (state.price !== 'all') {
      var p = v.price;
      if (state.price === 'p50' && p > 50) return false;
      if (state.price === 'p100' && (p <= 50 || p > 100)) return false;
      if (state.price === 'p200' && (p <= 100 || p > 200)) return false;
      if (state.price === 'p300' && p <= 200) return false;
    }
    return true;
  }

  function sortFn(a, b) {
    if (state.sort === 'dist' && located) {
      var da = distOf(a), db = distOf(b);
      if (da == null && db == null) return b.score - a.score;
      if (da == null) return 1;
      if (db == null) return -1;
      if (Math.abs(da - db) > 0.3) return da - db;
      return b.score - a.score;
    }
    if (state.sort === 'cheap') return a.price - b.price || b.score - a.score;
    if (state.sort === 'long') return b.includeYear - a.includeYear || b.score - a.score;
    /* rec：评分优先，同分看上榜年数 */
    return b.score - a.score || b.rankYear - a.rankYear || idxOf(a) - idxOf(b);
  }

  function scoreStar(s) {
    /* 4.0–5.0 映射到 5 颗星（全星 = 4.8+），直观但不改数字 */
    var full = Math.max(0, Math.min(5, Math.round((s - 3.8) / 0.24)));
    var out = '';
    for (var i = 0; i < 5; i++) out += (i < full ? '★' : '☆');
    return out;
  }

  function scoreBadge(v) {
    var cls = v.score >= 4.7 ? 'b-d1' : v.score >= 4.5 ? 'b-d2' : 'b-d3';
    return '<span class="badge ' + cls + '">⭐ <b>' + v.score.toFixed(1) + '</b></span>';
  }
  function rankBadge(v) {
    if (v.rankYear >= 8) return '<span class="badge b-d1">🏅 连续 ' + v.rankYear + ' 年上榜</span>';
    if (v.rankYear >= 3) return '<span class="badge b-d2">🏅 连续 ' + v.rankYear + ' 年上榜</span>';
    if (v.rankYear === 1) return '<span class="badge b-tbd">🆕 2026 新上榜</span>';
    return '';
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
    return '<div class="card card-eat" data-id="' + esc(v.id) + '">' +
      '<div class="top"><h3>' + esc(v.name) + '</h3>' + scoreBadge(v) + '</div>' +
      '<div class="meta-line">' +
        '<span class="pill-type">' + esc(CN[v.cuisine] || v.cat) + '</span> ' +
        (v.cat !== (CN[v.cuisine] || '') ? '<span class="en-name">' + esc(v.cat) + '</span> ' : '') +
        rankBadge(v) +
      '</div>' +
      '<div class="meta-line">' + scoreStar(v.score) + ' ' + v.score.toFixed(1) + ' 分（平台公开分）　·　💰 人均约 <b>¥' + v.price + '</b></div>' +
      '<div class="meta-line">📍 ' + esc(v.area || '—') + (v.metro ? '（近 ' + esc(v.metro) + ' 站）' : '') + '</div>' +
      (v.must && v.must.length ? '<div class="meta-line">🍽 榜单招牌：<b>' + esc(v.must.join('、')) + '</b></div>' : '') +
      '<div class="meta-line">📚 收录 <b>' + v.includeYear + '</b> 年' + (v.rankText ? '　·　' + esc(v.rankText) : '') + '</div>' +
      distHTML(v) +
      (v.reason ? '<div class="detail"><div class="tip">' + esc(v.reason) + '</div></div>' : '') +
      '</div>';
  }

  function render() {
    var list = DATA.filter(match).sort(sortFn);
    var grid = document.getElementById('grid');
    if (!grid) return;
    grid.innerHTML = list.length
      ? list.map(cardHTML).join('')
      : '<div class="empty">这个组合下没有收录的店 —— 把人均或「连续上榜」放宽一点试试。</div>';
    var c = document.getElementById('count');
    if (c) c.textContent = list.length;
    highlightGuide();
    if (window.Annotate) window.Annotate.apply();
  }

  function renderStats() {
    function set(id, val) { var e = document.getElementById(id); if (e) e.textContent = val; }
    set('s-total', DATA.length);
    set('s-cuisine', ORDER.filter(function (k) { return DATA.some(function (v) { return v.cuisine === k; }); }).length);
    set('s-long', DATA.filter(function (v) { return v.rankYear >= 5; }).length);
    set('s-cheap', DATA.filter(function (v) { return v.price <= 100; }).length);
  }

  function renderCounts() {
    var groups = { cuisine: { all: DATA.slice() }, price: { all: DATA.slice() }, rank: { all: DATA.slice() } };
    ORDER.forEach(function (k) { groups.cuisine[k] = []; });
    ['p50', 'p100', 'p200', 'p300'].forEach(function (k) { groups.price[k] = []; });
    groups.rank.long = []; groups.rank.new = [];
    DATA.forEach(function (v) {
      if (groups.cuisine[v.cuisine]) groups.cuisine[v.cuisine].push(v);
      var p = v.price;
      if (p <= 50) groups.price.p50.push(v);
      else if (p <= 100) groups.price.p100.push(v);
      else if (p <= 200) groups.price.p200.push(v);
      else groups.price.p300.push(v);
      if (v.rankYear >= 5) groups.rank.long.push(v);
      if (v.rankYear === 1) groups.rank.new.push(v);
    });
    document.querySelectorAll('[data-cnt]').forEach(function (el) {
      var p = el.getAttribute('data-cnt').split(':');
      var gr = groups[p[0]];
      if (!gr) return;
      el.textContent = (gr[p[1]] || []).length;
    });
    /* 计数为 0 的菜系芯片直接隐藏，避免点下去是空列表 */
    document.querySelectorAll('.chip[data-group="cuisine"]').forEach(function (el) {
      var val = el.getAttribute('data-val');
      if (val === 'all') return;
      var n = (groups.cuisine[val] || []).length;
      el.style.display = n ? '' : 'none';
    });
  }

  function pick() {
    var pool = DATA.filter(match);
    if (!pool.length) { alert('当前筛选下没有可推荐的店，放宽条件试试。'); return; }
    var weighted = [];
    pool.forEach(function (v) {
      var w = 2;
      if (v.score >= 4.7) w += 2;
      if (v.rankYear >= 5) w += 2;      // 长期上榜 = 稳
      if (v.includeYear >= 10) w += 1;
      for (var i = 0; i < w; i++) weighted.push(v);
    });
    var v = weighted[Math.floor(Math.random() * weighted.length)];
    var why = [];
    why.push('平台评分 ' + v.score.toFixed(1) + '（' + (v.score >= 4.7 ? '在这个池子里属突出' : '在必吃榜池子里属正常）') + '');
    why.push(v.rankText || '收录 ' + v.includeYear + ' 年');
    why.push('人均约 ¥' + v.price + '，' + (v.price <= 100 ? '不贵' : v.price <= 200 ? '中等偏上' : '偏贵'));
    var box = document.getElementById('pickResult');
    if (!box) return;
    box.style.display = 'block';
    box.innerHTML = '<div class="pick-card">' +
      '<div class="pk-name">' + esc(v.name) + '　' + scoreBadge(v) + '</div>' +
      '<div class="pk-line">' + esc(CN[v.cuisine] || v.cat) + '　·　' + esc(v.area || '—') + '</div>' +
      '<div class="pk-line">🍽 ' + esc((v.must || []).join('、') || '—') + '　·　💰 人均约 ¥' + v.price + '</div>' +
      '<div class="pk-why"><b>为什么是它：</b>' + esc(why.join('；')) + '。</div>' +
      '<div class="pk-line" style="color:var(--sub);font-size:12px">评分与人均是 ' + esc(META.scoreDate || '') +
        ' 的快照，去之前请在点评里再看一眼当前分。</div>' +
      '</div>';
    if (box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ===== 知识块 ===== */
  function card(r) {
    return '<div class="scene-card"><b>' + esc(r.k) + '</b>　<span style="color:var(--blue);font-weight:700">' +
      esc(r.v) + '</span><br><span style="color:var(--sub)">' + esc(r.d) + '</span></div>';
  }
  function guideCard(g) {
    return '<div class="scene-card guide-cuisine" data-cuisine="' + esc(g.k) + '">' +
      '<b>' + esc(g.name) + '</b><br>' +
      '<span style="color:var(--blue)">🗺 去哪吃　</span><span>' + esc(g.where) + '</span><br>' +
      '<span style="color:#1a8a3a">🍽 怎么点　</span><span>' + esc(g.how) + '</span><br>' +
      '<span style="color:#a3670a">⚠️ 注意　</span><span>' + esc(g.watch) + '</span></div>';
  }
  function honorTable() {
    var box = document.getElementById('honors');
    if (!box || !META.honors) return;
    var order = ['三星', '二星', '一星', '必比登', '黑珍珠'];
    function lvl(g) {
      if (/三星/.test(g)) return 0;
      if (/二星|二钻/.test(g)) return 1;
      if (/一星|一钻/.test(g)) return 2;
      if (/必比登/.test(g)) return 3;
      return 4;
    }
    var rows = META.honors.slice().sort(function (a, b) { return lvl(a.g) - lvl(b.g); });
    box.innerHTML = '<table class="mini-tbl"><thead><tr>' +
      '<th>餐厅</th><th>榜单等级</th><th>菜系</th><th>所在区</th><th>参考人均</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td><b>' + esc(r.n) + '</b></td><td>' + esc(r.g) + '</td><td>' + esc(r.c) +
          '</td><td>' + esc(r.d || '—') + '</td><td>' + (r.p ? '¥' + esc(r.p) : '—') + '</td></tr>';
      }).join('') + '</tbody></table>';
  }
  function renderMetaBlocks() {
    function set(id, t) { var e = document.getElementById(id); if (e) e.textContent = t; }
    set('verifiedAt', META.verifiedAt || '');
    set('metaTotal', DATA.length);
    set('honorCount', (META.honors || []).length);
    set('scoreDate', META.scoreDate || '');
    var n = document.getElementById('metaNote');
    if (n && META.note) n.innerHTML = '⚠️ ' + esc(META.note);
    var h = document.getElementById('howTo');
    if (h && META.howTo) h.innerHTML = META.howTo.map(card).join('');
    var g = document.getElementById('cuisineGuide');
    if (g && META.cuisineGuide) g.innerHTML = META.cuisineGuide.map(guideCard).join('');
    var s = document.getElementById('scoreHow');
    if (s && META.scoreHow) s.innerHTML = META.scoreHow.map(card).join('');
    var c = document.getElementById('care');
    if (c && META.care) c.innerHTML = META.care.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
    var hn = document.getElementById('honorsNote');
    if (hn && META.honorsNote) hn.textContent = META.honorsNote;
    honorTable();
  }
  /* 选了菜系，把对应的「怎么点」卡片高亮 */
  function highlightGuide() {
    document.querySelectorAll('.guide-cuisine').forEach(function (el) {
      el.classList.toggle('now', state.cuisine !== 'all' && el.getAttribute('data-cuisine') === state.cuisine);
    });
  }
  function scrollGuide() {
    var el = document.querySelector('.guide-cuisine.now');
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ===== 定位 ===== */
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
        if (g === 'cuisine' && val !== 'all') scrollGuide();
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
