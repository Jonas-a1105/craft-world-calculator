import { useEffect, useMemo, useState } from 'react';
import Card from '../components/Card';
import Layout from '../components/Layout';
import { loadFactoryData } from '../services/factoryData';
import { useTranslation } from '../utils/i18n';
import {
  exportPlayerConfig,
  getFactoryConfig,
  importPlayerConfig,
  loadPlayerConfig,
  resetPlayerConfig,
  savePlayerConfig,
  type PlayerConfig,
} from '../services/playerConfig';

export default function Settings() {
  const { t, language, setLanguage } = useTranslation();
  const [tokens, setTokens] = useState<string[]>([]);
  const [selectedToken, setSelectedToken] = useState('');
  const [config, setConfig] = useState<PlayerConfig>(() => loadPlayerConfig());
  const [json, setJson] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    loadFactoryData().then((rows) => {
      const nextTokens = Array.from(new Set(rows.map((row) => row.token).filter(Boolean))).sort();
      setTokens(nextTokens);
      setSelectedToken((current) => current || nextTokens[0] || '');
    });
  }, []);

  const selected = useMemo(() => getFactoryConfig(config, selectedToken), [config, selectedToken]);

  function updateSelected(next: Partial<typeof selected>) {
    const updated = savePlayerConfig({
      ...config,
      factories: {
        ...config.factories,
        [selectedToken]: { ...selected, ...next },
      },
    });
    setConfig(updated);
    setStatus(t('settings.status.saved'));
  }

  return (
    <Layout>
      <div className="space-y-4">
        <Card title={t('settings.title')}>
          <div className="space-y-3 text-sm">
            <p className="text-slate-300">{t('settings.savedDesc')}</p>
            {status && <p className="text-emerald-300">{status}</p>}
            <label className="block space-y-1">
              <span>{t('settings.factoryResource')}</span>
              <select value={selectedToken} onChange={(event) => setSelectedToken(event.target.value)} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2">
                {tokens.map((token) => <option key={token} value={token}>{token}</option>)}
              </select>
            </label>
            
            <hr className="border-slate-800 my-4" />
            
            <label className="block space-y-1">
              <span>{t('settings.language')}</span>
              <select value={language} onChange={(event) => setLanguage(event.target.value as any)} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2">
                <option value="en">{t('settings.english')}</option>
                <option value="es">{t('settings.spanish')}</option>
              </select>
            </label>
          </div>
        </Card>

        {selectedToken && (
          <Card title={t('settings.localSetup', { token: selectedToken })}>
            <div className="grid gap-3 text-sm md:grid-cols-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={selected.enabled} onChange={(event) => updateSelected({ enabled: event.target.checked })} />
                {t('settings.ownedEnabled')}
              </label>
              <label className="space-y-1">
                <span>{t('settings.factoryCount')}</span>
                <input type="number" min="1" value={selected.factoryCount} onChange={(event) => updateSelected({ factoryCount: Number(event.target.value) })} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2" />
              </label>
              <label className="space-y-1">
                <span>{t('settings.factoryLevel')}</span>
                <input type="number" min="1" value={selected.factoryLevel} onChange={(event) => updateSelected({ factoryLevel: Number(event.target.value) })} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2" />
              </label>
              <label className="space-y-1">
                <span>{t('settings.workersPercent')}</span>
                <input type="number" min="0" value={selected.workersPercent} onChange={(event) => updateSelected({ workersPercent: Number(event.target.value) })} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2" />
              </label>
              <label className="space-y-1">
                <span>{t('settings.workshopPercent')}</span>
                <input type="number" min="0" value={selected.workshopPercent} onChange={(event) => updateSelected({ workshopPercent: Number(event.target.value) })} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2" />
              </label>
              <label className="space-y-1">
                <span>{t('settings.boostMultiplier')}</span>
                <select value={selected.boostMultiplier} onChange={(event) => updateSelected({ boostMultiplier: Number(event.target.value) })} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2">
                  {[1, 2, 5, 10].map((value) => <option key={value} value={value}>{value}x</option>)}
                </select>
              </label>
              <label className="space-y-1 md:col-span-3">
                <span>{t('settings.notes')}</span>
                <textarea value={selected.notes} onChange={(event) => updateSelected({ notes: event.target.value })} className="min-h-24 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2" />
              </label>
            </div>
          </Card>
        )}

        <Card title={t('settings.importExport')}>
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setJson(exportPlayerConfig(config))} className="rounded bg-blue-600 px-3 py-2 font-semibold">{t('settings.exportJson')}</button>
              <button
                onClick={() => {
                  try {
                    const imported = importPlayerConfig(json);
                    setConfig(imported);
                    setStatus(t('settings.status.imported'));
                  } catch {
                    setStatus(t('settings.status.failed'));
                  }
                }}
                className="rounded bg-slate-700 px-3 py-2 font-semibold"
              >
                {t('settings.importJson')}
              </button>
              <button
                onClick={() => {
                  setConfig(resetPlayerConfig());
                  setJson('');
                  setStatus(t('settings.status.reset'));
                }}
                className="rounded bg-red-700 px-3 py-2 font-semibold"
              >
                {t('settings.resetAll')}
              </button>
            </div>
            <textarea value={json} onChange={(event) => setJson(event.target.value)} className="min-h-48 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs" />
          </div>
        </Card>
      </div>
    </Layout>
  );
}
