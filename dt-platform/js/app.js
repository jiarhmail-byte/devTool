let docSettingsDraft = [];
let toolSettingsDraft = [];
const TOOL_ICON_OPTIONS = [
    { label: '终端', value: 'fa-solid fa-terminal' },
    { label: '浏览器', value: 'fa-solid fa-globe' },
    { label: '火箭', value: 'fa-solid fa-rocket' },
    { label: '大脑', value: 'fa-solid fa-brain' },
    { label: '机器人', value: 'fa-solid fa-robot' },
    { label: 'Docker', value: 'fa-brands fa-docker' },
    { label: '数据库', value: 'fa-solid fa-database' },
    { label: '代码', value: 'fa-solid fa-code' },
    { label: '服务器', value: 'fa-solid fa-server' },
    { label: '齿轮', value: 'fa-solid fa-gear' },
    { label: '扳手', value: 'fa-solid fa-screwdriver-wrench' },
    { label: '盒子', value: 'fa-solid fa-box' }
];

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function fetchDocSettings() {
    const response = await fetch('./api/settings/docs', { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`读取配置失败: ${response.status}`);
    }

    return response.json();
}

async function saveDocSettingsRequest(rootPaths) {
    const response = await fetch('./api/settings/docs', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rootPaths })
    });

    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.message || '保存配置失败');
    }

    return result;
}

async function fetchToolSettings() {
    const response = await fetch('./api/settings/tools', { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`读取工具配置失败: ${response.status}`);
    }

    return response.json();
}

async function saveToolSettingsRequest(tools) {
    const response = await fetch('./api/settings/tools', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tools })
    });

    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.message || '保存工具配置失败');
    }

    return result;
}

function getSettingsElements() {
    return {
        modal: document.getElementById('doc-settings-modal'),
        list: document.getElementById('doc-settings-list'),
        feedback: document.getElementById('doc-settings-feedback')
    };
}

function getToolSettingsElements() {
    return {
        modal: document.getElementById('tool-settings-modal'),
        list: document.getElementById('tool-settings-list'),
        feedback: document.getElementById('tool-settings-feedback')
    };
}

