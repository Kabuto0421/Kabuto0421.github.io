// Procedural pixel-art backdrop for KABUTO: a blue summer-night city, a sap tree where a beetle
// rests, and a circuit-board ground whose traces carry glowing pulses. A wireframe polyhedron
// turns in the sky and cyan lightning strikes now and then. Everything is drawn at low resolution
// and scaled up with image-rendering: pixelated, so no bitmap assets are needed.

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function makeRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTE = {
  sky: ["#040817", "#060d24", "#091433", "#0d1d47", "#12285e", "#183577", "#1f4390"].map(hex),
  star: hex("#6f86b8"),
  cityFar: hex("#10265c"),
  cityFarEdge: hex("#1a3778"),
  cityFarWin: hex("#2b55a8"),
  cityNear: hex("#0a1840"),
  cityNearEdge: hex("#18306a"),
  winBlue: hex("#4f86e8"),
  winCyan: hex("#7ff8ff"),
  winWarm: hex("#ffd27a"),
  ground: ["#0a1838", "#081430", "#061028", "#040b1e"].map(hex),
  trace: hex("#16408c"),
  traceLit: hex("#2b6fd6"),
  node: hex("#3ff4ff"),
  trunk: hex("#0b1226"),
  trunkLight: hex("#16203e"),
  leaves: hex("#0b2044"),
  leavesLight: hex("#122b58"),
  leavesRim: hex("#3a72d4"),
  circuit: hex("#2fd2ff"),
  beetle: hex("#05060c"),
  beetleShine: hex("#3b4a6e"),
  beetleEye: hex("#3ff4ff"),
  melonRind: hex("#2f8a4a"),
  melonRindDark: hex("#1c5a30"),
  melonWhite: hex("#e8f0d0"),
  melonRed: hex("#ff4a64"),
  melonSeed: hex("#1a0a10"),
  spot: hex("#13306a"),
};

