# サーバーサイドAPI設計仕様およびガイドライン（セキュリティ強化版）

> [!IMPORTANT]
> 本ドキュメントは、フロントエンドアプリケーション `mememox` と連携するサーバーサイドAPIの実装ガイドラインです。
> セキュリティ保護の観点から、このAPI実装ファイル（例: `api.php` など）はレポジトリの配布対象外とします。
> 利用者は自身のホスティング環境（PHP, Node.js, Python, Go, Rust等）に合わせ、本ドキュメントを生成系AI（Claude, ChatGPT, Gemini等）に入力し、安全なAPIプログラムをオンデマンドで生成して設置してください。

---

## 1. 解決アプローチ（公開領域外へのデータ隔離）

セキュリティ向上のため、Markdownデータ領域（`categories/`）はWeb公開ディレクトリ（`www/` や `public_html/` 等）の**外側**に完全に隔離し、URL経由での直接参照を物理的に不可能な構造とします。

フロントエンドは、`src/storage.js` で提供されているストレージインターフェースと同じメソッドを持つ、サーバー接続用アダプタ `ServerStorage` を介してこのAPIと通信します。

```text
ブラウザ (Client)                              Webサーバー (Host)
┌─────────────────────────────────┐           ┌────────────────────────────────┐
│   ui.js   ──>  app.js           │           │   [Web公開領域]                 │
│                 │               │           │   mememox/                     │
│           [storageの切替]       │           │     ├─ index.html              │
│                 ├─ ローカル ──> FileSystemStorage  ├─ APIスクリプト           │
│                 └─ サーバ ───> ServerStorage ──┼─> 設定ファイル(DATA_DIR定義) │
│                                 (fetchリクエスト)│                              │
└─────────────────────────────────┘           ├────────────────────────────────┤
                                              │   [Web非公開領域 (隔離エリア)]  │
                                              │   mememox-private/             │
                                              │     └─ categories/ ──> Markdown保存│
                                              └────────────────────────────────┘
```

---

## 2. サーバーサイドAPIのセキュリティ要件

どのようなプログラミング言語・フレームワークでバックエンドAPIを実装する場合でも、以下のセキュリティ要件を必ず満たさなければなりません。

1. **アクセス制限と HTTPS の必須化**
   * 通信経路の保護（盗聴・中間者攻撃防止）のため、必ず **HTTPS** を強制する環境下でホストしてください。
   * ディレクトリ全体への Basic 認証等により保護された、同一ホスト・同一プロトコル上でのみ通信を受け付けます（同一オリジン前提）。
