/**
 * craftWorldService.ts — Direct CraftWorld GraphQL integration
 *
 * Implements:
 *   1. Token normalization (jwt_ prefix for Firebase tokens)
 *   2. The complete AggregatedCraftWorldDataQuery (same query the game client uses)
 *   3. Parsing of the massive response into PlayerAccountInfo
 *   4. Auto-refresh helper with UID resolution
 *
 * Reference: procesodeobtcwt.txt and datagame.txt
 */

import type {
  PlayerAccountInfo,
  PlayerMine,
  PlayerResource,
  DynoInfo,
  VaultInfo,
  WorkerInfo,
  ResearchInfo,
  PowerPlantInfo,
} from './accountService';

// ─── Constants ───

const CW_GRAPHQL_URL = '/api/game'; // Proxied by Vite to https://craft-world.gg/graphql
const CW_APP_VERSION = '1.15.1';

// ─── Token Normalization ───

/**
 * CraftWorld expects Firebase tokens prefixed with "jwt_".
 * If the token is a standard Firebase JWT (3 dot-separated parts),
 * prefix it with "jwt_". If it already starts with "jwt_", leave it alone.
 */
export function normalizeCraftWorldToken(token: string): string {
  const value = String(token || '').trim();
  if (!value) throw new Error('Missing CraftWorld token');

  // Already normalized
  if (value.startsWith('jwt_')) return value;

  // Standard Firebase JWT has 3 dot-separated segments
  if ((value.match(/\./g) || []).length >= 2) {
    return `jwt_${value}`;
  }

  return value;
}

/**
 * Decode JWT payload to extract UID without a library.
 */
export function decodeJWTPayload(token: string): Record<string, any> {
  try {
    const cleanToken = token.startsWith('jwt_') ? token.slice(4) : token;
    const parts = cleanToken.split('.');
    if (parts.length < 2) return {};
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payload);
  } catch {
    return {};
  }
}

// ─── The Complete AggregatedCraftWorldDataQuery ───

const AGGREGATED_QUERY = `
query AggregatedCraftWorldDataQuery {
  features {
    name
    active
  }

  dynoProductionCycle {
    startedAt
    millisecondsPerCompletion
  }

  events {
    id name code startTime endTime minLevelIndex skinName detailsText infoText
  }

  resources {
    symbol
    rank
    chainId
    features
    conversions {
      symbol
      factor
    }
    isFixed
    sector
    contractAddress
  }

  account {
    id
    experiencePoints
    power
    powerLastRefill
    skillPoints
    leagueId
    updatedAt
    walletAddress
    claimedMasterpieceIds
    resources { symbol amount }
    lastUserActionAt
    deletedAt
    isNoAdsActive
    globalCoordinate { x y }
    adWatchCounts { adPlacement count resetsAt }
    activeMasterpieceBattlePasses
    seasonPasses
    isTransferActive
    blockedWithdraw
    shopItemPurchases { shopItemId purchasedAt }
    crystalPass {
      claimableCrystals
      claimableDays
      remainingDays
      maxDays
      hasActivePass
      isClaimable
    }
    claimedDiscordJoinReward
    tradeAccount {
      tradeCount
      dailyRefillAmount
      totalTradeAmount
      capacity
    }
    currencyBalances { type amount }

    availableAvatars { avatarUrl isEns }

    workers {
      id
      name
      skin
      areaBoostValue
      areaUuid
      isAreaLead
      traits
      training {
        id
        workerSlotIndex
        universitySlotIndex
        universityBuildingId
        startedAt
        readyAt
      }
      abilityId
      abilityActivation {
        effect
        activatedAt
        expiresAt
      }
      cooldownEndsAt
    }

    eggs { definitionId amount }
    eggGuaranteeProgress { eggDefinitionId hatchesSinceGuarantee hatchesUntilGuaranteed }
    chests { definitionId count }
    blueprintInventory { definitionId amount starLevel landPlotUuids }
    factoryInventory { id definitionId level }

    wallets { address type provider providerId primary }

    mines {
      id
      definition { id }
      startedAt
      claimedAt
      level
      currentRunLevel
      unclaimedUnitsBeforeCurrentRun
      boostValue
      boostedNextRun
      consumableBoosters {
        id startTime endTime boostValue
      }
    }

    researches {
      symbol
      remainingInMilliseconds
      claimed
    }

    dynos {
      production { symbol amount }
      claimableResources { symbol amount }
      meta {
        displayName
        imageUrl
        rarity
        isOneOfOne
      }
    }

    landPlots {
      id
      name
      isLocked
      appliedBlueprint { definitionId starLevel landPlotUuids }
      areas {
        id
        symbol
        landPlotId
        landPlotPosition
        factories {
          factory {
            id
            level
            definition { id }
          }
          crafting {
            currentRunLevel
            startedAt
            claimedAt
            unclaimedUnitsBeforeCurrentRun
          }
          boosters { startTime endTime boostValue }
          consumableBoosters { id startTime endTime boostValue }
          workerBoostIntervals { startTime endTime boostValue }
        }
      }
      booster { startTime endTime boostValue }
    }

    fullPlayerBase {
      ownedSpaceIds
      buildings {
        id type level subType
        pos { x y }
        upgradedAt readyAt
      }
      powerPlants {
        buildingId
        lastClaimedAt
        storedPower
        inputAmount
        runningLevel
        activeBoosters { boosterId expiresAt }
      }
      hatchStates {
        hatcheryId eggDefinitionId slotId
        hatchStartTime hatchEndTime
        rolledSkin rolledBoostValue rolledName rolledAt
      }
      occupiedBuildingCapacity
      totalBuildingCapacity
    }

    vaults {
      symbol amount capacity isUnlocked buildingUnlockLevel
    }

    workshop { symbol level }

    proficiencies { symbol collectedAmount claimedLevel }

    profile { uid walletAddress avatarUrl displayName }

    announcements { id title body goToEvent minLevel createdAt }

    availablePowerPacks { id amount }
    availableBoosters { id amount }

    resourcesOnChain { symbol amount }
  }
}
`;

