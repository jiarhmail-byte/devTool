// --- 文档树核心逻辑 ---

let docTreeContainer = null;
let fullDocTreeData = [];

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildDocUrl(filePath) {
    return `./api/doc?path=${encodeURIComponent(filePath)}`;
}

function hasSearchKeyword() {
    return Boolean((document.getElementById('doc-search')?.value || '').trim());
}

// --- 递归渲染文档树 ---
function renderDocTree(container, data, options = {}) {
    const { expandDirectories = false } = options;

    // 1. 清空容器
    container.innerHTML = '';

    // 2. 如果数据为空，直接返回提示
    if (!data || data.length === 0) {
        container.innerHTML = '<p class="empty-hint">未发现 Markdown 文档</p>';
        return;
    }

    const ul = document.createElement('ul');
    ul.className = 'tree-list';

    data.forEach(item => {
        const li = document.createElement('li');
        const node = document.createElement('div');
        const isDir = item.isDir === true;

        const icon = isDir ? '<i class="fa-solid fa-folder"></i>' : '<i class="fa-regular fa-file-lines"></i>';
        node.className = `tree-node is-${isDir ? 'folder' : 'file'}`;
        node.innerHTML = `${icon} <span class="node-name">${escapeHtml(item.name)}</span>`;

        if (isDir) {
            const childWrapper = document.createElement('div');
            childWrapper.className = expandDirectories ? 'child-container' : 'child-container hidden';

            if (expandDirectories) {
                node.classList.add('expanded');
            }

            node.onclick = (e) => {
                e.stopPropagation();
                node.classList.toggle('expanded');
                childWrapper.classList.toggle('hidden');
            };

            li.appendChild(node);
            renderDocTree(childWrapper, item.children || [], options);
            li.appendChild(childWrapper);
        } else {
            const nodeLink = document.createElement('a');
            nodeLink.href = buildDocUrl(item.path);
            nodeLink.target = '_blank';
            nodeLink.rel = 'noopener noreferrer';
            nodeLink.className = `tree-node is-file`;
            nodeLink.innerHTML = `${icon} <span class="node-name">${escapeHtml(item.name)}</span>`;
            li.appendChild(nodeLink);
        }

        ul.appendChild(li);
    });

    container.appendChild(ul);
}

function filterTreeData(items, keyword) {
    if (!keyword) {
        return items;
    }

    return items.reduce((acc, item) => {
        const selfMatch = item.name.toLowerCase().includes(keyword);

        if (item.isDir) {
            const children = filterTreeData(item.children || [], keyword);
            if (selfMatch || children.length > 0) {
                acc.push({
                    ...item,
                    children
                });
            }
            return acc;
        }

        if (selfMatch) {
            acc.push(item);
        }

        return acc;
    }, []);
}

// --- 文档树筛选 ---
function filterDocTree(container) {
    const containerRef = container || docTreeContainer;
    if (!containerRef) return;

    const keyword = (document.getElementById('doc-search')?.value || '').trim().toLowerCase();
    const filteredTree = filterTreeData(fullDocTreeData, keyword);
    renderDocTree(containerRef, filteredTree, { expandDirectories: Boolean(keyword) });
}

async function loadDocManifest() {
    const response = await fetch('./data/doc-manifest.json', { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`文档清单读取失败: ${response.status}`);
    }

    return response.json();
}

async function refreshDocManifest() {
    fullDocTreeData = await loadDocManifest();
    filterDocTree(docTreeContainer);
    return fullDocTreeData;
}

// --- 初始化文档树并绑定搜索 ---
async function initDocTree(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }

    docTreeContainer = container;
    renderDocTree(container, []);

    const searchInput = document.getElementById('doc-search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            filterDocTree(container);
        });
    }

    try {
        fullDocTreeData = await loadDocManifest();
        if (hasSearchKeyword()) {
            filterDocTree(container);
            return;
        }

        renderDocTree(container, fullDocTreeData);
    } catch (error) {
        console.error(error);
        container.innerHTML = '<p class="empty-hint">文档清单加载失败，请先重新生成目录数据</p>';
    }
}

// --- 导出 ---
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { renderDocTree, filterDocTree, initDocTree, filterTreeData, refreshDocManifest };
}
