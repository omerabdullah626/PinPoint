# Pinpoint: In-Reply Bookmarks for AI Chats

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

> A lightweight, privacy-first Chrome extension that lets you bookmark **specific spots inside long AI chat replies** and jump back to them with a single click.

Works seamlessly across **ChatGPT**, **Claude**, **Gemini**, **DeepSeek**, **Perplexity**, **Microsoft Copilot**, **Mistral**, **Poe**, and **Grok**.

---

## The Problem

Modern AI models generate extensive, in-depth responses spanning multiple screens. Existing bookmark extensions either save the entire conversation or just the top of a message. When you want to return to a specific code block, mathematical formulation, or argument buried halfway down a 2,000-word response, you are forced to scroll and search manually.

## The Solution

**Pinpoint** lets you right-click on the exact line, code block, or paragraph you care about and choose **"Bookmark this spot"**. A minimalist, floating panel tracks your spots and smoothly scrolls you right back to them whenever clicked.

---

## Key Features

- 🎯 **In-Reply Precision**: Bookmarks point to exact scroll locations and specific elements within long replies, not just the whole chat or top of a turn.
- 📌 **Smart Floating Pill**:
  - Drag anywhere on the screen.
  - Collapse into a compact, unobtrusive badge (`📌 N`).
  - **Edge-Anchored Expansion**: Expands inward smoothly from wherever you placed it and returns right back to that exact spot when closed—no wandering or jumping across the screen.
- 🛡️ **Isolated Shadow DOM**: UI renders inside an isolated Shadow DOM container. Host website CSS cannot break Pinpoint, and Pinpoint's styling never leaks onto the page.
- ⚡ **Native Smooth Scrolling & Pulse**: Uses native element traversal to bring your bookmarked line directly to the center of your screen, highlighted with a temporary visual pulse.
- 🏷️ **Automatic Snippet Labels**: Automatically creates clean ~40-character preview labels from the text at your click point plus sequential order numbers (`#1`, `#2`, etc.).
- 🌓 **Theme Synchronization**: Automatically detects and adapts to your OS preference and the host site's active light/dark mode.
- 🔒 **100% Client-Side & Private**:
  - Zero external network requests.
  - Zero telemetry, tracking, or analytics.
  - In-memory session storage (bookmarks naturally clear when navigating between chats or refreshing).
  - Minimal permissions: only requests `contextMenus` and host permissions for supported AI domains.

---

## Supported Platforms

| Platform | Domain | Supported Content |
| :--- | :--- | :--- |
| **ChatGPT** | `chatgpt.com`, `chat.openai.com` | Responses, code blocks, tables, lists |
| **Claude** | `claude.ai` | Assistant messages, artifacts, code |
| **Gemini** | `gemini.google.com` | Model responses, markdown cards |
| **DeepSeek** | `chat.deepseek.com` | Markdown output & Deep Thinking traces |
| **Perplexity AI** | `perplexity.ai` | Search synthesis, answer sections, sources |
| **Microsoft Copilot** | `copilot.microsoft.com` | Copilot AI answers & cards |
| **Mistral / Le Chat** | `chat.mistral.ai` | Le Chat assistant conversation turns |
| **Poe** | `poe.com` | Multi-bot replies & markdown blocks |
| **Grok** | `grok.com` | Grok real-time responses & code |
| *Universal Fallback* | Other AI interfaces | Automatic detection of reply containers |

---

## Installation

### Load Unpacked in Chrome / Chromium

Pinpoint runs on any Chromium-based browser (Google Chrome, Brave, Microsoft Edge, Arc, Opera, Vivaldi):

1. **Clone or download** this repository:
   ```bash
   git clone https://github.com/your-username/pinpoint.git
   ```
2. Open your browser and navigate to the extensions page:
   - Chrome: `chrome://extensions`
   - Brave: `brave://extensions`
   - Edge: `edge://extensions`
3. Enable the **"Developer mode"** toggle in the top-right corner.
4. Click the **"Load unpacked"** button in the top-left toolbar.
5. Select the `PinPoint` folder from the cloned repository.
6. The extension is installed and ready to use!

---

## How to Use

1. Navigate to any supported AI chat (e.g. [ChatGPT](https://chatgpt.com), [Claude](https://claude.ai), [Gemini](https://gemini.google.com), [DeepSeek](https://chat.deepseek.com), [Perplexity](https://www.perplexity.ai)).
2. In any long response, **right-click** on the specific paragraph, code snippet, or heading you want to remember.
3. Select **"Bookmark this spot"** from the context menu.
4. The floating **Pinpoint** panel will appear on screen showing your new bookmark with an auto-generated label.
5. Scroll anywhere else in the conversation.
6. **Click the bookmark** in the panel to smoothly glide right back to that exact spot.
7. Click **`−`** to collapse the panel into a draggable badge, or click **`×`** next to any bookmark to delete it.

---

## Project Structure

```text
PinPoint/
├── manifest.json         # Manifest V3 configuration & domain permissions
├── background.js         # Service worker registering context menus
├── content.js            # Content script: site adapters, store, Shadow DOM UI & scrolling
├── icons/                # Extension icons (16px, 32px, 48px, 128px)
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── test/
│   ├── test-logic.js     # Synchronous unit test suite (DOM adapters, exclusions, SPA switching)
│   └── manual-test.html  # Interactive test harness simulating multi-platform chat turns
├── .gitignore            # Git exclusion rules
├── LICENSE               # MIT License
└── README.md             # Documentation
```

---

## Running Tests

Pinpoint includes a comprehensive unit test suite covering DOM adapters, input exclusions, and single-page application (SPA) chat transitions:

```bash
# Run unit test suite
node test/test-logic.js
```

You can also test the visual UI and scrolling interactions directly by opening `test/manual-test.html` in your browser.

---

## Architecture & Technical Highlights

- **Manifest V3 Compliant**: Built strictly around MV3 specifications using background service workers and declarative context menus.
- **Resilient Multi-Site Adapters**: Rather than relying on fragile hashed class names that change on every deploy, Pinpoint targets structural roles, semantic tags, and content containers.
- **Target Tracking**: Captures the exact element and vertical offset during the right-click capture phase.
- **Native Scrolling**: Delegates viewport calculation to browser-native `scrollIntoView({ behavior: 'smooth', block: 'center' })` on the live connected node, ensuring compatibility with nested scrollers and virtualized containers.

---

## Privacy Policy

Pinpoint is strictly local and private:
- No data is ever collected, transmitted, or stored on external servers.
- No third-party scripts, trackers, or CDNs are loaded.
- Bookmarks exist in memory for your current session and reset when a conversation is changed or reloaded.

---

## Contributing

Contributions, feature requests, and bug reports are welcome! Feel free to check the [issues page](https://github.com/your-username/pinpoint/issues) or submit a pull request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