2. **ディレクトリトラバーサル防止 (最重要)**
   * リクエストパラメータ（`category`, `file` など）に親ディレクトリを示す記号（`..`, `/`, `\` 等）、およびヌルバイト文字（`\0`）が含まれている場合、API は処理を拒否し、直ちに `HTTP 400 Bad Request` を返さなければなりません。
   * ファイル名およびカテゴリー名は、最大文字数制限を設け、安全な文字種（英数字、ハイフン、アンダースコア、マルチバイト文字）のみを含んでいるかを正規表現で厳格にバリデーション（ホワイトリスト検証）してください。
3. **拡張子の厳格チェック**
   * 読み書きするファイルは、必ず拡張子が **`.md`** であることを必須条件とし、PHP や Python 等の実行可能スクリプトの不正作成・上書きを防止してください。
4. **アトミック書き込み (上書き破損防止)**
   * ファイルの書き込み時は直接上書きをせず、対象カテゴリーフォルダ内に予測不可能な一時ファイル（`tmp_*` 等）を一度作成して内容をすべて書き込み、成功確認後に `rename()` 等のシステムコールを用いてアトミックに元ファイルを置換（上書き）してください。
5. **キャッシュ抑止ヘッダーの付与**
   * 個人データをブラウザやリバースプロキシにキャッシュさせないため、レスポンスには常時以下のヘッダーを出力してください。
     ```http
     Cache-Control: no-store, private, max-age=0
     Pragma: no-cache
     X-Content-Type-Options: nosniff
     X-Frame-Options: DENY
     ```

---

## 3. APIエンドポイントおよびアクション仕様

API は一律で JSON フォーマットでレスポンスを返します。エラー時は `HTTP 400/405/409/500` などの適切なステータスコードと共に `{ "ok": false, "error": "エラーメッセージ" }` を返却し、サーバー上の物理パスなどの内部デバッグ情報は一切漏洩させないでください。

リクエストの分岐は、クエリパラメータ `action` (例: `?action=list_categories`) または適切なルーティングによって判別します。

### ① `list_categories` (GET)
* **レスポンス (200 OK)**: `["inbox", "thinking", "work"]`
* **概要**: データ格納ディレクトリ（`DATA_DIR`）直下の実在するサブディレクトリ（カテゴリー）名一覧を配列で返します。

### ② `list_entries` (GET)
* **パラメータ**: `category` (必須)
* **レスポンス (200 OK)**: `[{"fileName": "inbox.md"}, {"fileName": "entry.md"}]`
* **概要**: 指定されたカテゴリーフォルダ配下に実在する `.md` ファイル一覧を配列で返します。

### ③ `read_entry` (GET)
* **パラメータ**: `category` (必須), `file` (必須)
* **レスポンス (200 OK)**:
  ```json
  {
    "ok": true,
    "data": {
      "content": "# エントリータイトル\n\n## 概要\n...",
      "revision": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }
  }
  ```
  ※ `revision` には、対象ファイルの最新コンテンツに対する SHA-256 ハッシュ値を返却します。

### ④ `write_entry` (POST)
* **リクエストボディ (JSON)**:
  ```json
  {
    "category": "thinking",
    "file": "example.md",
    "content": "# 本文\n...",
    "baseRevision": "sha256:e3b0c44298fc1c14..."
  }
  ```
* **仕様**:
  * サーバー側で、対象ファイルの現在のコンテンツのハッシュ値を算出します。
  * 現在のハッシュ値が `baseRevision` と一致しない場合は、他端末による同時編集・上書き競合と判断し、書き込みを行わずに **`HTTP 409 Conflict`** を返します（楽観的ロックによる上書き衝突防止）。
  * 一致する場合、または新規書き込み等の場合は、一時ファイル経由でアトミックに書き込みを完了させます。
* **レスポンス (200 OK)**: `{"ok": true}`

### ⑤ `create_entry` (POST)
* **リクエストボディ (JSON)**:
  ```json
  {
    "category": "inbox",
    "file": "new-file.md",
    "content": "# 新規作成\n..."
  }
  ```
* **仕様**:
  * 同一名のファイルが同一カテゴリー内にすでに存在する場合は、自動的に末尾に連番（例: `new-file-2.md`）を付与して重複を回避し、一時ファイル経由で保存します。
* **レスポンス (200 OK)**: `{"ok": true, "fileName": "new-file-2.md"}`

### ⑥ `move_entry` (POST)
* **リクエストボディ (JSON)**:
  ```json
  {
    "old_category": "inbox",
    "old_file": "old-file.md",
    "new_category": "thinking",
    "new_file": "new-file.md"
  }
  ```
* **仕様**:
  * 指定されたファイルを別のカテゴリーフォルダへ移動（リロケート）、またはリネームします。
  * 移動先でファイル名の重複が発生した場合は、自動的に末尾に連番（例: `new-file-2.md`）を付与して重複を解決し、最終的に保存されたファイル名を返します。
* **レスポンス (200 OK)**: `{"ok": true, "fileName": "new-file-2.md"}`

### ⑦ `delete_entry` (POST)
* **リクエストボディ (JSON)**:
  ```json
  {
    "category": "inbox",
    "file": "file.md"
  }
  ```
* **仕様**:
  * 指定されたエントリーファイルをサーバー上から物理削除します。
  * 削除によりカテゴリーフォルダ内が空になった場合（「ゴミ箱」カテゴリーを除く）は、そのカテゴリーフォルダも自動で削除します。
* **レスポンス (200 OK)**: `{"ok": true}`

---

## 4. クライアントサイド `ServerStorage` インターフェース

フロントエンドの `src/storage.js` は、上記APIと通信するために以下の共通インターフェース（Duck Typing）に準拠した実装を使用します。

```javascript
function ServerStorage(apiUrl) {
  this.apiUrl = apiUrl;
  this.revisions = {}; // { "category/file.md": "sha256:..." }
}

