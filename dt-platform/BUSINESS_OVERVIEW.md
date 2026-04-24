# DT Platform 业务梳理

## 1. 项目定位

`dt-platform` 是一个本地开发工作台，目标是把三类高频能力集中到一个页面里：

- 全局常用工具启动
- 本地 Git 项目管理与常用 Git 操作
- 本地 Markdown 文档目录浏览

当前项目采用「静态页面 + Node.js 本地服务」模式运行：

- 前端页面：`index.html` + `css/style.css` + `js/*.js`
- 本地服务：`server.js`
- 本地数据：`data/*.json`
- 文档扫描脚本：`scripts/gen-doc-tree.js`

这不是一个多用户系统，也不是云端服务，当前设计明显偏向“个人本地开发效率平台”。

## 2. 当前已实现功能

### 2.1 顶部操作区

页面顶部目前提供 4 个真实操作按钮：

- `新增项目`
- `管理项目`
- `管理工具`
- `配置路径`

它们分别对应 3 类配置弹窗：

- 项目配置弹窗
- 工具配置弹窗
- 文档路径配置弹窗

### 2.2 常用工具区

用于展示全局工具列表，用户点击后直接尝试拉起本地命令。

已支持能力：

- 从配置文件读取工具列表
- 页面渲染工具卡片
- 点击工具后按操作系统拼接执行协议
- 支持在界面内新增、编辑、删除工具
- 工具配置保存到 `data/tool-settings.json`

工具项核心字段：

- `id`
- `name`
- `icon`
- `command`
- `osProtocols`
- `fallback`

当前实际行为说明：

- 前端点击工具时，优先使用 `osProtocols`
- 若配置里没有协议，则由前端基于 `command` 自动生成协议
- macOS 目前主要走 `iterm2://open?...`

### 2.3 项目工作台

这是当前业务里最完整的一块，围绕本地 Git 仓库展开。

已支持能力：

- 读取项目配置并展示项目卡片
- 按 `workspace` 分组展示项目
- 展示 Git 运行时状态
- 支持搜索项目
- 支持打开项目终端
- 支持查看本地/远程分支
- 支持切换分支
- 支持执行 `commit`
- 支持执行 `push`
- 支持在界面中新增、编辑、删除项目配置

项目卡片展示的信息包括：

- 项目名称
- 项目说明
- 项目路径
- 当前分支
- 是否 clean
- 改动数量
- ahead / behind 状态
- upstream 信息

页面上的项目操作按钮包括：

- `打开终端`
- `切换分支`
- `Commit`
- `Push`

### 2.4 文档管理

用于浏览本地 Markdown 文档树。

已支持能力：

- 配置一个或多个根目录
- 扫描根目录下的 `.md` 文件
- 生成文档树清单
- 在页面展示可折叠目录树
- 支持按关键字搜索文档名称
- 点击文档后通过 `/api/doc` 打开原始 Markdown 内容

扫描规则：

- 忽略隐藏文件/目录
- 忽略 `node_modules`
- 只纳入 `.md` 文件
- 空目录不会进入最终树结构

## 3. 页面结构

页面主结构在 [index.html](/Users/hua/Developer/workspace/devTool/dt-platform/index.html)：

- Header
  - 标题、副标题
  - 顶部操作按钮
  - 工作台搜索栏
- `quick-tools-panel`
  - 全局工具列表
- `workspace-panel`
  - 项目工作台
- `doc-panel`
  - 文档搜索与文档树
- 多个模态框
  - 文档路径配置
  - 工具配置
  - 项目配置
  - 分支切换
  - Commit

## 4. 前端代码职责拆分

### 4.1 `js/config.js`

作用：

- 提供默认配置
- 兼容浏览器与 Node 环境导出

主要内容：

- 默认工具配置 `APP_CONFIG.tools`
- 默认文档配置 `APP_CONFIG.docs.rootPaths`

说明：

- 这份文件更像“默认初始值”
- 真正运行时优先读取 `data/*.json`

### 4.2 `js/tools.js`

作用：

- 读取工具配置
- 标准化工具数据
- 渲染工具卡片
- 执行工具启动逻辑

关键函数：

