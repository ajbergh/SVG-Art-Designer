import { Layer } from '../types';

/**
 * Parses an SVG string and returns a list of top-level "Layers"
 * A Layer is defined as a direct child of the <svg> element, excluding defs/metadata.
 */
export const parseLayers = (svgString: string): Layer[] => {
  if (!svgString) return [];
  
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    const svg = doc.querySelector('svg');
    if (!svg) return [];

    const layers: Layer[] = [];
    const children = Array.from(svg.children);

    children.forEach((el, index) => {
      // Skip non-visual elements
      if (['defs', 'style', 'title', 'desc', 'metadata'].includes(el.tagName.toLowerCase())) {
        return;
      }

      // Ensure element has an ID for tracking
      let elId = el.getAttribute('id');
      if (!elId) {
        elId = `layer-${index}-${el.tagName}`;
        // We don't modify the string here, just the object representation for now
        // But for the UI to be stable, we ideally need IDs in the SVG.
        // For this viewer, we will rely on index-based ID if missing attribute
      }

      layers.push({
        id: `internal-${index}`, // React key
        elementId: elId,
        type: el.tagName,
        name: elId || `${el.tagName} ${index + 1}`,
        visible: el.getAttribute('display') !== 'none'
      });
    });

    return layers.reverse(); // Display top-most element first in list (SVG renders bottom-up)
  } catch (e) {
    console.error("Error parsing layers", e);
    return [];
  }
};

/**
 * Common helper to load doc, perform action, and serialize
 */
const manipulateSvg = (svgString: string, action: (doc: Document, svg: SVGSVGElement) => void): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, "image/svg+xml");
  const svg = doc.querySelector('svg');
  if (!svg) return svgString;
  
  // Check for parser errors
  const parserError = doc.querySelector('parsererror');
  if (parserError) return svgString;

  action(doc, svg);

  return new XMLSerializer().serializeToString(doc);
};

const getVisualChildren = (svg: SVGSVGElement) => {
    return Array.from(svg.children).filter(el => 
        !['defs', 'style', 'title', 'desc', 'metadata'].includes(el.tagName.toLowerCase())
    );
};

export const toggleLayerVisibility = (svgString: string, indexFromTop: number): string => {
  return manipulateSvg(svgString, (doc, svg) => {
    const children = getVisualChildren(svg);
    // indexFromTop is 0 for the last element in DOM (rendered on top)
    // So we need to reverse index logic
    const targetIndex = children.length - 1 - indexFromTop;
    const el = children[targetIndex];
    
    if (el) {
      const current = el.getAttribute('display');
      if (current === 'none') {
        el.removeAttribute('display');
      } else {
        el.setAttribute('display', 'none');
      }
    }
  });
};

export const reorderLayer = (svgString: string, fromIndex: number, direction: 'up' | 'down'): string => {
  return manipulateSvg(svgString, (doc, svg) => {
    const children = getVisualChildren(svg);
    // Map UI index (0 = top visual) to DOM index (last = top visual)
    const domIndex = children.length - 1 - fromIndex;
    const element = children[domIndex];
    
    if (!element) return;

    // Moving "UP" in UI means moving towards end of DOM (higher Z-index)
    if (direction === 'up') {
        // If it's already last, can't move up
        if (domIndex === children.length - 1) return;
        const nextSibling = element.nextElementSibling;
        if (nextSibling) {
             // To move "up" visually (higher z-index), we move it after the next sibling
             // InsertBefore nextSibling.nextSibling handles this
             svg.insertBefore(element, nextSibling.nextElementSibling);
        }
    } else {
        // Moving "DOWN" in UI means moving towards start of DOM (lower Z-index)
        if (domIndex === 0) return;
        const prevSibling = element.previousElementSibling;
        // SVG children might include non-visuals (defs), so strictly swapping with visual sibling is tricky
        // Simpler: find the visual sibling below it
        const siblingBelow = children[domIndex - 1];
        if (siblingBelow) {
            svg.insertBefore(element, siblingBelow);
        }
    }
  });
};

export const groupLayers = (svgString: string, selectedIndices: number[]): string => {
    return manipulateSvg(svgString, (doc, svg) => {
        const children = getVisualChildren(svg);
        // Convert UI indices to DOM elements
        const elementsToGroup = selectedIndices
            .map(idx => children[children.length - 1 - idx])
            .filter(Boolean);
        
        if (elementsToGroup.length < 2) return;

        // Create group
        const g = doc.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("id", `group-${Date.now()}`);
        
        // Find insertion point (where the lowest item was)
        // We want to insert the group at the position of the first element in DOM order (lowest z-index)
        // to maintain relative z-order with unselected items
        const firstElement = elementsToGroup[0]; // Assuming filtered list preserves order?
        // Actually, let's sort elements by their DOM position
        const sortedElements = elementsToGroup.sort((a, b) => {
             return Array.from(svg.children).indexOf(a) - Array.from(svg.children).indexOf(b);
        });

        const insertRef = sortedElements[0];
        
        if (insertRef && insertRef.parentNode) {
            svg.insertBefore(g, insertRef);
        } else {
            svg.appendChild(g);
        }

        // Move elements into group
        sortedElements.forEach(el => g.appendChild(el));
    });
};

export const ungroupLayer = (svgString: string, indexFromTop: number): string => {
    return manipulateSvg(svgString, (doc, svg) => {
        const children = getVisualChildren(svg);
        const domIndex = children.length - 1 - indexFromTop;
        const element = children[domIndex];

        if (element && element.tagName.toLowerCase() === 'g') {
            // Move children out
            const groupChildren = Array.from(element.children);
            groupChildren.forEach(child => {
                svg.insertBefore(child, element);
            });
            // Remove empty group
            element.remove();
        }
    });
};

export const deleteLayer = (svgString: string, indexFromTop: number): string => {
    return manipulateSvg(svgString, (doc, svg) => {
        const children = getVisualChildren(svg);
        const domIndex = children.length - 1 - indexFromTop;
        const element = children[domIndex];
        if (element) {
            element.remove();
        }
    });
};
