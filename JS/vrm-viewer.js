import * as THREE from "https://esm.sh/three@0.164.1";
import { GLTFLoader } from "https://esm.sh/three@0.164.1/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "https://esm.sh/three@0.164.1/examples/jsm/controls/OrbitControls.js";
import { VRMLoaderPlugin, VRMUtils } from "https://esm.sh/@pixiv/three-vrm@3.3.6?deps=three@0.164.1";

const { createFxLayer } = await import(new URL(`./vrm-fx.js${new URL(import.meta.url).search}`, import.meta.url));

const MODEL_URL = "assets/kabutomodel.vrm";

const canvas = document.querySelector("#vrm-canvas");
const container = canvas?.closest(".vrm-container");

if (!canvas || !container) {
  throw new Error("VRM viewer target was not found.");
}

const stage = container.closest(".stage") ?? container;
const initialCamera = container.dataset.camera ?? "face";
const coarsePointer = window.matchMedia("(pointer: coarse)");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const status = document.createElement("p");
status.className = "vrm-status";
status.textContent = "NOW LOADING";
container.appendChild(status);

// Guide dialogue window: use the one placed in the page, or build one inside the stage.
let guideBox = document.querySelector("[data-guide]");
if (!guideBox) {
  guideBox = document.createElement("div");
  guideBox.className = "guide-box px-window";
  guideBox.dataset.guide = "";
  guideBox.innerHTML = `<p class="guide-box__name">かぶと</p><p class="guide-box__text"></p>`;
  stage.appendChild(guideBox);
}
const guideText = guideBox.querySelector(".guide-box__text");
guideBox.setAttribute("aria-live", "polite");

const talkForm = document.createElement("form");
talkForm.className = "guide-talk";
talkForm.hidden = true;
talkForm.innerHTML = `
  <label class="visually-hidden" for="guide-talk-input">喋らせたい言葉</label>
  <input id="guide-talk-input" class="guide-talk__input" type="text" maxlength="90" placeholder="喋らせたい言葉を入力" autocomplete="off">
  <button class="guide-talk__submit px-button" type="submit">喋る</button>
`;
guideBox.appendChild(talkForm);
const talkInput = talkForm.querySelector("input");

const controlsPanel = document.createElement("div");
controlsPanel.className = "vrm-controls is-collapsed";
controlsPanel.innerHTML = `
  <button class="vrm-controls-toggle px-button" type="button" aria-expanded="false" aria-controls="vrm-control-body">
    <span aria-hidden="true">▼</span> AVATAR
  </button>
  <div class="vrm-control-body" id="vrm-control-body">
    <p class="vrm-control-label">CAMERA</p>
    <div class="vrm-control-group" role="group" aria-label="カメラ">
      <button class="px-chip" type="button" data-camera="full">全身</button>
      <button class="px-chip" type="button" data-camera="face">顔アップ</button>
      <button class="px-chip" type="button" data-render-toggle aria-pressed="false">HD</button>
    </div>
    <p class="vrm-control-label">FACE</p>
    <div class="vrm-control-group" role="group" aria-label="表情">
      <button class="px-chip is-active" type="button" data-expression="neutral">通常</button>
      <button class="px-chip" type="button" data-expression="blink">まばたき</button>
      <button class="px-chip" type="button" data-expression="angry">怒り</button>
      <button class="px-chip" type="button" data-expression="surprised">驚き</button>
      <button class="px-chip" type="button" data-expression="sad">悲しみ</button>
      <button class="px-chip" type="button" data-expression="relaxed">楽しい</button>
      <button class="px-chip" type="button" data-expression="happy">喜び</button>
    </div>
    <p class="vrm-control-label">TALK</p>
    <div class="vrm-control-group">
      <button class="px-chip" type="button" data-talk-toggle aria-pressed="false">会話モード</button>
    </div>
  </div>
`;
stage.appendChild(controlsPanel);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
camera.position.set(0, 1.35, 3.6);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  alpha: true,
});
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.enableZoom = false;
controls.target.set(0, 1.2, 0);

