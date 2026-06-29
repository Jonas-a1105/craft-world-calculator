import type { FactoryBoost } from './factoryBoostModifiers';
import { applyFactoryBoostsToDuration, getActiveFactoryBoostPercent, getTotalFactoryBoostMultiplier } from './factoryBoostModifiers';
import type { ProficiencyItem } from './masteryModifiers';
import { applyMasteryInputReduction, getMasteryInputReductionPercent, getMasteryLevel } from './masteryModifiers';
import type { WorkshopItem } from './workshopModifiers';
import { applyWorkshopSpeedToDuration, getWorkshopSpeedBoostPercent } from './workshopModifiers';
import type { PriceData } from '../utils/priceService';

export type FactoryCycleContext = {
  factoryCount?: number;
  activeBoosts?: FactoryBoost[];
  workshop?: WorkshopItem[];
  proficiencies?: ProficiencyItem[];
  manualBoostMultiplier?: number;
  workersPercent?: number;
};

export type FactoryCycleResult = {
  runtimeMinutes: number;
  runtimeSeconds: number;
  runsPerHour: number;
  runsPerDay: number;
  outputPerCycle: number;
  outputPerHour: number;
  outputPerDay: number;
  input1PerCycle: number;
  input2PerCycle: number;
  inputCostPerCycle: number;
  revenuePerCycle: number;
  profitPerCycle: number;
  profitPerHour: number;
  profitPerDay: number;
  marginPercent: number | null;
  xpPerCycle: number;
  xpPerHour: number;
  xpPerDay: number;
  xpPerCoin: number | null;
  powerCostPerCycle: number;
  powerCostPerHour: number;
  workshopBoostPercent: number;
  activeBoostPercent: number;
  activeBoostMultiplier: number;
  masteryLevel: number;
  masteryReductionPercent: number;
};

const HOURS_PER_DAY = 24;
const SECONDS_PER_MINUTE = 60;

function finiteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampPositive(value: number, fallback = 0) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getFactoryCount(context: FactoryCycleContext = {}) {
  const count = Math.floor(finiteNumber(context.factoryCount, 1));
  return count > 0 ? count : 1;
}

function getManualBoostMultiplier(context: FactoryCycleContext = {}) {
  const multiplier = finiteNumber(context.manualBoostMultiplier, 1);
  return multiplier > 0 ? multiplier : 1;
}

function getWorkerMultiplier(context: FactoryCycleContext = {}) {
  const percent = finiteNumber(context.workersPercent, 0);
  return percent > 0 ? 1 + percent / 100 : 1;
}

export function getSellPrice(symbol: string, prices: Record<string, PriceData>): number {
  if (symbol === 'COIN') return 1;
  return prices[symbol]?.sell ?? 0;
}

export function getBuyPrice(symbol: string, prices: Record<string, PriceData>): number {
  if (symbol === 'COIN') return 1;
  return prices[symbol]?.buy ?? 0;
}

export function calculateFactoryRuntime(
  baseDurationSec: number,
  token: string,
  context: FactoryCycleContext = {}
) {
  const baseMinutes = baseDurationSec / SECONDS_PER_MINUTE;
  const ws = context.workshop || [];
  const wsDuration = applyWorkshopSpeedToDuration(baseMinutes, token, ws);
  const boostedDuration = applyFactoryBoostsToDuration(wsDuration, context.activeBoosts || []);
  const manualDuration = boostedDuration / getManualBoostMultiplier(context);
  const workerDuration = manualDuration / getWorkerMultiplier(context);
  return clampPositive(workerDuration, 0) * SECONDS_PER_MINUTE;
}

export function calculateProductionPerHour(
  outputPerCycle: number,
  runtimeSeconds: number,
  factoryCount: number
) {
  return runtimeSeconds > 0 ? outputPerCycle * factoryCount * (3600 / runtimeSeconds) : 0;
}

export function calculateProductionPerDay(outputPerHour: number) {
  return outputPerHour * HOURS_PER_DAY;
}

export function calculateAdjustedInputAmount(amount: number, token: string, context: FactoryCycleContext = {}) {
  return applyMasteryInputReduction(amount, token, context.proficiencies || []);
}

export function calculateInputCost(
  input1: string | undefined, input1Amt: number,
  input2: string | undefined, input2Amt: number,
  prices: Record<string, PriceData>,
  context: FactoryCycleContext = {}
) {
  const i1Amt = input1 ? calculateAdjustedInputAmount(input1Amt, input1, context) : 0;
  const i2Amt = input2 ? calculateAdjustedInputAmount(input2Amt, input2, context) : 0;
  const i1Price = input1 ? getBuyPrice(input1, prices) : 0;
  const i2Price = input2 ? getBuyPrice(input2, prices) : 0;
  return (i1Amt * i1Price + i2Amt * i2Price) * getFactoryCount(context);
}

export function calculateRevenue(
  output: string, outputPerCycle: number,
  prices: Record<string, PriceData>,
  context: FactoryCycleContext = {}
) {
  return outputPerCycle * getFactoryCount(context) * getSellPrice(output, prices);
}

