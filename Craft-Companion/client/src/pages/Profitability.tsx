import { useEffect, useMemo, useState } from 'react';
import Card from '../components/Card';
import Layout from '../components/Layout';
import { SkeletonSingleColumn } from '../components/Skeleton';
import { getCraftworldBuyQuote, getCraftworldHome, getCraftworldQuote } from '../services/api';
import { getActiveFactoryBoostPercent, getRunsPerHourWithFactoryBoosts, type FactoryBoost } from '../services/factoryBoostModifiers';
import { loadFactoryData, type FactoryDataRow } from '../services/factoryData';
import { applyMasteryInputReduction, getMasteryInputReductionPercent, getMasteryLevel, type ProficiencyItem } from '../services/masteryModifiers';
import { applyWorkshopSpeedToDuration, getWorkshopSpeedBoostPercent, type WorkshopItem } from '../services/workshopModifiers';
import { formatDurationFromMinutes, getDurationMinutesFromRunsPerHour, getEffectiveSpeedPercent } from '../services/durationFormat';

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

type OwnedFactory = {
  id?: string;
  areaSymbol?: string;
  level?: number;
  landPlotName?: string;
  currentRunLevel?: number;
  activeBoosts?: FactoryBoost[];
};

type OwnedFactoryOption = {
  key: string;
  factory: OwnedFactory;
  symbol: string;
  displayLevel: number;
  nextDisplayLevel: number;
  craftDisplayLevel: number | null;
  plotName: string;
  matchingCsvRow: FactoryDataRow | null;
  nextCsvRow: FactoryDataRow | null;
};

type Quote = {
  type: string;
  input: { symbol: string; amount: number };
  output: { symbol: string; amount: number };
  details?: { priceImpactPercentage?: number };
};

type QuoteMap = Record<string, Quote | null>;

type QuoteRequest = {
  type: 'sell' | 'buy';
  symbol: string;
  amount: number;
  key: string;
};

type ProfitAdvisorRow = {
  option: OwnedFactoryOption;
  row: FactoryDataRow;
  outputValue: number;
  inputCost: number;
  profitPerRun: number;
  profitPerHour: number;
  runsPerHour: number;
  baseDurationMinutes: number;
  calculatedDurationMinutes: number;
  effectiveSpeedPercent: number;
  workshopBoostPercent: number;
  activeBoostPercent: number;
  masteryLevel: number;
  masteryReductionPercent: number;
  missingQuote: boolean;
  maxImpact: number;
};

const QUOTE_BATCH_SIZE = 12;

function formatNumber(value: number, digits = 6) {
  return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : '0';
}

function formatSpeed(value: number) {
  return `${formatNumber(value, 2)}% / ${formatNumber(value / 100, 2)}x`;
}

function formatFactoryLabel(option: OwnedFactoryOption) {
  const craftLevel = option.craftDisplayLevel ? ` • Craft Lv ${option.craftDisplayLevel}` : '';
  return `${option.plotName} • ${option.symbol} • Lv ${option.displayLevel}${craftLevel}`;
}

function normalizeQuoteAmount(amount: number) {
  return Number(amount.toFixed(8));
}

function sellQuoteKey(symbol: string, amount: number) {
  return `SELL-${symbol.toUpperCase()}-${normalizeQuoteAmount(amount)}`;
}

function buyQuoteKey(symbol: string, amount: number) {
  return `BUY-COIN-${symbol.toUpperCase()}-${normalizeQuoteAmount(amount)}`;
}

function getAdjustedInputAmount(factoryToken: string, amount: number, proficiencies: ProficiencyItem[]) {
  return normalizeQuoteAmount(applyMasteryInputReduction(amount, factoryToken, proficiencies));
}

function getRunsPerHourWithAllSpeed(row: FactoryDataRow, option: OwnedFactoryOption, workshop: WorkshopItem[]) {
  const workshopDuration = applyWorkshopSpeedToDuration(row.duration_min, row.token, workshop);
  return getRunsPerHourWithFactoryBoosts(workshopDuration, option.factory.activeBoosts || []);
}