- `normalizeTool`
- `loadTools`
- `renderTools`
- `executeTool`
- `initTools`
- `refreshTools`

### 4.3 `js/docs.js`

作用：

- 加载文档树清单
- 渲染目录树
- 处理搜索过滤

关键函数：

- `loadDocManifest`
- `renderDocTree`
- `filterTreeData`
- `filterDocTree`
- `initDocTree`
- `refreshDocManifest`

### 4.4 `js/app.js`

作用：

- 页面主控制器
- 管理所有弹窗、表单草稿数据、事件绑定
- 调用后端 API
- 渲染项目工作台

主要状态变量：

- `docSettingsDraft`
- `toolSettingsDraft`
- `projectSettingsDraft`
- `projectRuntimeData`
- `activeBranchProjectId`
- `activeCommitProjectId`

关键职责：

- 文档设置弹窗管理
- 工具设置弹窗管理
- 项目设置弹窗管理
- 项目列表渲染
- 项目搜索
- 分支切换弹窗
- Commit 弹窗
- 页面初始化

## 5. 后端服务职责

后端主文件是 [server.js](/Users/hua/Developer/workspace/devTool/dt-platform/server.js)。

### 5.1 核心职责

- 提供静态资源服务
- 提供配置读写 API
- 提供文档访问 API
- 提供项目运行时信息 API
- 执行 Git 命令
- 调用脚本刷新文档清单

### 5.2 配置读写

涉及文件：

- `data/doc-settings.json`
- `data/tool-settings.json`
- `data/project-settings.json`

对应处理逻辑：

- `loadDocSettings` / `saveDocSettings`
- `loadToolSettings` / `saveToolSettings`
- `loadProjectSettings` / `saveProjectSettings`

### 5.3 项目运行时信息

后端会对每个项目执行 Git 命令，补充运行时状态：

- 当前分支
- upstream
- ahead
- behind
- 改动数量
- clean 状态

关键函数：

- `getProjectRuntime`
- `getProjectsWithRuntime`
- `parseGitStatus`

### 5.4 Git 操作能力

目前已接入的真实 Git 操作有：

- `git status --porcelain=v1 --branch`
- `git branch`
- `git branch -r`
- `git checkout`
- `git checkout --track`
- `git add -A`
- `git commit -m`
- `git push`

### 5.5 本地终端打开能力

当前仅实现了 macOS Terminal：

- 通过 `osascript` 打开 Terminal
- 自动 `cd` 到项目目录

这意味着：

- Windows / Linux 当前还没有真正完成项目终端能力
- 工具启动虽然有跨平台协议字段，但项目终端不是跨平台实现

## 6. API 清单

### 6.1 文档相关

- `GET /api/settings/docs`
  - 读取文档根路径配置
- `POST /api/settings/docs`
  - 保存文档根路径并重新生成 `doc-manifest.json`
- `GET /api/doc?path=...`
  - 读取指定 Markdown 文件内容

### 6.2 工具相关

- `GET /api/settings/tools`
  - 读取工具配置
- `POST /api/settings/tools`
  - 保存工具配置

### 6.3 项目相关

- `GET /api/projects`
  - 获取项目列表及 Git 运行时状态
- `GET /api/settings/projects`
  - 获取项目配置
- `POST /api/settings/projects`
  - 保存项目配置，并校验路径是 Git 仓库
- `GET /api/projects/branches?id=...`
  - 获取项目本地/远程分支
- `POST /api/projects/open-terminal`
  - 打开项目终端
- `POST /api/projects/checkout`
  - 切换分支
- `POST /api/projects/commit`
  - 执行 commit
- `POST /api/projects/push`
  - 执行 push

## 7. 数据文件说明

### 7.1 `data/doc-settings.json`

用途：

- 保存文档扫描根路径

当前示例：

- `/Users/hua/Developer/workspace`

### 7.2 `data/doc-manifest.json`

用途：

- 保存扫描后的 Markdown 树结构
- 供前端直接加载和渲染

特点：

- 属于派生数据
- 可以重新生成

### 7.3 `data/tool-settings.json`

用途：

- 保存实际生效的工具列表

说明：

- 若该文件不存在，系统会回退到 `js/config.js` 中的默认工具

