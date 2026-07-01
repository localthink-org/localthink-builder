import { buildLtfDocument, suggestFilename } from "../src/ltf.js";

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
