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

  /* ===== 「说说 TA 的情况」问答式推荐（2026-10-22 加） ===== */
  var ADVICE = window.GIFT_ADVICE || [];
  var BY_ID = {};
  DATA.forEach(function (g) { BY_ID[g.id] = g; });
  var GENDER_WORDS = [
    { re: /女生|女孩|女票|女朋友|女友|她|妹子|姑娘|老婆|女方|女士/i, v:'women' },
    { re: /男生|男孩|男朋友|男友|他|汉子|老公|男方|先生/i, v:'men' }
  ];
  var STAGE_WORDS = [
    { re: /暧昧|刚认识|刚接触|还没在一起|追求|暗恋|初期/, v:'crush' },
    { re: /结婚|已婚|老夫老妻|多年|长期/ , v:'longterm' }
  ];
  var PRICE_WORDS = [
    { re: /便宜|不贵|小几十|一百以内|100以内|百元内|低成本/, v:'p1' },
    { re: /预算\s*(1|2|3)\s*百|小几百|两三百|一百多/, v:'p2' }
  ];

  function parseAsk(txt) {
    var r = { gender:null, stage:null, priceTier:null };
    GENDER_WORDS.forEach(function (w) { if (w.re.test(txt) && !r.gender) r.gender = w.v; });
    STAGE_WORDS.forEach(function (w) { if (w.re.test(txt) && !r.stage) r.stage = w.v; });
    PRICE_WORDS.forEach(function (w) { if (w.re.test(txt) && !r.priceTier) r.priceTier = PRICE_TIER[w.v]; });
    return r;
  }

  /** 从礼物对象收集可匹配的文本：pains + tags + name + reason */
  function giftHay(g) {
    if (g.__hay) return g.__hay;
    var h = [ g.name || '', g.reason || '', g.tip || '' ]
      .concat(g.pains || []).concat(g.tags || []).join('｜');
    g.__hay = h;
    return h;
  }

  /** 原始 id 序列 → 过滤（性别/阶段约束）→ 去重 → 前 4 */
  function constrain(ids, ctx) {
    var out = [];
    (ids || []).forEach(function (id) {
      var g = BY_ID[id];
      if (!g || out.indexOf(g) >= 0) return;
      if (ctx.gender && g.for !== 'both' && g.for !== ctx.gender) return;
      if (ctx.stage === 'crush' && /贴身|分寸感|要熟|阶段/.test((g.tags || []).join('') + (g.tip || ''))) return;
      out.push(g);
    });
    return out.slice(0, 4);
  }

  function askAdvice() {
    var input = document.getElementById('askInput');
    var box = document.getElementById('askResult');
    if (!input || !box) return;
    var txt = (input.value || '').trim();
    if (!txt) { box.style.display = 'block'; box.innerHTML = '<div class="ask-empty">先说说 TA 的情况：比如「女生，最近天天加班，有黑眼圈」「男朋友健身」——对象、状况、预算，随口说就行。</div>'; return; }
    if (txt.length < 2) { box.style.display = 'block'; box.innerHTML = '<div class="ask-empty">再多写几个字吧——至少说说对象（女生 / 男生）和状况。</div>'; return; }

    var ctx = parseAsk(txt);

    /* 1) 痛点组命中 */
    var hitGroups = ADVICE.filter(function (grp) {
      return grp.keys.some(function (k) { return txt.indexOf(k) >= 0; });
    });
    var picked = [], seen = {};
    hitGroups.forEach(function (grp) {
      constrain(grp.picks, ctx).forEach(function (g) {
        if (!seen[g.id]) { seen[g.id] = 1; picked.push({ g:g, from:grp }); }
      });
    });

    /* 2) 无命中：giftHay 关键词兜底（取输入里 ≥2 字的片段） */
    var fallbackUsed = false;
    if (!picked.length) {
      var grams = [];
      for (var n = 4; n >= 2; n--) {
        for (var i = 0; i + n <= txt.length; i++) grams.push(txt.substr(i, n));
      }
      var scored = [];
      DATA.forEach(function (g) {
        var hay = giftHay(g), s = 0;
        grams.forEach(function (gm) { if (hay.indexOf(gm) >= 0) s += gm.length; });
        if (s > 0) scored.push({ g:g, s:s });
      });
      if (scored.length) {
        scored.sort(function (a, b) { return b.s - a.s; });
        scored.slice(0, 4).forEach(function (x) {
          var g = constrain([x.g.id], ctx)[0] || (ctx.gender && x.g.for !== 'both' && x.g.for !== ctx.gender ? null : x.g);
          if (g && !seen[g.id]) { seen[g.id] = 1; picked.push({ g:g, from:null }); }
        });
        fallbackUsed = picked.length > 0;
      }
    }

    /* 3) 渲染 */
    box.style.display = 'block';
    var html = '';
    if (hitGroups.length) {
      html += '<div class="ask-groups">' + hitGroups.map(function (grp) {
        return '<span class="ask-grp-tag">' + esc(grp.title) + '</span>';
      }).join('') + '</div>';
    }
    if (picked.length) {
      html += '<div class="ask-cards">' + picked.map(function (p) {
        var g = p.g;
        var confBadge = isSafe(g) ? '<span class="badge b-safe">🟢 安全牌</span>' : '<span class="badge b-risk">🟡 较看人</span>';
        var exp = isExp(g) ? ' <span class="badge b-run">⭐ 体验类</span>' : '';
        return '<div class="ask-card">' +
          '<div class="ak-top"><b>' + g.name + '</b>' + confBadge + exp +
            '　<span class="ak-price">' + esc(g.priceText || '') + '</span></div>' +
          '<div class="ak-reason">💡 ' + g.reason + '</div>' +
          '<div class="ak-tip">🎁 ' + g.tip + '</div>' +
          (p.from ? '<div class="ak-from">对症：' + esc(p.from.title) + '——' + p.from.say + '</div>' : '') +
          '</div>';
      }).join('') + '</div>';
      /* 避雷提醒：只取第一个命中组的 */
      if (hitGroups.length && hitGroups[0].avoid) {
        html += '<div class="ask-avoid">' + hitGroups[0].avoid + '</div>';
      }
      if (fallbackUsed) {
        html += '<div class="ask-note">以上是按你说的关键词从清单里挑的——没直接命中「状况库」，想更对症可以说说 TA 具体哪里不舒服（失眠 / 脖子酸 / 手脚冰凉…）。</div>';
      }
      if (ctx.stage === 'crush') {
        html += '<div class="ask-note">⚠️ 你提到「还在暧昧 / 刚接触」：已自动过滤贴身类和高分寸感礼物，预算建议压在 ¥300 内，分寸感永远比惊喜重要。</div>';
      }
    } else {
      html = '<div class="ask-empty">这段没认出具体状况。可以换成「黑眼圈」「失眠」「久坐脖子酸」「生理期」「健身」「压力大」这类说法，或直接用下面的筛选 chips 挑。</div>';
    }
    box.innerHTML = html;
    if (box.scrollIntoView) box.scrollIntoView({ behavior:'smooth', block:'nearest' });
  }

  function bindAsk() {
    var btn = document.getElementById('btnAsk');
    var input = document.getElementById('askInput');
    if (btn) btn.addEventListener('click', askAdvice);
    if (input) input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.keyCode === 13) askAdvice();
    });
    document.querySelectorAll('.chip[data-example]').forEach(function (el) {
      el.addEventListener('click', function () {
        if (input) input.value = el.getAttribute('data-example') || '';
        askAdvice();
      });
    });
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
    bindAsk();
    render();
  });
})();
