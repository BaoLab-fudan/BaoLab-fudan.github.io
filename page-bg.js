/* Bao Lab — a perspective-projected 3D biological field.
   World-space cells and signals are rendered back to front on Canvas 2D.
   No external dependencies; the live scene survives internal navigation. */
(function () {
  'use strict';

  var palette = [[212, 170, 165], [184, 205, 221], [169, 182, 158]];
  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var pointerMedia = window.matchMedia('(hover: hover) and (pointer: fine)');
  var reduced = motion.matches;
  var canvas = document.createElement('canvas');
  canvas.className = 'page-bg-layer';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(canvas, document.body.firstChild);
  var ctx = canvas.getContext('2d');
  if (!ctx) { canvas.remove(); return; }

  var W = 0, H = 0, dpr = 1, focal = 900;
  var cells = [], dust = [], signals = [];
  var clock = 0, last = 0, frameId = 0;
  var pointer = { x: 0, y: 0 }, camera = { x: 0, y: 0 };
  var yaw = 0, pitch = 0;
  var STORE = 'baolab_bg_3d_v1';
  var restored = false;
  try {
    var saved = JSON.parse(sessionStorage.getItem(STORE));
    if (saved && Date.now() - saved.savedAt < 5000 && Number.isFinite(saved.time)) {
      clock = saved.time;
      restored = true;
    }
  } catch (error) {}

  function rand(seed) {
    var x = Math.sin(seed * 999.91) * 10000;
    return x - Math.floor(x);
  }
  function rgba(color, alpha) {
    return 'rgba(' + color.join(',') + ',' + Math.max(0, Math.min(1, alpha)) + ')';
  }
  function quietCenter(x) {
    var edge = Math.min(1, Math.abs(x / W - 0.5) * 2);
    // Quiet the text column on narrow screens as well as wide screens.
    return 0.13 + Math.pow(edge, 1.8) * 0.77;
  }

  // Preserve simple organic cell drawings; depth comes from world positions.
  function cellPath(radius, phase, core) {
    var path = new Path2D();
    var size = radius * (core ? 0.34 : 1);
    for (var i = 0; i <= 32; i++) {
      var angle = i / 32 * Math.PI * 2;
      var r = size * (1 + Math.sin(angle * 3 + phase) * 0.1);
      var x = Math.cos(angle) * r, y = Math.sin(angle) * r * 0.84;
      if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
    }
    path.closePath();
    return path;
  }

  function build() {
    cells = []; dust = []; signals = [];
    var count = Math.min(100, Math.max(40, Math.round(W * H / 17000)));
    for (var i = 0; i < count; i++) {
      var seed = i * 31 + 11;
      var z = (rand(seed + 3) - 0.5) * 1100;
      var extent = (focal + z) / focal;
      cells.push({
        bx: (rand(seed) - 0.5) * W * 1.28 * extent,
        by: (rand(seed + 1) - 0.5) * H * 1.28 * extent,
        bz: z, x: 0, y: 0, z: z,
        radius: 11 + rand(seed + 4) * 13,
        phase: rand(seed + 5) * Math.PI * 2,
        tone: rand(seed + 6) < 0.68 ? 0 : (rand(seed + 7) < 0.75 ? 1 : 2),
        act: 0
      });
    }
    cells.forEach(function (cell) {
      cell.wall = cellPath(cell.radius, cell.phase, false);
      cell.core = cellPath(cell.radius, cell.phase + 1.7, true);
    });
    for (var d = 0; d < Math.min(150, count * 2); d++) {
      var ds = d * 23 + 71;
      var dz = (rand(ds + 2) - 0.5) * 1400;
      var de = (focal + dz) / focal;
      dust.push({ x: (rand(ds) - 0.5) * W * 1.5 * de,
        y: (rand(ds + 1) - 0.5) * H * 1.5 * de, z: dz,
        size: 0.5 + rand(ds + 3), phase: rand(ds + 4) * 6.28 });
    }
    for (var s = 0; s < Math.min(12, Math.floor(count / 5)); s++) {
      var from = Math.floor(rand(s * 51 + 9) * count);
      signals.push({ from: from, to: target(from, s + 37),
        offset: rand(s + 81) * 12, duration: 9 + rand(s + 22) * 8, cycle: -1 });
    }
  }
  function target(from, seed) {
    var origin = cells[from], best = (from + 1) % cells.length;
    for (var i = 0; i < 16; i++) {
      var id = Math.floor(rand(seed + i * 19) * cells.length);
      var c = cells[id];
      var distance = Math.hypot(c.bx - origin.bx, c.by - origin.by, c.bz - origin.bz);
      if (id !== from && distance > 160 && distance < 680) return id;
    }
    return best;
  }
  function resize() {
    W = canvas.offsetWidth; H = canvas.offsetHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    focal = Math.max(950, W * 0.85);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }

  function project(x, y, z) {
    var rx = x * Math.cos(yaw) + z * Math.sin(yaw);
    var rz = z * Math.cos(yaw) - x * Math.sin(yaw);
    var ry = y * Math.cos(pitch) - rz * Math.sin(pitch);
    rz = y * Math.sin(pitch) + rz * Math.cos(pitch);
    var scale = focal / Math.max(200, focal + rz);
    return { x: W / 2 + rx * scale, y: H / 2 + ry * scale,
      z: rz, scale: scale };
  }
  function signalPoint(signal, progress) {
    var a = cells[signal.from], b = cells[signal.to];
    var curve = Math.sin(progress * Math.PI);
    return project(a.x + (b.x - a.x) * progress,
      a.y + (b.y - a.y) * progress - curve * 65,
      a.z + (b.z - a.z) * progress + curve * 100);
  }

  function draw(time, dt) {
    camera.x += (pointer.x - camera.x) * Math.min(1, dt * 2.5);
    camera.y += (pointer.y - camera.y) * Math.min(1, dt * 2.5);
    yaw = Math.sin(time * 0.055) * 0.18 + camera.x * 0.14;
    pitch = Math.cos(time * 0.045) * 0.09 + camera.y * 0.08;
    ctx.clearRect(0, 0, W, H);
    var objects = [];
    cells.forEach(function (c) {
      c.x = c.bx + Math.sin(time * 0.12 + c.phase) * 13;
      c.y = c.by + Math.cos(time * 0.1 + c.phase) * 13;
      c.z = c.bz + Math.sin(time * 0.09 + c.phase) * 35;
      c.act = Math.max(0, c.act - dt * 0.35);
      var p = project(c.x, c.y, c.z);
      objects.push({ type: 'cell', p: p, cell: c });
    });
    dust.forEach(function (d) {
      var p = project(d.x, d.y + Math.sin(time * 0.08 + d.phase) * 10, d.z);
      objects.push({ type: 'dust', p: p, size: d.size });
    });
    signals.forEach(function (s, index) {
      var elapsed = (time + s.offset) / s.duration;
      var cycle = Math.floor(elapsed);
      if (s.cycle < 0) s.cycle = cycle;
      if (cycle !== s.cycle) {
        s.from = s.to; s.to = target(s.from, cycle * 97 + index * 23);
        s.cycle = cycle;
      }
      var progress = elapsed - cycle;
      if (progress > 0.86) cells[s.to].act = Math.max(cells[s.to].act, (progress - 0.86) / 0.14);
      for (var k = 0; k < 7; k++) {
        var t = progress - k * 0.012;
        if (t >= 0) objects.push({ type: 'signal', p: signalPoint(s, t),
          tone: cells[s.from].tone, strength: 1 - k / 7 });
      }
    });
    objects.sort(function (a, b) { return b.p.z - a.p.z; });
    objects.forEach(function (o) {
      var p = o.p, quiet = quietCenter(p.x);
      var fog = Math.max(0.22, Math.min(1, 1 - (p.z + 300) / 1400));
      if (o.type === 'dust') {
        ctx.fillStyle = rgba(palette[1], quiet * fog * 0.3);
        ctx.beginPath(); ctx.arc(p.x, p.y, o.size * p.scale, 0, Math.PI * 2); ctx.fill();
      } else if (o.type === 'signal') {
        var size = 2 * p.scale;
        ctx.globalAlpha = quiet * fog * o.strength;
        ctx.fillStyle = rgba(palette[o.tone], 0.16);
        ctx.beginPath(); ctx.arc(p.x, p.y, size * 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(241,240,236,0.9)';
        ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        var c = o.cell;
        var radius = c.radius * (1 + Math.sin(time * 0.35 + c.phase) * 0.035);
        var r = radius * p.scale;
        if (p.x < -r * 2 || p.x > W + r * 2 || p.y < -r * 2 || p.y > H + r * 2) return;
        var breath = radius / c.radius;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(p.scale * breath, p.scale * breath);
        ctx.rotate(c.phase + time * 0.025);
        ctx.fillStyle = rgba(palette[c.tone], quiet * fog * (0.08 + c.act * 0.3));
        ctx.fill(c.wall);
        ctx.strokeStyle = rgba(palette[c.tone], quiet * fog * (0.38 + c.act * 0.4));
        ctx.lineWidth = 0.85 / p.scale;
        ctx.stroke(c.wall);
        ctx.fillStyle = rgba(palette[c.tone], quiet * fog * (0.2 + c.act * 0.3));
        ctx.fill(c.core);
        ctx.restore();
        if (c.act > 0.05) {
          ctx.strokeStyle = rgba(palette[c.tone], quiet * fog * c.act * 0.4);
          ctx.beginPath(); ctx.arc(p.x, p.y, r * (1.08 + (1 - c.act) * 0.45), 0, Math.PI * 2); ctx.stroke();
        }
      }
    });
  }

  // Limit to 30 FPS, cap resolution, and stop work while the page is hidden.
  function loop(now) {
    frameId = 0;
    if (document.hidden || reduced) return;
    if (!last) last = now;
    var elapsed = now - last;
    if (elapsed >= 1000 / 30) {
      var dt = Math.min(0.08, elapsed / 1000);
      clock += dt; last = now;
      draw(clock, dt);
    }
    frameId = requestAnimationFrame(loop);
  }
  function resume() {
    cancelAnimationFrame(frameId); frameId = 0; last = 0;
    if (document.hidden) return;
    draw(clock, 0);
    if (!reduced) frameId = requestAnimationFrame(loop);
  }
  motion.addEventListener('change', function (event) {
    reduced = event.matches;
    if (reduced) { pointer.x = pointer.y = camera.x = camera.y = 0; }
    resume();
  });
  window.addEventListener('pointermove', function (event) {
    if (reduced || !pointerMedia.matches || event.pointerType === 'touch') return;
    pointer.x = event.clientX / W * 2 - 1;
    pointer.y = event.clientY / H * 2 - 1;
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', function () { pointer.x = pointer.y = 0; });
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (canvas.offsetWidth !== W || canvas.offsetHeight !== H) { resize(); draw(clock, 0); }
    }, 150);
  });
  function save() {
    try { sessionStorage.setItem(STORE, JSON.stringify({ time: clock, savedAt: Date.now() })); }
    catch (error) {}
  }
  window.addEventListener('pagehide', function () { save(); cancelAnimationFrame(frameId); });
  window.addEventListener('pageshow', resume);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { save(); cancelAnimationFrame(frameId); last = 0; }
    else resume();
  });
  resize(); resume();
  if (restored || reduced) canvas.classList.add('bg-instant');
  requestAnimationFrame(function () { canvas.classList.add('bg-ready'); });
})();
