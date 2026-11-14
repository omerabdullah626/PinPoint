# Chrome Extension Spec: In-Reply Bookmarks for AI Chats

> Hand this whole file to any LLM and ask it to build the extension. Everything the builder needs to know is below. Items marked **OPEN** are not decided; the builder must ask the owner rather than guess.

## 1. The idea in one paragraph

AI chat sites (ChatGPT, Claude, Gemini) produce very long replies. Existing bookmark tools save a whole reply or a whole chat. This extension lets the user bookmark a **specific spot inside a reply**, then shows a menu of those spots. Clicking a bookmark scrolls the chat back to that spot.

## 2. Target

- Browser: Chrome, Manifest V3.
- Sites: ChatGPT, Claude, Gemini. **OPEN:** confirm the exact domains with the owner (for example chatgpt.com, claude.ai, gemini.google.com) before writing `matches` in the manifest.
- Scope: prototype. A working, simple version beats a polished one.

## 3. Decisions already made by the owner

| Topic | Decision |
|---|---|
| How to create a bookmark | **Right-click context menu** on the page |
| What a bookmark points to | **Scroll position** in the chat (no text highlight needed) |
| Where the menu lives | Owner's order of preference: **floating draggable panel**; if that is too hard, **docked on the right side** |
| Persistence | **None.** Bookmarks vanish on page reload. This is intentional for the prototype. |

Do not add features beyond this (no export, no sync, no search, no tags) unless the owner asks.

## 4. User flow

1. User is reading a long reply.
2. User right-clicks at the spot they want to remember and picks **"Bookmark this spot"**.
3. A new entry appears in the bookmark panel, with a short auto-label (see 6.3).
4. Later, user clicks the entry in the panel. The chat scrolls back to that spot.
5. User can delete an entry from the panel.

## 5. Suggested architecture

Three parts:

1. **Background service worker** (`background.js`)
   - Registers the context menu item with `chrome.contextMenus.create`, limited to the supported sites.
   - On click, sends a message to the content script in that tab.
2. **Content script** (`content.js`, injected on the supported sites)
   - Listens for `contextmenu` events and remembers the element under the cursor (the last right-click target). This is needed because the context menu API does not tell you which page element was clicked.
   - On the "bookmark" message, captures the position (section 6) and adds it to an in-memory array.
   - Renders and manages the panel.
3. **Panel UI**, rendered by the content script inside a **Shadow DOM** so the host site's CSS cannot break it and ours cannot leak out.

Files: `manifest.json`, `background.js`, `content.js`, `panel.css` (or styles inlined in the shadow root).

Permissions needed: `contextMenus`, plus host permissions for the supported sites. Do not request more than that. `storage` is not needed while there is no persistence.

## 6. Capturing a "scroll position" reliably

This is the hardest part and the part most likely to break, so read carefully.

### 6.1 The problem
Chat apps usually scroll an **inner container**, not the window. A raw `scrollTop` number also breaks if the page loads older messages, expands collapsed content, or re-renders. Saving only a number may land in the wrong place.

### 6.2 Recommended approach
At bookmark time, save:
- A reference to the **nearest message/reply element** around the right-click target.
- The **offset** of the click point from the top of that element (pixels, or ratio of the element's height).
- As a fallback, the raw `scrollTop` of the scroll container.

On click in the panel: scroll that element into view, then add the saved offset. If the element is gone from the DOM, fall back to the raw `scrollTop`. If that also fails, tell the user the spot could not be found rather than silently jumping somewhere wrong.

> **OPEN (confirm with owner):** The owner said "just the scroll position." Saving the nearest-reply-plus-offset is a sturdier way of doing exactly that. Confirm they are happy with it, or whether they want a plain `scrollTop` only.

### 6.3 Labels
Auto-label each bookmark with a short snippet of text near the click point (first ~40 characters of the nearest paragraph or line), plus its order number. **OPEN:** ask whether the owner wants to rename bookmarks. Do not build renaming until they say yes.

### 6.4 Site differences
Each site has different HTML, and class names change often. **Do not hardcode selectors from memory.** Inspect the live page's DOM for each site and find:
- the element that wraps one reply,
- the scrollable container,
- anything stable to anchor on (roles, data attributes, ARIA labels are usually steadier than class names).

Keep per-site details in one small adapter object so a site update only requires changing one place:

```js
const adapters = {
  chatgpt: { getReplies(), getScrollContainer() },
  claude:  { getReplies(), getScrollContainer() },
  gemini:  { getReplies(), getScrollContainer() },
};
```

## 7. The panel

- Default: **floating, draggable, collapsible** window, starting near the right edge.
- Contains: title, collapse button, list of bookmarks (label, click to jump, small delete button).
- Empty state: a short hint such as "Right-click anywhere in a reply and choose Bookmark this spot."
- Must not cover the chat input or block clicks on the page outside its own box.
- If draggable proves difficult, fall back to a fixed panel in the right empty space and tell the owner.
- Lives in a Shadow DOM, has a high z-index, and supports both light and dark themes without hardcoding a color that disappears on one of them.

## 8. Persistence

None for now. Still, keep storage behind a tiny interface so adding it later is a small change:

```js
const store = {
  list(), add(bookmark), remove(id)   // in-memory array today
};
```

Later versions could swap this for `chrome.storage.local` keyed by the chat URL. Do not implement that now. Note for later: these sites are single-page apps, so switching chats does not reload the page. **OPEN:** decide whether bookmarks should clear or stay when the user switches to a different chat without reloading. Ask the owner.

## 9. Edge cases the builder should handle or consciously skip

- Right-click on a spot that is not inside any reply (sidebar, input box): do nothing or show nothing, never create a broken bookmark.
- Very long chats where old messages are not in the DOM yet: say so rather than failing silently.
- Chat switch inside the SPA (see section 8).
- Context menu item should appear only on the supported sites.
- Our own panel must not be bookmarkable or interfere with the right-click target tracking.

## 10. Acceptance test (prototype is done when)

1. On each of the three sites, right-click in a long reply, choose the menu item, and an entry appears in the panel.
2. Scroll far away, click the entry, and the view returns to the same spot within a small tolerance.
3. Create several bookmarks across different replies in the same chat. Each one jumps correctly.
4. Delete works.
5. The panel can be dragged and collapsed and does not break the host page.
6. Reloading the page clears everything (expected).

## 11. Questions the builder must ask the owner before coding

1. Exact domains to support (section 2).
2. Is nearest-reply-plus-offset acceptable for "scroll position" (section 6.2)?
3. Should bookmarks be renamable (section 6.3)?
4. What should happen to bookmarks when switching chats without reloading (section 8)?
5. Is the extension for personal use only (load unpacked in developer mode), or will it be published to the Chrome Web Store? This affects permissions wording and review requirements.

## 12. Instructions to the LLM building this

- Follow sections 3 to 8. Do not add features that are not listed.
- Do not assume anything marked **OPEN**; ask first.
- Verify each site's DOM yourself instead of relying on remembered selectors.
- Deliver the complete file set, plus short steps to load it in Chrome (`chrome://extensions` → Developer mode → Load unpacked).
- Explain anything you could not make work instead of hiding it.
