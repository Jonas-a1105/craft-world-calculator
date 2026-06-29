import React, { useMemo, useCallback } from 'react';
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Legend,
} from 'recharts';
import type { PlayerConfig } from '../../hooks/usePlayerConfig';
import type { TokenPrices } from '../../utils/priceService';
import { FACTORIES_DATA } from '../../assets/data/factories';
import { toCapitalCase } from '../../utils/string';
import {
  CHART_COLORS, getSeriesColor,
  TOOLTIP_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_ITEM_STYLE,
  AXIS_STYLE, GRID_STYLE, formatCompact,
} from '../../utils/rechartsTheme';
import styles from './PowerCalculator.module.css';

/* ───────────────────────── types ───────────────────────── */

interface PowerCalculatorProps {
  playerConfig: PlayerConfig;
  prices: TokenPrices;
}

interface ActiveFactoryPower {
  name: string;
  factoryCount: number;
  level: number;
  powerCostPerFactory: number;
  totalPowerWatts: number;
  sharePct: number;
}

interface PiePayloadEntry {
  name: string;
  value: number;
  pct: number;
  watts: number;
}

interface CostBarEntry {
  periodo: string;
  coin: number;
  usd: number;
  fill: string;
}

/* ──────────────────── custom tooltip helpers ──────────────────── */

const PieTooltipContent: React.FC<{
  active?: boolean;
  payload?: Array<{ payload: PiePayloadEntry }>;
}> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={TOOLTIP_STYLE}>
      <p style={TOOLTIP_LABEL_STYLE}>{d.name}</p>
      <p style={TOOLTIP_ITEM_STYLE}>⚡ {d.watts.toLocaleString('es-ES')} W/h</p>
      <p style={TOOLTIP_ITEM_STYLE}>📊 {d.pct.toFixed(1)}% del total</p>
    </div>
  );
};

const BarTooltipContent: React.FC<{
  active?: boolean;
  payload?: Array<{ payload: CostBarEntry }>;
}> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={TOOLTIP_STYLE}>
      <p style={TOOLTIP_LABEL_STYLE}>{d.periodo}</p>
      <p style={TOOLTIP_ITEM_STYLE}>🪙 {d.coin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} COIN</p>
      <p style={TOOLTIP_ITEM_STYLE}>💵 {d.usd.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</p>
    </div>
  );
};

/* ──────────────────── custom pie label ──────────────────── */

const renderCustomLabel = (props: any) => {
  const { cx, cy, midAngle, outerRadius, name, percent } = props;
  const pct = (percent || 0) * 100;
  if (pct < 8) return null;
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 18;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="#d8b4fe"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={11}
      fontFamily="'Outfit', sans-serif"
    >
      {name} ({pct.toFixed(0)}%)
    </text>
  );
};

/* ════════════════════ COMPONENT ════════════════════ */

