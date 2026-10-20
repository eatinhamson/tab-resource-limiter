// Throttling via the Chrome DevTools Protocol (same mechanism DevTools uses).
// Throughput values are bytes/second; latency is ms.
export const NETWORK_PROFILES = {
  none: null,
  '10mbps': { latency: 20, downloadThroughput: 1310720, uploadThroughput: 655360 },
  '1mbps': { latency: 100, downloadThroughput: 131072, uploadThroughput: 65536 },
  '500kbps': { latency: 200, downloadThroughput: 65536, uploadThroughput: 32768 },
  '400kbps': { latency: 400, downloadThroughput: 51200, uploadThroughput: 51200 }
};

const PROTOCOL_VERSION = '1.3';

function send(tabId, method, params) {
  return chrome.debugger.sendCommand({ tabId }, method, params);
}

export function scaleRule(rule, strength = 100) {
  const normalizedStrength = Math.min(100, Math.max(10, Number(strength) || 100));
  const ratio = normalizedStrength / 100;
  const baseCpuRate = Math.max(1, Number(rule.cpuRate) || 1);
  const profile = NETWORK_PROFILES[rule.network] || null;
  return {
    cpuRate: 1 + (baseCpuRate - 1) * ratio,
    networkProfile: profile ? {
      ...profile,
      downloadThroughput: Math.round(profile.downloadThroughput / ratio),
      uploadThroughput: Math.round(profile.uploadThroughput / ratio),
      latency: Math.round(profile.latency * ratio)
    } : null
  };
}

export async function isAttached(tabId) {
  const targets = await chrome.debugger.getTargets();
  return targets.some((t) => t.tabId === tabId && t.attached);
}

export async function applyThrottle(tabId, rule, strength = 100) {
  if (!(await isAttached(tabId))) {
    await chrome.debugger.attach({ tabId }, PROTOCOL_VERSION);
  }
  const { cpuRate, networkProfile: profile } = scaleRule(rule, strength);
  await send(tabId, 'Emulation.setCPUThrottlingRate', { rate: cpuRate });
  if (profile) {
    await send(tabId, 'Network.enable');
    await send(tabId, 'Network.emulateNetworkConditions', { offline: false, ...profile });
  } else {
    await send(tabId, 'Network.emulateNetworkConditions', {
      offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1
    });
  }
}

export async function clearThrottle(tabId) {
  if (!(await isAttached(tabId))) return;
  try {
    await send(tabId, 'Emulation.setCPUThrottlingRate', { rate: 1 });
    await send(tabId, 'Network.emulateNetworkConditions', {
      offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1
    });
  } finally {
    await chrome.debugger.detach({ tabId }).catch(() => {});
  }
}
