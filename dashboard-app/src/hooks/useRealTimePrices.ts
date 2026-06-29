import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAllPrices, type TokenPrices, type PriceResult } from '../utils/priceService';

export interface UseRealTimePricesReturn {
  prices: TokenPrices;
  coinPriceUsd: number;
  source: 'game-api' | 'rawrtools' | 'onchain' | 'fallback';
  stale: boolean;
  loading: boolean;
  error: string | null;
  lastUpdate: number;
  refetch: () => Promise<void>;
}

export function useRealTimePrices(intervalMs: number = 30000): UseRealTimePricesReturn {
  const [prices, setPrices] = useState<TokenPrices>({});
  const [coinPriceUsd, setCoinPriceUsd] = useState<number>(0);
  const [source, setSource] = useState<'game-api' | 'rawrtools' | 'onchain' | 'fallback'>('fallback');
  const [stale, setStale] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const mountedRef = useRef(true);

  const updatePrices = useCallback(async () => {
    try {
      setError(null);
      const data: PriceResult = await fetchAllPrices();
      if (!mountedRef.current) return;
      setPrices(data.prices);
      setCoinPriceUsd(data.coinPriceUsd);
      setSource(data.source);
      setStale(data.stale);
      setLastUpdate(data.timestamp);
      setLoading(false);
    } catch (err: any) {
      if (!mountedRef.current) return;
      console.error("Error in useRealTimePrices hook:", err);
      setError(err?.message || "Failed to fetch real-time prices");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    updatePrices();
    const timer = setInterval(() => {
      updatePrices();
    }, intervalMs);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [updatePrices, intervalMs]);

  return {
    prices,
    coinPriceUsd,
    source,
    stale,
    loading,
    error,
    lastUpdate,
    refetch: updatePrices
  };
}