function syncTouchControls() {
  // On touch screens the canvas must not swallow vertical scrolling.
  controls.enabled = !coarsePointer.matches;
  canvas.style.touchAction = coarsePointer.matches ? "pan-y" : "none";
}

const keyLight = new THREE.DirectionalLight(0xfff3dc, 2.6);
keyLight.position.set(-1.6, 2.8, 3.0);
scene.add(keyLight);

const forestLight = new THREE.DirectionalLight(0x8dffc0, 1.2);
forestLight.position.set(-3, 1.6, 1.2);
scene.add(forestLight);

const cityLight = new THREE.DirectionalLight(0xff5c9a, 1.9);
cityLight.position.set(3, 1.4, -1.5);
scene.add(cityLight);

const cyanRim = new THREE.DirectionalLight(0x33f0f0, 1.4);
cyanRim.position.set(1.5, 2.2, -3);
scene.add(cyanRim);

scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a1630, 1.9));

const shadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.42, 24),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false }),
);
shadow.rotation.x = -Math.PI / 2;
shadow.scale.set(1, 0.55, 1);
shadow.position.y = 0.002;
scene.add(shadow);

let currentVrm = null;
const bones = {};
const lookTarget = new THREE.Vector2(0, 0);
const lookCurrent = new THREE.Vector2(0, 0);
let expressionMode = "neutral";
let cameraMode = initialCamera;
let isTalkMode = false;
let speechText = "";
let speechChars = [];
let visibleSpeech = "";
let speechIndex = 0;
let lastTypeTime = 0;
let isSpeaking = false;
let mouthShape = "aa";
let mouthIntensity = 0;
let modelBounds = null;
let pixelMode = readPixelPreference();
const fx = createFxLayer(container);
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const headPoint = new THREE.Vector3();
const headTopPoint = new THREE.Vector3();
let freezeUntil = 0;
let hopAt = 0;
let hopPower = 0;
let motionTime = 0;
let tilt = 0;
let tiltUntil = 0;
let dizzyUntil = 0;
let sleeping = false;
let nextSnore = 0;
let lastActivity = performance.now();
let lastExpressionAt = performance.now();
let lookUpSince = 0;
let lastLookUp = -Infinity;
let lastCurious = -Infinity;
let lastDizzy = -Infinity;
let pokes = [];
let calmTimer = 0;
let spin = [];
const desiredCameraPosition = new THREE.Vector3().copy(camera.position);
const desiredCameraTarget = new THREE.Vector3().copy(controls.target);
const clock = new THREE.Clock();
const pageGuideMessages = {
  index: "ようこそ、かぶとの住処へ。メニューから見たいページを選んでください。",
  introduction: "自己紹介では、制作姿勢とこれまでの経験をまとめています。",
  skills: "SKILLでは、扱える技術と得意な作り方を整理しています。",
  gallery: "GALLERYでは、これまで作ってきた作品を紹介しています。気になるものを選んでみてください。",
  alakazar: "ALAKAZARは、友人と二人で制作中のターン制タクティクスローグライクです。体験版も遊べます！",
};
const pageGuideText = pageGuideMessages[document.body.dataset.page] ?? "気になる項目を選ぶと、制作内容を見られます。";

function readPixelPreference() {
  try {
    return window.localStorage.getItem("kabuto-vrm-render-v2") === "dot";
  } catch {
    return false;
  }
}

function savePixelPreference() {
  try {
    window.localStorage.setItem("kabuto-vrm-render-v2", pixelMode ? "dot" : "hd");
  } catch {
    // Storage can be unavailable (private mode); the toggle still works for this visit.
  }
}

function pixelSize() {
  const scenePx = parseFloat(getComputedStyle(stage).getPropertyValue("--scene-px")) || 4;
  return Math.max(2, Math.round(scenePx * 0.75));
}

