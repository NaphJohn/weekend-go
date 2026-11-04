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
  var CRAVE = META.crave || {};

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
                q: '',          // 「我想吃…」原始输入
                core: '',       // 剥掉「想吃 / 来点」之后的检索核心
                terms: [],      // 由 core 展开出的检索词（含同义词）
                fuzzy: false,   // 是否退到了「滑窗拆词」这一档
                negs: [],       // 明确否定词（不辣 → 辣 / 椒 / 麻…）
              negOnly: false, // 只输了否定词（例如就写「不辣」）—— 不能当成「没搜」
              negFilter: false, // 「只看不辣的店」：没有正词，只按否定词过筛
                ref: null };    // 唯一距离基准（中间点优先，否则单点）
  var distCache = {};

  /* ===== 「我想吃…」：把一句人话变成可检索的词 =====
     设计取舍（为什么不是简单的 indexOf 全文匹配）：
       ① 用户说的是「嘴里想吃的那一口」，常常不是菜系名 → 必须能搜食材、菜名、做法、口语叫法；
       ② 「想吃鱼杂」里的「想吃」是语气，不是内容 → 先剥虚词，否则永远 0 结果；
       ③ 「火锅」这类词在数据里既可能是 sub 也可能是店名 → 字段权重不同，得分要能排序；
       ④ 站内确实没有的东西（鱼杂 / 生煎 / 螺蛳粉）→ **不装作有**，明说没收录 + 给最接近的词。 */

  /** 剥掉句首虚词：「我想吃点螃蟹」→「螃蟹」。循环剥，避免「我想吃点」只剥一层剩「点螃蟹」。 */
  function stripQ(s) {
    var t = String(s || '').trim();
    var list = CRAVE.strip || [];
    var changed = true, guard = 0;
    while (changed && guard++ < 12) {
      changed = false;
      for (var i = 0; i < list.length; i++) {
        var w = list[i];
        if (w && t.indexOf(w) === 0 && t.length > w.length) {
          t = t.slice(w.length).trim();
          changed = true;
        }
      }
    }
    /* 句尾的语气尾巴也去：「火锅吧」「日料呗」「吃鱼吗」 */
    t = t.replace(/(吧|呗|呀|啊|嘛|呢|吗|了|哦|喔|噢|啦)[?？!！。.~～]*$/, '').trim();
    /* 挖掉否定词后会留下空格（「不辣的海鲜」→「 的海鲜」），先把空白收成单个空格，
       否则下面那句「去句首的『的』」会只吃掉空格、把「的」留下 */
    t = t.replace(/\s+/g, ' ').trim();
    /* 句首残留的连接词 / 助词。⚠️ 这里不能写「和」：会切掉「和牛」「和风」—— 只放宽「的」这类纯助词 */
    t = t.replace(/^[的与或了、,，。.\s]+/, '').trim();
    t = t.replace(/^(家|个|份|点)\s+/, '').trim();
    return t;
  }

  /** 单引号里的「不要辣」这类否定优先处理，剩下来的正词再走同义词展开。
   *  ⚠️ 必须把否定短语从查询里 **挖掉**，而不是只记下来：
   *     「不辣的海鲜」若整串去搜，搜不到就会退到滑窗，最后拿「不辣 / 辣的 / 的海」当检索词，
   *     结果既不对、whyHit 也会显示「命中：店名」（因为命中的其实是垃圾碎片）。 */
  function parseNeg(q) {
    var out = [], rest = String(q || '');
    Object.keys(CRAVE.neg || {}).forEach(function (k) {
      if (rest.indexOf(k) >= 0) {
        out = out.concat(CRAVE.neg[k]);
        rest = rest.split(k).join(' ');
      }
    });
    var seen = {};
    out = out.filter(function (t) { if (seen[t]) return false; seen[t] = 1; return true; });
    return { negs: out, rest: rest };
  }

  /** 一个词 → 检索词数组（同义词展开，含自身）。展开只加词、不替换，保证原词也能命中。 */
  function expand(term) {
    var out = [term];
    var S = CRAVE.syn || {};
    if (S[term]) out = out.concat(Array.isArray(S[term]) ? S[term] : [S[term]]);
    /* 反向：用户搜「日本料理」，也应该撞上 syn 里把「日料」映射到它的那些词 */
    Object.keys(S).forEach(function (k) {
      var v = S[k];
      var arr = Array.isArray(v) ? v : [v];
      if (arr.indexOf(term) >= 0 && out.indexOf(k) < 0) out.push(k);
    });
    /* 去重保序 */
    var seen = {};
    return out.filter(function (t) { if (seen[t]) return false; seen[t] = 1; return true; });
  }

  /**
   * 一条店 × 一个检索词 → 得分（0 = 不命中）。
   * 权重按「用户有多可能因为这句话来这家店」排：
   *   店名 6 > 招牌菜 5 > 二级细分 4 > 菜系 3 > 原始品类 3 > 商圈 1
   * ⚠️ reason（上榜理由）**故意不参与**：那是文案，搜「辣」会撞上「火辣开业」这类噪声。
   */
  function termScore(v, t) {
    if (!t) return 0;
    var s = 0;
    if (v.name && v.name.indexOf(t) >= 0) s = Math.max(s, 6);
    if (v.must && v.must.join(' ').indexOf(t) >= 0) s = Math.max(s, 5);
    if (v.sub && v.sub.indexOf(t) >= 0) s = Math.max(s, 4);
    if ((CN[v.cuisine] || '').indexOf(t) >= 0) s = Math.max(s, 3);
    if (v.cat && v.cat.indexOf(t) >= 0) s = Math.max(s, 3);
    if (v.area && v.area.indexOf(t) >= 0) s = Math.max(s, 1);
    return s;
  }

  /** 否定词：只查「店名 / 招牌菜 / 细分 / 原始品类」，不查 reason，避免误杀 */
  function hasNeg(v) {
    if (!state.negs.length) return false;
    var blob = [v.name, (v.must || []).join(' '), v.sub, v.cat].join(' ');
    return state.negs.some(function (n) { return blob.indexOf(n) >= 0; });
  }

  /** 当前搜索的命中分（0 = 不在结果里）。state.terms 为空 = 没在搜。 */
  function qScore(v) {
    /* 「只看不辣的店」：没有正词，只把带否定词的排掉，剩下的全算命中（给 1 分，不参与相关性排序） */
    if (!state.terms.length) return state.negFilter && !hasNeg(v) ? 1 : 0;
    if (hasNeg(v)) return 0;
    var best = 0;
    for (var i = 0; i < state.terms.length; i++) {
      best = Math.max(best, termScore(v, state.terms[i]));
    }
    return best;
  }

  /** 是否「正在按搜索过筛」（含只筛否定的那种） */
  function qActive() {
    return !!(state.terms.length || state.negFilter);
  }

  /** 把输入解析成 state.q / state.terms / state.negs，顺便决定要不要退回「拆词」 */
  function setQuery(raw) {
    var q0 = String(raw == null ? '' : raw).trim();
    state.q = q0;
    state.fuzzy = false;
    state.negFilter = false;

    /* 第一步：把「不辣」这类否定短语挖走，剩下的部分才当检索词。
       「不辣的海鲜」→ negs=[辣,椒,麻,…]，rest=「 的海鲜」→ core=「海鲜」 */
    var neg = parseNeg(q0);
    state.negs = neg.negs;

    var core = stripQ(neg.rest);
    /* 「想吃鱼杂」剥完是「鱼杂」；剥空了（用户只打了「想吃」）= 没在搜 */
    if (!core) {
      state.terms = [];
      state.core = '';
      /* ⚠️ 只输入了「不辣」这种否定词：不能静默当成「没搜」——
         那样会返回全部 142 家，用户会以为「不辣」这个条件被吃掉了。 */
      state.negOnly = state.negs.length > 0;
      return;
    }
    state.negOnly = false;
    state.core = core;

    /* 整句优先：搜「潮汕牛肉火锅」整句能直接中 sub，拆开会过宽。
       整句一个都不中、且词够长时才退到「滑窗两字」——
       例如「水煮鱼」在数据里写作「水煮三峡生态鱼」，整句搜不到，滑到「水煮」就能找到。
       ⚠️ 两字词（鱼杂 / 生煎）不做滑窗：拆成单字全站都能中，等于没搜。
       ⚠️ 滑窗切出来的碎片必须有实际命中才算数，否则「的海」这种也会被塞进检索词。 */
    var base = expand(core);
    if (!DATA.some(function (v) { return qScoreWith(v, base); }) && core.length >= 3) {
      var pieces = [];
      for (var i = 0; i + 2 <= core.length; i++) pieces.push(core.slice(i, i + 2));
      pieces.push(core.slice(0, 2), core.slice(-2));
      var seen = {}, alt = [];
      pieces.forEach(function (p) {
        /* 只留下真能命中的碎片 —— 这一步是「模糊匹配」不变成噪声的关键 */
        if (!DATA.some(function (v) { return termScore(v, p); })) return;
        expand(p).forEach(function (t) { if (!seen[t]) { seen[t] = 1; alt.push(t); } });
      });
      if (alt.length && DATA.some(function (v) { return qScoreWith(v, alt); })) {
        state.terms = alt;
        state.fuzzy = true;
        return;
      }
    }
    state.terms = base;
  }

  /** qScore 的参数化版本：解析阶段还没有写进 state，只能临时传词表 */
  function qScoreWith(v, terms) {
    if (!terms || !terms.length) return 0;
    if (state.negs.length) {
      var blob = [v.name, (v.must || []).join(' '), v.sub, v.cat].join(' ');
      if (state.negs.some(function (n) { return blob.indexOf(n) >= 0; })) return 0;
    }
    var best = 0;
    for (var i = 0; i < terms.length; i++) best = Math.max(best, termScore(v, terms[i]));
    return best;
  }

  /** 搜索命中的家数（不含其它筛选，用来判断「是搜索没结果，还是筛选把它掐掉了」） */
  function hitCount() {
    if (!qActive()) return 0;
    var n = 0;
    for (var i = 0; i < DATA.length; i++) if (qScore(DATA[i])) n++;
    return n;
  }
  /** 搜索 + 其它筛选都算上的家数 */
  function fullCount() {
    var n = 0;
    for (var i = 0; i < DATA.length; i++) if (match(DATA[i])) n++;
    return n;
  }

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

  /**
   * 商圈名 → 地铁站（README 设计的中间层兜底，2026-10-12 补上）：
   * metro 字段没写、但商圈名有明确归属时按这里映射；目标站必须真实存在于 data/metro.js。
   * ⚠️ 只映射「商圈整体归属明确」的名字，不按单店猜站。
   */
  var AREA_STATION = {
    '三林地区': '三林',
    '上南地区': '三林'
  };
  function stationOf(v) {
    if (v.metro && window.WG && window.WG.stations[v.metro]) return v.metro;
    var a = AREA_STATION[v.area];
    if (a && window.WG && window.WG.stations[a]) return a;
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
    /* 「我想吃…」和菜系/人均是**并列**的筛选条件，不是互斥的。
       但二级细分芯片的计数不该被搜索影响（否则芯片上的数字会随打字跳），
       所以搜索放在这里、细分计数靠调用方传 skipQ。 */
    return true;
  }

  function match(v) {
    if (state.sub !== 'all' && v.sub !== state.sub) return false;
    if (qActive() && !qScore(v)) return false;
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
    /* 搜索时「相关性」优先于评分：搜「烤鸭」却把一家只沾边的 4.9 分店排第一，是错的。
       相关性同档再走 byRec —— 两把尺子叠起来，每一步都还能用卡面数字复算。 */
    if (state.terms.length) {
      var sa = qScore(a), sb = qScore(b);
      if (sa !== sb) return sb - sa;
    }
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
    var why = whyHit(v);
    return '<div class="card card-eat" data-id="' + esc(v.id) + '">' +
      '<div class="top"><h3>' + esc(v.name) + '</h3>' + scoreBadge(v) + '</div>' +
      (why ? '<div class="q-why">' + why + '</div>' : '') +
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

  /* ===== 「我想吃…」搜索块 =====
     三种状态必须区分清楚，否则用户会误判成「站点坏了」：
       ① 没在搜 → 只显示快捷词；
       ② 搜到了 → 显示「N 家 · 命中在哪」；
       ③ 没搜到 → 明说「站内没收录」，并给 ①这个词是什么意思 ②往哪搜 ③最接近的可搜词。 */

  /** 这家的命中落在哪个字段上 —— 卡面上直接告诉用户「为什么它会出现在结果里」 */
  function whyHit(v) {
    if (!state.terms.length) return '';
    var hitT = '';
    for (var i = 0; i < state.terms.length; i++) {
      if (termScore(v, state.terms[i])) { hitT = state.terms[i]; break; }
    }
    if (!hitT) return '';
    var parts = [];
    if (v.must && v.must.join(' ').indexOf(hitT) >= 0) {
      /* 只挑出真正含这个词的那几道菜，别把整串 must 都列上 */
      var hitDish = v.must.filter(function (d) { return d.indexOf(hitT) >= 0; });
      parts.push('招牌菜「<b>' + esc(hitDish[0]) + '</b>」');
    }
    if (v.name && v.name.indexOf(hitT) >= 0) parts.push('店名');
    if (v.sub && v.sub.indexOf(hitT) >= 0) parts.push('细分「<b>' + esc(v.sub) + '</b>」');
    if ((CN[v.cuisine] || '').indexOf(hitT) >= 0) parts.push('菜系「' + esc(CN[v.cuisine] || '') + '」');
    if (v.cat && v.cat.indexOf(hitT) >= 0 && !(v.sub && v.sub.indexOf(hitT) >= 0)) parts.push('品类「' + esc(v.cat) + '」');
    if (!parts.length) parts.push('商圈');
    return '🔎 命中：' + parts.join(' · ');
  }

  /** 搜索块的快捷词：只显示站内真有的（家数写在括号里），点一下即搜 */
  function renderSearchHints() {
    var box = document.getElementById('qHints');
    if (!box) return;
    var hints = (CRAVE.hints || []).filter(function (h) {
      return DATA.some(function (v) { return termScore(v, h); });
    });
    box.innerHTML = hints.map(function (h) {
      var n = DATA.filter(function (v) { return termScore(v, h); }).length;
      return '<span class="chip sm" data-q="' + esc(h) + '">' + esc(h) +
        ' <b class="cnt">' + n + '</b></span>';
    }).join('');
  }

  /** 搜索状态行 + 空结果引导 */
  function renderSearchInfo() {
    var box = document.getElementById('qInfo');
    if (!box) return;
    var clr = document.getElementById('btnQClear');

    if (!state.terms.length) {
      if (clr) clr.style.display = (state.negOnly || state.negFilter) ? '' : 'none';
      /* 「只看不辣的店」已生效：没有正词，但搜索结果是真的有 */
      if (state.negFilter) {
        var nNeg = hitCount();
        box.className = 'q-info';
        box.innerHTML = '<span class="q-negs">已排除含「' + esc(state.negs.slice(0, 4).join(' / ')) + '」的店</span>　' +
          '剩下 <b>' + nNeg + '</b> 家' +
          '<div class="q-act"><span class="hint" style="font-size:12.5px">这是按<b>排除条件</b>筛的，没有按「想吃什么」排 —— 想更准就在输入框里再加一个词（例如「不辣的海鲜」）。</span></div>';
        return;
      }
      if (state.negOnly) {
        /* 只写了「不辣」：必须说清它只能当附加条件用，否则用户以为被忽略了 */
        box.className = 'q-info q-miss';
        box.innerHTML = '<div class="qm-h">🤔 「' + esc(state.q) + '」是个<b>排除条件</b>，还没说要吃什么。</div>' +
          '<div class="qm-row"><span class="qm-k">怎么用</span><span class="qm-v">加一个想吃的词就行：' +
            ['不辣的海鲜', '不辣的牛肉', '不辣的面'].map(function (t) {
              return '<span class="chip sm" data-q="' + esc(t) + '">' + esc(t) + '</span>';
            }).join(' ') + '</span></div>' +
          '<div class="qm-row"><span class="qm-k">单用</span><span class="qm-v">如果只想看「全都不辣」的店，点下面这个 —— 会排掉店名 / 招牌菜里带「' +
            esc(state.negs.slice(0, 4).join(' / ')) + '」的。</span></div>' +
          '<div class="q-act"><span class="chip sm" data-negonly="1">只看不辣的店</span></div>';
        return;
      }
      box.className = 'q-info';
      box.innerHTML = '👆 点一个上面有数的词，或直接搜。<b>也能整句搜</b>：「想吃蟹粉小笼」「两个人不辣的海鲜」都能听懂 —— 会自动去掉「想吃」这类语气词。';
      return;
    }
    if (clr) clr.style.display = '';

    var nHit = hitCount(), nFull = fullCount();
    if (!nHit) {
      /* ③ 一个都没搜到 —— 允许「一词都没有」，但必须给出口，不能只留一片空白 */
      box.className = 'q-info q-miss';
      var item = (CRAVE.items || []).filter(function (r) {
        return r.q === state.core || (state.core.indexOf(r.q) >= 0);
      })[0];
      var tryList = item && item.try ? item.try : [];
      var suggestions = (CRAVE.items || []).filter(function (r) {
        return r.q !== state.core && tryList.indexOf(r.q) < 0 &&
          DATA.some(function (v) { return termScore(v, r.q); });
      }).slice(0, 5).map(function (r) { return r.q; });

      var html = '<div class="qm-h">😕 「<b>' + esc(state.core) + '</b>」这个说法，站内一家都没搜到。</div>';
      if (item) {
        html += '<div class="qm-row"><span class="qm-k">这是什么</span><span class="qm-v">' + esc(item.what) + '</span></div>';
        html += '<div class="qm-row"><span class="qm-k">为什么没有</span><span class="qm-v">' + esc(item.note) + '</span></div>';
      } else {
        html += '<div class="qm-row"><span class="qm-k">为什么没有</span><span class="qm-v">本站只收录大众点评「必吃榜」上的 142 家店，' +
          '榜单之外的品类（鱼杂、生煎、螺蛳粉、汉堡这类）本身就不在池子里 —— 不是上海没有，是这家榜单没上。</span></div>';
      }
      if (tryList.length) {
        html += '<div class="qm-row"><span class="qm-k">要不要试</span><span class="qm-v qm-try">' +
          tryList.map(function (t) { return '<span class="chip sm" data-q="' + esc(t) + '">' + esc(t) + '</span>'; }).join('') +
          '</span></div>';
      }
      if (suggestions.length) {
        html += '<div class="qm-row"><span class="qm-k">或者搜</span><span class="qm-v qm-try">' +
          suggestions.map(function (t) { return '<span class="chip sm" data-q="' + esc(t) + '">' + esc(t) + '</span>'; }).join('') +
          '</span></div>';
      }
      box.innerHTML = html;
      return;
    }

    /* ② 搜到了。但要分清「搜索有结果，是筛选把它掐没了」—— 这两种空列表的原因完全不同 */
    box.className = 'q-info';
    var parts = ['🔎 「<b>' + esc(state.core) + '</b>」'];
    parts.push('<b>' + nHit + '</b> 家沾边');
    if (state.fuzzy) parts.push('<span class="q-fuzzy" title="整句没命中，用拆出来的词搜索的">模糊匹配：' + esc(state.terms.slice(0, 3).join(' / ')) + '</span>');
    if (state.negs.length) parts.push('<span class="q-negs">已排除含「' + esc(state.negs.slice(0, 4).join(' / ')) + '」的店</span>');
    if (nFull < nHit && nFull > 0) {
      parts.push('<span class="q-narrow">叠上菜系 / 人均 / 上榜后剩 <b>' + nFull + '</b> 家</span>');
    } else if (nFull === 0 && nHit > 0) {
      /* 「搜火锅 × 选粤菜 = 0 家」不是 bug，是两个条件本来就不相交 —— 必须点破，别让用户以为搜坏了 */
      parts.push('<span class="q-narrow">叠上菜系 / 人均 / 上榜后是 <b>0</b> 家 —— 两个条件完全不相交</span>');
    }
    box.innerHTML = parts.join('　');

    /* 不相交 / 只剩零星几家时，必须有「一键松绑」的出口，否则用户只会觉得坏了 */
    if (nFull === 0 && nHit > 0) {
      var fix = [];
      if (state.cuisine !== 'all') fix.push('cuisine');
      if (state.sub !== 'all') fix.push('sub');
      if (state.price !== 'all') fix.push('price');
      if (state.rank !== 'all') fix.push('rank');
      box.innerHTML += '<div class="q-act">' +
        (fix.length ? '<span class="chip sm" id="qRelax" data-relax="' + fix.join(',') + '">↺ 放宽筛选，看这 ' + nHit + ' 家</span>' : '') +
        '<span class="chip sm" data-qclear="1">✕ 取消搜索</span>' +
        '</div>';
    } else if (nHit && nHit <= 2) {
      /* 只有 1–2 家时，「就这几家」要主动说，否则看着像漏了数据 */
      box.innerHTML += '<div class="q-act"><span class="hint" style="font-size:12.5px">这一类站内只收录到 <b>' + nHit + '</b> 家（榜单整体就这么多），不是我筛掉了。</span></div>';
    }

    /* 「鱼」这类超宽词：命中太多时提醒怎么收窄，并给同义词入口 */
    var item2 = (CRAVE.items || []).filter(function (r) { return r.q === state.core; })[0];
    if (item2) {
      box.innerHTML += '<div class="q-tip"><b>这个词能搜到好几路东西：</b>' + esc(item2.what) +
        (item2.note ? '　' + esc(item2.note) : '') +
        (item2.try ? '<div class="qm-try" style="margin-top:6px">收窄试试：' +
          item2.try.map(function (t) { return '<span class="chip sm" data-q="' + esc(t) + '">' + esc(t) + '</span>'; }).join('') +
          '</div>' : '') +
        '</div>';
    }
  }

  /* ===== 「最值得去」推荐框 =====
     ⚠️ 跟随当前范围（含「我想吃…」搜索）：搜了「烤鸭」，这里给的就是「烤鸭里最值得去的 3 家」。
        但排序尺子仍是 byRec（评分 → 连续上榜 → 收录年数），**不是**搜索相关性 ——
        相关性只作用于下面的网格（sortFn）。两个框的分工：上面选「最好的」，下面看「最像的」。 */
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
      var base = state.cuisine === 'all'
        ? '全部菜系'
        : (CN[state.cuisine] || '') + (state.sub !== 'all' ? ' · ' + state.sub : '');
      /* 搜了词就把词一起写进来，否则用户会以为上面这 3 家是「全城最好」而不是「烤鸭里最好」 */
      scope.textContent = qActive()
        ? '「' + state.core + '」' + (state.cuisine === 'all' && state.sub === 'all' ? '' : ' · ' + base)
        : base;
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
    if (list.length) {
      grid.innerHTML = list.map(cardHTML).join('');
    } else if (qActive()) {
      /* 搜索参与了筛选却没结果：这句话和「普通筛选没结果」不是一回事，别让用户以为站挂了 */
      var nHit = hitCount();
      grid.innerHTML = nHit
        ? '<div class="empty">「' + esc(state.core) + '」搜到 <b>' + nHit + '</b> 家，但<b>被上面的菜系 / 人均 / 上榜筛选掐掉了</b> —— 把那些条件放宽就能看见。</div>'
        : '<div class="empty">「' + esc(state.core) + '」站内一家都没收录。<b>看上面那一栏</b>：那里写了这个词指的是什么、以及最接近能搜什么。</div>';
    } else {
      grid.innerHTML = '<div class="empty">这个组合下没有收录的店 —— 把人均或「连续上榜」放宽一点试试。</div>';
    }
    var c = document.getElementById('count');
    if (c) c.textContent = list.length;
    renderSearchInfo();
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
  /* ===== 「14 个菜系是怎么划的」 =====
     ⚠️ 家数一律实时从 DATA 算，绝不写死 —— 换榜单时页面上不会出现对不上的旧数字。 */
  function renderCuisineWhy() {
    var W = META.cuisineWhy;
    if (!W) return;
    function count(k) {
      var n = 0;
      for (var i = 0; i < DATA.length; i++) if (DATA[i].cuisine === k) n++;
      return n;
    }
    var intro = document.getElementById('cwIntro');
    if (intro) intro.innerHTML = md(W.intro);
    var ax = document.getElementById('cwAxes');
    if (ax) {
      ax.innerHTML = (W.axes || []).map(function (a) {
        return '<div class="scene-card"><b>' + md(a.k) + '</b><br>' +
          '<span style="color:var(--blue)">' + md(a.ex) + '</span><br>' +
          '<span style="color:var(--sub)">' + md(a.d) + '</span></div>';
      }).join('');
    }
    var ft = document.getElementById('cwFacts');
    if (ft) {
      ft.innerHTML = (W.facts || []).map(function (f) {
        return '<div class="cw-row"><span class="cw-k">' + md(f.k) + '</span>' +
          '<span class="cw-d">' + md(f.d) + '</span></div>';
      }).join('');
    }
    var it = document.getElementById('cwItems');
    if (it) {
      it.innerHTML = (W.items || []).map(function (r) {
        return '<div class="cw-row cw-item" data-cui="' + esc(r.k) + '">' +
          '<span class="cw-k"><b>' + esc(r.name) + '</b>　<span class="cw-n">' + count(r.k) + ' 家</span><br>' +
          '<span class="cw-from">' + esc(r.from) + '</span></span>' +
          '<span class="cw-d">' + md(r.why) + '</span></div>';
      }).join('');
    }
    var w = document.getElementById('cwWatch');
    if (w) w.innerHTML = (W.watch || []).map(function (t) { return '<li>' + md(t) + '</li>'; }).join('');
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
    renderCuisineWhy();
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

    /* ===== 「我想吃…」搜索：输入框 + 快捷词 + 结果里的可搜词 =====
       输入即搜（300ms 内不防抖，因为本地过滤本来就是毫秒级；但中文输入法组字期间不打断） */
    var qi = document.getElementById('qInput');
    var composing = false;
    function applyQ(raw, scroll) {
      setQuery(raw);
      var pr = document.getElementById('pickResult'); if (pr) pr.style.display = 'none';
      render();
      if (scroll && qActive()) {
        var g = document.getElementById('grid');
        if (g && g.scrollIntoView) g.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    if (qi) {
      qi.addEventListener('compositionstart', function () { composing = true; });
      qi.addEventListener('compositionend', function () { composing = false; applyQ(qi.value, false); });
      qi.addEventListener('input', function () { if (!composing) applyQ(qi.value, false); });
      qi.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); applyQ(qi.value, true); }
        else if (e.key === 'Escape') { qi.value = ''; applyQ('', false); qi.blur(); }
      });
    }
    var bq = document.getElementById('btnQ');
    if (bq) bq.addEventListener('click', function () { if (qi) applyQ(qi.value, true); });
    var bqc = document.getElementById('btnQClear');
    if (bqc) bqc.addEventListener('click', function () { if (qi) qi.value = ''; applyQ('', false); });

    /* 快捷词 / 「要不要试」/ 「或者搜」里的词：全部走 [data-q] 委托（这些块是重渲染的） */
    ['qHints', 'qInfo'].forEach(function (id) {
      var box = document.getElementById(id);
      if (!box) return;
      box.addEventListener('click', function (ev) {
        var tgt = ev.target;
        /* ① 一键放宽：把参与筛选的芯片全部点回 all（点真芯片，保证芯片高亮同步） */
        var rl = tgt.closest ? tgt.closest('[data-relax]') : null;
        if (rl) {
          String(rl.getAttribute('data-relax') || '').split(',').forEach(function (g) {
            if (!g) return;
            var chip = document.querySelector('.chip[data-group="' + g + '"][data-val="all"]');
            if (chip) chip.click();
          });
          return;
        }
        /* ② 取消搜索 */
        if (tgt.closest && tgt.closest('[data-qclear]')) {
          if (qi) qi.value = '';
          applyQ('', false);
          return;
        }
        /* ②b 只按否定词过筛（用户只写了「不辣」） */
        if (tgt.closest && tgt.closest('[data-negonly]')) {
          state.negFilter = true;
          state.negOnly = false;
          var pr2 = document.getElementById('pickResult'); if (pr2) pr2.style.display = 'none';
          render();
          return;
        }
        /* ③ 可搜词 */
        var el = tgt.closest ? tgt.closest('[data-q]') : null;
        if (!el) return;
        var t = el.getAttribute('data-q');
        if (qi) qi.value = t;
        applyQ(t, true);
      });
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
    /* 「14 类怎么划的」里的每一行也可点：点了直接筛出这一类 */
    var cwi = document.getElementById('cwItems');
    if (cwi) cwi.addEventListener('click', function (ev) {
      var el = ev.target.closest ? ev.target.closest('.cw-item') : null;
      if (!el) return;
      var c = el.getAttribute('data-cui');
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
    renderSearchHints();
    renderSubChips();
    bindFilters();
    bindLoc();
    render();
  });
})();
