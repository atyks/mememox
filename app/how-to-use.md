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

### 📝 Block Cards
* Each individual note block displays as a discrete card.
* Creating a block assigns a unique alphanumeric ID (e.g., `[a73bc]`) and a creation timestamp automatically.
* Textareas auto-expand and collapse in real-time.

### ⭐ Favorites Syncing
* Note favorites (★/☆ toggles) automatically sync. They save to the browser's LocalStorage in local mode, and synchronize to the server's `favorites.json` in Server Mode.

### 🔄 Fast Sync & Reload
* Server Mode caches all files inside the browser to keep navigation instantaneous.
* Sync updates by clicking the reload button (🔄) in the header, or pulling the viewport downwards (**Pull-to-refresh**) on mobile screens.

### 🗺️ Breadcrumb Links
* The details page header renders a 3-tier breadcrumb: `All ＞ [Category Name] ＞ [Entry Title]`. Click a parent tier to jump back to its respective list.

### 🗑️ Relocating & Guarding Trash
* Deleting an entry relocates the Markdown file to the **`Trash`** (or `ゴミ箱`) category directory instead of erasing it permanently.
* Entries under the Trash category cannot be favorited; their stars change to a disabled 🗑️ trash bin icon.
* Deleting a note while it is inside the Trash category triggers a confirmation prompt to erase the file permanently.

### ✏️ Editing Entries (Relocate & Rename)
* Modifying an entry's title rewrites the file's H1 title and renames the physical `.md` filename on disk.
* Re-categorize entries by choosing a category from the dropdown or typing a new folder name to relocate them instantly.

### 🤝 Merging Blocks
* Merge multiple blocks (using checkboxes) to extract them into a new entry or append them to an existing entry.
* Original block headers automatically demote by one level upon export. The source block remains untouched until the target save is fully verified.

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
* `M` (Checked blocks) : Execute block merge directly

### D. Inside Modals
* `Ctrl + Enter` : Save changes and close modal
* `Esc` : Close modal without saving changes

---

## ⚠️ Known Constraints
* Designed and optimized for Chromium-based web browsers (Microsoft Edge, Google Chrome).
* Custom files that do not adhere to the designated Markdown format (H1 title, `## Summary`, `## Block`, and metadata comments on H3 headers) will open in **Read-Only Mode**.
