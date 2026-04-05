/**
 * UI Parser — DroidClaw-style XML parsing + element filtering
 * Parses Android accessibility XML and returns compact, scored elements for the LLM
 */

import { XMLParser } from 'fast-xml-parser';

export interface RawUiElement {
  '@_bounds'?: string;
  '@_text'?: string;
  '@_content-desc'?: string;
  '@_resource-id'?: string;
  '@_class'?: string;
  '@_clickable'?: string;
  '@_long-clickable'?: string;
  '@_scrollable'?: string;
  '@_enabled'?: string;
  '@_checked'?: string;
  '@_focused'?: string;
  '@_selected'?: string;
  '@_password'?: string;
  '@_editable'?: string;
  '@_hint'?: string;
}

export interface UiElement {
  id: string;
  text: string;
  type: string;
  bounds: string;
  center: [number, number];
  size: [number, number];
  clickable: boolean;
  editable: boolean;
  enabled: boolean;
  checked: boolean;
  focused: boolean;
  selected: boolean;
  scrollable: boolean;
  longClickable: boolean;
  password: boolean;
  hint: string;
  action: 'tap' | 'type' | 'longpress' | 'scroll' | 'read';
  parent: string;
  depth: number;
}

export interface CompactElement {
  text: string;
  center: [number, number];
  action: UiElement['action'];
  enabled?: false;
  checked?: true;
  focused?: true;
  hint?: string;
  editable?: true;
  scrollable?: true;
}

/**
 * Parse Android accessibility XML and extract interactive UI elements
 */
export function parseUiXml(xmlContent: string): UiElement[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
  });

  let parsed: unknown;
  try {
    parsed = parser.parse(xmlContent);
  } catch {
    return [];
  }

  const elements: UiElement[] = [];

  function walk(node: any, parentLabel: string, depth: number): void {
    if (!node || typeof node !== 'object') return;

    if (node['@_bounds']) {
      const isClickable = node['@_clickable'] === 'true';
      const isLongClickable = node['@_long-clickable'] === 'true';
      const isScrollable = node['@_scrollable'] === 'true';
      const isEnabled = node['@_enabled'] !== 'false';
      const isChecked = node['@_checked'] === 'true';
      const isFocused = node['@_focused'] === 'true';
      const isSelected = node['@_selected'] === 'true';
      const isPassword = node['@_password'] === 'true';

      const elementClass = node['@_class'] ?? '';
      const isEditable =
        elementClass.includes('EditText') ||
        elementClass.includes('AutoCompleteTextView') ||
        node['@_editable'] === 'true';

      const text: string = node['@_text'] ?? '';
      const desc: string = node['@_content-desc'] ?? '';
      const resourceId: string = node['@_resource-id'] ?? '';
      const hint: string = node['@_hint'] ?? '';

      const typeName = elementClass.split('.').pop() ?? '';
      const nodeLabel = text || desc || resourceId.split('/').pop() || typeName;

      const isInteractive = isClickable || isEditable || isLongClickable || isScrollable;
      const hasContent = !!(text || desc);

      if (isInteractive || hasContent) {
        const bounds: string = node['@_bounds'];
        try {
          const coords = bounds
            .replace('][', ',')
            .replace('[', '')
            .replace(']', '')
            .split(',')
            .map(Number);

          const [x1, y1, x2, y2] = coords;
          const centerX = Math.floor((x1 + x2) / 2);
          const centerY = Math.floor((y1 + y2) / 2);
          const width = x2 - x1;
          const height = y2 - y1;

          if (width <= 0 || height <= 0) {
            walkChildren(node, nodeLabel, depth + 1);
            return;
          }

          let suggestedAction: UiElement['action'];
          if (isEditable) suggestedAction = 'type';
          else if (isLongClickable && !isClickable) suggestedAction = 'longpress';
          else if (isScrollable && !isClickable) suggestedAction = 'scroll';
          else if (isClickable) suggestedAction = 'tap';
          else suggestedAction = 'read';

          elements.push({
            id: resourceId,
            text: text || desc,
            type: typeName,
            bounds,
            center: [centerX, centerY],
            size: [width, height],
            clickable: isClickable,
            editable: isEditable,
            enabled: isEnabled,
            checked: isChecked,
            focused: isFocused,
            selected: isSelected,
            scrollable: isScrollable,
            longClickable: isLongClickable,
            password: isPassword,
            hint,
            action: suggestedAction,
            parent: parentLabel,
            depth,
          });
        } catch {
          // skip malformed bounds
        }
      }

      walkChildren(node, nodeLabel, depth + 1);
      return;
    }

    walkChildren(node, parentLabel, depth);
  }

  function walkChildren(node: any, parentLabel: string, depth: number): void {
    if (node.node) {
      const children = Array.isArray(node.node) ? node.node : [node.node];
      for (const child of children) {
        walk(child, parentLabel, depth);
      }
    }
    if (node.hierarchy) {
      walk(node.hierarchy, parentLabel, depth);
    }
  }

  walk(parsed, 'root', 0);
  return elements;
}

