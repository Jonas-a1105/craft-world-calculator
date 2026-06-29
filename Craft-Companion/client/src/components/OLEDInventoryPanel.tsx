import { useState, useMemo } from 'react';

type ResourceAmount = { symbol?: string; amount?: number };

const CATEGORIES = [
  { key: 'ALL', label: 'Todos' },
  { key: 'BASIC', label: 'Básicos' },
  { key: 'PROCESSED', label: 'Procesados' },
  { key: 'KEYS', label: 'Llaves' },
] as const;

const CATEGORY_MAP: Record<string, string> = {
  COIN: 'BASIC', EARTH: 'BASIC', WATER: 'BASIC', FIRE: 'BASIC',
  MUD: 'BASIC', CLAY: 'BASIC', SAND: 'BASIC', COPPER: 'BASIC',
  SEAWATER: 'BASIC', HEAT: 'BASIC', ALGAE: 'BASIC', LAVA: 'BASIC',
  STONE: 'BASIC', SULFUR: 'BASIC',
  CERAMICS: 'PROCESSED', STEEL: 'PROCESSED', OXYGEN: 'PROCESSED',
  GLASS: 'PROCESSED', GAS: 'PROCESSED', STEAM: 'PROCESSED',
  SCREWS: 'PROCESSED', FUEL: 'PROCESSED', CEMENT: 'PROCESSED',
  OIL: 'PROCESSED', ACID: 'PROCESSED', PLASTICS: 'PROCESSED',
  FIBERGLASS: 'PROCESSED', ENERGY: 'PROCESSED', HYDROGEN: 'PROCESSED',
  DYNAMITE: 'PROCESSED', BOLTS: 'PROCESSED',
  KEY: 'KEYS', CERAMICKEY: 'KEYS', GLASSKEY: 'KEYS', DYNOKEY: 'KEYS', BOOK: 'KEYS',
};

const RESOURCE_COLORS: Record<string, string> = {
  COIN: '#f59e0b', EARTH: '#a16207', WATER: '#3b82f6', FIRE: '#ef4444',
  MUD: '#713f12', CLAY: '#ea580c', SAND: '#fbbf24', COPPER: '#ea580c',
  SEAWATER: '#06b6d4', HEAT: '#f472b6', ALGAE: '#10b981', LAVA: '#f97316',
  STONE: '#6b7280', SULFUR: '#fbbf24', CERAMICS: '#cbd5e1', STEEL: '#94a3b8',
  OXYGEN: '#4ade80', GLASS: '#38bdf8', GAS: '#818cf8', STEAM: '#e2e8f0',
  SCREWS: '#94a3b8', FUEL: '#22c55e', CEMENT: '#4b5563', OIL: '#334155',
  ACID: '#a3e635', PLASTICS: '#60a5fa', FIBERGLASS: '#9ca3af', ENERGY: '#facc15',
  HYDROGEN: '#3b82f6', DYNAMITE: '#ef4444', BOLTS: '#cbd5e1',
  KEY: '#eab308', CERAMICKEY: '#f8fafc', GLASSKEY: '#38bdf8', DYNOKEY: '#f87171', BOOK: '#c084fc',
};

function getResourceImage(symbol?: string) {
  if (!symbol) return '';
  const cleanSymbol = symbol.trim().toLowerCase();
  const formattedSymbol = cleanSymbol.charAt(0).toUpperCase() + cleanSymbol.slice(1);
  return `/assets/resources/${formattedSymbol}.png`;
}

export default function OLEDInventoryPanel({ inventory }: { inventory: ResourceAmount[] }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');

  const filtered = useMemo(() => {
    return inventory.filter((item) => {
      const symbol = (item.symbol || '').toUpperCase();
      if (category !== 'ALL' && CATEGORY_MAP[symbol] !== category) return false;
      if (search && !symbol.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [inventory, category, search]);

  const activeCount = useMemo(
    () => inventory.filter((i) => (i.amount ?? 0) > 0).length,
    [inventory],
  );

  return (
    <div
      style={{
        backgroundColor: 'rgba(15, 15, 15, 0.35)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderRadius: 'var(--radius)',
      }}
      className="w-full flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="w-full pt-4 pb-3 px-6 sm:px-8 flex flex-col gap-3 shrink-0">
        {/* Title row */}
        <div className="flex items-center justify-between">
          <h1
            style={{ fontFamily: "'Press Start 2P', monospace" }}
            className="text-[12px] sm:text-[14px] md:text-[17px] tracking-wider text-white uppercase leading-none"
          >
            RESUMEN DE INVENTARIO
          </h1>
          <span className="text-[10px] bg-white/10 text-gray-300 font-bold px-3 py-1 rounded-[16px] uppercase tracking-wider">
            OLED FLAT
          </span>
        </div>

        {/* Search + Tabs */}
        <div className="w-full flex flex-col md:flex-row gap-2 items-center justify-between">
          {/* Search */}
          <div className="relative w-full md:max-w-xs">
            <input
              type="text"
              placeholder="Buscar recurso..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                backgroundColor: 'rgba(20, 20, 20, 0.8)',
                border: 'none',
                outline: 'none',
                borderRadius: 'var(--radius)',
                color: '#ffffff',
              }}
              className="w-full pl-4 pr-10 py-2 text-[13px]"
            />
          </div>
          {/* Tabs */}
          <div className="flex gap-1.5 w-full md:w-auto overflow-x-auto">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                style={{
                  backgroundColor: category === cat.key ? '#ffffff' : 'rgba(25, 25, 25, 0.6)',
                  color: category === cat.key ? '#000000' : '#9ca3af',
                  fontWeight: category === cat.key ? 700 : 400,
                  borderRadius: 'var(--radius)',
                  border: 'none',
                  transition: 'all 0.12s ease',
                }}
                className="px-3.5 py-1.5 text-xs flex-1 md:flex-initial text-center cursor-pointer whitespace-nowrap"
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 px-6 sm:px-8 py-2 overflow-hidden">
        {filtered.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5">
            {filtered.map((item, i) => {
              const symbol = item.symbol || 'Unknown';
              const img = getResourceImage(symbol);
              const color = RESOURCE_COLORS[symbol.toUpperCase()] || '#94a3b8';
              const amount = typeof item.amount === 'number' ? item.amount.toLocaleString() : '0';
              return (
                <div
                  key={`${symbol}-${i}`}
                  className="resource-item-badge px-[var(--padding-resource-item-x)] py-[var(--padding-resource-item-y-xs)] sm:py-[var(--padding-resource-item-y-sm)] md:py-[var(--padding-resource-item-y)] flex items-center justify-between gap-1.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-black/40 flex items-center justify-center p-0.5 shrink-0">
                      {img && <img src={img} alt={symbol} className="w-full h-full object-contain" />}
                    </div>
                    <span className="text-[11px] sm:text-[12.5px] font-bold text-gray-400 group-hover:text-white transition-colors truncate">
                      {symbol}
                    </span>
                  </div>
                  <span
                    className="text-[11px] sm:text-[13px] font-black pl-1.5 shrink-0 tabular-nums"
                    style={{ color }}
                  >
                    {amount}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center text-gray-500">
            <p className="text-xs">No se encontraron recursos.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="w-full px-6 sm:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
        <div className="text-left flex flex-col">
          <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold leading-none">
            Inventario Activo
          </span>
          <div className="text-[12px] text-gray-300 font-medium mt-1">
            Elementos: <span className="text-white font-extrabold">{activeCount}/{inventory.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
