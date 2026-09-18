declare const __PORTFOLIO_SCRIPTS__: { attributes: Record<string, string>; code: string }[];
let initialization: Promise<void> | undefined;

// Keep vendor versions, execution order, animation timings, and easing unchanged.
// This bridge is intentionally page-scoped: do not mount it in a client router.
export function initializePortfolioAnimations(): Promise<void> {
  if (initialization) return initialization;
  initialization = (async () => {
    await document.fonts.ready;
    for (const descriptor of __PORTFOLIO_SCRIPTS__) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        for (const [name, value] of Object.entries(descriptor.attributes)) {
          if (!['async', 'defer', 'src'].includes(name)) script.setAttribute(name, value);
        }
        script.async = false;
        script.dataset.portfolioLegacy = 'true';
        if (descriptor.attributes.src) {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error(`Cannot load animation script: ${descriptor.attributes.src}`));
          script.src = descriptor.attributes.src;
          document.body.appendChild(script);
        } else {
          script.textContent = descriptor.code;
          document.body.appendChild(script);
          resolve();
        }
      });
    }
  })();
  return initialization;
}
