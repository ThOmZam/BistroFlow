const fs = require('fs');
let code = fs.readFileSync('src/views/WaiterView.tsx', 'utf8');

// The block to insert starts around line 1805, below Zelle info
const insertStr = `
                {paymentMethod === 'mixto' && (
                  <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 space-y-4">
                    <div className="pb-2 border-b border-slate-200/50 flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">Pagos Mixtos</span>
                      <span className="text-xs font-bold font-mono">Restante: $ {Math.max(0, finalTotal - mixedPayments.reduce((s, p) => s + p.amountUSD, 0)).toFixed(2)}</span>
                    </div>

                    {mixedPayments.length > 0 && (
                      <div className="space-y-2">
                        {mixedPayments.map(p => (
                          <div key={p.id} className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-100 text-xs">
                            <div>
                              <span className="font-bold block uppercase">{p.method.replace('_', ' ')}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{p.reference || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-bold font-mono text-slate-700">${p.amountUSD.toFixed(2)}</span>
                              <button type="button" onClick={() => setMixedPayments(mixedPayments.filter(x => x.id !== p.id))} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg"><Trash2 size={14}/></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {finalTotal - mixedPayments.reduce((s, p) => s + p.amountUSD, 0) > 0.001 && (
                      <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Método</label>
                            <select id="mixto_method" className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2 outline-none text-xs">
                              <option value="pago_movil">Pago Móvil</option>
                              <option value="zelle">Zelle</option>
                              <option value="divisa">Divisa ($)</option>
                              <option value="punto">Punto (Bs)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Monto ($)</label>
                            <input 
                              type="number" 
                              id="mixto_amount"
                              placeholder="Ej. 10" 
                              step="0.01"
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2 outline-none text-xs"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Referencia</label>
                            <input 
                              type="text" 
                              id="mixto_ref"
                              placeholder="Obligatorio para digital" 
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2 outline-none text-xs"
                            />
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={() => {
                            const m = (document.getElementById('mixto_method') as HTMLSelectElement).value;
                            const amt = parseFloat((document.getElementById('mixto_amount') as HTMLInputElement).value) || 0;
                            const ref = (document.getElementById('mixto_ref') as HTMLInputElement).value;
                            
                            if (amt <= 0) return alert('Ingrese un monto válido');
                            if ((m === 'pago_movil' || m === 'zelle' || m === 'punto') && !ref.trim()) return alert('Referencia requerida para este método');
                            
                            const currency = (m === 'pago_movil' || m === 'punto') ? 'Bs' : 'USD';
                            setMixedPayments([...mixedPayments, { id: Date.now().toString(), method: m, amountUSD: amt, currency, reference: ref, receiptImage: null }]);
                            (document.getElementById('mixto_amount') as HTMLInputElement).value = '';
                            (document.getElementById('mixto_ref') as HTMLInputElement).value = '';
                          }}
                          className="w-full py-2 bg-indigo-50 text-indigo-700 font-bold text-[10px] uppercase rounded-xl hover:bg-indigo-100"
                        >
                          + Agregar Pago
                        </button>
                      </div>
                    )}
                  </div>
                )}
`;

code = code.replace(
  "{/* Image Upload and Reference for digital payments */}",
  insertStr + "\n                {/* Image Upload and Reference for digital payments */}"
);

// Do not show the generic digital payment upload if 'mixto' is selected
code = code.replace(
  "{(paymentMethod === 'pago_movil' || paymentMethod === 'zelle') && (",
  "{(paymentMethod === 'pago_movil' || paymentMethod === 'zelle') && paymentMethod !== 'mixto' && ("
);

fs.writeFileSync('src/views/WaiterView.tsx', code);
