let docSettingsDraft = [];
let toolSettingsDraft = [];
let projectSettingsDraft = [];
let projectRuntimeData = [];
let activeBranchProjectId = '';
let activeCommitProjectId = '';

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

async function fetchJson(url, options) {
    const response = await fetch(url, options);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(result.message || `请求失败: ${response.status}`);
    }
    return result;
}

function getModalState(id) {
    return document.getElementById(id);
}

function openModal(id) {
    const modal = getModalState(id);
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
}

function closeModal(id) {
    const modal = getModalState(id);
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
}

function setFeedback(elementId, message, type = 'info') {
    const element = document.getElementById(elementId);
    if (!element) return;

    if (!message) {
        element.className = 'modal-feedback hidden';
        element.textContent = '';
        return;
    }

    element.className = `modal-feedback ${type}`;
    element.textContent = message;
}

async function fetchDocSettings() {
    return fetchJson('./api/settings/docs', { cache: 'no-store' });
}

async function saveDocSettingsRequest(rootPaths) {
    return fetchJson('./api/settings/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPaths })
    });
}

async function fetchToolSettings() {
    return fetchJson('./api/settings/tools', { cache: 'no-store' });
}

async function saveToolSettingsRequest(tools) {
    return fetchJson('./api/settings/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tools })
    });
}

async function fetchProjectSettings() {
    return fetchJson('./api/settings/projects', { cache: 'no-store' });
}

async function saveProjectSettingsRequest(projects) {
    return fetchJson('./api/settings/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects })
    });
}

async function fetchProjects() {
    const result = await fetchJson('./api/projects', { cache: 'no-store' });
    return result.projects || [];
}

