(function () {
  'use strict';

  var DATA = window.GAMES || [];
  var META = window.GAMES_META || {};

  var CAT_TEXT = {
    social: '社交推理 / 阵营', party: '欢乐破冰',
    strategy: '策略经营', card: '卡牌对战'
  };
  var DIFF_TEXT = { 1: '一学就会', 2: '好上手', 3: '要学一会', 4: '偏硬核', 5: '硬核' };
  var DIFF_CLS = { 1: 'b-d1', 2: 'b-d1', 3: 'b-d2', 4: 'b-d3', 5: 'b-d4' };
  var GM_TEXT = { none: '不用人主持', needed: '需要有人主持' };
  var KIT_TEXT = { buy: '要有一盒', free: '不用买就能开' };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function stars(n) {
    n = Math.max(1, Math.min(5, Math.round(n || 0)));
    var on = '', off = '';
    for (var i = 0; i < n; i++) on += '★';
    for (var j = n; j < 5; j++) off += '<i>★</i>';
    return '<span class="stars">' + on + off + '</span>';
  }
  function idxOf(g) { return DATA.indexOf(g); }

  var state = { cat: 'all', people: 'all', time: 'all', diff: 'all', gm: 'all', sort: 'rec' };

  function match(g) {
    if (state.cat !== 'all' && g.cat !== state.cat) return false;
    if (state.gm !== 'all' && g.gm !== state.gm) return false;
    if (state.diff !== 'all') {
      var d = g.diff || 0;
      if (state.diff === 'e' && d > 2) return false;
      if (state.diff === 'm' && d !== 3) return false;
      if (state.diff === 'h' && d < 4) return false;
    }
    if (state.people !== 'all') {
      var mn = g.pmin == null ? 4 : g.pmin, mx = g.pmax == null ? 6 : g.pmax;
      if (state.people === 's' && mx > 4) return false;
      if (state.people === 'm' && !(mn <= 8 && mx >= 6)) return false;
      if (state.people === 'l' && mx < 9) return false;
    }
    if (state.time !== 'all') {
      var t1 = g.dmin == null ? 1 : g.dmin, t2 = g.dmax == null ? 1 : g.dmax;
      if (state.time === 'short' && t2 > 0.5) return false;
      if (state.time === 'mid' && !(t1 >= 0.5 && t2 <= 1.5)) return false;
      if (state.time === 'long' && t2 < 1.5) return false;
    }
    return true;
  }

  function sortFn(a, b) {
    if (state.sort === 'diff-asc') return (a.diff - b.diff) || (idxOf(a) - idxOf(b));
    if (state.sort === 'diff-desc') return (b.diff - a.diff) || (idxOf(a) - idxOf(b));
    if (state.sort === 'time-asc') return ((a.dmax || 1) - (b.dmax || 1)) || (a.diff - b.diff) || (idxOf(a) - idxOf(b));
    if (state.sort === 'people-asc') return ((a.pmin || 2) - (b.pmin || 2)) || (idxOf(a) - idxOf(b));
    return idxOf(a) - idxOf(b);   // 推荐排序 = 收录顺序（同类里越靠前越常被提起）
  }

  function pillHTML(g) {
    return '<span class="pill-type">' + (CAT_TEXT[g.cat] || '') + '</span>' +
      ' <span class="pill-gm pill-gm-' + (g.gm === 'needed' ? 'need' : 'none') + '">' +
      (g.gm === 'needed' ? '🙋 要有人主持' : '✅ 不用人主持') + '</span>' +
      (g.kit === 'free' ? ' <span class="pill-free">🆓 不用买</span>' : '');
  }

  /** 「玩之前要知道」——沿用看展科普那套紫块样式 */
  function guideHTML(g) {
    var rows = '';
    if (g.highlight) rows += '<div class="g-sec">🎬 这游戏在玩什么</div><p class="g-intro">' + g.highlight + '</p>';
    if (g.forWho) rows += '<div class="g-sec">👀 适合谁玩</div><p class="g-aud">' + g.forWho + '</p>';
    if (g.note) rows += '<div class="g-sec">⚠️ 玩之前要知道</div><p class="g-aud">' + g.note + '</p>';
    if (!rows) return '';
    return '<details class="guide"><summary>📚 玩之前科普 · 在玩什么 / 适合谁 / 注意什么</summary>' +
      '<div class="guide-body">' + rows + '</div></details>';
  }

  function cardHTML(g) {
    var genres = (g.genres || []).map(function (x) { return '<span class="tag">' + x + '</span>'; }).join('');
    var tags = (g.tags || []).map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('');
    var bits = [];
    if (g.year && g.year !== '—') bits.push(g.year + ' 年');
    if (g.designer) bits.push(g.designer);
    if (g.kit && KIT_TEXT[g.kit]) bits.push(KIT_TEXT[g.kit]);
    if (g.conf === 'mid') bits.push('🟡 口径待核');
    var sub = bits.length ? '　·　' + bits.join('　·　') : '';

    return '<div class="card card-game" data-id="' + esc(g.id) + '">' +
      '<div class="top"><h3>' + g.name +
        (g.en && g.en !== '—' ? '<span class="en-name">' + g.en + '</span>' : '') + '</h3>' +
        '<span class="badge ' + (DIFF_CLS[g.diff] || 'b-d2') + '">' + (DIFF_TEXT[g.diff] || '要学一会') + '</span></div>' +
      '<div class="meta-line">' + pillHTML(g) + '</div>' +
      '<div class="meta-line"><b>' + g.players + '</b>　<span style="color:var(--sub)">⏱ ' + g.duration + '</span></div>' +
      '<div class="meta-line">上手难度 ' + stars(g.diff) + '<span style="color:var(--sub)">' + sub + '</span></div>' +
      '<div class="tags">' + genres + '</div>' +
      guideHTML(g) +
      (tags ? '<div class="tags" style="border-top:1px dashed var(--line);padding-top:8px">' + tags + '</div>' : '') +
      '</div>';
  }

  function render() {
    var list = DATA.filter(match).sort(sortFn);
    var grid = document.getElementById('grid');
    if (!grid) return;
    grid.innerHTML = list.length
      ? list.map(cardHTML).join('')
      : '<div class="empty">没有符合条件的游戏，把筛选放宽一点试试。</div>';
    var c = document.getElementById('count');
    if (c) c.textContent = list.length;
    if (window.Annotate) window.Annotate.apply();
  }

  function renderStats() {
    function set(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }
    set('s-total', DATA.length);
    set('s-noGm', DATA.filter(function (g) { return g.gm === 'none'; }).length);
    set('s-free', DATA.filter(function (g) { return g.kit === 'free'; }).length);
    set('s-quick', DATA.filter(function (g) { return (g.dmax || 1) <= 0.5; }).length);
  }

  /** 芯片上的数量：按「忽略本组筛选」的剩余集合算，跟其他页一致的手感 */
  function renderCounts() {
    var groups = {
      cat: { all: DATA, social: [], party: [], strategy: [], card: [] },
      people: { all: DATA, s: [], m: [], l: [] },
      time: { all: DATA, short: [], mid: [], long: [] },
      diff: { all: DATA, e: [], m: [], h: [] },
      gm: { all: DATA, none: [], needed: [] }
    };
    DATA.forEach(function (g) {
      if (groups.cat[g.cat]) groups.cat[g.cat].push(g);
      if (groups.gm[g.gm]) groups.gm[g.gm].push(g);
      var d = g.diff || 0;
      if (d <= 2) groups.diff.e.push(g); else if (d === 3) groups.diff.m.push(g); else groups.diff.h.push(g);
      var mn = g.pmin == null ? 4 : g.pmin, mx = g.pmax == null ? 6 : g.pmax;
      if (mx <= 4) groups.people.s.push(g);
      if (mn <= 8 && mx >= 6) groups.people.m.push(g);
      if (mx >= 9) groups.people.l.push(g);
      var t1 = g.dmin == null ? 1 : g.dmin, t2 = g.dmax == null ? 1 : g.dmax;
      if (t2 <= 0.5) groups.time.short.push(g);
      if (t1 >= 0.5 && t2 <= 1.5) groups.time.mid.push(g);
      if (t2 >= 1.5) groups.time.long.push(g);
    });
    document.querySelectorAll('[data-cnt]').forEach(function (el) {
      var key = el.getAttribute('data-cnt');        // 形如 "cat:social"
      var p = key.split(':');
      var gr = groups[p[0]];
      if (!gr) return;
      el.textContent = (gr[p[1]] || []).length;
    });
  }

  function pick() {
    var pool = DATA.filter(match);
    if (!pool.length) { alert('当前筛选下没有可推荐的游戏，放宽条件试试。'); return; }
    var weighted = [];
    pool.forEach(function (g) {
      var w = 2;
      if (g.gm === 'none') w += 2;            // 不用有人当主持，更容易开起来
      if (g.kit === 'free') w += 1;           // 不用买东西
      if ((g.dmax || 1) <= 0.5) w += 1;       // 半小时内能打完一局
      for (var i = 0; i < w; i++) weighted.push(g);
    });
    var g = weighted[Math.floor(Math.random() * weighted.length)];
    var why = [];
    if (g.gm === 'none') why.push('不用专门有人当主持，随时能开');
    else why.push('需要有人当主持 —— 先确认这一局有人愿意');
    if (g.kit === 'free') why.push('不用买，扑克 / 纸笔 / 手机就能开');
    if ((g.dmax || 1) <= 0.5) why.push('半小时内能打完一局，随时可以收');
    if (g.diff >= 4) why.push('上手偏硬核，先留出讲规则的时间');
    else if (g.diff <= 2) why.push('规则好讲，带完全没玩过的人也行');
    if ((g.pmax || 0) >= 9) why.push('人数弹性大，人多了也开得起来');
    var box = document.getElementById('pickResult');
    if (!box) return;
    box.style.display = 'block';
    box.innerHTML = '<div class="pick-card">' +
      '<div class="pk-name">' + g.name +
        (g.en && g.en !== '—' ? ' <span class="en-name">' + g.en + '</span>' : '') +
        '<span class="badge ' + (DIFF_CLS[g.diff] || 'b-d2') + '" style="margin-left:6px">' + (DIFF_TEXT[g.diff] || '') + '</span></div>' +
      '<div class="pk-line">' + (CAT_TEXT[g.cat] || '') + '　·　' + (g.genres || []).join(' / ') + '</div>' +
      '<div class="pk-line">' + g.players + '　·　' + g.duration + '　·　难度 ' + g.diff + '/5</div>' +
      '<div class="pk-line">' + (g.highlight || '') + '</div>' +
      (why.length ? '<div class="pk-why"><b>为什么是它：</b>' + why.join('；') + '。</div>' : '') +
      '</div>';
    if (box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderFeeRef() {
    var box = document.getElementById('feeRef');
    if (!box || !META.feeRef) return;
    box.innerHTML = META.feeRef.map(function (r) {
      return '<div class="scene-card"><b>' + r.k + '</b>　<span style="color:var(--amber);font-weight:700">' +
        r.v + '</span><br><span style="color:var(--sub)">' + r.d + '</span></div>';
    }).join('');
  }

  function renderPlatforms() {
    var box = document.getElementById('platforms');
    if (!box || !META.platforms) return;
    box.innerHTML = META.platforms.map(function (p) {
      return '<div class="scene-card"><b><a href="' + esc(p.url) + '" target="_blank" rel="noopener">' +
        esc(p.k) + ' ↗</a></b><br>' + esc(p.v) + '<br>' +
        '<span style="color:var(--sub)">' + esc(p.d) + '</span></div>';
    }).join('');
  }

  function bind() {
    document.querySelectorAll('.chip[data-group]').forEach(function (el) {
      el.addEventListener('click', function () {
        var g = el.getAttribute('data-group');
        var v = el.getAttribute('data-val');
        if (!g) return;                       // 排序芯片没有 data-group
        document.querySelectorAll('.chip[data-group="' + g + '"]').forEach(function (o) { o.classList.remove('on'); });
        el.classList.add('on');
        state[g] = v;
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
    var btn = document.getElementById('btnDecide');
    if (btn) btn.addEventListener('click', pick);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var v = document.getElementById('verifiedAt');
    if (v) v.textContent = META.verifiedAt || '';
    var b = document.getElementById('metaNote');
    if (b && META.note) b.innerHTML = '⚠️ ' + META.note;
    renderFeeRef();
    renderPlatforms();
    renderStats();
    renderCounts();
    bind();
    render();
  });
})();
