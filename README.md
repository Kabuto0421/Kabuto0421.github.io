# kabutoPage

このリポジトリは、かぶと（Kabuto）が管理している Webページ用のプロジェクトです。  
主に Unity WebGL ビルドのコンテンツを含み、HTML/CSS/JavaScript によるページ構成と組み合わせて公開しています。

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
├── CSS/
│   └── style.css
├── JS/
│   └── index.js
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
  Unity WebGL 用にビルドされたファイル群です。  
  - `kabutoPage3.data.unityweb` / `kabutoPage3.framework.js.unityweb` / `kabutoPage3.wasm.unityweb` / `kabutoPage3.loader.js` など
- **CSS/**  
  サイトのデザインを管理するスタイルシート (`style.css`) が含まれます。
- **JS/**  
  JavaScript のスクリプトを配置しています (`index.js` など)。
- **Movie/**  
  背景動画などのメディアファイル。  
- **pictures/**  
  アイコンやボタン、タイトル画像などのリソースファイルを格納しています。
- **gallery.html / index.html / introduction.html / skills.html**  
  Web ページ本体の HTML ファイルです。Unity WebGL のコンテンツを埋め込み、背景動画や画像等を組み合わせてサイトとして公開しています。

---

## 特徴

- **Unity WebGL の埋め込み**  
  Unity で作成したコンテンツを Web ページ内に組み込む形で公開し、3D/2D の動的コンテンツをブラウザから閲覧できます。
- **HTML/CSS/JavaScript**  
  ページ構成やスタイリング、動的なページ操作は一般的な Web 技術で管理しています。  
- **レスポンシブ対応**  
  PC やモバイル端末の画面サイズに合わせた調整を CSS や JavaScript で実施しています。

---

## 更新方針

- 本リポジトリの内容は、必要に応じて随時更新されます。
- 不具合修正や新機能追加などがある場合、随時コミットやプルリクエストを行って最新の状態を維持します。
