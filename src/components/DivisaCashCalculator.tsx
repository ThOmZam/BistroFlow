import React from 'react';
import { DollarSign, ArrowRightLeft, CheckCircle2, AlertCircle, Phone, Landmark, CreditCard, Banknote } from 'lucide-react';

export interface DivisaCashCalculatorProps {
  totalUSD: number;
  currentRateBs: number;
  cashReceivedUSD: number;
  onChangeCashReceivedUSD: (val: number) => void;
  changeCurrency: 'USD' | 'Bs';
  onChangeCurrency: (curr: 'USD' | 'Bs') => void;
  changeMethod: 'efectivo_usd' | 'efectivo_bs' | 'pago_movil_vuelto';
  onChangeMethod: (method: 'efectivo_usd' | 'efectivo_bs' | 'pago_movil_vuelto') => void;
  vueltoPhone?: string;
  onChangeVueltoPhone?: (v: string) => void;
  vueltoBank?: string;
  onChangeVueltoBank?: (v: string) => void;
  vueltoIdNumber?: string;
  onChangeVueltoIdNumber?: (v: string) => void;
  vueltoRef?: string;
  onChangeVueltoRef?: (v: string) => void;
  readOnly?: boolean;
}

export const DivisaCashCalculator: React.FC<DivisaCashCalculatorProps> = ({
  totalUSD,
  currentRateBs,
  cashReceivedUSD,
  onChangeCashReceivedUSD,
  changeCurrency,
  onChangeCurrency,
  changeMethod,
  onChangeMethod,
  vueltoPhone = '',
  onChangeVueltoPhone,
  vueltoBank = 'Banesco',
  onChangeVueltoBank,
  vueltoIdNumber = '',
  onChangeVueltoIdNumber,
  vueltoRef = '',
  onChangeVueltoRef,
  readOnly = false
}) => {
  const totalBs = totalUSD * currentRateBs;
  
  // Quick presets for common bill denominations ($5, $10, $20, $50, $100)
  const presets: { label: string; value: number }[] = [
    { label: 'Exacto', value: Math.round(totalUSD * 100) / 100 },
    ...[5, 10, 20, 50, 100]
      .filter(val => val >= totalUSD)
      .map(val => ({ label: `$${val}`, value: val }))
  ];

  const changeUSD = Math.max(0, cashReceivedUSD - totalUSD);
  const changeBs = changeUSD * currentRateBs;
  const isShortage = cashReceivedUSD > 0 && cashReceivedUSD < totalUSD;
  const shortageUSD = totalUSD - cashReceivedUSD;
  const shortageBs = shortageUSD * currentRateBs;

  return (
    <div className="bg-gradient-to-br from-emerald-50/90 via-emerald-50/40 to-teal-50/60 border border-emerald-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 font-sans text-slate-800">
      
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-emerald-200/70">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <DollarSign size={18} strokeWidth={2.5} />
          </div>
          <div>
            <h4 className="font-black text-xs sm:text-sm text-emerald-950 uppercase tracking-wide flex items-center gap-1.5">
              Pago en Divisa / Efectivo $
            </h4>
            <p className="text-[10px] sm:text-xs text-emerald-800 font-medium">
              Calculadora de billete recibido y entrega de vuelto
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100/80 border border-emerald-300/80 rounded-full text-[10px] font-black text-emerald-900 self-start sm:self-center">
          <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
          <span>Sin referencia ni comprobante obligatorio</span>
        </div>
      </div>

      {/* Bill summary vs Rate */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs">
        <div className="bg-white/90 p-3 rounded-xl border border-emerald-100 shadow-2xs">
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Total de la Cuenta</span>
          <span className="font-black text-sm text-slate-900 font-mono">${totalUSD.toFixed(2)} USD</span>
        </div>
        <div className="bg-white/90 p-3 rounded-xl border border-emerald-100 shadow-2xs">
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Total en Bolívares ({currentRateBs.toFixed(2)} Bs/$)</span>
          <span className="font-black text-sm text-emerald-700 font-mono">Bs. {totalBs.toFixed(2)}</span>
        </div>
      </div>

      {!readOnly && (
        <>
          {/* Amount Received Input */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
                <Banknote size={13} className="text-emerald-600" />
                Cantidad / Billete Recibido ($ USD)
              </label>
              {cashReceivedUSD > 0 && (
                <button
                  type="button"
                  onClick={() => onChangeCashReceivedUSD(0)}
                  className="text-[10px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={cashReceivedUSD || ''}
                onChange={(e) => onChangeCashReceivedUSD(parseFloat(e.target.value) || 0)}
                placeholder={`Ej. ${(Math.ceil(totalUSD / 5) * 5 || totalUSD).toFixed(2)}`}
                className="w-full pl-8 pr-4 py-3 bg-white border border-emerald-300 rounded-xl font-mono font-black text-base text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition-all shadow-2xs"
              />
            </div>

            {/* Quick Presets Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] font-bold text-slate-400 mr-1">Rápido:</span>
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onChangeCashReceivedUSD(p.value)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer border ${
                    cashReceivedUSD === p.value
                      ? 'bg-emerald-700 text-white border-emerald-800 shadow-2xs'
                      : 'bg-white text-slate-700 border-emerald-200 hover:bg-emerald-100/70'
                  }`}
                >
                  {p.label === 'Exacto' ? `Exacto ($${p.value.toFixed(2)})` : `$${p.value}`}
                </button>
              ))}
            </div>
          </div>

          {/* Shortage Warning */}
          {isShortage && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start gap-2.5 text-amber-900 text-xs shadow-2xs">
              <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold block text-amber-950">Monto insuficiente</span>
                <span>Faltan <strong>${shortageUSD.toFixed(2)} USD</strong> (Bs. {shortageBs.toFixed(2)}) para completar el total.</span>
              </div>
            </div>
          )}

          {/* Change Result Panel (When cash received >= total) */}
          {cashReceivedUSD >= totalUSD && (
            <div className="bg-white border border-emerald-300 rounded-xl p-4 space-y-3.5 shadow-2xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <ArrowRightLeft size={13} className="text-emerald-600" />
                  Vuelto Total a Entregar
                </span>
                <div className="text-right">
                  <span className="font-black text-emerald-700 text-sm font-mono block">
                    ${changeUSD.toFixed(2)} USD
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono font-extrabold">
                    (= Bs. {changeBs.toFixed(2)})
                  </span>
                </div>
              </div>

              {changeUSD > 0 ? (
                <>
                  {/* Moneda de Vuelto */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase text-slate-600 block">
                      Moneda para entregar el Vuelto:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onChangeCurrency('USD');
                          onChangeMethod('efectivo_usd');
                        }}
                        className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          changeCurrency === 'USD'
                            ? 'bg-emerald-800 text-white border-emerald-900 shadow-2xs font-black'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>💵 Dólares ($)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onChangeCurrency('Bs');
                          if (changeMethod === 'efectivo_usd') {
                            onChangeMethod('efectivo_bs');
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          changeCurrency === 'Bs'
                            ? 'bg-emerald-800 text-white border-emerald-900 shadow-2xs font-black'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>🇻🇪 Bolívares (Bs)</span>
                      </button>
                    </div>
                  </div>

                  {/* If Vuelto in Bs: Select method (Efectivo Bs vs Pago Móvil) */}
                  {changeCurrency === 'Bs' && (
                    <div className="space-y-2 pt-1">
                      <label className="text-[10px] font-extrabold uppercase text-slate-600 block">
                        Método de Entrega del Vuelto en Bs:
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => onChangeMethod('efectivo_bs')}
                          className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            changeMethod === 'efectivo_bs'
                              ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          💵 Efectivo Bs.
                        </button>

                        <button
                          type="button"
                          onClick={() => onChangeMethod('pago_movil_vuelto')}
                          className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            changeMethod === 'pago_movil_vuelto'
                              ? 'bg-indigo-900 text-white border-indigo-900 shadow-2xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          📱 Pago Móvil
                        </button>
                      </div>

                      {/* If Pago Movil for Vuelto, show optional recipient inputs */}
                      {changeMethod === 'pago_movil_vuelto' && (
                        <div className="bg-indigo-50/90 border border-indigo-200 rounded-xl p-3 space-y-2.5 text-xs">
                          <span className="font-black text-indigo-950 text-[10px] uppercase block tracking-wider">
                            Datos para Enviar Pago Móvil de Vuelto (Bs. {changeBs.toFixed(2)})
                          </span>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">
                                Teléfono Cliente
                              </label>
                              <div className="relative">
                                <Phone size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                  type="text"
                                  value={vueltoPhone}
                                  onChange={(e) => onChangeVueltoPhone && onChangeVueltoPhone(e.target.value)}
                                  placeholder="0412-1234567"
                                  className="w-full pl-7 pr-2 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-mono font-bold text-slate-800 outline-none focus:border-indigo-600"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">
                                Banco Destino
                              </label>
                              <div className="relative">
                                <Landmark size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <select
                                  value={vueltoBank}
                                  onChange={(e) => onChangeVueltoBank && onChangeVueltoBank(e.target.value)}
                                  className="w-full pl-7 pr-2 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-indigo-600"
                                >
                                  <option value="Banesco">Banesco (0134)</option>
                                  <option value="Mercantil">Mercantil (0105)</option>
                                  <option value="Banco de Venezuela">BDV (0102)</option>
                                  <option value="Provincial">BBVA Provincial (0108)</option>
                                  <option value="BNC">BNC (0191)</option>
                                  <option value="Bancamiga">Bancamiga (0172)</option>
                                  <option value="BFC">BFC (0151)</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">
                                Cédula / RIF
                              </label>
                              <div className="relative">
                                <CreditCard size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                  type="text"
                                  value={vueltoIdNumber}
                                  onChange={(e) => onChangeVueltoIdNumber && onChangeVueltoIdNumber(e.target.value)}
                                  placeholder="V-12345678"
                                  className="w-full pl-7 pr-2 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-mono font-bold text-slate-800 outline-none focus:border-indigo-600"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">
                                Nro. Ref Envío (Opcional)
                              </label>
                              <input
                                type="text"
                                value={vueltoRef}
                                onChange={(e) => onChangeVueltoRef && onChangeVueltoRef(e.target.value)}
                                placeholder="Ej. 984102"
                                className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-mono font-bold text-slate-800 outline-none focus:border-indigo-600"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-center text-xs text-emerald-900 font-extrabold">
                  ✓ Pago Exacto — No requiere entregar vuelto
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
