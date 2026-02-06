const STORAGE_KEY = 'mouser_profiles_v1';

const profileNameInput = document.getElementById('profileNameInput');
const profileList = document.getElementById('profileList');
const newProfileBtn = document.getElementById('newProfileBtn');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const deleteProfileBtn = document.getElementById('deleteProfileBtn');
const runProfileBtn = document.getElementById('runProfileBtn');

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
let profiles = [];
let selectedProfileId = null;

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

function getConfigFromForm() {
  return {
    x: Number(xInput.value),
    y: Number(yInput.value),
    interval: Number(intervalInput.value),
    key: keyInput.value.trim()
  };
}

function applyConfigToForm(config) {
  xInput.value = config.x;
  yInput.value = config.y;
  intervalInput.value = config.interval;
  keyInput.value = config.key || '';
}

function validateConfig(config) {
  if (!Number.isFinite(config.x) || !Number.isFinite(config.y)) {
    return 'X 和 Y 必须是有效数字。';
  }

  if (!Number.isFinite(config.interval) || config.interval < 10) {
    return '点击间隔必须至少为 10 毫秒。';
  }

  return '';
}

function getProfileById(id) {
  return profiles.find((item) => item.id === id) || null;
}

function persistProfiles() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

function createProfileFromForm(id) {
  const name = profileNameInput.value.trim();
  const config = getConfigFromForm();
  const validationError = validateConfig(config);

  if (!name) {
    return { error: '请先填写 Profile 名称。' };
  }

  if (validationError) {
    return { error: validationError };
  }

  return {
    profile: {
      id,
      name,
      x: Math.round(config.x),
      y: Math.round(config.y),
      interval: Math.round(config.interval),
      key: config.key,
      updatedAt: Date.now()
    }
  };
}

function renderProfiles() {
  profileList.innerHTML = '';

  if (!profiles.length) {
    const empty = document.createElement('li');
    empty.className = 'profile-item';
    empty.textContent = '暂无 Profile，填写参数后点击「保存/更新」。';
    profileList.appendChild(empty);
    return;
  }

  const sorted = [...profiles].sort((a, b) => b.updatedAt - a.updatedAt);

  for (const profile of sorted) {
    const item = document.createElement('li');
    item.className = 'profile-item';
    if (profile.id === selectedProfileId) {
      item.classList.add('active');
    }

    const name = document.createElement('p');
    name.className = 'profile-name';
    name.textContent = profile.name;

    const desc = document.createElement('p');
    desc.className = 'profile-desc';
    const keyDesc = profile.key ? profile.key : '无按键';
    desc.textContent = `X${profile.x} Y${profile.y} | ${profile.interval}ms | ${keyDesc}`;

    item.appendChild(name);
    item.appendChild(desc);

    item.addEventListener('click', () => {
      selectedProfileId = profile.id;
      profileNameInput.value = profile.name;
      applyConfigToForm(profile);
      renderProfiles();
      showError('');
      showPickInfo(`已选择 Profile：${profile.name}`);
      setStatus();
    });

    profileList.appendChild(item);
  }
}

function loadProfiles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      profiles = [];
      return;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      profiles = [];
      return;
    }

    profiles = parsed
      .filter((item) => item && typeof item.name === 'string')
      .map((item) => ({
        id: String(item.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
        name: String(item.name).slice(0, 40),
        x: Number(item.x) || 0,
        y: Number(item.y) || 0,
        interval: Math.max(10, Number(item.interval) || 100),
        key: typeof item.key === 'string' ? item.key : '',
        updatedAt: Number(item.updatedAt) || Date.now()
      }));
  } catch (_error) {
    profiles = [];
  }
}

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

  newProfileBtn.disabled = running || picking;
  saveProfileBtn.disabled = running || picking;
  deleteProfileBtn.disabled = running || picking || !selectedProfileId;
  runProfileBtn.disabled = running || picking || !selectedProfileId;
  profileNameInput.disabled = running || picking;
}

async function startAutomation(config) {
  const error = validateConfig(config);
  if (error) {
    showError(error);
    return;
  }

  try {
    await window.automation.start(config);
    running = true;
    picking = false;
    setStatus();
  } catch (startError) {
    running = false;
    setStatus();
    showError(startError?.message || '启动自动点击失败');
  }
}

newProfileBtn.addEventListener('click', () => {
  selectedProfileId = null;
  profileNameInput.value = '';
  showError('');
  showPickInfo('已切换到新建模式，填写名称后点击「保存/更新」。');
  renderProfiles();
  setStatus();
});

saveProfileBtn.addEventListener('click', () => {
  showError('');

  const targetId = selectedProfileId || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const result = createProfileFromForm(targetId);
  if (result.error) {
    showError(result.error);
    return;
  }

  const nextProfile = result.profile;
  const existingIndex = profiles.findIndex((item) => item.id === targetId);

  if (existingIndex >= 0) {
    profiles[existingIndex] = nextProfile;
  } else {
    profiles.push(nextProfile);
  }

  selectedProfileId = targetId;
  persistProfiles();
  renderProfiles();
  setStatus();
  showPickInfo(`Profile 已保存：${nextProfile.name}`);
});

deleteProfileBtn.addEventListener('click', () => {
  if (!selectedProfileId) {
    showError('请先选中要删除的 Profile。');
    return;
  }

  const target = getProfileById(selectedProfileId);
  profiles = profiles.filter((item) => item.id !== selectedProfileId);
  selectedProfileId = null;
  persistProfiles();
  renderProfiles();
  setStatus();
  showError('');
  showPickInfo(target ? `已删除 Profile：${target.name}` : '已删除 Profile。');
});

runProfileBtn.addEventListener('click', async () => {
  showError('');
  showPickInfo('');

  if (!selectedProfileId) {
    showError('请先选中一个 Profile。');
    return;
  }

  const target = getProfileById(selectedProfileId);
  if (!target) {
    showError('选中的 Profile 不存在。');
    return;
  }

  applyConfigToForm(target);
  profileNameInput.value = target.name;
  await startAutomation(target);
});

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

  await startAutomation(getConfigFromForm());
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
  } catch (_error) {
    // No action needed during unload cleanup.
  }

  if (!running) {
    return;
  }

  try {
    await window.automation.stop();
  } catch (_error) {
    // No action needed during unload cleanup.
  }
});

loadProfiles();
renderProfiles();
setStatus();