function resizeRenderer() {
  const width = Math.max(container.clientWidth, 120);
  const height = Math.max(container.clientHeight, 120);

  if (pixelMode) {
    const size = pixelSize();
    renderer.setPixelRatio(1);
    renderer.setSize(Math.round(width / size), Math.round(height / size), false);
  } else {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
  }
  container.classList.toggle("is-pixel", pixelMode);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function calculateModelBounds(vrm) {
  const box = new THREE.Box3().setFromObject(vrm.scene);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z);

  modelBounds = { center, size, maxSize, bottom: box.min.y };
  shadow.position.set(center.x, box.min.y + 0.002, center.z);
  camera.near = Math.max(maxSize / 100, 0.01);
  camera.far = maxSize * 14;
  camera.updateProjectionMatrix();
}

function setCameraMode(nextMode, immediate = false) {
  if (!modelBounds) {
    return;
  }

  cameraMode = nextMode;
  const { center, size, maxSize } = modelBounds;
  const distance = maxSize / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  const isFace = cameraMode === "face";
  const targetY = isFace ? center.y + size.y * 0.24 : center.y + size.y * 0.02;
  const distanceScale = isFace ? 0.74 : 1.08;

  desiredCameraTarget.set(center.x, targetY, center.z);
  desiredCameraPosition.set(center.x, targetY + (isFace ? 0 : size.y * 0.04), center.z + distance * distanceScale);

  controls.minDistance = Math.max(distance * 0.25, 0.45);
  controls.maxDistance = distance * 1.8;

  if (immediate) {
    camera.position.copy(desiredCameraPosition);
    controls.target.copy(desiredCameraTarget);
    controls.update();
  }
  setActiveButton("camera", cameraMode);
}

