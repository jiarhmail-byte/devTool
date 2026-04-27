// js/config.js

const APP_CONFIG = {
  version: "1.0.0",
  tools: [
    {
      id: "open-webui",
      name: "Open WebUI",
      icon: "fa-solid fa-brain",
      command: "open-webui serve",
      osProtocols: {
        darwin: "iterm2://open?window=1&command=open-webui+serve",
        win32: "wt.exe wt -d . open-webui serve",
        linux: "gnome-terminal -- open-webui serve"
      },
      fallback: "cmd /c open-webui serve"
    },
    {
      id: "restart-docker",
      name: "Docker 重启",
      icon: "fa-solid fa-dharmachakra",
      command: "docker compose up -d",
      osProtocols: {
        darwin: "iterm2://open?window=1&command=docker+compose+up+-d",
        win32: "wt.exe wt -d . docker compose up -d",
        linux: "gnome-terminal -- docker compose up -d"
      },
      fallback: "cmd /c docker compose up -d"
    },
    {
      id: "edit-zshrc",
      name: "编辑 .zshrc",
      icon: "fa-solid fa-file-code",
      command: "open -e ~/.zshrc",
      osProtocols: {
        darwin: "open -e ~/.zshrc",
        win32: "notepad %USERPROFILE%\\.zshrc",
        linux: "gedit ~/.zshrc"
      },
      fallback: "open ~/.zshrc"
    }
  ],
  docs: {
    // 🚨 在此配置你所有的 Mac 本地路径
    rootPaths: [
      "/Users/hua/Developer/workspace/", // ⬅️ 请替换为你实际的 Mac 路径
      // ⬅️ 请替换为你实际的 Mac 路径
    ],
    searchEnabled: true,
    openInBrowser: true
  }
};

// ⚠️ 修复：兼容性导出逻辑
if (typeof module !== 'undefined' && module.exports) {
    // 如果在 Node.js 环境（运行脚本），使用 module.exports
    module.exports = { APP_CONFIG };
} else {
    // 如果在浏览器环境，将配置挂载到全局 window 对象
    window.APP_CONFIG = APP_CONFIG;
}