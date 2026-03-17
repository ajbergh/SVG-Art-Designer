import DOMPurify from 'dompurify';

// SVG-specific DOMPurify configuration
const SVG_PURIFY_CONFIG: DOMPurify.Config = {
  USE_PROFILES: { svg: true, svgFilters: true },
  ADD_TAGS: ['use', 'animate', 'animateTransform', 'animateMotion', 'set'],
  ADD_ATTR: [
    'viewBox', 'xmlns', 'xmlns:xlink', 'fill', 'stroke', 'stroke-width',
    'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset',
    'opacity', 'transform', 'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y',
    'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points', 'offset',
    'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform',
    'patternUnits', 'patternTransform', 'filterUnits', 'primitiveUnits',
    'stdDeviation', 'in', 'in2', 'result', 'mode', 'values',
    'dur', 'begin', 'end', 'repeatCount', 'attributeName', 'from', 'to',
    'keyTimes', 'keySplines', 'calcMode', 'type', 'additive', 'accumulate',
    'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline',
    'clip-path', 'mask', 'marker-start', 'marker-mid', 'marker-end',
    'preserveAspectRatio', 'overflow', 'color', 'fill-rule', 'clip-rule',
    'fill-opacity', 'stroke-opacity', 'vector-effect', 'letter-spacing',
    'text-decoration', 'word-spacing', 'writing-mode', 'glyph-orientation-vertical',
    'dx', 'dy', 'rotate', 'textLength', 'lengthAdjust',
    'spreadMethod', 'fx', 'fy', 'fr',
    'markerWidth', 'markerHeight', 'refX', 'refY', 'orient',
    'xlink:href', 'href', 'target',
    'flood-color', 'flood-opacity', 'lighting-color',
    'color-interpolation-filters', 'color-interpolation',
    'baseline-shift', 'alignment-baseline',
    'enable-background', 'xml:space',
    'path', 'keyPoints', 'rotate',
  ],
  FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'object', 'embed'],
  FORBID_ATTR: [
    'onclick', 'ondblclick', 'onmousedown', 'onmouseup', 'onmouseover',
    'onmouseout', 'onmousemove', 'onkeydown', 'onkeyup', 'onkeypress',
    'onfocus', 'onblur', 'onload', 'onerror', 'onresize', 'onscroll',
    'onunload', 'onabort', 'onanimationend', 'onanimationstart',
    'ontransitionend', 'onbegin', 'onend', 'onrepeat',
  ],
};

/**
 * Sanitize an SVG string, removing scripts, event handlers, and dangerous elements.
 * Returns clean SVG safe for innerHTML rendering.
 */
export function sanitizeSvg(rawSvg: string): string {
  return DOMPurify.sanitize(rawSvg, SVG_PURIFY_CONFIG);
}
