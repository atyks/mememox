window.EntryMemo = window.EntryMemo || {};

window.EntryMemo.Storage = (function () {
  /**
   * --- DemoStorage ---
   * メモリ上のデモデータを扱う
   */
  function DemoStorage() {
    // デモ用データをディープコピー
    this.data = JSON.parse(JSON.stringify(window.EntryMemo.DemoData || {}));
  }

  DemoStorage.prototype.listCategories = async function () {
    const keys = Object.keys(this.data);
    const hasTrash = keys.some(k => k === "ゴミ箱" || k === "trash");
    if (!hasTrash) {
      keys.push("ゴミ箱");
    }
    const compareCategories = window.EntryMemo.Utils.compareCategories;
    return keys.sort(compareCategories);
  };

  DemoStorage.prototype.listEntries = async function (categoryName) {
    if (!this.data[categoryName]) return [];
    return Object.keys(this.data[categoryName]).map(fileName => {
      return { fileName: fileName, mtime: Math.floor(Date.now() / 1000) };
    }).sort((a, b) => a.fileName.localeCompare(b.fileName));
  };

  DemoStorage.prototype.readEntry = async function (categoryName, fileName) {
    if (!this.data[categoryName] || !this.data[categoryName][fileName]) {
      throw new Error(`デモデータが見つかりません: ${categoryName}/${fileName}`);
    }
    return this.data[categoryName][fileName];
  };

  DemoStorage.prototype.writeEntry = async function (categoryName, fileName, markdownText) {
    if (!this.data[categoryName]) {
      this.data[categoryName] = {};
    }
    this.data[categoryName][fileName] = markdownText;
  };

  DemoStorage.prototype.createEntry = async function (categoryName, fileName, markdownText) {
    if (!this.data[categoryName]) {
      this.data[categoryName] = {};
    }
    
    let baseName = fileName;
    if (baseName.endsWith(".md")) {
      baseName = baseName.slice(0, -3);
    }
    
    let targetFileName = `${baseName}.md`;
    let counter = 1;
    while (this.data[categoryName][targetFileName] !== undefined) {
      counter++;
      targetFileName = `${baseName}-${counter}.md`;
    }
    
    this.data[categoryName][targetFileName] = markdownText;
    return targetFileName;
  };

  DemoStorage.prototype.moveEntry = async function (oldCategoryName, oldFileName, newCategoryName, newFileName) {
    if (!this.data[oldCategoryName] || this.data[oldCategoryName][oldFileName] === undefined) {
      throw new Error(`デモデータが見つかりません: ${oldCategoryName}/${oldFileName}`);
    }
    const markdownText = this.data[oldCategoryName][oldFileName];
    
    // 新しいカテゴリーがなければ作成
    if (!this.data[newCategoryName]) {
      this.data[newCategoryName] = {};
    }
    
    // 移動先のファイル名が重複していないか解決（重複時は連番を振る）
    let baseName = newFileName;
    if (baseName.endsWith(".md")) {
      baseName = baseName.slice(0, -3);
    }
    let targetFileName = `${baseName}.md`;
    let counter = 1;
    // 自分自身と同じカテゴリーかつ同じファイル名でなければ重複チェック
    while (this.data[newCategoryName][targetFileName] !== undefined && !(oldCategoryName === newCategoryName && targetFileName === oldFileName)) {
      counter++;
      targetFileName = `${baseName}-${counter}.md`;
    }

    this.data[newCategoryName][targetFileName] = markdownText;
    
    // 古いファイルを削除（移動先と異なる場合のみ）
    if (oldCategoryName !== newCategoryName || oldFileName !== targetFileName) {
      delete this.data[oldCategoryName][oldFileName];
      // 古いカテゴリーが空になったらキーごと削除
      if (Object.keys(this.data[oldCategoryName]).length === 0) {
        delete this.data[oldCategoryName];
      }
    }
    return targetFileName;
  };

  DemoStorage.prototype.deleteEntry = async function (categoryName, fileName) {
    if (this.data[categoryName] && this.data[categoryName][fileName] !== undefined) {
      delete this.data[categoryName][fileName];
      if (Object.keys(this.data[categoryName]).length === 0) {
        delete this.data[categoryName];
      }
    }
  };

  /**
   * --- FileSystemStorage ---
   * File System Access APIを使ってローカルファイルを読み書きする
   */
  function FileSystemStorage(directoryHandle) {
    this.rootHandle = directoryHandle;
    this.categoriesHandle = null;
  }

  /**
   * 初期チェック: カテゴリー用フォルダが存在するか確認する
   * @returns {Promise<boolean>} カテゴリーが存在すればtrue、なければfalse
   */
  FileSystemStorage.prototype.init = async function () {
    this.categoriesHandle = this.rootHandle;
    try {
      let hasSubDir = false;
      for await (const entry of this.rootHandle.values()) {
        if (entry.kind === "directory" && !entry.name.startsWith(".")) {
          hasSubDir = true;
          break;
        }
      }
      return hasSubDir;
    } catch (e) {
      return false;
    }
  };

  /**
   * 初期ディレクトリ構造および初期空エントリーファイルを生成する
   */
  FileSystemStorage.prototype.createInitialStructure = async function () {
    this.categoriesHandle = this.rootHandle;
    
    // inbox, thinking, work ディレクトリの作成
    const inboxHandle = await this.rootHandle.getDirectoryHandle("inbox", { create: true });
    const thinkingHandle = await this.rootHandle.getDirectoryHandle("thinking", { create: true });
    const workHandle = await this.rootHandle.getDirectoryHandle("work", { create: true });
    
    // 初期エントリーファイルの作成
    // inbox/inbox.md
    const inboxFile = await inboxHandle.getFileHandle("inbox.md", { create: true });
    const inboxWritable = await inboxFile.createWritable();
    await inboxWritable.write(`# Inbox\n\n## 概要\n\n- ここはインボックスです。一時的なメモを置く場所です。\n\n## ブロック\n`);
    await inboxWritable.close();
    
    // thinking/entry-memo-system.md
    const thinkingFile = await thinkingHandle.getFileHandle("entry-memo-system.md", { create: true });
    const thinkingWritable = await thinkingFile.createWritable();
    await thinkingWritable.write(`# エントリー型メモシステム\n\n## 概要\n\n- エントリー型メモシステムの設計方針について記述します。\n\n## ブロック\n`);
    await thinkingWritable.close();
 
    // work/work-memo-environment.md
    const workFile = await workHandle.getFileHandle("work-memo-environment.md", { create: true });
    const workWritable = await workFile.createWritable();
    await workWritable.write(`# 仕事用メモ環境\n\n## 概要\n\n- 仕事用メモの管理方針やTipsを記述します。\n\n## ブロック\n`);
    await workWritable.close();
  };

  FileSystemStorage.prototype.listCategories = async function () {
    if (!this.categoriesHandle) {
      throw new Error("メモフォルダが初期化されていません。");
    }
    const categories = [];
    for await (const entry of this.categoriesHandle.values()) {
      if (entry.kind === "directory") {
        categories.push(entry.name);
      }
    }
    const hasTrash = categories.some(k => k === "ゴミ箱" || k === "trash");
    if (!hasTrash) {
      categories.push("ゴミ箱");
    }
    const compareCategories = window.EntryMemo.Utils.compareCategories;
    return categories.sort(compareCategories);
  };

  FileSystemStorage.prototype.listEntries = async function (categoryName) {
    if (!this.categoriesHandle) {
      throw new Error("メモフォルダが初期化されていません。");
    }
    try {
      const categoryHandle = await this.categoriesHandle.getDirectoryHandle(categoryName, { create: false });
      const entries = [];
      for await (const entry of categoryHandle.values()) {
        if (entry.kind === "file" && entry.name.endsWith(".md")) {
          let mtime = 0;
          try {
            const file = await entry.getFile();
            mtime = Math.floor(file.lastModified / 1000);
          } catch (_) {}
          entries.push({
            fileName: entry.name,
            mtime: mtime
          });
        }
      }
      return entries.sort((a, b) => a.fileName.localeCompare(b.fileName));
    } catch (e) {
      if (e.name === "NotFoundError") {
        return [];
      }
      throw e;
    }
  };

  FileSystemStorage.prototype.readEntry = async function (categoryName, fileName) {
    if (!this.categoriesHandle) {
      throw new Error("メモフォルダが初期化されていません。");
    }
    const categoryHandle = await this.categoriesHandle.getDirectoryHandle(categoryName, { create: false });
    const fileHandle = await categoryHandle.getFileHandle(fileName, { create: false });
    const file = await fileHandle.getFile();
    return await file.text();
  };

  FileSystemStorage.prototype.writeEntry = async function (categoryName, fileName, markdownText) {
    if (!this.categoriesHandle) {
      throw new Error("メモフォルダが初期化されていません。");
    }
    const categoryHandle = await this.categoriesHandle.getDirectoryHandle(categoryName, { create: false });
    const fileHandle = await categoryHandle.getFileHandle(fileName, { create: false });
    const writable = await fileHandle.createWritable();
    await writable.write(markdownText);
    await writable.close();
  };

  FileSystemStorage.prototype.createEntry = async function (categoryName, fileName, markdownText) {
    if (!this.categoriesHandle) {
      throw new Error("メモフォルダが初期化されていません。");
    }
    const categoryHandle = await this.categoriesHandle.getDirectoryHandle(categoryName, { create: true });
    
    let baseName = fileName;
    if (baseName.endsWith(".md")) {
      baseName = baseName.slice(0, -3);
    }
    
    let targetFileName = `${baseName}.md`;
    let counter = 1;
    let fileExists = true;
    
    while (fileExists) {
      try {
        await categoryHandle.getFileHandle(targetFileName, { create: false });
        counter++;
        targetFileName = `${baseName}-${counter}.md`;
      } catch (e) {
        fileExists = false;
      }
    }
    
    const fileHandle = await categoryHandle.getFileHandle(targetFileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(markdownText);
    await writable.close();
    
    return targetFileName;
  };

  FileSystemStorage.prototype.moveEntry = async function (oldCategoryName, oldFileName, newCategoryName, newFileName) {
    if (!this.categoriesHandle) {
      throw new Error("メモフォルダが初期化されていません。");
    }
    const oldCategoryHandle = await this.categoriesHandle.getDirectoryHandle(oldCategoryName, { create: false });
    const newCategoryHandle = await this.categoriesHandle.getDirectoryHandle(newCategoryName, { create: true });
    
    const fileHandle = await oldCategoryHandle.getFileHandle(oldFileName, { create: false });
    
    // 重複を解決
    let baseName = newFileName;
    if (baseName.endsWith(".md")) {
      baseName = baseName.slice(0, -3);
    }
    let targetFileName = `${baseName}.md`;
    let counter = 1;
    let fileExists = true;
    
    while (fileExists) {
      if (oldCategoryName === newCategoryName && targetFileName === oldFileName) {
        fileExists = false; // 自分自身なので重複とみなさない
        break;
      }
      try {
        await newCategoryHandle.getFileHandle(targetFileName, { create: false });
        counter++;
        targetFileName = `${baseName}-${counter}.md`;
      } catch (e) {
        fileExists = false;
      }
    }

    if (typeof fileHandle.move === "function") {
      await fileHandle.move(newCategoryHandle, targetFileName);
    } else {
      // フォールバック: コピーして削除
      const file = await fileHandle.getFile();
      const text = await file.text();
      
      const newFileHandle = await newCategoryHandle.getFileHandle(targetFileName, { create: true });
      const writable = await newFileHandle.createWritable();
      await writable.write(text);
      await writable.close();
      
      await oldCategoryHandle.removeEntry(oldFileName);
    }
    
    return targetFileName;
  };

  FileSystemStorage.prototype.deleteEntry = async function (categoryName, fileName) {
    if (!this.categoriesHandle) {
      throw new Error("メモフォルダが初期化されていません。");
    }
    const categoryHandle = await this.categoriesHandle.getDirectoryHandle(categoryName, { create: false });
    await categoryHandle.removeEntry(fileName);
  };


  /**
   * ServerStorage - サーバー上のPHP APIと通信するストレージ（インメモリキャッシュ同期モデル）
   */
  function ServerStorage(apiUrl) {
    this.apiUrl = apiUrl;
    this.cache = {};       // {"category/fileName.md": {category, fileName, content, revision, mtime}}
    this.categories = [];  // ["inbox", "work", ...]
    this.favorites = new Set(); // Set {"category/fileName.md", ...}
  }

  ServerStorage.prototype._request = async function (action, data = null) {
    const url = `${this.apiUrl}?action=${action}`;
    const options = {
      method: data ? "POST" : "GET",
      headers: { "Cache-Control": "no-cache" }
    };
    if (data) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(data);
    }
    const response = await fetch(url, options);
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || `HTTP error! status: ${response.status}`);
    }
    return result;
  };

  ServerStorage.prototype.init = async function () {
    const res = await this._request("load_all");
    this.cache = res.entries || {};
    this.categories = res.categories || [];
    this.favorites = new Set(res.favorites || []);
    return true;
  };

  ServerStorage.prototype.listCategories = async function () {
    const cats = [...this.categories];
    const hasTrash = cats.some(k => k === "ゴミ箱" || k === "trash");
    if (!hasTrash) {
      cats.push("ゴミ箱");
    }
    return cats.sort(window.EntryMemo.Utils.compareCategories);
  };

  ServerStorage.prototype.listEntries = async function (categoryName) {
    const entries = [];
    for (const key in this.cache) {
      const entry = this.cache[key];
      if (entry.category === categoryName) {
        entries.push({
          fileName: entry.fileName,
          mtime: entry.mtime || 0
        });
      }
    }
    return entries.sort((a, b) => a.fileName.localeCompare(b.fileName));
  };

  ServerStorage.prototype.readEntry = async function (categoryName, fileName) {
    const key = `${categoryName}/${fileName}`;
    const entry = this.cache[key];
    if (!entry) {
      throw new Error(`エントリーが見つかりません: ${key}`);
    }
    return entry.content;
  };

  ServerStorage.prototype.writeEntry = async function (categoryName, fileName, markdownText) {
    const key = `${categoryName}/${fileName}`;
    const entry = this.cache[key];
    const baseRevision = entry ? entry.revision : "";

    const res = await this._request("write_entry", {
      category: categoryName,
      file: fileName,
      content: markdownText,
      baseRevision: baseRevision
    });

    // 保存成功時にキャッシュを更新
    this.cache[key] = {
      category: categoryName,
      fileName: fileName,
      content: markdownText,
      revision: res.revision,
      mtime: res.mtime
    };

    if (!this.categories.includes(categoryName)) {
      this.categories.push(categoryName);
    }
    return true;
  };

  ServerStorage.prototype.createEntry = async function (categoryName, titleText, markdownText) {
    const res = await this._request("create_entry", {
      category: categoryName,
      file: titleText, // titleText を file として渡す (仕様書と整合性を確認)
      content: markdownText
    });

    const key = `${categoryName}/${res.fileName}`;
    this.cache[key] = {
      category: categoryName,
      fileName: res.fileName,
      content: markdownText,
      revision: res.revision,
      mtime: res.mtime
    };

    if (!this.categories.includes(categoryName)) {
      this.categories.push(categoryName);
    }
    return res.fileName;
  };

  ServerStorage.prototype.moveEntry = async function (oldCategory, oldFile, newCategory, newFile) {
    const res = await this._request("move_entry", {
      old_category: oldCategory,
      old_file: oldFile,
      new_category: newCategory,
      new_file: newFile
    });

    const oldKey = `${oldCategory}/${oldFile}`;
    const newKey = `${newCategory}/${newFile}`;
    
    // キャッシュ移行
    const oldEntry = this.cache[oldKey];
    if (oldEntry) {
      this.cache[newKey] = {
        category: newCategory,
        fileName: newFile,
        content: oldEntry.content,
        revision: res.revision,
        mtime: res.mtime
      };
      delete this.cache[oldKey];
    }

    // カテゴリーリスト更新
    if (!this.categories.includes(newCategory)) {
      this.categories.push(newCategory);
    }
    // 旧カテゴリーが空になったかチェック
    const hasRemaining = Object.values(this.cache).some(e => e.category === oldCategory);
    if (!hasRemaining) {
      this.categories = this.categories.filter(c => c !== oldCategory);
    }

    // お気に入りパスの引越し
    if (this.favorites.has(oldKey)) {
      this.favorites.delete(oldKey);
      this.favorites.add(newKey);
      await this.saveFavorites();
    }

    return res.fileName;
  };

  ServerStorage.prototype.deleteEntry = async function (categoryName, fileName) {
    await this._request("delete_entry", {
      category: categoryName,
      file: fileName
    });

    const key = `${categoryName}/${fileName}`;
    delete this.cache[key];

    const hasRemaining = Object.values(this.cache).some(e => e.category === categoryName);
    if (!hasRemaining) {
      this.categories = this.categories.filter(c => c !== categoryName);
    }

    if (this.favorites.has(key)) {
      this.favorites.delete(key);
      await this.saveFavorites();
    }

    return true;
  };

  ServerStorage.prototype.isFavorite = function (categoryName, fileName) {
    const key = `${categoryName}/${fileName}`;
    return this.favorites.has(key);
  };

  ServerStorage.prototype.toggleFavorite = async function (categoryName, fileName) {
    const key = `${categoryName}/${fileName}`;
    if (this.favorites.has(key)) {
      this.favorites.delete(key);
    } else {
      this.favorites.add(key);
    }
    await this.saveFavorites();
    return this.favorites.has(key);
  };

  ServerStorage.prototype.saveFavorites = async function () {
    const list = Array.from(this.favorites);
    await this._request("save_favorites", { favorites: list });
  };

  return {
    DemoStorage,
    FileSystemStorage,
    ServerStorage
  };
})();
