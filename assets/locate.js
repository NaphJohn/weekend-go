/**
 * 共用定位模块：给 index.html（展览/市集/美食）和 shows.html（看剧）同时使用。
 * 依赖 data/metro.js（window.METRO）。
 * 暴露：window.WG = { station, km, grade, locate, midPoint, ptKm, nearest,
 *                    readLoc, saveLoc, dropLoc, readLocMid, saveLocMid, dropLocMid,
 *                    urlHere, urlMid, stations, meta }
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

  /* ================= 多点：任意点 ↔ 站 的距离 / 中间点 ================= */

  /** 任意坐标 {x,y} → 某个地铁站的距离（公里）。传站名，内部查坐标 */
  function ptKm(pt, stationName) {
    var q = S[stationName];
    if (!pt || !q) return null;
    var dx = pt.x - q.x, dy = pt.y - q.y;
    return Math.sqrt(dx * dx + dy * dy) * (M.unit || 100) / 1000;
  }

  /** 离某个坐标最近的地铁站 → {name, km} */
  function nearest(pt) {
    if (!pt) return null;
    var best = null, bd = Infinity;
    Object.keys(S).forEach(function (n) {
      var s = S[n], dx = pt.x - s.x, dy = pt.y - s.y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = n; }
    });
    if (!best) return null;
    return { name: best, km: Math.sqrt(bd) * (M.unit || 100) / 1000 };
  }

  /**
   * 中间点：两个人从各自的地方出发，先约在中间碰头。
   *
   * 坐标系本来就是「以人民广场为原点的等比平面直角坐标」（1 单位 = 100 米），
   * 所以中点就是两站坐标的算术平均，不需要任何经纬度/投影换算。
   * 再取离中点最近的地铁站，作为「差不多在哪」的白话锚点。
   *
   * 返回 {A, B, M:{x,y}, near:{name,km}}；任一端认不出来就返回 null。
   */
  function midPoint(a, b) {
    var ra = locate(a), rb = locate(b);
    if (!ra || !ra.station || !rb || !rb.station) return null;
    var p = S[ra.station], q = S[rb.station];
    if (!p || !q) return null;
    var mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    return { A: ra.station, B: rb.station, M: mid, near: nearest(mid) };
  }

  /* ================= 「你在哪 / 中间点」记忆 =================
   * 两个 key 分开存、互不覆盖，且写入其一会清掉另一个（单点与中点互斥）。
   * 12 小时 TTL：换天出门应该重新填，而不是被昨天的定位悄悄影响。
   */
  var LOC_KEY = 'weekendgo_loc_v1';
  var MID_KEY = 'weekendgo_loc_mid_v1';
  var TTL = 12 * 3600 * 1000;

  function readKey(key) {
    try {
      var o = JSON.parse(localStorage.getItem(key) || 'null');
      if (!o || !o.t) return null;
      if (Date.now() - o.t > TTL) { localStorage.removeItem(key); return null; }
      return o.v || null;
    } catch (e) { return null; }
  }
  function writeKey(key, v) {
    try { localStorage.setItem(key, JSON.stringify({ v: v, t: Date.now() })); } catch (e) {}
  }
  function delKey(key) { try { localStorage.removeItem(key); } catch (e) {} }

  function readLoc() { return readKey(LOC_KEY); }               // → 站名
  function saveLoc(name) { writeKey(LOC_KEY, name); delKey(MID_KEY); }
  function dropLoc() { delKey(LOC_KEY); }

  function readLocMid() { return readKey(MID_KEY); }            // → {A, B}
  function saveLocMid(a, b) { writeKey(MID_KEY, { A: a, B: b }); delKey(LOC_KEY); }
  function dropLocMid() { delKey(MID_KEY); }

  /* 跨页携带：?here=站名（单点）/ ?mid=A,B（中点）。URL 优先于记忆 */
  function param(k) {
    try { return new URLSearchParams(location.search).get(k) || ''; } catch (e) { return ''; }
  }
  function urlHere() { return param('here') || null; }
  function urlMid() {
    var v = param('mid');
    if (!v) return null;
    var i = v.indexOf(',');
    if (i <= 0 || i >= v.length - 1) return null;
    return { A: v.slice(0, i), B: v.slice(i + 1) };
  }

  window.WG = {
    station: station, km: km, grade: grade, locate: locate,
    ptKm: ptKm, nearest: nearest, midPoint: midPoint,
    readLoc: readLoc, saveLoc: saveLoc, dropLoc: dropLoc,
    readLocMid: readLocMid, saveLocMid: saveLocMid, dropLocMid: dropLocMid,
    urlHere: urlHere, urlMid: urlMid,
    stations: S, meta: M
  };
})();
