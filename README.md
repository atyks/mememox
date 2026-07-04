# mememox (🧵 Memo Tool)

English | [日本語 (Japanese)](README.ja.md)

`mememox` is a lightweight, secure, and card-based block structure note system using Markdown files as the data store.
It is optimized for both PC browsers and smartphones, allowing you to manage your notes securely by hosting them locally or on an isolated server via APIs.

## Directory Structure

* `app/` - Frontend Static Web Application
  * `index.html` - Main HTML file (supports refresh button and mobile Pull-to-refresh)
  * `style.css` - UI layout and styling
  * `app.js` - App control and state management logic (in-memory cached sync)
  * `src/` - Feature modules
    * `storage.js` - Data input/output (Demo / FileSystem / cached Server API sync)
    * `ui.js` - DOM rendering, 3-tier breadcrumbs, touch gestures, keyboard shortcuts
    * `markdown.js` - Parser and serializer for custom Markdown formats
    * `utils.js` - Common utilities
  * `how-to-use.md` - Operation manual (Japanese)
* `util/` - API deployment directory for server integration (git-ignored empty folder)
* `specification_for_api.md` - Platform-independent server API guidelines for implementing backend endpoints in various languages/environments.
* `specification.md` - System design and technical specification sheet (Japanese)

## Getting Started

### Local Use (Demo Mode / Local Folder Integration)
1. Open `app/index.html` directly in your Chromium-based browser (Edge, Chrome, etc.).
2. The app starts in **Demo Mode** by default.
3. Click the **Open Folder** button (📁) at the top-right of the screen and select any local directory. The app uses the File System Access API to read and write your Markdown notes directly on your local storage.

### Server Integration Mode
You can isolate your data outside the public web server root and access it securely via APIs from multiple devices.
1. The server-side API requirements are defined in [specification_for_api.md](specification_for_api.md).
2. Based on this specification, implement the backend program tailored to your server environment (PHP, Node.js, Python, Go, etc.) and place it in the `util/` directory.
3. Deploy the `app/` folder to your web server and access it via `http://` or `https://`. The app will automatically boot into server mode with cached ultra-fast sync.

## License & Policies

* For security reasons, backend API implementation scripts are not packaged or distributed in this repository.
* Please feed the [specification_for_api.md](specification_for_api.md) into generative AI tools (ChatGPT, Claude, Gemini, etc.) to generate API scripts tailored to your hosting environment.