// ─── API Call ───

export async function fetchAggregatedCraftWorldData(idToken: string): Promise<{
  account: any;
  features: any[];
  dynoProductionCycle: any;
  events: any[];
  resources: any[];
}> {
  const normalizedToken = normalizeCraftWorldToken(idToken);

  console.log('🌐 Calling CraftWorld AggregatedCraftWorldDataQuery...');

  const res = await fetch(CW_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-app-version': CW_APP_VERSION,
      'Authorization': `Bearer ${normalizedToken}`,
    },
    body: JSON.stringify({
      query: AGGREGATED_QUERY,
      variables: null,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`CraftWorld API error: HTTP ${res.status} — ${errorText.slice(0, 200)}`);
  }

  const json = await res.json();

  if (json.errors) {
    console.error('❌ CraftWorld GraphQL errors:', json.errors);
    throw new Error(`CraftWorld GraphQL error: ${json.errors[0]?.message || 'Unknown error'}`);
  }

  console.log('✅ AggregatedCraftWorldDataQuery succeeded');

  return {
    account: json.data?.account || null,
    features: json.data?.features || [],
    dynoProductionCycle: json.data?.dynoProductionCycle || null,
    events: json.data?.events || [],
    resources: json.data?.resources || [],
  };
}

// ─── Parse Response into PlayerAccountInfo ───

const RAW_RESOURCES = [
  'EARTH', 'WATER', 'FIRE', 'DYNOFISH', 'MAGICSHARD', 'BURNTRICE',
  'WOOD', 'STONE', 'COAL', 'IRON', 'GOLD',
];

