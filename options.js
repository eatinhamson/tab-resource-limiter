const NETWORKS = ['none', '10mbps', '1mbps', '500kbps', '400kbps'];

function normalizeStrength(value, fallback = 100) {
  return Math.min(100, Math.max(10, Number(value) || fallback));
}

function rowHtml(rule, defaultStrength = 100) {
  const tr = document.createElement('tr');
  tr.dataset.strength = normalizeStrength(rule.strength, defaultStrength);
  const netOptions = NETWORKS.map(
    (n) => `<option value="${n}" ${rule.network === n ? 'selected' : ''}>${n}</option>`
  ).join('');
  tr.innerHTML = `
    <td><input type="checkbox" class="enabled" ${rule.enabled !== false ? 'checked' : ''}></td>
    <td><input type="text" class="pattern" value="${rule.pattern || ''}" placeholder="spotify.com"></td>
    <td><input type="number" class="cpuRate" min="1" max="20" value="${rule.cpuRate || 1}"></td>
    <td><select class="network">${netOptions}</select></td>
    <td><input type="number" class="discardAfterMin" min="0" value="${rule.discardAfterMin || 0}"></td>
    <td><input type="checkbox" class="onlyBackground" ${rule.onlyBackground ? 'checked' : ''}></td>
    <td><button class="del">✕</button></td>`;
  tr.querySelector('.del').onclick = () => tr.remove();
  return tr;
}

async function load() {
  const { rules = [], strength } = await chrome.storage.sync.get(['rules', 'strength']);
  const defaultStrength = normalizeStrength(strength);
  const tbody = document.getElementById('rows');
  tbody.textContent = '';
  for (const rule of rules) tbody.appendChild(rowHtml(rule, defaultStrength));
}

document.getElementById('add').onclick = () => {
  document.getElementById('rows').appendChild(
    rowHtml({ pattern: '', cpuRate: 3, network: '1mbps', discardAfterMin: 0, onlyBackground: false, enabled: true })
  );
};

document.getElementById('save').onclick = async () => {
  const rules = [...document.querySelectorAll('#rows tr')]
    .map((tr) => ({
      enabled: tr.querySelector('.enabled').checked,
      pattern: tr.querySelector('.pattern').value.trim(),
      cpuRate: Math.max(1, Number(tr.querySelector('.cpuRate').value) || 1),
      strength: Number(tr.dataset.strength),
      network: tr.querySelector('.network').value,
      discardAfterMin: Math.max(0, Number(tr.querySelector('.discardAfterMin').value) || 0),
      onlyBackground: tr.querySelector('.onlyBackground').checked
    }))
    .filter((r) => r.pattern);
  await chrome.storage.sync.set({ rules });
  const saved = document.getElementById('saved');
  saved.textContent = 'Saved';
  setTimeout(() => { saved.textContent = ''; }, 1500);
};

load();
