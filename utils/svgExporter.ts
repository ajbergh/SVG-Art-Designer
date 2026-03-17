export type ExportFormat = 'svg' | 'png' | 'jpeg' | 'webp' | 'base64' | 'react';

export interface ExportOptions {
  scale: number; // 1, 2, or 4
  quality: number; // 0.1 to 1.0 (for jpeg/webp)
}

function ensureDimensions(svg: string): string {
  const hasWidth = /<svg[^>]*width=["']([^"']*)["']/i.test(svg);
  const hasHeight = /<svg[^>]*height=["']([^"']*)["']/i.test(svg);
  if (!hasWidth && !hasHeight) {
    const viewBoxMatch = svg.match(/viewBox=["']\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s*["']/i);
    if (viewBoxMatch) {
      svg = svg.replace(/<svg([^>]*)>/i, `<svg$1 width="${viewBoxMatch[3]}" height="${viewBoxMatch[4]}">`);
    } else {
      svg = svg.replace(/<svg([^>]*)>/i, `<svg$1 width="512" height="512">`);
    }
  }
  return svg;
}

function svgToCanvas(svgString: string, scale: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const svg = ensureDimensions(svgString);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = (img.width || 512) * scale;
      canvas.height = (img.height || 512) * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas context unavailable')); return; }
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to render SVG to image')); };
    img.src = url;
  });
}

function wrapAsReactComponent(svg: string): string {
  // Convert SVG attributes to JSX-compatible names
  let jsx = svg
    .replace(/class=/g, 'className=')
    .replace(/clip-path=/g, 'clipPath=')
    .replace(/fill-opacity=/g, 'fillOpacity=')
    .replace(/fill-rule=/g, 'fillRule=')
    .replace(/stroke-dasharray=/g, 'strokeDasharray=')
    .replace(/stroke-dashoffset=/g, 'strokeDashoffset=')
    .replace(/stroke-linecap=/g, 'strokeLinecap=')
    .replace(/stroke-linejoin=/g, 'strokeLinejoin=')
    .replace(/stroke-miterlimit=/g, 'strokeMiterlimit=')
    .replace(/stroke-opacity=/g, 'strokeOpacity=')
    .replace(/stroke-width=/g, 'strokeWidth=')
    .replace(/font-family=/g, 'fontFamily=')
    .replace(/font-size=/g, 'fontSize=')
    .replace(/font-weight=/g, 'fontWeight=')
    .replace(/text-anchor=/g, 'textAnchor=')
    .replace(/xmlns:xlink=/g, 'xmlnsXlink=');

  return `import React from 'react';

const SvgComponent: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  ${jsx.replace(/<svg/, '<svg {...props}')}
);

export default SvgComponent;
`;
}

export async function exportSvgAs(
  svgString: string,
  format: ExportFormat,
  options: ExportOptions = { scale: 1, quality: 0.92 }
): Promise<{ data: Blob | string; filename: string; mimeType: string }> {
  const timestamp = Date.now();

  if (format === 'svg') {
    return {
      data: new Blob([svgString], { type: 'image/svg+xml' }),
      filename: `design-${timestamp}.svg`,
      mimeType: 'image/svg+xml',
    };
  }

  if (format === 'base64') {
    return {
      data: btoa(unescape(encodeURIComponent(svgString))),
      filename: `design-${timestamp}.txt`,
      mimeType: 'text/plain',
    };
  }

  if (format === 'react') {
    return {
      data: wrapAsReactComponent(svgString),
      filename: `SvgComponent-${timestamp}.tsx`,
      mimeType: 'text/plain',
    };
  }

  // Raster formats (png, jpeg, webp)
  const canvas = await svgToCanvas(svgString, options.scale);
  const mimeType = `image/${format}`;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error('Failed to generate image')); return; }
        resolve({
          data: blob,
          filename: `design-${timestamp}@${options.scale}x.${format}`,
          mimeType,
        });
      },
      mimeType,
      format === 'png' ? undefined : options.quality
    );
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
