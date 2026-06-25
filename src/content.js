(function () {
  const CONTENT_VERSION = "2026-06-23-chatgpt-dom-only-v0.1";
  const CAPTURE_MESSAGE = "LOCALTHINK_CAPTURE_V5";

  if (globalThis.__localthinkContentVersion === CONTENT_VERSION) return;
  globalThis.__localthinkContentVersion = CONTENT_VERSION;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== CAPTURE_MESSAGE) return false;

    try {
      sendResponse({ ok: true, data: captureChatGptConversation() });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return false;
  });

  function captureChatGptConversation() {
    if (!isChatGptPage()) {
      throw new Error("This version only captures ChatGPT web conversations.");
    }

    const turns = extractChatGptTurns();
    if (!turns.length) {
      throw new Error("No ChatGPT conversation turns were found on this page.");
    }

    return {
      platform: "chatgpt",
      title: cleanTitle(document.title),
      url: location.href,
      capturedAt: new Date().toISOString(),
      captureAdapter: "browser-extension-chatgpt-dom-v0.1",
      model: detectModel(),
      turns,
      quality: buildQualityReport(turns)
    };
  }

  function isChatGptPage() {
    return /(^|\.)chatgpt\.com$/i.test(location.hostname) || /^chat\.openai\.com$/i.test(location.hostname);
  }

  function extractChatGptTurns() {
    const roleNodes = Array.from(document.querySelectorAll("[data-message-author-role]"));
    if (roleNodes.length) {
      return roleNodes
        .map((node, index) => turnFromRoleNode(node, index))
        .filter(Boolean);
    }

    const articles = Array.from(document.querySelectorAll("main article"));
    return articles
      .map((article, index) => ({
        role: index % 2 === 0 ? "human" : "assistant",
        text: textFromNode(article)
      }))
      .filter((turn) => isUsefulTurn(turn.text));
  }

  function turnFromRoleNode(node, index) {
    const rawRole = node.getAttribute("data-message-author-role") || "";
    const role = normalizeRole(rawRole, index);
    const text = textFromNode(node);
    if (!isUsefulTurn(text)) return null;
    return { role, text };
  }

  function normalizeRole(rawRole, index) {
    const role = String(rawRole || "").toLowerCase();
    if (role === "assistant") return "assistant";
    if (role === "system") return "system";
    if (role === "tool") return "tool";
    if (role === "user" || role === "human") return "human";
    return index % 2 === 0 ? "human" : "assistant";
  }

  function textFromNode(node) {
    const clone = node.cloneNode(true);
    for (const selector of [
      "button",
      "svg",
      "style",
      "script",
      "noscript",
      "[aria-hidden='true']",
      "[data-testid*='copy' i]",
      "[data-testid*='feedback' i]"
    ]) {
      for (const child of clone.querySelectorAll(selector)) child.remove();
    }

    preserveCodeBlocks(clone);
    return cleanText(clone.innerText || clone.textContent || "");
  }

  function preserveCodeBlocks(root) {
    for (const pre of root.querySelectorAll("pre")) {
      const code = pre.querySelector("code");
      const text = cleanText((code || pre).textContent || "");
      if (!text) continue;
      const replacement = document.createElement("div");
      replacement.textContent = `\n\`\`\`\n${text}\n\`\`\`\n`;
      pre.replaceWith(replacement);
    }
  }

  function detectModel() {
    const text = document.body.innerText || "";
    const match = text.match(/\b(GPT-[45][\w.-]*|o[134](?:-[\w.-]+)?|ChatGPT)\b/i);
    return match ? match[0] : "";
  }

  function buildQualityReport(turns) {
    const text = turns.map((turn) => turn.text).join("\n");
    const humanTurns = turns.filter((turn) => turn.role === "human").length;
    const assistantTurns = turns.filter((turn) => turn.role === "assistant").length;
    const codeBlocks = Math.floor((text.match(/```/g) || []).length / 2);
    const warnings = [];

    if (!humanTurns || !assistantTurns) warnings.push("Could not clearly identify both human and AI turns.");
    if ((text.match(/```/g) || []).length % 2 !== 0) warnings.push("Captured markdown has an unbalanced code fence.");
    if (turns.length <= 2 && (document.body.innerText || "").length > 4000) {
      warnings.push("Only visible ChatGPT messages may have been captured. Scroll the conversation and capture again if older turns are missing.");
    }
    if (turns.length > 200) warnings.push("A very high number of turns was captured. Review the preview before saving.");

    return {
      turnCount: turns.length,
      humanTurns,
      assistantTurns,
      codeBlocks,
      captureStrategy: "visible-dom",
      warnings
    };
  }

  function isUsefulTurn(text) {
    const value = cleanText(text);
    if (value.length < 1) return false;
    if (/^(copy|share|regenerate|like|dislike|read aloud)$/i.test(value)) return false;
    return true;
  }

  function cleanText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function cleanTitle(title) {
    return String(title || "")
      .replace(/\s*[-|]\s*ChatGPT\s*$/i, "")
      .replace(/^ChatGPT\s*[-|]\s*/i, "")
      .trim() || "ChatGPT Conversation";
  }
})();
