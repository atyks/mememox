# mememox System Specification

English | [日本語 (Japanese)](specification.ja.md)

This document defines the system design, architecture, and behavioral specifications for `mememox`—a lightweight, secure note system structured around a card-based block format using Markdown files as the datastore.

> [!NOTE]
> **Keyboard Shortcut Customization**
> The keyboard shortcuts documented in this file are the **default configurations**.
> The application can dynamically load custom key assignments from `app/src/keymaps.js`.
> When customizations are present, the shortcut help panel (opened with the `?` key) will automatically render and display the user's custom shortcuts.

---

## 1. System Overview & Basic Concepts

`mememox` is a personal knowledge management (PKM) tool designed to consolidate "current conclusions/directions (summary)" and "chronological thinking logs (blocks)" under one entry to prevent information from getting buried or outdated.

### Key Features
1. **Markdown-Based**: All notes are stored as plain text files complying with specific Markdown structural rules.
2. **Hybrid Storage**:
   * **Demo Mode**: Test application features instantly inside browser memory.
   * **Local Folder Integration**: Uses the File System Access API to read/write local PC directories directly.
   * **Server Mode**: Connects to a secure, isolated server API, enabling fast cached note synchronization across devices.
3. **Keyboard & Mobile Optimized**: Provides rich keyboard navigation alongside swipe gestures and Pull-to-refresh for mobile environments.

---

## 2. Directory Structure

The repository has the following file layout:

```text
/
├─ app/                     (Frontend Static Web Application)
│  ├─ index.html            (Main HTML template)
│  ├─ style.css             (UI styles, themes, and animations)
│  ├─ app.js                (Main control and app state logic)
│  ├─ how-to-use.md         (User Manual - English)
│  ├─ how-to-use.ja.md      (User Manual - Japanese)
│  ├─ fixtures/
│  │  └─ demo-data.js       (Default mock data for Demo Mode)
│  └─ src/
│     ├─ utils.js           (Common helpers and sanitizers)
│     ├─ markdown.js        (Markdown parser and serializer)
│     ├─ storage.js         (Storage interfaces: Demo/FileSystem/Server)
│     └─ ui.js              (DOM events, gesture handler, and shortcut dispatch)
├─ util/                    (API folder - ignored in git)
├─ specification_for_api.md (Server-side API Guideline - English)
├─ specification_for_api.ja.md (Server-side API Guideline - Japanese)
├─ README.md                (Project Setup Readme - English)
├─ README.ja.md             (Project Setup Readme - Japanese)
├─ specification.md         (System Specification Sheet - English)
└─ specification.ja.md      (System Specification Sheet - Japanese)
```

---

## 3. Markdown Data Structure (Standard Format)

In order for the system to parse, serialize, and edit files correctly, entries must comply with the following Markdown structure. Any file violating this format will be treated as **"Read-Only"** and prompt an error banner.

### Standard Entry Template

```markdown
# [Entry Title]

## Summary (or any custom header)

[Summary contents, bullets, and paragraphs go here]

## Block

### [Block Title (Optional)] <!-- [blockId] [YYYY-MM-DD HH:mm:ss] -->
[Block card contents (multiline Markdown)]

### [Another Block Title] <!-- [blockId] [YYYY-MM-DD HH:mm:ss] -->
[Block card contents]
```

### Parser & Validation Rules
1. **H1 Title**: Files must start with a level-1 heading `# Title`.
2. **Summary Section**: The second section header must be `## Summary` (or the configured equivalent), followed by its body.
3. **Block Section**: The third section header must be `## Block`. All content below this header is treated as block cards.
4. **Individual Blocks (H3)**:
   * Each block header must use level-3 heading `###`.
   * The heading must end with an HTML comment metadata: `<!-- [blockId] [YYYY-MM-DD HH:mm:ss] -->`.
   * Block IDs must be a unique, 5-character alphanumeric string (e.g., `a73bc`). The timestamp must follow the `YYYY-MM-DD HH:mm:ss` format.

---

## 4. Storage Interface Specification

Each storage backend in `storage.js` conforms to the following common interface, swapped at runtime via `currentStorage`:

| Method / Property | Type | Description |
| :--- | :--- | :--- |
| `favorites` | `Set<string>` | Set containing favorited entry paths (`category/file.md`). |
| `init()` | `Promise<boolean>` | Initializes the storage. Fetches all server cache data in Server Mode. |
| `listCategories()` | `Promise<string[]>` | Returns sorted category names. The trash folder is forced to the end. |
| `listEntries(cat)` | `Promise<object[]>` | Lists files and modification times (`mtime`) within a category. |
| `readEntry(cat, file)` | `Promise<string>` | Retrieves the raw text content of the Markdown file. |
| `writeEntry(cat, file, md)`| `Promise<boolean>` | Atomically overwrites the specified entry with new content. |
| `createEntry(cat, file, md)`| `Promise<string>`| Creates a new entry, resolving conflicts with sequence suffixes (e.g., `-2.md`), and returns the resolved filename. |
| `moveEntry(oc, of, nc, nf)` | `Promise<string>`| Renames/relocates an entry, resolving conflicts, and returns the resolved filename. |
| `deleteEntry(cat, file)` | `Promise<boolean>` | Deletes the note file. |
| `isFavorite(cat, file)` | `boolean` | Verifies whether the specified entry is favorited. |
| `toggleFavorite(cat, file)`| `Promise<boolean>` | Toggles and syncs the favorited status. |
| `saveFavorites()` | `Promise<void>` | Persists favorites information. |

