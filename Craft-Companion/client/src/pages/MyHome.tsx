import { useEffect, useMemo, useState } from 'react';
import Card from '../components/Card';
import Layout from '../components/Layout';
import { SkeletonDashboardPage } from '../components/Skeleton';
import { useTranslation } from '../utils/i18n';
import OLEDInventoryPanel from '../components/OLEDInventoryPanel';
import {
  getCraftworldHome,
  getCraftworldProfile,
  getCraftworldWallets,
  getMe,
  updateCraftworldIdentity,
} from '../services/api';
import { formatDurationFromMinutes, getDurationMinutesFromRunsPerHour, getEffectiveSpeedPercent } from '../services/durationFormat';
import { getActiveFactoryBoostPercent, getRunsPerHourWithFactoryBoosts, type FactoryBoost } from '../services/factoryBoostModifiers';
import { loadFactoryData, type FactoryDataRow } from '../services/factoryData';
import { applyWorkshopSpeedToDuration } from '../services/workshopModifiers';

type ResourceAmount = { symbol?: string; amount?: number };
type DynoSummary = { displayName?: string; rarity?: string; isOneOfOne?: boolean };
type FactorySummary = {
  id?: string;
  areaSymbol?: string;
  level?: number;
  landPlotName?: string;
  currentRunLevel?: number;
  activeBoosts?: FactoryBoost[];
};
type VaultSummary = { symbol?: string; amount?: number; capacity?: number; isUnlocked?: boolean };
type WorkshopItem = { symbol?: string; level?: number };
type ProficiencyItem = { symbol?: string; collectedAmount?: number; claimedLevel?: number };
type CurrencyBalance = { type?: string; amount?: number };
type ProfileData = {
  uid: string;
  walletAddress?: string;
  avatarUrl?: string;
  displayName?: string;
  level?: number;
  badges?: { displayName?: string | null; description?: string | null; url?: string | null }[];
  lastSyncedAt?: string;
};
type WalletData = {
  wallets?: { address: string; type?: string | null; provider?: string | null; providerId?: string | null; primary: boolean }[];
  primaryWalletAddress?: string;
  lastSyncedAt?: string;
};

type HomeData = {
  lastSyncedAt?: string;
  account?: {
    power?: number;
    skillPoints?: number;
    experiencePoints?: number;
    walletAddress?: string;
  };
  dynos?: DynoSummary[];
  factories?: FactorySummary[];
  inventory?: ResourceAmount[];
  vaults?: VaultSummary[];
  workshop?: WorkshopItem[];
  proficiencies?: ProficiencyItem[];
  currencies?: CurrencyBalance[];
};

function EmptyState({ children }: { children: string }) {
  return <p className="text-sm text-slate-400">{children}</p>;
}

function displayNumber(value: unknown) {
  return typeof value === 'number' ? value.toLocaleString() : 'Not connected';
}

function formatNumber(value: unknown, digits = 3) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString(undefined, { maximumFractionDigits: digits })
    : '0';
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
          .replace(/\b\w/g, c => c.toUpperCase());
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
          .replace(/\b\w/g, c => c.toUpperCase());
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

function ipfsToHttp(url?: string) {
  if (!url) return '';
  return url.startsWith('ipfs://') ? url.replace('ipfs://', 'https://ipfs.io/ipfs/') : url;
}

