import { useEffect, useMemo, useState } from 'react';
import Card from '../components/Card';
import Layout from '../components/Layout';
import { SkeletonDashboardPage } from '../components/Skeleton';
import { useTranslation } from '../utils/i18n';
import { getCraftworldHome } from '../services/api';
import { formatDurationFromMinutes } from '../services/durationFormat';
import { type FactoryBoost } from '../services/factoryBoostModifiers';
import { loadFactoryData, type FactoryDataRow } from '../services/factoryData';
import { calculateFactoryCycle } from '../services/craftworldCalculations';
import { type WorkshopItem } from '../services/workshopModifiers';

function getFactoryImage(symbol?: string) {
  if (!symbol) return '';
  const cleanName = symbol.trim().toLowerCase();
  const capitalized = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

  if (capitalized === 'Earth') return '/assets/factories/Earth.png';
  return `/assets/factories/${capitalized}.gif`;
}

function getResourceImage(symbol?: string) {
  if (!symbol) return '';
  const cleanSymbol = symbol.trim().toLowerCase();
  const formattedSymbol = cleanSymbol.charAt(0).toUpperCase() + cleanSymbol.slice(1);
  return `/assets/resources/${formattedSymbol}.png`;
}

function formatPlotName(plotName: string, lang: string): string {
  const normalized = String(plotName || '').trim().toUpperCase();
  if (lang === 'es') {
    switch (normalized) {
      case 'EARTH_PLOT':
        return 'Parcela de Tierra';
      case 'BLUEPRINT_PLOT':
      case 'BLUEPRINT_PLOT_A':
        return 'Parcela de Planos A';
      case 'BLUEPRINT_PLOT_B':
        return 'Parcela de Planos B';
      case 'FLEXIBLE_PLOT':
        return 'Parcela Flexible';
      default:
        return String(plotName || '')
          .trim()
          .toLowerCase()
          .replace(/_/g, ' ')
          .replace(/\w/g, c => c.toUpperCase());
    }
  } else {
    switch (normalized) {
      case 'EARTH_PLOT':
        return 'Earth Plot';
      case 'BLUEPRINT_PLOT':
      case 'BLUEPRINT_PLOT_A':
        return 'Blueprint Plot A';
      case 'BLUEPRINT_PLOT_B':
        return 'Blueprint Plot B';
      case 'FLEXIBLE_PLOT':
        return 'Flexible Plot';
      default:
        return String(plotName || '')
          .trim()
          .toLowerCase()
          .replace(/_/g, ' ')
          .replace(/\w/g, c => c.toUpperCase());
    }
  }
}

function formatFactoryName(symbol: string, lang: string): string {
  const normalized = String(symbol || '').trim().toUpperCase();
  if (lang === 'es') {
    switch (normalized) {
      case 'STEEL': return 'Acero';
      case 'WOOD': return 'Madera';
      case 'FIRE': return 'Fuego';
      case 'WATER': return 'Agua';
      case 'EARTH': return 'Tierra';
      case 'AIR': return 'Aire';
      case 'GOLD': return 'Oro';
      case 'IRON': return 'Hierro';
      case 'STONE': return 'Piedra';
      case 'SILVER': return 'Plata';
      case 'COPPER': return 'Cobre';
      case 'BRONZE': return 'Bronce';
      default:
        return normalized.charAt(0) + normalized.slice(1).toLowerCase();
    }
  } else {
    switch (normalized) {
      case 'STEEL': return 'Steel';
      case 'WOOD': return 'Wood';
      case 'FIRE': return 'Fire';
      case 'WATER': return 'Water';
      case 'EARTH': return 'Earth';
      case 'AIR': return 'Air';
      case 'GOLD': return 'Gold';
      case 'IRON': return 'Iron';
      case 'STONE': return 'Stone';
      case 'SILVER': return 'Silver';
      case 'COPPER': return 'Copper';
      case 'BRONZE': return 'Bronze';
      default:
        return normalized.charAt(0) + normalized.slice(1).toLowerCase();
    }
  }
}

