import * as THREE from "https://esm.sh/three@0.164.1";
import { GLTFLoader } from "https://esm.sh/three@0.164.1/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "https://esm.sh/three@0.164.1/examples/jsm/controls/OrbitControls.js";
import { VRMLoaderPlugin, VRMUtils } from "https://esm.sh/@pixiv/three-vrm@3.3.6?deps=three@0.164.1";

const MODEL_URL = "assets/kabutomodel.vrm";

const canvas = document.querySelector("#unity-canvas");
const container = document.querySelector(".canvas-container");

if (!canvas || !container) {
  throw new Error("VRM viewer target was not found.");
}

container.classList.add("vrm-container");
canvas.classList.add("vrm-canvas");

const status = document.createElement("p");
status.className = "vrm-status";
status.textContent = "Loading avatar...";
container.appendChild(status);

const controlsPanel = document.createElement("div");
controlsPanel.className = "vrm-controls";
controlsPanel.innerHTML = `
  <button class="vrm-controls-toggle" type="button" aria-expanded="true">UI非表示</button>
  <div class="vrm-control-group" aria-label="Camera">
    <button class="vrm-button is-active" type="button" data-camera="full">全身</button>
    <button class="vrm-button" type="button" data-camera="face">顔アップ</button>
    <button class="vrm-button" type="button" data-talk-toggle>会話</button>
  </div>
  <div class="vrm-control-group" aria-label="Expression">
    <button class="vrm-button is-active" type="button" data-expression="neutral">通常</button>
    <button class="vrm-button" type="button" data-expression="blink">まばたき</button>
    <button class="vrm-button" type="button" data-expression="angry">怒り</button>
    <button class="vrm-button" type="button" data-expression="surprised">驚き</button>
    <button class="vrm-button" type="button" data-expression="sad">悲しみ</button>
    <button class="vrm-button" type="button" data-expression="relaxed">楽しい</button>
    <button class="vrm-button" type="button" data-expression="happy">喜び</button>
  </div>
`;
container.appendChild(controlsPanel);

const pageGuide = document.createElement("div");
pageGuide.className = "vrm-page-guide";
pageGuide.setAttribute("aria-live", "polite");
container.appendChild(pageGuide);

const talkPanel = document.createElement("div");
talkPanel.className = "vrm-talk-panel";
talkPanel.hidden = true;
talkPanel.innerHTML = `
  <button class="vrm-talk-close" type="button">閉じる</button>
  <div class="vrm-talk-box" aria-live="polite"></div>
  <form class="vrm-talk-form">
    <input class="vrm-talk-input" type="text" maxlength="90" placeholder="喋らせたい言葉を入力">
    <button class="vrm-talk-submit" type="submit">喋る</button>
  </form>
`;
container.appendChild(talkPanel);

const talkBox = talkPanel.querySelector(".vrm-talk-box");
const talkForm = talkPanel.querySelector(".vrm-talk-form");
const talkInput = talkPanel.querySelector(".vrm-talk-input");
const talkClose = talkPanel.querySelector(".vrm-talk-close");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x18212c);
scene.fog = new THREE.Fog(0x18212c, 4.5, 9);

const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
camera.position.set(0, 1.35, 3.6);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 1.5;
controls.maxDistance = 5.5;
controls.target.set(0, 1.2, 0);

const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
keyLight.position.set(1.2, 2.8, 3.0);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x9fe7ff, 1.8);
fillLight.position.set(-2.5, 1.9, 1.8);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xff8bd2, 1.6);
rimLight.position.set(2.5, 1.4, -2.5);
scene.add(rimLight);

scene.add(new THREE.HemisphereLight(0xffffff, 0x3b4560, 2.2));

