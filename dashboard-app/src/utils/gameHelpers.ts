import { FACTORIES_DATA } from '../assets/data/factories';

export type FactoryCategory = 'basic' | 'crafted' | 'keys';

// Basic raw resources used for initial classification
export const RAW_RESOURCES = ["EARTH", "WATER", "FIRE", "DYNOFISH", "MAGICSHARD", "BURNTRICE"];

// Keys resources
export const KEYS_RESOURCES = ["KEY", "GLASSKEY", "CERAMICKEY", "DYNOKEY"];

// Emojis mapping for premium design
export const EMOJI_MAP: Record<string, string> = {
  "ACID": "🧪", "ALGAE": "🌿", "BOLTS": "🔩", "BONESOUP": "🍲", "BOWL": "🥣", 
  "BURGER": "🍔", "BURNTRICE": "🌾", "CEMENT": "🧱", "CERAMICKEY": "🔑", "CERAMICS": "🏺", 
  "CLAY": "🧱", "COPPER": "🪙", "DANGO": "🍡", "DUMPLING": "🥟", "DYNAMITE": "🧨", 
  "DYNODESSERT": "🧁", "DYNOFISH": "🐡", "DYNOKEY": "🗝️", "EARTH": "🌍", "ENERGY": "⚡", 
  "FIBERGLASS": "🧪", "FISHBONE": "🦴", "FUEL": "⛽", "FUGU": "🐡", "GAS": "☁️", 
  "GLASS": "🍷", "GLASSKEY": "🔑", "HEAT": "🔥", "HYDROGEN": "🎈", "KEY": "🔑", 
  "LAVA": "🌋", "LOBSTER": "🦞", "MAGICSHARD": "✨", "MEATBALL": "🧆", "MUD": "🟫", 
  "MYSTICWEAPON": "🔮", "NINJASTAR": "🌟", "OIL": "🛢️", "OXYGEN": "🫧", "PANCAKE": "🥞", 
  "PLASTICS": "🧬", "PLUNGER": "🪠", "RAWRMEN": "🍜", "RAWRVIOLI": "🥟", "SAND": "⏳", 
  "SASHIMI": "🍣", "SCREWS": "🔩", "SEAWATER": "🌊", "SPOON": "🥄", "STEAM": "💨", 
  "STEEL": "⚔️", "STONE": "🪨", "SULFUR": "🟡", "SUSHI": "🍣", "SWORD": "⚔️", 
  "TAPE": "🎗️", "TARGET": "🎯", "TOYHAMMER": "🔨", "WAGYU": "🥩"
};

/**
 * Resolves a factory/resource category
 */
export function getCategory(name: string): FactoryCategory {
  if (RAW_RESOURCES.includes(name)) return 'basic';
  if (KEYS_RESOURCES.includes(name)) return 'keys';
  const levels = FACTORIES_DATA[name];
  if (levels && levels.length > 0) {
    const firstLvl = levels[0];
    const inputs = [firstLvl.input1, firstLvl.input2].filter(Boolean);
    const onlyRaw = inputs.every(inp => RAW_RESOURCES.includes(inp));
    if (onlyRaw) return 'basic';
  }
  return 'crafted';
}

/**
 * Returns emoji for resource
 */
/** Mastery yield multiplier per level (from game data: masterydata.txt)
 *  The "Bono de Rendimiento" values are applied multiplicatively:
 *  effectiveYield = baseYield × multiplier
 */
const MASTERY_YIELD_MULT: Record<number, number> = {
  0: 1.0,
  1: 1.020,
  2: 1.029,
  3: 1.033,
  4: 1.037,
  5: 1.042,
  6: 1.044,
  7: 1.046,
  8: 1.048,
  9: 1.050,
  10: 1.053,
};

/** Get the effective yield at a given mastery level (e.g. level 10 → baseYield × 1.053) */
export function getMasteryYield(baseYield: number, masteryLevel: number): number {
  return baseYield * getMasteryMultiplier(masteryLevel);
}

/** Get the yield multiplier at a given mastery level (e.g. level 10 → 1.053) */
export function getMasteryMultiplier(masteryLevel: number): number {
  if (masteryLevel <= 0) return 1.0;
  if (masteryLevel <= 10) return MASTERY_YIELD_MULT[masteryLevel];
  // Extrapolate beyond level 10: +0.003 per extra level
  return 1.053 + (masteryLevel - 10) * 0.003;
}

/** Get the yield bonus percentage at a given mastery level (e.g. level 10 → 5.3%) */
export function getMasteryYieldBonus(masteryLevel: number): number {
  return (getMasteryMultiplier(masteryLevel) - 1) * 100;
}

/** Get the mastery input reduction percentage (Craft-Companion formula).
 *  Mastery reduces the INPUT needed, not multiplies the yield.
 *  e.g. level 10 → 5.3% reduction → input × (1 - 0.053)
 */
export function getMasteryReductionPercent(masteryLevel: number): number {
  return getMasteryYieldBonus(masteryLevel);
}

