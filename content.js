/**
 * Pinpoint - In-Reply Bookmarks for AI Chats
 * Content Script
 * 
 * Supports ChatGPT, Claude, and Gemini.
 * Tracks right-clicks, captures reply-relative scroll positions,
 * and displays a floating, draggable, collapsible bookmark panel in Shadow DOM.
 */

(() => {
  // Prevent duplicate injection
  if (window.__pinpointInitialized) return;
  window.__pinpointInitialized = true;

  /* ==========================================================================
     1. In-Memory Store (Section 8)
     ========================================================================== */
  const store = {
    _items: [],
    list() {
      return [...this._items];
    },
    add(bookmark) {
      this._items.push(bookmark);
      return bookmark;
    },
    remove(id) {
      this._items = this._items.filter(item => item.id !== id);
      // Re-index orders
      this._items.forEach((item, idx) => {
        item.order = idx + 1;
      });
    },
    clear() {
      this._items = [];
    }
  };

  /* ==========================================================================
     2. Site Adapters (Section 6.4)
     ========================================================================== */
  function getNearestScrollableAncestor(el) {
    let curr = el?.parentElement;
    while (curr && curr !== document.body && curr !== document.documentElement) {
      const style = window.getComputedStyle(curr);
      const overflowY = style.overflowY;
      if ((overflowY === 'auto' || overflowY === 'scroll') && curr.scrollHeight > curr.clientHeight) {
        return curr;
      }
      curr = curr.parentElement;
    }
    return document.scrollingElement || document.documentElement || document.body;
  }

  const adapters = {
    chatgpt: {
      findReply(el) {
        if (!el || typeof el.closest !== 'function') return null;

        // Exclude sidebar, navigation, inputs, headers, send buttons
        if (el.closest('form, nav, aside, header, textarea, [contenteditable="true"], [role="navigation"], button[data-testid="send-button"]')) {
          return null;
        }

        // Exclude user messages explicitly
        if (el.closest('[data-message-role="user"]') ||
            el.closest('[data-message-author-role="user"]') ||
            el.closest('[data-testid*="user"]') ||
            el.closest('.user-message') ||
            el.closest('[data-is-user="true"]')) {
          return null;
        }

        // Modern ChatGPT: data-message-role="assistant" (often on <li data-message-role="assistant">)
        const modernRole = el.closest('[data-message-role="assistant"]');
        if (modernRole) return modernRole;

        // Legacy / alternative ChatGPT attributes
        const authorRole = el.closest('[data-message-author-role="assistant"]');
        if (authorRole) return authorRole;

        const roleAttr = el.closest('[data-role="assistant"]');
        if (roleAttr) return roleAttr;

        // Conversation transcript list item
        const transcriptItem = el.closest('[data-conversation-transcript] li, [aria-label="Conversation"] li');
        if (transcriptItem) return transcriptItem;

        // Conversation turn testid wrapper
        const testIdTurn = el.closest('[data-testid^="conversation-turn-"]');
        if (testIdTurn) return testIdTurn;

        // Agent-turn or conversation-turn class
        const agentTurn = el.closest('.agent-turn, [class*="agent-turn"], [class*="conversation-turn"]');
        if (agentTurn) return agentTurn;

        // Markdown or prose body
        const markdown = el.closest('.markdown, [class*="markdown"], .prose, [class*="prose"]');
        if (markdown) return markdown;

        // Article wrapper
        const article = el.closest('article');
        if (article) return article;

        // Fallback: If clicked inside main or conversation region and not in an excluded zone
        const inMain = el.closest('main, [role="main"], [role="region"][aria-label*="Conversation"]');
        if (inMain) {
          return el.closest('li, [role="listitem"], article, div > div') || el.parentElement;
        }

        return null;
      },
      getScrollContainer() {
        return null; // Will use getNearestScrollableAncestor from anchor element
      }
    },

    claude: {
      findReply(el) {
        if (!el || typeof el.closest !== 'function') return null;

        // Exclude inputs, user turns, and navigation
        if (el.closest('fieldset, div[contenteditable="true"], nav, header, [role="navigation"], form, textarea')) {
          return null;
        }

        if (el.closest('[data-testid="user-message"], .font-user-message, [data-is-user="true"], [data-message-role="user"]')) {
          return null;
        }

        const assistantMsg = el.closest('[data-testid="assistant-message"]') ||
                             el.closest('[data-message-author-role="assistant"]') ||
                             el.closest('[data-message-role="assistant"]') ||
                             el.closest('.font-claude-message, [class*="font-claude-message"]') ||
                             el.closest('[data-is-streaming]') ||
                             el.closest('[data-is-assistant="true"]') ||
                             el.closest('.standard-markdown, [class*="standard-markdown"], [class*="markdown"], [class*="prose"]');
        if (assistantMsg) return assistantMsg;

        const inMain = el.closest('main, [role="main"]');
        if (inMain) {
          return el.closest('div > div') || el.parentElement;
        }

        return null;
      },
      getScrollContainer() {
        return null;
      }
    },

    gemini: {
      findReply(el) {
        if (!el || typeof el.closest !== 'function') return null;

        // Exclude prompt area, user query, and side navigation
        if (el.closest('user-query, .user-query-container, .input-area, rich-textarea, header, nav, mat-sidenav, [role="navigation"], textarea')) {
          return null;
        }

        if (el.closest('[data-test-id*="user"]')) {
          return null;
        }

        const modelResp = el.closest('model-response') ||
                          el.closest('message-content') ||
                          el.closest('.model-response-text, [class*="model-response"]') ||
                          el.closest('.response-container, [class*="response-container"]') ||
                          el.closest('[data-test-id="model-response"], [data-testid*="model-response"]') ||
                          el.closest('.markdown, [class*="markdown"]');
        if (modelResp) return modelResp;

        const inMain = el.closest('main, [role="main"], chat-window');
        if (inMain) {
          return el.closest('div > div') || el.parentElement;
        }

        return null;
      },
      getScrollContainer() {
        return null;
      }
    },

    deepseek: {
      findReply(el) {
        if (!el || typeof el.closest !== 'function') return null;

        if (el.closest('textarea, #chat-input, form, nav, header, aside, [role="navigation"], button')) {
          return null;
        }

        if (el.closest('[data-role="user"]') || el.closest('[data-testid*="user"]')) {
          return null;
        }

        const dsMarkdown = el.closest('.ds-markdown, [class*="ds-markdown"]');
        if (dsMarkdown) return dsMarkdown;

        const dsThink = el.closest('.ds-think-content, [class*="think-content"], [class*="ds-think"]');
        if (dsThink) return dsThink;

        const roleAssistant = el.closest('[data-role="assistant"]');
        if (roleAssistant) return roleAssistant;

        const inFeed = el.closest('[data-conversation-scroll], main, [role="main"]');
        if (inFeed) {
          return el.closest('div > div') || el.parentElement;
        }

        return null;
      },
      getScrollContainer() {
        return document.querySelector('[data-conversation-scroll]');
      }
    },

    perplexity: {
      findReply(el) {
        if (!el || typeof el.closest !== 'function') return null;

        if (el.closest('textarea, [contenteditable="true"], form, nav, aside, header, [role="navigation"], button')) {
          return null;
        }

        if (el.closest('[data-is-user="true"]') || el.closest('[class*="user-query"]')) {
          return null;
        }

        const prose = el.closest('.markdown, [class*="prose"], div[dir="auto"]');
        if (prose) return prose;

        const answer = el.closest('[class*="answer"], [class*="response"], [class*="message"]');
        if (answer) return answer;

        const inMain = el.closest('main, [role="main"]');
        if (inMain) {
          return el.closest('div > div') || el.parentElement;
        }

        return null;
      },
      getScrollContainer() {
        return null;
      }
    },

    copilot: {
      findReply(el) {
        if (!el || typeof el.closest !== 'function') return null;

        if (el.closest('textarea, cib-text-input, form, nav, aside, header, [role="navigation"], button')) {
          return null;
        }

        if (el.closest('[data-is-user="true"]') || el.closest('[data-author="user"]')) {
          return null;
        }

        const aiContent = el.closest('[data-content="ai"]') ||
                          el.closest('cib-message[type="text"]') ||
                          el.closest('[class*="assistant-message"]') ||
                          el.closest('[class*="message-content"]');
        if (aiContent) return aiContent;

        const inMain = el.closest('main, [role="region"], cib-serp');
        if (inMain) {
          return el.closest('div > div') || el.parentElement;
        }

        return null;
      },
      getScrollContainer() {
        return null;
      }
    },

    mistral: {
      findReply(el) {
        if (!el || typeof el.closest !== 'function') return null;

        if (el.closest('textarea, [contenteditable="true"], form, nav, aside, header, [role="navigation"], button')) {
          return null;
        }

        if (el.closest('[data-is-user="true"]') || el.closest('[data-role="user"]')) {
          return null;
        }

        const prose = el.closest('.markdown, [class*="prose"], [class*="markdown"]');
        if (prose) return prose;

        const turn = el.closest('[data-role="assistant"], div.group\\/conversation-turn, [class*="conversation-turn"]');
        if (turn) return turn;

        const inMain = el.closest('main, [role="main"]');
        if (inMain) {
          return el.closest('div > div') || el.parentElement;
        }

        return null;
      },
      getScrollContainer() {
        return null;
      }
    },

    poe: {
      findReply(el) {
        if (!el || typeof el.closest !== 'function') return null;

        if (el.closest('textarea, [class*="ChatMessageInput"], form, nav, aside, header, button')) {
          return null;
        }

        if (el.closest('[class*="ChatMessage_userMessage"], [data-is-user="true"]')) {
          return null;
        }

        const poeMsg = el.closest('[class*="ChatMessage_chatMessage"]') ||
                       el.closest('[class*="Message_messageText"]') ||
                       el.closest('.markdown, [class*="markdown"]');
        if (poeMsg) return poeMsg;

        return null;
      },
      getScrollContainer() {
        return null;
      }
    },

    grok: {
      findReply(el) {
        if (!el || typeof el.closest !== 'function') return null;

        if (el.closest('textarea, form, nav, aside, header, [role="navigation"], button')) {
          return null;
        }

        if (el.closest('[data-testid*="user"], [class*="user-message"]')) {
          return null;
        }

        const grokMsg = el.closest('[class*="response"], [class*="markdown"], [class*="prose"]');
        if (grokMsg) return grokMsg;

        const inMain = el.closest('main, [role="main"]');
        if (inMain) {
          return el.closest('div > div') || el.parentElement;
        }

        return null;
      },
      getScrollContainer() {
        return null;
      }
    },

    generic: {
      findReply(el) {
        if (!el || typeof el.closest !== 'function') return null;
        if (el.closest('form, input, textarea, [contenteditable="true"], nav, aside, header, [role="navigation"]')) {
          return null;
        }
        if (el.closest('[data-message-author-role="user"], [data-message-role="user"], user-query, [data-testid*="user"]')) {
          return null;
        }
        return el.closest('article, li, [role="listitem"], [class*="message"], [class*="response"], [class*="turn"], [class*="markdown"], [class*="prose"]') || el.parentElement;
      },
      getScrollContainer() {
        return null;
      }
    }
  };

  function getCurrentAdapter() {
    const host = window.location.hostname;
    if (host.includes('chatgpt.com') || host.includes('openai.com')) {
      return adapters.chatgpt;
    }
    if (host.includes('claude.ai')) {
      return adapters.claude;
    }
    if (host.includes('gemini.google.com')) {
      return adapters.gemini;
    }
    if (host.includes('deepseek.com')) {
      return adapters.deepseek;
    }
    if (host.includes('perplexity.ai')) {
      return adapters.perplexity;
    }
    if (host.includes('copilot.microsoft.com')) {
      return adapters.copilot;
    }
    if (host.includes('mistral.ai')) {
      return adapters.mistral;
    }
    if (host.includes('poe.com')) {
      return adapters.poe;
    }
    if (host.includes('grok.com')) {
      return adapters.grok;
    }
    return adapters.generic;
  }

  function resolveScrollContainer(anchorEl) {
    if (anchorEl) {
      const container = getNearestScrollableAncestor(anchorEl);
      if (container) return container;
    }
    return document.scrollingElement || document.documentElement || document.body;
  }

  /* ==========================================================================
     3. Auto-Label Extraction (Section 6.3)
     ========================================================================== */
  function extractLabel(targetEl) {
    if (!targetEl) return "Bookmark spot";

    // Find nearest block or structural element
    const blockEl = targetEl.closest('p, h1, h2, h3, h4, h5, h6, li, pre, code, blockquote, td, th') || targetEl;
    let text = (blockEl.innerText || blockEl.textContent || "").trim();

    // Clean whitespace
    text = text.replace(/\s+/g, ' ');

    if (!text && targetEl.parentElement) {
      text = (targetEl.parentElement.innerText || targetEl.parentElement.textContent || "").trim().replace(/\s+/g, ' ');
    }

    if (!text) {
      return "Bookmark spot";
    }

    // Limit to ~40 characters cleanly
    if (text.length > 40) {
      return text.slice(0, 37).trim() + "...";
    }
    return text;
  }

  /* ==========================================================================
     4. Target Tracking & State
     ========================================================================== */
  let lastRightClickInfo = null;
  let isCollapsed = false;
  let toastTimeout = null;

  // Track right-click position and target
  window.addEventListener('contextmenu', (e) => {
    // Check if the click happened inside our shadow DOM root
    const path = e.composedPath ? e.composedPath() : [];
    const insideOurRoot = path.some(el => el && el.id === 'pinpoint-bookmark-root');
    if (insideOurRoot) {
      return;
    }

    const target = (e.target && e.target.nodeType === 3) ? e.target.parentElement : e.target;

    lastRightClickInfo = {
      target: target,
      clientX: e.clientX,
      clientY: e.clientY,
      timestamp: Date.now()
    };
  }, true);

  /* ==========================================================================
     5. Shadow DOM UI & Styling (Section 7)
     ========================================================================== */
  let shadowRoot = null;
  let hostEl = null;

  function isDarkTheme() {
    const docEl = document.documentElement;
    const body = document.body;
    if (docEl.classList.contains('dark') || body?.classList.contains('dark') ||
        docEl.getAttribute('data-theme') === 'dark' || body?.getAttribute('data-theme') === 'dark' ||
        docEl.classList.contains('theme-dark')) {
      return true;
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function getPanelStyles() {
    return `
      :host {
        all: initial;
        position: fixed;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        line-height: 1.4;
        color-scheme: light dark;
      }

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      .pinpoint-container {
        --bg: #ffffff;
        --header-bg: #f8fafc;
        --hover-bg: #f1f5f9;
        --active-bg: #e2e8f0;
        --text: #0f172a;
        --text-muted: #64748b;
        --border: rgba(0, 0, 0, 0.12);
        --shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        --accent: #2563eb;
        --accent-hover: #1d4ed8;
        --badge-bg: #e0e7ff;
        --badge-text: #3730a3;
        --danger: #ef4444;
        --danger-hover: #dc2626;
        --toast-bg: rgba(15, 23, 42, 0.95);
        --toast-text: #ffffff;
      }

      .pinpoint-container.dark {
        --bg: #1e1e24;
        --header-bg: #16161b;
        --hover-bg: #2a2a34;
        --active-bg: #353542;
        --text: #f1f5f9;
        --text-muted: #94a3b8;
        --border: rgba(255, 255, 255, 0.12);
        --shadow: 0 12px 28px -4px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.35);
        --accent: #3b82f6;
        --accent-hover: #60a5fa;
        --badge-bg: #1e3a8a;
        --badge-text: #bfdbfe;
        --danger: #f87171;
        --danger-hover: #ef4444;
        --toast-bg: rgba(30, 30, 38, 0.96);
        --toast-text: #f8fafc;
      }

      /* Floating Panel Window */
      .panel-window {
        position: fixed;
        width: 290px;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: var(--shadow);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        user-select: none;
        transition: box-shadow 0.2s ease, opacity 0.2s ease;
      }

      /* Draggable Header */
      .panel-header {
        background: var(--header-bg);
        border-bottom: 1px solid var(--border);
        padding: 9px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: grab;
      }

      .panel-header.dragging {
        cursor: grabbing;
      }

      .header-title-group {
        display: flex;
        align-items: center;
        gap: 7px;
      }

      .header-icon {
        width: 15px;
        height: 15px;
        fill: var(--accent);
        flex-shrink: 0;
      }

      .header-title {
        font-weight: 600;
        font-size: 13px;
        color: var(--text);
        letter-spacing: -0.01em;
      }

      .header-badge {
        font-size: 11px;
        font-weight: 600;
        background: var(--badge-bg);
        color: var(--badge-text);
        padding: 1px 6px;
        border-radius: 10px;
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .icon-button {
        background: transparent;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-muted);
        transition: background 0.15s ease, color 0.15s ease;
      }

      .icon-button:hover {
        background: var(--hover-bg);
        color: var(--text);
      }

      .icon-button svg {
        width: 14px;
        height: 14px;
        stroke: currentColor;
        stroke-width: 2;
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      /* Bookmark List Body */
      .panel-body {
        max-height: 320px;
        overflow-y: auto;
        padding: 6px;
      }

      .panel-body::-webkit-scrollbar {
        width: 5px;
      }
      .panel-body::-webkit-scrollbar-thumb {
        background: var(--border);
        border-radius: 4px;
      }

      /* Empty State */
      .empty-state {
        padding: 24px 16px;
        text-align: center;
        color: var(--text-muted);
      }

      .empty-icon {
        width: 28px;
        height: 28px;
        margin: 0 auto 8px auto;
        stroke: var(--text-muted);
        opacity: 0.7;
      }

      .empty-title {
        font-weight: 600;
        font-size: 12.5px;
        margin-bottom: 4px;
        color: var(--text);
      }

      .empty-desc {
        font-size: 11.5px;
        line-height: 1.4;
      }

      /* Bookmark Items */
      .bookmark-list {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .bookmark-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 7px 8px;
        border-radius: 7px;
        background: transparent;
        cursor: pointer;
        transition: background 0.12s ease;
      }

      .bookmark-item:hover {
        background: var(--hover-bg);
      }

      .bookmark-item:active {
        background: var(--active-bg);
      }

      .item-order {
        font-size: 11px;
        font-weight: 700;
        color: var(--accent);
        background: var(--badge-bg);
        padding: 1px 5px;
        border-radius: 4px;
        flex-shrink: 0;
        min-width: 20px;
        text-align: center;
      }

      .item-label {
        flex: 1;
        font-size: 12px;
        color: var(--text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .item-delete {
        opacity: 0.4;
        transition: opacity 0.15s ease, color 0.15s ease;
        padding: 3px;
        border-radius: 4px;
        background: transparent;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-muted);
      }

      .bookmark-item:hover .item-delete {
        opacity: 0.9;
      }

      .item-delete:hover {
        opacity: 1 !important;
        color: var(--danger) !important;
        background: rgba(239, 68, 68, 0.12);
      }

      .item-delete svg {
        width: 13px;
        height: 13px;
        stroke: currentColor;
        stroke-width: 2.2;
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      /* Collapsed Badge Pill */
      .collapsed-pill {
        position: fixed;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 7px 12px;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 20px;
        box-shadow: var(--shadow);
        cursor: grab;
        user-select: none;
        transition: transform 0.12s ease, box-shadow 0.15s ease;
      }

      .collapsed-pill:hover {
        transform: translateY(-1px);
      }

      .collapsed-pill.dragging {
        cursor: grabbing;
      }

      .pill-icon {
        width: 14px;
        height: 14px;
        fill: var(--accent);
      }

      .pill-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--text);
      }

      .pill-badge {
        font-size: 10.5px;
        font-weight: 700;
        background: var(--accent);
        color: #ffffff;
        padding: 1px 5px;
        border-radius: 10px;
      }

      /* Notification Toast */
      .pinpoint-toast {
        position: absolute;
        bottom: 8px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--toast-bg);
        color: var(--toast-text);
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 11.5px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        pointer-events: none;
        white-space: nowrap;
        opacity: 0;
        transition: opacity 0.2s ease, transform 0.2s ease;
        z-index: 10;
      }

      .pinpoint-toast.show {
        opacity: 1;
        transform: translateX(-50%) translateY(-2px);
      }
    `;
  }

  // UI Dimensions constants
  const PILL_WIDTH = 135;
  const PILL_HEIGHT = 36;
  const WINDOW_WIDTH = 290;
  const WINDOW_HEIGHT = 320;

  // Track position of the collapsed pill (persists where the user puts it)
  let pillPos = {
    left: Math.max(8, window.innerWidth - PILL_WIDTH - 20),
    top: 75
  };

  // Track position of the expanded panel window
  let windowPos = {
    left: Math.max(8, window.innerWidth - WINDOW_WIDTH - 20),
    top: 75
  };

  function openPanel() {
    isCollapsed = false;

    // Anchor the expanded window relative to the pill's current position
    const pillCenter = pillPos.left + (PILL_WIDTH / 2);
    if (pillCenter > window.innerWidth / 2) {
      // Pill is on right side: align window's right edge to pill's right edge
      const pillRight = pillPos.left + PILL_WIDTH;
      const desiredLeft = pillRight - WINDOW_WIDTH;
      windowPos.left = Math.max(8, Math.min(window.innerWidth - WINDOW_WIDTH - 8, desiredLeft));
    } else {
      // Pill is on left side: align window's left edge to pill's left edge
      windowPos.left = Math.max(8, Math.min(window.innerWidth - WINDOW_WIDTH - 8, pillPos.left));
    }

    // Vertically align with pill's top, ensuring window stays within screen bounds
    windowPos.top = Math.max(8, Math.min(window.innerHeight - WINDOW_HEIGHT - 8, pillPos.top));

    render();
  }

  function collapsePanel() {
    isCollapsed = true;
    // Pill position is preserved exactly where user placed it, clamped to viewport
    pillPos.left = Math.max(8, Math.min(window.innerWidth - PILL_WIDTH - 8, pillPos.left));
    pillPos.top = Math.max(8, Math.min(window.innerHeight - PILL_HEIGHT - 8, pillPos.top));

    render();
  }

  function initUI() {
    if (document.getElementById('pinpoint-bookmark-root')) return;

    hostEl = document.createElement('div');
    hostEl.id = 'pinpoint-bookmark-root';
    (document.body || document.documentElement).appendChild(hostEl);

    shadowRoot = hostEl.attachShadow({ mode: 'open' });
    render();
  }

  function showToast(message) {
    if (!shadowRoot) return;
    const toast = shadowRoot.querySelector('.pinpoint-toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('show');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2400);
  }

  function highlightSpot(el) {
    if (!el || !el.isConnected) return;
    const origOutline = el.style.outline;
    const origBoxShadow = el.style.boxShadow;
    const origTransition = el.style.transition;

    el.style.transition = 'outline 0.2s ease, box-shadow 0.2s ease';
    el.style.outline = '2px solid #3b82f6';
    el.style.boxShadow = '0 0 14px rgba(59, 130, 246, 0.45)';

    setTimeout(() => {
      el.style.outline = origOutline;
      el.style.boxShadow = origBoxShadow;
      setTimeout(() => {
        el.style.transition = origTransition;
      }, 250);
    }, 1500);
  }

  /* ==========================================================================
     6. Bookmark Scroll Jump Logic (Section 6.2)
     ========================================================================== */
  function jumpToBookmark(bm) {
    let targetNode = null;

    // Preference 1: Target element is still in DOM
    if (bm.targetEl && bm.targetEl.isConnected) {
      targetNode = bm.targetEl;
    }
    // Preference 2: Reply container is still connected
    else if (bm.replyEl && bm.replyEl.isConnected) {
      targetNode = bm.replyEl;
    }

    if (targetNode) {
      // 1. Native smooth scroll directly to the element centered in viewport
      try {
        targetNode.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      } catch (e) {
        targetNode.scrollIntoView(true);
      }

      // 2. Visual highlight pulse so the user's eyes immediately lock onto it
      highlightSpot(targetNode);
      return;
    }

    // Preference 3: Fallback raw scrollTop if message element was detached/virtualized
    const scrollContainer = resolveScrollContainer();
    if (scrollContainer && typeof bm.fallbackScrollTop === 'number') {
      scrollContainer.scrollTo({
        top: bm.fallbackScrollTop,
        behavior: 'smooth'
      });
      showToast("Restored approximate position (message was reloaded).");
      return;
    }

    showToast("Bookmark spot could not be found.");
  }

  /* ==========================================================================
     7. Render Panel & Interaction Setup
     ========================================================================== */
  function render() {
    if (!shadowRoot) return;

    const darkClass = isDarkTheme() ? 'dark' : '';
    const bookmarks = store.list();
    const count = bookmarks.length;

    // Ensure positions are clamped within current viewport
    pillPos.left = Math.max(8, Math.min(window.innerWidth - PILL_WIDTH - 8, pillPos.left));
    pillPos.top = Math.max(8, Math.min(window.innerHeight - PILL_HEIGHT - 8, pillPos.top));
    windowPos.left = Math.max(8, Math.min(window.innerWidth - WINDOW_WIDTH - 8, windowPos.left));
    windowPos.top = Math.max(8, Math.min(window.innerHeight - WINDOW_HEIGHT - 8, windowPos.top));

    let bodyContent = '';
    if (bookmarks.length === 0) {
      bodyContent = `
        <div class="empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
          </svg>
          <div class="empty-title">No bookmarks yet</div>
          <div class="empty-desc">Right-click anywhere inside a reply and select <strong>"Bookmark this spot"</strong>.</div>
        </div>
      `;
    } else {
      const itemsHtml = bookmarks.map(bm => `
        <div class="bookmark-item" data-id="${bm.id}">
          <span class="item-order">#${bm.order}</span>
          <span class="item-label" title="${escapeHtml(bm.label)}">${escapeHtml(bm.label)}</span>
          <button class="item-delete" data-delete-id="${bm.id}" title="Delete bookmark">
            <svg viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      `).join('');

      bodyContent = `<div class="bookmark-list">${itemsHtml}</div>`;
    }

    shadowRoot.innerHTML = `
      <style>${getPanelStyles()}</style>
      <div class="pinpoint-container ${darkClass}">
        ${isCollapsed ? `
          <div class="collapsed-pill" style="left: ${pillPos.left}px; top: ${pillPos.top}px;">
            <svg class="pill-icon" viewBox="0 0 24 24">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
            </svg>
            <span class="pill-label">Bookmarks</span>
            ${count > 0 ? `<span class="pill-badge">${count}</span>` : ''}
          </div>
        ` : `
          <div class="panel-window" style="left: ${windowPos.left}px; top: ${windowPos.top}px;">
            <div class="panel-header">
              <div class="header-title-group">
                <svg class="header-icon" viewBox="0 0 24 24">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                </svg>
                <span class="header-title">Pinpoint</span>
                ${count > 0 ? `<span class="header-badge">${count}</span>` : ''}
              </div>
              <div class="header-actions">
                <button class="icon-button btn-collapse" title="Collapse panel">
                  <svg viewBox="0 0 24 24">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>
              </div>
            </div>
            <div class="panel-body">
              ${bodyContent}
            </div>
            <div class="pinpoint-toast"></div>
          </div>
        `}
      </div>
    `;

    setupEvents();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;');
  }

  function setupEvents() {
    if (!shadowRoot) return;

    if (isCollapsed) {
      const pill = shadowRoot.querySelector('.collapsed-pill');
      if (pill) {
        setupDraggable(pill, pill, true, () => {
          openPanel();
        });
      }
      return;
    }

    const panelWindow = shadowRoot.querySelector('.panel-window');
    const panelHeader = shadowRoot.querySelector('.panel-header');
    const collapseBtn = shadowRoot.querySelector('.btn-collapse');

    if (collapseBtn) {
      collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        collapsePanel();
      });
    }

    if (panelHeader && panelWindow) {
      setupDraggable(panelHeader, panelWindow, false);
    }

    // Bookmark list item click and delete handling
    const listContainer = shadowRoot.querySelector('.bookmark-list');
    if (listContainer) {
      listContainer.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('[data-delete-id]');
        if (deleteBtn) {
          e.stopPropagation();
          const id = deleteBtn.getAttribute('data-delete-id');
          store.remove(id);
          render();
          showToast("Bookmark removed");
          return;
        }

        const item = e.target.closest('.bookmark-item');
        if (item) {
          const id = item.getAttribute('data-id');
          const bm = store.list().find(b => b.id === id);
          if (bm) {
            jumpToBookmark(bm);
          }
        }
      });
    }
  }

  function setupDraggable(handleEl, targetContainerEl, isPill = false, onClickIfNoDrag = null) {
    let isDragging = false;
    let hasMoved = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const onMouseDown = (e) => {
      if (e.button !== 0) return; // Only primary mouse button
      if (e.target.closest('button')) return; // Ignore button clicks

      isDragging = true;
      hasMoved = false;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = isPill ? pillPos.left : windowPos.left;
      startTop = isPill ? pillPos.top : windowPos.top;

      handleEl.classList.add('dragging');
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!hasMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        hasMoved = true;
      }

      if (hasMoved) {
        const width = isPill ? (targetContainerEl.offsetWidth || PILL_WIDTH) : (targetContainerEl.offsetWidth || WINDOW_WIDTH);
        const height = isPill ? (targetContainerEl.offsetHeight || PILL_HEIGHT) : (targetContainerEl.offsetHeight || WINDOW_HEIGHT);

        const maxLeft = window.innerWidth - width - 8;
        const maxTop = window.innerHeight - height - 8;

        const currentLeft = Math.max(8, Math.min(maxLeft, startLeft + dx));
        const currentTop = Math.max(8, Math.min(maxTop, startTop + dy));

        if (isPill) {
          pillPos.left = currentLeft;
          pillPos.top = currentTop;
        } else {
          windowPos.left = currentLeft;
          windowPos.top = currentTop;
        }

        targetContainerEl.style.left = `${currentLeft}px`;
        targetContainerEl.style.top = `${currentTop}px`;
      }
    };

    const onMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        handleEl.classList.remove('dragging');
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);

        if (hasMoved) {
          if (!isPill) {
            // If user dragged the full window, sync pill position to window corner
            const windowCenter = windowPos.left + (WINDOW_WIDTH / 2);
            if (windowCenter > window.innerWidth / 2) {
              pillPos.left = Math.max(8, windowPos.left + WINDOW_WIDTH - PILL_WIDTH);
            } else {
              pillPos.left = windowPos.left;
            }
            pillPos.top = windowPos.top;
          }
        } else if (typeof onClickIfNoDrag === 'function') {
          onClickIfNoDrag();
        }
      }
    };

    handleEl.addEventListener('mousedown', onMouseDown);
  }

  /* ==========================================================================
     8. Bookmark Creation Action (Message from background.js)
     ========================================================================== */
  function handleCreateBookmark() {
    initUI();

    if (!lastRightClickInfo || (Date.now() - lastRightClickInfo.timestamp > 30000)) {
      showToast("Please right-click on the spot in a reply first.");
      return;
    }

    const clickedTarget = lastRightClickInfo.target;
    const clientY = lastRightClickInfo.clientY;

    const adapter = getCurrentAdapter();
    const replyEl = adapter.findReply(clickedTarget);

    if (!replyEl) {
      showToast("Click must be inside an AI reply.");
      return;
    }

    const scrollContainer = resolveScrollContainer(replyEl);
    const replyRect = replyEl.getBoundingClientRect();
    const offsetFromReplyTop = clientY - replyRect.top;
    const label = extractLabel(clickedTarget);
    const fallbackScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

    const newBookmark = {
      id: "bm_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      order: store.list().length + 1,
      label: label,
      replyEl: replyEl,
      targetEl: clickedTarget,
      offsetFromReplyTop: offsetFromReplyTop,
      fallbackScrollTop: fallbackScrollTop,
      createdAt: Date.now()
    };

    store.add(newBookmark);

    // If panel is collapsed, uncollapse to show newly created bookmark
    if (isCollapsed) {
      openPanel();
    } else {
      render();
    }
    showToast(`Bookmarked #${newBookmark.order}: "${label}"`);
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "create-bookmark") {
      handleCreateBookmark();
      sendResponse({ ok: true });
    }
  });

  /* ==========================================================================
     9. SPA Chat Switching Observer (Section 8 decision: Clear on URL change)
     ========================================================================== */
  let currentUrl = window.location.href;

  function onUrlChange() {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      // Clear bookmarks when navigating to another chat
      store.clear();
      render();
    }
  }

  const origPushState = history.pushState;
  history.pushState = function(...args) {
    origPushState.apply(this, args);
    onUrlChange();
  };

  const origReplaceState = history.replaceState;
  history.replaceState = function(...args) {
    origReplaceState.apply(this, args);
    onUrlChange();
  };

  window.addEventListener('popstate', onUrlChange);
  setInterval(onUrlChange, 1000);

  /* ==========================================================================
     10. Window Resize & Theme Mutation Observer
     ========================================================================== */
  window.addEventListener('resize', () => {
    if (shadowRoot) {
      render();
    }
  });

  const themeObserver = new MutationObserver(() => {
    if (shadowRoot) {
      const container = shadowRoot.querySelector('.pinpoint-container');
      if (container) {
        if (isDarkTheme()) {
          container.classList.add('dark');
        } else {
          container.classList.remove('dark');
        }
      }
    }
  });

  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
  if (document.body) {
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme'] });
  }

  // Initial UI instantiation
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }
})();
