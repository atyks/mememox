window.EntryMemo = window.EntryMemo || {};

window.EntryMemo.App = (function () {
  const Utils = window.EntryMemo.Utils;
  const Markdown = window.EntryMemo.Markdown;
  const Storage = window.EntryMemo.Storage;
  const UI = window.EntryMemo.UI;

  let currentStorage = null;
  let activeCategory = "";
  let activeEntryFileName = "";
  let activeEntryObj = null; // { categoryName, fileName, title, summary, blocks, hasError, errors }
  let favorites = new Set();
  let lastActiveListViewCategory = localStorage.getItem("EntryMemo.lastActiveListViewCategory") || "すべてのエントリー";
  let lastActiveEntryCategory = localStorage.getItem("EntryMemo.lastActiveEntryCategory") || "";
  let lastActiveEntryFileName = localStorage.getItem("EntryMemo.lastActiveEntryFileName") || "";

  function loadFavorites() {
    try {
      const favs = localStorage.getItem("EntryMemo.favorites");
      if (favs) {
        favorites = new Set(JSON.parse(favs));
      } else {
        favorites = new Set([
          "inbox/inbox.md",
          "thinking/entry-memo-system.md",
          "work/work-memo-environment.md"
        ]);
        saveFavorites();
      }
    } catch (e) {
      console.error(e);
      favorites = new Set();
    }
  }

  function saveFavorites() {
    try {
      localStorage.setItem("EntryMemo.favorites", JSON.stringify([...favorites]));
    } catch (e) {
      console.error(e);
    }
  }

  // 共通お気に入りメソッド注入ヘルパー
  function injectFavoritesMethods(storage) {
    if (!storage.favorites) {
      storage.favorites = new Set();
    }
    if (typeof storage.isFavorite !== "function") {
      storage.isFavorite = function (categoryName, fileName) {
        return this.favorites.has(`${categoryName}/${fileName}`);
      };
    }
    if (typeof storage.toggleFavorite !== "function") {
      storage.toggleFavorite = async function (categoryName, fileName) {
        const key = `${categoryName}/${fileName}`;
        if (this.favorites.has(key)) {
          this.favorites.delete(key);
        } else {
          this.favorites.add(key);
        }
        return this.favorites.has(key);
      };
    }
  }

  /**
   * アプリ起動時の初期化
   */
  async function init() {
    UI.init();
    
    const isServerMode = window.location.protocol.startsWith("http");
 
    if (isServerMode) {
      // サーバーモードの初期化
      let apiUrl = "../util/api.php";
      try {
        const configRes = await fetch("config.json");
        if (configRes.ok) {
          const configData = await configRes.json();
          if (configData && configData.apiUrl) {
            apiUrl = configData.apiUrl;
          }
        } else {
          console.log("Optional config.json not found (HTTP " + configRes.status + "). Using default api.php endpoint.");
        }
      } catch (configErr) {
        // config.json が無い、または取得・解析エラーの場合はデフォルト (api.php) をそのまま使用
        console.log("Optional config.json not found or parsing failed. Using default api.php endpoint.");
      }
 
      try {
        currentStorage = new Storage.ServerStorage(apiUrl);
        await currentStorage.init();
        injectFavoritesMethods(currentStorage);
        favorites = currentStorage.favorites;
        
        UI.updateModeIndicator(false, "サーバーモード", "server");
        
        // サーバーモード時でもFile System Access API非対応であればローカルフォルダボタンを無効化
        if (typeof window.showDirectoryPicker !== "function") {
          const openBtn = document.getElementById("open-folder-btn");
          if (openBtn) {
            openBtn.disabled = true;
            openBtn.title = "お使いのブラウザはローカルフォルダの選択に対応していません";
          }
        }
      } catch (e) {
        UI.showToast(`接続エラー: ${e.message}`, "error");
        currentStorage = new Storage.DemoStorage();
        injectFavoritesMethods(currentStorage);
        loadFavorites();
        currentStorage.favorites = favorites;
        UI.updateModeIndicator(true);
      }
    } else {
      // 最初はデモモードで起動する
      currentStorage = new Storage.DemoStorage();
      injectFavoritesMethods(currentStorage);
      loadFavorites();
      currentStorage.favorites = favorites;
      UI.updateModeIndicator(true);
 
      // File System Access APIの非対応ブラウザチェック
      if (typeof window.showDirectoryPicker !== "function") {
        UI.showToast("お使いのブラウザはローカルフォルダの読み書きに対応していません。デモモードのみご利用いただけます。", "warning");
        const openBtn = document.getElementById("open-folder-btn");
        if (openBtn) {
          openBtn.disabled = true;
          openBtn.title = "非対応ブラウザです (Microsoft Edge や Google Chrome等でご利用ください)";
        }
      }
    }
 
    // デフォルトエントリーまたは最後のエントリーをロード
    await loadInitialEntry();

    // ブラウザの戻る・進む制御用のダミー履歴をプッシュ
    history.pushState({ page: "app" }, "");
  }
 
  /**
   * 読み込み可能な初期エントリーを自動選択してロードする
   */
  async function loadInitialEntry() {
    try {
      const lastCategory = localStorage.getItem("EntryMemo.lastActiveCategory");
      const lastEntryFile = localStorage.getItem("EntryMemo.lastActiveEntryFileName");

      if (lastCategory) {
        if (lastCategory === "すべてのエントリー") {
          await showAllEntriesListView();
          return;
        }

        // ストレージ内にそのカテゴリーがあるか確認
        const categories = await currentStorage.listCategories();
        if (categories.includes(lastCategory)) {
          if (lastEntryFile) {
            const entries = await currentStorage.listEntries(lastCategory);
            const hasEntry = entries.some(e => e.fileName === lastEntryFile);
            if (hasEntry) {
              await handleSelectEntry(lastCategory, lastEntryFile);
              return;
            }
          } else {
            await handleSelectCategory(lastCategory);
            return;
          }
        }
      }

      // フォールバック: inbox/inbox.md があればそれを開く、無ければすべてのエントリー一覧
      const categories = await currentStorage.listCategories();
      const hasInboxCategory = categories.includes("inbox");
      let hasInboxFile = false;
      if (hasInboxCategory) {
        const entries = await currentStorage.listEntries("inbox");
        hasInboxFile = entries.some(e => e.fileName === "inbox.md");
      }

      if (hasInboxFile) {
        await handleSelectEntry("inbox", "inbox.md");
      } else {
        await showAllEntriesListView();
      }
    } catch (e) {
      console.error("Failed to load initial entry", e);
      await showAllEntriesListView();
    }
  }
 
  /**
   * すべてのエントリー一覧を右ペインに表示する
   */
  async function showAllEntriesListView() {
    activeCategory = "すべてのエントリー";
    activeEntryFileName = "";
    activeEntryObj = null;
    lastActiveListViewCategory = "すべてのエントリー";
    document.title = "すべてのエントリー - mememox";

    localStorage.setItem("EntryMemo.lastActiveCategory", "すべてのエントリー");
    localStorage.setItem("EntryMemo.lastActiveListViewCategory", "すべてのエントリー");
    localStorage.removeItem("EntryMemo.lastActiveEntryFileName");

    UI.showLoading("エントリー一覧を読み込み中...");
    try {
      const allEntries = [];
      if (!currentStorage) return;
      const categories = await currentStorage.listCategories();
      for (const category of categories) {
        const entries = await currentStorage.listEntries(category);
        for (const entry of entries) {
          allEntries.push({
            category: category,
            fileName: entry.fileName,
            mtime: entry.mtime || 0
          });
        }
      }
      
      // 並列でエントリーデータを読み込みパースして高速化
      const entryDetails = await Promise.all(allEntries.map(async (ent) => {
        try {
          const md = await currentStorage.readEntry(ent.category, ent.fileName);
          const parsed = Markdown.parseEntry(md);
          const summaryExcerpt = Utils.excerpt(parsed.summary || "", 80) || "(概要は設定されていません)";

          return {
            categoryName: ent.category, // 実際のカテゴリー名を渡す
            fileName: ent.fileName,
            title: parsed.title || ent.fileName,
            excerpt: summaryExcerpt,
            hasError: parsed.errors.length > 0,
            isFavorite: favorites.has(`${ent.category}/${ent.fileName}`),
            mtime: ent.mtime
          };
        } catch (e) {
          return {
            categoryName: ent.category,
            fileName: ent.fileName,
            title: ent.fileName,
            excerpt: "ファイルの読み込みに失敗しました。",
            hasError: true,
            isFavorite: favorites.has(`${ent.category}/${ent.fileName}`),
            mtime: ent.mtime
          };
        }
      }));

      // ソート: お気に入り優先、その中で更新日時（mtime）が新しい順
      entryDetails.sort((a, b) => {
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        return (b.mtime || 0) - (a.mtime || 0);
      });

      UI.renderCategoryEntries("すべてのエントリー", entryDetails);
    } catch (e) {
      console.error(e);
      UI.showToast(`すべてのエントリー一覧の取得に失敗しました: ${e.message}`, "error");
    } finally {
      UI.hideLoading();
    }
  }

  /**
   * 現在のエントリーが読み取り専用（編集不可）かどうかを判定する
   */
  function isReadOnly() {
    return !activeEntryObj || activeEntryObj.hasError;
  }

  /**
   * 現在のアクティブエントリーのオブジェクトを返す
   */
  function getCurrentEntry() {
    return activeEntryObj;
  }

  /**
   * 全エントリーから存在する全ブロックIDを収集する（ID重複を完全に防止するため）
   */
  async function getAllExistingIds() {
    const ids = new Set();
    
    if (currentStorage.cache && Object.keys(currentStorage.cache).length > 0) {
      // キャッシュが存在する場合（ServerStorage等）は一瞬でスキャン
      for (const key in currentStorage.cache) {
        try {
          const parsed = Markdown.parseEntry(currentStorage.cache[key].content);
          parsed.blocks.forEach(r => { if (r.id) ids.add(r.id); });
        } catch(e) {}
      }
    } else {
      // 従来の都度読み込み（FileSystemStorage等）
      const categories = await currentStorage.listCategories();
      for (const category of categories) {
        const entries = await currentStorage.listEntries(category);
        for (const ent of entries) {
          try {
            const md = await currentStorage.readEntry(category, ent.fileName);
            const parsed = Markdown.parseEntry(md);
            parsed.blocks.forEach(r => { if (r.id) ids.add(r.id); });
          } catch(e) {}
        }
      }
    }
    return ids;
  }

  /**
   * エントリーの選択
   */
  async function handleSelectEntry(categoryName, fileName) {
    activeCategory = categoryName;
    activeEntryFileName = fileName;
    lastActiveEntryCategory = categoryName;
    lastActiveEntryFileName = fileName;

    localStorage.setItem("EntryMemo.lastActiveCategory", categoryName);
    localStorage.setItem("EntryMemo.lastActiveEntryCategory", categoryName);
    localStorage.setItem("EntryMemo.lastActiveEntryFileName", fileName);

    UI.showLoading("エントリーを読み込み中...");
    try {
      const md = await currentStorage.readEntry(categoryName, fileName);
      const parsed = Markdown.parseEntry(md);
      
      activeEntryObj = {
        categoryName: categoryName,
        fileName: fileName,
        title: parsed.title,
        summary: parsed.summary,
        summaryTitle: parsed.summaryTitle || "概要",
        blocks: parsed.blocks,
        hasError: parsed.errors.length > 0,
        errors: parsed.errors,
        isFavorite: favorites.has(`${categoryName}/${fileName}`)
      };

      UI.renderCurrentEntry(activeEntryObj, true);
      document.title = `${categoryName} ＞ ${activeEntryObj.title || fileName} - mememox`;
    } catch (e) {
      console.error(e);
      activeEntryObj = {
        categoryName: categoryName,
        fileName: fileName,
        title: fileName,
        summary: "",
        summaryTitle: "概要",
        blocks: [],
        hasError: true,
        errors: [`ファイルを読み込めませんでした: ${e.message}`]
      };
      UI.renderCurrentEntry(activeEntryObj, true);
      document.title = `要修復: ${fileName} - mememox`;
      UI.showToast(`エントリーの読み込みに失敗しました: ${e.message}`, "error");
    } finally {
      UI.hideLoading();
    }
  }

  // IndexedDBを使ってFileSystemDirectoryHandleを保存・取得する関数
  function saveLastDirectoryHandle(handle) {
    return new Promise((resolve) => {
      const request = indexedDB.open("EntryMemoDB", 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("handles")) {
          db.createObjectStore("handles");
        }
      };
      request.onsuccess = (e) => {
        const db = e.target.result;
        try {
          const tx = db.transaction("handles", "readwrite");
          const store = tx.objectStore("handles");
          store.put(handle, "lastDirectory");
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (err) {
          resolve(false);
        }
      };
      request.onerror = () => resolve(false);
    });
  }

  function loadLastDirectoryHandle() {
    return new Promise((resolve) => {
      const request = indexedDB.open("EntryMemoDB", 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("handles")) {
          db.createObjectStore("handles");
        }
      };
      request.onsuccess = (e) => {
        const db = e.target.result;
        try {
          const tx = db.transaction("handles", "readonly");
          const store = tx.objectStore("handles");
          const getReq = store.get("lastDirectory");
          getReq.onsuccess = () => resolve(getReq.result || null);
          getReq.onerror = () => resolve(null);
        } catch (err) {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  }

  /**
   * フォルダ選択ボタン押下時の処理
   */
  async function handleOpenFolder() {
    if (typeof window.showDirectoryPicker !== "function") {
      UI.showToast("お使いのブラウザはフォルダ選択に対応していません。", "error");
      return;
    }

    try {
      let dirHandle = null;
      
      const isCurrentlyDemo = currentStorage instanceof Storage.DemoStorage;
      if (isCurrentlyDemo) {
        const savedHandle = await loadLastDirectoryHandle();
        if (savedHandle) {
          try {
            const permission = await savedHandle.requestPermission({ mode: "readwrite" });
            if (permission === "granted") {
              dirHandle = savedHandle;
            }
          } catch (permErr) {
            console.warn("Failed to request permission for saved handle", permErr);
          }
        }
      }

      if (!dirHandle) {
        dirHandle = await window.showDirectoryPicker({
          mode: "readwrite",
          id: "entry-memo-directory"
        });
      }

      const fsStorage = new Storage.FileSystemStorage(dirHandle);
      const hasCategories = await fsStorage.init();

      if (!hasCategories) {
        const confirmCreate = confirm(
          "このフォルダに初期構造を作成しますか？\n\n" +
          "inbox/\n" +
          "  inbox.md\n" +
          "thinking/\n" +
          "  entry-memo-system.md\n" +
          "work/\n" +
          "  work-memo-environment.md"
        );

        if (confirmCreate) {
          try {
            await fsStorage.createInitialStructure();
            UI.showToast("初期構造を作成しました。", "success");
          } catch (createErr) {
            console.error(createErr);
            UI.showToast(`初期構造の作成に失敗しました: ${createErr.message}`, "error");
            return;
          }
        } else {
          UI.showToast("初期構造の作成をキャンセルしました。ファイルを変更していません。", "warning");
          return;
        }
      }

      // ストレージをFileSystemStorageに切り替え
      currentStorage = fsStorage;
      injectFavoritesMethods(currentStorage);
      const localFavs = localStorage.getItem("EntryMemo.favorites");
      currentStorage.favorites = new Set(localFavs ? JSON.parse(localFavs) : []);
      favorites = currentStorage.favorites;
      activeCategory = "";
      activeEntryFileName = "";
      activeEntryObj = null;

      // 最後に開いたフォルダとして保存
      await saveLastDirectoryHandle(dirHandle);

      UI.updateModeIndicator(false, dirHandle.name);
      UI.showToast(`フォルダ "${dirHandle.name}" を開きました。`, "success");

      // 初期のエントリーをロード
      await loadInitialEntry();

    } catch (e) {
      if (e.name === "AbortError") {
        // ユーザーがキャンセルした場合は何もしない
        return;
      }
      console.error("Failed to open folder:", e);
      UI.showToast(`フォルダを開けませんでした: ${e.message}`, "error");
    }
  }

  /**
   * 新規エントリー作成
   */
  async function handleCreateEntry(categoryName, title) {
    if (!currentStorage) return false;

    try {
      // ファイル名の生成
      const sanitizedName = Utils.sanitizeFileName(title);
      const fileNameCandidates = sanitizedName.endsWith(".md") ? sanitizedName : `${sanitizedName}.md`;

      const initialMd = `# ${title}\n\n## 概要\n\n\n\n## ブロック\n`;

      // 重複解決を含めてファイルを作成
      const actualFileName = await currentStorage.createEntry(categoryName, fileNameCandidates, initialMd);
      
      UI.showToast(`新しいエントリー "${title}" を作成しました。`, "success");
      
      // 作成したエントリーを開く
      await handleSelectEntry(categoryName, actualFileName);
      return true;
    } catch (e) {
      console.error(e);
      UI.showToast(`エントリーの作成に失敗しました: ${e.message}`, "error");
      throw e;
    }
  }

  /**
   * エントリーの削除（ゴミ箱への移動、または完全削除）
   */
  async function handleDeleteEntry(categoryName, fileName) {
    if (isReadOnly() && !currentStorage) return;

    const isTrash = categoryName === "ゴミ箱" || categoryName === "trash";
    const confirmMessage = isTrash 
      ? `エントリー "${fileName}" を完全に削除しますか？\nこの操作は取り消せません。`
      : `エントリー "${fileName}" を「ゴミ箱」カテゴリーへ移動しますか？`;

    if (!confirm(confirmMessage)) return;

    UI.showLoading("エントリーを削除中...");
    try {
      if (isTrash) {
        await currentStorage.deleteEntry(categoryName, fileName);
        favorites.delete(`${categoryName}/${fileName}`);
        saveFavorites();
        UI.showToast(`エントリー "${fileName}" を完全に削除しました。`, "success");
      } else {
        const actualFileName = await currentStorage.moveEntry(categoryName, fileName, "ゴミ箱", fileName);
        favorites.delete(`${categoryName}/${fileName}`);
        favorites.delete(`ゴミ箱/${actualFileName}`);
        saveFavorites();
        UI.showToast(`エントリー "${fileName}" を「ゴミ箱」カテゴリーに移動しました。`, "success");
      }

      // 初期エントリーを開き直す
      await loadInitialEntry();
    } catch (e) {
      console.error(e);
      UI.showToast(`エントリーの削除に失敗しました: ${e.message}`, "error");
    } finally {
      UI.hideLoading();
    }
  }

  /**
   * エントリーの編集（タイトル、所属するカテゴリーの変更）
   */
  async function handleEditEntry(categoryName, fileName, newCategoryName, newTitle) {
    if (isReadOnly() && !currentStorage) return false;

    try {
      // 1. タイトルの変更を適用
      activeEntryObj.title = newTitle;
      const updatedMd = Markdown.serializeEntry(activeEntryObj);

      // 2. 移動先（ファイル名）の決定
      const sanitized = Utils.sanitizeFileName(newTitle);
      const targetFileName = sanitized.endsWith(".md") ? sanitized : `${sanitized}.md`;

      // 3. 一旦現在のエントリーへ書き込む
      await currentStorage.writeEntry(categoryName, fileName, updatedMd);

      let actualFileName = fileName;
      let actualCategoryName = categoryName;

      // 4. カテゴリー、またはファイル名が変わる場合は moveEntry を呼び出す
      if (categoryName !== newCategoryName || fileName !== targetFileName) {
        actualFileName = await currentStorage.moveEntry(categoryName, fileName, newCategoryName, targetFileName);
        actualCategoryName = newCategoryName;

        // お気に入りのキーを移行する
        const oldKey = `${categoryName}/${fileName}`;
        const newKey = `${actualCategoryName}/${actualFileName}`;
        if (favorites.has(oldKey)) {
          favorites.delete(oldKey);
          const isTrash = actualCategoryName === "ゴミ箱" || actualCategoryName === "trash";
          if (!isTrash) {
            favorites.add(newKey);
          }
          saveFavorites();
        }

        UI.showToast(`エントリーを「${newCategoryName}」に移動し、タイトルを更新しました。`, "success");
      } else {
        UI.showToast("エントリータイトルを更新しました。", "success");
      }

      // 開き直す
      await handleSelectEntry(actualCategoryName, actualFileName);
      return true;
    } catch (e) {
      console.error(e);
      UI.showToast(`エントリーの編集に失敗しました: ${e.message}`, "error");
      throw e;
    }
  }

  /**
   * 概要の編集保存
   */
  async function handleSaveSummary(newTitle, newValue) {
    if (isReadOnly()) return false;

    try {
      activeEntryObj.summaryTitle = newTitle.trim();
      activeEntryObj.summary = newValue.trim();
      
      // 再シリアライズ
      const md = Markdown.serializeEntry(activeEntryObj);
      
      // 書き込み
      await currentStorage.writeEntry(activeEntryObj.categoryName, activeEntryObj.fileName, md);
      
      UI.showToast(`${activeEntryObj.summaryTitle}を保存しました。`, "success");
      UI.renderCurrentEntry(activeEntryObj);
      return true;
    } catch (e) {
      console.error(e);
      UI.showToast(`${newTitle.trim() || "概要"}の保存に失敗しました: ${e.message}`, "error");
      throw e;
    }
  }

  /**
   * ブロックの追加
   */
  async function handleCreateBlock(title, body) {
    if (isReadOnly()) return;

    UI.showLoading("ブロックを追加中...");
    try {
      const existingIds = await getAllExistingIds();
      const newBlock = Markdown.createBlock(title, body, existingIds);

      // 追加
      activeEntryObj.blocks.push(newBlock);

      // 保存
      const md = Markdown.serializeEntry(activeEntryObj);
      await currentStorage.writeEntry(activeEntryObj.categoryName, activeEntryObj.fileName, md);

      UI.showToast("新しいブロックを追加しました。", "success");
      
      // 再描画の前に、UI側で新しく追加されたブロックにフォーカスを当てるように指示
      UI.setFocusedBlockId(newBlock.id);
      UI.renderCurrentEntry(activeEntryObj);
    } catch (e) {
      console.error(e);
      UI.showToast(`ブロックの追加に失敗しました: ${e.message}`, "error");
    } finally {
      UI.hideLoading();
    }
  }

  /**
   * ブロックの編集
   */
  async function handleUpdateBlock(blockId, title, body) {
    if (isReadOnly()) return;

    UI.showLoading("ブロックを更新中...");
    try {
      Markdown.updateBlock(activeEntryObj, blockId, title, body);

      // 保存
      const md = Markdown.serializeEntry(activeEntryObj);
      await currentStorage.writeEntry(activeEntryObj.categoryName, activeEntryObj.fileName, md);

      UI.showToast("ブロックを更新しました。", "success");
      
      // 再描画の前に、編集されたブロックにフォーカスを合わせる
      UI.setFocusedBlockId(blockId);
      UI.renderCurrentEntry(activeEntryObj);
    } catch (e) {
      console.error(e);
      UI.showToast(`ブロックの更新に失敗しました: ${e.message}`, "error");
    } finally {
      UI.hideLoading();
    }
  }

  /**
   * ブロックの移動
   */
  async function handleMoveBlock(blockId, targetCategory, targetFileName) {
    if (isReadOnly()) return;

    if (activeEntryObj && activeEntryObj.categoryName === targetCategory && activeEntryObj.fileName === targetFileName) {
      UI.showToast("移動先が現在のエントリーと同じです。自分自身へは移動できません。", "warning");
      return;
    }

    const sourceBlock = activeEntryObj.blocks.find(r => r.id === blockId);
    if (!sourceBlock) {
      UI.showToast("移動対象のブロックが見つかりません。", "error");
      return;
    }

    UI.showLoading("ブロックを移動中...");
    try {
      // 1. 移動先のファイルを読み込み、パース
      const targetMd = await currentStorage.readEntry(targetCategory, targetFileName);
      const targetEntryParsed = Markdown.parseEntry(targetMd);

      if (targetEntryParsed.errors.length > 0) {
         UI.showToast("移動先エントリーにエラーがあるため、移動できません。", "error");
         return;
      }

      // 移動先の既存ID重複チェック
      const duplicateId = targetEntryParsed.blocks.some(r => r.id === blockId);
      if (duplicateId) {
        UI.showToast(`移動先エントリーにすでに同じID [${blockId}] のブロックが存在します。移動できません。`, "error");
        return;
      }

      // 2. 移動先エントリーオブジェクトにブロックを追加
      targetEntryParsed.blocks.push({
        id: sourceBlock.id,
        title: sourceBlock.title,
        body: sourceBlock.body,
        datetime: sourceBlock.datetime
      });

      // 3. 移動先エントリーのMarkdownシリアライズ＆書き込み
      const targetSerialized = Markdown.serializeEntry(targetEntryParsed);
      await currentStorage.writeEntry(targetCategory, targetFileName, targetSerialized);

      // 4. 移動先の書き込みが100%成功した後、移動元から削除
      let sourceRemovedSuccessfully = false;
      try {
        activeEntryObj.blocks = activeEntryObj.blocks.filter(r => r.id !== blockId);
        const sourceSerialized = Markdown.serializeEntry(activeEntryObj);
        await currentStorage.writeEntry(activeEntryObj.categoryName, activeEntryObj.fileName, sourceSerialized);
        sourceRemovedSuccessfully = true;
      } catch (removeErr) {
        console.error(removeErr);
        UI.showToast(
          `警告: 移動先には保存されましたが、移動元からの削除に失敗しました。個別に対応してください。エラー: ${removeErr.message}`, 
          "error"
        );
      }

      if (sourceRemovedSuccessfully) {
        UI.showToast("ブロックを別のエントリーに移動しました。", "success");
        // 移動元エントリーを再描画して、移動したブロックが消えたことを反映
        UI.renderCurrentEntry(activeEntryObj);
      }
    } catch (e) {
      console.error(e);
      UI.showToast(`ブロックの移動に失敗しました: ${e.message}`, "error");
    } finally {
      UI.hideLoading();
    }
  }

  /**
   * ブロックから新しいエントリーを作成して移動
   */
  async function handleMoveBlockToNewEntry(blockId, targetCategory, entryName) {
    if (isReadOnly()) return;

    const sourceBlock = activeEntryObj.blocks.find(r => r.id === blockId);
    if (!sourceBlock) {
      UI.showToast("移動対象のブロックが見つかりません。", "error");
      return;
    }

    UI.showLoading("エントリーを作成中...");
    try {
      // 1. 新規エントリーのMarkdownを作成
      const newEntryObj = {
        title: entryName,
        summary: "",
        summaryTitle: "概要",
        blocks: [
          {
            id: sourceBlock.id,
            title: sourceBlock.title,
            body: sourceBlock.body,
            datetime: sourceBlock.datetime
          }
        ]
      };

      const newEntryMd = Markdown.serializeEntry(newEntryObj);
      
      // 2. 新規ファイル名を生成（重複連番解決は createEntry 内部で行われる）
      const sanitizedName = Utils.sanitizeFileName(entryName);
      const fileCandidate = sanitizedName.endsWith(".md") ? sanitizedName : `${sanitizedName}.md`;

      // 3. 移動先新規ファイルを保存
      const actualFileName = await currentStorage.createEntry(targetCategory, fileCandidate, newEntryMd);

      // 4. 新エントリー保存成功後にだけ、元エントリーからブロックを削除する
      let sourceRemovedSuccessfully = false;
      try {
        activeEntryObj.blocks = activeEntryObj.blocks.filter(r => r.id !== blockId);
        const sourceSerialized = Markdown.serializeEntry(activeEntryObj);
        await currentStorage.writeEntry(activeEntryObj.categoryName, activeEntryObj.fileName, sourceSerialized);
        sourceRemovedSuccessfully = true;
      } catch (removeErr) {
        console.error(removeErr);
        UI.showToast(
          `警告: 新規エントリーは作成されましたが、移動元からの削除に失敗しました。エラー: ${removeErr.message}`, 
          "error"
        );
      }

      if (sourceRemovedSuccessfully) {
        UI.showToast(`新規エントリー "${entryName}" を作成し、ブロックを移動しました。`, "success");
        // 移動元エントリーを再描画して、移動したブロックが消えたことを反映
        UI.renderCurrentEntry(activeEntryObj);
      }
    } catch (e) {
      console.error(e);
      UI.showToast(`新規エントリー作成および移動に失敗しました: ${e.message}`, "error");
    } finally {
      UI.hideLoading();
    }
  }

  /**
   * カテゴリーのエントリー一覧
   */
  async function handleSelectCategory(categoryName) {
    activeCategory = categoryName;
    activeEntryFileName = "";
    activeEntryObj = null;
    lastActiveListViewCategory = categoryName;

    localStorage.setItem("EntryMemo.lastActiveCategory", categoryName);
    localStorage.setItem("EntryMemo.lastActiveListViewCategory", categoryName);
    localStorage.removeItem("EntryMemo.lastActiveEntryFileName");

    UI.showLoading("カテゴリーのエントリーを読み込み中...");
    try {
      const entries = await currentStorage.listEntries(categoryName);

      const entryDetails = await Promise.all(entries.map(async (t) => {
        try {
          const md = await currentStorage.readEntry(categoryName, t.fileName);
          const parsed = Markdown.parseEntry(md);
          const summaryExcerpt = Utils.excerpt(parsed.summary || "", 80) || "(概要は設定されていません)";

          return {
            categoryName: categoryName,
            fileName: t.fileName,
            title: parsed.title || t.fileName,
            excerpt: summaryExcerpt,
            hasError: parsed.errors.length > 0,
            isFavorite: favorites.has(`${categoryName}/${t.fileName}`),
            mtime: t.mtime || 0
          };
        } catch (e) {
          return {
            categoryName: categoryName,
            fileName: t.fileName,
            title: t.fileName,
            excerpt: "ファイルの読み込みに失敗しました。",
            hasError: true,
            isFavorite: favorites.has(`${categoryName}/${t.fileName}`),
            mtime: t.mtime || 0
          };
        }
      }));

      // お気に入り優先、かつ更新日時（mtime）が新しい順にソート
      entryDetails.sort((a, b) => {
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        return (b.mtime || 0) - (a.mtime || 0);
      });

      UI.renderCategoryEntries(categoryName, entryDetails);
      document.title = `${categoryName} - mememox`;
    } catch (e) {
      console.error(e);
      UI.showToast(`カテゴリーのエントリー一覧の取得に失敗しました: ${e.message}`, "error");
    } finally {
      UI.hideLoading();
    }
  }

  async function handleShowMarkdownPreview(categoryName, fileName) {
    try {
      const md = await currentStorage.readEntry(categoryName, fileName);
      UI.openMarkdownPreviewPanel(md);
    } catch (e) {
      console.error(e);
      UI.showToast(`Markdownの取得に失敗しました: ${e.message}`, "error");
    }
  }

  async function handleToggleFavorite(category, fileName) {
    try {
      const isFavNow = await currentStorage.toggleFavorite(category, fileName);
      
      // ローカルモードの時のみ localStorage にミラーリング
      if (currentStorage.constructor.name === "FileSystemStorage") {
        const list = Array.from(currentStorage.favorites);
        localStorage.setItem("EntryMemo.favorites", JSON.stringify(list));
      }

      UI.showToast(isFavNow ? "お気に入り（Pickup）に追加しました。" : "お気に入りから解除しました。", "success");
      
      // UIの再描画
      if (activeCategory === "すべてのエントリー") {
        await showAllEntriesListView();
      } else if (activeCategory && !activeEntryFileName) {
        await handleSelectCategory(activeCategory);
      } else if (activeCategory && activeEntryFileName) {
        // 詳細ビュー表示中の更新
        const entry = await currentStorage.readEntry(activeCategory, activeEntryFileName);
        const parsed = Markdown.parseEntry(entry);
        parsed.categoryName = activeCategory;
        parsed.fileName = activeEntryFileName;
        parsed.isFavorite = isFavNow;
        UI.renderCurrentEntry(parsed);
      }
    } catch (e) {
      console.error(e);
      UI.showToast(`お気に入り設定の変更に失敗しました: ${e.message}`, "error");
    }
  }

  function isFavorite(categoryName, fileName) {
    return favorites.has(`${categoryName}/${fileName}`);
  }

  async function handleDeleteBlock(blockId) {
    if (isReadOnly()) return;

    UI.showLoading("ブロックを削除中...");
    try {
      activeEntryObj.blocks = activeEntryObj.blocks.filter(r => r.id !== blockId);
      const md = Markdown.serializeEntry(activeEntryObj);
      await currentStorage.writeEntry(activeEntryObj.categoryName, activeEntryObj.fileName, md);

      UI.showToast("ブロックを削除しました。", "success");
      UI.renderCurrentEntry(activeEntryObj);
    } catch (e) {
      console.error(e);
      UI.showToast(`ブロックの削除に失敗しました: ${e.message}`, "error");
    } finally {
      UI.hideLoading();
    }
  }

  async function handleDeleteBlocks(blockIds) {
    if (isReadOnly()) return;

    UI.showLoading("選択したブロックを削除中...");
    try {
      activeEntryObj.blocks = activeEntryObj.blocks.filter(r => !blockIds.includes(r.id));
      const md = Markdown.serializeEntry(activeEntryObj);
      await currentStorage.writeEntry(activeEntryObj.categoryName, activeEntryObj.fileName, md);

      UI.showToast("選択したブロックを削除しました。", "success");
      UI.renderCurrentEntry(activeEntryObj);
    } catch (e) {
      console.error(e);
      UI.showToast(`ブロックの削除に失敗しました: ${e.message}`, "error");
    } finally {
      UI.hideLoading();
    }
  }


  async function handleMergeBlocks(blockIds) {
    if (isReadOnly()) return;

    const selectedBlocks = activeEntryObj.blocks.filter(r => blockIds.includes(r.id));
    if (selectedBlocks.length === 0) {
      UI.showToast("マージ対象のブロックが選択されていません。", "error");
      return;
    }

    UI.showLoading("ブロックをマージ中...");
    try {
      const allExistingIds = await getAllExistingIds();
      
      const firstBlockTitle = selectedBlocks[0].title;
      const mergedBlock = Markdown.mergeBlocks(selectedBlocks, firstBlockTitle, allExistingIds);

      // 元のエントリーオブジェクトから元のブロックを削除し、マージされたブロックを追加する
      activeEntryObj.blocks = activeEntryObj.blocks.filter(r => !blockIds.includes(r.id));
      activeEntryObj.blocks.push(mergedBlock);

      // 保存
      const md = Markdown.serializeEntry(activeEntryObj);
      await currentStorage.writeEntry(activeEntryObj.categoryName, activeEntryObj.fileName, md);

      UI.showToast("ブロックをマージしました。", "success");
      
      // マージされた新しいブロックにフォーカスを合わせる
      UI.setFocusedBlockId(mergedBlock.id);
      UI.renderCurrentEntry(activeEntryObj);
    } catch (e) {
      console.error(e);
      UI.showToast(`ブロックのマージに失敗しました: ${e.message}`, "error");
    } finally {
      UI.hideLoading();
    }
  }

  function getActiveCategory() {
    return activeCategory;
  }

  async function getSortedFavorites() {
    const sortedFavs = [];
    if (!currentStorage) return sortedFavs;
    const categories = await currentStorage.listCategories();
    for (const category of categories) {
      const entries = await currentStorage.listEntries(category);
      for (const entry of entries) {
        const key = `${category}/${entry.fileName}`;
        if (favorites.has(key)) {
          sortedFavs.push({ category, fileName: entry.fileName, mtime: entry.mtime || 0 });
        }
      }
    }
    // 更新日時（mtime）が新しい順にソート
    sortedFavs.sort((a, b) => b.mtime - a.mtime);
    return sortedFavs;
  }

  async function handleNavigateEntry(direction) {
    if (!currentStorage) return;
    const sortedFavs = await getSortedFavorites();
    if (sortedFavs.length <= 1) return;

    let currentIndex = sortedFavs.findIndex(
      f => f.category === activeCategory && f.fileName === activeEntryFileName
    );

    if (currentIndex === -1) {
      await handleSelectEntry(sortedFavs[0].category, sortedFavs[0].fileName);
      return;
    }

    let nextIndex;
    if (direction === "next") {
      nextIndex = (currentIndex + 1) % sortedFavs.length;
    } else {
      nextIndex = (currentIndex - 1 + sortedFavs.length) % sortedFavs.length;
    }

    const target = sortedFavs[nextIndex];
    await handleSelectEntry(target.category, target.fileName);
  }

  function handleToggleView(view) {
    if (view === "board") { // 互換性のため "board" を許容
      if (activeCategory) {
        handleSelectCategory(activeCategory);
      }
    } else if (view === "thread") { // 互換性のため "thread" を許容
      if (activeCategory && activeEntryFileName) {
        handleSelectCategory(activeCategory);
      }
    }
  }

  async function handleNavigateCategory(direction) {
    if (!currentStorage) return;
    const categories = await currentStorage.listCategories();
    categories.sort(Utils.compareCategories);
    if (categories.length <= 1) return;

    let currentIndex = categories.indexOf(activeCategory);
    if (currentIndex === -1) {
      await handleSelectCategory(categories[0]);
      return;
    }

    let nextIndex;
    if (direction === "next") {
      nextIndex = (currentIndex + 1) % categories.length;
    } else {
      nextIndex = (currentIndex - 1 + categories.length) % categories.length;
    }

    await handleSelectCategory(categories[nextIndex]);
  }

  /**
   * 左右スワイプによる画面のトグル遷移
   */
  async function handleSwipeToggle() {
    const isCategoryViewActive = document.getElementById("category-entries-view").style.display === "flex";
    if (isCategoryViewActive) {
      // エントリー一覧画面にいる場合：最後に見ていたエントリー詳細画面へ遷移
      if (lastActiveEntryCategory && lastActiveEntryFileName) {
        await handleSelectEntry(lastActiveEntryCategory, lastActiveEntryFileName);
      } else {
        const sortedFavs = await getSortedFavorites();
        if (sortedFavs.length > 0) {
          await handleSelectEntry(sortedFavs[0].category, sortedFavs[0].fileName);
        }
      }
    } else {
      // エントリー詳細画面にいる場合：最後に見ていたエントリー一覧画面へ遷移
      if (lastActiveListViewCategory === "すべてのエントリー") {
        await showAllEntriesListView();
      } else if (lastActiveListViewCategory) {
        await handleSelectCategory(lastActiveListViewCategory);
      } else {
        await showAllEntriesListView();
      }
    }
  }

  async function handlePullToRefresh() {
    if (!currentStorage) return;
    await currentStorage.init();
    
    if (activeCategory === "すべてのエントリー") {
      await showAllEntriesListView();
    } else if (activeCategory && !activeEntryFileName) {
      await handleSelectCategory(activeCategory);
    } else if (activeCategory && activeEntryFileName) {
      await handleSelectEntry(activeCategory, activeEntryFileName);
    } else {
      await loadInitialEntry();
    }
  }

  return {
    init,
    isReadOnly,
    getCurrentEntry,
    getActiveCategory,
    handleNavigateEntry,
    handleNavigateCategory,
    handleToggleView,
    handleSelectEntry,
    handleSelectCategory,
    handleToggleFavorite,
    handleShowMarkdownPreview,
    showAllEntriesListView,
    isFavorite,
    handleDeleteBlock,
    handleDeleteBlocks,
    handleMergeBlocks,
    handleOpenFolder,
    handleCreateEntry,
    handleDeleteEntry,
    handleEditEntry,
    handleSaveSummary,
    handleCreateBlock,
    handleUpdateBlock,
    handleMoveBlock,
    handleMoveBlockToNewEntry,
    handleSwipeToggle,
    handlePullToRefresh,
    storage: {
      listCategories: () => currentStorage.listCategories(),
      listEntries: (b) => currentStorage.listEntries(b),
      readEntry: (b, f) => currentStorage.readEntry(b, f),
      deleteEntry: (b, f) => currentStorage.deleteEntry(b, f),
      moveEntry: (ob, of, nb, nf) => currentStorage.moveEntry(ob, of, nb, nf)
    }
  };
})();
