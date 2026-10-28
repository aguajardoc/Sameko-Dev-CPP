'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('--- Starting CrudModalManager & Strategy Tests ---');

// Mock DOM elements and document/window
function createMockElement(tagName = 'div', id = '') {
    const classList = new Set();
    const children = [];
    const listeners = {};
    const dataset = {};
    let innerHTML = '';

    const element = {
        tagName: tagName.toUpperCase(),
        id,
        dataset,
        style: {},
        value: '',
        textContent: '',
        classList: {
            add: (cls) => classList.add(cls),
            remove: (cls) => classList.delete(cls),
            contains: (cls) => classList.has(cls),
            toggle: (cls, force) => {
                if (force === undefined) {
                    if (classList.has(cls)) classList.delete(cls);
                    else classList.add(cls);
                } else if (force) {
                    classList.add(cls);
                } else {
                    classList.delete(cls);
                }
            }
        },
        addEventListener: (event, handler) => {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(handler);
        },
        removeEventListener: (event, handler) => {
            if (listeners[event]) {
                listeners[event] = listeners[event].filter(h => h !== handler);
            }
        },
        dispatchEvent: (event) => {
            const handlers = listeners[event.type] || [];
            handlers.forEach(h => h(event));
        },
        click: () => {
            element.dispatchEvent({ type: 'click', target: element });
        },
        closest: (selector) => {
            if (selector.includes('data-action="edit"') && element.dataset.action === 'edit') return element;
            if (selector.includes('data-action="delete"') && element.dataset.action === 'delete') return element;
            if (selector.includes('.btn-edit') && element.classList.contains('btn-edit')) return element;
            if (selector.includes('.btn-delete') && element.classList.contains('btn-delete')) return element;
            if (selector.includes('[data-index]') && element.dataset.index !== undefined) return element;
            return null;
        },
        contains: (target) => true,
        querySelector: (selector) => {
            return null;
        },
        querySelectorAll: (selector) => {
            return [];
        }
    };

    Object.defineProperty(element, 'innerHTML', {
        get: () => innerHTML,
        set: (val) => {
            innerHTML = val;
        }
    });

    return element;
}

// 1. Test FormEditorStrategy, CrudModalManager, SnippetEditorStrategy, FilePathRuleEditorStrategy from crud-modal-manager.js
const {
    CrudModalManager,
    FormEditorStrategy,
    SnippetEditorStrategy,
    FilePathRuleEditorStrategy
} = require('../src/renderer/ui/crud-modal-manager.js');

// Test 1: FilePathRuleEditorStrategy validation and extraction
{
    console.log('Testing FilePathRuleEditorStrategy...');
    const strategy = new FilePathRuleEditorStrategy();

    // Mock DOM elements
    const regexInput = createMockElement('input', 'rule-regex-input');
    const pathInput = createMockElement('input', 'rule-filepath-input');

    global.document = {
        getElementById: (id) => {
            if (id === 'rule-regex-input') return regexInput;
            if (id === 'rule-filepath-input') return pathInput;
            return null;
        }
    };

    // Test reset
    regexInput.value = 'abc';
    pathInput.value = '/path';
    strategy.reset();
    assert.strictEqual(regexInput.value, '', 'reset() should clear regex input');
    assert.strictEqual(pathInput.value, '', 'reset() should clear filepath input');

    // Test populate
    strategy.populate({ regex: '^test.*', filePath: '/out/test.cpp' });
    assert.strictEqual(regexInput.value, '^test.*', 'populate() sets regex');
    assert.strictEqual(pathInput.value, '/out/test.cpp', 'populate() sets filepath');

    // Test validation: empty regex
    regexInput.value = '   ';
    pathInput.value = '/out/test.cpp';
    let res = strategy.validateAndExtract([], null);
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes('regex'), 'Should reject empty regex');

    // Test validation: empty filepath
    regexInput.value = '^test.*';
    pathInput.value = '   ';
    res = strategy.validateAndExtract([], null);
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes('filepath'), 'Should reject empty filepath');

    // Test validation: invalid regex
    regexInput.value = '[invalid(';
    pathInput.value = '/out/test.cpp';
    res = strategy.validateAndExtract([], null);
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes('Invalid regular expression'), 'Should catch invalid regex syntax');

    // Test validation: duplicate regex
    const existing = [{ regex: '^existing$', filePath: '/old.cpp' }];
    regexInput.value = '^existing$';
    pathInput.value = '/new.cpp';
    res = strategy.validateAndExtract(existing, null);
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes('already exists'), 'Should prevent duplicate regex on add');

    // Duplicate check allows self when editing
    res = strategy.validateAndExtract(existing, 0);
    assert.strictEqual(res.valid, true, 'Allows same regex when editing itself');
    assert.deepStrictEqual(res.data, { regex: '^existing$', filePath: '/new.cpp' });

    console.log('PASS: FilePathRuleEditorStrategy tests passed');
}

