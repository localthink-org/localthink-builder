export function buildLtfDocument(metadata, turns) {
  const cleanTurns = Array.isArray(turns) ? turns.filter((turn) => turn.text?.trim()) : [];
  const frontmatter = buildFrontmatter(metadata, cleanTurns);
  const body = buildBody(metadata, cleanTurns);
  return `${frontmatter}\n\n${body}\n`;
}

export function suggestFilename(title) {
  const slug = slugify(title || "local-think-conversation");
  return `${slug || "local-think-conversation"}.ltf.md`;
}

export function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export function detectLanguage(text) {
  if (/[\u4e00-\u9fff]/.test(text)) {
    if (/[开说发项变现与战这为逻辑经典独]/.test(text)) {
      return "zh-CN";
    }
    return "zh-TW";
  }
  return "en";
}

export function titleFromDocumentTitle(title) {
  return String(title || "")
    .replace(/\s*[-|]\s*ChatGPT\s*$/i, "")
    .replace(/^ChatGPT\s*[-|]\s*/i, "")
    .trim() || "ChatGPT Conversation";
}

function buildFrontmatter(metadata, turns) {
  const lines = ["---"];
  const title = metadata.title || "ChatGPT Conversation";
  const created = metadata.created || today();
  const updated = metadata.updated || nowIso();
  const language = metadata.language || detectLanguage(turns.map((turn) => turn.text).join("\n"));

  add(lines, "localthink", "1.0");
  add(lines, "title", title);
  addRaw(lines, "created", created);
  addRaw(lines, "updated", updated);
  addRaw(lines, "platform", metadata.platform || "chatgpt");
  if (metadata.model) add(lines, "model", metadata.model);
  addRaw(lines, "language", language);
  if (metadata.project) add(lines, "project", metadata.project);
  if (metadata.projectId) add(lines, "project_id", metadata.projectId);
  addRaw(lines, "kind", metadata.kind || "conversation");
  addRaw(lines, "status", metadata.status || "active");
  addRaw(lines, "source", "builder");
  add(lines, "x_builder", "browser-extension");
  if (metadata.captureAdapter) add(lines, "x_capture_adapter", metadata.captureAdapter);
  if (metadata.captureQuality) {
    addRaw(lines, "x_capture_turns", metadata.captureQuality.turnCount);
    addRaw(lines, "x_capture_human_turns", metadata.captureQuality.humanTurns);
    addRaw(lines, "x_capture_ai_turns", metadata.captureQuality.assistantTurns);
    addRaw(lines, "x_capture_code_blocks", metadata.captureQuality.codeBlocks);
    if (metadata.captureQuality.captureStrategy) add(lines, "x_capture_strategy", metadata.captureQuality.captureStrategy);
    if (metadata.captureQuality.sameRoleAdjacency) addRaw(lines, "x_capture_same_role_adjacency", metadata.captureQuality.sameRoleAdjacency);
    if (metadata.captureQuality.roleImbalance) addRaw(lines, "x_capture_role_imbalance", metadata.captureQuality.roleImbalance);
    if (metadata.captureQuality.turnMin) addRaw(lines, "x_capture_turn_min", metadata.captureQuality.turnMin);
    if (metadata.captureQuality.turnMax) addRaw(lines, "x_capture_turn_max", metadata.captureQuality.turnMax);
    if (metadata.captureQuality.missingTurnCount) addRaw(lines, "x_capture_missing_turn_count", metadata.captureQuality.missingTurnCount);
    if (metadata.captureQuality.missingTurnRanges) add(lines, "x_capture_missing_turn_ranges", metadata.captureQuality.missingTurnRanges);
    if (metadata.captureQuality.messageIdCount) addRaw(lines, "x_capture_message_id_count", metadata.captureQuality.messageIdCount);
    if (metadata.captureQuality.turnIdCount) addRaw(lines, "x_capture_turn_id_count", metadata.captureQuality.turnIdCount);
    if (metadata.captureQuality.scrollComplete !== undefined) addRaw(lines, "x_capture_scroll_complete", Boolean(metadata.captureQuality.scrollComplete));
    if (metadata.captureQuality.scrollSteps) addRaw(lines, "x_capture_scroll_steps", metadata.captureQuality.scrollSteps);
    if (metadata.captureQuality.scrollTop) addRaw(lines, "x_capture_scroll_top", metadata.captureQuality.scrollTop);
    if (metadata.captureQuality.scrollHeight) addRaw(lines, "x_capture_scroll_height", metadata.captureQuality.scrollHeight);
  }
  addList(lines, "tags", parseTags(metadata.tags));
  addRaw(lines, "visibility", metadata.visibility || "private");
  add(lines, "summary", buildSummary(metadata, turns));
  addList(lines, "insights", []);
  addList(lines, "open_questions", []);
  lines.push("participants:");
  lines.push("  - role: human");
  lines.push("  - role: ai");
  lines.push(`    platform: ${metadata.platform || "chatgpt"}`);
  if (metadata.model) lines.push(`    model: ${quote(metadata.model)}`);
  lines.push("---");

  return lines.join("\n");
}