const stage = new THREE.Group();
scene.add(stage);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(1.8, 64),
  new THREE.MeshStandardMaterial({
    color: 0x344252,
    roughness: 0.8,
    metalness: 0.1,
  }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.02;
stage.add(floor);

const grid = new THREE.GridHelper(3.6, 18, 0x54d7ff, 0x526270);
grid.position.y = 0.002;
stage.add(grid);

const backPanel = new THREE.Mesh(
  new THREE.PlaneGeometry(4.8, 2.8),
  new THREE.MeshBasicMaterial({
    color: 0x253446,
    transparent: true,
    opacity: 0.64,
  }),
);
backPanel.position.set(0, 1.35, -1.25);
stage.add(backPanel);

for (const [x, y, width, color] of [
  [-1.35, 1.95, 1.15, 0x58d8ff],
  [1.22, 1.58, 1.45, 0xff8bd2],
  [0.0, 0.85, 2.25, 0x8effb5],
]) {
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(width, 0.035),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
  );
  strip.position.set(x, y, -1.23);
  stage.add(strip);
}

let currentVrm = null;
let leftUpperArm = null;
let rightUpperArm = null;
let leftLowerArm = null;
let rightLowerArm = null;
let neck = null;
let head = null;
let lookTarget = new THREE.Vector2(0, 0);
let expressionMode = "neutral";
let cameraMode = "full";
let isTalkPanelOpen = false;
let speechText = "";
let visibleSpeech = "";
let speechIndex = 0;
let lastTypeTime = 0;
let isSpeaking = false;
let speechTarget = null;
let mouthShape = "aa";
let mouthIntensity = 0;
let modelBounds = null;
const desiredCameraPosition = new THREE.Vector3().copy(camera.position);
const desiredCameraTarget = new THREE.Vector3().copy(controls.target);
const clock = new THREE.Clock();
const mobileControlsQuery = window.matchMedia("(max-width: 768px)");
const pageGuideMessages = {
  "/": "ようこそ。制作姿勢、扱える技術、これまでの作品をここから案内します。",
  "/index.html": "ようこそ。制作姿勢、扱える技術、これまでの作品をここから案内します。",
  "/introduction.html": "自己紹介では、制作姿勢とこれまでの経験をまとめています。",
  "/skills.html": "Skillsでは、扱える技術と得意な作り方を整理しています。",
  "/gallery.html": "Galleryでは、これまで作ってきた作品を紹介しています。",
};
const pageGuideText = pageGuideMessages[window.location.pathname] ?? "気になる項目を選ぶと、制作内容を見られます。";

function resizeRenderer() {
  const width = Math.max(container.clientWidth, 320);
  const height = Math.max(container.clientHeight, 220);

  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function calculateModelBounds(vrm) {
  const box = new THREE.Box3().setFromObject(vrm.scene);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z);

  modelBounds = { center, size, maxSize };
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
  const targetY = isFace ? center.y + size.y * 0.25 : center.y + size.y * 0.08;
  const distanceScale = isFace ? 0.66 : 1.18;

  desiredCameraTarget.set(center.x, targetY, center.z);
  desiredCameraPosition.set(center.x, targetY + (isFace ? -0.06 : -size.y * 0.02), center.z + distance * distanceScale);

  controls.minDistance = Math.max(distance * 0.25, 0.45);
  controls.maxDistance = distance * 1.8;

  if (immediate) {
    camera.position.copy(desiredCameraPosition);
    controls.target.copy(desiredCameraTarget);
    controls.update();
  }
}

function setActiveButton(kind, value) {
  controlsPanel.querySelectorAll(`[data-${kind}]`).forEach((button) => {
    button.classList.toggle("is-active", button.dataset[kind] === value);
  });
}

function setControlsCollapsed(isCollapsed) {
  controlsPanel.classList.toggle("is-collapsed", isCollapsed);
  const button = controlsPanel.querySelector(".vrm-controls-toggle");
  button.textContent = isCollapsed ? "UI表示" : "UI非表示";
  button.setAttribute("aria-expanded", String(!isCollapsed));
}

function syncControlsForViewport() {
  setControlsCollapsed(true);
}

function getBone(vrm, name) {
  return vrm.humanoid?.getNormalizedBoneNode(name) ?? null;
}