async function openProjectTerminal(id) {
    return fetchJson('./api/projects/open-terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    });
}

async function fetchProjectBranches(id) {
    return fetchJson(`./api/projects/branches?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
}

async function checkoutProjectBranch(id, branch, isRemote) {
    return fetchJson('./api/projects/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, branch, isRemote })
    });
}

async function commitProject(id, message) {
    return fetchJson('./api/projects/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, message })
    });
}

async function pushProject(id) {
    return fetchJson('./api/projects/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    });
}

function renderDocSettingsList() {
    const list = document.getElementById('doc-settings-list');
    if (!list) return;
    list.innerHTML = '';

    docSettingsDraft.forEach((rootPath, index) => {
        const row = document.createElement('div');
        row.className = 'settings-row';
        row.innerHTML = `
            <div class="settings-index">${index + 1}</div>
            <input type="text" class="settings-input" value="${escapeHtml(rootPath)}" data-index="${index}" placeholder="/Users/yourname/Documents/docs">
            <button type="button" class="icon-button danger" data-remove-index="${index}" aria-label="删除路径"><i class="fa-solid fa-trash"></i></button>
        `;
        list.appendChild(row);
    });

    if (docSettingsDraft.length === 0) {
        list.innerHTML = '<div class="empty-hint">请先添加至少一个本地目录路径</div>';
    }
}

function renderToolSettingsList() {
    const list = document.getElementById('tool-settings-list');
    if (!list) return;
    list.innerHTML = '';

    toolSettingsDraft.forEach((tool, index) => {
        const iconOptions = TOOL_ICON_OPTIONS.map((option) => `
            <button
                type="button"
                class="icon-choice${tool.icon === option.value ? ' is-selected' : ''}"
                data-tool-icon-value="${escapeHtml(option.value)}"
                data-tool-index="${index}"
                title="${escapeHtml(option.label)}"
            >
                <i class="${escapeHtml(option.value)}"></i>
            </button>
        `).join('');

        const card = document.createElement('div');
        card.className = 'tool-settings-card';
        card.innerHTML = `
            <div class="tool-settings-topbar">
                <div class="tool-settings-badge">${index + 1}</div>
                <button type="button" class="icon-button danger" data-tool-remove-index="${index}" aria-label="删除工具"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="tool-settings-grid">
                <label class="field-group">
                    <span class="field-label">工具名称</span>
                    <input type="text" class="settings-input" data-tool-field="name" data-tool-index="${index}" value="${escapeHtml(tool.name || '')}">
                </label>
                <label class="field-group">
                    <span class="field-label">图标 class</span>
                    <div class="icon-input-row">
                        <span class="icon-preview"><i class="${escapeHtml(tool.icon || 'fa-solid fa-screwdriver-wrench')}"></i></span>
                        <input type="text" class="settings-input" data-tool-field="icon" data-tool-index="${index}" value="${escapeHtml(tool.icon || '')}">
                    </div>
                    <div class="icon-choice-list">${iconOptions}</div>
                </label>
                <label class="field-group tool-settings-command">
                    <span class="field-label">启动命令</span>
                    <input type="text" class="settings-input" data-tool-field="command" data-tool-index="${index}" value="${escapeHtml(tool.command || '')}">
                </label>
            </div>
        `;
        list.appendChild(card);
    });

    if (toolSettingsDraft.length === 0) {
        list.innerHTML = '<div class="empty-hint">请先添加至少一个工具项</div>';
    }
}

function renderProjectSettingsList() {
    const list = document.getElementById('project-settings-list');
    if (!list) return;
    list.innerHTML = '';

    projectSettingsDraft.forEach((project, index) => {
        const card = document.createElement('div');
        card.className = 'project-settings-card';
        card.innerHTML = `
            <div class="tool-settings-topbar">
                <div class="tool-settings-badge">${index + 1}</div>
                <button type="button" class="icon-button danger" data-project-remove-index="${index}" aria-label="删除项目"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="project-settings-grid">
                <label class="field-group">
                    <span class="field-label">项目名称</span>
                    <input type="text" class="settings-input" data-project-field="name" data-project-index="${index}" value="${escapeHtml(project.name || '')}" placeholder="例如：devTool">
                </label>
                <label class="field-group">
                    <span class="field-label">工作空间</span>
                    <input type="text" class="settings-input" data-project-field="workspace" data-project-index="${index}" value="${escapeHtml(project.workspace || '')}" placeholder="/Users/hua/Developer/workspace">
                </label>
                <label class="field-group project-settings-path">
                    <span class="field-label">项目路径</span>
                    <input type="text" class="settings-input" data-project-field="path" data-project-index="${index}" value="${escapeHtml(project.path || '')}" placeholder="/Users/hua/Developer/workspace/devTool">
                </label>
                <label class="field-group project-settings-path">
                    <span class="field-label">说明</span>
                    <input type="text" class="settings-input" data-project-field="description" data-project-index="${index}" value="${escapeHtml(project.description || '')}" placeholder="例如：本地效率平台项目">
                </label>
            </div>
        `;
        list.appendChild(card);
    });

    if (projectSettingsDraft.length === 0) {
        list.innerHTML = '<div class="empty-hint">请先添加至少一个 Git 项目</div>';
    }
}

function buildProjectStatus(project) {
    const git = project.git || {};
    if (git.error) {
        return '<span class="project-badge danger"><i class="fa-solid fa-triangle-exclamation"></i> 状态异常</span>';
    }

    const parts = [];
    parts.push(`<span class="project-badge"><i class="fa-solid fa-code-branch"></i> ${escapeHtml(git.currentBranch || 'unknown')}</span>`);
    if (git.isClean) {
        parts.push('<span class="project-badge success"><i class="fa-solid fa-circle-check"></i> clean</span>');
    } else {
        parts.push(`<span class="project-badge warn"><i class="fa-solid fa-pen"></i> ${git.changedCount || 0} changed</span>`);
    }
    if (git.ahead) {
        parts.push(`<span class="project-badge"><i class="fa-solid fa-arrow-up"></i> ahead ${git.ahead}</span>`);
    }
    if (git.behind) {
        parts.push(`<span class="project-badge"><i class="fa-solid fa-arrow-down"></i> behind ${git.behind}</span>`);
    }
    if (git.upstream) {
        parts.push(`<span class="project-badge subtle"><i class="fa-solid fa-link"></i> ${escapeHtml(git.upstream)}</span>`);
    }

    return parts.join('');
}

function groupProjectsByWorkspace(projects) {
    return projects.reduce((acc, project) => {
        const workspace = project.workspace || '未分组工作空间';
        if (!acc[workspace]) {
            acc[workspace] = [];
        }
        acc[workspace].push(project);
        return acc;
    }, {});
}

function filterProjects(projects) {
    const query = (document.getElementById('workspace-search-input')?.value || '').trim().toLowerCase();
    if (!query) {
        return projects;
    }

    return projects.filter((project) => {
        return [
            project.name,
            project.description,
            project.path,
            project.workspace,
            project.git?.currentBranch
        ].some((value) => String(value || '').toLowerCase().includes(query));
    });
}

function renderProjects() {
    const container = document.getElementById('workspace-container');
    if (!container) return;

    const projects = filterProjects(projectRuntimeData);
    container.innerHTML = '';

    if (projects.length === 0) {
        container.innerHTML = `
            <div class="project-card project-card-empty">
                <div class="empty-state-icon"><i class="fa-solid fa-folder-tree"></i></div>
                <h3>还没有可展示的项目</h3>
                <p>点击顶部“新增项目”或“管理项目”，把本地 Git 项目接入首页工作台。</p>
            </div>
        `;
        return;
    }

    const groups = groupProjectsByWorkspace(projects);

    Object.entries(groups).forEach(([workspace, items]) => {
        const block = document.createElement('div');
        block.className = 'workspace-block';
        block.innerHTML = `<div class="workspace-title">${escapeHtml(workspace)}</div>`;

        const list = document.createElement('div');
        list.className = 'project-card-list';

        items.forEach((project, index) => {
            const card = document.createElement('article');
            card.className = `project-card${index === 0 ? ' project-card-featured' : ''}`;
            card.innerHTML = `
                <div class="project-card-top">
                    <div>
                        <h3>${escapeHtml(project.name)}</h3>
                        <p>${escapeHtml(project.description || project.path)}</p>
                    </div>
                    <div class="project-status${project.git?.isClean ? ' clean' : ''}">${escapeHtml(project.git?.currentBranch || 'unknown')}</div>
                </div>
                <div class="project-meta">${buildProjectStatus(project)}</div>
                <div class="project-path">${escapeHtml(project.path)}</div>
                <div class="project-actions">
                    <button type="button" class="ghost-button secondary" data-project-open-terminal="${project.id}">打开终端</button>
                    <button type="button" class="ghost-button secondary" data-project-branches="${project.id}">切换分支</button>
                    <button type="button" class="ghost-button secondary" data-project-commit="${project.id}">Commit</button>
                    <button type="button" class="ghost-button secondary" data-project-push="${project.id}">Push</button>
                </div>
            `;
            list.appendChild(card);
        });

        block.appendChild(list);
        container.appendChild(block);
    });
}

async function refreshProjects() {
    projectRuntimeData = await fetchProjects();
    renderProjects();
}

async function openDocSettings() {
    const settings = await fetchDocSettings();
    docSettingsDraft = Array.isArray(settings.rootPaths) ? settings.rootPaths.slice() : [];
    renderDocSettingsList();
    setFeedback('doc-settings-feedback', '');
    openModal('doc-settings-modal');
}

async function openToolSettings() {
    const settings = await fetchToolSettings();
    toolSettingsDraft = Array.isArray(settings.tools) ? settings.tools.map((tool) => ({ ...tool })) : [];
    renderToolSettingsList();
    setFeedback('tool-settings-feedback', '');
    openModal('tool-settings-modal');
}

async function openZshrcConfig() {
    try {
        const result = await fetchJson('./api/config/zshrc');
        document.getElementById('zshrc-content').value = result.content || '';
        setFeedback('zshrc-feedback', '');
        openModal('zshrc-modal');
    } catch (error) {
        setFeedback('zshrc-feedback', `加载失败：${error.message}`, 'error');
        openModal('zshrc-modal');
    }
}

async function openProjectSettings(withNewItem = false) {
    const settings = await fetchProjectSettings();
    projectSettingsDraft = Array.isArray(settings.projects) ? settings.projects.map((project) => ({ ...project })) : [];
    if (withNewItem) {
        projectSettingsDraft.push({ id: '', name: '', workspace: '', path: '', description: '' });
    }
    renderProjectSettingsList();
    setFeedback('project-settings-feedback', '');
    openModal('project-settings-modal');
}

async function showBranchModal(projectId) {
    activeBranchProjectId = projectId;
    const project = projectRuntimeData.find((item) => item.id === projectId);
    document.getElementById('branch-modal-project').textContent = project ? `${project.name} · ${project.path}` : '';
    setFeedback('branch-feedback', '正在加载分支...', 'info');
    openModal('branch-modal');

    try {
        const branches = await fetchProjectBranches(projectId);
        const localList = document.getElementById('branch-local-list');
        const remoteList = document.getElementById('branch-remote-list');
        localList.innerHTML = '';
        remoteList.innerHTML = '';

        branches.localBranches.forEach((branch) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'branch-item';
            button.dataset.branch = branch;
            button.textContent = branch;
            localList.appendChild(button);
        });

        branches.remoteBranches.forEach((branch) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'branch-item';
            button.dataset.branch = branch;
            button.dataset.remote = 'true';
            button.textContent = branch;
            remoteList.appendChild(button);
        });

        setFeedback('branch-feedback', '');
    } catch (error) {
        setFeedback('branch-feedback', error.message, 'error');
    }
}

async function openZshrcConfig() {
    try {
        const result = await fetchJson('./api/config/zshrc');
        document.getElementById('zshrc-content').value = result.content || '';
        setFeedback('zshrc-feedback', '');
        openModal('zshrc-modal');
    } catch (error) {
        setFeedback('zshrc-feedback', `加载失败：${error.message}`, 'error');
        openModal('zshrc-modal');
    }
}

function showCommitModal(projectId) {
    activeCommitProjectId = projectId;
    const project = projectRuntimeData.find((item) => item.id === projectId);
    document.getElementById('commit-modal-project').textContent = project ? `${project.name} · ${project.path}` : '';
    document.getElementById('commit-message-input').value = '';
    setFeedback('commit-feedback', '');
    openModal('commit-modal');
}

function bindDocSettingsEvents() {
    document.getElementById('doc-settings-trigger')?.addEventListener('click', async () => {
        try {
            await openDocSettings();
        } catch (error) {
            alert(error.message);
        }
    });

    document.getElementById('doc-settings-close')?.addEventListener('click', () => closeModal('doc-settings-modal'));
    document.getElementById('doc-settings-cancel')?.addEventListener('click', () => closeModal('doc-settings-modal'));
    document.getElementById('doc-settings-modal')?.addEventListener('click', (event) => {
        if (event.target.dataset.closeModal === 'true') closeModal('doc-settings-modal');
    });

    document.getElementById('doc-settings-add')?.addEventListener('click', () => {
        docSettingsDraft.push('');
        renderDocSettingsList();
    });

    document.getElementById('doc-settings-list')?.addEventListener('input', (event) => {
        if (!event.target.classList.contains('settings-input')) return;
        docSettingsDraft[Number(event.target.dataset.index)] = event.target.value;
    });

    document.getElementById('doc-settings-list')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-remove-index]');
        if (!button) return;
        docSettingsDraft.splice(Number(button.dataset.removeIndex), 1);
        renderDocSettingsList();
    });

    document.getElementById('doc-settings-save')?.addEventListener('click', async () => {
        const rootPaths = docSettingsDraft.map((item) => item.trim()).filter(Boolean);
        if (!rootPaths.length) {
            setFeedback('doc-settings-feedback', '至少需要保留一个本地路径', 'error');
            return;
        }

        setFeedback('doc-settings-feedback', '正在保存并刷新文档...', 'info');
        try {
            await saveDocSettingsRequest(rootPaths);
            await refreshDocManifest();
            setFeedback('doc-settings-feedback', '路径已保存，文档清单已刷新', 'success');
            setTimeout(() => closeModal('doc-settings-modal'), 500);
        } catch (error) {
            setFeedback('doc-settings-feedback', error.message, 'error');
        }
    });
}

function bindToolSettingsEvents() {
    document.getElementById('tool-settings-trigger')?.addEventListener('click', async () => {
        try {
            await openToolSettings();
        } catch (error) {
            alert(error.message);
        }
    });

    document.getElementById('tool-settings-close')?.addEventListener('click', () => closeModal('tool-settings-modal'));
    document.getElementById('tool-settings-cancel')?.addEventListener('click', () => closeModal('tool-settings-modal'));
    document.getElementById('tool-settings-modal')?.addEventListener('click', (event) => {
        if (event.target.dataset.closeToolModal === 'true') closeModal('tool-settings-modal');
    });

    document.getElementById('tool-settings-add')?.addEventListener('click', () => {
        toolSettingsDraft.push({ id: '', name: '', icon: 'fa-solid fa-screwdriver-wrench', command: '' });
        renderToolSettingsList();
    });

    document.getElementById('tool-settings-list')?.addEventListener('input', (event) => {
        const input = event.target.closest('[data-tool-field]');
        if (!input) return;
        toolSettingsDraft[Number(input.dataset.toolIndex)][input.dataset.toolField] = input.value;
    });

    document.getElementById('tool-settings-list')?.addEventListener('click', (event) => {
        const iconChoice = event.target.closest('[data-tool-icon-value]');
        if (iconChoice) {
            toolSettingsDraft[Number(iconChoice.dataset.toolIndex)].icon = iconChoice.dataset.toolIconValue;
            renderToolSettingsList();
            return;
        }

        const button = event.target.closest('[data-tool-remove-index]');
        if (!button) return;
        toolSettingsDraft.splice(Number(button.dataset.toolRemoveIndex), 1);
        renderToolSettingsList();
    });

    document.getElementById('tool-settings-save')?.addEventListener('click', async () => {
        const tools = toolSettingsDraft
            .map((tool) => ({
                id: String(tool.id || '').trim(),
                name: String(tool.name || '').trim(),
                icon: String(tool.icon || 'fa-solid fa-screwdriver-wrench').trim(),
                command: String(tool.command || '').trim()
            }))
            .filter((tool) => tool.name && tool.command);

        if (!tools.length) {
            setFeedback('tool-settings-feedback', '至少需要保留一个完整的工具项', 'error');
            return;
        }

        setFeedback('tool-settings-feedback', '正在保存并刷新工具...', 'info');
        try {
            await saveToolSettingsRequest(tools);
            await refreshTools();
            setFeedback('tool-settings-feedback', '工具栏已更新', 'success');
            setTimeout(() => closeModal('tool-settings-modal'), 500);
        } catch (error) {
            setFeedback('tool-settings-feedback', error.message, 'error');
        }
    });

    document.getElementById('zshrc-config-trigger')?.addEventListener('click', async () => {
        try {
            await openZshrcConfig();
        } catch (error) {
            alert(error.message);
        }
    });
}

function bindProjectSettingsEvents() {
    document.getElementById('project-add-trigger')?.addEventListener('click', async () => {
        try {
            await openProjectSettings(true);
        } catch (error) {
            alert(error.message);
        }
    });

    document.getElementById('project-settings-trigger')?.addEventListener('click', async () => {
        try {
            await openProjectSettings(false);
        } catch (error) {
            alert(error.message);
        }
    });

    document.getElementById('project-settings-close')?.addEventListener('click', () => closeModal('project-settings-modal'));
    document.getElementById('project-settings-cancel')?.addEventListener('click', () => closeModal('project-settings-modal'));
    document.getElementById('project-settings-modal')?.addEventListener('click', (event) => {
        if (event.target.dataset.closeProjectModal === 'true') closeModal('project-settings-modal');
    });

    document.getElementById('project-settings-add')?.addEventListener('click', () => {
        projectSettingsDraft.push({ id: '', name: '', workspace: '', path: '', description: '' });
        renderProjectSettingsList();
    });

    document.getElementById('project-settings-list')?.addEventListener('input', (event) => {
        const input = event.target.closest('[data-project-field]');
        if (!input) return;
        projectSettingsDraft[Number(input.dataset.projectIndex)][input.dataset.projectField] = input.value;
    });

    document.getElementById('project-settings-list')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-project-remove-index]');
        if (!button) return;
        projectSettingsDraft.splice(Number(button.dataset.projectRemoveIndex), 1);
        renderProjectSettingsList();
    });

    document.getElementById('project-settings-save')?.addEventListener('click', async () => {
        const projects = projectSettingsDraft
            .map((project) => ({
                id: String(project.id || '').trim(),
                name: String(project.name || '').trim(),
                workspace: String(project.workspace || '').trim(),
                path: String(project.path || '').trim(),
                description: String(project.description || '').trim()
            }))
            .filter((project) => project.name && project.path);

        if (!projects.length) {
            setFeedback('project-settings-feedback', '至少需要保留一个完整的项目项', 'error');
            return;
        }

        setFeedback('project-settings-feedback', '正在校验并保存项目...', 'info');
        try {
            await saveProjectSettingsRequest(projects);
            await refreshProjects();
            setFeedback('project-settings-feedback', '项目配置已更新', 'success');
            setTimeout(() => closeModal('project-settings-modal'), 500);
        } catch (error) {
            setFeedback('project-settings-feedback', error.message, 'error');
        }
    });
}

function bindProjectActionEvents() {
    document.getElementById('workspace-container')?.addEventListener('click', async (event) => {
        const openButton = event.target.closest('[data-project-open-terminal]');
        if (openButton) {
            try {
                await openProjectTerminal(openButton.dataset.projectOpenTerminal);
            } catch (error) {
                alert(error.message);
            }
            return;
        }

        const branchButton = event.target.closest('[data-project-branches]');
        if (branchButton) {
            await showBranchModal(branchButton.dataset.projectBranches);
            return;
        }

        const commitButton = event.target.closest('[data-project-commit]');
        if (commitButton) {
            showCommitModal(commitButton.dataset.projectCommit);
            return;
        }

        const pushButton = event.target.closest('[data-project-push]');
        if (pushButton) {
            pushButton.disabled = true;
            try {
                await pushProject(pushButton.dataset.projectPush);
                await refreshProjects();
            } catch (error) {
                alert(error.message);
            } finally {
                pushButton.disabled = false;
            }
        }
    });

    document.getElementById('workspace-search-input')?.addEventListener('input', renderProjects);
}

function bindBranchModalEvents() {
    document.getElementById('branch-modal-close')?.addEventListener('click', () => closeModal('branch-modal'));
    document.getElementById('branch-modal')?.addEventListener('click', async (event) => {
        if (event.target.dataset.closeBranchModal === 'true') {
            closeModal('branch-modal');
            return;
        }

        const button = event.target.closest('[data-branch]');
        if (!button) return;

        setFeedback('branch-feedback', '正在切换分支...', 'info');
        try {
            await checkoutProjectBranch(activeBranchProjectId, button.dataset.branch, button.dataset.remote === 'true');
            await refreshProjects();
            setFeedback('branch-feedback', '分支切换成功', 'success');
            setTimeout(() => closeModal('branch-modal'), 500);
        } catch (error) {
            setFeedback('branch-feedback', error.message, 'error');
        }
    });
}

function bindCommitModalEvents() {
    document.getElementById('commit-modal-close')?.addEventListener('click', () => closeModal('commit-modal'));
    document.getElementById('commit-cancel')?.addEventListener('click', () => closeModal('commit-modal'));
    document.getElementById('commit-modal')?.addEventListener('click', (event) => {
        if (event.target.dataset.closeCommitModal === 'true') closeModal('commit-modal');
    });
    document.getElementById('commit-submit')?.addEventListener('click', async () => {
        const message = document.getElementById('commit-message-input').value.trim();
        if (!message) {
            setFeedback('commit-feedback', '请输入 commit message', 'error');
            return;
        }

        setFeedback('commit-feedback', '正在执行 commit...', 'info');
        try {
            await commitProject(activeCommitProjectId, message);
            await refreshProjects();
            setFeedback('commit-feedback', 'Commit 成功', 'success');
            setTimeout(() => closeModal('commit-modal'), 500);
        } catch (error) {
            setFeedback('commit-feedback', error.message, 'error');
        }
    });

    document.getElementById('commit-ai-generate')?.addEventListener('click', async () => {
        const aiButton = document.getElementById('commit-ai-generate');
        const originalText = aiButton.innerHTML;
        aiButton.disabled = true;
        aiButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 生成中...';
        setFeedback('commit-feedback', '正在使用 AI 生成 commit message...', 'info');

        try {
            const result = await fetchJson('./api/projects/commit-message', {
                method: 'POST',
                body: JSON.stringify({ id: activeCommitProjectId })
            });
            document.getElementById('commit-message-input').value = result.message;
            setFeedback('commit-feedback', 'AI 生成成功', 'success');
        } catch (error) {
            setFeedback('commit-feedback', `AI 生成失败: ${error.message}`, 'error');
        } finally {
            aiButton.disabled = false;
            aiButton.innerHTML = originalText;
        }
    });
}

function bindZshrcConfigEvents() {
    document.getElementById('zshrc-close')?.addEventListener('click', () => closeModal('zshrc-modal'));
    document.getElementById('zshrc-cancel')?.addEventListener('click', () => {
        closeModal('zshrc-modal');
        setFeedback('zshrc-feedback', '');
    });
    document.getElementById('zshrc-save')?.addEventListener('click', async () => {
        const saveButton = document.getElementById('zshrc-save');
        const originalText = saveButton.innerHTML;
        saveButton.disabled = true;
        saveButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 保存中...';

        try {
            const content = document.getElementById('zshrc-content').value;
            await fetchJson('./api/config/zshrc', {
                method: 'POST',
                body: JSON.stringify({ content })
            });
            setFeedback('zshrc-feedback', '保存成功！在终端执行 source ~/.zshrc 使配置生效', 'success');
            closeModal('zshrc-modal');
        } catch (error) {
            setFeedback('zshrc-feedback', `保存失败：${error.message}`, 'error');
        } finally {
            saveButton.disabled = false;
            saveButton.innerHTML = originalText;
        }
    });
    document.getElementById('zshrc-load')?.addEventListener('click', async () => {
        try {
            const result = await fetchJson('./api/config/zshrc');
            document.getElementById('zshrc-content').value = result.content || '';
            setFeedback('zshrc-feedback', '重新加载成功', 'success');
        } catch (error) {
            setFeedback('zshrc-feedback', `加载失败：${error.message}`, 'error');
        }
    });
}

function bindZshrcConfigEvents() {
    document.getElementById('zshrc-close')?.addEventListener('click', () => closeModal('zshrc-modal'));
    document.getElementById('zshrc-cancel')?.addEventListener('click', () => {
        closeModal('zshrc-modal');
        setFeedback('zshrc-feedback', '');
    });
    document.getElementById('zshrc-load')?.addEventListener('click', openZshrcConfig);
    document.getElementById('zshrc-save')?.addEventListener('click', async () => {
        const saveButton = document.getElementById('zshrc-save');
        const originalText = saveButton.innerHTML;
        saveButton.disabled = true;
        saveButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 保存中...';

        try {
            const content = document.getElementById('zshrc-content').value;
            await fetchJson('./api/config/zshrc', {
                method: 'POST',
                body: JSON.stringify({ content })
            });
            setFeedback('zshrc-feedback', '保存成功！在终端执行 source ~/.zshrc 使配置生效', 'success');
            closeModal('zshrc-modal');
        } catch (error) {
            setFeedback('zshrc-feedback', `保存失败：${error.message}`, 'error');
        } finally {
            saveButton.disabled = false;
            saveButton.innerHTML = originalText;
        }
    });
}

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    ['doc-settings-modal', 'tool-settings-modal', 'project-settings-modal', 'zshrc-modal', 'branch-modal', 'commit-modal']
        .forEach(closeModal);
});

document.addEventListener('DOMContentLoaded', async () => {
    await initTools();
    await initDocTree('doc-tree-container');
    await refreshProjects();
    bindDocSettingsEvents();
    bindToolSettingsEvents();
    bindProjectSettingsEvents();
    bindProjectActionEvents();
    bindBranchModalEvents();
    bindCommitModalEvents();
    bindZshrcConfigEvents();
});
