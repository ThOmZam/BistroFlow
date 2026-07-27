import React from 'react';
import { DollarSign, Sparkles } from 'lucide-react';

interface TipSelectorProps {
  subtotalUSD: number;
  exchangeRate: number;
  tipAmountUSD: number;
  setTipAmountUSD: (amount: number) => void;
  tipPercent: number | null;
  setTipPercent: (pct: number | null) => void;
  enabled?: boolean;
  tipOptions?: number[];
}

export default function TipSelector({
  subtotalUSD,
  exchangeRate,
  tipAmountUSD,
  setTipAmountUSD,
  tipPercent,
  setTipPercent,
  enabled = true,
  tipOptions = [10, 15, 20]
}: TipSelectorProps) {
  if (!enabled) return null;

  const handleSelectPercent = (pct: number) => {
    setTipPercent(pct);
    const calculated = (subtotalUSD * pct) / 100;
    setTipAmountUSD(Number(calculated.toFixed(2)));
  };

  const handleSelectNoTip = () => {
    setTipPercent(0);
    setTipAmountUSD(0);
  };

  return (
    <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
          <Sparkles size={14} className="text-amber-600" />
          💡 Propina Sugerida para el Personal
        </span>
        {tipAmountUSD > 0 && (
          <span className="text-xs font-extrabold bg-amber-500 text-white px-2.5 py-0.5 rounded-full">
            +${tipAmountUSD.toFixed(2)} (Bs. {(tipAmountUSD * exchangeRate).toFixed(2)})
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {tipOptions.map((pct) => {
          const isSelected = tipPercent === pct;
          const valUSD = (subtotalUSD * pct) / 100;
          return (
            <button
              key={pct}
              type="button"
              onClick={() => handleSelectPercent(pct)}
              className={`p-2 rounded-xl text-center border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-amber-500 text-slate-950 border-amber-600 font-extrabold shadow-sm'
                  : 'bg-white text-slate-700 border-amber-200/80 hover:bg-amber-100/50'
              }`}
            >
              <div className="text-xs font-black">{pct}%</div>
              <div className="text-[10px] opacity-90">${valUSD.toFixed(2)}</div>
            </button>
          );
        })}

        <button
          type="button"
          onClick={handleSelectNoTip}
          className={`p-2 rounded-xl text-center border transition-all cursor-pointer ${
            tipPercent === 0
              ? 'bg-slate-900 text-white border-slate-900 font-extrabold'
              : 'bg-white text-slate-600 border-amber-200/80 hover:bg-amber-100/50'
          }`}
        >
          <div className="text-xs font-bold">Sin Propina</div>
          <div className="text-[10px] opacity-75">$0.00</div>
        </button>
      </div>

      {/* Manual Tip Amount Input if user wants another amount */}
      <div className="pt-1 flex items-center gap-2">
        <label className="text-[10px] font-bold text-amber-900 shrink-0">Otro Monto ($):</label>
        <input
          type="number"
          step="0.5"
          min="0"
          value={tipAmountUSD || ''}
          onChange={(e) => {
            const val = parseFloat(e.target.value) || 0;
            setTipAmountUSD(val);
            setTipPercent(null);
          }}
          placeholder="Ej: 5.00"
          className="w-full px-3 py-1.5 text-xs font-bold border border-amber-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>
    </div>
  );
}