function setActiveButton(kind, value) {
  controlsPanel.querySelectorAll(`[data-${kind}]`).forEach((button) => {
    const active = button.dataset[kind] === value;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function setControlsCollapsed(isCollapsed) {
  controlsPanel.classList.toggle("is-collapsed", isCollapsed);
  const button = controlsPanel.querySelector(".vrm-controls-toggle");
  button.setAttribute("aria-expanded", String(!isCollapsed));
  button.querySelector("span").textContent = isCollapsed ? "▼" : "▲";
}

function setPixelMode(next, { save = true } = {}) {
  pixelMode = next;
  const button = controlsPanel.querySelector("[data-render-toggle]");
  button.textContent = pixelMode ? "DOT" : "HD";
  button.setAttribute("aria-pressed", String(pixelMode));
  button.classList.toggle("is-active", pixelMode);
  if (save) savePixelPreference();
  resizeRenderer();
}

function getBone(vrm, name) {
  return vrm.humanoid?.getNormalizedBoneNode(name) ?? null;
}

// Poses per expression: rotations (x, y, z radians) of normalized humanoid bones.
const POSE_BONES = ["spine", "chest", "neck", "head", "leftUpperArm", "rightUpperArm", "leftLowerArm", "rightLowerArm"];
const ZERO = [0, 0, 0];
const REST = {
  leftUpperArm: [-0.08, 0, -0.95],
  rightUpperArm: [-0.08, 0, 0.95],
  leftLowerArm: [0, 0, -0.12],
  rightLowerArm: [0, 0, 0.12],
  neck: [0.04, 0, 0],
};
const POSES = {
  neutral: REST,
  happy: { ...REST, leftUpperArm: [0, 0, 0.75], rightUpperArm: [0, 0, -0.75], leftLowerArm: [0, 0, 0.35], rightLowerArm: [0, 0, -0.35], spine: [-0.05, 0, 0] },
  relaxed: { ...REST, leftUpperArm: [-0.08, 0, -1.08], rightUpperArm: [-0.08, 0, 1.08], head: [0, 0, 0.12] },
  surprised: { ...REST, leftUpperArm: [-0.2, 0, -0.3], rightUpperArm: [-0.2, 0, 0.3], leftLowerArm: [0, 0, 0.55], rightLowerArm: [0, 0, -0.55], spine: [-0.08, 0, 0], head: [-0.1, 0, 0] },
  angry: { ...REST, leftUpperArm: [0.1, 0, -0.65], rightUpperArm: [0.1, 0, 0.65], leftLowerArm: [0, 0, -1.3], rightLowerArm: [0, 0, 1.3], spine: [0.07, 0, 0], head: [0.12, 0, 0] },
  sad: { ...REST, leftUpperArm: [0.05, 0, -1.22], rightUpperArm: [0.05, 0, 1.22], spine: [0.08, 0, 0], neck: [0.08, 0, 0], head: [0.1, 0, -0.12] },
  blink: { ...REST, rightUpperArm: [0, 0, -1.15], rightLowerArm: [0, 0, -0.25], head: [0, 0, -0.08] },
  sleep: { ...REST, spine: [0.06, 0, 0], neck: [0.2, 0, 0], head: [0.25, 0, 0.18] },
};
// Motions layered on top of a pose.
const GESTURES = {
  blink: (t) => ({ rightLowerArm: [0, 0, Math.sin(t * 9) * 0.35] }),
  happy: (t) => ({ leftLowerArm: [0, 0, Math.sin(t * 6) * 0.12], rightLowerArm: [0, 0, -Math.sin(t * 6) * 0.12] }),
  angry: (t) => ({ spine: [0, 0, Math.sin(t * 40) * 0.012] }),
  sleep: (t) => ({ head: [Math.sin(t * 1.2) * 0.05, 0, 0] }),
  dizzy: (t) => ({ head: [Math.sin(t * 5) * 0.06, 0, Math.cos(t * 5) * 0.1] }),
};
const HOP = { happy: 0.035, surprised: 0.045, blink: 0.02 };
const poseCurrent = Object.fromEntries(POSE_BONES.map((name) => [name, new THREE.Vector3()]));

function initPose(vrm) {
  for (const name of POSE_BONES) {
    bones[name] = getBone(vrm, name);
    poseCurrent[name].set(...(REST[name] ?? ZERO));
  }
}

function updateExpression(vrm, elapsed) {
  const manager = vrm.expressionManager;
  if (!manager) {
    return;
  }

  const autoBlink = Math.max(0, Math.sin(elapsed * 2.6) - 0.94) * 16;
  const talkingPulse = isSpeaking ? 0.55 + Math.sin(elapsed * 32) * 0.35 : 0;
  mouthIntensity = THREE.MathUtils.lerp(mouthIntensity, talkingPulse, isSpeaking ? 0.55 : 0.18);

  const values = {
    blink: sleeping ? 1 : expressionMode === "blink" ? 0.95 : Math.min(autoBlink, 1),
    angry: !sleeping && expressionMode === "angry" ? 0.75 : 0,
    surprised: !sleeping && expressionMode === "surprised" ? 0.9 : 0,
    sad: !sleeping && expressionMode === "sad" ? 0.86 : 0,
    relaxed: !sleeping && expressionMode === "relaxed" ? 0.85 : 0,
    happy: !sleeping && expressionMode === "happy" ? 0.88 : 0,
    aa: !sleeping && expressionMode === "surprised" ? 0.25 : 0,
    ih: 0,
    ou: 0,
    ee: 0,
    oh: 0,
  };

  values[mouthShape] = Math.max(values[mouthShape], mouthIntensity);

  manager.setValue("blink", values.blink);
  manager.setValue("blinkLeft", values.blink);
  manager.setValue("blinkRight", values.blink);
  manager.setValue("happy", values.happy);
  manager.setValue("angry", values.angry);
  manager.setValue("surprised", values.surprised);
  manager.setValue("sad", values.sad);
  manager.setValue("relaxed", values.relaxed);
  manager.setValue("aa", values.aa);
  manager.setValue("ih", values.ih);
  manager.setValue("ou", values.ou);
  manager.setValue("ee", values.ee);
  manager.setValue("oh", values.oh);
}

function getMouthShape(character) {
  if ("いきしちにひみりぎじぢびぴイキシチニヒミリギジヂビピ".includes(character)) {
    return "ih";
  }
  if ("うくすつぬふむゆるぐずづぶぷゅュウクスツヌフムユルグズヅブプ".includes(character)) {
    return "ou";
  }
  if ("えけせてねへめれげぜでべぺぇェエケセテネヘメレゲゼデベペ".includes(character)) {
    return "ee";
  }
  if ("おこそとのほもよろごぞどぼぽょョオコソトノホモヨロゴゾドボポ".includes(character)) {
    return "oh";
  }
  return "aa";
}

// Lines the guide says when reacting.
const LINES = {
  poke1: "むっ、貴様か。見事な奇襲だ。褒めて使わそう。",
  poke3: "フハハ、貴様の好奇心、嫌いでないぞ。",
  poke5: "💢貴様〜〜〜❗️❓我々をおちょくるにしても限度ってものがあるぞ❗️💢",
  oddClick: "どうかしたか？我々にはそこに何もないように見えるが...",
  wake: "はっ！　眠ってなどいない。電子の海を巡回していたのだ！",
  dizzy: "ぐぬぬ…め、目が回る…！",
  welcomeBack: "戻ったか。待ちくたびれたぞ。",
};

// Changing the face freezes the body for a beat (so the new face reads), then hops,
// and pops a pixel emote next to the head.
function setExpression(mode, { effect = true, force = false } = {}) {
  if (!mode || (mode === expressionMode && !force)) {
    return;
  }
  expressionMode = mode;
  setActiveButton("expression", mode);
  lastExpressionAt = performance.now();
  if (!currentVrm) {
    return;
  }
  freezeUntil = performance.now() + 380;
  if (HOP[mode] && !reduceMotion.matches) {
    hopAt = freezeUntil;
    hopPower = HOP[mode];
  }
  if (effect) {
    fx.spawn(mode);
  }
}

function calmDown(after) {
  clearTimeout(calmTimer);
  calmTimer = setTimeout(() => setExpression("relaxed", { effect: false }), after);
}

function sayReaction(text) {
  if (!isTalkMode) {
    say(text);
  }
}

function wake() {
  lastActivity = performance.now();
  if (!sleeping) {
    return false;
  }
  sleeping = false;
  setExpression("surprised", { force: true });
  sayReaction(LINES.wake);
  calmDown(2500);
  return true;
}

function hitsAvatar(clientX, clientY) {
  if (!currentVrm) {
    return false;
  }
  const rect = canvas.getBoundingClientRect();
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
    return false;
  }
  pointerNdc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointerNdc, camera);
  return raycaster.intersectObject(currentVrm.scene, true).length > 0;
}

function poke() {
  const now = performance.now();
  pokes = pokes.filter((time) => now - time < 4000);
  pokes.push(now);
  if (pokes.length >= 5) {
    pokes = [];
    setExpression("angry", { force: true });
    sayReaction(LINES.poke5);
    calmDown(3500);
  } else if (pokes.length >= 3) {
    setExpression("happy", { force: true });
    sayReaction(LINES.poke3);
    calmDown(3000);
  } else {
    setExpression("surprised", { force: true });
    if (pokes.length === 1) sayReaction(LINES.poke1);
    calmDown(2500);
  }
}

function curious() {
  const now = performance.now();
  if (now - lastCurious < 2500) {
    return;
  }
  lastCurious = now;
  tiltUntil = now + 1800;
  fx.spawn("question");
  sayReaction(LINES.oddClick);
}

function containerOnScreen() {
  const rect = container.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight;
}

function say(text, expression) {
  const next = String(text ?? "").trim();
  if (!next || (next === speechText && isSpeaking)) {
    return;
  }

  speechText = next;
  speechChars = Array.from(next);
  if (expression) {
    setExpression(expression);
  }
  visibleSpeech = "";
  speechIndex = 0;
  lastTypeTime = performance.now();
  isSpeaking = true;
  guideText.textContent = "";
  guideBox.classList.add("is-speaking");
}

function setTalkMode(isOpen) {
  isTalkMode = isOpen;
  talkForm.hidden = !isTalkMode;
  guideBox.classList.toggle("is-talk", isTalkMode);
  const button = controlsPanel.querySelector("[data-talk-toggle]");
  button.classList.toggle("is-active", isTalkMode);
  button.setAttribute("aria-pressed", String(isTalkMode));
  if (isTalkMode) {
    say("喋ってほしい言葉を入れてね。");
    talkInput.focus();
  }
}

function updateTypewriter(now) {
  if (!isSpeaking) {
    return;
  }

  const currentCharacter = speechChars[speechIndex];
  const isPause = "。、,.!?！？…".includes(currentCharacter);
  const interval = isPause ? 160 : 42;

  if (now - lastTypeTime < interval) {
    return;
  }

  visibleSpeech += currentCharacter;
  guideText.textContent = visibleSpeech;
  mouthShape = getMouthShape(currentCharacter);
  speechIndex += 1;
  lastTypeTime = now;

  if (speechIndex >= speechChars.length) {
    isSpeaking = false;
    guideBox.classList.remove("is-speaking");
  }
}

function updatePose(elapsed, delta, now) {
  if (!currentVrm) {
    return;
  }

  const frozen = now < freezeUntil;
  if (!frozen) {
    motionTime += delta;
    // While dizzy the avatar stops tracking the cursor.
    lookCurrent.lerp(now < dizzyUntil ? lookTarget.clone().multiplyScalar(0.15) : lookTarget, 0.08);
  }
  const t = motionTime;
  const mode = sleeping ? "sleep" : expressionMode;
  const pose = POSES[mode] ?? REST;
  const gesture = (now < dizzyUntil ? GESTURES.dizzy : GESTURES[mode])?.(t) ?? {};
  tilt += ((now < tiltUntil ? 0.22 : 0) - tilt) * 0.1;

  for (const name of POSE_BONES) {
    const node = bones[name];
    if (!node) continue;
    const current = poseCurrent[name];
    if (!frozen) {
      const [x, y, z] = pose[name] ?? ZERO;
      current.x += (x - current.x) * 0.14;
      current.y += (y - current.y) * 0.14;
      current.z += (z - current.z) * 0.14;
    }
    const [gx, gy, gz] = gesture[name] ?? ZERO;
    let rx = current.x + gx;
    let ry = current.y + gy;
    let rz = current.z + gz;
    if (name === "head") {
      ry += lookCurrent.x * 0.3;
      rx += lookCurrent.y * 0.18;
      rz += tilt;
    } else if (name === "neck") {
      ry += lookCurrent.x * 0.12;
      rx += lookCurrent.y * 0.08;
    } else if (name === "rightLowerArm" && isSpeaking && (mode === "relaxed" || mode === "neutral")) {
      rz += Math.sin(t * 7) * 0.06;
    }
    node.rotation.set(rx, ry, rz);
  }

  const sway = Math.sin(t * 1.6);
  currentVrm.scene.rotation.y = sway * 0.045 + lookCurrent.x * 0.1;
  let y = Math.sin(t * 2.1) * 0.006;
  if (hopAt && now >= hopAt) {
    const progress = (now - hopAt) / 320;
    if (progress >= 1) {
      hopAt = 0;
    } else {
      y += Math.sin(Math.PI * progress) * hopPower;
    }
  }
  currentVrm.scene.position.y = y;

  updateExpression(currentVrm, elapsed);
}

// Keeps the effect layer pinned to the head and runs the idle behaviours.
function updateReactions(now) {
  if (!currentVrm || !modelBounds || !bones.head) {
    return;
  }
  bones.head.getWorldPosition(headPoint);
  headPoint.y += modelBounds.size.y * 0.1;
  headTopPoint.copy(headPoint);
  headTopPoint.y += modelBounds.size.y * 0.17;
  headPoint.project(camera);
  headTopPoint.project(camera);
  const width = container.clientWidth;
  const height = container.clientHeight;
  const hx = ((headPoint.x + 1) / 2) * width;
  const hy = ((1 - headPoint.y) / 2) * height;
  const radius = Math.abs(((headPoint.y - headTopPoint.y) / 2) * height);
  fx.follow(hx, hy, Math.max(18, radius));

  if (document.hidden || isTalkMode) {
    return;
  }

  // Doze off after a long quiet spell; Zz while asleep.
  if (!sleeping && !isSpeaking && now - lastActivity > 30000) {
    sleeping = true;
    nextSnore = now;
  }
  if (sleeping && now >= nextSnore) {
    fx.spawn("sleep");
    nextSnore = now + 2600;
  }
  if (sleeping) {
    return;
  }

  // Staring straight up for a while: "…"
  if (lookTarget.y <= -0.95) {
    lookUpSince ||= now;
    if (now - lookUpSince > 1200 && now - lastLookUp > 12000) {
      lastLookUp = now;
      tiltUntil = now + 1500;
      fx.spawn("ponder");
    }
  } else {
    lookUpSince = 0;
  }

  // Now and then, a new face on its own.
  if (!isSpeaking && now - lastExpressionAt > 20000 && now - lastActivity < 25000) {
    const choices = ["happy", "blink", "relaxed"].filter((mode) => mode !== expressionMode);
    setExpression(choices[Math.floor(Math.random() * choices.length)]);
  }
}

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const elapsed = clock.elapsedTime;

  const now = performance.now();
  updateTypewriter(now);
  updatePose(elapsed, delta, now);
  updateReactions(now);
  currentVrm?.update(delta);
  camera.position.lerp(desiredCameraPosition, 0.08);
  controls.target.lerp(desiredCameraTarget, 0.08);
  controls.update();
  renderer.render(scene, camera);
}