type OwnedFactory = {
  id?: string;
  areaSymbol?: string;
  level?: number;
  landPlotName?: string;
  currentRunLevel?: number;
  activeBoosts?: FactoryBoost[];
};

type HomeData = {
  lastSyncedAt?: string;
  factories?: OwnedFactory[];
  workshop?: WorkshopItem[];
};

type FactoryProductionRow = {
  key: string;
  symbol: string;
  plotName: string;
  level: number;
  outputToken: string;
  outputAmount: number;
  baseDurationMinutes: number;
  effectiveDurationMinutes: number;
  runsPerHour: number;
  outputPerHour: number;
  outputPerDay: number;
  workshopBoostPercent: number;
  activeBoostPercent: number;
};

type TokenTotal = {
  token: string;
  perHour: number;
  perDay: number;
  factoryCount: number;
};

function fmt(value: number, digits = 3) {
  return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : '0';
}

function getDisplayLevel(factory: OwnedFactory) {
  return typeof factory.currentRunLevel === 'number'
    ? factory.currentRunLevel + 1
    : typeof factory.level === 'number'
      ? factory.level + 1
      : 0;
}

function getFactoryRow(factoryRows: FactoryDataRow[], factory: OwnedFactory) {
  const symbol = String(factory.areaSymbol || '').trim().toUpperCase();
  const level = getDisplayLevel(factory);
  return factoryRows.find((row) => row.token === symbol && row.level === level) || null;
}

function buildProductionRows(factories: OwnedFactory[], factoryRows: FactoryDataRow[], workshop: WorkshopItem[]) {
  return factories
    .map((factory, index): FactoryProductionRow | null => {
      const row = getFactoryRow(factoryRows, factory);
      const symbol = String(factory.areaSymbol || '').trim().toUpperCase();
      if (!row || !symbol) return null;

      const cycle = calculateFactoryCycle(row, {}, { workshop, activeBoosts: factory.activeBoosts || [] });

      return {
        key: factory.id || `${factory.landPlotName || 'plot'}-${symbol}-${row.level}-${index}`,
        symbol,
        plotName: factory.landPlotName || 'Unknown plot',
        level: row.level,
        outputToken: row.output_token,
        outputAmount: row.output_amount,
        baseDurationMinutes: row.duration_min,
        effectiveDurationMinutes: cycle.runtimeMinutes,
        runsPerHour: cycle.runsPerHour,
        outputPerHour: cycle.outputPerHour,
        outputPerDay: cycle.outputPerDay,
        workshopBoostPercent: cycle.workshopBoostPercent,
        activeBoostPercent: cycle.activeBoostPercent,
      };
    })
    .filter((value): value is FactoryProductionRow => Boolean(value))
    .sort((a, b) => b.outputPerDay - a.outputPerDay);
}

function buildTokenTotals(rows: FactoryProductionRow[]) {
  const totals = new Map<string, TokenTotal>();

  rows.forEach((row) => {
    const current = totals.get(row.outputToken) || { token: row.outputToken, perHour: 0, perDay: 0, factoryCount: 0 };
    current.perHour += row.outputPerHour;
    current.perDay += row.outputPerDay;
    current.factoryCount += 1;
    totals.set(row.outputToken, current);
  });

  return Array.from(totals.values()).sort((a, b) => b.perDay - a.perDay);
}

function getBestBoostPlacement(rows: FactoryProductionRow[]) {
  const candidates = rows.filter((row) => row.outputPerHour > 0);
  if (!candidates.length) return null;

  return [...candidates].sort((a, b) => {
    const aBaseRunsPerHour = a.baseDurationMinutes > 0 ? 60 / a.baseDurationMinutes : 0;
    const bBaseRunsPerHour = b.baseDurationMinutes > 0 ? 60 / b.baseDurationMinutes : 0;
    const aNaturalOutput = a.outputAmount * aBaseRunsPerHour;
    const bNaturalOutput = b.outputAmount * bBaseRunsPerHour;
    return bNaturalOutput - aNaturalOutput;
  })[0];
}

