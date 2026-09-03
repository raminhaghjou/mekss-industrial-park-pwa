/** @type {any} */
const css = globalThis.CSS || {};

if (typeof globalThis.CSS === 'undefined') {
  globalThis.CSS = css;
}

if (typeof css.escape !== 'function') {
  css.escape = (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
}