ServerStorage.prototype._request = async function (action, params = {}, options = {}) {
  let url = `${this.apiUrl}?action=${action}`;
  let fetchOptions = {};

  if (options.method === "POST") {
    fetchOptions.method = "POST";
    fetchOptions.headers = {
      "Content-Type": "application/json"
    };
    fetchOptions.body = JSON.stringify(params);
  } else {
    const query = new URLSearchParams(params).toString();
    if (query) url += `&${query}`;
  }

  const res = await fetch(url, fetchOptions);
  if (!res.ok) {
    let errMsg = "サーバーとの通信エラーが発生しました。";
    try {
      const errJson = await res.json();
      if (errJson && errJson.error) errMsg = errJson.error;
    } catch (_) {}
    throw new Error(errMsg);
  }

  return await res.json();
};

ServerStorage.prototype._calculateHash = async function (message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return 'sha256:' + hashHex;
};

ServerStorage.prototype.init = async function () {
  return true;
};

ServerStorage.prototype.listCategories = async function () {
  const categories = await this._request("list_categories");
  const hasTrash = categories.some(k => k === "ゴミ箱" || k === "trash");
  if (!hasTrash) {
    categories.push("ゴミ箱");
  }
  const compareCategories = window.EntryMemo.Utils.compareCategories;
  return categories.sort(compareCategories);
};

ServerStorage.prototype.listEntries = async function (categoryName) {
  const entries = await this._request("list_entries", { category: categoryName });
  return entries.sort((a, b) => a.fileName.localeCompare(b.fileName));
};

ServerStorage.prototype.readEntry = async function (categoryName, fileName) {
  const res = await this._request("read_entry", { category: categoryName, file: fileName });
  if (!res.ok || !res.data) {
    throw new Error(res.error || "エントリーの読み込みに失敗しました。");
  }
  
  const key = `${categoryName}/${fileName}`;
  this.revisions[key] = res.data.revision;
  
  return res.data.content;
};

ServerStorage.prototype.writeEntry = async function (categoryName, fileName, markdownText) {
  const key = `${categoryName}/${fileName}`;
  const baseRevision = this.revisions[key] || "";

  const res = await this._request("write_entry", {
    category: categoryName,
    file: fileName,
    content: markdownText,
    baseRevision: baseRevision
  }, { method: "POST" });

  if (!res.ok) {
    throw new Error(res.error || "エントリーの保存に失敗しました。");
  }

  this.revisions[key] = await this._calculateHash(markdownText);
};

ServerStorage.prototype.createEntry = async function (categoryName, fileName, markdownText) {
  const res = await this._request("create_entry", {
    category: categoryName,
    file: fileName,
    content: markdownText
  }, { method: "POST" });

  if (!res.ok || !res.fileName) {
    throw new Error(res.error || "新規エントリーの作成に失敗しました。");
  }

  const actualFileName = res.fileName;
  const key = `${categoryName}/${actualFileName}`;
  this.revisions[key] = await this._calculateHash(markdownText);
  
  return actualFileName;
};

ServerStorage.prototype.moveEntry = async function (oldCategoryName, oldFileName, newCategoryName, newFileName) {
  const res = await this._request("move_entry", {
    old_category: oldCategoryName,
    old_file: oldFileName,
    new_category: newCategoryName,
    new_file: newFileName
  }, { method: "POST" });

  if (!res.ok || !res.fileName) {
    throw new Error(res.error || "エントリーの移動に失敗しました。");
  }

  const actualFileName = res.fileName;
  
  const oldKey = `${oldCategoryName}/${oldFileName}`;
  const newKey = `${newCategoryName}/${actualFileName}`;
  if (this.revisions[oldKey]) {
    this.revisions[newKey] = this.revisions[oldKey];
    delete this.revisions[oldKey];
  }
  
  return actualFileName;
};

