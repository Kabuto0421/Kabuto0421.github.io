// Procedural pixel-art backdrops, drawn at low resolution and scaled up with
// image-rendering: pixelated, so no bitmap assets are needed.
//  - kabuto (default): a blue summer-night city, a sap tree where a beetle rests, and a
//    circuit-board ground whose traces carry glowing pulses; a wireframe polyhedron turns in the sky.
//  - alakazar: a moonlit forest and a neon prison city joined by a dithered seam (shown while the
//    ALAKAZAR menu item is selected).

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

const KABUTO = {
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

function themeKabuto(env) {
  const { W, H, horizon, scale, random, set, rectFill, options, px, line } = env;
  let stars = [];
  let windows = [];
  let clouds = [];
  let traces = [];
  let beetleEyes = [];
  let beacon = null;
  let poly = null;
  let motes = [];

  // Sky: dithered night gradient, brighter toward the city glow on the horizon.
  const bands = KABUTO.sky;
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
    set(x, y, KABUTO.star);
    if (random() < 0.35) stars.push({ x, y, phase: random() * 6.28, speed: 0.6 + random() * 1.8 });
  }

  // Far skyline across the whole width, kept low in the middle where the guide stands.
  windows = [];
  for (let x = -2; x < W; ) {
    const bw = Math.round((6 + random() * 10) * Math.max(0.8, scale));
    const centre = 1 - Math.min(1, Math.abs(x + bw / 2 - W * 0.5) / (W * 0.22));
    const bh = Math.round(H * (0.12 + random() * 0.22) * (1 - centre * 0.45));
    rectFill(x, horizon - bh, bw, bh, KABUTO.cityFar);
    for (let y = horizon - bh; y < horizon; y += 1) set(x, y, KABUTO.cityFarEdge);
    if (random() < 0.3) rectFill(x + 1, horizon - bh - 2, Math.max(2, bw - 4), 2, KABUTO.cityFar);
    for (let y = horizon - bh + 2; y < horizon - 2; y += 3) {
      for (let xx = x + 2; xx < x + bw - 1; xx += 2) {
        if (random() < 0.42) {
          const roll = random();
          const c = roll < 0.12 ? KABUTO.winCyan : roll < 0.16 ? KABUTO.winWarm : KABUTO.cityFarWin;
          set(xx, y, c);
          if (c !== KABUTO.cityFarWin && random() < 0.35) windows.push({ x: xx, y, phase: random() * 40 });
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
    rectFill(x, horizon - bh, bw, bh, KABUTO.cityNear);
    for (let y = horizon - bh; y < horizon; y += 1) set(x, y, KABUTO.cityNearEdge);
    for (let xx = x; xx < x + bw; xx += 1) set(xx, horizon - bh, KABUTO.cityNearEdge);
    for (let y = horizon - bh + 3; y < horizon - 3; y += 3) {
      for (let xx = x + 2; xx < x + bw - 1; xx += 3) {
        if (random() < 0.32) {
          const c = random() < 0.4 ? KABUTO.winCyan : KABUTO.winBlue;
          set(xx, y, c);
          set(xx + 1, y, c);
          if (random() < 0.2) windows.push({ x: xx, y, w: 2, phase: random() * 40 });
        }
      }
    }
    if (isTower) {
      const mx = x + Math.floor(bw / 2);
      const mastTop = horizon - bh - Math.round(14 * scale);
      for (let y = horizon - bh; y > mastTop; y -= 1) set(mx, y, KABUTO.cityNearEdge);
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
    const g = KABUTO.ground;
    for (let x = 0; x < W; x += 1) {
      const f = depth * (g.length - 1);
      const i = Math.floor(f);
      set(x, y, f - i > bayer(x, y) && i < g.length - 1 ? g[i + 1] : g[i]);
    }
  }
  for (let x = 0; x < W; x += 1) set(x, horizon, KABUTO.traceLit);

  const spotX = W * (options.spotX ?? 0.5);
  const spotY = horizon + (H - horizon) * 0.6;
  for (let y = horizon + 1; y < H; y += 1) {
    for (let x = Math.round(spotX - H * 0.4); x < spotX + H * 0.4; x += 1) {
      const r = ((x - spotX) / (H * 0.34)) ** 2 + ((y - spotY) / ((H - horizon) * 0.5)) ** 2;
      if (r < 1 && (1 - r) * 0.55 > bayer(x + 1, y)) set(x, y, KABUTO.spot);
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
    for (const [px, py] of path) set(px, py, KABUTO.trace);
    const [nx, ny] = path[path.length - 1];
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) set(nx + dx, ny + dy, KABUTO.traceLit);
    set(nx, ny, KABUTO.ground[2]);
    set(path[0][0], path[0][1] - 1, KABUTO.traceLit);
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
      let c = KABUTO.melonRed;
      if (r > mr - 0.8) c = KABUTO.melonRindDark;
      else if (r > mr - 1.6) c = KABUTO.melonRind;
      else if (r > mr - 2.4) c = KABUTO.melonWhite;
      set(melonX + x, melonY + y, c);
    }
  }
  for (const [sx, sy] of [[-2, 1], [1, 1], [-1, 2], [2, 2]]) set(melonX + Math.round(sx * scale), melonY + Math.round(sy * scale), KABUTO.melonSeed);

  // Sap tree on the left: trunk with glowing circuit veins, a beetle, and a leafy canopy.
  const trunkX = Math.round(Math.max(10, W * 0.11));
  const trunkW = Math.max(6, Math.round(11 * scale));
  const trunkTop = Math.round(H * 0.18);
  for (let y = trunkTop; y < H; y += 1) {
    const flare = y > horizon ? Math.round((y - horizon) * 0.5) : 0;
    for (let x = trunkX - flare; x < trunkX + trunkW + flare; x += 1) {
      const bark = (x * 3 + Math.floor(y / 4)) % 5 === 0;
      set(x, y, bark ? KABUTO.trunkLight : KABUTO.trunk);
    }
  }
  // Branches reaching up and out.
  const branch = (x, y, dx, len) => {
    for (let k = 0; k < len; k += 1) {
      rectFill(Math.round(x), Math.round(y), 2, 2, KABUTO.trunk);
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
        const c = top && bayer(bx + x, by + y) < 0.5 ? KABUTO.leavesRim : (x + y) % 7 === 0 ? KABUTO.leavesLight : KABUTO.leaves;
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
      set(x, y, KABUTO.circuit);
    }
    set(x, trunkTop + 3, KABUTO.node);
    set(x - 1, trunkTop + 4, KABUTO.node);
    set(x + 1, trunkTop + 4, KABUTO.node);
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
  beetle.forEach((row, y) => [...row].forEach((ch, x) => ch === "#" && set(bxx + x, byy + y, KABUTO.beetle)));
  set(bxx + 1, byy + 3, KABUTO.beetleShine);
  beetleEyes = [
    { x: bxx + 1, y: byy + 2 },
    { x: bxx + 3, y: byy + 2 },
  ];

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

  function drawPoly(ctx, t) {
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

  return {
    flash: ["rgba(160, 240, 255, 0.14)", "rgba(63, 244, 255, 0.5)", "#f2feff"],
    boltRange: [0.3, 0.7],
    draw(ctx, t, dt, still, pointer) {
      for (const star of stars) {
        if (Math.sin(t * star.speed + star.phase) > 0.55) px(star.x, star.y, "#e4f4ff");
      }

      for (const cloud of clouds) {
        if (!still) cloud.x += cloud.speed * dt;
        if (cloud.x > W + 4) cloud.x = -cloud.sprite.width - 4;
        ctx.drawImage(cloud.sprite, Math.round(cloud.x), cloud.y);
      }

      if (poly) drawPoly(ctx, still ? 0 : t);

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
    },
  };
}

const smoothstep = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const ALAKAZAR = {
  forestSky: ["#050f0d", "#081a15", "#0c251d", "#123428", "#1a4434", "#245540"].map(hex),
  citySky: ["#0b040b", "#160712", "#22091a", "#320d25", "#461131", "#5c173c"].map(hex),
  moon: hex("#f1ebcf"),
  moonRim: hex("#fffbe8"),
  moonShade: hex("#d3cba8"),
  star: hex("#8d9a9a"),
  treeFar: hex("#0f3125"),
  treeFarRim: hex("#1f5c43"),
  treeMid: hex("#0a231a"),
  treeMidRim: hex("#17473a"),
  treeNear: hex("#05140e"),
  forestGround: ["#133626", "#0e2b1d", "#0a2116", "#071810"].map(hex),
  grass: hex("#22603c"),
  grassLight: hex("#348a55"),
  cityFar: hex("#2a0c22"),
  cityFarWin: hex("#4c1638"),
  building: hex("#1c0916"),
  buildingEdge: hex("#3e1533"),
  roof: hex("#33112b"),
  neonPink: hex("#ff4f8b"),
  neonCyan: hex("#33f0f0"),
  amber: hex("#f2b24e"),
  wall: hex("#22101c"),
  wallLine: hex("#170910"),
  wallCap: hex("#3d1b33"),
  cityGround: ["#2c1222", "#230d1b", "#1b0915", "#13060e"].map(hex),
  tile: hex("#3b1630"),
  spot: hex("#2a4a5a"),
};

function themeAlakazar(env) {
  const { W, H, horizon, scale, random, set, options, px } = env;
  const P = ALAKAZAR;
  const split = (x) => smoothstep(W * 0.4, W * 0.6, x);
  const isCity = (x, y) => split(x) > bayer(x + 2, y + 1);
  const forestOnly = (x, y, c) => {
    if (!isCity(x, y)) set(x, y, c);
  };
  const cityOnly = (x, y, c) => {
    if (isCity(x, y)) set(x, y, c);
  };
  const stars = [];
  const windows = [];
  const lamps = [];
  let antenna = null;

  // Sky: banded gradient with ordered dithering between bands, moon glow on the forest side.
  const moonX = Math.round(W * 0.27);
  const moonY = Math.round(H * 0.2);
  const moonR = Math.max(5, Math.round(H * 0.065));
  for (let y = 0; y < horizon; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const city = isCity(x, y);
      const bands = city ? P.citySky : P.forestSky;
      let f = Math.pow(y / horizon, 1.15) * (bands.length - 2);
      if (!city) {
        const r = Math.hypot(x - moonX, (y - moonY) * 1.1);
        f += Math.max(0, 1 - (r - moonR) / (H * 0.42)) ** 2 * 2.6;
      } else {
        f += Math.max(0, 1 - Math.abs(x - W * 0.8) / (W * 0.4)) * 0.5 * (y / horizon);
      }
      f = Math.min(bands.length - 1, Math.max(0, f));
      const i = Math.floor(f);
      set(x, y, f - i > bayer(x, y) && i < bands.length - 1 ? bands[i + 1] : bands[i]);
    }
  }

  for (let i = 0; i < Math.round((W * H) / 380); i += 1) {
    const x = Math.floor(random() * W);
    const y = Math.floor(random() * horizon * 0.62);
    if (Math.hypot(x - moonX, y - moonY) < moonR * 3) continue;
    set(x, y, P.star);
    if (random() < 0.35) stars.push({ x, y, phase: random() * 6.28, speed: 0.6 + random() * 1.8 });
  }

  // Moon with rim light and a few craters.
  for (let y = -moonR; y <= moonR; y += 1) {
    for (let x = -moonR; x <= moonR; x += 1) {
      const r = Math.hypot(x, y);
      if (r > moonR + 0.3) continue;
      const rim = x + y < -moonR * 0.9 && r > moonR - 1.6;
      set(moonX + x, moonY + y, rim ? P.moonRim : P.moon);
    }
  }
  for (let i = 0; i < 4; i += 1) {
    const a = random() * 6.28;
    const r = random() * moonR * 0.6;
    const cx = moonX + Math.cos(a) * r;
    const cy = moonY + Math.sin(a) * r;
    set(cx, cy, P.moonShade);
    if (moonR > 7) set(cx + 1, cy, P.moonShade);
  }

  // Far city skyline.
  for (let x = Math.round(W * 0.42); x < W; ) {
    const bw = 5 + Math.floor(random() * 10);
    const bh = Math.round(H * (0.1 + random() * 0.22));
    for (let yy = horizon - bh; yy < horizon; yy += 1) {
      for (let xx = x; xx < x + bw; xx += 1) cityOnly(xx, yy, P.cityFar);
    }
    for (let yy = horizon - bh + 2; yy < horizon - 2; yy += 3) {
      for (let xx = x + 1; xx < x + bw - 1; xx += 2) {
        if (random() < 0.45) cityOnly(xx, yy, random() < 0.12 ? P.neonCyan : P.cityFarWin);
      }
    }
    x += bw + Math.floor(random() * 3);
  }

  // Prison tower: stacked tiers with flared neon-lined roofs.
  const towerX = Math.round(W * 0.8);
  let tierBottom = horizon - Math.round(10 * scale);
  const tierWidths = [34, 27, 21, 15, 10].map((w) => Math.max(4, Math.round(w * scale)));
  const tierHeight = Math.max(5, Math.round(H * 0.085));
  tierWidths.forEach((tw, index) => {
    const left = towerX - Math.floor(tw / 2);
    const top = tierBottom - tierHeight;
    for (let y = top; y < tierBottom; y += 1) {
      for (let x = left; x < left + tw; x += 1) {
        cityOnly(x, y, x === left || x === left + tw - 1 ? P.buildingEdge : P.building);
      }
    }
    for (let y = top + 3; y < tierBottom - 1; y += 3) {
      for (let x = left + 2; x < left + tw - 2; x += 3) {
        const roll = random();
        const color = roll < 0.4 ? P.neonCyan : roll < 0.55 ? P.amber : P.cityFarWin;
        cityOnly(x, y, color);
        if (color !== P.cityFarWin && random() < 0.3) windows.push({ x, y, phase: random() * 40 });
      }
    }
    const flare = Math.max(2, Math.round(3 * scale));
    for (let r = 0; r < 3; r += 1) {
      for (let x = left - (flare - r); x < left + tw + (flare - r); x += 1) cityOnly(x, top - r, P.roof);
    }
    for (let x = left - flare; x < left + tw + flare; x += 1) cityOnly(x, top + 1, P.neonPink);
    tierBottom = top - 2;
    if (index === tierWidths.length - 1) {
      const mastHeight = Math.round(12 * scale);
      for (let y = tierBottom; y > tierBottom - mastHeight; y -= 1) cityOnly(towerX, y, P.buildingEdge);
      antenna = { x: towerX, y: tierBottom - mastHeight };
    }
  });

  // Near buildings flanking the right edge.
  for (let x = Math.round(W * 0.6); x < W; ) {
    const bw = 6 + Math.floor(random() * 9);
    if (Math.abs(x + bw / 2 - towerX) < 24 * scale) {
      x += bw;
      continue;
    }
    const bh = Math.round(H * (0.12 + random() * 0.14));
    for (let yy = horizon - bh; yy < horizon; yy += 1) {
      for (let xx = x; xx < x + bw; xx += 1) cityOnly(xx, yy, xx === x ? P.buildingEdge : P.building);
    }
    for (let yy = horizon - bh + 2; yy < horizon - 3; yy += 2) {
      for (let xx = x + 2; xx < x + bw - 1; xx += 2) {
        if (random() < 0.3) {
          cityOnly(xx, yy, random() < 0.5 ? P.neonPink : P.neonCyan);
          if (random() < 0.2) windows.push({ x: xx, y: yy, phase: random() * 40 });
        }
      }
    }
    x += bw + 1 + Math.floor(random() * 4);
  }

  // Prison wall with lamp posts.
  const wallTop = horizon - Math.max(5, Math.round(H * 0.065));
  for (let y = wallTop; y < horizon; y += 1) {
    for (let x = Math.round(W * 0.52); x < W; x += 1) {
      const brickRow = Math.floor((y - wallTop) / 3);
      const isLine = (y - wallTop) % 3 === 0 || (x + brickRow * 4) % 8 === 0;
      cityOnly(x, y, y === wallTop ? P.wallCap : isLine ? P.wallLine : P.wall);
    }
  }
  for (let x = Math.round(W * 0.56); x < W; x += Math.max(14, Math.round(22 * scale))) {
    for (let y = wallTop - 4; y < wallTop; y += 1) cityOnly(x, y, P.wallCap);
    if (isCity(x, wallTop - 5)) lamps.push({ x, y: wallTop - 5, phase: random() * 6.28 });
  }

  // Pine forest: layered, rim-lit from the moon.
  const pine = (cx, baseY, h, color, rimColor, near) => {
    const tiers = Math.max(2, Math.round(h / 9));
    const tierLen = h / tiers;
    for (let r = 0; r < h; r += 1) {
      const y = baseY - h + r;
      const tier = Math.floor(r / tierLen);
      const within = (r - tier * tierLen) / tierLen;
      const half = Math.round((within * 0.75 + tier * 0.55 + 0.4) * (h / 18) + within * 1.5);
      for (let dx = -half; dx <= half; dx += 1) {
        const x = cx + dx;
        const towardMoon = (cx < moonX && dx === half) || (cx >= moonX && dx === -half);
        const c = rimColor && towardMoon && bayer(x, y) < 0.6 ? rimColor : color;
        near ? set(x, y, c) : forestOnly(x, y, c);
      }
    }
    for (let y = baseY; y < baseY + 3; y += 1) near ? set(cx, y, color) : forestOnly(cx, y, color);
  };
  const forestEdge = W * 0.54;
  for (let x = -4; x < forestEdge; x += 3 + Math.floor(random() * 4)) {
    const fade = 1 - smoothstep(W * 0.3, forestEdge, x);
    if (random() > 0.25 + fade) continue;
    pine(x, horizon - 1, Math.round(H * (0.16 + random() * 0.14) * (0.6 + fade * 0.4)), P.treeFar, P.treeFarRim);
  }
  for (let x = -6; x < W * 0.44; x += 6 + Math.floor(random() * 7)) {
    const fade = 1 - smoothstep(W * 0.18, W * 0.44, x);
    if (random() > 0.2 + fade) continue;
    pine(x, horizon + 2, Math.round(H * (0.26 + random() * 0.16) * (0.55 + fade * 0.45)), P.treeMid, P.treeMidRim);
  }

  // Ground: grass on the forest side, perspective tiles on the city side.
  const vanishX = W * 0.72;
  const vanishY = horizon - H * 0.25;
  for (let y = horizon; y < H; y += 1) {
    const depth = (y - horizon) / (H - horizon);
    for (let x = 0; x < W; x += 1) {
      const city = isCity(x, y);
      const bands = city ? P.cityGround : P.forestGround;
      const f = depth * (bands.length - 1);
      const i = Math.floor(f);
      let c = f - i > bayer(x, y) && i < bands.length - 1 ? bands[i + 1] : bands[i];
      if (city) {
        const rowPos = Math.log(1 + (y - horizon)) * 3.2;
        const t = (x - vanishX) / ((y - vanishY) / (H - vanishY));
        if (Math.abs(rowPos - Math.round(rowPos)) < 0.12 || Math.abs(t / 16 - Math.round(t / 16)) < 0.04) c = P.tile;
      }
      set(x, y, c);
    }
  }
  for (let i = 0; i < W * 0.9; i += 1) {
    const x = Math.floor(random() * W * 0.55);
    const y = horizon + Math.floor(random() * (H - horizon));
    if (isCity(x, y)) continue;
    set(x, y, random() < 0.3 ? P.grassLight : P.grass);
    set(x - 1, y - 1, P.grass);
    set(x + 1, y - 1, P.grass);
  }
  const spotX = W * (options.spotX ?? 0.5);
  const spotY = horizon + (H - horizon) * 0.62;
  for (let y = horizon; y < H; y += 1) {
    for (let x = Math.round(spotX - W * 0.2); x < spotX + W * 0.2; x += 1) {
      const r = ((x - spotX) / (H * 0.32)) ** 2 + ((y - spotY) / ((H - horizon) * 0.45)) ** 2;
      if (r < 1 && (1 - r) * 0.5 > bayer(x + 1, y)) set(x, y, P.spot);
    }
  }
  for (let x = -8; x < W * 0.14; x += 8 + Math.floor(random() * 6)) {
    pine(x, H + 2, Math.round(H * (0.5 + random() * 0.2)), P.treeNear, null, true);
  }

  const fireflies = Array.from({ length: Math.max(6, Math.min(28, Math.round((W * H) / 2600))) }, () => ({
    x: random() * W * 0.46,
    y: horizon - H * 0.3 + random() * (H - horizon + H * 0.28),
    ax: 0.3 + random() * 0.6,
    ay: 0.4 + random() * 0.7,
    phase: random() * 6.28,
    blink: 0.8 + random() * 1.6,
    ox: 0,
    oy: 0,
  }));
  const drops = Array.from({ length: Math.max(20, Math.min(140, Math.round((W * H) / 700))) }, () => ({
    x: W * 0.4 + random() * W * 0.7,
    y: random() * H,
    speed: 90 + random() * 70,
  }));

  return {
    flash: ["rgba(255, 255, 255, 0.16)", "rgba(120, 240, 255, 0.55)", "#fffbe0"],
    boltRange: [0.45, 0.55],
    draw(ctx, t, dt, still, pointer) {
      for (const star of stars) {
        if (Math.sin(t * star.speed + star.phase) > 0.55) px(star.x, star.y, "#fff6e0");
      }
      for (const w of windows) {
        if (Math.floor(t * 0.8 + w.phase) % 9 === 0) px(w.x, w.y, "#1c0916");
      }
      for (const lamp of lamps) {
        const glow = 0.5 + Math.sin(t * 2.2 + lamp.phase) * 0.5;
        px(lamp.x, lamp.y, "#33f0f0");
        if (glow > 0.5) {
          ctx.fillStyle = `rgba(51, 240, 240, ${(glow - 0.5) * 0.6})`;
          ctx.fillRect(lamp.x - 1, lamp.y, 3, 1);
          ctx.fillRect(lamp.x, lamp.y - 1, 1, 3);
        }
      }
      if (antenna && Math.floor(t * 1.4) % 2 === 0) px(antenna.x, antenna.y, "#ff4f8b");

      for (const fly of fireflies) {
        let x = fly.x + Math.sin(t * fly.ax + fly.phase) * 7;
        let y = fly.y + Math.cos(t * fly.ay + fly.phase) * 4;
        if (pointer && !isCity(Math.round(pointer.x), Math.round(pointer.y))) {
          const dx = pointer.x - x;
          const dy = pointer.y - y;
          const pull = Math.hypot(dx, dy) < H * 0.45 ? 0.55 : 0;
          fly.ox += (dx * pull - fly.ox) * 0.04;
          fly.oy += (dy * pull - fly.oy) * 0.04;
        } else {
          fly.ox *= 0.96;
          fly.oy *= 0.96;
        }
        x += fly.ox;
        y += fly.oy;
        if (isCity(Math.round(x), Math.round(y))) continue;
        const b = (Math.sin(t * fly.blink + fly.phase * 3) + 1) / 2;
        if (b > 0.72) {
          ctx.fillStyle = "rgba(168, 224, 90, 0.75)";
          ctx.fillRect(Math.round(x) - 1, Math.round(y), 3, 1);
          ctx.fillRect(Math.round(x), Math.round(y) - 1, 1, 3);
          px(x, y, "#f4ffb0");
        } else if (b > 0.3) {
          px(x, y, "#a8e05a");
        }
      }

      ctx.fillStyle = "rgba(205, 176, 222, 0.5)";
      for (const drop of drops) {
        if (!still) {
          drop.y += drop.speed * dt;
          drop.x -= drop.speed * 0.25 * dt;
        }
        if (drop.y > H || drop.x < W * 0.38) {
          drop.y = -Math.random() * 20;
          drop.x = W * 0.42 + Math.random() * W * 0.7;
        }
        const x = Math.round(drop.x);
        const y = Math.round(drop.y);
        if (!isCity(x, y)) continue;
        ctx.fillRect(x, y, 1, 1);
        ctx.fillRect(x + 1, y - 1, 1, 1);
        ctx.fillRect(x + 1, y - 2, 1, 1);
      }
    },
  };
}

const THEMES = { kabuto: themeKabuto, alakazar: themeAlakazar };

export function mountPixelScene(canvas, options = {}) {
  const stage = canvas.parentElement;
  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const seed = options.seed ?? 421;
  const themeName = options.theme ?? "kabuto";
  const makeTheme = THEMES[themeName] ?? themeKabuto;

  // A lazy scene is only drawn once its theme is selected, and only animates while selected.
  let active = !options.lazy;
  let built = false;
  let W = 0;
  let H = 0;
  let horizon = 0;
  let base = null;
  let theme = null;
  let pointer = null;
  let bolt = null;
  let nextBolt = 5;
  let running = false;
  let visible = true;
  let lastFrame = 0;
  const startTime = performance.now();

  const px = (x, y, color, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };
  const line = (x0, y0, x1, y1, color) => {
    ctx.fillStyle = color;
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let s = 0; s <= steps; s += 1) {
      ctx.fillRect(Math.round(x0 + ((x1 - x0) * s) / steps), Math.round(y0 + ((y1 - y0) * s) / steps), 1, 1);
    }
  };

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

    theme = makeTheme({
      W,
      H,
      horizon,
      scale: H / 180,
      random: makeRandom(seed + W * 7 + H),
      set,
      rectFill,
      options,
      px,
      line,
    });

    base = document.createElement("canvas");
    base.width = W;
    base.height = H;
    base.getContext("2d").putImageData(img, 0, 0);
    built = true;
  }

  function makeBolt() {
    const [from, to] = theme.boltRange;
    const points = [];
    let x = W * (from + Math.random() * (to - from));
    for (let y = 0; y <= horizon + 4; y += 3) {
      points.push([Math.round(x), y]);
      x = Math.min(W * (to + 0.06), Math.max(W * (from - 0.06), x + (Math.random() - 0.5) * 7));
    }
    return { points, born: performance.now() };
  }

  function draw(now) {
    const t = (now - startTime) / 1000;
    const dt = Math.min(0.1, (now - lastFrame) / 1000 || 0.033);
    lastFrame = now;
    const still = reduceMotion.matches;

    ctx.drawImage(base, 0, 0);
    theme.draw(ctx, t, dt, still, pointer);

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
      const [flash, glow, core] = theme.flash;
      if (age > 0.45) {
        bolt = null;
      } else {
        if (age < 0.08) {
          ctx.fillStyle = flash;
          ctx.fillRect(0, 0, W, H);
        }
        if (age < 0.12 || (age > 0.2 && age < 0.3)) {
          for (let i = 1; i < bolt.points.length; i += 1) {
            const [x0, y0] = bolt.points[i - 1];
            const [x1, y1] = bolt.points[i];
            line(x0 - 1, y0, x1 - 1, y1, glow);
            line(x0 + 1, y0, x1 + 1, y1, glow);
            line(x0, y0, x1, y1, core);
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
    setRunning(active && visible && !document.hidden);
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

  stage.addEventListener("scene:theme", (event) => {
    active = (event.detail?.theme ?? "kabuto") === themeName;
    if (active && !built) {
      build();
      draw(performance.now());
    }
    syncRunning();
  });

  let resizeTimer = 0;
  new ResizeObserver(() => {
    if (!built) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      build();
      draw(performance.now());
    }, 80);
  }).observe(stage);

  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    syncRunning();
  }).observe(stage);
  document.addEventListener("visibilitychange", syncRunning);

  if (active) {
    build();
    draw(performance.now());
  }
  syncRunning();
}

document.querySelectorAll("canvas.pixel-scene").forEach((canvas) => {
  mountPixelScene(canvas, {
    theme: canvas.dataset.theme ?? "kabuto",
    lazy: canvas.hasAttribute("data-lazy"),
    spotX: Number(canvas.dataset.spotX ?? 0.5),
    polyX: Number(canvas.dataset.polyX ?? 0.86),
    horizon: Number(canvas.dataset.horizon ?? 0.74),
  });
});
