// ============================================================================
// SNIPPET EDITOR MODAL & CRUD LOGIC (CrudModalManager + SnippetEditorStrategy)
// ============================================================================

function getSnippetEscapeHtml() {
    if (typeof escHtml === 'function') return escHtml;
    if (typeof escapeHtml === 'function') return escapeHtml;
    return (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Fallback import if running in Node.js test environment
if (typeof CrudModalManager === 'undefined' && typeof require !== 'undefined') {
    try {
        const common = require('../../renderer/ui/crud-modal-manager.js');
        if (common.CrudModalManager) global.CrudModalManager = common.CrudModalManager;
        if (common.FormEditorStrategy) global.FormEditorStrategy = common.FormEditorStrategy;
    } catch (_) {}
}

/**
 * SnippetEditorStrategy
 * Wraps Monaco Editor container and trigger input. Monaco is lazily initialized.
 */
class SnippetEditorStrategy extends (typeof FormEditorStrategy !== 'undefined' ? FormEditorStrategy : Object) {
    constructor() {
        super();
        this.editor = null;
    }

    initEditor() {
        if (this.editor) return this.editor;
        const container = document.getElementById('snippet-content-editor');
        if (!container || typeof monaco === 'undefined') return null;

        const currentTheme = (typeof App !== 'undefined' && App.settings?.appearance?.theme) || 'kawaii-dark';
        this.editor = monaco.editor.create(container, {
            value: '',
            language: 'cpp',
            theme: currentTheme,
            fontSize: 14,
            fontFamily: 'JetBrains Mono, monospace',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            lineNumbers: 'on',
            renderWhitespace: 'selection',
            emptySelectionClipboard: false,
            bracketPairColorization: { enabled: true }
        });

        if (typeof window !== 'undefined') {
            window.snippetEditor = this.editor;
        }

        return this.editor;
    }

    reset() {
        this.initEditor();
        const triggerInput = document.getElementById('snippet-trigger-input');
        if (triggerInput) triggerInput.value = '';
        if (this.editor) this.editor.setValue('');
    }

    populate(item) {
        this.initEditor();
        const triggerInput = document.getElementById('snippet-trigger-input');
        if (triggerInput) triggerInput.value = item?.trigger || '';
        if (this.editor) this.editor.setValue(item?.content || '');
    }

    validateAndExtract(existingItems, currentIndex) {
        const triggerInput = document.getElementById('snippet-trigger-input');
        const trigger = triggerInput ? triggerInput.value.trim() : '';
        const content = this.editor ? this.editor.getValue() : '';

        if (!trigger) {
            return { valid: false, error: 'Please enter a trigger keyword.' };
        }
        if (!content) {
            return { valid: false, error: 'Please enter snippet content.' };
        }

        const items = existingItems || [];
        const existingIndex = items.findIndex(s => s && s.trigger === trigger);

        // Check for duplicate triggers
        if (existingIndex !== -1 && (currentIndex === null || existingIndex !== currentIndex)) {
            return { valid: false, error: 'A snippet with this trigger already exists!' };
        }

        return {
            valid: true,
            data: {
                trigger,
                name: 'Custom',
                content
            }
        };
    }
}

if (typeof window !== 'undefined') {
    window.SnippetEditorStrategy = SnippetEditorStrategy;
}

function createSnippetCrudManager() {
    const esc = getSnippetEscapeHtml();
    return new CrudModalManager({
        entityName: 'Snippet',
        dom: {
            modal: 'snippet-editor-modal',
            headerTitle: 'snippet-editor-title',
            closeBtn: 'btn-close-snippet-editor',
            cancelBtn: 'btn-cancel-snippet',
            saveBtn: 'btn-save-snippet',
            addBtn: 'btn-add-snippet',
            listContainer: 'snippets-list'
        },
        getItems: () => {
            if (typeof App !== 'undefined' && App.settings) {
                App.settings.snippets = App.settings.snippets || [];
                return App.settings.snippets;
            }
            return [];
        },
        setItems: (items) => {
            if (typeof App !== 'undefined' && App.settings) {
                App.settings.snippets = items;
            }
        },
        renderItemContent: (s, idx) => `
            <div class="snippet-item ${s.isBuiltin ? 'builtin' : ''}" data-index="${idx}">
                <div class="snippet-trigger">${esc(s.trigger || '')}</div>
                <div class="snippet-preview" title="${esc(s.content || '')}">
                    ${esc((s.content || '').split('\n')[0].substring(0, 50))}${(s.content || '').length > 50 || (s.content || '').includes('\n') ? '...' : ''}
                </div>
                <div class="snippet-actions">
                    <button class="btn-edit" data-action="edit" data-index="${idx}" title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                    </button>
                    <button class="btn-delete" data-action="delete" data-index="${idx}" title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                    </button>
                </div>
            </div>
        `,
        editorStrategy: new SnippetEditorStrategy()
    });
}

function initSnippetManagerInstance() {
    if (typeof App !== 'undefined' && App.settings) {
        App.settings.snippets = App.settings.snippets || [];
        App.settings.filePathRules = App.settings.filePathRules || [];
    }

    if (typeof window !== 'undefined' && typeof CrudModalManager !== 'undefined') {
        if (!window.snippetManager) {
            window.snippetManager = createSnippetCrudManager();
        }
        if (typeof App !== 'undefined' && App.settings) {
            window.snippetManager.render();
        }
    }
}

// Backward compatibility window functions
if (typeof window !== 'undefined') {
    window.renderSnippetsList = function () {
        if (window.snippetManager) {
            window.snippetManager.render();
        }
    };

    window.editSnippet = function (index) {
        if (window.snippetManager) {
            window.snippetManager.openEditModal(index);
        }
    };

    window.addNewSnippet = function () {
        if (window.snippetManager) {
            window.snippetManager.openAddModal();
        }
    };

    window.deleteSnippet = function (index) {
        if (window.snippetManager) {
            window.snippetManager.deleteItem(index);
        }
    };
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSnippetManagerInstance);
    } else {
        initSnippetManagerInstance();
    }
}

if (typeof module !== 'undefined' && module.exports) 
    module.exports = {
        SnippetEditorStrategy,
        createSnippetCrudManager
    };
}
