// Pixel-art reaction effects (manga-style emotes) that pop up around the avatar's head.
// Sprites are tiny bitmaps turned into crisp SVG; the layer follows the head every frame.

const INK = "#07080f";

const SPRITES = {
  bang: {
    colors: { k: INK, a: "#ffe66b", b: "#fffbe0" },
    rows: [".kkkk.", "kbaaak", "kbaaak", "kaaaak", "kaaaak", ".kaak.", ".kaak.", ".kaak.", "..kk..", "......", ".kkkk.", ".kaak.", ".kaak.", ".kkkk."],
  },
  question: {
    colors: { k: INK, a: "#8cc8ff" },
    rows: [".kkkkk.", "kaaaaak", "kakkkak", "kkk.kak", "...kaak", "..kaak.", "..kak..", "..kkk..", ".......", "..kkk..", "..kak..", "..kkk.."],
  },
  heart: {
    colors: { k: INK, a: "#ff5a8a", b: "#ffd0de" },
    rows: [".kk.kk.", "kbakaak", "kbaaaak", "kaaaaak", ".kaaak.", "..kak..", "...k..."],
  },
  note: {
    colors: { k: INK, a: "#3ff4ff" },
    rows: ["...kkk.", "...kaak", "...ka.k", "...ka..", "...ka..", ".kkka..", "kaaaak.", "kaaaak.", ".kkkk.."],
  },
  anger: {
    colors: { k: INK, a: "#ff3b4e" },
    rows: ["..kk.kk..", ".kak.kak.", "kaak.kaak", "kkk...kkk", ".........", "kkk...kkk", "kaak.kaak", ".kak.kak.", "..kk.kk.."],
  },
  drop: {
    colors: { k: INK, a: "#6fb8ff", b: "#e6f6ff" },
    rows: ["..k..", ".kak.", ".kak.", "kaaak", "kbaak", "kaaak", ".kkk."],
  },
  sparkle: {
    colors: { k: INK, a: "#ffe66b", b: "#ffffff" },
    rows: ["...k...", "..kak..", "..kak..", "kkabakk", "..kak..", "..kak..", "...k..."],
  },
  dots: {
    colors: { k: INK, a: "#eaf6ff" },
    rows: ["kkk.kkk.kkk", "kak.kak.kak", "kkk.kkk.kkk"],
  },
  zz: {
    colors: { k: INK, a: "#b9c8ff" },
    rows: ["kkkkk", "kaaak", "kkak.", ".kak.", "kakkk", "kaaak", "kkkkk"],
  },
  swirl: {
    colors: { k: INK, a: "#ffe66b" },
    rows: [".kkkkk.", "kaaaaak", "kakkkak", "kakaaak", "kakkkkk", "kaaaaak", ".kkkkk."],
  },
};

// What each reaction spawns: sprite, offset from the head (in head radii), animation, delay.
const EFFECTS = {
  surprised: [{ sprite: "bang", dx: 1, dy: -0.4, anim: "pop" }],
  happy: [
    { sprite: "heart", dx: -1, dy: 0, anim: "float" },
    { sprite: "heart", dx: 1.05, dy: -0.25, anim: "float", delay: 180 },
    { sprite: "heart", dx: 0.15, dy: -0.85, anim: "float", delay: 360, scale: 0.75 },
  ],
  relaxed: [
    { sprite: "note", dx: 1.05, dy: -0.1, anim: "float" },
    { sprite: "note", dx: 1.45, dy: -0.55, anim: "float", delay: 320, scale: 0.8 },
  ],
  angry: [{ sprite: "anger", dx: 0.95, dy: -0.55, anim: "pulse" }],
  sad: [{ sprite: "drop", dx: 0.95, dy: -0.1, anim: "drip" }],
  blink: [
    { sprite: "sparkle", dx: 0.95, dy: 0.05, anim: "pop" },
    { sprite: "sparkle", dx: -1, dy: -0.45, anim: "pop", delay: 220, scale: 0.7 },
  ],
  question: [{ sprite: "question", dx: 1.05, dy: -0.45, anim: "pop" }],
  ponder: [{ sprite: "dots", dx: 0.2, dy: -1.15, anim: "pop", scale: 0.8 }],
  sleep: [
    { sprite: "zz", dx: 0.9, dy: -0.4, anim: "float", scale: 0.8 },
    { sprite: "zz", dx: 1.3, dy: -0.8, anim: "float", delay: 700, scale: 0.6 },
  ],
  dizzy: [
    { sprite: "swirl", dx: -0.6, dy: -0.95, anim: "spin" },
    { sprite: "swirl", dx: 0.6, dy: -0.95, anim: "spin", delay: 120 },
  ],
};

function spriteSvg(name, unit) {
  const { rows, colors } = SPRITES[name];
  const paths = {};
  rows.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === ".") return;
      paths[cell] = (paths[cell] ?? "") + `M${x} ${y}h1v1h-1z`;
    });
  });
  const width = rows[0].length;
  const height = rows.length;
  const body = Object.entries(paths)
    .map(([cell, d]) => `<path fill="${colors[cell]}" d="${d}"/>`)
    .join("");
  return `<svg viewBox="0 0 ${width} ${height}" width="${width * unit}" height="${height * unit}" shape-rendering="crispEdges" aria-hidden="true">${body}</svg>`;
}

export function createFxLayer(container) {
  const layer = document.createElement("div");
  layer.className = "vrm-fx";
  layer.setAttribute("aria-hidden", "true");
  container.appendChild(layer);
  let radius = 40;

  return {
    // Called every frame with the head position (top of head) and its on-screen radius in CSS px.
    follow(x, y, r) {
      radius = r;
      layer.style.setProperty("--hx", `${x.toFixed(1)}px`);
      layer.style.setProperty("--hy", `${y.toFixed(1)}px`);
      layer.style.setProperty("--hr", `${r.toFixed(1)}px`);
    },
    spawn(kind) {
      const specs = EFFECTS[kind];
      if (!specs) return;
      const unit = Math.max(3, Math.min(7, Math.round(radius / 12)));
      for (const spec of specs) {
        const particle = document.createElement("span");
        particle.className = `vrm-fx__p vrm-fx__p--${spec.anim}`;
        particle.style.left = `calc(var(--hx) + var(--hr) * ${spec.dx})`;
        particle.style.top = `calc(var(--hy) + var(--hr) * ${spec.dy})`;
        particle.style.animationDelay = `${spec.delay ?? 0}ms`;
        particle.innerHTML = spriteSvg(spec.sprite, Math.max(2, Math.round(unit * (spec.scale ?? 1))));
        particle.addEventListener("animationend", () => particle.remove());
        layer.appendChild(particle);
      }
    },
    clear() {
      layer.replaceChildren();
    },
  };
}
