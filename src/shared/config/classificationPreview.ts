/** Vite supplies a literal at compile time; Jest supplies it in test globals.
 * Even `vite build --mode development` must not expose the demo. */
export const classificationPreviewEnabled = typeof __CLASSIFICATION_PREVIEW__ !== 'undefined' && __CLASSIFICATION_PREVIEW__;
export const CLASSIFICATION_PREVIEW_PATH = '/classification-preview';
