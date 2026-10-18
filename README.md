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
│   ├── alakazar.css
│   └── style.css
├── JS/
│   ├── pixel-scene.js
│   ├── site.js
│   └── vrm-viewer.js
├── Movie/
│   └── background.mp4
├── README.md
├── StreamingAssets/
│   └── UnityServicesProjectConfiguration.json
├── Thumbs.db
├── alakazar.html
├── gallery.html
├── index.html
├── introduction.html
├── pictures/
│   ├── alakazar/（ALAKAZARのサムネイルとゲーム画面）
│   ├── icon/（ドット絵アイコン kabuto-pixel.png。ファビコンとヘッダーで使用）
│   ├── thumbs/（ギャラリー用の軽量サムネイル .webp）
│   └── 各種画像ファイル（ロゴ、アイコン、スクリーンショットなど）
└── skills.html
```

### 主なディレクトリ・ファイル

- **Build/**
  以前の Unity WebGL 用ビルドファイル群です。現在の各ページでは直接読み込んでいません。
  - `kabutoPage3.data.unityweb` / `kabutoPage3.framework.js.unityweb` / `kabutoPage3.wasm.unityweb` / `kabutoPage3.loader.js` など
- **assets/**
  Web ページで読み込むモデルなどのアセットを配置します。現在は `kabutomodel.vrm` を使用しています。
- **CSS/**
  サイト共通の `style.css` と、ALAKAZAR の作品紹介に使う `alakazar.css` が含まれます。
- **JS/**
  JavaScript のスクリプトを配置しています。
  - `pixel-scene.js`：ステージ背景のドット絵（夜の街・樹液の木とカブトムシ・回路の地面・ワイヤーフレーム・稲妻）を画像を使わずに低解像度で描き、拡大表示します。
  - `vrm-viewer.js`：VRM アバター表示。低解像度で描いてドット絵風に表示（AVATAR メニューで DOT / HD を切替）、案内ウィンドウへのセリフ表示、表情・カメラ・会話モード。
  - `site.js`：ドット文字ロゴ、タイトルメニュー（カーソル / ↑↓ / Enter で選択、選ぶと案内役が説明）、スクロール表示。
- **Movie/**
  背景動画などのメディアファイル。
- **pictures/**
  アイコンやボタン、タイトル画像などのリソースファイルを格納しています。
- **gallery.html / alakazar.html / index.html / introduction.html / skills.html**
  Web ページ本体の HTML ファイルです。ページごとに VRM アバター表示や画像等を組み合わせてサイトとして公開しています。
  `gallery.html` から `alakazar.html` の作品紹介へ移動できます。

---

## 特徴

- **VRM アバター表示**
  Three.js と three-vrm を使い、ブラウザ上で VRM モデルを表示します。マウス位置に合わせた視線・頭部の動き、待機モーション、表情変化を実装しています。
- **ドット絵のステージ**
  背景・ロゴ・ウィンドウ枠・カーソルはすべてコード（canvas / インライン SVG）で描いています。
- **文字ロゴの差し替え**
  `index.html` の `title-logo__mark` を `<img>` に置き換えると画像ロゴにできます。黒背景の画像は `mix-blend-mode: screen` で黒が透けて背景になじみます。
- **HTML/CSS/JavaScript**
  ページ構成やスタイリング、動的なページ操作は一般的な Web 技術で管理しています。
- **レスポンシブ対応**
  PC やモバイル端末の画面サイズに合わせた調整を CSS や JavaScript で実施しています。

---

## 更新方針

- 本リポジトリの内容は、必要に応じて随時更新されます。
- 不具合修正や新機能追加などがある場合、随時コミットやプルリクエストを行って最新の状態を維持します。
