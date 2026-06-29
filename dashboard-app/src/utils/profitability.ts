import { FACTORIES_DATA } from '../assets/data/factories';
import type { TokenPrices } from './priceService';
import { applyMasteryReduction, getMasteryReductionPercent, getWorkshopBoostPercent, applyWorkshopSpeedToDuration, applyFactoryBoostToDuration, getRunsPerHour } from './gameHelpers';
import type { ResourceConfig } from '../hooks/usePlayerConfig';
import { calculateUpgradeROI } from '../services/craftworldCalculations';

export interface ChainNode {
  resource: string;
  amount: number;
  costCoin: number;
  isBase: boolean;
  children: ChainNode[];
}

export interface ResourceProfit {
  name: string;
  category: 'basic' | 'crafted' | 'keys';

  // Market prices
  buyPrice: number;
  sellPrice: number;

  // Craft cost (recursive, all sub-resources at market buy price)
  craftCostPerUnit: number;
  isCraftable: boolean;

  // Direct input cost (only 1 level deep — buy the immediate inputs)
  directInputCostPerUnit: number;
  marginDirectPct: number;

  // Profit analysis
  profitPerUnit: number;
  marginPct: number;

  // With player's actual config (bonuses + factory count)
  cyclesPerHour: number;
  outputPerHour: number;
  outputPerDay: number;
  profitPerHour: number;
  profitPerDay: number;

  // Sell vs use-as-input analysis
  usedAsInputIn: Array<{
    resource: string;
    amountConsumedPerUnit: number;
    valueAddedPerUnit: number;
    betterToUseAsInput: boolean;
  }>;

  // Best use recommendation
  bestUse: 'sell_raw' | 'craft_self' | 'buy_and_craft' | 'use_as_input' | 'nothing';

  // Full chain breakdown
  chain: ChainNode[];

  // Player config used
  factoryCount: number;
  level: number;
  mastery: number;
  workshop: number;
  workers: number;
  boost: number;
}

/**
 * Recursively compute the full craft cost of 1 unit of resource,
 * using market buy prices for all sub-resources.
 */
function computeCraftCostRecursive(
  resource: string,
  prices: TokenPrices,
  visited: Set<string> = new Set()
): { totalCost: number; chain: ChainNode[] } {
  if (visited.has(resource)) {
    return { totalCost: 0, chain: [] };
  }
  visited.add(resource);

  const levels = FACTORIES_DATA[resource];
  if (!levels || levels.length === 0) {
    // Not craftable — no factory entry (e.g. COIN, ENERGY, or raw like WATER)
    // Use market buy price as replacement cost
    const cost = prices[resource] ? prices[resource].buy : 0;
    return {
      totalCost: cost,
      chain: [{ resource, amount: 1, costCoin: cost, isBase: true, children: [] }]
    };
  }

  const lvl1 = levels[0];
  const hasInput1 = lvl1.input1 && lvl1.input1_amt > 0;
  const hasInput2 = lvl1.input2 && lvl1.input2_amt > 0;

  if (!hasInput1 && !hasInput2) {
    // Basic resource (mined, no inputs)
    // Cost is the market buy price (opportunity cost)
    const cost = prices[resource] ? prices[resource].buy : 0;
    return {
      totalCost: cost,
      chain: [{ resource, amount: 1, costCoin: cost, isBase: true, children: [] }]
    };
  }

  // It's a crafted resource — sum up input costs
  let totalCost = 0;
  let children: ChainNode[] = [];

  if (hasInput1) {
    const sub = computeCraftCostRecursive(lvl1.input1!, prices, new Set(visited));
    const inputCost = sub.totalCost * lvl1.input1_amt;
    totalCost += inputCost;
    children.push({
      resource: lvl1.input1!,
      amount: lvl1.input1_amt,
      costCoin: inputCost,
      isBase: sub.chain.length === 1 && sub.chain[0].isBase,
      children: sub.chain
    });
  }

  if (hasInput2) {
    const sub = computeCraftCostRecursive(lvl1.input2!, prices, new Set(visited));
    const inputCost = sub.totalCost * lvl1.input2_amt;
    totalCost += inputCost;
    children.push({
      resource: lvl1.input2!,
      amount: lvl1.input2_amt,
      costCoin: inputCost,
      isBase: sub.chain.length === 1 && sub.chain[0].isBase,
      children: sub.chain
    });
  }

  return {
    totalCost,
    chain: [{ resource, amount: 1, costCoin: totalCost, isBase: false, children }]
  };
}

/**
 * Check which resources use a given resource as input.
 */
