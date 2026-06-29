import React, { useMemo } from 'react';
import styles from './ProfitSimulator.module.css';
import { computeLevelSensitivity } from '../../utils/profitability';
import type { TokenPrices } from '../../utils/priceService';
import type { ResourceConfig } from '../../hooks/usePlayerConfig';
import { getEmoji } from '../../utils/gameHelpers';
import { toCapitalCase } from '../../utils/string';


interface ProfitSimulatorProps {
  factoryName: string;
  prices: TokenPrices;
  playerCfg: ResourceConfig;
}

function formatCoin(val: number): string {
  if (val === 0) return '0.00';
  if (Math.abs(val) < 0.01) return val.toFixed(4);
  if (Math.abs(val) < 1) return val.toFixed(2);
  return val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDays(val: number): string {
  if (!isFinite(val) || val <= 0) return '∞';
  if (val < 1) return `${Math.round(val * 24)}h`;
  if (val < 30) return `${val.toFixed(1)}d`;
  return `${(val / 30).toFixed(1)}m`;
}

export const ProfitSimulator: React.FC<ProfitSimulatorProps> = ({
  factoryName,
  prices,
  playerCfg,
}) => {
  const analysis = useMemo(() => {
    return computeLevelSensitivity(factoryName, prices, playerCfg);
  }, [factoryName, prices, playerCfg]);

  if (!analysis || analysis.byLevel.length === 0) {
    return (
      <section className={`bento-card ${styles.card}`}>
        <h2 className="card-title">🔬 SIMULADOR DE RENTABILIDAD</h2>
        <div className={styles.empty}>No hay datos para {toCapitalCase(factoryName)}</div>
      </section>
    );
  }

  const currentLevelEntry = analysis.byLevel[analysis.currentLevel - 1];
  const breakeven = analysis.breakevenLevel;

  return (
    <section className={`bento-card ${styles.card}`}>
      <h2 className="card-title">
        <span>{getEmoji(factoryName)}</span> SIMULADOR — {toCapitalCase(factoryName)}
      </h2>

      {/* Summary bar */}
      <div className={styles.summaryBar}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Nivel actual</span>
          <span className={styles.summaryValue}>{analysis.currentLevel}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Profit/día actual</span>
          <span className={styles.summaryValue} style={{ color: currentLevelEntry?.profitPerDay >= 0 ? '#39ff14' : '#f87171' }}>
            {currentLevelEntry ? formatCoin(currentLevelEntry.profitPerDay) : '—'}
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Margen actual</span>
          <span className={styles.summaryValue} style={{ color: currentLevelEntry?.marginPct >= 0 ? '#39ff14' : '#f87171' }}>
            {currentLevelEntry ? (currentLevelEntry.marginPct >= 0 ? '+' : '') + currentLevelEntry.marginPct.toFixed(1) + '%' : '—'}
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Break-even nivel</span>
          <span className={styles.summaryValue} style={{ color: breakeven ? '#22d3ee' : 'var(--text-muted)' }}>
            {breakeven ? `≥ Nivel ${breakeven}` : 'Nunca'}
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Maestría</span>
          <span className={styles.summaryValue}>{analysis.currentMastery}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Taller/Workers/Boost</span>
          <span className={styles.summaryValue} style={{ fontSize: '0.7rem' }}>
            {analysis.currentWorkshop}% / {analysis.currentWorkers}% / x{analysis.currentBoost}
          </span>
        </div>
      </div>

      {/* Profit by level table */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>📊 RENTABILIDAD POR NIVEL</h3>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nivel</th>
                <th>Dur./ciclo</th>
                <th>Output/día</th>
                <th>Insumos/día</th>
                <th>Ingreso/día</th>
                <th>Profit/día</th>
                <th>Margen</th>
                <th>Costo mejora</th>
                <th>Gasto acum.</th>
                <th>ROI</th>
              </tr>
            </thead>
            <tbody>
              {analysis.byLevel.map((entry) => {
                const isCurrent = entry.level === analysis.currentLevel;
                const bestInCol = entry.profitPerDay === Math.max(...analysis.byLevel.map(e => e.profitPerDay));
                return (
                  <tr
                    key={entry.level}
                    className={`${isCurrent ? styles.rowCurrent : ''} ${bestInCol && entry.profitPerDay > 0 ? styles.rowBest : ''}`}
                  >
                    <td className={styles.levelCell}>
                      <span className={styles.levelBadge}>{entry.level}</span>
                      {isCurrent && <span className={styles.currentBadge}>ACTUAL</span>}
                    </td>
                    <td>{formatDuration(entry.durationSec)}</td>
                    <td>{entry.outputPerDay.toFixed(1)}</td>
                    <td style={{ color: '#f87171' }}>{formatCoin(entry.inputCostPerDay)}</td>
                    <td style={{ color: '#39ff14' }}>{formatCoin(entry.revenuePerDay)}</td>
                    <td style={{ color: entry.profitPerDay >= 0 ? '#39ff14' : '#f87171', fontWeight: 700 }}>
                      {formatCoin(entry.profitPerDay)}
                    </td>
                    <td style={{ color: entry.marginPct >= 0 ? '#39ff14' : '#f87171' }}>
                      {entry.marginPct >= 0 ? '+' : ''}{entry.marginPct.toFixed(1)}%
                    </td>
                    <td>{entry.upgradeCostCoin > 0 ? formatCoin(entry.upgradeCostCoin) : '—'}</td>
                    <td>{entry.cumulativeCostCoin > 0 ? formatCoin(entry.cumulativeCostCoin) : '—'}</td>
                    <td style={{ color: isFinite(entry.roiDays) && entry.roiDays > 0 ? '#fbbf24' : '#6b7280' }}>
                      {entry.roiDays > 0 && isFinite(entry.roiDays) ? formatDays(entry.roiDays) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Breakeven + best level highlight */}
      {breakeven && (
        <div className={styles.insightBox}>
          {currentLevelEntry?.profitPerDay < 0 ? (
            <span>
              ⚠️ Necesitas al menos <strong>Nivel {breakeven}</strong> para tener ganancia positiva con tu configuración actual.
              {analysis.byLevel.filter(e => e.profitPerDay > 0).length > 0 && (
                <> El nivel más rentable es <strong>Nivel {analysis.byLevel.reduce((best, e) => e.profitPerDay > best.profitPerDay ? e : best).level}</strong>.</>
              )}
            </span>
          ) : (
            <span>
              ✅ Ya tienes ganancia desde Nivel {analysis.currentLevel}.
              {analysis.byLevel.filter(e => e.profitPerDay > analysis.byLevel[analysis.currentLevel - 1].profitPerDay).length > 0 && (
                <> Subir a <strong>Nivel {analysis.byLevel.reduce((best, e) => e.profitPerDay > best.profitPerDay ? e : best).level}</strong> maximiza tu ganancia.</>
              )}
            </span>
          )}
        </div>
      )}

      {/* Mastery curve (compact) */}
      {analysis.byMastery.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>🎯 SENSIBILIDAD A MAESTRÍA (nivel fijo {analysis.currentLevel})</h3>
          <div className={styles.masteryGrid}>
            {analysis.byMastery.filter((_, i) => i % 4 === 0 || analysis.byMastery[i].mastery === analysis.currentMastery).map(entry => {
              const isCurrent = entry.mastery === analysis.currentMastery;
              return (
                <div key={entry.mastery} className={`${styles.masteryCard} ${isCurrent ? styles.masteryCurrent : ''}`}>
                  <span className={styles.masteryLevel}>{entry.mastery}</span>
                  <span className={styles.masteryValue} style={{ color: entry.profitPerDay >= 0 ? '#39ff14' : '#f87171' }}>
                    {formatCoin(entry.profitPerDay)}
                  </span>
                  <span className={styles.masterySub}>Profit/día</span>
                  <span className={styles.masterySub} style={{ color: '#fbbf24' }}>
                    -{entry.inputReductionPct.toFixed(1)}% insumos
                  </span>
                  {isCurrent && <span className={styles.dotActive}>●</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${Math.floor(sec % 60)}s`;
}
