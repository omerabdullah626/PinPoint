# Pinpoint

Chrome extension (Manifest V3) that lets you bookmark specific spots inside long AI chat responses and scroll back to them.

Supported sites:
- ChatGPT (`chatgpt.com`, `chat.openai.com`)
- Claude (`claude.ai`)
- Gemini (`gemini.google.com`)
- DeepSeek (`chat.deepseek.com`)
- Perplexity (`perplexity.ai`)
- Microsoft Copilot (`copilot.microsoft.com`)
- Mistral Le Chat (`chat.mistral.ai`)
- Poe (`poe.com`)
- Grok (`grok.com`)

---

## How It Works

1. Right-click anywhere inside an AI response and select **"Bookmark this spot"**.
2. A floating panel appears on the right with a snippet label from where you clicked.
3. Click any bookmark in the panel to scroll the chat directly back to that element.
4. Click `-` to collapse the panel into a draggable pill. Click the pill to expand it again.
5. Click `x` next to any item to remove it.

---

## Installation

Works on Chrome, Brave, Edge, Arc, and other Chromium browsers.

1. Clone or download this repo:
   ```bash
   git clone https://github.com/omerabdullah626/PinPoint.git
   ```
2. Open `chrome://extensions` in your browser.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** (top-left button).
5. Select the `PinPoint` folder.

---

## Implementation Details

- **Element-level anchoring**: Rather than saving raw container scroll numbers (which shift when content reflows), bookmarks anchor to the clicked DOM element and center it in the viewport via native `scrollIntoView`.
- **Shadow DOM isolation**: The panel and pill UI are rendered inside an open Shadow DOM root attached to the page. Host site CSS cannot leak in, and extension styles cannot leak out.
- **Edge-anchored pill**: When collapsed, the pill remembers where you placed it. Expanding anchors to the pill's edge so the window does not jump across the screen, and collapsing returns the pill to that exact spot.
- **Session storage**: Bookmarks are stored in memory for the active conversation. Navigating to another chat or reloading the page resets the list.
- **Privacy & Permissions**: Requires only the `contextMenus` permission and host permissions for supported chat domains. Makes zero external network requests and collects no telemetry.

---

## Testing

Run the unit tests with Node:

```bash
node test/test-logic.js
```

You can also test the UI manually by opening `test/manual-test.html` in any browser.

---

## License

MIT