function renderDocSettingsList() {
    const { list } = getSettingsElements();
    if (!list) return;

    list.innerHTML = '';

    docSettingsDraft.forEach((rootPath, index) => {
        const row = document.createElement('div');
        row.className = 'settings-row';
        row.innerHTML = `
            <div class="settings-index">${index + 1}</div>
            <input
                type="text"
                class="settings-input"
                value="${escapeHtml(rootPath)}"
                placeholder="/Users/yourname/Documents/docs"
                data-index="${index}"
            >
            <button type="button" class="icon-button danger" data-remove-index="${index}" aria-label="删除路径">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;
        list.appendChild(row);
    });

    if (docSettingsDraft.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-hint';
        emptyState.textContent = '请先添加至少一个本地目录路径';
        list.appendChild(emptyState);
    }
}

function setDocSettingsFeedback(message, type = 'info') {
    const { feedback } = getSettingsElements();
    if (!feedback) return;

    if (!message) {
        feedback.textContent = '';
        feedback.className = 'modal-feedback hidden';
        return;
    }

    feedback.textContent = message;
    feedback.className = `modal-feedback ${type}`;
}

function setToolSettingsFeedback(message, type = 'info') {
    const { feedback } = getToolSettingsElements();
    if (!feedback) return;

    if (!message) {
        feedback.textContent = '';
        feedback.className = 'modal-feedback hidden';
        return;
    }

    feedback.textContent = message;
    feedback.className = `modal-feedback ${type}`;
}

function openDocSettingsModal() {
    const { modal } = getSettingsElements();
    if (!modal) return;

    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
}

function closeDocSettingsModal() {
    const { modal } = getSettingsElements();
    if (!modal) return;

    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    setDocSettingsFeedback('');
}

function renderToolSettingsList() {
    const { list } = getToolSettingsElements();
    if (!list) return;

    list.innerHTML = '';

    toolSettingsDraft.forEach((tool, index) => {
        const card = document.createElement('div');
        card.className = 'tool-settings-card';
        const iconOptions = TOOL_ICON_OPTIONS.map((option) => `
            <button
                type="button"
                class="icon-choice${tool.icon === option.value ? ' is-selected' : ''}"
                data-tool-icon-value="${escapeHtml(option.value)}"
                data-tool-index="${index}"
                aria-label="${escapeHtml(option.label)}"
                title="${escapeHtml(option.label)}"
            >
                <i class="${escapeHtml(option.value)}"></i>
            </button>
        `).join('');
        card.innerHTML = `
            <div class="tool-settings-topbar">
                <div class="tool-settings-badge">${index + 1}</div>
                <button type="button" class="icon-button danger" data-tool-remove-index="${index}" aria-label="删除工具">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
            <div class="tool-settings-grid">
                <label class="field-group">
                    <span class="field-label">工具名称</span>
                    <input type="text" class="settings-input" data-tool-field="name" data-tool-index="${index}" value="${escapeHtml(tool.name || '')}" placeholder="例如：Open WebUI">
                </label>
                <label class="field-group">
                    <span class="field-label">图标 class</span>
                    <div class="icon-input-row">
                        <span class="icon-preview"><i class="${escapeHtml(tool.icon || 'fa-solid fa-screwdriver-wrench')}"></i></span>
                        <input type="text" class="settings-input" data-tool-field="icon" data-tool-index="${index}" value="${escapeHtml(tool.icon || '')}" placeholder="fa-solid fa-terminal">
                    </div>
                    <div class="icon-choice-list">
                        ${iconOptions}
                    </div>
                </label>
                <label class="field-group tool-settings-command">
                    <span class="field-label">启动命令</span>
                    <input type="text" class="settings-input" data-tool-field="command" data-tool-index="${index}" value="${escapeHtml(tool.command || '')}" placeholder="例如：npm run dev">
                </label>
            </div>
        `;
        list.appendChild(card);
    });

    if (toolSettingsDraft.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-hint';
        emptyState.textContent = '请先添加至少一个工具项';
        list.appendChild(emptyState);
    }
}

function openToolSettingsModal() {
    const { modal } = getToolSettingsElements();
    if (!modal) return;

    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
}

function closeToolSettingsModal() {
    const { modal } = getToolSettingsElements();
    if (!modal) return;

    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    setToolSettingsFeedback('');
}

async function handleOpenDocSettings() {
    try {
        const settings = await fetchDocSettings();
        docSettingsDraft = Array.isArray(settings.rootPaths) ? settings.rootPaths.slice() : [];
        renderDocSettingsList();
        setDocSettingsFeedback('');
        openDocSettingsModal();
    } catch (error) {
        console.error(error);
        alert(error.message || '读取文档路径失败');
    }
}

async function handleOpenToolSettings() {
    try {
        const settings = await fetchToolSettings();
        toolSettingsDraft = Array.isArray(settings.tools)
            ? settings.tools.map((tool) => ({
                id: tool.id || '',
                name: tool.name || '',
                icon: tool.icon || 'fa-solid fa-screwdriver-wrench',
                command: tool.command || ''
            }))
            : [];
        renderToolSettingsList();
        setToolSettingsFeedback('');
        openToolSettingsModal();
    } catch (error) {
        console.error(error);
        alert(error.message || '读取工具配置失败');
    }
}

function bindDocSettingsEvents() {
    const trigger = document.getElementById('doc-settings-trigger');
    const closeButton = document.getElementById('doc-settings-close');
    const cancelButton = document.getElementById('doc-settings-cancel');
    const addButton = document.getElementById('doc-settings-add');
    const saveButton = document.getElementById('doc-settings-save');
    const { modal, list } = getSettingsElements();

    trigger?.addEventListener('click', handleOpenDocSettings);
    closeButton?.addEventListener('click', closeDocSettingsModal);
    cancelButton?.addEventListener('click', closeDocSettingsModal);

    modal?.addEventListener('click', (event) => {
        if (event.target.dataset.closeModal === 'true') {
            closeDocSettingsModal();
        }
    });

    addButton?.addEventListener('click', () => {
        docSettingsDraft.push('');
        renderDocSettingsList();
    });

    list?.addEventListener('input', (event) => {
        if (!event.target.classList.contains('settings-input')) {
            return;
        }

        const index = Number(event.target.dataset.index);
        docSettingsDraft[index] = event.target.value;
    });

    list?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-remove-index]');
        if (!button) {
            return;
        }

        const index = Number(button.dataset.removeIndex);
        docSettingsDraft.splice(index, 1);
        renderDocSettingsList();
    });

    saveButton?.addEventListener('click', async () => {
        const rootPaths = docSettingsDraft
            .map((rootPath) => rootPath.trim())
            .filter(Boolean);

        if (rootPaths.length === 0) {
            setDocSettingsFeedback('至少需要保留一个本地路径', 'error');
            return;
        }

        setDocSettingsFeedback('正在保存并刷新文档...', 'info');

        try {
            await saveDocSettingsRequest(rootPaths);
            await refreshDocManifest();
            setDocSettingsFeedback('路径已保存，文档清单已刷新', 'success');
            setTimeout(() => {
                closeDocSettingsModal();
            }, 500);
        } catch (error) {
            console.error(error);
            setDocSettingsFeedback(error.message || '保存失败，请稍后重试', 'error');
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
            closeDocSettingsModal();
        }
    });
}

function bindToolSettingsEvents() {
    const trigger = document.getElementById('tool-settings-trigger');
    const closeButton = document.getElementById('tool-settings-close');
    const cancelButton = document.getElementById('tool-settings-cancel');
    const addButton = document.getElementById('tool-settings-add');
    const saveButton = document.getElementById('tool-settings-save');
    const { modal, list } = getToolSettingsElements();

    trigger?.addEventListener('click', handleOpenToolSettings);
    closeButton?.addEventListener('click', closeToolSettingsModal);
    cancelButton?.addEventListener('click', closeToolSettingsModal);

    modal?.addEventListener('click', (event) => {
        if (event.target.dataset.closeToolModal === 'true') {
            closeToolSettingsModal();
        }
    });

    addButton?.addEventListener('click', () => {
        toolSettingsDraft.push({
            id: '',
            name: '',
            icon: 'fa-solid fa-screwdriver-wrench',
            command: ''
        });
        renderToolSettingsList();
    });

    list?.addEventListener('input', (event) => {
        const input = event.target.closest('[data-tool-field]');
        if (!input) {
            return;
        }

        const index = Number(input.dataset.toolIndex);
        const field = input.dataset.toolField;
        toolSettingsDraft[index][field] = input.value;
    });

    list?.addEventListener('click', (event) => {
        const iconChoice = event.target.closest('[data-tool-icon-value]');
        if (iconChoice) {
            const index = Number(iconChoice.dataset.toolIndex);
            toolSettingsDraft[index].icon = iconChoice.dataset.toolIconValue;
            renderToolSettingsList();
            return;
        }

        const button = event.target.closest('[data-tool-remove-index]');
        if (!button) {
            return;
        }

        const index = Number(button.dataset.toolRemoveIndex);
        toolSettingsDraft.splice(index, 1);
        renderToolSettingsList();
    });

    saveButton?.addEventListener('click', async () => {
        const tools = toolSettingsDraft
            .map((tool) => ({
                id: String(tool.id || '').trim(),
                name: String(tool.name || '').trim(),
                icon: String(tool.icon || 'fa-solid fa-screwdriver-wrench').trim(),
                command: String(tool.command || '').trim()
            }))
            .filter((tool) => tool.name && tool.command);

        if (tools.length === 0) {
            setToolSettingsFeedback('至少需要保留一个完整的工具项', 'error');
            return;
        }

        setToolSettingsFeedback('正在保存并刷新工具...', 'info');

        try {
            await saveToolSettingsRequest(tools);
            await refreshTools();
            setToolSettingsFeedback('工具栏已更新', 'success');
            setTimeout(() => {
                closeToolSettingsModal();
            }, 500);
        } catch (error) {
            console.error(error);
            setToolSettingsFeedback(error.message || '保存工具配置失败', 'error');
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
            closeToolSettingsModal();
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initTools();
    initDocTree('doc-tree-container');
    bindDocSettingsEvents();
    bindToolSettingsEvents();
});
