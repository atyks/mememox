window.EntryMemo = window.EntryMemo || {};

window.EntryMemo.Markdown = (function () {
  /**
   * Markdownテキストをエントリーオブジェクトにパースする
   * @param {string} markdownText 
   * @returns {object}
   */
  function parseEntry(markdownText) {
    const result = {
      title: "",
      summary: "",
      blocks: [],
      errors: []
    };

    if (typeof markdownText !== "string") {
      result.errors.push("ファイル内容がテキストではありません。");
      return result;
    }

    const lines = markdownText.split(/\r?\n/);

    let state = "START"; // START -> TITLE -> SUMMARY -> BLOCKS
    let currentBlock = null;
    let summaryLines = [];
    const blockIds = new Set();
    
    let h1Count = 0;
    let hasSummaryHeader = false;
    let hasBlocksHeader = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // H1（エントリータイトル）の検出
      if (line.startsWith("# ")) {
        h1Count++;
        if (state === "START") {
          result.title = line.substring(2).trim();
          state = "TITLE";
        } else {
          result.errors.push("H1（エントリータイトル）が複数存在します。1ファイルに1つのみにしてください。");
        }
        continue;
      }

      // ## 概要
      if (line.trim() === "## 概要") {
        hasSummaryHeader = true;
        if (state === "TITLE" || state === "START") {
          state = "SUMMARY";
        } else {
          result.errors.push("## 概要 の位置が不正です。");
        }
        continue;
      }

      // ## ブロック
      if (line.trim() === "## ブロック") {
        hasBlocksHeader = true;
        if (state === "SUMMARY") {
          state = "BLOCKS";
        } else {
          result.errors.push("## ブロック の位置が不正です（## 概要 より前に出現しています）。");
        }
        continue;
      }

      // 各状態に応じた行の割り当て
      if (state === "SUMMARY") {
        summaryLines.push(line);
      } else if (state === "BLOCKS") {
        // H3見出しの判定
        if (line.startsWith("### ")) {
          // 直前のブロックがあれば結果に追加
          if (currentBlock) {
            result.blocks.push(currentBlock);
            currentBlock = null;
          }

          const h3Content = line.substring(4).trim();
          const idMatch = h3Content.match(/^\[([a-z0-9]+)\]/);
          if (idMatch) {
            const id = idMatch[1];
            let rest = h3Content.substring(idMatch[0].length).trim();

            // 日付パターン (yyyy-mm-dd hh:mm) をすべて抽出
            const dateRegex = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/g;
            const dates = rest.match(dateRegex) || [];

            // 抽出した日付部分を rest から取り除く
            dates.forEach(d => {
              rest = rest.replace(d, "");
            });

            const datetime = dates.slice(0, 2).join(" ");
            const title = rest.trim();

            if (id.length !== 5) {
              result.errors.push(`ブロックID "${id}" は5文字（英小文字と数字）である必要があります。`);
            }

            if (blockIds.has(id)) {
              result.errors.push(`重複したブロックID "${id}" が検出されました。`);
            }
            blockIds.add(id);

            currentBlock = {
              id: id,
              datetime: datetime,
              title: title || "",
              bodyLines: []
            };
          } else {
            result.errors.push(`H3見出しのID形式が壊れています: "${line}"（形式: ### [xxxxx] タイトル）`);
            // エラーを検出しつつもパースを続けるためのフォールバック
            currentBlock = {
              id: "error",
              title: h3Content,
              bodyLines: []
            };
          }
        } else {
          // ブロックの本文
          if (currentBlock) {
            currentBlock.bodyLines.push(line);
          } else {
            // ## ブロック ヘッダーの直後で、かつ最初の H3 見出しが出現する前のコンテンツ
            if (line.trim() !== "") {
              result.errors.push(`## ブロック の直後に、H3見出し以外のテキストがあります: "${line}"`);
            }
          }
        }
      }
    }

    // 最後のブロックを追加
    if (currentBlock) {
      result.blocks.push(currentBlock);
    }

    // 各ブロックのbodyLinesを整理して文字列化
    result.blocks.forEach(rec => {
      rec.body = rec.bodyLines.join("\n").trim();
      delete rec.bodyLines;
    });

    // 概要の整理
    result.summary = summaryLines.join("\n").trim();

    // 構造自体の存在チェック
    if (h1Count === 0) {
      result.errors.push("H1（エントリータイトル）が存在しません。");
    }
    if (!hasSummaryHeader) {
      result.errors.push("## 概要 が存在しません。");
    }
    if (!hasBlocksHeader) {
      result.errors.push("## ブロック が存在しません。");
    }

    return result;
  }

  /**
   * エントリーオブジェクトをMarkdownテキストに変換する
   * @param {object} entryObject 
   * @returns {string}
   */
  function serializeEntry(entryObject) {
    let md = `# ${entryObject.title}\n\n`;
    
    md += `## 概要\n\n`;
    if (entryObject.summary) {
      md += `${entryObject.summary}\n\n`;
    } else {
      md += `\n`; // 空行
    }
    
    md += `## ブロック\n`;
    
    entryObject.blocks.forEach(rec => {
      let header = `### [${rec.id}]`;
      if (rec.datetime) {
        header += ` ${rec.datetime}`;
      }
      if (rec.title) {
        header += ` ${rec.title}`;
      }
      md += `\n${header}\n\n`;
      if (rec.body) {
        md += `${rec.body}\n`;
      }
    });
    
    return md;
  }

  /**
   * エントリーオブジェクトが規約を満たしているか検証する
   * @param {object} entryObject 
   * @returns {object} { valid: boolean, errors: string[] }
   */
  function validateEntry(entryObject) {
    const errors = [];
    if (!entryObject.title) {
      errors.push("H1（エントリータイトル）が存在しません。");
    }
    if (entryObject.summary === undefined) {
      errors.push("## 概要 が存在しません。");
    }
    if (!Array.isArray(entryObject.blocks)) {
      errors.push("## ブロック が存在しません。");
    } else {
      const ids = new Set();
      entryObject.blocks.forEach((rec, idx) => {
        if (!rec.id || !/^[a-z0-9]{5}$/.test(rec.id)) {
          errors.push(`ブロックID "${rec.id || ""}" (位置: ${idx + 1}) の形式が壊れています。5文字の英小文字と数字のみ使用可能です。`);
        }
        if (rec.id && ids.has(rec.id)) {
          errors.push(`重複したブロックID "${rec.id}" が検出されました。`);
        }
        if (rec.id) {
          ids.add(rec.id);
        }
      });
    }
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * 新しいブロックオブジェクトを生成する
   * @param {string} title 
   * @param {string} body 
   * @param {Set<string>|string[]} existingIds 
   * @returns {object}
   */
  function createBlock(title, body, existingIds) {
    const finalTitle = (title || "").trim();
    const finalBody = (body || "").trim();
    
    const id = window.EntryMemo.Utils.generateId(existingIds);
    const datetime = window.EntryMemo.Utils.getCurrentDatetime();
    return {
      id: id,
      datetime: datetime,
      title: finalTitle,
      body: finalBody
    };
  }

  /**
   * エントリーオブジェクトの末尾にブロックを追加する
   * @param {object} entryObject 
   * @param {object} blockObject 
   * @returns {object}
   */
  function appendBlock(entryObject, blockObject) {
    entryObject.blocks.push(blockObject);
    return entryObject;
  }

  /**
   * エントリーオブジェクト内の特定のブロックを更新する
   * @param {object} entryObject 
   * @param {string} blockId 
   * @param {string} title 
   * @param {string} body 
   * @returns {object}
   */
  function updateBlock(entryObject, blockId, title, body) {
    const rec = entryObject.blocks.find(r => r.id === blockId);
    if (!rec) {
      throw new Error(`ブロックID "${blockId}" が見つかりません。`);
    }
    
    const finalTitle = (title || "").trim();
    
    rec.title = finalTitle;
    rec.body = (body || "").trim();

    const nowStr = window.EntryMemo.Utils.getCurrentDatetime();
    if (rec.datetime) {
      const matches = rec.datetime.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/g);
      if (matches && matches.length >= 2) {
        // 最後の要素を作成日時（最古）として抽出し、「現在時刻 作成日時」の2つに整形
        const creationTime = matches[matches.length - 1];
        rec.datetime = `${nowStr} ${creationTime}`;
      } else if (matches && matches.length === 1) {
        rec.datetime = `${nowStr} ${matches[0]}`;
      } else {
        rec.datetime = nowStr;
      }
    } else {
      rec.datetime = nowStr;
    }
    return entryObject;
  }

  /**
   * エントリーオブジェクトから特定のブロックを削除する
   * @param {object} entryObject 
   * @param {string} blockId 
   * @returns {object}
   */
  function removeBlock(entryObject, blockId) {
    const initialLength = entryObject.blocks.length;
    entryObject.blocks = entryObject.blocks.filter(r => r.id !== blockId);
    if (entryObject.blocks.length === initialLength) {
      throw new Error(`削除対象のブロックID "${blockId}" が見つかりません。`);
    }
    return entryObject;
  }

  /**
   * 本文内の見出しレベルを適切に調整するヘルパー
   * マージされたブロックのID付き見出し (H4) や、すでに深い見出し (H5以上) はそれ以上下げない
   * @param {string} bodyText 
   * @returns {string}
   */
  function demoteHeadings(bodyText) {
    if (!bodyText) return "";
    return bodyText.split(/\r?\n/).map(line => {
      // ID付き見出し (例: #### [abcde] ...) は常に #### (H4) にリセット/維持する
      const idHeaderMatch = line.match(/^#+\s+\[([a-z0-9]{5})\]/);
      if (idHeaderMatch) {
        const startIdx = line.indexOf("[");
        if (startIdx !== -1) {
          return "#### " + line.substring(startIdx);
        }
      }

      // 一般のユーザー見出しのデモート処理
      if (line.startsWith("### ")) {
        return "#### " + line.substring(4);
      } else if (line.startsWith("#### ")) {
        return "##### " + line.substring(5);
      }
      return line;
    }).join("\n");
  }

  /**
   * 複数のブロックを1つのマージブロックにまとめる
   * @param {array} blocks 
   * @param {string} newBlockTitle 
   * @param {Set|array} existingIds 
   * @returns {object}
   */
  function mergeBlocks(blocks, newBlockTitle, existingIds) {
    let mergedBody = "";
    
    blocks.forEach((rec, idx) => {
      const demotedBody = demoteHeadings(rec.body);
      
      let header = `#### [${rec.id}]`;
      if (rec.datetime) {
        header += ` ${rec.datetime}`;
      }
      if (rec.title) {
        header += ` ${rec.title}`;
      }
      mergedBody += `${header}\n\n`;
      if (demotedBody) {
        mergedBody += `${demotedBody}\n\n`;
      }
    });

    const newId = window.EntryMemo.Utils.generateId(existingIds);
    const datetime = window.EntryMemo.Utils.getCurrentDatetime();
    
    let finalTitle = (newBlockTitle || "").trim();
    if (!finalTitle && blocks.length > 0) {
      finalTitle = blocks[0].title || "";
    }

    return {
      id: newId,
      datetime: datetime,
      title: finalTitle,
      body: mergedBody.trim()
    };
  }

  return {
    parseEntry,
    serializeEntry,
    validateEntry,
    createBlock,
    appendBlock,
    updateBlock,
    removeBlock,
    mergeBlocks
  };
})();