function getRecipeQuoteRequests(row: FactoryDataRow, proficiencies: ProficiencyItem[]) {
  const input1Amount = getAdjustedInputAmount(row.token, row.input_amount_1, proficiencies);
  const requests: QuoteRequest[] = [
    { type: 'sell', symbol: row.output_token, amount: row.output_amount, key: sellQuoteKey(row.output_token, row.output_amount) },
    { type: 'buy', symbol: row.input_token_1, amount: input1Amount, key: buyQuoteKey(row.input_token_1, input1Amount) },
  ];

  if (row.input_token_2 && row.input_amount_2 > 0) {
    const input2Amount = getAdjustedInputAmount(row.token, row.input_amount_2, proficiencies);
    requests.push({ type: 'buy', symbol: row.input_token_2, amount: input2Amount, key: buyQuoteKey(row.input_token_2, input2Amount) });
  }

  return requests;
}

function getUpgradeBuyQuoteRequest(row: FactoryDataRow | null) {
  if (!row?.upgrade_token || row.upgrade_amount <= 0) return null;
  return {
    type: 'buy' as const,
    symbol: row.upgrade_token,
    amount: row.upgrade_amount,
    key: buyQuoteKey(row.upgrade_token, row.upgrade_amount),
  };
}

function QuoteLine({ label, quote }: { label: string; quote: Quote | null | undefined }) {
  if (!quote) return <p>{label}: Quote unavailable</p>;

  const inputImg = getResourceImage(quote.input.symbol);
  const outputImg = getResourceImage(quote.output.symbol);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span>{label}: {formatNumber(quote.input.amount)}</span>
      {inputImg && <img src={inputImg} alt={quote.input.symbol} className="h-4 w-4 object-contain inline" />}
      <span>{quote.input.symbol} for {formatNumber(quote.output.amount)}</span>
      {outputImg && <img src={outputImg} alt={quote.output.symbol} className="h-4 w-4 object-contain inline" />}
      <span>{quote.output.symbol} • Impact {formatNumber(quote.details?.priceImpactPercentage || 0, 2)}%</span>
    </div>
  );
}

