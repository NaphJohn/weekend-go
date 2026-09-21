(function () {
  'use strict';

  var DATA = window.SCRIPTS || [];
  var META = window.SCRIPTS_META || {};

  var GENRE_TEXT = {
    hard: '硬核推理', bian: '变格科幻', horror: '恐怖惊悚',
    emo: '情感沉浸', fun: '机制欢乐', guofeng: '古风家国', newbie: '新手友好'
  };
  var DIFF_TEXT = { 1: '轻松', 2: '新手友好', 3: '进阶', 4: '硬核', 5: '地狱难度' };
  var DIFF_CLS = { 1: 'b-d1', 2: 'b-d1', 3: 'b-d2', 4: 'b-d3', 5: 'b-d4' };

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
  function isNewbie(s) { return s.diff <= 2 || s.genre === 'newbie'; }

  var state = { genre: 'all', diff: 'all', people: 'all', time: 'all', cat: 'all', sort: 'rec' };

  function match(s) {
    if (state.genre !== 'all' && s.genre !== state.genre) return false;
    if (state.cat !== 'all' && s.cat !== state.cat) return false;
    if (state.diff !== 'all') {
      var d = s.diff || 0;
      if (state.diff === 'd1' && d > 2) return false;
      if (state.diff === 'd2' && d !== 3) return false;
      if (state.diff === 'd3' && d !== 4) return false;
      if (state.diff === 'd4' && d !== 5) return false;
    }
    if (state.people !== 'all') {
      var mn = s.pmin == null ? 6 : s.pmin, mx = s.pmax == null ? 6 : s.pmax;
      if (state.people === 'small' && mn > 5) return false;
      if (state.people === 'mid' && !(mn <= 6 && mx >= 6)) return false;
      if (state.people === 'big' && mx < 7) return false;
    }
    if (state.time !== 'all') {
      var t1 = s.dmin == null ? 5 : s.dmin, t2 = s.dmax == null ? 5 : s.dmax;
      if (state.time === 'short' && t2 > 4.5) return false;
      if (state.time === 'mid' && !(t1 >= 4 && t2 <= 5.5)) return false;
      if (state.time === 'long' && t1 < 5) return false;
    }
    return true;
  }

  function sortFn(a, b) {
    if (state.sort === 'diff-asc') return (a.diff - b.diff) || a.name.localeCompare(b.name);
    if (state.sort === 'diff-desc') return (b.diff - a.diff) || a.name.localeCompare(b.name);
    if (state.sort === 'time-asc') {
      return ((a.dmax || 5) - (b.dmax || 5)) || (a.diff - b.diff) || a.name.localeCompare(b.name);
    }
    // 推荐排序：经典本优先 → 难度高的在前（硬核榜常客）→ 名字
    var ca = a.cat === 'classic' ? 0 : 1, cb = b.cat === 'classic' ? 0 : 1;
    return (ca - cb) || (b.diff - a.diff) || a.name.localeCompare(b.name);
  }

  function pillHTML(s) {
    return '<span class="pill-type">' + (GENRE_TEXT[s.genre] || '') + '</span>' +
      (s.cat === 'new' ? ' <span class="pill-type pill-new">2026 新本</span>' : '');
  }

  /** 「上车前要知道」——沿用看展科普那套紫块样式 */
  function guideHTML(s) {
    var rows = '';
    if (s.highlight) rows += '<div class="g-sec">🎬 这本是什么</div><p class="g-intro">' + s.highlight + '</p>';
    if (s.forWho) rows += '<div class="g-sec">👀 适合谁打</div><p class="g-aud">' + s.forWho + '</p>';
    if (s.note) rows += '<div class="g-sec">⚠️ 上车前要知道</div><p class="g-aud">' + s.note + '</p>';
    if (!rows) return '';
    return '<details class="guide"><summary>📚 上车前科普 · 是什么 / 适合谁 / 注意什么</summary>' +
      '<div class="guide-body">' + rows + '</div></details>';
  }

  function cardHTML(s) {
    var cls = DIFF_CLS[s.diff] || 'b-d2';
    var txt = DIFF_TEXT[s.diff] || '进阶';
    var genres = (s.genres || []).map(function (g) { return '<span class="tag">' + g + '</span>'; }).join('');
    var tags = (s.tags || []).map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('');
    var bits = [];
    if (s.year) bits.push(s.year + (s.cat === 'new' ? ' 发行' : ''));
    if (s.publisher) bits.push(s.publisher);
    if (s.mode) bits.push(s.mode);
    if (s.conf === 'mid') bits.push('🟡 榜单口径');
    var sub = bits.length ? '　·　' + bits.join('　·　') : '';

    return '<div class="card card-script" data-id="' + esc(s.id) + '">' +
      '<div class="top"><h3>' + s.name + '</h3>' +
        '<span class="badge ' + cls + '">' + txt + '</span></div>' +
      '<div class="meta-line">' + pillHTML(s) + '　<b>' + s.players + '</b>' +
        '　<span style="color:var(--sub)">⏱ ' + s.duration + '</span></div>' +
      '<div class="meta-line">难度 ' + stars(s.diff) + '<span style="color:var(--sub)">' + sub + '</span></div>' +
      '<div class="tags">' + genres + '</div>' +
      guideHTML(s) +
      (tags ? '<div class="tags" style="border-top:1px dashed var(--line);padding-top:8px">' + tags + '</div>' : '') +
      '</div>';
  }

  function render() {
    var list = DATA.filter(match).sort(sortFn);
    document.getElementById('grid').innerHTML = list.length
      ? list.map(cardHTML).join('')
      : '<div class="empty">没有符合条件的本子，把筛选放宽一点试试。</div>';
    document.getElementById('count').textContent = list.length;
    if (window.Annotate) window.Annotate.apply();
  }

  function renderStats() {
    document.getElementById('s-total').textContent = DATA.length;
    document.getElementById('s-classic').textContent = DATA.filter(function (s) { return s.cat === 'classic'; }).length;
    document.getElementById('s-new').textContent = DATA.filter(function (s) { return s.cat === 'new'; }).length;
    document.getElementById('s-newbie').textContent = DATA.filter(isNewbie).length;
  }

  /** 芯片上的数量：按「忽略本组筛选」的剩余集合算，跟首页一致的手感 */
  function renderCounts() {
    var groups = {
      genre: { all: DATA, hard: [], bian: [], horror: [], emo: [], fun: [], guofeng: [], newbie: [] },
      diff: { all: DATA, d1: [], d2: [], d3: [], d4: [] },
      people: { all: DATA, small: [], mid: [], big: [] },
      time: { all: DATA, short: [], mid: [], long: [] },
      cat: { all: DATA, classic: [], new: [] }
    };
    DATA.forEach(function (s) {
      if (groups.genre[s.genre]) groups.genre[s.genre].push(s);
      var d = s.diff || 0;
      if (d <= 2) groups.diff.d1.push(s); else if (d === 3) groups.diff.d2.push(s);
      else if (d === 4) groups.diff.d3.push(s); else groups.diff.d4.push(s);
      var mn = s.pmin == null ? 6 : s.pmin, mx = s.pmax == null ? 6 : s.pmax;
      if (mn <= 5) groups.people.small.push(s);
      if (mn <= 6 && mx >= 6) groups.people.mid.push(s);
      if (mx >= 7) groups.people.big.push(s);
      var t1 = s.dmin == null ? 5 : s.dmin, t2 = s.dmax == null ? 5 : s.dmax;
      if (t2 <= 4.5) groups.time.short.push(s);
      if (t1 >= 4 && t2 <= 5.5) groups.time.mid.push(s);
      if (t1 >= 5) groups.time.long.push(s);
      if (s.cat === 'classic') groups.cat.classic.push(s); else groups.cat.new.push(s);
    });
    document.querySelectorAll('[data-cnt]').forEach(function (el) {
      var key = el.getAttribute('data-cnt');        // 形如 "genre:hard"
      var p = key.split(':');
      var g = groups[p[0]];
      if (!g) return;
      el.textContent = (g[p[1]] || []).length;
    });
  }

  function pick() {
    var pool = DATA.filter(match);
    if (!pool.length) { alert('当前筛选下没有可推荐的本子，放宽条件试试。'); return; }
    var weighted = [];
    pool.forEach(function (s) {
      var w = 2;
      if (s.cat === 'classic') w += 3;            // 经典本优先
      if (s.conf === 'high') w += 1;              // 口径可靠的优先
      if (isNewbie(s)) w += 1;                    // 新手本更容易成局
      for (var i = 0; i < w; i++) weighted.push(s);
    });
    var s = weighted[Math.floor(Math.random() * weighted.length)];
    var why = [];
    if (s.cat === 'classic') why.push('经典本，口碑经得起时间考验');
    else why.push('2026 新本，想吃新鲜的可以试');
    if (s.diff >= 4) why.push('硬核档，脑力消费者优先');
    else if (s.diff <= 2) why.push('难度友好，适合第一次玩或带新人');
    if ((s.players || '').indexOf('6') > -1) why.push('6 人本最好凑局');
    if (s.mode === '盒装') why.push('盒装本人均门槛较低');
    if (s.conf === 'mid') why.push('⚠️ 这本是榜单口径，先跟店家核对本单');
    var box = document.getElementById('pickResult');
    box.style.display = 'block';
    box.innerHTML = '<div class="pick-card">' +
      '<div class="pk-name">' + s.name +
        '<span class="badge ' + (DIFF_CLS[s.diff] || 'b-d2') + '" style="margin-left:6px">' + (DIFF_TEXT[s.diff] || '') + '</span></div>' +
      '<div class="pk-line">' + (GENRE_TEXT[s.genre] || '') + '　·　' + (s.genres || []).join(' / ') + '</div>' +
      '<div class="pk-line">' + s.players + '　·　' + s.duration + '　·　难度 ' + s.diff + '/5' +
        (s.mode ? '　·　' + s.mode : '') + '</div>' +
      '<div class="pk-line">' + (s.highlight || '') + '</div>' +
      (why.length ? '<div class="pk-why"><b>为什么是它：</b>' + why.join('；') + '。</div>' : '') +
      '</div>';
    if (box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderPriceRef() {
    var box = document.getElementById('priceRef');
    if (!box || !META.priceRef) return;
    box.innerHTML = META.priceRef.map(function (r) {
      return '<div class="scene-card"><b>' + r.k + '</b>　<span style="color:var(--amber);font-weight:700">' +
        r.v + '</span><br><span style="color:var(--sub)">' + r.d + '</span></div>';
    }).join('');
  }

  function bind() {
    document.querySelectorAll('.chip[data-group]').forEach(function (el) {
      el.addEventListener('click', function () {
        var g = el.getAttribute('data-group');
        var v = el.getAttribute('data-val');
        if (!g || g === 'sort') return;   // 排序单独处理
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
    document.getElementById('btnDecide').addEventListener('click', pick);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var v = document.getElementById('verifiedAt');
    if (v) v.textContent = META.verifiedAt || '';
    var b = document.getElementById('metaNote');
    if (b && META.note) b.innerHTML = '⚠️ ' + META.note;
    renderPriceRef();
    renderStats();
    renderCounts();
    bind();
    render();
  });
})();
