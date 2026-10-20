export const LEGACY_SEED_RULES = [
  { pattern: 'spotify.com', cpuRate: 6, network: '500kbps', discardAfterMin: 0, onlyBackground: false },
  { pattern: 'teams.microsoft.com', cpuRate: 6, network: '500kbps', discardAfterMin: 0, onlyBackground: true },
  { pattern: 'outlook.cloud.microsoft', cpuRate: 6, network: '500kbps', discardAfterMin: 15, onlyBackground: true },
  { pattern: 'outlook.office.com', cpuRate: 6, network: '500kbps', discardAfterMin: 15, onlyBackground: true },
  { pattern: 'outlook.live.com', cpuRate: 6, network: '500kbps', discardAfterMin: 15, onlyBackground: true }
];

export function isUnchangedLegacySeed(rule) {
  const seed = LEGACY_SEED_RULES.find((candidate) => candidate.pattern === rule.pattern);
  return Boolean(seed) &&
    rule.strength === undefined &&
    seed.cpuRate === rule.cpuRate &&
    seed.network === rule.network &&
    seed.discardAfterMin === rule.discardAfterMin &&
    seed.onlyBackground === rule.onlyBackground;
}
