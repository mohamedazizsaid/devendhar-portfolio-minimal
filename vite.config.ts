import { defineConfig, type Plugin } from 'vite';
import { parse, serialize, type DefaultTreeAdapterMap } from 'parse5';
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync } from 'node:fs';
import { resolve } from 'node:path';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const root = process.cwd();
const original = readFileSync(resolve(root, 'index.html'), 'utf8');
const doc = parse(original);
const isElement = (node: Node): node is Element => 'tagName' in node;
function find(node: Node, tag: string): Element | undefined {
  if (isElement(node) && node.tagName === tag) return node;
  if ('childNodes' in node) {
    for (const child of node.childNodes) {
      const match = find(child, tag);
      if (match) return match;
    }
  }
}
const head = find(doc, 'head');
const body = find(doc, 'body');
if (!head || !body) throw new Error('Source index.html must contain head and body.');
const profilePath = resolve(root, 'src/data/dataprofile.ts');
const defaults: Record<string, string> = {};
let counter = 0;
function extract(value: string, section: string, kind: string) {
  const key = `${section}_${kind}_${++counter}`;
  defaults[key] = value;
  return `__PROFILE_${key}__`;
}
const editable = new Set(['href', 'src', 'srcset', 'alt', 'title', 'aria-label', 'placeholder', 'data-background-image', 'data-cursor', 'data-purecounter-end']);
const scripts: { attributes: Record<string, string>; code: string }[] = [];
const styles: string[] = [];
function visit(node: Node, section = 'global') {
  if (node.nodeName === '#text' && 'value' in node) {
    if (node.value.trim()) node.value = extract(node.value, section, 'text');
    return;
  }
  if (!('childNodes' in node)) return;
  if (isElement(node)) {
    section = node.attrs.find(a => a.name === 'id')?.value.replace(/[^a-zA-Z0-9_]/g, '_') || section;
    for (const attr of node.attrs) {
      if (editable.has(attr.name)) attr.value = extract(attr.value, section, attr.name.replace(/-/g, '_'));
    }
  }
  node.childNodes = node.childNodes.filter(child => {
    if (isElement(child) && child.tagName === 'script') {
      scripts.push({ attributes: Object.fromEntries(child.attrs.map(a => [a.name, a.value])), code: serialize(child) });
      return false;
    }
    if (isElement(child) && child.tagName === 'style') {
      styles.push(serialize(child));
      return false;
    }
    return true;
  });
  for (const child of node.childNodes) visit(child, section);
}
// Extract scripts in document order, including any head scripts.
head.childNodes = head.childNodes.filter(child => {
  if (isElement(child) && child.tagName === 'script') {
    scripts.push({ attributes: Object.fromEntries(child.attrs.map(a => [a.name, a.value])), code: serialize(child) });
    return false;
  }
  return true;
});
visit(body);
const template = serialize(body);
if (!existsSync(profilePath) || readFileSync(profilePath, 'utf8').includes('PROFILE_EXTRACTION_PENDING')) {
  mkdirSync(resolve(root, 'src/data'), { recursive: true });
  writeFileSync(profilePath, '// Extracted once from the COMPLETE original index.html.\n// Edit values here; restarting Vite never overwrites this file.\nexport const dataprofile: Record<string, string> = ' + JSON.stringify(defaults, null, 2) + ';\n');
}
const bodyAttrs = body.attrs.map(a => ` ${a.name}=${JSON.stringify(a.value)}`).join('');
const shell = `<!doctype html><html lang="en"><head>${serialize(head)}${styles.map(s => `<style>${s}</style>`).join('')}</head><body${bodyAttrs}><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`;

// Only this known initializer needs adapting: React mounts after DOMContentLoaded.
const mainSource = readFileSync(resolve(root, 'assets/js/main.js'), 'utf8');
const marker = 'document.addEventListener("DOMContentLoaded", () => {';
const start = mainSource.indexOf(marker);
const end = mainSource.indexOf('\n  });', start);
if (start < 0 || end < 0) throw new Error('Preloader source changed; inspect initializer before migration.');
const adaptedMain = mainSource.slice(0, start) + '(function () {' + mainSource.slice(start + marker.length, end) + '\n  })();' + mainSource.slice(end + '\n  });'.length);
for (const script of scripts) {
  if (script.attributes.src?.replace(/^\.\//, '') === 'assets/js/main.js') {
    script.attributes.src = '__legacy-main.js';
  }
}
const virtualId = 'virtual:portfolio-template';
let outDir = resolve(root, 'dist');
const migration: Plugin = {
  name: 'portfolio-react-migration',
  configResolved(config) { outDir = resolve(root, config.build.outDir); },
  resolveId(id) { if (id === virtualId) return '\0' + virtualId; },
  load(id) {
    if (id === '\0' + virtualId) return `export const template = ${JSON.stringify(template)}; export const scripts = ${JSON.stringify(scripts)};`;
  },
  transformIndexHtml: { order: 'pre', handler: () => shell },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const path = req.url?.split('?')[0];
      if (path === '/__reference/index.html') {
        res.setHeader('Content-Type', 'text/html');
        res.end(original.replace('<head>', '<head><base href="/">'));
        return;
      }
      if (path === '/__legacy-main.js') {
        res.setHeader('Content-Type', 'application/javascript');
        res.end(adaptedMain);
        return;
      }
      next();
    });
  },
  handleHotUpdate(context) {
    // Legacy plugins mutate the DOM. A full reload avoids duplicate listeners/tickers.
    if (context.file.includes('/src/')) {
      context.server.ws.send({ type: 'full-reload' });
      return [];
    }
  },
  closeBundle() {
    cpSync(resolve(root, 'assets'), resolve(outDir, 'assets'), { recursive: true });
    writeFileSync(resolve(outDir, '__legacy-main.js'), adaptedMain);
  },
};
export default defineConfig({
  base: './',
  plugins: [migration],
  build: { assetsDir: 'react-assets' },
});
