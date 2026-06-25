(function () {
  const CONTENT_VERSION = "2026-06-25-chatgpt-targeted-turn-sweep-v2";
  if (globalThis.__localthinkContentVersion === CONTENT_VERSION) return;
  globalThis.__localthinkContentVersion = CONTENT_VERSION;
  globalThis.__localthinkContentInstalled = true;

  const CAPTURE_MESSAGE = "LOCALTHINK_CAPTURE_V6";
  const CAPTURE_ADAPTERS = {
    chatgpt: "browser-extension-chatgpt-v2.2"
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== CAPTURE_MESSAGE) {
      return false;
    }

    captureConversation(message)
      .then((data) => {
        sendResponse({ ok: true, data });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        });
      });

    return true;
  });

  async function captureConversation(message = {}) {
    const platform = detectPlatform();
    if (platform !== "chatgpt") {
      throw new Error("This version only captures ChatGPT web conversations.");
    }
    const result = await extractTurnsForPlatform(platform, message);
    const turns = Array.isArray(result) ? result : result.turns;
    const captureStrategy = Array.isArray(result) ? "visible-dom" : result.strategy;
    const captureAdapter = Array.isArray(result) || !result.adapter
      ? CAPTURE_ADAPTERS[platform] || "browser-extension-unknown"
      : result.adapter;

    if (!turns.length) {
      throw new Error(`No ${platform} conversation turns were found on this page.`);
    }

    return {
      platform,
      title: cleanTitle(document.title),
      url: location.href,
      capturedAt: new Date().toISOString(),
      captureAdapter,
      model: detectModel(platform),
      turns,
      quality: buildQualityReport(turns, {
        platform,
        captureStrategy,
        scrollComplete: result.scrollComplete,
        scrollSteps: result.scrollSteps,
        scrollTop: result.scrollTop,
        scrollHeight: result.scrollHeight
      })
    };
  }

  function detectPlatform() {
    if (/(^|\.)chatgpt\.com$/i.test(location.hostname) || /^chat\.openai\.com$/i.test(location.hostname)) return "chatgpt";
    return "unsupported";
  }

  async function extractTurnsForPlatform(platform, message = {}) {
    return extractChatGptTurnsDeep();
  }

  async function extractChatGptTurnsDeep() {
    const scroller = findConversationScroller();
    const initialTop = getScrollTop(scroller);
    const initialTurns = extractChatGptTurns({ visibleOnly: false });
    const targetTurnNumbers = chatGptTurnNumbersInDom();

    if (!canScroll(scroller)) {
      return { turns: initialTurns.map(stripCaptureFields), strategy: "visible-dom" };
    }

    const seen = new Set();
    const turns = [];
    const addVisibleTurns = () => {
      for (const turn of extractChatGptTurns({ visibleOnly: true })) {
        const key = turnKey(turn);
        if (key && !seen.has(key)) {
          seen.add(key);
          turns.push(turn);
        }
      }
    };

    setScrollTop(scroller, 0);
    await waitForRender();
    addVisibleTurns();

    if (targetTurnNumbers.length >= 12) {
      await sweepKnownChatGptTurns(scroller, targetTurnNumbers, addVisibleTurns, turns);
      const capturedNumbers = capturedTurnNumbers(turns);
      const missingTargetCount = targetTurnNumbers.filter((number) => !capturedNumbers.has(number)).length;
      setScrollTop(scroller, initialTop);
      return {
        turns: sortCapturedTurns(turns).map(markDomTurnMetadata),
        strategy: "chatgpt-targeted-turn-sweep",
        scrollComplete: missingTargetCount === 0,
        scrollSteps: targetTurnNumbers.length,
        scrollTop: Math.round(getScrollTop(scroller)),
        scrollHeight: Math.round(getScrollHeight(scroller))
      };
    }

    let previousTop = -1;
    let stableReads = 0;
    let scrollComplete = false;
    let scrollSteps = 0;
    let finalScrollTop = getScrollTop(scroller);
    let finalScrollHeight = getScrollHeight(scroller);
    const hardMaxSteps = maxScrollSweepSteps(scroller);

    for (let step = 0; step < hardMaxSteps; step += 1) {
      const currentTop = getScrollTop(scroller);
      const nextTop = Math.min(currentTop + scrollSweepStepSize(scroller), getScrollHeight(scroller));
      setScrollTop(scroller, nextTop);
      await waitForRender();
      addVisibleTurns();

      const actualTop = getScrollTop(scroller);
      const atBottom = isAtBottom(scroller);
      finalScrollTop = actualTop;
      finalScrollHeight = getScrollHeight(scroller);
      scrollSteps = step + 1;

      if (atBottom) {
        stableReads += 1;
        if (stableReads >= 3) {
          scrollComplete = true;
          break;
        }
      } else if (Math.abs(actualTop - previousTop) < 2) {
        stableReads += 1;
        if (stableReads >= 8) break;
      } else {
        stableReads = 0;
      }
      previousTop = actualTop;
    }

    setScrollTop(scroller, initialTop);
    const sortedTurns = turns.length ? sortCapturedTurns(turns).map(markDomTurnMetadata) : initialTurns.map(markDomTurnMetadata);
    return {
      turns: sortedTurns,
      strategy: turns.length ? "chatgpt-viewport-turn-sweep" : "visible-dom",
      scrollComplete,
      scrollSteps,
      scrollTop: Math.round(finalScrollTop),
      scrollHeight: Math.round(finalScrollHeight)
    };
  }

  function findConversationScroller() {
    const roleNode = document.querySelector("[data-message-author-role]");
    const candidates = [
      document.scrollingElement,
      document.documentElement,
      document.body,
      ...Array.from(document.querySelectorAll("main, [role='main'], div"))
    ].filter(Boolean);

    const scrollable = candidates
      .filter((node) => canScroll(node))
      .filter((node) => !roleNode || node === document.scrollingElement || node.contains(roleNode))
      .map((node) => ({ node, score: scrollContainerScore(node, roleNode) }))
      .filter((candidate) => candidate.score > Number.NEGATIVE_INFINITY)
      .sort((a, b) => b.score - a.score);

    return scrollable[0]?.node || document.scrollingElement || document.documentElement;
  }

  function canScroll(node) {
    return getScrollHeight(node) > getClientHeight(node) + 200;
  }

  function scrollContainerScore(node, roleNode) {
    if (!node || !canScroll(node)) return Number.NEGATIVE_INFINITY;
    const style = getComputedStyle(node);
    const overflowY = style.overflowY || "";
    const rect = node.getBoundingClientRect?.();
    const clientHeight = getClientHeight(node);
    const scrollHeight = getScrollHeight(node);
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;
    const isDocument = node === document.scrollingElement || node === document.documentElement || node === document.body;
    const isOverflowScroller = /auto|scroll|overlay/i.test(overflowY);

    let score = 0;
    if (roleNode && node.contains(roleNode)) score += 1000;
    if (isOverflowScroller) score += 5000;
    if (/visible/i.test(overflowY) && !isDocument) score -= 2500;
    if (clientHeight > 0 && clientHeight <= viewportHeight + 160) score += 800;
    if (rect && rect.height > 0 && rect.height <= viewportHeight + 160) score += 500;
    if (rect && Math.abs(rect.top) <= 80) score += 250;
    if (isDocument) score -= 200;
    score += Math.min(scrollHeight / 1000, 400);
    score -= Math.max(0, clientHeight - viewportHeight - 160) / 200;
    return score;
  }

  function getScrollTop(node) {
    return node === document.scrollingElement || node === document.documentElement || node === document.body
      ? window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
      : node.scrollTop;
  }

  function setScrollTop(node, value) {
    if (node === document.scrollingElement || node === document.documentElement || node === document.body) {
      window.scrollTo(0, value);
      document.documentElement.scrollTop = value;
      document.body.scrollTop = value;
    } else {
      node.scrollTop = value;
    }
  }

  function getScrollHeight(node) {
    return node === document.scrollingElement || node === document.documentElement || node === document.body
      ? Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
      : node.scrollHeight;
  }

  function getClientHeight(node) {
    return node === document.scrollingElement || node === document.documentElement || node === document.body
      ? window.innerHeight
      : node.clientHeight;
  }

  function isAtBottom(node) {
    return getScrollTop(node) + getClientHeight(node) >= getScrollHeight(node) - 4;
  }

  function scrollSweepStepSize(node) {
    return Math.max(520, getClientHeight(node) * 0.72);
  }

  function maxScrollSweepSteps(node) {
    const estimated = Math.ceil(getScrollHeight(node) / scrollSweepStepSize(node)) + 80;
    return Math.min(Math.max(estimated, 240), 1400);
  }

  function waitForRender(delay = 180) {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        setTimeout(resolve, delay);
      });
    });
  }

  function turnKey(turn) {
    const text = cleanText(turn.text || "");
    if (!text) return "";
    return turn._captureKey || `${turn.role}:${text.slice(0, 500)}:${text.length}`;
  }

  function extractChatGptTurns(options = {}) {
    const roleNodes = Array.from(document.querySelectorAll("[data-message-author-role]"));

    if (roleNodes.length) {
      return roleNodes
        .map((node, index) => turnFromRoleNode(node, index, options))
        .filter(Boolean)
        .sort(compareCapturedTurns)
        .filter((turn) => turn.text);
    }

    const articles = Array.from(document.querySelectorAll("main article"));
    if (articles.length) {
      return articles
        .map((article, index) => ({
          role: inferRoleFromArticle(article, index),
          text: markdownFromNode(article)
        }))
        .filter((turn) => turn.text);
    }

    return [];
  }

  function turnFromRoleNode(node, index, options) {
    const turnContainer = node.closest("[data-testid^='conversation-turn-']") || node;
    if (options.visibleOnly && !isInCaptureWindow(turnContainer)) return null;

    const text = markdownFromNode(node);
    if (!text) return null;

    const turnNumber = turnNumberFromNode(turnContainer);
    const absoluteTop = absoluteTopForNode(turnContainer);
    return {
      role: normalizeRole(node.getAttribute("data-message-author-role")),
      text,
      _turnNumber: turnNumber,
      _absoluteTop: absoluteTop,
      _messageId: node.getAttribute("data-message-id") || "",
      _turnId: turnContainer.getAttribute?.("data-turn-id") || "",
      _captureKey: captureKeyForRoleNode(node, text, index, turnNumber, absoluteTop)
    };
  }

  function isInCaptureWindow(node) {
    const rect = node.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;
    return rect.bottom >= -240 && rect.top <= viewportHeight + 320;
  }

  function turnNumberFromNode(node) {
    const value = node?.getAttribute?.("data-testid") || "";
    const match = value.match(/^conversation-turn-(\d+)$/);
    return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
  }

  function absoluteTopForNode(node) {
    const rect = node.getBoundingClientRect();
    return Math.round(rect.top + (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0));
  }

  function captureKeyForRoleNode(node, text, index, turnNumber, absoluteTop) {
    const id = node.getAttribute("data-message-id") ||
      node.closest("[data-turn-id]")?.getAttribute("data-turn-id") ||
      "";
    if (id) return `${id}:${node.getAttribute("data-message-author-role") || ""}`;
    const textKey = cleanText(text).slice(0, 200);
    const orderKey = Number.isFinite(turnNumber) ? `turn:${turnNumber}` : `top:${Math.round(absoluteTop / 20)}:${index}`;
    return `${orderKey}:${node.getAttribute("data-message-author-role") || ""}:${textKey.length}:${textKey}`;
  }

  function sortCapturedTurns(turns) {
    return turns.slice().sort(compareCapturedTurns);
  }

  function compareCapturedTurns(a, b) {
    const aTurn = a._turnNumber ?? Number.POSITIVE_INFINITY;
    const bTurn = b._turnNumber ?? Number.POSITIVE_INFINITY;
    if (Number.isFinite(aTurn) && Number.isFinite(bTurn) && aTurn !== bTurn) return aTurn - bTurn;
    if (Number.isFinite(aTurn) && !Number.isFinite(bTurn)) return -1;
    if (!Number.isFinite(aTurn) && Number.isFinite(bTurn)) return 1;
    const topDiff = (a._absoluteTop ?? 0) - (b._absoluteTop ?? 0);
    if (topDiff) return topDiff;
    return 0;
  }

  function chatGptTurnNumbersInDom() {
    return Array.from(new Set(Array.from(document.querySelectorAll("[data-testid^='conversation-turn-']"))
      .map((node) => turnNumberFromNode(node))
      .filter((number) => Number.isFinite(number))))
      .sort((a, b) => a - b);
  }

  async function sweepKnownChatGptTurns(scroller, turnNumbers, addVisibleTurns, turns) {
    for (const turnNumber of turnNumbers) {
      if (capturedTurnNumbers(turns).has(turnNumber)) continue;
      if (!scrollChatGptTurnIntoView(scroller, turnNumber)) continue;
      for (let attempt = 0; attempt < 3 && !capturedTurnNumbers(turns).has(turnNumber); attempt += 1) {
        await waitForRender(90);
        addVisibleTurns();
      }
    }
  }

  function scrollChatGptTurnIntoView(scroller, turnNumber) {
    const node = document.querySelector(`[data-testid="conversation-turn-${turnNumber}"]`);
    if (!node) return false;

    try {
      node.scrollIntoView({ block: "center", inline: "nearest" });
    } catch (_error) {
      // Fallback below handles browsers that reject options.
      node.scrollIntoView();
    }

    if (scroller && scroller !== document.scrollingElement && scroller !== document.documentElement && scroller !== document.body) {
      const scrollerRect = scroller.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      const targetTop = getScrollTop(scroller) + nodeRect.top - scrollerRect.top - Math.max(0, getClientHeight(scroller) * 0.25);
      setScrollTop(scroller, targetTop);
    }
    return true;
  }

  function capturedTurnNumbers(turns) {
    return new Set(turns
      .map((turn) => turn._turnNumber)
      .filter((number) => Number.isFinite(number)));
  }

  function stripCaptureFields(turn) {
    return {
      role: turn.role,
      text: turn.text
    };
  }

  function markDomTurnMetadata(turn) {
    const cleanTurn = stripCaptureFields(turn);
    if (Number.isFinite(turn._turnNumber)) cleanTurn.captureTurnNumber = turn._turnNumber;
    if (turn._messageId) cleanTurn.captureMessageId = turn._messageId;
    if (turn._turnId) cleanTurn.captureTurnId = turn._turnId;
    return cleanTurn;
  }

  function hasBothRoles(turns) {
    return turns.some((turn) => turn.role === "human") && turns.some((turn) => turn.role === "assistant");
  }

  function isUsefulTurn(text) {
    const value = cleanText(text || "");
    if (value.length < 2) return false;
    if (looksLikeAppChromeText(value)) return false;
    return true;
  }

  function looksLikeAppChromeText(text) {
    return /^(Claude|ChatGPT|New chat|Projects|Recents|Upgrade|Settings|Try again)$/i.test(text) ||
      /New chat|Search⌘K|Chats\]\(\/recents\)|Projects\]\(\/projects\)|Artifacts\]\(\/artifacts|Customize\]\(\/customize\)|CodeUpgrade|Free plan|Recent chats/i.test(text);
  }

  function inferRoleFromArticle(article, index) {
    const text = article.getAttribute("aria-label") || article.getAttribute("data-testid") || "";
    if (/assistant|chatgpt|ai/i.test(text)) return "assistant";
    if (/user|human|you/i.test(text)) return "human";
    return index % 2 === 0 ? "human" : "assistant";
  }

  function normalizeRole(role) {
    if (role === "assistant") return "assistant";
    if (role === "system") return "system";
    if (role === "tool") return "tool";
    return "human";
  }

  function cleanText(value) {
    return String(value || "")
      .replace(/[\u2028\u2029]/g, "\n")
      .replace(/\u00a0/g, " ")
      .replace(/\ufffc/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function markdownFromNode(node) {
    const clone = node.cloneNode(true);
    removeChrome(clone);
    return cleanMarkdown(walk(clone));
  }

  function removeChrome(root) {
    for (const selector of [
      "button",
      "svg",
      "[aria-hidden='true']",
      "[data-testid*='copy']",
      "[data-testid*='feedback']",
      "[data-testid*='voice']",
      "[aria-label*='Show more' i]",
      "[aria-label*='Show less' i]",
      ".cdk-visually-hidden",
      "[class*='screen-reader']"
    ]) {
      for (const node of Array.from(root.querySelectorAll(selector))) {
        node.remove();
      }
    }

    for (const node of Array.from(root.querySelectorAll("*"))) {
      const text = cleanText(node.textContent || "");
      if (text === "Show more" || text === "Show less" || text === "Show moreShow less") {
        node.remove();
      }
    }
  }

  function walk(node, context = {}) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || "";
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const tag = node.tagName.toLowerCase();

    if (tag === "pre") return renderPre(node);
    if (tag === "code") return context.inPre ? node.textContent || "" : `\`${cleanInline(node.textContent || "")}\``;
    if (tag === "br") return "\n";
    if (tag === "p") return block(children(node, context));
    if (/^h[1-6]$/.test(tag)) return heading(tag, children(node, context));
    if (tag === "ul") return list(node, false);
    if (tag === "ol") return list(node, true);
    if (tag === "li") return children(node, context);
    if (tag === "blockquote") return quoteBlock(children(node, context));
    if (tag === "a") return link(node, context);
    if (tag === "strong" || tag === "b") return `**${children(node, context).trim()}**`;
    if (tag === "em" || tag === "i") return `_${children(node, context).trim()}_`;
    if (tag === "table") return table(node);
    if (tag === "thead" || tag === "tbody" || tag === "tr" || tag === "td" || tag === "th") return children(node, context);

    return children(node, context);
  }

  function children(node, context) {
    return Array.from(node.childNodes).map((child) => walk(child, context)).join("");
  }

  function block(value) {
    const text = cleanText(value);
    return text ? `${text}\n\n` : "";
  }

  function heading(tag, value) {
    const level = Number(tag.slice(1));
    const prefix = "#".repeat(Math.min(Math.max(level, 3), 6));
    const text = cleanText(value);
    return text ? `${prefix} ${text}\n\n` : "";
  }

  function renderPre(node) {
    const code = node.querySelector("code") || node;
    const language = detectCodeLanguage(node, code);
    const text = restoreCodeFormatting(extractCodeText(code), language).replace(/\n+$/g, "");
    return `\n\n\`\`\`${language}\n${text}\n\`\`\`\n\n`;
  }

  function extractCodeText(code) {
    const rows = Array.from(code.querySelectorAll("[data-line], .line, [class*='line']"))
      .map((line) => line.textContent || "")
      .filter((line) => line.trim() !== "");

    if (rows.length > 1) return rows.join("\n");

    return code.innerText || code.textContent || "";
  }

  function restoreCodeFormatting(value, language) {
    const text = repairKnownTermLineBreaks(String(value || "").trim());
    if (!text) return "";
    if (text.includes("\n")) {
      return cleanupRestoredCode(text
        .split("\n")
        .map((line) => looksLikePackedStructure(line) ? formatConcatenatedTitleList(line) : repairKnownTermLineBreaks(line))
        .join("\n"));
    }

    if (language === "js" || language === "ts" || looksLikeJavaScript(text)) {
      return formatJavaScriptLike(text);
    }

    if (language === "json") {
      return formatJsonLike(text);
    }

    if (looksLikeDiagram(text)) {
      return formatDiagramLike(text);
    }

    if (looksLikeConcatenatedTitleList(text)) {
      return formatConcatenatedTitleList(text);
    }

    if (language === "bash") {
      return formatShellLike(text);
    }

    if (text.includes("↓")) {
      return formatArrowDiagram(text);
    }

    return text;
  }

  function looksLikeJavaScript(text) {
    return /\b(import|export|const|let|var|async|await|function|return|fetch|JSON\.stringify)\b/.test(text);
  }

  function formatJavaScriptLike(text) {
    return text
      .replace(/;\s*(?=(const|let|var|import|export|async|function|return|console|if|for|while)\b)/g, ";\n")
      .replace(/\}\s*(?=(const|let|var|export|async|function|return|console|if|for|while)\b)/g, "}\n")
      .replace(/\)\s*(?=(const|let|var|export|async|function|return|console|if|for|while)\b)/g, ")\n")
      .replace(/\s{2,}/g, " ")
      .replace(/\n\s+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function formatJsonLike(text) {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch (_error) {
      return formatJavaScriptLike(text);
    }
  }

  function formatShellLike(text) {
    return text
      .replace(/\s+(?=(wrangler|npm|pnpm|yarn|bun|curl|export|echo|cd|mkdir|git)\b)/g, "\n")
      .trim();
  }

  function looksLikeDiagram(text) {
    return /[│├└┌┐┬┼]/.test(text) || /\b[A-Za-z][A-Za-z ]+\s{4,}[│├└]/.test(text);
  }

  function formatDiagramLike(text) {
    return cleanupRestoredCode(repairKnownTermLineBreaks(text)
      .replace(/([A-Za-z0-9)）])(?=(?:ByteDance|Google|Amazon|Meta|Microsoft|OpenAI)\s{2,})/g, "$1\n")
      .replace(/([A-Za-z0-9)）])(?=(?:YouTube|TikTok)\s*\/)/g, "$1\n")
      .replace(/\s+\|\s*(?=│)/g, "\n")
      .replace(/\s+(?=│)/g, "\n")
      .replace(/\s{6,}(?=│|├|└|┌|┐|┬|┼)/g, "\n")
      .replace(/\s{4,}(?=[A-Za-z\u4e00-\u9fff][^\n]{0,80}(?:│|├|└|→))/g, "\n")
      .replace(/(│|├──|└──)\s{6,}/g, "$1 ")
      .replace(/\n{3,}/g, "\n\n"));
  }

  function looksLikeConcatenatedTitleList(text) {
    const value = String(text || "").trim();
    if (value.includes("\n") || value.length > 360) return false;
    if (looksLikePackedStructure(value)) return true;
    if (looksLikeChinesePackedList(value)) return true;
    if (containsAdjacentKnownTerms(value)) return true;
    const titleMatches = value.match(/[A-Z][a-z]+(?: [A-Z][a-z]+)*/g) || [];
    return titleMatches.length >= 3 && /[a-z][A-Z]/.test(value);
  }

  function formatConcatenatedTitleList(text) {
    const protectedText = protectKnownCompoundTerms(insertKnownTermBoundaries(repairKnownTermLineBreaks(text)));
    return cleanupRestoredCode(restoreKnownCompoundTerms(protectedText
      .replace(/([^\n])(?=\bLayer\s*\d+\b)/g, "$1\n")
      .replace(/\bLayer\s*(\d+)(?=[^\s:：)）\]】])/g, "Layer $1 ")
      .replace(/([a-z0-9)）])(?=[A-Z][a-z])/g, "$1\n")
      .replace(/([A-Za-z0-9)）])(?=(?:AI Infrastructure|Application Layer|Recommendation System|Recommendation Engine|Creator Economy|Advertising Engine|User Data Platform|Data Trust|Product Trust|Narrative Trust|Legal Trust|Identity|Corporate|Product|Platform|Applications)\b)/g, "$1\n")
      .replace(/(系统)(?=[\u4e00-\u9fff])/g, "$1\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()));
  }

  function looksLikePackedStructure(text) {
    return /\bLayer\s*\d+[^\n]+\bLayer\s*\d+\b/.test(String(text || ""));
  }

  function looksLikeChinesePackedList(text) {
    const value = String(text || "").trim();
    return !/\s/.test(value) && value.length >= 10 && /(系统|資料|数据|平台|生态|引擎).+(系统|資料|数据|平台|生态|引擎)/.test(value);
  }

  function containsAdjacentKnownTerms(text) {
    return adjacentKnownTermPattern().test(String(text || ""));
  }

  function insertKnownTermBoundaries(text) {
    const pattern = adjacentKnownTermPattern();
    let value = String(text || "");
    for (let pass = 0; pass < 4; pass += 1) {
      const next = value.replace(pattern, "$1\n");
      if (next === value) break;
      value = next;
    }
    return value;
  }

  function adjacentKnownTermPattern() {
    const terms = [
      "ByteDance",
      "TikTok",
      "Douyin",
      "Toutiao",
      "Lemon8",
      "CapCut",
      "YouTube",
      "Google",
      "Android OS",
      "Maps",
      "Gmail",
      "Recommendation System",
      "Recommendation Engine",
      "AI Infrastructure",
      "Creator Economy",
      "Advertising Engine",
      "User Data Platform"
    ].map(escapeRegExp).join("|");
    return new RegExp(`(${terms})(?=(?:${terms}))`, "g");
  }

  function protectKnownCompoundTerms(text) {
    let value = String(text || "");
    knownCompoundTerms().forEach((term, index) => {
      value = value.replace(new RegExp(escapeRegExp(term), "g"), `__LTF_TERM_${index}__`);
    });
    return value;
  }

  function restoreKnownCompoundTerms(text) {
    let value = String(text || "");
    knownCompoundTerms().forEach((term, index) => {
      value = value.replace(new RegExp(`__LTF_TERM_${index}__`, "g"), term);
    });
    return value;
  }

  function repairKnownTermLineBreaks(text) {
    let value = String(text || "");
    for (const term of knownCompoundTerms()) {
      const pieces = term.match(/[A-Z]+(?=[A-Z][a-z])|[A-Z]?[a-z0-9]+|[A-Z]+/g);
      if (!pieces || pieces.length < 2) continue;
      const pattern = new RegExp(pieces.map(escapeRegExp).join("\\s*\\n\\s*"), "g");
      value = value.replace(pattern, term);
    }
    return value;
  }

  function knownCompoundTerms() {
    return [
      "ByteDance",
      "TikTok",
      "CapCut",
      "ChatGPT",
      "LocalThink",
      "BizClaw",
      "VibeFast",
      "Luckyman",
      "Cityman",
      "DankoAI",
      "VolcanoEngine",
      "YouTube",
      "GitHub",
      "OpenAI"
    ];
  }

  function cleanupRestoredCode(text) {
    return String(text || "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function formatArrowDiagram(text) {
    return text
      .replace(/\s*↓\s*/g, "\n  ↓\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function detectCodeLanguage(pre, code) {
    const raw = [
      pre.getAttribute("data-language"),
      code.getAttribute("data-language"),
      code.className,
      pre.innerText?.split("\n")[0]
    ].filter(Boolean).join(" ");

    if (/typescript|tsx/i.test(raw)) return "ts";
    if (/javascript|jsx/i.test(raw)) return "js";
    if (/python/i.test(raw)) return "py";
    if (/bash|shell|zsh|sh/i.test(raw)) return "bash";
    if (/json/i.test(raw)) return "json";
    if (/yaml|yml/i.test(raw)) return "yaml";
    if (/html/i.test(raw)) return "html";
    if (/css/i.test(raw)) return "css";
    return "";
  }

  function list(node, ordered) {
    const items = Array.from(node.children).filter((child) => child.tagName?.toLowerCase() === "li");
    return `${items.map((item, index) => {
      const marker = ordered ? `${index + 1}.` : "-";
      const text = cleanText(children(item, {})).replace(/\n/g, "\n  ");
      return `${marker} ${text}`;
    }).join("\n")}\n\n`;
  }

  function quoteBlock(value) {
    const text = cleanText(value);
    return text ? `${text.split("\n").map((line) => `> ${line}`).join("\n")}\n\n` : "";
  }

  function link(node, context) {
    const text = cleanText(children(node, context));
    const href = node.getAttribute("href");
    if (!href || !text || href.startsWith("#")) return text;
    return `[${text}](${href})`;
  }

  function table(node) {
    const rows = Array.from(node.querySelectorAll("tr")).map((row) =>
      Array.from(row.children).map((cell) => cleanText(cell.textContent || ""))
    ).filter((row) => row.length);

    if (!rows.length) return "";

    const width = Math.max(...rows.map((row) => row.length));
    const normalized = rows.map((row) => Array.from({ length: width }, (_, index) => row[index] || ""));
    const header = normalized[0];
    const separator = header.map(() => "---");
    const body = normalized.slice(1);
    return [
      `| ${header.join(" | ")} |`,
      `| ${separator.join(" | ")} |`,
      ...body.map((row) => `| ${row.join(" | ")} |`)
    ].join("\n") + "\n\n";
  }

  function cleanInline(value) {
    return String(value || "").replace(/\s+/g, " ").trim().replace(/`/g, "\\`");
  }

  function cleanMarkdown(value) {
    return String(value || "")
      .replace(/[\u2028\u2029]/g, "\n")
      .replace(/\u00a0/g, " ")
      .replace(/\ufffc/g, "")
      .replace(/\b(?:Viewed a file|Created \d+ files?|Created a file|Ran a command|Read a file|Searched the web)(?:,\s*(?:viewed a file|created \d+ files?|created a file|ran a command|read a file))*\b/gi, "")
      .replace(/,\s*(?:viewed a file|created \d+ files?|created a file|ran a command|read a file)/gi, "")
      .replace(/^[^\n]{1,120}Document\s+·\s+(?:MD|Code|HTML|Text)\s*$/gim, "")
      .replace(/^你说\s*/gm, "")
      .replace(/Show more\s*Show less/g, "")
      .replace(/\bShow more\b/g, "")
      .replace(/\bShow less\b/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim();
  }

  function detectModel(platform) {
    const text = document.body.innerText || "";
    const match = text.match(/\bGPT-?5(?:\.\d+)?\b|\bGPT-?4(?:\.\d+|o)?\b|\bo[134]\b/i);
    return match?.[0];
  }

  function buildQualityReport(turns, options = {}) {
    const text = turns.map((turn) => turn.text).join("\n");
    const humanTurns = turns.filter((turn) => turn.role === "human").length;
    const assistantTurns = turns.filter((turn) => turn.role === "assistant").length;
    const codeBlocks = (text.match(/```/g) || []).length / 2;
    const unbalancedCodeFence = (text.match(/```/g) || []).length % 2 !== 0;
    const possibleVirtualization = options.platform === "chatgpt" &&
      turns.length <= 8 &&
      document.body.innerText.length > 5000;
    const roleImbalance = Math.abs(humanTurns - assistantTurns);
    const sameRoleAdjacency = countSameRoleAdjacency(turns);
    const turnSequence = analyzeTurnSequence(turns);
    const idCoverage = analyzeIdCoverage(turns);
    const warnings = [];

    if (!humanTurns || !assistantTurns) warnings.push("Could not clearly identify both human and AI turns.");
    if (unbalancedCodeFence) warnings.push("Captured markdown has an unbalanced code fence.");
    if (options.platform === "chatgpt" && options.scrollComplete === false) {
      warnings.push(`ChatGPT DOM sweep stopped before reaching the page bottom (${options.scrollSteps || 0} steps, ${Math.round(options.scrollTop || 0)}/${Math.round(options.scrollHeight || 0)}px). Capture again after letting the page finish scrolling.`);
    }
    if (possibleVirtualization) warnings.push("Only the currently rendered ChatGPT messages may have been captured. Scroll the conversation, wait for older messages to load, and capture again.");
    if (sameRoleAdjacency) warnings.push(`Detected ${sameRoleAdjacency} adjacent same-role turn pairs. Review for missed or mismatched turns.`);
    if (roleImbalance > 1) warnings.push(`Human/AI turn count is imbalanced by ${roleImbalance}. Review the preview before saving.`);
    if (turnSequence.missingCount) warnings.push(`Detected ${turnSequence.missingCount} missing ChatGPT turn numbers within the captured range.`);
    if (turns.length > 200) warnings.push("A very high number of turns was captured. Review the preview for app navigation or history entries.");
    if (looksLikeAppChromeText(text)) warnings.push("Possible app navigation or sidebar text was captured. Review the preview before saving.");

    return {
      turnCount: turns.length,
      humanTurns,
      assistantTurns,
      codeBlocks,
      captureStrategy: options.captureStrategy || "visible-dom",
      unbalancedCodeFence,
      possibleVirtualization,
      sameRoleAdjacency,
      roleImbalance,
      turnMin: turnSequence.min,
      turnMax: turnSequence.max,
      missingTurnCount: turnSequence.missingCount,
      missingTurnRanges: turnSequence.missingRanges,
      messageIdCount: idCoverage.messageIdCount,
      turnIdCount: idCoverage.turnIdCount,
      scrollComplete: options.scrollComplete,
      scrollSteps: options.scrollSteps || 0,
      scrollTop: Math.round(options.scrollTop || 0),
      scrollHeight: Math.round(options.scrollHeight || 0),
      warnings
    };
  }

  function countSameRoleAdjacency(turns) {
    let count = 0;
    for (let index = 1; index < turns.length; index += 1) {
      if (turns[index - 1].role === turns[index].role) count += 1;
    }
    return count;
  }

  function analyzeTurnSequence(turns) {
    const numbers = Array.from(new Set(turns
      .map((turn) => turn.captureTurnNumber)
      .filter((value) => Number.isInteger(value) && value > 0)))
      .sort((a, b) => a - b);

    if (!numbers.length) {
      return { min: 0, max: 0, missingCount: 0, missingRanges: "" };
    }

    const min = numbers[0];
    const max = numbers[numbers.length - 1];
    const present = new Set(numbers);
    const missing = [];
    for (let value = min; value <= max; value += 1) {
      if (!present.has(value)) missing.push(value);
    }

    return {
      min,
      max,
      missingCount: missing.length,
      missingRanges: compactNumberRanges(missing)
    };
  }

  function analyzeIdCoverage(turns) {
    return {
      messageIdCount: turns.filter((turn) => turn.captureMessageId).length,
      turnIdCount: turns.filter((turn) => turn.captureTurnId).length
    };
  }

  function compactNumberRanges(values) {
    if (!values.length) return "";
    const ranges = [];
    let start = values[0];
    let previous = values[0];
    for (const value of values.slice(1)) {
      if (value === previous + 1) {
        previous = value;
        continue;
      }
      ranges.push(start === previous ? String(start) : `${start}-${previous}`);
      start = value;
      previous = value;
    }
    ranges.push(start === previous ? String(start) : `${start}-${previous}`);
    return ranges.slice(0, 20).join(",");
  }

  function cleanTitle(title) {
    return String(title || "")
      .replace(/\s*[-|]\s*ChatGPT\s*$/i, "")
      .replace(/\s*[-|]\s*Google Gemini\s*$/i, "")
      .replace(/^ChatGPT\s*[-|]\s*/i, "")
      .replace(/^Google Gemini\s*[-|]\s*/i, "")
      .trim() || "ChatGPT Conversation";
  }
})();