function getResourcesThatUseAsInput(resourceName: string): string[] {
  const result: string[] = [];
  Object.keys(FACTORIES_DATA).forEach(name => {
    const lvl1 = FACTORIES_DATA[name][0];
    if (lvl1.input1 === resourceName || lvl1.input2 === resourceName) {
      result.push(name);
    }
  });
  return result;
}

/**
 * Compute full profitability analysis for ALL resources.
 */
export function computeAllProfitability(
  prices: TokenPrices,
  playerConfig: Record<string, ResourceConfig>
): ResourceProfit[] {
  const results: ResourceProfit[] = [];

  Object.keys(FACTORIES_DATA).forEach(name => {
    const cfg = playerConfig[name] || { factories: 0, level: 1, mastery: 0, workers: 0, workshop: 0, boost: 1 };
    const levels = FACTORIES_DATA[name];
    const lvl1 = levels[0];

    const hasInput1 = lvl1.input1 && lvl1.input1_amt > 0;
    const hasInput2 = lvl1.input2 && lvl1.input2_amt > 0;
    const isBasic = !hasInput1 && !hasInput2;

    // Category
    let category: 'basic' | 'crafted' | 'keys' = 'crafted';
    if (isBasic) category = 'basic';
    if (['KEY', 'GLASSKEY', 'CERAMICKEY', 'DYNOKEY'].includes(name)) category = 'keys';

    // Market prices
    const buyPrice = prices[name]?.buy || 0;
    const sellPrice = prices[name]?.sell || 0;

    // Craft cost (recursive, buying all sub-resources at market)
    const { totalCost: craftCostPerUnit } = isBasic
      ? { totalCost: buyPrice } // buying raw = market price
      : computeCraftCostRecursive(name, prices);

    // Profit margin (deep chain — all sub-resources from base, at market buy prices)
    const profitPerUnit = sellPrice - craftCostPerUnit;
    const marginPct = craftCostPerUnit > 0 ? (profitPerUnit / craftCostPerUnit) * 100 : 0;

    // Use the player's actual level data + bonuses for production rates
    const levelIdx = Math.min(cfg.level, levels.length) - 1;
    const levelData = levels[levelIdx] || lvl1;
    const baseDurationSec = levelData.duration_sec || 3600;
    const outputPerCycle = levelData.output || 1;

    const wsPct = getWorkshopBoostPercent(name, cfg.workshop);
    const totalSpeedPct = wsPct + (cfg.workers || 0);
    const boostMult = cfg.boost || 1;
    const speedDur = applyWorkshopSpeedToDuration(baseDurationSec, totalSpeedPct);
    const effDur = applyFactoryBoostToDuration(speedDur, boostMult);
    const finalCycleDurationSec = Math.max(0.1, effDur);
    const cyclesPerHour = getRunsPerHour(finalCycleDurationSec);
    const outputPerHour = outputPerCycle * cyclesPerHour * cfg.factories;
    const outputPerDay = outputPerHour * 24;

    // Direct input cost using player's actual level + mastery (buy inputs at market)
    // Mastery reduces INPUT (Craft-Companion: input × (1 - reduction%))
    const dirInput1Amt = applyMasteryReduction(levelData.input1_amt, cfg.mastery);
    const dirInput2Amt = applyMasteryReduction(levelData.input2_amt, cfg.mastery);
    const dirInput1Price = levelData.input1 ? prices[levelData.input1]?.buy || 0 : 0;
    const dirInput2Price = levelData.input2 ? prices[levelData.input2]?.buy || 0 : 0;
    const directInputCost = dirInput1Amt * dirInput1Price + dirInput2Amt * dirInput2Price;
    const directProfit = sellPrice - directInputCost;
    const marginDirectPct = directInputCost > 0 ? (directProfit / directInputCost) * 100 : 0;

    // Profit with bonuses — account for input costs too (same as directInputCost)
    const inputCostPerCycle = directInputCost;
    const revenuePerCycle = outputPerCycle * sellPrice;
    const profitPerCycleActual = revenuePerCycle - inputCostPerCycle;

    const profitPerHourActual = profitPerCycleActual * cyclesPerHour * cfg.factories;
    const profitPerDayActual = profitPerHourActual * 24;

    // Find which resources use this as input
    const usedAsInputIn: ResourceProfit['usedAsInputIn'] = [];
    const downstream = getResourcesThatUseAsInput(name);
    downstream.forEach(downstreamName => {
      const dlvl = FACTORIES_DATA[downstreamName]?.[0];
      if (!dlvl) return;
      const amtConsumed = dlvl.input1 === name ? dlvl.input1_amt : dlvl.input2_amt;
      if (amtConsumed <= 0) return;

      // What's the downstream resource's profitability?
      const downSellPrice = prices[downstreamName]?.sell || 0;

      // Value added per unit of THIS resource when used to craft the downstream one
      const otherInputCost = dlvl.input1 === name
        ? (dlvl.input2_amt * (prices[dlvl.input2!]?.buy || 0))
        : (dlvl.input1_amt * (prices[dlvl.input1!]?.buy || 0));
      const valueCreatedPerUnit = (downSellPrice - otherInputCost) / amtConsumed;

      usedAsInputIn.push({
        resource: downstreamName,
        amountConsumedPerUnit: amtConsumed,
        valueAddedPerUnit: valueCreatedPerUnit,
        betterToUseAsInput: valueCreatedPerUnit > sellPrice * 1.05, // 5% threshold to account for effort
      });
    });

    // Best use recommendation
    let bestUse: ResourceProfit['bestUse'] = 'nothing';
    if (cfg.factories > 0 && profitPerCycleActual > 0) {
      // We have active factories and they're profitable
      bestUse = isBasic ? 'sell_raw' : 'craft_self';
    } else if (profitPerUnit > 0 && !isBasic) {
      bestUse = 'buy_and_craft';
    } else if (isBasic && sellPrice > 0) {
      bestUse = 'sell_raw';
    }

    // Check if any downstream use is better
    const hasBetterUseAsInput = usedAsInputIn.some(u => u.betterToUseAsInput);
    if (hasBetterUseAsInput && (profitPerCycleActual <= 0 || isBasic)) {
      bestUse = 'use_as_input';
    }

    // Full chain breakdown
    const { chain } = isBasic
      ? { chain: [{ resource: name, amount: 1, costCoin: sellPrice, isBase: true, children: [] } as ChainNode] }
      : computeCraftCostRecursive(name, prices);

    results.push({
      name,
      category,
      buyPrice,
      sellPrice,
      craftCostPerUnit,
      isCraftable: !isBasic,
      directInputCostPerUnit: directInputCost,
      marginDirectPct,
      profitPerUnit,
      marginPct,
      cyclesPerHour,
      outputPerHour,
      outputPerDay,
      profitPerHour: profitPerHourActual,
      profitPerDay: profitPerDayActual,
      usedAsInputIn,
      bestUse,
      chain,
      factoryCount: cfg.factories,
      level: cfg.level,
      mastery: cfg.mastery,
      workshop: cfg.workshop,
      workers: cfg.workers,
      boost: cfg.boost,
    });
  });

  return results.sort((a, b) => b.profitPerHour - a.profitPerHour);
}

