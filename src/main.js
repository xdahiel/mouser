const path = require('path');
const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const { keyboard, mouse, Button, Point, Key } = require('@nut-tree-fork/nut-js');

let mainWindow;
let clickTimer = null;
let pickTimer = null;
let pickMode = false;
let lastConfig = {
  x: 600,
  y: 400,
  interval: 200,
  key: ''
};

const START_SHORTCUT = 'CommandOrControl+Alt+W';
const STOP_SHORTCUT = 'CommandOrControl+Alt+E';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 920,
    height: 680,
    minWidth: 980,
    minHeight: 700,
    backgroundColor: '#f3f8ff',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function sanitizeConfig(config) {
  return {
    x: Number.isFinite(config?.x) ? Math.round(config.x) : 0,
    y: Number.isFinite(config?.y) ? Math.round(config.y) : 0,
    interval: Number.isFinite(config?.interval) ? Math.max(10, Math.round(config.interval)) : 100,
    key: typeof config?.key === 'string' ? config.key : ''
  };
}

function normalizeKey(raw) {
  if (!raw || typeof raw !== 'string') {
    return null;
  }

  const value = raw.trim();
  if (!value) {
    return null;
  }

  const upper = value.toUpperCase();

  if (upper.length === 1 && upper >= 'A' && upper <= 'Z') {
    return Key[upper];
  }

  if (/^F([1-9]|1[0-2])$/.test(upper)) {
    return Key[upper];
  }

  const aliases = {
    ENTER: Key.Enter,
    RETURN: Key.Enter,
    ESC: Key.Escape,
    ESCAPE: Key.Escape,
    SPACE: Key.Space,
    TAB: Key.Tab,
    SHIFT: Key.LeftShift,
    CTRL: Key.LeftControl,
    CONTROL: Key.LeftControl,
    ALT: Key.LeftAlt,
    CMD: Key.LeftSuper,
    COMMAND: Key.LeftSuper,
    UP: Key.Up,
    DOWN: Key.Down,
    LEFT: Key.Left,
    RIGHT: Key.Right,
    BACKSPACE: Key.Backspace,
    DELETE: Key.Delete
  };

  if (aliases[upper]) {
    return aliases[upper];
  }

  if (upper.length === 1 && /[0-9]/.test(upper)) {
    return Key[`Num${upper}`];
  }

  return null;
}

async function performAction(config) {
  const { x, y, key } = config;

  await mouse.setPosition(new Point(x, y));
  await mouse.click(Button.LEFT);

  const parsedKey = normalizeKey(key);
  if (parsedKey) {
    await keyboard.type(parsedKey);
  }
}

async function stopAutomation(source = 'manual') {
  if (clickTimer) {
    clearInterval(clickTimer);
    clickTimer = null;
  }

  sendToRenderer('automation:running-changed', { running: false, source });
  return { running: false };
}

async function startAutomation(config, source = 'manual') {
  if (clickTimer) {
    clearInterval(clickTimer);
    clickTimer = null;
  }

  await stopPickMode('cancelled');

  const sanitized = sanitizeConfig(config);
  lastConfig = sanitized;

  await performAction(sanitized);

  clickTimer = setInterval(async () => {
    try {
      await performAction(sanitized);
    } catch (error) {
      sendToRenderer('automation:error', error.message || 'Automation failed');
      await stopAutomation('error');
    }
  }, sanitized.interval);

  sendToRenderer('automation:running-changed', { running: true, source });
  return { running: true };
}

function registerGlobalShortcuts() {
  const startRegistered = globalShortcut.register(START_SHORTCUT, async () => {
    try {
      await startAutomation(lastConfig, 'hotkey');
    } catch (error) {
      sendToRenderer('automation:error', error.message || '通过快捷键启动失败');
    }
  });

  const stopRegistered = globalShortcut.register(STOP_SHORTCUT, async () => {
    try {
      await stopAutomation('hotkey');
    } catch (error) {
      sendToRenderer('automation:error', error.message || '通过快捷键停止失败');
    }
  });

  if (!startRegistered || !stopRegistered) {
    sendToRenderer(
      'automation:error',
      `全局快捷键注册失败。请检查是否与其他应用冲突：${START_SHORTCUT} / ${STOP_SHORTCUT}`
    );
  }
}

async function stopPickMode(reason = 'cancelled', position = null) {
  if (pickTimer) {
    clearInterval(pickTimer);
    pickTimer = null;
  }

  globalShortcut.unregister('Enter');
  globalShortcut.unregister('Escape');

  if (!pickMode) {
    return { pickMode: false };
  }

  pickMode = false;
  sendToRenderer('automation:pick-mode-ended', { reason, position });
  return { pickMode: false };
}

async function startPickMode() {
  if (pickMode) {
    return { pickMode: true };
  }

  pickMode = true;

  const emitPosition = async () => {
    const pos = await mouse.getPosition();
    sendToRenderer('automation:pick-position', { x: pos.x, y: pos.y });
    return pos;
  };

  await emitPosition();

  pickTimer = setInterval(async () => {
    try {
      await emitPosition();
    } catch (error) {
      await stopPickMode('error');
      sendToRenderer('automation:error', error.message || 'Failed to track cursor position');
    }
  }, 50);

  const enterRegistered = globalShortcut.register('Enter', async () => {
    try {
      const pos = await mouse.getPosition();
      await stopPickMode('picked', { x: pos.x, y: pos.y });
    } catch (error) {
      await stopPickMode('error');
      sendToRenderer('automation:error', error.message || 'Failed to capture picked position');
    }
  });

  const escapeRegistered = globalShortcut.register('Escape', async () => {
    await stopPickMode('cancelled');
  });

  if (!enterRegistered || !escapeRegistered) {
    await stopPickMode('error');
    throw new Error('Unable to register Enter/Escape shortcuts for pick mode. Close conflicting apps and retry.');
  }

  return { pickMode: true };
}

ipcMain.handle('automation:capture-position', async () => {
  const pos = await mouse.getPosition();
  return { x: pos.x, y: pos.y };
});

ipcMain.handle('automation:start-pick-mode', async () => startPickMode());
ipcMain.handle('automation:stop-pick-mode', async () => stopPickMode('cancelled'));
ipcMain.handle('automation:update-last-config', async (_event, config) => {
  lastConfig = sanitizeConfig(config);
  return { ok: true };
});

ipcMain.handle('automation:start', async (_event, config) => {
  return startAutomation(config, 'manual');
});

ipcMain.handle('automation:stop', async () => stopAutomation('manual'));

app.whenReady().then(() => {
  createWindow();
  registerGlobalShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  if (clickTimer) {
    clearInterval(clickTimer);
    clickTimer = null;
  }

  if (pickTimer) {
    clearInterval(pickTimer);
    pickTimer = null;
  }

  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
