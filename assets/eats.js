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

  var state = { cuisine: 'all', sub: 'all', price: 'all', rank: 'all', sort: 'rec',
                loc: null,      // 单点定位：站名
                midA: null, midB: null, midErr: '',   // 中间点：两个人的站名
                ref: null };    // 唯一距离基准（中间点优先，否则单点）
  var distCache = {};

  /**
   * 距离基准 state.ref —— 中间点优先，否则单点定位。语义与 index/assets/app.js 的 refreshRef() 一致。
   *
   * ⚠️ 所有跟距离有关的地方（distOf / sortFn / 卡片文案 / 推荐框）都必须只读 state.ref，
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
  function refShort() {
    if (!state.ref) return '';
    return state.ref.kind === 'mid' ? state.ref.label + ' 中间点' : state.ref.label;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  /**
   * 作者文案专用：先转义、再把 **加粗** 变成 <b>。
   * ⚠️ 数据里（episode / honestTag 等）写的是 **这样**，而 esc() 只转义不解析，
   *    直接用 esc 会把星号原样显示在页面上。凡是「我写的说明文字」都走 md()，
   *    凡是「平台上抓来的原文」（店名 / 菜名 / 地址）仍走 esc()，不要混。
   */
  function md(s) {
    return esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  }
  function idxOf(v) { return DATA.indexOf(v); }

  /** 大众点评链接：有 shopId 就直达门店页，没有就退回站内搜索 */
  function dpUrl(v) {
    if (v.dp) return 'https://www.dianping.com/shop/' + v.dp;
    return 'https://www.dianping.com/search/keyword/1/0_' + encodeURIComponent(v.name);
  }
  function dpLink(v, cls) {
    return '<a class="' + (cls || 'dp') + '" href="' + dpUrl(v) +
      '" target="_blank" rel="noopener nofollow">大众点评' + (v.dp ? '' : '（搜索）') + ' ↗</a>';
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

  /* 不含「细分」的那部分筛选 —— 细分芯片的计数必须用它，
     否则计数会随「当前选中哪个细分」而变，芯片数量自己跳。 */
  function matchBase(v) {
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

  function match(v) {
    if (state.sub !== 'all' && v.sub !== state.sub) return false;
    return matchBase(v);
  }

  /* 「最值得去」的排序规则 —— 故意不用加权公式（权重是拍的，说不清）。
     分档 → 上榜久 → 收录久，三步都是必吃榜页面的公开字段，读者能拿卡面数字自己核对。
     ⚠️ 这是本站的排序口径，不是官方排名，页面已写明。 */
  function byRec(a, b) {
    var ba = Math.round(a.score * 10), bb = Math.round(b.score * 10);
    if (ba !== bb) return bb - ba;                                   // ① 评分档位（4.9 / 4.8…）
    if ((b.rankYear || 0) !== (a.rankYear || 0)) {                   // ② 连续上榜年数
      return (b.rankYear || 0) - (a.rankYear || 0);
    }
    if ((b.includeYear || 0) !== (a.includeYear || 0)) {              // ③ 收录年数
      return (b.includeYear || 0) - (a.includeYear || 0);
    }
    return idxOf(a) - idxOf(b);                                       // ④ 兜底：数据里的顺序
  }

  function sortFn(a, b) {
    if (state.sort === 'dist' && state.ref) {
      var da = distOf(a), db = distOf(b);
      if (da == null && db == null) return b.score - a.score;
      if (da == null) return 1;
      if (db == null) return -1;
      if (Math.abs(da - db) > 0.3) return da - db;
      return b.score - a.score;
    }
    if (state.sort === 'cheap') return a.price - b.price || b.score - a.score;
    if (state.sort === 'long') return b.includeYear - a.includeYear || b.score - a.score;
    /* rec：与推荐框同一把尺子（评分档位 → 连续上榜 → 收录年数），保证「推荐前 3」＝网格前 3 */
    return byRec(a, b);
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
    if (!state.ref || !window.WG) return '';
    var km = distOf(v);
    if (km == null) return '<div class="dist d5">📍 距' + esc(refName()) + '较远（跨区）</div>';
    var g = window.WG.grade(km);
    if (!g) return '';
    return '<div class="dist ' + g.cls + '">📍 距' + esc(refName()) + '约 ' +
      km.toFixed(1) + ' km <span>· ' + g.txt + ' · ' + g.sub + '</span></div>';
  }

  /* ===== 招牌菜：有科普词典的就做成可点，点开在卡内展开 ===== */
  function dishHTML(v) {
    if (!v.must || !v.must.length) return '';
    var D = META.dishes || {};
    var spans = v.must.map(function (d, i) {
      var has = !!D[d];
      return has
        ? '<span class="dish" data-dish="' + esc(d) + '" data-box="db-' + esc(v.id) + '-' + i + '">' + esc(d) + '</span>'
        : esc(d);
    }).join('、');
    var boxes = v.must.map(function (d, i) {
      var e = D[d];
      if (!e) return '';
      return '<div class="dish-box" id="db-' + esc(v.id) + '-' + i + '">' +
        '<div class="db-head">🍽 ' + esc(d) + '　<span class="db-g">' + esc(e.g) + '</span></div>' +
        '<div class="db-w">' + esc(e.w) + '</div>' +
        '<div class="db-t"><b>怎么判断 / 怎么点：</b>' + esc(e.t) + '</div>' +
        '</div>';
    }).join('');
    return '<div class="meta-line">🍽 榜单招牌：<b>' + spans + '</b>' +
      '<span class="hint" style="margin-left:6px">（点菜名看科普）</span>' + boxes + '</div>';
  }

  function cardHTML(v) {
    return '<div class="card card-eat" data-id="' + esc(v.id) + '">' +
      '<div class="top"><h3>' + esc(v.name) + '</h3>' + scoreBadge(v) + '</div>' +
      '<div class="meta-line">' +
        '<span class="pill-type">' + esc(v.sub || v.cat) + '</span> ' +
        (v.cat !== (v.sub || '') ? '<span class="en-name">' + esc(v.cat) + '</span> ' : '') +
        rankBadge(v) +
      '</div>' +
      '<div class="meta-line">' + scoreStar(v.score) + ' <span style="color:var(--sub)">大众点评公开分</span>　·　💰 人均约 <b>¥' + v.price + '</b></div>' +
      '<div class="meta-line">📍 ' + esc(v.area || '—') + (v.metro ? '（近 ' + esc(v.metro) + ' 站）' : '') + '</div>' +
      dishHTML(v) +
      '<div class="meta-line">📚 收录 <b>' + v.includeYear + '</b> 年' + (v.rankText ? '　·　' + esc(v.rankText) : '') + '</div>' +
      distHTML(v) +
      '<div class="meta-line">' + dpLink(v) + '</div>' +
      (v.reason ? '<div class="detail"><div class="tip">' + esc(v.reason) + '</div></div>' : '') +
      '</div>';
  }

  /* ===== 「最值得去」推荐框 ===== */
  function topPickCard(v, rank) {
    var addr = esc(v.area || '—') + (v.metro ? '（近 ' + esc(v.metro) + ' 站）' : '');
    var d = distOf(v);
    if (state.ref && d != null) addr += '　·　📍 距 ' + esc(refShort()) + ' ' + d.toFixed(1) + ' km';
    var why = '平台公开分 <b>' + v.score.toFixed(1) + '</b>';
    why += '　·　' + (v.rankText ? esc(v.rankText) : '上榜年数未标注');
    why += '　·　收录 <b>' + v.includeYear + '</b> 年';
    return '<div class="tp-card' + (rank === 1 ? ' tp-first' : '') + '">' +
      '<div class="tp-rank">' + rank + '</div>' +
      '<div class="tp-body">' +
        '<div class="tp-name">' + esc(v.name) + '　' + scoreBadge(v) +
          (rank === 1 ? ' <span class="badge b-d1">🏆 本次首选</span>' : '') + '</div>' +
        '<div class="tp-meta"><span class="pill-type">' + esc(v.sub || v.cat) + '</span>　' + addr +
          '　·　💰 人均约 <b>¥' + v.price + '</b></div>' +
        dishHTML(v) +
        '<div class="tp-why">为什么排第 ' + rank + '：' + why + '</div>' +
        (v.reason ? '<div class="tp-reason">' + esc(v.reason) + '</div>' : '') +
        '<div style="margin-top:6px">' + dpLink(v) + '</div>' +
      '</div>' +
    '</div>';
  }

  function renderTop() {
    var box = document.getElementById('topPicks');
    if (!box) return;
    var list = DATA.filter(match).sort(byRec);
    var scope = document.getElementById('topScope');
    if (scope) {
      scope.textContent = state.cuisine === 'all'
        ? '全部菜系'
        : (CN[state.cuisine] || '') + (state.sub !== 'all' ? ' · ' + state.sub : '');
    }
    var num = document.getElementById('topTotal');
    if (num) num.textContent = list.length;
    if (!list.length) {
      box.innerHTML = '<div class="empty">这个组合下没有收录的店 —— 把人均或「连续上榜」放宽一点试试。</div>';
      return;
    }
    box.innerHTML = list.slice(0, 3).map(function (v, i) { return topPickCard(v, i + 1); }).join('');
  }

  /* ===== 二级细分芯片 =====
     选了菜系才出现。大类里只有一种细分时（例如东南亚只有泰国菜），
     仍然给一个「全部<菜系>」芯片 + 在上面写清「这一类只收录到这一种」，不假装有得选。 */
  function renderSubChips() {
    var wrap = document.getElementById('subRow');
    var box = document.getElementById('subChips');
    var note = document.getElementById('subNote');
    if (!wrap || !box) return;
    if (state.cuisine === 'all') {
      wrap.style.display = 'none';
      box.innerHTML = '';
      if (note) { note.style.display = 'none'; note.innerHTML = ''; }
      return;
    }
    wrap.style.display = '';
    var base = DATA.filter(matchBase);
    var g = {};
    base.forEach(function (v) { var k = v.sub || v.cat; g[k] = (g[k] || 0) + 1; });
    var keys = Object.keys(g).sort(function (a, b) { return g[b] - g[a] || (a < b ? -1 : 1); });
    var html = '<span class="chip' + (state.sub === 'all' ? ' on' : '') + '" data-sub="all">全部' +
      esc(CN[state.cuisine] || '') + ' <b class="cnt">' + base.length + '</b></span>';
    keys.forEach(function (k) {
      html += '<span class="chip' + (state.sub === k ? ' on' : '') + '" data-sub="' + esc(k) + '">' +
        esc(k) + ' <b class="cnt">' + g[k] + '</b></span>';
    });
    box.innerHTML = html;
    if (note) {
      /* 优先显示「这一类覆盖偏薄」的警告（有就直说），否则退回讲清细分口径是怎么归的 */
      var thin = (META.thinSub && META.thinSub[state.cuisine]) || '';
      if (thin) {
        note.className = 'hint sub-note warn';
        note.innerHTML = '⚠️ ' + esc(thin);
      } else {
        note.className = 'hint sub-note';
        note.innerHTML = esc(META.subNote || '');
      }
      note.style.display = (thin || META.subNote) ? '' : 'none';
    }
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
    renderTop();
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
      '<div class="pk-line">' + esc(CN[v.cuisine] || v.cat) + '　·　' + esc(v.area || '—') +
        (state.ref ? '　·　📍 距 ' + esc(refShort()) + ' ' + (distOf(v) == null ? '—' : distOf(v).toFixed(1) + ' km') : '') + '</div>' +
      '<div class="pk-line">🍽 ' + esc((v.must || []).join('、') || '—') + '　·　💰 人均约 ¥' + v.price + '</div>' +
      '<div class="pk-why"><b>为什么是它：</b>' + esc(why.join('；')) + '。</div>' +
      '<div class="pk-line" style="color:var(--sub);font-size:12px">评分与人均是 ' + esc(META.scoreDate || '') +
        ' 的快照，去之前请在点评里再看一眼当前分。　' + dpLink(v, 'dp dp-sm') + '</div>' +
      '</div>';
    if (box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ===== 知识块 ===== */
  function card(r) {
    return '<div class="scene-card"><b>' + esc(r.k) + '</b>　<span style="color:var(--blue);font-weight:700">' +
      esc(r.v) + '</span><br><span style="color:var(--sub)">' + esc(r.d) + '</span></div>';
  }
  function guideCard(g) {
    var shops = (g.shops || []).map(function (s) {
      return esc(s.n) + '<span style="color:var(--sub)">（⭐' + s.s.toFixed(1) + ' · ¥' + s.p + '）</span>';
    }).join('　');
    return '<div class="scene-card guide-cuisine" data-cuisine="' + esc(g.k) + '">' +
      '<b>' + esc(g.name) + '</b><br>' +
      '<span style="color:var(--blue)">🗺 去哪吃　</span><span>' + esc(g.where) + '</span><br>' +
      '<span style="color:#1a8a3a">🍽 怎么点　</span><span>' + esc(g.how) + '</span><br>' +
      '<span style="color:#a3670a">⚠️ 注意　</span><span>' + esc(g.watch) + '</span>' +
      (shops ? '<br><span style="color:#7a3ea8">🍜 代表店　</span><span class="gl-shops">' + shops + '</span>' : '') +
      '<br><span class="hint">👆 点这张卡＝直接把上面的列表筛成「' + esc(g.name) + '」</span>' +
      '</div>';
  }

  /* ===== 招牌菜科普词典（137 道，可按分组筛 + 按菜名搜） ===== */
  var dishState = { g: 'all', q: '' };
  var DGROUP = ['高级硬菜', '本帮江浙', '粤潮', '川湘', '火锅', '日料', '烤西', '韩东南亚', '面点小吃', '素与地方'];

  function renderDishDict() {
    var box = document.getElementById('dishDict');
    if (!box) return;
    var D = META.dishes || {};
    var keys = Object.keys(D);
    var chips = document.getElementById('dishChips');
    if (chips) {
      var html = '<span class="chip' + (dishState.g === 'all' ? ' on' : '') + '" data-dg="all">全部 <b class="cnt">' + keys.length + '</b></span>';
      DGROUP.forEach(function (g) {
        var n = keys.filter(function (k) { return D[k].g === g; }).length;
        if (!n) return;
        html += '<span class="chip' + (dishState.g === g ? ' on' : '') + '" data-dg="' + esc(g) + '">' +
          esc(g) + ' <b class="cnt">' + n + '</b></span>';
      });
      chips.innerHTML = html;
    }
    var q = dishState.q.trim();
    var list = keys.filter(function (k) {
      if (dishState.g !== 'all' && D[k].g !== dishState.g) return false;
      if (q && k.indexOf(q) < 0 && (D[k].w + D[k].t).indexOf(q) < 0) return false;
      return true;
    });
    var cnt = document.getElementById('dishCount');
    if (cnt) cnt.textContent = list.length;
    if (!list.length) {
      box.innerHTML = '<div class="empty">没搜到这道菜 —— 换个词（比如「咖喱」「小笼」「吊龙」）试试。</div>';
      return;
    }
    var out = '', lastG = '';
    DGROUP.forEach(function (g) {
      var sub = list.filter(function (k) { return D[k].g === g; });
      if (!sub.length) return;
      if (g !== lastG) { out += '<div class="dish-group">' + esc(g) + '</div>'; lastG = g; }
      out += sub.map(function (k) {
        var e = D[k];
        return '<div class="dish-card"><div class="dc-n">' + esc(k) + '</div>' +
          '<div class="dc-w">' + esc(e.w) + '</div>' +
          '<div class="dc-t"><b>怎么判断 / 怎么点：</b>' + esc(e.t) + '</div></div>';
      }).join('');
    });
    box.innerHTML = out;
  }

  /* ===== 「舌尖上的中国 · 我们编了一期」 ===== */
  function renderEpisode() {
    var E = META.episode;
    if (!E) return;
    function set(id, t, html) {
      var e = document.getElementById(id);
      if (!e) return;
      if (html) e.innerHTML = t; else e.textContent = t;
    }
    set('epNote', md(E.note || ''), true);
    set('epSeasons', md(E.seasons || ''), true);
    set('epWarn', md(E.warn || ''), true);
    var box = document.getElementById('epList');
    if (!box) return;
    box.innerHTML = (E.segs || []).map(function (s, i) {
      var cui = (s.cui || []).map(function (c) {
        var n = DATA.filter(function (v) { return v.cuisine === c; }).length;
        return '<span class="chip sm ep-cui" data-cui="' + esc(c) + '">' + esc(CN[c] || c) + ' · ' + n + ' 家</span>';
      }).join('');
      return '<div class="ep-seg">' +
        '<div class="ep-head"><span class="ep-no">' + (i + 1) + '</span>' +
          '<span class="ep-t">' + esc(s.ep) + '</span>' +
          '<span class="ep-dish">🥢 ' + esc(s.dish) + '</span></div>' +
        '<div class="ep-shot">🎬 这一集拍了：' + md(s.shot) + '</div>' +
        '<div class="ep-what">' + md(s.what) + '</div>' +
        '<div class="ep-where"><b>在上海吃同类：</b>' + md(s.where) + '</div>' +
        '<div class="ep-how"><b>怎么判断：</b>' + md(s.how) + '</div>' +
        (cui ? '<div class="ep-cuis">' + cui + '</div>' : '') +
        '</div>';
    }).join('');
  }

  /* ===== 「上过榜 / 上过电视」怎么标 ===== */
  function renderHonest() {
    var H = META.honestTag;
    if (!H) return;
    var intro = document.getElementById('honestIntro');
    if (intro) intro.innerHTML = '⚠️ ' + md(H.intro);
    var box = document.getElementById('honestList');
    if (!box) return;
    box.innerHTML = (H.items || []).map(function (r) {
      return '<div class="scene-card"><b>' + md(r.k) + '</b>　<span style="color:var(--blue);font-weight:700">' +
        md(r.v) + '</span><br><span style="color:var(--sub)">' + md(r.d) + '</span></div>';
    }).join('');
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
    /* 「最值得去」的排序公式直接摊在推荐框上面，不藏权重 */
    var th = document.getElementById('topHow');
    if (th) th.innerHTML = '规则很简单，<b>没有加权公式</b>：' + esc(META.topHow || '');
    honorTable();
    renderDishDict();
    renderEpisode();
    renderHonest();
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

  /* ===== 定位（单点 + 中间点）=====
     语义与首页 assets/app.js 完全一致：两者互斥，state.ref 是唯一距离基准。
     卡片文案区分「距「张江路」」与「距「漕河泾 ↔ 张江路」中间点」。 */
  function setSortChip(which) {
    document.querySelectorAll('.chip[data-sort]').forEach(function (o) {
      var s = o.getAttribute('data-sort');
      if (s === 'dist') o.style.display = state.ref ? '' : 'none';
      o.classList.toggle('on', s === which);
    });
  }
  function renderLoc(html, cls) {
    var box = document.getElementById('locResult');
    if (!box) return;
    box.innerHTML = html ? '<div class="' + (cls || 'loc-ok') + '">' + html + '</div>' : '';
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
    state.midA = null; state.midB = null; state.midErr = '';
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
    distCache = {};
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
      state.midErr = '中间点要填两个地点：左边一个人在哪，右边另一个人在哪。两边都填上再点「算中间点」。';
      renderLoc(state.midErr, 'loc-bad');
    } else {
      var ra = window.WG.locate(a), rb = window.WG.locate(b);
      if (!ra || !ra.station || !rb || !rb.station) {
        state.midA = null; state.midB = null; state.loc = null; refreshRef();
        var bad = (!ra || !ra.station) ? a : b;
        state.midErr = '中间点这一侧「' + esc(bad) + '」没认出来，换个更常见的地名或地铁站名试试。';
        renderLoc(state.midErr, 'loc-bad');
      } else {
        state.midA = ra.station; state.midB = rb.station;
        state.loc = null; state.midErr = '';
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
    distCache = {};
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
    state.loc = null; state.midA = null; state.midB = null; state.midErr = '';
    refreshRef();
    renderLoc('');
    var chip = document.getElementById('chipNear'); if (chip) chip.style.display = 'none';
    state.sort = 'rec';
    setSortChip('rec');
    var d = document.querySelector('.chip[data-sort="dist"]');
    if (d) d.style.display = 'none';
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

    if (quick && window.WG.meta && window.WG.meta.quick) {
      var qs = window.WG.meta.quick.slice();
      if (qs.indexOf('张江路') < 0) qs.push('张江路');
      quick.innerHTML = qs.map(function (s) {
        return '<span class="chip sm" data-st="' + esc(s) + '">' + esc(s) + '</span>';
      }).join('');
      /* 快捷站填「最后聚焦的那一栏」——在中间点那两栏里点，就填那一栏并重算 */
      var focus = 'locInput';
      ['locInput', 'locInputA', 'locInputB'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('focus', function () { focus = id; });
      });
      quick.addEventListener('click', function (ev) {
        var el = ev.target.closest ? ev.target.closest('[data-st]') : null;
        if (!el) return;
        var s = el.getAttribute('data-st');
        var target = document.getElementById(focus) || input;
        if (!target) return;
        target.value = s;
        if (focus === 'locInputA' || focus === 'locInputB') {
          if (A && B && (A.value || '').trim() && (B.value || '').trim()) applyMid(false);
        } else applyLoc(s, false);
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
      if (input && !input.value && state.ref.kind === 'loc') input.value = state.loc;
      state.sort = 'dist';
      setSortChip('dist');
      render();
    });
    /* 优先 ?mid= → ?here= → 本地记忆（与首页一致） */
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
        /* 换了菜系，二级细分必须归零，否则会残留上一个菜系的 sub（列表直接空） */
        if (g === 'cuisine') { state.sub = 'all'; renderSubChips(); }
        else if (g === 'price' || g === 'rank') { renderSubChips(); }
        var pr = document.getElementById('pickResult'); if (pr) pr.style.display = 'none';
        render();
        if (g === 'cuisine' && val !== 'all') scrollGuide();
      });
    });
    /* 二级细分芯片：动态生成，走事件委托，别在 renderSubChips 里逐个绑 */
    var subBox = document.getElementById('subChips');
    if (subBox) subBox.addEventListener('click', function (ev) {
      var el = ev.target.closest ? ev.target.closest('[data-sub]') : null;
      if (!el) return;
      state.sub = el.getAttribute('data-sub');
      renderSubChips();
      var pr = document.getElementById('pickResult'); if (pr) pr.style.display = 'none';
      render();
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

    /* 卡片里的招牌菜：点菜名展开科普（卡片是重渲染的，必须走事件委托） */
    var grid = document.getElementById('grid');
    if (grid) grid.addEventListener('click', function (ev) {
      var el = ev.target.closest ? ev.target.closest('.dish') : null;
      if (!el) return;
      var box = document.getElementById(el.getAttribute('data-box'));
      if (!box) return;
      box.classList.toggle('open');
    });

    /* 词典：分组芯片 + 搜索框 */
    var dch = document.getElementById('dishChips');
    if (dch) dch.addEventListener('click', function (ev) {
      var el = ev.target.closest ? ev.target.closest('[data-dg]') : null;
      if (!el) return;
      dishState.g = el.getAttribute('data-dg');
      renderDishDict();
    });
    var ds = document.getElementById('dishSearch');
    if (ds) {
      ds.addEventListener('input', function () {
        dishState.q = ds.value || '';
        renderDishDict();
      });
      ds.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { ds.value = ''; dishState.q = ''; renderDishDict(); }
      });
    }

    /* 「舌尖一期」里的菜系芯片：点了直接筛列表 */
    var epl = document.getElementById('epList');
    if (epl) epl.addEventListener('click', function (ev) {
      var el = ev.target.closest ? ev.target.closest('[data-cui]') : null;
      if (!el) return;
      var c = el.getAttribute('data-cui');
      var chip = document.querySelector('.chip[data-group="cuisine"][data-val="' + c + '"]');
      if (chip) {
        chip.click();
        var g = document.getElementById('grid');
        if (g && g.scrollIntoView) g.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    /* 菜系知识卡：整张卡可点，直接筛出这一类 */
    var cg = document.getElementById('cuisineGuide');
    if (cg) cg.addEventListener('click', function (ev) {
      var el = ev.target.closest ? ev.target.closest('.guide-cuisine') : null;
      if (!el) return;
      var c = el.getAttribute('data-cuisine');
      var chip = document.querySelector('.chip[data-group="cuisine"][data-val="' + c + '"]');
      if (chip) {
        chip.click();
        var g = document.getElementById('grid');
        if (g && g.scrollIntoView) g.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderMetaBlocks();
    renderStats();
    renderCounts();
    renderSubChips();
    bindFilters();
    bindLoc();
    render();
  });
})();