controlsPanel.addEventListener("pointerdown", (event) => {
  event.stopPropagation();
});

controlsPanel.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }

  if (button.classList.contains("vrm-controls-toggle")) {
    setControlsCollapsed(!controlsPanel.classList.contains("is-collapsed"));
    return;
  }

  if (button.dataset.camera) {
    setCameraMode(button.dataset.camera);
  }

  if (button.hasAttribute("data-render-toggle")) {
    setPixelMode(!pixelMode);
  }

  if (button.hasAttribute("data-talk-toggle")) {
    setTalkMode(!isTalkMode);
  }

  if (button.dataset.expression) {
    wake();
    setExpression(button.dataset.expression, { force: true });
  }
});

talkForm.addEventListener("submit", (event) => {
  event.preventDefault();
  say(talkInput.value);
  talkInput.value = "";
});

// The head follows the cursor anywhere on the page, not only over the canvas.
let lastPointer = null;
window.addEventListener("pointermove", (event) => {
  const rect = container.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
  const y = ((event.clientY - (rect.top + rect.height * 0.25)) / rect.height) * 2;
  lookTarget.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1));
  wake();

  // Whirling the cursor around the avatar makes it dizzy.
  const now = performance.now();
  const inside = Math.abs(x) < 1 && event.clientY > rect.top && event.clientY < rect.bottom;
  if (inside && lastPointer && currentVrm) {
    spin.push({ t: now, d: Math.hypot(event.clientX - lastPointer.x, event.clientY - lastPointer.y) });
  }
  lastPointer = { x: event.clientX, y: event.clientY };
  spin = spin.filter((entry) => now - entry.t < 1500);
  const travelled = spin.reduce((sum, entry) => sum + entry.d, 0);
  if (travelled > rect.width * 3.5 && now - lastDizzy > 15000 && !isTalkMode) {
    lastDizzy = now;
    spin = [];
    dizzyUntil = now + 2400;
    setExpression("sad", { effect: false, force: true });
    fx.spawn("dizzy");
    sayReaction(LINES.dizzy);
    calmDown(2800);
  }
});

