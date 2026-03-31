/**
 * 🦆 Duck Agent - Buddy Module
 */

export {
  rollCompanion,
  getCompanion,
  hatchCompanion,
  getBuddyComment,
  formatCompanionCard,
  loadBuddyConfig,
  setCompanionMuted,
  isMuted,
  getUserId,
  RARITIES,
  RARITY_WEIGHTS,
  RARITY_STARS,
  RARITY_COLORS,
  SPECIES,
  EYES,
  HATS,
  STAT_NAMES,
} from './types.js';
export type { Companion, Rarity, Species, Eye, Hat, StatName, CompanionBones, CompanionSoul } from './types.js';

export { renderSprite, renderCompanion, getAnimationFrames } from './sprites.js';
