import React, { useState } from 'react';
import { useCurrency } from '../context/CurrencyContext';
import { CurrencyCode } from '../types';
import { RefreshCw, TrendingUp, DollarSign, Euro, ShieldCheck, Check, Edit3, X } from 'lucide-react';

interface CurrencySelectorProps {
  variant?: 'compact' | 'bar' | 'expanded';
  className?: string;
  showSyncButton?: boolean;
}

export default function CurrencySelector({ 
  variant = 'compact', 
  className = '',
  showSyncButton = true 
}: CurrencySelectorProps) {
  const { 
    activeCurrency, 
    setActiveCurrency, 
    rates, 
    currentRate, 
    isSyncing, 
    lastSynced, 
    refreshRates,
    updateManualRate 
  } = useCurrency();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editCurrency, setEditCurrency] = useState<CurrencyCode>('USD');
  const [manualRateInput, setManualRateInput] = useState('');

  const currencies: CurrencyCode[] = ['USD', 'EUR', 'USDT'];

  const getCurrencyIcon = (code: CurrencyCode) => {
    switch (code) {
      case 'USD': return <DollarSign size={14} className="stroke-[3]" />;
      case 'EUR': return <Euro size={14} className="stroke-[3]" />;
      case 'USDT': return <span className="font-black text-[10px] tracking-tight">₮</span>;
    }
  };

  const handleOpenEdit = (code: CurrencyCode) => {
    setEditCurrency(code);
    setManualRateInput(rates[code].rate.toString());
    setIsEditModalOpen(true);
  };

  const handleSaveManualRate = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(manualRateInput);
    if (!isNaN(val) && val > 0) {
      await updateManualRate(editCurrency, val);
      setIsEditModalOpen(false);
    }
  };

  // 1. Compact Variant (For top bar / header in Waiter, Caja, Admin)
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-1.5 bg-slate-100/90 backdrop-blur-sm p-1 rounded-2xl border border-slate-200/80 shadow-xs ${className}`}>
        <div className="flex items-center gap-1">
          {currencies.map((code) => {
            const isSelected = activeCurrency === code;
            const rateInfo = rates[code];

            return (
              <button
                key={code}
                type="button"
                onClick={() => setActiveCurrency(code)}
                title={`${rateInfo.name}: Bs. ${rateInfo.rate.toFixed(2)} (${rateInfo.source})`}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer select-none ${
                  isSelected
                    ? code === 'EUR'
                      ? 'bg-blue-600 text-white shadow-sm scale-[1.02]'
                      : code === 'USDT'
                      ? 'bg-emerald-600 text-white shadow-sm scale-[1.02]'
                      : 'bg-black text-white shadow-sm scale-[1.02]'
                    : 'text-slate-600 hover:text-black hover:bg-slate-200/60'
                }`}
              >
                <span className="shrink-0">{getCurrencyIcon(code)}</span>
                <span className="uppercase text-[11px] tracking-tight">{code}</span>
                <span className={`text-[10px] font-mono opacity-85 hidden sm:inline ${isSelected ? 'text-white/90' : 'text-slate-500'}`}>
                  {rateInfo.rate.toFixed(0)}
                </span>
              </button>
            );
          })}
        </div>

        {showSyncButton && (
          <button
            type="button"
            onClick={() => refreshRates()}
            disabled={isSyncing}
            title={lastSynced ? `pyDolarVenezuela sincronizado: ${lastSynced}` : 'Sincronizar tasas con pyDolarVenezuela / BCV'}
            className="p-1.5 hover:bg-white text-slate-500 hover:text-black rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin text-blue-600' : ''} />
          </button>
        )}
      </div>
    );
  }

  // 2. Full Bar Variant (Used as top banner or prominently in Caja / WaiterView)
  if (variant === 'bar') {
    return (
      <div className={`bg-white rounded-2xl border border-slate-200 p-2 sm:p-2.5 shadow-xs flex flex-wrap items-center justify-between gap-2.5 ${className}`}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0">
            <TrendingUp size={16} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">
                Moneda Activa y Tasa
              </span>
              <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-bold">
                pyDolarVenezuela
              </span>
            </div>
            <div className="text-xs font-black text-slate-900 flex items-center gap-1">
              <span>{currentRate.name}</span>
              <span className="text-slate-400 font-medium">({currentRate.symbol})</span>
              <span className="text-emerald-700 font-mono font-bold">Bs. {currentRate.rate.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Currency buttons */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          {currencies.map((code) => {
            const isSelected = activeCurrency === code;
            const r = rates[code];
            return (
              <button
                key={code}
                type="button"
                onClick={() => setActiveCurrency(code)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  isSelected
                    ? code === 'EUR'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : code === 'USDT'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-black text-white shadow-xs'
                    : 'text-slate-600 hover:text-black hover:bg-white/60'
                }`}
              >
                {getCurrencyIcon(code)}
                <span>{code}</span>
                <span className={`text-[10px] font-mono hidden sm:inline ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                  (Bs. {r.rate.toFixed(1)})
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => refreshRates()}
            disabled={isSyncing}
            title="Actualizar tasas en vivo"
            className="p-1.5 hover:bg-white text-slate-500 hover:text-black rounded-lg transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
      </div>
    );
  }

  // 3. Expanded Variant (Full 3-Card Grid for Caja / Menu Settings)
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">
              Control de Moneda y Tasa de Cambio
            </span>
            <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
              <ShieldCheck size={11} />
              API pyDolarVenezuela / BCV
            </span>
          </div>
          <h3 className="text-base font-black text-slate-900 mt-0.5">
            Selecciona la Moneda Base de Trabajo
          </h3>
          <p className="text-xs text-slate-500">
            Al seleccionar una tasa, todas las cuentas, pedidos, comprobantes y números se calcularán en esa moneda.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {lastSynced && (
            <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
              Sinc: {lastSynced}
            </span>
          )}
          <button
            type="button"
            onClick={() => refreshRates()}
            disabled={isSyncing}
            className="px-3 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin text-blue-400' : ''} />
            <span>{isSyncing ? 'Actualizando...' : 'Actualizar Tasas'}</span>
          </button>
        </div>
      </div>

      {/* 3 Interactive Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {currencies.map((code) => {
          const isSelected = activeCurrency === code;
          const info = rates[code];

          return (
            <div
              key={code}
              onClick={() => setActiveCurrency(code)}
              className={`relative p-4 rounded-2xl border-2 transition-all cursor-pointer select-none flex flex-col justify-between ${
                isSelected
                  ? code === 'EUR'
                    ? 'border-blue-600 bg-blue-50/40 shadow-md ring-2 ring-blue-600/20'
                    : code === 'USDT'
                    ? 'border-emerald-600 bg-emerald-50/40 shadow-md ring-2 ring-emerald-600/20'
                    : 'border-slate-900 bg-slate-50/60 shadow-md ring-2 ring-black/10'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              {/* Top header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black ${
                    isSelected
                      ? code === 'EUR'
                        ? 'bg-blue-600 text-white'
                        : code === 'USDT'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-black text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {getCurrencyIcon(code)}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">{info.name}</h4>
                    <span className="text-[10px] text-slate-400 block font-medium">{info.source}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEdit(code);
                    }}
                    title="Ajustar tasa manualmente"
                    className="p-1 text-slate-400 hover:text-black hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <Edit3 size={12} />
                  </button>
                  {isSelected && (
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white ${
                      code === 'EUR' ? 'bg-blue-600' : code === 'USDT' ? 'bg-emerald-600' : 'bg-black'
                    }`}>
                      <Check size={12} className="stroke-[3]" />
                    </span>
                  )}
                </div>
              </div>

              {/* Rate value */}
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Tasa en Bolívares
                </span>
                <div className="text-2xl font-black text-slate-900 font-mono flex items-baseline gap-1">
                  <span className="text-xs font-normal text-slate-500">Bs.</span>
                  <span>{info.rate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Status footer */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                <span className={`font-black uppercase tracking-wider ${
                  isSelected 
                    ? code === 'EUR' ? 'text-blue-700' : code === 'USDT' ? 'text-emerald-700' : 'text-slate-900' 
                    : 'text-slate-400'
                }`}>
                  {isSelected ? '● ACTIVA EN TODO EL SISTEMA' : 'Clic para Activar'}
                </span>
                <span className="text-slate-400 font-mono text-[9px]">
                  Ref: 1 {info.symbol}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Manual Rate Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                  {getCurrencyIcon(editCurrency)}
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">Ajustar Tasa Manual</h4>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">{editCurrency} - {rates[editCurrency].name}</span>
                </div>
              </div>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveManualRate} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Tasa en Bolívares (VES por 1 {rates[editCurrency].symbol}):
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Bs.</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={manualRateInput}
                    onChange={(e) => setManualRateInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:bg-white focus:border-black outline-hidden"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Puedes sobrescribir la tasa temporalmente si el restaurante maneja un diferencial local o no hay internet.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-black hover:bg-slate-800 text-white text-xs font-black rounded-xl shadow-sm cursor-pointer"
                >
                  Guardar Tasa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