/**
 * Score element for relevance to the LLM
 */
function scoreElement(el: UiElement): number {
  let score = 0;
  if (el.enabled) score += 10;
  if (el.editable) score += 8;
  if (el.focused) score += 6;
  if (el.clickable || el.longClickable) score += 5;
  if (el.text) score += 3;
  return score;
}

/**
 * Compact element for LLM context (minimal tokens)
 */
export function compactElement(el: UiElement): CompactElement {
  const compact: CompactElement = {
    text: el.text,
    center: el.center,
    action: el.action,
  };
  if (!el.enabled) (compact as any).enabled = false;
  if (el.checked) (compact as any).checked = true;
  if (el.focused) (compact as any).focused = true;
  if (el.hint) (compact as any).hint = el.hint;
  if (el.editable) (compact as any).editable = true;
  if (el.scrollable) (compact as any).scrollable = true;
  return compact;
}

/**
 * Deduplicate elements by center coordinates, score, and return top N compact elements
 */
export function filterElements(elements: UiElement[], limit: number = 40): CompactElement[] {
  // Deduplicate by center coordinates (5px tolerance)
  const seen = new Map<string, UiElement>();
  for (const el of elements) {
    const bucketX = Math.round(el.center[0] / 5) * 5;
    const bucketY = Math.round(el.center[1] / 5) * 5;
    const key = `${bucketX},${bucketY}`;
    const existing = seen.get(key);
    if (!existing || scoreElement(el) > scoreElement(existing)) {
      seen.set(key, el);
    }
  }

  // Score, sort descending, take top N
  const deduped = Array.from(seen.values());
  deduped.sort((a, b) => scoreElement(b) - scoreElement(a));
  return deduped.slice(0, limit).map(compactElement);
}

/**
 * Compute screen hash for change detection
 */
export function computeScreenHash(elements: UiElement[]): string {
  const parts = elements.map(
    (e) => `${e.id}|${e.text}|${e.center[0]},${e.center[1]}|${e.enabled}|${e.checked}`
  );
  return parts.join(';');
}

/**
 * Screen diff result
 */
export interface ScreenDiff {
  changed: boolean;
  addedTexts: string[];
  removedTexts: string[];
  summary: string;
}

/**
 * Diff two screen states to detect changes
 */
export function diffScreenState(prevElements: UiElement[], currElements: UiElement[]): ScreenDiff {
  const prevTexts = new Set(prevElements.map((e) => e.text).filter(Boolean));
  const currTexts = new Set(currElements.map((e) => e.text).filter(Boolean));

  const addedTexts = [...currTexts].filter((t) => !prevTexts.has(t));
  const removedTexts = [...prevTexts].filter((t) => !currTexts.has(t));

  const prevHash = computeScreenHash(prevElements);
  const currHash = computeScreenHash(currElements);
  const changed = prevHash !== currHash;

  let summary = '';
  if (!changed) {
    summary = 'Screen has NOT changed since last action.';
  } else {
    const parts: string[] = [];
    if (addedTexts.length > 0) {
      parts.push(`New on screen: ${addedTexts.slice(0, 5).join(', ')}`);
    }
    if (removedTexts.length > 0) {
      parts.push(`Gone from screen: ${removedTexts.slice(0, 5).join(', ')}`);
    }
    summary = parts.join('. ') || 'Screen layout changed.';
  }

  return { changed, addedTexts, removedTexts, summary };
}