export default function Profitability() {
  const [rows, setRows] = useState<FactoryDataRow[]>([]);
  const [ownedFactories, setOwnedFactories] = useState<OwnedFactory[]>([]);
  const [workshop, setWorkshop] = useState<WorkshopItem[]>([]);
  const [proficiencies, setProficiencies] = useState<ProficiencyItem[]>([]);
  const [selectedFactoryKey, setSelectedFactoryKey] = useState('');
  const [quotes, setQuotes] = useState<QuoteMap>({});
  const [loading, setLoading] = useState(true);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quotedCount, setQuotedCount] = useState(0);
  const [error, setError] = useState('');
  const [quoteError, setQuoteError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const [factoryRows, homeData] = await Promise.all([loadFactoryData(), getCraftworldHome()]);
        setRows(factoryRows);
        setOwnedFactories(homeData.factories || []);
        setWorkshop(homeData.workshop || []);
        setProficiencies(homeData.proficiencies || []);
      } catch {
        setError('Unable to load profitability data. Refresh and try again.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const ownedFactoryOptions = useMemo<OwnedFactoryOption[]>(() => {
    return ownedFactories
      .map((factory, index) => {
        const symbol = String(factory.areaSymbol || '').trim().toUpperCase();
        const displayLevel = typeof factory.level === 'number' ? factory.level + 1 : 0;
        const nextDisplayLevel = displayLevel + 1;
        const craftDisplayLevel = typeof factory.currentRunLevel === 'number' ? factory.currentRunLevel + 1 : null;
        const plotName = factory.landPlotName || 'Unknown plot';
        const matchingCsvRow = rows.find((row) => row.token === symbol && row.level === displayLevel) || null;
        const nextCsvRow = rows.find((row) => row.token === symbol && row.level === nextDisplayLevel) || null;

        return {
          key: factory.id || `${plotName}-${symbol}-${displayLevel}-${index}`,
          factory,
          symbol,
          displayLevel,
          nextDisplayLevel,
          craftDisplayLevel,
          plotName,
          matchingCsvRow,
          nextCsvRow,
        };
      })
      .filter((option) => option.symbol)
      .sort((a, b) => {
        const plotSort = a.plotName.localeCompare(b.plotName);
        if (plotSort !== 0) return plotSort;
        const symbolSort = a.symbol.localeCompare(b.symbol);
        if (symbolSort !== 0) return symbolSort;
        return b.displayLevel - a.displayLevel;
      });
  }, [ownedFactories, rows]);

  useEffect(() => {
    if (!ownedFactoryOptions.length) {
      setSelectedFactoryKey('');
      return;
    }

    const selectedStillExists = ownedFactoryOptions.some((option) => option.key === selectedFactoryKey);
    if (!selectedStillExists) setSelectedFactoryKey(ownedFactoryOptions[0].key);
  }, [ownedFactoryOptions, selectedFactoryKey]);

  const selectedFactory = useMemo(
    () => ownedFactoryOptions.find((option) => option.key === selectedFactoryKey) || null,
    [ownedFactoryOptions, selectedFactoryKey],
  );

  const selectedRow = selectedFactory?.matchingCsvRow || null;
  const selectedUpgradeRow = selectedFactory?.nextCsvRow || null;

  const quoteRequests = useMemo(() => {
    const byKey = new Map<string, QuoteRequest>();

    if (selectedRow) {
      getRecipeQuoteRequests(selectedRow, proficiencies).forEach((request) => byKey.set(request.key, request));
    }

    const selectedUpgradeRequest = getUpgradeBuyQuoteRequest(selectedUpgradeRow);
    if (selectedUpgradeRequest) byKey.set(selectedUpgradeRequest.key, selectedUpgradeRequest);

    ownedFactoryOptions.forEach((option) => {
      if (!option.matchingCsvRow) return;
      getRecipeQuoteRequests(option.matchingCsvRow, proficiencies).forEach((request) => {
        if (!byKey.has(request.key)) byKey.set(request.key, request);
      });
    });

    return Array.from(byKey.values());
  }, [ownedFactoryOptions, selectedRow, selectedUpgradeRow, proficiencies]);

  useEffect(() => {
    if (!quoteRequests.length) return;
    let cancelled = false;

    const loadQuotes = async () => {
      setQuoteLoading(true);
      setQuoteError('');
      setQuotedCount(0);

      try {
        const missingRequests = quoteRequests.filter((request) => quotes[request.key] === undefined);

        for (let index = 0; index < missingRequests.length; index += QUOTE_BATCH_SIZE) {
          const batch = missingRequests.slice(index, index + QUOTE_BATCH_SIZE);
          const entries = await Promise.all(
            batch.map(async (request) => {
              try {
                const quote = request.type === 'buy'
                  ? await getCraftworldBuyQuote({
                      inputSymbol: 'COIN',
                      outputSymbol: request.symbol,
                      outputAmount: request.amount,
                    })
                  : await getCraftworldQuote({
                      inputSymbol: request.symbol,
                      outputSymbol: 'COIN',
                      inputAmount: request.amount,
                    });
                return [request.key, quote] as const;
              } catch {
                return [request.key, null] as const;
              }
            }),
          );

          if (cancelled) return;
          setQuotes((current) => ({ ...current, ...Object.fromEntries(entries) }));
          setQuotedCount((current) => current + entries.length);
        }
      } catch {
        if (!cancelled) setQuoteError('Unable to load one or more Craft World quotes.');
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    };

    loadQuotes();
    return () => {
      cancelled = true;
    };
  }, [quoteRequests]);

  const getSellQuote = (symbol: string, amount: number) => quotes[sellQuoteKey(symbol, amount)] || null;
  const getBuyQuote = (symbol: string, amount: number) => quotes[buyQuoteKey(symbol, amount)] || null;

  const advisorRows = useMemo<ProfitAdvisorRow[]>(() => {
    return ownedFactoryOptions
      .filter((option): option is OwnedFactoryOption & { matchingCsvRow: FactoryDataRow } => Boolean(option.matchingCsvRow))
      .map((option) => {
        const row = option.matchingCsvRow;
        const input1AdjustedAmount = getAdjustedInputAmount(row.token, row.input_amount_1, proficiencies);
        const input2AdjustedAmount = row.input_token_2 ? getAdjustedInputAmount(row.token, row.input_amount_2, proficiencies) : 0;
        const outputQuote = getSellQuote(row.output_token, row.output_amount);
        const input1Quote = getBuyQuote(row.input_token_1, input1AdjustedAmount);
        const input2Quote = row.input_token_2 ? getBuyQuote(row.input_token_2, input2AdjustedAmount) : null;
        const outputValue = outputQuote?.output.amount || 0;
        const inputCost = (input1Quote?.input.amount || 0) + (input2Quote?.input.amount || 0);
        const profitPerRun = outputValue - inputCost;
        const runsPerHour = getRunsPerHourWithAllSpeed(row, option, workshop);
        const baseDurationMinutes = row.duration_min;
        const calculatedDurationMinutes = getDurationMinutesFromRunsPerHour(runsPerHour);
        const effectiveSpeedPercent = getEffectiveSpeedPercent(baseDurationMinutes, calculatedDurationMinutes);
        const profitPerHour = profitPerRun * runsPerHour;
        const impacts = [outputQuote, input1Quote, input2Quote]
          .map((quote) => quote?.details?.priceImpactPercentage || 0)
          .filter((impact) => Number.isFinite(impact));

        return {
          option,
          row,
          outputValue,
          inputCost,
          profitPerRun,
          profitPerHour,
          runsPerHour,
          baseDurationMinutes,
          calculatedDurationMinutes,
          effectiveSpeedPercent,
          workshopBoostPercent: getWorkshopSpeedBoostPercent(row.token, workshop),
          activeBoostPercent: getActiveFactoryBoostPercent(option.factory.activeBoosts || []),
          masteryLevel: getMasteryLevel(row.token, proficiencies),
          masteryReductionPercent: getMasteryInputReductionPercent(row.token, proficiencies),
          missingQuote: !outputQuote || !input1Quote || Boolean(row.input_token_2 && !input2Quote),
          maxImpact: impacts.length ? Math.max(...impacts) : 0,
        };
      })
      .sort((a, b) => b.profitPerHour - a.profitPerHour);
  }, [ownedFactoryOptions, quotes, workshop, proficiencies]);

  const bestAdvisorRow = advisorRows.find((row) => !row.missingQuote) || null;
  const missingCsvMatches = ownedFactoryOptions.filter((option) => !option.matchingCsvRow).length;
  const readyAdvisorRows = advisorRows.filter((row) => !row.missingQuote);

  const selectedInput1AdjustedAmount = selectedRow ? getAdjustedInputAmount(selectedRow.token, selectedRow.input_amount_1, proficiencies) : 0;
  const selectedInput2AdjustedAmount = selectedRow?.input_token_2 ? getAdjustedInputAmount(selectedRow.token, selectedRow.input_amount_2, proficiencies) : 0;
  const outputQuote = selectedRow ? getSellQuote(selectedRow.output_token, selectedRow.output_amount) : null;
  const input1Quote = selectedRow ? getBuyQuote(selectedRow.input_token_1, selectedInput1AdjustedAmount) : null;
  const input2Quote = selectedRow?.input_token_2 ? getBuyQuote(selectedRow.input_token_2, selectedInput2AdjustedAmount) : null;
  const upgradeQuote = selectedUpgradeRow?.upgrade_token ? getBuyQuote(selectedUpgradeRow.upgrade_token, selectedUpgradeRow.upgrade_amount) : null;
  const selectedWorkshopBoostPercent = selectedRow ? getWorkshopSpeedBoostPercent(selectedRow.token, workshop) : 0;
  const selectedActiveBoostPercent = selectedFactory ? getActiveFactoryBoostPercent(selectedFactory.factory.activeBoosts || []) : 0;
  const selectedMasteryLevel = selectedRow ? getMasteryLevel(selectedRow.token, proficiencies) : 0;
  const selectedMasteryReductionPercent = selectedRow ? getMasteryInputReductionPercent(selectedRow.token, proficiencies) : 0;

  const inputCost = (input1Quote?.input.amount || 0) + (input2Quote?.input.amount || 0);
  const outputValue = outputQuote?.output.amount || 0;
  const profitPerRun = outputValue - inputCost;
  const runsPerHour = selectedRow && selectedFactory ? getRunsPerHourWithAllSpeed(selectedRow, selectedFactory, workshop) : 0;
  const profitPerHour = profitPerRun * runsPerHour;
  const selectedBaseDurationMinutes = selectedRow?.duration_min || 0;
  const selectedCalculatedDurationMinutes = getDurationMinutesFromRunsPerHour(runsPerHour);
  const selectedEffectiveSpeedPercent = getEffectiveSpeedPercent(selectedBaseDurationMinutes, selectedCalculatedDurationMinutes);
  const upgradeCost = upgradeQuote?.input.amount || 0;

  if (loading) {
    return (
      <Layout>
        <SkeletonSingleColumn />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4">
        <Card title="Profit Advisor">
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              This ranks every owned factory that matches the CSV by estimated COIN profit per hour using live Craft World sell quotes for outputs, buy quotes for inputs, workshop speed boosts, active boosts, and factory resource mastery input reductions.
            </p>
            {quoteLoading && (
              <p className="text-sm text-slate-400">
                Loading live quote data in parallel batches... {quotedCount}/{quoteRequests.length} quotes checked.
              </p>
            )}
            {missingCsvMatches > 0 && (
              <p className="text-sm text-yellow-200">
                {missingCsvMatches} owned factories do not have a CSV match yet, so they are excluded from the ranking.
              </p>
            )}
            {bestAdvisorRow ? (
              <div className="flex gap-4 items-start rounded-lg border border-emerald-400/70 bg-emerald-500/10 p-3 text-sm">
                {getFactoryImage(bestAdvisorRow.option.symbol) && (
                  <img src={getFactoryImage(bestAdvisorRow.option.symbol)} alt={bestAdvisorRow.option.symbol} className="h-16 w-16 shrink-0 rounded-lg border border-emerald-500/20 bg-emerald-950/60 object-contain p-1" />
                )}
                <div className="space-y-1">
                  <p className="font-semibold text-emerald-200">Best visible craft right now</p>
                  <p>{formatFactoryLabel(bestAdvisorRow.option)}</p>
                  <p>Workshop speed boost: {formatNumber(bestAdvisorRow.workshopBoostPercent, 2)}%</p>
                  <p>Active boost: {formatNumber(bestAdvisorRow.activeBoostPercent, 2)}%</p>
                  <p>Base Time: {formatDurationFromMinutes(bestAdvisorRow.baseDurationMinutes)}</p>
                  <p>Output Time: {formatDurationFromMinutes(bestAdvisorRow.calculatedDurationMinutes)}</p>
                  <p>Effective Speed: {formatSpeed(bestAdvisorRow.effectiveSpeedPercent)}</p>
                  <p className="flex items-center gap-1.5">
                    <span>Mastery: Lv {bestAdvisorRow.masteryLevel} / {formatNumber(bestAdvisorRow.masteryReductionPercent, 2)}%</span>
                    {getResourceImage(bestAdvisorRow.row.token) && <img src={getResourceImage(bestAdvisorRow.row.token)} alt={bestAdvisorRow.row.token} className="h-4 w-4 object-contain" />}
                    <span>{bestAdvisorRow.row.token}</span>
                  </p>
                  <p>Estimated profit per hour: {formatNumber(bestAdvisorRow.profitPerHour)} COIN</p>
                  <p>Estimated profit per run: {formatNumber(bestAdvisorRow.profitPerRun)} COIN</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">No fully quoted factory recommendation is available yet.</p>
            )}
          </div>
        </Card>

        {advisorRows.length > 0 && (
          <Card title="All Matched Factories Ranked">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] text-left text-sm">
                <thead className="text-slate-300">
                  <tr>
                    <th className="p-2">Rank</th>
                    <th className="p-2">Factory</th>
                    <th className="p-2">Workshop</th>
                    <th className="p-2">Active Boost</th>
                    <th className="p-2">Mastery</th>
                    <th className="p-2">Base Time</th>
                    <th className="p-2">Output Time</th>
                    <th className="p-2">Effective Speed</th>
                    <th className="p-2">Profit Per Hour</th>
                    <th className="p-2">Profit Per Run</th>
                    <th className="p-2">Input Buy Cost</th>
                    <th className="p-2">Output Sell Value</th>
                    <th className="p-2">Impact</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(readyAdvisorRows.length ? readyAdvisorRows : advisorRows).map((advisorRow, index) => {
                    const factImg = getFactoryImage(advisorRow.option.symbol);
                    const resImg = getResourceImage(advisorRow.row.token);
                    return (
                      <tr key={advisorRow.option.key} className="border-t border-slate-800">
                        <td className="p-2">{index + 1}</td>
                        <td className="p-2 font-semibold">
                          <div className="flex items-center gap-2">
                            {factImg && <img src={factImg} alt={advisorRow.option.symbol} className="h-8 w-8 rounded border border-slate-700 bg-slate-900 object-contain p-0.5" />}
                            <span>{formatFactoryLabel(advisorRow.option)}</span>
                          </div>
                        </td>
                        <td className="p-2">{formatNumber(advisorRow.workshopBoostPercent, 2)}%</td>
                        <td className="p-2">{formatNumber(advisorRow.activeBoostPercent, 2)}%</td>
                        <td className="p-2">
                          <div className="flex items-center gap-1.5">
                            <span>Lv {advisorRow.masteryLevel} / {formatNumber(advisorRow.masteryReductionPercent, 2)}%</span>
                            {resImg && <img src={resImg} alt={advisorRow.row.token} className="h-4 w-4 object-contain" />}
                            <span>{advisorRow.row.token}</span>
                          </div>
                        </td>
                        <td className="p-2">{formatDurationFromMinutes(advisorRow.baseDurationMinutes)}</td>
                        <td className="p-2">{formatDurationFromMinutes(advisorRow.calculatedDurationMinutes)}</td>
                        <td className="p-2">{formatSpeed(advisorRow.effectiveSpeedPercent)}</td>
                        <td className={advisorRow.profitPerHour >= 0 ? 'p-2 text-emerald-300' : 'p-2 text-red-300'}>
                          {advisorRow.missingQuote ? 'Waiting' : `${formatNumber(advisorRow.profitPerHour)} COIN`}
                        </td>
                        <td className={advisorRow.profitPerRun >= 0 ? 'p-2 text-emerald-300' : 'p-2 text-red-300'}>
                          {advisorRow.missingQuote ? 'Waiting' : `${formatNumber(advisorRow.profitPerRun)} COIN`}
                        </td>
                        <td className="p-2">{advisorRow.missingQuote ? 'Waiting' : `${formatNumber(advisorRow.inputCost)} COIN`}</td>
                        <td className="p-2">{advisorRow.missingQuote ? 'Waiting' : `${formatNumber(advisorRow.outputValue)} COIN`}</td>
                        <td className="p-2">{advisorRow.missingQuote ? 'Waiting' : `${formatNumber(advisorRow.maxImpact, 2)}%`}</td>
                        <td className="p-2">{advisorRow.missingQuote ? 'Waiting for quote' : 'Ready'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <Card title="Profitability Calculator">
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              Select one of your live Craft World factories. The calculator matches your owned factory level to the uploaded factory CSV.
            </p>
            <p className="text-sm text-yellow-200">
              Output value uses the sell quote: output resource to COIN. Input costs use buy quotes: COIN to the selected factory resource inputs after mastery reduction.
            </p>
            <p className="text-sm text-yellow-200">
              Upgrade requirement uses the next CSV level row. Profit per hour includes workshop speed and active factory boosts.
            </p>

            {error && <p className="text-sm text-red-300">{error}</p>}
            {quoteError && <p className="text-sm text-red-300">{quoteError}</p>}

            {!ownedFactoryOptions.length ? (
              <p className="text-sm text-slate-400">No live factories were found for this account yet.</p>
            ) : (
              <label className="space-y-1 text-sm">
                <span>Your Factory</span>
                <select
                  value={selectedFactoryKey}
                  onChange={(event) => setSelectedFactoryKey(event.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2"
                >
                  {ownedFactoryOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {formatFactoryLabel(option)}{option.matchingCsvRow ? '' : ' • No CSV match'}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </Card>

        {selectedFactory && !selectedRow && (
          <Card title="CSV Match Missing">
            <p className="text-sm text-yellow-200">
              No CSV row was found for {selectedFactory.symbol} level {selectedFactory.displayLevel}. The uploaded CSV may not include this factory level yet.
            </p>
          </Card>
        )}

        {selectedFactory && selectedRow && (
          <>
            <Card title="Selected Owned Factory">
              <div className="flex gap-4 items-start text-sm">
                {getFactoryImage(selectedFactory.symbol) && (
                  <img src={getFactoryImage(selectedFactory.symbol)} alt={selectedFactory.symbol} className="h-16 w-16 shrink-0 rounded-lg border border-slate-700 bg-slate-900 object-contain p-1" />
                )}
                <div className="grid gap-2 text-sm md:grid-cols-2 flex-grow">
                  <p>Plot: {selectedFactory.plotName}</p>
                  <p>Factory: {selectedFactory.symbol}</p>
                  <p>Owned Display Level: {selectedFactory.displayLevel}</p>
                  <p>Next Display Level: {selectedFactory.nextDisplayLevel}</p>
                  <p>Craft Level: {selectedFactory.craftDisplayLevel || 'N/A'}</p>
                  <p>CSV Level: {selectedRow.level}</p>
                  <p>Original Duration: {formatNumber(selectedRow.duration_min, 2)} min</p>
                  <p>Base Time: {formatDurationFromMinutes(selectedBaseDurationMinutes)}</p>
                  <p>Output Time: {formatDurationFromMinutes(selectedCalculatedDurationMinutes)}</p>
                  <p>Effective Speed: {formatSpeed(selectedEffectiveSpeedPercent)}</p>
                  <p>Workshop Speed Boost: {formatNumber(selectedWorkshopBoostPercent, 2)}%</p>
                  <p>Active Boost: {formatNumber(selectedActiveBoostPercent, 2)}%</p>
                  <p className="flex items-center gap-1.5">
                    <span>Mastery: Lv {selectedMasteryLevel} / {formatNumber(selectedMasteryReductionPercent, 2)}%</span>
                    {getResourceImage(selectedRow.token) && <img src={getResourceImage(selectedRow.token)} alt={selectedRow.token} className="h-4 w-4 object-contain" />}
                    <span>{selectedRow.token}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span>Output: {formatNumber(selectedRow.output_amount)}</span>
                    {getResourceImage(selectedRow.output_token) && <img src={getResourceImage(selectedRow.output_token)} alt={selectedRow.output_token} className="h-4 w-4 object-contain" />}
                    <span>{selectedRow.output_token}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span>Input 1: {formatNumber(selectedRow.input_amount_1)} → {formatNumber(selectedInput1AdjustedAmount)}</span>
                    {getResourceImage(selectedRow.input_token_1) && <img src={getResourceImage(selectedRow.input_token_1)} alt={selectedRow.input_token_1} className="h-4 w-4 object-contain" />}
                    <span>{selectedRow.input_token_1}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span>Input 2: </span>
                    {selectedRow.input_token_2 ? (
                      <>
                        <span>{formatNumber(selectedRow.input_amount_2)} → {formatNumber(selectedInput2AdjustedAmount)}</span>
                        {getResourceImage(selectedRow.input_token_2) && <img src={getResourceImage(selectedRow.input_token_2)} alt={selectedRow.input_token_2} className="h-4 w-4 object-contain" />}
                        <span>{selectedRow.input_token_2}</span>
                      </>
                    ) : 'N/A'}
                  </p>
                  <p className="flex items-center gap-1.5 md:col-span-2">
                    <span>Upgrade Requires: </span>
                    {selectedUpgradeRow?.upgrade_token ? (
                      <>
                        <span>{formatNumber(selectedUpgradeRow.upgrade_amount)}</span>
                        {getResourceImage(selectedUpgradeRow.upgrade_token) && <img src={getResourceImage(selectedUpgradeRow.upgrade_token)} alt={selectedUpgradeRow.upgrade_token} className="h-4 w-4 object-contain" />}
                        <span>{selectedUpgradeRow.upgrade_token}</span>
                      </>
                    ) : 'No next CSV row'}
                  </p>
                </div>
              </div>
            </Card>

            <Card title="Live COIN Quotes">
              <div className="space-y-2 text-sm">
                {quoteLoading && <p className="text-slate-400">Loading Craft World quotes...</p>}
                <QuoteLine label="Output Sell Value" quote={outputQuote} />
                <QuoteLine label="Input 1 Buy Cost After Mastery" quote={input1Quote} />
                {selectedRow.input_token_2 && <QuoteLine label="Input 2 Buy Cost After Mastery" quote={input2Quote} />}
                {selectedUpgradeRow?.upgrade_token && <QuoteLine label="Upgrade Buy Cost" quote={upgradeQuote} />}
              </div>
            </Card>

            <Card title="Results">
              <div className="grid gap-2 text-sm md:grid-cols-2">
                <p>Input Buy Cost After Mastery: {formatNumber(inputCost)} COIN</p>
                <p>Output Sell Value: {formatNumber(outputValue)} COIN</p>
                <p>Profit Per Run: {formatNumber(profitPerRun)} COIN</p>
                <p>Profit Per Hour: {formatNumber(profitPerHour)} COIN</p>
                <p>Runs Per Hour: {formatNumber(runsPerHour, 4)}</p>
                <p>Base Time: {formatDurationFromMinutes(selectedBaseDurationMinutes)}</p>
                <p>Output Time: {formatDurationFromMinutes(selectedCalculatedDurationMinutes)}</p>
                <p>Effective Speed: {formatSpeed(selectedEffectiveSpeedPercent)}</p>
                <p>Upgrade Buy Cost: {formatNumber(upgradeCost)} COIN</p>
              </div>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
