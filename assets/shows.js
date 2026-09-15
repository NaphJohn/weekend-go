(function () {
  'use strict';

  var DATA = window.SHOWS || [];
  var META = window.SHOWS_META || {};
  var TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);

  var TYPE_TEXT = {
    musical: '音乐剧', opera: '歌剧', dance: '舞剧/芭蕾',
    theatre: '话剧', concert: '音乐会', resident: '驻演·小剧场'
  };

  // 本周（周一 ~ 周日）
  function weekStart() {
    var d = new Date(TODAY);
    var w = (d.getDay() + 6) % 7; // 周一=0
    d.setDate(d.getDate() - w);
    return d;
  }
  var WS = weekStart();
  var WE = new Date(WS); WE.setDate(WE.getDate() + 6);

  function parse(s) { if (!s) return null; var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function daysTo(d) { return Math.round((parse(d) - TODAY) / 86400000); }
  function fmt(d) { return d.getFullYear() + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + ('0' + d.getDate()).slice(-2); }

  function statusOf(s) {
    if (!s.start || !s.end) return 'tbd';
    var st = parse(s.start), en = parse(s.end);
    if (en < TODAY) return 'ended';
    if (st <= TODAY) return 'running';
    return 'upcoming';
  }
  function runningNow(s) {
    var st = statusOf(s);
    return st === 'running' || st === 'upcoming';
  }
  function inThisWeek(s) {
    if (!s.start || !s.end) return false;
    var st = parse(s.start), en = parse(s.end);
    return st <= WE && en >= WS && en >= TODAY;
  }

  function badgeOf(s) {
    var st = statusOf(s);
    if (st === 'running') return { cls: 'b-run', txt: '在演中' };
    if (st === 'upcoming') {
      var d = daysTo(s.start);
      var md = s.start.slice(5).replace('-', '.');
      return { cls: d <= 14 ? 'b-urgent' : 'b-soon', txt: md + ' 开演' };
    }
    if (st === 'ended') return { cls: 'b-end', txt: '已结束' };
    return { cls: 'b-tbd', txt: '档期待定' };
  }

  var state = { type: 'all', status: 'all', district: 'all', band: 'all' };

  function match(s) {
    if (state.type !== 'all' && s.type !== state.type) return false;
    if (state.status !== 'all' && statusOf(s) !== state.status) return false;
    if (state.district !== 'all' && s.district !== state.district) return false;
    if (state.band !== 'all') {
      var p = s.price || {};
      if (p.min == null || p.max == null) return false;
      if (state.band === 'low' && p.min > 200) return false;
      if (state.band === 'high' && p.max < 800) return false;
    }
    return true;
  }

  var ORD = { running: 0, upcoming: 1, tbd: 2, ended: 3 };
  function sortFn(x, y) {
    var a = ORD[statusOf(x)], b = ORD[statusOf(y)];
    if (a !== b) return a - b;
    var sx = x.start ? parse(x.start).getTime() : 9e15;
    var sy = y.start ? parse(y.start).getTime() : 9e15;
    if (statusOf(x) === 'ended') { sx = -sx; sy = -sy; } // 已结束：近的在前
    return sx - sy;
  }

  function dateLine(s) {
    if (!s.start || !s.end) return '<span style="color:var(--sub)">档期待定 · 以官方开票为准</span>';
    var r = s.start === s.end ? s.start : (s.start + ' ~ ' + s.end);
    var extra = '';
    if (statusOf(s) === 'running') extra = '（在演）';
    else if (statusOf(s) === 'upcoming') extra = '（' + daysTo(s.start) + ' 天后开演）';
    return r + '　' + extra + (s.sessions ? '<br><span style="color:var(--sub)">' + s.sessions + '</span>' : '');
  }

  // 组装展开区
  function detailHTML(s) {
    var out = '';
    if (s.platform) out += '<div><b>购票渠道：</b>' + s.platform + '</div>';
    if (s.sessions) out += '<div><b>场次：</b>' + s.sessions + '</div>';
    if (s.duration) out += '<div><b>时长：</b>' + s.duration + '</div>';
    if (s.highlight) out += '<div class="hl"><b>看点：</b>' + s.highlight + '</div>';
    if (s.price && s.price.note) out += '<div class="tip">' + s.price.note + '</div>';
    if (s.address) out += '<div class="hl">地址：' + s.address + '</div>';
    return out;
  }

  function cardHTML(s) {
    var b = badgeOf(s);
    var tags = (s.tags || []).map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('');
    var cls = statusOf(s) === 'ended' ? ' done' : '';
    return '<div class="card' + cls + '">' +
      '<div class="top"><h3>' + s.name + '</h3><span class="badge ' + b.cls + '">' + b.txt + '</span></div>' +
      '<div class="meta-line"><span class="pill-type">' + (TYPE_TEXT[s.type] || '') + '</span>　<b>' + s.venue + '</b>　<span style="color:var(--sub)">' + s.district + '</span></div>' +
      '<div class="meta-line">' + dateLine(s) + '</div>' +
      '<div class="price">🎫 <b>' + (s.price && s.price.text ? s.price.text : '以官方为准') + '</b>' +
        (s.language ? '　<span style="color:var(--sub)">· ' + s.language + '</span>' : '') + '</div>' +
      (s.duration ? '<div class="meta-line">⏱ ' + s.duration + '　<span style="color:var(--sub)">· ' + (s.platform || '') + '</span></div>' : '') +
      '<div class="tags">' + tags + '</div>' +
      '<details><summary>展开：怎么买票 / 值不值得看</summary><div class="detail">' +
      detailHTML(s) +
      '</div></details>' +
      '</div>';
  }

  function render() {
    var list = DATA.filter(match).sort(sortFn);
    document.getElementById('grid').innerHTML = list.length
      ? list.map(cardHTML).join('')
      : '<div class="empty">没有符合条件的剧目，把筛选放宽一点试试。</div>';
    document.getElementById('count').textContent = list.length;
  }

  function renderStats() {
    var live = DATA.filter(function (s) { return statusOf(s) === 'running'; });
    var soon = DATA.filter(function (s) { return statusOf(s) === 'upcoming'; });
    document.getElementById('s-run').textContent = live.length;
    document.getElementById('s-soon').textContent = soon.length;
    document.getElementById('s-total').textContent = DATA.length;
    document.getElementById('s-week').textContent = DATA.filter(inThisWeek).length;
  }

  function renderWeek() {
    var pool = DATA.filter(function (s) { return inThisWeek(s); }).sort(sortFn);
    var box = document.getElementById('weekBox');
    if (!pool.length) {
      // 没有本周在演 → 提示最近开演
      var nxt = DATA.filter(function (s) { return statusOf(s) === 'upcoming'; }).sort(sortFn)[0];
      box.innerHTML = '<div class="week-empty">本周（' + fmt(WS) + '~' + fmt(WE) + '）暂无剧目开演，' +
        (nxt ? '最近一部是 <b>' + nxt.name + '</b>，' + nxt.start + ' 开演（' + daysTo(nxt.start) + ' 天后）。' : '近期暂无已官宣档期。') +
        '</div>';
      return;
    }
    box.innerHTML = pool.map(function (s) {
      var b = badgeOf(s);
      return '<div class="week-item"><span class="badge ' + b.cls + '">' + b.txt + '</span>' +
        '<b>' + s.name + '</b>　<span style="color:var(--sub)">' + s.venue + ' · ' + (TYPE_TEXT[s.type] || '') + '</span>' +
        '<div class="week-meta">' + (s.sessions || '') + '　·　' + (s.price && s.price.text ? s.price.text : '以官方为准') + '</div></div>';
    }).join('');
  }

  function pick() {
    var pool = DATA.filter(function (s) { return match(s) && runningNow(s); });
    if (!pool.length) { alert('当前筛选下没有可推荐的剧目，放宽条件试试。'); return; }
    var weighted = [];
    pool.forEach(function (s) {
      var w = (s.rating || 3);
      if (statusOf(s) === 'running') w += 3;
      var d = s.start ? daysTo(s.start) : 999;
      if (d >= 0 && d <= 14) w += 2; else if (d <= 45) w += 1;
      for (var i = 0; i < w; i++) weighted.push(s);
    });
    var s = weighted[Math.floor(Math.random() * weighted.length)];
    var b = badgeOf(s);
    var why = [];
    if (statusOf(s) === 'running') why.push('正在上演，这周就能看');
    else if (s.start) why.push(daysTo(s.start) + ' 天后开演');
    if ((s.rating || 0) >= 5) why.push('这批里口碑最高的之一');
    if (s.price && s.price.min != null && s.price.min <= 200) why.push('有 200 元以内的票');
    if (s.type === 'resident') why.push('小剧场沉浸式，时长友好');
    var box = document.getElementById('pickResult');
    box.style.display = 'block';
    box.innerHTML = '<div class="pick-card">' +
      '<div class="pk-name">' + s.name + ' <span class="badge ' + b.cls + '" style="margin-left:6px">' + b.txt + '</span></div>' +
      '<div class="pk-line">' + (TYPE_TEXT[s.type] || '') + ' · ' + s.venue + '（' + s.district + '）</div>' +
      '<div class="pk-line">' + (s.start ? (s.start === s.end ? s.start : s.start + ' ~ ' + s.end) : '档期待定') + '　' + (s.sessions || '') + '</div>' +
      '<div class="pk-line">' + (s.price && s.price.text ? s.price.text : '以官方为准') + '　·　' + (s.duration || '') + '</div>' +
      (why.length ? '<div class="pk-why"><b>为什么是它：</b>' + why.join('；') + '。</div>' : '') +
      '</div>';
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function bind() {
    document.querySelectorAll('.chip').forEach(function (el) {
      el.addEventListener('click', function () {
        var g = el.getAttribute('data-group');
        var v = el.getAttribute('data-val');
        document.querySelectorAll('.chip[data-group="' + g + '"]').forEach(function (o) { o.classList.remove('on'); });
        el.classList.add('on');
        state[g] = v;
        document.getElementById('pickResult').style.display = 'none';
        render();
      });
    });
    document.getElementById('btnDecide').addEventListener('click', pick);
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('verifiedAt').textContent = META.verifiedAt || '';
    document.getElementById('weekRange').textContent = fmt(WS) + ' ~ ' + fmt(WE);
    renderStats();
    renderWeek();
    bind();
    render();
  });
})();
