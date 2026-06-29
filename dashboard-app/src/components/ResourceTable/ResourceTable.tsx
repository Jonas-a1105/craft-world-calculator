import React, { useEffect, useRef, useMemo } from 'react';
import anime from 'animejs';
import styles from './ResourceTable.module.css';
import { FACTORIES_DATA } from '../../assets/data/factories';
import { toCapitalCase } from '../../utils/string';
import type { TokenPrices, PriceData } from '../../utils/priceService';
import type { UsePlayerConfigReturn, ResourceConfig } from '../../hooks/usePlayerConfig';
import type { PriceDeltas } from '../../hooks/usePriceHistory';
import { getCategory, getEmoji, applyMasteryReduction, getMasteryYieldBonus, getWorkshopBoostPercent, applyWorkshopSpeedToDuration, applyFactoryBoostToDuration, getRunsPerHour } from '../../utils/gameHelpers';
import type { PlayerAccountInfo, PlayerMine } from '../../utils/accountService';


interface ResourceTableProps {
  prices: TokenPrices;
  coinPriceUsd: number;
  pricesLoading: boolean;
  playerConfig: UsePlayerConfigReturn;
  priceDeltas: PriceDeltas;
  balances?: Record<string, number> | null;
  gameBalances?: Record<string, number> | null;
  accountInfo?: PlayerAccountInfo | null;
}

interface ResourceRowProps {
  name: string;
  cfg: ResourceConfig;
  tokenPrice: PriceData | undefined;
  priceDelta: { delta1h: number | null; delta24h: number | null };
  prices: TokenPrices;
  pricesLoading: boolean;
  maxLevel: number;
  balance: number | undefined;
  gameBalance: number | undefined;
  factoryLevels: number[];
  coinPriceUsd: number;
}



function getCategoryStars(cat: 'basic' | 'crafted' | 'keys'): string {
  if (cat === 'basic') return '★';
  if (cat === 'keys') return '★★★';
  return '★★';
}

function getCategoryColor(cat: 'basic' | 'crafted' | 'keys'): string {
  if (cat === 'basic') return '#fbbf24';
  if (cat === 'keys') return '#c084fc';
  return '#38bdf8';
}

function formatCoinPrice(val: number): string {
  if (val === 0) return '—';
  if (val < 0.0001) return val.toFixed(6);
  if (val < 0.01) return val.toFixed(5);
  if (val < 1) return val.toFixed(4);
  return val.toFixed(2);
}

function formatDelta(val: number | null): { text: string; className: string } {
  if (val === null) return { text: '—', className: styles.deltaNeutral };
  const prefix = val >= 0 ? '▲' : '▼';
  const cls = val >= 0 ? styles.deltaPositive : styles.deltaNegative;
  return { text: `${prefix} ${Math.abs(val).toFixed(2)}%`, className: cls };
}

function formatPowerKw(watts: number): string {
  if (watts === 0) return '—';
  if (watts >= 1000) return `${(watts / 1000).toFixed(1)} kW`;
  return `${watts.toFixed(0)} W`;
}

function formatProfit(val: number): string {
  if (val === 0) return '—';
  const prefix = val >= 0 ? '+' : '';
  if (Math.abs(val) < 0.01) return `${prefix}${val.toFixed(4)}`;
  return `${prefix}${val.toFixed(2)}`;
}

function formatNumber(val: number, decimals = 2): string {
  if (val === 0) return '0';
  if (Math.abs(val) < 0.0001) return val.toExponential(2);
  if (Math.abs(val) < 0.01) return val.toFixed(6);
  if (Math.abs(val) < 1) return val.toFixed(4);
  if (Math.abs(val) < 1000) return val.toFixed(decimals);
  if (Math.abs(val) < 1000000) return val.toLocaleString(undefined, { maximumFractionDigits: decimals });
  return (val / 1000000).toFixed(2) + 'M';
}

// ─── Memoized Row Component ──────────────────────────────────────────────────