// Test 2: SnippetEditorStrategy lazy Monaco initialization and validation
{
    console.log('Testing SnippetEditorStrategy...');
    const triggerInput = createMockElement('input', 'snippet-trigger-input');
    const editorContainer = createMockElement('div', 'snippet-content-editor');

    let monacoCreateCalls = 0;
    let editorValue = '';
    const mockMonacoEditor = {
        getValue: () => editorValue,
        setValue: (v) => { editorValue = v; }
    };

    global.document = {
        getElementById: (id) => {
            if (id === 'snippet-trigger-input') return triggerInput;
            if (id === 'snippet-content-editor') return editorContainer;
            return null;
        }
    };
    global.monaco = {
        editor: {
            create: () => {
                monacoCreateCalls++;
                return mockMonacoEditor;
            }
        }
    };
    global.App = { settings: { appearance: { theme: 'kawaii-dark' } } };

    const strategy = new SnippetEditorStrategy();
    assert.strictEqual(monacoCreateCalls, 0, 'Monaco must NOT be initialized upon strategy creation');

    // Reset initializes lazily
    strategy.reset();
    assert.strictEqual(monacoCreateCalls, 1, 'Monaco initialized on reset()');
    assert.strictEqual(triggerInput.value, '');
    assert.strictEqual(editorValue, '');

    // Populate
    strategy.populate({ trigger: 'fori', content: 'for (int i = 0; i < n; i++)' });
    assert.strictEqual(triggerInput.value, 'fori');
    assert.strictEqual(editorValue, 'for (int i = 0; i < n; i++)');
    assert.strictEqual(monacoCreateCalls, 1, 'Monaco not re-created on populate');

    // Validation
    triggerInput.value = '';
    let res = strategy.validateAndExtract([], null);
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes('trigger'));

    triggerInput.value = 'fori';
    editorValue = '';
    res = strategy.validateAndExtract([], null);
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes('content'));

    // Duplicate check
    const existing = [{ trigger: 'fori', name: 'Custom', content: 'loop' }];
    triggerInput.value = 'fori';
    editorValue = 'new content';
    res = strategy.validateAndExtract(existing, null);
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes('already exists'));

    // Edit self allows duplicate trigger
    res = strategy.validateAndExtract(existing, 0);
    assert.strictEqual(res.valid, true);
    assert.deepStrictEqual(res.data, { trigger: 'fori', name: 'Custom', content: 'new content' });

    console.log('PASS: SnippetEditorStrategy tests passed');
}