export function calculateProfitPerCycle(
  output: string, outputPerCycle: number,
  input1: string | undefined, input1Amt: number,
  input2: string | undefined, input2Amt: number,
  prices: Record<string, PriceData>,
  context: FactoryCycleContext = {}
) {
  const rev = calculateRevenue(output, outputPerCycle, prices, context);
  const cost = calculateInputCost(input1, input1Amt, input2, input2Amt, prices, context);
  return rev - cost;
}

export function calculateProfitPerHour(profitPerCycle: number, runtimeSeconds: number) {
  return runtimeSeconds > 0 ? profitPerCycle * (3600 / runtimeSeconds) : 0;
}

export function calculateProfitPerDay(profitPerHour: number) {
  return profitPerHour * HOURS_PER_DAY;
}

export function calculatePowerCostPerHour(powerCost: number, runtimeSeconds: number, factoryCount: number) {
  return runtimeSeconds > 0 ? powerCost * factoryCount * (3600 / runtimeSeconds) : 0;
}

export function calculateXpPerHour(xpPerOutput: number, outputPerCycle: number, runtimeSeconds: number, factoryCount: number) {
  const xpPerCycle = xpPerOutput * outputPerCycle * factoryCount;
  return runtimeSeconds > 0 ? xpPerCycle * (3600 / runtimeSeconds) : 0;
}

export function calculateXpPerCoin(xpPerOutput: number, outputPerCycle: number, inputCost: number, factoryCount: number) {
  return inputCost > 0 ? (xpPerOutput * outputPerCycle * factoryCount) / inputCost : null;
}

export function calculateFactoryCycle(
  token: string,
  baseDurationSec: number,
  outputPerCycle: number,
  input1: string | undefined, input1Amt: number,
  input2: string | undefined, input2Amt: number,
  powerCost: number,
  xpPerOutput: number,
  prices: Record<string, PriceData>,
  context: FactoryCycleContext = {}
): FactoryCycleResult {
  const factoryCount = getFactoryCount(context);
  const runtimeSeconds = calculateFactoryRuntime(baseDurationSec, token, context);
  const runtimeMinutes = runtimeSeconds / SECONDS_PER_MINUTE;
  const runsPerHour = runtimeSeconds > 0 ? 3600 / runtimeSeconds : 0;
  const runsPerDay = runsPerHour * HOURS_PER_DAY;

  const i1Amt = calculateAdjustedInputAmount(input1Amt, input1 || '', context);
  const i2Amt = input2 ? calculateAdjustedInputAmount(input2Amt, input2, context) : 0;
  const inputCost = calculateInputCost(input1, input1Amt, input2, input2Amt, prices, context);
  const revenue = calculateRevenue(token, outputPerCycle, prices, context);
  const profit = revenue - inputCost;

  return {
    runtimeMinutes,
    runtimeSeconds,
    runsPerHour,
    runsPerDay,
    outputPerCycle: outputPerCycle * factoryCount,
    outputPerHour: calculateProductionPerHour(outputPerCycle, runtimeSeconds, factoryCount),
    outputPerDay: calculateProductionPerHour(outputPerCycle, runtimeSeconds, factoryCount) * HOURS_PER_DAY,
    input1PerCycle: i1Amt * factoryCount,
    input2PerCycle: i2Amt * factoryCount,
    inputCostPerCycle: inputCost,
    revenuePerCycle: revenue,
    profitPerCycle: profit,
    profitPerHour: profit * runsPerHour,
    profitPerDay: profit * runsPerDay,
    marginPercent: revenue > 0 ? (profit / revenue) * 100 : null,
    xpPerCycle: xpPerOutput * outputPerCycle * factoryCount,
    xpPerHour: (xpPerOutput * outputPerCycle * factoryCount) * runsPerHour,
    xpPerDay: (xpPerOutput * outputPerCycle * factoryCount) * runsPerDay,
    xpPerCoin: inputCost > 0 ? (xpPerOutput * outputPerCycle * factoryCount) / inputCost : null,
    powerCostPerCycle: powerCost * factoryCount,
    powerCostPerHour: powerCost * factoryCount * runsPerHour,
    workshopBoostPercent: getWorkshopSpeedBoostPercent(token, context.workshop || []),
    activeBoostPercent: getActiveFactoryBoostPercent(context.activeBoosts || []),
    activeBoostMultiplier: getTotalFactoryBoostMultiplier(context.activeBoosts || []) * getManualBoostMultiplier(context) * getWorkerMultiplier(context),
    masteryLevel: getMasteryLevel(token, context.proficiencies || []),
    masteryReductionPercent: getMasteryInputReductionPercent(token, context.proficiencies || []),
  };
}

export function calculateUpgradeROI(
  upgradeCostCoin: number,
  currentProfitPerDay: number,
  nextProfitPerDay: number
) {
  const extraProfit = nextProfitPerDay - currentProfitPerDay;
  return {
    upgradeCost: upgradeCostCoin > 0 ? upgradeCostCoin : null,
    extraProfitPerDay: extraProfit,
    paybackDays: upgradeCostCoin > 0 && extraProfit > 0 ? upgradeCostCoin / extraProfit : null,
  };
}
