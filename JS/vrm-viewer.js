import * as THREE from "https://esm.sh/three@0.164.1";
import { GLTFLoader } from "https://esm.sh/three@0.164.1/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "https://esm.sh/three@0.164.1/examples/jsm/controls/OrbitControls.js";
import { VRMLoaderPlugin, VRMUtils } from "https://esm.sh/@pixiv/three-vrm@3.3.6?deps=three@0.164.1";

const MODEL_URL = "assets/kabutomodel.vrm";

const canvas = document.querySelector("#vrm-canvas");
const container = canvas?.closest(".vrm-container");

if (!canvas || !container) {
  throw new Error("VRM viewer target was not found.");
}

const stage = container.closest(".stage") ?? container;
const initialCamera = container.dataset.camera ?? "face";
const coarsePointer = window.matchMedia("(pointer: coarse)");

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
let neck = null;
let head = null;
const lookTarget = new THREE.Vector2(0, 0);
const lookCurrent = new THREE.Vector2(0, 0);
let expressionMode = "neutral";
let cameraMode = initialCamera;
let isTalkMode = false;
let speechText = "";
let visibleSpeech = "";
let speechIndex = 0;
let lastTypeTime = 0;
let isSpeaking = false;
let mouthShape = "aa";
let mouthIntensity = 0;
let modelBounds = null;
let pixelMode = readPixelPreference();
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

function applyRestPose(vrm) {
  const leftUpperArm = getBone(vrm, "leftUpperArm");
  const rightUpperArm = getBone(vrm, "rightUpperArm");
  const leftLowerArm = getBone(vrm, "leftLowerArm");
  const rightLowerArm = getBone(vrm, "rightLowerArm");
  neck = getBone(vrm, "neck");
  head = getBone(vrm, "head");

  if (leftUpperArm) {
    leftUpperArm.rotation.z = -0.95;
    leftUpperArm.rotation.x = -0.08;
  }
  if (rightUpperArm) {
    rightUpperArm.rotation.z = 0.95;
    rightUpperArm.rotation.x = -0.08;
  }
  if (leftLowerArm) {
    leftLowerArm.rotation.z = -0.12;
  }
  if (rightLowerArm) {
    rightLowerArm.rotation.z = 0.12;
  }
  if (neck) {
    neck.rotation.x = 0.04;
  }

  vrm.humanoid?.update();
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
    blink: expressionMode === "blink" ? 0.95 : Math.min(autoBlink, 1),
    angry: expressionMode === "angry" ? 0.75 : 0,
    surprised: expressionMode === "surprised" ? 0.9 : 0,
    sad: expressionMode === "sad" ? 0.86 : 0,
    relaxed: expressionMode === "relaxed" ? 0.85 : 0,
    happy: expressionMode === "happy" ? 0.88 : 0,
    aa: expressionMode === "surprised" ? 0.25 : 0,
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

function say(text, expression) {
  const next = String(text ?? "").trim();
  if (!next || (next === speechText && isSpeaking)) {
    return;
  }

  speechText = next;
  if (expression) {
    expressionMode = expression;
    setActiveButton("expression", expressionMode);
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

  const currentCharacter = speechText[speechIndex];
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

  if (speechIndex >= speechText.length) {
    isSpeaking = false;
    guideBox.classList.remove("is-speaking");
  }
}

function updatePose(elapsed) {
  if (!currentVrm) {
    return;
  }

  lookCurrent.lerp(lookTarget, 0.08);
  const sway = Math.sin(elapsed * 1.6);
  currentVrm.scene.rotation.y = sway * 0.045 + lookCurrent.x * 0.1;
  currentVrm.scene.position.y = Math.sin(elapsed * 2.1) * 0.006;

  if (head) {
    head.rotation.y = lookCurrent.x * 0.3;
    head.rotation.x = lookCurrent.y * 0.18;
  }
  if (neck) {
    neck.rotation.y = lookCurrent.x * 0.12;
    neck.rotation.x = 0.04 + lookCurrent.y * 0.08;
  }

  updateExpression(currentVrm, elapsed);
}

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const elapsed = clock.elapsedTime;

  updateTypewriter(performance.now());
  updatePose(elapsed);
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
    expressionMode = button.dataset.expression;
    setActiveButton("expression", expressionMode);
  }
});

talkForm.addEventListener("submit", (event) => {
  event.preventDefault();
  say(talkInput.value);
  talkInput.value = "";
});

// The head follows the cursor anywhere on the page, not only over the canvas.
window.addEventListener("pointermove", (event) => {
  const rect = container.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
  const y = ((event.clientY - (rect.top + rect.height * 0.25)) / rect.height) * 2;
  lookTarget.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1));
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
  if (currentVrm && !isSpeaking && expressionMode === "relaxed") {
    expressionMode = "surprised";
    setTimeout(() => {
      if (expressionMode === "surprised") expressionMode = "relaxed";
    }, 600);
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
    applyRestPose(currentVrm);
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
