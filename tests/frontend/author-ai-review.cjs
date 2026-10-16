'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = readFileSync(path.resolve(__dirname, '../../app/web/author/author.js'), 'utf8');

const between = (start, end) => {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `expected helper boundaries ${start}`);
  return source.slice(a, b);
};

test('AI generation only stages a proposal and never auto-saves it', async () => {
  const old = {identity: {title: 'Boats'}, starting_situation: 'Boat accident on a beach'};
  const proposed = {identity: {title: 'Boats'}, starting_situation: 'Boat wreck on the beach'};
  let applied = 0;
  let staged = null;
  const box = {
    authorAiTarget: {kind: 'field', fieldPath: 'starting_situation', label: 'Starting Situation'},
    authorAssistInFlight: false,
    authorAiPending: null,
    activeVersion: null,
    ui: {
      authorAiPrompt: {value: 'Boat accident and beach', focus() {}},
      authorAiSubmit: {disabled: false, textContent: 'GENERATE PROPOSAL'},
      authorAiDialog: {close() { throw Error('dialog closed before approval'); }},
    },
    stableSourceForAiAssist: async () => ({source: old, revisionAtStart: 4}),
    api: async () => ({source: proposed, changed_paths: ['starting_situation']}),
    clearAuthorAiProposal: () => { box.authorAiPending = null; },
    renderAuthorAiProposal: (_, result) => { staged = result; },
    applyAiAssistResult: () => { applied++; },
    renderAuthorAssistState: () => {},
    refreshAiHelperButtons: () => {},
    showToast: () => {},
    setTimeout: () => {},
  };
  vm.createContext(box);
  vm.runInContext(between('async function submitAuthorAiHelper() {', 'function createAiPill('), box);
  await box.submitAuthorAiHelper();
  assert.equal(applied, 0, 'API response may not apply draft automatically');
  assert.equal(staged.source, proposed);
  assert.equal(box.authorAiPending.revisionAtStart, 4);
  assert.equal(box.ui.authorAiSubmit.textContent, 'REGENERATE PROPOSAL');
  assert.equal(old.starting_situation, 'Boat accident on a beach');
});

test('only explicit APPLY accepts reviewed draft, discard does not', () => {
  let applies = 0;
  let closed = 0;
  const box = {
    authorAiPending: {
      result: {source: {starting_situation: 'A boat accident on a beach'}, changed_paths:['starting_situation']},
      revisionAtStart: 12,
      successMessage: 'UPDATED',
    },
    authorAssistInFlight: false,
    authorAiTarget: {kind: 'document'},
    ui: {
      authorAiDialog: {close: () => closed++},
      authorAiPreview: {hidden: false},
      authorAiApply: {hidden: false},
      authorAiPreviewChanges: {replaceChildren: () => {}},
    },
    applyAiAssistResult: () => {applies++;},
    renderAuthorAssistState: () => {},
    showToast: () => {},
  };
  vm.createContext(box);
  vm.runInContext(between('function clearAuthorAiProposal() {', 'function aiHelperAvailable() {'), box);
  box.clearAuthorAiProposal(); // user clicked discard
  box.applyReviewedAuthorAiProposal();
  assert.equal(applies, 0);
  assert.equal(closed, 0);
  box.authorAiPending = {result: {source: {}, changed_paths:['premise']}, revisionAtStart: 12, successMessage: 'UPDATED'};
  box.applyReviewedAuthorAiProposal();
  assert.equal(applies, 1);
  assert.equal(closed, 1);
});

test('review displays before and proposed values without injecting HTML or editing source', () => {
  const node = () => ({
    children: [],
    textContent: '',
    appendChild(child) {this.children.push(child);},
    replaceChildren(...children) {this.children = children;},
  });
  const original = {identity: {title: 'Survivors'}, starting_situation: 'Boat accident on a beach.'};
  const proposed = {identity: {title: 'Survivors'}, starting_situation: 'Boat accident leaves survivors stranded on a beach.'};
  let status;
  const box = {
    authorAiPending: null,
    ui: {
      authorAiPreview: {hidden: true},
      authorAiApply: {hidden: true},
      authorAiPreviewChanges: node(),
    },
    document: {createElement: () => node(), createDocumentFragment: () => node()},
    getPath: (source, path) => path.split('.').reduce((v, k) => v?.[k], source),
    renderAuthorAssistState: value => {status = value;},
  };
  vm.createContext(box);
  vm.runInContext(between('function clearAuthorAiProposal() {', 'function aiHelperAvailable() {'), box);
  box.renderAuthorAiProposal(original, {source: proposed, changed_paths: ['starting_situation']});
  assert.equal(original.starting_situation, 'Boat accident on a beach.');
  assert.equal(box.ui.authorAiPreview.hidden, false);
  assert.equal(box.ui.authorAiApply.hidden, false);
  assert.equal(status, 'REVIEW REQUIRED');
  const texts = [];
  const walk = element => {texts.push(element.textContent); element.children.forEach(walk);};
  walk(box.ui.authorAiPreviewChanges);
  assert.ok(texts.includes('Boat accident on a beach.'));
  assert.ok(texts.includes('Boat accident leaves survivors stranded on a beach.'));
});