function applyRestPose(vrm) {
  leftUpperArm = getBone(vrm, "leftUpperArm");
  rightUpperArm = getBone(vrm, "rightUpperArm");
  leftLowerArm = getBone(vrm, "leftLowerArm");
  rightLowerArm = getBone(vrm, "rightLowerArm");
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

function startSpeech(text) {
  speechText = text.trim();
  if (!speechText) {
    return;
  }

  visibleSpeech = "";
  speechIndex = 0;
  lastTypeTime = performance.now();
  isSpeaking = true;
  speechTarget = talkBox;
  talkBox.textContent = "";
  talkPanel.hidden = false;
  setTalkPanelOpen(true);
}

function startGuideSpeech(text) {
  speechText = text.trim();
  if (!speechText) {
    return;
  }

  expressionMode = "relaxed";
  setActiveButton("expression", expressionMode);
  visibleSpeech = "";
  speechIndex = 0;
  lastTypeTime = performance.now();
  isSpeaking = true;
  speechTarget = pageGuide;
  pageGuide.textContent = "";
  container.classList.add("has-page-guide");
}

function setTalkPanelOpen(isOpen) {
  isTalkPanelOpen = isOpen;
  talkPanel.hidden = !isTalkPanelOpen;
  container.classList.toggle("is-talk-open", isTalkPanelOpen);
  controlsPanel.querySelector("[data-talk-toggle]")?.classList.toggle("is-active", isTalkPanelOpen);
  if (isTalkPanelOpen) {
    talkInput.focus();
  }
}

function updateTypewriter(now) {
  if (!isSpeaking) {
    return;
  }

  const currentCharacter = speechText[speechIndex];
  const isPause = "。、,.!?！？…".includes(currentCharacter);
  const interval = isPause ? 180 : 48;

  if (now - lastTypeTime < interval) {
    return;
  }

  visibleSpeech += currentCharacter;
  if (speechTarget) {
    speechTarget.textContent = visibleSpeech;
  }
  mouthShape = getMouthShape(currentCharacter);
  speechIndex += 1;
  lastTypeTime = now;

  if (speechIndex >= speechText.length) {
    isSpeaking = false;
  }
}

function updatePose(elapsed) {
  if (!currentVrm) {
    return;
  }

  const sway = Math.sin(elapsed * 1.6);
  currentVrm.scene.rotation.y = sway * 0.045 + lookTarget.x * 0.08;
  currentVrm.scene.position.y = Math.sin(elapsed * 2.1) * 0.006;

  if (head) {
    head.rotation.y = lookTarget.x * 0.28;
    head.rotation.x = lookTarget.y * 0.16;
  }
  if (neck) {
    neck.rotation.y = lookTarget.x * 0.12;
    neck.rotation.x = 0.04 + lookTarget.y * 0.08;
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
    setActiveButton("camera", button.dataset.camera);
  }

  if (button.hasAttribute("data-talk-toggle")) {
    setTalkPanelOpen(!isTalkPanelOpen);
  }

  if (button.dataset.expression) {
    expressionMode = button.dataset.expression;
    setActiveButton("expression", expressionMode);
  }
});

talkPanel.addEventListener("pointerdown", (event) => {
  event.stopPropagation();
});

talkForm.addEventListener("submit", (event) => {
  event.preventDefault();
  startSpeech(talkInput.value);
  talkInput.value = "";
});

talkClose.addEventListener("click", () => {
  setTalkPanelOpen(false);
});

container.addEventListener("pointermove", (event) => {
  const rect = container.getBoundingClientRect();
  lookTarget.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
  lookTarget.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
});

container.addEventListener("pointerleave", () => {
  lookTarget.set(0, 0);
});

window.addEventListener("resize", resizeRenderer);
mobileControlsQuery.addEventListener("change", syncControlsForViewport);

resizeRenderer();
syncControlsForViewport();

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
    const initialCameraMode = mobileControlsQuery.matches ? "full" : "face";
    setCameraMode(initialCameraMode, true);
    setActiveButton("camera", initialCameraMode);
    status.remove();
    startGuideSpeech(pageGuideText);
  },
  (progress) => {
    if (progress.total > 0) {
      const percent = Math.round((progress.loaded / progress.total) * 100);
      status.textContent = `Loading avatar... ${percent}%`;
    }
  },
  (error) => {
    console.error(error);
    status.textContent = "Avatar could not be loaded. Check assets/kabutomodel.vrm.";
  },
);

animate();
