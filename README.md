# Pinpoint: In-Reply Bookmarks for AI Chats

> A Chrome Extension (Manifest V3) that lets you bookmark specific spots inside long AI chat replies across ChatGPT, Claude, Gemini, DeepSeek, Perplexity, Copilot, Mistral, Poe, and Grok, and instantly jump back to them via a floating, draggable panel.

---

## Features

- **In-Reply Precision**: Bookmarks point to exact scroll locations and elements inside long responses, not just the whole chat or reply.
- **Floating Draggable Panel**: Renders in an isolated **Shadow DOM** so it never clashes with host page CSS or theme styles.
- **Draggable & Collapsible**: Drag anywhere on screen by the header. Minimize into a compact badge (`📌 N`) when reading. Edge-anchored expansion ensures it expands inward smoothly and returns exactly where placed.
- **Cross-Platform Adapters**: Dedicated DOM adapters for:
  - **ChatGPT** (`chatgpt.com`, `chat.openai.com`)
  - **Claude** (`claude.ai`)
  - **Gemini** (`gemini.google.com`)
  - **DeepSeek** (`chat.deepseek.com`) — Supports both final markdown answers and reasoning/thinking blocks
  - **Perplexity AI** (`perplexity.ai`)
  - **Microsoft Copilot** (`copilot.microsoft.com`)
  - **Mistral / Le Chat** (`chat.mistral.ai`)
  - **Poe** (`poe.com`)
  - **Grok** (`grok.com`)
  - Universal smart fallback for other chat interfaces
- **Smart Scroll Restoration**:
  - Restores to exact element + vertical offset.
  - Smoothly scrolls the correct scrollable container (handles inner scroll containers).
  - Highlights the bookmarked spot with a temporary pulse.
  - Falls back to raw `scrollTop` if the DOM dynamically virtualized.
- **Auto-Labels**: Extracts a clean ~40-character snippet from the nearest paragraph or heading plus an order number (`#1`, `#2`).
- **SPA Chat Switch Detection**: Automatically clears in-memory bookmarks when navigating to another chat within the single-page application.
- **Light & Dark Theme Support**: Automatically matches your system preference and the host site's active theme.
- **Zero Host Permissions Bloat**: Requires only `contextMenus` and host permissions for the three supported AI chat domains.

---

## File Structure

```text
pinpoint/
├── manifest.json         # Manifest V3 extension configuration
├── background.js         # Service worker registering the context menu
├── content.js            # Content script with site adapters, store, & Shadow DOM UI
├── icons/                # High-res extension icons (16px, 32px, 48px, 128px)
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── test/
│   ├── test-logic.js     # Unit test suite covering adapters, exclusions & SPA navigation
│   └── manual-test.html  # Interactive manual test harness
├── chat-bookmarks-spec.md# Project specification
└── README.md             # Documentation & installation instructions
```

---

## How to Install and Load in Chrome

1. Open **Google Chrome** (or any Chromium browser such as Brave, Edge, or Arc).
2. Navigate to `chrome://extensions` in the address bar.
3. Enable the **"Developer mode"** toggle located in the top-right corner.
4. Click the **"Load unpacked"** button in the top-left toolbar.
5. In the file picker dialog, select this folder (`/home/omer-abdullah/Downloads/pinpoint`).
6. The extension **"Pinpoint - In-Reply Bookmarks for AI Chats"** will appear in your installed extensions list.

---

## How to Use

1. Navigate to any of the supported AI chat websites:
   - [ChatGPT](https://chatgpt.com)
   - [Claude](https://claude.ai)
   - [Gemini](https://gemini.google.com)
2. Open or start a chat with a long response.
3. **Right-click** on any paragraph, code snippet, or heading inside an AI reply.
4. Select **"Bookmark this spot"** from the context menu.
5. The **Pinpoint** floating panel will appear on the right side with your new bookmark.
6. Scroll anywhere else in the conversation, then **click the bookmark in the panel** to smoothly return to that spot.
7. Click the small **`×`** button next to any bookmark to delete it, or click the **`−`** button in the header to collapse the panel into a compact badge.

---

## Running Unit Tests

Run the included unit test suite with Node.js:

```bash
node test/test-logic.js
```

All tests for ChatGPT, Claude, and Gemini reply detection, user message exclusions, label formatting, and SPA URL switching run synchronously and output verified status checks.

---

## Decisions & Chrome Web Store Readiness

- **Storage**: In-memory store per user session (bookmarks reset on manual reload or chat navigation). Interface is cleanly separated in `store` (`list()`, `add()`, `remove()`, `clear()`) to support `chrome.storage.local` if persistent bookmarks are desired in future versions.
- **Security & Privacy**: No external network requests, zero telemetry, no content scripts on unrelated domains, and minimal manifest permissions for seamless Chrome Web Store approval.
