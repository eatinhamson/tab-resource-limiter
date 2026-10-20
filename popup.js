const DEFAULT_RULE = { cpuRate: 3, network: '1mbps', discardAfterMin: 0, onlyBackground: false, enabled: true };
const DEFAULT_STRENGTH = 100;

const master = document.getElementById('master');
const strength = document.getElementById('strength');
const strengthValue = document.getElementById('strengthValue');
const strengthControl = document.getElementById('strengthControl');

function normalizeStrength(value) {
  return Math.min(100, Math.max(10, Number(value) || DEFAULT_STRENGTH));
}

function renderMasterControl(enabled) {
  master.checked = enabled;
}

function renderStrengthControl(enabled, value) {
  value = normalizeStrength(value);
  strengthControl.hidden = false;
  strength.value = value;
  strength.disabled = !enabled;
  strengthValue.textContent = `${value}%`;
  strengthControl.classList.toggle('disabled', !enabled);
}

master.onchange = async () => {
  renderMasterControl(master.checked);
  if (!strengthControl.hidden) renderStrengthControl(master.checked, strength.value);
  await chrome.storage.sync.set({ limiterEnabled: master.checked });
};

strength.oninput = () => {
  strengthValue.textContent = `${strength.value}%`;
};

async function currentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function describe(rule) {
  const parts = [`CPU ÷${rule.cpuRate}`];
  if (rule.network && rule.network !== 'none') parts.push(`net ${rule.network}`);
  if (rule.discardAfterMin > 0) parts.push(`discard after ${rule.discardAfterMin}m`);
  if (rule.onlyBackground) parts.push('background only');
  return parts.join(' · ');
}

async function render() {
  const tab = await currentTab();
  const hostEl = document.getElementById('host');
  const statusEl = document.getElementById('status');
  const btn = document.getElementById('toggle');
  const stored = await chrome.storage.sync.get(['rules', 'limiterEnabled', 'strength']);
  const rules = stored.rules || [];
  const limiterEnabled = stored.limiterEnabled !== false;
  renderMasterControl(limiterEnabled);
  let host = null;
  try { host = new URL(tab.url).hostname; } catch { /* chrome:// etc. */ }
  if (!host || !/^https?:/.test(tab.url)) {
    hostEl.textContent = 'This page cannot be throttled.';
    return;
  }
  hostEl.textContent = host;
  const idx = rules.findIndex((r) => r.pattern && host.includes(r.pattern));
  btn.hidden = false;
  if (idx >= 0) {
    const rule = rules[idx];
    renderStrengthControl(limiterEnabled, rule.strength || stored.strength);
    strength.onchange = async () => {
      rules[idx] = { ...rules[idx], strength: normalizeStrength(strength.value) };
      await chrome.storage.sync.set({ rules });
    };
    statusEl.textContent = `Rule "${rule.pattern}": ${describe(rule)}` +
      (rule.enabled === false ? ' (disabled)' : '');
    btn.textContent = 'Remove rule for this site';
    btn.onclick = async () => {
      rules.splice(idx, 1);
      await chrome.storage.sync.set({ rules });
      render();
    };
  } else {
    strengthControl.hidden = true;
    strength.onchange = null;
    statusEl.textContent = 'No rule for this site.';
    btn.textContent = 'Throttle this site';
    btn.onclick = async () => {
      rules.push({
        pattern: host.replace(/^www\./, ''),
        ...DEFAULT_RULE,
        strength: normalizeStrength(stored.strength)
      });
      await chrome.storage.sync.set({ rules });
      render();
    };
  }
}

document.getElementById('options').onclick = (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
};
render();
