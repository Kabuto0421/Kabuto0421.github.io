// Shared UI: pixel logo, RPG-style menu selection, guide lines on hover, reveal on scroll.

const GLYPHS = {
  K: ["##...##", "##..##.", "##.##..", "####...", "###....", "####...", "##.##..", "##..##.", "##...##"],
  A: ["..###..", ".##.##.", "##...##", "##...##", "#######", "##...##", "##...##", "##...##", "##...##"],
  B: ["######.", "##...##", "##...##", "##..##.", "######.", "##...##", "##...##", "##...##", "######."],
  U: ["##...##", "##...##", "##...##", "##...##", "##...##", "##...##", "##...##", "##...##", ".#####."],
  T: ["#######", "#######", "..###..", "..###..", "..###..", "..###..", "..###..", "..###..", "..###.."],
  O: [".#####.", "##...##", "##...##", "##...##", "##...##", "##...##", "##...##", "##...##", ".#####."],
};

// One <path> per layer: separate row rects leave hairline seams when the SVG is scaled.
function rowPath(rows, offsetX, offsetY, grow = 0) {
  let d = "";
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== "#") {
        x += 1;
        continue;
      }
      let end = x;
      while (end < row.length && row[end] === "#") end += 1;
      d += `M${offsetX + x - grow} ${offsetY + y - grow}h${end - x + grow * 2}v${1 + grow * 2}h${-(end - x + grow * 2)}z`;
      x = end;
    }
  });
  return d;
}

function buildPixelLogo(target) {
  const word = target.dataset.pixelLogo || "KABUTO";
  const advance = 9;
  const width = word.length * advance - 2 + 4;
  const height = 9 + 4;
  let shadow = "";
  let outline = "";
  let letters = "";
  [...word].forEach((char, index) => {
    const glyph = GLYPHS[char];
    if (!glyph) return;
    const x = 2 + index * advance;
    shadow += rowPath(glyph, x + 1, 3, 1);
    outline += rowPath(glyph, x, 2, 1);
    letters += `<path class="logo-letter" style="--i:${index}" d="${rowPath(glyph, x, 2)}"/>`;
  });
  target.innerHTML = `
    <svg viewBox="0 0 ${width} ${height + 1}" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="logo-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffffff"/>
          <stop offset="0.5" stop-color="#d8fbff"/>
          <stop offset="1" stop-color="#5ff6ff"/>
        </linearGradient>
      </defs>
      <path class="logo-shadow" d="${shadow}"/>
      <path class="logo-outline" d="${outline}"/>
      ${letters}
    </svg>`;

  target.querySelectorAll(".logo-letter").forEach((letter) => {
    letter.addEventListener("pointerenter", () => {
      letter.classList.remove("is-lit");
      void letter.getBoundingClientRect();
      letter.classList.add("is-lit");
    });
  });
}

function sweepLogo(target) {
  target.classList.remove("is-sweeping");
  void target.offsetWidth;
  target.classList.add("is-sweeping");
}

function say(text, expression) {
  if (!text) return;
  document.dispatchEvent(new CustomEvent("guide:say", { detail: { text, expression } }));
}

const BGM_LOOP_START = 12; // the fanfare plays once, then the march loops from here

// Switches the stage backdrop for menu items that carry data-scene-theme and plays the
// ALAKAZAR title theme while that backdrop is up.
function setupStageTheme(menu) {
  const stage = menu.closest(".stage");
  if (!stage) return () => {};
  const toggle = menu.querySelector("[data-bgm-toggle]");
  let audio = null;
  let fadeTimer = 0;
  let wantPlay = false;
  let stageVisible = true;
  let wasBlocked = false;
  let enabled = true;
  try {
    enabled = window.localStorage.getItem("kabuto-bgm") !== "off";
  } catch {
    // Storage unavailable: keep the default.
  }

  const getAudio = () => {
    if (!audio) {
      audio = new Audio();
      audio.preload = "auto";
      audio.src = audio.canPlayType('audio/ogg; codecs="vorbis"')
        ? "assets/audio/alakazar-title.ogg"
        : "assets/audio/alakazar-title.m4a";
      audio.volume = 0;
      audio.addEventListener("ended", () => {
        audio.currentTime = BGM_LOOP_START;
        audio.play().catch(() => {});
      });
    }
    return audio;
  };

  const fadeTo = (target, done) => {
    clearInterval(fadeTimer);
    fadeTimer = setInterval(() => {
      const step = 0.05;
      const diff = target - audio.volume;
      if (Math.abs(diff) <= step) {
        audio.volume = target;
        clearInterval(fadeTimer);
        done?.();
      } else {
        audio.volume = Math.min(1, Math.max(0, audio.volume + Math.sign(diff) * step));
      }
    }, 40);
  };

  const renderToggle = (blocked = false) => {
    if (!toggle) return;
    toggle.classList.toggle("is-blocked", blocked);
    toggle.setAttribute("aria-pressed", String(enabled));
    toggle.textContent = blocked ? "♪ クリックでBGM" : enabled ? "♪ BGM ON" : "♪ BGM OFF";
  };

  const update = () => {
    if (wantPlay && enabled && stageVisible && !document.hidden) {
      const a = getAudio();
      a.play()
        .then(() => {
          renderToggle(false);
          fadeTo(0.55);
        })
        // Browsers block sound until the visitor clicks or presses a key.
        .catch(() => renderToggle(true));
    } else {
      renderToggle(false);
      if (audio && !audio.paused) fadeTo(0, () => audio.pause());
    }
  };

  const retry = () => {
    if (wantPlay && enabled && audio?.paused) update();
  };
  document.addEventListener("pointerdown", retry);
  document.addEventListener("keydown", retry);

  if (toggle) {
    const remember = () => {
      wasBlocked = toggle.classList.contains("is-blocked");
    };
    toggle.addEventListener("pointerdown", remember);
    toggle.addEventListener("keydown", remember);
    toggle.addEventListener("click", () => {
      // A click that only unlocked blocked audio should not also switch it off.
      if (!wasBlocked) {
        enabled = !enabled;
        try {
          window.localStorage.setItem("kabuto-bgm", enabled ? "on" : "off");
        } catch {
          // Storage unavailable: the choice lasts for this visit.
        }
      }
      wasBlocked = false;
      update();
    });
    renderToggle(false);
  }

  new IntersectionObserver((entries) => {
    stageVisible = entries[0].isIntersecting;
    update();
  }).observe(stage);
  document.addEventListener("visibilitychange", update);

  let current = "kabuto";
  return (theme = "kabuto") => {
    if (theme === current) return;
    current = theme;
    stage.classList.toggle("is-theme-alakazar", theme === "alakazar");
    stage.dispatchEvent(new CustomEvent("scene:theme", { detail: { theme } }));
    wantPlay = theme === "alakazar";
    update();
  };
}

