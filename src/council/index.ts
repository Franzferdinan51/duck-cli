/**
 * 🦆 Duck Agent - AI Council Module
 * Deep integration with AI Council Chamber
 */

// Client
export { AICouncilClient, CORE_COUNCILORS, DELIBERATION_MODES } from './client.js';
export type { Councilor, DeliberationMode, Session, Vote, CouncilResult } from './client.js';

// Engine
export { DeliberationEngine } from './deliberation-engine.js';
export type { DeliberationOptions, DeliberationState } from './deliberation-engine.js';

// Commands
export { createCouncilCommand } from '../commands/council.js';
