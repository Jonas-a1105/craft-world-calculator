import React, { useEffect, useRef } from 'react';
import anime from 'animejs';
import { useNumberCounter } from '../../hooks/useNumberCounter';
import styles from './Calculator.module.css';
import { toCapitalCase } from '../../utils/string';
import { type TokenPrices } from '../../utils/priceService';
import { getMasteryReductionPercent } from '../../utils/gameHelpers';

interface CalculatorProps {
  dailyProduction: number; // base
  dailyXp: number; // base
  targetProduction: number;
  setTargetProduction: (target: number) => void;
  inputs: Array<{ name: string; amount: number; emoji: string }>;
  outputPerCycle: number;
  prices?: TokenPrices;
  outputName: string;
  // Live bonuses
  durationSec: number;
  xpPerOutput: number;
  factoryCount: number;
  mastery: number;
  workshop: number;
  workers: number;
  boost: number;
  levelYield?: number;
}

export const Calculator: React.FC<CalculatorProps> = ({
  targetProduction,
  setTargetProduction,
  inputs,
  outputPerCycle,
  prices,
  outputName,
  durationSec,
  xpPerOutput,
  factoryCount,
  mastery,
  workshop,
  workers,
  boost,
}) => {
  const listRef = useRef<HTMLDivElement>(null);

  // ─── Bonus Calculations ───────────────────────────────────────────────────
  // Mastery reduces INPUT (Craft-Companion: input × (1 - reduction%))
  const masteryInputMult = 1 - getMasteryReductionPercent(mastery) / 100;
  const finalInputMultiplier = masteryInputMult;

  // Output per cycle is fixed (does not increase with mastery)
  const finalYieldPerCycle = outputPerCycle;

  // Workshop (% directo) + Workers (% directo) = reducción de tiempo
  const speedModifier = 1 + (workshop / 100) + (workers / 100);
  const boostMult = boost || 1;
  const finalCycleDurationSec = Math.max(0.1, durationSec / (speedModifier * boostMult));

  // Compute stats per second for easy scaling
  const cyclesPerSecond = 1 / finalCycleDurationSec;
  const productionPerSecond = cyclesPerSecond * finalYieldPerCycle * factoryCount;
  const xpPerSecond = cyclesPerSecond * xpPerOutput * factoryCount;

  // Calculate live daily values (including all bonuses) to display in Bento boxes
  const activeDailyProduction = productionPerSecond * 86400;
  const activeDailyXp = xpPerSecond * 86400;

  // Smoothly count summary numbers
  const animatedDailyProduction = useNumberCounter(activeDailyProduction);
  const animatedDailyXp = useNumberCounter(activeDailyXp);

  // Stagger animation on change
  useEffect(() => {
    if (listRef.current && listRef.current.children.length > 0) {
      anime({
        targets: listRef.current.children,
        opacity: [0, 1],
        translateX: [-20, 0],
        easing: 'easeOutQuad',
        duration: 400,
        delay: anime.stagger(50)
      });
    }
  }, [inputs, targetProduction, finalYieldPerCycle, factoryCount]);

  // Target objective calculations
  // To produce targetProduction units *total*, how many cycles does it require?
  // Note: This target is for the aggregate of all factories.
  const totalCyclesRequired = targetProduction / (finalYieldPerCycle || 1);

  // Financial Calculations for the daily target
  let totalInputCostCoin = 0;
  let totalInputCostUsd = 0;

  const targetInputsList = inputs.map(inp => {
    // Each cycle requires inp.amount * finalInputMultiplier
    const rawAmtNeeded = totalCyclesRequired * inp.amount * finalInputMultiplier;
    const amountNeeded = Math.round(rawAmtNeeded);
    const tokenPrice = prices?.[inp.name];
    let costCoin = 0;
    let costUsd = 0;

    if (tokenPrice) {
      costCoin = amountNeeded * tokenPrice.buy;
      costUsd = amountNeeded * tokenPrice.usdBuy;
      totalInputCostCoin += costCoin;
      totalInputCostUsd += costUsd;
    }

    return {
      name: inp.name,
      amount: amountNeeded,
      emoji: inp.emoji,
      costCoin,
      costUsd
    };
  });

  const outputPrice = prices?.[outputName];
  const totalRevenueCoin = outputPrice ? targetProduction * outputPrice.sell : 0;
  const totalRevenueUsd = outputPrice ? targetProduction * outputPrice.usdSell : 0;

  // Buy vs Craft comparison (cost per unit)
  const costPerUnitCraft = inputs.reduce((sum, inp) => {
    const price = prices?.[inp.name];
    return sum + (price ? inp.amount * price.buy * finalInputMultiplier : 0);
  }, 0);
  const costPerUnitBuy = outputPrice ? outputPrice.buy : 0;
  const craftIsCheaper = costPerUnitCraft > 0 && costPerUnitBuy > 0 && costPerUnitCraft < costPerUnitBuy;
  const savingsPerUnit = costPerUnitBuy - costPerUnitCraft;

  const netProfitCoin = totalRevenueCoin - totalInputCostCoin;
  const netProfitUsd = totalRevenueUsd - totalInputCostUsd;
  const profitColorClass = netProfitCoin >= 0 ? styles.profitPositive : styles.profitNegative;

  // Helper format functions
  const formatCoin = (val: number) => {
    if (val === 0) return '0.00';
    if (Math.abs(val) < 0.001) return val.toFixed(6);
    if (Math.abs(val) < 1) return val.toFixed(4);
    return val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatUsd = (val: number) => {
    const isNeg = val < 0;
    const absVal = Math.abs(val);
    let str = '';
    if (absVal === 0) str = '0.00';
    else if (absVal < 0.001) str = absVal.toFixed(6);
    else if (absVal < 0.1) str = absVal.toFixed(4);
    else str = absVal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return isNeg ? `-$${str}` : `$${str}`;
  };

  // ─── Yield Breakdown by Time Intervals ─────────────────────────────────────
  const INTERVALS = [
    { label: 'Por Minuto', sec: 60 },
    { label: 'Por Hora', sec: 3600 },
    { label: 'Por Día (24h)', sec: 86400 },
    { label: 'Por Semana (7d)', sec: 604800 },
    { label: 'Por Mes (30d)', sec: 2592000 }
  ];

  const breakdownRows = INTERVALS.map(interval => {
    const prod = productionPerSecond * interval.sec;
    const cycles = prod / finalYieldPerCycle;

    // Calculate inputs cost for this interval
    let intervalInputCostCoin = 0;
    let intervalInputCostUsd = 0;
    const inputsDetail = inputs.map(inp => {
      const amt = cycles * inp.amount * finalInputMultiplier;
      const price = prices?.[inp.name];
      if (price) {
        intervalInputCostCoin += amt * price.buy;
        intervalInputCostUsd += amt * price.usdBuy;
      }
      return `${Math.round(amt).toLocaleString('es-ES')} ${inp.name}`;
    });

    const revCoin = outputPrice ? prod * outputPrice.sell : 0;
    const revUsd = outputPrice ? prod * outputPrice.usdSell : 0;

    const netCoin = revCoin - intervalInputCostCoin;
    const netUsd = revUsd - intervalInputCostUsd;

    return {
      label: interval.label,
      production: prod,
      inputsStr: inputsDetail.length > 0 ? inputsDetail.join(', ') : 'Ninguno',
      netCoin,
      netUsd
    };
  });

  return (
    <section className={`bento-card ${styles.card}`}>
      <h2 className="card-title">🧮 RENDIMIENTO CON BONOS Y METAS</h2>

      <div className={styles.dailySummaryGrid}>
        <div className={styles.summaryBox}>
          <span className={styles.summaryLabel}>Producción Diaria Activa ({factoryCount} Fáb.)</span>
          <div className={styles.summaryNumRow}>
            <span className={styles.summaryValue}>
              {animatedDailyProduction.toLocaleString('es-ES', { maximumFractionDigits: 1 })}
            </span>
            <span className={styles.summaryUnit}>uds/día</span>
          </div>
        </div>
        <div className={styles.summaryBox}>
          <span className={styles.summaryLabel}>Experiencia Diaria Activa</span>
          <div className={styles.summaryNumRow}>
            <span className={styles.summaryValue}>
              {Math.round(animatedDailyXp).toLocaleString('es-ES')}
            </span>
            <span className={styles.summaryUnit}>XP/día</span>
          </div>
        </div>
      </div>

      {/* Yield Breakdown Section */}
      <div className={styles.breakdownSection}>
        <h3 className={styles.toolTitle}>⏱️ DESGLOSE DE PRODUCCIÓN Y GANANCIA</h3>
        <p className={styles.toolDesc}>
          Simulación temporal del rendimiento de tus fábricas aplicando los bonos de taller, maestría y trabajadores.
        </p>
        <div className={styles.tableResponsive}>
          <table className={styles.breakdownTable}>
            <thead>
              <tr>
                <th className={styles.breakdownTh}>Intervalo</th>
                <th className={styles.breakdownTh}>Producción</th>
                <th className={styles.breakdownTh}>Insumos requeridos</th>
                <th className={styles.breakdownTh}>Ganancia COIN</th>
                <th className={styles.breakdownTh}>Ganancia USD</th>
              </tr>
            </thead>
            <tbody>
              {breakdownRows.map((row, idx) => (
                <tr key={idx} className={styles.breakdownRow}>
                  <td className={styles.breakdownTd} style={{ fontWeight: 600 }}>{row.label}</td>
                  <td className={`${styles.breakdownTd} ${styles.monoVal}`}>
                    {row.production.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} uds
                  </td>
                  <td className={styles.breakdownTd} style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {row.inputsStr}
                  </td>
                  <td className={`${styles.breakdownTd} ${styles.monoVal} ${row.netCoin >= 0 ? styles.profitPositive : styles.profitNegative}`}>
                    {formatCoin(row.netCoin)}
                  </td>
                  <td className={`${styles.breakdownTd} ${styles.monoVal} ${row.netCoin >= 0 ? styles.profitPositive : styles.profitNegative}`}>
                    {formatUsd(row.netUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Calculator tool for daily target */}
      <div className={styles.calculatorTool} style={{ marginTop: '24px' }}>
        <h3 className={styles.toolTitle}>🎯 SIMULADOR DE OBJETIVO DE PRODUCCIÓN</h3>
        <p className={styles.toolDesc}>
          Ingresa la meta total de producción para calcular los insumos y finanzas requeridas.
        </p>

        <div className={styles.calcInputRow}>
          <div className="input-group">
            <input
              type="number"
              value={targetProduction}
              onChange={(e) => setTargetProduction(Math.max(0, parseFloat(e.target.value) || 0))}
              min="1"
            />
          </div>
          <span className={styles.calcLabelInline}>unidades totales</span>
        </div>

        <div className={styles.calcLayoutGrid}>
          {/* Inputs list */}
          <div className={styles.calcResultsArea}>
            <h4>INSUMOS TOTALES REQUERIDOS:</h4>
            <div ref={listRef} className={styles.calcResultsList}>
              {targetInputsList.length === 0 ? (
                <span style={{ color: 'var(--color-green)', fontWeight: 500, fontSize: '0.95rem' }}>
                  ✨ Esta fábrica es autónoma. ¡No requiere insumos!
                </span>
              ) : (
                targetInputsList.map((inp) => (
                  <div key={inp.name} className={styles.calcResItem}>
                    <div className={styles.calcResNameWrapper}>
                      <img
                        src={`/assets/resources/${toCapitalCase(inp.name)}.png`}
                        className={styles.calcResIcon}
                        alt={inp.name}
                      />
                      <span className={styles.calcResName}>
                        {inp.name}
                      </span>
                    </div>
                    <div className={styles.calcResAmtCol}>
                      <span className={styles.calcResAmt}>
                        {inp.amount.toLocaleString('es-ES')} uds
                      </span>
                      {prices?.[inp.name] && (
                        <span className={styles.calcResPrice}>
                          {formatCoin(inp.costCoin)} COIN ({formatUsd(inp.costUsd)})
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Financial summary card */}
          {prices && prices[outputName] && (
            <div className={styles.financialSummaryCard}>
              <h4>ANÁLISIS FINANCIERO ESTIMADO:</h4>
              <div className={styles.financialGrid}>
                <div className={styles.financialRow}>
                  <span>Ingresos (Venta Output):</span>
                  <span className={styles.financialVal}>
                    {formatCoin(totalRevenueCoin)} COIN <span className={styles.usdText}>({formatUsd(totalRevenueUsd)})</span>
                  </span>
                </div>
                <div className={styles.financialRow}>
                  <span>Costos (Compra Insumos):</span>
                  <span className={styles.financialVal}>
                    {formatCoin(totalInputCostCoin)} COIN <span className={styles.usdText}>({formatUsd(totalInputCostUsd)})</span>
                  </span>
                </div>
                <div className={`${styles.financialRow} ${styles.financialProfitRow}`}>
                  <span>Margen Neto (Beneficio):</span>
                  <span className={`${styles.financialVal} ${profitColorClass}`}>
                    {formatCoin(netProfitCoin)} COIN <span className={styles.usdText}>({formatUsd(netProfitUsd)})</span>
                  </span>
                </div>
              </div>

              {/* Buy vs Craft comparison */}
              {costPerUnitCraft > 0 && costPerUnitBuy > 0 && (
                <div className={styles.buyVsCraftSection} style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>🆚 COMPRAR vs FABRICAR (por unidad)</h4>
                  <div className={styles.financialRow}>
                    <span>Comprar {outputName} en mercado:</span>
                    <span className={styles.financialVal} style={{ color: '#f87171' }}>
                      {formatCoin(costPerUnitBuy)} COIN
                    </span>
                  </div>
                  <div className={styles.financialRow}>
                    <span>Fabricar desde insumos:</span>
                    <span className={styles.financialVal} style={{ color: craftIsCheaper ? '#39ff14' : '#f87171' }}>
                      {formatCoin(costPerUnitCraft)} COIN
                    </span>
                  </div>
                  <div className={styles.financialRow}>
                    <span style={{ fontWeight: 700 }}>{craftIsCheaper ? '✅ Más barato fabricarlo' : savingsPerUnit > 0 ? '⚠️ Más barato comprarlo' : '—'}</span>
                    <span className={styles.financialVal} style={{ color: '#fbbf24', fontWeight: 700 }}>
                      {savingsPerUnit > 0 ? `Ahorras ${formatCoin(Math.abs(savingsPerUnit))} COIN/ud` : ''}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
