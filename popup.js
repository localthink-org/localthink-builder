import {
  buildLtfDocument,
  detectLanguage,
  suggestFilename,
  titleFromDocumentTitle
} from "./src/ltf.js";

const state = {
  capture: null,
  ltf: ""
};

const CAPTURE_MESSAGE = "LOCALTHINK_CAPTURE_V6";

const elements = {
  captureButton: document.querySelector("#captureButton"),
  downloadButton: document.querySelector("#downloadButton"),
  statusPill: document.querySelector("#statusPill"),
  titleInput: document.querySelector("#titleInput"),
  createdInput: document.querySelector("#createdInput"),
  languageInput: document.querySelector("#languageInput"),
  turnCount: document.querySelector("#turnCount"),
  platformName: document.querySelector("#platformName"),
  qualityPanel: document.querySelector("#qualityPanel"),
  qualityStatus: document.querySelector("#qualityStatus"),
  qualityList: document.querySelector("#qualityList"),
  message: document.querySelector("#message")
};

elements.captureButton.addEventListener("click", captureConversation);
elements.downloadButton.addEventListener("click", downloadLtf);

for (const input of [
  elements.titleInput,
  elements.createdInput,
  elements.languageInput
]) {
  input.addEventListener("input", renderLtf);
}

initializeDefaults();

async function captureConversation() {
  setStatus("Capturing", "");
  setMessage("");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab found.");

    const response = await sendCaptureMessage(tab.id);
    if (!response?.ok) throw new Error(response?.error || "Capture failed.");

    state.capture = response.data;
    populateFromCapture(response.data);
    renderLtf();
    setStatus(response.data.quality?.warnings?.length ? "Review" : "Captured", response.data.quality?.warnings?.length ? "warn" : "ok");
    setMessage(`Captured ${response.data.turns.length} turns from ${response.data.platform}.`);
  } catch (error) {
    setStatus("Error", "error");
    setMessage(error instanceof Error ? error.message : String(error), true);
  }
}

async function sendCaptureMessage(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (!isSupportedConversationUrl(tab.url || "")) {
    throw new Error("Open a supported ChatGPT, Claude, Gemini, or Grok conversation page before capturing.");
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["src/content.js"]
  });
  return chrome.tabs.sendMessage(tabId, {
    type: CAPTURE_MESSAGE
  });
}

function isSupportedConversationUrl(tabUrl) {
  try {
    const url = new URL(tabUrl);
    return /(^|\.)chatgpt\.com$/i.test(url.hostname) ||
      /^chat\.openai\.com$/i.test(url.hostname) ||
      /^claude\.ai$/i.test(url.hostname) ||
      /^gemini\.google\.com$/i.test(url.hostname) ||
      /(^|\.)grok\.com$/i.test(url.hostname) ||
      (/^(x|twitter)\.com$/i.test(url.hostname) && /^\/(?:i\/)?grok(?:\/|$)/i.test(url.pathname));
  } catch (_error) {
    return false;
  }
}

function initializeDefaults() {
  const now = new Date();
  elements.createdInput.value = now.toISOString();
  elements.languageInput.value = "en";
  elements.platformName.textContent = "No capture";
  renderQuality(null);
}

function populateFromCapture(capture) {
  const allText = capture.turns.map((turn) => turn.text).join("\n");
  elements.titleInput.value = titleFromDocumentTitle(capture.title);
  elements.createdInput.value = capture.capturedAt || new Date().toISOString();
  elements.languageInput.value = detectLanguage(allText);
  elements.platformName.textContent = displayPlatform(capture.platform);
  elements.turnCount.textContent = String(capture.turns.length);
  renderQuality(capture.quality);
}

function metadataFromForm() {
  const platform = state.capture?.platform || "chatgpt";
  return {
    title: elements.titleInput.value.trim() || defaultTitleForPlatform(platform),
    created: elements.createdInput.value.trim(),
    updated: new Date().toISOString(),
    platform,
    model: state.capture?.model || "",
    language: elements.languageInput.value.trim() || "en",
    project: "",
    projectId: "",
    kind: "conversation",
    status: "active",
    visibility: "private",
    tags: "",
    captureAdapter: state.capture?.captureAdapter || "",
    captureQuality: state.capture?.quality
  };
}

function displayPlatform(platform) {
  if (platform === "chatgpt") return "ChatGPT";
  if (platform === "claude") return "Claude";
  if (platform === "gemini") return "Gemini";
  if (platform === "grok") return "Grok";
  return "No capture";
}

function defaultTitleForPlatform(platform) {
  if (platform === "claude") return "Claude Conversation";
  if (platform === "gemini") return "Gemini Conversation";
  if (platform === "grok") return "Grok Conversation";
  if (platform === "chatgpt") return "ChatGPT Conversation";
  return "AI Conversation";
}

function renderQuality(quality) {
  if (!quality) {
    elements.qualityPanel.hidden = false;
    elements.qualityStatus.textContent = "No capture";
    elements.qualityStatus.className = "";
    elements.qualityList.innerHTML = "";
    for (const item of [
      "Capture a supported AI conversation to see export details.",
      "Supports ChatGPT, Claude, Gemini, and Grok."
    ]) {
      const li = document.createElement("li");
      li.textContent = item;
      elements.qualityList.append(li);
    }
    return;
  }

  elements.qualityPanel.hidden = false;
  elements.qualityList.innerHTML = "";
  const warnings = quality.warnings || [];
  elements.qualityStatus.textContent = warnings.length ? "Review" : "Looks good";
  elements.qualityStatus.className = warnings.length ? "warn" : "ok";

  const items = [
    `${quality.turnCount} turns captured (${quality.humanTurns} human, ${quality.assistantTurns} AI)`,
    `Capture strategy: ${quality.captureStrategy || "visible-dom"}`,
    `${quality.codeBlocks} code blocks preserved`
  ];
  if (quality.turnMin && quality.turnMax) {
    items.push(`Captured turn range: ${quality.turnMin}-${quality.turnMax}`);
  }
  if (quality.missingTurnCount) {
    items.push(`Missing turn numbers: ${quality.missingTurnCount}${quality.missingTurnRanges ? ` (${quality.missingTurnRanges})` : ""}`);
  }
  if (quality.messageIdCount || quality.turnIdCount) {
    items.push(`IDs captured: ${quality.messageIdCount || 0} message ids, ${quality.turnIdCount || 0} turn ids`);
  }
  if (quality.scrollComplete !== undefined) {
    items.push(`Scroll sweep: ${quality.scrollComplete ? "complete" : "incomplete"}${quality.scrollSteps ? ` (${quality.scrollSteps} steps)` : ""}`);
  }
  if (quality.scrollHeight) {
    items.push(`Scroll position: ${quality.scrollTop || 0}/${quality.scrollHeight}px`);
  }

  for (const warning of warnings) {
    items.push(warning);
  }

  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    elements.qualityList.append(li);
  }
}

function renderLtf() {
  if (!state.capture) return;

  state.ltf = buildLtfDocument(metadataFromForm(), state.capture.turns);
  elements.downloadButton.disabled = false;
}

function downloadLtf() {
  if (!state.ltf) return;

  const metadata = metadataFromForm();
  const filename = suggestFilename(metadata.title);
  const blob = new Blob([state.ltf], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  setMessage(`Downloaded ${filename}.`);
}

function setStatus(label, kind) {
  elements.statusPill.textContent = label;
  elements.statusPill.className = `pill ${kind || ""}`.trim();
}

function setMessage(message, isError = false) {
  elements.message.textContent = message;
  elements.message.className = isError ? "message error" : "message";
}
