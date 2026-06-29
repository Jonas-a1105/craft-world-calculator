import React, { useEffect, useRef, useMemo } from 'react';
import anime from 'animejs';
import styles from './FactoryDetails.module.css';
import type { FactoryCategory, LevelData } from '../../types/game';
import { toCapitalCase } from '../../utils/string';
import { type TokenPrices } from '../../utils/priceService';
import type { PlayerAccountInfo, PlayerMine, FactoryInstanceData } from '../../utils/accountService';
import type { PriceDeltas } from '../../hooks/usePriceHistory';
import type { ResourceConfig } from '../../hooks/usePlayerConfig';
import { getMasteryReductionPercent, applyMasteryReduction, getMasteryYieldBonus, getWorkshopBoostPercent, applyWorkshopSpeedToDuration, applyFactoryBoostToDuration, getRunsPerHour, getEffectiveSpeedMult } from '../../utils/gameHelpers';
import { FACTORIES_DATA } from '../../assets/data/factories';

interface FactoryDetailsProps {
  factoryName: string;
  category: FactoryCategory;
  emoji: string;
  maxLevel: number;
  basePowerCost: number;
  inputs: Array<{ name: string; amount: number; emoji: string }>;
  prices?: TokenPrices;
  coinPriceUsd?: number;
  factoriesCount?: number;
  currentConfigLevel?: number;
  playerCfg?: ResourceConfig;
  accountInfo?: PlayerAccountInfo | null;
  priceDeltas?: PriceDeltas;
  currentLevelData?: LevelData;
  gameBalance?: number;
  walletBalance?: number;
  factoryInstances?: FactoryInstanceData[];
  factoryDataVersion?: number;
}

function formatNum(val: number, d = 2): string {
  if (val === 0) return '0';
  if (Math.abs(val) < 0.0001) return val.toExponential(2);
  if (Math.abs(val) < 0.01) return val.toFixed(6);
  if (Math.abs(val) < 1) return val.toFixed(4);
  if (Math.abs(val) < 1000) return val.toFixed(d);
  if (Math.abs(val) < 1000000) return val.toLocaleString(undefined, { maximumFractionDigits: d });
  return (val / 1000000).toFixed(2) + 'M';
}