/** Apply mastery input reduction to an input amount (Craft-Companion formula). */
export function applyMasteryReduction(amount: number, masteryLevel: number): number {
  return amount * (1 - getMasteryReductionPercent(masteryLevel) / 100);
}

export function getEmoji(name: string): string {
  return EMOJI_MAP[name] || '🏭';
}

/**
 * Convert a cycle-duration factor to a speed multiplier.
 * boostValue < 1 = speed boost (e.g. 0.5 → 2x speed)
 * boostValue > 1 = penalty (slower)
 */
export function toSpeedMult(v: number): number {
  return v > 0 ? 1 / v : 1;
}

// ─── Workshop tier-based speed boost (from Craft-Companion) ───

const WORKSHOP_TIER_ONE = ['MUD', 'CLAY', 'SAND'];
const WORKSHOP_TIER_TWO = ['COPPER', 'SEAWATER', 'HEAT', 'ALGAE', 'LAVA', 'CERAMICS', 'STEEL', 'OXYGEN', 'GLASS'];
const WORKSHOP_TIER_THREE = ['GAS', 'STONE', 'STEAM', 'SCREWS', 'FUEL', 'CEMENT', 'OIL', 'ACID', 'SULFUR'];
const WORKSHOP_TIER_FOUR = ['PLASTICS', 'PLASTIC', 'FIBERGLASS', 'ENERGY', 'HYDROGEN', 'DYNAMITE'];

/** Boost percent per tier index [0..10]; index = min(level + 1, 10) */
const WORKSHOP_BOOSTS: Record<number, number[]> = {
  1: [0, 11, 23, 35, 47, 59, 69, 79, 85, 92, 100],
  2: [0, 10, 20, 30, 39, 47, 54, 61, 69, 75, 82],
  3: [0, 9, 18, 25, 32, 39, 45, 52, 56, 61, 67],
  4: [0, 8, 15, 22, 28, 33, 37, 41, 45, 49, 54],
};

export function getWorkshopTier(symbol: string): number {
  const s = symbol.toUpperCase();
  if (WORKSHOP_TIER_ONE.includes(s)) return 1;
  if (WORKSHOP_TIER_TWO.includes(s)) return 2;
  if (WORKSHOP_TIER_THREE.includes(s)) return 3;
  if (WORKSHOP_TIER_FOUR.includes(s)) return 4;
  return 0;
}

/** Get the workshop speed boost percent for a given factory and workshop level */
export function getWorkshopBoostPercent(symbol: string, workshopLevel: number): number {
  const tier = getWorkshopTier(symbol);
  if (!tier) return 0;
  const idx = Math.min(Math.max(0, workshopLevel) + 1, 10);
  return WORKSHOP_BOOSTS[tier][idx] || 0;
}

/** A booster is "active" if its value is not 1 (no effect) and > 0 */
export function isActiveBooster(v: number): boolean {
  return v !== 1 && v > 0;
}

/**
 * Check if a time window is currently active.
 * Handles null endTime as "never expires" (permanent).
 */
export function isTimeActive(startTime: string | null | undefined, endTime: string | null | undefined): boolean {
  const now = Date.now();
  const start = startTime ? new Date(startTime).getTime() : 0;
  const end = endTime ? new Date(endTime).getTime() : Infinity;
  return now >= start && now <= end;
}

// ─── Craft-Companion speed / duration extraction ───

/** Apply a speed boost percent to a duration.
 *  E.g. 35% workshop speed boost → duration / 1.35 */
export function applyWorkshopSpeedToDuration(durationSec: number, workshopBoostPercent: number): number {
  return durationSec / (1 + workshopBoostPercent / 100);
}

/** Apply a factory boost multiplier to a duration.
 *  E.g. 2x boost → duration / 2 */
export function applyFactoryBoostToDuration(durationSec: number, multiplier: number): number {
  return durationSec / multiplier;
}

/** Get runs per hour from a cycle duration in seconds */
export function getRunsPerHour(durationSec: number): number {
  return durationSec > 0 ? 3600 / durationSec : 0;
}

/** Convert a factory boost value to a multiplier (Craft-Companion logic).
 *  Fractional values < 1 are duration ratios (0.5 → 2x speed).
 *  Values ≥ 1 are direct multipliers. */
export function getBoostMultiplier(boostValue: number): number {
  if (!Number.isFinite(boostValue) || boostValue <= 0) return 1;
  return boostValue > 0 && boostValue < 1 ? 1 / boostValue : boostValue;
}

/** Get effective speed percent = baseDuration / calculatedDuration × 100 */
export function getEffectiveSpeedPercent(baseDurationSec: number, calculatedDurationSec: number): number {
  if (baseDurationSec <= 0 || calculatedDurationSec <= 0) return 0;
  return (baseDurationSec / calculatedDurationSec) * 100;
}

/** Get effective speed multiplier = baseDuration / calculatedDuration */
export function getEffectiveSpeedMult(baseDurationSec: number, calculatedDurationSec: number): number {
  if (baseDurationSec <= 0 || calculatedDurationSec <= 0) return 1;
  return baseDurationSec / calculatedDurationSec;
}
