const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');

const fs = require('fs');

const { buildSco } = require('../tools/sco-builder/core/buildEngine');

let mainWindow;
let splashWindow;

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    backgroundColor: '#0b0f14'
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Vault App',
    show: false,
    icon: path.join(__dirname, '../ui/assets/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      enableRemoteModule: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../ui/index.html'));

  // Always open DevTools in development mode
  mainWindow.webContents.openDevTools();

  // Show main window once ready and close splash
  mainWindow.once('ready-to-show', () => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
  });
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'reload' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About SOBT ICW Developer Tools',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              icon: path.join(__dirname, '../ui/assets/logo.png'),
              title: 'About SOBT ICW Developer Tools',
              message: 'SOBT ICW Developer Tools',
              detail: `Version ${app.getVersion()}\n\nDeveloper utilities for building and managing SOBT courseware.\n\nSTRIKE Lab`,
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/* =========================================
   SCO BUILDER SERVICES
========================================= */

ipcMain.handle('vault:select-zip', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select Slide ZIP',
    properties: ['openFile'],
    filters: [{ name: 'ZIP Files', extensions: ['zip'] }]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { cancelled: true };
  }

  return { path: result.filePaths[0] };
});

ipcMain.handle('vault:build-sco', async (event, { zipPath, title }) => {
  const save = await dialog.showSaveDialog({
    title: 'Save SCO Package',
    defaultPath: `${title || 'course'}.zip`
  });

  if (save.canceled) return { cancelled: true };

  try {
    const tempDir = path.join(app.getPath('temp'), 'sco-builder');

    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    buildSco(zipPath, save.filePath, title || 'Course', tempDir);

    return { success: true };
  } catch (err) {
    console.error('SCO build failed', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('vault:clear-uploads', async () => {
  const tempDir = path.join(app.getPath('temp'), 'sco-builder');

  try {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('vault:get-version', async () => {
  return app.getVersion();
});

ipcMain.handle('vault:show-about', async () => {
  dialog.showMessageBox({
    type: 'info',
    icon: path.join(__dirname, '../ui/assets/logo.png'),
    title: 'About SOBT ICW Developer Tools',
    message: 'SOBT ICW Developer Tools',
    detail: `Version ${app.getVersion()}\nSTRIKE Lab`
  });
});

ipcMain.handle('vault:toggle-devtools', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.webContents.toggleDevTools();
  }
  return { success: true };
});

app.whenReady().then(async () => {
  createSplash();
  createMainWindow();
  buildMenu();

  const chokidar = (await import('chokidar')).default;

  // Hot reload watcher for tools during development
  const toolsPath = path.join(__dirname, '../tools');

  const watcher = chokidar.watch(toolsPath, {
    ignored: /(^|[\/\\])\../,
    persistent: true
  });

  watcher.on('change', (filePath) => {
    const win = BrowserWindow.getAllWindows()[0];

    if (win) {
      win.webContents.send('vault:tool-updated', filePath);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
