/**
 * 🦆 Duck Agent - Buddy Companion System
 * Virtual companion with stats, rarity, and personality
 */

import { randomBytes } from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
export type Rarity = typeof RARITIES[number];

export const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 1,
};

export const RARITY_STARS: Record<Rarity, string> = {
  common: '★',
  uncommon: '★★',
  rare: '★★★',
  epic: '★★★★',
  legendary: '★★★★★',
};

export const RARITY_COLORS: Record<Rarity, string> = {
  common: 'gray',
  uncommon: 'green',
  rare: 'blue',
  epic: 'purple',
  legendary: 'gold',
};

export const SPECIES = [
  'duck',
  'blob',
  'cat',
  'dragon',
  'owl',
  'ghost',
  'robot',
  'rabbit',
  'cactus',
  'snail',
] as const;
export type Species = typeof SPECIES[number];

export const EYES = ['·', '✦', '×', '◉', '@', '°'] as const;
export type Eye = typeof EYES[number];

export const HATS = [
  'none',
  'crown',
  'tophat',
  'halo',
  'wizard',
  'beanie',
  'tinyduck',
] as const;
export type Hat = typeof HATS[number];

export const STAT_NAMES = ['DEBUGGING', 'PATIENCE', 'CHAOS', 'WISDOM', 'SNARK'] as const;
export type StatName = typeof STAT_NAMES[number];

export interface CompanionBones {
  rarity: Rarity;
  species: Species;
  eye: Eye;
  hat: Hat;
  shiny: boolean;
  stats: Record<StatName, number>;
}

export interface CompanionSoul {
  name: string;
  personality: string;
}

export interface Companion extends CompanionBones, CompanionSoul {
  hatchedAt: number;
}

export interface StoredCompanion extends CompanionSoul {
  hatchedAt: number;
}

// ============================================================================
// DETERMINISTIC GENERATION (from user ID)
// ============================================================================

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function rollRarity(rng: () => number): Rarity {
  const total = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (const rarity of RARITIES) {
    roll -= RARITY_WEIGHTS[rarity];
    if (roll < 0) return rarity;
  }
  return 'common';
}

const RARITY_FLOOR: Record<Rarity, number> = {
  common: 5,
  uncommon: 15,
  rare: 25,
  epic: 35,
  legendary: 50,
};

function rollStats(rng: () => number, rarity: Rarity): Record<StatName, number> {
  const floor = RARITY_FLOOR[rarity];
  const peak = pick(rng, STAT_NAMES);
  let dump = pick(rng, STAT_NAMES);
  while (dump === peak) dump = pick(rng, STAT_NAMES);

  const stats = {} as Record<StatName, number>;
  for (const name of STAT_NAMES) {
    if (name === peak) {
      stats[name] = Math.min(100, floor + 50 + Math.floor(rng() * 30));
    } else if (name === dump) {
      stats[name] = Math.max(1, floor - 10 + Math.floor(rng() * 15));
    } else {
      stats[name] = floor + Math.floor(rng() * 40);
    }
  }
  return stats;
}

export interface Roll {
  bones: CompanionBones;
}

function rollFrom(rng: () => number): Roll {
  const rarity = rollRarity(rng);
  const bones: CompanionBones = {
    rarity,
    species: pick(rng, SPECIES),
    eye: pick(rng, EYES),
    hat: rarity === 'common' ? 'none' : pick(rng, HATS),
    shiny: rng() < 0.01,
    stats: rollStats(rng, rarity),
  };
  return { bones };
}

const SALT = 'duck-agent-2026';

export function rollCompanion(userId: string): Roll {
  const key = userId + SALT;
  return rollFrom(mulberry32(hashString(key)));
}

// ============================================================================
// COMPANION MANAGEMENT
// ============================================================================

export interface BuddyConfig {
  companion?: StoredCompanion;
  companionMuted?: boolean;
  companionName?: string;
}

let config: BuddyConfig = {};
let companion: Companion | undefined;

export function loadBuddyConfig(cfg: BuddyConfig): void {
  config = cfg;
  if (config.companion) {
    const { bones } = rollCompanion(getUserId());
    companion = { ...config.companion, ...bones };
  }
}

export function getUserId(): string {
  return config.companionName || 'duckbot';
}

export function getCompanion(): Companion | undefined {
  return companion;
}

export function hatchCompanion(name: string, personality: string): Companion {
  const { bones } = rollCompanion(getUserId());
  companion = {
    ...bones,
    name,
    personality,
    hatchedAt: Date.now(),
  };
  
  // Save to config
  if (config.companion !== undefined) {
    config.companion = {
      name: companion.name,
      personality: companion.personality,
      hatchedAt: companion.hatchedAt,
    };
  }
  
  return companion;
}

export function setCompanionMuted(muted: boolean): void {
  config.companionMuted = muted;
}

export function isMuted(): boolean {
  return config.companionMuted || false;
}

// ============================================================================
// BUDDY COMMENTS
// ============================================================================

const BUDDY_COMMENTS = {
  idle: [
    "Hmmm...",
    "Interesting...",
    "Quack.",
    "*fidgets*",
    "Looking at code...",
    "Hmm hmm hmm...",
    "*waddle*",
    "Your move!",
  ],
  working: [
    "Ooh working hard!",
    "I believe in you!",
    "Quack quack!",
    "Making progress!",
    "*cheerful waddle*",
    "Looking good!",
  ],
  success: [
    "QUACK! Victory!",
    "We did it!",
    "Amazing!",
    "*happy dance*",
    "Top tier!",
    "Feels good!",
  ],
  error: [
    "Hrmm...",
    "That's not quack-right.",
    "Oopsie...",
    "Buggy buddies!",
    "*concerned quack*",
    "Let's fix this!",
  ],
  waiting: [
    "Take your time!",
    "Waiting...",
    "*patient wiggle*",
    "Ready when you are!",
    "Zzz... wait zzz",
  ],
};

export function getBuddyComment(type: keyof typeof BUDDY_COMMENTS): string {
  const comments = BUDDY_COMMENTS[type];
  return comments[Math.floor(Math.random() * comments.length)];
}

// ============================================================================
// FORMATTING
// ============================================================================

export function formatCompanionCard(comp: Companion): string {
  const stars = RARITY_STARS[comp.rarity];
  const color = RARITY_COLORS[comp.rarity];
  
  const lines = [
    '',
    `  🐤 ${comp.name} ${stars}`,
    `  ${comp.rarity.toUpperCase()} ${comp.species}`,
    comp.shiny ? '  ✨ SHINY ✨' : '',
    '',
    '  Stats:',
    ...Object.entries(comp.stats).map(([stat, val]) => 
      `    ${stat.padEnd(10)} ${'█'.repeat(Math.floor(val / 10))}${'░'.repeat(10 - Math.floor(val / 10))} ${val}`
    ),
    '',
    `  Personality: ${comp.personality}`,
    '',
  ];
  
  return lines.join('\n');
}

export default {
  rollCompanion,
  getCompanion,
  hatchCompanion,
  getBuddyComment,
  formatCompanionCard,
  loadBuddyConfig,
  getUserId,
  setCompanionMuted,
  isMuted,
};