// Clicks: poking the avatar, or clicking somewhere with nothing to click.
let pressStart = null;
window.addEventListener("pointerdown", (event) => {
  pressStart = { x: event.clientX, y: event.clientY, t: performance.now() };
  wake();
});
window.addEventListener("pointerup", (event) => {
  if (!pressStart || !currentVrm) return;
  const moved = Math.hypot(event.clientX - pressStart.x, event.clientY - pressStart.y);
  const quick = performance.now() - pressStart.t < 500;
  pressStart = null;
  if (moved > 6 || !quick || event.button !== 0) return;
  if (event.target.closest("a, button, input, textarea, select, label, summary, [role='button'], .vrm-controls, .guide-box, .title-menu, .site-header")) return;
  if (hitsAvatar(event.clientX, event.clientY)) {
    poke();
  } else if (containerOnScreen() && !isTalkMode) {
    curious();
  }
});

for (const type of ["keydown", "scroll", "touchstart"]) {
  window.addEventListener(type, wake, { passive: true });
}

let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    hiddenAt = performance.now();
    fx.clear();
    return;
  }
  const away = performance.now() - hiddenAt;
  lastActivity = performance.now();
  sleeping = false;
  if (hiddenAt && away > 8000 && currentVrm && !isTalkMode) {
    setExpression("happy", { force: true });
    sayReaction(LINES.welcomeBack);
    calmDown(3000);
  }
});

