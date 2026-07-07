window.EntryMemo = window.EntryMemo || {};

window.EntryMemo.UI = (function () {
  const Utils = window.EntryMemo.Utils;
  const Markdown = window.EntryMemo.Markdown;

  // DOM要素の参照キャッシュ
  let elements = {};

  // 開いたブロックIDの記憶
  let expandedBlockIds = new Set();

  // フォーカスされているブロックカードのインデックス
  let focusedBlockIndex = -1;

  // フォーカスされているエントリーカードのインデックス
  let focusedEntryIndex = -1;

  // ブロックの並び順（昇順 asc / 降順 desc）
  let currentSortOrder = localStorage.getItem("EntryMemo.sortOrder") || "desc";

  // エントリー一覧の表示モード（カテゴリーごと group / カテゴリー区別なし flat）
  let currentEntryListViewMode = localStorage.getItem("EntryMemo.entryListViewMode") || "group";

  // 編集・作成・マージ後にフォーカスを合わせるブロックID
  let lastFocusedBlockId = null;

  // ブロックモーダル内でのEnterキー連続入力回数
  let blockModalEnterCount = 0;

  // 入力フォームがアクティブかどうかを判定する関数
  const isTextInputActive = () => {
    const activeEl = document.activeElement;
    if (!activeEl) return false;
    const tag = activeEl.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || activeEl.isContentEditable;
  };

  // 階層構造（ツリー）を維持したまま、第一階層（見出し3）のみソート順を適用して平坦化されたリストを取得する
  const getDisplayBlocks = (blocks, sortOrder) => {
    if (!blocks || blocks.length === 0) return [];

    const roots = [];
    const stack = []; // [{node, level}]

    blocks.forEach(block => {
      const level = block.level || 3;
      const node = { block: block, children: [] };

      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      if (stack.length > 0) {
        stack[stack.length - 1].node.children.push(node);
      } else {
        roots.push(node);
      }

      stack.push({ node: node, level: level });
    });

    if (sortOrder === "desc") {
      roots.reverse();
    }

    const flatList = [];
    function flatten(nodes) {
      nodes.forEach(node => {
        flatList.push(node.block);
        flatten(node.children);
      });
    }
    flatten(roots);
    return flatList;
  };

  /**
   * 親ブロックの開閉状態に応じて、非表示にすべき子ブロックIDのSetを算出する
   */
  const calculateHiddenBlocks = (blocks) => {
    const hiddenBlockIds = new Set();
    const stack = []; // [{id, level}]
    
    // 親子関係の判定は、ソート順にかかわらず常にオリジナルの昇順順序で走査して判定する
    blocks.forEach(rec => {
      const level = rec.level || 3;
      
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }
      
      // スタックに残っているすべての先祖が「開いている（expanded）」状態であるか確認
      const isVisible = stack.every(ancestor => expandedBlockIds.has(ancestor.id));
      if (!isVisible) {
        hiddenBlockIds.add(rec.id);
      }
      
      stack.push({
        id: rec.id,
        level: level
      });
    });

    return hiddenBlockIds;
  };

  // デフォルトの多言語翻訳辞書定義
  const DefaultTranslations = {
    ja: {
      name: "日本語",
      selectLanguage: "言語の選択",
      selectLanguageLabel: "使用する言語を選択してください：",
      save: "保存",
      cancel: "キャンセル",
      openFolder: "フォルダを開く",
      refresh: "最新の情報に更新",
      manual: "操作マニュアルを開く",
      home: "ホーム",
      newEntryBtn: "新規エントリー",
      demoMode: "デモモード",
      serverMode: "サーバーモード",
      localFolder: "ローカルフォルダ",
      languageChanged: "言語を変更しました。",
      category: "カテゴリー",
      title: "タイトル",
      all: "すべて",
      trash: "ゴミ箱",
      inbox: "インボックス",
      thinking: "思考",
      work: "作業",
      openFolderSuccess: "フォルダを開きました。",
      openFolderFailed: "フォルダを開けませんでした：",
      initialStructureSuccess: "初期構造を作成しました。",
      initialStructureFailed: "初期構造の作成に失敗しました：",
      cancelInitialStructure: "初期構造の作成をキャンセルしました。ファイルを変更していません。",
      entryDeleteSuccess: "エントリーを削除しました。",
      entryDeleteFailed: "エントリーの削除に失敗しました：",
      entryCreateSuccess: "エントリーを作成しました。",
      entryCreateFailed: "エントリーの作成に失敗しました：",
      entryUpdateSuccess: "エントリーを保存しました。",
      entryUpdateFailed: "エントリーの保存に失敗しました：",
      blockUpdateSuccess: "ブロックを保存しました。",
      blockUpdateFailed: "ブロックの保存に失敗しました：",
      blockDeleteSuccess: "ブロックを削除しました。",
      blockDeleteFailed: "ブロックの削除に失敗しました：",
      blockMoveSuccess: "ブロックを移動しました。",
      blockMoveFailed: "ブロックの移動に失敗しました：",
      blockMergeSuccess: "ブロックをマージしました。",
      blockMergeFailed: "ブロックのマージに失敗しました：",
      confirmDeleteEntry: "エントリー \"${fileName}\" を完全に削除しますか？\nこの操作は取り消せません。",
      confirmDeleteBlock: "このブロックを削除しますか？",
      confirmInitialStructure: "このフォルダに初期構造を作成しますか？\n\ninbox/\n  inbox.md\nthinking/\n  entry-memo-system.md\nwork/\n  work-memo-environment.md",
      warningDemoSave: "注意: デモモードの変更はブラウザのリロードで消失します。",
      newEntryTitle: "新規エントリー",
      newEntryCategoryLabel: "カテゴリー",
      newEntryTitleLabel: "タイトル",
      newEntryTitlePlaceholder: "タイトルを入力してください",
      newEntryNewCategoryOption: "＋ 新しいカテゴリーを作って追加する",
      editEntryTitle: "エントリーの編集",
      edit: "編集",
      editEntryTitleLabel: "エントリータイトル",
      editEntryTitlePlaceholder: "タイトルを入力してください",
      editEntryNewCategoryOption: "＋ 新しいカテゴリーを作って移動する",
      editEntryCategorySelectLabel: "移動先のカテゴリー",
      editEntryNewCategoryLabel: "新しいカテゴリー名",
      editEntryNewCategoryPlaceholder: "新しいカテゴリーの名前を入力してください",
      addBlockTitle: "新規ブロックの追加",
      editBlockTitle: "ブロックの編集",
      blockTitleLabel: "ブロックタイトル（任意）",
      blockTitlePlaceholder: "ブロックの見出し（省略可能）",
      blockBodyLabel: "ブロック本文",
      blockBodyPlaceholder: "メモの内容をMarkdown形式で入力してください",
      moveBlockTitle: "ブロックの移動",
      moveBlockTargetLabel: "移動先のエントリー",
      moveBlockTargetPlaceholder: "移動先のエントリー名を選択または検索",
      mergeActionBarTitle: "選択されたブロック",
      mergeActionBarBtn: "マージ",
      mergeActionBarRelocateBtn: "一括移動",
      mergeActionBarDeleteBtn: "一括削除",
      
      // 動的追加キー
      confirmMoveToTrash: "エントリー \"${fileName}\" を「ゴミ箱」カテゴリーへ移動しますか？",
      warningLocalFolderUnsupported: "お使いのブラウザはローカルフォルダの読み書きに対応していません。デモモードのみご利用いただけます。",
      favoriteAdded: "お気に入り（Pickup）に追加しました。",
      favoriteRemoved: "お気に入りから解除しました。",
      entryEditSuccessMove: "エントリーを「${category}」に移動し、タイトルを更新しました。",
      entryEditSuccessTitle: "エントリータイトルを更新しました。",
      summary: "概要",
      summaryTextareaPlaceholder: "現在の結論、方針、未解決事項などを${summaryTitle}に記述してください...",
      viewModeGroup: "カテゴリー別 ↕",
      viewModeFlat: "新着順（一列） ↕",
      noEntries: "登録されたエントリーがありません。",

      // HTML追加翻訳キー (ja)
      allEntries: "すべてのエントリー",
      newEntryTitle: "新規エントリー作成",
      newEntryTitleLabel: "エントリー名",
      newEntryTitlePlaceholder: "エントリーのタイトルを入力してください",
      newEntryNewCategoryOption: "＋ 新しいカテゴリーを作って作成する",
      editEntryCategorySelectLabel: "移動先のカテゴリー",
      editEntryNewCategoryLabel: "新しいカテゴリー名",
      editEntryNewCategoryPlaceholder: "新しいカテゴリーの名前を入力してください",
      editEntryTitle: "エントリーの編集",
      editEntryTitleLabel: "エントリータイトル",
      editEntryTitlePlaceholder: "エントリーのタイトルを入力してください",
      editEntryNewCategoryOption: "＋ 新しいカテゴリーを作って移動する",
      move: "移動する",
      moveBlockDesc: "以下のブロックを別のエントリーに移動します。",
      moveNewEntryOption: "＋ 新しいエントリーを作って移動する",
      helpTitle: "⌨️ キーボードショートカット",
      helpSectionNavigation: "ナビゲーション",
      helpSectionBasic: "基本操作",
      helpSectionCategory: "カテゴリーのエントリー一覧画面時",
      helpSectionCard: "概要・ブロックカード選択時（J/Kで移動）",
      helpSectionModal: "ポップアップ（モーダル）内",
      helpItemToggleHelp: "ヘルプパネルの開閉",
      helpItemToggleSidebar: "サイドバーの表示/非表示",
      helpItemNavigateEntry: "前後のエントリーに切り替え",
      helpItemToggleView: "ビューの切り替え",
      helpItemOpenFolder: "メモフォルダを開く",
      helpItemNewEntry: "新規エントリーの作成",
      helpItemEditEntry: "エントリーの編集",
      helpItemDeleteEntry: "エントリーの削除 (ゴミ箱へ移動)",
      helpItemAddBlock: "ブロック追加ポップアップを開く (Aは非入力時)",
      helpItemAddChildBlock: "選択中のブロックに子ブロックを追加 (Alt + Enter)",
      helpItemEditSummary: "概要セクションの編集",
      helpItemShowAll: "カテゴリーのエントリー一覧を表示",
      helpItemNavigateCategory: "カテゴリーの切り替え / エントリー一覧へ",
      helpItemCategorySelect: "次 / 前のエントリーを選択",
      helpItemCategoryOpen: "選択中のエントリーを開く",
      helpItemCategorySwitch: "前後のカテゴリーのエントリー一覧に移動",
      helpItemCardSelect: "次 / 前の項目（概要・ブロック）を選択",
      helpItemCardToggle: "選択中のカードの開閉",
      helpItemCardEdit: "選択中の項目（概要・ブロック）を編集",
      helpItemCardMove: "選択中のカードを移動 / マージを実行",
      helpItemCardDelete: "選択中のカードを削除",
      helpItemCardSelectMerge: "マージ対象として選択 / 解除",
      helpItemCardExpandAll: "すべてのブロックを展開 (O)",
      helpItemCardCollapseAll: "すべてのブロックを折りたたむ (C)",
      helpItemModalSave: "保存して閉じる",
      helpItemModalCancel: "保存せずに閉じる",
      markdownPreviewTitle: "📄 Markdownプレビュー",
      copy: "コピー",
      loadingText: "保存中...",
      
      // 追加のUIテキスト (ja)
      addBlockBtn: "ブロックを追加",
      addEntryBtn: "エントリーを追加",
      online: "オンライン",
      openLocalFolder: "ローカルフォルダを開く",
      local: "ローカル",
      openOtherFolder: "別のフォルダを開く",
      sortAsc: "昇順 ↕",
      sortDesc: "降順 ↕",
      noBlocks: "ブロックはありません。",
      mergeCountText: "${count} 件のブロックを選択中",
      blocks: "📝 ブロック",
      sortBlocksTitle: "ブロックの並び順（昇順/降順）",
      
      // 追加のトースト・ダイアログキー (ja)
      favoriteTooltip: "お気に入り（Pickup）に追加/解除 (S)",
      selectTargetCategory: "作成先のカテゴリーを選択してください。",
      warningAddBlockUnsupported: "このエントリーにはブロックを追加できません。",
      selectTargetEntry: "移動先のエントリーを選択してください。",
      markdownCopied: "Markdownをクリップボードにコピーしました。",
      copyFailed: "コピーに失敗しました。手動でコピーしてください。",
      dataReloaded: "最新データをロードしました",
      reloadFailed: "更新に失敗しました：",
      noBlocksSelectedForMerge: "マージ対象のブロックが選択されていません。",
      confirmDeleteSelectedBlocks: "選択された ${count} 個のブロックを削除しますか？\n削除したブロックは元に戻せません。",
      confirmDeleteSelectedBlocksWithChildren: "選択されたブロックの中に、子ブロックを持つものが含まれています。\n削除すると、それらの配下にある子ブロックもすべて一緒に削除されます。\n\n本当に削除しますか？",
      confirmMergeSelectedBlocks: "選択された ${count} 件のブロックを1つにマージしますか？\nマージ後は元の各ブロックの見出しレベルが1段下がり、現在のエントリー内で1つのブロックに統合されます。",
      confirmDeleteBlockId: "このブロック [${id}] を削除しますか？\n削除したブロックは元に戻せません。",
      confirmDeleteBlockWithChildren: "このブロック [${id}] には子ブロックが含まれています。\n削除すると、配下の子ブロックもすべて一緒に削除されます。\n\n本当に削除しますか？",
      autoReloadSuccess: "一定時間操作がなかったため、最新データを自動読み込みしました。",
      allBlocksOpened: "すべてのブロックを展開しました。",
      allBlocksClosed: "すべてのブロックを折りたたみました。"
    },
    en: {
      name: "English",
      selectLanguage: "Select Language",
      selectLanguageLabel: "Please select a language to use:",
      save: "Save",
      cancel: "Cancel",
      openFolder: "Open Folder",
      refresh: "Refresh Data",
      manual: "Open Manual",
      home: "Home",
      newEntryBtn: "New Entry",
      demoMode: "Demo Mode",
      serverMode: "Server Mode",
      localFolder: "Local Folder",
      languageChanged: "Language changed.",
      category: "Category",
      title: "Title",
      all: "All",
      trash: "Trash",
      inbox: "Inbox",
      thinking: "Thinking",
      work: "Work",
      openFolderSuccess: "Folder opened successfully.",
      openFolderFailed: "Failed to open folder: ",
      initialStructureSuccess: "Initial folder structure created.",
      initialStructureFailed: "Failed to create initial structure: ",
      cancelInitialStructure: "Initial structure creation cancelled. No files modified.",
      entryDeleteSuccess: "Entry \"${fileName}\" permanently deleted.",
      entryDeleteFailed: "Failed to delete entry: ",
      entryCreateSuccess: "New entry \"${title}\" created.",
      entryCreateFailed: "Failed to create entry: ",
      entryUpdateSuccess: "Entry saved successfully.",
      entryUpdateFailed: "Failed to save entry: ",
      blockUpdateSuccess: "Block saved successfully.",
      blockUpdateFailed: "Failed to save block: ",
      blockDeleteSuccess: "Block deleted successfully.",
      blockDeleteFailed: "Failed to delete block: ",
      blockMoveSuccess: "Block moved successfully.",
      blockMoveFailed: "Failed to move block: ",
      blockMergeSuccess: "Blocks merged successfully.",
      blockMergeFailed: "Failed to merge blocks: ",
      confirmDeleteEntry: "Are you sure you want to permanently delete entry \"${fileName}\"?\nThis action cannot be undone.",
      confirmDeleteBlock: "Are you sure you want to delete this block?",
      confirmInitialStructure: "Do you want to initialize structure in this directory?\n\ninbox/\n  inbox.md\nthinking/\n  entry-memo-system.md\nwork/\n  work-memo-environment.md",
      warningDemoSave: "Warning: Changes in Demo Mode will be lost upon reloading the browser.",
      newEntryTitle: "New Entry",
      newEntryCategoryLabel: "Category",
      newEntryTitleLabel: "Title",
      newEntryTitlePlaceholder: "Enter entry title...",
      newEntryNewCategoryOption: "+ Create new category and add",
      editEntryTitle: "Edit Entry",
      edit: "Edit",
      editEntryTitleLabel: "Entry Title",
      editEntryTitlePlaceholder: "Enter entry title...",
      editEntryNewCategoryOption: "+ Create new category and move",
      editEntryCategorySelectLabel: "Move to Category",
      editEntryNewCategoryLabel: "New Category Name",
      editEntryNewCategoryPlaceholder: "Enter new category name...",
      addBlockTitle: "Add New Block",
      editBlockTitle: "Edit Block",
      blockTitleLabel: "Block Title (Optional)",
      blockTitlePlaceholder: "Block heading (can be blank)",
      blockBodyLabel: "Block Body",
      blockBodyPlaceholder: "Enter memo contents in Markdown...",
      moveBlockTitle: "Move Block",
      moveBlockTargetLabel: "Destination Entry",
      moveBlockTargetPlaceholder: "Select or search target entry...",
      mergeActionBarTitle: "Selected Blocks",
      mergeActionBarBtn: "Merge",
      mergeActionBarRelocateBtn: "Batch Move",
      mergeActionBarDeleteBtn: "Batch Delete",
      
      // 動的追加キー
      confirmMoveToTrash: "Do you want to relocate entry \"${fileName}\" to the Trash category?",
      warningLocalFolderUnsupported: "Your browser does not support local directory access. Running in Demo Mode.",
      favoriteAdded: "Added to favorites.",
      favoriteRemoved: "Removed from favorites.",
      entryEditSuccessMove: "Relocated entry to \"${category}\" and updated title.",
      entryEditSuccessTitle: "Entry title updated.",
      summary: "Summary",
      summaryTextareaPlaceholder: "Please describe the current conclusion, policy, unresolved matters, etc. in the ${summaryTitle}...",
      viewModeGroup: "By Category ↕",
      viewModeFlat: "Flat (Newest First) ↕",
      noEntries: "No entries registered.",

      // HTML追加翻訳キー (en)
      allEntries: "All Entries",
      newEntryTitle: "Create New Entry",
      newEntryTitleLabel: "Entry Name",
      newEntryTitlePlaceholder: "Enter entry title...",
      newEntryNewCategoryOption: "+ Create a new category and create",
      editEntryCategorySelectLabel: "Move to Category",
      editEntryNewCategoryLabel: "New Category Name",
      editEntryNewCategoryPlaceholder: "Enter new category name...",
      editEntryTitle: "Edit Entry",
      editEntryTitleLabel: "Entry Title",
      editEntryTitlePlaceholder: "Enter entry title...",
      editEntryNewCategoryOption: "+ Create a new category and move",
      move: "Move",
      moveBlockDesc: "Move the following block to another entry.",
      moveNewEntryOption: "+ Create a new entry and move",
      helpTitle: "⌨️ Keyboard Shortcuts",
      helpSectionNavigation: "Navigation",
      helpSectionBasic: "Basic Operations",
      helpSectionCategory: "On Category Entries List View",
      helpSectionCard: "On Card Selected (J/K to Navigate)",
      helpSectionModal: "In Dialog (Modal)",
      helpItemToggleHelp: "Toggle Help Panel",
      helpItemToggleSidebar: "Toggle Sidebar",
      helpItemNavigateEntry: "Navigate Entries",
      helpItemToggleView: "Toggle View Mode",
      helpItemOpenFolder: "Open Memo Directory",
      helpItemNewEntry: "Create New Entry",
      helpItemEditEntry: "Edit Entry",
      helpItemDeleteEntry: "Delete Entry (Move to Trash)",
      helpItemAddBlock: "Open Add Block Dialog (A key when idle)",
      helpItemAddChildBlock: "Add a child block to the selected block (Alt + Enter)",
      helpItemEditSummary: "Edit Summary Section",
      helpItemShowAll: "Show Category Entries List",
      helpItemNavigateCategory: "Navigate Categories / List",
      helpItemCategorySelect: "Select Next/Prev Entry",
      helpItemCategoryOpen: "Open Selected Entry",
      helpItemCategorySwitch: "Switch Category List",
      helpItemCardSelect: "Select Next/Prev Item",
      helpItemCardToggle: "Toggle Expand/Collapse",
      helpItemCardEdit: "Edit Selected Item",
      helpItemCardMove: "Move Card / Execute Merge",
      helpItemCardDelete: "Delete Selected Card",
      helpItemCardSelectMerge: "Select/Deselect for Merge",
      helpItemCardExpandAll: "Expand all blocks (O)",
      helpItemCardCollapseAll: "Collapse all blocks (C)",
      helpItemModalSave: "Save and Close",
      helpItemModalCancel: "Close Without Saving",
      markdownPreviewTitle: "📄 Markdown Preview",
      copy: "Copy",
      loadingText: "Saving...",
      
      // 追加のUIテキスト (en)
      addBlockBtn: "Add Block",
      addEntryBtn: "Add Entry",
      online: "Online",
      openLocalFolder: "Open Local Folder",
      local: "Local",
      openOtherFolder: "Open Another Folder",
      sortAsc: "Ascending ↕",
      sortDesc: "Descending ↕",
      noBlocks: "No blocks available.",
      mergeCountText: "${count} block(s) selected",
      blocks: "📝 Blocks",
      sortBlocksTitle: "Block sort order (Ascending/Descending)",
      
      // 追加のトースト・ダイアログキー (en)
      favoriteTooltip: "Add/Remove from favorites (S)",
      selectTargetCategory: "Please select a destination category.",
      warningAddBlockUnsupported: "Cannot add blocks to this entry.",
      selectTargetEntry: "Please select a destination entry.",
      markdownCopied: "Markdown copied to clipboard.",
      copyFailed: "Copy failed. Please copy manually.",
      dataReloaded: "Latest data loaded.",
      reloadFailed: "Update failed: ",
      noBlocksSelectedForMerge: "No blocks selected for merge.",
      confirmDeleteSelectedBlocks: "Are you sure you want to delete the ${count} selected block(s)?\nThis action cannot be undone.",
      confirmDeleteSelectedBlocksWithChildren: "Some of the selected blocks contain child blocks.\nAll nested child blocks will also be deleted.\n\nAre you sure you want to delete?",
      confirmMergeSelectedBlocks: "Are you sure you want to merge the ${count} selected block(s) into one?\nAfter merging, the heading levels of the original blocks will be lowered by one step and integrated into a single block within the current entry.",
      confirmDeleteBlockId: "Are you sure you want to delete this block [${id}]?\nThis action cannot be undone.",
      confirmDeleteBlockWithChildren: "This block [${id}] contains child blocks.\nAll nested child blocks will also be deleted.\n\nAre you sure you want to delete?",
      autoReloadSuccess: "Data auto-reloaded due to inactivity.",
      allBlocksOpened: "Expanded all blocks.",
      allBlocksClosed: "Collapsed all blocks."
    }
  };

  // 有効な翻訳辞書（カスタム言語のロード前はデフォルト値を使用）
  let activeTranslations = Object.assign({}, DefaultTranslations);

  // デフォルトのキーマップ定義
  const DefaultKeymaps = {
    help: { code: "Slash", shift: true },
    toggleFavorite: { key: ["s", "S"] },
    toggleSidebar: { code: "Backslash", ctrl: true },
    showAllEntries: { code: "KeyH", ctrl: true },
    toggleSwipe: { code: "KeyL", ctrl: true },
    selectAllBlocks: { code: "KeyA", ctrl: true },
    batchDelete: { code: "KeyD", ctrl: true },
    togglePreview: { code: "KeyP", ctrl: true },
    newEntry: { code: "KeyC", ctrl: true },
    openFolder: { code: "KeyO", ctrl: true },
    editEntry: { code: "KeyE", ctrl: true },
    editSummary: { code: "KeyI", ctrl: true },
    navigateCategoryNextCtrl: { code: "KeyJ", ctrl: true },
    navigateCategoryPrevCtrl: { code: "KeyK", ctrl: true },
    navigateEntryNext: { code: "ArrowDown", alt: true },
    navigateEntryPrev: { code: "ArrowUp", alt: true },
    toggleViewBoard: { code: "ArrowLeft", alt: true },
    toggleViewThread: { code: "ArrowRight", alt: true },
    
    // カテゴリー一覧画面
    categoryNavigateNext: { code: "KeyJ" },
    categoryNavigatePrev: { code: "KeyK" },
    categoryOpenEntry: { code: "Enter" },
    categoryDeleteEntry: [
      { code: "KeyD", shift: true },
      { code: "Delete" }
    ],

    // 詳細画面
    cardNavigateNext: { code: "KeyJ" },
    cardNavigatePrev: { code: "KeyK" },
    cardToggleExpand: { code: "Space" },
    cardEdit: [
      { code: "Enter" },
      { code: "KeyE" }
    ],
    cardMoveOrMerge: { code: "KeyM" },
    cardDelete: { code: "KeyD" },
    cardSelectMerge: { code: "KeyX" },
    cardAddBlock: { code: "Enter", ctrl: true },
    deleteEntry: [
      { code: "KeyD", shift: true },
      { code: "Delete" }
    ],
  };

  let activeKeymaps = DefaultKeymaps;

  // キー表示用のHTML表現を生成する
  function getKeyString(mapping) {
    if (!mapping) return "";
    if (Array.isArray(mapping)) {
      return mapping.map(m => getKeyString(m)).join(" / ");
    }
    const parts = [];
    if (mapping.ctrl) parts.push("Ctrl");
    if (mapping.shift) parts.push("Shift");
    if (mapping.alt) parts.push("Alt");
    
    let keyText = "";
    if (mapping.code) {
      keyText = formatKeyCode(mapping.code);
    } else if (mapping.key) {
      keyText = Array.isArray(mapping.key) ? mapping.key[0].toUpperCase() : mapping.key.toUpperCase();
    }
    
    if (keyText) parts.push(keyText);
    return parts.map(p => `<span class="key">${p}</span>`).join(" + ");
  }

  function formatKeyCode(code) {
    if (Array.isArray(code)) {
      return code.map(c => formatKeyCode(c)).join(" / ");
    }
    if (code.startsWith("Key")) {
      return code.substring(3);
    }
    if (code.startsWith("Digit")) {
      return code.substring(5);
    }
    switch (code) {
      case "ArrowUp": return "↑";
      case "ArrowDown": return "↓";
      case "ArrowLeft": return "←";
      case "ArrowRight": return "→";
      case "Backslash": return "\\";
      case "Slash": return "/";
      default: return code;
    }
  }

  // ヘルプパネル内のショートカットキー表示を動的に更新する
  function updateHelpUI() {
    if (!elements.shortcutHelpPanel) return;
    const containers = elements.shortcutHelpPanel.querySelectorAll("[data-key-action]");
    containers.forEach(el => {
      const actionName = el.dataset.keyAction;
      const mapping = activeKeymaps[actionName];
      if (mapping) {
        el.innerHTML = getKeyString(mapping);
      }
    });
  }

  // キー入力イベントとキーマップ設定とのマッチング判定
  function matchKey(e, mapping) {
    if (!mapping) return false;
    if (Array.isArray(mapping)) {
      return mapping.some(m => matchKey(e, m));
    }
    const expectedCtrl = !!mapping.ctrl;
    const actualCtrl = !!(e.ctrlKey || e.metaKey);
    if (expectedCtrl !== actualCtrl) return false;

    const expectedShift = !!mapping.shift;
    const actualShift = !!e.shiftKey;
    if (expectedShift !== actualShift) return false;

    const expectedAlt = !!mapping.alt;
    const actualAlt = !!e.altKey;
    if (expectedAlt !== actualAlt) return false;

    if (mapping.code) {
      const codes = Array.isArray(mapping.code) ? mapping.code : [mapping.code];
      if (codes.includes(e.code)) return true;
    }
    if (mapping.key) {
      const keys = Array.isArray(mapping.key) ? mapping.key : [mapping.key];
      if (keys.includes(e.key)) return true;
    }
    return false;
  }

  function match(e, actionName) {
    return matchKey(e, activeKeymaps[actionName]);
  }

  // 外部カスタマイズキーマップファイルの非同期読み込み
  function initKeymaps() {
    const script = document.createElement("script");
    script.src = "src/keymaps.js";
    script.onload = () => {
      if (window.EntryMemo && window.EntryMemo.Keymaps) {
        activeKeymaps = Object.assign({}, DefaultKeymaps, window.EntryMemo.Keymaps);
        console.log("Custom keymaps loaded successfully from src/keymaps.js");
      }
      updateHelpUI();
    };
    script.onerror = () => {
      // 読み込めない場合はデフォルトのまま
      console.log("Optional custom keymaps (src/keymaps.js) not found. Using default keymaps.");
      updateHelpUI();
    };
    document.head.appendChild(script);
  }

  // 外部カスタマイズ言語ファイルの非同期読み込み
  function initLangs(callback) {
    const script = document.createElement("script");
    script.src = "src/langs.js";
    script.onload = () => {
      if (window.EntryMemo && window.EntryMemo.Languages) {
        activeTranslations = Object.assign({}, DefaultTranslations, window.EntryMemo.Languages);
        console.log("Custom languages loaded successfully from src/langs.js");
      }
      if (callback) callback();
    };
    script.onerror = () => {
      console.log("Optional custom languages (src/langs.js) not found. Using default languages.");
      if (callback) callback();
    };
    document.head.appendChild(script);
  }

  function initLanguage() {
    const savedLang = localStorage.getItem("EntryMemo.language");
    if (savedLang) {
      currentLanguage = savedLang;
    } else {
      const browserLang = (navigator.language || navigator.userLanguage || "ja").toLowerCase();
      if (browserLang.startsWith("en")) {
        currentLanguage = "en";
      } else {
        currentLanguage = "ja";
      }
    }
  }

  function t(key, fallback = "") {
    const lang = currentLanguage;
    const dict = activeTranslations[lang] || activeTranslations["ja"];
    
    // カテゴリー名などの日本語文字列を英語辞書のキーにマッピングするエイリアス処理
    let searchKey = key;
    if (lang !== "ja") {
      if (key === "すべてのエントリー") searchKey = "allEntries";
      else if (key === "ゴミ箱") searchKey = "trash";
      else if (key === "インボックス") searchKey = "inbox";
      else if (key === "思考") searchKey = "thinking";
      else if (key === "作業") searchKey = "work";
    }
    
    return dict[searchKey] || fallback || key;
  }

  function updateLanguageUI() {
    const lang = currentLanguage;
    const dict = activeTranslations[lang] || activeTranslations["ja"];
    
    // data-i18n
    const i18nElements = document.querySelectorAll("[data-i18n]");
    i18nElements.forEach(el => {
      const key = el.dataset.i18n;
      if (dict[key]) {
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
          el.placeholder = dict[key];
        } else {
          el.textContent = dict[key];
        }
      }
    });

    // data-i18n-title
    const titleElements = document.querySelectorAll("[data-i18n-title]");
    titleElements.forEach(el => {
      const key = el.dataset.i18nTitle;
      if (dict[key]) {
        el.title = dict[key];
      }
    });

    document.documentElement.lang = lang;
  }

  function openLanguageModal() {
    const listContainer = document.getElementById("language-options-list");
    if (!listContainer) return;
    
    listContainer.innerHTML = "";
    
    const availableLangs = Object.keys(activeTranslations);
    availableLangs.forEach(langCode => {
      const langName = activeTranslations[langCode].name || langCode;
      
      const optionRow = document.createElement("label");
      optionRow.style.display = "flex";
      optionRow.style.alignItems = "center";
      optionRow.style.gap = "8px";
      optionRow.style.cursor = "pointer";
      optionRow.style.padding = "6px 0";
      
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "lang-selection";
      radio.value = langCode;
      radio.checked = (langCode === currentLanguage);
      
      const labelText = document.createTextNode(langName);
      
      optionRow.appendChild(radio);
      optionRow.appendChild(labelText);
      listContainer.appendChild(optionRow);
    });
    
    openModal(document.getElementById("language-modal"));
  }

  function saveLanguageSelection() {
    const listContainer = document.getElementById("language-options-list");
    if (!listContainer) return;
    
    const checkedRadio = listContainer.querySelector("input[name='lang-selection']:checked");
    if (checkedRadio) {
      const newLang = checkedRadio.value;
      if (newLang !== currentLanguage) {
        currentLanguage = newLang;
        localStorage.setItem("EntryMemo.language", newLang);
        updateLanguageUI();
        showToast(t("languageChanged", "Language changed."), "success");
        if (window.EntryMemo.App && typeof window.EntryMemo.App.refreshCurrentView === "function") {
          window.EntryMemo.App.refreshCurrentView();
        }
      }
    }
    closeModal(document.getElementById("language-modal"));
  }

  /**
   * UIの初期化
   */
  function init() {
    initKeymaps();
    elements = {
      appContainer: document.getElementById("app-container"),
      mainContent: document.getElementById("main-content"),

      // ヘルプパネル
      shortcutHelpPanel: document.getElementById("shortcut-help-panel"),
      closeHelpBtn: document.getElementById("close-help-btn"),
      helpPanelOverlay: document.getElementById("help-panel-overlay"),

      // マージ拡張
      mergeActionBar: document.getElementById("merge-action-bar"),
      mergeCountText: document.getElementById("merge-count-text"),
      mergeSubmitBtn: document.getElementById("merge-submit-btn"),
      mergeCancelBtn: document.getElementById("merge-cancel-btn"),

      // 新ビューおよび拡張
      entryDetailView: document.getElementById("entry-detail-view"),
      categoryEntriesView: document.getElementById("category-entries-view"),
      categoryViewTitle: document.getElementById("category-view-title"),
      categoryEntriesList: document.getElementById("category-entries-list"),
      favoriteToggleBtn: document.getElementById("favorite-toggle-btn"),
      
      // 共通ヘッダーのアクションボタン
      headerHelpBtn: document.getElementById("header-help-btn"),
      headerRefreshBtn: document.getElementById("header-refresh-btn"),
      headerHomeBtn: document.getElementById("header-home-btn"),
      headerNewEntryBtn: document.getElementById("header-new-entry-btn"),
      toggleEntryListModeBtn: document.getElementById("toggle-entry-list-mode-btn"),
      
      entryMarkdownViewBtn: document.getElementById("entry-markdown-view-btn"),
      sortBlocksBtn: document.getElementById("sort-blocks-btn"),
      
      // Markdownプレビューパネル
      markdownPreviewPanel: document.getElementById("markdown-preview-panel"),
      markdownCopyBtn: document.getElementById("markdown-copy-btn"),
      markdownPreviewCloseBtn: document.getElementById("markdown-preview-close-btn"),
      markdownPreviewOverlay: document.getElementById("markdown-preview-overlay"),
      markdownPreviewTextarea: document.getElementById("markdown-preview-textarea"),

      // エントリーヘッダー
      currentEntryTitle: document.getElementById("current-entry-title"),
      entryErrorBanner: document.getElementById("entry-error-banner"),
      entryErrorList: document.getElementById("entry-error-list"),
      
      // 概要セクション
      summarySection: document.getElementById("summary-section"),
      summaryDisplayArea: document.getElementById("summary-display-area"),
      summaryText: document.getElementById("summary-text"),
      summaryEditBtn: document.getElementById("summary-edit-btn"),
      summaryEditorArea: document.getElementById("summary-editor-area"),
      summaryTitleInput: document.getElementById("summary-title-input"),
      summaryTextarea: document.getElementById("summary-textarea"),
      summarySaveBtn: document.getElementById("summary-save-btn"),
      summaryCancelBtn: document.getElementById("summary-cancel-btn"),
      
      // ブロック一覧
      blocksList: document.getElementById("blocks-list"),
      addBlockBtnTop: document.getElementById("add-block-btn-top"),
      addEntryBtnFab: document.getElementById("add-entry-btn-fab"),
      
      // モーダル
      modalOverlay: document.getElementById("modal-overlay"),
      
      // ブロック追加・編集モーダル
      blockModal: document.getElementById("block-modal"),
      blockModalTitle: document.getElementById("block-modal-title"),
      blockInputTitle: document.getElementById("block-input-title"),
      blockInputBody: document.getElementById("block-input-body"),
      blockModalSaveBtn: document.getElementById("block-modal-save-btn"),
      blockModalCancelBtn: document.getElementById("block-modal-cancel-btn"),
      
      // 移動モーダル
      moveModal: document.getElementById("move-modal"),
      moveSourceInfo: document.getElementById("move-source-info"),
      moveTargetCategory: document.getElementById("move-target-category"),
      moveTargetEntry: document.getElementById("move-target-entry"),
      moveTargetParentBlock: document.getElementById("move-target-parent-block"),
      moveNewEntryOption: document.getElementById("move-new-entry-option"),
      moveNewEntryForm: document.getElementById("move-new-entry-form"),
      moveNewEntryCategory: document.getElementById("move-new-entry-category"),
      moveNewEntryName: document.getElementById("move-new-entry-name"),
      moveModalSubmitBtn: document.getElementById("move-modal-submit-btn"),
      moveModalCancelBtn: document.getElementById("move-modal-cancel-btn"),
      
      // エントリー新規作成モーダル
      newEntryModal: document.getElementById("new-entry-modal"),
      newEntryNewCategoryOption: document.getElementById("new-entry-new-category-option"),
      newEntryExistingCategoryForm: document.getElementById("new-entry-existing-category-form"),
      newEntryCategorySelect: document.getElementById("new-entry-category-select"),
      newEntryNewCategoryForm: document.getElementById("new-entry-new-category-form"),
      newEntryNewCategoryInput: document.getElementById("new-entry-new-category-input"),
      newEntryNameInput: document.getElementById("new-entry-name-input"),
      newEntryCreateBtn: document.getElementById("new-entry-create-btn"),
      newEntryCancelBtn: document.getElementById("new-entry-cancel-btn"),
      
      // エントリー編集・削除
      entryEditBtn: document.getElementById("entry-edit-btn"),
      entryDeleteBtn: document.getElementById("entry-delete-btn"),
      editEntryModal: document.getElementById("edit-entry-modal"),
      editEntryNameInput: document.getElementById("edit-entry-name-input"),
      editEntryNewCategoryOption: document.getElementById("edit-entry-new-category-option"),
      editEntryExistingCategoryForm: document.getElementById("edit-entry-existing-category-form"),
      editEntryCategorySelect: document.getElementById("edit-entry-category-select"),
      editEntryNewCategoryForm: document.getElementById("edit-entry-new-category-form"),
      editEntryNewCategoryInput: document.getElementById("edit-entry-new-category-input"),
      editEntrySaveBtn: document.getElementById("edit-entry-save-btn"),
      editEntryCancelBtn: document.getElementById("edit-entry-cancel-btn"),
      
      // ストレージ関連
      openFolderBtn: document.getElementById("open-folder-btn"),
      currentModeBadge: document.getElementById("current-mode-badge"),
      toastContainer: document.getElementById("toast-container"),
      loadingOverlay: document.getElementById("loading-overlay"),

      // 言語設定関連
      headerLangBtn: document.getElementById("header-lang-btn"),
      languageModal: document.getElementById("language-modal"),
      languageSaveBtn: document.getElementById("language-save-btn"),
      languageCancelBtn: document.getElementById("language-cancel-btn"),
      languageOptionsList: document.getElementById("language-options-list")
    };

    // expandedBlockIdsの初期読み込み
    try {
      const saved = localStorage.getItem("EntryMemo.expandedBlocks");
      if (saved) {
        expandedBlockIds = new Set(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load expandedBlocks", e);
    }

    // 言語設定の初期化
    initLanguage();
    initLangs(() => {
      updateLanguageUI();
    });

    updateHelpUI();
    setupEventListeners();
    updateSortBlocksBtnText();
  }

  function setFocusedBlockId(blockId) {
    lastFocusedBlockId = blockId;
  }

  /**
   * トースト通知を表示する
   */
  function showToast(message, type = "success") {
    if (!elements.toastContainer) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add("fade-out");
      toast.addEventListener("transitionend", () => {
        toast.remove();
      });
    }, 4000);
  }

  /**
   * ローディング表示を開始する
   */
  function showLoading(message = "処理中...") {
    if (!elements.loadingOverlay) return;
    const textEl = elements.loadingOverlay.querySelector(".loading-text");
    if (textEl) textEl.textContent = message;
    elements.loadingOverlay.style.display = "flex";
  }

  /**
   * ローディング表示を終了する
   */
  function hideLoading() {
    if (!elements.loadingOverlay) return;
    elements.loadingOverlay.style.display = "none";
  }

  /**
   * タイトルやカテゴリー名のバリデーションを行う
   * @param {string} value 検証する文字列
   * @param {string} fieldName フィールド名（"エントリー名" など、メッセージ用）
   * @param {number} maxLength 最大文字数
   * @returns {string|null} エラーメッセージ（問題なければ null）
   */
  function validateName(value, fieldName, maxLength = 255) {
    const trimmed = (value || "").trim();
    if (!trimmed) {
      return `${fieldName}を入力してください。`;
    }
    if (trimmed.length > maxLength) {
      return `${fieldName}は${maxLength}文字以内で入力してください。`;
    }
    // Windows禁則文字 \ / : * ? " < > |
    const invalidChars = /[\\/:*?"<>|]/;
    if (invalidChars.test(trimmed)) {
      return `${fieldName}に使用できない文字が含まれています。次の文字は使用できません: \\ / : * ? " < > |`;
    }
    return null;
  }

  /**
   * ヘルプパネルのトグル
   */
  function toggleHelpPanel() {
    const isOpen = elements.shortcutHelpPanel.classList.contains("open");
    if (isOpen) {
      closeHelpPanel();
    } else {
      elements.shortcutHelpPanel.classList.add("open");
      elements.helpPanelOverlay.classList.add("open");
    }
  }

  /**
   * ヘルプパネルを閉じる
   */
  function closeHelpPanel() {
    elements.shortcutHelpPanel.classList.remove("open");
    elements.helpPanelOverlay.classList.remove("open");
  }

  /**
   * Markdownプレビューパネルを開く
   */
  function openMarkdownPreviewPanel(markdownText) {
    if (!elements.markdownPreviewPanel) return;
    elements.markdownPreviewTextarea.value = markdownText;
    elements.markdownPreviewPanel.classList.add("open");
    elements.markdownPreviewOverlay.classList.add("open");
  }

  /**
   * Markdownプレビューパネルを閉じる
   */
  function closeMarkdownPreviewPanel() {
    if (!elements.markdownPreviewPanel) return;
    elements.markdownPreviewPanel.classList.remove("open");
    elements.markdownPreviewOverlay.classList.remove("open");
  }

  /**
   * テキストエリアの高さを自動調節する
   */
  function adjustTextareaHeight(textarea) {
    if (!textarea) return;
    textarea.style.height = "auto";
    const innerHeight = (typeof window.innerHeight === "number" && !isNaN(window.innerHeight)) ? window.innerHeight : 800;
    let limitHeight = Math.max(150, Math.min(300, innerHeight * 0.3));
    if (isNaN(limitHeight) || !isFinite(limitHeight)) {
      limitHeight = 250;
    }
    
    if (textarea.scrollHeight > limitHeight) {
      textarea.style.height = limitHeight + "px";
      textarea.style.overflowY = "auto";
    } else {
      textarea.style.height = textarea.scrollHeight + "px";
      textarea.style.overflowY = "hidden";
    }
  }

  /**
   * モーダルを開く
   */
  function openModal(modalElement) {
    elements.modalOverlay.style.display = "block";
    modalElement.style.display = "block";
  }

  /**
   * すべてのモーダルを閉じる
   */
  function closeModal() {
    blockModalEnterCount = 0;
    elements.modalOverlay.style.display = "none";
    elements.blockModal.style.display = "none";
    elements.moveModal.style.display = "none";
    elements.newEntryModal.style.display = "none";
    if (elements.editEntryModal) {
      elements.editEntryModal.style.display = "none";
    }
    if (elements.languageModal) {
      elements.languageModal.style.display = "none";
    }
    closeHelpPanel();
    closeMarkdownPreviewPanel();
    
    // フォームリセット
    elements.blockInputTitle.value = "";
    elements.blockInputBody.value = "";
    elements.blockInputBody.style.height = "auto";
    elements.moveNewEntryOption.checked = false;
    elements.moveNewEntryForm.style.display = "none";
    elements.moveNewEntryName.value = "";
    elements.newEntryNameInput.value = "";
    if (elements.editEntryNameInput) elements.editEntryNameInput.value = "";
    if (elements.editEntryNewCategoryOption) elements.editEntryNewCategoryOption.checked = false;
    if (elements.editEntryNewCategoryForm) elements.editEntryNewCategoryForm.style.display = "none";
    if (elements.editEntryExistingCategoryForm) elements.editEntryExistingCategoryForm.style.display = "block";
    if (elements.editEntryNewCategoryInput) elements.editEntryNewCategoryInput.value = "";
  }

  /**
   * イベントリスナーのセットアップ
   */
  function setupEventListeners() {
    // 言語切り替えボタンとモーダル操作
    if (elements.headerLangBtn) {
      elements.headerLangBtn.addEventListener("click", openLanguageModal);
    }
    if (elements.languageSaveBtn) {
      elements.languageSaveBtn.addEventListener("click", saveLanguageSelection);
    }
    if (elements.languageCancelBtn) {
      elements.languageCancelBtn.addEventListener("click", () => {
        closeModal(elements.languageModal);
      });
    }

    // フォルダ選択
    elements.openFolderBtn.addEventListener("click", () => {
      window.EntryMemo.App.handleOpenFolder();
    });

    // ブロックソート順切り替え
    if (elements.sortBlocksBtn) {
      elements.sortBlocksBtn.addEventListener("click", () => {
        currentSortOrder = currentSortOrder === "asc" ? "desc" : "asc";
        localStorage.setItem("EntryMemo.sortOrder", currentSortOrder);
        updateSortBlocksBtnText();
        const currentEntry = window.EntryMemo.App.getCurrentEntry();
        if (currentEntry) {
          renderBlocksList(currentEntry.blocks, currentEntry.hasError);
        }
      });
    }

    // Markdownプレビューの表示
    if (elements.entryMarkdownViewBtn) {
      elements.entryMarkdownViewBtn.addEventListener("click", () => {
        const currentEntry = window.EntryMemo.App.getCurrentEntry();
        if (currentEntry) {
          window.EntryMemo.App.handleShowMarkdownPreview(currentEntry.categoryName, currentEntry.fileName);
        }
      });
    }

    // 新規エントリー（共通ヘッダーボタン）
    if (elements.headerNewEntryBtn) {
      elements.headerNewEntryBtn.addEventListener("click", () => {
        openNewEntryModal();
      });
    }

    // ヘルプ（共通ヘッダーボタン - ヘルプパネルの開閉）
    if (elements.headerHelpBtn) {
      elements.headerHelpBtn.addEventListener("click", () => {
        toggleHelpPanel();
      });
    }

    // ホーム（共通ヘッダーボタン）
    if (elements.headerHomeBtn) {
      elements.headerHomeBtn.addEventListener("click", async () => {
        await window.EntryMemo.App.showAllEntriesListView();
      });
    }

    // エントリー一覧表示モード切り替えボタン
    if (elements.toggleEntryListModeBtn) {
      elements.toggleEntryListModeBtn.addEventListener("click", async () => {
        currentEntryListViewMode = currentEntryListViewMode === "group" ? "flat" : "group";
        localStorage.setItem("EntryMemo.entryListViewMode", currentEntryListViewMode);
        
        const activeCategory = window.EntryMemo.App.getActiveCategory();
        if (activeCategory === "すべてのエントリー") {
          await window.EntryMemo.App.showAllEntriesListView();
        } else if (activeCategory) {
          await window.EntryMemo.App.handleSelectCategory(activeCategory);
        }
      });
    }

    // 新規エントリー作成モーダルでの新規カテゴリー切り替えトグル
    elements.newEntryNewCategoryOption.addEventListener("change", (e) => {
      if (e.target.checked) {
        elements.newEntryExistingCategoryForm.style.display = "none";
        elements.newEntryNewCategoryForm.style.display = "block";
        setTimeout(() => elements.newEntryNewCategoryInput.focus(), 50);
      } else {
        elements.newEntryExistingCategoryForm.style.display = "block";
        elements.newEntryNewCategoryForm.style.display = "none";
      }
    });

    // 新規エントリー作成キャンセル
    elements.newEntryCancelBtn.addEventListener("click", closeModal);

    // 新規エントリー作成実行
    elements.newEntryCreateBtn.addEventListener("click", async () => {
      const title = elements.newEntryNameInput.value.trim();
      const titleError = validateName(title, "エントリー名");
      if (titleError) {
        showToast(titleError, "warning");
        return;
      }

      let category = "";
      if (elements.newEntryNewCategoryOption.checked) {
        category = elements.newEntryNewCategoryInput.value.trim();
        const categoryError = validateName(category, "カテゴリー名");
        if (categoryError) {
          showToast(categoryError, "warning");
          return;
        }
      } else {
        category = elements.newEntryCategorySelect.value;
        if (!category) {
          showToast(t("selectTargetCategory", "作成先のカテゴリーを選択してください。"), "warning");
          return;
        }
      }

      elements.newEntryCreateBtn.disabled = true;
      elements.newEntryCancelBtn.disabled = true;
      showLoading(t("entryCreateLoading", "エントリーを作成中..."));
      try {
        const success = await window.EntryMemo.App.handleCreateEntry(category, title);
        if (success) {
          closeModal();
        }
      } catch (e) {
        console.error("Error during handleCreateEntry in UI:", e);
        showToast(`${t("entryCreateFailed", "エントリーの作成に失敗しました：")}${e.message}`, "error");
      } finally {
        hideLoading();
        elements.newEntryCreateBtn.disabled = false;
        elements.newEntryCancelBtn.disabled = false;
      }
    });

    // 概要の編集開始
    elements.summaryEditBtn.addEventListener("click", () => {
      const currentEntry = window.EntryMemo.App.getCurrentEntry();
      if (!currentEntry || currentEntry.hasError) return;
      
      if (elements.summaryTitleInput) {
        elements.summaryTitleInput.value = currentEntry.summaryTitle || "概要";
      }
      elements.summaryTextarea.value = currentEntry.summary || "";
      elements.summaryDisplayArea.style.display = "none";
      elements.summaryEditorArea.style.display = "block";
      setTimeout(() => adjustTextareaHeight(elements.summaryTextarea), 0);
    });

    // 概要の編集キャンセル
    elements.summaryCancelBtn.addEventListener("click", () => {
      elements.summaryDisplayArea.style.display = "block";
      elements.summaryEditorArea.style.display = "none";
      elements.summaryTextarea.style.height = "auto";
    });

    // 概要の編集保存
    elements.summarySaveBtn.addEventListener("click", async () => {
      const newTitle = elements.summaryTitleInput ? elements.summaryTitleInput.value.trim() : "概要";
      const titleError = validateName(newTitle, "項目タイトル", 50);
      if (titleError) {
        showToast(titleError, "warning");
        return;
      }
      const newValue = elements.summaryTextarea.value;
      
      elements.summarySaveBtn.disabled = true;
      elements.summaryCancelBtn.disabled = true;
      showLoading(t("savingSummary", "概要を保存中..."));
      try {
        const success = await window.EntryMemo.App.handleSaveSummary(newTitle, newValue);
        if (success) {
          elements.summaryDisplayArea.style.display = "block";
          elements.summaryEditorArea.style.display = "none";
          elements.summaryTextarea.style.height = "auto";
        }
      } catch (err) {
        // エラー時はモーダルを閉じない
      } finally {
        hideLoading();
        elements.summarySaveBtn.disabled = false;
        elements.summaryCancelBtn.disabled = false;
      }
    });

    // テキストエリア自動高さ調整リスナー
    elements.summaryTextarea.addEventListener("input", (e) => {
      adjustTextareaHeight(e.target);
    });
    elements.blockInputBody.addEventListener("input", (e) => {
      adjustTextareaHeight(e.target);
    });

    // ブロック追加ボタン
    let isAddBlockLongPressed = false;
    let addBlockLongPressTimer = null;

    const handleLongPressAction = async () => {
      showLoading("inboxを開いています...");
      try {
        await window.EntryMemo.App.handleSelectEntry("inbox", "inbox.md");
        openBlockModal(null);
      } catch (err) {
        console.error(err);
        showToast("inboxの切り替えに失敗しました", "error");
      } finally {
        hideLoading();
      }
    };

    const startAddBlockLongPress = () => {
      if (!window.EntryMemo.App.isFavorite("inbox", "inbox.md")) return;
      isAddBlockLongPressed = false;
      addBlockLongPressTimer = setTimeout(() => {
        isAddBlockLongPressed = true;
        handleLongPressAction();
      }, 1000);
    };

    const cancelAddBlockLongPress = () => {
      if (addBlockLongPressTimer) {
        clearTimeout(addBlockLongPressTimer);
        addBlockLongPressTimer = null;
      }
    };

    elements.addBlockBtnTop.addEventListener("mousedown", startAddBlockLongPress);
    elements.addBlockBtnTop.addEventListener("touchstart", startAddBlockLongPress, { passive: true });
    elements.addBlockBtnTop.addEventListener("mouseup", cancelAddBlockLongPress);
    elements.addBlockBtnTop.addEventListener("mouseleave", cancelAddBlockLongPress);
    elements.addBlockBtnTop.addEventListener("touchend", cancelAddBlockLongPress);
    elements.addBlockBtnTop.addEventListener("touchcancel", cancelAddBlockLongPress);
    elements.addBlockBtnTop.addEventListener("touchmove", cancelAddBlockLongPress);

    const triggerAddBlock = () => {
      const currentEntry = window.EntryMemo.App.getCurrentEntry();
      if (!currentEntry || currentEntry.hasError) {
        showToast(t("warningAddBlockUnsupported", "このエントリーにはブロックを追加できません。"), "warning");
        return;
      }
      openBlockModal(null);
    };

    const triggerAddChildBlock = () => {
      const currentEntry = window.EntryMemo.App.getCurrentEntry();
      if (!currentEntry || currentEntry.hasError) {
        showToast(t("warningAddBlockUnsupported", "このエントリーにはブロックを追加できません。"), "warning");
        return;
      }

      const cards = elements.blocksList.querySelectorAll(".block-card");
      if (focusedBlockIndex >= 1 && focusedBlockIndex <= cards.length) {
        const displayBlocks = getDisplayBlocks(currentEntry.blocks, currentSortOrder);
        const parentBlock = displayBlocks[focusedBlockIndex - 1];

        if (parentBlock) {
          if ((parentBlock.level || 3) >= 6) {
            showToast(t("cannotAddChildToLevel6", "見出し6の下には子ブロックを追加できません。"), "warning");
            return;
          }
          openBlockModal(null, parentBlock);
        }
      } else {
        showToast(t("selectBlockToAddChild", "子ブロックを追加するには、対象のブロックを選択してください。"), "warning");
      }
    };

    elements.addBlockBtnTop.addEventListener("click", (e) => {
      if (isAddBlockLongPressed) {
        e.preventDefault();
        e.stopPropagation();
        isAddBlockLongPressed = false;
        return;
      }
      triggerAddBlock();
    });

    // エントリー追加ボタン
    let isAddEntryLongPressed = false;
    let addEntryLongPressTimer = null;

    const startAddEntryLongPress = () => {
      if (!window.EntryMemo.App.isFavorite("inbox", "inbox.md")) return;
      isAddEntryLongPressed = false;
      addEntryLongPressTimer = setTimeout(() => {
        isAddEntryLongPressed = true;
        handleLongPressAction();
      }, 1000);
    };

    const cancelAddEntryLongPress = () => {
      if (addEntryLongPressTimer) {
        clearTimeout(addEntryLongPressTimer);
        addEntryLongPressTimer = null;
      }
    };

    if (elements.addEntryBtnFab) {
      elements.addEntryBtnFab.addEventListener("mousedown", startAddEntryLongPress);
      elements.addEntryBtnFab.addEventListener("touchstart", startAddEntryLongPress, { passive: true });
      elements.addEntryBtnFab.addEventListener("mouseup", cancelAddEntryLongPress);
      elements.addEntryBtnFab.addEventListener("mouseleave", cancelAddEntryLongPress);
      elements.addEntryBtnFab.addEventListener("touchend", cancelAddEntryLongPress);
      elements.addEntryBtnFab.addEventListener("touchcancel", cancelAddEntryLongPress);
      elements.addEntryBtnFab.addEventListener("touchmove", cancelAddEntryLongPress);

      elements.addEntryBtnFab.addEventListener("click", (e) => {
        if (isAddEntryLongPressed) {
          e.preventDefault();
          e.stopPropagation();
          isAddEntryLongPressed = false;
          return;
        }
        openNewEntryModal();
      });
    }

    // エントリーの削除
    elements.entryDeleteBtn.addEventListener("click", () => {
      const currentEntry = window.EntryMemo.App.getCurrentEntry();
      if (currentEntry) {
        window.EntryMemo.App.handleDeleteEntry(currentEntry.categoryName, currentEntry.fileName);
      }
    });

    // エントリーの編集モーダルを開く
    elements.entryEditBtn.addEventListener("click", () => {
      openEditEntryModal();
    });

    // エントリー編集キャンセル
    elements.editEntryCancelBtn.addEventListener("click", closeModal);

    // エントリー編集の新規カテゴリー作成オプション切り替え
    elements.editEntryNewCategoryOption.addEventListener("change", (e) => {
      if (e.target.checked) {
        elements.editEntryExistingCategoryForm.style.display = "none";
        elements.editEntryNewCategoryForm.style.display = "block";
      } else {
        elements.editEntryExistingCategoryForm.style.display = "block";
        elements.editEntryNewCategoryForm.style.display = "none";
      }
    });

    // エントリー編集の保存実行
    elements.editEntrySaveBtn.addEventListener("click", async () => {
      const currentEntry = window.EntryMemo.App.getCurrentEntry();
      if (!currentEntry) return;

      const newTitle = elements.editEntryNameInput.value.trim();
      const titleError = validateName(newTitle, "エントリータイトル");
      if (titleError) {
        showToast(titleError, "warning");
        return;
      }

      let targetCategory = "";
      if (elements.editEntryNewCategoryOption.checked) {
        targetCategory = elements.editEntryNewCategoryInput.value.trim();
        const categoryError = validateName(targetCategory, "カテゴリー名");
        if (categoryError) {
          showToast(categoryError, "warning");
          return;
        }
      } else {
        targetCategory = elements.editEntryCategorySelect.value;
      }

      elements.editEntrySaveBtn.disabled = true;
      elements.editEntryCancelBtn.disabled = true;
      showLoading(t("savingEntry", "エントリーを保存中..."));
      try {
        const success = await window.EntryMemo.App.handleEditEntry(
          currentEntry.categoryName, 
          currentEntry.fileName, 
          targetCategory, 
          newTitle
        );
        if (success) {
          closeModal();
        }
      } catch (e) {
        console.error("Error during handleEditEntry in UI:", e);
        showToast(`${t("entryUpdateFailed", "エントリーの保存に失敗しました：")}${e.message}`, "error");
      } finally {
        hideLoading();
        elements.editEntrySaveBtn.disabled = false;
        elements.editEntryCancelBtn.disabled = false;
      }
    });

    // ブロック保存ボタン（モーダル内）
    elements.blockModalSaveBtn.addEventListener("click", async () => {
      const title = elements.blockInputTitle.value.trim();
      const body = elements.blockInputBody.value;
      const editingBlockId = elements.blockModal.dataset.editingBlockId;
      
      if (!editingBlockId && !title && !body.trim()) {
        closeModal();
        return;
      }
      
      elements.blockModalSaveBtn.disabled = true;
      elements.blockModalCancelBtn.disabled = true;
      showLoading("ブロックを保存中...");
      try {
        if (editingBlockId) {
          await window.EntryMemo.App.handleUpdateBlock(editingBlockId, title, body);
        } else {
          const parentBlockId = elements.blockModal.dataset.parentBlockId;
          await window.EntryMemo.App.handleCreateBlock(title, body, parentBlockId);
          if (parentBlockId) {
            expandedBlockIds.add(parentBlockId);
            
            const currentEntry = window.EntryMemo.App.getCurrentEntry();
            if (currentEntry) {
              const blocks = currentEntry.blocks;
              let parentIdx = blocks.findIndex(b => b.id === parentBlockId);
              if (parentIdx !== -1) {
                let currentLevel = blocks[parentIdx].level || 3;
                for (let i = parentIdx - 1; i >= 0; i--) {
                  const block = blocks[i];
                  const blockLevel = block.level || 3;
                  if (blockLevel < currentLevel) {
                    expandedBlockIds.add(block.id);
                    currentLevel = blockLevel;
                    if (currentLevel <= 3) {
                      break;
                    }
                  }
                }
              }
              localStorage.setItem("EntryMemo.expandedBlocks", JSON.stringify(Array.from(expandedBlockIds)));
              renderBlocksList(currentEntry.blocks, currentEntry.hasError);
            }
          }
        }
        closeModal();
      } catch (e) {
        // エラー時はモーダルを閉じない
      } finally {
        hideLoading();
        elements.blockModalSaveBtn.disabled = false;
        elements.blockModalCancelBtn.disabled = false;
      }
    });

    // ブロックモーダルキャンセル
    elements.blockModalCancelBtn.addEventListener("click", closeModal);

    // 移動モーダル：「新エントリーに移動する」チェックボックスの変更監視
    elements.moveNewEntryOption.addEventListener("change", (e) => {
      if (e.target.checked) {
        elements.moveNewEntryForm.style.display = "block";
      } else {
        elements.moveNewEntryForm.style.display = "none";
      }
    });

    // 移動先のカテゴリーが選択されたら、そのカテゴリーのエントリー一覧とブロック一覧をプルダウンに反映する
    elements.moveTargetCategory.addEventListener("change", async (e) => {
      const selectedFile = await updateMoveModalEntries(e.target.value);
      const blockId = elements.moveModal.dataset.blockId;
      await updateMoveModalBlocks(e.target.value, selectedFile, blockId);
    });

    // 移動先のエントリーが選択されたら、そのエントリーのブロック一覧をプルダウンに反映する
    elements.moveTargetEntry.addEventListener("change", async (e) => {
      const blockId = elements.moveModal.dataset.blockId;
      await updateMoveModalBlocks(elements.moveTargetCategory.value, e.target.value, blockId);
    });

    // 移動モーダル実行
    elements.moveModalSubmitBtn.addEventListener("click", async () => {
      const blockId = elements.moveModal.dataset.blockId;
      if (!blockId) return;

      const isNewEntry = elements.moveNewEntryOption.checked;
      
      elements.moveModalSubmitBtn.disabled = true;
      elements.moveModalCancelBtn.disabled = true;
      try {
        if (isNewEntry) {
          const category = elements.moveNewEntryCategory.value;
          let entryName = elements.moveNewEntryName.value.trim();
          if (!entryName) {
            const currentEntry = window.EntryMemo.App.getCurrentEntry();
            const sourceBlock = currentEntry ? currentEntry.blocks.find(r => r.id === blockId) : null;
            entryName = sourceBlock ? sourceBlock.title : "無題のエントリー";
          }
          const titleError = validateName(entryName, "エントリー名");
          if (titleError) {
            showToast(titleError, "warning");
            return;
          }
          
          showLoading(t("movingBlock", "ブロックを移動中..."));
          await window.EntryMemo.App.handleMoveBlockToNewEntry(blockId, category, entryName);
          closeModal();
          elements.moveNewEntryName.value = "";
        } else {
          const category = elements.moveTargetCategory.value;
          const fileName = elements.moveTargetEntry.value;
          const targetParentBlockId = elements.moveTargetParentBlock.value || null;
          if (!fileName) {
            showToast(t("selectTargetEntry", "移動先のエントリーを選択してください。"), "warning");
            return;
          }
          showLoading(t("movingBlock", "ブロックを移動中..."));
          await window.EntryMemo.App.handleMoveBlock(blockId, category, fileName, targetParentBlockId);
          closeModal();
        }
      } catch (e) {
        // エラー時はモーダルを閉じない
      } finally {
        hideLoading();
        elements.moveModalSubmitBtn.disabled = false;
        elements.moveModalCancelBtn.disabled = false;
      }
    });

    // 移動モーダルキャンセル
    elements.moveModalCancelBtn.addEventListener("click", closeModal);

    // 背景クリックでモーダルを閉じる
    elements.modalOverlay.addEventListener("click", closeModal);

    // お気に入りトグルボタン
    elements.favoriteToggleBtn.addEventListener("click", () => {
      const currentEntry = window.EntryMemo.App.getCurrentEntry();
      if (currentEntry) {
        const isTrash = currentEntry.categoryName === "ゴミ箱" || currentEntry.categoryName === "trash";
        if (isTrash) return;
        window.EntryMemo.App.handleToggleFavorite(currentEntry.categoryName, currentEntry.fileName);
      }
    });

    // ヘルプパネル関連
    elements.closeHelpBtn.addEventListener("click", closeHelpPanel);
    elements.helpPanelOverlay.addEventListener("click", closeHelpPanel);

    // Markdownプレビュー関連
    if (elements.markdownPreviewCloseBtn) {
      elements.markdownPreviewCloseBtn.addEventListener("click", closeMarkdownPreviewPanel);
    }
    if (elements.markdownPreviewOverlay) {
      elements.markdownPreviewOverlay.addEventListener("click", closeMarkdownPreviewPanel);
    }
    if (elements.markdownCopyBtn) {
      elements.markdownCopyBtn.addEventListener("click", () => {
        const text = elements.markdownPreviewTextarea.value;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text)
            .then(() => {
              showToast(t("markdownCopied", "Markdownをクリップボードにコピーしました。"), "success");
            })
            .catch((err) => {
              showToast(`${t("copyFailedPrefix", "コピーに失敗しました：")}${err.message}`, "error");
            });
        } else {
          elements.markdownPreviewTextarea.select();
          try {
            document.execCommand("copy");
            showToast(t("markdownCopied", "Markdownをクリップボードにコピーしました。"), "success");
          } catch (err) {
            showToast(t("copyFailed", "コピーに失敗しました。手動でコピーしてください。"), "error");
          }
        }
      });
    }

    // ロゴタップですべてのエントリー一覧に戻る
    const logoClick = () => {
      window.EntryMemo.App.showAllEntriesListView();
    };
    const headerLogo = document.querySelector("#header-bar .logo");
    if (headerLogo) {
      headerLogo.addEventListener("click", logoClick);
    }

    // PCリロードボタン
    if (elements.headerRefreshBtn) {
      elements.headerRefreshBtn.addEventListener("click", async () => {
        elements.headerRefreshBtn.classList.add("spinning-btn");
        showLoading(t("loadingLatestData", "最新のデータを読み込み中..."));
        try {
          await window.EntryMemo.App.handlePullToRefresh();
          showToast(t("dataReloaded", "最新データをロードしました"), "success");
        } catch (err) {
          showToast(`${t("reloadFailed", "更新に失敗しました：")}${err.message}`, "error");
        } finally {
          hideLoading();
          setTimeout(() => {
            elements.headerRefreshBtn.classList.remove("spinning-btn");
          }, 600);
        }
      });
    }

    // 左右スワイプおよび上下引っ張り(Pull-to-refresh)ジェスチャーの登録
    let touchStartX = 0;
    let touchStartY = 0;
    let isPullingPtr = false;
    const ptrTriggerThreshold = 75;
    
    const ptrIndicator = document.getElementById("pull-to-refresh");
    const ptrIcon = document.getElementById("pull-indicator-icon");

    const getScrollContainer = () => {
      const isCategoryActive = elements.categoryEntriesView.style.display === "flex";
      if (isCategoryActive) {
        return elements.categoryEntriesView.querySelector(".entry-body-scroll");
      } else {
        return elements.entryDetailView.querySelector(".entry-body-scroll");
      }
    };

    if (elements.mainContent) {
      elements.mainContent.addEventListener("touchstart", (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
        
        const isModalOpen = elements.blockModal.style.display === "block" || 
                           elements.moveModal.style.display === "block" || 
                           elements.newEntryModal.style.display === "block" || 
                           (elements.editEntryModal && elements.editEntryModal.style.display === "block") || 
                           elements.shortcutHelpPanel.classList.contains("open") ||
                           elements.markdownPreviewPanel.classList.contains("open");
        if (isModalOpen) {
          isPullingPtr = false;
          return;
        }

        const container = getScrollContainer();
        if (container && container.scrollTop === 0) {
          isPullingPtr = true;
        } else {
          isPullingPtr = false;
        }
      }, { passive: true });

      elements.mainContent.addEventListener("touchmove", (e) => {
        if (!isPullingPtr) return;

        const currentY = e.changedTouches[0].screenY;
        const diffY = currentY - touchStartY;
        const diffX = e.changedTouches[0].screenX - touchStartX;

        if (diffY > 0 && diffY > Math.abs(diffX)) {
          const pullDistance = Math.min(diffY * 0.4, 90);
          if (ptrIndicator && ptrIcon) {
            ptrIndicator.classList.add("pulling");
            ptrIndicator.style.transform = `translateY(${pullDistance - 60}px)`;
            ptrIndicator.style.opacity = Math.min(pullDistance / 60, 1);
            ptrIcon.style.transform = `rotate(${pullDistance * 4}deg)`;
          }
        }
      }, { passive: true });

      elements.mainContent.addEventListener("touchend", async (e) => {
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;

        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 80) {
          if (!isPullingPtr && !isTextInputActive()) {
            window.EntryMemo.App.handleSwipeToggle();
          }
        }
        
        if (isPullingPtr) {
          isPullingPtr = false;
          const pullDistance = diffY * 0.4;
          
          if (ptrIndicator) {
            ptrIndicator.classList.remove("pulling");
            if (pullDistance >= ptrTriggerThreshold) {
              ptrIndicator.classList.add("refreshing");
              ptrIndicator.style.transform = "translateY(0px)";
              ptrIndicator.style.opacity = 1;
              
              try {
                await window.EntryMemo.App.handlePullToRefresh();
                showToast(t("dataReloaded", "最新データをロードしました"), "success");
              } catch (err) {
                showToast(`${t("reloadFailed", "更新に失敗しました：")}${err.message}`, "error");
              } finally {
                ptrIndicator.classList.remove("refreshing");
                ptrIndicator.style.transform = "translateY(-100%)";
                ptrIndicator.style.opacity = 0;
              }
            } else {
              ptrIndicator.style.transform = "translateY(-100%)";
              ptrIndicator.style.opacity = 0;
            }
          }
        }
      }, { passive: true });
    }


    // キーボードショートカット
    document.addEventListener("keydown", (e) => {
      const isBlockModalOpen = elements.blockModal.style.display === "block";
      const isMoveModalOpen = elements.moveModal.style.display === "block";
      const isNewEntryModalOpen = elements.newEntryModal.style.display === "block";
      const isEditEntryModalOpen = elements.editEntryModal && elements.editEntryModal.style.display === "block";
      const isHelpOpen = elements.shortcutHelpPanel.classList.contains("open");
      const isModalOpen = isBlockModalOpen || isMoveModalOpen || isNewEntryModalOpen || isEditEntryModalOpen || isHelpOpen;
      const isSummaryEditing = elements.summaryEditorArea.style.display === "block";

      // 一括削除処理の共通関数
      const performBatchDelete = () => {
        const checkedBoxes = Array.from(elements.blocksList.querySelectorAll(".block-select-checkbox:checked"));
        if (checkedBoxes.length > 0) {
          const blockIds = checkedBoxes.map(cb => cb.dataset.recordId);
          const currentEntry = window.EntryMemo.App.getCurrentEntry();
          
          let hasChildrenInSelection = false;
          if (currentEntry) {
            for (const id of blockIds) {
              const subtree = Utils.getSubtreeBlocks(currentEntry.blocks, id);
              if (subtree.length > 1) {
                hasChildrenInSelection = true;
                break;
              }
            }
          }
          
          let confirmMsg;
          if (hasChildrenInSelection) {
            confirmMsg = t("confirmDeleteSelectedBlocksWithChildren", "選択されたブロックの中に、子ブロックを持つものが含まれています。\n削除すると、それらの配下にある子ブロックもすべて一緒に削除されます。\n\n本当に削除しますか？");
          } else {
            confirmMsg = t("confirmDeleteSelectedBlocks", "選択された ${count} 個のブロックを削除しますか？\n削除したブロックは元に戻せません。").replace("${count}", checkedBoxes.length);
          }

          const confirmDelete = confirm(confirmMsg);
          if (confirmDelete) {
            const blockIds = checkedBoxes.map(cb => cb.dataset.recordId);
            const currentEntry = window.EntryMemo.App.getCurrentEntry();
            if (currentEntry) {
              const displayBlocks = getDisplayBlocks(currentEntry.blocks, currentSortOrder);
              const checkedIds = new Set(blockIds);
              const remainingBlocks = displayBlocks.filter(b => !checkedIds.has(b.id));
              if (remainingBlocks.length > 0) {
                let lastTargetIdx = -1;
                for (let i = 0; i < displayBlocks.length; i++) {
                  if (checkedIds.has(displayBlocks[i].id)) {
                    lastTargetIdx = i;
                  }
                }
                let foundFocus = false;
                for (let i = lastTargetIdx + 1; i < displayBlocks.length; i++) {
                  if (!checkedIds.has(displayBlocks[i].id)) {
                    lastFocusedBlockId = displayBlocks[i].id;
                    foundFocus = true;
                    break;
                  }
                }
                if (!foundFocus) {
                  for (let i = lastTargetIdx - 1; i >= 0; i--) {
                    if (!checkedIds.has(displayBlocks[i].id)) {
                      lastFocusedBlockId = displayBlocks[i].id;
                      foundFocus = true;
                      break;
                    }
                  }
                }
                if (!foundFocus) {
                  lastFocusedBlockId = "summary";
                }
              } else {
                lastFocusedBlockId = "summary";
              }
              window.EntryMemo.App.handleDeleteBlocks(blockIds);
            }
          }
          return true;
        }
        return false;
      };

      // フォーカストラップの処理（Tabキーの移動をモーダル内に限定）
      let activeModal = null;
      if (isBlockModalOpen) activeModal = elements.blockModal;
      else if (isMoveModalOpen) activeModal = elements.moveModal;
      else if (isNewEntryModalOpen) activeModal = elements.newEntryModal;
      else if (isEditEntryModalOpen) activeModal = elements.editEntryModal;

      if (activeModal && (e.key === "Tab" || e.code === "Tab")) {
        const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const focusableElements = Array.from(activeModal.querySelectorAll(focusableSelector)).filter(el => {
          return el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled;
        });

        if (focusableElements.length > 0) {
          const firstFocusable = focusableElements[0];
          const lastFocusable = focusableElements[focusableElements.length - 1];

          if (e.shiftKey) {
            // Shift + Tab
            if (document.activeElement === firstFocusable) {
              e.preventDefault();
              lastFocusable.focus();
            }
          } else {
            // Tab
            if (document.activeElement === lastFocusable) {
              e.preventDefault();
              firstFocusable.focus();
            }
          }
          // モーダルの外にフォーカスがいってしまった場合のガード
          if (!activeModal.contains(document.activeElement)) {
            e.preventDefault();
            firstFocusable.focus();
          }
        } else {
          e.preventDefault();
        }
      }

      // Markdownプレビューペイン表示中のスクロール対応
      const isPreviewOpen = elements.markdownPreviewPanel.classList.contains("open");
      if (isPreviewOpen) {
        if (e.code === "ArrowDown" || e.key === "ArrowDown" || e.key === "Down") {
          e.preventDefault();
          elements.markdownPreviewTextarea.scrollTop += 40;
          return;
        } else if (e.code === "ArrowUp" || e.key === "ArrowUp" || e.key === "Up") {
          e.preventDefault();
          elements.markdownPreviewTextarea.scrollTop -= 40;
          return;
        } else if (e.code === "PageDown") {
          e.preventDefault();
          elements.markdownPreviewTextarea.scrollTop += elements.markdownPreviewTextarea.clientHeight - 40;
          return;
        } else if (e.code === "PageUp") {
          e.preventDefault();
          elements.markdownPreviewTextarea.scrollTop -= elements.markdownPreviewTextarea.clientHeight - 40;
          return;
        }
      }

      // Escapeキーによるモーダル・ヘルプのクローズ
      if (e.code === "Escape" || e.key === "Escape") {
        if (isModalOpen || isSummaryEditing) {
          e.preventDefault();
          closeModal();
          if (isSummaryEditing) {
            elements.summaryCancelBtn.click();
          }
        }
        return;
      }

      const inputActive = isTextInputActive();
      const isCategoryViewActive = elements.categoryEntriesView.style.display === "flex";

      // ? (Shift + /) でヘルプパネルを開閉
      if (match(e, "help") && !inputActive) {
        e.preventDefault();
        toggleHelpPanel();
        return;
      }

      // S キーでのお気に入り（Pickup）トグル
      if (match(e, "toggleFavorite") && !inputActive && !isModalOpen && !isSummaryEditing) {
        if (elements.entryDetailView.style.display === "flex") {
          const currentEntry = window.EntryMemo.App.getCurrentEntry();
          if (currentEntry) {
            const isTrash = currentEntry.categoryName === "ゴミ箱" || currentEntry.categoryName === "trash";
            if (isTrash) return;
            e.preventDefault();
            window.EntryMemo.App.handleToggleFavorite(currentEntry.categoryName, currentEntry.fileName);
          }
        } else if (isCategoryViewActive) {
          const cards = elements.categoryEntriesList.querySelectorAll(".inline-entry-item");
          if (focusedEntryIndex >= 0 && focusedEntryIndex < cards.length) {
            const card = cards[focusedEntryIndex];
            const categoryName = card.dataset.categoryName;
            const fileName = card.dataset.fileName;
            if (categoryName && fileName) {
              e.preventDefault();
              window.EntryMemo.App.handleToggleFavorite(categoryName, fileName);
            }
          }
        }
        return;
      }

      // Ctrl または Cmd を伴うショートカット、またはそれらに対応するマッピング
      if (match(e, "showAllEntries")) {
        if (!inputActive && !isModalOpen && !isSummaryEditing) {
          e.preventDefault();
          window.EntryMemo.App.showAllEntriesListView();
          return;
        }
      }

      if (match(e, "toggleSwipe")) {
        if (!inputActive && !isModalOpen && !isSummaryEditing) {
          e.preventDefault();
          window.EntryMemo.App.handleSwipeToggle();
          return;
        }
      }

      if (match(e, "selectAllBlocks")) {
        if (!inputActive && !isModalOpen && !isSummaryEditing) {
          const checkboxes = Array.from(elements.blocksList.querySelectorAll(".block-select-checkbox"));
          if (checkboxes.length > 0) {
            e.preventDefault();
            const allChecked = checkboxes.every(cb => cb.checked);
            checkboxes.forEach(cb => {
              cb.checked = !allChecked;
            });
            updateMergeActionBar();
          }
          return;
        }
      }

      if (match(e, "batchDelete")) {
        if (!inputActive && !isModalOpen && !isSummaryEditing) {
          if (performBatchDelete()) {
            e.preventDefault();
          }
          return;
        }
      }

      if (match(e, "togglePreview")) {
        if (!inputActive && !isModalOpen && !isSummaryEditing) {
          e.preventDefault();
          if (isPreviewOpen) {
            closeMarkdownPreviewPanel();
          } else {
            if (elements.entryDetailView.style.display === "flex") {
              const currentEntry = window.EntryMemo.App.getCurrentEntry();
              if (currentEntry) {
                const md = window.EntryMemo.Markdown.serializeEntry(currentEntry);
                openMarkdownPreviewPanel(md);
              }
            } else if (isCategoryViewActive) {
              const cards = elements.categoryEntriesList.querySelectorAll(".inline-entry-item");
              if (focusedEntryIndex >= 0 && focusedEntryIndex < cards.length) {
                const card = cards[focusedEntryIndex];
                const categoryName = card.dataset.categoryName;
                const fileName = card.dataset.fileName;
                if (categoryName && fileName) {
                  window.EntryMemo.App.handleShowMarkdownPreview(categoryName, fileName);
                }
              }
            }
          }
          return;
        }
      }

      if (e.ctrlKey || e.metaKey) {
        // 残りのCtrlキー、または互換性のあるマッピングの処理
        if (match(e, "cardAddBlock")) {
          if (!isModalOpen && !isSummaryEditing) {
            if (elements.entryDetailView.style.display === "flex") {
              e.preventDefault();
              triggerAddBlock();
            }
          }
        } else if (match(e, "newEntry")) {
          const hasSelection = window.getSelection().toString().length > 0;
          if (!hasSelection && !inputActive && !isModalOpen && !isSummaryEditing) {
            e.preventDefault();
            openNewEntryModal();
          }
        } else if (match(e, "openFolder")) {
          e.preventDefault();
          elements.openFolderBtn.click();
        } else if (match(e, "editEntry")) {
          if (!isModalOpen && !isSummaryEditing) {
            e.preventDefault();
            openEditEntryModal();
          }
        } else if (match(e, "editSummary")) {
          if (!isModalOpen && !isSummaryEditing && elements.summaryEditBtn.style.display !== "none") {
            e.preventDefault();
            elements.summaryEditBtn.click();
            setTimeout(() => elements.summaryTextarea.focus(), 50);
          }
        } else if (match(e, "navigateCategoryNextCtrl")) {
          if (!isModalOpen && !isSummaryEditing) {
            e.preventDefault();
            if (isCategoryViewActive) {
              window.EntryMemo.App.handleNavigateCategory("next");
            } else {
              const currentEntry = window.EntryMemo.App.getCurrentEntry();
              const category = currentEntry ? currentEntry.categoryName : window.EntryMemo.App.getActiveCategory();
              if (category) {
                window.EntryMemo.App.handleSelectCategory(category);
              }
            }
          }
        } else if (match(e, "navigateCategoryPrevCtrl")) {
          if (!isModalOpen && !isSummaryEditing) {
            e.preventDefault();
            if (isCategoryViewActive) {
              window.EntryMemo.App.handleNavigateCategory("prev");
            } else {
              const currentEntry = window.EntryMemo.App.getCurrentEntry();
              const category = currentEntry ? currentEntry.categoryName : window.EntryMemo.App.getActiveCategory();
              if (category) {
                window.EntryMemo.App.handleSelectCategory(category);
              }
            }
          }
        }
      } else if (e.altKey) {
        if (e.key === "Enter" || e.code === "Enter") {
          if (!isModalOpen && !isSummaryEditing) {
            if (elements.entryDetailView.style.display === "flex") {
              e.preventDefault();
              triggerAddChildBlock();
            }
          }
        } else if (match(e, "navigateEntryNext")) {
          e.preventDefault();
          window.EntryMemo.App.handleNavigateEntry("next");
        } else if (match(e, "navigateEntryPrev")) {
          e.preventDefault();
          window.EntryMemo.App.handleNavigateEntry("prev");
        } else if (match(e, "toggleViewBoard")) {
          e.preventDefault();
          window.EntryMemo.App.handleToggleView("board");
        } else if (match(e, "toggleViewThread")) {
          e.preventDefault();
          window.EntryMemo.App.handleToggleView("thread");
        }
      } else { // 修飾キーなし (または通常のキー)
        if (!inputActive && !isModalOpen && !isSummaryEditing) {
          if (isCategoryViewActive) {
            // --- カテゴリーのエントリー一覧画面でのキー操作 ---
            const cards = elements.categoryEntriesList.querySelectorAll(".inline-entry-item");
            if (match(e, "categoryNavigateNext")) {
              e.preventDefault();
              navigateEntryCardFocus("next");
            } else if (match(e, "categoryNavigatePrev")) {
              e.preventDefault();
              navigateEntryCardFocus("prev");
            } else if (match(e, "categoryOpenEntry")) {
              if (focusedEntryIndex >= 0 && focusedEntryIndex < cards.length) {
                e.preventDefault();
                cards[focusedEntryIndex].click();
              }
            } else if (match(e, "categoryDeleteEntry")) {
              if (focusedEntryIndex >= 0 && focusedEntryIndex < cards.length) {
                e.preventDefault();
                const card = cards[focusedEntryIndex];
                const category = card.dataset.categoryName; 
                const file = card.dataset.fileName;
                if (category && file) {
                  window.EntryMemo.App.handleDeleteEntry(category, file);
                }
              }
            }
          } else {
            // --- エントリー詳細ビューでのキー操作 ---
            const cards = elements.blocksList.querySelectorAll(".block-card");

            if (match(e, "cardNavigateNext")) {
              e.preventDefault();
              navigateCardFocus("next");
            } else if (match(e, "cardNavigatePrev")) {
              e.preventDefault();
              navigateCardFocus("prev");
            } else if (match(e, "cardToggleExpand")) {
              if (focusedBlockIndex >= 1 && focusedBlockIndex <= cards.length) {
                e.preventDefault();
                const targetCard = cards[focusedBlockIndex - 1];
                const openBtn = targetCard.querySelector(".block-footer button:first-child");
                if (openBtn) openBtn.click();
              }
            } else if (match(e, "cardEdit")) {
              if (focusedBlockIndex === 0) {
                e.preventDefault();
                if (elements.summaryEditBtn && elements.summaryEditBtn.style.display !== "none") {
                  elements.summaryEditBtn.click();
                  setTimeout(() => elements.summaryTextarea.focus(), 50);
                }
              } else if (focusedBlockIndex >= 1 && focusedBlockIndex <= cards.length) {
                e.preventDefault();
                const targetCard = cards[focusedBlockIndex - 1];
                const editBtn = Array.from(targetCard.querySelectorAll(".block-footer button")).find(b => b.textContent === "編集");
                if (editBtn) editBtn.click();
              }
            } else if (match(e, "cardMoveOrMerge")) {
              const checkedBoxes = Array.from(elements.blocksList.querySelectorAll(".block-select-checkbox:checked"));
              if (checkedBoxes.length > 0) {
                e.preventDefault();
                elements.mergeSubmitBtn.click();
              } else if (focusedBlockIndex >= 1 && focusedBlockIndex <= cards.length) {
                e.preventDefault();
                const targetCard = cards[focusedBlockIndex - 1];
                const moveBtn = Array.from(targetCard.querySelectorAll(".block-footer button")).find(b => b.textContent === "移動");
                if (moveBtn) moveBtn.click();
              }
            } else if (match(e, "cardAddBlock")) {
              e.preventDefault();
              triggerAddBlock();
            } else if (match(e, "cardDelete")) {
              if (performBatchDelete()) {
                e.preventDefault();
              } else if (focusedBlockIndex >= 1 && focusedBlockIndex <= cards.length) {
                e.preventDefault();
                const targetCard = cards[focusedBlockIndex - 1];
                const deleteBtn = Array.from(targetCard.querySelectorAll(".block-footer button")).find(b => b.textContent === "削除");
                if (deleteBtn) deleteBtn.click();
              }
            } else if (match(e, "cardSelectMerge")) {
              if (focusedBlockIndex >= 1 && focusedBlockIndex <= cards.length) {
                e.preventDefault();
                const targetCard = cards[focusedBlockIndex - 1];
                const cb = targetCard.querySelector(".block-select-checkbox");
                if (cb) {
                  cb.checked = !cb.checked;
                  updateMergeActionBar();
                }
              }
            } else if (e.key === "o" || e.key === "O") {
              e.preventDefault();
              const currentEntry = window.EntryMemo.App.getCurrentEntry();
              if (currentEntry && currentEntry.blocks.length > 0) {
                currentEntry.blocks.forEach(b => expandedBlockIds.add(b.id));
                localStorage.setItem("EntryMemo.expandedBlocks", JSON.stringify(Array.from(expandedBlockIds)));
                renderBlocksList(currentEntry.blocks, currentEntry.hasError);
                showToast(t("allBlocksOpened", "すべてのブロックを展開しました。"), "success");
              }
            } else if (e.key === "c" || e.key === "C") {
              e.preventDefault();
              const currentEntry = window.EntryMemo.App.getCurrentEntry();
              if (currentEntry && currentEntry.blocks.length > 0) {
                currentEntry.blocks.forEach(b => expandedBlockIds.delete(b.id));
                localStorage.setItem("EntryMemo.expandedBlocks", JSON.stringify(Array.from(expandedBlockIds)));
                renderBlocksList(currentEntry.blocks, currentEntry.hasError);
                showToast(t("allBlocksClosed", "すべてのブロックを折りたたみました。"), "success");
              }
            } else if (match(e, "deleteEntry")) {
              e.preventDefault();
              const currentEntry = window.EntryMemo.App.getCurrentEntry();
              if (currentEntry) {
                window.EntryMemo.App.handleDeleteEntry(currentEntry.categoryName, currentEntry.fileName);
              }
            }
          }
        }
      }
    });

    // ブロックモーダル内のショートカット
    const handleModalShortcut = (e) => {
      if (e.key === "Enter" && !e.isComposing) {
        if (e.target === elements.blockInputBody) {
          blockModalEnterCount++;
          if (blockModalEnterCount === 3) {
            e.preventDefault();
            e.stopPropagation();
            blockModalEnterCount = 0;
            const val = elements.blockInputBody.value;
            if (val.endsWith("\n\n")) {
              elements.blockInputBody.value = val.slice(0, -2);
            } else if (val.endsWith("\n")) {
              elements.blockInputBody.value = val.slice(0, -1);
            }
            elements.blockModalSaveBtn.click();
            return;
          }
        }
      } else if (!e.isComposing) {
        blockModalEnterCount = 0;
      }

      if ((e.ctrlKey || e.metaKey)) {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          blockModalEnterCount = 0;
          elements.blockModalSaveBtn.click();
        } else if (e.key === "s" || e.key === "S") {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };
    elements.blockInputBody.addEventListener("keydown", handleModalShortcut);
    elements.blockInputTitle.addEventListener("keydown", handleModalShortcut);

    // 概要編集内のショートカット
    elements.summaryTextarea.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey)) {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          elements.summarySaveBtn.click();
        } else if (e.key === "s" || e.key === "S") {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    });

    // 新規エントリー作成モーダル内のショートカット
    const handleNewEntryModalShortcut = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        elements.newEntryCreateBtn.click();
      }
    };
    elements.newEntryNameInput.addEventListener("keydown", handleNewEntryModalShortcut);
    elements.newEntryNewCategoryInput.addEventListener("keydown", handleNewEntryModalShortcut);
    elements.newEntryCategorySelect.addEventListener("keydown", handleNewEntryModalShortcut);

    // エントリー編集モーダル内のショートカット
    const handleEditEntryModalShortcut = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          elements.editEntrySaveBtn.click();
        } else if (e.key === "s" || e.key === "S") {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };
    if (elements.editEntryNameInput) {
      elements.editEntryNameInput.addEventListener("keydown", handleEditEntryModalShortcut);
    }
    if (elements.editEntryNewCategoryInput) {
      elements.editEntryNewCategoryInput.addEventListener("keydown", handleEditEntryModalShortcut);
    }

    // マージボタン
    elements.mergeSubmitBtn.addEventListener("click", async () => {
      const checkedBoxes = elements.blocksList.querySelectorAll(".block-select-checkbox:checked");
      const count = checkedBoxes.length;
      if (count === 0) {
        showToast("マージ対象のブロックが選択されていません。", "warning");
        return;
      }

      const confirmMerge = confirm(t("confirmMergeSelectedBlocks", "選択された ${count} 件のブロックを1つにマージしますか？\nマージ後は元の各ブロックの見出しレベルが1段下がり、現在のエントリー内で1つのブロックに統合されます。").replace("${count}", count));
      if (confirmMerge) {
        const blockIds = Array.from(checkedBoxes).map(cb => cb.dataset.recordId);
        
        elements.mergeActionBar.style.display = "none";
        await window.EntryMemo.App.handleMergeBlocks(blockIds);
      }
    });

    // マージキャンセルボタン
    elements.mergeCancelBtn.addEventListener("click", () => {
      const checkedBoxes = elements.blocksList.querySelectorAll(".block-select-checkbox");
      checkedBoxes.forEach(cb => cb.checked = false);
      updateMergeActionBar();
    });

    // ブラウザの戻る・進むをスマホのスワイプと同様のトグル動作にする
    window.addEventListener("popstate", (e) => {
      e.preventDefault();
      window.EntryMemo.App.handleSwipeToggle();
      // 履歴スタックを維持するためにダミーを再プッシュ
      history.pushState({ page: "app" }, "");
    });
  }

  function navigateCardFocus(direction) {
    const cards = Array.from(elements.blocksList.querySelectorAll(".block-card"));
    
    // 表示されている要素のリストを作成（概要セクション + 表示されているブロックカード）
    const visibleTargets = [];
    if (elements.summarySection) {
      visibleTargets.push({ index: 0, element: elements.summarySection });
    }
    cards.forEach((card, idx) => {
      if (card.style.display !== "none") {
        visibleTargets.push({ index: idx + 1, element: card });
      }
    });

    if (visibleTargets.length === 0) return;

    // 現在のフォーカスがどの位置にあるか特定
    let currentIdx = visibleTargets.findIndex(t => t.index === focusedBlockIndex);

    // 既存のフォーカスを除去
    if (focusedBlockIndex === 0) {
      if (elements.summarySection) {
        elements.summarySection.classList.remove("focused");
      }
    } else if (focusedBlockIndex >= 1 && focusedBlockIndex <= cards.length) {
      const prevCard = cards[focusedBlockIndex - 1];
      if (prevCard) prevCard.classList.remove("focused");
    }

    // 次のインデックスを決定
    if (currentIdx === -1) {
      if (direction === "next") {
        currentIdx = 0;
      } else {
        currentIdx = visibleTargets.length - 1;
      }
    } else {
      if (direction === "next") {
        currentIdx = (currentIdx + 1) % visibleTargets.length;
      } else if (direction === "prev") {
        currentIdx = (currentIdx - 1 + visibleTargets.length) % visibleTargets.length;
      }
    }

    // フォーカスの適用
    const target = visibleTargets[currentIdx];
    focusedBlockIndex = target.index;
    
    target.element.classList.add("focused");
    target.element.setAttribute("tabindex", "-1");
    target.element.focus();
  }

  function navigateEntryCardFocus(direction) {
    const cards = elements.categoryEntriesList.querySelectorAll(".inline-entry-item");
    if (cards.length === 0) return;

    if (focusedEntryIndex >= 0 && focusedEntryIndex < cards.length) {
      cards[focusedEntryIndex].classList.remove("focused");
    }

    if (focusedEntryIndex === -1) {
      if (direction === "next") {
        focusedEntryIndex = 0;
      } else {
        focusedEntryIndex = cards.length - 1;
      }
    } else {
      if (direction === "next") {
        focusedEntryIndex++;
        if (focusedEntryIndex >= cards.length) {
          focusedEntryIndex = 0;
        }
      } else if (direction === "prev") {
        focusedEntryIndex--;
        if (focusedEntryIndex < 0) {
          focusedEntryIndex = cards.length - 1;
        }
      }
    }

    const targetCard = cards[focusedEntryIndex];
    if (targetCard) {
      targetCard.classList.add("focused");
      targetCard.setAttribute("tabindex", "-1");
      targetCard.focus();
    }
  }

  /**
   * 新規エントリーモーダルを開く
   */
  async function openNewEntryModal() {
    const categories = await window.EntryMemo.App.storage.listCategories();
    elements.newEntryCategorySelect.innerHTML = categories.map(b => 
      `<option value="${Utils.escapeHtml(b)}">${Utils.escapeHtml(b)}</option>`
    ).join("");
    
    const activeCategory = window.EntryMemo.App.getActiveCategory();
    if (activeCategory && categories.includes(activeCategory)) {
      elements.newEntryCategorySelect.value = activeCategory;
    }
    
    elements.newEntryNameInput.value = "";
    elements.newEntryNewCategoryInput.value = "";
    elements.newEntryNewCategoryOption.checked = false;
    elements.newEntryExistingCategoryForm.style.display = "block";
    elements.newEntryNewCategoryForm.style.display = "none";

    openModal(elements.newEntryModal);
    setTimeout(() => {
      elements.newEntryNameInput.focus();
    }, 50);
  }

  /**
   * エントリー編集モーダルを開く
   */
  async function openEditEntryModal() {
    const currentEntry = window.EntryMemo.App.getCurrentEntry();
    if (!currentEntry) return;

    const categories = await window.EntryMemo.App.storage.listCategories();
    elements.editEntryCategorySelect.innerHTML = categories.map(b => 
      `<option value="${Utils.escapeHtml(b)}">${Utils.escapeHtml(b)}</option>`
    ).join("");

    if (currentEntry.categoryName && categories.includes(currentEntry.categoryName)) {
      elements.editEntryCategorySelect.value = currentEntry.categoryName;
    }

    elements.editEntryNameInput.value = currentEntry.title || currentEntry.fileName.slice(0, -3);
    elements.editEntryNewCategoryOption.checked = false;
    elements.editEntryNewCategoryInput.value = "";
    elements.editEntryExistingCategoryForm.style.display = "block";
    elements.editEntryNewCategoryForm.style.display = "none";

    openModal(elements.editEntryModal);
    setTimeout(() => {
      elements.editEntryNameInput.focus();
    }, 50);
  }

  /**
   * ブロックの追加・編集モーダルを開く
   */
  function openBlockModal(block = null, parentBlock = null) {
    blockModalEnterCount = 0;
    if (block) {
      elements.blockModalTitle.textContent = t("editBlockTitle", "ブロックを編集");
      elements.blockModal.dataset.editingBlockId = block.id;
      delete elements.blockModal.dataset.parentBlockId;
      elements.blockInputTitle.value = block.title;
      elements.blockInputBody.value = block.body;
    } else {
      if (parentBlock) {
        elements.blockModalTitle.textContent = t("addChildBlockTitle", "子ブロックを追加");
        elements.blockModal.dataset.parentBlockId = parentBlock.id;
      } else {
        elements.blockModalTitle.textContent = t("addBlockTitle", "ブロックを追加");
        delete elements.blockModal.dataset.parentBlockId;
      }
      delete elements.blockModal.dataset.editingBlockId;
      elements.blockInputTitle.value = "";
      elements.blockInputBody.value = "";
    }
    openModal(elements.blockModal);
    setTimeout(() => {
      adjustTextareaHeight(elements.blockInputBody);
      elements.blockInputBody.focus();
    }, 50);
  }

  /**
   * 移動モーダルのエントリー一覧を更新する
   */
  async function updateMoveModalEntries(categoryName) {
    const App = window.EntryMemo.App;
    const entries = await App.storage.listEntries(categoryName);

    let options = [];
    const validEntries = [];
    for (const entry of entries) {
      try {
        const md = await App.storage.readEntry(categoryName, entry.fileName);
        const parsed = Markdown.parseEntry(md);
        if (parsed.errors.length === 0) {
          options.push(`<option value="${Utils.escapeHtml(entry.fileName)}">${Utils.escapeHtml(parsed.title || entry.fileName)}</option>`);
          validEntries.push(entry.fileName);
        }
      } catch (e) {
      }
    }

    if (options.length === 0) {
      elements.moveTargetEntry.innerHTML = `<option value="">(移動可能なエントリーがありません)</option>`;
      return null;
    } else {
      elements.moveTargetEntry.innerHTML = options.join("");
      elements.moveTargetEntry.value = validEntries[0];
      return validEntries[0];
    }
  }

  /**
   * 移動先エントリーのブロック（親ブロック候補）一覧を更新する
   */
  async function updateMoveModalBlocks(categoryName, fileName, currentBlockId = null) {
    if (!categoryName || !fileName) {
      elements.moveTargetParentBlock.innerHTML = `<option value="">(第一階層のブロックとして追加)</option>`;
      return;
    }

    try {
      const App = window.EntryMemo.App;
      const md = await App.storage.readEntry(categoryName, fileName);
      const parsed = Markdown.parseEntry(md);
      
      const currentEntry = App.getCurrentEntry();
      const isSameEntry = currentEntry && currentEntry.categoryName === categoryName && currentEntry.fileName === fileName;

      // 除外するブロックIDのセットを作成（移動対象ブロック自身と、その配下の子孫ブロック）
      const excludeIds = new Set();
      if (isSameEntry && currentBlockId) {
        const subtree = Utils.getSubtreeBlocks(parsed.blocks, currentBlockId);
        subtree.forEach(b => excludeIds.add(b.id));
      }

      let options = [`<option value="">(第一階層のブロックとして追加)</option>`];
      for (const block of parsed.blocks) {
        if (excludeIds.has(block.id)) continue;
        if ((block.level || 3) >= 6) continue; // 見出し6は子を持てない

        const indent = "　".repeat(Math.max(0, (block.level || 3) - 3));
        const label = `${indent}[${block.id}] ${block.title || "(タイトルなし)"}`;
        options.push(`<option value="${Utils.escapeHtml(block.id)}">${Utils.escapeHtml(label)}</option>`);
      }
      elements.moveTargetParentBlock.innerHTML = options.join("");
    } catch (e) {
      elements.moveTargetParentBlock.innerHTML = `<option value="">(第一階層のブロックとして追加)</option>`;
    }
  }

  /**
   * ブロック移動モーダルを開く
   */
  async function openMoveModal(block) {
    const App = window.EntryMemo.App;
    elements.moveModal.dataset.blockId = block.id;
    elements.moveSourceInfo.textContent = `[${block.id}] ${block.title}`;

    const categories = await App.storage.listCategories();
    
    elements.moveTargetCategory.innerHTML = categories.map(b => 
      `<option value="${Utils.escapeHtml(b)}">${Utils.escapeHtml(b)}</option>`
    ).join("");

    elements.moveNewEntryCategory.innerHTML = categories.map(b => 
      `<option value="${Utils.escapeHtml(b)}">${Utils.escapeHtml(b)}</option>`
    ).join("");

    const currentEntry = App.getCurrentEntry();
    if (currentEntry) {
      elements.moveTargetCategory.value = currentEntry.categoryName;
      elements.moveNewEntryCategory.value = currentEntry.categoryName;
    }

    const selectedFile = await updateMoveModalEntries(elements.moveTargetCategory.value);
    
    let activeFile = selectedFile;
    if (currentEntry) {
      const hasCurrent = Array.from(elements.moveTargetEntry.options).some(opt => opt.value === currentEntry.fileName);
      if (hasCurrent) {
        elements.moveTargetEntry.value = currentEntry.fileName;
        activeFile = currentEntry.fileName;
      }
    }
    
    // エントリーがセットされたら、親ブロックリストを更新する
    await updateMoveModalBlocks(elements.moveTargetCategory.value, activeFile, block.id);
    
    elements.moveNewEntryName.value = block.title;

    openModal(elements.moveModal);
  }

  /**
   * サイドバー描画（左メニューが廃止されたため機能なし）
   */
  function renderSidebar(sidebarData, activeCategory, activeFileName) {
    // 廃止されたため何もしない
  }

  /**
   * 現在のエントリー本文エリアの描画
   */
  function renderCurrentEntry(entryData, isNewLoad = false) {
    if (!entryData) {
      elements.mainContent.style.display = "none";
      return;
    }

    elements.mainContent.style.display = "block";
    elements.entryDetailView.style.display = "flex";
    elements.categoryEntriesView.style.display = "none";
    
    updateFavoriteButton(entryData.isFavorite, entryData.categoryName);
    updateSortBlocksBtnText();
    
    // エラーバナーの処理
    if (entryData.hasError) {
      elements.entryErrorBanner.style.display = "block";
      elements.entryErrorList.innerHTML = entryData.errors.map(err => 
        `<li>${Utils.escapeHtml(err)}</li>`
      ).join("");
      
      elements.summaryEditBtn.style.display = "none";
      elements.addBlockBtnTop.style.display = "none";
    } else {
      elements.entryErrorBanner.style.display = "none";
      elements.summaryEditBtn.style.display = "inline-block";
      elements.addBlockBtnTop.style.display = "inline-block";
    }

    elements.mergeActionBar.style.display = "none";

    elements.currentEntryTitle.innerHTML = "";
    
    // 1階層目: 「すべて」へのリンク
    const allLink = document.createElement("a");
    allLink.href = "#";
    allLink.className = "breadcrumb-category-link";
    allLink.textContent = t("all", "すべて");
    allLink.addEventListener("click", (e) => {
      e.preventDefault();
      window.EntryMemo.App.showAllEntriesListView();
    });
    elements.currentEntryTitle.appendChild(allLink);
    
    const separator1 = document.createTextNode(" ＞ ");
    elements.currentEntryTitle.appendChild(separator1);

    // 2階層目: カテゴリー名へのリンク
    if (entryData.categoryName) {
      const categoryLink = document.createElement("a");
      categoryLink.href = "#";
      categoryLink.className = "breadcrumb-category-link";
      categoryLink.textContent = t(entryData.categoryName);
      categoryLink.addEventListener("click", (e) => {
        e.preventDefault();
        window.EntryMemo.App.handleSelectCategory(entryData.categoryName);
      });
      elements.currentEntryTitle.appendChild(categoryLink);
      
      const separator2 = document.createTextNode(" ＞ ");
      elements.currentEntryTitle.appendChild(separator2);
    }
    
    // 3階層目: エントリータイトル
    const titleText = document.createTextNode(entryData.title || entryData.fileName);
    elements.currentEntryTitle.appendChild(titleText);
    if (isNewLoad) {
      setTimeout(() => {
        elements.currentEntryTitle.focus();
      }, 50);
    }

    // 概要の表示
    const summaryTitle = entryData.summaryTitle || t("summary", "概要");
    if (elements.summarySection) {
      const summaryHeader = elements.summarySection.querySelector("h3");
      if (summaryHeader) {
        summaryHeader.textContent = `📌 ${summaryTitle}`;
      }
    }
    if (elements.summaryEditBtn) {
      elements.summaryEditBtn.textContent = t("edit", "編集");
    }
    if (elements.summaryTextarea) {
      elements.summaryTextarea.placeholder = t("summaryTextareaPlaceholder", "現在の結論、方針、未解決事項などを${summaryTitle}に記述してください...").replace("${summaryTitle}", summaryTitle);
    }

    if (entryData.summary) {
      elements.summaryText.textContent = entryData.summary;
      elements.summaryText.style.display = "block";
    } else {
      elements.summaryText.textContent = (currentLanguage === "ja") ? `(${summaryTitle}は設定されていません)` : `(${summaryTitle} is not set)`;
      elements.summaryText.style.display = "block";
    }
    
    elements.summaryDisplayArea.style.display = "block";
    elements.summaryEditorArea.style.display = "none";

    // ブロックリストの描画
    if (elements.summarySection) {
      elements.summarySection.classList.remove("focused");
    }
    focusedBlockIndex = -1;
    renderBlocksList(entryData.blocks, entryData.hasError);
  }

  /**
   * ブロックカード一覧の描画
   */
  function renderBlocksList(blocks, entryHasError) {
    elements.blocksList.innerHTML = "";

    if (!blocks || blocks.length === 0) {
      const emptyDiv = document.createElement("div");
      emptyDiv.className = "blocks-empty";
      emptyDiv.textContent = t("noBlocks", "ブロックはありません。");
      elements.blocksList.appendChild(emptyDiv);
      return;
    }

    // 祖先ブロックのスタックを使った非表示判定
    const hiddenBlockIds = calculateHiddenBlocks(blocks);

    const displayBlocks = getDisplayBlocks(blocks, currentSortOrder);

    displayBlocks.forEach(rec => {
      const card = document.createElement("div");
      card.className = `block-card block-card-level-${rec.level || 3}`;
      card.id = `block-card-${rec.id}`;

      if (hiddenBlockIds.has(rec.id)) {
        card.style.display = "none";
      }

      const isExpanded = expandedBlockIds.has(rec.id);

      // ヘッダー部分
      const header = document.createElement("div");
      header.className = "block-header";
      
      const headerLeft = document.createElement("div");
      headerLeft.className = "block-header-left";

      const selectCheckbox = document.createElement("input");
      selectCheckbox.type = "checkbox";
      selectCheckbox.className = "block-select-checkbox";
      selectCheckbox.dataset.recordId = rec.id;
      selectCheckbox.addEventListener("change", updateMergeActionBar);
      headerLeft.appendChild(selectCheckbox);

      const titleSpan = document.createElement("span");
      titleSpan.className = "block-title";
      titleSpan.style.cursor = "pointer";
      let dateHtml = "";
      if (rec.datetime) {
        dateHtml = ` <span class="block-datetime" style="color: var(--text-muted); font-size: 12px; margin-right: 6px; font-family: var(--font-mono);">${Utils.escapeHtml(rec.datetime)}</span>`;
      }
      titleSpan.innerHTML = `<span class="block-id">[${Utils.escapeHtml(rec.id)}]</span>${dateHtml}${Utils.escapeHtml(rec.title)}`;
      headerLeft.appendChild(titleSpan);
      
      header.appendChild(headerLeft);
      card.appendChild(header);

      // 本文部分
      const bodyArea = document.createElement("div");
      bodyArea.className = "block-body";
      
      const textDiv = document.createElement("div");
      textDiv.className = "block-text";
      textDiv.textContent = Utils.excerpt(rec.body, 150);
      textDiv.style.display = isExpanded ? "none" : "block";
      bodyArea.appendChild(textDiv);

      const fullTextPre = document.createElement("pre");
      fullTextPre.className = "block-full-text";
      fullTextPre.textContent = rec.body;
      fullTextPre.style.display = isExpanded ? "block" : "none";
      bodyArea.appendChild(fullTextPre);

      card.appendChild(bodyArea);
      if (isExpanded) {
        card.classList.add("expanded");
      }

      // 操作フッター
      const footer = document.createElement("div");
      footer.className = "block-footer";

      const toggleExpand = () => {
        if (expandedBlockIds.has(rec.id)) {
          expandedBlockIds.delete(rec.id);
        } else {
          expandedBlockIds.add(rec.id);
        }
        localStorage.setItem("EntryMemo.expandedBlocks", JSON.stringify(Array.from(expandedBlockIds)));
        renderBlocksList(blocks, entryHasError);
      };

      const openBtn = document.createElement("button");
      openBtn.className = "btn-secondary btn-sm";
      openBtn.textContent = isExpanded ? "閉じる" : "開く";
      openBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleExpand();
      });
      footer.appendChild(openBtn);

      titleSpan.addEventListener("click", (e) => {
        if (window.getSelection().toString()) return;
        toggleExpand();
      });

      if (!entryHasError) {
        const editBtn = document.createElement("button");
        editBtn.className = "btn-secondary btn-sm";
        editBtn.textContent = "編集";
        editBtn.addEventListener("click", () => {
          openBlockModal(rec);
        });
        footer.appendChild(editBtn);

        // レベル6未満の場合のみ「子ブロック追加」ボタンを追加
        if ((rec.level || 3) < 6) {
          const addChildBtn = document.createElement("button");
          addChildBtn.className = "btn-secondary btn-sm";
          addChildBtn.textContent = "子ブロック追加";
          addChildBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            openBlockModal(null, rec);
          });
          footer.appendChild(addChildBtn);
        }

        const moveBtn = document.createElement("button");
        moveBtn.className = "btn-secondary btn-sm";
        moveBtn.textContent = "移動";
        moveBtn.addEventListener("click", () => {
          openMoveModal(rec);
        });
        footer.appendChild(moveBtn);

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "btn-secondary btn-sm";
        deleteBtn.textContent = "削除";
        deleteBtn.style.color = "var(--color-error)";
        deleteBtn.addEventListener("click", () => {
          const subtree = Utils.getSubtreeBlocks(blocks, rec.id);
          const hasChildren = subtree.length > 1;
          
          let confirmMsg;
          if (hasChildren) {
            confirmMsg = t("confirmDeleteBlockWithChildren", "このブロック [${id}] には子ブロックが含まれています。\n削除すると、配下の子ブロックもすべて一緒に削除されます。\n\n本当に削除しますか？").replace("${id}", rec.id);
          } else {
            confirmMsg = t("confirmDeleteBlockId", "このブロック [${id}] を削除しますか？\n削除したブロックは元に戻せません。").replace("${id}", rec.id);
          }

          const confirmDelete = confirm(confirmMsg);
          if (confirmDelete) {
            const targetIdx = displayBlocks.findIndex(b => b.id === rec.id);
            if (targetIdx + 1 < displayBlocks.length) {
              lastFocusedBlockId = displayBlocks[targetIdx + 1].id;
            } else if (targetIdx > 0) {
              lastFocusedBlockId = displayBlocks[targetIdx - 1].id;
            } else {
              lastFocusedBlockId = "summary";
            }
            window.EntryMemo.App.handleDeleteBlock(rec.id);
          }
        });
        footer.appendChild(deleteBtn);
      }

      card.appendChild(footer);
      elements.blocksList.appendChild(card);

      // 閉じているブロックかつ子ブロックが存在する場合、子ブロックのプレビュースタックをカードの直後に挿入する
      const subtree = Utils.getSubtreeBlocks(blocks, rec.id);
      const hasChildren = subtree.length > 1;

      if (!isExpanded && hasChildren) {
        const stackContainer = document.createElement("div");
        stackContainer.className = "collapsed-children-stack";
        
        // 子孫ブロックの中から、最上位（最も浅いレベル）の子ブロックを抽出する
        const descendants = subtree.slice(1);
        const minLevel = Math.min(...descendants.map(b => b.level || 3));
        const previewBlocks = descendants.filter(b => (b.level || 3) === minLevel);
        
        // 最大3件を重ねる
        const displayPreviews = previewBlocks.slice(0, 3);
        displayPreviews.forEach((child, idx) => {
          const previewCard = document.createElement("div");
          previewCard.className = `collapsed-child-preview`;
          
          // CSS変数によるレイアウトと重なりの制御
          previewCard.style.setProperty("--stack-index", idx);
          previewCard.style.setProperty("--parent-level", rec.level || 3);
          
          const icon = document.createElement("span");
          icon.className = "collapsed-child-icon";
          icon.textContent = "↳ ";
          
          const titleSpan = document.createElement("span");
          titleSpan.className = "collapsed-child-title";
          titleSpan.textContent = child.title || child.body.trim().substring(0, 20) || "(タイトルなし)";
          
          previewCard.appendChild(icon);
          previewCard.appendChild(titleSpan);
          
          // プレビューをクリックした際は、親を展開し、この子ブロックへフォーカスを当てて再描画する
          previewCard.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            expandedBlockIds.add(rec.id);
            localStorage.setItem("EntryMemo.expandedBlocks", JSON.stringify(Array.from(expandedBlockIds)));
            lastFocusedBlockId = child.id;
            setTimeout(() => {
              renderBlocksList(blocks, entryHasError);
            }, 0);
          });
          
          stackContainer.appendChild(previewCard);
        });
        
        elements.blocksList.appendChild(stackContainer);
      }
    });

    // 最後に編集・追加・マージ・削除されたブロックがある場合、それにフォーカスを合わせる
    if (lastFocusedBlockId === "summary") {
      focusedBlockIndex = 0;
      lastFocusedBlockId = null;
    } else if (lastFocusedBlockId) {
      const targetIdx = displayBlocks.findIndex(b => b.id === lastFocusedBlockId);
      if (targetIdx !== -1) {
        focusedBlockIndex = targetIdx + 1; // 概要が 0 なので +1 する
      }
      lastFocusedBlockId = null;
    }

    // 再描画時にフォーカスインデックスを適用する
    if (focusedBlockIndex > blocks.length) {
      focusedBlockIndex = blocks.length;
    }
    if (focusedBlockIndex === 0) {
      if (elements.summarySection) {
        elements.summarySection.classList.add("focused");
      }
    } else if (focusedBlockIndex >= 1 && blocks.length > 0) {
      // テキスト入力中の場合は、ブロックカードへのフォーカス奪取をスキップ
      if (isTextInputActive()) return;

      const cards = elements.blocksList.querySelectorAll(".block-card");
      if (cards[focusedBlockIndex - 1]) {
        cards[focusedBlockIndex - 1].classList.add("focused");
        setTimeout(() => {
          if (isTextInputActive()) return;
          cards[focusedBlockIndex - 1].focus();
        }, 50);
      }
    }
  }

  /**
   * 現在の動作モード表示更新
   */
  function updateModeIndicator(isDemo, folderName = "", type = "local") {
    if (isDemo) {
      elements.currentModeBadge.textContent = t("demoMode", "デモモード");
      elements.currentModeBadge.className = "badge-demo";
      elements.openFolderBtn.style.display = "block";
      elements.openFolderBtn.textContent = "📁";
      elements.openFolderBtn.title = t("openFolder", "フォルダを開く");
    } else {
      if (type === "server") {
        elements.currentModeBadge.textContent = t("online", "オンライン");
        elements.currentModeBadge.className = "badge-server";
        elements.openFolderBtn.style.display = "block";
        elements.openFolderBtn.textContent = "📁";
        elements.openFolderBtn.title = t("openLocalFolder", "ローカルフォルダを開く");
      } else {
        elements.currentModeBadge.textContent = `${t("local", "ローカル")}: ${folderName}`;
        elements.currentModeBadge.className = "badge-local";
        elements.openFolderBtn.style.display = "block";
        elements.openFolderBtn.textContent = "📁";
        elements.openFolderBtn.title = t("openOtherFolder", "別のフォルダを開く");
      }
    }
  }

  /**
   * カテゴリー内のエントリー一覧の描画
   */
  function renderCategoryEntries(categoryName, entries) {
    elements.mainContent.style.display = "block";
    elements.entryDetailView.style.display = "none";
    elements.categoryEntriesView.style.display = "flex";
    
    focusedEntryIndex = -1;
    elements.categoryViewTitle.textContent = t(categoryName);
    elements.categoryEntriesList.innerHTML = "";
    
    elements.categoryEntriesList.className = "";
    
    // 表示モード切り替えボタンのテキストを現在の設定に応じて更新
    if (elements.toggleEntryListModeBtn) {
      elements.toggleEntryListModeBtn.textContent = currentEntryListViewMode === "group" ? t("viewModeGroup", "カテゴリー別 ↕") : t("viewModeFlat", "新着順（一列） ↕");
    }

    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "blocks-empty";
      empty.textContent = t("noEntries", "登録されたエントリーがありません。");
      elements.categoryEntriesList.appendChild(empty);
      return;
    }

    if (currentEntryListViewMode === "flat") {
      // --- カテゴリーの区別をなくして新着順（一列）にフラット表示 ---
      // ただし、ゴミ箱とゴミ箱に含まれるエントリーは別扱いにして一番下にカテゴリとして表示する
      const normalEntries = [];
      const trashEntries = [];
      let trashCategoryName = "ゴミ箱";

      entries.forEach(t => {
        const entryCategory = t.categoryName || categoryName;
        const isTrash = entryCategory === "ゴミ箱" || entryCategory === "trash";
        if (isTrash) {
          trashEntries.push(t);
          trashCategoryName = entryCategory;
        } else {
          normalEntries.push(t);
        }
      });

      if (normalEntries.length > 0) {
        const listDiv = document.createElement("div");
        listDiv.className = "inline-entry-list flat-list";
        
        normalEntries.forEach(t => {
          const item = document.createElement("a");
          item.className = "inline-entry-item";
          item.href = "#";
          const entryCategory = t.categoryName || categoryName;
          item.dataset.categoryName = entryCategory;
          item.dataset.fileName = t.fileName;

          // スター
          const star = document.createElement("span");
          star.className = "compact-entry-star";
          star.textContent = t.isFavorite ? "★" : "☆";
          star.addEventListener("click", (e) => {
            e.stopPropagation();
            e.preventDefault();
            window.EntryMemo.App.handleToggleFavorite(entryCategory, t.fileName);
          });
          star.style.marginRight = "6px";
          item.appendChild(star);

          // タイトル
          const title = document.createElement("span");
          title.className = "inline-entry-title";
          title.textContent = t.title;
          item.appendChild(title);

          item.addEventListener("click", (e) => {
            e.preventDefault();
            window.EntryMemo.App.handleSelectEntry(entryCategory, t.fileName);
          });

          listDiv.appendChild(item);
        });
        elements.categoryEntriesList.appendChild(listDiv);
      }

      if (trashEntries.length > 0) {
        const groupDiv = document.createElement("div");
        groupDiv.className = "inline-entry-group";

        const titleHeader = document.createElement("h4");
        titleHeader.className = "inline-entry-group-title";
        titleHeader.textContent = t(trashCategoryName);
        groupDiv.appendChild(titleHeader);

        const listDiv = document.createElement("div");
        listDiv.className = "inline-entry-list";

        trashEntries.forEach(t => {
          const item = document.createElement("a");
          item.className = "inline-entry-item";
          item.href = "#";
          const entryCategory = t.categoryName || categoryName;
          item.dataset.categoryName = entryCategory;
          item.dataset.fileName = t.fileName;

          // スター
          const star = document.createElement("span");
          star.className = "compact-entry-star";
          star.textContent = "🗑️";
          star.style.cursor = "default";
          star.style.marginRight = "6px";
          item.appendChild(star);

          // タイトル
          const title = document.createElement("span");
          title.className = "inline-entry-title";
          title.textContent = t.title;
          item.appendChild(title);

          item.addEventListener("click", (e) => {
            e.preventDefault();
            window.EntryMemo.App.handleSelectEntry(entryCategory, t.fileName);
          });

          listDiv.appendChild(item);
        });

        groupDiv.appendChild(listDiv);
        elements.categoryEntriesList.appendChild(groupDiv);
      }
      
    } else {
      // --- カテゴリーごとにグループ化して表示（デフォルト） ---
      const groups = {};
      entries.forEach(t => {
        const category = t.categoryName || categoryName;
        if (!groups[category]) {
          groups[category] = [];
        }
        groups[category].push(t);
      });

      const sortedCategories = Object.keys(groups).sort(window.EntryMemo.Utils.compareCategories);

      sortedCategories.forEach(category => {
        const groupDiv = document.createElement("div");
        groupDiv.className = "inline-entry-group";

        const titleHeader = document.createElement("h4");
        titleHeader.className = "inline-entry-group-title";
        titleHeader.textContent = t(category);
        groupDiv.appendChild(titleHeader);

        const listDiv = document.createElement("div");
        listDiv.className = "inline-entry-list";

        groups[category].forEach(t => {
          const item = document.createElement("a");
          item.className = "inline-entry-item";
          item.href = "#";
          item.dataset.categoryName = category;
          item.dataset.fileName = t.fileName;

          // スター
          const star = document.createElement("span");
          star.className = "compact-entry-star";
          const isTrash = category === "ゴミ箱" || category === "trash";
          if (isTrash) {
            star.textContent = "🗑️";
            star.style.cursor = "default";
          } else {
            star.textContent = t.isFavorite ? "★" : "☆";
            star.addEventListener("click", (e) => {
              e.stopPropagation();
              e.preventDefault();
              window.EntryMemo.App.handleToggleFavorite(category, t.fileName);
            });
          }
          star.style.marginRight = "6px";
          item.appendChild(star);

          // タイトル
          const title = document.createElement("span");
          title.className = "inline-entry-title";
          title.textContent = t.title;
          item.appendChild(title);

          item.addEventListener("click", (e) => {
            e.preventDefault();
            window.EntryMemo.App.handleSelectEntry(category, t.fileName);
          });

          listDiv.appendChild(item);
        });

        groupDiv.appendChild(listDiv);
        elements.categoryEntriesList.appendChild(groupDiv);
      });
    }
  }

  function updateFavoriteButton(isFav, categoryName = "") {
    const isTrash = categoryName === "ゴミ箱" || categoryName === "trash";
    if (isTrash) {
      elements.favoriteToggleBtn.textContent = "🗑️";
      elements.favoriteToggleBtn.classList.remove("active");
      elements.favoriteToggleBtn.disabled = true;
      elements.favoriteToggleBtn.title = "ゴミ箱に入っているためお気に入りに追加できません";
    } else {
      elements.favoriteToggleBtn.disabled = false;
      elements.favoriteToggleBtn.title = t("favoriteTooltip", "お気に入り（Pickup）に追加/解除 (S)");
      if (isFav) {
        elements.favoriteToggleBtn.textContent = "★";
        elements.favoriteToggleBtn.classList.add("active");
      } else {
        elements.favoriteToggleBtn.textContent = "☆";
        elements.favoriteToggleBtn.classList.remove("active");
      }
    }
  }

  function updateSortBlocksBtnText() {
    if (elements.sortBlocksBtn) {
      elements.sortBlocksBtn.textContent = currentSortOrder === "asc" ? t("sortAsc", "昇順 ↕") : t("sortDesc", "降順 ↕");
    }
  }

  function updateMergeActionBar() {
    const checkedBoxes = elements.blocksList.querySelectorAll(".block-select-checkbox:checked");
    const count = checkedBoxes.length;
    
    if (count > 0) {
      elements.mergeCountText.textContent = t("mergeCountText", "${count} 件のブロックを選択中").replace("${count}", count);
      elements.mergeActionBar.style.display = "flex";
    } else {
      elements.mergeActionBar.style.display = "none";
    }
  }

  return {
    init,
    t,
    updateLanguageUI,
    showToast,
    showLoading,
    hideLoading,
    closeModal,
    renderSidebar,
    renderCurrentEntry,
    renderCategoryEntries,
    updateFavoriteButton,
    updateMergeActionBar,
    updateModeIndicator,
    openMarkdownPreviewPanel,
    closeMarkdownPreviewPanel,
    setFocusedBlockId
  };
})();
