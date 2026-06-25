# LTF Builder

Chrome plugin for exporting ChatGPT web conversations as LocalThink Format (LTF) files.

This first public version is intentionally conservative:

- supports ChatGPT web pages only
- runs capture only after the user clicks the extension's Capture button
- reads conversation text from the current page DOM
- converts captured turns into `.ltf.md`
- lets the user edit metadata before export
- downloads the generated file locally
- does not collect, transmit, sync, or remotely store conversation data

---

## Install Locally

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select this folder:

```text
localthink-builder
```

6. Open a ChatGPT conversation.
7. Click LTF Builder.
8. Click **Capture**.
9. Edit metadata if needed.
10. Click **Download .ltf.md**.

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
  ↓ inject content script into the active ChatGPT tab
DOM conversation capture
  ↓ deterministic serializer
LTF markdown preview
  ↓ browser download
.ltf.md file
```

LTF Builder does not ask an AI to generate markdown. It does not call LocalThink servers or third-party APIs. All captured data remains in the browser session until the user downloads a local file.

The exported frontmatter includes basic capture diagnostics:

```yaml
x_builder: "browser-extension"
x_capture_adapter: "browser-extension-chatgpt-dom-v0.1"
x_capture_turns: 4
x_capture_human_turns: 2
x_capture_ai_turns: 2
x_capture_code_blocks: 1
x_capture_strategy: "visible-dom"
```

---

## Current Limitations

- Only ChatGPT web conversations are supported in this first version.
- Capture is DOM-based, so very long or virtualized conversations may require the user to scroll first.
- Attachments, images, generated files, and some tool outputs may be captured only as visible text.
- Conversation creation time is not always available in the DOM, so `created` defaults to the current export date unless the user edits it.
