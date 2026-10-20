import { applyThrottle, clearThrottle } from './throttler.js';
import { isUnchangedLegacySeed } from './rule-config.js';
import { setThrottleIcon } from './action-icon.js';

// Version 4 retires the built-in site presets. Rules are now created on demand.
const SEED_VERSION = 4;
const DEFAULT_SETTINGS = { limiterEnabled: true, strength: 100 };

async function getConfig() {
  const stored = await chrome.storage.sync.get(['rules', 'limiterEnabled', 'strength']);
  return {
    rules: (stored.rules || []).filter((r) => r.enabled !== false),
    limiterEnabled: stored.limiterEnabled !== false,
    defaultStrength: Math.min(100, Math.max(10, Number(stored.strength) || DEFAULT_SETTINGS.strength))
  };
}

export function matchRule(url, rules) {
  let host;
  try { host = new URL(url).hostname; } catch { return null; }
  return rules.find((r) => r.pattern && host.includes(r.pattern)) || null;
}

async function evaluateTab(tab) {
  if (!tab.id) return;
  if (!tab.url || !/^https?:/.test(tab.url)) {
    await setThrottleIcon(tab.id, false).catch(() => {});
    return;
  }
  const { rules, limiterEnabled, defaultStrength } = await getConfig();
  const rule = limiterEnabled ? matchRule(tab.url, rules) : null;
  if (!rule || (rule.onlyBackground && tab.active)) {
    await clearThrottle(tab.id).catch(() => {});
    await setThrottleIcon(tab.id, false).catch(() => {});
    return;
  }
  const strength = Math.min(100, Math.max(10, Number(rule.strength) || defaultStrength));
  try {
    await applyThrottle(tab.id, rule, strength);
    await setThrottleIcon(tab.id, true);
  } catch (error) {
    await setThrottleIcon(tab.id, false).catch(() => {});
    console.warn('throttle failed', tab.id, error.message);
  }
}

async function evaluateAllTabs() {
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(tabs.map(evaluateTab));
}

async function touch(tabId) {
  const { activity = {} } = await chrome.storage.session.get('activity');
  activity[tabId] = Date.now();
  await chrome.storage.session.set({ activity });
}

chrome.runtime.onInstalled.addListener(async () => {
  const { rules, seedVersion = 0, limiterEnabled, strength } = await chrome.storage.sync.get([
    'rules', 'seedVersion', 'limiterEnabled', 'strength'
  ]);
  const settings = {};
  if (limiterEnabled === undefined) settings.limiterEnabled = DEFAULT_SETTINGS.limiterEnabled;
  if (strength === undefined) settings.strength = DEFAULT_SETTINGS.strength;
  if (!rules) {
    settings.rules = [];
    settings.seedVersion = SEED_VERSION;
  } else if (seedVersion < SEED_VERSION) {
    // Remove only unchanged built-in presets. Customized and user-created rules
    // remain available, including their per-site strength values.
    settings.rules = rules.filter((rule) => !isUnchangedLegacySeed(rule));
    settings.seedVersion = SEED_VERSION;
  }
  if (Object.keys(settings).length) await chrome.storage.sync.set(settings);
  await evaluateAllTabs();
});
chrome.runtime.onStartup.addListener(evaluateAllTabs);
chrome.storage.onChanged.addListener((_c, area) => { if (area === 'sync') evaluateAllTabs(); });

chrome.tabs.onUpdated.addListener((_tabId, info, tab) => {
  if (info.status === 'loading' || info.url) evaluateTab(tab);
});
chrome.tabs.onCreated.addListener(evaluateTab);

chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  await touch(tabId);
  const { lastActive = {} } = await chrome.storage.session.get('lastActive');
  const prev = lastActive[windowId];
  lastActive[windowId] = tabId;
  await chrome.storage.session.set({ lastActive });
  for (const id of [tabId, prev].filter((x) => x && x !== -1)) {
    try { await evaluateTab(await chrome.tabs.get(id)); } catch { /* tab gone */ }
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { activity = {} } = await chrome.storage.session.get('activity');
  delete activity[tabId];
  await chrome.storage.session.set({ activity });
});

chrome.debugger.onDetach.addListener(({ tabId }) => {
  if (tabId) setThrottleIcon(tabId, false).catch(() => {});
});

chrome.alarms.create('discard-check', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'discard-check') return;
  const { rules: enabledRules, limiterEnabled } = await getConfig();
  if (!limiterEnabled) return;
  const rules = enabledRules.filter((r) => r.discardAfterMin > 0);
  if (!rules.length) return;
  const { activity = {} } = await chrome.storage.session.get('activity');
  const tabs = await chrome.tabs.query({ active: false, discarded: false, audible: false });
  for (const tab of tabs) {
    const rule = tab.url && matchRule(tab.url, rules);
    if (!rule) continue;
    const last = activity[tab.id];
    if (last === undefined) { await touch(tab.id); continue; }
    if (Date.now() - last > rule.discardAfterMin * 60000) {
      await clearThrottle(tab.id).catch(() => {});
      await setThrottleIcon(tab.id, false).catch(() => {});
      await chrome.tabs.discard(tab.id).catch(() => {});
    }
  }
});
