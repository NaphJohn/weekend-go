/**
 * 划词批注：在卡片上选中任意一句话 → 划线 → 写批注。
 *
 * 数据只存在这台设备的浏览器里（localStorage），不上传、不需要登录。
 * 换设备 / 清浏览器缓存会丢，重要的记得「导出」。
 *
 * 难点：卡片在每次筛选、定位、切换后都会被整段重新渲染，
 *      所以批注不是「改一次 DOM 就完事」，而是每次渲染后要按
 *      「卡片 id + 选中原文 + 第几次出现」重新上色。
 */
(function () {
  var KEY = 'weekendgo_anno_v1';
  var MIN = 2;          // 少于 2 个字不给批（避免误划）
  var MAX = 200;        // 太长也不给批（锚点会不稳）
  var gridSel = '#grid';
  var data = null;

  /* ---------- 存取 ---------- */
  function load() {
    if (data) return data;
    try { data = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
    catch (e) { data = {}; }
    if (!data || typeof data !== 'object') data = {};
    return data;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} }

  function closest(node, sel) {
    while (node && node.nodeType !== 1) node = node.parentNode;
    while (node && node.nodeType === 1) {
      if (node.matches && node.matches(sel)) return node;
      node = node.parentNode;
    }
    return null;
  }
  function mk(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  /* ---------- 字符偏移 ↔ DOM 位置 ---------- */
  function textNodes(root) {
    var out = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false), n;
    while ((n = w.nextNode())) {
      var p = n.parentNode;
      if (p && (p.nodeName === 'SCRIPT' || p.nodeName === 'STYLE')) continue;
      out.push(n);
    }
    return out;
  }
  function nodeAt(root, off) {
    var ns = textNodes(root), acc = 0, i;
    for (i = 0; i < ns.length; i++) {
      var len = ns[i].textContent.length;
      if (off <= acc + len) return { node: ns[i], offset: Math.max(0, off - acc) };
      acc += len;
    }
    return null;
  }
  /** (node, offset) 在 root 全文里的第几个字符 */
  function charOffset(root, node, offset) {
    try {
      var r = document.createRange();
      r.selectNodeContents(root);
      r.setEnd(node, Math.min(offset, node.textContent.length));
      return r.toString().length;
    } catch (e) { return -1; }
  }
  /** needle 在 hay 里第 nth 次（0 起）出现的位置 */
  function nthIndex(hay, needle, nth) {
    var i = hay.indexOf(needle), c = 0;
    while (i >= 0) { if (c === nth) return i; c++; i = hay.indexOf(needle, i + 1); }
    return -1;
  }

  /* ---------- 上色 / 拆色 ---------- */
  function wrapRange(range, attrs) {
    if (!range || range.collapsed) return;
    var items = [];
    // 选区落在单个文本节点里时，commonAncestorContainer 就是那个文本节点；
    // TreeWalker 从 root 自身「之后」才开始走，会一个都取不到 —— 必须抬到父元素。
    var root = range.commonAncestorContainer;
    if (root && root.nodeType === 3) root = root.parentNode;
    if (!root) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false), n;
    while ((n = w.nextNode())) {
      if (!range.intersectsNode(n)) continue;
      var s = 0, e = n.textContent.length;
      if (n === range.startContainer) s = range.startOffset;
      if (n === range.endContainer) e = range.endOffset;
      if (e > s) items.push({ n: n, s: s, e: e });
    }
    // 先把 (起止) 都算好再切，否则 splitText 会打乱后续节点
    items.forEach(function (it) {
      var nn = it.n, s = it.s, e = it.e;
      if (e > nn.textContent.length) e = nn.textContent.length;
      if (e <= s) return;
      var t = nn;
      if (e < nn.textContent.length) nn.splitText(e);
      if (s > 0) t = nn.splitText(s);
      var m = document.createElement('mark');
      m.className = 'anno';
      Object.keys(attrs || {}).forEach(function (k) { m.setAttribute(k, attrs[k]); });
      t.parentNode.insertBefore(m, t);
      m.appendChild(t);
    });
  }
  function unwrap(root) {
    var m, guard = 0;
    while ((m = root.querySelector('mark.anno')) && guard++ < 800) {
      m.parentNode.replaceChild(document.createTextNode(m.textContent || ''), m);
    }
    try { root.normalize(); } catch (e) {}
  }

  /* ---------- 每次渲染后重新上色 ---------- */
  function apply() {
    var grid = document.querySelector(gridSel);
    if (!grid) return;
    unwrap(grid);
    var d = load();
    Array.prototype.forEach.call(grid.querySelectorAll('[data-id]'), function (card) {
      var id = card.getAttribute('data-id');
      var list = d[id] || [];
      list.forEach(function (an) {
        var full = card.textContent;
        var start = nthIndex(full, an.text, an.nth || 0);
        if (start < 0) return;                       // 原文被改掉了，就跳过（别乱画）
        var a = nodeAt(card, start), b = nodeAt(card, start + an.text.length);
        if (!a || !b) return;
        var r = document.createRange();
        r.setStart(a.node, a.offset);
        r.setEnd(b.node, b.offset);
        wrapRange(r, { 'data-an': an.id, title: (an.note || '').slice(0, 300) });
      });
    });
    renderBar();
  }

  /* ---------- 浮动按钮 + 编辑弹窗 ---------- */
  var btn = null, pop = null, pending = null, editing = null;

  function ensureUI() {
    if (btn) return;
    btn = mk('button', 'anno-btn', '✍️ 加批注');
    btn.style.display = 'none';
    btn.addEventListener('mousedown', function (e) { e.preventDefault(); });
    btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openEditor(); });
    document.body.appendChild(btn);

    pop = mk('div', 'anno-pop');
    pop.style.display = 'none';
    document.body.appendChild(pop);

    document.addEventListener('mousedown', function (e) {
      if (pop && pop.style.display !== 'none' && !pop.contains(e.target) && e.target !== btn) closePop();
    });
  }

  function pos(el, rect) {
    var top = rect.bottom + window.pageYOffset + 6;
    var left = rect.left + window.pageXOffset;
    var room = window.innerHeight - rect.bottom;
    if (room < 190) top = rect.top + window.pageYOffset - 190;   // 下面放不下就翻到上面
    if (top < window.pageYOffset + 4) top = window.pageYOffset + 4;
    var w = el.offsetWidth || 160;
    if (left + w > window.pageXOffset + document.documentElement.clientWidth - 8) {
      left = window.pageXOffset + document.documentElement.clientWidth - w - 8;
    }
    el.style.left = Math.max(4, left) + 'px';
    el.style.top = top + 'px';
  }

  function hideBtn() { if (btn) btn.style.display = 'none'; }

  function onUp() {
    ensureUI();
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount < 1) { hideBtn(); return; }
    var text = sel.toString();
    if (text.trim().length < MIN || text.length > MAX) { hideBtn(); return; }

    var range = sel.getRangeAt(0);
    var node = range.commonAncestorContainer;
    if (closest(node, 'mark.anno')) { hideBtn(); return; }       // 别在已有批注里再套一层
    var grid = document.querySelector(gridSel);
    var card = closest(node, '[data-id]');
    if (!card || !grid || !grid.contains(card)) { hideBtn(); return; }

    // 同一句话可能在卡片里出现多次 → 记下是第几次，重渲染时才能画回原处
    var off = charOffset(card, range.startContainer, range.startOffset);
    var nth = 0, i = card.textContent.indexOf(text);
    while (i >= 0 && i < off) { nth++; i = card.textContent.indexOf(text, i + 1); }

    pending = { cardId: card.getAttribute('data-id'), text: text, nth: nth };
    editing = null;
    btn.style.display = '';
    pos(btn, range.getBoundingClientRect());
  }

  function openEditor(an, cardId, rect) {
    ensureUI();
    editing = an ? { an: an, cardId: cardId } : null;
    var text = an ? an.text : (pending ? pending.text : '');
    pop.innerHTML = '';
    pop.appendChild(mk('div', 'anno-pop-h', an ? '📝 这条批注' : '✍️ 加批注'));
    var q = mk('div', 'anno-quote', '「' + text + '」');
    pop.appendChild(q);
    var ta = mk('textarea', 'anno-ta');
    ta.rows = 3;
    ta.placeholder = '写一句：确认过 / 别买 / 带现金…（只存本机）';
    ta.value = an ? (an.note || '') : '';
    pop.appendChild(ta);
    var ops = mk('div', 'anno-ops');
    var bSave = mk('button', 'mini', '保存');
    var bCancel = mk('button', 'mini ghost', '取消');
    ops.appendChild(bSave); ops.appendChild(bCancel);
    if (an) {
      var bDel = mk('button', 'mini ghost anno-del', '删除');
      ops.appendChild(bDel);
      bDel.addEventListener('click', function () { doDelete(); });
    }
    pop.appendChild(ops);

    bSave.addEventListener('click', function () { doSave(ta.value); });
    bCancel.addEventListener('click', closePop);

    pop.style.display = '';
    var anchor = rect || (btn && btn.style.display !== 'none' ? btn.getBoundingClientRect() : null);
    if (anchor) pos(pop, anchor); else { pop.style.left = '50%'; pop.style.top = '30%'; }
    ta.focus();
  }

  function doSave(txt) {
    var v = (txt || '').trim();
    var d = load();
    if (editing && editing.an) {
      editing.an.note = v;
      editing.an.t = Date.now();
    } else if (pending) {
      var list = d[pending.cardId] || (d[pending.cardId] = []);
      list.push({ id: 'a' + Date.now() + Math.random().toString(36).slice(2, 6), text: pending.text, nth: pending.nth, note: v, t: Date.now() });
    }
    save();
    closePop();
    apply();
  }
  function doDelete() {
    if (!editing) return;
    var d = load();
    var list = d[editing.cardId] || [];
    var out = [];
    for (var i = 0; i < list.length; i++) { if (list[i].id !== editing.an.id) out.push(list[i]); }
    if (out.length) d[editing.cardId] = out; else delete d[editing.cardId];
    save();
    closePop();
    apply();
  }
  function closePop() {
    if (pop) pop.style.display = 'none';
    hideBtn();
    editing = null; pending = null;
    try { window.getSelection().removeAllRanges(); } catch (e) {}
  }

  /* ---------- 点已划的句子 → 打开 ---------- */
  function bindGrid() {
    var grid = document.querySelector(gridSel);
    if (!grid || grid.__annoBound) return;
    grid.__annoBound = true;
    grid.addEventListener('click', function (e) {
      var m = closest(e.target, 'mark.anno');
      if (!m) return;
      e.preventDefault(); e.stopPropagation();
      var card = closest(m, '[data-id]');
      if (!card) return;
      var id = card.getAttribute('data-id'), anId = m.getAttribute('data-an');
      var list = load()[id] || [], hit = null;
      for (var i = 0; i < list.length; i++) { if (list[i].id === anId) hit = list[i]; }
      if (!hit) return;
      openEditor(hit, id, m.getBoundingClientRect());
    });
  }

  /* ---------- 底部那一行：条数 / 导出 / 清空 ---------- */
  function countAll() {
    var d = load(), n = 0;
    Object.keys(d).forEach(function (k) { n += ((d[k] || []).length); });
    return n;
  }
  function renderBar() {
    var bar = document.getElementById('annoBar');
    if (!bar) return;
    var n = countAll();
    bar.innerHTML = '';
    // ⚠️ 提示文案必须对「展览 / 剧 / 剧本杀 / 桌游」四类卡片都成立 —— 别写死具体例子
    bar.appendChild(mk('span', 'hint', n ? ('共 ' + n + ' 条批注。划卡片上任意一句话就能加，点划线的地方可以改或删。')
                                     : '还没有批注。用鼠标划选卡片上任意一句话，松手后点「加批注」。'));
    if (!n) return;
    var ops = mk('div', 'anno-bar-ops');
    var bExp = mk('button', 'mini', '导出');
    var bClr = mk('button', 'mini ghost', '清空全部');
    ops.appendChild(bExp); ops.appendChild(bClr);
    bar.appendChild(ops);
    bExp.addEventListener('click', function () {
      var blob = new Blob([JSON.stringify(load(), null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'weekend-go-批注-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(a.href);
    });
    bClr.addEventListener('click', function () {
      if (!window.confirm('清空这台设备上的全部 ' + n + ' 条批注？此操作不可撤销（可先导出备份）。')) return;
      data = {}; save(); apply();
    });
  }

  /* ---------- 启动 ---------- */
  function init(opts) {
    if (opts && opts.grid) gridSel = opts.grid;
    ensureUI();
    bindGrid();
    document.addEventListener('mouseup', function () { setTimeout(onUp, 0); });
    document.addEventListener('touchend', function () { setTimeout(onUp, 0); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePop(); });
    apply();
  }

  window.Annotate = { init: init, apply: apply, count: countAll, KEY: KEY };

  // 自启动：两页都靠它接管选区与卡片点击（重新渲染时由页面的 render() 调 apply()）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); });
  } else { init(); }
})();