export function mountPixelScene(canvas, options = {}) {
  const stage = canvas.parentElement;
  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const seed = options.seed ?? 421;

  let W = 0;
  let H = 0;
  let horizon = 0;
  let base = null;
  let stars = [];
  let motes = [];
  let traces = [];
  let windows = [];
  let clouds = [];
  let beacon = null;
  let beetleEyes = [];
  let poly = null;
  let pointer = null;
  let bolt = null;
  let nextBolt = 5;
  let running = false;
  let visible = true;
  let lastFrame = 0;
  const startTime = performance.now();

  function build() {
    const rect = stage.getBoundingClientRect();
    const cssW = Math.max(rect.width, 200);
    const cssH = Math.max(rect.height, 120);
    H = Math.round(Math.min(220, Math.max(84, cssH / 4)));
    W = Math.round(cssW / (cssH / H));
    canvas.width = W;
    canvas.height = H;
    stage.style.setProperty("--scene-px", `${(cssH / H).toFixed(3)}px`);
    horizon = Math.round(H * (options.horizon ?? 0.74));
    const scale = H / 180;

    const random = makeRandom(seed + W * 7 + H);
    const img = new ImageData(W, H);
    const d = img.data;
    const set = (x, y, c) => {
      x = Math.round(x);
      y = Math.round(y);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = (y * W + x) * 4;
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = 255;
    };
    const rectFill = (x0, y0, w, h, c) => {
      for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) set(x, y, c);
    };

    // Sky: dithered night gradient, brighter toward the city glow on the horizon.
    const bands = PALETTE.sky;
    for (let y = 0; y < horizon; y += 1) {
      for (let x = 0; x < W; x += 1) {
        let f = Math.pow(y / horizon, 1.6) * (bands.length - 1.2);
        f += Math.max(0, 1 - Math.abs(x - W * 0.5) / (W * 0.7)) * 0.6 * (y / horizon) ** 3;
        f = Math.min(bands.length - 1, Math.max(0, f));
        const i = Math.floor(f);
        set(x, y, f - i > bayer(x, y) && i < bands.length - 1 ? bands[i + 1] : bands[i]);
      }
    }

    stars = [];
    for (let i = 0; i < Math.round((W * H) / 340); i += 1) {
      const x = Math.floor(random() * W);
      const y = Math.floor(random() * horizon * 0.6);
      set(x, y, PALETTE.star);
      if (random() < 0.35) stars.push({ x, y, phase: random() * 6.28, speed: 0.6 + random() * 1.8 });
    }

    // Far skyline across the whole width, kept low in the middle where the guide stands.
    windows = [];
    for (let x = -2; x < W; ) {
      const bw = Math.round((6 + random() * 10) * Math.max(0.8, scale));
      const centre = 1 - Math.min(1, Math.abs(x + bw / 2 - W * 0.5) / (W * 0.22));
      const bh = Math.round(H * (0.12 + random() * 0.22) * (1 - centre * 0.45));
      rectFill(x, horizon - bh, bw, bh, PALETTE.cityFar);
      for (let y = horizon - bh; y < horizon; y += 1) set(x, y, PALETTE.cityFarEdge);
      if (random() < 0.3) rectFill(x + 1, horizon - bh - 2, Math.max(2, bw - 4), 2, PALETTE.cityFar);
      for (let y = horizon - bh + 2; y < horizon - 2; y += 3) {
        for (let xx = x + 2; xx < x + bw - 1; xx += 2) {
          if (random() < 0.42) {
            const roll = random();
            const c = roll < 0.12 ? PALETTE.winCyan : roll < 0.16 ? PALETTE.winWarm : PALETTE.cityFarWin;
            set(xx, y, c);
            if (c !== PALETTE.cityFarWin && random() < 0.35) windows.push({ x: xx, y, phase: random() * 40 });
          }
        }
      }
      x += bw + Math.floor(random() * 3);
    }

    // Near buildings on the right with a tall tower and a beacon.
    const towerX = Math.round(W * 0.8);
    for (let x = Math.round(W * 0.6); x < W + 4; ) {
      const isTower = x <= towerX && x + 16 * scale > towerX && !beacon;
      const bw = Math.round((isTower ? 14 : 8 + random() * 10) * Math.max(0.8, scale));
      const bh = Math.round(H * (isTower ? 0.5 : 0.14 + random() * 0.16));
      rectFill(x, horizon - bh, bw, bh, PALETTE.cityNear);
      for (let y = horizon - bh; y < horizon; y += 1) set(x, y, PALETTE.cityNearEdge);
      for (let xx = x; xx < x + bw; xx += 1) set(xx, horizon - bh, PALETTE.cityNearEdge);
      for (let y = horizon - bh + 3; y < horizon - 3; y += 3) {
        for (let xx = x + 2; xx < x + bw - 1; xx += 3) {
          if (random() < 0.32) {
            const c = random() < 0.4 ? PALETTE.winCyan : PALETTE.winBlue;
            set(xx, y, c);
            set(xx + 1, y, c);
            if (random() < 0.2) windows.push({ x: xx, y, w: 2, phase: random() * 40 });
          }
        }
      }
      if (isTower) {
        const mx = x + Math.floor(bw / 2);
        const mastTop = horizon - bh - Math.round(14 * scale);
        for (let y = horizon - bh; y > mastTop; y -= 1) set(mx, y, PALETTE.cityNearEdge);
        beacon = { x: mx, y: mastTop };
      }
      x += bw + 1 + Math.floor(random() * 3);
    }
    if (!beacon) beacon = { x: towerX, y: Math.round(horizon - H * 0.4) };

    // Pixel clouds (drawn per frame so they can drift).
    clouds = [];
    for (let i = 0; i < Math.max(2, Math.round(W / 90)); i += 1) {
      const cw = Math.round((18 + random() * 22) * scale);
      const ch = Math.round((5 + random() * 4) * scale);
      const sprite = document.createElement("canvas");
      sprite.width = cw;
      sprite.height = ch + 2;
      const sctx = sprite.getContext("2d");
      const lumps = 3 + Math.floor(random() * 3);
      for (let l = 0; l < lumps; l += 1) {
        const lx = Math.round((l / (lumps - 1)) * (cw - ch * 1.2));
        const lw = Math.round(ch * (1.1 + random() * 0.8));
        const top = Math.round(random() * ch * 0.4);
        sctx.fillStyle = "#1b3c86";
        sctx.fillRect(lx, top + 1, lw, ch - top + 1);
        sctx.fillStyle = "#2b56b0";
        sctx.fillRect(lx + 1, top, lw - 2, 2);
      }
      sctx.fillStyle = "#132d6a";
      sctx.fillRect(0, ch, cw, 2);
      clouds.push({ sprite, x: random() * W, y: Math.round(H * (0.06 + random() * 0.3)), speed: 1.2 + random() * 1.6 });
    }

    // Ground: dithered navy band with circuit traces (the KABUTO logo motif).
    for (let y = horizon; y < H; y += 1) {
      const depth = (y - horizon) / (H - horizon);
      const g = PALETTE.ground;
      for (let x = 0; x < W; x += 1) {
        const f = depth * (g.length - 1);
        const i = Math.floor(f);
        set(x, y, f - i > bayer(x, y) && i < g.length - 1 ? g[i + 1] : g[i]);
      }
    }
    for (let x = 0; x < W; x += 1) set(x, horizon, PALETTE.traceLit);

    const spotX = W * (options.spotX ?? 0.5);
    const spotY = horizon + (H - horizon) * 0.6;
    for (let y = horizon + 1; y < H; y += 1) {
      for (let x = Math.round(spotX - H * 0.4); x < spotX + H * 0.4; x += 1) {
        const r = ((x - spotX) / (H * 0.34)) ** 2 + ((y - spotY) / ((H - horizon) * 0.5)) ** 2;
        if (r < 1 && (1 - r) * 0.55 > bayer(x + 1, y)) set(x, y, PALETTE.spot);
      }
    }

    traces = [];
    const traceCount = Math.max(5, Math.round(W / 34));
    for (let i = 0; i < traceCount; i += 1) {
      let x = Math.round(((i + 0.5) / traceCount) * W + (random() - 0.5) * 10);
      let y = horizon + 1;
      const path = [];
      const target = horizon + 3 + Math.floor(random() * (H - horizon - 6));
      const dir = random() < 0.5 ? -1 : 1;
      const run = Math.round((10 + random() * 30) * scale);
      while (y < target) path.push([x, y++]);
      // 45° bend, then a horizontal run ending in a node.
      for (let k = 0; k < 3; k += 1) path.push([(x += dir), y++]);
      for (let k = 0; k < run; k += 1) path.push([(x += dir), y]);
      if (y >= H - 1) continue;
      for (const [px, py] of path) set(px, py, PALETTE.trace);
      const [nx, ny] = path[path.length - 1];
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) set(nx + dx, ny + dy, PALETTE.traceLit);
      set(nx, ny, PALETTE.ground[2]);
      set(path[0][0], path[0][1] - 1, PALETTE.traceLit);
      traces.push({ path, offset: random() * path.length, speed: 18 + random() * 22 });
    }

    // Watermelon slice resting on the ground near the tree.
    const melonX = Math.round(W * 0.62);
    const melonY = Math.round(horizon + (H - horizon) * 0.55);
    const mr = Math.max(4, Math.round(5 * scale));
    for (let y = 0; y <= mr; y += 1) {
      for (let x = -mr; x <= mr; x += 1) {
        const r = Math.hypot(x, y);
        if (r > mr + 0.4) continue;
        let c = PALETTE.melonRed;
        if (r > mr - 0.8) c = PALETTE.melonRindDark;
        else if (r > mr - 1.6) c = PALETTE.melonRind;
        else if (r > mr - 2.4) c = PALETTE.melonWhite;
        set(melonX + x, melonY + y, c);
      }
    }
    for (const [sx, sy] of [[-2, 1], [1, 1], [-1, 2], [2, 2]]) set(melonX + Math.round(sx * scale), melonY + Math.round(sy * scale), PALETTE.melonSeed);

    // Sap tree on the left: trunk with glowing circuit veins, a beetle, and a leafy canopy.
    const trunkX = Math.round(Math.max(10, W * 0.11));
    const trunkW = Math.max(6, Math.round(11 * scale));
    const trunkTop = Math.round(H * 0.18);
    for (let y = trunkTop; y < H; y += 1) {
      const flare = y > horizon ? Math.round((y - horizon) * 0.5) : 0;
      for (let x = trunkX - flare; x < trunkX + trunkW + flare; x += 1) {
        const bark = (x * 3 + Math.floor(y / 4)) % 5 === 0;
        set(x, y, bark ? PALETTE.trunkLight : PALETTE.trunk);
      }
    }
    // Branches reaching up and out.
    const branch = (x, y, dx, len) => {
      for (let k = 0; k < len; k += 1) {
        rectFill(Math.round(x), Math.round(y), 2, 2, PALETTE.trunk);
        x += dx;
        y -= 0.7;
      }
    };
    branch(trunkX + trunkW - 2, trunkTop + 10 * scale, 1, Math.round(16 * scale));
    branch(trunkX, trunkTop + 6 * scale, -1, Math.round(12 * scale));
    // Canopy: clustered blobs with a moonlit rim on top.
    const canopyCx = trunkX + trunkW / 2;
    for (let i = 0; i < 14; i += 1) {
      const bx = canopyCx + (random() - 0.5) * 60 * scale;
      const by = trunkTop - 4 * scale + (random() - 0.6) * 22 * scale;
      const br = (8 + random() * 9) * scale;
      for (let y = -br; y <= br; y += 1) {
        for (let x = -br; x <= br; x += 1) {
          if (x * x + y * y > br * br) continue;
          const top = y < -br * 0.55;
          const c = top && bayer(bx + x, by + y) < 0.5 ? PALETTE.leavesRim : (x + y) % 7 === 0 ? PALETTE.leavesLight : PALETTE.leaves;
          set(bx + x, by + y, c);
        }
      }
    }
    // Circuit veins up the trunk, ending in nodes.
    for (let v = 0; v < 2; v += 1) {
      let x = trunkX + 2 + v * Math.max(2, Math.round(trunkW / 2));
      for (let y = H - 2; y > trunkTop + 4; y -= 1) {
        if (y % 13 === v * 5) x += v ? 1 : -1;
        x = Math.min(trunkX + trunkW - 2, Math.max(trunkX + 1, x));
        set(x, y, PALETTE.circuit);
      }
      set(x, trunkTop + 3, PALETTE.node);
      set(x - 1, trunkTop + 4, PALETTE.node);
      set(x + 1, trunkTop + 4, PALETTE.node);
    }
    // A rhinoceros beetle clinging to the bark.
    const bxx = trunkX + Math.round(trunkW / 2) - 2;
    const byy = Math.round(horizon - H * 0.36);
    const beetle = [
      "..#..",
      "..#..",
      ".###.",
      "#####",
      "##.##",
      "#####",
      ".###.",
      "#...#",
    ];
    beetle.forEach((row, y) => [...row].forEach((ch, x) => ch === "#" && set(bxx + x, byy + y, PALETTE.beetle)));
    set(bxx + 1, byy + 3, PALETTE.beetleShine);
    beetleEyes = [
      { x: bxx + 1, y: byy + 2 },
      { x: bxx + 3, y: byy + 2 },
    ];

    base = document.createElement("canvas");
    base.width = W;
    base.height = H;
    base.getContext("2d").putImageData(img, 0, 0);

    poly = {
      x: W * (options.polyX ?? 0.68),
      y: H * 0.2,
      r: Math.max(8, Math.min(H * 0.11, W * 0.09)),
    };
    // Portrait screens have no free sky for it; the guide and headings take the space.
    if (W < H * 1.25) poly = null;

    motes = Array.from({ length: Math.max(8, Math.min(32, Math.round((W * H) / 2200))) }, () => ({
      x: random() * W,
      y: horizon - H * 0.3 + random() * (H - horizon + H * 0.3),
      ax: 0.3 + random() * 0.6,
      ay: 0.4 + random() * 0.7,
      phase: random() * 6.28,
      blink: 0.8 + random() * 1.6,
      ox: 0,
      oy: 0,
    }));
  }

  function px(x, y, color, w = 1, h = 1) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }

  function line(x0, y0, x1, y1, color) {
    ctx.fillStyle = color;
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let s = 0; s <= steps; s += 1) {
      ctx.fillRect(Math.round(x0 + ((x1 - x0) * s) / steps), Math.round(y0 + ((y1 - y0) * s) / steps), 1, 1);
    }
  }

  // Icosahedron vertices/edges for the floating wireframe.
  const PHI = (1 + Math.sqrt(5)) / 2;
  const ICO_V = [
    [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
    [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
    [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
  ].map((v) => v.map((c) => c / Math.hypot(1, PHI)));
  const ICO_E = [];
  for (let i = 0; i < 12; i += 1) {
    for (let j = i + 1; j < 12; j += 1) {
      const dist = Math.hypot(...ICO_V[i].map((c, k) => c - ICO_V[j][k]));
      if (dist < 1.1) ICO_E.push([i, j]);
    }
  }

  function drawPoly(t) {
    const a = t * 0.35;
    const b = t * 0.22 + 0.5;
    const pts = ICO_V.map(([x, y, z]) => {
      const x1 = x * Math.cos(a) - z * Math.sin(a);
      const z1 = x * Math.sin(a) + z * Math.cos(a);
      const y1 = y * Math.cos(b) - z1 * Math.sin(b);
      const z2 = y * Math.sin(b) + z1 * Math.cos(b);
      return [poly.x + x1 * poly.r, poly.y + y1 * poly.r + Math.sin(t * 0.8) * 2, z2];
    });
    for (const [i, j] of ICO_E) {
      const back = pts[i][2] + pts[j][2] < 0;
      line(pts[i][0], pts[i][1], pts[j][0], pts[j][1], back ? "rgba(63, 160, 255, 0.35)" : "rgba(63, 244, 255, 0.85)");
    }
    for (const [x, y, z] of pts) if (z > 0) px(x, y, "#e6fdff");
  }

  function makeBolt() {
    const points = [];
    let x = W * (0.3 + Math.random() * 0.4);
    for (let y = 0; y <= horizon; y += 3) {
      points.push([Math.round(x), y]);
      x += (Math.random() - 0.5) * 7;
    }
    return { points, born: performance.now() };
  }

  function draw(now) {
    const t = (now - startTime) / 1000;
    const dt = Math.min(0.1, (now - lastFrame) / 1000 || 0.033);
    lastFrame = now;
    const still = reduceMotion.matches;

    ctx.drawImage(base, 0, 0);

    for (const star of stars) {
      if (Math.sin(t * star.speed + star.phase) > 0.55) px(star.x, star.y, "#e4f4ff");
    }

    for (const cloud of clouds) {
      if (!still) cloud.x += cloud.speed * dt;
      if (cloud.x > W + 4) cloud.x = -cloud.sprite.width - 4;
      ctx.drawImage(cloud.sprite, Math.round(cloud.x), cloud.y);
    }

    if (poly) drawPoly(still ? 0 : t);

    for (const w of windows) {
      if (Math.floor(t * 0.8 + w.phase) % 9 === 0) px(w.x, w.y, "#0a1840", w.w ?? 1, 1);
    }
    if (beacon && Math.floor(t * 1.4) % 2 === 0) {
      px(beacon.x, beacon.y, "#ff5a74");
      ctx.fillStyle = "rgba(255, 90, 116, 0.35)";
      ctx.fillRect(beacon.x - 1, beacon.y, 3, 1);
    }
    const eyeOn = Math.sin(t * 2) > -0.6;
    for (const eye of beetleEyes) if (eyeOn) px(eye.x, eye.y, "#3ff4ff");

    // Pulses travelling along the circuit traces.
    for (const trace of traces) {
      const head = still ? trace.offset : (trace.offset + t * trace.speed) % (trace.path.length + 20);
      for (let k = 0; k < 4; k += 1) {
        const p = trace.path[Math.floor(head) - k];
        if (!p) continue;
        px(p[0], p[1], k === 0 ? "#e6fdff" : `rgba(63, 244, 255, ${0.8 - k * 0.2})`);
      }
    }

    for (const mote of motes) {
      let x = mote.x + Math.sin(t * mote.ax + mote.phase) * 7;
      let y = mote.y + Math.cos(t * mote.ay + mote.phase) * 4;
      if (pointer) {
        const dx = pointer.x - x;
        const dy = pointer.y - y;
        const pull = Math.hypot(dx, dy) < H * 0.45 ? 0.55 : 0;
        mote.ox += (dx * pull - mote.ox) * 0.04;
        mote.oy += (dy * pull - mote.oy) * 0.04;
      } else {
        mote.ox *= 0.96;
        mote.oy *= 0.96;
      }
      x += mote.ox;
      y += mote.oy;
      const b = (Math.sin(t * mote.blink + mote.phase * 3) + 1) / 2;
      if (b > 0.72) {
        ctx.fillStyle = "rgba(63, 244, 255, 0.55)";
        ctx.fillRect(Math.round(x) - 1, Math.round(y), 3, 1);
        ctx.fillRect(Math.round(x), Math.round(y) - 1, 1, 3);
        px(x, y, "#e6fdff");
      } else if (b > 0.3) {
        px(x, y, "#5fb8ff");
      }
    }

    if (!still) {
      nextBolt -= dt;
      if (nextBolt <= 0) {
        bolt = makeBolt();
        nextBolt = 8 + Math.random() * 8;
        stage.dispatchEvent(new CustomEvent("scene:flash", { bubbles: true }));
      }
    }
    if (bolt) {
      const age = (now - bolt.born) / 1000;
      if (age > 0.45) {
        bolt = null;
      } else {
        if (age < 0.08) {
          ctx.fillStyle = "rgba(160, 240, 255, 0.14)";
          ctx.fillRect(0, 0, W, H);
        }
        if (age < 0.12 || (age > 0.2 && age < 0.3)) {
          for (let i = 1; i < bolt.points.length; i += 1) {
            const [x0, y0] = bolt.points[i - 1];
            const [x1, y1] = bolt.points[i];
            line(x0 - 1, y0, x1 - 1, y1, "rgba(63, 244, 255, 0.5)");
            line(x0 + 1, y0, x1 + 1, y1, "rgba(63, 244, 255, 0.5)");
            line(x0, y0, x1, y1, "#f2feff");
          }
        }
      }
    }
  }

  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);
    if (now - lastFrame < 1000 / 30) return;
    draw(now);
  }

  function setRunning(next) {
    if (next === running) return;
    running = next;
    if (running) {
      lastFrame = performance.now();
      requestAnimationFrame(loop);
    }
  }

  function syncRunning() {
    setRunning(visible && !document.hidden);
  }

  stage.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer = {
      x: ((event.clientX - rect.left) / rect.width) * W,
      y: ((event.clientY - rect.top) / rect.height) * H,
    };
  });
  stage.addEventListener("pointerleave", () => {
    pointer = null;
  });

  let resizeTimer = 0;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      beacon = null;
      build();
      draw(performance.now());
    }, 80);
  }).observe(stage);

  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    syncRunning();
  }).observe(stage);
  document.addEventListener("visibilitychange", syncRunning);

  build();
  draw(performance.now());
  syncRunning();
}

document.querySelectorAll("canvas.pixel-scene").forEach((canvas) => {
  mountPixelScene(canvas, {
    spotX: Number(canvas.dataset.spotX ?? 0.5),
    polyX: Number(canvas.dataset.polyX ?? 0.86),
    horizon: Number(canvas.dataset.horizon ?? 0.74),
  });
});