ServerStorage.prototype.deleteEntry = async function (categoryName, fileName) {
  const res = await this._request("delete_entry", {
    category: categoryName,
    file: fileName
  }, { method: "POST" });

  if (!res.ok) {
    throw new Error(res.error || "エントリーの削除に失敗しました。");
  }

  const key = `${categoryName}/${fileName}`;
  delete this.revisions[key];
};
```

---

## 5. サーバー配置と認証設定（例：Apache/Nginx）

データをWeb公開領域外に完全に隔離し、外部から直接 Markdown ファイルをダウンロードできない環境を構築します。

### 5-1. ディレクトリ構造のベストプラクティス
サーバーの絶対パスで、Web公開ディレクトリ（`www/` や `public_html/`）と並列または上位の階層にデータ領域を配置します。

```text
/home/user/
├─ www/                          (Web公開ディレクトリ)
│  └─ mememox/                   (アプリ公開領域)
│     ├─ index.html
│     ├─ api-server             (生成したAPIスクリプト。例: api.php や nodeサーバー等)
│     ├─ config.json            (APIのデータディレクトリ設定ファイル)
│     ├─ style.css
│     ├─ app.js
│     └─ src/
│
└─ mememox-private/              (Web非公開領域：絶対アクセス不可)
   └─ categories/                (Markdownデータ格納フォルダ)
      ├─ inbox/
      ├─ thinking/
      └─ work/
```

### 5-2. 接続先設定ファイル (config.json)
API の向き先を柔軟に変更できるように、必要に応じて以下の `config.json` を Web 公開領域に設置できます。

```json
{
  "apiUrl": "api.php"
}
```

* **フォールバック仕様**:
  `config.json` が配置されていない、またはネットワークエラー等で読み込みに失敗した場合は、デフォルトのエンドポイントとして自動的に `"api.php"` が採用されます。設定ファイルがない場合でも、従来通りの動作が維持されます。

### 5-3. Basic認証の設定 (Apache 例)
アプリディレクトリ（例: `www/mememox/`）全体に Basic 認証をかけ、第三者によるアクセスを防御します。

1. **`.htpasswd` ファイルの生成と配置**
   パスワードファイルを非公開領域（例: `/home/user/mememox-private/`）に配置します。
   ```text
   user1:$apr1$9t2.v/..$hBwRjEgh2.8y93bX6GzXk/
   ```
2. **`.htaccess` ファイルの配置**
   `www/mememox/.htaccess` に以下を配置し、HTTPSを強制した上で認証を有効化します。
   ```apache
   # Force HTTPS
   RewriteEngine On
   RewriteCond %{HTTPS} off
   RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]

   # Basic Authentication
   AuthType Basic
   AuthName "mememox Protected Area"
   AuthUserFile /home/user/mememox-private/.htpasswd
   Require valid-user
   ```

---

## 6. 【AIコード生成用】プロンプトテンプレート

生成系AIにコピー＆ペーストして、安全なAPIコードを出力させるためのプロンプト指示文のひな型です。実装言語（PHP、Node.js、Python 等）に合わせて書き換えてご利用ください。

```markdown
以下の要件を満たす、安全で堅牢な Web サーバーサイド API プログラムを作成してください。

# 構成要件
- 実装言語: [ここに希望の言語/フレームワークを記述。例: PHP 8.1 (シングルファイル構成) / Node.js Express / Python FastAPI]
- データの保存先: 設定変数 `DATA_DIR` で指定されたローカルディレクトリ（絶対パス。例: /home/user/mememox-private/categories）
  - ※このディレクトリ配下に「カテゴリー名」のフォルダが作成され、その中に `*.md` ファイルが保存されます。

