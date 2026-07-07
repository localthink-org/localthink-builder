export function buildLtfDocument(metadata, turns) {
  const cleanTurns = Array.isArray(turns) ? turns.filter((turn) => turn.text?.trim()) : [];
  const frontmatter = buildFrontmatter(metadata, cleanTurns);
  const body = buildBody(metadata, cleanTurns);
  return normalizeLineTerminators(`${frontmatter}\n\n${body}\n`);
}

export function suggestFilename(title) {
  const slug = slugify(title || "local-think-conversation");
  return `${slug || "local-think-conversation"}.ltf.md`;
}

export function slugify(value) {
  return normalizeLineTerminators(value)
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
  const value = normalizeLineTerminators(text);
  if (/[\u4e00-\u9fff]/.test(value)) {
    if (/[开说发项变现与战这为逻辑经典独]/.test(value)) {
      return "zh-CN";
    }
    return "zh-TW";
  }
  if (/[\u3040-\u30ff]/.test(value)) return "ja";
  if (/[\uac00-\ud7af]/.test(value)) return "ko";
  return "en";
}

export function titleFromDocumentTitle(title) {
  return normalizeScalar(title)
    .replace(/\s*[-|]\s*ChatGPT\s*$/i, "")
    .replace(/\s*[-|]\s*Claude\s*$/i, "")
    .replace(/\s*[-|]\s*Gemini\s*$/i, "")
    .replace(/\s*[-|]\s*Grok\s*$/i, "")
    .replace(/^ChatGPT\s*[-|]\s*/i, "")
    .replace(/^Claude\s*[-|]\s*/i, "")
    .replace(/^Gemini\s*[-|]\s*/i, "")
    .replace(/^Grok\s*[-|]\s*/i, "")
    .trim() || "AI Conversation";
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
    `# ${normalizeScalar(metadata.title) || "ChatGPT Conversation"}`,
    "",
    "## Conversation",
    "",
    `### Session: ${normalizeScalar(metadata.created) || today()}`,
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
  return normalizeLineTerminators(text)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildSummary(metadata, turns) {
  const title = normalizeScalar(metadata.title);
  const firstHuman = turns.find((turn) => turn.role === "human")?.text || "";
  const topic = firstMeaningfulTopic(firstHuman) || title;
  const language = metadata.language || detectLanguage(turns.map((turn) => turn.text).join("\n"));

  return buildLocalizedSummary({
    title: title && title !== "ChatGPT Conversation" ? title : "",
    language,
    turnCount: turns.length,
    topic,
    source: "builder"
  });
}

function buildLocalizedSummary(options) {
  const language = normalizeLanguage(options.language);
  const title = normalizeScalar(options.title);
  const topic = normalizeScalar(options.topic).slice(0, 120);
  const count = options.turnCount;

  if (language.startsWith("zh")) {
    const displayTitle = title ? `「${title}」` : "這場對話";
    const sourceText = options.source === "builder" ? "，完整內容由 LTF Builder 擷取並轉換為 LTF" : "";
    if (topic) {
      return `這份 LTF 文件保存了${displayTitle}，共 ${count} 個回合。主題從「${topic}」開始${sourceText}。`;
    }
    return `這份 LTF 文件保存了${displayTitle}，共 ${count} 個回合${sourceText}。`;
  }

  if (language === "ja") {
    const displayTitle = title ? `「${title}」` : "このAI対話";
    return topic
      ? `このLTFファイルは${displayTitle}を保存しています。全 ${count} ターン。会話は「${topic}」から始まります。`
      : `このLTFファイルは${displayTitle}を保存しています。全 ${count} ターン。`;
  }

  if (language === "ko") {
    const displayTitle = title ? `「${title}」` : "이 AI 대화";
    return topic
      ? `이 LTF 파일은 ${displayTitle}를 저장합니다. 총 ${count}턴입니다. 대화는 「${topic}」에서 시작합니다.`
      : `이 LTF 파일은 ${displayTitle}를 저장합니다. 총 ${count}턴입니다.`;
  }

  if (language === "fr") {
    const displayTitle = title ? `« ${title} »` : "une conversation IA";
    return topic
      ? `Ce fichier LTF conserve ${displayTitle} avec ${count} tours. La conversation commence par : ${topic}.`
      : `Ce fichier LTF conserve ${displayTitle} avec ${count} tours.`;
  }

  if (language === "de") {
    const displayTitle = title ? `"${title}"` : "eine KI-Unterhaltung";
    return topic
      ? `Diese LTF-Datei bewahrt ${displayTitle} mit ${count} Runden auf. Die Unterhaltung beginnt mit: ${topic}.`
      : `Diese LTF-Datei bewahrt ${displayTitle} mit ${count} Runden auf.`;
  }

  if (language === "es") {
    const displayTitle = title ? `"${title}"` : "una conversación con IA";
    return topic
      ? `Este archivo LTF conserva ${displayTitle} con ${count} turnos. La conversación empieza con: ${topic}.`
      : `Este archivo LTF conserva ${displayTitle} con ${count} turnos.`;
  }

  const displayTitle = title
    ? `"${title}"`
    : options.source === "builder" ? "a browser-captured AI conversation" : "an AI conversation";
  const turnPhrase = options.source === "builder" ? `${count} captured turns` : `${count} turns`;
  return topic
    ? `This LTF document preserves ${displayTitle} with ${turnPhrase}. The conversation starts from: ${topic}.`
    : `This LTF document preserves ${displayTitle} with ${turnPhrase}.`;
}

function normalizeLanguage(language) {
  const value = String(language || "").toLowerCase();
  if (value.startsWith("zh")) return "zh";
  if (value.startsWith("ja")) return "ja";
  if (value.startsWith("ko")) return "ko";
  if (value.startsWith("fr")) return "fr";
  if (value.startsWith("de")) return "de";
  if (value.startsWith("es")) return "es";
  return "en";
}

function firstMeaningfulTopic(text) {
  return normalizeLineTerminators(text)
    .replace(/https?:\/\/\S+/gi, " ")
    .split(/\n|。|\.|\?|？/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .find((part) => part && !/^https?:/i.test(part)) || "";
}

function parseTags(value) {
  return normalizeLineTerminators(value)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function add(lines, key, value) {
  lines.push(`${key}: ${quote(value)}`);
}

function addRaw(lines, key, value) {
  const normalized = typeof value === "string" ? normalizeScalar(value) : value;
  if (normalized !== undefined && normalized !== null && normalized !== "") {
    lines.push(`${key}: ${normalized}`);
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
  return `"${normalizeScalar(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function normalizeLineTerminators(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u2028\u2029]/g, "\n");
}

function normalizeScalar(value) {
  return normalizeLineTerminators(value)
    .replace(/\s+/g, " ")
    .trim();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}
