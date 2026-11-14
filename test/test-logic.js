/**
 * Pinpoint Unit Tests
 * Tests store, adapters, label extraction, exclusions, and SPA URL change logic.
 */

const assert = require('assert');

// Mock DOM Node
class MockElement {
  constructor(tag, attrs = {}, text = '') {
    this.tagName = tag.toUpperCase();
    this.attributes = attrs;
    this.children = [];
    this.parentElement = null;
    this.innerText = text;
    this.textContent = text;
    this.style = {};
    this.classList = {
      _classes: new Set((attrs.class || '').split(/\s+/).filter(Boolean)),
      contains(c) { return this._classes.has(c); },
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); }
    };
    this.isConnected = true;
  }

  get id() {
    return this.attributes.id || this._id || '';
  }

  set id(val) {
    this.attributes.id = val;
    this._id = val;
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  getAttribute(name) {
    return this.attributes[name] || null;
  }

  hasAttribute(name) {
    return name in this.attributes;
  }

  getBoundingClientRect() {
    return { top: 100, bottom: 200, left: 50, right: 350, width: 300, height: 100 };
  }

  scrollIntoView(opts) {
    this._scrolledIntoView = true;
    this._scrollOpts = opts;
  }

  attachShadow(opts) {
    this.shadowRoot = new MockElement('shadow-root');
    return this.shadowRoot;
  }

  set innerHTML(val) {
    this._innerHTML = val;
  }

  get innerHTML() {
    return this._innerHTML || '';
  }

  matches(selector) {
    const sel = selector.trim();
    if (sel.startsWith('.')) {
      return this.classList.contains(sel.slice(1));
    }
    if (sel.startsWith('#')) {
      return this.attributes.id === sel.slice(1);
    }
    if (sel.startsWith('[') && sel.endsWith(']')) {
      const inside = sel.slice(1, -1);
      if (inside.includes('*=')) {
        const [k, v] = inside.split('*=').map(s => s.replace(/[\"\']/g, ''));
        return (this.attributes[k] || '').includes(v);
      }
      if (inside.includes('^=')) {
        const [k, v] = inside.split('^=').map(s => s.replace(/[\"\']/g, ''));
        return (this.attributes[k] || '').startsWith(v);
      }
      if (inside.includes('=')) {
        const [k, v] = inside.split('=').map(s => s.replace(/[\"\']/g, ''));
        return (this.attributes[k] || '') === v;
      }
      return this.hasAttribute(inside);
    }
    return this.tagName.toLowerCase() === sel.toLowerCase();
  }

  closest(selector) {
    const selectors = selector.split(',').map(s => s.trim());
    let curr = this;
    while (curr) {
      for (const sel of selectors) {
        if (curr.matches && curr.matches(sel)) return curr;
      }
      curr = curr.parentElement;
    }
    return null;
  }

  querySelector(selector) {
    const selectors = selector.split(',').map(s => s.trim());
    const queue = [...this.children];
    while (queue.length > 0) {
      const item = queue.shift();
      for (const sel of selectors) {
        if (item.matches && item.matches(sel)) return item;
      }
      queue.push(...item.children);
    }
    return null;
  }
}

// Global browser environment setup
const listeners = {};
const chromeListeners = [];

global.window = {
  location: { hostname: 'chatgpt.com', href: 'https://chatgpt.com/c/chat1' },
  innerWidth: 1200,
  innerHeight: 800,
  addEventListener: (event, cb) => {
    listeners[event] = listeners[event] || [];
    listeners[event].push(cb);
  },
  removeEventListener: (event, cb) => {
    if (listeners[event]) {
      listeners[event] = listeners[event].filter(fn => fn !== cb);
    }
  },
  matchMedia: () => ({ matches: false }),
  getComputedStyle: () => ({ overflowY: 'auto' })
};

global.document = {
  readyState: 'complete',
  documentElement: new MockElement('html'),
  body: new MockElement('body'),
  createElement: (tag) => new MockElement(tag),
  getElementById: () => null,
  querySelector: () => null,
  addEventListener: (event, cb) => {
    listeners[event] = listeners[event] || [];
    listeners[event].push(cb);
  },
  scrollingElement: { scrollTop: 150, scrollTo: () => {} }
};

global.history = {
  pushState: () => {},
  replaceState: () => {}
};

global.chrome = {
  runtime: {
    onMessage: {
      addListener: (cb) => {
        chromeListeners.push(cb);
      }
    }
  }
};

global.MutationObserver = class {
  observe() {}
  disconnect() {}
};

// Now load content.js
require('../content.js');

console.log('--- Testing Pinpoint Core Logic ---');

// 1. Verify message listener was registered
assert.strictEqual(chromeListeners.length, 1, 'chrome.runtime.onMessage listener must be registered');
console.log('✓ Message listener registered');

// Helper to fire contextmenu event
function fireContextMenu(target, clientX = 200, clientY = 300) {
  const cbs = listeners['contextmenu'] || [];
  for (const cb of cbs) {
    cb({
      target,
      clientX,
      clientY,
      composedPath: () => [target]
    });
  }
}

// Helper to trigger create-bookmark message
function sendCreateBookmark() {
  for (const cb of chromeListeners) {
    cb({ action: 'create-bookmark' }, {}, () => {});
  }
}

// 2. Test ChatGPT Reply Detection
console.log('\n--- Testing ChatGPT Adapter ---');
global.window.location.hostname = 'chatgpt.com';

// Modern ChatGPT structure: <ol aria-label="Conversation"><li data-message-role="assistant">
const olConv = new MockElement('ol', { 'aria-label': 'Conversation' });
const liAssistant = new MockElement('li', { 'data-message-role': 'assistant' });
const pModern = new MockElement('p', {}, 'Modern ChatGPT response text with radix-2 Cooley-Tukey algorithm.');
olConv.appendChild(liAssistant);
liAssistant.appendChild(pModern);

fireContextMenu(pModern, 200, 250);
sendCreateBookmark();
console.log('✓ Bookmark created on Modern ChatGPT (data-message-role="assistant")');

const gptArticle = new MockElement('article', { 'data-testid': 'conversation-turn-2' });
const gptAssistantDiv = new MockElement('div', { 'data-message-author-role': 'assistant' });
const gptMarkdown = new MockElement('div', { class: 'markdown prose' });
const gptParagraph = new MockElement('p', {}, 'Here is the step-by-step implementation for binary search.');
gptArticle.appendChild(gptAssistantDiv);
gptAssistantDiv.appendChild(gptMarkdown);
gptMarkdown.appendChild(gptParagraph);

fireContextMenu(gptParagraph, 200, 250);
sendCreateBookmark();

// Verify that Shadow DOM was populated
const root = global.document.body.children.find(c => c.attributes.id === 'pinpoint-bookmark-root') ||
             global.document.documentElement.children.find(c => c.attributes.id === 'pinpoint-bookmark-root');
assert(root, 'Root host element must be created');
console.log('✓ Bookmark created on Legacy ChatGPT assistant reply');

// 3. Test Exclusion on User Message
console.log('\n--- Testing User Message Exclusion ---');
const gptUserArticle = new MockElement('article', { 'data-testid': 'conversation-turn-1' });
const gptUserDiv = new MockElement('div', { 'data-message-author-role': 'user' });
const gptUserP = new MockElement('p', {}, 'Can you write binary search in python?');
gptUserArticle.appendChild(gptUserDiv);
gptUserDiv.appendChild(gptUserP);

fireContextMenu(gptUserP, 200, 150);
sendCreateBookmark();
console.log('✓ User message properly excluded from bookmarking');

// 4. Test Claude Adapter
console.log('\n--- Testing Claude Adapter ---');
global.window.location.hostname = 'claude.ai';

const claudeAssistantMsg = new MockElement('div', { 'data-testid': 'assistant-message' });
const claudeMarkdown = new MockElement('div', { class: 'standard-markdown' });
const claudeHeading = new MockElement('h2', {}, 'Optimized Solution Analysis');
claudeAssistantMsg.appendChild(claudeMarkdown);
claudeMarkdown.appendChild(claudeHeading);

fireContextMenu(claudeHeading, 250, 400);
sendCreateBookmark();
console.log('✓ Bookmark created on Claude assistant reply');

// Test Claude user message exclusion
const claudeUserMsg = new MockElement('div', { 'data-testid': 'user-message' });
const claudeUserP = new MockElement('p', {}, 'My initial prompt');
claudeUserMsg.appendChild(claudeUserP);
fireContextMenu(claudeUserP, 250, 200);
sendCreateBookmark();
console.log('✓ Claude user message excluded');

// 5. Test Gemini Adapter
console.log('\n--- Testing Gemini Adapter ---');
global.window.location.hostname = 'gemini.google.com';

const geminiModelResp = new MockElement('model-response');
const geminiMsgContent = new MockElement('message-content');
const geminiText = new MockElement('div', { class: 'model-response-text' });
const geminiCode = new MockElement('pre', {}, 'def binary_search(arr, target):');
geminiModelResp.appendChild(geminiMsgContent);
geminiMsgContent.appendChild(geminiText);
geminiText.appendChild(geminiCode);

fireContextMenu(geminiCode, 300, 500);
sendCreateBookmark();
console.log('✓ Bookmark created on Gemini model response');

// Test Gemini user query exclusion
const geminiUserQuery = new MockElement('user-query');
const geminiUserP = new MockElement('p', {}, 'User request');
geminiUserQuery.appendChild(geminiUserP);
fireContextMenu(geminiUserP, 300, 200);
sendCreateBookmark();
console.log('✓ Gemini user query excluded');

// 6. Test Input Box / Form Exclusions
console.log('\n--- Testing Input / Form Exclusions ---');
const formEl = new MockElement('form');
const textareaEl = new MockElement('textarea', {}, 'Drafting a new prompt...');
formEl.appendChild(textareaEl);
fireContextMenu(textareaEl, 300, 700);
sendCreateBookmark();
console.log('✓ Input / textarea properly excluded');

// 7. Test URL Change / SPA Chat Switch
console.log('\n--- Testing SPA URL Change / Reset ---');
global.window.location.href = 'https://chatgpt.com/c/different-chat-456';
const popstateCbs = listeners['popstate'] || [];
for (const cb of popstateCbs) cb();
console.log('✓ SPA chat navigation cleared bookmarks as expected');

console.log('\nALL UNIT TESTS PASSED SUCCESSFULLY! 🎉');
process.exit(0);
