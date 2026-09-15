(function () {
  'use strict';

  var DATA = window.ACTIVITIES || [];
  var META = window.DATA_META || {};
  var TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);

  var LEVEL_TEXT = {
    none: '不用预约',
    easy: '预约很简单',
    medium: '需预约',
    hard: '需实名抢约',
    unknown: '预约待开放'
  };
  var TYPE_TEXT = { exhibition: '展览', market: '市集', event: '活动/节庆', trip: '周边游' };
  var TRIPLEN_TEXT = { day: '当天往返', '2d': '2天1夜', '3d': '3天以上' };

  var state = {
    type: 'all',
    onlyFree: false,
    onlyNoBooking: false,
    hideEnded: true,
    district: 'all',
    tripLen: 'all'
  };

  function parse(d) { var p = d.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function isTrip(a) { return a.type === 'trip'; }
  function daysLeft(end) { return Math.round((parse(end) - TODAY) / 86400000); }
  function isEnded(a) { return isTrip(a) ? false : daysLeft(a.end) < 0; }

  function badgeOf(a) {
    if (isTrip(a)) return { cls: 'b-trip', txt: a.tripDays || '周边游' };
    if (isEnded(a)) return { cls: 'b-end', txt: '已结束' };
    var d = daysLeft(a.end);
    if (d <= 7) return { cls: 'b-urgent', txt: '仅剩 ' + d + ' 天' };
    if (d <= 21) return { cls: 'b-soon', txt: '剩 ' + d + ' 天' };
    if (d <= 90) return { cls: 'b-ok', txt: '剩 ' + d + ' 天' };
    return { cls: 'b-long', txt: '长期展' };
  }

  function match(a) {
    if (state.hideEnded && isEnded(a)) return false;
    if (state.type !== 'all' && a.type !== state.type) return false;
    if (state.onlyFree && !a.price.free) return false;
    if (state.onlyNoBooking && a.booking.required) return false;
    if (state.district !== 'all' && a.district !== state.district) return false;
    // 选了行程长度 = 只想看周边游
    if (state.tripLen !== 'all') {
      if (!isTrip(a) || a.tripLen !== state.tripLen) return false;
    }
    return true;
  }

  function bookLine(a) {
    var lv = a.booking.level;
    return '<span class="lv lv-' + lv + '">' + (LEVEL_TEXT[lv] || '—') + '</span>　' +
      (a.booking.channel || '');
  }

  function fact(label, val) {
    if (!val) return '';
    return '<div class="fact"><span class="fact-k">' + label + '</span><span class="fact-v">' + val + '</span></div>';
  }

  function detailHTML(a) {
    var steps = (a.booking.steps || []).map(function (s) { return '<li>' + s + '</li>'; }).join('');
    if (!isTrip(a)) {
      return '<details><summary>展开：怎么预约 / 值不值得去</summary><div class="detail">' +
        '<ol>' + steps + '</ol>' +
        (a.booking.realName ? '<div class="hl">实名要求：' + a.booking.realName + '</div>' : '') +
        (a.booking.tip ? '<div class="tip">' + a.booking.tip + '</div>' : '') +
        (a.highlight ? '<div class="hl"><b>看点：</b>' + a.highlight + '</div>' : '') +
        (a.address ? '<div class="hl">地址：' + a.address + '</div>' : '') +
        '</div></details>';
    }
    var itin = (a.itinerary || []).map(function (s) { return '<li>' + s + '</li>'; }).join('');
    return '<details><summary>展开：怎么去 / 花多少 / 值不值得</summary><div class="detail">' +
      '<div class="facts">' +
      fact('车程', a.distance) +
      fact('最佳季节', a.bestSeason) +
      fact('预算', a.budget) +
      fact('交通', a.transport) +
      fact('订票', a.booking.channel) +
      '</div>' +
      (itin ? '<div class="sec-title">建议行程</div><ol>' + itin + '</ol>' : '') +
      '<div class="sec-title">订票 / 预约</div><ol>' + steps + '</ol>' +
      (a.booking.realName ? '<div class="hl">预约要求：' + a.booking.realName + '</div>' : '') +
      (a.booking.tip ? '<div class="tip">' + a.booking.tip + '</div>' : '') +
      (a.highlight ? '<div class="hl"><b>看点：</b>' + a.highlight + '</div>' : '') +
      (a.address ? '<div class="hl">地址：' + a.address + '</div>' : '') +
      '</div></details>';
  }

  function cardHTML(a) {
    var b = badgeOf(a);
    var tags = (a.tags || []).map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('');
    var price = a.price.free
      ? '<span class="free">免费</span>'
      : '<span class="paid">' + a.price.amount + '</span>';
    if (a.price.note) price += ' <span style="color:var(--sub)">· ' + a.price.note + '</span>';

    var period = isTrip(a)
      ? '<b>' + (TRIPLEN_TEXT[a.tripLen] || a.tripDays || '') + '</b>　<span style="color:var(--sub)">常年可去</span>'
      : a.start + ' ~ ' + a.end + (a.closedDay ? '　<span style="color:var(--sub)">' + a.closedDay + '</span>' : '');

    return '<div class="card' + (isTrip(a) ? ' card-trip' : '') + (isEnded(a) ? ' done' : '') + '">' +
      '<div class="top"><h3>' + a.name + '</h3>' +
      '<span class="badge ' + b.cls + '">' + b.txt + '</span></div>' +
      '<div class="meta-line"><b>' + a.venue + '</b>　<span style="color:var(--sub)">' + a.district + '</span></div>' +
      '<div class="meta-line">' + period + '</div>' +
      (isTrip(a) && a.distance ? '<div class="meta-line"><span style="color:var(--sub)">' + a.distance + '</span></div>' : '') +
      '<div class="price">' + price + '</div>' +
      '<div class="book">' + bookLine(a) + '</div>' +
      '<div class="tags">' + tags + '</div>' +
      detailHTML(a) +
      '</div>';
  }

  function render() {
    var list = DATA.filter(match).sort(function (x, y) {
      var tx = isTrip(x) ? 1 : 0, ty = isTrip(y) ? 1 : 0;
      if (tx !== ty) return tx - ty;                            // 市内活动在前，周边游沉底
      if (tx === 1) return (y.rating || 0) - (x.rating || 0);   // 周边游按推荐度排
      var ex = isEnded(x) ? 1 : 0, ey = isEnded(y) ? 1 : 0;
      if (ex !== ey) return ex - ey;
      return daysLeft(x.end) - daysLeft(y.end);
    });

    document.getElementById('grid').innerHTML = list.length
      ? list.map(cardHTML).join('')
      : '<div class="empty">没有符合条件的，把筛选放宽一点试试。</div>';
    document.getElementById('count').textContent = list.length;
  }

  function renderStats() {
    var live = DATA.filter(function (a) { return !isTrip(a) && !isEnded(a); });
    document.getElementById('s-total').textContent = live.length;
    document.getElementById('s-free').textContent = live.filter(function (a) { return a.price.free; }).length;
    document.getElementById('s-nobook').textContent = live.filter(function (a) { return !a.booking.required; }).length;
    document.getElementById('s-urgent').textContent = live.filter(function (a) { return daysLeft(a.end) <= 10; }).length;
    var el = document.getElementById('s-trip');
    if (el) el.textContent = DATA.filter(isTrip).length;
  }

  function pick() {
    var pool = DATA.filter(function (a) { return match(a) && !isEnded(a); });
    if (!pool.length) { alert('当前筛选下没有可推荐的项目，放宽条件试试。'); return; }
    // 加权：评分高 + 快结束的 / 当天能回的，更容易被选中
    var weighted = [];
    pool.forEach(function (a) {
      var w = (a.rating || 3);
      if (isTrip(a)) {
        if (a.tripLen === 'day') w += 2; else if (a.tripLen === '2d') w += 1;
      } else {
        var d = daysLeft(a.end);
        if (d <= 10) w += 2; else if (d <= 30) w += 1;
      }
      if (a.price.free) w += 1;
      for (var i = 0; i < w; i++) weighted.push(a);
    });
    var a = weighted[Math.floor(Math.random() * weighted.length)];
    var b = badgeOf(a);
    var why = [];
    if (a.price.free) why.push('免费');
    if (!a.booking.required) why.push('不用预约，说走就走');
    if (isTrip(a)) {
      if (a.tripLen === 'day') why.push('当天就能来回，不用请假');
      else if (a.tripLen === '2d') why.push('请一天假就能走');
      else why.push('需要凑个三天，适合小长假');
      if (a.budget) why.push('预算：' + a.budget);
    } else {
      var d = daysLeft(a.end);
      if (d <= 10) why.push('只剩 ' + d + ' 天，再不去就没了');
      else if (d > 180) why.push('展期很长，可以从容挑个工作日');
    }
    if ((a.rating || 0) >= 5) why.push('这批里口碑最高的一个');
    if (a.district === '浦东' || a.district === '崇明') why.push('离你最近');

    var metaLine = isTrip(a)
      ? '<div class="pk-line">' + TYPE_TEXT[a.type] + ' · ' + a.venue + '（' + a.district + '）　' + (a.tripDays || '') + '</div>' +
        '<div class="pk-line">' + (a.distance || '') + '</div>'
      : '<div class="pk-line">' + TYPE_TEXT[a.type] + ' · ' + a.venue + '（' + a.district + '）</div>' +
        '<div class="pk-line">' + a.start + ' ~ ' + a.end + '　' + (a.closedDay || '') + '</div>';

    var box = document.getElementById('pickResult');
    box.style.display = 'block';
    box.innerHTML = '<div class="pick-card">' +
      '<div class="pk-name">' + a.name + ' <span class="badge ' + b.cls + '" style="margin-left:6px">' + b.txt + '</span></div>' +
      metaLine +
      '<div class="pk-line">' + (a.price.free ? '免费' : a.price.amount) + '　·　' + (LEVEL_TEXT[a.booking.level] || '') + '　·　' + (a.booking.channel || '') + '</div>' +
      (why.length ? '<div class="pk-why"><b>为什么是它：</b>' + why.join('；') + '。</div>' : '') +
      '</div>';
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function bind() {
    document.querySelectorAll('.chip').forEach(function (el) {
      el.addEventListener('click', function () {
        var g = el.getAttribute('data-group');
        var v = el.getAttribute('data-val');
        if (g === 'toggle') {
          state[v] = !state[v];
          el.classList.toggle('on', state[v]);
        } else {
          document.querySelectorAll('.chip[data-group="' + g + '"]').forEach(function (o) { o.classList.remove('on'); });
          el.classList.add('on');
          state[g] = v;
        }
        document.getElementById('pickResult').style.display = 'none';
        render();
      });
    });
    document.getElementById('btnDecide').addEventListener('click', pick);
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('verifiedAt').textContent = META.verifiedAt || '';
    renderStats();
    bind();
    render();
  });
})();
