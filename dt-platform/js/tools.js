let currentTools = [];

function normalizeToolId(name, index) {
  const baseName = String(name || `tool-${index + 1}`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return baseName || `tool-${index + 1}`;
}

function buildToolProtocols(command) {
  const encodedCommand = encodeURIComponent(command);
  return {
    darwin: `iterm2://open?window=1&command=${encodedCommand}`,
    win32: `wt.exe wt -d . ${command}`,
    linux: `gnome-terminal -- ${command}`
  };
}

function normalizeTool(tool, index) {
  return {
    id: tool.id || normalizeToolId(tool.name, index),
    name: String(tool.name || '').trim(),
    icon: String(tool.icon || 'fa-solid fa-screwdriver-wrench').trim(),
    command: String(tool.command || '').trim(),
    osProtocols: tool.osProtocols || buildToolProtocols(tool.command || ''),
    fallback: String(tool.fallback || `cmd /c ${tool.command || ''}`).trim()
  };
}

async function loadTools() {
  try {
    const response = await fetch('./api/settings/tools', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`工具配置读取失败: ${response.status}`);
    }

    const settings = await response.json();
    return (settings.tools || []).map(normalizeTool);
  } catch (error) {
    console.warn(error);
    return (APP_CONFIG.tools || []).map(normalizeTool);
  }
}

function renderTools() {
  const grid = document.getElementById('tools-grid');
  if (!grid) return;
  grid.innerHTML = '';

  currentTools.forEach((tool) => {
    const card = document.createElement('button');
    card.className = 'tool-card';
    card.type = 'button';
    const isZshrc = tool.id === 'edit-zshrc';
    card.setAttribute('data-zshrc', isZshrc ? '' : null);
    card.innerHTML = `
      <span class="tool-icon"><i class="${tool.icon}"></i></span>
      <span class="tool-content">
        <span class="tool-name">${tool.name}</span>
        <span class="tool-command">${isZshrc ? '编辑配置' : tool.command}</span>
      </span>
    `;

    card.addEventListener('click', () => executeTool(tool));
    grid.appendChild(card);
  });
}

function executeTool(tool) {
  // 编辑.zshrc 的工具打开配置窗口
  if (tool.id === 'edit-zshrc') {
    openZshrcConfig(tool);
    return;
  }
  const os = navigator.platform.toLowerCase();
  const protocols = tool.osProtocols || buildToolProtocols(tool.command);
  const protocol = protocols[os] || protocols[os.includes('win') ? 'win32' : 'darwin'] || tool.fallback;
  window.location.href = protocol;
}

async function openZshrcConfig(tool) {
  try {
    const result = await fetchJson('./api/config/zshrc');
    document.getElementById('zshrc-content').value = result.content || '';
    openModal('zshrc-modal');
  } catch (error) {
    alert(`加载失败：${error.message}`);
    openModal('zshrc-modal');
  }
}

async function initTools() {
  currentTools = await loadTools();
  renderTools();
  return currentTools;
}

async function refreshTools() {
  return initTools();
}
