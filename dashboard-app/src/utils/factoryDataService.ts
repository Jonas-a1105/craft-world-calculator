import type { LevelData, FactoryData } from '../types/game';
import { FACTORIES_DATA } from '../assets/data/factories';

const CW_GRAPHQL_URL = '/api/game';

const FACTORY_DEFINITIONS_QUERY = `query {
  factoryDefinitions {
    id
    levels {
      input { symbol amount }
      output { symbol amount }
      cost { symbol amount }
    }
  }
}`;

interface ApiLevel {
  input: Array<{ symbol: string; amount: number }>;
  output: { symbol: string; amount: number };
  cost: Array<{ symbol: string; amount: number }>;
}

interface ApiFactoryDef {
  id: string;
  levels: ApiLevel[];
}

let initialized = false;
let initPromise: Promise<void> | null = null;
let version = 0;
const listeners = new Set<() => void>();

function createLevelData(
  apiLevel: ApiLevel,
  levelIndex: number,
  staticLevel?: LevelData,
  level1InputAmt?: number,
): LevelData {
  const in1 = apiLevel.input[0] || { symbol: '', amount: 0 };
  const in2 = apiLevel.input[1] || { symbol: '', amount: 0 };
  const cost = apiLevel.cost[0] || { symbol: '', amount: 0 };
  const outAmt = typeof apiLevel.output.amount === 'number' ? apiLevel.output.amount : 1;

  if (staticLevel) {
    // Derive exact yield from the API's input amounts relative to level 1
    let exactYield = staticLevel.yield;
    if (level1InputAmt && in1.amount > 0 && outAmt > 0) {
      const lvl1InputPerOutput = level1InputAmt / (staticLevel.output || outAmt);
      const currentInputPerOutput = in1.amount / outAmt;
      if (currentInputPerOutput > 0) {
        exactYield = parseFloat(((lvl1InputPerOutput / currentInputPerOutput) * 100).toFixed(4));
      }
    }

    return {
      level: levelIndex + 1,
      output: outAmt,
      duration: staticLevel.duration,
      duration_sec: staticLevel.duration_sec,
      input1: in1.symbol,
      // Keep static input amounts — they are consistent with the static yield.
      // The API often returns the same rounded values, and deriving yield from
      // rounded inputs creates an inconsistency (e.g. STEEL lv10: static
      // input1_amt=4.29 → API-derived yield=116.55 vs correct yield=116.51).
      input1_amt: staticLevel.input1_amt ?? in1.amount,
      input2: in2.symbol,
      input2_amt: staticLevel.input2_amt ?? in2.amount,
      // Keep static yield — it represents the correct per-level efficiency.
      yield: staticLevel.yield ?? exactYield,
      power_cost: staticLevel.power_cost,
      xp_per_output: staticLevel.xp_per_output,
      cost_symbol: cost.symbol,
      cost_amount: cost.amount,
      production_per_day: staticLevel.production_per_day,
      xp_per_day: staticLevel.xp_per_day,
      event: staticLevel.event || '',
    };
  }

  const approxDurationSec = 43200 - levelIndex * 600;
  const approxDurationHrs = Math.floor(approxDurationSec / 3600);
  const approxDurationMin = Math.floor((approxDurationSec % 3600) / 60);
  const durationStr = `${approxDurationHrs.toString().padStart(2, '0')}:${approxDurationMin.toString().padStart(2, '0')}:00`;
  const approxYield = Math.min(200, 100 + levelIndex * 2.5);
  const approxPpd = (86400 / approxDurationSec) * outAmt;

  return {
    level: levelIndex + 1,
    output: outAmt,
    duration: durationStr,
    duration_sec: approxDurationSec,
    input1: in1.symbol,
    input1_amt: in1.amount,
    input2: in2.symbol,
    input2_amt: in2.amount,
    yield: approxYield,
    power_cost: 5000,
    xp_per_output: 100000,
    cost_symbol: cost.symbol,
    cost_amount: cost.amount,
    production_per_day: parseFloat(approxPpd.toFixed(2)),
    xp_per_day: parseFloat(((86400 / approxDurationSec) * 100000).toFixed(2)),
    event: '',
  };
}

function patchFactoryDataInPlace(merged: FactoryData): void {
  for (const key of Object.keys(FACTORIES_DATA)) {
    delete FACTORIES_DATA[key];
  }
  for (const [key, value] of Object.entries(merged)) {
    FACTORIES_DATA[key] = value;
  }
  version++;
  listeners.forEach(cb => cb());
  listeners.clear();
}

export async function initFactoryData(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const res = await fetch(CW_GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: FACTORY_DEFINITIONS_QUERY,
          variables: null,
        }),
      });

      if (!res.ok) {
        console.warn('[factoryData] API unavailable, keeping static data');
        return;
      }

      const json = await res.json();

      if (json.errors || !json.data?.factoryDefinitions) {
        console.warn('[factoryData] API error, keeping static data', json.errors);
        return;
      }

      const apiDefs: ApiFactoryDef[] = json.data.factoryDefinitions;
      const result: FactoryData = {};

      for (const def of apiDefs) {
        const symbol = def.id;
        const staticLevels = FACTORIES_DATA[symbol] || [];
        const lastStaticLvl = staticLevels[staticLevels.length - 1];
        // Get the precise level-1 input amount from the API to derive exact yields
        const lvl1Api = def.levels[0];
        const lvl1InputAmt = lvl1Api?.input?.[0]?.amount;
        const levels: LevelData[] = def.levels.map((apiLevel, idx) => {
          const staticLvl = staticLevels[idx] || lastStaticLvl;
          return createLevelData(apiLevel, idx, staticLvl, lvl1InputAmt);
        });
        result[symbol] = levels;
      }

      for (const symbol of Object.keys(FACTORIES_DATA)) {
        if (!result[symbol]) {
          result[symbol] = FACTORIES_DATA[symbol];
        }
      }

      patchFactoryDataInPlace(result);
    } catch (err) {
      console.warn('[factoryData] Fetch failed, keeping static data', err);
    } finally {
      initialized = true;
      listeners.forEach(cb => cb());
      listeners.clear();
    }
  })();

  return initPromise;
}

export function getFactoryDataVersion(): number {
  return version;
}

export function onFactoryDataReady(callback: () => void): void {
  if (initialized) {
    callback();
  } else {
    listeners.add(callback);
  }
}

export function getFactoryData(): FactoryData {
  return FACTORIES_DATA;
}

export function getLevelData(symbol: string, levelIndex: number): LevelData | undefined {
  const levels = FACTORIES_DATA[symbol];
  if (!levels || levelIndex < 0 || levelIndex >= levels.length) return undefined;
  return levels[levelIndex];
}

export function getFactoryNames(): string[] {
  return Object.keys(FACTORIES_DATA);
}