---

## 5. Server-Side API Architecture

In Server Mode, the frontend transmits AJAX requests to the backend. The API should be implemented according to the following design:

### Security & Safety
1. **Stateless / JSON API**: Communicates via standard JSON payloads (for POST requests) and remains stateless.
2. **Traversal Defense**: Restricts paths containing `..`, `/`, `\\`, or `\0`, and filenames starting with `.`.
3. **Atomic Writes**: Uses temporary files and file-renaming mechanisms to prevent data corruption during write failures.
4. **Optimistic Locking**: Leverages SHA-256 hash revisions to prevent overwrite conflicts.

※ For API payload schemas and backend guides, refer to **`specification_for_api.md`** (or Japanese **`specification_for_api.ja.md`**).

---

## 6. Frontend Navigation & UI/UX

### Breadcrumb Navigation
The header title displays a 3-tier link: `All` ＞ `[Category]` ＞ `[Title]`.
* Clicking `All` redirects to the global entry list.
* Clicking `Category` redirects to the filtered category entry list.

### Trash Guards
When an entry is located in the "Trash" (or "ゴミ箱") category:
* The star button is replaced by a 🗑️ icon and is disabled.
* Keyboard shortcuts (S key) and favoriting events are ignored.
* List views display 🗑️ instead of stars (★/☆), disabling favorite toggles.

### Caching and Manual Sync
* Under Server Mode, `ServerStorage` caches all data in memory.
* To refresh data, users can click the refresh button (🔄) in the header (which plays a spin animation during synchronization).
* Mobile users can trigger **Pull-to-refresh** by pulling the page downward at the top of the viewport (exceeding a 75px threshold).

### Swipe Gestures
On mobile devices, users can swipe left or right (exceeding 80px horizontally) to toggle between the entry list view and the detail view. Gestures are disabled when an input element is active.

---

## 7. Keyboard Shortcuts

| Shortcut | Context | Description |
| :--- | :--- | :--- |
| `?` (Shift + `/`) | Global (except inputs) | Toggles the shortcut help panel |
| `Ctrl + \` | Global | Toggles the sidebar visibility |
| `Alt + ↑` / `↓` | Global | Switches to next/previous favorited entry |
| `Alt + ←` / `→` | Global | Toggles between list and detail views |
| `Ctrl + O` | Global | Opens the local folder picker |
| `Ctrl + C` | Global (except inputs) | Opens the new entry modal |
| `Ctrl + E` | Detail View | Opens the edit entry modal |
| `Shift + D` / `Delete` | Detail View | Relocates entry to Trash, or deletes permanently |
| `Ctrl + Enter` / `A` | Detail View | Opens the add block modal (`A` is active only outside inputs) |
| `Ctrl + I` | Detail View | Commences summary section editing |
| `Ctrl + H` | Detail View | Displays the entry list of the current category |
| `Ctrl + J` / `K` | Global | Navigates categories (Next / Prev) |
| `J` / `K` | List / Card Focus | Focuses on next/previous entry or card (loops) |
| `Space` | Card Focus | Expands or collapses the focused block card |
| `Enter` / `E` | Card Focus | Edits the focused block or summary |
| `M` (Unchecked) | Card Focus | Opens the block relocation modal |
| `D` | Card Focus | Deletes the focused block |
| `X` | Card Focus | Selects/deselects block for merge (shows merge bar) |
| `M` (Checked) | Card Focus | Executes block merge |
| `Ctrl + Enter` | Modals | Saves changes and closes modal |
| `Esc` | Modals | Closes modal without saving |

### Keymap Customization
Users can customize key bindings by copying `app/src/keymaps.js.sample` to `app/src/keymaps.js` (which is git-ignored). Assign customized configurations to `window.EntryMemo.Keymaps` to override default shortcuts.

---

## 8. Safety & Concurrency Control

### Atomic Writes
When writing files, the API writes to a temporary file first, and only replaces the target file via atomic renames after a successful write.

### Concurrency Resolution (Optimistic Locking)
1. Upon loading, the server returns a SHA-256 hash value as `revision`.
2. When saving, the client submits the `baseRevision` along with the request.
3. The server compares the current disk revision with the client's `baseRevision`, rejecting saves with a `409 Conflict` if they mismatch.
