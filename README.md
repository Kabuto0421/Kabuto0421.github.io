# kabutoPage

このリポジトリは、かぶと（Kabuto）が管理している Web ページ用のプロジェクトです。
HTML/CSS/JavaScript によるページ構成と、Three.js + three-vrm による VRM アバター表示を組み合わせて公開しています。

## リポジトリ構成
```
├── .vs/
│   ├── KabutoPage/
│   ├── ProjectSettings.json
│   ├── VSWorkspaceState.json
│   └── kabutoPage3/
├── Build/
│   ├── kabutoPage3.data.unityweb
│   ├── kabutoPage3.framework.js.unityweb
│   ├── kabutoPage3.loader.js
│   └── kabutoPage3.wasm.unityweb
├── assets/
│   └── kabutomodel.vrm
├── CSS/
│   └── style.css
├── JS/
│   ├── index.js
│   └── vrm-viewer.js
├── Movie/
│   └── background.mp4
├── README.md
├── StreamingAssets/
│   └── UnityServicesProjectConfiguration.json
├── Thumbs.db
├── gallery.html
├── index.html
├── introduction.html
├── pictures/
│   ├── 各種画像ファイル（ロゴ、アイコン、スクリーンショットなど）
└── skills.html
```

### 主なディレクトリ・ファイル

- **Build/**
  以前の Unity WebGL 用ビルドファイル群です。現在の各ページでは直接読み込んでいません。
  - `kabutoPage3.data.unityweb` / `kabutoPage3.framework.js.unityweb` / `kabutoPage3.wasm.unityweb` / `kabutoPage3.loader.js` など
- **assets/**
  Web ページで読み込むモデルなどのアセットを配置します。現在は `kabutomodel.vrm` を使用しています。
- **CSS/**
  サイトのデザインを管理するスタイルシート (`style.css`) が含まれます。
- **JS/**
  JavaScript のスクリプトを配置しています。`index.js` はページ遷移などの基本操作、`vrm-viewer.js` は VRM アバター表示を担当します。
- **Movie/**
  背景動画などのメディアファイル。
- **pictures/**
  アイコンやボタン、タイトル画像などのリソースファイルを格納しています。
- **gallery.html / index.html / introduction.html / skills.html**
  Web ページ本体の HTML ファイルです。VRM アバター表示、背景動画、画像等を組み合わせてサイトとして公開しています。

---

## 特徴

- **VRM アバター表示**
  Three.js と three-vrm を使い、ブラウザ上で VRM モデルを表示します。マウス位置に合わせた視線・頭部の動き、待機モーション、表情変化を実装しています。
- **HTML/CSS/JavaScript**
  ページ構成やスタイリング、動的なページ操作は一般的な Web 技術で管理しています。
- **レスポンシブ対応**
  PC やモバイル端末の画面サイズに合わせた調整を CSS や JavaScript で実施しています。

---

## 更新方針

- 本リポジトリの内容は、必要に応じて随時更新されます。
- 不具合修正や新機能追加などがある場合、随時コミットやプルリクエストを行って最新の状態を維持します。
