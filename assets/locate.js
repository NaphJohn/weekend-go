/**
 * 共用定位模块：给 index.html（展览/市集/美食）和 shows.html（看剧）同时使用。
 * 依赖 data/metro.js（window.METRO）。
 * 暴露：window.WG = { station, km, grade, locate, stations, meta }
 */
(function () {
  'use strict';

  var M = window.METRO || { stations: [], places: [], district: {}, venue: {}, quick: [], showVenue: {}, unit: 100 };

  var S = {};
  (M.stations || []).forEach(function (s) {
    S[s[0]] = { x: s[1], y: s[2], lines: s[3], d: s[4] };
  });

  function station(name) { return S[name] || null; }

  /** 两站直线距离（公里）。示意坐标，只用于粗排 */
  function km(a, b) {
    var p = S[a], q = S[b];
    if (!p || !q) return null;
    var dx = p.x - q.x, dy = p.y - q.y;
    return Math.sqrt(dx * dx + dy * dy) * (M.unit || 100) / 1000;
  }

  /** 距离档位文案 */
  function grade(k) {
    if (k == null) return null;
    if (k < 1.2) return { txt: '就在附近', sub: '步行或 1 站内', cls: 'd1' };
    if (k < 3.5) return { txt: '很近', sub: '地铁约 15 分钟', cls: 'd2' };
    if (k < 8) return { txt: '不远', sub: '地铁约 30 分钟', cls: 'd3' };
    if (k < 16) return { txt: '跨区', sub: '地铁约 45 分钟', cls: 'd4' };
    return { txt: '较远', sub: '地铁 1 小时起', cls: 'd5' };
  }

  /** 输入地点 → 最近地铁站。四级兜底：站名 → 地标词典 → 站名部分匹配 → 区中心 */
  function locate(raw) {
    var q0 = (raw || '').trim();
    if (!q0) return null;
    var q = q0.replace(/\s+/g, '').replace(/^上海市?/, '').replace(/市$/, '');
    if (!q) return null;

    if (S[q]) return { station: q, how: '定位到地铁站「' + q + '」' };

    var best = null, score = 0;
    (M.places || []).forEach(function (p) {
      p[1].forEach(function (kw) {
        if (q.indexOf(kw) >= 0 && kw.length > score) {
          score = kw.length;
          best = { station: p[0], how: '按「' + kw + '」定位到 ' + p[0] + '站' };
        }
      });
    });
    if (best) return best;

    var cand = null, diff = 1e9;
    Object.keys(S).forEach(function (n) {
      if (q.length >= 2 && n.indexOf(q) >= 0) {
        var d = n.length - q.length;
        if (d < diff) { diff = d; cand = n; }
      }
    });
    if (cand) return { station: cand, how: '匹配到地铁站「' + cand + '」' };

    var dq = q.replace(/区$/, '');
    if (M.district && M.district[dq] !== undefined) {
      var st = M.district[dq];
      if (st) return { station: st, how: '按「' + dq + '区」中心定位到 ' + st + '站' };
      return { station: null, how: dq + ' 暂无地铁直达，试试附近的区' };
    }
    return null;
  }

  window.WG = { station: station, km: km, grade: grade, locate: locate, stations: S, meta: M };
})();
