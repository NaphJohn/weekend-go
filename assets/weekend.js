/* 本周推荐渲染层（2026-11-12 建）
 * 目标：#weekBox（index.html 顶部 .week-panel 内）、#weekRange、#s-weekend、#hk-weekend
 * 数据：data/weekend.js → window.WEEKEND / window.WEEKEND_META
 * 原则：过期条目自动隐藏（end < 今天），全过期则整块显提示 —— 不静默留假数据。
 */
(function () {
  'use strict';

  var DATA = (window.WEEKEND || []).slice();
  var META = window.WEEKEND_META || {};
  var CAT = {
    exhibition: { t: '展览', cls: 'wc-ex', ico: '🖼️' },
    show:       { t: '演出', cls: 'wc-sh', ico: '🎭' },
    market:     { t: '市集', cls: 'wc-mk', ico: '🎪' },
    pet:        { t: '亲子 · 宠物', cls: 'wc-pt', ico: '🐕' }
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function today() {
    var t = new Date(); t.setHours(0, 0, 0, 0); return t;
  }
  function parseD(s) {
    if (!s) return null;
    var p = String(s).split('-');
    if (p.length !== 3) return null;
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  /* 距结束还有几天：负数 = 已结束 */
  function daysLeft(end) {
    var d = parseD(end);
    if (!d) return 9999;
    return Math.round((d - today()) / 86400000);
  }
  function fmtDate(s) {
    var d = parseD(s);
    if (!d) return '';
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }
  function weekdayOf(s) {
    var d = parseD(s);
    if (!d) return '';
    return '日一二三四五六'.charAt(d.getDay()) === '日' ? '周日' : '周' + '日一二三四五六'.charAt(d.getDay());
  }

  /* ---------- 状态徽章 ---------- */
  function stateBadge(it) {
    var dl = daysLeft(it.end);
    if (dl < 0) return { txt: '已结束', cls: 'wn-end' };
    if (it.start && daysLeft(it.start) > 0) {
      return { txt: daysLeft(it.start) + ' 天后开始', cls: 'wn-soon' };
    }
    if (dl === 0) return { txt: '今天是最后一天', cls: 'wn-hot' };
    if (dl <= 2) return { txt: '还剩 ' + dl + ' 天', cls: 'wn-hot' };
    return { txt: '进行中', cls: 'wn-run' };
  }

  /* ---------- 主推大卡 ---------- */
  function cardHTML(it, idx) {
    var c = CAT[it.cat] || { t: '活动', cls: '', ico: '📌' };
    var b = stateBadge(it);
    var h = '';
    h += '<div class="wk-card ' + c.cls + '">';
    h += '<div class="wk-hd">';
    h += '<span class="wk-idx">' + (idx + 1) + '</span>';
    h += '<span class="wk-cat">' + c.ico + ' ' + esc(c.t) + '</span>';
    h += '<span class="wk-badge ' + b.cls + '">' + esc(b.txt) + '</span>';
    if (it.free) h += '<span class="wk-free">免费</span>';
    if (it.needBooking) h += '<span class="wk-book">要预约</span>';
    h += '<div class="wk-name">' + esc(it.name) + '</div>';
    h += '<div class="wk-date">' + esc(it.dateText) + '</div>';
    h += '</div>';

    h += '<div class="wk-rows">';
    if (it.sessions) {
      h += '<div class="wk-r"><span class="wk-k">时间</span><span class="wk-v">' + esc(it.sessions) + '</span></div>';
    }
    h += '<div class="wk-r"><span class="wk-k">地点</span><span class="wk-v"><b>' + esc(it.place) + '</b>'
      + (it.addr ? '<br><span class="wk-addr">' + esc(it.addr) + '</span>' : '')
      + (it.metro && it.metro !== '—' ? '<span class="wk-metro">🚇 ' + esc(it.metro) + '</span>' : '')
      + '</span></div>';
    if (it.why) {
      h += '<div class="wk-r"><span class="wk-k">亮点</span><span class="wk-v">' + esc(it.why) + '</span></div>';
    }
    if (it.book) {
      h += '<div class="wk-r"><span class="wk-k">预约</span><span class="wk-v">' + esc(it.book) + '</span></div>';
    }
    if (it.tip) {
      h += '<div class="wk-r wk-r-tip"><span class="wk-k">提醒</span><span class="wk-v">' + esc(it.tip) + '</span></div>';
    }
    if (it.src && it.src.length) {
      var links = it.src.map(function (s) {
        return '<a class="wk-src" href="' + esc(s.u) + '" target="_blank" rel="noopener">' + esc(s.t) + ' ↗</a>';
      }).join('');
      h += '<div class="wk-r"><span class="wk-k">来源</span><span class="wk-v wk-srcs">' + links + '</span></div>';
    }
    h += '</div></div>';
    return h;
  }

  /* ---------- 顺路可加小行 ---------- */
  function subHTML(it) {
    var c = CAT[it.cat] || { t: '活动', ico: '📌' };
    var b = stateBadge(it);
    var h = '<div class="wk-sub">';
    h += '<div class="wk-sub-hd">';
    h += '<span class="wk-sub-name">' + esc(it.name) + '</span>';
    h += '<span class="wk-badge ' + b.cls + '">' + esc(b.txt) + '</span>';
    if (it.free) h += '<span class="wk-free">免费</span>';
    h += '</div>';
    h += '<div class="wk-sub-meta">' + c.ico + ' ' + esc(it.dateText)
      + (it.sessions ? '　·　' + esc(it.sessions) : '')
      + '　·　' + esc(it.place)
      + (it.metro && it.metro !== '—' ? '　·　🚇 ' + esc(it.metro) : '')
      + '</div>';
    if (it.why) h += '<div class="wk-sub-why">' + esc(it.why) + '</div>';
    if (it.book) h += '<div class="wk-sub-book">预约：' + esc(it.book) + '</div>';
    if (it.src && it.src.length) {
      var links = it.src.map(function (s) {
        return '<a class="wk-src" href="' + esc(s.u) + '" target="_blank" rel="noopener">' + esc(s.t) + ' ↗</a>';
      }).join('');
      h += '<div class="wk-sub-src">' + links + '</div>';
    }
    h += '</div>';
    return h;
  }

  /* ---------- 空态 ---------- */
  function emptyHTML(live, all) {
    var h = '<div class="week-empty">';
    if (!all.length) {
      h += '本板块还没有数据（<code>data/weekend.js</code> 为空）。';
    } else {
      h += '本周末（' + (META.range ? fmtDate(META.range.sat) + '~' + fmtDate(META.range.sun) : '—') +
        '）的推荐已全部过期（收录 ' + all.length + ' 条，最新一条结束于 ' +
        (function () {
          var mx = '';
          all.forEach(function (x) { if (x.end && x.end > mx) mx = x.end; });
          return mx || '—';
        })() + '）。';
      h += '<br><span style="color:var(--sub)">自动化每周四晚更新；这段时间可以先看 <a href="shows.html">🎭 看剧 · 演出</a> 或 <a href="venues.html">📍 常年去处</a>，那两个板块全年有效。</span>';
    }
    h += '</div>';
    return h;
  }

  function render() {
    var box = document.getElementById('weekBox');
    if (!box) return;

    /* 过滤：只保留未过期（end >= 今天）。没有 end 的视为长期有效 */
    var live = DATA.filter(function (x) { return daysLeft(x.end) >= 0; });
    var picks = live.filter(function (x) { return x.pick; });
    var subs = live.filter(function (x) { return !x.pick; });

    /* 主推按剩余天数升序（快结束的在前），和全站「市内活动」排序口径一致 */
    picks.sort(function (a, b) { return daysLeft(a.end) - daysLeft(b.end); });
    subs.sort(function (a, b) { return daysLeft(a.end) - daysLeft(b.end); });

    var h = '';

    /* 数据陈旧提醒：距 updatedAt 超过 9 天就顶上一条黄条。
       —— 自动化万一失败，页面不能装作数据是新的。 */
    var ageD = (function () {
      var u = parseD(META.updatedAt);
      if (!u) return -1;
      return Math.round((today() - u) / 86400000);
    })();
    if (ageD > 9) {
      h += '<div class="wk-stale">⏳ ' + esc(META.staleHint || '本周数据还没刷新，出行前请以官方公告为准。') +
        '<span class="wk-stale-age">数据已 ' + ageD + ' 天未更新</span></div>';
    }

    if (META.title || META.intro) {
      h += '<div class="wk-intro">' + esc(META.intro || '') + '</div>';
    }

    if (!live.length) {
      h += emptyHTML(live, DATA);
    } else {
      if (picks.length) {
        h += '<div class="wk-grid">' + picks.map(cardHTML).join('') + '</div>';
      }
      if (subs.length) {
        h += '<div class="wk-subwrap">';
        h += '<div class="wk-subtitle">📍 顺路可加（' + subs.length + ' 处，不用单独跑一趟）</div>';
        h += subs.map(subHTML).join('');
        h += '</div>';
      }
    }

    /* 玩法 + 口径 */
    if (META.howTo && META.howTo.length) {
      h += '<div class="wk-howto"><div class="wk-howto-h">🗺️ 这周末怎么排</div><ul>';
      META.howTo.forEach(function (x) { h += '<li>' + esc(x) + '</li>'; });
      h += '</ul></div>';
    }
    if (META.care && META.care.length) {
      h += '<div class="wk-care"><div class="wk-care-h">出行前请留意</div><ul>';
      META.care.forEach(function (x) { h += '<li>' + esc(x) + '</li>'; });
      h += '</ul></div>';
    }
    h += '<div class="wk-foot">数据截至 ' + esc(META.updatedAt || '—') +
      '（核对 ' + esc(META.verifiedAt || META.updatedAt || '—') + '）· ' +
      esc(META.updater || '人工整理') +
      '　·　本页只做线索整理，不售票</div>';

    box.innerHTML = h;

    /* 日期范围 */
    var rg = document.getElementById('weekRange');
    if (rg) {
      if (META.range && META.range.sat) {
        rg.textContent = fmtDate(META.range.sat) + '（周六）~ ' + fmtDate(META.range.sun) + '（周日）';
      } else {
        rg.textContent = '本周末';
      }
    }

    /* 计数：主推 + 顺路 */
    var st = document.getElementById('s-weekend');
    if (st) st.textContent = live.length;
    var hk = document.getElementById('hk-weekend');
    if (hk) hk.textContent = live.length;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }

  /* 供外部调试 */
  window.WEEKEND_RENDER = render;
})();
