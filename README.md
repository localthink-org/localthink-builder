# LTF Builder

Chrome extension for exporting ChatGPT, Claude, Gemini, and Grok conversations as LocalThink Format (`.ltf.md`) files.

[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/ltf-builder/icpjoemgdpkmllkngcpndocnalodhfaj)

This version is intentionally conservative:

- supports ChatGPT and Claude web pages, with experimental Gemini and Grok support
- runs capture only after the user clicks the extension's Capture button
- reads conversation text from the current supported conversation page DOM
- uses a targeted turn sweep for long virtualized ChatGPT conversations
- uses a direct DOM sweep with full-DOM completion for Claude conversations
- uses an experimental direct DOM sweep for Gemini conversations
- uses an experimental direct DOM sweep for Grok conversations
- converts captured turns into `.ltf.md`
- lets the user edit metadata before export
- downloads the generated file locally
- does not collect, transmit, sync, or remotely store conversation data

---

## Install

Install LTF Builder from the Chrome Web Store:

https://chromewebstore.google.com/detail/ltf-builder/icpjoemgdpkmllkngcpndocnalodhfaj

After installation:

1. Open a ChatGPT, Claude, Gemini, or Grok conversation.
2. Click LTF Builder.
3. Click **Capture**.
4. Edit metadata if needed.
5. Click **Download .ltf.md**.

---

## Local Development

1. Clone this repository.
2. Open Chrome.
3. Go to `chrome://extensions`.
4. Enable **Developer mode**.
5. Click **Load unpacked**.
6. Select this repository folder:

```text
localthink-builder
```

7. Open a ChatGPT, Claude, Gemini, or Grok conversation.
8. Click LTF Builder.
9. Click **Capture**.
10. Edit metadata if needed.
11. Click **Download .ltf.md**.

---

## Repository Structure

```text
localthink-builder/
├── manifest.json
├── popup.html
├── popup.css
├── popup.js
├── src/
│   ├── content.js
│   └── ltf.js
└── icons/
    └── icon.svg
```

---

## Architecture

```text
Popup UI
  ↓ user clicks Capture
chrome.scripting.executeScript
  ↓ inject content script into the active supported conversation tab
ChatGPT targeted DOM capture, Claude direct DOM sweep, Gemini direct DOM sweep, or Grok direct DOM sweep
  ↓ deterministic serializer
LTF markdown preview
  ↓ browser download
.ltf.md file
```

LTF Builder does not ask an AI to generate markdown. It does not call LocalThink servers or third-party APIs. All captured data remains in the browser session until the user downloads a local file.

The exported frontmatter includes capture diagnostics:

```yaml
x_builder: "browser-extension"
x_capture_adapter: "browser-extension-chatgpt-v2.2"
x_capture_turns: 4
x_capture_human_turns: 2
x_capture_ai_turns: 2
x_capture_code_blocks: 1
x_capture_strategy: "chatgpt-targeted-turn-sweep"
x_capture_scroll_complete: true
```

---

## Privacy

LTF Builder does not collect, transmit, sell, or share user data.

Conversation content is processed locally in the browser only after the user clicks **Capture**. The generated `.ltf.md` file is downloaded directly by the user and is not sent to LocalThink, OpenAI, analytics providers, or any third party.

LTF Builder is not affiliated with OpenAI, ChatGPT, Anthropic, or Claude.
LTF Builder is not affiliated with Google or Gemini.
LTF Builder is not affiliated with xAI, X, Twitter, or Grok.

---

## Validation Notes

- ChatGPT long conversation export has been manually tested with a 322-turn conversation.
- Claude long conversation export has been manually tested with a 528-turn Claude Project conversation, 575 scroll steps, and an approximately 994 KB `.ltf.md` file.

---

## Current Limitations

- ChatGPT and Claude web conversations are supported; Gemini and Grok support are experimental.
- Capture is DOM-based and optimized for ChatGPT's virtualized conversation UI, but ChatGPT DOM changes can still require adapter updates.
- Claude support is experimental and has been manually tested with long Claude Project conversations, but Claude DOM changes can still require adapter updates.
- Gemini support is experimental and needs real-page testing against short and long Gemini conversations.
- Grok support is experimental and needs real-page testing against short and long Grok conversations.
- Attachments, images, generated files, and some tool outputs may be captured only as visible text.
- Conversation creation time is not always available in the DOM, so `created` defaults to the current export date unless the user edits it.

---

## Links

- Chrome Web Store: https://chromewebstore.google.com/detail/ltf-builder/icpjoemgdpkmllkngcpndocnalodhfaj
- Product page: https://localthink.org/ltf-builder
- LocalThink Format: https://github.com/localthink-org/localthink-format
- Privacy Policy: https://localthink.ai/privacy
- X: https://x.com/localthinkai
- Threads: https://www.threads.com/@localthink.ai
