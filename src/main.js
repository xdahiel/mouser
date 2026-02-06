const path = require('path');
const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const { keyboard, mouse, Button, Point, Key } = require('@nut-tree-fork/nut-js');

let mainWindow;
let clickTimer = null;
let pickTimer = null;
let pickMode = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 920,
    height: 680,
    minWidth: 760,
    minHeight: 560,
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

ipcMain.handle('automation:start', async (_event, config) => {
  if (clickTimer) {
    clearInterval(clickTimer);
    clickTimer = null;
  }

  await stopPickMode('cancelled');

  const sanitized = {
    x: Number.isFinite(config?.x) ? Math.round(config.x) : 0,
    y: Number.isFinite(config?.y) ? Math.round(config.y) : 0,
    interval: Number.isFinite(config?.interval) ? Math.max(10, Math.round(config.interval)) : 100,
    key: typeof config?.key === 'string' ? config.key : ''
  };

  await performAction(sanitized);

  clickTimer = setInterval(async () => {
    try {
      await performAction(sanitized);
    } catch (error) {
      sendToRenderer('automation:error', error.message || 'Automation failed');
    }
  }, sanitized.interval);

  return { running: true };
});

ipcMain.handle('automation:stop', async () => {
  if (clickTimer) {
    clearInterval(clickTimer);
    clickTimer = null;
  }
  return { running: false };
});

app.whenReady().then(() => {
  createWindow();

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