function formatCoin(val: number): string {
  if (val === 0) return '0';
  if (val < 0.0001) return val.toFixed(6);
  if (val < 0.01) return val.toFixed(5);
  if (val < 1) return val.toFixed(4);
  return val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDelta(val: number | null): string {
  if (val === null) return '—';
  const prefix = val >= 0 ? '▲' : '▼';
  return `${prefix} ${Math.abs(val).toFixed(2)}%`;
}

function formatProfit(val: number): string {
  if (val === 0) return '—';
  const prefix = val >= 0 ? '+' : '';
  if (Math.abs(val) < 0.01) return `${prefix}${val.toFixed(4)}`;
  return `${prefix}${val.toFixed(2)}`;
}

function formatDuration(sec: number): string {
  if (!sec || sec <= 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatPowerKw(watts: number): string {
  if (watts === 0) return '—';
  if (watts >= 1000) return `${(watts / 1000).toFixed(1)} kW`;
  return `${watts.toFixed(0)} W`;
}

export const FactoryDetails: React.FC<FactoryDetailsProps> = ({
  factoryName,
  category,
  prices,
  playerCfg,
  accountInfo,
  priceDeltas,
  currentLevelData,
  gameBalance,
  walletBalance,
  factoryInstances,
  factoryDataVersion
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cardRef.current) {
      anime({
        targets: cardRef.current,
        scale: [0.98, 1],
        duration: 350,
        easing: 'easeOutQuad'
      });
    }
  }, [factoryName]);

  const tokenPrice = prices?.[factoryName];
  const priceDelta = priceDeltas?.[factoryName];

  const cfg: ResourceConfig = playerCfg || { factories: 0, level: 1, mastery: 0, workers: 0, workshop: 0, boost: 1 };
  const lvlData = currentLevelData;

  // ─── Computations (Craft-Companion formulas) ───
  const baseYield = lvlData?.yield || 100;

  // Mastery reduces INPUT (Craft-Companion: input × (1 - reduction%))
  const masteryReductionPct = getMasteryReductionPercent(cfg.mastery);
  const finalInput1Amt = applyMasteryReduction(lvlData?.input1_amt || 0, cfg.mastery);
  const finalInput2Amt = applyMasteryReduction(lvlData?.input2_amt || 0, cfg.mastery);

  // Speed: Craft-Companion chain — apply speed% then factory boost multiplier
  const baseDurationSec = lvlData?.duration_sec || 3600;
  const workshopBoostPct = getWorkshopBoostPercent(factoryName, cfg.workshop);
  const totalSpeedPct = workshopBoostPct + (cfg.workers || 0);
  const boostMult = cfg.boost || 1;
  const speedDurationSec = applyWorkshopSpeedToDuration(baseDurationSec, totalSpeedPct);
  const effectiveDurationSec = applyFactoryBoostToDuration(speedDurationSec, boostMult);
  const finalCycleDurationSec = Math.max(0.1, effectiveDurationSec);
  const cyclesPerHour = getRunsPerHour(finalCycleDurationSec);
  const cyclesPerDay = cyclesPerHour * 24;

  const outputPerCycle = lvlData?.output || 0;
  const outputPerHr = outputPerCycle * cyclesPerHour * cfg.factories;
  const outputPer24h = outputPerCycle * cyclesPerDay * cfg.factories;
  const powerCostPerHour = (lvlData?.power_cost || 0) * cyclesPerHour * cfg.factories;

  let inputCostPerCycle = 0;
  if (lvlData?.input1 && lvlData.input1_amt > 0 && prices?.[lvlData.input1]) {
    inputCostPerCycle += finalInput1Amt * prices[lvlData.input1].buy;
  }
  if (lvlData?.input2 && lvlData.input2_amt > 0 && prices?.[lvlData.input2]) {
    inputCostPerCycle += finalInput2Amt * prices[lvlData.input2].buy;
  }

  const revenuePerCycle = tokenPrice ? outputPerCycle * tokenPrice.sell : 0;
  const profitPerCycle = revenuePerCycle - inputCostPerCycle;
  const marginPct = revenuePerCycle > 0 ? (profitPerCycle / revenuePerCycle) * 100 : 0;
  const profitPerHour = profitPerCycle * cyclesPerHour * cfg.factories;
  const profitPer24h = profitPerCycle * cyclesPerDay * cfg.factories;

  const xpPerCycle = lvlData?.xp_per_output || 0;
  const xpPerHour = xpPerCycle * cyclesPerHour * cfg.factories;
  const xpPer24h = xpPerCycle * cyclesPerDay * cfg.factories;
  const xpPerCoin = inputCostPerCycle > 0 ? xpPerCycle / inputCostPerCycle : 0;

  // Factory individual levels
  const factoryLevels = useMemo(() => {
    if (!accountInfo?.factories) return [];
    const levels: number[] = [];
    accountInfo.factories.forEach((f: PlayerMine) => {
      const symbol = (f.definition?.id || f.id || '').toUpperCase();
      if (symbol === factoryName) {
        levels.push(f.level);
      }
    });
    return levels.sort((a, b) => b - a);
  }, [accountInfo?.factories, factoryName]);

  // Filtered per-factory instances for this resource
  const myFactoryInstances = useMemo(() => {
    if (!factoryInstances) return [];
    return factoryInstances
      .filter(inst => inst.symbol === factoryName)
      .sort((a, b) => b.level - a.level);
  }, [factoryInstances, factoryName]);

  // Real aggregated totals from individual factory instances (accurate)
  const realTotals = useMemo(() => {
    if (myFactoryInstances.length === 0) return null;
    let totalOutputHr = 0, totalProfitHr = 0, totalPowerHr = 0;
    let totalInputCostHr = 0, totalXpHr = 0;
    const inputAmtHr: Record<string, number> = {};
    const activeCount = myFactoryInstances.filter(i => i.isActive).length;

    myFactoryInstances.forEach(inst => {
      const data = FACTORIES_DATA[factoryName]?.[inst.level - 1] || lvlData;
      if (!data) return;
      const i1 = applyMasteryReduction(data.input1_amt || 0, cfg.mastery);
      const i2 = applyMasteryReduction(data.input2_amt || 0, cfg.mastery);
      const spdPct = getWorkshopBoostPercent(factoryName, cfg.workshop) + (inst.workerPct || 0);
      const bst = (inst.boostMult || 1) * (inst.globalBoostMult || 1);
      const speedDur = applyWorkshopSpeedToDuration(data.duration_sec || 3600, spdPct);
      const effDur = applyFactoryBoostToDuration(speedDur, bst);
      const cycle = Math.max(0.1, effDur);
      const cph = getRunsPerHour(cycle);
      const out = data.output || 0;

      totalOutputHr += out * cph;
      totalPowerHr += (data.power_cost || 0) * cph;
      totalXpHr += (data.xp_per_output || 0) * cph;

      let costHr = 0;
      if (data.input1 && i1 > 0 && prices?.[data.input1]) {
        costHr += i1 * prices[data.input1].buy * cph;
        inputAmtHr[data.input1] = (inputAmtHr[data.input1] || 0) + i1 * cph;
      }
      if (data.input2 && i2 > 0 && prices?.[data.input2]) {
        costHr += i2 * prices[data.input2].buy * cph;
        inputAmtHr[data.input2] = (inputAmtHr[data.input2] || 0) + i2 * cph;
      }
      totalInputCostHr += costHr;

      const revHr = tokenPrice ? out * tokenPrice.sell * cph : 0;
      totalProfitHr += revHr - costHr;
    });

    return {
      outputHr: totalOutputHr, output24h: totalOutputHr * 24,
      profitHr: totalProfitHr, profit24h: totalProfitHr * 24,
      powerHr: totalPowerHr, inputCostHr: totalInputCostHr, xpHr: totalXpHr,
      inputAmtHr, factoryCount: myFactoryInstances.length, activeCount,
    };
  }, [myFactoryInstances, cfg.mastery, cfg.workshop, prices, tokenPrice, factoryName, lvlData, factoryDataVersion]);

  // Input prices
  const inp1Price = lvlData?.input1 && prices?.[lvlData.input1] ? prices[lvlData.input1] : undefined;
  const inp2Price = lvlData?.input2 && prices?.[lvlData.input2] ? prices[lvlData.input2] : undefined;

  const categoryLabel = category === 'basic' ? 'Recurso Base' : category === 'keys' ? 'Llave / Especial' : 'Crafteado';
  const categoryClass = category === 'basic' ? 'bg-badge-basic' : category === 'keys' ? 'bg-badge-keys' : 'bg-badge-crafted';

  return (
    <section ref={cardRef} className={`bento-card ${styles.card}`}>
      {/* ─── Header ─── */}
      <div className={styles.factoryInfoHeader}>
        <div className={styles.factoryMainIcon}>
          <img
            src={`/assets/factories/${toCapitalCase(factoryName)}.gif`}
            className={styles.factoryGif}
            alt={factoryName}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              const name = factoryName;
              if (target.src.endsWith('.gif')) target.src = `/assets/factories/${toCapitalCase(name)}Pause.png`;
              else if (target.src.includes('Pause.png')) target.src = `/assets/factories/${toCapitalCase(name)}.png`;
              else if (target.src.endsWith('.png') && !target.src.includes('/assets/resources/'))
                target.src = `/assets/resources/${toCapitalCase(name)}.png`;
              else target.src = '/assets/resources/Mud.png';
            }}
          />
        </div>
        <div className={styles.headerInfo}>
          <h2 className={styles.factoryName}>{factoryName}</h2>
          <span className={`factory-type-badge ${categoryClass}`}>{categoryLabel}</span>
          <div className={styles.headerBadges}>
            {gameBalance !== undefined && gameBalance > 0 && (
              <span className={styles.badgeGame}>🎮 {formatNum(gameBalance)}</span>
            )}
            {walletBalance !== undefined && walletBalance > 0 && (
              <span className={styles.badgeWallet}>💼 {formatNum(walletBalance)}</span>
            )}
          </div>
        </div>
      </div>

      {/* ─── Summary Data Grid (3 cols) ─── */}
      <div className={styles.dataGrid}>

        {/* ── INPUTS ── */}
        <div className={styles.dataSection}>
          <div className={styles.sectionTitle}>📥 ENTRADA</div>
          <div className={styles.inputRow}>
            {realTotals ? (
              <>
                {Object.entries(realTotals.inputAmtHr).map(([res, amtHr]) => {
                  const resPrice = prices?.[res];
                  return (
                    <div key={res} className={styles.inputCard}>
                      <img
                        src={`/assets/resources/${toCapitalCase(res)}.png`}
                        className={styles.inputIcon}
                        alt={res}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <span className={styles.inputName}>{res}</span>
                      <span className={styles.inputAmt}>{formatNum(amtHr)}</span>
                      {resPrice && <span className={styles.inputCostVal}>{formatCoin(amtHr * resPrice.buy)} C/h</span>}
                    </div>
                  );
                })}
              </>
            ) : (
              <>
                {lvlData?.input1 && lvlData.input1_amt > 0 ? (
                  <div className={styles.inputCard}>
                    <img
                      src={`/assets/resources/${toCapitalCase(lvlData.input1)}.png`}
                      className={styles.inputIcon}
                      alt={lvlData.input1}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <span className={styles.inputName}>{lvlData.input1}</span>
                    <span className={styles.inputAmt}>{formatNum(finalInput1Amt)}</span>
                    {inp1Price && <span className={styles.inputCostVal}>{formatCoin(finalInput1Amt * inp1Price.buy)} C</span>}
                  </div>
                ) : null}
                {lvlData?.input2 && lvlData.input2_amt > 0 ? (
                  <div className={styles.inputCard}>
                    <img
                      src={`/assets/resources/${toCapitalCase(lvlData.input2)}.png`}
                      className={styles.inputIcon}
                      alt={lvlData.input2}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <span className={styles.inputName}>{lvlData.input2}</span>
                    <span className={styles.inputAmt}>{formatNum(finalInput2Amt)}</span>
                    {inp2Price && <span className={styles.inputCostVal}>{formatCoin(finalInput2Amt * inp2Price.buy)} C</span>}
                  </div>
                ) : lvlData?.input1 && lvlData.input1_amt > 0 ? null : (
                  <span className={styles.noData}>Sin insumos</span>
                )}
              </>
            )}
          </div>
          {(realTotals ? realTotals.inputCostHr > 0 : inputCostPerCycle > 0) && (
            <div className={styles.costTotal}>
              Coste total: <span className={styles.costTotalVal}>{formatCoin(realTotals ? realTotals.inputCostHr : inputCostPerCycle)} COIN/{realTotals ? 'h' : 'ciclo'}</span>
            </div>
          )}
        </div>

        {/* ── OUTPUT ── */}
        <div className={styles.dataSection}>
          <div className={styles.sectionTitle}>📤 SALIDA</div>
          <div className={styles.metricGrid}>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>/ciclo</span>
              <span className={styles.metricValue}>{formatNum(outputPerCycle)}</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>/min</span>
              <span className={styles.metricValue}>{formatNum(realTotals ? realTotals.outputHr / 60 : (finalCycleDurationSec > 0 ? (outputPerCycle / (finalCycleDurationSec / 60)) * cfg.factories : 0))}</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>/hora</span>
              <span className={styles.metricValue}>{formatNum(realTotals ? realTotals.outputHr : outputPerHr)}</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>/24h</span>
              <span className={styles.metricValue}>{formatNum(realTotals ? realTotals.output24h : outputPer24h)}</span>
            </div>
          </div>
        </div>

        {/* ── PRICES ── */}
        <div className={styles.dataSection}>
          <div className={styles.sectionTitle}>💰 PRECIO</div>
          <div className={styles.priceRow}>
            <div className={`${styles.priceCard} ${styles.priceBase}`}>
              <span className={styles.priceCardLabel}>BASE</span>
              <span className={styles.priceCardValue}>{tokenPrice ? formatCoin(tokenPrice.mid) : '—'}</span>
            </div>
            <div className={`${styles.priceCard} ${styles.priceBuy}`}>
              <span className={styles.priceCardLabel}>BUY</span>
              <span className={styles.priceCardValue}>{tokenPrice ? formatCoin(tokenPrice.buy) : '—'}</span>
            </div>
            <div className={`${styles.priceCard} ${styles.priceSell}`}>
              <span className={styles.priceCardLabel}>SELL</span>
              <span className={styles.priceCardValue}>{tokenPrice ? formatCoin(tokenPrice.sell) : '—'}</span>
            </div>
            {priceDelta && (
              <>
                <div className={styles.priceCard}>
                  <span className={styles.priceCardLabel}>Δ1h</span>
                  <span className={styles.priceCardValue} style={{ color: (priceDelta.delta1h || 0) >= 0 ? '#39ff14' : '#f87171' }}>
                    {formatDelta(priceDelta.delta1h)}
                  </span>
                </div>
                <div className={styles.priceCard}>
                  <span className={styles.priceCardLabel}>Δ24h</span>
                  <span className={styles.priceCardValue} style={{ color: (priceDelta.delta24h || 0) >= 0 ? '#39ff14' : '#f87171' }}>
                    {formatDelta(priceDelta.delta24h)}
                  </span>
                </div>
              </>
            )}
            {tokenPrice?.recommendation && (
              <div className={styles.priceCard}>
                <span className={styles.priceCardLabel}>SEÑAL</span>
                <span className={styles.priceCardValue} style={{
                  color: tokenPrice.recommendation === 'BUY' ? '#22c55e' : tokenPrice.recommendation === 'SELL' ? '#ef4444' : '#9ca3af'
                }}>
                  {tokenPrice.recommendation === 'BUY' ? '▲ BUY' : tokenPrice.recommendation === 'SELL' ? '▼ SELL' : '● HOLD'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── COST & PROFIT ── */}
        <div className={styles.dataSection}>
          <div className={styles.sectionTitle}>💵 COSTO & GANANCIA</div>
          <div className={styles.metricGrid}>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Costo/h</span>
              <span className={styles.metricValue} style={{ color: '#f87171' }}>{formatCoin(realTotals ? realTotals.inputCostHr : inputCostPerCycle * (cyclesPerHour || 1))}</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Venta (SELL)</span>
              <span className={styles.metricValue} style={{ color: '#c084fc' }}>{tokenPrice ? formatCoin(tokenPrice.sell) : '—'}</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Margen</span>
              <span className={styles.metricValue} style={{ color: marginPct >= 0 ? '#39ff14' : '#f87171' }}>
                {marginPct >= 0 ? '+' : ''}{marginPct.toFixed(1)}%
              </span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Ganancia/ciclo</span>
              <span className={styles.metricValue} style={{ color: profitPerCycle >= 0 ? '#39ff14' : '#f87171' }}>
                {formatProfit(profitPerCycle)}
              </span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Ganancia/h</span>
              <span className={styles.metricValue} style={{ color: (realTotals ? realTotals.profitHr : profitPerHour) >= 0 ? '#39ff14' : '#f87171' }}>
                {(realTotals || (cfg.factories > 0)) ? formatProfit(realTotals ? realTotals.profitHr : profitPerHour) : '—'}
              </span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Ganancia/24h</span>
              <span className={styles.metricValue} style={{ color: (realTotals ? realTotals.profit24h : profitPer24h) >= 0 ? '#39ff14' : '#f87171' }}>
                {(realTotals || (cfg.factories > 0)) ? formatProfit(realTotals ? realTotals.profit24h : profitPer24h) : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* ── XP ── */}
        <div className={styles.dataSection}>
          <div className={styles.sectionTitle}>⭐ EXPERIENCIA</div>
          <div className={styles.metricGrid}>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>XP/ciclo</span>
              <span className={styles.metricValue} style={{ color: '#fbbf24' }}>{formatNum(xpPerCycle, 0)}</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>XP/h</span>
              <span className={styles.metricValue} style={{ color: '#fbbf24' }}>{formatNum(realTotals ? realTotals.xpHr : xpPerHour, 0)}</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>XP/24h</span>
              <span className={styles.metricValue} style={{ color: '#fbbf24' }}>{formatNum(realTotals ? realTotals.xpHr * 24 : xpPer24h, 0)}</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>XP/🪙</span>
              <span className={styles.metricValue} style={{ color: '#fbbf24' }}>{(realTotals ? realTotals.inputCostHr : inputCostPerCycle) > 0 ? formatNum(realTotals ? realTotals.xpHr / realTotals.inputCostHr : xpPerCoin, 0) : '—'}</span>
            </div>
          </div>
        </div>

        {/* ── FACTORIES ── */}
        <div className={styles.dataSection}>
          <div className={styles.sectionTitle}>🏭 FÁBRICAS</div>
          <div className={styles.metricGrid}>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Total</span>
              <span className={styles.metricValue} style={{ color: '#00f0ff' }}>{realTotals ? realTotals.factoryCount : (cfg.factories || '0')}</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Activas</span>
              <span className={styles.metricValue} style={{ color: '#39ff14' }}>{realTotals ? realTotals.activeCount : (cfg.factories || '0')}</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Niveles</span>
              <span className={styles.metricValue} style={{ color: '#00f0ff', fontSize: '0.85rem' }}>
                {factoryLevels.length > 0 ? factoryLevels.join(', ') : '—'}
              </span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Power/h</span>
              <span className={styles.metricValue} style={{ color: '#d8b4fe' }}>{formatPowerKw(realTotals ? realTotals.powerHr : powerCostPerHour)}</span>
            </div>
          </div>
        </div>

      </div>{/* ── end dataGrid ── */}

      {/* ─── Bonus & Yield Row (2 cols) ─── */}
      <div className={styles.bonusYieldRow}>
        {/* ── BONUSES ── */}
        <div className={styles.dataSection}>
          <div className={styles.sectionTitle}>⚡ BONIFICACIONES</div>
          <div className={styles.bonusRow}>
            <div className={styles.bonusPill}>
              <span className={styles.bonusLabel}>Maestría</span>
              <span className={styles.bonusValue}>{cfg.mastery} ({getMasteryYieldBonus(cfg.mastery).toFixed(1)}%)</span>
            </div>
            <div className={styles.bonusPill}>
              <span className={styles.bonusLabel}>Taller</span>
              <span className={styles.bonusValue}>{cfg.workshop}%</span>
            </div>
            <div className={styles.bonusPill}>
              <span className={styles.bonusLabel}>Workers</span>
              <span className={styles.bonusValue}>{cfg.workers}%</span>
            </div>
            <div className={styles.bonusPill}>
              <span className={styles.bonusLabel}>Boost</span>
              <span className={styles.bonusValue}>x{cfg.boost}</span>
            </div>
            {myFactoryInstances.some(i => (i.globalBoostMult || 1) > 1) && (
              <div className={styles.bonusPill} style={{ borderColor: 'rgba(250, 215, 0, 0.4)' }}>
                <span className={styles.bonusLabel}>Evento</span>
                <span className={styles.bonusValue} style={{ color: '#fad700' }}>x{Math.max(...myFactoryInstances.map(i => i.globalBoostMult || 1))}</span>
              </div>
            )}
            <div className={styles.bonusPill}>
              <span className={styles.bonusLabel}>Yield efectivo</span>
              <span className={styles.bonusValue}>{((100 - masteryReductionPct) / 100).toFixed(3)}x</span>
            </div>
            <div className={styles.bonusPill}>
              <span className={styles.bonusLabel}>Velocidad</span>
              <span className={styles.bonusValue}>x{getEffectiveSpeedMult(baseDurationSec, finalCycleDurationSec).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* ── YIELD INFO ── */}
        <div className={styles.dataSection}>
          <div className={styles.sectionTitle}>📊 RENDIMIENTO</div>
          <div className={styles.metricGrid}>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Yield base (nivel)</span>
              <span className={styles.metricValue}>{baseYield.toFixed(1)}%</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Reducción insumos (maestría)</span>
              <span className={styles.metricValue} style={{ color: '#39ff14' }}>{masteryReductionPct > 0 ? `-${masteryReductionPct.toFixed(2)}%` : '0%'}</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Ciclos/hora</span>
              <span className={styles.metricValue}>{cyclesPerHour.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Factory Breakdown (full width) ─── */}
      {myFactoryInstances.length > 0 && (
        <section className={styles.breakdownSection}>
          <div className={styles.breakdownHeader}>🏭 DESGLOSE DE FÁBRICAS</div>
          <div className={styles.factoryBreakdownGrid}>
            {myFactoryInstances.map((inst, idx) => {
              const instLvlData = FACTORIES_DATA[factoryName]?.[inst.level - 1] || lvlData;
              if (true) {
                console.log(`🔍 Factory ${idx+1} (${factoryName} Lv.${inst.level}):`, {
                  baseDurationSec: instLvlData?.duration_sec,
                  workshop: cfg.workshop, workers: inst.workerPct,
                  speedMod: 1 + (cfg.workshop / 100) + (inst.workerPct / 100),
                  factoryBoost: inst.boostMult, globalBoost: inst.globalBoostMult,
                  totalBoost: (inst.boostMult || 1) * (inst.globalBoostMult || 1),
                  cycleSec: Math.max(0.1, (instLvlData?.duration_sec || 3600) / ((1 + (cfg.workshop / 100) + (inst.workerPct / 100)) * ((inst.boostMult || 1) * (inst.globalBoostMult || 1)))),
                  baseYield: instLvlData?.yield, masteryReductionPct,
                });
              }
              const instInput1Amt = applyMasteryReduction(instLvlData?.input1_amt || 0, cfg.mastery);
              const instInput2Amt = applyMasteryReduction(instLvlData?.input2_amt || 0, cfg.mastery);
              const instWsPct = getWorkshopBoostPercent(factoryName, cfg.workshop);
              const instTotalSpeedPct = instWsPct + (inst.workerPct || 0);
              const instBoostMult = (inst.boostMult || 1) * (inst.globalBoostMult || 1);
              const instSpeedDuration = applyWorkshopSpeedToDuration(instLvlData?.duration_sec || 3600, instTotalSpeedPct);
              const instEffDuration = applyFactoryBoostToDuration(instSpeedDuration, instBoostMult);
              const instCycleSec = Math.max(0.1, instEffDuration);
              const instCyclesPerHr = getRunsPerHour(instCycleSec);
              const instOutputPerCycle = instLvlData?.output || 0;
              const instOutputHr = instOutputPerCycle * instCyclesPerHr;
              const instPowerHr = (instLvlData?.power_cost || 0) * instCyclesPerHr;

              // Input cost, revenue, profit per cycle
              let instInputCost = 0;
              if (instLvlData?.input1 && instInput1Amt > 0 && prices?.[instLvlData.input1]) {
                instInputCost += instInput1Amt * prices[instLvlData.input1].buy;
              }
              if (instLvlData?.input2 && instInput2Amt > 0 && prices?.[instLvlData.input2]) {
                instInputCost += instInput2Amt * prices[instLvlData.input2].buy;
              }
              const instRevenue = tokenPrice ? instOutputPerCycle * tokenPrice.sell : 0;
              const instProfitRun = instRevenue - instInputCost;
              const instProfitHr = instProfitRun * instCyclesPerHr;

              // Impact = spread between buy and sell
              const instImpact = tokenPrice && tokenPrice.mid > 0
                ? ((tokenPrice.buy - tokenPrice.sell) / tokenPrice.mid) * 100
                : 0;

              const statusColor = inst.isActive ? '#39ff14' : '#666';
              const statusText = inst.isActive ? 'Activa' : 'Inactiva';

              return (
                <div key={inst.id} className={`${styles.factoryCard} ${inst.isActive ? '' : styles.factoryCardInactive}`}>
                  <div className={styles.factoryCardHeader}>
                    <img
                      src={`/assets/factories/${toCapitalCase(factoryName)}.gif`}
                      className={styles.factoryCardIcon}
                      alt={factoryName}
                      onError={(e) => {
                        const t = e.target as HTMLImageElement;
                        if (t.src.endsWith('.gif')) t.src = `/assets/factories/${toCapitalCase(factoryName)}Pause.png`;
                        else if (t.src.endsWith('.png')) t.src = `/assets/resources/${toCapitalCase(factoryName)}.png`;
                      }}
                    />
                    <div className={styles.factoryCardTitleRow}>
                      <span className={styles.factoryCardTitle}>Fábrica {idx + 1}</span>
                      <span className={styles.factoryCardStatus} style={{ color: statusColor }}>{statusText}</span>
                    </div>
                    <span className={styles.factoryCardLevel}>Nv.{inst.level}</span>
                  </div>
                  {/* ── Resources (inputs + output) with icons ── */}
                  <div className={styles.factoryCardResources}>
                    {instLvlData?.input1 && instInput1Amt > 0 && (
                      <div className={styles.factoryResInput}>
                        <img
                          src={`/assets/resources/${toCapitalCase(instLvlData.input1)}.png`}
                          className={styles.factoryResIcon}
                          alt={instLvlData.input1}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <span className={styles.factoryResAmt}>{formatNum(instInput1Amt)}</span>
                        <span className={styles.factoryResName}>{instLvlData.input1}</span>
                        {inp1Price && (
                          <span className={styles.factoryResCost}>{formatCoin(instInput1Amt * inp1Price.buy)} C</span>
                        )}
                      </div>
                    )}
                    {instLvlData?.input2 && instInput2Amt > 0 && (
                      <div className={styles.factoryResInput}>
                        <img
                          src={`/assets/resources/${toCapitalCase(instLvlData.input2)}.png`}
                          className={styles.factoryResIcon}
                          alt={instLvlData.input2}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <span className={styles.factoryResAmt}>{formatNum(instInput2Amt)}</span>
                        <span className={styles.factoryResName}>{instLvlData.input2}</span>
                        {inp2Price && (
                          <span className={styles.factoryResCost}>{formatCoin(instInput2Amt * inp2Price.buy)} C</span>
                        )}
                      </div>
                    )}
                    <div className={styles.factoryResArrow}>→</div>
                    <div className={styles.factoryResOutput}>
                      <img
                        src={`/assets/resources/${toCapitalCase(factoryName)}.png`}
                        className={styles.factoryResIcon}
                        alt={factoryName}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <span className={styles.factoryResAmt}>{formatNum(instOutputPerCycle)}</span>
                      <span className={styles.factoryResName}>{factoryName}</span>
                      <span className={styles.factoryResCost}>{formatCoin(instRevenue)} C</span>
                    </div>
                  </div>
                  <div className={styles.factoryCardStats}>
                    <div className={styles.factoryCardStat}>
                      <span className={styles.factoryStatLabel}>Taller</span>
                      <span className={styles.factoryStatValue}>{cfg.workshop}%</span>
                    </div>
                    <div className={styles.factoryCardStat}>
                      <span className={styles.factoryStatLabel}>Maestría</span>
                      <span className={styles.factoryStatValue}>{cfg.mastery} ({getMasteryYieldBonus(cfg.mastery).toFixed(1)}%)</span>
                    </div>
                    <div className={styles.factoryCardStat}>
                      <span className={styles.factoryStatLabel}>Boost</span>
                      <span className={styles.factoryStatValue} style={{ color: instBoostMult > 1 ? '#39ff14' : '#666' }}>x{instBoostMult}</span>
                    </div>
                    <div className={styles.factoryCardStat}>
                      <span className={styles.factoryStatLabel}>Workers</span>
                      <span className={styles.factoryStatValue} style={{ color: inst.workerPct > 0 ? '#00f0ff' : '#666' }}>{inst.workerPct}%</span>
                    </div>
                    <div className={styles.factoryCardStat}>
                      <span className={styles.factoryStatLabel}>Yield</span>
                      <span className={styles.factoryStatValue}>{(instLvlData?.yield || 100).toFixed(1)}%</span>
                    </div>
                    <div className={styles.factoryCardStat}>
                      <span className={styles.factoryStatLabel}>Duración ciclo</span>
                      <span className={styles.factoryStatValue}>{formatDuration(instCycleSec)}</span>
                    </div>
                    <div className={styles.factoryCardStat}>
                      <span className={styles.factoryStatLabel}>Output/run</span>
                      <span className={styles.factoryStatValue}>{formatNum(instOutputPerCycle)}</span>
                    </div>
                    <div className={styles.factoryCardStat}>
                      <span className={styles.factoryStatLabel}>Output/hr</span>
                      <span className={styles.factoryStatValue}>{formatNum(instOutputHr)}</span>
                    </div>
                    <div className={styles.factoryCardStat}>
                      <span className={styles.factoryStatLabel}>Input cost/run</span>
                      <span className={styles.factoryStatValue} style={{ color: '#f87171' }}>{formatCoin(instInputCost)} C</span>
                    </div>
                    <div className={styles.factoryCardStat}>
                      <span className={styles.factoryStatLabel}>Sell value/run</span>
                      <span className={styles.factoryStatValue} style={{ color: '#c084fc' }}>{formatCoin(instRevenue)} C</span>
                    </div>
                    <div className={styles.factoryCardStat}>
                      <span className={styles.factoryStatLabel}>Profit/run</span>
                      <span className={styles.factoryStatValue} style={{ color: instProfitRun >= 0 ? '#39ff14' : '#f87171' }}>{formatProfit(instProfitRun)} C</span>
                    </div>
                    <div className={styles.factoryCardStat}>
                      <span className={styles.factoryStatLabel}>Profit/hr</span>
                      <span className={styles.factoryStatValue} style={{ color: instProfitHr >= 0 ? '#39ff14' : '#f87171' }}>{formatProfit(instProfitHr)} C</span>
                    </div>
                    <div className={styles.factoryCardStat}>
                      <span className={styles.factoryStatLabel}>Power/h</span>
                      <span className={styles.factoryStatValue} style={{ color: '#d8b4fe' }}>{formatPowerKw(instPowerHr)}</span>
                    </div>
                    <div className={styles.factoryCardStat}>
                      <span className={styles.factoryStatLabel}>Impacto</span>
                      <span className={styles.factoryStatValue} style={{ color: instImpact > 0 ? '#fbbf24' : '#666' }}>{instImpact > 0 ? instImpact.toFixed(2) + '%' : '—'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </section>
  );
};


