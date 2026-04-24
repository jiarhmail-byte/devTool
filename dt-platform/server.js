const http = require('http');
const fs = require('fs');
const path = require('path');

const { APP_CONFIG } = require('./js/config.js');
const {
  generate,
  loadDocSettings,
  saveDocSettings
} = require('./scripts/gen-doc-tree.js');

const HOST = '127.0.0.1';
const ROOT_DIR = __dirname;
const DEFAULT_PORT = Number(process.env.PORT || 8080);
const TOOL_SETTINGS_PATH = path.join(ROOT_DIR, 'data/tool-settings.json');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8'
};

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

function normalizeToolId(name, index) {
  const baseName = String(name || `tool-${index + 1}`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return baseName || `tool-${index + 1}`;
}

function normalizeTools(tools) {
  return (tools || []).map((tool, index) => ({
    id: tool.id || normalizeToolId(tool.name, index),
    name: String(tool.name || '').trim(),
    icon: String(tool.icon || 'fa-solid fa-screwdriver-wrench').trim(),
    command: String(tool.command || '').trim(),
    osProtocols: tool.osProtocols || null,
    fallback: String(tool.fallback || '').trim()
  })).filter((tool) => tool.name && tool.command);
}

function loadToolSettings() {
  const defaultTools = normalizeTools(APP_CONFIG.tools || []);

  try {
    if (!fs.existsSync(TOOL_SETTINGS_PATH)) {
      return { tools: defaultTools };
    }

    const content = fs.readFileSync(TOOL_SETTINGS_PATH, 'utf-8');
    const parsed = JSON.parse(content);
    return {
      tools: normalizeTools(parsed.tools)
    };
  } catch (error) {
    console.error(`⚠️ 读取工具配置失败，已回退默认配置: ${error.message}`);
    return { tools: defaultTools };
  }
}

function saveToolSettings(settings) {
  const nextSettings = {
    tools: normalizeTools(settings.tools)
  };

  const dirPath = path.dirname(TOOL_SETTINGS_PATH);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(TOOL_SETTINGS_PATH, JSON.stringify(nextSettings, null, 2), 'utf-8');
  return nextSettings;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      resolve(body);
    });

    req.on('error', reject);
  });
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

    sendJson(res, 200, {
      message: '文档路径已更新',
      settings,
      manifestCount: manifest.length
    });
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
    sendJson(res, 200, {
      message: '工具配置已更新',
      settings
    });
  } catch (error) {
    sendJson(res, 500, { message: `工具配置更新失败: ${error.message}` });
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