function setupMenu(menu) {
  const items = [...menu.querySelectorAll("[data-menu-item]")];
  if (!items.length) return;
  let selected = Math.max(0, items.findIndex((item) => item.classList.contains("is-selected")));
  const setTheme = setupStageTheme(menu);

  const select = (index, { focus = false, speak = true } = {}) => {
    selected = (index + items.length) % items.length;
    items.forEach((item, i) => item.classList.toggle("is-selected", i === selected));
    setTheme(items[selected].dataset.sceneTheme);
    if (focus) items[selected].focus({ preventScroll: true });
    if (speak) say(items[selected].dataset.guideText, "relaxed");
  };

  items.forEach((item, index) => {
    item.addEventListener("pointerenter", () => {
      if (index !== selected) select(index);
    });
    item.addEventListener("focus", () => {
      if (index !== selected) select(index);
    });
  });

  // Arrow keys / WASD move the cursor like a game menu while focus is not in a text field.
  const vertical = menu.dataset.menuAxis !== "horizontal";
  document.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target.closest("input, textarea, select, [contenteditable]")) return;
    const inMenu = menu.contains(document.activeElement);
    const idle = document.activeElement === document.body || !document.activeElement;
    // A global menu (title screen) only takes the keys while it is on screen and nothing else has focus.
    const globalActive = menu.matches("[data-menu-global]") && idle && menu.getBoundingClientRect().bottom > 0 && window.scrollY < window.innerHeight * 0.4;
    if (!inMenu && !globalActive) return;
    const prev = vertical ? ["ArrowUp", "w", "W"] : ["ArrowLeft", "a", "A"];
    const next = vertical ? ["ArrowDown", "s", "S"] : ["ArrowRight", "d", "D"];
    if (prev.includes(event.key)) {
      event.preventDefault();
      select(selected - 1, { focus: true });
    } else if (next.includes(event.key)) {
      event.preventDefault();
      select(selected + 1, { focus: true });
    } else if (event.key === "Enter" && !inMenu) {
      event.preventDefault();
      items[selected].click();
    }
  });

  select(selected, { speak: false });
}

function setupGuideHovers() {
  let timer = 0;
  document.querySelectorAll("[data-guide-text]:not([data-menu-item])").forEach((element) => {
    element.addEventListener("pointerenter", () => {
      clearTimeout(timer);
      timer = setTimeout(() => say(element.dataset.guideText, element.dataset.guideFace || "happy"), 160);
    });
    element.addEventListener("pointerleave", () => clearTimeout(timer));
    element.addEventListener("focusin", () => say(element.dataset.guideText, element.dataset.guideFace || "happy"));
  });
}

function setupReveal() {
  const targets = document.querySelectorAll("[data-reveal]");
  if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    targets.forEach((target) => target.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px" },
  );
  targets.forEach((target) => observer.observe(target));
}

document.querySelectorAll("[data-pixel-logo]").forEach((target) => {
  buildPixelLogo(target);
  document.addEventListener("scene:flash", () => sweepLogo(target));
  setTimeout(() => sweepLogo(target), 700);
});
document.querySelectorAll("[data-menu]").forEach(setupMenu);
document.querySelectorAll("img[data-optional]").forEach((img) => {
  const hide = () => img.closest("[data-optional-wrap]")?.classList.add("is-missing");
  if (img.complete && img.naturalWidth === 0) hide();
  img.addEventListener("error", hide);
});
setupGuideHovers();
setupReveal();