function buildBody(metadata, turns) {
  const lines = [
    `# ${metadata.title || "ChatGPT Conversation"}`,
    "",
    "## Conversation",
    "",
    `### Session: ${metadata.created || today()}`,
    ""
  ];

  for (const turn of turns) {
    const text = formatTurnText(turn.text);
    if (text.includes("\n")) {
      lines.push(`**${speakerLabel(turn.role)}:**`);
      lines.push(text);
    } else {
      lines.push(`**${speakerLabel(turn.role)}:** ${text}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function speakerLabel(role) {
  if (role === "assistant") return "AI";
  if (role === "system") return "System";
  if (role === "tool") return "Tool";
  return "Human";
}

function formatTurnText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildSummary(metadata, turns) {
  const count = turns.length;
  const title = String(metadata.title || "").trim();
  const firstHuman = turns.find((turn) => turn.role === "human")?.text || "";
  const topic = firstMeaningfulTopic(firstHuman) || title;
  const language = detectLanguage(turns.map((turn) => turn.text).join("\n"));
  const displayTitle = title && title !== "ChatGPT Conversation" ? `「${title}」` : "這場對話";

  if (language.startsWith("zh")) {
    if (topic) {
      return `這份 LTF 文件保存了${displayTitle}，共 ${count} 個回合。主題從「${topic.slice(0, 120)}」開始，完整內容由 LTF Builder 擷取並轉換為 LTF。`;
    }
    return `這份 LTF 文件保存了${displayTitle}，共 ${count} 個回合，完整內容由 LTF Builder 擷取並轉換為 LTF。`;
  }

  if (topic) {
    const englishTitle = title && title !== "ChatGPT Conversation" ? `"${title}"` : "a browser-captured AI conversation";
    return `This LTF document preserves ${englishTitle} with ${count} captured turns. The conversation starts from: ${topic.slice(0, 120)}.`;
  }
  return `This LTF document preserves a browser-captured AI conversation with ${count} captured turns.`;
}

function firstMeaningfulTopic(text) {
  return String(text || "")
    .replace(/https?:\/\/\S+/gi, " ")
    .split(/\n|。|\.|\?|？/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .find((part) => part && !/^https?:/i.test(part)) || "";
}

function parseTags(value) {
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function add(lines, key, value) {
  lines.push(`${key}: ${quote(value)}`);
}

function addRaw(lines, key, value) {
  if (value !== undefined && value !== null && value !== "") {
    lines.push(`${key}: ${value}`);
  }
}

function addList(lines, key, values) {
  if (!values.length) {
    lines.push(`${key}: []`);
    return;
  }

  lines.push(`${key}:`);
  for (const value of values) {
    lines.push(`  - ${quote(value)}`);
  }
}

function quote(value) {
  return `"${String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}
