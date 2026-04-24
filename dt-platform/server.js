const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const { APP_CONFIG } = require('./js/config.js');
const {
  generate,
  loadDocSettings,
  saveDocSettings
} = require('./scripts/gen-doc-tree.js');

const HOST = '127.0.0.1';
const ROOT_DIR = __dirname;
const DEFAULT_PORT = Number(process.env.PORT || 8080);
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/generate';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';
const TOOL_SETTINGS_PATH = path.join(ROOT_DIR, 'data/tool-settings.json');
const PROJECT_SETTINGS_PATH = path.join(ROOT_DIR, 'data/project-settings.json');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8'
};

function execFileAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { maxBuffer: 1024 * 1024, ...options }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

function slugify(value, fallback) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
}

function ensureDataDirectory(filePath) {
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function isSubPath(targetPath, basePath) {
  const relativePath = path.relative(basePath, targetPath);
  return relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

function isAllowedDocPath(filePath) {
  if (path.extname(filePath).toLowerCase() !== '.md') {
    return false;
  }

  const docRoots = loadDocSettings().rootPaths;
  return docRoots.some((rootPath) => filePath === rootPath || isSubPath(filePath, rootPath));
}

function sendError(res, statusCode, message) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function postJson(targetUrl, payload) {
  return new Promise((resolve, reject) => {
    const requestUrl = new URL(targetUrl);
    const body = JSON.stringify(payload);
    const request = http.request({
      protocol: requestUrl.protocol,
      hostname: requestUrl.hostname,
      port: requestUrl.port,
      path: `${requestUrl.pathname}${requestUrl.search}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (response) => {
      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`本地 LLM 请求失败: ${response.statusCode} ${data}`));
          return;
        }

        try {
          resolve(data ? JSON.parse(data) : {});
        } catch (error) {
          reject(new Error(`本地 LLM 返回内容无法解析: ${error.message}`));
        }
      });
    });

    request.on('error', (error) => {
      reject(error);
    });

    request.write(body);
    request.end();
  });
}

function normalizeToolId(name, index) {
  return slugify(name, `tool-${index + 1}`);
}

function normalizeTools(tools) {
  return (tools || [])
    .map((tool, index) => ({
      id: tool.id || normalizeToolId(tool.name, index),
      name: String(tool.name || '').trim(),
      icon: String(tool.icon || 'fa-solid fa-screwdriver-wrench').trim(),
      command: String(tool.command || '').trim(),
      osProtocols: tool.osProtocols || null,
      fallback: String(tool.fallback || '').trim()
    }))
    .filter((tool) => tool.name && tool.command);
}

function loadToolSettings() {
  const defaultTools = normalizeTools(APP_CONFIG.tools || []);

  try {
    if (!fs.existsSync(TOOL_SETTINGS_PATH)) {
      return { tools: defaultTools };
    }

    const content = fs.readFileSync(TOOL_SETTINGS_PATH, 'utf-8');
    const parsed = JSON.parse(content);
    return { tools: normalizeTools(parsed.tools) };
  } catch (error) {
    console.error(`⚠️ 读取工具配置失败，已回退默认配置: ${error.message}`);
    return { tools: defaultTools };
  }
}

function saveToolSettings(settings) {
  const nextSettings = { tools: normalizeTools(settings.tools) };
  ensureDataDirectory(TOOL_SETTINGS_PATH);
  fs.writeFileSync(TOOL_SETTINGS_PATH, JSON.stringify(nextSettings, null, 2), 'utf-8');
  return nextSettings;
}

function normalizeProject(project, index) {
  const projectPath = path.resolve(String(project.path || '').trim());
  const projectName = String(project.name || path.basename(projectPath)).trim();
  const workspace = String(project.workspace || path.dirname(projectPath)).trim();

  return {
    id: project.id || slugify(projectName, `project-${index + 1}`),
    name: projectName,
    path: projectPath,
    workspace,
    description: String(project.description || '').trim()
  };
}

function loadProjectSettings() {
  try {
    if (!fs.existsSync(PROJECT_SETTINGS_PATH)) {
      return { projects: [] };
    }

    const content = fs.readFileSync(PROJECT_SETTINGS_PATH, 'utf-8');
    const parsed = JSON.parse(content);
    return {
      projects: (parsed.projects || []).map(normalizeProject)
    };
  } catch (error) {
    console.error(`⚠️ 读取项目配置失败: ${error.message}`);
    return { projects: [] };
  }
}

function saveProjectSettings(settings) {
  const nextSettings = {
    projects: (settings.projects || []).map(normalizeProject)
  };

  ensureDataDirectory(PROJECT_SETTINGS_PATH);
  fs.writeFileSync(PROJECT_SETTINGS_PATH, JSON.stringify(nextSettings, null, 2), 'utf-8');
  return nextSettings;
}

async function resolveGitRoot(projectPath) {
  const { stdout } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], { cwd: projectPath });
  return stdout.trim();
}

async function ensureProjectIsGitRepo(projectPath) {
  const resolvedPath = path.resolve(projectPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`项目路径不存在: ${resolvedPath}`);
  }

  const stats = fs.statSync(resolvedPath);
  if (!stats.isDirectory()) {
    throw new Error(`项目路径不是目录: ${resolvedPath}`);
  }

  return resolveGitRoot(resolvedPath);
}

async function normalizeAndValidateProjects(projects) {
  const normalizedProjects = [];

  for (let index = 0; index < (projects || []).length; index += 1) {
    const normalized = normalizeProject(projects[index], index);
    const gitRoot = await ensureProjectIsGitRepo(normalized.path);
    normalized.path = gitRoot;
    normalized.workspace = String(normalized.workspace || path.dirname(gitRoot)).trim() || path.dirname(gitRoot);
    normalizedProjects.push(normalized);
  }

  return normalizedProjects;
}

function parseGitStatus(stdout) {
  const lines = stdout.split('\n').filter(Boolean);
  const summaryLine = lines[0] || '';
  const changedCount = Math.max(lines.length - 1, 0);
  const branchMatch = summaryLine.match(/^## ([^.\s]+)(?:\.\.\.([^\s]+))?(?: \[(.+)\])?/);
  let ahead = 0;
  let behind = 0;

  if (branchMatch && branchMatch[3]) {
    const statusPart = branchMatch[3];
    const aheadMatch = statusPart.match(/ahead (\d+)/);
    const behindMatch = statusPart.match(/behind (\d+)/);
    ahead = aheadMatch ? Number(aheadMatch[1]) : 0;
    behind = behindMatch ? Number(behindMatch[1]) : 0;
  }

  return {
    currentBranch: branchMatch ? branchMatch[1] : 'unknown',
    upstream: branchMatch ? branchMatch[2] || '' : '',
    ahead,
    behind,
    changedCount,
    isClean: changedCount === 0
  };
}

async function getProjectRuntime(project) {
  const { stdout } = await execFileAsync('git', ['status', '--porcelain=v1', '--branch'], { cwd: project.path });
  return {
    ...project,
    git: parseGitStatus(stdout)
  };
}

async function getProjectsWithRuntime() {
  const settings = loadProjectSettings();
  const result = [];

  for (const project of settings.projects) {
    try {
      result.push(await getProjectRuntime(project));
    } catch (error) {
      result.push({
        ...project,
        git: {
          currentBranch: 'unknown',
          upstream: '',
          ahead: 0,
          behind: 0,
          changedCount: 0,
          isClean: false,
          error: error.stderr?.trim() || error.message
        }
      });
    }
  }

  return result;
}

function findProjectById(projectId) {
  const settings = loadProjectSettings();
  return settings.projects.find((project) => project.id === projectId);
}

async function listProjectBranches(project) {
  const [localResult, remoteResult] = await Promise.all([
    execFileAsync('git', ['branch', '--format=%(refname:short)'], { cwd: project.path }),
    execFileAsync('git', ['branch', '-r', '--format=%(refname:short)'], { cwd: project.path })
  ]);

  const localBranches = localResult.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
  const remoteBranches = remoteResult.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.includes('->'));

  return { localBranches, remoteBranches };
}

async function openProjectTerminal(project) {
  if (process.platform === 'darwin') {
    const escapedPath = project.path.replace(/"/g, '\\"');
    await execFileAsync('osascript', [
      '-e',
      `tell application "Terminal" to do script "cd \\"${escapedPath}\\""`,
      '-e',
      'tell application "Terminal" to activate'
    ]);
    return;
  }

  throw new Error('当前仅实现了 macOS Terminal 打开能力');
}

async function checkoutProjectBranch(project, branch, isRemote) {
  if (isRemote) {
    const localName = branch.replace(/^origin\//, '');
    await execFileAsync('git', ['checkout', '--track', branch], { cwd: project.path });
    return localName;
  }

  await execFileAsync('git', ['checkout', branch], { cwd: project.path });
  return branch;
}

async function commitProjectChanges(project, message) {
  await execFileAsync('git', ['add', '-A'], { cwd: project.path });
  await execFileAsync('git', ['commit', '-m', message], { cwd: project.path });
}

async function pushProjectChanges(project) {
  await execFileAsync('git', ['push'], { cwd: project.path });
}

function normalizeCommitMessage(message) {
  return String(message || '')
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ''))
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .find((line) => !line.startsWith('#') && !line.startsWith('-') && !line.startsWith('*')) || '';
}

async function buildCommitGenerationPrompt(project) {
  const [statusResult, statResult, diffResult] = await Promise.all([
    execFileAsync('git', ['status', '--short'], { cwd: project.path }),
    execFileAsync('git', ['diff', '--stat', 'HEAD'], { cwd: project.path }),
    execFileAsync('git', ['diff', 'HEAD'], { cwd: project.path, maxBuffer: 4 * 1024 * 1024 })
  ]);

  const statusOutput = statusResult.stdout.trim();
  const statOutput = statResult.stdout.trim();
  const diffOutput = diffResult.stdout.trim();

  if (!statusOutput) {
    throw new Error('当前没有可提交的改动');
  }

  return `
你是一个资深工程师，负责为 Git 改动生成 commit message。
请严格遵守以下规则：
1. 只输出一行 commit message
2. 优先使用 Conventional Commits 风格，例如 feat/fix/refactor/docs/chore
3. 内容要具体，不能空泛
4. 不要输出解释、前后缀、引号、代码块

项目名称: ${project.name}
项目路径: ${project.path}

Git status:
${statusOutput}

Diff stat:
${statOutput || '(empty)'}

Diff:
${diffOutput.slice(0, 12000) || '(empty)'}
  `.trim();
}

async function generateCommitMessage(project) {
  const prompt = await buildCommitGenerationPrompt(project);
  const result = await postJson(OLLAMA_URL, {
    model: OLLAMA_MODEL,
    prompt,
    stream: false,
    options: {
      temperature: 0.2
    }
  });

  const message = normalizeCommitMessage(result.response);
  if (!message) {
    throw new Error('本地 LLM 未返回有效的 commit message');
  }

  return message;
}

function serveStaticFile(reqPath, res) {
  const safePath = reqPath === '/' ? '/index.html' : reqPath;
  const filePath = path.normalize(path.join(ROOT_DIR, safePath));

  if (!filePath.startsWith(ROOT_DIR)) {
    sendError(res, 403, '禁止访问该资源');
    return;
  }

  fs.stat(filePath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      sendError(res, 404, '页面不存在');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
}

function serveMarkdownFile(rawFilePath, res) {
  if (!rawFilePath) {
    sendError(res, 400, '缺少文档路径');
    return;
  }

  const filePath = path.resolve(rawFilePath);
  if (!isAllowedDocPath(filePath)) {
    sendError(res, 403, '不允许访问该文档');
    return;
  }

  fs.stat(filePath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      sendError(res, 404, '文档不存在');
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `inline; filename="${encodeURIComponent(path.basename(filePath))}"`,
      'X-Content-Type-Options': 'nosniff'
    });

    fs.createReadStream(filePath).pipe(res);
  });
}

function handleDocSettingsGet(res) {
  sendJson(res, 200, loadDocSettings());
}

function handleToolSettingsGet(res) {
  sendJson(res, 200, loadToolSettings());
}

async function handleProjectsGet(res) {
  try {
    const projects = await getProjectsWithRuntime();
    sendJson(res, 200, { projects });
  } catch (error) {
    sendJson(res, 500, { message: `读取项目失败: ${error.message}` });
  }
}

function handleProjectSettingsGet(res) {
  sendJson(res, 200, loadProjectSettings());
}

async function handleDocSettingsUpdate(req, res) {
  try {
    const rawBody = await readRequestBody(req);
    const payload = rawBody ? JSON.parse(rawBody) : {};
    const rootPaths = Array.isArray(payload.rootPaths) ? payload.rootPaths : [];

    if (rootPaths.length === 0) {
      sendJson(res, 400, { message: '至少需要保留一个文档根路径' });
      return;
    }

    const settings = saveDocSettings({ rootPaths });
    const manifest = generate(settings.rootPaths);
    sendJson(res, 200, { message: '文档路径已更新', settings, manifestCount: manifest.length });
  } catch (error) {
    sendJson(res, 500, { message: `文档路径更新失败: ${error.message}` });
  }
}

async function handleToolSettingsUpdate(req, res) {
  try {
    const rawBody = await readRequestBody(req);
    const payload = rawBody ? JSON.parse(rawBody) : {};
    const tools = Array.isArray(payload.tools) ? payload.tools : [];

    if (tools.length === 0) {
      sendJson(res, 400, { message: '至少需要保留一个工具项' });
      return;
    }

    const settings = saveToolSettings({ tools });
    sendJson(res, 200, { message: '工具配置已更新', settings });
  } catch (error) {
    sendJson(res, 500, { message: `工具配置更新失败: ${error.message}` });
  }
}

async function handleProjectSettingsUpdate(req, res) {
  try {
    const rawBody = await readRequestBody(req);
    const payload = rawBody ? JSON.parse(rawBody) : {};
    const projects = Array.isArray(payload.projects) ? payload.projects : [];

    const validatedProjects = await normalizeAndValidateProjects(projects);
    const settings = saveProjectSettings({ projects: validatedProjects });
    sendJson(res, 200, { message: '项目配置已更新', settings });
  } catch (error) {
    sendJson(res, 400, { message: error.stderr?.trim() || error.message });
  }
}

async function handleProjectBranches(req, res, requestUrl) {
  try {
    const projectId = requestUrl.searchParams.get('id');
    const project = findProjectById(projectId);
    if (!project) {
      sendJson(res, 404, { message: '未找到项目' });
      return;
    }

    const branches = await listProjectBranches(project);
    sendJson(res, 200, branches);
  } catch (error) {
    sendJson(res, 500, { message: error.stderr?.trim() || error.message });
  }
}

async function handleProjectOpenTerminal(req, res) {
  try {
    const rawBody = await readRequestBody(req);
    const payload = rawBody ? JSON.parse(rawBody) : {};
    const project = findProjectById(payload.id);
    if (!project) {
      sendJson(res, 404, { message: '未找到项目' });
      return;
    }

    await openProjectTerminal(project);
    sendJson(res, 200, { message: '终端已打开' });
  } catch (error) {
    sendJson(res, 500, { message: error.stderr?.trim() || error.message });
  }
}

async function handleProjectCheckout(req, res) {
  try {
    const rawBody = await readRequestBody(req);
    const payload = rawBody ? JSON.parse(rawBody) : {};
    const project = findProjectById(payload.id);
    const branch = String(payload.branch || '').trim();
    const isRemote = Boolean(payload.isRemote);

    if (!project) {
      sendJson(res, 404, { message: '未找到项目' });
      return;
    }

    if (!branch) {
      sendJson(res, 400, { message: '缺少分支名' });
      return;
    }

    const currentBranch = await checkoutProjectBranch(project, branch, isRemote);
    const runtime = await getProjectRuntime(project);
    sendJson(res, 200, { message: `已切换到 ${currentBranch}`, project: runtime });
  } catch (error) {
    sendJson(res, 500, { message: error.stderr?.trim() || error.message });
  }
}

async function handleProjectCommit(req, res) {
  try {
    const rawBody = await readRequestBody(req);
    const payload = rawBody ? JSON.parse(rawBody) : {};
    const project = findProjectById(payload.id);
    const message = String(payload.message || '').trim();

    if (!project) {
      sendJson(res, 404, { message: '未找到项目' });
      return;
    }

    if (!message) {
      sendJson(res, 400, { message: '请输入 commit message' });
      return;
    }

    await commitProjectChanges(project, message);
    const runtime = await getProjectRuntime(project);
    sendJson(res, 200, { message: 'Commit 成功', project: runtime });
  } catch (error) {
    sendJson(res, 500, { message: error.stderr?.trim() || error.message });
  }
}

async function handleProjectCommitMessage(req, res) {
  try {
    const rawBody = await readRequestBody(req);
    const payload = rawBody ? JSON.parse(rawBody) : {};
    const project = findProjectById(payload.id);

    if (!project) {
      sendJson(res, 404, { message: '未找到项目' });
      return;
    }

    const message = await generateCommitMessage(project);
    sendJson(res, 200, { message });
  } catch (error) {
    sendJson(res, 500, { message: error.stderr?.trim() || error.message });
  }
}

async function handleProjectPush(req, res) {
  try {
    const rawBody = await readRequestBody(req);
    const payload = rawBody ? JSON.parse(rawBody) : {};
    const project = findProjectById(payload.id);

    if (!project) {
      sendJson(res, 404, { message: '未找到项目' });
      return;
    }

    await pushProjectChanges(project);
    const runtime = await getProjectRuntime(project);
    sendJson(res, 200, { message: 'Push 成功', project: runtime });
  } catch (error) {
    sendJson(res, 500, { message: error.stderr?.trim() || error.message });
  }
}

function createServer() {
  return http.createServer((req, res) => {
    const requestUrl = new URL(req.url, `http://${req.headers.host || `${HOST}:${DEFAULT_PORT}`}`);

    if (requestUrl.pathname === '/api/doc') {
      serveMarkdownFile(requestUrl.searchParams.get('path'), res);
      return;
    }

    if (requestUrl.pathname === '/api/settings/docs' && req.method === 'GET') {
      handleDocSettingsGet(res);
      return;
    }

    if (requestUrl.pathname === '/api/settings/docs' && req.method === 'POST') {
      handleDocSettingsUpdate(req, res);
      return;
    }

    if (requestUrl.pathname === '/api/settings/tools' && req.method === 'GET') {
      handleToolSettingsGet(res);
      return;
    }

    if (requestUrl.pathname === '/api/settings/tools' && req.method === 'POST') {
      handleToolSettingsUpdate(req, res);
      return;
    }

    if (requestUrl.pathname === '/api/projects' && req.method === 'GET') {
      handleProjectsGet(res);
      return;
    }

    if (requestUrl.pathname === '/api/settings/projects' && req.method === 'GET') {
      handleProjectSettingsGet(res);
      return;
    }

    if (requestUrl.pathname === '/api/settings/projects' && req.method === 'POST') {
      handleProjectSettingsUpdate(req, res);
      return;
    }

    if (requestUrl.pathname === '/api/projects/branches' && req.method === 'GET') {
      handleProjectBranches(req, res, requestUrl);
      return;
    }

    if (requestUrl.pathname === '/api/projects/open-terminal' && req.method === 'POST') {
      handleProjectOpenTerminal(req, res);
      return;
    }

    if (requestUrl.pathname === '/api/projects/checkout' && req.method === 'POST') {
      handleProjectCheckout(req, res);
      return;
    }

    if (requestUrl.pathname === '/api/projects/commit' && req.method === 'POST') {
      handleProjectCommit(req, res);
      return;
    }

    if (requestUrl.pathname === '/api/projects/commit-message' && req.method === 'POST') {
      handleProjectCommitMessage(req, res);
      return;
    }

    if (requestUrl.pathname === '/api/projects/push' && req.method === 'POST') {
      handleProjectPush(req, res);
      return;
    }

    serveStaticFile(requestUrl.pathname, res);
  });
}

function listen(port) {
  const server = createServer();

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.log(`⚠️ 端口 ${port} 已被占用，尝试下一个端口...`);
      listen(port + 1);
      return;
    }

    console.error('❌ 本地服务启动失败:', error.message);
    process.exit(1);
  });

  server.listen(port, HOST, () => {
    console.log(`🌐 本地服务已启动: http://${HOST}:${port}`);
  });
}

listen(DEFAULT_PORT);