const ResourceRow: React.FC<ResourceRowProps> = React.memo(({
  name,
  cfg,
  tokenPrice,
  priceDelta,
  prices,
  maxLevel,
  balance,
  gameBalance,
  factoryLevels
}) => {
  const levels = FACTORIES_DATA[name];
  const levelIdx = Math.min(cfg.level, maxLevel) - 1;
  const levelData = levels[levelIdx] || levels[0];
  const category = getCategory(name);
  const catColor = getCategoryColor(category);
  const catStars = getCategoryStars(category);

  // Mastery reduces INPUT (Craft-Companion: input × (1 - reduction%))
  const finalInput1Amt = applyMasteryReduction(levelData.input1_amt, cfg.mastery);
  const finalInput2Amt = applyMasteryReduction(levelData.input2_amt, cfg.mastery);

  // Speed (Craft-Companion chain): workshop% → factory boost multiplier
  const wsPct = getWorkshopBoostPercent(name, cfg.workshop);
  const totalPct = wsPct + (cfg.workers || 0);
  const boostMult = cfg.boost || 1;
  const durA = applyWorkshopSpeedToDuration(levelData.duration_sec, totalPct);
  const durB = applyFactoryBoostToDuration(durA, boostMult);
  const finalCycleDurationSec = Math.max(0.1, durB);

  const cyclesPerHour = getRunsPerHour(finalCycleDurationSec);
  const cyclesPerDay = cyclesPerHour * 24;
  const powerCostPerHour = levelData.power_cost * cyclesPerHour * cfg.factories;

  // Production breakdown — all scaled by factoryCount for consistency with profit columns
  const outputPerCycle = levelData.output || 0;
  const outputPerHr = outputPerCycle * cyclesPerHour * cfg.factories;
  const outputPer24h = outputPerCycle * cyclesPerDay * cfg.factories;

  // Economics
  let inputCostPerCycle = 0;
  if (levelData.input1 && levelData.input1_amt > 0) {
    const inp1Price = prices[levelData.input1];
    if (inp1Price) {
      inputCostPerCycle += finalInput1Amt * inp1Price.buy;
    }
  }
  if (levelData.input2 && levelData.input2_amt > 0) {
    const inp2Price = prices[levelData.input2];
    if (inp2Price) {
      inputCostPerCycle += finalInput2Amt * inp2Price.buy;
    }
  }

  const revenuePerCycle = tokenPrice ? outputPerCycle * tokenPrice.sell : 0;
  const profitPerCycle = revenuePerCycle - inputCostPerCycle;
  const marginPct = revenuePerCycle > 0 ? (profitPerCycle / revenuePerCycle) * 100 : 0;

  const profitPerHour = profitPerCycle * cyclesPerHour * cfg.factories;
  const profitPer24h = profitPerCycle * cyclesPerDay * cfg.factories;

  // XP
  const xpPerCycle = levelData.xp_per_output || 0;
  const xpPerHour = xpPerCycle * cyclesPerHour * cfg.factories;
  const xpPer24h = xpPerCycle * cyclesPerDay * cfg.factories;
  const xpPerCoin = inputCostPerCycle > 0 ? xpPerCycle / inputCostPerCycle : 0;

  // Price deltas
  const d1h = formatDelta(priceDelta.delta1h);
  const d24h = formatDelta(priceDelta.delta24h);

  // Input prices for display
  const inp1Price = levelData.input1 ? prices[levelData.input1] : undefined;
  const inp2Price = levelData.input2 ? prices[levelData.input2] : undefined;

  // Factory levels display
  const sortedLevels = [...factoryLevels].sort((a, b) => b - a);
  const factoryLevelsStr = factoryLevels.length > 0
    ? sortedLevels.join(', ')
    : '—';

  return (
    <div className={styles.tableRow}>
      {/* Resource */}
      <div className={`${styles.cell} ${styles.cellResource}`}>
        <img
          src={`/assets/resources/${toCapitalCase(name)}.png`}
          className={styles.resourceIcon}
          alt={name}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div className={styles.resourceNameWrapper}>
          <span className={styles.resourceName}>{toCapitalCase(name)}</span>
          <div className={styles.balancesContainer}>
            {gameBalance !== undefined && gameBalance > 0 && (
              <span className={styles.gameBalanceText} title={`Saldo en Juego: ${gameBalance.toLocaleString()}`}>
                🎮 {gameBalance < 0.01 ? gameBalance.toFixed(4) : gameBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            )}
            {balance !== undefined && balance > 0 && (
              <span className={styles.balanceText} title={`Saldo en Wallet: ${balance.toLocaleString()}`}>
                💼 {balance < 0.01 ? balance.toFixed(4) : balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            )}
          </div>
        </div>
        <span className={styles.resourceStars} style={{ color: catColor }}>{catStars}</span>
      </div>

      {/* Entrada - Input 1 */}
      <div className={`${styles.cell} ${styles.cellInput}`}>
        {levelData.input1 && levelData.input1_amt > 0 ? (
          <div className={styles.inputCell}>
            <span className={styles.inputEmoji}>{getEmoji(levelData.input1)}</span>
            <span className={styles.inputAmt}>{formatNumber(finalInput1Amt, 2)}</span>
            <span className={styles.inputUnit}>{levelData.input1}</span>
            {inp1Price && (
              <span className={styles.inputCost}>{formatCoinPrice(finalInput1Amt * inp1Price.buy)} C</span>
            )}
          </div>
        ) : (
          <span className={styles.inactiveValue}>—</span>
        )}
      </div>

      {/* Entrada - Input 2 */}
      <div className={`${styles.cell} ${styles.cellInput}`}>
        {levelData.input2 && levelData.input2_amt > 0 ? (
          <div className={styles.inputCell}>
            <span className={styles.inputEmoji}>{getEmoji(levelData.input2)}</span>
            <span className={styles.inputAmt}>{formatNumber(finalInput2Amt, 2)}</span>
            <span className={styles.inputUnit}>{levelData.input2}</span>
            {inp2Price && (
              <span className={styles.inputCost}>{formatCoinPrice(finalInput2Amt * inp2Price.buy)} C</span>
            )}
          </div>
        ) : (
          <span className={styles.inactiveValue}>—</span>
        )}
      </div>

      {/* Salida / Output per cycle */}
      <div className={`${styles.cell} ${styles.cellOutput}`}>
        <span className={styles.outputValue}>{formatNumber(outputPerCycle)}</span>
        <span className={styles.outputUnit}>u/ciclo</span>
      </div>

      {/* Output per hour */}
      <div className={`${styles.cell} ${styles.cellOutput}`}>
        <span className={styles.outputValue}>{formatNumber(outputPerHr)}</span>
        <span className={styles.outputUnit}>u/hr</span>
      </div>

      {/* Output per 24h */}
      <div className={`${styles.cell} ${styles.cellOutput}`}>
        <span className={styles.outputValue}>{formatNumber(outputPer24h)}</span>
        <span className={styles.outputUnit}>u/24h</span>
      </div>

      {/* Costo / Cycle */}
      <div className={`${styles.cell} ${styles.cellResult}`}>
        {cfg.factories > 0 && inputCostPerCycle > 0 ? (
          <span className={styles.costValue}>
            {formatCoinPrice(inputCostPerCycle)}
            <img src="/assets/resources/Coin.png" className={styles.coinIconSmall} alt="C" />
          </span>
        ) : (
          <span className={styles.inactiveValue}>—</span>
        )}
      </div>

      {/* Venta / Sale Price */}
      <div className={`${styles.cell} ${styles.cellPrice}`}>
        {tokenPrice ? (
          <span className={styles.sellValue}>{formatCoinPrice(tokenPrice.sell)}<img src="/assets/resources/Coin.png" className={styles.coinIconSmall} alt="C" /></span>
        ) : (
          <span className={styles.inactiveValue}>—</span>
        )}
      </div>

      {/* Ganancia / Profit per cycle */}
      <div className={`${styles.cell} ${styles.cellResult}`}>
        {cfg.factories > 0 ? (
          <span className={profitPerCycle >= 0 ? styles.profitPositive : styles.profitNegative}>
            {formatProfit(profitPerCycle)}
          </span>
        ) : (
          <span className={styles.profitNeutral}>—</span>
        )}
      </div>

      {/* Profit per hour */}
      <div className={`${styles.cell} ${styles.cellResult}`}>
        {cfg.factories > 0 ? (
          <span className={profitPerHour >= 0 ? styles.profitPositive : styles.profitNegative}>
            {formatProfit(profitPerHour)} <img src="/assets/resources/Coin.png" className={styles.coinIcon} alt="COIN" />
          </span>
        ) : (
          <span className={styles.profitNeutral}>—</span>
        )}
      </div>

      {/* Profit per 24h */}
      <div className={`${styles.cell} ${styles.cellResult}`}>
        {cfg.factories > 0 ? (
          <span className={profitPer24h >= 0 ? styles.profitPositive : styles.profitNegative}>
            {formatProfit(profitPer24h)} <img src="/assets/resources/Coin.png" className={styles.coinIcon} alt="COIN" />
          </span>
        ) : (
          <span className={styles.profitNeutral}>—</span>
        )}
      </div>

      {/* Margen % */}
      <div className={`${styles.cell} ${styles.cellDelta}`}>
        {cfg.factories > 0 && revenuePerCycle > 0 ? (
          <span className={marginPct >= 0 ? styles.marginPositive : styles.marginNegative}>
            {marginPct >= 0 ? '+' : ''}{marginPct.toFixed(1)}%
          </span>
        ) : (
          <span className={styles.inactiveValue}>—</span>
        )}
      </div>

      {/* XP / Cycle */}
      <div className={`${styles.cell} ${styles.cellXp}`}>
        <span className={styles.xpValue}>{formatNumber(xpPerCycle, 0)}</span>
        <span className={styles.xpUnit}>XP/ciclo</span>
      </div>

      {/* XP / Hour */}
      <div className={`${styles.cell} ${styles.cellXp}`}>
        <span className={styles.xpValue}>{formatNumber(xpPerHour, 0)}</span>
        <span className={styles.xpUnit}>XP/hr</span>
      </div>

      {/* XP / 24h */}
      <div className={`${styles.cell} ${styles.cellXp}`}>
        <span className={styles.xpValue}>{formatNumber(xpPer24h, 0)}</span>
        <span className={styles.xpUnit}>XP/24h</span>
      </div>

      {/* XP / Coin */}
      <div className={`${styles.cell} ${styles.cellXp}`}>
        {inputCostPerCycle > 0 ? (
          <div className={styles.xpCoinCell}>
            <span className={styles.xpCoinValue}>{formatNumber(xpPerCoin, 0)}</span>
            <span className={styles.xpCoinUnit}>XP/🪙</span>
          </div>
        ) : (
          <span className={styles.inactiveValue}>—</span>
        )}
      </div>

      {/* Signal */}
      <div className={`${styles.cell} ${styles.cellDelta}`}>
        {tokenPrice?.recommendation ? (
          <span style={{
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '0.65rem',
            fontWeight: 700,
            letterSpacing: '0.5px',
            color: tokenPrice.recommendation === 'BUY' ? '#22c55e' : tokenPrice.recommendation === 'SELL' ? '#ef4444' : '#9ca3af',
            background: tokenPrice.recommendation === 'BUY' ? 'rgba(34,197,94,0.1)' : tokenPrice.recommendation === 'SELL' ? 'rgba(239,68,68,0.1)' : 'rgba(156,163,175,0.08)',
            border: `1px solid ${tokenPrice.recommendation === 'BUY' ? 'rgba(34,197,94,0.25)' : tokenPrice.recommendation === 'SELL' ? 'rgba(239,68,68,0.25)' : 'rgba(156,163,175,0.15)'}`,
          }}>
            {tokenPrice.recommendation === 'BUY' ? '▲ BUY' : tokenPrice.recommendation === 'SELL' ? '▼ SELL' : '● HOLD'}
          </span>
        ) : (
          <span style={{ color: '#4b5563' }}>—</span>
        )}
      </div>

      {/* Delta 1H */}
      <div className={`${styles.cell} ${styles.cellDelta}`}>
        <span className={d1h.className}>{d1h.text}</span>
      </div>

      {/* Delta 24H */}
      <div className={`${styles.cell} ${styles.cellDelta}`}>
        <span className={d24h.className}>{d24h.text}</span>
      </div>

      {/* # Factories */}
      <div className={`${styles.cell} ${styles.cellStatic}`}>
        <span className={cfg.factories > 0 ? styles.activeValue : styles.inactiveValue}>
          {cfg.factories || '—'}
        </span>
      </div>

      {/* Factory Levels (independent) */}
      <div className={`${styles.cell} ${styles.cellLevels}`}>
        {factoryLevels.length > 0 ? (
          <span className={styles.factoryLevelsText} title={factoryLevelsStr}>
            {factoryLevelsStr}
          </span>
        ) : (
          <span className={styles.inactiveValue}>—</span>
        )}
      </div>

      {/* Mastery */}
      <div className={`${styles.cell} ${styles.cellStatic}`}>
        {cfg.factories > 0 && cfg.mastery > 0 ? (
          <span className={styles.activeValue}>
            {cfg.mastery} <span className={styles.percentSub}>({getMasteryYieldBonus(cfg.mastery).toFixed(1)}%)</span>
          </span>
        ) : (
          <span className={styles.inactiveValue}>—</span>
        )}
      </div>

      {/* Workers % */}
      <div className={`${styles.cell} ${styles.cellStatic}`}>
        <span className={cfg.factories > 0 && cfg.workers > 0 ? styles.activeValue : styles.inactiveValue}>
          {cfg.factories > 0 && cfg.workers > 0 ? `${cfg.workers}%` : '—'}
        </span>
      </div>

      {/* Workshop % */}
      <div className={`${styles.cell} ${styles.cellStatic}`}>
        <span className={cfg.factories > 0 && cfg.workshop > 0 ? styles.activeValue : styles.inactiveValue}>
          {cfg.factories > 0 && cfg.workshop > 0 ? `${cfg.workshop}%` : '—'}
        </span>
      </div>

      {/* Boost */}
      <div className={`${styles.cell} ${styles.cellStatic}`}>
        <span className={cfg.factories > 0 && cfg.boost > 1 ? styles.activeValue : styles.inactiveValue}>
          {cfg.factories > 0 && cfg.boost > 1 ? `x${cfg.boost}` : '—'}
        </span>
      </div>

      {/* Power Cost/H */}
      <div className={`${styles.cell} ${styles.cellResult}`}>
        <span className={styles.powerValue}>
          {cfg.factories > 0 ? formatPowerKw(powerCostPerHour) : '—'}
        </span>
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.name === next.name &&
    prev.pricesLoading === next.pricesLoading &&
    prev.cfg.factories === next.cfg.factories &&
    prev.cfg.level === next.cfg.level &&
    prev.cfg.mastery === next.cfg.mastery &&
    prev.cfg.workers === next.cfg.workers &&
    prev.cfg.workshop === next.cfg.workshop &&
    prev.cfg.boost === next.cfg.boost &&
    prev.tokenPrice?.buy === next.tokenPrice?.buy &&
    prev.tokenPrice?.sell === next.tokenPrice?.sell &&
    prev.tokenPrice?.recommendation === next.tokenPrice?.recommendation &&
    prev.priceDelta.delta1h === next.priceDelta.delta1h &&
    prev.priceDelta.delta24h === next.priceDelta.delta24h &&
    prev.prices === next.prices &&
    prev.balance === next.balance &&
    prev.gameBalance === next.gameBalance &&
    prev.factoryLevels?.join(',') === next.factoryLevels?.join(',')
  );
});

// ─── Main Component ──────────────────────────────────────────────────────────

export const ResourceTable: React.FC<ResourceTableProps> = ({
  prices,
  coinPriceUsd,
  pricesLoading,
  playerConfig,
  priceDeltas,
  balances,
  gameBalances,
  accountInfo
}) => {
  const tableRef = useRef<HTMLDivElement>(null);
  const hasAnimatedRef = useRef(false);

  // Build a map of resource -> individual factory levels from accountInfo
  const factoryLevelsMap = useMemo(() => {
    if (!accountInfo?.factories) return {} as Record<string, number[]>;

    const map: Record<string, number[]> = {};
    const allFactories = accountInfo.factories;

    allFactories.forEach((f: PlayerMine) => {
      const symbol = (f.definition?.id || f.id || '').toUpperCase();
      if (!map[symbol]) map[symbol] = [];
      map[symbol].push(f.level);
    });

    return map;
  }, [accountInfo?.factories]);

  useEffect(() => {
    if (tableRef.current && !hasAnimatedRef.current) {
      hasAnimatedRef.current = true;
      anime({
        targets: tableRef.current.querySelectorAll(`.${styles.tableRow}`),
        opacity: [0, 1],
        translateX: [-15, 0],
        easing: 'easeOutQuad',
        duration: 300,
        delay: anime.stagger(15, { start: 50 })
      });
    }
  }, []);

  const factoryNames = Object.keys(FACTORIES_DATA).sort();

  return (
    <section className={`bento-card ${styles.card}`}>
      <h2 className="card-title">📊 TABLA DE RECURSOS — RENTABILIDAD, PRODUCCIÓN Y XP</h2>

      <div className={styles.tableWrapper} ref={tableRef}>
        <div className={styles.tableContainer}>
          {/* Header */}
          <div className={`${styles.tableRow} ${styles.tableHeader}`}>
            <div className={`${styles.cell} ${styles.cellResource}`}>RECURSO</div>
            <div className={`${styles.cell} ${styles.cellInput}`}>ENTRADA 1</div>
            <div className={`${styles.cell} ${styles.cellInput}`}>ENTRADA 2</div>
            <div className={`${styles.cell} ${styles.cellOutput}`}>SALIDA/CICLO</div>
            <div className={`${styles.cell} ${styles.cellOutput}`}>SALIDA/HR</div>
            <div className={`${styles.cell} ${styles.cellOutput}`}>SALIDA/24H</div>
            <div className={`${styles.cell} ${styles.cellResult}`}>COSTO/CICLO</div>
            <div className={`${styles.cell} ${styles.cellPrice}`}>VENTA</div>
            <div className={`${styles.cell} ${styles.cellResult}`}>GANANCIA/CICLO</div>
            <div className={`${styles.cell} ${styles.cellResult}`}>GANANCIA/HR</div>
            <div className={`${styles.cell} ${styles.cellResult}`}>GANANCIA/24H</div>
            <div className={`${styles.cell} ${styles.cellDelta}`}>MARGEN %</div>
            <div className={`${styles.cell} ${styles.cellXp}`}>XP/CICLO</div>
            <div className={`${styles.cell} ${styles.cellXp}`}>XP/HR</div>
            <div className={`${styles.cell} ${styles.cellXp}`}>XP/24H</div>
            <div className={`${styles.cell} ${styles.cellXp}`}>XP/🪙</div>
            <div className={`${styles.cell} ${styles.cellDelta}`}>SEÑAL</div>
            <div className={`${styles.cell} ${styles.cellDelta}`}>Δ 1H</div>
            <div className={`${styles.cell} ${styles.cellDelta}`}>Δ 24H</div>
            <div className={`${styles.cell} ${styles.cellStatic}`}># FÁBRICAS</div>
            <div className={`${styles.cell} ${styles.cellLevels}`}>NIVELES INDIV.</div>
            <div className={`${styles.cell} ${styles.cellStatic}`}>MAESTRÍA</div>
            <div className={`${styles.cell} ${styles.cellStatic}`}>WORKERS %</div>
            <div className={`${styles.cell} ${styles.cellStatic}`}>TALLER %</div>
            <div className={`${styles.cell} ${styles.cellStatic}`}>BOOST</div>
            <div className={`${styles.cell} ${styles.cellResult}`}>POWER COST/H</div>
          </div>

          {/* Rows */}
          {factoryNames.map(name => {
            const cfg = playerConfig.config[name] || {
              factories: 0,
              level: 1,
              mastery: 0,
              workers: 0,
              workshop: 0,
              boost: 1
            };
            const tokenPrice = prices[name];
            const priceDelta = priceDeltas[name] || { delta1h: null, delta24h: null };
            const levels = FACTORIES_DATA[name];
            const tokenBalance = balances ? balances[name] : undefined;
            const gameBalance = gameBalances ? gameBalances[name] : undefined;
            const fLevels = factoryLevelsMap[name] || [];

            return (
              <ResourceRow
                key={name}
                name={name}
                cfg={cfg}
                tokenPrice={tokenPrice}
                priceDelta={priceDelta}
                prices={prices}
                pricesLoading={pricesLoading}
                maxLevel={levels.length}
                balance={tokenBalance}
                gameBalance={gameBalance}
                factoryLevels={fLevels}
                coinPriceUsd={coinPriceUsd}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
};