# セキュリティ要件
1. ディレクトリトラバーサル脆弱性を徹底的に防御してください。
   - `category` または `file` の入力値（あるいはそれに類する引数）に、親ディレクトリを指す記号（`..`, `/`, `\`）、ヌルバイト（`\0`）が含まれる場合は、直ちに HTTP 400 Bad Request を返し、処理を中断すること。
   - `category` および `file` は、半角英数字、ハイフン、アンダースコア、および日本語を含む一般的なマルチバイト文字のみを許可し、正規表現で厳格にホワイトリスト検証すること。最大文字数（例: 255文字）を超えていないかチェックすること。
2. ファイル操作の拡張子制限:
   - 操作可能なファイルは、拡張子が必ず `.md` であること。それ以外の拡張子の指定は HTTP 400 で拒否すること。
3. アトミックな書き込み:
   - ファイルの保存・更新時には直接上書きせず、同じディレクトリ内に一時ファイル（例: `tmp_random`）を作成して書き込み、成功後に `rename`（置換）するアプローチをとること。
4. キャッシュ制御:
   - 全てのレスポンスに、以下のHTTPヘッダーを付与すること。
     - Cache-Control: no-store, private, max-age=0
     - Pragma: no-cache
     - X-Content-Type-Options: nosniff
     - X-Frame-Options: DENY
5. エラー秘匿:
   - 例外発生時を含め、HTTPステータスコードを適切に設定し、レスポンス JSON の `{ "ok": false, "error": "メッセージ" }` のエラーメッセージ内にはサーバー上の絶対パスやDBエラー、システムのデバッグ情報を含めない（隠蔽する）こと。

# API アクション仕様
クエリパラメータ `action` またはルーティングに従い、以下のエンドポイントを実装してください。すべて JSON を返却します。

1. GET `list_categories`
   - `DATA_DIR` 直下のサブディレクトリ名一覧を JSON 配列で返却する。
2. GET `list_entries` (要 `category` パラメータ)
   - 指定されたカテゴリーディレクトリ配下の `.md` ファイル一覧を JSON 配列 `[{"fileName": "..."}]` で返却する。
3. GET `read_entry` (要 `category`, `file` パラメータ)
   - 指定された Markdown ファイルを読み込み、以下の形式で返却する。
     `{ "ok": true, "data": { "content": "ファイル本文", "revision": "コンテンツのSHA-256ハッシュ文字列" } }`
4. POST `write_entry` (要 `category`, `file`, `content`, `baseRevision` をリクエストボディに含む)
   - 楽観的ロックチェック: サーバーにある現在のファイルのコンテンツから算出した SHA-256 ハッシュ値が、クライアントから送られた `baseRevision` と一致するか検証する。一致しない場合は HTTP 409 Conflict を返却して書き込みを拒否する。
   - ハッシュが一致するか、ファイルが存在しない場合は、アトミックに書き込みを完了させ `{ "ok": true }` を返却する。
5. POST `create_entry` (要 `category`, `file`, `content`)
   - 新規作成する。すでに同名ファイルが存在する場合は、ファイル名の末尾に `-2.md`, `-3.md` のように連番を自動で付与して重複を回避し保存する。
   - レスポンス: `{ "ok": true, "fileName": "最終的に決定したファイル名" }`
6. POST `move_entry` (要 `old_category`, `old_file`, `new_category`, `new_file`)
   - ファイルを移動またはリネームする。移動先で名前が重複した場合は連番（例: `-2.md`）で自動重複解決する。
   - レスポンス: `{ "ok": true, "fileName": "移動・解決後のファイル名" }`
7. POST `delete_entry` (要 `category`, `file`)
   - 指定ファイルを物理削除する。削除した結果、カテゴリーフォルダ内が空になった場合は、カテゴリーフォルダも自動で削除する（ただし "ゴミ箱" または "trash" という名前のカテゴリーフォルダは削除しないこと）。
   - レスポンス: `{ "ok": true }`
```

---

## 7. 動作確認用のチェックリスト

APIコードの設置後、セキュリティ要件が満たされているか動作確認を行うためのテストリストです。

* [ ] **データディレクトリへの直接アクセスの不可能性 (最重要)**
  * URLを直接叩いても実データが取得できないこと（`404 Not Found` になること）。
  * `curl -I https://example.com/mememox/categories/inbox/inbox.md` -> レスポンスコードが **`404`** になること。
* [ ] **APIのエラーパス秘匿チェック**
  * 不正なパラメータ（例: `action=read_entry&category=no_exist&file=no_exist.md`）を送り、`404` / `400` エラーを返させた際、レスポンスの JSON のエラー文面内にサーバーの物理絶対パス（`/home/user/...`）が一切露出していないこと。
* [ ] **拡張子・パスのバリデーション**
  * 拡張子が `.php` 等のリクエスト（例: `action=read_entry&category=inbox&file=test.php`）を送信した際、`400 Bad Request` で弾かれること。
  * ディレクトリトラバーサル（例: `file=../config.json`）を指定した際、`400 Bad Request` で弾かれること。
* [ ] **競合防止 (Conflict) の動作検証**
  * `baseRevision` を送信せず、または古い値のままで `write_entry` を送信した際、`409 Conflict` が返り、上書きが防止されること。
* [ ] **アトミック書き込みの整合性**
  * 保存処理中にエラーが発生しても破損した空のファイルが生成されず、保存が成功した時のみ変更が正しく上書き更新されていること。
