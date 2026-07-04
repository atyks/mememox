# mememox Server-Side API Specification

English | [日本語 (Japanese)](specification_for_api.ja.md)

This document provides system integration and development guidelines for implementing the server-side API endpoints required when the `mememox` frontend runs in Server Mode.

It defines common API schemas, payloads, and behavioral constraints to ensure consistent behavior across various backend platforms (PHP, Node.js, Go, Python, etc.) and hosting environments.

---

## 1. Synchronization Model (In-Memory Cache)

To minimize network latency and connection overhead, `mememox` uses an **"In-Memory Cache Synchronization Model"**:

1. **Initial Load**: Upon startup, the client dispatches a single `load_all` API request to retrieve all directories, files, contents, metadata, and favorited states.
2. **Speed**: Operations such as listing entries or viewing files are processed locally on the cached database in milliseconds.
3. **Writes & Updates**: Saves, creations, moves, and deletions transmit a POST request referencing the target file. Once verified by the API, the local client cache is updated accordingly.

---

## 2. Security & Input Validation Policies

To protect against malicious activities, the API must perform the following validation checks for all requests:

### ① HTTP Methods & Content-Type
* Limit writing requests to the `POST` method.
* Require `Content-Type: application/json` for POST requests, enforcing a maximum payload size of `1MB`.

### ② Directory Traversal Defense
Because category and file parameters map directly to target directory paths, any payload containing the following sequences must immediately trigger a `400 Bad Request`:
* Directory separators or parent references: `/`, `\\`, `..`
* Null byte characters: `\0` (or `chr(0)`)
* Hidden files: Categories or filenames starting with `.`.

### ③ String Length Constraints
* Category name (`category`): Maximum 100 characters.
* Filename (`file`): Maximum 255 characters.

---

## 3. Concurrency & Safety Resolution

### ① Atomic Writes
Overwriting files directly poses a risk of data corruption if connections terminate prematurely.
**【Recommended Algorithm】**
1. Write target content into a unique temporary file inside the data directory.
2. Ensure the file has closed successfully.
3. Swap the temporary file with the target file using atomic system calls (e.g., POSIX `rename`). Remove the temporary file if rename operations fail.

### ② Concurrency Guard (Optimistic Locking)
To prevent lost updates caused by simultaneous modifications from multiple clients, use SHA-256 hash revisions.
**【Recommended Algorithm】**
1. The client submits its cached SHA-256 hash revision as `baseRevision`.
2. The server computes the current SHA-256 hash revision (`currentRevision`) of the target file on disk.
3. Reject saves and return `409 Conflict` if `baseRevision` does not match `currentRevision`.

---

## 4. API Endpoints Specification

API requests are routed based on the `action` query parameter (e.g., `?action=load_all`).

---

### ① `load_all` (GET / POST)
Recursively scans the storage folder, retrieving all entries, metadata, and favorites.

* **Behavior**:
  1. Scan subfolders (categories) inside the storage root, ignoring hidden folders starting with `.`.
  2. Read each Markdown file (`.md`), recording contents, name, hash (prefixed with `sha256:`), and modification time (`mtime` / Epoch timestamp).
  3. Retrieve favorited entries from `favorites.json` in the storage root.
  4. Sort categories, placing the Trash folder (e.g., "Trash" or "ゴミ箱") at the end of the array.
* **Response (JSON)**:
  ```json
  {
    "categories": ["inbox", "thinking", "work", "Trash"],
    "entries": {
      "inbox/inbox.md": {
        "category": "inbox",
        "fileName": "inbox.md",
        "content": "# Inbox\n\n## Summary\n...",
        "revision": "sha256:4a8c...",
        "mtime": 1789456210
      }
    },
    "favorites": ["inbox/inbox.md"]
  }
  ```

---

### ② `save_favorites` (POST)
Overwrites and persists the favorites list into `DATA_DIR/favorites.json`.

* **Request Body (JSON)**:
  ```json
  {
    "favorites": [
      "inbox/inbox.md",
      "work/report.md"
    ]
  }
  ```
* **Response (JSON)**:
  ```json
  {
    "ok": true
  }
  ```

---

### ③ `write_entry` (POST)
Overwrites an entry, verifying hash revisions and utilizing atomic write methods.

* **Request Body (JSON)**:
  ```json
  {
    "category": "inbox",
    "file": "inbox.md",
    "content": "# Updated Content ...",
    "baseRevision": "sha256:4a8c..."
  }
  ```
* **Response (JSON)**:
  * On success (`200 OK`):
    ```json
    {
      "ok": true,
      "revision": "sha256:8f2a...",
      "mtime": 1789456299
    }
    ```
  * On conflict (`409 Conflict`):
    ```json
    {
      "ok": false,
      "error": "Conflict detected. The file has been modified by another source."
    }
    ```

---

### ④ `create_entry` (POST)
Creates a new Markdown file. Automatically resolves conflicts by adding numerical suffixes (e.g., `-2`, `-3`) to the filename.

* **Request Body (JSON)**:
  ```json
  {
    "category": "inbox",
    "file": "new-memo.md",
    "content": "# New Memo ..."
  }
  ```
* **Conflict Resolution**:
  * If `DATA_DIR/inbox/new-memo.md` already exists, attempt to save as `new-memo-2.md`, then `new-memo-3.md`, until an open slot is found.
* **Response (JSON)**:
  ```json
  {
    "ok": true,
    "fileName": "new-memo-2.md",
    "revision": "sha256:0d2a...",
    "mtime": 1789456300
  }
  ```

---

### ⑤ `move_entry` (POST)
Relocates or renames an entry, resolving conflicts with sequence suffixes.

* **Request Body (JSON)**:
  ```json
  {
    "old_category": "inbox",
    "old_file": "new-memo-2.md",
    "new_category": "work",
    "new_file": "final-report.md"
  }
  ```
* **Cleanup Behavior**:
  * After moving, delete the source category directory if it becomes empty (do not delete Trash directories).
* **Response (JSON)**:
  ```json
  {
    "ok": true,
    "fileName": "final-report.md",
    "revision": "sha256:0d2a...",
    "mtime": 1789456310
  }
  ```

---

### ⑥ `delete_entry` (POST)
Deletes the specified note file permanently.

* **Request Body (JSON)**:
  ```json
  {
    "category": "Trash",
    "file": "deleted-memo.md"
  }
  ```
* **Cleanup Behavior**:
  * Delete the parent directory if it becomes empty (do not delete Trash directories).
* **Response (JSON)**:
  ```json
  {
    "ok": true
  }
  ```
