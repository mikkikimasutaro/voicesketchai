# Voice Sketch AI

これはReact, TypeScript, Tailwind CSS, Firebaseで作成されたWebアプリケーションです。

## 技術スタック

*   **フロントエンド:**
    *   React
    *   TypeScript
    *   Tailwind CSS
*   **バックエンド & ホスティング:**
    *   Firebase

## プロジェクトのセットアップ

1.  **リポジトリをクローンし、ディレクトリに移動します。**

2.  **依存関係をインストールします:**
    ```sh
    npm install
    ```

3.  **Firebaseの設定:**
    このプロジェクトではFirebaseを利用します。`src/firebase.tsx`にあなたのFirebaseプロジェクトの設定がされていることを確認してください。

## 利用可能なスクリプト

プロジェクトディレクトリで、以下のコマンドを実行できます:

### `npm start`

開発モードでアプリを起動します。
ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

ファイル編集を行うと、ページは自動的にリロードされます。

### `npm test`

インタラクティブなウォッチモードでテストランナーを起動します。

### `npm run build`

`build`フォルダに本番用のアプリをビルドします。
プロダクションモードでReactを適切にバンドルし、最高のパフォーマンスのためにビルドを最適化します。

### デプロイ

`npm run build`コマンドを実行してアプリケーションをビルドした後、以下のコマンドでFirebaseにデプロイできます。

```sh
firebase deploy
```

## フォルダ構成

*   `/build/`: プロジェクトのビルド時に生成されるファイルが格納されます。このディレクトリの内容がFirebase Hostingにデプロイされます。
*   `/functions/`: Firebase Functionsのソースコードが格納されます。
    *   `/functions/src/index.ts`: Firebase Functionsのメインファイルです。
*   `/public/`: `index.html`や画像など、公開される静的ファイルが格納されます。
*   `/src/`: Firebase HostingでホストするReactアプリケーションのメインソースコードが格納されます。
    *   `/src/components/`: 再利用可能なReactコンポーネントが格納されます。
    *   `/src/App.tsx`: アプリケーションのメインコンポーネントです。
    *   `/src/index.tsx`: アプリケーションのエントリーポイントです。
    *   `/src/firebase.tsx`: Firebaseの初期設定ファイルです。