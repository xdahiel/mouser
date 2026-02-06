const xInput = document.getElementById('xInput');
const yInput = document.getElementById('yInput');
const intervalInput = document.getElementById('intervalInput');
const keyInput = document.getElementById('keyInput');

const captureBtn = document.getElementById('captureBtn');
const pickBtn = document.getElementById('pickBtn');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');

const statusPill = document.getElementById('statusPill');
const pickInfo = document.getElementById('pickInfo');
const errorBox = document.getElementById('errorBox');

let running = false;
let picking = false;

function setStatus() {
  if (running) {
    statusPill.classList.remove('idle', 'picking');
    statusPill.classList.add('running');
    statusPill.textContent = '运行中';
  } else if (picking) {
    statusPill.classList.remove('idle', 'running');
    statusPill.classList.add('picking');
    statusPill.textContent = '拾取中';
  } else {
    statusPill.classList.remove('running', 'picking');
    statusPill.classList.add('idle');
    statusPill.textContent = '空闲';
  }

  startBtn.disabled = running || picking;
  stopBtn.disabled = !running;
  captureBtn.disabled = running || picking;
  pickBtn.disabled = running;
  pickBtn.textContent = picking ? '取消拾取模式（Esc）' : '拾取模式（回车确认）';
}

function showPickInfo(message) {
  if (!message) {
    pickInfo.hidden = true;
    pickInfo.textContent = '';
    return;
  }

  pickInfo.hidden = false;
  pickInfo.textContent = message;
}

function showError(message) {
  if (!message) {
    errorBox.hidden = true;
    errorBox.textContent = '';
    return;
  }

  errorBox.hidden = false;
  errorBox.textContent = message;
}

function getConfig() {
  return {
    x: Number(xInput.value),
    y: Number(yInput.value),
    interval: Number(intervalInput.value),
    key: keyInput.value
  };
}

captureBtn.addEventListener('click', async () => {
  showError('');
  try {
    const pos = await window.automation.capturePosition();
    xInput.value = pos.x;
    yInput.value = pos.y;
  } catch (error) {
    showError(error?.message || '读取鼠标坐标失败');
  }
});

pickBtn.addEventListener('click', async () => {
  showError('');

  if (picking) {
    try {
      await window.automation.stopPickMode();
    } catch (error) {
      showError(error?.message || '取消拾取模式失败');
    }
    return;
  }

  try {
    await window.automation.startPickMode();
    picking = true;
    showPickInfo('请把鼠标移动到目标位置，然后按回车确认。按 Esc 可取消。');
    setStatus();
  } catch (error) {
    showError(error?.message || '启动拾取模式失败');
  }
});

startBtn.addEventListener('click', async () => {
  showError('');
  showPickInfo('');

  const config = getConfig();
  if (!Number.isFinite(config.x) || !Number.isFinite(config.y)) {
    showError('X 和 Y 必须是有效数字。');
    return;
  }

  if (!Number.isFinite(config.interval) || config.interval < 10) {
    showError('点击间隔必须至少为 10 毫秒。');
    return;
  }

  try {
    await window.automation.start(config);
    running = true;
    picking = false;
    setStatus();
  } catch (error) {
    running = false;
    setStatus();
    showError(error?.message || '启动自动点击失败');
  }
});

stopBtn.addEventListener('click', async () => {
  showError('');
  try {
    await window.automation.stop();
    running = false;
    setStatus();
  } catch (error) {
    showError(error?.message || '停止自动点击失败');
  }
});

window.automation.onPickPosition((position) => {
  if (!picking || !position) {
    return;
  }

  xInput.value = position.x;
  yInput.value = position.y;
  showPickInfo(`实时坐标：X ${position.x}, Y ${position.y}。按回车确认。`);
});

window.automation.onPickModeEnded((payload) => {
  picking = false;
  setStatus();

  if (!payload) {
    showPickInfo('');
    return;
  }

  if (payload.reason === 'picked' && payload.position) {
    xInput.value = payload.position.x;
    yInput.value = payload.position.y;
    showPickInfo(`已锁定坐标：X ${payload.position.x}, Y ${payload.position.y}。`);
    return;
  }

  if (payload.reason === 'cancelled') {
    showPickInfo('已取消拾取模式。');
    return;
  }

  showPickInfo('拾取模式因异常中止。');
});

window.automation.onError((message) => {
  showError(message || '发生未知错误');
  running = false;
  setStatus();
});

window.addEventListener('beforeunload', async () => {
  try {
    await window.automation.stopPickMode();
  } catch (error) {
    // No action needed during unload cleanup.
  }

  if (!running) {
    return;
  }

  try {
    await window.automation.stop();
  } catch (error) {
    // No action needed during unload cleanup.
  }
});

setStatus();