// ── Sensitivity / What-If Analysis ──────────────────────────────────────────

export interface LevelProfitEntry {
  level: number;
  durationSec: number;
  outputPerDay: number;
  inputCostPerDay: number;
  revenuePerDay: number;
  profitPerDay: number;
  marginPct: number;
  upgradeCostCoin: number;
  cumulativeCostCoin: number;
  roiDays: number;
}

export interface MasteryProfitEntry {
  mastery: number;
  yieldFactor: number;
  effectiveYield: number;
  inputReductionPct: number;
  inputCostPerDay: number;
  profitPerDay: number;
  marginPct: number;
}

export interface SensitivityAnalysis {
  resourceName: string;
  currentLevel: number;
  currentMastery: number;
  currentWorkshop: number;
  currentWorkers: number;
  currentBoost: number;
  factoryCount: number;
  sellPrice: number;
  byLevel: LevelProfitEntry[];
  byMastery: MasteryProfitEntry[];
  breakevenLevel: number | null;
}

/**
 * Compute profit at every level for a resource using its current config bonuses.
 * Answers: "If I upgrade to level X, what's my profit?"
 */
export function computeLevelSensitivity(
  resourceName: string,
  prices: TokenPrices,
  cfg: ResourceConfig
): SensitivityAnalysis | null {
  const levels = FACTORIES_DATA[resourceName];
  if (!levels || levels.length === 0) return null;

  const sellPrice = prices[resourceName]?.sell || 0;

  const byLevel: LevelProfitEntry[] = [];
  let cumulativeCost = 0;

  for (let i = 0; i < levels.length; i++) {
    const levelData = levels[i];
    const levelNum = i + 1;
    const baseDurationSec = levelData.duration_sec || 3600;
    const outputPerCycle = levelData.output || 1;

    const wsPct = getWorkshopBoostPercent(resourceName, cfg.workshop);
    const totalSpeedPct = wsPct + (cfg.workers || 0);
    const boostMult = cfg.boost || 1;
    const speedDur = applyWorkshopSpeedToDuration(baseDurationSec, totalSpeedPct);
    const effDur = applyFactoryBoostToDuration(speedDur, boostMult);
    const finalCycleDurationSec = Math.max(0.1, effDur);
    const cyclesPerHour = getRunsPerHour(finalCycleDurationSec);
    const outputPerDay = outputPerCycle * cyclesPerHour * cfg.factories * 24;

    const input1Amt = applyMasteryReduction(levelData.input1_amt, cfg.mastery);
    const input2Amt = applyMasteryReduction(levelData.input2_amt, cfg.mastery);
    const input1Price = levelData.input1 ? prices[levelData.input1]?.buy || 0 : 0;
    const input2Price = levelData.input2 ? prices[levelData.input2]?.buy || 0 : 0;
    const inputCostPerCycle = input1Amt * input1Price + input2Amt * input2Price;
    const revenuePerCycle = outputPerCycle * sellPrice;
    const profitPerCycleActual = revenuePerCycle - inputCostPerCycle;

    const profitPerDay = profitPerCycleActual * cyclesPerHour * cfg.factories * 24;
    const revenuePerDay = revenuePerCycle * cyclesPerHour * cfg.factories * 24;
    const inputCostPerDay = inputCostPerCycle * cyclesPerHour * cfg.factories * 24;
    const marginPct = inputCostPerDay > 0 ? (profitPerDay / inputCostPerDay) * 100 : 0;

    // Upgrade cost from previous level (the cost to reach THIS level from previous)
    const upgradeCost = i > 0 && levels[i - 1].cost_symbol && levels[i - 1].cost_amount > 0
      ? levels[i - 1].cost_amount * (prices[levels[i - 1].cost_symbol]?.buy || 0)
      : 0;
    cumulativeCost += upgradeCost;

    // ROI: if upgrading from level-1 to level, days to recoup cost
    let roiDays = 0;
    if (i > 0 && byLevel.length > 0) {
      const prevProfit = byLevel[i - 1].profitPerDay;
      const roi = calculateUpgradeROI(upgradeCost, prevProfit, profitPerDay);
      roiDays = roi.paybackDays ?? Infinity;
    }

    byLevel.push({
      level: levelNum,
      durationSec: finalCycleDurationSec,
      outputPerDay,
      inputCostPerDay,
      revenuePerDay,
      profitPerDay,
      marginPct,
      upgradeCostCoin: upgradeCost,
      cumulativeCostCoin: cumulativeCost,
      roiDays,
    });
  }

  // Find first level where profit becomes positive
  const breakevenLevel = byLevel.find(e => e.profitPerDay > 0)?.level ?? null;

  // By mastery: vary mastery, keep current level fixed
  const currentLevelIdx = Math.min(cfg.level, levels.length) - 1;
  const lvlData = levels[currentLevelIdx];
  const byMastery: MasteryProfitEntry[] = [];

  if (lvlData && lvlData.input1_amt > 0) {
    for (let m = 0; m <= 200; m += 5) {
      const inputReductionPct = getMasteryReductionPercent(m);
      const yieldFactor = 1 - inputReductionPct / 100;
      const effectiveYield = lvlData.yield || 100;

      const input1Amt = applyMasteryReduction(lvlData.input1_amt, m);
      const input2Amt = applyMasteryReduction(lvlData.input2_amt, m);
      const input1Price = lvlData.input1 ? prices[lvlData.input1]?.buy || 0 : 0;
      const input2Price = lvlData.input2 ? prices[lvlData.input2]?.buy || 0 : 0;
      const inputCostPerCycle = input1Amt * input1Price + input2Amt * input2Price;

      const baseDur = lvlData.duration_sec || 3600;
      const wsPct = getWorkshopBoostPercent(resourceName, cfg.workshop);
      const totalPct = wsPct + (cfg.workers || 0);
      const bst = cfg.boost || 1;
      const durA = applyWorkshopSpeedToDuration(baseDur, totalPct);
      const durB = applyFactoryBoostToDuration(durA, bst);
      const finalDur = Math.max(0.1, durB);
      const cph = getRunsPerHour(finalDur);

      const profitPerDay = ((lvlData.output || 1) * sellPrice - inputCostPerCycle) * cph * cfg.factories * 24;
      const marginPct = inputCostPerCycle > 0
        ? (((lvlData.output || 1) * sellPrice - inputCostPerCycle) / inputCostPerCycle) * 100
        : 0;

      byMastery.push({
        mastery: m,
        yieldFactor,
        effectiveYield,
        inputReductionPct,
        inputCostPerDay: inputCostPerCycle * cph * cfg.factories * 24,
        profitPerDay,
        marginPct,
      });
    }
  }

  return {
    resourceName,
    currentLevel: cfg.level,
    currentMastery: cfg.mastery,
    currentWorkshop: cfg.workshop,
    currentWorkers: cfg.workers,
    currentBoost: cfg.boost,
    factoryCount: cfg.factories,
    sellPrice,
    byLevel,
    byMastery,
    breakevenLevel,
  };
}
