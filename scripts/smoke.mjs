import { buildLtfDocument, suggestFilename, titleFromDocumentTitle } from "../src/ltf.js";

const doc = buildLtfDocument(
  {
    title: "Test Conversation",
    created: "2026-05-18",
    updated: "2026-05-18T12:00:00-04:00",
    platform: "chatgpt",
    language: "en",
    visibility: "private",
    tags: "LocalThink, test",
    captureQuality: {
    turnCount: 2,
    humanTurns: 1,
    assistantTurns: 1,
    codeBlocks: 0,
    captureStrategy: "visible-dom",
    sameRoleAdjacency: 0,
    roleImbalance: 0,
    turnMin: 1,
    turnMax: 2,
    missingTurnCount: 0,
    scrollComplete: true,
    scrollSteps: 4,
    scrollTop: 1200,
    scrollHeight: 1200
  }
  },
  [
    { role: "human", text: "Hello" },
    { role: "assistant", text: "Hi" }
  ]
);

const required = [
  'localthink: "1.0"',
  "created: 2026-05-18",
  "platform: chatgpt",
  "language: en",
  "source: builder",
  'x_builder: "browser-extension"',
  "x_capture_turns: 2",
  'x_capture_strategy: "visible-dom"',
  "x_capture_turn_min: 1",
  "x_capture_turn_max: 2",
  "x_capture_scroll_complete: true",
  "x_capture_scroll_steps: 4",
  "**Human:** Hello",
  "**AI:** Hi"
];

for (const fragment of required) {
  if (!doc.includes(fragment)) {
    throw new Error(`Smoke test failed. Missing: ${fragment}`);
  }
}

if (suggestFilename("Test Conversation") !== "test-conversation.ltf.md") {
  throw new Error("Smoke test failed. Filename suggestion mismatch.");
}

if (suggestFilename("开源项目变现：机遇与挑战") !== "开源项目变现-机遇与挑战.ltf.md") {
  throw new Error("Smoke test failed. Unicode filename suggestion mismatch.");
}

const zhDoc = buildLtfDocument(
  {
    title: "ByteDance 全球化架构分析",
    platform: "chatgpt"
  },
  [
    { role: "human", text: "https://www.bytedance.com/en/ 討論一下bytedance的全球化公司架構" },
    { role: "assistant", text: "好的" }
  ]
);

if (!zhDoc.includes('summary: "這份 LTF 文件保存了「ByteDance 全球化架构分析」，共 2 個回合。主題從「討論一下bytedance的全球化公司架構」開始')) {
  throw new Error("Smoke test failed. Chinese summary should ignore leading URLs.");
}

const claudeDoc = buildLtfDocument(
  {
    title: "Claude Research Notes",
    platform: "claude",
    language: "en",
    captureAdapter: "browser-extension-claude-v2.1",
    captureQuality: {
      turnCount: 2,
      humanTurns: 1,
      assistantTurns: 1,
      codeBlocks: 0,
      captureStrategy: "claude-visible-dom",
      sameRoleAdjacency: 0,
      roleImbalance: 0,
      turnMin: 1,
      turnMax: 2,
      missingTurnCount: 0,
      messageIdCount: 0,
      turnIdCount: 0,
      scrollComplete: true
    }
  },
  [
    { role: "human", text: "Summarize this research thread." },
    { role: "assistant", text: "Here is a concise summary." }
  ]
);

for (const fragment of [
  "platform: claude",
  'x_capture_adapter: "browser-extension-claude-v2.1"',
  'x_capture_strategy: "claude-visible-dom"',
  "    platform: claude",
  "**Human:** Summarize this research thread.",
  "**AI:** Here is a concise summary."
]) {
  if (!claudeDoc.includes(fragment)) {
    throw new Error(`Smoke test failed. Missing Claude fragment: ${fragment}`);
  }
}

const geminiDoc = buildLtfDocument(
  {
    title: "Gemini Research Notes",
    platform: "gemini",
    language: "en",
    captureAdapter: "browser-extension-gemini-v0.1",
    captureQuality: {
      turnCount: 2,
      humanTurns: 1,
      assistantTurns: 1,
      codeBlocks: 0,
      captureStrategy: "gemini-direct-dom-sweep-v0.1",
      sameRoleAdjacency: 0,
      roleImbalance: 0,
      turnMin: 1,
      turnMax: 2,
      missingTurnCount: 0,
      messageIdCount: 0,
      turnIdCount: 0,
      scrollComplete: true,
      scrollSteps: 6
    }
  },
  [
    { role: "human", text: "Compare local AI options." },
    { role: "assistant", text: "Here are the main tradeoffs." }
  ]
);

