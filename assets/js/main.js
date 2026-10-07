/* TRACE project page. No dependencies.
   Data sources: Table 2, Appendix A.7, and Figs. 13-14 of the manuscript. */
(function () {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  // TRACER rose, humans blue, GPT-5 as the gray baseline; families amber / blue / teal (validated)
  var C = {
    tracer: '#C2415F', gpt: '#8E97A8', human: '#2F63C8',
    closed: '#C47A12', open: '#2F63C8', affect: '#0E8C73',
    track: '#EEF0F3', surface: '#FFFFFF', grid: '#E8EBEF', axis: '#CDD2D9',
    ink: '#17213A', ink2: '#4A5468', muted: '#818A9C'
  };
  // External resources: fill in when public; pending buttons turn into links automatically.
  var LINKS = { arxiv: '', huggingface: '' };

  /* ------------------------------------------------------------------ data */
  var TASKS = ['T1', 'T2', 'T3', 'T4', 'T5', 'Avg.'];
  var TASK_NAMES = ['Recognition', 'Regulation', 'Cause', 'Effect', 'Full chain', 'Average'];
  var RESULTS = {
    main: {
      gpt:    [56.61, 41.56, 77.11, 53.75, 60.79, 57.96],
      tracer: [61.67, 49.53, 84.55, 59.47, 63.59, 63.76]
    },
    matched: {
      human:  [83.60, 72.32, 85.55, 78.90, 75.40, 79.15],
      gpt:    [57.97, 41.87, 75.80, 57.61, 60.48, 58.75],
      tracer: [60.78, 49.91, 84.39, 60.21, 62.59, 63.58]
    }
  };
  var FAMILIES = [
    { key: 'affect', label: 'Affect-specialized', models: [['Emotion-LLaMA', 1.69], ['AffectGPT', 18.77], ['Emotion-Qwen', 21.47]] },
    { key: 'open', label: 'Open-source', models: [['LLaVA-OneVision-7B', 18.70], ['LLaVA-NeXT-Video-32B', 23.49], ['MiniCPM-V-4.5', 33.45],
      ['GLM-4.6V-Flash-9B', 34.62], ['LLaVA-OneVision-70B', 36.88], ['InternVL3.5-38B', 37.76], ['Qwen3-Omni-30B', 42.55], ['Qwen3-VL-32B', 48.28]] },
    { key: 'closed', label: 'Closed-source', models: [['Gemini-3-Pro', 54.63], ['GPT-5 (non-thinking)', 54.94], ['GPT-5 (thinking)', 57.96]] }
  ];
  var SURFACE = [
    { label: 'GPT-5 (thinking)', setting: 'baseline', v: [50, 19, 31] },
    { label: 'GPT-5 (thinking)', setting: '+ appraisal records', v: [60, 7, 33] },
    { label: 'Qwen3-VL-32B', setting: 'baseline', v: [40, 27, 33] },
    { label: 'Qwen3-VL-32B', setting: '+ appraisal records', v: [51, 2, 47] }
  ];
  var SURFACE_KEYS = [['Correct State', '#2F63C8'], ['Manifestation mistaken for State', '#C47A12'], ['Other errors or omissions', '#E3E6EB']];
  var FAB = {
    stages: ['Condition', 'Affect', 'Effect'],
    stageSub: ['external reality', 'manifestation', 'physical'],
    series: [{ name: 'GPT-5 (thinking)', color: C.gpt, v: [3.1, 12.2, 17.3] },
             { name: 'TRACER', color: C.tracer, v: [3.0, 6.2, 3.3] }]
  };

  /* --------------------------------------------------------------- helpers */
  function el(tag, attrs, parent) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function txt(parent, x, y, s, attrs) {
    attrs = Object.assign({}, attrs || {});
    var fill = attrs.fill; delete attrs.fill;
    var t = el('text', Object.assign({ x: x, y: y }, attrs), parent);
    if (fill) t.style.fill = fill;
    t.textContent = s;
    return t;
  }
  function svgFor(container, h) {
    var w = Math.max(280, Math.round(container.clientWidth));
    container.textContent = '';
    var s = el('svg', { viewBox: '0 0 ' + w + ' ' + h, width: w, height: h, 'aria-hidden': 'true' }, container);
    return { svg: s, w: w, h: h };
  }
  function fmt(v, d) { return v.toFixed(d === undefined ? 2 : d); }
  function roundEndBar(g, x, y, w, h, color, r) {
    // square at the baseline (left), rounded data-end (right)
    r = Math.min(r || 4, w, h / 2);
    var d = 'M' + x + ',' + y + 'h' + (w - r) + 'a' + r + ',' + r + ' 0 0 1 ' + r + ',' + r +
            'v' + (h - 2 * r) + 'a' + r + ',' + r + ' 0 0 1 ' + (-r) + ',' + r + 'h' + (-(w - r)) + 'z';
    return el('path', { d: d, fill: color, class: 'mark' }, g);
  }

  /* tooltip: values lead, labels follow; built with textContent only */
  var tip = document.getElementById('tooltip');
  function showTip(evt, title, rows) {
    tip.textContent = '';
    if (title) { var t = document.createElement('div'); t.className = 't-title'; t.textContent = title; tip.appendChild(t); }
    rows.forEach(function (r) {
      var row = document.createElement('div'); row.className = 't-row';
      var key = document.createElement('span'); key.className = 't-key'; key.style.background = r[2] || C.muted;
      var val = document.createElement('b'); val.textContent = r[1];
      var lab = document.createElement('span'); lab.textContent = r[0];
      row.appendChild(key); row.appendChild(val); row.appendChild(lab); tip.appendChild(row);
    });
    tip.hidden = false;
    var x, y;
    if (evt && evt.clientX !== undefined && evt.type !== 'focus') { x = evt.clientX; y = evt.clientY; }
    else { var b = evt.target.getBoundingClientRect(); x = b.left + b.width / 2; y = b.top; }
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    var left = Math.min(window.innerWidth - tw - 8, Math.max(8, x + 14));
    var top = y - th - 12; if (top < 8) top = y + 18;
    tip.style.left = left + 'px'; tip.style.top = top + 'px';
  }
  function hideTip() { tip.hidden = true; }
  function hoverable(node, title, rows) {
    node.setAttribute('tabindex', '0');
    node.setAttribute('role', 'img');
    node.setAttribute('aria-label', (title ? title + ': ' : '') + rows.map(function (r) { return r[0] + ' ' + r[1]; }).join(', '));
    node.addEventListener('pointermove', function (e) { showTip(e, title, rows); });
    node.addEventListener('pointerleave', hideTip);
    node.addEventListener('focus', function (e) { showTip(e, title, rows); });
    node.addEventListener('blur', hideTip);
  }

  /* ---------------------------------------------------------- results chart */
  var resultsView = 'main';
  function drawResults() {
    var box = document.getElementById('viz-results');
    if (!box) return;
    var view = RESULTS[resultsView];
    box.textContent = '';
    var table = document.createElement('table');
    var head = table.createTHead().insertRow();
    var modelHead = document.createElement('th');
    modelHead.scope = 'col'; modelHead.textContent = 'Model'; head.appendChild(modelHead);
    TASKS.forEach(function (task, i) {
      var th = document.createElement('th'); th.scope = 'col'; th.textContent = task;
      var name = document.createElement('small'); name.textContent = TASK_NAMES[i];
      th.appendChild(name); head.appendChild(th);
    });
    var body = table.createTBody();
    var rows = [['GPT-5 (thinking)', view.gpt], ['TRACER', view.tracer]];
    if (view.human) rows.unshift(['Human', view.human]);
    rows.forEach(function (item) {
      var row = body.insertRow();
      if (item[0] === 'TRACER') row.className = 'result-ours';
      var label = document.createElement('th'); label.scope = 'row'; label.textContent = item[0]; row.appendChild(label);
      item[1].forEach(function (v) { row.insertCell().textContent = fmt(v); });
    });
    var delta = body.insertRow(); delta.className = 'result-delta';
    var label = document.createElement('th'); label.scope = 'row';
    label.textContent = resultsView === 'main' ? 'TRACER − GPT-5' : 'Human − TRACER'; delta.appendChild(label);
    TASKS.forEach(function (_, i) {
      var diff = resultsView === 'main' ? view.tracer[i] - view.gpt[i] : view.human[i] - view.tracer[i];
      delta.insertCell().textContent = (diff >= 0 ? '+' : '−') + fmt(Math.abs(diff));
    });
    box.appendChild(table);
    document.getElementById('res-note').textContent = resultsView === 'main'
      ? 'Table 2. Avg. is the five-task mean. Average margin: +5.80 points (95% CI 4.42–7.17).'
      : 'Humans and models answer the same 50 questions per task (Appendix A.7). Human scores average two participants.';
  }

  /* --------------------------------------------------------- finding charts */
  var VIZ_H = 168;
  function drawHuman() {
    var box = document.getElementById('viz-human'); if (!box) return;
    var rows = [['Human', 79.15, C.human], ['TRACER', 63.58, C.tracer], ['GPT-5 (thinking)', 58.75, C.gpt]];
    var rowH = Math.floor((VIZ_H - 22) / 3), barH = 22, o = svgFor(box, VIZ_H), labelW = 118, x1 = o.w - 52;
    var sx = function (v) { return labelW + (x1 - labelW) * v / 100; };
    var g = el('g', {}, o.svg);
    [0, 50, 100].forEach(function (t) {
      el('line', { x1: sx(t), x2: sx(t), y1: 0, y2: 3 * rowH, class: 'gridline' }, g);
      txt(g, sx(t), o.h - 4, String(t), { 'text-anchor': 'middle', 'font-size': 11 });
    });
    rows.forEach(function (r, i) {
      var y = i * rowH + (rowH - barH) / 2;
      txt(g, 0, y + barH / 2 + 4.5, r[0], { 'font-size': 13, class: 'lab' });
      roundEndBar(g, sx(0), y, sx(r[1]) - sx(0), barH, r[2], 4);
      txt(g, sx(r[1]) + 6, y + barH / 2 + 4.5, fmt(r[1]), { 'font-size': 13, class: 'val' });
      var hit = el('rect', { x: 0, y: i * rowH, width: o.w, height: rowH, class: 'hit' }, g);
      hoverable(hit, 'Average on the human-matched subset', [[r[0], fmt(r[1]), r[2]]]);
    });
  }

  function drawFamily() {
    var box = document.getElementById('viz-family'); if (!box) return;
    var rowH = Math.floor((VIZ_H - 24) / FAMILIES.length), o = svgFor(box, VIZ_H), labelW = 130, x1 = o.w - 10;
    var sx = function (v) { return labelW + (x1 - labelW) * v / 60; };
    var g = el('g', {}, o.svg);
    [0, 20, 40, 60].forEach(function (t) {
      el('line', { x1: sx(t), x2: sx(t), y1: 0, y2: FAMILIES.length * rowH, class: 'gridline' }, g);
      txt(g, sx(t), o.h - 4, String(t), { 'text-anchor': 'middle', 'font-size': 11 });
    });
    FAMILIES.forEach(function (f, i) {
      var cy = i * rowH + rowH / 2;
      txt(g, 0, cy + 4.5, f.label, { 'font-size': 13, class: 'lab' });
      el('line', { x1: sx(0), x2: x1, y1: cy, y2: cy, stroke: C.grid }, g);
      f.models.forEach(function (m) {
        el('circle', { cx: sx(m[1]), cy: cy, r: 5, fill: C[f.key], stroke: C.surface, 'stroke-width': 2, class: 'mark' }, g);
        var hit = el('circle', { cx: sx(m[1]), cy: cy, r: 12, class: 'hit' }, g);
        hoverable(hit, f.label, [[m[0], fmt(m[1]), C[f.key]]]);
      });
    });
  }

  function drawSurface() {
    var box = document.getElementById('viz-surface'); if (!box) return;
    var narrow = box.clientWidth < 420, W = Math.max(280, Math.round(box.clientWidth));
    var pos = [], lx = 0, ly = 10;
    SURFACE_KEYS.forEach(function (k) {
      var wEst = 22 + k[0].length * 6.4;
      if (lx > 0 && lx + wEst > W) { lx = 0; ly += 19; }
      pos.push([lx, ly]); lx += wEst + 12;
    });
    var chartH = box.clientHeight || VIZ_H;
    var legendH = ly + 16, rowH = Math.floor((chartH - legendH - 4) / SURFACE.length), o = svgFor(box, chartH);
    var labelW = narrow ? 112 : 150, x1 = o.w - 2;
    var sx = function (v) { return labelW + (x1 - labelW) * v / 100; };
    var g = el('g', {}, o.svg);
    SURFACE_KEYS.forEach(function (k, j) {
      el('rect', { x: pos[j][0], y: pos[j][1] - 8, width: 10, height: 10, rx: 2, fill: k[1], stroke: j === 2 ? '#CDD3DC' : 'none' }, g);
      txt(g, pos[j][0] + 15, pos[j][1] + 1, k[0], { 'font-size': 12 });
    });
    SURFACE.forEach(function (r, i) {
      var h = Math.min(22, rowH - 10), y = legendH + i * rowH + (rowH - h) / 2 - 2;
      txt(g, 0, y + h / 2 - 3, r.label, { 'font-size': 12.5, class: 'lab' });
      txt(g, 0, y + h / 2 + 14, r.setting, { 'font-size': 11.5 });
      var acc = 0;
      r.v.forEach(function (v, j) {
        var xa = sx(acc), xb = sx(acc + v);
        var wseg = Math.max(0, xb - xa - (j < 2 ? 2 : 0)); // 2px surface gap between segments
        el('rect', { x: xa, y: y, width: wseg, height: h, fill: SURFACE_KEYS[j][1], rx: j === 2 ? 3 : 0, class: 'mark' }, g);
        var label = v + '%';
        if (j < 2 && wseg > label.length * 7 + 10) {
          txt(g, xa + wseg / 2, y + h / 2 + 4, label, { 'text-anchor': 'middle', 'font-size': 12, fill: j === 0 ? '#FFFFFF' : C.ink, 'font-weight': 600 });
        }
        acc += v;
      });
      var hit = el('rect', { x: 0, y: y - 4, width: o.w, height: rowH - 4, class: 'hit' }, g);
      hoverable(hit, r.label + ' · ' + r.setting, r.v.map(function (v, j) { return [SURFACE_KEYS[j][0], v + '%', SURFACE_KEYS[j][1] === '#E3E6EB' ? '#B9C0CB' : SURFACE_KEYS[j][1]]; }));
    });
  }

  function drawFab() {
    var box = document.getElementById('viz-fab'); if (!box) return;
    var o = svgFor(box, box.clientHeight || VIZ_H), left = 34, right = 120, top = 12, bottom = 44;
    var xs = function (i) { return left + 20 + (o.w - left - right - 40) * i / 2; };
    var ys = function (v) { return top + (o.h - top - bottom) * (1 - v / 20); };
    var g = el('g', {}, o.svg);
    [0, 5, 10, 15, 20].forEach(function (t) {
      el('line', { x1: left, x2: o.w - right + 10, y1: ys(t), y2: ys(t), class: 'gridline' }, g);
      txt(g, left - 6, ys(t) + 4, t + (t === 20 ? '%' : ''), { 'text-anchor': 'end', 'font-size': 11 });
    });
    var roomy = (xs(1) - xs(0)) > 96;   // sub-labels only when they cannot collide
    FAB.stages.forEach(function (s, i) {
      txt(g, xs(i), o.h - (roomy ? 23 : 10), s, { 'text-anchor': 'middle', 'font-size': 12, class: 'lab' });
      if (roomy) txt(g, xs(i), o.h - 4, FAB.stageSub[i], { 'text-anchor': 'middle', 'font-size': 11 });
    });
    var cross = el('line', { x1: 0, x2: 0, y1: top, y2: o.h - bottom, stroke: '#B9C0C7', 'stroke-width': 1, visibility: 'hidden' }, g);
    FAB.series.forEach(function (s) {
      var d = s.v.map(function (v, i) { return (i ? 'L' : 'M') + xs(i) + ',' + ys(v); }).join('');
      el('path', { d: d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', class: 'mark' }, g);
      s.v.forEach(function (v, i) { el('circle', { cx: xs(i), cy: ys(v), r: 4.5, fill: s.color, stroke: C.surface, 'stroke-width': 2 }, g); });
      // end label in ink, keyed by a short colored line
      var ey = ys(s.v[2]);
      el('line', { x1: xs(2) + 12, x2: xs(2) + 22, y1: ey, y2: ey, stroke: s.color, 'stroke-width': 2 }, g);
      txt(g, xs(2) + 26, ey + 4, fmt(s.v[2], 1) + '%  ' + s.name, { 'font-size': 12, class: 'val' });
    });
    // crosshair layer snapping to the nearest stage
    var hit = el('rect', { x: left, y: top, width: o.w - left - right + 20, height: o.h - top - bottom, class: 'hit' }, g);
    function at(e) {
      var pt = o.svg.getBoundingClientRect(); var scale = o.w / pt.width;
      var x = (e.clientX - pt.left) * scale, best = 0;
      for (var i = 1; i < 3; i++) if (Math.abs(xs(i) - x) < Math.abs(xs(best) - x)) best = i;
      return best;
    }
    function show(e, i) {
      cross.setAttribute('x1', xs(i)); cross.setAttribute('x2', xs(i)); cross.setAttribute('visibility', 'visible');
      showTip(e, FAB.stages[i] + ' · ' + FAB.stageSub[i], FAB.series.map(function (s) { return [s.name, fmt(s.v[i], 1) + '%', s.color]; }));
    }
    hit.addEventListener('pointermove', function (e) { show(e, at(e)); });
    hit.addEventListener('pointerleave', function () { cross.setAttribute('visibility', 'hidden'); hideTip(); });
    hit.setAttribute('tabindex', '0'); hit.setAttribute('role', 'img');
    hit.setAttribute('aria-label', 'Fabricated claims by stage. ' + FAB.series.map(function (s) { return s.name + ': ' + s.v.join('%, ') + '%'; }).join('. '));
    hit.addEventListener('focus', function (e) { show(e, 2); });
    hit.addEventListener('blur', function () { cross.setAttribute('visibility', 'hidden'); hideTip(); });
  }

  /* ------------------------------------------------------- derivation graph */
  var DNODES = [
    { id: 'o1', kind: 'obs', tag: 'Observation', text: 'Customer declares theft, employee offers another size', x: 0, y: 0, w: 230 },
    { id: 'a1', kind: 'app', tag: 'Appraisal', text: 'R: Protecting merchandise matters to me. C: I cannot physically intervene.', x: 0, y: 110, w: 230 },
    { id: 'o2', kind: 'obs', tag: 'Observation', text: 'The employee gives a stiff smile, his eyes darting, while offering another size.', x: 0, y: 300, w: 230 },
    { id: 'ext', kind: 'c', tag: 'External Reality', text: 'Theft exploiting store policy', x: 290, y: 20, w: 180, concl: true },
    { id: 'int', kind: 'c', tag: 'Internal Driver', text: 'Wants to protect stock', x: 290, y: 130, w: 180, concl: true },
    { id: 'sta', kind: 'a', tag: 'State', text: 'Surprise, anxiety', x: 525, y: 86, w: 160, concl: true },
    { id: 'man', kind: 'a', tag: 'Manifestation', text: 'Service smile', x: 525, y: 250, w: 160, concl: true },
    { id: 'a2', kind: 'app', tag: 'Appraisal', text: 'N: Role requires non-confrontation.', x: 735, y: 0, w: 170 },
    { id: 'reg', kind: 'a', tag: 'Regulation', text: 'Substitution to happiness', x: 735, y: 150, w: 170, concl: true },
    { id: 'a3', kind: 'app', tag: 'Appraisal', text: 'The employee has no authority to stop me.', x: 955, y: 0, w: 175, dash: true },
    { id: 'eff', kind: 'e', tag: 'Physical Effect', text: 'Leave with shoes', x: 955, y: 160, w: 175, concl: true, dash: true },
    { id: 'o3', kind: 'obs', tag: 'Observation', text: 'See? they can’t stop me', x: 955, y: 300, w: 175, dash: true }
  ];
  var DEDGES = [['o1', 'ext'], ['a1', 'ext'], ['o1', 'int'], ['a1', 'int'], ['ext', 'sta'], ['int', 'sta'], ['o2', 'sta', 0.9],
                ['o2', 'man'], ['sta', 'reg'], ['man', 'reg'], ['a2', 'reg'], ['reg', 'eff'], ['a3', 'eff'], ['o3', 'eff']];
  function wrap(s, maxChars) {
    var words = s.split(' '), lines = [], cur = '';
    words.forEach(function (w) { if ((cur + ' ' + w).trim().length > maxChars) { if (cur) lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); });
    if (cur) lines.push(cur);
    return lines;
  }
  function drawDerivation() {
    var box = document.getElementById('deriv'); if (!box) return;
    box.textContent = '';
    DNODES.forEach(function (n) {
      n.lines = wrap(n.text, Math.floor((n.w - 28) / 7.9));
      n.h = 31 + n.lines.length * 19;
    });
    var W = 1130, H = Math.max.apply(null, DNODES.map(function (n) { return n.y + n.h; })) + 6;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'group', 'aria-label': 'Premise-declared derivation graph' }, box);
    var defs = el('defs', {}, svg);
    var mk = el('marker', { id: 'arr', viewBox: '0 0 8 8', refX: 7, refY: 4, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
    el('path', { d: 'M0,0L8,4L0,8z', fill: '#A7B0BD' }, mk);
    var mk2 = el('marker', { id: 'arr-on', viewBox: '0 0 8 8', refX: 7, refY: 4, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
    el('path', { d: 'M0,0L8,4L0,8z', fill: C.ink }, mk2);
    var byId = {};
    DNODES.forEach(function (n) { byId[n.id] = n; });
    var gEdges = el('g', {}, svg), gNodes = el('g', {}, svg);
    var edgeEls = DEDGES.map(function (e) {
      var a = byId[e[0]], b = byId[e[1]], d;
      if (b.x - (a.x + a.w) > 20) {
        var f = e[2] || 0.5;   // where the curve turns; 0.9 keeps it low until it clears the boxes in between
        var x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x - 2, y2 = b.y + b.h / 2, mx = x1 + (x2 - x1) * f;
        d = f === 0.5 ? 'M' + x1 + ',' + y1 + ' C' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + x2 + ',' + y2
                      : 'M' + x1 + ',' + y1 + ' L' + (mx - 30) + ',' + y1 + ' C' + (mx + 10) + ',' + y1 + ' ' + (mx - 10) + ',' + y2 + ' ' + x2 + ',' + y2;
      } else {
        var down = a.y < b.y, xa = a.x + a.w / 2;
        var ya = down ? a.y + a.h : a.y, yb = down ? b.y - 2 : b.y + b.h + 2;
        d = 'M' + xa + ',' + ya + ' L' + xa + ',' + yb;
      }
      var p = el('path', { d: d, class: 'dedge', 'marker-end': 'url(#arr)' }, gEdges);
      p.dataset.from = e[0]; p.dataset.to = e[1];
      return p;
    });
    var nodeEls = {};
    DNODES.forEach(function (n) {
      var g = el('g', { class: 'dnode ' + n.kind + (n.dash ? ' dash' : '') + (n.concl ? ' concl' : ''), transform: 'translate(' + n.x + ',' + n.y + ')' }, gNodes);
      el('rect', { x: 0, y: 0, width: n.w, height: n.h, rx: 8, class: 'box' }, g);
      el('rect', { x: 6, y: 8, width: 3, height: n.h - 16, rx: 1.5, class: 'kbar' }, g);
      txt(g, 17, 19, n.tag, { class: 'ntag' });
      n.lines.forEach(function (l, i) { txt(g, 17, 40 + i * 19, l); });
      nodeEls[n.id] = g;
      if (n.concl) {
        g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button');
        g.setAttribute('aria-label', n.tag + ': ' + n.text + '. Show cited premises.');
        g.addEventListener('click', function () { select(n.id); });
        g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(n.id); } });
      }
    });
    var current = null, readout = document.getElementById('deriv-readout');
    function select(id) {
      if (current === id) { current = null; box.classList.remove('has-sel'); readout.textContent = 'Showing all premise links.'; clear(); return; }
      current = id; clear(); box.classList.add('has-sel');
      nodeEls[id].classList.add('on', 'target');
      var cites = [];
      edgeEls.forEach(function (p) {
        if (p.dataset.to === id) { p.classList.add('on'); p.setAttribute('marker-end', 'url(#arr-on)'); nodeEls[p.dataset.from].classList.add('on'); cites.push(byId[p.dataset.from]); }
      });
      var n = byId[id];
      readout.textContent = n.tag + ' “' + n.text + '” cites ' + cites.map(function (c) { return c.tag.toLowerCase() + ' “' + c.text.replace(/[.]$/, '') + '”'; }).join(', ') + '.';
    }
    function clear() {
      Object.keys(nodeEls).forEach(function (k) { nodeEls[k].classList.remove('on', 'target'); });
      edgeEls.forEach(function (p) { p.classList.remove('on'); p.setAttribute('marker-end', 'url(#arr)'); });
    }
    // list view for narrow screens, built from the same data
    var list = document.createElement('ul'); list.className = 'deriv-list';
    DNODES.filter(function (n) { return n.concl; }).forEach(function (n) {
      var li = document.createElement('li');
      var head = document.createElement('div');
      var kind = document.createElement('span'); kind.className = 'dl-kind';
      kind.style.color = { c: '#8A560B', a: '#A3304D', e: '#0A6B58' }[n.kind]; kind.textContent = n.tag;
      var concl = document.createElement('span'); concl.className = 'dl-concl'; concl.textContent = n.text;
      head.appendChild(kind); head.appendChild(concl); li.appendChild(head);
      var ul = document.createElement('ul');
      DEDGES.filter(function (e) { return e[1] === n.id; }).forEach(function (e) {
        var p = byId[e[0]], it = document.createElement('li'); it.textContent = p.tag + ': ' + p.text; ul.appendChild(it);
      });
      li.appendChild(ul); list.appendChild(li);
    });
    box.appendChild(list);
  }

  /* ------------------------------------------------ task spans (Section 4.1) */
  // Known (g) and queried (q) constructs per task, from the task mappings in the paper.
  // A trailing "d" marks constructs in square brackets: present only when annotated.
  var CONS = [
    { key: 'ext', name: 'External Reality', short: 'Ext.', stage: 'c' },
    { key: 'int', name: 'Internal Driver', short: 'Int.', stage: 'c' },
    { key: 'sta', name: 'State', short: 'State', stage: 'a' },
    { key: 'man', name: 'Manifestation', short: 'Man.', stage: 'a' },
    { key: 'reg', name: 'Regulation', short: 'Reg.', stage: 'a' },
    { key: 'eff', name: 'Effect', short: 'Effect', stage: 'e' }
  ];
  var STAGE_COL = { c: '#C47A12', a: '#C2415F', e: '#0E8C73' };
  var TASK_SPANS = [
    { group: 'Within a stage' },
    { id: 'T1', name: 'Grounded Affect Recognition', qa: '919', videos: '625',
      marks: { sta: 'q', man: 'q' },
      text: 'Given the context, which specifies the focal subject and episode, the model jointly predicts State and Manifestation.' },
    { id: 'T2', name: 'Regulation Decoding', qa: '401', videos: '344',
      marks: { sta: 'g', reg: 'q' },
      text: 'The task supplies the category under regulation, its intensity, and the affective object. The model infers Regulation and cites the manifestation cues that support it.' },
    { group: 'Across stages' },
    { id: 'T3', name: 'Affective Cause Reasoning', qa: '795', videos: '540',
      marks: { ext: 'q', int: 'qd', sta: 'g', man: 'g', reg: 'gd' },
      text: 'Given State (without its fine-grained description), Manifestation, and any annotated Regulation, the model infers External Reality and, when annotated, Internal Driver.' },
    { id: 'T4', name: 'Affective Effect Reasoning', qa: '1,123', videos: '418',
      marks: { sta: 'g', man: 'g', reg: 'gd', eff: 'q' },
      text: 'Given State (with its fine-grained description), Manifestation, and any annotated Regulation, the model predicts the consequence along the queried Effect channel for the specified recipient.' },
    { group: 'Full chain' },
    { id: 'T5', name: 'Full Chain Reconstruction', qa: '508', videos: '381',
      marks: { ext: 'q', int: 'qd', sta: 'q', man: 'q', reg: 'qd', eff: 'q' },
      text: 'From a context that identifies the focal subject, affective object, and episode anchor, the model reconstructs Condition and Affect together with the requested Effect channels.' }
  ];
  var MARK_WORD = { q: 'queried', qd: 'queried when annotated', g: 'supplied', gd: 'supplied when annotated' };

  function div(cls, text) { var d = document.createElement('div'); if (cls) d.className = cls; if (text) d.textContent = text; return d; }
  function span(cls, text) { var d = document.createElement('span'); if (cls) d.className = cls; if (text) d.textContent = text; return d; }

  function buildSpans() {
    var host = document.getElementById('spans'); if (!host) return;
    host.textContent = '';
    host.classList.add('sg');
    var st = div('sg-line sg-stage'); st.setAttribute('aria-hidden', 'true');
    st.appendChild(span('blank')); st.appendChild(span('c', 'Condition')); st.appendChild(span('a', 'Affect')); st.appendChild(span('e', 'Effect'));
    host.appendChild(st);
    var hd = div('sg-line sg-cons'); hd.setAttribute('aria-hidden', 'true');
    hd.appendChild(span('h-task', 'Task'));
    CONS.forEach(function (c) { var h = span('', c.name); h.dataset.short = c.short; hd.appendChild(h); });
    hd.appendChild(span('h-qa', 'QA pairs'));
    host.appendChild(hd);
    TASK_SPANS.forEach(function (t) {
      if (t.group) { host.appendChild(div('sg-group', t.group)); return; }
      var row = div('sg-line sg-row'); row.tabIndex = 0;
      var used = CONS.map(function (c, i) { return t.marks[c.key] ? i : -1; }).filter(function (i) { return i >= 0; });
      var i0 = Math.min.apply(null, used), i1 = Math.max.apply(null, used), n = i1 - i0 + 1;
      var name = div('sg-name'); name.appendChild(span('tchip', t.id)); name.appendChild(document.createTextNode(t.name));
      row.appendChild(name);
      var line = span('span'); line.style.gridColumn = (i0 + 2) + ' / ' + (i1 + 3); line.style.margin = '0 calc(50% / ' + n + ')';
      row.appendChild(line);
      var described = [];
      CONS.forEach(function (c, i) {
        var m = t.marks[c.key]; if (!m) return;
        var d = span('sg-dot ' + m.charAt(0) + (m.length > 1 ? ' dash' : ''));
        d.style.gridColumn = String(i + 2); d.style.setProperty('--col', STAGE_COL[c.stage]);
        row.appendChild(d);
        described.push(c.name + ' ' + MARK_WORD[m]);
      });
      var cnt = div('sg-count', t.qa + ' QA'); var sm = document.createElement('small'); sm.textContent = t.videos + ' videos'; cnt.appendChild(sm);
      row.appendChild(cnt);
      row.setAttribute('aria-label', t.id + ' ' + t.name + ': ' + described.join(', ') + '. ' + t.text);
      noteTip(row, t.id + ' · ' + t.name, t.text);
      host.appendChild(row);
    });
  }

  /* a tooltip that carries a sentence rather than values */
  function showNote(evt, title, text) {
    tip.textContent = '';
    var t = document.createElement('div'); t.className = 't-title'; t.textContent = title; tip.appendChild(t);
    var p = document.createElement('div'); p.className = 't-note'; p.textContent = text; tip.appendChild(p);
    tip.hidden = false;
    var x, y;
    if (evt && evt.clientX !== undefined && evt.type !== 'focus') { x = evt.clientX; y = evt.clientY; }
    else { var b = evt.target.getBoundingClientRect(); x = b.left + Math.min(b.width / 2, 160); y = b.top; }
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = Math.min(window.innerWidth - tw - 8, Math.max(8, x + 14)) + 'px';
    var top = y - th - 12; if (top < 8) top = y + 18; tip.style.top = top + 'px';
  }
  function noteTip(node, title, text) {
    node.addEventListener('pointermove', function (e) { showNote(e, title, text); });
    node.addEventListener('pointerleave', hideTip);
    node.addEventListener('focus', function (e) { showNote(e, title, text); });
    node.addEventListener('blur', hideTip);
  }
  function initDefs() {
    document.querySelectorAll('.node[data-def]').forEach(function (n) {
      n.tabIndex = 0;
      n.setAttribute('aria-label', n.textContent.trim() + '. ' + n.dataset.def);
      noteTip(n, n.textContent.trim(), n.dataset.def);
    });
  }

  /* ------------------------------- Blueprint connectors, placed by measurement */
  // f′(·) runs from the center of State to the center of Manifestation; each dashed arrow
  // meets the center of the Cause field it points to (Physical → External, Mental → Internal).
  function alignConnectors() {
    var fp = document.querySelector('.f-prime');
    if (fp && getComputedStyle(fp).display !== 'none') {
      var F = fp.getBoundingClientRect();
      var M = document.querySelector('.g-man').getBoundingClientRect();
      var S = document.querySelector('.g-sta').getBoundingClientRect();
      fp.style.setProperty('--top', (M.top + M.height / 2 - F.top).toFixed(1) + 'px');
      fp.style.setProperty('--bot', (F.bottom - (S.top + S.height / 2)).toFixed(1) + 'px');
    }
    var nodes = document.querySelectorAll('.g-cause .node');
    [['.d1', nodes[0]], ['.d2', nodes[2]]].forEach(function (pair) {
      var d = document.querySelector('.d-arrow' + pair[0]);
      if (!d || !pair[1] || getComputedStyle(d).display === 'none') return;
      var D = d.getBoundingClientRect(), T = pair[1].getBoundingClientRect();
      d.style.setProperty('--y', (T.top + T.height / 2 - D.top).toFixed(1) + 'px');
    });
  }

  /* -------------------------------------------------------------- case tabs */
  var CASES = [
    { img: 'assets/img/figures/fig12-t1.webp', w: 2000, h: 1316, ctx: 'The defendant’s response when Kevin explains the defense strategy.', alt: 'Case study for T1, grounded affect recognition.' },
    { img: 'assets/img/figures/fig12-t2.webp', w: 2000, h: 1316, ctx: 'Focus on the colleague as Laura confronts him.', alt: 'Case study for T2, regulation decoding.' },
    { img: 'assets/img/figures/fig12-t3.webp', w: 2000, h: 1627, ctx: 'The woman’s embarrassment as June probes her father’s interest in her.', alt: 'Case study for T3, affective cause reasoning.' },
    { img: 'assets/img/figures/fig12-t4.webp', w: 2000, h: 1627, ctx: 'Black Shirt’s hesitant explanation and its effect on Pink Shirt.', alt: 'Case study for T4, affective effect reasoning.' }
  ];
  function initCases() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.tabs [role="tab"]'));
    var img = document.getElementById('case-img'), ctx = document.getElementById('case-ctx'), panel = document.getElementById('panel-case');
    function choose(i, focus) {
      tabs.forEach(function (t, j) { t.setAttribute('aria-selected', String(i === j)); t.tabIndex = i === j ? 0 : -1; });
      var c = CASES[i];
      img.src = c.img; img.alt = c.alt; img.width = c.w; img.height = c.h; ctx.textContent = c.ctx;
      panel.setAttribute('aria-labelledby', tabs[i].id);
      if (focus) tabs[i].focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { choose(i); });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault(); choose((i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length, true);
        }
      });
    });
    document.getElementById('case-open').addEventListener('click', function () {
      openLightbox(img.getAttribute('src'), 'Fig. 12. ' + ctx.textContent + ' Text is condensed from the source records.');
    });
  }

  /* --------------------------------------------------------------- lightbox */
  var lb = document.getElementById('lightbox');
  function openLightbox(src, cap) {
    document.getElementById('lb-img').src = src;
    document.getElementById('lb-img').alt = cap || '';
    document.getElementById('lb-cap').textContent = cap || '';
    if (typeof lb.showModal === 'function') lb.showModal(); else window.open(src, '_blank');
  }
  function initLightbox() {
    document.querySelectorAll('[data-lightbox]').forEach(function (b) {
      b.addEventListener('click', function () { openLightbox(b.dataset.lightbox, b.dataset.caption); });
    });
    lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
  }

  /* ------------------------------------------------------------ nav + misc */
  function initLinks() {
    document.querySelectorAll('[data-link]').forEach(function (n) {
      var url = LINKS[n.dataset.link];
      if (!url || n.tagName === 'A') return;
      var a = document.createElement('a'); a.href = url;
      a.className = n.className.replace(/\b(is-soon|res-off)\b/g, '').trim();
      a.dataset.link = n.dataset.link;
      while (n.firstChild) a.appendChild(n.firstChild);
      a.querySelectorAll('em, small').forEach(function (x) { if (/soon/i.test(x.textContent)) x.remove(); });
      a.removeAttribute('aria-disabled'); n.replaceWith(a);
    });
  }
  function initHeader() {
    var hd = document.querySelector('.site-header');
    var on = function () { hd.classList.toggle('scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', on, { passive: true }); on();
  }

  function initNav() {
    var btn = document.querySelector('.menu-btn'), nav = document.getElementById('site-nav');
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open'); btn.setAttribute('aria-expanded', String(open));
    });
    nav.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }); });
    if (!('IntersectionObserver' in window)) return;
    var links = {}; nav.querySelectorAll('a').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && links[en.target.id]) {
          Object.keys(links).forEach(function (k) { links[k].classList.remove('active'); });
          links[en.target.id].classList.add('active');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(links).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
  }
  function initResultsToggle() {
    document.querySelectorAll('.seg-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        resultsView = b.dataset.view;
        document.querySelectorAll('.seg-btn').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        drawResults();
      });
    });
  }
  function initCopy() {
    document.querySelectorAll('[data-copy]').forEach(function (b) {
      b.addEventListener('click', function () {
        var text = document.querySelector(b.dataset.copy).textContent;
        var done = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1600); };
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
        function fallback() {
          var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); done(); } catch (e) { /* leave the text selectable */ }
          document.body.removeChild(ta);
        }
      });
    });
  }

  function initBlueprintTasks() {
    var diagram = document.querySelector('.bp-diagram');
    var buttons = document.querySelectorAll('[data-bp-task]');
    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        var task = TASK_SPANS.find(function (t) { return t.id === button.dataset.bpTask; });
        var marks = task ? task.marks : null;
        buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b === button)); });
        diagram.querySelectorAll('[data-bp-construct]').forEach(function (node) {
          var mark = marks && marks[node.dataset.bpConstruct];
          node.classList.toggle('bp-muted', !!marks && !mark);
          node.classList.toggle('bp-queried', !!mark && mark.charAt(0) === 'q');
          node.classList.toggle('bp-supplied', !!mark && mark.charAt(0) === 'g');
          node.classList.toggle('bp-optional', !!mark && mark.length > 1);
        });
        var edges = {
          manifestation: marks && marks.sta && marks.man,
          regulation: marks && marks.reg,
          cause: marks && marks.ext,
          effect: marks && marks.eff
        };
        diagram.querySelectorAll('[data-bp-edge]').forEach(function (edge) {
          edge.classList.toggle('bp-muted', !!marks && !edges[edge.dataset.bpEdge]);
          edge.classList.toggle('bp-edge-active', !!edges[edge.dataset.bpEdge]);
        });
        ['c', 'a', 'e'].forEach(function (stage) {
          var active = !marks || CONS.some(function (c) { return c.stage === stage && marks[c.key]; });
          diagram.querySelector('.band-' + stage).classList.toggle('bp-muted', !active);
        });
        document.getElementById('bp-readout').textContent = task ? task.text :
          'Select a task to highlight its supplied and queried constructs.';
        alignConnectors();
      });
    });
    document.querySelector('.method-detail').addEventListener('toggle', function (e) {
      if (e.target.open) drawDerivation();
    });
  }

  function initAnalysis() {
    var tabs = Array.from(document.querySelectorAll('.analysis-tabs [role="tab"]'));
    function choose(index, focus) {
      tabs.forEach(function (tab, i) {
        tab.setAttribute('aria-selected', String(i === index));
        tab.tabIndex = i === index ? 0 : -1;
        document.getElementById(tab.getAttribute('aria-controls')).hidden = i !== index;
      });
      if (focus) tabs[index].focus();
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { choose(i, false); });
      tab.addEventListener('keydown', function (e) {
        var next;
        if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') next = (i + tabs.length - 1) % tabs.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = tabs.length - 1;
        else return;
        e.preventDefault(); choose(next, true);
      });
    });
  }

  function drawAll() { drawResults(); drawHuman(); drawFamily(); drawSurface(); drawFab(); }
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { drawAll(); alignConnectors(); }, 120); });
  window.addEventListener('scroll', hideTip, { passive: true });

  initLinks(); initHeader(); initNav(); buildSpans(); initDefs(); initCases(); initLightbox(); initResultsToggle(); initCopy(); initBlueprintTasks();
  initAnalysis(); drawDerivation(); drawAll(); alignConnectors();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(alignConnectors);
  window.addEventListener('load', alignConnectors);
})();
