/* ============================================================
   Bao Lab — Subpage Background
   A full-page, animated "living network": organic cells as
   nodes, linked by faint synapse-like edges, with occasional
   signal pulses travelling between them — cell biology meets
   neural network. Gentle, slow, and dimmed through the centre
   so page text stays readable.
   Reuses the homepage palette + organic cell shapes.

   Drop into any non-home page, just before animations.js:
     <script src="page-bg.js"></script>
   ============================================================ */
(function () {
  'use strict';

  var GLOW = [212, 170, 165]; /* rose  */
  var LINE = [184, 205, 221]; /* sky   */
  var SAGE = [169, 182, 158]; /* sage  */
  var TEXT = [241, 240, 236]; /* cloud */
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function rgba(rgb, a) {
    return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a.toFixed(3) + ')';
  }
  function rand(seed) {
    var x = Math.sin(seed * 999.91) * 10000;
    return x - Math.floor(x);
  }

  /* keep content above the layer */
  var st = document.createElement('style');
  st.textContent =
    '.page-bg-layer{position:fixed;inset:0;width:100%;height:100%;' +
    'z-index:0;pointer-events:none;}' +
    '.page-content{position:relative;z-index:1;}';
  document.head.appendChild(st);

  var canvas = document.createElement('canvas');
  canvas.className = 'page-bg-layer';
  document.body.insertBefore(canvas, document.body.firstChild);
  var ctx = canvas.getContext('2d');

  /* ── 5 organic cell shapes (from the homepage hero) ────── */
  function drawCellPath(size, shape, phase, scale) {
    var s = size * scale;
    ctx.beginPath();
    if (shape === 0) {
      ctx.ellipse(0, 0, s * 1.1, s * 0.78, phase * 0.18, 0, Math.PI * 2);
    } else if (shape === 1) {
      for (var i = 0; i < 18; i++) {
        var a = i / 18 * Math.PI * 2;
        var r = s * (0.86 + Math.sin(a * 3 + phase) * 0.11);
        var x = Math.cos(a) * r * 1.05, y = Math.sin(a) * r * 0.84;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
    } else if (shape === 2) {
      for (var j = 0; j < 20; j++) {
        var a2 = j / 20 * Math.PI * 2;
        var r2 = s * (0.78 + Math.cos(a2 * 2 - phase) * 0.13);
        var x2 = Math.cos(a2) * r2, y2 = Math.sin(a2) * r2 * 1.1;
        j === 0 ? ctx.moveTo(x2, y2) : ctx.lineTo(x2, y2);
      }
      ctx.closePath();
    } else if (shape === 3) {
      var rk = s * 0.86;
      ctx.moveTo(-rk, -rk * 0.3);
      ctx.bezierCurveTo(-rk * 0.85, -rk, rk * 0.5, -rk * 1.02, rk, -rk * 0.24);
      ctx.bezierCurveTo(rk * 1.12, rk * 0.58, -rk * 0.22, rk * 1.08, -rk * 0.9, rk * 0.46);
      ctx.bezierCurveTo(-rk * 1.14, rk * 0.24, -rk * 1.08, -rk * 0.02, -rk, -rk * 0.3);
      ctx.closePath();
    } else {
      var rt = s * 0.9;
      ctx.moveTo(0, -rt);
      ctx.bezierCurveTo(rt * 0.82, -rt * 0.8, rt * 0.96, rt * 0.24, rt * 0.38, rt * 0.72);
      ctx.bezierCurveTo(-rt * 0.28, rt * 1.12, -rt * 1.02, rt * 0.36, -rt * 0.82, -rt * 0.32);
      ctx.bezierCurveTo(-rt * 0.62, -rt * 0.86, -rt * 0.18, -rt * 1.02, 0, -rt);
      ctx.closePath();
    }
  }

  var nodes = [], edges = [], pulses = [];
  var W = 0, H = 0, DPR = 1, t0 = performance.now();

  /* smoothstep centre-dim: text column stays quiet, edges livelier */
  function centreFade(x) {
    var cx = Math.abs(x / W - 0.5);
    return 0.34 + Math.min(1, Math.max(0, (cx - 0.15) * 3.4)) * 0.66;
  }

  function build() {
    nodes = []; edges = []; pulses = [];
    var gap  = W < 640 ? 74 : 96;             /* node spacing  */
    var cols = Math.ceil(W / gap) + 2;
    var rows = Math.ceil(H / gap) + 2;
    var ox   = (W - (cols - 1) * gap) / 2;
    var oy   = (H - (rows - 1) * gap) / 2;
    var idx  = {};

    for (var r = 0; r < rows; r++) for (var cl = 0; cl < cols; cl++) {
      var seed = r * 131 + cl * 37 + 11;
      /* jitter the grid so it reads organic, not gridded */
      var jx = (rand(seed + 1) - 0.5) * gap * 0.62;
      var jy = (rand(seed + 2) - 0.5) * gap * 0.62;
      var id = nodes.length;
      idx[r + ',' + cl] = id;
      nodes.push({
        r: r, c: cl,
        bx: ox + cl * gap + jx, by: oy + r * gap + jy,   /* base pos */
        x: 0, y: 0,
        size:  9 + rand(seed + 3) * 11,
        shape: Math.floor(rand(seed + 4) * 5),
        bit:   rand(seed + 5) > 0.5 ? 1 : 0,
        phase: rand(seed + 6) * Math.PI * 2,
        speed: (0.5 + rand(seed + 7) * 0.6) * 0.42,       /* slow pulse */
        drift: 0.05 + rand(seed + 8) * 0.09,              /* float amount */
        driftPh: rand(seed + 9) * Math.PI * 2,
        tone:  rand(seed + 10)                            /* colour pick */
      });
    }

    /* connect each node to right / down / down-right / down-left
       neighbours — a triangulated mesh without O(n^2) cost */
    function link(aId, r2, c2) {
      var bId = idx[r2 + ',' + c2];
      if (bId === undefined) return;
      edges.push({ a: aId, b: bId,
        seed: aId * 7 + bId * 3,
        base: 0.5 + rand(aId * 13 + bId * 5) * 0.5 });   /* some edges dropped */
    }
    for (var rr = 0; rr < rows; rr++) for (var cc = 0; cc < cols; cc++) {
      var a = idx[rr + ',' + cc];
      if (rand(a * 17 + 3) > 0.22) link(a, rr, cc + 1);
      if (rand(a * 19 + 5) > 0.22) link(a, rr + 1, cc);
      if (rand(a * 23 + 7) > 0.52) link(a, rr + 1, cc + 1);
      if (rand(a * 29 + 9) > 0.52) link(a, rr + 1, cc - 1);
    }

    /* signal pulses — a handful travelling along random edges */
    var nPulse = Math.max(4, Math.min(14, Math.round(edges.length / 26)));
    for (var p = 0; p < nPulse; p++) {
      pulses.push(spawnPulse(p * 97 + 5, rand(p * 41 + 3) * 6));
    }
  }

  function spawnPulse(seed, delay) {
    var e = Math.floor(rand(seed) * edges.length);
    return {
      edge: e,
      dir:  rand(seed + 1) > 0.5 ? 1 : 0,        /* a→b or b→a */
      t:    -delay,                              /* start offset */
      dur:  2.6 + rand(seed + 2) * 3.2,          /* seconds to cross */
      tone: rand(seed + 3),
      seed: seed
    };
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.offsetWidth; H = canvas.offsetHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    build();
  }

  function toneColor(tone) {
    return tone > 0.66 ? GLOW : (tone > 0.33 ? LINE : SAGE);
  }

  function frame(time) {
    ctx.clearRect(0, 0, W, H);

    /* 1 ── update node positions (gentle float) + brightness */
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      n.x = n.bx + Math.sin(time * n.drift + n.driftPh) * 9;
      n.y = n.by + Math.cos(time * n.drift * 0.8 + n.driftPh) * 9;
      var wave = 0.5 + Math.sin(time * n.speed + n.phase) * 0.5;
      n.lit = wave * wave * (3 - 2 * wave);
    }

    /* 2 ── edges (draw first, under nodes) */
    ctx.lineWidth = 1;
    for (var e = 0; e < edges.length; e++) {
      var ed = edges[e];
      var a = nodes[ed.a], b = nodes[ed.b];
      var cf = centreFade((a.x + b.x) / 2);
      var glow = (a.lit + b.lit) * 0.5;
      var alpha = (0.02 + glow * 0.07) * ed.base * cf;
      if (alpha < 0.004) continue;
      ctx.strokeStyle = rgba(LINE, alpha);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    /* 3 ── signal pulses travelling along edges */
    for (var p = 0; p < pulses.length; p++) {
      var pu = pulses[p];
      pu.t += 1 / 60;
      var prog = pu.t / pu.dur;
      if (prog >= 1) { pulses[p] = spawnPulse(pu.seed + 131, rand(pu.seed + time * 7 % 997) * 2.5); continue; }
      if (prog < 0) continue;
      var ed2 = edges[pu.edge];
      if (!ed2) continue;
      var na = nodes[pu.dir ? ed2.a : ed2.b];
      var nb = nodes[pu.dir ? ed2.b : ed2.a];
      var ease = prog < 0.5 ? 2 * prog * prog : 1 - Math.pow(-2 * prog + 2, 2) / 2;
      var px = na.x + (nb.x - na.x) * ease;
      var py = na.y + (nb.y - na.y) * ease;
      var fade = Math.sin(prog * Math.PI);          /* in-out along path */
      var cf2 = centreFade(px);
      var col = toneColor(pu.tone);
      var a1 = 0.5 * fade * cf2;
      /* glow */
      var g = ctx.createRadialGradient(px, py, 0, px, py, 9);
      g.addColorStop(0, rgba(col, a1));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2); ctx.fill();
      /* core */
      ctx.fillStyle = rgba(TEXT, a1 * 0.9);
      ctx.beginPath(); ctx.arc(px, py, 1.4, 0, Math.PI * 2); ctx.fill();
    }

    /* 4 ── nodes (organic cells) */
    for (var k = 0; k < nodes.length; k++) {
      var c = nodes[k];
      var cf3 = centreFade(c.x);
      var lit = c.lit;
      var alpha = (0.03 + lit * 0.13) * cf3;
      if (alpha < 0.006) continue;
      var col2 = lit > 0.55 ? toneColor(c.tone) : LINE;

      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(Math.sin(c.phase + time * 0.05) * 0.22);

      /* faint fill when lit */
      drawCellPath(c.size, c.shape, c.phase, 1);
      ctx.fillStyle = rgba(col2, alpha * 0.16);
      ctx.fill();
      ctx.strokeStyle = rgba(col2, alpha);
      ctx.stroke();

      /* inner membrane */
      drawCellPath(c.size, c.shape, c.phase, 0.44);
      ctx.strokeStyle = rgba(TEXT, alpha * 0.28);
      ctx.stroke();

      /* binary digit once bright enough */
      if (lit > 0.62) {
        ctx.fillStyle = rgba(TEXT, (lit - 0.62) * 0.34 * cf3);
        ctx.font = Math.max(9, c.size * 0.62) + 'px ui-monospace,Menlo,monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(c.bit), 0, 1);
      }
      ctx.restore();
    }
  }

  function loop(now) {
    frame((now - t0) / 1000);
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);
  resize();
  if (reduced) frame(3.7); else requestAnimationFrame(loop);
})();
