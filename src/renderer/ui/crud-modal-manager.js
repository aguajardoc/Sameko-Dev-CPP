/**
 * Generic CRUD Modal Manager and Strategy Pattern Implementations
 * Handles modal lifecycle, state management, list rendering, event delegation, and persistence.
 */

// Helper to escape HTML safely
function escapeHtmlValue(value) {
    if (typeof escHtml === 'function') {
        return escHtml(value);
    }
    return String(value ?? '').replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

/**
 * Base Form Strategy Interface
 */
class FormEditorStrategy {
    reset() {
        throw new Error('reset() must be implemented by strategy');
    }

    populate(item) {
        throw new Error('populate() must be implemented by strategy');
    }

    validateAndExtract(existingItems, currentIndex) {
        throw new Error('validateAndExtract() must be implemented by strategy');
    }
}

/**
 * Generic CrudModalManager
 * Coordinates CRUD operations for entities with a modal form and list view.
 */
class CrudModalManager {
    /**
     * @param {Object} config
     * @param {string} config.entityName
     * @param {Object} config.dom - Element IDs or elements
     * @param {Function} config.renderItemContent - (item, index) => string
     * @param {FormEditorStrategy} config.editorStrategy
     * @param {Function} [config.getItems]
     * @param {Function} [config.setItems]
     * @param {Function} [config.saveSettings]
     */
    constructor(config) {
        this.config = config || {};
        this.entityName = this.config.entityName || 'Item';
        this.editorStrategy = this.config.editorStrategy || null;
        this.currentEditingIndex = null;
        this._items = [];
        this._eventsBound = false;
        this._escBound = false;

        if (typeof document !== 'undefined') {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.bindEvents());
            } else {
                this.bindEvents();
            }
        }
    }

    _resolveElement(keys) {
        if (!this.config || !this.config.dom) return null;
        const dom = this.config.dom;
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const k of keyList) {
            const val = dom[k];
            if (!val) continue;
            if (typeof val === 'string') {
                const el = document.getElementById(val) || document.querySelector(val);
                if (el) return el;
            } else if (val instanceof HTMLElement || (typeof val === 'object' && val.nodeType === 1)) {
                return val;
            }
        }
        return null;
    }

    get modal() {
        return this._resolveElement(['modal', 'modalContainer', 'modalId', 'containerModal']);
    }

    get headerTitle() {
        return this._resolveElement(['headerTitle', 'title', 'titleId', 'header']);
    }

    get closeBtn() {
        return this._resolveElement(['closeBtn', 'btnClose', 'closeButton', 'btn-close']);
    }

    get cancelBtn() {
        return this._resolveElement(['cancelBtn', 'btnCancel', 'cancelButton', 'btn-cancel']);
    }

    get saveBtn() {
        return this._resolveElement(['saveBtn', 'btnSave', 'saveButton', 'btn-save']);
    }

    get addBtn() {
        return this._resolveElement(['addBtn', 'btnAdd', 'addButton', 'btn-add']);
    }

    get listContainer() {
        return this._resolveElement(['listContainer', 'list', 'container', 'listId']);
    }

    getItems() {
        if (typeof this.config.getItems === 'function') {
            return this.config.getItems();
        }
        return this._items || [];
    }

    setItems(items) {
        if (typeof this.config.setItems === 'function') {
            this.config.setItems(items);
        } else {
            this._items = items;
        }
    }

    saveSettings() {
        if (typeof this.config.saveSettings === 'function') {
            this.config.saveSettings();
        } else if (typeof saveSettings === 'function') {
            saveSettings();
        } else if (typeof App !== 'undefined' && typeof App.saveSettings === 'function') {
            App.saveSettings();
        }
    }

    isOpen() {
        const modal = this.modal;
        return modal ? modal.classList.contains('active') : false;
    }

    openAddModal() {
        this.bindEvents();
        this.currentEditingIndex = null;
        const titleEl = this.headerTitle;
        if (titleEl) {
            titleEl.textContent = `Add New ${this.entityName}`;
        }
        if (this.editorStrategy && typeof this.editorStrategy.reset === 'function') {
            this.editorStrategy.reset();
        }
        const modal = this.modal;
        if (modal) {
            modal.classList.add('active');
        }
    }

    openEditModal(index) {
        this.bindEvents();
        const items = this.getItems();
        if (!items || items[index] === undefined) return;

        this.currentEditingIndex = index;
        const titleEl = this.headerTitle;
        if (titleEl) {
            titleEl.textContent = `Edit ${this.entityName}`;
        }
        if (this.editorStrategy && typeof this.editorStrategy.populate === 'function') {
            this.editorStrategy.populate(items[index]);
        }
        const modal = this.modal;
        if (modal) {
            modal.classList.add('active');
        }
    }

    closeModal() {
        const modal = this.modal;
        if (modal) {
            modal.classList.remove('active');
        }
        this.currentEditingIndex = null;
    }

    save() {
        if (!this.editorStrategy || typeof this.editorStrategy.validateAndExtract !== 'function') {
            return;
        }
        const items = this.getItems();
        const result = this.editorStrategy.validateAndExtract(items, this.currentEditingIndex);
        if (!result || !result.valid) {
            const errorMsg = (result && result.error) ? result.error : 'Validation failed';
            alert(errorMsg);
            return;
        }

        if (this.currentEditingIndex !== null && this.currentEditingIndex >= 0) {
            items[this.currentEditingIndex] = result.data;
        } else {
            items.push(result.data);
        }
        this.setItems(items);
        this.render();
        this.saveSettings();
        this.closeModal();
    }

    deleteItem(index) {
        const entityLabel = this.entityName.toLowerCase();
        if (confirm(`Are you sure you want to delete this ${entityLabel}?`)) {
            const items = this.getItems();
            if (index >= 0 && index < items.length) {
                items.splice(index, 1);
                this.setItems(items);
                this.render();
                this.saveSettings();
            }
        }
    }

    bindEvents() {
        // Add Button
        const addBtn = this.addBtn;
        if (addBtn && !addBtn._crudBound) {
            addBtn._crudBound = true;
            addBtn.addEventListener('click', () => this.openAddModal());
        }

        // Close Button
        const closeBtn = this.closeBtn;
        if (closeBtn && !closeBtn._crudBound) {
            closeBtn._crudBound = true;
            closeBtn.addEventListener('click', () => this.closeModal());
        }

        // Cancel Button
        const cancelBtn = this.cancelBtn;
        if (cancelBtn && !cancelBtn._crudBound) {
            cancelBtn._crudBound = true;
            cancelBtn.addEventListener('click', () => this.closeModal());
        }

        // Save Button
        const saveBtn = this.saveBtn;
        if (saveBtn && !saveBtn._crudBound) {
            saveBtn._crudBound = true;
            saveBtn.addEventListener('click', () => this.save());
        }

        // Modal overlay and backdrop click
        const modal = this.modal;
        if (modal && !modal._crudBackdropBound) {
            modal._crudBackdropBound = true;
            const overlay = modal.querySelector('.snippet-editor-overlay, .rule-editor-overlay, [class*="overlay"]');
            if (overlay) {
                overlay.addEventListener('click', () => this.closeModal());
            }
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                }
            });
        }

        // Esc key handling
        if (!this._escBound && typeof document !== 'undefined') {
            this._escBound = true;
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen()) {
                    this.closeModal();
                }
            });
        }

        // Event delegation on list container
        this.setupListDelegation();
    }

    setupListDelegation() {
        const list = this.listContainer;
        if (!list || list._crudDelegationBound) return;
        list._crudDelegationBound = true;

        list.addEventListener('click', (e) => {
            // Edit action trigger
            const editBtn = e.target.closest('[data-action="edit"], [data-edit], [data-snippet-edit], [data-rule-edit], .btn-edit');
            if (editBtn && list.contains(editBtn)) {
                const row = editBtn.closest('[data-index]');
                const rawIndex = editBtn.dataset.action === 'edit' && editBtn.dataset.index !== undefined
                    ? editBtn.dataset.index
                    : (editBtn.dataset.edit ?? editBtn.dataset.snippetEdit ?? editBtn.dataset.ruleEdit ?? editBtn.dataset.index ?? row?.dataset.index);
                if (rawIndex !== undefined && rawIndex !== '') {
                    const index = parseInt(rawIndex, 10);
                    if (!isNaN(index)) {
                        this.openEditModal(index);
                    }
                }
                return;
            }

            // Delete action trigger
            const deleteBtn = e.target.closest('[data-action="delete"], [data-delete], [data-snippet-delete], [data-rule-delete], .btn-delete');
            if (deleteBtn && list.contains(deleteBtn)) {
                const row = deleteBtn.closest('[data-index]');
                const rawIndex = deleteBtn.dataset.action === 'delete' && deleteBtn.dataset.index !== undefined
                    ? deleteBtn.dataset.index
                    : (deleteBtn.dataset.delete ?? deleteBtn.dataset.snippetDelete ?? deleteBtn.dataset.ruleDelete ?? deleteBtn.dataset.index ?? row?.dataset.index);
                if (rawIndex !== undefined && rawIndex !== '') {
                    const index = parseInt(rawIndex, 10);
                    if (!isNaN(index)) {
                        this.deleteItem(index);
                    }
                }
                return;
            }
        });
    }

    render() {
        this.bindEvents();
        const container = this.listContainer;
        if (!container) return;

        const items = this.getItems();
        if (!items || items.length === 0) {
            const entityPlural = this.entityName.toLowerCase() + 's';
            container.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="12" y1="18" x2="12" y2="12"></line>
                        <line x1="9" y1="15" x2="15" y2="15"></line>
                    </svg>
                    <p>No ${entityPlural} found. Click "Add New ${this.entityName}" to create one.</p>
                </div>
            `;
            return;
        }

        if (typeof this.config.renderItemContent === 'function') {
            container.innerHTML = items.map((item, idx) => {
                let rowHtml = this.config.renderItemContent(item, idx);
                const hasActions = rowHtml.includes('btn-edit') || rowHtml.includes('data-action="edit"') || rowHtml.includes('data-edit');
                if (!hasActions) {
                    return `
                        <div class="snippet-item" data-index="${idx}">
                            ${rowHtml}
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
                    `;
                }
                if (!rowHtml.includes(`data-index="${idx}"`) && !rowHtml.includes(`data-snippet-edit="${idx}"`) && !rowHtml.includes(`data-rule-edit="${idx}"`)) {
                    rowHtml = rowHtml.replace(/^(\s*<[a-zA-Z0-9-]+)/, `$1 data-index="${idx}"`);
                }
                return rowHtml;
            }).join('');
        }
    }

    renderList() {
        this.render();
    }
}

// Global browser exposures
if (typeof window !== 'undefined') {
    window.CrudModalManager = CrudModalManager;
    window.FormEditorStrategy = FormEditorStrategy;
}

// CommonJS module exports for tests/Node environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CrudModalManager,
        FormEditorStrategy,
        get SnippetEditorStrategy() {
            return require('../../features/snippets/snippet-editor.js').SnippetEditorStrategy;
        },
        get FilePathRuleEditorStrategy() {
            return require('../../features/filepath-rules/filepath-rules.js').FilePathRuleEditorStrategy;
        },
        escapeHtmlValue
    };
}