document.addEventListener("pointerleave", () => {
  lookTarget.set(0, 0);
});

// Other scripts (menu hover, gallery cards) make the guide speak.
document.addEventListener("guide:say", (event) => {
  if (!isTalkMode) {
    say(event.detail?.text, event.detail?.expression);
  }
});

stage.addEventListener("scene:flash", () => {
  if (currentVrm && !isSpeaking && !sleeping && containerOnScreen() && (expressionMode === "relaxed" || expressionMode === "neutral")) {
    const before = expressionMode;
    setExpression("surprised");
    const token = lastExpressionAt;
    setTimeout(() => {
      // Only undo our own surprise, not a face something else set meanwhile.
      if (lastExpressionAt === token) setExpression(before, { effect: false });
    }, 2200);
  }
});

new ResizeObserver(resizeRenderer).observe(container);
coarsePointer.addEventListener("change", syncTouchControls);

syncTouchControls();
setPixelMode(pixelMode, { save: false });
setActiveButton("camera", cameraMode);

const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));

loader.load(
  MODEL_URL,
  (gltf) => {
    currentVrm = gltf.userData.vrm;
    VRMUtils.removeUnnecessaryVertices(currentVrm.scene);

    currentVrm.scene.rotation.y = Math.PI;
    scene.add(currentVrm.scene);
    initPose(currentVrm);
    calculateModelBounds(currentVrm);
    setCameraMode(cameraMode, true);
    status.remove();
    container.classList.add("is-ready");
    say(pageGuideText, "relaxed");
  },
  (progress) => {
    if (progress.total > 0) {
      const percent = Math.round((progress.loaded / progress.total) * 100);
      status.textContent = `NOW LOADING ${percent}%`;
    }
  },
  (error) => {
    console.error(error);
    status.textContent = "アバターを読み込めませんでした";
    say(pageGuideText);
  },
);

animate();
