window.EntryMemo = window.EntryMemo || {};

window.EntryMemo.Utils = (function () {
  /**
   * HTMLエスケープ処理 (XSS防止)
   * @param {string} str 
   * @returns {string}
   */
  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * 5文字のランダムな英数字ID（英小文字＋数字）を生成。
   * existingIds に含まれる場合は再生成する。
   * @param {Set<string>|string[]} existingIds 
   * @returns {string}
   */
  function generateId(existingIds) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    const set = existingIds instanceof Set ? existingIds : new Set(existingIds || []);
    let id;
    do {
      id = "";
      for (let i = 0; i < 5; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (set.has(id));
    return id;
  }

  /**
   * Windowsで使用できない禁則文字を削除または置換して、安全なファイル名を生成する。
   * 日本語文字は許可。
   * @param {string} title 
   * @returns {string}
   */
  function sanitizeFileName(title) {
    if (!title) return "untitled";
    // Windowsの予約文字: \ / : * ? " < > | および制御文字
    let sanitized = title
      .replace(/[\\/:*?"<>|\x00-\x1F]/g, "")
      .trim();
    
    // 空、またはドットのみになった場合のフォールバック
    if (!sanitized || /^[\.]+$/.test(sanitized)) {
      sanitized = "untitled";
    }
    
    // 拡張子 .md はここでは付与せず、呼び出し元で追加することを想定、
    // あるいはすでに .md が付いている場合はそれを取り除いてからサニタイズする
    return sanitized;
  }

  /**
   * 本文から指定文字数（デフォルト150文字）を抜粋する。
   * @param {string} body 
   * @param {number} maxLength 
   * @returns {string}
   */
  function excerpt(body, maxLength = 150) {
    if (!body) return "";
    // 連続する改行や空白をスペースに置換して抜粋しやすくする
    const flatText = body.replace(/\s+/g, " ").trim();
    if (flatText.length <= maxLength) {
      return flatText;
    }
    return flatText.substring(0, maxLength) + "...";
  }

  /**
   * 現在の日時を YYYY-MM-DD HH:mm 形式で取得する。
   * @returns {string}
   */
  function getCurrentDatetime() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  }

  /**
   * カテゴリー名の比較用ソート関数。
   * ゴミ箱 (または trash) が常に末尾にくるようにする。
   * @param {string} a 
   * @param {string} b 
   * @returns {number}
   */
  function compareCategories(a, b) {
    const isTrashA = a === "ゴミ箱" || a === "trash";
    const isTrashB = b === "ゴミ箱" || b === "trash";
    if (isTrashA && !isTrashB) return 1;
    if (!isTrashA && isTrashB) return -1;
    return a.localeCompare(b);
  }

  return {
    escapeHtml,
    generateId,
    sanitizeFileName,
    excerpt,
    getCurrentDatetime,
    compareCategories
  };
})();
