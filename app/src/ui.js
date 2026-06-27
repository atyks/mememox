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

  // 入力フォームがアクティブかどうかを判定する関数
  const isTextInputActive = () => {
    const activeEl = document.activeElement;
    if (!activeEl) return false;
    const tag = activeEl.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || activeEl.isContentEditable;
  };

  /**
   * UIの初期化
   */
  function init() {
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
      summaryTextarea: document.getElementById("summary-textarea"),
      summarySaveBtn: document.getElementById("summary-save-btn"),
      summaryCancelBtn: document.getElementById("summary-cancel-btn"),
      
      // ブロック一覧
      blocksList: document.getElementById("blocks-list"),
      addBlockBtnTop: document.getElementById("add-block-btn-top"),
      
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
      toastContainer: document.getElementById("toast-container")
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
    elements.modalOverlay.style.display = "none";
    elements.blockModal.style.display = "none";
    elements.moveModal.style.display = "none";
    elements.newEntryModal.style.display = "none";
    if (elements.editEntryModal) {
      elements.editEntryModal.style.display = "none";
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

    // ヘルプ（共通ヘッダーボタン）
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
      if (!title) {
        showToast("エントリー名を入力してください。", "warning");
        return;
      }

      let category = "";
      if (elements.newEntryNewCategoryOption.checked) {
        category = elements.newEntryNewCategoryInput.value.trim();
        if (!category) {
          showToast("新しいカテゴリー名を入力してください。", "warning");
          return;
        }
      } else {
        category = elements.newEntryCategorySelect.value;
        if (!category) {
          showToast("作成先のカテゴリーを選択してください。", "warning");
          return;
        }
      }

      closeModal();
      await window.EntryMemo.App.handleCreateEntry(category, title);
    });

    // 概要の編集開始
    elements.summaryEditBtn.addEventListener("click", () => {
      const currentEntry = window.EntryMemo.App.getCurrentEntry();
      if (!currentEntry || currentEntry.hasError) return;
      
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
      const newValue = elements.summaryTextarea.value;
      await window.EntryMemo.App.handleSaveSummary(newValue);
      elements.summaryDisplayArea.style.display = "block";
      elements.summaryEditorArea.style.display = "none";
      elements.summaryTextarea.style.height = "auto";
    });

    // テキストエリア自動高さ調整リスナー
    elements.summaryTextarea.addEventListener("input", (e) => {
      adjustTextareaHeight(e.target);
    });
    elements.blockInputBody.addEventListener("input", (e) => {
      adjustTextareaHeight(e.target);
    });

    // ブロック追加ボタン
    const triggerAddBlock = () => {
      const currentEntry = window.EntryMemo.App.getCurrentEntry();
      if (!currentEntry || currentEntry.hasError) {
        showToast("このエントリーにはブロックを追加できません。", "warning");
        return;
      }
      openBlockModal(null);
    };
    elements.addBlockBtnTop.addEventListener("click", triggerAddBlock);

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
      if (!newTitle) {
        showToast("エントリータイトルを入力してください。", "warning");
        return;
      }

      let targetCategory = "";
      if (elements.editEntryNewCategoryOption.checked) {
        targetCategory = elements.editEntryNewCategoryInput.value.trim();
        if (!targetCategory) {
          showToast("新しいカテゴリー名を入力してください。", "warning");
          return;
        }
      } else {
        targetCategory = elements.editEntryCategorySelect.value;
      }

      closeModal();
      await window.EntryMemo.App.handleEditEntry(
        currentEntry.categoryName, 
        currentEntry.fileName, 
        targetCategory, 
        newTitle
      );
    });

    // ブロック保存ボタン（モーダル内）
    elements.blockModalSaveBtn.addEventListener("click", async () => {
      const title = elements.blockInputTitle.value.trim();
      const body = elements.blockInputBody.value;
      const editingBlockId = elements.blockModal.dataset.editingBlockId;
      
      closeModal();
      if (editingBlockId) {
        await window.EntryMemo.App.handleUpdateBlock(editingBlockId, title, body);
      } else {
        await window.EntryMemo.App.handleCreateBlock(title, body);
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

    // 移動先のカテゴリーが選択されたら、そのカテゴリーのエントリー一覧をプルダウンに反映する
    elements.moveTargetCategory.addEventListener("change", async (e) => {
      await updateMoveModalEntries(e.target.value);
    });

    // 移動モーダル実行
    elements.moveModalSubmitBtn.addEventListener("click", async () => {
      const blockId = elements.moveModal.dataset.blockId;
      if (!blockId) return;

      const isNewEntry = elements.moveNewEntryOption.checked;
      
      if (isNewEntry) {
        const category = elements.moveNewEntryCategory.value;
        let entryName = elements.moveNewEntryName.value.trim();
        if (!entryName) {
          const currentEntry = window.EntryMemo.App.getCurrentEntry();
          const sourceBlock = currentEntry ? currentEntry.blocks.find(r => r.id === blockId) : null;
          entryName = sourceBlock ? sourceBlock.title : "無題のエントリー";
        }
        closeModal();
        await window.EntryMemo.App.handleMoveBlockToNewEntry(blockId, category, entryName);
      } else {
        const category = elements.moveTargetCategory.value;
        const fileName = elements.moveTargetEntry.value;
        if (!fileName) {
          showToast("移動先のエントリーを選択してください。", "warning");
          return;
        }
        closeModal();
        await window.EntryMemo.App.handleMoveBlock(blockId, category, fileName);
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
              showToast("Markdownをクリップボードにコピーしました。", "success");
            })
            .catch((err) => {
              showToast(`コピーに失敗しました: ${err.message}`, "error");
            });
        } else {
          elements.markdownPreviewTextarea.select();
          try {
            document.execCommand("copy");
            showToast("Markdownをクリップボードにコピーしました。", "success");
          } catch (err) {
            showToast("コピーに失敗しました。手動でコピーしてください。", "error");
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

    // 左右スワイプジェスチャーの登録 (トグル遷移)
    let touchStartX = 0;
    let touchStartY = 0;
    if (elements.mainContent) {
      elements.mainContent.addEventListener("touchstart", (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
      }, { passive: true });

      elements.mainContent.addEventListener("touchend", (e) => {
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        
        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;
        
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 80) {
          if (isTextInputActive()) return;

          // 左右どちらのスワイプでも、同じ動作（画面トグル）を行う
          window.EntryMemo.App.handleSwipeToggle();
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
          const confirmDelete = confirm(`選択された ${checkedBoxes.length} 個のブロックを削除しますか？\n削除したブロックは元に戻せません。`);
          if (confirmDelete) {
            const blockIds = checkedBoxes.map(cb => cb.dataset.recordId);
            const currentEntry = window.EntryMemo.App.getCurrentEntry();
            if (currentEntry) {
              const displayBlocks = currentSortOrder === "desc" ? [...currentEntry.blocks].reverse() : currentEntry.blocks;
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
      if (e.code === "Slash" && e.shiftKey && !inputActive) {
        e.preventDefault();
        toggleHelpPanel();
        return;
      }

      // S キーでのお気に入り（Pickup）トグル
      if ((e.key === "s" || e.key === "S") && !inputActive && !isModalOpen && !isSummaryEditing) {
        if (elements.entryDetailView.style.display === "flex") {
          const currentEntry = window.EntryMemo.App.getCurrentEntry();
          if (currentEntry) {
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

      // Ctrl または Cmd を伴うショートカット
      if (e.ctrlKey || e.metaKey) {
        if (e.code === "KeyH") {
          if (!inputActive && !isModalOpen && !isSummaryEditing) {
            e.preventDefault();
            window.EntryMemo.App.showAllEntriesListView();
            return;
          }
        }

        if (e.code === "KeyL") {
          if (!inputActive && !isModalOpen && !isSummaryEditing) {
            e.preventDefault();
            window.EntryMemo.App.handleSwipeToggle();
            return;
          }
        }

        if (e.code === "KeyA") {
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

        if (e.code === "KeyD") {
          if (!inputActive && !isModalOpen && !isSummaryEditing) {
            if (performBatchDelete()) {
              e.preventDefault();
            }
            return;
          }
        }

        if (e.code === "KeyP") {
          // Ctrl + P: Markdown表示/非表示 (トグル)
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

        if (e.code === "Enter") {
          if (!isModalOpen && !isSummaryEditing) {
            if (elements.entryDetailView.style.display === "flex") {
              e.preventDefault();
              triggerAddBlock();
            }
          }
        } else if (e.code === "KeyC") {
          // テキスト選択がある場合は、標準の「コピー」挙動を優先する
          const hasSelection = window.getSelection().toString().length > 0;
          if (!hasSelection && !inputActive && !isModalOpen && !isSummaryEditing) {
            e.preventDefault();
            openNewEntryModal();
          }
        } else if (e.code === "KeyO") { // Ctrl + O フォルダ選択
          e.preventDefault();
          elements.openFolderBtn.click();
        } else if (e.code === "KeyE") { // Ctrl + E エントリーの編集
          if (!isModalOpen && !isSummaryEditing) {
            e.preventDefault();
            openEditEntryModal();
          }
        } else if (e.code === "KeyI") { // Ctrl + I 概要編集
          if (!isModalOpen && !isSummaryEditing && elements.summaryEditBtn.style.display !== "none") {
            e.preventDefault();
            elements.summaryEditBtn.click();
            setTimeout(() => elements.summaryTextarea.focus(), 50);
          }
        } else if (e.code === "KeyM") { // Ctrl + M マージ
          if (!isModalOpen && !isSummaryEditing) {
            e.preventDefault();
            elements.mergeSubmitBtn.click();
          }
        } else if (e.code === "KeyH") { // Ctrl + H 一番最初の画面に戻る
          if (!isModalOpen && !isSummaryEditing) {
            e.preventDefault();
            window.EntryMemo.App.showAllEntriesListView();
          }
        } else if (e.code === "KeyJ") { // Ctrl + J カテゴリーの移動、またはエントリー一覧ビューへ
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
        } else if (e.code === "KeyK") { // Ctrl + K カテゴリーの移動、またはエントリー一覧ビューへ
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
      } else if (e.altKey) { // Alt を伴うショートカット
        if (e.code === "ArrowDown" || e.key === "ArrowDown" || e.key === "Down") {
          e.preventDefault();
          window.EntryMemo.App.handleNavigateEntry("next");
        } else if (e.code === "ArrowUp" || e.key === "ArrowUp" || e.key === "Up") {
          e.preventDefault();
          window.EntryMemo.App.handleNavigateEntry("prev");
        } else if (e.code === "ArrowLeft" || e.key === "ArrowLeft" || e.key === "Left") {
          e.preventDefault();
          window.EntryMemo.App.handleToggleView("board");
        } else if (e.code === "ArrowRight" || e.key === "ArrowRight" || e.key === "Right") {
          e.preventDefault();
          window.EntryMemo.App.handleToggleView("thread");
        }
      } else { // 修飾キーなし (通常のキー)
        if (!inputActive && !isModalOpen && !isSummaryEditing) {
          if (isCategoryViewActive) {
            // --- カテゴリーのエントリー一覧画面でのキー操作 ---
            const cards = elements.categoryEntriesList.querySelectorAll(".inline-entry-item");
            if (e.code === "KeyJ") {
              e.preventDefault();
              navigateEntryCardFocus("next");
            } else if (e.code === "KeyK") {
              e.preventDefault();
              navigateEntryCardFocus("prev");
            } else if (e.code === "Enter") {
              if (focusedEntryIndex >= 0 && focusedEntryIndex < cards.length) {
                e.preventDefault();
                cards[focusedEntryIndex].click();
              }
            } else if ((e.code === "KeyD" && e.shiftKey) || e.code === "Delete") {
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

            if (e.code === "KeyJ") {
              e.preventDefault();
              navigateCardFocus("next");
            } else if (e.code === "KeyK") {
              e.preventDefault();
              navigateCardFocus("prev");
            } else if (e.code === "Space") {
              if (focusedBlockIndex >= 1 && focusedBlockIndex <= cards.length) {
                e.preventDefault();
                const targetCard = cards[focusedBlockIndex - 1];
                const openBtn = targetCard.querySelector(".block-footer button:first-child");
                if (openBtn) openBtn.click();
              }
            } else if (e.code === "Enter" || e.code === "KeyE") {
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
            } else if (e.code === "KeyM") {
              if (focusedBlockIndex >= 1 && focusedBlockIndex <= cards.length) {
                e.preventDefault();
                const targetCard = cards[focusedBlockIndex - 1];
                const moveBtn = Array.from(targetCard.querySelectorAll(".block-footer button")).find(b => b.textContent === "移動");
                if (moveBtn) moveBtn.click();
              }
            } else if (e.code === "KeyD") {
              if (performBatchDelete()) {
                e.preventDefault();
              } else if (focusedBlockIndex >= 1 && focusedBlockIndex <= cards.length) {
                e.preventDefault();
                const targetCard = cards[focusedBlockIndex - 1];
                const deleteBtn = Array.from(targetCard.querySelectorAll(".block-footer button")).find(b => b.textContent === "削除");
                if (deleteBtn) deleteBtn.click();
              }
            } else if (e.code === "KeyX") {
              if (focusedBlockIndex >= 1 && focusedBlockIndex <= cards.length) {
                e.preventDefault();
                const targetCard = cards[focusedBlockIndex - 1];
                const cb = targetCard.querySelector(".block-select-checkbox");
                if (cb) {
                  cb.checked = !cb.checked;
                  updateMergeActionBar();
                }
              }
            } else if ((e.code === "KeyD" && e.shiftKey) || e.code === "Delete") {
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
      if ((e.ctrlKey || e.metaKey)) {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
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

      const confirmMerge = confirm(`選択された ${count} 件のブロックを1つにマージしますか？\nマージ後は元の各ブロックの見出しレベルが1段下がり、現在のエントリー内で1つのブロックに統合されます。`);
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
    const cards = elements.blocksList.querySelectorAll(".block-card");
    const totalCount = cards.length + 1;

    if (focusedBlockIndex === 0) {
      if (elements.summarySection) {
        elements.summarySection.classList.remove("focused");
      }
    } else if (focusedBlockIndex >= 1 && focusedBlockIndex <= cards.length) {
      const prevCard = cards[focusedBlockIndex - 1];
      if (prevCard) prevCard.classList.remove("focused");
    }

    if (focusedBlockIndex === -1) {
      if (direction === "next") {
        focusedBlockIndex = 0;
      } else {
        focusedBlockIndex = cards.length;
      }
    } else {
      if (direction === "next") {
        focusedBlockIndex++;
        if (focusedBlockIndex >= totalCount) {
          focusedBlockIndex = 0;
        }
      } else if (direction === "prev") {
        focusedBlockIndex--;
        if (focusedBlockIndex < 0) {
          focusedBlockIndex = cards.length;
        }
      }
    }

    if (focusedBlockIndex === 0) {
      if (elements.summarySection) {
        elements.summarySection.classList.add("focused");
        elements.summarySection.setAttribute("tabindex", "-1");
        elements.summarySection.focus();
      }
    } else if (focusedBlockIndex >= 1 && focusedBlockIndex <= cards.length) {
      const targetCard = cards[focusedBlockIndex - 1];
      if (targetCard) {
        targetCard.classList.add("focused");
        targetCard.setAttribute("tabindex", "-1");
        targetCard.focus();
      }
    }
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
  function openBlockModal(block = null) {
    if (block) {
      elements.blockModalTitle.textContent = "ブロックを編集";
      elements.blockModal.dataset.editingBlockId = block.id;
      elements.blockInputTitle.value = block.title;
      elements.blockInputBody.value = block.body;
    } else {
      elements.blockModalTitle.textContent = "ブロックを追加";
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
    const currentEntry = App.getCurrentEntry();

    let options = [];
    for (const entry of entries) {
      const isSelf = currentEntry && currentEntry.categoryName === categoryName && currentEntry.fileName === entry.fileName;
      if (isSelf) continue;

      try {
        const md = await App.storage.readEntry(categoryName, entry.fileName);
        const parsed = Markdown.parseEntry(md);
        if (parsed.errors.length === 0) {
          options.push(`<option value="${Utils.escapeHtml(entry.fileName)}">${Utils.escapeHtml(parsed.title || entry.fileName)}</option>`);
        }
      } catch (e) {
      }
    }

    if (options.length === 0) {
      elements.moveTargetEntry.innerHTML = `<option value="">(移動可能なエントリーがありません)</option>`;
    } else {
      elements.moveTargetEntry.innerHTML = options.join("");
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

    await updateMoveModalEntries(elements.moveTargetCategory.value);
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
    
    updateFavoriteButton(entryData.isFavorite);
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

    const categoryPrefix = entryData.categoryName ? `${entryData.categoryName} ＞ ` : "";
    elements.currentEntryTitle.textContent = categoryPrefix + (entryData.title || entryData.fileName);
    if (isNewLoad) {
      setTimeout(() => {
        elements.currentEntryTitle.focus();
      }, 50);
    }

    // 概要の表示
    if (entryData.summary) {
      elements.summaryText.textContent = entryData.summary;
      elements.summaryText.style.display = "block";
    } else {
      elements.summaryText.textContent = "(概要は設定されていません)";
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
      emptyDiv.textContent = "ブロックはありません。";
      elements.blocksList.appendChild(emptyDiv);
      return;
    }

    const displayBlocks = currentSortOrder === "desc" ? [...blocks].reverse() : blocks;

    displayBlocks.forEach(rec => {
      const card = document.createElement("div");
      card.className = "block-card";
      card.id = `block-card-${rec.id}`;

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
        if (fullTextPre.style.display === "none") {
          fullTextPre.style.display = "block";
          textDiv.style.display = "none";
          openBtn.textContent = "閉じる";
          card.classList.add("expanded");
          expandedBlockIds.add(rec.id);
        } else {
          fullTextPre.style.display = "none";
          textDiv.style.display = "block";
          openBtn.textContent = "開く";
          card.classList.remove("expanded");
          expandedBlockIds.delete(rec.id);
        }
        localStorage.setItem("EntryMemo.expandedBlocks", JSON.stringify(Array.from(expandedBlockIds)));
      };

      const openBtn = document.createElement("button");
      openBtn.className = "btn-secondary btn-sm";
      openBtn.textContent = isExpanded ? "閉じる" : "開く";
      openBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleExpand();
      });
      footer.appendChild(openBtn);

      card.addEventListener("click", (e) => {
        const targetTag = e.target.tagName.toLowerCase();
        if (targetTag === "button" || targetTag === "input" || targetTag === "a" || window.getSelection().toString()) {
          return;
        }
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
          const confirmDelete = confirm(`このブロック [${rec.id}] を削除しますか？\n削除したブロックは元に戻せません。`);
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
      elements.currentModeBadge.textContent = "デモモード";
      elements.currentModeBadge.className = "badge-demo";
      elements.openFolderBtn.style.display = "block";
      elements.openFolderBtn.textContent = "📁";
      elements.openFolderBtn.title = "フォルダを開く";
    } else {
      if (type === "server") {
        elements.currentModeBadge.textContent = "オンライン";
        elements.currentModeBadge.className = "badge-server";
        elements.openFolderBtn.style.display = "block";
        elements.openFolderBtn.textContent = "📁";
        elements.openFolderBtn.title = "ローカルフォルダを開く";
      } else {
        elements.currentModeBadge.textContent = `ローカル: ${folderName}`;
        elements.currentModeBadge.className = "badge-local";
        elements.openFolderBtn.style.display = "block";
        elements.openFolderBtn.textContent = "📁";
        elements.openFolderBtn.title = "別のフォルダを開く";
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
    elements.categoryViewTitle.textContent = categoryName;
    elements.categoryEntriesList.innerHTML = "";
    
    elements.categoryEntriesList.className = "";
    
    // 表示モード切り替えボタンのテキストを現在の設定に応じて更新
    if (elements.toggleEntryListModeBtn) {
      elements.toggleEntryListModeBtn.textContent = currentEntryListViewMode === "group" ? "カテゴリー別 ↕" : "新着順（一列） ↕";
    }

    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "blocks-empty";
      empty.textContent = "登録されたエントリーがありません。";
      elements.categoryEntriesList.appendChild(empty);
      return;
    }

    if (currentEntryListViewMode === "flat") {
      // --- カテゴリーの区別をなくして新着順（一列）にフラット表示 ---
      const listDiv = document.createElement("div");
      listDiv.className = "inline-entry-list flat-list";
      
      entries.forEach(t => {
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
        star.style.marginRight = "6px";
        star.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          window.EntryMemo.App.handleToggleFavorite(entryCategory, t.fileName);
        });
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
        titleHeader.textContent = category;
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
          star.textContent = t.isFavorite ? "★" : "☆";
          star.style.marginRight = "6px";
          star.addEventListener("click", (e) => {
            e.stopPropagation();
            e.preventDefault();
            window.EntryMemo.App.handleToggleFavorite(category, t.fileName);
          });
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

  function updateFavoriteButton(isFav) {
    if (isFav) {
      elements.favoriteToggleBtn.textContent = "★";
      elements.favoriteToggleBtn.classList.add("active");
    } else {
      elements.favoriteToggleBtn.textContent = "☆";
      elements.favoriteToggleBtn.classList.remove("active");
    }
  }

  function updateSortBlocksBtnText() {
    if (elements.sortBlocksBtn) {
      elements.sortBlocksBtn.textContent = currentSortOrder === "asc" ? "昇順 ↕" : "降順 ↕";
    }
  }

  function updateMergeActionBar() {
    const checkedBoxes = elements.blocksList.querySelectorAll(".block-select-checkbox:checked");
    const count = checkedBoxes.length;
    
    if (count > 0) {
      elements.mergeCountText.textContent = `${count} 件のブロックを選択中`;
      elements.mergeActionBar.style.display = "flex";
    } else {
      elements.mergeActionBar.style.display = "none";
    }
  }

  return {
    init,
    showToast,
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
