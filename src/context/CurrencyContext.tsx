import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CurrencyCode, ExchangeRateInfo, AppCurrencyRates } from '../types';

export const DEFAULT_RATES: AppCurrencyRates = {
  USD: {
    code: 'USD',
    name: 'BCV Dólar',
    symbol: '$',
    rate: 874.73,
    source: 'BCV Oficial',
    lastUpdated: new Date().toISOString()
  },
  EUR: {
    code: 'EUR',
    name: 'BCV Euro',
    symbol: '€',
    rate: 979.08,
    source: 'BCV Oficial',
    lastUpdated: new Date().toISOString()
  },
  USDT: {
    code: 'USDT',
    name: 'USDT Cripto / Paralelo',
    symbol: 'USDT',
    rate: 1017.00,
    source: 'Binance P2P / Mercado',
    lastUpdated: new Date().toISOString()
  }
};

interface CurrencyContextValue {
  activeCurrency: CurrencyCode;
  setActiveCurrency: (code: CurrencyCode) => Promise<void>;
  rates: AppCurrencyRates;
  currentRate: ExchangeRateInfo;
  currentRateBs: number;
  currencySymbol: string;
  isSyncing: boolean;
  lastSynced: string | null;
  refreshRates: (saveToFirestore?: boolean) => Promise<boolean>;
  updateManualRate: (code: CurrencyCode, rate: number) => Promise<void>;
  convert: (amountUSD: number) => number;
  toBolivares: (amountUSD: number) => number;
  formatPrice: (amountUSD: number) => string;
  formatActive: (amountInActive: number) => string;
  formatBs: (amountBs: number) => string;
  formatWithBs: (amountUSD: number) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [activeCurrency, setActiveCurrencyState] = useState<CurrencyCode>(() => {
    return (localStorage.getItem('resto_active_currency') as CurrencyCode) || 'USD';
  });
  const [rates, setRates] = useState<AppCurrencyRates>(DEFAULT_RATES);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  // 1. Listen to Firestore settings/general for live sync across all devices
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.activeCurrency && ['USD', 'EUR', 'USDT'].includes(data.activeCurrency)) {
          setActiveCurrencyState(data.activeCurrency as CurrencyCode);
          localStorage.setItem('resto_active_currency', data.activeCurrency);
        }

        if (data.currencyRates) {
          setRates(prev => ({
            USD: { ...prev.USD, ...(data.currencyRates.USD || {}) },
            EUR: { ...prev.EUR, ...(data.currencyRates.EUR || {}) },
            USDT: { ...prev.USDT, ...(data.currencyRates.USDT || {}) },
          }));
        } else if (data.exchangeRate) {
          // If only general exchangeRate is present, update active rate
          setRates(prev => {
            const curr = data.activeCurrency || 'USD';
            return {
              ...prev,
              [curr]: { ...prev[curr as CurrencyCode], rate: Number(data.exchangeRate) }
            };
          });
        }
      }
    });

    return () => unsub();
  }, []);

  // 2. Fetch live rates with multi-layer fallback (Server Route -> Direct Public API -> Cached/Default)
  const refreshRates = async (saveToFirestore = false): Promise<boolean> => {
    setIsSyncing(true);
    let resolvedRates: AppCurrencyRates | null = null;

    // Strategy 1: Attempt to fetch from local server endpoint
    try {
      const url = saveToFirestore ? '/api/exchange-rates?force=true' : '/api/exchange-rates';
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(3500)
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data && data.success && data.rates) {
          resolvedRates = {
            USD: { ...DEFAULT_RATES.USD, ...data.rates.USD },
            EUR: { ...DEFAULT_RATES.EUR, ...data.rates.EUR },
            USDT: { ...DEFAULT_RATES.USDT, ...data.rates.USDT },
          };
        }
      }
    } catch {
      // Server endpoint not ready, timed out, or unavailable; proceed to Strategy 2
    }

    // Strategy 2: Direct public CORS-enabled API fallback (ve.dolarapi.com)
    if (!resolvedRates) {
      try {
        const [dRes, eRes] = await Promise.allSettled([
          fetch('https://ve.dolarapi.com/v1/dolares', { signal: AbortSignal.timeout(3000) }),
          fetch('https://ve.dolarapi.com/v1/euros', { signal: AbortSignal.timeout(3000) })
        ]);

        let bcvUSD = DEFAULT_RATES.USD.rate;
        let paraleloUSDT = DEFAULT_RATES.USDT.rate;
        let bcvEUR = DEFAULT_RATES.EUR.rate;
        let updatedTime = new Date().toISOString();

        if (dRes.status === 'fulfilled' && dRes.value.ok) {
          try {
            const ct = dRes.value.headers.get('content-type') || '';
            if (ct.includes('application/json')) {
              const dData = await dRes.value.json();
              if (Array.isArray(dData)) {
                const oficial = dData.find((d: any) => d.fuente === 'oficial') || dData[0];
                const paralelo = dData.find((d: any) => d.fuente === 'paralelo');
                if (oficial && typeof oficial.promedio === 'number' && oficial.promedio > 0) {
                  bcvUSD = Math.round(oficial.promedio * 100) / 100;
                  updatedTime = oficial.fechaActualizacion || updatedTime;
                }
                if (paralelo && typeof paralelo.promedio === 'number' && paralelo.promedio > 0) {
                  paraleloUSDT = Math.round(paralelo.promedio * 100) / 100;
                }
              }
            }
          } catch {
            // Ignore JSON parse error from third-party endpoint
          }
        }

        if (eRes.status === 'fulfilled' && eRes.value.ok) {
          try {
            const ct = eRes.value.headers.get('content-type') || '';
            if (ct.includes('application/json')) {
              const eData = await eRes.value.json();
              if (Array.isArray(eData)) {
                const oficial = eData.find((e: any) => e.fuente === 'oficial') || eData[0];
                if (oficial && typeof oficial.promedio === 'number' && oficial.promedio > 0) {
                  bcvEUR = Math.round(oficial.promedio * 100) / 100;
                }
              }
            }
          } catch {
            // Ignore JSON parse error from third-party endpoint
          }
        }

        resolvedRates = {
          USD: { ...DEFAULT_RATES.USD, rate: bcvUSD, lastUpdated: updatedTime },
          EUR: { ...DEFAULT_RATES.EUR, rate: bcvEUR, lastUpdated: updatedTime },
          USDT: { ...DEFAULT_RATES.USDT, rate: paraleloUSDT, lastUpdated: updatedTime },
        };
      } catch {
        // Fallback to existing or default rates
      }
    }

    if (resolvedRates) {
      setRates(resolvedRates);
      setLastSynced(new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      // Only save to Firestore if explicitly requested by Admin in Ajustes!
      if (saveToFirestore) {
        try {
          const activeRate = resolvedRates[activeCurrency]?.rate || resolvedRates.USD.rate;
          await setDoc(doc(db, 'settings', 'general'), {
            activeCurrency,
            exchangeRate: activeRate,
            currencyRates: resolvedRates,
            ratesLastSynced: new Date().toISOString()
          }, { merge: true });
        } catch {}
      }

      setIsSyncing(false);
      return true;
    }

    setIsSyncing(false);
    return false;
  };

  useEffect(() => {
    // Background fetch for reference only, never overwrite Admin Firestore configuration
    refreshRates(false);
    const interval = setInterval(() => refreshRates(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // 3. Change active currency and update Firestore
  const setActiveCurrency = async (code: CurrencyCode) => {
    setActiveCurrencyState(code);
    localStorage.setItem('resto_active_currency', code);

    const selectedRate = rates[code]?.rate || DEFAULT_RATES[code].rate;
    try {
      await updateDoc(doc(db, 'settings', 'general'), {
        activeCurrency: code,
        exchangeRate: selectedRate
      });
    } catch (err) {
      // In case doc doesn't exist yet
      try {
        await setDoc(doc(db, 'settings', 'general'), {
          activeCurrency: code,
          exchangeRate: selectedRate,
          currencyRates: rates
        }, { merge: true });
      } catch (e) {
        console.warn('Failed to update Firestore currency setting:', e);
      }
    }
  };

  // 4. Update manual rate override
  const updateManualRate = async (code: CurrencyCode, rateVal: number) => {
    const validRate = Math.max(0.01, rateVal);
    const updatedRates: AppCurrencyRates = {
      ...rates,
      [code]: {
        ...rates[code],
        rate: validRate,
        source: 'Manual / Restaurante',
        lastUpdated: new Date().toISOString()
      }
    };
    setRates(updatedRates);

    const activeRate = updatedRates[activeCurrency]?.rate || validRate;
    try {
      await setDoc(doc(db, 'settings', 'general'), {
        currencyRates: updatedRates,
        exchangeRate: activeRate
      }, { merge: true });
    } catch (err) {
      console.error('Error saving manual rate:', err);
    }
  };

  // 5. Calculations based on active currency
  const currentRate = rates[activeCurrency] || DEFAULT_RATES[activeCurrency];
  const currentRateBs = currentRate.rate;
  const currencySymbol = currentRate.symbol;

  /**
   * Converts a base USD amount to the currently active currency
   */
  const convert = (amountUSD: number): number => {
    if (!amountUSD || isNaN(amountUSD)) return 0;
    if (activeCurrency === 'USD') return amountUSD;
    if (activeCurrency === 'USDT') return amountUSD; // 1:1 Crypto peg reference
    if (activeCurrency === 'EUR') {
      const usdRate = rates.USD.rate || DEFAULT_RATES.USD.rate;
      const eurRate = rates.EUR.rate || DEFAULT_RATES.EUR.rate;
      return (amountUSD * usdRate) / eurRate;
    }
    return amountUSD;
  };

  /**
   * Calculates the exact Bolívares equivalent for a base USD amount using the active rate
   */
  const toBolivares = (amountUSD: number): number => {
    if (!amountUSD || isNaN(amountUSD)) return 0;
    if (activeCurrency === 'USD') return amountUSD * rates.USD.rate;
    if (activeCurrency === 'USDT') return amountUSD * rates.USDT.rate;
    if (activeCurrency === 'EUR') {
      const eurAmount = convert(amountUSD);
      return eurAmount * rates.EUR.rate;
    }
    return amountUSD * currentRateBs;
  };

  /**
   * Formats a base USD amount into the active currency string:
   * USD -> "$10.00"
   * EUR -> "8.93 €"
   * USDT -> "10.00 USDT"
   */
  const formatPrice = (amountUSD: number): string => {
    const converted = convert(amountUSD);
    return formatActive(converted);
  };

  /**
   * Formats an amount that is already in the active currency:
   * USD -> "$10.00"
   * EUR -> "10.00 €"
   * USDT -> "10.00 USDT"
   */
  const formatActive = (amountInActive: number): string => {
    const val = Number(amountInActive) || 0;
    if (activeCurrency === 'USD') {
      return `$${val.toFixed(2)}`;
    }
    if (activeCurrency === 'EUR') {
      return `${val.toFixed(2)} €`;
    }
    if (activeCurrency === 'USDT') {
      return `${val.toFixed(2)} USDT`;
    }
    return `$${val.toFixed(2)}`;
  };

  /**
   * Formats an amount in Bolívares:
   * "Bs. 8,747.30"
   */
  const formatBs = (amountBs: number): string => {
    const val = Number(amountBs) || 0;
    return `Bs. ${val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  /**
   * Formats base USD with its active currency and Bolívares equivalent:
   * USD -> "$10.00 (Bs. 8,747.30)"
   * EUR -> "8.93 € (Bs. 8,747.30)"
   * USDT -> "10.00 USDT (Bs. 10,170.00)"
   */
  const formatWithBs = (amountUSD: number): string => {
    const priceStr = formatPrice(amountUSD);
    const bsStr = formatBs(toBolivares(amountUSD));
    return `${priceStr} (${bsStr})`;
  };

  const value = useMemo<CurrencyContextValue>(() => ({
    activeCurrency,
    setActiveCurrency,
    rates,
    currentRate,
    currentRateBs,
    currencySymbol,
    isSyncing,
    lastSynced,
    refreshRates,
    updateManualRate,
    convert,
    toBolivares,
    formatPrice,
    formatActive,
    formatBs,
    formatWithBs
  }), [activeCurrency, rates, isSyncing, lastSynced]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
