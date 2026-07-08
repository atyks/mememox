# mememox User Manual

[English](how-to-use.md) | [日本語 (Japanese)](how-to-use.ja.md)

`mememox` is a keyboard-friendly and touch-optimized personal note application designed to manage, browse, and edit your Markdown files directly in the browser.

Unlike typical chat tools where chronological logs bury conclusions, `mememox` keeps a "Summary" pinned at the top of each entry, letting you compile thoughts and logs in card-like "Blocks" below.

> [!NOTE]
> **Keyboard Shortcut Customization**
> The keyboard shortcuts documented in this manual are the **default configurations**.
> If you have overridden key assignments using `app/src/keymaps.js`, please read the shortcuts accordingly.
> The shortcut help panel (opened with the `?` key) inside the app automatically renders and displays your custom keys in real-time.

---

## 🚀 Getting Started

The app runs either as a static local frontend or connected to a secure web server.

1. **Local Use (Demo Mode / Local Directory)**
   * Open `index.html` directly in your Chromium-based browser (Microsoft Edge, Google Chrome, etc.).
   * The app boots into **Demo Mode** by default.
   * To open and manage actual files on your PC, click the folder button (📁) at the top-right and select your notes directory. (Requires File System Access API support).
2. **Server Integration (Server Mode)**
   * Deploying the app on a web server and accessing it via `http`/`https` automatically activates **Server Mode**.
   * Server Mode leverages ultra-fast in-memory cache synchronization to read/write notes and favorites across devices.

---

## 📁 Standard Directory Structure

When working with actual files on disk, the system reads and generates the following folder structure:

```text
Root Directory/
├─ inbox/
│  └─ inbox.md             (Scratchpad / temporary notes)
├─ thinking/
│  ├─ entry-memo-system.md
│  └─ pkm-and-markdown.md  (Brainstorming entries)
├─ work/
│  └─ work-memo-environment.md (Worklogs)
├─ Trash/                  (Category where deleted notes are moved)
└─ favorites.json          (Favorited items index under Server Mode)
```

---

## ✨ Key Features

### 📌 Summary Section
* Pinned at the top of each entry, the Summary records current directions, pending items, or final decisions.
* Textareas **autosize dynamically** based on text length to eliminate scroll bars inside inputs.

### 🧱 Hierarchical Blocks & Accordion (Collapse)
* Blocks are rendered in a nested hierarchical tree based on heading levels (H3 to H6) with automatic indentation.
* Click the "Open/Close" button or the card itself (or shortcut `Space` key) to collapse nested child blocks.
* Keyboard navigation (J/K keys) automatically skips collapsed (hidden) child cards.

### 🎴 3D Card Stack Preview
* When a parent block is collapsed, its nested child blocks (up to 3) are visually stacked behind the parent card in a 3D design layout.
* The titles of the collapsed child blocks peek through from behind. Clicking a preview card automatically expands the parent block and focuses the child block immediately.

### 📝 Block Cards
* Creating a block assigns a unique alphanumeric ID (e.g., `[a73bc]`) and a creation timestamp automatically.
* When adding a "child block" (`Shift + Enter` or cards action button), it is automatically created at one level deeper (H4 to H6) relative to the parent block.
* Textareas auto-expand and collapse in real-time.

### ⭐ Favorites Syncing
* Note favorites (★/☆ toggles) automatically sync. They save to the browser's LocalStorage in local mode, and synchronize to the server's `favorites.json` in Server Mode.

### 🔄 Fast Sync & Reload
* Server Mode caches all files inside the browser to keep navigation instantaneous.
* Sync updates by clicking the reload button (🔄) in the header, or pulling the viewport downwards (**Pull-to-refresh**) on mobile screens.

### 🗺️ Breadcrumb Links
* The details page header renders a 3-tier breadcrumb: `All ＞ [Category Name] ＞ [Entry Title]`. Click a parent tier to jump back to its respective list.

### 🗑️ Relocating & Guarding Trash / Deletion Warnings
* **Entry Deletion**: Deleting an entry relocates the Markdown file to the **`Trash`** category instead of erasing it permanently.
* **Block Deletion Warnings**: Deleting or batch-deleting parent blocks that contain child blocks triggers a warning dialog: "Nested child blocks will also be deleted." Confirming will recursively erase child blocks to prevent orphaned data.

### ✏️ Editing Entries (Relocate & Rename)
* Modifying an entry's title rewrites the file's H1 title and renames the physical `.md` filename on disk.
* Re-categorize entries by choosing a category from the dropdown or typing a new folder name to relocate them instantly.

### 🤝 Relocating & Merging Blocks
* **Block Movement**: Relocate block cards to another position (as a child block) or a different entry. Moving parent blocks carries over the entire nested child blocks hierarchy and automatically shifts levels.
* **Merging Blocks**: Merge multiple blocks to extract them into a new entry or append them to an existing entry. Source nested child blocks are safely merged into the merged block's body (with headings demoted) and cleaned up from the source entry.

### 📱 Swipe Gestures
* On touch-capable mobile devices, swipe left or right across the main content area (minimum 80px transition) to toggle between the list and detail views. Gestures are disabled when inputs are focused.

---

## ⌨️ Keyboard Navigation

Press `?` (Shift + `/`) on your keyboard outside of input fields to open the shortcut helper panel on the right.

### A. Navigation
* `?` : Toggles the help panel
* `Ctrl + \` : Toggles the left sidebar
* `Alt + ↑` / `↓` : Switch to next/prev favorited entry
* `Alt + ←` / `→` : Toggle between detail view and category list view
* `Ctrl + O` : Open local folder picker

### B. Core Operations
* `Ctrl + C` : Open the new entry modal
  * ※ Normal text copy takes precedence when text is selected or an input is active.
* `Ctrl + E` : Edit current entry (renaming title or moving category)
* `Shift + D` / `Delete` : Delete current entry (relocates to Trash, or deletes permanently if inside Trash)
* `Ctrl + Enter` / `A` (except inputs) : Open the add block modal
* `Shift + Enter` : Open the add child block modal under the selected block
* `Ctrl + I` : Edit the Summary section directly
* `Ctrl + H` : Navigate back to the parent category list
* `Ctrl + J` / `K` : Switch category view (next/prev)

### C. Element Focus (Using J/K navigation)
* `J` / `K` : Select next/prev card (loops at bounds)
* `Space` : Expand or collapse the selected block card
* `Enter` :
  * On a block card ──> Edit the selected block card
  * On a summary card ──> Edit the Summary section
* `M` (Unchecked blocks) : Relocate selected block card to another entry
* `D` : Delete the selected block card
* `X` : Toggle block selection for merging
* `O` : Expand all blocks/child blocks
* `C` : Collapse all blocks/child blocks
* `Shift + O` : Expand all nested child blocks under the selected block
* `Shift + C` : Collapse all nested child blocks under the selected block
* `M` (Checked blocks) : Execute block merge directly

### D. Inside Modals
* `Ctrl + Enter` : Save changes and close modal
* `Esc` : Close modal without saving changes

---

## ⚠️ Known Constraints
* Designed and optimized for Chromium-based web browsers (Microsoft Edge, Google Chrome).
* Custom files that do not adhere to the designated Markdown format (H1 title, `## Summary`, `## Block`, and metadata comments on H3 headers) will open in **Read-Only Mode**.
* The maximum nesting depth is Level 6 (H6). You cannot create child blocks under a Level 6 block, and any card movements that would result in Level 7 or deeper are restricted.