export const PowerCalculator: React.FC<PowerCalculatorProps> = ({
  playerConfig,
  prices
}) => {
  // Compute list of active factories and their power consumption
  const activeFactoriesPower = useMemo((): ActiveFactoryPower[] => {
    const list: Omit<ActiveFactoryPower, 'sharePct'>[] = [];
    let grandTotalWatts = 0;

    Object.entries(playerConfig).forEach(([name, config]) => {
      if (config.factories > 0 && FACTORIES_DATA[name]) {
        const levels = FACTORIES_DATA[name];
        const currentLvl = Math.max(1, Math.min(config.level, levels.length));
        const levelData = levels[currentLvl - 1];
        const powerCostPerFactory = levelData?.power_cost || 0;
        const baseDurationSec = levelData?.duration_sec || 3600;

        // Speed bonuses affect cycles per hour → power consumption per hour
        const speedMod = 1 + (config.workshop / 100) + (config.workers / 100);
        const boostMult = config.boost || 1;
        const finalCycleDuration = Math.max(0.1, baseDurationSec / (speedMod * boostMult));
        const cyclesPerHour = 3600 / finalCycleDuration;

        const totalPowerWatts = powerCostPerFactory * cyclesPerHour * config.factories;
        grandTotalWatts += totalPowerWatts;

        list.push({
          name,
          factoryCount: config.factories,
          level: config.level,
          powerCostPerFactory,
          totalPowerWatts
        });
      }
    });

    return list.map(item => ({
      ...item,
      sharePct: grandTotalWatts > 0 ? (item.totalPowerWatts / grandTotalWatts) * 100 : 0
    })).sort((a, b) => b.totalPowerWatts - a.totalPowerWatts);
  }, [playerConfig]);

  // Aggregate stats
  const totalWattsPerHour = useMemo(() => {
    return activeFactoriesPower.reduce((sum, item) => sum + item.totalPowerWatts, 0);
  }, [activeFactoriesPower]);

  const totalWattsPerDay = totalWattsPerHour * 24;
  const totalWattsPerWeek = totalWattsPerDay * 7;
  const totalWattsPerMonth = totalWattsPerDay * 30;

  // Energy Token cost calculations
  const ENERGY_KW_RATIO = 1000;
  const dailyEnergyTokensNeeded = totalWattsPerDay / ENERGY_KW_RATIO;
  const weeklyEnergyTokensNeeded = totalWattsPerWeek / ENERGY_KW_RATIO;
  const monthlyEnergyTokensNeeded = totalWattsPerMonth / ENERGY_KW_RATIO;

  const energyPrice = prices['ENERGY'];
  
  const dailyEnergyCostCoin = energyPrice ? dailyEnergyTokensNeeded * energyPrice.buy : 0;
  const dailyEnergyCostUsd = energyPrice ? dailyEnergyTokensNeeded * energyPrice.usdBuy : 0;

  const weeklyEnergyCostCoin = energyPrice ? weeklyEnergyTokensNeeded * energyPrice.buy : 0;
  const weeklyEnergyCostUsd = energyPrice ? weeklyEnergyTokensNeeded * energyPrice.usdBuy : 0;

  const monthlyEnergyCostCoin = energyPrice ? monthlyEnergyTokensNeeded * energyPrice.buy : 0;
  const monthlyEnergyCostUsd = energyPrice ? monthlyEnergyTokensNeeded * energyPrice.usdBuy : 0;

  /* ── format helpers ── */
  const formatWatts = useCallback((watts: number) => {
    if (watts >= 1000000) return `${(watts / 1000000).toFixed(2)} MW`;
    if (watts >= 1000) return `${(watts / 1000).toFixed(2)} kW`;
    return `${watts.toLocaleString('es-ES')} W`;
  }, []);

  const formatCoin = (num: number) => num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatUsd = (num: number) => num.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* ── chart data ── */
  const pieData: PiePayloadEntry[] = useMemo(() =>
    activeFactoriesPower.map(f => ({
      name: f.name,
      value: f.totalPowerWatts,
      pct: f.sharePct,
      watts: f.totalPowerWatts,
    })),
  [activeFactoriesPower]);

  const costBarData: CostBarEntry[] = useMemo(() => [
    { periodo: 'Diario', coin: dailyEnergyCostCoin, usd: dailyEnergyCostUsd, fill: CHART_COLORS.green },
    { periodo: 'Semanal', coin: weeklyEnergyCostCoin, usd: weeklyEnergyCostUsd, fill: CHART_COLORS.orange },
    { periodo: 'Mensual', coin: monthlyEnergyCostCoin, usd: monthlyEnergyCostUsd, fill: CHART_COLORS.pink },
  ], [dailyEnergyCostCoin, dailyEnergyCostUsd, weeklyEnergyCostCoin, weeklyEnergyCostUsd, monthlyEnergyCostCoin, monthlyEnergyCostUsd]);

  /* ═══════════════ RENDER ═══════════════ */

  if (activeFactoriesPower.length === 0) {
    return (
      <section className={`bento-card ${styles.card}`}>
        <h2 className={styles.title}>⚡ SIMULADOR DE ENERGÍA Y CONSUMO</h2>
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>🔋</span>
          No tienes fábricas activas configuradas.
          <br />
          Activa fábricas en el panel de bonificaciones o de configuración para ver el cálculo de energía.
        </div>
      </section>
    );
  }

  return (
    <section className={`bento-card ${styles.card}`}>
      <h2 className={styles.title}>⚡ SIMULADOR DE ENERGÍA Y CONSUMO</h2>

      {/* ─────── Donut Chart: Power Distribution ─────── */}
      <div className={styles.chartSection}>
        <h3 className={styles.listTitle}>📊 Distribución de Consumo Energético</h3>
        <div className={styles.donutWrapper}>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                animationDuration={800}
                animationEasing="ease-out"
                label={renderCustomLabel}
                labelLine={false}
              >
                {pieData.map((_entry, idx) => (
                  <Cell
                    key={`cell-${idx}`}
                    fill={getSeriesColor(idx)}
                    stroke="rgba(0,0,0,0.4)"
                    strokeWidth={1}
                  />
                ))}
              </Pie>
              <RechartsTooltip content={<PieTooltipContent />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className={styles.donutCenter}>
            <span className={styles.donutCenterValue}>{formatCompact(totalWattsPerHour)}</span>
            <span className={styles.donutCenterLabel}>W/h total</span>
          </div>
        </div>
      </div>

      <div className={styles.powerLayout}>
        {/* ───── Left column: factory list ───── */}
        <div>
          <h3 className={styles.listTitle}>🔋 Consumo por Fábrica Activa</h3>
          <div className={styles.factoryScrollList}>
            {activeFactoriesPower.map((item, idx) => (
              <div key={item.name} className={styles.factoryRow}>
                <div className={styles.rowHeader}>
                  <div className={styles.factoryInfo}>
                    <img
                      src={`/assets/resources/${toCapitalCase(item.name)}.png`}
                      className={styles.factoryIcon}
                      alt={item.name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/assets/resources/Mud.png';
                      }}
                    />
                    <span className={styles.factoryName}>{item.name}</span>
                  </div>
                  <div className={styles.factoryBadges}>
                    <span className={`${styles.badge} ${styles.badgeQty}`}>
                      {item.factoryCount} {item.factoryCount === 1 ? 'fábrica' : 'fábricas'}
                    </span>
                    <span className={`${styles.badge} ${styles.badgeLvl}`}>
                      Nivel {item.level}
                    </span>
                  </div>
                  <div className={styles.powerUsageText}>
                    {formatWatts(item.totalPowerWatts)}/h
                  </div>
                </div>

                {/* Text-only share info with color dot */}
                <div className={styles.shareTextRow}>
                  <span
                    className={styles.colorDot}
                    style={{ backgroundColor: getSeriesColor(idx) }}
                  />
                  <span className={styles.sharePctText}>
                    {item.sharePct.toFixed(1)}% del consumo total — {formatWatts(item.powerCostPerFactory)}/fábrica
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ───── Right column: summary ───── */}
        <div className={styles.summaryCard}>
          <h3 className={styles.summaryTitle}>⚡ Resumen de Demanda</h3>
          
          <div className={styles.totalWattsRow}>
            <span className={styles.totalLabel}>Consumo Total en Tiempo Real</span>
            <div className={styles.totalValue}>{formatWatts(totalWattsPerHour)}/h</div>
          </div>

          <div className={styles.totalsGrid}>
            <div className={styles.gridRow}>
              <span className={styles.gridLabel}>Consumo Diario (24h):</span>
              <span className={styles.gridVal}>{formatWatts(totalWattsPerDay)}</span>
            </div>
            <div className={styles.gridRow}>
              <span className={styles.gridLabel}>Consumo Semanal (7d):</span>
              <span className={styles.gridVal}>{formatWatts(totalWattsPerWeek)}</span>
            </div>
            <div className={styles.gridRow}>
              <span className={styles.gridLabel}>Consumo Mensual (30d):</span>
              <span className={styles.gridVal}>{formatWatts(totalWattsPerMonth)}</span>
            </div>
          </div>

          {/* Energy token requirements and financial costs */}
          <div className={styles.energyCostCard}>
            <div className={styles.energyHeader}>
              <span>⚡ Costo de Fichas de Energía (ENERGY)</span>
            </div>
            
            <div className={styles.energyValRow}>
              <span className={styles.gridLabel} style={{ fontSize: '0.78rem' }}>Demanda Diaria:</span>
              <span className={styles.energyTokensNeeded}>
                {dailyEnergyTokensNeeded.toLocaleString('es-ES', { maximumFractionDigits: 2 })} ENERGY
              </span>
            </div>

            {energyPrice ? (
              <>
                <div className={styles.energyValRow} style={{ marginTop: '4px', borderTop: '1px dashed rgba(255,255,255,0.06)', paddingTop: '6px' }}>
                  <span className={styles.gridLabel} style={{ fontSize: '0.78rem' }}>Costo Diario:</span>
                  <div style={{ textAlign: 'right' }}>
                    <span className={styles.energyCostCoin}>{formatCoin(dailyEnergyCostCoin)} COIN</span>
                    <div className={styles.energyCostUsd}>({formatUsd(dailyEnergyCostUsd)})</div>
                  </div>
                </div>
                <div className={styles.energyValRow}>
                  <span className={styles.gridLabel} style={{ fontSize: '0.78rem' }}>Costo Semanal (7d):</span>
                  <div style={{ textAlign: 'right' }}>
                    <span className={styles.energyCostCoin} style={{ color: 'var(--color-orange)' }}>{formatCoin(weeklyEnergyCostCoin)} COIN</span>
                    <div className={styles.energyCostUsd}>({formatUsd(weeklyEnergyCostUsd)})</div>
                  </div>
                </div>
                <div className={styles.energyValRow}>
                  <span className={styles.gridLabel} style={{ fontSize: '0.78rem' }}>Costo Mensual (30d):</span>
                  <div style={{ textAlign: 'right' }}>
                    <span className={styles.energyCostCoin} style={{ color: 'var(--color-pink)' }}>{formatCoin(monthlyEnergyCostCoin)} COIN</span>
                    <div className={styles.energyCostUsd}>({formatUsd(monthlyEnergyCostUsd)})</div>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.note} style={{ color: 'var(--color-pink)' }}>
                No hay datos de cotización del token ENERGY.
              </div>
            )}
            
            <div className={styles.note}>
              💡 Nota: La conversión se basa en la equivalencia oficial del juego, donde 1 token de ENERGY equivale a 1,000 W-h (1 kWh) de consumo energético.
            </div>
          </div>
        </div>
      </div>

      {/* ─────── Bar Chart: Cost Comparison ─────── */}
      {energyPrice && (
        <div className={styles.chartSection}>
          <h3 className={styles.listTitle}>💰 Comparativa de Costos de Energía</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={costBarData}
              margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid {...GRID_STYLE} />
              <XAxis
                dataKey="periodo"
                {...AXIS_STYLE}
              />
              <YAxis
                {...AXIS_STYLE}
                tickFormatter={formatCompact}
              />
              <RechartsTooltip content={<BarTooltipContent />} />
              <Legend
                formatter={(value: string) => (
                  <span style={{ color: '#d8b4fe', fontFamily: "'Outfit', sans-serif", fontSize: '0.78rem' }}>
                    {value}
                  </span>
                )}
              />
              <Bar
                dataKey="coin"
                name="Costo (COIN)"
                animationDuration={800}
                animationEasing="ease-out"
                radius={[6, 6, 0, 0]}
              >
                {costBarData.map((entry, idx) => (
                  <Cell key={`bar-${idx}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
};