export function parseAggregatedData(
  account: any,
  fallbackIdToken?: string,
  features?: Array<{ name: string; active: boolean }>,
  events?: Array<{ id: string; name: string; code: string; startTime: string; endTime: string; minLevelIndex: number }>,
): PlayerAccountInfo {
  if (!account) {
    throw new Error('No account data returned from CraftWorld');
  }

  // ─── Extract mines and factories from multiple sources ───
  const extractedMines: PlayerMine[] = [];
  const extractedFactories: PlayerMine[] = [];
  const extractedPowerPlants: PlayerMine[] = [];
  const extractedBatteries: PlayerMine[] = [];

  const classifyAndPush = (symbol: string, level: number, id: string) => {
    const buildingObj: PlayerMine = {
      id,
      level: level + 1, // CraftWorld API returns 0-indexed levels
      definition: { id: symbol },
    };
    if (symbol.includes('POWER') || symbol.includes('PLANT')) {
      extractedPowerPlants.push(buildingObj);
    } else if (symbol.includes('BATTERY') || symbol.includes('ACCUMULATOR')) {
      extractedBatteries.push(buildingObj);
    } else if (RAW_RESOURCES.includes(symbol) || symbol.includes('MINE') || symbol.includes('COLLECTOR') || symbol.includes('EXTRACTOR')) {
      extractedMines.push(buildingObj);
    } else {
      extractedFactories.push(buildingObj);
    }
  };

  // From account.mines
  if (account.mines) {
    account.mines.forEach((m: any) => {
      const symbol = (m.definition?.id || m.id || '').toUpperCase();
      classifyAndPush(symbol, m.level, m.id);
    });
  }

  // From account.landPlots → areas → factories
  if (account.landPlots) {
    account.landPlots.forEach((plot: any) => {
      if (plot.areas) {
        plot.areas.forEach((area: any) => {
          if (area.factories) {
            area.factories.forEach((f: any) => {
              if (f.factory) {
                const symbol = (f.factory.definition?.id || f.factory.id || '').toUpperCase();
                classifyAndPush(symbol, f.factory.level, f.factory.id);
              }
            });
          }
        });
      }
    });
  }

  // From account.factoryInventory
  if (account.factoryInventory) {
    account.factoryInventory.forEach((f: any) => {
      const symbol = (f.definitionId || f.id || '').toUpperCase();
      classifyAndPush(symbol, f.level, f.id);
    });
  }

  // ─── Resources ───
  const resources: PlayerResource[] = (account.resources || []).map((r: any) => ({
    symbol: r.symbol,
    amount: r.amount,
  }));

  // ─── Resources On Chain ───
  const resourcesOnChain: PlayerResource[] = (account.resourcesOnChain || []).map((r: any) => ({
    symbol: r.symbol,
    amount: r.amount,
  }));

  // ─── Dynos ───
  const dynos: DynoInfo[] = (account.dynos || []).map((d: any) => ({
    production: d.production || [],
    claimableResources: d.claimableResources || [],
    meta: {
      displayName: d.meta?.displayName || '',
      imageUrl: d.meta?.imageUrl,
      rarity: d.meta?.rarity || '',
      isOneOfOne: d.meta?.isOneOfOne,
    },
  }));

  // ─── Vaults ───
  const vaults: VaultInfo[] = (account.vaults || []).map((v: any) => ({
    symbol: v.symbol,
    amount: v.amount,
    capacity: v.capacity,
    isUnlocked: v.isUnlocked,
    buildingUnlockLevel: v.buildingUnlockLevel,
  }));

  // ─── Workers ───
  const workers: WorkerInfo[] = (account.workers || []).map((w: any) => ({
    id: w.id,
    name: w.name,
    skin: w.skin,
    areaBoostValue: w.areaBoostValue || 0,
    areaUuid: w.areaUuid,
    isAreaLead: w.isAreaLead,
    traits: w.traits,
    training: w.training,
    abilityId: w.abilityId,
    abilityActivation: w.abilityActivation,
    cooldownEndsAt: w.cooldownEndsAt,
  }));

  // ─── Researches ───
  const researches: ResearchInfo[] = (account.researches || []).map((r: any) => ({
    symbol: r.symbol,
    remainingInMilliseconds: r.remainingInMilliseconds,
    claimed: r.claimed,
  }));

  // ─── Power Plants (detailed) ───
  const detailedPowerPlants: PowerPlantInfo[] = (account.fullPlayerBase?.powerPlants || []).map((pp: any) => ({
    buildingId: pp.buildingId,
    lastClaimedAt: pp.lastClaimedAt,
    storedPower: pp.storedPower || 0,
    inputAmount: pp.inputAmount || 0,
    runningLevel: pp.runningLevel || 0,
    activeBoosters: pp.activeBoosters,
  }));

  // ─── Workshop level from buildings ───
  let workshopLevel = 0;
  if (account.fullPlayerBase?.buildings) {
    const ws = account.fullPlayerBase.buildings.find((b: any) => b.type === 'WORKSHOP');
    if (ws) {
      workshopLevel = ws.level;
    }
  }

  // ─── Profile / UID ───
  const profile = account.profile || {};
  const uid = profile.uid || account.id || '';

  // If we couldn't get UID from account, try JWT payload
  let resolvedUid = uid;
  if (!resolvedUid && fallbackIdToken) {
    const payload = decodeJWTPayload(fallbackIdToken);
    resolvedUid = payload.uid || payload.user_id || payload.sub || '';
  }

  // ─── Build result ───
  const result: PlayerAccountInfo = {
    id: resolvedUid,
    walletAddress: account.walletAddress || profile.walletAddress || '',
    displayName: profile.displayName || `Player ${resolvedUid}`,
    level: 0, // level comes from XP calculation
    uid: resolvedUid,
    avatarUrl: profile.avatarUrl,

    // Buildings
    mines: extractedMines,
    factories: extractedFactories,
    powerPlants: extractedPowerPlants,
    batteries: extractedBatteries,

    // Resources
    resources,
    resourcesOnChain,

    // Workshop & Mastery
    workshopLevel,
    proficiencies: account.proficiencies || [],
    workshop: account.workshop || [],

    // Extended data
    dynos,
    vaults,
    workers,
    researches,
    detailedPowerPlants,
    experiencePoints: account.experiencePoints,
    power: account.power,
    powerLastRefill: account.powerLastRefill,
    skillPoints: account.skillPoints,
    tradeAccount: account.tradeAccount,
    crystalPass: account.crystalPass,
    eggs: account.eggs || [],
    chests: account.chests || [],
    blueprintInventory: account.blueprintInventory || [],
    availablePowerPacks: account.availablePowerPacks || [],
    availableBoosters: account.availableBoosters || [],
    currencyBalances: account.currencyBalances || [],

    // Timestamp
    lastDataRefresh: Date.now(),

    // Raw data preserved
    allRawData: { account, source: 'AggregatedCraftWorldDataQuery' },
    rawAccountData: account,
    rawFactoriesData: extractedFactories,

    // Global features and events
    features,
    events,
  };

  // ─── Log summary ───
  console.group('📊 CraftWorld Data Loaded');
  console.log(`👤 Player: ${result.displayName} (${resolvedUid})`);
  console.log(`⛏️ Mines: ${extractedMines.length}`);
  console.log(`🏭 Factories: ${extractedFactories.length}`);
  console.log(`⚡ Power Plants: ${extractedPowerPlants.length}`);
  console.log(`🦕 Dynos: ${dynos.length}`);
  console.log(`📦 Resources: ${resources.length}`);
  console.log(`🏪 Vaults: ${vaults.length}`);
  console.log(`👷 Workers: ${workers.length}`);
  console.log(`🔬 Researches: ${researches.length}`);
  console.log(`⭐ Workshop entries: ${(account.workshop || []).length}`);
  console.log(`🎯 Proficiencies: ${(account.proficiencies || []).length}`);
  console.log(`💰 Power: ${account.power}, XP: ${account.experiencePoints}`);
  if (features && features.length > 0) {
    console.log(`🌐 Features:`, features);
  }
  if (events && events.length > 0) {
    console.log(`📅 Events:`, events);
  }
  console.groupEnd();

  return result;
}

// ─── Convenience: fetch + parse in one call ───

export async function fetchFullPlayerData(idToken: string): Promise<PlayerAccountInfo> {
  const { account, features, events } = await fetchAggregatedCraftWorldData(idToken);
  return parseAggregatedData(account, idToken, features, events);
}
