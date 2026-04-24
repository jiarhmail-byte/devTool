const fs = require('fs');
const path = require('path');

const { APP_CONFIG } = require('../js/config.js');

const SAVE_PATH = path.join(__dirname, '../data/doc-manifest.json');
const SETTINGS_PATH = path.join(__dirname, '../data/doc-settings.json');

function normalizeRootPaths(rootPaths) {
  return (rootPaths || [])
    .map((rootPath) => String(rootPath || '').trim())
    .filter(Boolean)
    .map((rootPath) => path.resolve(rootPath));
}

function loadDocSettings() {
  const defaultSettings = {
    rootPaths: normalizeRootPaths(APP_CONFIG.docs.rootPaths)
  };

  try {
    if (!fs.existsSync(SETTINGS_PATH)) {
      return defaultSettings;
    }

    const content = fs.readFileSync(SETTINGS_PATH, 'utf-8');
    const parsed = JSON.parse(content);
    return {
      rootPaths: normalizeRootPaths(parsed.rootPaths)
    };
  } catch (err) {
    console.error(`⚠️ 读取文档设置失败，已回退默认配置: ${err.message}`);
    return defaultSettings;
  }
}

function saveDocSettings(settings) {
  const nextSettings = {
    rootPaths: normalizeRootPaths(settings.rootPaths)
  };

  const dirPath = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(nextSettings, null, 2), 'utf-8');
  return nextSettings;
}

function scan(dir) {
  const entries = [];

  try {
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
      if (file.startsWith('.') || file === 'node_modules') return;

      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        const children = scan(fullPath);
        if (children && children.length > 0) {
          entries.push({
            name: file,
            isDir: true,
            path: fullPath,
            children
          });
        }
      } else if (file.toLowerCase().endsWith('.md')) {
        entries.push({
          name: file,
          isDir: false,
          path: fullPath,
          ext: 'md'
        });
      }
    });
  } catch (err) {
    console.error(`读取出错: ${dir}`, err.message);
  }

  return entries;
}

function writeManifest(finalTree) {
  const dirPath = path.dirname(SAVE_PATH);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(SAVE_PATH, JSON.stringify(finalTree, null, 2), 'utf-8');
}

function generate(rootPaths = loadDocSettings().rootPaths) {
  console.log('🔍 正在扫描并清理空目录...');

  const finalTree = [];

  normalizeRootPaths(rootPaths).forEach((rootPath) => {
    const result = scan(rootPath);
    if (result.length === 0) {
      return;
    }

    const rootName = path.basename(rootPath.replace(/[\\/]+$/, '')) || rootPath;
    finalTree.push({
      name: rootName,
      isDir: true,
      path: rootPath,
      children: result
    });
  });

  try {
    writeManifest(finalTree);
    console.log(`\n✅ 成功！干净的文档树已写入: ${SAVE_PATH}`);
    console.log(`项目现在包含 ${finalTree.length} 个顶级条目。`);
  } catch (err) {
    console.error('❌ 写入文件失败:', err.message);
  }

  return finalTree;
}

if (require.main === module) {
  const settings = loadDocSettings();
  saveDocSettings(settings);
  generate(settings.rootPaths);
}

module.exports = {
  generate,
  loadDocSettings,
  saveDocSettings,
  normalizeRootPaths,
  SAVE_PATH,
  SETTINGS_PATH
};
