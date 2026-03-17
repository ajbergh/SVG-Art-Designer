/**
 * SVG Optimizer — DOM-based transformations to reduce file size.
 * Pure functions, no side effects.
 */

/** Remove XML comments */
function removeComments(svg: string): string {
  return svg.replace(/<!--[\s\S]*?-->/g, '');
}

/** Remove metadata, title, and desc elements (optional) */
function removeMetadata(svg: string): string {
  return svg.replace(/<metadata[\s\S]*?<\/metadata>/gi, '');
}

/** Round numeric values in attributes to the given precision */
function roundNumbers(svg: string, precision: number): string {
  // Match numeric values in attribute values (e.g. d="M 12.345678 23.456789")
  return svg.replace(/(\d+\.\d{3,})/g, (match) => {
    return parseFloat(match).toFixed(precision);
  });
}

/** Remove empty groups like <g></g> or <g> </g> */
function removeEmptyGroups(svg: string): string {
  // Iteratively remove empty groups (since nested empties may be revealed)
  let prev = '';
  let current = svg;
  while (prev !== current) {
    prev = current;
    current = current.replace(/<g[^>]*>\s*<\/g>/gi, '');
  }
  return current;
}

/** Collapse groups with a single child and no meaningful attributes */
function collapseSingleChildGroups(svg: string): string {
  // Match <g> with only an optional id attribute and a single child
  return svg.replace(/<g(?:\s+id="[^"]*")?\s*>\s*(<(?!g\b)[^]*?<\/[^>]+>)\s*<\/g>/gi, '$1');
}

/** Remove unnecessary whitespace between tags (preserves text content) */
function collapseWhitespace(svg: string): string {
  return svg
    .replace(/>\s+</g, '> <')
    .trim();
}

/** Remove default attribute values that browsers infer */
function removeDefaultAttributes(svg: string): string {
  return svg
    .replace(/\s+fill-opacity=["']1["']/gi, '')
    .replace(/\s+stroke-opacity=["']1["']/gi, '')
    .replace(/\s+opacity=["']1["']/gi, '')
    .replace(/\s+fill-rule=["']nonzero["']/gi, '')
    .replace(/\s+clip-rule=["']nonzero["']/gi, '');
}

export interface OptimizeOptions {
  removeComments?: boolean;
  removeMetadata?: boolean;
  roundPrecision?: number; // decimal places, 0 to disable
  removeEmptyGroups?: boolean;
  collapseSingleChildGroups?: boolean;
  collapseWhitespace?: boolean;
  removeDefaultAttributes?: boolean;
}

const defaultOptions: Required<OptimizeOptions> = {
  removeComments: true,
  removeMetadata: true,
  roundPrecision: 2,
  removeEmptyGroups: true,
  collapseSingleChildGroups: true,
  collapseWhitespace: true,
  removeDefaultAttributes: true,
};

export function optimizeSvg(svg: string, options?: OptimizeOptions): { svg: string; savings: number } {
  const opts = { ...defaultOptions, ...options };
  const originalSize = svg.length;
  let result = svg;

  if (opts.removeComments) result = removeComments(result);
  if (opts.removeMetadata) result = removeMetadata(result);
  if (opts.removeDefaultAttributes) result = removeDefaultAttributes(result);
  if (opts.removeEmptyGroups) result = removeEmptyGroups(result);
  if (opts.collapseSingleChildGroups) result = collapseSingleChildGroups(result);
  if (opts.roundPrecision > 0) result = roundNumbers(result, opts.roundPrecision);
  if (opts.collapseWhitespace) result = collapseWhitespace(result);

  const savings = originalSize > 0 ? Math.round(((originalSize - result.length) / originalSize) * 100) : 0;
  return { svg: result, savings };
}
