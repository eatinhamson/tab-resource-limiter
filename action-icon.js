const ICON_SIZES = [16, 32];
const COLORS = {
  active: '#188038',
  inactive: '#9aa0a6'
};

export function drawThrottleIcon(size, active) {
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext('2d');
  const scale = size / 16;

  context.clearRect(0, 0, size, size);
  context.fillStyle = active ? COLORS.active : COLORS.inactive;
  context.beginPath();
  context.arc(8 * scale, 8 * scale, 7 * scale, 0, Math.PI * 2);
  context.fill();

  // A small speedometer makes the state recognizable without relying on color.
  context.strokeStyle = '#ffffff';
  context.lineWidth = 1.5 * scale;
  context.lineCap = 'round';
  context.beginPath();
  context.arc(8 * scale, 9 * scale, 4 * scale, Math.PI, 0);
  context.stroke();
  context.beginPath();
  context.moveTo(8 * scale, 9 * scale);
  context.lineTo((active ? 11 : 9.5) * scale, (active ? 6.5 : 7) * scale);
  context.stroke();

  return context.getImageData(0, 0, size, size);
}

export async function setThrottleIcon(tabId, active) {
  if (!tabId) return;
  const imageData = Object.fromEntries(
    ICON_SIZES.map((size) => [size, drawThrottleIcon(size, active)])
  );
  await Promise.all([
    chrome.action.setIcon({ tabId, imageData }),
    chrome.action.setTitle({
      tabId,
      title: active ? 'Tab Resource Limiter — throttling active' : 'Tab Resource Limiter — not throttling'
    })
  ]);
}
