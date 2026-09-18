import { createElement, memo, type CSSProperties, type ReactNode } from 'react';
import { dataprofile } from '../data/dataprofile';

declare const __PORTFOLIO_TEMPLATE__: string;

const aliases: Record<string, string> = {
  class: 'className', for: 'htmlFor', tabindex: 'tabIndex', readonly: 'readOnly',
  colspan: 'colSpan', rowspan: 'rowSpan', maxlength: 'maxLength',
  autocomplete: 'autoComplete', autofocus: 'autoFocus', crossorigin: 'crossOrigin',
  srcset: 'srcSet', usemap: 'useMap', contenteditable: 'contentEditable',
  'stroke-width': 'strokeWidth', 'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin', 'stroke-dasharray': 'strokeDasharray',
  'stroke-dashoffset': 'strokeDashoffset', 'fill-rule': 'fillRule',
  'clip-rule': 'clipRule', 'fill-opacity': 'fillOpacity', 'stroke-opacity': 'strokeOpacity',
  'xlink:href': 'xlinkHref', 'xml:space': 'xmlSpace',
};
const booleans = new Set(['disabled', 'checked', 'multiple', 'selected', 'required', 'hidden', 'autofocus', 'readonly', 'controls', 'loop', 'muted', 'autoplay']);
function value(source: string) {
  return source.replace(/__PROFILE_([a-zA-Z0-9_]+)__/g, (_, key: string) => {
    if (!(key in dataprofile)) throw new Error(`Missing profile field: ${key}`);
    return dataprofile[key];
  });
}
function renderNode(node: Node, key: string): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return value(node.textContent || '');
  if (!(node instanceof Element)) return null;
  if (node.tagName === 'SCRIPT') return null;
  const props: Record<string, unknown> = { key };
  for (const attr of Array.from(node.attributes)) {
    // Inline event handlers are not copied as executable strings into React.
    if (/^on/i.test(attr.name)) throw new Error(`Inline handler requires explicit migration: ${attr.name}`);
    if (attr.name === 'style') {
      const css = (node as HTMLElement).style;
      const style: Record<string, string> = {};
      for (const name of Array.from(css)) {
        const property = name.startsWith('--') ? name : name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()).replace(/^Ms/, 'ms');
        style[property] = css.getPropertyValue(name);
      }
      props.style = style as CSSProperties;
    } else {
      const name = aliases[attr.name] || attr.name;
      props[name] = booleans.has(attr.name) ? true : value(attr.value);
    }
  }
  // Uncontrolled elements allow the legacy plugins to keep their original behavior.
  if (node.tagName === 'INPUT') {
    if ('value' in props) { props.defaultValue = props.value; delete props.value; }
    if ('checked' in props) { props.defaultChecked = props.checked; delete props.checked; }
  }
  const children = Array.from(node.childNodes).map((child, index) => renderNode(child, `${key}.${index}`));
  const tag = node.namespaceURI === 'http://www.w3.org/2000/svg' ? node.tagName : node.tagName.toLowerCase();
  return children.length ? createElement(tag, props, ...children) : createElement(tag, props);
}

// Single-page legacy boundary: React creates the original DOM once. Animation
// plugins then own their mutations. Editing data triggers a full page reload.
export const Portfolio = memo(function Portfolio() {
  const document = new DOMParser().parseFromString(__PORTFOLIO_TEMPLATE__, 'text/html');
  return <>{Array.from(document.body.childNodes).map((node, index) => renderNode(node, String(index)))}</>;
});
