# training-manager

筋トレ記録アプリ(筋トレ帳)。Vite + React の静的サイトで、GitHub Pages にデプロイして
スマホから使う想定。

## データの保存先

データの実体は **GitHub Gist**(JSONファイル1つ)。アプリの「記録」タブから
gistスコープのみのPersonal Access Tokenを登録すると、以後は起動時にGistを読み込み、
更新するたびにGistへ書き戻す。複数端末(スマホ・PC)から同じデータを見られる。

`localStorage` はGistに接続できないとき(オフライン、未設定時)のためのフォールバック
キャッシュにすぎない。localStorageが消えてもGist側にデータは残る。

## 構成

```
src/
  lib/
    date.js        日付ユーティリティ
    schedule.js     トレーニング周期・予定キューの計算(スケジュール管理)
    equipment.js     マシン器具の重量管理
    bodyWeight.js    体重ログとペース判定
    gist.js          GitHub Gist の読み書き(データの実体)
    storage.js       Gist⇄localStorageキャッシュの読み書きオーケストレーション
    sound.js         休憩タイマーの通知音
  components/
    WeightChart.jsx
    SyncSettings.jsx Gist接続設定UI
  App.jsx
  main.jsx
public/
  manifest.webmanifest
  sw.js              ネットワーク優先のservice worker
  icon.svg
  data/
    seed-data.json   まだGistを持っていない人が「新しく作る」を押したときの
                     初期データ(今までの実績)。Gist作成後は一切参照されない。
```

## 開発

```
npm install
npm run dev
```

Node 18 以上が必要(Vite 8)。

## デプロイ

`main` に push すると `.github/workflows/deploy.yml` がビルドして GitHub Pages に公開する。
初回のみ、リポジトリの Settings → Pages → Source を **GitHub Actions** に設定しておくこと。

公開URL: `https://<GitHubユーザー名>.github.io/training-manager/`

## 初回セットアップ(Gist接続)

1. デプロイ後、サイトを開く(このときはまだ`public/data/seed-data.json`が初期値として表示される)
2. [github.com/settings/tokens/new](https://github.com/settings/tokens/new?scopes=gist) で
   **gistスコープのみ**チェックしたPersonal Access Tokenを発行
3. 「記録」タブの「データの同期」でトークンを貼り、「新しく作る」を押す
   → 今表示されているデータを元にGistが作成され、以後はそのGistが本体になる
4. 別の端末で使うときは、同じトークンと発行されたGist IDを「既存のGistに接続」で入力する