### 7.4 `data/project-settings.json`

用途：

- 保存需要展示的项目配置

字段包括：

- `id`
- `name`
- `path`
- `workspace`
- `description`

## 8. 核心业务流程

### 8.1 页面初始化流程

页面加载后执行顺序：

1. `initTools()`
2. `initDocTree('doc-tree-container')`
3. `refreshProjects()`
4. 绑定所有弹窗和交互事件

### 8.2 配置变更流程

三类配置的基本模式一致：

1. 打开弹窗
2. 从后端拉取当前配置
3. 在前端维护 draft 草稿
4. 用户编辑后提交
5. 后端校验并写入 `data/*.json`
6. 前端刷新对应模块

### 8.3 文档更新流程

1. 用户修改文档根路径
2. 前端调用 `POST /api/settings/docs`
3. 后端保存 `doc-settings.json`
4. 后端调用 `generate(...)`
5. 生成新的 `doc-manifest.json`
6. 前端重新加载并渲染文档树

### 8.4 项目接入流程

1. 用户点击 `新增项目` 或 `管理项目`
2. 在弹窗内填写项目名、工作空间、路径、说明
3. 前端提交到 `POST /api/settings/projects`
4. 后端校验路径存在且是 Git 仓库
5. 保存到 `project-settings.json`
6. 前端刷新项目工作台
7. 页面实时展示该项目 Git 状态

## 9. 当前实现特点

### 9.1 优点

- 结构直观，容易继续加功能
- 前后端边界比较清晰
- 本地配置落盘，适合个人长期使用
- 项目工作台已经形成可闭环的日常操作链路

### 9.2 当前限制

- 没有账号体系、权限体系、多用户能力
- 没有数据库，全部依赖本地 JSON 文件
- 没有任务队列或异步状态管理
- Git 操作缺乏更细粒度校验和确认
- 项目终端能力当前仅支持 macOS
- 工具执行高度依赖本机协议环境
- 文档预览目前只是返回 Markdown 原文，不是富文本阅读体验
- 搜索只做了前端基础过滤，没有更复杂的筛选逻辑

## 10. 后续功能迭代建议

### 10.1 项目工作台方向

建议优先继续增强这一块，因为这是当前最成体系的主业务。

可选迭代：

- 增加 `Pull`
- 增加 `Fetch`
- 增加 `Stash`
- 增加 `Discard` / `Reset` 前的安全确认
- 展示最近 commit 历史
- 展示工作区文件改动明细
- 增加项目标签、收藏、排序
- 增加按状态筛选，例如 `clean` / `changed`

### 10.2 工具管理方向

可选迭代：

- 支持工具分组
- 支持自定义排序
- 支持工具说明和标签
- 支持区分“命令执行”和“打开 URL”
- 支持更可靠的跨平台执行方式

### 10.3 文档管理方向

可选迭代：

- Markdown 在线预览
- 文档收藏
- 最近打开文档
- 按目录/标签筛选
- 支持更多文档类型，如 `.txt`、`.pdf`

### 10.4 工程化方向

可选迭代：

- 抽离前端 API 层
- 将 `app.js` 继续拆分模块
- 增加统一错误提示组件，减少 `alert`
- 增加日志与操作审计
- 增加自动化测试
- 增加配置 schema 校验

## 11. 建议的后续文档补充

如果你后面准备持续迭代，建议再补 3 份文档：

- `FEATURE_ROADMAP.md`
  - 用来列功能优先级和阶段目标
- `API_CONTRACT.md`
  - 用来固定前后端接口格式
- `CHANGELOG.md`
  - 用来记录每次功能迭代和影响范围

## 12. 快速定位表

后续改功能时可以优先按下面方式找入口：

- 改页面结构：`index.html`
- 改页面样式：`css/style.css`
- 改工具区逻辑：`js/tools.js`
- 改文档树逻辑：`js/docs.js`
- 改弹窗/项目工作台逻辑：`js/app.js`
- 改接口/文件读写/Git 操作：`server.js`
- 改文档扫描规则：`scripts/gen-doc-tree.js`
- 改默认配置：`js/config.js`
- 改实际运行配置：`data/*.json`

