(function () {
  'use strict';

  var DATA = window.GIFTS || [];
  var META = window.GIFTS_META || {};
  var FOR_TEXT   = META.forText   || { all:'不限', women:'送女生', men:'送男士', both:'男女都合适' };
  var PRICE_TEXT = META.priceText || { all:'预算不限', p1:'¥100 以内', p2:'¥100–300', p3:'¥300–800', p4:'¥800 以上' };
  var OCC_TEXT   = META.occText   || {};
  var STAGE_TEXT = META.stageText || {};
  var PRICE_TIER = { p1:1, p2:2, p3:3, p4:4 };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function isSafe(g) { return g.conf === 'high'; }
  function isExp(g) { return /^⭐/.test(g.name || ''); }

  var state = { for:'all', price:'all', occasion:'all', stage:'all', onlySafe:false, sort:'rec' };

  function match(g) {
    if (state.for !== 'all' && g.for !== state.for && g.for !== 'both') return false;
    if (state.price !== 'all' && g.price !== PRICE_TIER[state.price]) return false;
    if (state.occasion !== 'all' && (g.occasion || []).indexOf(state.occasion) < 0) return false;
    if (state.stage !== 'all' && (g.stage || []).indexOf(state.stage) < 0) return false;
    if (state.onlySafe && g.conf !== 'high') return false;
    return true;
  }

  function safeRank(g) { return g.conf === 'high' ? 0 : 1; }
  function sortFn(a, b) {
    if (state.sort === 'price-asc')  return (a.price - b.price) || a.name.localeCompare(b.name, 'zh');
    if (state.sort === 'price-desc') return (b.price - a.price) || a.name.localeCompare(b.name, 'zh');
    // 推荐排序：安全牌优先 → 预算从低到高 → 名称
    return (safeRank(a) - safeRank(b)) || (a.price - b.price) || a.name.localeCompare(b.name, 'zh');
  }

  function cardHTML(g) {
    var confBadge = isSafe(g)
      ? '<span class="badge b-safe">🟢 安全牌</span>'
      : '<span class="badge b-risk">🟡 较看人</span>';
    var exp = isExp(g) ? ' <span class="badge b-run">⭐ 体验类</span>' : '';
    var price = g.priceText || PRICE_TEXT['p' + g.price] || '';
    var occ = (g.occasion || []).map(function (o) { return '<span class="tag">' + esc(OCC_TEXT[o] || o) + '</span>'; }).join('');
    var stg = (g.stage || []).map(function (s) { return '<span class="tag">' + esc(STAGE_TEXT[s] || s) + '</span>'; }).join('');
    var tags = (g.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');
    return '<div class="card card-gift" data-id="' + esc(g.id) + '">' +
      '<div class="top"><h3>' + g.name + '</h3>' + confBadge + exp + '</div>' +
      '<div class="meta-line"><span class="pill-type">' + esc(FOR_TEXT[g.for] || '') + '</span>' +
        '　<b style="color:var(--amber)">' + esc(price) + '</b></div>' +
      '<div class="gift-why">💡 ' + g.reason + '</div>' +
      '<div class="gift-tip">🎁 怎么送 / 注意：' + g.tip + '</div>' +
      '<div class="tags">' + occ + '</div>' +
      '<div class="tags" style="border-top:1px dashed var(--line);padding-top:8px">' + stg + tags + '</div>' +
      '</div>';
  }

  function render() {
    var list = DATA.filter(match).sort(sortFn);
    document.getElementById('grid').innerHTML = list.length
      ? list.map(cardHTML).join('')
      : '<div class="empty">没有符合条件的礼物，把筛选放宽一点试试。</div>';
    document.getElementById('count').textContent = list.length;
    if (window.Annotate) window.Annotate.apply();
  }

  function renderStats() {
    function set(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }
    set('s-total', DATA.length);
    set('s-safe', DATA.filter(isSafe).length);
    set('s-exp', DATA.filter(isExp).length);
  }

  /** 芯片上的数量：按「忽略本组筛选」的剩余集合算 */
  function renderCounts() {
    var G = {
      'for':   { all: DATA.length, women: 0, men: 0, both: 0 },
      'price': { all: DATA.length, p1: 0, p2: 0, p3: 0, p4: 0 },
      'occasion': { all: DATA.length, birthday: 0, anniv: 0, valentine: 0, festival: 0, daily: 0, confess: 0, heal: 0 },
      'stage': { all: DATA.length, crush: 0, dating: 0, longterm: 0 }
    };
    DATA.forEach(function (g) {
      if (g.for === 'women' || g.for === 'both') G.for.women++;
      if (g.for === 'men' || g.for === 'both') G.for.men++;
      if (g.for === 'both') G.for.both++;
      var pk = 'p' + g.price; if (G.price[pk] != null) G.price[pk]++;
      (g.occasion || []).forEach(function (o) { if (G.occasion[o] != null) G.occasion[o]++; });
      (g.stage || []).forEach(function (s) { if (G.stage[s] != null) G.stage[s]++; });
    });
    document.querySelectorAll('[data-cnt]').forEach(function (el) {
      var key = el.getAttribute('data-cnt');          // 形如 "occasion:birthday"
      var p = key.split(':');
      var grp = G[p[0]];
      if (!grp) return;
      el.textContent = grp[p[1]] != null ? grp[p[1]] : 0;
    });
  }

  function pick() {
    var pool = DATA.filter(match);
    if (!pool.length) { alert('当前筛选下没有可推荐的礼物，放宽条件试试。'); return; }
    var weighted = [];
    pool.forEach(function (g) {
      var w = 2;
      if (isSafe(g)) w += 3;          // 安全牌优先
      if (isExp(g)) w += 1;           // 体验类稍微加权
      for (var i = 0; i < w; i++) weighted.push(g);
    });
    var g = weighted[Math.floor(Math.random() * weighted.length)];
    var why = [];
    if (isSafe(g)) why.push('安全牌，不太会出错'); else why.push('⚠️ 较看人，送前多观察对方喜好');
    if (isExp(g)) why.push('体验类，「一起度过的时间」比实物更难忘');
    if (g.price <= 1) why.push('预算友好');
    else if (g.price >= 4) why.push('偏大件，先确认关系阶段和预算');
    var box = document.getElementById('pickResult');
    box.style.display = 'block';
    box.innerHTML = '<div class="pick-card">' +
      '<div class="pk-name">' + g.name +
        '<span class="badge ' + (isSafe(g) ? 'b-safe' : 'b-risk') + '" style="margin-left:6px">' +
        (isSafe(g) ? '🟢 安全牌' : '🟡 较看人') + '</span></div>' +
      '<div class="pk-line">' + esc(FOR_TEXT[g.for] || '') + '　·　' + esc(g.priceText || '') + '</div>' +
      '<div class="pk-line">' + g.reason + '</div>' +
      '<div class="pk-line">🎁 ' + g.tip + '</div>' +
      (why.length ? '<div class="pk-why"><b>为什么是它：</b>' + why.join('；') + '。</div>' : '') +
      '</div>';
    if (box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function bind() {
    document.querySelectorAll('.chip[data-group]').forEach(function (el) {
      el.addEventListener('click', function () {
        var g = el.getAttribute('data-group');
        var v = el.getAttribute('data-val');
        if (!g) return;
        if (g === 'toggle') {                       // 「只看安全牌」独立开关
          el.classList.toggle('on');
          state.onlySafe = el.classList.contains('on');
        } else {                                    // 单选组
          document.querySelectorAll('.chip[data-group="' + g + '"]').forEach(function (o) { o.classList.remove('on'); });
          el.classList.add('on');
          state[g] = v;
        }
        var pr = document.getElementById('pickResult'); if (pr) pr.style.display = 'none';
        render();
      });
    });
    document.querySelectorAll('.chip[data-sort]').forEach(function (el) {
      el.addEventListener('click', function () {
        document.querySelectorAll('.chip[data-sort]').forEach(function (o) { o.classList.remove('on'); });
        el.classList.add('on');
        state.sort = el.getAttribute('data-sort');
        render();
      });
    });
    document.getElementById('btnDecide').addEventListener('click', pick);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var v = document.getElementById('verifiedAt');
    if (v) v.textContent = META.verifiedAt || '';
    var b = document.getElementById('metaNote');
    if (b && META.note) b.innerHTML = '⚠️ ' + META.note;
    renderStats();
    renderCounts();
    bind();
    render();
  });
})();
