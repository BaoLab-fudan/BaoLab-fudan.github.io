/* Automatic cell communication field. No pointer input. */
(function () {
  'use strict';
  const canvas = document.getElementById('hero-canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const GLOW = [212, 170, 165], LINE = [184, 205, 221];
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  let W = 0, H = 0, cells = [], edges = [], routes = [];
  let frameId = 0, visible = false, time = 0, last = 0;
  function rand(seed) { const x = Math.sin(seed * 999.91) * 10000; return x - Math.floor(x); }
  function rgba(rgb, a) { return 'rgba(' + rgb.join(',') + ',' + a.toFixed(3) + ')'; }
  function buildCellPath(cell, scale) {
    const p = new Path2D();
    const s = cell.size * scale;
    const w = 0.11;   /* wobble factor */
    if (cell.shape === 0) {
      /* oval */
      p.ellipse(0, 0, s * 1.1, s * 0.78, cell.phase * 0.18, 0, Math.PI * 2);
    } else if (cell.shape === 1) {
      /* amoeba A */
      for (let i = 0; i < 18; i++) {
        const a = i / 18 * Math.PI * 2;
        const r = s * (0.86 + Math.sin(a * 3 + cell.phase) * w);
        const x = Math.cos(a) * r * 1.05;
        const y = Math.sin(a) * r * 0.84;
        i === 0 ? p.moveTo(x, y) : p.lineTo(x, y);
      }
      p.closePath();
    } else if (cell.shape === 2) {
      /* amoeba B */
      for (let i = 0; i < 20; i++) {
        const a = i / 20 * Math.PI * 2;
        const r = s * (0.78 + Math.cos(a * 2 - cell.phase) * 0.13);
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r * 1.1;
        i === 0 ? p.moveTo(x, y) : p.lineTo(x, y);
      }
      p.closePath();
    } else if (cell.shape === 3) {
      /* kidney */
      const r = s * 0.86;
      p.moveTo(-r, -r * 0.3);
      p.bezierCurveTo(-r * 0.85, -r,      r * 0.5,  -r * 1.02, r,  -r * 0.24);
      p.bezierCurveTo( r * 1.12,  r * 0.58, -r * 0.22, r * 1.08, -r * 0.9, r * 0.46);
      p.bezierCurveTo(-r * 1.14,  r * 0.24, -r * 1.08, -r * 0.02, -r, -r * 0.3);
      p.closePath();
    } else {
      /* teardrop */
      const r = s * 0.9;
      p.moveTo(0, -r);
      p.bezierCurveTo( r * 0.82, -r * 0.8,   r * 0.96,  r * 0.24, r * 0.38, r * 0.72);
      p.bezierCurveTo(-r * 0.28,  r * 1.12, -r * 1.02,  r * 0.36, -r * 0.82, -r * 0.32);
      p.bezierCurveTo(-r * 0.62, -r * 0.86, -r * 0.18, -r * 1.02, 0, -r);
      p.closePath();
    }
    return p;
  }


  function build() {
    W = canvas.offsetWidth; H = canvas.offsetHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cells = []; edges = []; routes = [];
    const gap = W < 640 ? 76 : 96;
    const cols = Math.ceil(W / gap) + 1, rows = Math.ceil(H / gap) + 1;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const seed = r * 131 + c * 37 + 11;
      const cell = {
        x: c * gap + (rand(seed) - 0.5) * gap * 0.48,
        y: r * gap + (rand(seed + 1) - 0.5) * gap * 0.48,
        size: 12 + rand(seed + 2) * 10,
        shape: Math.floor(rand(seed + 3) * 5), phase: rand(seed + 4) * Math.PI * 2,
        neighbors: [], activation: 0
      };
      cell.pOuter = buildCellPath(cell, 1); cell.pInner = buildCellPath(cell, 0.38);
      cells.push(cell);
    }
    // A sparse graph connects nearby cells; every signal follows a real edge.
    cells.forEach(function (cell, i) {
      const near = cells.map((n, j) => ({ j, d: Math.hypot(n.x - cell.x, n.y - cell.y) }))
        .filter(n => n.j !== i && n.d < gap * 1.5).sort((a, b) => a.d - b.d).slice(0, 3);
      near.forEach(function (n) {
        if (edges.some(e => e.a === n.j && e.b === i)) return;
        edges.push({ a: i, b: n.j });
        cell.neighbors.push(n.j); cells[n.j].neighbors.push(i);
      });
    });
    const count = W < 640 ? 3 : 5;
    for (let k = 0; k < count; k++) {
      const root = Math.floor(rand(k * 211 + 19) * cells.length);
      const visited = new Set([root]), queue = [{ id: root, depth: 0 }], branches = [];
      while (queue.length) {
        const current = queue.shift();
        if (current.depth >= 3) continue;
        cells[current.id].neighbors.slice(0, 3).forEach(function (id) {
          if (visited.has(id)) return;
          visited.add(id);
          branches.push({ a: current.id, b: id, start: current.depth * 2.4 });
          queue.push({ id, depth: current.depth + 1 });
        });
      }
      routes.push({ root, branches, offset: k * 3.8, color: k % 3 === 1 ? LINE : GLOW });
    }
  }
  function quiet(x, y) {
    const nx = (x - W * 0.5) / (W * 0.32), ny = (y - H * 0.48) / (H * 0.38);
    return 0.15 + 0.85 * Math.min(1, (nx * nx + ny * ny) * 0.65);
  }
  function point(cell, t) {
    return { x: cell.x + Math.sin(t * 0.22 + cell.phase) * 5,
             y: cell.y + Math.cos(t * 0.18 + cell.phase) * 5 };
  }
  function path(a, b) {
    ctx.beginPath(); ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo((a.x + b.x) / 2 + (b.y - a.y) * 0.1,
      (a.y + b.y) / 2 - (b.x - a.x) * 0.1, b.x, b.y);
  }
  function draw(t) {
    ctx.fillStyle = '#1d2b36'; ctx.fillRect(0, 0, W, H);
    const positions = cells.map(c => point(c, t));
    cells.forEach(c => { c.activation = 0; });
    edges.forEach(function (edge) {
      const a = positions[edge.a], b = positions[edge.b];
      path(a, b); ctx.strokeStyle = rgba(LINE, 0.08 * quiet((a.x + b.x) / 2, (a.y + b.y) / 2));
      ctx.lineWidth = 0.7; ctx.stroke();
    });
    routes.forEach(function (route) {
      const phase = (t + route.offset) % 19;
      cells[route.root].activation = Math.max(cells[route.root].activation, Math.max(0, 1 - phase / 3));
      route.branches.forEach(function (branch) {
        const progress = (phase - branch.start) / 2.4;
        const arrival = phase - branch.start - 2.4;
        if (arrival >= 0 && arrival < 3.5) {
          cells[branch.b].activation = Math.max(cells[branch.b].activation, Math.exp(-arrival * 0.9));
        }
        if (progress < 0 || progress > 1) return;
        const a = positions[branch.a], b = positions[branch.b], u = 1 - progress;
        const cx = (a.x + b.x) / 2 + (b.y - a.y) * 0.1;
        const cy = (a.y + b.y) / 2 - (b.x - a.x) * 0.1;
        const x = u*u*a.x + 2*u*progress*cx + progress*progress*b.x;
        const y = u*u*a.y + 2*u*progress*cy + progress*progress*b.y;
        const fade = quiet(x, y) * Math.sin(Math.PI * progress);
        path(a, b); ctx.strokeStyle = rgba(route.color, fade * 0.24); ctx.stroke();
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 16);
        glow.addColorStop(0, rgba(route.color, fade * 0.5)); glow.addColorStop(1, rgba(route.color, 0));
        ctx.fillStyle = glow; ctx.fillRect(x - 16, y - 16, 32, 32);
        ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = rgba(route.color, fade * 0.9); ctx.fill();
      });
    });
    cells.forEach(function (cell, i) {
      const p = positions[i], activation = cell.activation, fade = quiet(p.x, p.y);
      ctx.save(); ctx.translate(p.x, p.y);
      ctx.rotate(Math.sin(t * 0.12 + cell.phase) * 0.12);
      const breath = 1 + Math.sin(t * 0.5 + cell.phase) * 0.035 + activation * 0.06;
      ctx.scale(breath, breath);
      ctx.fillStyle = rgba(GLOW, (0.015 + activation * 0.18) * fade); ctx.fill(cell.pOuter);
      ctx.strokeStyle = rgba(activation > 0.2 ? GLOW : LINE, (0.22 + activation * 0.48) * fade);
      ctx.lineWidth = 1; ctx.stroke(cell.pOuter);
      ctx.fillStyle = rgba(LINE, (0.05 + activation * 0.2) * fade); ctx.fill(cell.pInner);
      ctx.strokeStyle = rgba(LINE, 0.15 * fade); ctx.lineWidth = 0.6; ctx.stroke(cell.pInner);
      ctx.restore();
    });
    const bottom = ctx.createLinearGradient(0, H * 0.7, 0, H);
    bottom.addColorStop(0, 'rgba(36,52,65,0)'); bottom.addColorStop(1, '#243441');
    ctx.fillStyle = bottom; ctx.fillRect(0, 0, W, H);
  }
  function loop(now) {
    frameId = 0;
    if (!visible || document.hidden || media.matches) return;
    if (last) time += Math.min((now - last) / 1000, 0.05);
    last = now; draw(time); frameId = requestAnimationFrame(loop);
  }
  function sync() {
    cancelAnimationFrame(frameId); frameId = 0; last = 0;
    if (media.matches) draw(4.5);
    else if (visible && !document.hidden) frameId = requestAnimationFrame(loop);
  }
  let resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (canvas.offsetWidth !== W || canvas.offsetHeight !== H) { build(); draw(media.matches ? 4.5 : time); }
    }, 150);
  });
  document.addEventListener('visibilitychange', sync);
  media.addEventListener('change', sync);
  build(); draw(media.matches ? 4.5 : 0);
  new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; sync(); },
    { threshold: 0.01 }).observe(canvas);
})();
