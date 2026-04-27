# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
**devTool** is a local development platform with a static web interface and Node.js backend, designed for personal efficiency tools, project workspace management, and document browsing. It's a single-user local system, not a multi-user cloud service.

## Commands
- **Run the project**: `node server.js` (from `dt-platform/` directory)
- **Default port**: 3000 (configurable in `server.js`)

## Architecture
Static HTML/JS frontend + Node.js HTTP server backend. Frontend uses vanilla JS (no framework), backend uses `express` + `node-static` + `child_process` for Git operations. Data persists via JSON files in `data/` directory.

## Key Files & Responsibilities

### Backend (dt-platform/server.js)
- **HTTP server**: Serves static files and provides API endpoints
- **API endpoints**:
  - `GET /api/projects` - List projects with runtime status
  - `GET /api/tools` - Get tool list
  - `GET /api/docs` - Get document tree
  - `POST /api/config` - Read configuration
  - `POST /api/config/save` - Save configuration
  - `POST /api/git/*` - Git operations (status/branch/checkout/add/commit/push)
  - `POST /api/terminal` - Open macOS terminal
  - `POST /api/ai-commit` - AI-generate commit message

### Frontend (dt-platform/index.html + js/*.js)
- **index.html**: Main page structure (header, tools panel, workspace panel, docs panel, modals)
- **js/app.js**: Main controller - manages modals, project operations (open, add, remove), terminal opening, Git UI integration
- **js/tools.js**: Tool list management and execution - renders tools, handles launch, adds new tools
- **js/docs.js**: Document browser - scans root paths, renders hierarchical tree, opens MD files
- **js/config.js**: Default configurations (tools list, doc root paths) - initial values for settings modal

### Data Layer (dt-platform/data/)
- **project-settings.json**: Project configurations (name, path, runtime)
- **tool-settings.json**: Tool configurations (name, command, desc, category)
- **doc-settings.json**: Root paths for document scanning
- **doc-manifest.json**: Scanned document metadata (name, path, folder)

## Data Flow
1. Frontend calls `postApi()` to backend API endpoints
2. Backend reads/writes JSON files in `data/` directory
3. Git operations use `child_process.exec()` with project-specific cwd
4. Terminal opens via macOS `iterm2://` protocol

## Main Features
- **Tools Launcher**: Quick launch common commands (e.g., `open-webui serve`)
- **Project Workspace**: Git operations (status, branch, checkout, add, commit, push) with AI commit message generation
- **Document Browser**: Hierarchical document organization with search

## Code Style
- No comments unless the WHY is non-obvious
- Component-based JS organization by responsibility
- macOS-specific terminal integration (iterm2:// protocol via `osascript`)
