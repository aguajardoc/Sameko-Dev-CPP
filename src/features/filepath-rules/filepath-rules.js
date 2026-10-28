// ============================================================================
// FILEPATH RULES MODAL & CRUD LOGIC (CrudModalManager + FilePathRuleEditorStrategy)
// ============================================================================

function getRulesEscapeHtml() {
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
 * FilePathRuleEditorStrategy
 * Targets two text inputs: #rule-regex-input and #rule-filepath-input.
 * Validates non-empty fields, regex validity, and no duplicate regexes.
 * Serializes to { regex, filePath }.
 */
class FilePathRuleEditorStrategy extends (typeof FormEditorStrategy !== 'undefined' ? FormEditorStrategy : Object) {
    constructor() {
        super();
    }

    reset() {
        const regexInput = document.getElementById('rule-regex-input');
        const filepathInput = document.getElementById('rule-filepath-input');
        if (regexInput) regexInput.value = '';
        if (filepathInput) filepathInput.value = '';
    }

    populate(item) {
        const regexInput = document.getElementById('rule-regex-input');
        const filepathInput = document.getElementById('rule-filepath-input');
        if (regexInput) {
            regexInput.value = item?.regex || item?.rule || item?.pattern || '';
        }
        if (filepathInput) {
            filepathInput.value = item?.filePath || item?.filepath || item?.path || '';
        }
    }

    validateAndExtract(existingItems, currentIndex) {
        const regexInput = document.getElementById('rule-regex-input');
        const filepathInput = document.getElementById('rule-filepath-input');
        const regex = regexInput ? regexInput.value.trim() : '';
        const filePath = filepathInput ? filepathInput.value.trim() : '';

        if (!regex) {
            return { valid: false, error: 'Please enter a regex pattern.' };
        }
        if (!filePath) {
            return { valid: false, error: 'Please enter a destination filepath.' };
        }

        try {
            new RegExp(regex);
        } catch (e) {
            return { valid: false, error: `Invalid regular expression: ${e.message}` };
        }

        const items = existingItems || [];
        const existingIndex = items.findIndex(r => r && (r.regex === regex || r.rule === regex || r.pattern === regex));

        if (existingIndex !== -1 && (currentIndex === null || existingIndex !== currentIndex)) {
            return { valid: false, error: 'A filepath rule with this regex pattern already exists!' };
        }

        return {
            valid: true,
            data: {
                regex,
                filePath
            }
        };
    }
}

if (typeof window !== 'undefined') {
    window.FilePathRuleEditorStrategy = FilePathRuleEditorStrategy;
}

function createFilePathRuleCrudManager() {
    const esc = getRulesEscapeHtml();
    return new CrudModalManager({
        entityName: 'Filepath Rule',
        dom: {
            modal: 'rule-editor-modal',
            headerTitle: 'rule-editor-title',
            closeBtn: 'btn-close-rule-editor',
            cancelBtn: 'btn-cancel-rule',
            saveBtn: 'btn-save-rule',
            addBtn: 'btn-add-rule',
            listContainer: 'rules-list'
        },
        getItems: () => {
            if (typeof App !== 'undefined' && App.settings) {
                App.settings.filePathRules = App.settings.filePathRules || [];
                return App.settings.filePathRules;
            }
            return [];
        },
        setItems: (items) => {
            if (typeof App !== 'undefined' && App.settings) {
                App.settings.filePathRules = items;
            }
        },
        renderItemContent: (r, idx) => `
            <div class="snippet-item rule-item" data-index="${idx}">
                <div class="snippet-trigger rule-pattern" title="${esc(r.regex || '')}">${esc(r.regex || '')}</div>
                <div class="snippet-preview rule-path" title="${esc(r.filePath || '')}">${esc(r.filePath || '')}</div>
                <div class="snippet-actions rule-actions">
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
        editorStrategy: new FilePathRuleEditorStrategy()
    });
}

function initFilePathRuleManagerInstance() {
    if (typeof App !== 'undefined' && App.settings) {
        App.settings.filePathRules = App.settings.filePathRules || [];
    }

    if (typeof window !== 'undefined' && typeof CrudModalManager !== 'undefined') {
        if (!window.filePathRuleManager) {
            window.filePathRuleManager = createFilePathRuleCrudManager();
        }
        if (typeof App !== 'undefined' && App.settings) {
            window.filePathRuleManager.render();
        }
    }
}

// Backward compatibility window functions
if (typeof window !== 'undefined') {
    window.renderFilePathRules = function () {
        if (window.filePathRuleManager) {
            window.filePathRuleManager.render();
        }
    };

    window.editFilePathRule = function (index) {
        if (window.filePathRuleManager) {
            window.filePathRuleManager.openEditModal(index);
        }
    };

    window.addNewFilePathRule = function () {
        if (window.filePathRuleManager) {
            window.filePathRuleManager.openAddModal();
        }
    };

    window.deleteFilePathRule = function (index) {
        if (window.filePathRuleManager) {
            window.filePathRuleManager.deleteItem(index);
        }
    };
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFilePathRuleManagerInstance);
    } else {
        initFilePathRuleManagerInstance();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        FilePathRuleEditorStrategy,
        createFilePathRuleCrudManager
    };
}