for (const fragment of [
  "platform: gemini",
  'x_capture_adapter: "browser-extension-gemini-v0.1"',
  'x_capture_strategy: "gemini-direct-dom-sweep-v0.1"',
  "x_capture_scroll_steps: 6",
  "    platform: gemini",
  "**Human:** Compare local AI options.",
  "**AI:** Here are the main tradeoffs."
]) {
  if (!geminiDoc.includes(fragment)) {
    throw new Error(`Smoke test failed. Missing Gemini fragment: ${fragment}`);
  }
}

if (titleFromDocumentTitle("Gemini Research Notes - Gemini") !== "Gemini Research Notes") {
  throw new Error("Smoke test failed. Gemini title cleanup mismatch.");
}

const grokDoc = buildLtfDocument(
  {
    title: "Grok Research Notes",
    platform: "grok",
    language: "en",
    captureAdapter: "browser-extension-grok-v0.1",
    captureQuality: {
      turnCount: 2,
      humanTurns: 1,
      assistantTurns: 1,
      codeBlocks: 0,
      captureStrategy: "grok-direct-dom-sweep-v0.1",
      sameRoleAdjacency: 0,
      roleImbalance: 0,
      turnMin: 1,
      turnMax: 2,
      missingTurnCount: 0,
      messageIdCount: 0,
      turnIdCount: 0,
      scrollComplete: true,
      scrollSteps: 5
    }
  },
  [
    { role: "human", text: "Summarize this Grok thread." },
    { role: "assistant", text: "Here are the key points." }
  ]
);

for (const fragment of [
  "platform: grok",
  'x_capture_adapter: "browser-extension-grok-v0.1"',
  'x_capture_strategy: "grok-direct-dom-sweep-v0.1"',
  "x_capture_scroll_steps: 5",
  "    platform: grok",
  "**Human:** Summarize this Grok thread.",
  "**AI:** Here are the key points."
]) {
  if (!grokDoc.includes(fragment)) {
    throw new Error(`Smoke test failed. Missing Grok fragment: ${fragment}`);
  }
}

if (titleFromDocumentTitle("Grok Research Notes - Grok") !== "Grok Research Notes") {
  throw new Error("Smoke test failed. Grok title cleanup mismatch.");
}

const jaDoc = buildLtfDocument(
  {
    title: "ローカルAI",
    platform: "chatgpt",
    language: "ja"
  },
  [
    { role: "human", text: "ローカルでAIを動かす方法を教えて" },
    { role: "assistant", text: "いくつかの方法があります。" }
  ]
);

if (!jaDoc.includes('summary: "このLTFファイルは「ローカルAI」を保存しています。全 2 ターン。会話は「ローカルでAIを動かす方法を教えて」から始まります。"')) {
  throw new Error("Smoke test failed. Japanese summary should use localized turn wording.");
}

const frDoc = buildLtfDocument(
  {
    title: "Notes IA locale",
    platform: "chatgpt",
    language: "fr"
  },
  [
    { role: "human", text: "Comment exécuter un modèle local ?" },
    { role: "assistant", text: "Voici une approche simple." }
  ]
);

if (!frDoc.includes('summary: "Ce fichier LTF conserve « Notes IA locale » avec 2 tours. La conversation commence par : Comment exécuter un modèle local."')) {
  throw new Error("Smoke test failed. French summary should use localized turn wording.");
}

const unusualLineDoc = buildLtfDocument(
  {
    title: "Unusual\u2028Title",
    platform: "chatgpt",
    tags: "alpha\u2029beta"
  },
  [
    { role: "human", text: "1. 核心技术违规出口\u2028Manus 的核心 AI 技术" },
    { role: "assistant", text: "已改成普通换行\u2029不会触发编辑器警告" }
  ]
);

if (/[\u2028\u2029]/.test(unusualLineDoc)) {
  throw new Error("Smoke test failed. LTF output should not contain unusual line terminators.");
}

if (!unusualLineDoc.includes("1. 核心技术违规出口\nManus 的核心 AI 技术")) {
  throw new Error("Smoke test failed. U+2028 should be preserved as a normal newline in turn text.");
}

console.log("Smoke test passed.");