export default function EmpireDashboard() {
  const { t, language } = useTranslation();
  const [home, setHome] = useState<HomeData | null>(null);
  const [factoryRows, setFactoryRows] = useState<FactoryDataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [homeData, rows] = await Promise.all([getCraftworldHome(), loadFactoryData()]);
      setHome(homeData || {});
      setFactoryRows(rows);
    } catch {
      setError(language === 'es' ? 'No se pudo cargar la información del imperio. Recarga e intenta de nuevo.' : 'Unable to load empire dashboard data. Refresh and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const productionRows = useMemo(() => {
    return buildProductionRows(home?.factories || [], factoryRows, home?.workshop || []);
  }, [factoryRows, home]);

  const tokenTotals = useMemo(() => buildTokenTotals(productionRows), [productionRows]);
  const bestFactory = productionRows[0] || null;
  const bestBoostPlacement = useMemo(() => getBestBoostPlacement(productionRows), [productionRows]);
  const activeBoostedFactories = productionRows.filter((row) => row.activeBoostPercent > 0).length;
  const totalRunsPerHour = productionRows.reduce((total, row) => total + row.runsPerHour, 0);
  const lastSynced = home?.lastSyncedAt ? new Date(home.lastSyncedAt).toLocaleString() : 'Not connected';

  if (loading) {
    return (
      <Layout>
        <SkeletonDashboardPage />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4">
        {/* Empire Control Panel Card */}
        <div className="w-full max-w-[920px] mx-auto">
          <Card title="Empire Dashboard">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1 text-sm text-slate-300">
                <p>
                  {language === 'es'
                    ? "Cálculos de producción en vivo utilizando la misma ruta de ejecución que las tarjetas de fábrica: duración base de CSV, velocidad del taller y potenciadores activos de la fábrica."
                    : "Live production math using the same trusted runtime path as the factory cards: CSV base duration, workshop speed, and active factory boosts."}
                </p>
                <p className="text-slate-400">
                  {language === 'es' ? "Última sincronización: " : "Last synced: "}{lastSynced}
                </p>
                {error && <p className="text-red-300">{error}</p>}
              </div>
              <button onClick={load} className="retroBtn shrink-0">
                {language === 'es' ? 'Actualizar Datos' : 'Refresh Data'}
              </button>
            </div>
          </Card>
        </div>

        {/* General Stats cards */}
        <div className="grid gap-3 md:grid-cols-4 w-full max-w-[920px] mx-auto">
          <Card title="Tracked Factories">
            <div className="text-center text-xl font-bold text-white py-1">{fmt(productionRows.length, 0)}</div>
          </Card>
          <Card title="Total Runs / Hour">
            <div className="text-center text-xl font-bold text-white py-1">{fmt(totalRunsPerHour, 2)}</div>
          </Card>
          <Card title="Boosted Factories">
            <div className="text-center text-xl font-bold text-white py-1">{fmt(activeBoostedFactories, 0)}</div>
          </Card>
          <Card title="Output Tokens">
            <div className="text-center text-xl font-bold text-white py-1">{fmt(tokenTotals.length, 0)}</div>
          </Card>
        </div>

        {/* Next Best Action and Top Producer */}
        <div className="grid gap-3 lg:grid-cols-2 w-full max-w-[920px] mx-auto">
          <Card title="Next Best Action">
            {bestBoostPlacement ? (
              <div className="flex gap-4 items-start text-sm">
                {getFactoryImage(bestBoostPlacement.symbol) && (
                  <img 
                    src={getFactoryImage(bestBoostPlacement.symbol)} 
                    alt={bestBoostPlacement.symbol} 
                    className="h-16 w-16 shrink-0 bg-slate-900 object-contain p-1" 
                    style={{ borderRadius: 'var(--radius-resource-item)' }}
                  />
                )}
                <div className="space-y-2 flex-1 min-w-0">
                  <p className="text-base font-bold text-emerald-300">
                    {language === 'es' 
                      ? `Coloca tu potenciador más fuerte en ${formatFactoryName(bestBoostPlacement.symbol, language)}.` 
                      : `Put your strongest boost on ${formatFactoryName(bestBoostPlacement.symbol, language)}.`}
                  </p>
                  
                  <div className="flex flex-wrap gap-2 text-[10.5px]">
                    <span 
                      className="bg-slate-950/60 px-2.5 py-0.5 text-slate-300"
                      style={{ borderRadius: 'var(--radius-resource-item)' }}
                    >
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider">{language === 'es' ? 'Objetivo' : 'Target'}:</span>{' '}
                      <strong className="text-white">{formatPlotName(bestBoostPlacement.plotName, language)} (Lv {bestBoostPlacement.level})</strong>
                    </span>
                    <span 
                      className="bg-slate-950/60 px-2.5 py-0.5 text-slate-300"
                      style={{ borderRadius: 'var(--radius-resource-item)' }}
                    >
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider">{language === 'es' ? 'Produce' : 'Output'}:</span>{' '}
                      <strong className="text-indigo-300">{formatFactoryName(bestBoostPlacement.outputToken, language)}</strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[10.5px]">
                    <span 
                      className="bg-slate-950/60 px-2.5 py-0.5 text-slate-300 flex items-center gap-1"
                      style={{ borderRadius: 'var(--radius-resource-item)' }}
                    >
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider">{language === 'es' ? 'Por Hora' : 'Per Hour'}:</span>
                      <strong className="text-emerald-400">{fmt(bestBoostPlacement.outputPerHour)} {formatFactoryName(bestBoostPlacement.outputToken, language)}/hr</strong>
                    </span>
                    <span 
                      className="bg-slate-950/60 px-2.5 py-0.5 text-slate-300 flex items-center gap-1"
                      style={{ borderRadius: 'var(--radius-resource-item)' }}
                    >
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider">{language === 'es' ? 'Por Día' : 'Per Day'}:</span>
                      <strong className="text-amber-400">{fmt(bestBoostPlacement.outputPerDay)} {formatFactoryName(bestBoostPlacement.outputToken, language)}/day</strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[10.5px]">
                    <span 
                      className="bg-slate-950/60 px-2.5 py-0.5 text-slate-300 flex items-center gap-1"
                      style={{ borderRadius: 'var(--radius-resource-item)' }}
                    >
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider">{language === 'es' ? 'Tiempo de Ciclo' : 'Cycle Runtime'}:</span>
                      <strong className="text-cyan-400">{formatDurationFromMinutes(bestBoostPlacement.effectiveDurationMinutes)}</strong>
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                {language === 'es' ? 'No hay registros de producción listos todavía.' : 'No factory production rows are ready yet.'}
              </p>
            )}
          </Card>

          <Card title="Top Producer">
            {bestFactory ? (
              <div className="flex gap-4 items-start text-sm">
                {getFactoryImage(bestFactory.symbol) && (
                  <img 
                    src={getFactoryImage(bestFactory.symbol)} 
                    alt={bestFactory.symbol} 
                    className="h-16 w-16 shrink-0 bg-slate-900 object-contain p-1" 
                    style={{ borderRadius: 'var(--radius-resource-item)' }}
                  />
                )}
                <div className="space-y-2 flex-1 min-w-0">
                  <p className="text-base font-bold text-white">
                    {language === 'es'
                      ? `${formatFactoryName(bestFactory.symbol, language)} en ${formatPlotName(bestFactory.plotName, language)}`
                      : `${formatFactoryName(bestFactory.symbol, language)} on ${formatPlotName(bestFactory.plotName, language)}`}
                  </p>

                  <div className="flex flex-wrap gap-2 text-[10.5px]">
                    <span 
                      className="bg-slate-950/60 px-2.5 py-0.5 text-slate-300"
                      style={{ borderRadius: 'var(--radius-resource-item)' }}
                    >
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider">{language === 'es' ? 'Nivel' : 'Level'}:</span>{' '}
                      <strong className="text-white">Lv {bestFactory.level}</strong>
                    </span>
                    <span 
                      className="bg-slate-950/60 px-2.5 py-0.5 text-slate-300"
                      style={{ borderRadius: 'var(--radius-resource-item)' }}
                    >
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider">{language === 'es' ? 'Producto' : 'Product'}:</span>{' '}
                      <strong className="text-indigo-300">{formatFactoryName(bestFactory.outputToken, language)}</strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[10.5px]">
                    <span 
                      className="bg-slate-950/60 px-2.5 py-0.5 text-slate-300 flex items-center gap-1"
                      style={{ borderRadius: 'var(--radius-resource-item)' }}
                    >
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider">{language === 'es' ? 'Por Hora' : 'Per Hour'}:</span>
                      <strong className="text-emerald-400">{fmt(bestFactory.outputPerHour)} / hr</strong>
                    </span>
                    <span 
                      className="bg-slate-950/60 px-2.5 py-0.5 text-slate-300 flex items-center gap-1"
                      style={{ borderRadius: 'var(--radius-resource-item)' }}
                    >
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider">{language === 'es' ? 'Por Día' : 'Per Day'}:</span>
                      <strong className="text-amber-400">{fmt(bestFactory.outputPerDay)} / day</strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[10.5px]">
                    <span 
                      className="bg-slate-950/60 px-2.5 py-0.5 text-slate-300 flex items-center gap-1"
                      style={{ borderRadius: 'var(--radius-resource-item)' }}
                    >
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider">{language === 'es' ? 'Boost Activo' : 'Active Boost'}:</span>
                      <strong className="text-violet-400">{fmt(bestFactory.activeBoostPercent, 2)}%</strong>
                    </span>
                    <span 
                      className="bg-slate-950/60 px-2.5 py-0.5 text-slate-300 flex items-center gap-1"
                      style={{ borderRadius: 'var(--radius-resource-item)' }}
                    >
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider">{language === 'es' ? 'Boost Taller' : 'Workshop Boost'}:</span>
                      <strong className="text-blue-400">{fmt(bestFactory.workshopBoostPercent, 2)}%</strong>
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                {language === 'es' ? 'No hay registros de producción listos todavía.' : 'No factory production rows are ready yet.'}
              </p>
            )}
          </Card>
        </div>

        {/* Live Production Per Hour / Day */}
        <div className="w-full max-w-[650px] mx-auto">
          <Card title="Live Production Per Hour / Day">
            {tokenTotals.length ? (
              <div className="flex flex-wrap justify-center gap-3">
                {tokenTotals.map((total) => {
                  const img = getResourceImage(total.token);
                  return (
                    <div 
                      key={total.token} 
                      className="resource-item-badge flex items-center gap-3 text-sm w-full sm:w-[280px] shrink-0"
                      style={{
                        padding: '12px var(--padding-resource-item-x)',
                      }}
                    >
                      {img && <img src={img} alt={total.token} className="h-10 w-10 object-contain shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-bold text-white truncate">{formatFactoryName(total.token, language)}</p>
                        
                        <div className="mt-1 flex flex-wrap gap-1.5 text-[10.5px]">
                          <span 
                            className="bg-slate-950/60 px-2.5 py-0.5 text-slate-300 flex items-center gap-1"
                            style={{ borderRadius: 'var(--radius-resource-item)' }}
                          >
                            <span className="text-[9px] text-slate-500 uppercase tracking-wider">{language === 'es' ? 'Hora' : 'Hr'}:</span>
                            <strong className="text-emerald-400">{fmt(total.perHour)}</strong>
                          </span>
                          <span 
                            className="bg-slate-950/60 px-2.5 py-0.5 text-slate-300 flex items-center gap-1"
                            style={{ borderRadius: 'var(--radius-resource-item)' }}
                          >
                            <span className="text-[9px] text-slate-500 uppercase tracking-wider">{language === 'es' ? 'Día' : 'Day'}:</span>
                            <strong className="text-amber-400">{fmt(total.perDay)}</strong>
                          </span>
                        </div>

                        <p className="text-[10px] text-slate-400 mt-1">
                          {language === 'es'
                            ? `${total.factoryCount} ${total.factoryCount === 1 ? 'fábrica activa' : 'fábricas activas'}`
                            : `${total.factoryCount} active factory${total.factoryCount === 1 ? '' : 'ies'}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                {language === 'es' ? 'No hay totales de producción disponibles todavía.' : 'No production totals available yet.'}
              </p>
            )}
          </Card>
        </div>

        {/* Factory Comparison Table */}
        <Card title="Factory Comparison">
          {productionRows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] text-left text-sm">
                <thead className="text-slate-300">
                  <tr>
                    <th className="p-2">{language === 'es' ? 'Rango' : 'Rank'}</th>
                    <th className="p-2">{language === 'es' ? 'Fábrica' : 'Factory'}</th>
                    <th className="p-2">{language === 'es' ? 'Resultado' : 'Output'}</th>
                    <th className="p-2">{language === 'es' ? 'Ejecución' : 'Runtime'}</th>
                    <th className="p-2">{language === 'es' ? 'Ejec./Hr' : 'Runs/Hr'}</th>
                    <th className="p-2">{language === 'es' ? 'Prod./Hr' : 'Output/Hr'}</th>
                    <th className="p-2">{language === 'es' ? 'Prod./Día' : 'Output/Day'}</th>
                    <th className="p-2">{language === 'es' ? 'Taller' : 'Workshop'}</th>
                    <th className="p-2">{language === 'es' ? 'Boost Activo' : 'Active Boost'}</th>
                  </tr>
                </thead>
                <tbody>
                  {productionRows.map((row, index) => {
                    const factImg = getFactoryImage(row.symbol);
                    const resImg = getResourceImage(row.outputToken);
                    return (
                      <tr key={row.key} className="border-t border-slate-800">
                        <td className="p-2">{index + 1}</td>
                        <td className="p-2 font-semibold">
                          <div className="flex items-center gap-2">
                            {factImg && (
                              <img 
                                src={factImg} 
                                alt={row.symbol} 
                                className="h-8 w-8 bg-slate-900 object-contain p-0.5" 
                                style={{ borderRadius: 'var(--radius-resource-item)' }}
                              />
                            )}
                            <span>{formatPlotName(row.plotName, language)} • {formatFactoryName(row.symbol, language)} • Lv {row.level}</span>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-1.5">
                            {resImg && <img src={resImg} alt={row.outputToken} className="h-5 w-5 object-contain" />}
                            <span>{fmt(row.outputAmount)} {formatFactoryName(row.outputToken, language)}</span>
                          </div>
                        </td>
                        <td className="p-2">{formatDurationFromMinutes(row.effectiveDurationMinutes)}</td>
                        <td className="p-2">{fmt(row.runsPerHour, 3)}</td>
                        <td className="p-2">
                          <div className="flex items-center gap-1.5">
                            {resImg && <img src={resImg} alt={row.outputToken} className="h-5 w-5 object-contain" />}
                            <span>{fmt(row.outputPerHour)} {formatFactoryName(row.outputToken, language)}</span>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-1.5">
                            {resImg && <img src={resImg} alt={row.outputToken} className="h-5 w-5 object-contain" />}
                            <span>{fmt(row.outputPerDay)} {formatFactoryName(row.outputToken, language)}</span>
                          </div>
                        </td>
                        <td className="p-2">{fmt(row.workshopBoostPercent, 2)}%</td>
                        <td className="p-2">{fmt(row.activeBoostPercent, 2)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              {language === 'es' ? 'Aún no hay filas de fábricas que coincidan con el CSV.' : 'No factory rows matched the CSV yet.'}
            </p>
          )}
        </Card>
      </div>
    </Layout>
  );
}
