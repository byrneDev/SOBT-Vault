# SOBT ICW Developer Tools

SOBT ICW Developer Tools is an Electron-based platform that hosts utilities used to develop, build, and manage SOBT courseware tools.

The application provides a unified workspace where individual tools run inside the platform while using the platform’s Electron services for filesystem access, dialogs, and other system-level operations.

---

# Overview

The platform acts as a developer tool host, not a plugin installer.

Tools are included inside the repository and run inside the platform workspace.

Example tools include:

- VaultSCO Builder – Build CourseVault-ready SCO packages
- Future validation tools
- Courseware debugging utilities
- Developer workflow helpers

All tools run inside a shared interface and use the platform bridge for system access.

---

# Architecture

The system follows a host–tool architecture.

SOBT ICW Developer Tools
│
├ electron/      → Electron runtime (main process)
│
├ ui/            → Launcher UI and workspace
│
├ tools/         → Hosted developer tools
│   ├ tools.json
│   ├ sco-builder/
│   └ _template/
│
├ package.json
└ README.md

### Electron Host

The Electron host provides:

- File dialogs
- Filesystem access
- Secure IPC bridge
- Application menu
- Tool services

### UI Layer

The UI provides:

- Tool launcher
- Workspace iframe
- Shared styling
- Logging interface
- Status display

### Tools

Each tool is a small web application loaded inside the workspace.

Example structure:

tools/sco-builder/
   index.html
   style.css
   app.js
   core/
      buildEngine.js

Tools communicate with the host through the secure bridge exposed in preload.js.

---

# Tool Registry

Tools are registered in:

tools/tools.json

Example:

{
  "tools": [
    {
      "name": "VaultSCO Builder",
      "description": "Build CourseVault-ready SOBT SCO packages",
      "entry": "../tools/sco-builder/index.html",
      "icon": "",
      "category": "Builder"
    }
  ]
}

Adding a new tool requires:

1. Creating a folder inside tools/
2. Adding the tool entry to tools.json

---

# Tool Template

The _template directory provides a standard starting point for creating new tools.

tools/_template/
   index.html
   style.css
   app.js

To create a new tool:

1. Copy _template
2. Rename the folder
3. Add the tool entry to tools.json
4. Implement the tool logic

---

# Development

Install dependencies:

npm install

Run the platform:

npm start

---

# Build

Mac ARM:

npm run dist:mac:arm64

Windows ARM:

npm run dist:win:arm64

Windows x64:

npm run dist:win:x64

Build outputs will appear in the dist/ directory.

---

# Versioning

Versioning is controlled at the platform level through package.json.

Individual tools do not maintain independent versions. Tool changes are tracked through the repository commit history.

---

# Security

The platform enforces Electron security best practices:

- contextIsolation: true
- sandbox: true
- nodeIntegration: false

Tools interact with the system only through the secure IPC bridge provided by the host.

---

# License

Internal development utility for SOBT ICW tooling.
