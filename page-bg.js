/* ============================================================
   Bao Lab — Subpage Background
   A full-page, animated cell field: faint organic cells drift
   and breathe; small groups of slow rose "signal" dots roam
   the space, converging together on a target cell and lighting
   it up (filling it with colour that then fades), before moving
   on to another cell. Heavily dimmed through the centre so page
   text stays crisp. Reuses the homepage organic cell shapes.

   Drop into any non-home page, just before animations.js:
     <script src="page-bg.js"></script>
   ============================================================ */
(function () {
  'use strict';

  var ROSE = [212, 170, 165]; /* rose  — the ambient accent (dominant) */
  var DEEP = [198, 138, 132]; /* deeper rose for variation */
  var SKY  = [184, 205, 221]; /* sky   — cool minority accent */
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

  var nodes = [], groups = [];
  var W = 0, H = 0, DPR = 1, t0 = performance.now();
  var R = 52;                 /* dot → cell activation radius */
  var curTime = 0;            /* latest sim time (seconds) */

  /* ── cross-page continuity: resume the field after navigation ─ */
  var STORE = 'baolab_bg_v1';
  var pendingRestore = (function () {
    try {
      var s = JSON.parse(sessionStorage.getItem(STORE));
      if (s && Date.now() - s.savedAt < 5000) return s;   /* recent nav only */
    } catch (e) {}
    return null;
  })();

  /* smoothstep centre-dim: text column goes quiet, edges livelier */
  function centreFade(x) {
    var cx = Math.abs(x / W - 0.5);
    return 0.12 + Math.min(1, Math.max(0, (cx - 0.14) * 3.2)) * 0.88;
  }

  function toneColor(tone) {
    return tone > 0.82 ? SKY : (tone > 0.5 ? DEEP : ROSE);
  }

  function randNodeId(seed) {
    return Math.floor(rand(seed) * nodes.length);
  }

  /* pick a fresh target a moderate distance from the current one */
  function pickTarget(fromId, seed) {
    var f = nodes[fromId];
    for (var i = 0; i < 12; i++) {
      var id = randNodeId(seed + i * 17.3);
      var n = nodes[id];
      var d = Math.hypot(n.x - f.x, n.y - f.y);
      if (d > 150 && d < 460) return id;
    }
    return randNodeId(seed + 91);
  }

  function build() {
    nodes = []; groups = [];
    var gap  = W < 640 ? 62 : 78;             /* cell spacing */
    var cols = Math.ceil(W / gap) + 2;
    var rows = Math.ceil(H / gap) + 2;
    var ox   = (W - (cols - 1) * gap) / 2;
    var oy   = (H - (rows - 1) * gap) / 2;

    for (var r = 0; r < rows; r++) for (var cl = 0; cl < cols; cl++) {
      var seed = r * 131 + cl * 37 + 11;
      var jx = (rand(seed + 1) - 0.5) * gap * 0.62;
      var jy = (rand(seed + 2) - 0.5) * gap * 0.62;
      nodes.push({
        bx: ox + cl * gap + jx, by: oy + r * gap + jy,
        x: ox + cl * gap + jx, y: oy + r * gap + jy, act: 0,
        size:  9 + rand(seed + 3) * 11,
        shape: Math.floor(rand(seed + 4) * 5),
        phase: rand(seed + 6) * Math.PI * 2,
        drift: 0.05 + rand(seed + 8) * 0.09,
        driftPh: rand(seed + 9) * Math.PI * 2,
        breathPh: rand(seed + 11) * Math.PI * 2,
        spin:  (rand(seed + 12) - 0.5) * 0.10,
        tone:  rand(seed + 10)
      });
    }

    /* signal-dot groups — each is a little swarm converging on a
       shared target cell, then moving on to the next */
    var nGroup = Math.max(4, Math.min(13, Math.round(nodes.length / 22)));
    for (var g = 0; g < nGroup; g++) {
      var gs = g * 211 + 17;
      var target = randNodeId(gs);
      var t = nodes[target];
      var count = 4 + Math.floor(rand(gs + 1) * 4);        /* 4–7 dots */
      var members = [];
      for (var d = 0; d < count; d++) {
        var ds = gs + d * 29 + 3;
        members.push({
          /* start scattered near the target */
          x: t.x + (rand(ds) - 0.5) * 260,
          y: t.y + (rand(ds + 1) - 0.5) * 260,
          spd:  16 + rand(ds + 2) * 14,        /* slow: 16–30 px/s */
          size: 1.2 + rand(ds + 3) * 1.0,
          oa:   rand(ds + 4) * Math.PI * 2,    /* offset around the cell */
          orr:  10 + rand(ds + 5) * 26,
          wob:  rand(ds + 6) * Math.PI * 2
        });
      }
      groups.push({ target: target, tone: rand(gs + 7), dots: members, seed: gs });
    }

    /* resume from the previous page if the layout matches */
    if (pendingRestore && pendingRestore.w === W && pendingRestore.h === H &&
        pendingRestore.acts && pendingRestore.acts.length === nodes.length &&
        pendingRestore.groups && pendingRestore.groups.length === groups.length) {
      for (var ri = 0; ri < nodes.length; ri++) nodes[ri].act = pendingRestore.acts[ri] || 0;
      for (var gj = 0; gj < groups.length; gj++) {
        var sg = pendingRestore.groups[gj];
        groups[gj].target = sg.target;
        groups[gj].tone = sg.tone;
        for (var dj = 0; dj < groups[gj].dots.length && dj < sg.dots.length; dj++) {
          var sd = sg.dots[dj], dd = groups[gj].dots[dj];
          dd.x = sd.x; dd.y = sd.y; dd.spd = sd.spd; dd.size = sd.size;
          dd.oa = sd.oa; dd.orr = sd.orr; dd.wob = sd.wob;
        }
      }
      /* advance the clock across the (brief) reload gap for seamless motion */
      var resume = pendingRestore.time + (Date.now() - pendingRestore.savedAt) / 1000;
      t0 = performance.now() - resume * 1000;
    }
    pendingRestore = null;
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.offsetWidth; H = canvas.offsetHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    build();
  }

  var prevT = -1;

  function frame(time) {
    var dt = prevT < 0 ? 0.016 : Math.min(0.05, time - prevT);
    prevT = time;
    curTime = time;
    ctx.clearRect(0, 0, W, H);

    /* 1 ── cells: gentle float + activation decay */
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      n.x = n.bx + Math.sin(time * n.drift + n.driftPh) * 9;
      n.y = n.by + Math.cos(time * n.drift * 0.8 + n.driftPh) * 9;
      n.act -= dt * 0.5;                             /* fade over ~2s */
      if (n.act < 0) n.act = 0;
    }

    /* 2 ── dot groups: swarm toward the shared target cell, light
            cells they pass, and retarget once they've converged */
    var R2 = R * R;
    for (var gi = 0; gi < groups.length; gi++) {
      var G = groups[gi];
      var tn = nodes[G.target];
      var sumd = 0;
      for (var p = 0; p < G.dots.length; p++) {
        var o = G.dots[p];
        var aim = { x: tn.x + Math.cos(o.oa) * o.orr, y: tn.y + Math.sin(o.oa) * o.orr };
        var dx = aim.x - o.x, dy = aim.y - o.y;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        o.wob += dt * 0.5;
        var wob = 5;
        o.x += (dx / dist * o.spd + Math.cos(o.wob) * wob) * dt;
        o.y += (dy / dist * o.spd + Math.sin(o.wob * 1.3) * wob) * dt;
        sumd += Math.hypot(tn.x - o.x, tn.y - o.y);

        /* light up cells this dot is near (target gets hit by many
           dots at once → strong activation) */
        for (var q = 0; q < nodes.length; q++) {
          var nd = nodes[q];
          var ex = nd.x - o.x, ey = nd.y - o.y;
          var e2 = ex * ex + ey * ey;
          if (e2 < R2) {
            var prox = 1 - Math.sqrt(e2) / R;
            if (prox > nd.act) { nd.act = prox; nd.tone = G.tone; }
          }
        }
      }
      /* converged → pick a new target, drift the colour occasionally */
      if (sumd / G.dots.length < R * 0.75) {
        G.target = pickTarget(G.target, G.seed + Math.floor(time * 7) + 1);
        if (rand(G.seed + Math.floor(time * 13)) < 0.16) G.tone = rand(G.seed + time * 3 % 991);
      }
    }

    /* 3 ── draw cells — fill with colour driven by activation */
    for (var k = 0; k < nodes.length; k++) {
      var c = nodes[k];
      var cf = centreFade(c.x);
      var lit = Math.min(1, 0.085 + Math.sin(time * 0.5 + c.breathPh) * 0.03 + c.act);
      var alpha = (0.02 + lit * 0.17) * cf;
      if (alpha < 0.005) continue;
      var col = toneColor(c.tone);
      var breath = 1 + Math.sin(time * 0.5 + c.breathPh) * 0.09 + c.act * 0.12;

      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.phase + time * c.spin);

      /* activation halo */
      if (c.act > 0.05) {
        var hr = c.size * 2.9 * breath;
        var hg = ctx.createRadialGradient(0, 0, 0, 0, 0, hr);
        hg.addColorStop(0, rgba(col, c.act * 0.30 * cf));
        hg.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(0, 0, hr, 0, Math.PI * 2); ctx.fill();
      }

      /* cell wall — fill scales strongly with activation */
      drawCellPath(c.size, c.shape, c.phase, breath);
      ctx.fillStyle = rgba(col, (0.06 + c.act * 0.7) * cf);
      ctx.fill();
      ctx.strokeStyle = rgba(col, alpha + c.act * 0.3 * cf);
      ctx.lineWidth = 1;
      ctx.stroke();

      /* nucleus — light-grey fill, offset from the cell body */
      drawCellPath(c.size, c.shape, c.phase + 1.7, 0.4 * breath);
      ctx.fillStyle = rgba(TEXT, (0.05 + c.act * 0.4) * cf);
      ctx.fill();
      ctx.strokeStyle = rgba(TEXT, (alpha + c.act * 0.28 * cf) * 0.7);
      ctx.lineWidth = 0.8;
      ctx.stroke();

      ctx.restore();
    }

    /* 4 ── draw the dots themselves (over the cells) */
    for (var m = 0; m < groups.length; m++) {
      var G2 = groups[m];
      var col2 = toneColor(G2.tone);
      for (var mm = 0; mm < G2.dots.length; mm++) {
        var o2 = G2.dots[mm];
        var cf2 = centreFade(o2.x);
        var a1 = 0.6 * cf2;
        if (a1 < 0.02) continue;
        var g = ctx.createRadialGradient(o2.x, o2.y, 0, o2.x, o2.y, o2.size * 6);
        g.addColorStop(0, rgba(col2, a1));
        g.addColorStop(1, rgba(col2, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(o2.x, o2.y, o2.size * 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = rgba(TEXT, a1 * 0.9);
        ctx.beginPath(); ctx.arc(o2.x, o2.y, o2.size, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function loop(now) {
    frame((now - t0) / 1000);
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);
  resize();
  if (reduced) frame(3.7); else requestAnimationFrame(loop);

  /* save the field so the next page can pick it up mid-flow */
  function saveState() {
    try {
      sessionStorage.setItem(STORE, JSON.stringify({
        savedAt: Date.now(), time: curTime, w: W, h: H,
        acts: nodes.map(function (n) { return +n.act.toFixed(3); }),
        groups: groups.map(function (G) {
          return { target: G.target, tone: G.tone,
            dots: G.dots.map(function (o) {
              return { x: Math.round(o.x), y: Math.round(o.y), spd: o.spd,
                       size: o.size, oa: o.oa, orr: o.orr, wob: o.wob };
            }) };
        })
      }));
    } catch (e) {}
  }
  window.addEventListener('pagehide', saveState);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') saveState();
  });
})();
