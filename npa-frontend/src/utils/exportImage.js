// Minimal PNG export for dashboard composed of SVG charts.
// It stacks found SVG elements vertically with padding and a title.

export async function exportDashboardPng(containerEl, filename = 'dashboard.png', title = 'Node.js Performance Analyzer') {
  if (!containerEl) return;
  const svgs = containerEl.querySelectorAll('svg');
  if (!svgs.length) return;

  const padding = 24;
  const gap = 16;
  const width = Math.max(...Array.from(svgs).map(s => s.clientWidth || 800)) + padding * 2;

  // Compute total height: title + all svgs + gaps
  let height = padding * 2 + 32; // title space
  Array.from(svgs).forEach(s => { height += (s.clientHeight || 240) + gap; });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--surface-2') || '#1e2a44';
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text') || '#e5e7eb';
  ctx.font = '600 20px Inter, system-ui, sans-serif';
  ctx.fillText(title, padding, padding + 20);

  // Helper to convert inline SVG to data URL
  const svgToDataUrl = (svg) => {
    const xml = new XMLSerializer().serializeToString(svg);
    const svg64 = btoa(unescape(encodeURIComponent(xml)));
    return `data:image/svg+xml;base64,${svg64}`;
  };

  let y = padding + 32 + gap;
  for (const svg of svgs) {
    const dataUrl = svgToDataUrl(svg);
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const targetW = width - padding * 2;
        const scale = targetW / img.width;
        const targetH = img.height * scale;
        ctx.drawImage(img, padding, y, targetW, targetH);
        y += targetH + gap;
        resolve();
      };
      img.src = dataUrl;
    });
  }

  const a = document.createElement('a');
  a.download = filename;
  a.href = canvas.toDataURL('image/png');
  a.click();
}

