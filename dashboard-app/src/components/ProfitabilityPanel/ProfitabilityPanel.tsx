import React, { useMemo } from 'react';
import { useNumberCounter } from '../../hooks/useNumberCounter';
import { computeAllProfitability, type ResourceProfit } from '../../utils/profitability';
import { toCapitalCase } from '../../utils/string';
import { getEmoji } from '../../utils/gameHelpers';
import type { TokenPrices } from '../../utils/priceService';
import type { PlayerConfig } from '../../hooks/usePlayerConfig';
import type { PlayerAccountInfo, PlayerMine } from '../../utils/accountService';
import styles from './ProfitabilityPanel.module.css';

interface ProfitabilityPanelProps {
  prices: TokenPrices;
  playerConfig: PlayerConfig;
  accountInfo?: PlayerAccountInfo | null;
}

function formatCoin(val: number): string {
  if (val === 0) return '0.00';
  if (Math.abs(val) < 0.001) return val.toFixed(6);
  if (Math.abs(val) < 0.01) return val.toFixed(4);
  if (Math.abs(val) < 1) return val.toFixed(2);
  return val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCompact(val: number): string {
  if (val === 0) return '0';
  if (Math.abs(val) >= 1000000) return (val / 1000000).toFixed(2) + 'M';
  if (Math.abs(val) >= 1000) return (val / 1000).toFixed(1) + 'K';
  return val.toFixed(1);
}

function getBestUseLabel(use: ResourceProfit['bestUse']): { text: string; color: string; icon: string } {
  switch (use) {
    case 'sell_raw':
      return { text: 'VENDER DIRECTO', color: '#fbbf24', icon: '💰' };
    case 'craft_self':
      return { text: 'FABRICAR (tienes fábricas)', color: '#39ff14', icon: '🏭' };
    case 'buy_and_craft':
      return { text: 'COMPRAR INSUMOS Y FABRICAR', color: '#22d3ee', icon: '📈' };
    case 'use_as_input':
      return { text: 'USAR COMO INSUMO', color: '#c084fc', icon: '🔗' };
    case 'nothing':
      return { text: 'NO RENTABLE', color: '#6b7280', icon: '⛔' };
  }
}

export const ProfitabilityPanel: React.FC<ProfitabilityPanelProps> = ({
  prices,
  playerConfig,
  accountInfo
}) => {
  const allProfits = useMemo(() => {
    return computeAllProfitability(prices, playerConfig);
  }, [prices, playerConfig]);

  // Build a map of resource → individual factory levels from accountInfo
  const factoryLevelsMap = useMemo(() => {
    if (!accountInfo?.factories) return {} as Record<string, number[]>;
    const map: Record<string, number[]> = {};
    accountInfo.factories.forEach((f: PlayerMine) => {
      const symbol = (f.definition?.id || f.id || '').toUpperCase();
      if (!map[symbol]) map[symbol] = [];
      map[symbol].push(f.level);
    });
    return map;
  }, [accountInfo?.factories]);

  const animatedDailyProfit = useNumberCounter(
    allProfits.reduce((sum, r) => sum + Math.max(0, r.profitPerDay), 0)
  );

  // Separate into categories
  const withFactories = allProfits.filter(r => r.factoryCount > 0 && r.profitPerDay > 0);
  const profitableToCraft = allProfits.filter(r => r.isCraftable && r.marginPct > 0 && r.factoryCount === 0);
  const bestToSell = allProfits.filter(r => r.bestUse === 'sell_raw' || (r.isCraftable && r.marginPct <= 0 && r.sellPrice > 0));

  return (
    <section className={`bento-card ${styles.card}`}>
      <h2 className="card-title">🏆 RENTABILIDAD TOTAL — COMPRAR vs FABRICAR vs VENDER</h2>

      {/* Global summary */}
      <div className={styles.globalSummary}>
        <div className={styles.summaryBox}>
          <span className={styles.summaryLabel}>Ganancia Total Activa/día</span>
          <span className={styles.summaryValue}>{formatCompact(animatedDailyProfit)} COIN</span>
        </div>
        <div className={styles.summaryBox}>
          <span className={styles.summaryLabel}>Fábricas Rentables</span>
          <span className={styles.summaryValue}>{withFactories.length}</span>
        </div>
        <div className={styles.summaryBox}>
          <span className={styles.summaryLabel}>Recursos Analizados</span>
          <span className={styles.summaryValue}>{allProfits.length}</span>
        </div>
      </div>

      {/* 1. BEST USE — quick recommendation per resource */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>📋 RECOMENDACIONES POR RECURSO</h3>
        <div className={styles.tableWrapper}>
          <div className={styles.tableContainer}>
            <div className={`${styles.tableRow} ${styles.tableHeader}`}>
              <div className={styles.cell}>RECURSO</div>
              <div className={styles.cell}>MEJOR USO</div>
              <div className={styles.cell}>PRECIO VENTA</div>
              <div className={styles.cell}>COSTE FABRICACIÓN</div>
              <div className={styles.cell}>MARGEN DIRECTO</div>
              <div className={styles.cell}>MARGEN TOTAL</div>
              <div className={styles.cell}>PROFIT/DÍA</div>
              <div className={styles.cell}>PROFIT/HR</div>
              <div className={styles.cell}>NIVEL</div>
              <div className={styles.cell}># FÁB</div>
            </div>
            {allProfits.map(r => {
              const gl = getBestUseLabel(r.bestUse);
              const fLevels = factoryLevelsMap[r.name] || [];
              return (
                <div key={r.name} className={styles.tableRow}>
                  <div className={styles.cell}>
                    <span className={styles.resourceIcon}>{getEmoji(r.name)}</span>
                    <span className={styles.resourceName}>{toCapitalCase(r.name)}</span>
                  </div>
                  <div className={styles.cell}>
                    <span className={styles.bestUseBadge} style={{ color: gl.color, borderColor: gl.color }}>
                      {gl.icon} {gl.text}
                    </span>
                  </div>
                  <div className={styles.cell}>{formatCoin(r.sellPrice)}</div>
                  <div className={styles.cell}>{r.isCraftable ? formatCoin(r.craftCostPerUnit) : '—'}</div>
                  <div className={styles.cell} style={{ color: r.marginDirectPct > 0 ? '#39ff14' : '#f87171', fontWeight: 700 }}>
                    {r.isCraftable && r.directInputCostPerUnit > 0
                      ? (r.marginDirectPct > 0 ? '+' : '') + r.marginDirectPct.toFixed(1) + '%'
                      : '—'}
                  </div>
                  <div className={styles.cell} style={{ color: r.marginPct > 0 ? '#39ff14' : '#f87171', opacity: 0.7, fontSize: '0.72rem' }}>
                    {r.isCraftable ? (r.marginPct > 0 ? '+' : '') + r.marginPct.toFixed(1) + '%' : '—'}
                  </div>
                  <div className={styles.cell} style={{ color: r.profitPerDay > 0 ? '#39ff14' : 'var(--text-muted)' }}>
                    {r.factoryCount > 0 ? formatCoin(r.profitPerDay) : '—'}
                  </div>
                  <div className={styles.cell} style={{ color: r.profitPerHour > 0 ? '#39ff14' : 'var(--text-muted)' }}>
                    {r.factoryCount > 0 ? formatCoin(r.profitPerHour) : '—'}
                  </div>
                  <div className={styles.cell}>
                    <span className={styles.levelPill}>{r.level}</span>
                    {fLevels.length > 0 && (
                      <span className={styles.levelsDetail} title={fLevels.join(', ')}>
                        ({fLevels.join(',')})
                      </span>
                    )}
                  </div>
                  <div className={styles.cell}>
                    <span className={styles.factoryPill}>{r.factoryCount}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. TOP RANKINGS */}
      <div className={styles.rankingsGrid}>
        <div className={styles.rankingCard}>
          <h4 className={styles.rankingTitle}>🏭 Mayor Ganancia/día (tus fábricas)</h4>
          <div className={styles.rankingList}>
            {withFactories.slice(0, 10).map((r, i) => (
              <div key={r.name} className={styles.rankingRow}>
                <span className={styles.rankNum}>#{i + 1}</span>
                <span className={styles.rankIcon}>{getEmoji(r.name)}</span>
                <span className={styles.rankName}>{toCapitalCase(r.name)}</span>
                <span className={styles.rankValue}>{formatCoin(r.profitPerDay)}/día</span>
              </div>
            ))}
            {withFactories.length === 0 && (
              <div className={styles.emptyState}>Activa fábricas en la pestaña Producción</div>
            )}
          </div>
        </div>

        <div className={styles.rankingCard}>
          <h4 className={styles.rankingTitle}>📈 Mayor Margen (comprar insumos → fabricar → vender)</h4>
          <div className={styles.rankingList}>
            {profitableToCraft.slice(0, 10).map((r, i) => (
              <div key={r.name} className={styles.rankingRow}>
                <span className={styles.rankNum}>#{i + 1}</span>
                <span className={styles.rankIcon}>{getEmoji(r.name)}</span>
                <span className={styles.rankName}>{toCapitalCase(r.name)}</span>
                <span className={styles.rankValue}>+{r.marginPct.toFixed(1)}%</span>
              </div>
            ))}
            {profitableToCraft.length === 0 && (
              <div className={styles.emptyState}>Ningún recurso da margen comprando insumos</div>
            )}
          </div>
        </div>

        <div className={styles.rankingCard}>
          <h4 className={styles.rankingTitle}>💰 Mejor para VENDER DIRECTO (recursos básicos)</h4>
          <div className={styles.rankingList}>
            {bestToSell.slice(0, 10).map((r, i) => (
              <div key={r.name} className={styles.rankingRow}>
                <span className={styles.rankNum}>#{i + 1}</span>
                <span className={styles.rankIcon}>{getEmoji(r.name)}</span>
                <span className={styles.rankName}>{toCapitalCase(r.name)}</span>
                <span className={styles.rankValue}>{formatCoin(r.sellPrice)}/ud</span>
              </div>
            ))}
            {bestToSell.length === 0 && (
              <div className={styles.emptyState}>Sin datos de precio</div>
            )}
          </div>
        </div>
      </div>

      {/* 3. SELL vs USE AS INPUT — crossover analysis */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>🔗 VENDER vs USAR COMO INSUMO</h3>
        <div className={styles.tableWrapper}>
          <div className={styles.tableContainer}>
            <div className={`${styles.tableRow} ${styles.tableHeader}`}>
              <div className={styles.cell}>RECURSO</div>
              <div className={styles.cell}>VALOR VENTA</div>
              <div className={styles.cell}>SE USA EN</div>
              <div className={styles.cell}>VALOR AL FABRICAR</div>
              <div className={styles.cell}>RECOMENDACIÓN</div>
            </div>
            {allProfits.filter(r => r.usedAsInputIn.length > 0).map(r => (
              <div key={r.name} className={styles.tableRow}>
                <div className={styles.cell}>
                  <span className={styles.resourceIcon}>{getEmoji(r.name)}</span>
                  <span className={styles.resourceName}>{toCapitalCase(r.name)}</span>
                </div>
                <div className={styles.cell}>{formatCoin(r.sellPrice)} COIN</div>
                <div className={styles.cell}>
                  {r.usedAsInputIn.map(u => (
                    <div key={u.resource} className={styles.downstreamRow}>
                      <span>{getEmoji(u.resource)} {toCapitalCase(u.resource)}</span>
                      <span className={styles.downstreamAmt}>({u.amountConsumedPerUnit}/ud)</span>
                    </div>
                  ))}
                </div>
                <div className={styles.cell}>
                  {r.usedAsInputIn.map((u, i) => (
                    <div key={i} style={{ color: u.valueAddedPerUnit > r.sellPrice ? '#39ff14' : '#f87171', marginBottom: '2px' }}>
                      {formatCoin(u.valueAddedPerUnit)} COIN/ud
                    </div>
                  ))}
                </div>
                <div className={styles.cell}>
                  {r.usedAsInputIn.some(u => u.betterToUseAsInput) ? (
                    <span className={styles.bestUseBadge} style={{ color: '#c084fc', borderColor: '#c084fc' }}>
                      🔗 Mejor usarlo para fabricar
                    </span>
                  ) : r.sellPrice > 0 ? (
                    <span className={styles.bestUseBadge} style={{ color: '#fbbf24', borderColor: '#fbbf24' }}>
                      💰 Mejor venderlo directo
                    </span>
                  ) : (
                    <span className={styles.bestUseBadge} style={{ color: '#6b7280', borderColor: '#6b7280' }}>
                      — Sin datos
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. FULL CHAIN DRILLDOWN */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>🔬 CADENA DE FABRICACIÓN COMPLETA</h3>
        <div className={styles.chainGrid}>
          {allProfits.filter(r => r.isCraftable && r.chain.length > 0).slice(0, 15).map(r => (
            <details key={r.name} className={styles.chainDetails}>
              <summary className={styles.chainSummary}>
                <span>{getEmoji(r.name)} <strong>{toCapitalCase(r.name)}</strong></span>
                <span style={{ color: r.marginPct > 0 ? '#39ff14' : '#f87171', fontSize: '0.78rem' }}>
                  Coste: {formatCoin(r.craftCostPerUnit)} COIN | Venta: {formatCoin(r.sellPrice)} COIN | Margen: {r.marginPct > 0 ? '+' : ''}{r.marginPct.toFixed(1)}%
                </span>
              </summary>
              <div className={styles.chainContent}>
                {renderChain(r.chain, prices, 0)}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
};

function renderChain(nodes: ResourceProfit['chain'], prices: TokenPrices, depth: number): React.ReactNode {
  return nodes.map((node, i) => (
    <div key={i} style={{ marginLeft: depth * 20, marginBottom: '4px' }}>
      <div className={styles.chainNodeRow}>
        <span style={{ opacity: 0.4, fontSize: '0.7rem', minWidth: '24px' }}>{'└─'.padStart(depth + 1, '─').padEnd(depth + 2, '─')}</span>
        <span>{getEmoji(node.resource)}</span>
        <span className={styles.chainNodeName}>{toCapitalCase(node.resource)}</span>
        <span className={styles.chainNodeAmt}>x{node.amount.toFixed(2)}</span>
        <span className={styles.chainNodeCost}>{formatCoin(node.costCoin)} COIN</span>
        {node.isBase && <span className={styles.chainBaseBadge}>BASE</span>}
      </div>
      {node.children.length > 0 && renderChain(node.children, prices, depth + 1)}
    </div>
  ));
}
