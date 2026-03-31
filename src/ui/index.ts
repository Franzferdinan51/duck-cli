/**
 * 🦆 Duck Agent - UI Module
 * A2UI, Textura, and Pretext Canvas renderers
 */

// A2UI - Agent to User Interface Protocol
export { A2UIRenderer, A2UI_STYLES } from './a2ui/renderer.js';
export type { A2UIComponent, Surface, A2UIMessage } from './a2ui/renderer.js';

// Textura - DOM-free layout engine
export { TexturaLayout } from './textura/layout-engine.js';
export type { TexturaNode, ComputedLayout } from './textura/layout-engine.js';

// Pretext Canvas - Canvas-based rendering
export { PretextCanvasRenderer } from './pretext-canvas/pretext-canvas.js';
export type { MessageBubble, VotePanel, ConsensusMeter, Particle, StreamingMessage } from './pretext-canvas/pretext-canvas.js';
