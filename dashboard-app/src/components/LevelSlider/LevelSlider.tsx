import React, { useMemo } from 'react';
import { useNumberCounter } from '../../hooks/useNumberCounter';
import styles from './LevelSlider.module.css';
import { toCapitalCase } from '../../utils/string';
import type { LevelData } from '../../types/game';
import type { TokenPrices } from '../../utils/priceService';

interface LevelSliderProps {
  level: number;
  setLevel: (lvl: number) => void;
  maxLevel: number;
  output: number;
  duration: string;
  durationSec: number;
  powerCost: number;
  xpPerOutput: number;
  costSymbol: string;
  costAmount: number;
  levels: LevelData[];
  prices?: TokenPrices;
}

interface CumulativeCost {
  symbol: string;
  amount: number;
  coinValue: number;
  usdValue: number;
}

export const LevelSlider: React.FC<LevelSliderProps> = ({
  level,
  setLevel,
  maxLevel,
  output,
  duration,
  durationSec,
  powerCost,
  xpPerOutput,
  costSymbol,
  costAmount,
  levels,
  prices
}) => {
  const [targetLevel, setTargetLevel] = React.useState<number>(() => {
    const saved = localStorage.getItem('cw-target-level');
    return saved ? Math.min(parseInt(saved), maxLevel) : maxLevel;
  });

  React.useEffect(() => {
    if (targetLevel > maxLevel) setTargetLevel(maxLevel);
  }, [maxLevel, targetLevel]);

  React.useEffect(() => {
    localStorage.setItem('cw-target-level', targetLevel.toString());
  }, [targetLevel]);

  // Calculate cumulative upgrade costs from current level to target level
  const cumulativeCosts = useMemo((): CumulativeCost[] => {
    if (level >= targetLevel || !levels.length) return [];
    
    const costMap: Record<string, number> = {};
    
    // The cost at level N is the cost to upgrade FROM level N to level N+1
    // So to go from level 2 to level 5, we need costs of levels 2, 3, 4
    // But in the data, level N's cost_symbol/cost_amount is the cost to reach level N (upgrade FROM N-1)
    // So to go from current level to target, we need levels[current] through levels[target-1]
    for (let i = level; i < targetLevel && i < levels.length; i++) {
      const lvl = levels[i];
      if (lvl.cost_symbol && lvl.cost_amount > 0) {
        const sym = lvl.cost_symbol;
        costMap[sym] = (costMap[sym] || 0) + lvl.cost_amount;
      }
    }

    return Object.entries(costMap).map(([symbol, amount]) => {
      const tokenPrice = prices?.[symbol];
      const coinValue = tokenPrice ? amount * tokenPrice.buy : 0;
      const usdValue = tokenPrice ? amount * tokenPrice.usdBuy : 0;
      return { symbol, amount, coinValue, usdValue };
    }).sort((a, b) => b.coinValue - a.coinValue);
  }, [level, targetLevel, levels, prices]);

  const totalCoinCost = cumulativeCosts.reduce((sum, c) => sum + c.coinValue, 0);
  const totalUsdCost = cumulativeCosts.reduce((sum, c) => sum + c.usdValue, 0);

  // ROI: additional daily revenue vs upgrade cost
  const roiData = useMemo(() => {
    if (level >= targetLevel || !levels.length || !prices) return null;

    const currentLvlData = levels[level - 1];
    const targetLvlData = levels[targetLevel - 1];
    if (!currentLvlData || !targetLvlData) return null;

    const currentProdPerDay = currentLvlData.production_per_day || 0;
    const targetProdPerDay = targetLvlData.production_per_day || 0;
    const extraUnitsPerDay = targetProdPerDay - currentProdPerDay;

    const sellPrice = prices[costSymbol]?.sell || 0;
    const extraDailyRevenue = extraUnitsPerDay * sellPrice;

    if (extraDailyRevenue <= 0 || totalCoinCost <= 0) return null;

    const daysToRoi = totalCoinCost / extraDailyRevenue;
    const hoursToRoi = daysToRoi * 24;

    return { extraUnitsPerDay, extraDailyRevenue, daysToRoi, hoursToRoi };
  }, [level, targetLevel, levels, prices, totalCoinCost, costSymbol]);
  const progressPct = maxLevel > 1 ? ((level - 1) / (maxLevel - 1)) * 100 : 100;
  const targetPct = maxLevel > 1 ? ((targetLevel - 1) / (maxLevel - 1)) * 100 : 100;

  // Smoothly animate stats changes using the custom anime.js hook
  const animatedOutput = useNumberCounter(output);
  const animatedPower = useNumberCounter(powerCost);
  const animatedXp = useNumberCounter(xpPerOutput);
  const animatedCostAmount = useNumberCounter(costAmount);
  const animatedDurationSec = useNumberCounter(durationSec);
  const animatedTotalCoin = useNumberCounter(totalCoinCost);

  const formatCoin = (val: number) => {
    if (val === 0) return '0.00';
    if (Math.abs(val) < 0.001) return val.toFixed(6);
    if (Math.abs(val) < 1) return val.toFixed(4);
    return val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatUsd = (val: number) => {
    const absVal = Math.abs(val);
    if (absVal === 0) return '$0.00';
    if (absVal < 0.001) return `$${absVal.toFixed(6)}`;
    if (absVal < 0.1) return `$${absVal.toFixed(4)}`;
    return `$${absVal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <section className={`bento-card ${styles.card}`}>
      <div className={styles.levelHeader}>
        <h2 className="card-title">🎚️ SIMULADOR DE NIVEL</h2>
        <div className={styles.levelBadgeContainer}>
          <span>NIVEL</span>
          <span className={styles.levelNumberBadge}>{level}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>→</span>
          <span className={`${styles.levelNumberBadge} ${styles.targetBadge}`}>{targetLevel}</span>
        </div>
      </div>

      {/* Current Level Slider */}
      <div className={styles.sliderWrapper}>
        <div className={styles.sliderLabelRow}>
          <span className={styles.sliderTag}>Nivel Actual</span>
          <span className={styles.sliderTagValue}>{level}</span>
        </div>
        <input
          type="range"
          min="1"
          max={maxLevel || 1}
          value={level}
          onChange={(e) => setLevel(parseInt(e.target.value))}
          className="neon-slider"
        />
      </div>

      {/* Target Level Slider */}
      <div className={styles.sliderWrapper}>
        <div className={styles.sliderLabelRow}>
          <span className={styles.sliderTag} style={{ color: 'var(--color-orange)' }}>Nivel Objetivo</span>
          <span className={styles.sliderTagValue} style={{ color: 'var(--color-orange)' }}>{targetLevel}</span>
        </div>
        <input
          type="range"
          min={level}
          max={maxLevel || 1}
          value={targetLevel}
          onChange={(e) => setTargetLevel(parseInt(e.target.value))}
          className="neon-slider"
          style={{ '--slider-color': 'var(--color-orange)' } as React.CSSProperties}
        />
      </div>

      {/* Progress Bar */}
      <div className={styles.progressBarContainer}>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
          <div className={styles.progressTarget} style={{ width: `${targetPct}%` }} />
        </div>
        <div className={styles.sliderLabels}>
          <span>Lvl 1</span>
          <span>Lvl {maxLevel}</span>
        </div>
      </div>

      {/* Current Level Stats */}
      <div className={styles.statsCounterGrid}>
        <div className={styles.counterBox}>
          <span className={styles.counterLabel}>Producción por Ciclo</span>
          <span className={styles.counterValue}>{animatedOutput.toLocaleString('es-ES')}</span>
          <span className={styles.counterUnit}>unidades</span>
        </div>
        <div className={styles.counterBox}>
          <span className={styles.counterLabel}>Duración del Ciclo</span>
          <span className={styles.counterValue} style={{ fontFamily: 'var(--font-mono)' }}>
            {duration}
          </span>
          <span className={styles.counterUnit}>{Math.round(animatedDurationSec)} segundos</span>
        </div>
        <div className={styles.counterBox}>
          <span className={styles.counterLabel}>Consumo de Energía</span>
          <span className={styles.counterValue}>{animatedPower.toLocaleString('es-ES')}</span>
          <span className={styles.counterUnit}>Watts</span>
        </div>
        <div className={styles.counterBox}>
          <span className={styles.counterLabel}>Experiencia (XP)</span>
          <span className={styles.counterValue}>{animatedXp.toLocaleString('es-ES')}</span>
          <span className={styles.counterUnit}>puntos</span>
        </div>
      </div>

      {/* Next Level Cost */}
      {costSymbol && costAmount > 0 && (
        <div className={styles.upgradeCostBox}>
          <span className={styles.upgradeTitle}>🔧 Requisito para siguiente nivel:</span>
          <div className={styles.upgradeCostValue}>
            <span className={styles.upgradeAmount}>{Math.round(animatedCostAmount).toLocaleString('es-ES')}</span>
            <div className={styles.upgradeSymbolWrapper}>
              <img
                src={`/assets/resources/${toCapitalCase(costSymbol)}.png`}
                className={styles.upgradeSymbolIcon}
                alt={costSymbol}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/assets/resources/Mud.png';
                }}
              />
              <span className={styles.upgradeSymbolName}>{costSymbol}</span>
            </div>
          </div>
        </div>
      )}

      {/* Cumulative Upgrade Cost Table */}
      {level < targetLevel && cumulativeCosts.length > 0 && (
        <div className={styles.cumulativeSection}>
          <h3 className={styles.cumulativeTitle}>
            📊 COSTO TOTAL: Nivel {level} → {targetLevel}
          </h3>
          <div className={styles.cumulativeList}>
            {cumulativeCosts.map((cost) => (
              <div key={cost.symbol} className={styles.cumulativeRow}>
                <div className={styles.cumulativeResInfo}>
                  <img
                    src={`/assets/resources/${toCapitalCase(cost.symbol)}.png`}
                    className={styles.cumulativeIcon}
                    alt={cost.symbol}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/assets/resources/Mud.png';
                    }}
                  />
                  <span className={styles.cumulativeResName}>{cost.symbol}</span>
                </div>
                <div className={styles.cumulativeAmounts}>
                  <span className={styles.cumulativeQty}>
                    {Math.round(cost.amount).toLocaleString('es-ES')} uds
                  </span>
                  {cost.coinValue > 0 && (
                    <span className={styles.cumulativeCoin}>
                      {formatCoin(cost.coinValue)} COIN
                    </span>
                  )}
                  {cost.usdValue > 0 && (
                    <span className={styles.cumulativeUsd}>
                      {formatUsd(cost.usdValue)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Total summary */}
          <div className={styles.cumulativeTotalRow}>
            <span className={styles.cumulativeTotalLabel}>💰 COSTO TOTAL ESTIMADO:</span>
            <div className={styles.cumulativeTotalValues}>
              <span className={styles.cumulativeTotalCoin}>
                {formatCoin(animatedTotalCoin)} COIN
              </span>
              <span className={styles.cumulativeTotalUsd}>
                {formatUsd(totalUsdCost)}
              </span>
            </div>
          </div>
        </div>
      )}

      {level >= targetLevel && level < maxLevel && (
        <div className={styles.cumulativeSection}>
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>
            ⬆️ Selecciona un nivel objetivo mayor que el actual para ver los costos acumulados
          </p>
        </div>
      )}

      {/* ROI Section */}
      {roiData && (
        <div className={styles.cumulativeSection}>
          <h3 className={styles.cumulativeTitle}>📈 RETORNO DE INVERSIÓN (ROI)</h3>
          <div className={styles.cumulativeList}>
            <div className={styles.cumulativeRow}>
              <span className={styles.cumulativeResName}>Producción extra/día</span>
              <span className={styles.cumulativeQty}>{roiData.extraUnitsPerDay.toFixed(2)} uds</span>
            </div>
            <div className={styles.cumulativeRow}>
              <span className={styles.cumulativeResName}>Ingreso extra/día</span>
              <span className={styles.cumulativeCoin}>{roiData.extraDailyRevenue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} COIN</span>
            </div>
            <div className={styles.cumulativeRow}>
              <span className={styles.cumulativeResName}>Costo de mejora</span>
              <span className={styles.cumulativeCoin}>{totalCoinCost.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} COIN</span>
            </div>
            <div className={styles.cumulativeRow} style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '8px', marginTop: '4px' }}>
              <span className={styles.cumulativeResName} style={{ color: 'var(--color-green)', fontWeight: 700 }}>Recuperación estimada</span>
              <span className={styles.cumulativeQty} style={{ color: 'var(--color-green)', fontWeight: 700, fontSize: '1rem' }}>
                {roiData.daysToRoi < 1
                  ? `${Math.round(roiData.hoursToRoi)} horas`
                  : roiData.daysToRoi < 30
                    ? `${roiData.daysToRoi.toFixed(1)} días`
                    : `${(roiData.daysToRoi / 30).toFixed(1)} meses`}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
