'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = readFileSync(path.resolve(__dirname, '../../app/web/author/author.js'), 'utf8');
function between(start, end) {
  const from = source.indexOf(start);
  const until = source.indexOf(end, from + start.length);
  assert.ok(from !== -1 && until !== -1, `missing ${start}`);
  return source.slice(from, until);
}

class MockClassList {
  constructor(owner) { this.owner = owner; }
  tokens() { return new Set(this.owner.className.split(/\s+/).filter(Boolean)); }
  contains(token) { return this.tokens().has(token); }
  add(token) { this.owner.className = [...this.tokens(), token].join(' '); }
  remove(token) { this.owner.className = [...this.tokens()].filter(value => value !== token).join(' '); }
  toggle(token, active) { if (active) this.add(token); else this.remove(token); }
}
class MockElement {
  constructor(tag='div') {
    this.tagName = tag.toUpperCase(); this.children = []; this.listeners = {};
    this.className = ''; this.classList = new MockClassList(this); this.attrs = {};
    this.dataset = {}; this.disabled = false; this.hidden = false; this.textContent = '';
  }
  append(...children) { children.forEach(child => { child.parentNode = this; this.children.push(child); }); }
  appendChild(child) { this.append(child); return child; }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  addEventListener(event, callback) { (this.listeners[event] ??= []).push(callback); }
  dispatchEvent(event) { for (const callback of this.listeners[event.type] ?? []) callback(event); return true; }
  setAttribute(name, value) { this.attrs[name] = value; }
  getAttribute(name) { return this.attrs[name]; }
  insertAdjacentElement(position, element) {
    assert.equal(position, 'afterend'); this.shell = element;
    if (this.parentNode) {
      const children = this.parentNode.children;
      children.splice(children.indexOf(this)+1, 0, element);
      element.parentNode = this.parentNode;
    }
  }
  focus() { this.focused = true; }
  click() { this.dispatchEvent({type:'click'}); }
  contains(other) { return this === other || this.children.some(child => child.contains(other)); }
  querySelectorAll(selector) {
    const matching = node => selector === 'select' ? node.tagName === 'SELECT' :
      selector === '.author-terminal-select.is-open' ? node.classList.contains('author-terminal-select') && node.classList.contains('is-open') : false;
    const results = [];
    const walk = node => node.children.forEach(child => { if (matching(child)) results.push(child); walk(child); });
    walk(this); return results;
  }
}
class MockSelect extends MockElement {
  constructor(options) { super('select'); this.options = options.map(([value, text]) => ({value, textContent:text, disabled:false})); this.value = options[0]?.[0] ?? ''; }
  get selectedIndex() { return this.options.findIndex(option => option.value === this.value); }
}
function setup() {
  const document = new MockElement('document');
  document.createElement = tag => new MockElement(tag);
  const observed = [];
  class MutationObserver {
    constructor(callback) { this.callback = callback; }
    observe(node) { observed.push({node, observer:this}); }
  }
  class MockEvent { constructor(type) { this.type=type; } }
  const context = {document, MutationObserver, HTMLSelectElement:MockSelect, Event:MockEvent};
  vm.createContext(context);
  vm.runInContext(between('const terminalSelectBindings = new WeakMap();', '/* =========================================================\n   BOOT'), context);
  return {context, document, observed};
}

test('selected draft value remains visible when changed programmatically without a change event', () => {
  const {context, document} = setup();
  const select = new MockSelect([['journey','Journey'],['mystery','Mystery'],['survival','Survival']]);
  document.append(select);
  context.installTerminalSelects();
  const trigger = select.shell.children[0];
  assert.equal(trigger.textContent, 'Journey');
  select.value = 'survival'; // Draft load and autosave do not fire change.
  context.syncTerminalSelects();
  assert.equal(trigger.textContent, 'Survival');
  trigger.click();
  assert.equal(select.shell.children[1].children[2].getAttribute('aria-selected'), 'true');
  assert.equal(trigger.textContent, 'Survival');
  select.value = 'mystery';
  context.syncTerminalSelects();
  assert.equal(trigger.textContent, 'Mystery');
  assert.equal(select.shell.children[1].children[1].getAttribute('aria-selected'), 'true');
});

test('dynamically created select, asynchronously replaced options, disabled state, and repeated installation stay synchronized', () => {
  const {context, document, observed} = setup();
  const form = new MockElement('div'); document.append(form);
  const select = new MockSelect([['short','Short'],['long','Long']]); form.append(select);
  context.installTerminalSelects(form);
  context.installTerminalSelects(form);
  assert.equal(select.shell.children[0].textContent,'Short');
  assert.equal(observed.length,1, 'reinstall must not create duplicate observers');
  assert.equal((document.listeners.pointerdown || []).length,1, 'document outside-click listener installed once');
  select.value = 'long'; select.disabled=true;
  context.installTerminalSelects(form);
  assert.equal(select.shell.children[0].textContent, 'Long');
  assert.equal(select.shell.children[0].disabled, true);
  select.options = [{value:'new',textContent:'NEW WORLD', disabled:false}]; select.value='new';
  observed[0].observer.callback(); // Options MutationObserver on async provider updates.
  assert.equal(select.shell.children[0].textContent, 'NEW WORLD');
  select.disabled=false;
  context.syncTerminalSelects(select);
  assert.equal(select.shell.children[0].disabled,false);
  const repeat = new MockSelect([['major','MAJOR'],['minor','MINOR']]); form.append(repeat);
  context.installTerminalSelects(form);
  assert.equal(repeat.shell.children[0].textContent,'MAJOR');
  assert.equal(observed.length,2);
});

test('draft hydration refreshes native select and its visible custom button', () => {
  const {context, document} = setup();
  const select = new MockSelect([['short','Short'],['medium','Medium'],['long','Long']]);
  select.dataset.path='identity.length'; document.append(select);
  context.installTerminalSelects();
  context.ui = {form:{querySelectorAll: () => [select]}};
  context.activeSource={identity:{length:'long'}};
  context.controlMatchesActiveDocument=()=>true;
  context.getPath=(source,path)=>path.split('.').reduce((v,key)=>v?.[key],source);
  vm.runInContext(between('function renderSimpleFields() {', 'function updateStrengthUI() {'), context);
  context.renderSimpleFields();
  assert.equal(select.value,'long');
  assert.equal(select.shell.children[0].textContent,'Long');
  context.activeSource.identity.length='medium';
  context.renderSimpleFields();
  assert.equal(select.shell.children[0].textContent,'Medium');
});

test('autosave reconciliation, editor renders, quality profile updates and create dialogs all resync custom selects', () => {
  assert.match(between('async function saveDraft(', '/* =========================================================\n   LIBRARY'), /activeSource = structuredClone\(saved\.source\);\s*syncTerminalSelects\(\);/);
  assert.match(between('function renderEditor() {', '/* =========================================================\n   DIRTY + AUTOSAVE'), /installTerminalSelects\(\);/);
  assert.match(between('function renderRepeatSection(', '/* =========================================================\n   FORM'), /installTerminalSelects\(container\);/);
  assert.match(between('async function refreshGenerationProviderStatus()', '/* ========================================================='), /syncTerminalSelects\(ui\.generationPanel\);/);
  assert.match(between('function updateCreateDialogKind()', 'function openNewSource('), /syncTerminalSelects\(ui\.newDialog\);/);
});