function getFactoryImage(symbol?: string) {
  if (!symbol) return '';
  const cleanSymbol = symbol.trim().toUpperCase();
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

function formatSpeed(value: number) {
  return `${formatNumber(value / 100, 2)}x`;
}

export default function MyHome() {
  const { t, language } = useTranslation();
  const [me, setMe] = useState<any>();
  const [home, setHome] = useState<HomeData>();
  const [factoryRows, setFactoryRows] = useState<FactoryDataRow[]>([]);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [craftWorldUidInput, setCraftWorldUidInput] = useState('');
  const [error, setError] = useState('');
  const [identityMessage, setIdentityMessage] = useState('');

  const load = async () => {
    setError('');
    try {
      const [meData, homeData] = await Promise.all([getMe(), getCraftworldHome()]);
      setMe(meData);
      setHome(homeData || {});

      try {
        const rows = await loadFactoryData();
        setFactoryRows(rows);
      } catch (err) {
        console.error('Failed to load factory CSV', err);
        setFactoryRows([]);
      }
      setCraftWorldUidInput(meData.craftWorldUid || meData.craftWorldUserId || '');

      const uid = meData.craftWorldUid || meData.craftWorldUserId;
      if (uid) {
        try {
          setProfile(await getCraftworldProfile());
        } catch {
          setProfile(null);
        }
      }

      try {
        setWalletData(await getCraftworldWallets());
      } catch {
        setWalletData(null);
      }
    } catch (err) {
      setError(t('home.loadError'));
    }
  };

  const saveIdentity = async () => {
    setIdentityMessage('');
    setError('');
    try {
      const updated = await updateCraftworldIdentity({ craftWorldUid: craftWorldUidInput });
      setMe(updated);
      setIdentityMessage(t('home.uidSaved'));
      await load();
    } catch {
      setError(t('home.uidSaveError'));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const factoryRowsByTokenLevel = useMemo(() => {
    const rowMap = new Map<string, FactoryDataRow>();
    factoryRows.forEach((row) => rowMap.set(`${row.token}-${row.level}`, row));
    return rowMap;
  }, [factoryRows]);

  if (!me || !home) return <Layout><SkeletonDashboardPage /></Layout>;

  const account = home.account || {};
  const dynos = home.dynos || [];
  const factories = home.factories || [];
  const inventory = home.inventory || [];
  const vaults = home.vaults || [];
  const workshop = home.workshop || [];
  const proficiencies = home.proficiencies || [];
  const sortedProficiencies = [...proficiencies].sort((a, b) => String(a.symbol || '').localeCompare(String(b.symbol || '')));
  const currencies = home.currencies || [];
  const wallets = walletData?.wallets || [];
  const isCraftWorldConnected = Boolean(
    account.walletAddress || dynos.length || factories.length || inventory.length || vaults.length || workshop.length || currencies.length,
  );
  const lastSynced = home.lastSyncedAt ? new Date(home.lastSyncedAt).toLocaleString() : 'Not connected';

  const plotDisplayOrder = ['EARTH_PLOT', 'WATER_PLOT', 'FIRE_PLOT', 'BLUEPRINT_PLOT', 'BLUEPRINT_PLOT_B', 'FLEXIBLE_PLOT'];
  const factoriesByPlot = factories.reduce<Record<string, FactorySummary[]>>((acc, factory) => {
    const plotKey = factory.landPlotName || 'Unknown plot';
    if (!acc[plotKey]) acc[plotKey] = [];
    acc[plotKey].push(factory);
    return acc;
  }, {});

  const orderedPlots = Object.entries(factoriesByPlot).sort(([plotA], [plotB]) => {
    const indexA = plotDisplayOrder.indexOf(plotA);
    const indexB = plotDisplayOrder.indexOf(plotB);
    const normalizedIndexA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
    const normalizedIndexB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;

    if (normalizedIndexA !== normalizedIndexB) return normalizedIndexA - normalizedIndexB;
    return plotA.localeCompare(plotB);
  });

  return (
    <Layout>
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* SECTION 1: Panel de Control */}
        <div className="lg:col-span-12 text-center mt-4 mb-2">
          <h2 
            className="text-3xl font-extrabold text-white tracking-wider"
            style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 4px 16px rgba(0,0,0,0.7)' }}
          >
            {language === 'es' ? 'Panel de Control' : 'Dashboard Control Panel'}
          </h2>
          <p 
            className="text-sm font-medium text-slate-200 mt-1 max-w-2xl mx-auto"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.6)' }}
          >
            {language === 'es' ? 'Accede a los detalles de tu perfil, estadísticas generales y sincroniza tu cuenta con Craft World.' : 'Access your profile details, general statistics, and sync your account with Craft World.'}
          </p>
        </div>

        {/* Welcome & Profile Cards (Centered Row) */}
        <div className="lg:col-span-12 flex flex-col md:flex-row justify-center items-stretch gap-6 w-full max-w-[920px] mx-auto mb-2">
          {/* Welcome / Header Card */}
          <div className={profile ? "w-full md:w-[550px] shrink-0" : "w-full md:max-w-[550px] mx-auto"}>
            <Card>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg font-semibold">{language === 'es' ? `¡Hola de nuevo, ${profile?.displayName || me.username}!` : `Welcome back, ${profile?.displayName || me.username}!`}</p>
                  <p className="text-sm text-slate-300">{language === 'es' ? 'UID de Craft World: ' : 'Craft World UID: '}{me.craftWorldUid || me.craftWorldUserId || (language === 'es' ? 'No establecido' : 'Not set')}</p>
                  <p className="text-xs text-slate-400">{language === 'es' ? 'Última sincronización: ' : 'Last synced: '}{lastSynced}</p>
                </div>
                <button onClick={load} className="retroBtn shrink-0">
                  {language === 'es' ? 'Actualizar Datos' : 'Refresh Data'}
                </button>
              </div>
            </Card>
          </div>

          {/* Profile Card */}
          {profile && (
            <div className="w-full md:w-[310px] shrink-0">
              <Card title={t('home.profile')}>
                <div className="flex items-center gap-4">
                  {profile.avatarUrl && <img src={ipfsToHttp(profile.avatarUrl)} alt="Craft World avatar" className="h-16 w-16 rounded-xl object-cover border border-slate-800" />}
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-base font-semibold truncate">{profile.displayName || (language === 'es' ? 'Jugador sin nombre' : 'Unnamed player')}</p>
                    <p className="text-xs text-slate-300">{language === 'es' ? 'Nivel' : 'Level'} {profile.level ?? 'N/A'}</p>
                    <p className="break-all text-[11px] text-slate-400">{profile.walletAddress || ''}</p>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* Error Card */}
        {error && (
          <div className="lg:col-span-12">
            <Card>{error}</Card>
          </div>
        )}

        {/* Stats KPI Block */}
        <div className="lg:col-span-4">
          <Card title={language === 'es' ? 'Estadísticas' : 'Statistics'}>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div 
                className="resource-item-badge text-white"
                style={{
                  padding: '8px var(--padding-resource-item-x)',
                }}
              >
                <p className="text-[11px] text-slate-400">{language === 'es' ? 'Poder' : 'Power'}</p>
                <p className="text-sm font-bold text-white">{displayNumber(account.power)}</p>
              </div>
              <div 
                className="resource-item-badge text-white"
                style={{
                  padding: '8px var(--padding-resource-item-x)',
                }}
              >
                <p className="text-[11px] text-slate-400">{language === 'es' ? 'Puntos Skill' : 'Skill Points'}</p>
                <p className="text-sm font-bold text-white">{displayNumber(account.skillPoints)}</p>
              </div>
              <div 
                className="col-span-2 resource-item-badge text-white"
                style={{
                  padding: '8px var(--padding-resource-item-x)',
                }}
              >
                <p className="text-[11px] text-slate-400">{language === 'es' ? 'Experiencia' : 'Experience'}</p>
                <p className="text-sm font-bold text-white">{displayNumber(account.experiencePoints)}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Connect Game Card */}
        <div className="lg:col-span-4">
          <Card title={t('home.connectGame')}>
            <div className="space-y-3">
              <p className="text-xs text-slate-400">{t('home.connectDesc')}</p>
              <div className="flex flex-col gap-2">
                <input
                  value={craftWorldUidInput}
                  onChange={(event) => setCraftWorldUidInput(event.target.value)}
                  placeholder="Craft World UID"
                  className="w-full text-sm"
                />
                <button onClick={saveIdentity} className="retroBtn w-full">
                  {t('home.saveUid')}
                </button>
              </div>
              {identityMessage && <p className="text-xs text-emerald-300">{identityMessage}</p>}
              <div className="pt-2 border-t border-slate-800">
                {isCraftWorldConnected ? (
                  <p className="text-xs text-emerald-300">{language === 'es' ? 'Los datos en vivo de Craft World están conectados.' : 'Live Craft World data is connected.'}</p>
                ) : (
                  <p className="text-xs text-slate-400">{language === 'es' ? 'Los datos de la cuenta de Craft World aún no están conectados. Agrega tu UID.' : 'Craft World account data is not connected yet. Add your UID.'}</p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Ronin Wallets Card */}
        <div className="lg:col-span-4">
          <Card title={t('home.roninWallets')}>
            {wallets.length ? (
              <div className="space-y-2">
                {wallets.map((wallet) => (
                  <div 
                    key={wallet.address} 
                    className={`text-xs transition-all cursor-default ${wallet.primary ? '' : 'resource-item-badge'}`}
                    style={{
                      backgroundColor: wallet.primary ? 'rgba(16, 185, 129, 0.1)' : undefined,
                      borderRadius: wallet.primary ? 'var(--radius-resource-item)' : undefined,
                      padding: '10px var(--padding-resource-item-x)',
                      border: 'none',
                    }}
                  >
                    <p className="break-all font-semibold text-white">{wallet.address}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{language === 'es' ? 'Tipo: ' : 'Type: '}{wallet.type || 'N/A'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState>{language === 'es' ? 'Billeteras no autenticadas.' : 'No wallets authenticated.'}</EmptyState>
            )}
          </Card>
        </div>

        {/* SECTION 2: Operaciones de Producción */}
        <div className="lg:col-span-12 text-center mt-8 mb-2">
          <h2 
            className="text-3xl font-extrabold text-white tracking-wider"
            style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 4px 16px rgba(0,0,0,0.7)' }}
          >
            {language === 'es' ? 'Operaciones de Producción' : 'Production Operations'}
          </h2>
          <p 
            className="text-sm font-medium text-slate-200 mt-1 max-w-2xl mx-auto"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.6)' }}
          >
            {language === 'es' ? 'Monitorea los tiempos de ejecución, niveles de optimización y velocidad de tus fábricas activas por parcela.' : 'Monitor runtimes, optimization levels, and speed of your active factories by plot.'}
          </p>
        </div>

        {/* Active Factories Card */}
        <div className="lg:col-span-12">
          <Card title={t('home.activeFactories')}>
            {orderedPlots.length ? (
              <div className="space-y-6">
                {orderedPlots.map(([plotName, plotFactories]) => {
                  const sortedFactories = [...plotFactories].sort((a, b) => {
                    const symbolSort = (a.areaSymbol || '').localeCompare(b.areaSymbol || '');
                    if (symbolSort !== 0) return symbolSort;
                    const aDisplayLevel = (a.level ?? -1) + 1;
                    const bDisplayLevel = (b.level ?? -1) + 1;
                    return bDisplayLevel - aDisplayLevel;
                  });

                  const highestDisplayedLevel = sortedFactories.reduce((maxLevel, factory) => {
                    const displayLevel = (factory.level ?? -1) + 1;
                    return displayLevel > maxLevel ? displayLevel : maxLevel;
                  }, 0);

                  return (
                    <div key={plotName} className="space-y-3">
                      <div 
                        className="w-fit mx-auto text-center"
                        style={{
                          backgroundColor: 'var(--bg-panel)',
                          borderRadius: 'var(--radius-resource-item)',
                          padding: '8px 24px',
                        }}
                      >
                        <p className="text-sm font-bold text-white tracking-wider">{formatPlotName(plotName, language)}</p>
                        <div className="flex items-center justify-center gap-2 mt-1.5 text-[11px]">
                          <span className="px-2 py-0.5 rounded-full bg-slate-950/50 text-slate-300">
                            <strong>{sortedFactories.length}</strong> {language === 'es' ? 'Fábricas' : 'Factories'}
                          </span>
                          <span className="text-slate-500">•</span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-950/50 text-amber-400">
                            {language === 'es' ? 'Nivel Máx:' : 'Max Lv:'} <strong>{highestDisplayedLevel}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {sortedFactories.map((factory, index) => {
                          const displayLevel = (factory.level ?? 0) + 1;
                          const craftDisplayLevel =
                            typeof factory.currentRunLevel === 'number' ? factory.currentRunLevel + 1 : null;
                          const symbol = factory.areaSymbol || 'Unknown';
                          const factoryRow = factoryRowsByTokenLevel.get(`${String(factory.areaSymbol || '').trim().toUpperCase()}-${displayLevel}`);
                          const workshopDuration = factoryRow ? applyWorkshopSpeedToDuration(factoryRow.duration_min, factoryRow.token, workshop) : 0;
                          const runsPerHour = factoryRow ? getRunsPerHourWithFactoryBoosts(workshopDuration, factory.activeBoosts || []) : 0;
                          const calculatedDurationMinutes = getDurationMinutesFromRunsPerHour(runsPerHour);
                          const effectiveSpeedPercent = factoryRow ? getEffectiveSpeedPercent(factoryRow.duration_min, calculatedDurationMinutes) : 0;
                          const factoryImage = getFactoryImage(symbol);

                          return (
                            <div 
                              key={factory.id || `${plotName}-factory-${index}`} 
                              className="resource-item-badge flex items-center gap-3 text-sm"
                              style={{
                                padding: 'var(--padding-resource-item-y) var(--padding-resource-item-x)',
                              }}
                            >
                              {factoryImage ? (
                                <img 
                                  src={factoryImage} 
                                  alt={`${symbol} factory`} 
                                  className="h-12 w-12 shrink-0 bg-slate-900/60 object-contain p-1" 
                                  style={{ borderRadius: 'var(--radius-resource-item)' }}
                                />
                              ) : (
                                <div 
                                  className="flex h-12 w-12 shrink-0 items-center justify-center bg-slate-900/60 text-xs font-bold text-slate-500"
                                  style={{ borderRadius: 'var(--radius-resource-item)' }}
                                >
                                  {symbol.slice(0, 3)}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-bold text-white text-sm truncate">{formatFactoryName(symbol, language)}</p>
                                  <span 
                                    className="text-[10px] bg-slate-900/60 px-2 py-0.5 text-slate-300 shrink-0"
                                    style={{ borderRadius: 'var(--radius-resource-item)' }}
                                  >
                                    Lv {displayLevel}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                                  {craftDisplayLevel !== null && (
                                    <span className="text-indigo-400">Craft Lv {craftDisplayLevel}</span>
                                  )}
                                </div>
                                {factoryRow ? (
                                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10.5px]">
                                    <span 
                                      className="bg-slate-950/60 px-2.5 py-0.5 text-slate-300 flex items-center gap-1"
                                      style={{ borderRadius: 'var(--radius-resource-item)' }}
                                    >
                                      <span className="text-[9px] text-slate-500 uppercase tracking-wider">{language === 'es' ? 'Tiempo' : 'Time'}:</span>
                                      <strong className="text-emerald-400">{formatDurationFromMinutes(calculatedDurationMinutes)}</strong>
                                    </span>
                                    <span 
                                      className="bg-slate-950/60 px-2.5 py-0.5 text-slate-300 flex items-center gap-1"
                                      style={{ borderRadius: 'var(--radius-resource-item)' }}
                                    >
                                      <span className="text-[9px] text-slate-500 uppercase tracking-wider">{language === 'es' ? 'Vel' : 'Speed'}:</span>
                                      <strong className="text-amber-400">{formatSpeed(effectiveSpeedPercent)}</strong>
                                    </span>
                                  </div>
                                ) : (
                                  <div className="mt-1.5">
                                    <span 
                                      className="bg-yellow-500/10 px-2.5 py-0.5 text-yellow-300 text-[10px]"
                                      style={{ borderRadius: 'var(--radius-resource-item)' }}
                                    >
                                      {language === 'es' ? 'Sin datos de CSV' : 'No CSV match'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState>No factories found yet.</EmptyState>
            )}
          </Card>
        </div>

        {/* SECTION 3: Gestión de Recursos */}
        <div className="lg:col-span-12 text-center mt-8 mb-2">
          <h2 
            className="text-3xl font-extrabold text-white tracking-wider"
            style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 4px 16px rgba(0,0,0,0.7)' }}
          >
            {language === 'es' ? 'Gestión de Recursos' : 'Resource Management'}
          </h2>
          <p 
            className="text-sm font-medium text-slate-200 mt-1 max-w-2xl mx-auto"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.6)' }}
          >
            {language === 'es' ? 'Visualiza tu inventario en tiempo real, la capacidad actual de tus bóvedas y los saldos de tus monedas.' : 'Visualize your real-time inventory, current capacity of your vaults, and currency balances.'}
          </p>
        </div>

        {/* Currencies & Vaults Ribbon (Horizontal, Centered, No Stretch, Matching Panel Style) */}
        <div className="lg:col-span-12 flex justify-center mb-1">
          <div 
            className="flex flex-wrap items-center gap-3 w-fit"
            style={{
              backgroundColor: 'var(--bg-panel)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderRadius: 'var(--radius)',
              padding: '12px 24px',
            }}
          >
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider mr-1">{language === 'es' ? 'Monedas y Bóvedas:' : 'Currencies & Vaults:'}</span>
            {(currencies.length || vaults.length) ? (
              <>
                {currencies.map((c, i) => {
                  const img = getResourceImage(c.type);
                  return (
                    <div 
                      key={c.type || `currency-${i}`} 
                      className="resource-item-badge flex items-center gap-1.5 text-xs text-white"
                      style={{
                        padding: 'var(--padding-resource-item-y-sm) var(--padding-resource-item-x)',
                      }}
                    >
                      {img && <img src={img} alt={c.type} className="h-4 w-4 object-contain" />}
                      <span>{c.type || 'Unknown'}: <strong className="text-amber-400">{formatNumber(c.amount)}</strong></span>
                    </div>
                  );
                })}
                {vaults.map((v, i) => {
                  const img = getResourceImage(v.symbol);
                  return (
                    <div 
                      key={v.symbol || `vault-${i}`} 
                      className="resource-item-badge flex items-center gap-1.5 text-xs text-white"
                      style={{
                        padding: 'var(--padding-resource-item-y-sm) var(--padding-resource-item-x)',
                      }}
                    >
                      {img && <img src={img} alt={v.symbol} className="h-4 w-4 object-contain" />}
                      <span>{v.symbol || 'Unknown'}: <strong className="text-indigo-400">{formatNumber(v.amount)}/{formatNumber(v.capacity)}</strong></span>
                    </div>
                  );
                })}
              </>
            ) : (
              <span className="text-xs text-slate-400">{language === 'es' ? 'Aún no hay datos de monedas o bóvedas.' : 'No currencies or vaults found yet.'}</span>
            )}
          </div>
        </div>

        {/* OLED Inventory Panel */}
        <div className="lg:col-span-12">
          <OLEDInventoryPanel inventory={inventory} />
        </div>

        {/* SECTION 4: Taller y Especializaciones */}
        <div className="lg:col-span-12 text-center mt-8 mb-2">
          <h2 
            className="text-3xl font-extrabold text-white tracking-wider"
            style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 4px 16px rgba(0,0,0,0.7)' }}
          >
            {language === 'es' ? 'Taller y Especializaciones' : 'Workshop & Specializations'}
          </h2>
          <p 
            className="text-sm font-medium text-slate-200 mt-1 max-w-2xl mx-auto"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.6)' }}
          >
            {language === 'es' ? 'Consulta tu nivel de maestría en recolección, mejoras de tu taller mecánico y la información sobre tus Dynos.' : 'Check your proficiency level in gathering, mechanical workshop upgrades, and details about your Dynos.'}
          </p>
        </div>

        {/* Workshop & My Dynos Row - Centered and non-stretching */}
        <div className="lg:col-span-12 flex flex-col md:flex-row justify-center items-stretch gap-6 mb-4">
          {/* Workshop Card */}
          <div className="w-full md:w-[380px] shrink-0">
            <Card title="Workshop">
              {workshop.length ? (
                <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
                  {workshop.map((w, i) => {
                    const img = getResourceImage(w.symbol);
                    return (
                      <div 
                        key={w.symbol || `workshop-${i}`} 
                        className="resource-item-badge flex items-center gap-2 text-xs text-white"
                        style={{
                          padding: '8px var(--padding-resource-item-x)',
                        }}
                      >
                        {img && <img src={img} alt={w.symbol} className="h-5 w-5 object-contain" />}
                        <span className="truncate">{w.symbol || 'Unknown'}: Lv {formatNumber(w.level)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState>{language === 'es' ? 'Aún no hay datos del taller.' : 'No workshop data found yet.'}</EmptyState>
              )}
            </Card>
          </div>

          {/* My Dynos Card */}
          <div className="w-full md:w-[380px] shrink-0">
            <Card title={language === 'es' ? 'Mis Dynos' : 'My Dynos'}>
              {dynos.length ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {dynos.map((d, i) => (
                    <div 
                      key={`${d.displayName || 'dyno'}-${i}`} 
                      className="resource-item-badge text-xs text-white"
                      style={{
                        padding: '8px var(--padding-resource-item-x)',
                      }}
                    >
                      {d.displayName || (language === 'es' ? 'Dyno sin nombre' : 'Unnamed Dyno')} ({d.rarity || 'N/A'})
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState>{language === 'es' ? 'Aún no se han encontrado Dynos.' : 'No Dynos found yet.'}</EmptyState>
              )}
            </Card>
          </div>
        </div>

        {/* Proficiencies Card */}
        <div className="lg:col-span-12">
          <Card title="Proficiencies">
            {sortedProficiencies.length ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  {language === 'es' ? 'Cantidad recolectada y nivel de maestría reclamado devuelto por Craft World.' : 'Collected amount and claimed proficiency level returned by Craft World.'}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px] text-left text-sm">
                    <thead className="text-slate-300">
                      <tr>
                        <th className="p-2">{language === 'es' ? 'Recurso' : 'Resource'}</th>
                        <th className="p-2">{language === 'es' ? 'Cantidad Recolectada' : 'Collected Amount'}</th>
                        <th className="p-2">{language === 'es' ? 'Nivel Reclamado' : 'Claimed Level'}</th>
                        <th className="p-2">{language === 'es' ? 'Siguiente Nivel' : 'Next Level'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedProficiencies.map((item, index) => {
                        const symbol = item.symbol || 'Unknown';
                        const claimedLevel = typeof item.claimedLevel === 'number' ? item.claimedLevel : 0;
                        const img = getResourceImage(symbol);
                        return (
                          <tr key={`${symbol}-${index}`} className="border-t border-slate-800">
                            <td className="p-2 font-semibold flex items-center gap-2">
                              {img && <img src={img} alt={symbol} className="h-5 w-5 object-contain" />}
                              <span>{symbol}</span>
                            </td>
                            <td className="p-2">{formatNumber(item.collectedAmount)}</td>
                            <td className="p-2">{formatNumber(claimedLevel)}</td>
                            <td className="p-2">{claimedLevel + 1}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <EmptyState>{language === 'es' ? 'Aún no hay datos de maestrías.' : 'No proficiency data found yet.'}</EmptyState>
            )}
          </Card>
        </div>
      </div>
    </Layout>
  );
}