// Test 3: Generic CrudModalManager lifecycle and event delegation
{
    console.log('Testing CrudModalManager lifecycle & state tracking...');

    const modal = createMockElement('div', 'test-modal');
    const title = createMockElement('h2', 'test-title');
    const closeBtn = createMockElement('button', 'btn-test-close');
    const cancelBtn = createMockElement('button', 'btn-test-cancel');
    const saveBtn = createMockElement('button', 'btn-test-save');
    const addBtn = createMockElement('button', 'btn-test-add');
    const list = createMockElement('div', 'test-list');

    const domMap = {
        'test-modal': modal,
        'test-title': title,
        'btn-test-close': closeBtn,
        'btn-test-cancel': cancelBtn,
        'btn-test-save': saveBtn,
        'btn-test-add': addBtn,
        'test-list': list
    };

    global.document = {
        getElementById: (id) => domMap[id] || null,
        querySelector: (sel) => null,
        addEventListener: () => {}
    };

    let savedCalls = 0;
    let items = [{ name: 'Item 1' }, { name: 'Item 2' }];

    const mockStrategy = {
        resetCalled: false,
        populatedWith: null,
        reset() { this.resetCalled = true; },
        populate(item) { this.populatedWith = item; },
        validateAndExtract(currentItems, idx) {
            return { valid: true, data: { name: 'Saved Item' } };
        }
    };

    const manager = new CrudModalManager({
        entityName: 'TestItem',
        dom: {
            modal: 'test-modal',
            headerTitle: 'test-title',
            closeBtn: 'btn-test-close',
            cancelBtn: 'btn-test-cancel',
            saveBtn: 'btn-test-save',
            addBtn: 'btn-test-add',
            listContainer: 'test-list'
        },
        getItems: () => items,
        setItems: (newItems) => { items = newItems; },
        saveSettings: () => { savedCalls++; },
        renderItemContent: (item, idx) => `
            <div class="test-row" data-index="${idx}">
                <span>${item.name}</span>
                <button class="btn-edit" data-action="edit" data-index="${idx}">Edit</button>
                <button class="btn-delete" data-action="delete" data-index="${idx}">Delete</button>
            </div>
        `,
        editorStrategy: mockStrategy
    });

    // Test render
    manager.render();
    assert.ok(list.innerHTML.includes('Item 1'));
    assert.ok(list.innerHTML.includes('Item 2'));

    // Test empty state
    items = [];
    manager.render();
    assert.ok(list.innerHTML.includes('class="empty-state"'), 'Must render empty state fallback');
    assert.ok(list.innerHTML.includes('No testitems found'), 'Empty state mentions entity name');

    // Test openAddModal
    items = [{ name: 'Item 1' }];
    manager.openAddModal();
    assert.strictEqual(manager.currentEditingIndex, null);
    assert.strictEqual(title.textContent, 'Add New TestItem');
    assert.strictEqual(mockStrategy.resetCalled, true);
    assert.strictEqual(modal.classList.contains('active'), true);

    // Test closeModal
    manager.closeModal();
    assert.strictEqual(modal.classList.contains('active'), false);
    assert.strictEqual(manager.currentEditingIndex, null);

    // Test openEditModal
    manager.openEditModal(0);
    assert.strictEqual(manager.currentEditingIndex, 0);
    assert.strictEqual(title.textContent, 'Edit TestItem');
    assert.deepStrictEqual(mockStrategy.populatedWith, { name: 'Item 1' });
    assert.strictEqual(modal.classList.contains('active'), true);

    // Test save (editing)
    manager.save();
    assert.strictEqual(savedCalls, 1);
    assert.strictEqual(items[0].name, 'Saved Item');
    assert.strictEqual(modal.classList.contains('active'), false);

    // Test save (adding)
    manager.openAddModal();
    manager.save();
    assert.strictEqual(savedCalls, 2);
    assert.strictEqual(items.length, 2);
    assert.strictEqual(items[1].name, 'Saved Item');

    // Test delete
    global.confirm = () => true;
    manager.deleteItem(1);
    assert.strictEqual(savedCalls, 3);
    assert.strictEqual(items.length, 1);

    console.log('PASS: CrudModalManager lifecycle tests passed');
}

// Test 4: Verify index.html contains all required elements and IDs
{
    console.log('Verifying HTML DOM structure in src/index.html...');
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');

    // Required IDs:
    const requiredIds = [
        'rules-list',
        'rule-editor-modal',
        'btn-add-rule',
        'rule-regex-input',
        'rule-filepath-input',
        'btn-save-rule',
        'btn-cancel-rule',
        'btn-close-rule-editor',
        'snippets-list',
        'snippet-editor-modal',
        'btn-add-snippet',
        'snippet-trigger-input',
        'snippet-content-editor',
        'btn-save-snippet',
        'btn-cancel-snippet',
        'btn-close-snippet-editor'
    ];

    for (const id of requiredIds) {
        assert.ok(html.includes(`id="${id}"`), `index.html must include id="${id}"`);
    }

    // Required scripts in load order:
    assert.ok(html.includes('crud-modal-manager.js'), 'index.html must include crud-modal-manager.js');
    assert.ok(html.includes('snippet-editor.js'), 'index.html must include snippet-editor.js');
    assert.ok(html.includes('filepath-rules.js'), 'index.html must include filepath-rules.js');

    const crudPos = html.indexOf('crud-modal-manager.js');
    const snipPos = html.indexOf('snippet-editor.js');
    const rulePos = html.indexOf('filepath-rules.js');
    assert.ok(crudPos < snipPos, 'crud-modal-manager.js must load before snippet-editor.js');
    assert.ok(snipPos < rulePos, 'snippet-editor.js must load before filepath-rules.js');

    console.log('PASS: index.html markup & script dependencies verified');
}

// Test 5: Verify settings defaults and settings persistence
{
    console.log('Verifying App.settings.filePathRules initialization and backward compatibility...');
    const coreJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app', 'core.js'), 'utf8');
    assert.ok(coreJs.includes('filePathRules: []'), 'core.js DEFAULT_SETTINGS must include filePathRules: []');

    const settingsJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app', 'settings.js'), 'utf8');
    assert.ok(settingsJs.includes('filePathRules: saved.filePathRules || DEFAULT_SETTINGS.filePathRules || []'), 'settings.js must load saved.filePathRules');

    console.log('PASS: Settings defaults and persistence verified');
}

console.log('--- ALL TESTS PASSED SUCCESSFULLY! ---');
