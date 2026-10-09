/* Bao Lab — a perspective-projected 3D biological field.
   World-space cells and signals are rendered back to front on Canvas 2D.
   No external dependencies; the live scene survives internal navigation. */
(function () {
  'use strict';

  var palette = [[212, 170, 165], [184, 205, 221], [169, 182, 158]];
  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduced = motion.matches;
  var canvas = document.createElement('canvas');
  canvas.className = 'page-bg-layer';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(canvas, document.body.firstChild);
  var ctx = canvas.getContext('2d');
  if (!ctx) { canvas.remove(); return; }

  var W = 0, H = 0, dpr = 1, focal = 900;
  var sceneWidth = 0, sceneHeight = 0;
  var cells = [], dust = [], signals = [], renderList = [];
  var cellGrid = new Map(), activationRadius = 150, glows = [];
  var cosYaw = 1, sinYaw = 0, cosPitch = 1, sinPitch = 0;
  var colorPrefixes = palette.map(function (color) { return 'rgba(' + color.join(',') + ','; });
  var clock = 0, last = 0, frameId = 0;
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
    return colorPrefixes[palette.indexOf(color)] + Math.max(0, Math.min(1, alpha)) + ')';
  }
  function quietCenter(x) {
    var edge = Math.min(1, Math.abs(x / W - 0.5) * 2);
    // Quiet the text column on narrow screens as well as wide screens.
    return 0.09 + Math.pow(edge, 1.8) * 0.81;
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

  // Cache soft glow textures once, rather than building gradients per lit cell.
  palette.forEach(function (color) {
    var glow = document.createElement('canvas');
    glow.width = glow.height = 96;
    var g = glow.getContext('2d');
    var gradient = g.createRadialGradient(48, 48, 0, 48, 48, 48);
    gradient.addColorStop(0, rgba(color, 0.8));
    gradient.addColorStop(0.4, rgba(color, 0.28));
    gradient.addColorStop(1, rgba(color, 0));
    g.fillStyle = gradient; g.fillRect(0, 0, 96, 96);
    glows.push(glow);
  });
  function gridKey(x, y, z) { return x + '/' + y + '/' + z; }
  function renderObject(type) {
    return { type: type, p: { x: 0, y: 0, z: 0, scale: 1 } };
  }
  function activateRegion(point, tone, strength) {
    // Base positions index the cloud once. Padding includes each cell's drift.
    var reach = activationRadius + 35;
    var minX = Math.floor((point.x - reach) / activationRadius);
    var maxX = Math.floor((point.x + reach) / activationRadius);
    var minY = Math.floor((point.y - reach) / activationRadius);
    var maxY = Math.floor((point.y + reach) / activationRadius);
    var minZ = Math.floor((point.z - reach) / activationRadius);
    var maxZ = Math.floor((point.z + reach) / activationRadius);
    var radiusSquared = activationRadius * activationRadius;
    for (var x = minX; x <= maxX; x++) for (var y = minY; y <= maxY; y++) for (var z = minZ; z <= maxZ; z++) {
      var bucket = cellGrid.get(gridKey(x, y, z));
      if (!bucket) continue;
      for (var i = 0; i < bucket.length; i++) {
        var cell = bucket[i];
        var dx = cell.x - point.x, dy = cell.y - point.y, dz = cell.z - point.z;
        var distanceSquared = dx * dx + dy * dy + dz * dz;
        if (distanceSquared >= radiusSquared) continue;
        var intensity = Math.pow(1 - distanceSquared / radiusSquared, 1.3) * strength;
        if (intensity > cell.excitation) { cell.excitation = intensity; cell.activeTone = tone; }
      }
    }
  }

  function build() {
    cells = []; dust = []; signals = [];
    cellGrid.clear();
    activationRadius = focal * 0.16;
    // Fill a volume with a dense population, rather than a sparse screen layer.
    var count = Math.min(1100, Math.max(200, Math.round(sceneWidth * sceneHeight / 1600)));
    for (var i = 0; i < count; i++) {
      var seed = i * 31 + 11;
      // A bounded volume can turn through a full revolution without crossing the camera.
      var angle = rand(seed) * Math.PI * 2;
      var elevation = rand(seed + 1) * 2 - 1;
      var radial = Math.cbrt(rand(seed + 3));
      var horizontal = Math.sqrt(1 - elevation * elevation) * radial;
      var z = Math.sin(angle) * horizontal * focal * 0.72;
      cells.push({
        bx: Math.cos(angle) * horizontal * focal * 0.72,
        by: elevation * radial * sceneHeight * 0.78,
        bz: z, x: 0, y: 0, z: z,
        radius: 12 + rand(seed + 4) * 6,
        phase: rand(seed + 5) * Math.PI * 2,
        tone: rand(seed + 6) < 0.68 ? 0 : (rand(seed + 7) < 0.75 ? 1 : 2),
        act: 0, excitation: 0
      });
    }
    cells.forEach(function (cell) {
      cell.wall = cellPath(cell.radius, cell.phase, false);
      cell.core = cellPath(cell.radius, cell.phase + 1.7, true);
      cell.activeTone = cell.tone;
      cell.render = renderObject('cell'); cell.render.cell = cell;
      var key = gridKey(Math.floor(cell.bx / activationRadius), Math.floor(cell.by / activationRadius), Math.floor(cell.bz / activationRadius));
      if (!cellGrid.has(key)) cellGrid.set(key, []);
      cellGrid.get(key).push(cell);
    });
    for (var d = 0; d < Math.min(80, Math.round(count / 4)); d++) {
      var ds = d * 23 + 71;
      var dustAngle = rand(ds) * Math.PI * 2;
      var dustRadius = Math.sqrt(rand(ds + 2)) * focal * 0.72;
      dust.push({ x: Math.cos(dustAngle) * dustRadius,
        y: (rand(ds + 1) - 0.5) * sceneHeight * 1.5,
        z: Math.sin(dustAngle) * dustRadius,
        size: 0.5 + rand(ds + 3), phase: rand(ds + 4) * 6.28 });
    }
    dust.forEach(function (d) { d.render = renderObject('dust'); d.render.size = d.size; });
    for (var s = 0; s < Math.min(12, Math.floor(count / 5)); s++) {
      var from = Math.floor(rand(s * 51 + 9) * count);
      signals.push({ from: from, to: target(from, s + 37),
        offset: rand(s + 81) * 12, duration: 12 + rand(s + 22) * 8, cycle: -1 });
    }
    signals.forEach(function (signal) {
      signal.head = { x: 0, y: 0, z: 0 };
      signal.trail = [];
      for (var i = 0; i < 7; i++) {
        var dot = renderObject('signal'); dot.strength = 1 - i / 7;
        signal.trail.push(dot);
      }
    });
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
    var width = canvas.offsetWidth, height = canvas.offsetHeight;
    // A decorative canvas does not need a huge Retina buffer on large displays.
    var pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(3000000 / Math.max(1, width * height)));
    if (width === W && height === H && pixelRatio === dpr) return false;
    W = width; H = height; dpr = pixelRatio;
    var bitmapWidth = Math.round(W * dpr), bitmapHeight = Math.round(H * dpr);
    if (canvas.width !== bitmapWidth) canvas.width = bitmapWidth;
    if (canvas.height !== bitmapHeight) canvas.height = bitmapHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Resize the view into the existing world, retaining cell sizes and signals.
    return true;
  }
  function syncViewport() {
    if (resize()) draw(clock, 0);
  }

  function project(x, y, z, out) {
    var rx = x * cosYaw + z * sinYaw;
    var rz = z * cosYaw - x * sinYaw;
    var ry = y * cosPitch - rz * sinPitch;
    rz = y * sinPitch + rz * cosPitch;
    var scale = focal / Math.max(200, focal + rz);
    out = out || {};
    out.x = W / 2 + rx * scale; out.y = H / 2 + ry * scale;
    out.z = rz; out.scale = scale;
    return out;
  }
  function signalPosition(signal, progress, out) {
    var a = cells[signal.from], b = cells[signal.to];
    var curve = Math.sin(progress * Math.PI);
    out.x = a.x + (b.x - a.x) * progress;
    out.y = a.y + (b.y - a.y) * progress - curve * 65;
    out.z = a.z + (b.z - a.z) * progress + curve * 100;
    return out;
  }
  function visible(p, radius) {
    return p.x >= -radius && p.x <= W + radius && p.y >= -radius && p.y <= H + radius;
  }

  function draw(time, dt) {
    // Rotate the whole cloud steadily: one revolution in about 225 seconds.
    yaw = time * 0.028 - 0.35;
    pitch = 0.12;
    cosYaw = Math.cos(yaw); sinYaw = Math.sin(yaw);
    cosPitch = Math.cos(pitch); sinPitch = Math.sin(pitch);
    ctx.clearRect(0, 0, W, H);
    var objects = renderList;
    objects.length = 0;
    cells.forEach(function (c) {
      c.x = c.bx + Math.sin(time * 0.12 + c.phase) * 13;
      c.y = c.by + Math.cos(time * 0.1 + c.phase) * 13;
      c.z = c.bz + Math.sin(time * 0.09 + c.phase) * 35;
      c.excitation = 0;
      var p = project(c.x, c.y, c.z, c.render.p);
      if (visible(p, c.radius * p.scale * 3)) objects.push(c.render);
    });
    dust.forEach(function (d) {
      var p = project(d.x, d.y + Math.sin(time * 0.08 + d.phase) * 10, d.z, d.render.p);
      if (visible(p, d.size * p.scale)) objects.push(d.render);
    });
    signals.forEach(function (s, index) {
      var elapsed = (time + s.offset) / s.duration;
      var cycle = Math.floor(elapsed);
      if (s.cycle < 0) s.cycle = cycle;
      if (cycle !== s.cycle) {
        s.from = s.to; s.to = target(s.from, cycle * 97 + index * 23);
        s.cycle = cycle;
      }
      var phase = elapsed - cycle;
      // Ease departures and arrivals without changing the cell-to-cell route.
      var progress = phase * phase * (3 - 2 * phase);
      var tone = cells[s.from].tone;
      signalPosition(s, progress, s.head);
      activateRegion(s.head, tone, 0.85);
      // Arrival lights the target's neighborhood, then decays over about 3 seconds.
      if (progress > 0.82) activateRegion(cells[s.to], tone, (progress - 0.82) / 0.18);
      for (var k = 0; k < s.trail.length; k++) {
        var t = progress - k * 0.012;
        if (t < 0) continue;
        var dot = s.trail[k];
        signalPosition(s, t, s.head);
        project(s.head.x, s.head.y, s.head.z, dot.p);
        dot.tone = tone;
        dot.opacity = Math.min(1, phase / 0.12, (1 - phase) / 0.12);
        if (visible(dot.p, dot.p.scale * 6)) objects.push(dot);
      }
    });
    // Smooth activation makes each cell brighten and recover organically.
    cells.forEach(function (cell) {
      var rate = cell.excitation > cell.act ? 4 : 0.75;
      if (dt > 0) cell.act += (cell.excitation - cell.act) * (1 - Math.exp(-rate * dt));
    });
    objects.sort(function (a, b) { return b.p.z - a.p.z; });
    objects.forEach(function (o) {
      var p = o.p, quiet = quietCenter(p.x);
      var fog = Math.max(0.18, Math.min(1, (p.scale - 0.3) * 0.78));
      if (o.type === 'dust') {
        ctx.fillStyle = rgba(palette[1], quiet * fog * 0.3);
        ctx.beginPath(); ctx.arc(p.x, p.y, o.size * p.scale, 0, Math.PI * 2); ctx.fill();
      } else if (o.type === 'signal') {
        var size = 2 * p.scale;
        ctx.globalAlpha = quiet * fog * o.strength * o.opacity;
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
        var tone = c.act > 0.05 ? c.activeTone : c.tone;
        if (c.act > 0.05) {
          var glowRadius = r * 2.8;
          ctx.globalAlpha = quiet * fog * c.act * 0.5;
          ctx.drawImage(glows[tone], p.x - glowRadius, p.y - glowRadius, glowRadius * 2, glowRadius * 2);
          ctx.globalAlpha = 1;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(p.scale * breath, p.scale * breath);
        ctx.rotate(c.phase + time * 0.025);
        ctx.fillStyle = rgba(palette[tone], quiet * fog * (0.09 + c.act * 0.65));
        ctx.fill(c.wall);
        ctx.strokeStyle = rgba(palette[tone], quiet * fog * (0.48 + c.act * 0.45));
        ctx.lineWidth = 0.85 / p.scale;
        ctx.stroke(c.wall);
        ctx.fillStyle = rgba(palette[tone], quiet * fog * (0.27 + c.act * 0.45));
        ctx.fill(c.core);
        ctx.restore();
        if (c.act > 0.05) {
          ctx.strokeStyle = rgba(palette[tone], quiet * fog * c.act * 0.4);
          ctx.beginPath(); ctx.arc(p.x, p.y, r * (1.08 + (1 - c.act) * 0.45), 0, Math.PI * 2); ctx.stroke();
        }
      }
    });
  }

  // Limit to 30 FPS, cap resolution, and stop work while the page is hidden.
  function loop(now) {
    frameId = 0;
    if (document.hidden || reduced) return;
    // A changed viewport must redraw even between the usual 30 FPS frames.
    if (resize()) { draw(clock, 0); last = now; }
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
    resize();
    draw(clock, 0);
    if (!reduced) frameId = requestAnimationFrame(loop);
  }
  motion.addEventListener('change', function (event) {
    reduced = event.matches;
    resume();
  });
  // ResizeObserver runs before paint, preventing a stretched old bitmap.
  // The resize event also covers pixel-ratio changes between displays.
  window.addEventListener('resize', syncViewport);
  if (window.ResizeObserver) {
    var viewportObserver = new ResizeObserver(syncViewport);
    viewportObserver.observe(canvas);
  }
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
  resize();
  // Cover the display once so growing the window reveals the same cell cloud.
  sceneWidth = Math.max(W, window.screen.width || W);
  sceneHeight = Math.max(H, window.screen.height || H);
  focal = Math.max(950, sceneWidth * 0.85);
  build();
  resume();
  if (restored || reduced) canvas.classList.add('bg-instant');
  requestAnimationFrame(function () { canvas.classList.add('bg-ready'); });
})();
