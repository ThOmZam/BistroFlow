import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useOrders } from '../hooks/useOrders';
import { useRestaurantData } from '../hooks/useRestaurantData';
import { doc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Clock, CheckCircle2, ChefHat, XCircle, Printer, Tag, Undo2, RotateCcw, AlertTriangle, FileText, Check, Sparkles } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { playNotificationSound } from '../lib/audio';

export default function KDSView({ currentUser }: { currentUser?: any }) {
  const { orders } = useOrders();
  const { ingredients, settings, menu } = useRestaurantData();
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [checkedItemIds, setCheckedItemIds] = useState<Record<string, boolean>>({});

  // Helper function to extract notes & excluded ingredients
  const getItemNotesAndExclusions = (item: any, ingredientsList: any[] = []) => {
    const details: string[] = [];

    if (item.note && typeof item.note === 'string' && item.note.trim()) {
      details.push(item.note.trim());
    }
    if (item.notes && typeof item.notes === 'string' && item.notes.trim() && item.notes !== item.note) {
      details.push(item.notes.trim());
    }
    if (item.specialInstructions && typeof item.specialInstructions === 'string' && item.specialInstructions.trim()) {
      details.push(item.specialInstructions.trim());
    }

    if (Array.isArray(item.excludedIngredientNames) && item.excludedIngredientNames.length > 0) {
      details.push(`SIN: ${item.excludedIngredientNames.join(', ')}`);
    } else if (Array.isArray(item.excludedIngredientIds) && item.excludedIngredientIds.length > 0) {
      const names = item.excludedIngredientIds
        .map((id: string) => ingredientsList.find((ing: any) => ing.id === id)?.name)
        .filter(Boolean);
      if (names.length > 0) {
        details.push(`SIN: ${names.join(', ')}`);
      }
    }

    return details;
  };
  
  // Sticker Printer states
  const [selectedTicketForPrint, setSelectedTicketForPrint] = useState<any | null>(null);
  const [printMode, setPrintMode] = useState<'comanda' | 'individual_stickers'>(() => {
    return (localStorage.getItem('kds_auto_print_format') as 'comanda' | 'individual_stickers') || 'comanda';
  });

  useEffect(() => {
    if (selectedTicketForPrint) {
      const savedFormat = (localStorage.getItem('kds_auto_print_format') as 'comanda' | 'individual_stickers') || 'comanda';
      setPrintMode(savedFormat);
    }
  }, [selectedTicketForPrint]);
  const [autoPrintEnabled, setAutoPrintEnabled] = useState<boolean>(() => {
    return localStorage.getItem('kds_auto_print_enabled') === 'true';
  });
  const [prevOrdersLength, setPrevOrdersLength] = useState<number>(orders.length);
  const [, setTicker] = useState(0);

  // Live timer interval to update elapsed minutes dynamically every 10s
  useEffect(() => {
    const timer = setInterval(() => {
      setTicker(t => t + 1);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Group pending orders by batchId or fallback to timestamp
  const groupedTickets = useMemo(() => {
    const pendingOrders = orders.filter(o => o.status === 'pending');
    const groups: Record<string, any> = {};

    pendingOrders.forEach((order: any) => {
      const key = order.batchId || order.timestamp; // Group key
      const custName = order.customerName || order.clientName || order.customer || order.accountName || null;
      if (!groups[key]) {
        groups[key] = {
          id: key,
          tableName: order.tableName || 'Desconocido',
          timestamp: order.timestamp,
          isDelivery: order.isDelivery,
          customerName: custName,
          items: []
        };
      } else if (!groups[key].customerName && custName) {
        groups[key].customerName = custName;
      }
      groups[key].items.push(order);
    });

    // Sort by oldest first
    return Object.values(groups).sort((a: any, b: any) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [orders]);

  // Group recently ready orders for Undo tab
  const historyTickets = useMemo(() => {
    const readyOrders = orders.filter(o => o.status === 'ready');
    const groups: Record<string, any> = {};

    readyOrders.forEach((order: any) => {
      const key = order.batchId || order.timestamp;
      const custName = order.customerName || order.clientName || order.customer || order.accountName || null;
      if (!groups[key]) {
        groups[key] = {
          id: key,
          tableName: order.tableName || 'Desconocido',
          timestamp: order.timestamp,
          readyAt: order.readyAt,
          isDelivery: order.isDelivery,
          customerName: custName,
          items: []
        };
      } else if (!groups[key].customerName && custName) {
        groups[key].customerName = custName;
      }
      groups[key].items.push(order);
    });

    // Sort by newest ready first
    return Object.values(groups).sort((a: any, b: any) => 
      new Date(b.readyAt || b.timestamp).getTime() - new Date(a.readyAt || a.timestamp).getTime()
    ).slice(0, 15); // limit to 15 recent
  }, [orders]);

  // Toggle item item checkoff
  const toggleCheckItem = (itemId: string) => {
    setCheckedItemIds(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  // Audio & Auto-Print trigger on new pending order
  useEffect(() => {
    const currentPendingCount = orders.filter(o => o.status === 'pending').length;
    if (currentPendingCount > prevOrdersLength && prevOrdersLength !== 0) {
      playNotificationSound();
      if (autoPrintEnabled && groupedTickets.length > 0) {
        // Auto select newest ticket for print
        const newestTicket = groupedTickets[groupedTickets.length - 1];
        if (newestTicket) {
          setSelectedTicketForPrint(newestTicket);
        }
      }
    }
    setPrevOrdersLength(currentPendingCount);
  }, [orders.length]);

  const toggleAutoPrint = () => {
    const newValue = !autoPrintEnabled;
    setAutoPrintEnabled(newValue);
    localStorage.setItem('kds_auto_print_enabled', String(newValue));
  };

  // Direct 1-Click completion
  const markTicketReady = async (ticket: any) => {
    try {
      const promises = ticket.items.map(async (item: any) => {
        const orderRef = doc(db, item.path);
        await updateDoc(orderRef, { status: 'ready', readyAt: new Date().toISOString() });
        await inventoryService.deductIngredients(item.menuItemId, item.quantity, item.excludedIngredientIds || []);
      });
      await Promise.all(promises);

      // Log activity to trigger waiter real-time notifications
      const itemSummary = ticket.items.map((i: any) => `${i.quantity}x ${i.itemName}`).join(', ');
      await addDoc(collection(db, 'activity_logs'), {
        type: 'order',
        actorName: currentUser?.name || 'Cocina',
        actorRole: 'Cocinero',
        action: 'Platillo Listo para Servir 🔔',
        details: `${ticket.tableName}: ${itemSummary}`,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Undo ready ticket (Return back to pending)
  const undoTicketReady = async (ticket: any) => {
    try {
      const promises = ticket.items.map(async (item: any) => {
        const orderRef = doc(db, item.path);
        await updateDoc(orderRef, { status: 'pending' });
      });
      await Promise.all(promises);
    } catch (err) {
      console.error(err);
    }
  };

  const triggerDirectPrint = () => {
    window.print();
  };

  // Helper to calculate elapsed minutes
  const getElapsedMinutes = (timestamp: string) => {
    const mins = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
    return Math.max(0, mins);
  };

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto w-full pb-16 px-4 sm:px-6">
      
      {/* SECTION HEADER */}
      <header className="mb-6 border-b border-slate-200/60 pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:pr-40">
        <div>
          <span className="text-[10px] uppercase font-black tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 inline-block mb-1.5">
            Módulo Operativo de Cocina & Bar
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            Pantalla de Cocina (KDS)
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Chef de Guardia: <strong className="text-emerald-600 font-extrabold">{currentUser?.name || 'Cocinero'}</strong>
          </p>
        </div>

        {/* Controls: AutoPrint + Tabs */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {/* Tabs */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'pending'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Pendientes</span>
              {groupedTickets.length > 0 && (
                <span className="bg-amber-500 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full">
                  {groupedTickets.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <RotateCcw size={13} />
              <span>Historial (Deshacer)</span>
            </button>
          </div>

          <button
            onClick={toggleAutoPrint}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all border cursor-pointer ${
              autoPrintEnabled 
                ? 'bg-amber-500 text-white border-amber-600 shadow-sm' 
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="Auto-imprimir ticket al recibir nuevo pedido en cocina"
          >
            <Printer size={14} className={autoPrintEnabled ? 'animate-bounce' : ''} />
            <span className="hidden sm:inline">Auto-Impresión:</span>
            <strong>{autoPrintEnabled ? 'ON' : 'OFF'}</strong>
          </button>
        </div>
      </header>

      {/* PENDING ORDERS TAB */}
      {activeTab === 'pending' && (
        <div className="flex-1 overflow-auto pb-6">
          {groupedTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-white rounded-3xl border border-slate-200/80 shadow-sm p-8 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mb-3">
                <CheckCircle2 size={36} />
              </div>
              <p className="font-bold text-lg text-slate-800">No hay pedidos pendientes</p>
              <p className="text-sm text-slate-500 mt-1">La cocina está al día. Las nuevas comandas aparecerán aquí en tiempo real.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {groupedTickets.map((ticket: any) => {
                const elapsedMins = getElapsedMinutes(ticket.timestamp);
                const warningMins = settings?.kdsWarningMinutes ?? 8;
                const criticalMins = settings?.kdsCriticalMinutes ?? 15;
                const isCritical = elapsedMins >= criticalMins;
                const isWarning = elapsedMins >= warningMins && elapsedMins < criticalMins;

                const criticalClass = settings?.kdsCriticalColor === 'red' 
                  ? 'border-red-600 ring-2 ring-red-600/40 shadow-red-500/20' 
                  : settings?.kdsCriticalColor === 'purple'
                  ? 'border-purple-600 ring-2 ring-purple-600/40 shadow-purple-500/20'
                  : 'border-rose-500 ring-2 ring-rose-500/30 shadow-rose-500/20';

                const warningClass = settings?.kdsWarningColor === 'yellow'
                  ? 'border-yellow-400 ring-2 ring-yellow-400/30'
                  : settings?.kdsWarningColor === 'orange'
                  ? 'border-orange-500 ring-2 ring-orange-500/30'
                  : 'border-amber-400 ring-1 ring-amber-400/20';

                return (
                  <motion.div
                    layout
                    key={ticket.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`bg-white rounded-[24px] border shadow-sm overflow-hidden flex flex-col transition-all ${
                      isCritical 
                        ? criticalClass
                        : isWarning 
                          ? warningClass 
                          : 'border-emerald-300'
                    }`}
                  >
                    {/* Ticket Header */}
                    <div className={`p-4 text-white flex justify-between items-start ${
                      isCritical ? 'bg-rose-950' : isWarning ? 'bg-amber-950' : 'bg-slate-900'
                    }`}>
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[10px] uppercase font-black tracking-wider text-amber-400 block">
                            {ticket.isDelivery ? '📦 Delivery' : '🍽️ Comanda Mesa'}
                          </span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1.5 ${
                            isCritical 
                              ? 'bg-rose-600 text-white animate-pulse' 
                              : isWarning 
                                ? 'bg-amber-500 text-slate-950 font-extrabold' 
                                : 'bg-emerald-500 text-white'
                          }`}>
                            <Clock size={11} /> 
                            <span>{elapsedMins} min</span>
                            <span className="text-[9px] opacity-90 border-l border-white/20 pl-1">
                              {isCritical ? '🚨 CRÍTICO (>15m)' : isWarning ? '🟡 ALERTA (8-15m)' : '🟢 OK (<8m)'}
                            </span>
                          </span>
                        </div>
                        <h3 className="font-black text-xl text-white leading-tight">
                          {ticket.tableName}
                        </h3>
                        <div className="text-[10px] text-slate-300 font-mono mt-1 flex items-center gap-2">
                          <span>
                            {new Date(ticket.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {ticket.items?.[0]?.waiterName && (
                            <span className="text-indigo-300 font-bold uppercase tracking-wider">
                              • 👤 {ticket.items[0].waiterName}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Print Sticker Button */}
                      <button
                        onClick={() => setSelectedTicketForPrint(ticket)}
                        className="bg-white/10 hover:bg-white/20 text-white font-bold text-[11px] px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border border-white/10 shrink-0"
                        title="Imprimir sticker/ticket para empaque o cocina"
                      >
                        <Printer size={13} className="text-amber-400" />
                        <span>Sticker</span>
                      </button>
                    </div>

                    {/* Optional Customer Info */}
                    {ticket.customerName && (
                      <div className="bg-amber-50 border-b border-amber-200/80 px-4 py-2 text-xs font-bold text-amber-900 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 truncate">
                          <span className="text-amber-700 font-extrabold shrink-0">👤 Cliente:</span>
                          <span className="truncate">{ticket.customerName}</span>
                        </span>
                        <Tag size={12} className="text-amber-600 shrink-0" />
                      </div>
                    )}

                    {/* Interactive Items List (Tap to Checkoff & Course Firing) */}
                    <div className="p-4 flex-1 space-y-2.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Toca un plato para tacharlo al prepararlo:
                      </p>
                      {ticket.items.map((item: any) => {
                        const isChecked = checkedItemIds[item.id];
                        const notesAndExclusions = getItemNotesAndExclusions(item, ingredients);
                        const isHold = item.courseStatus === 'hold';

                        const menuItem = menu?.find((m: any) => m.id === item.menuItemId || m.name === item.itemName);
                        const prepTime = menuItem?.preparationTime;
                        const itemElapsed = getElapsedMinutes(item.timestamp || ticket.timestamp);
                        const isDelayed = prepTime && itemElapsed > prepTime;

                        const courseLabel = item.course === 'starter' ? '🥗 Entrada' :
                                           item.course === 'main' ? '🥩 Plato Fuerte' :
                                           item.course === 'dessert' ? '🍰 Postre' :
                                           item.course === 'beverage' ? '🍹 Bebida' : null;

                        return (
                          <div 
                            key={item.id} 
                            className={`flex flex-col text-sm border p-2.5 rounded-xl transition-all select-none ${
                              isChecked 
                                ? 'bg-slate-100 border-slate-200 opacity-50 line-through' 
                                : isHold
                                  ? 'bg-amber-50/60 border-amber-200'
                                  : isDelayed
                                    ? 'bg-rose-50 border-rose-300 ring-1 ring-rose-300/40'
                                    : 'bg-slate-50/50 border-slate-100 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex justify-between items-start cursor-pointer" onClick={() => toggleCheckItem(item.id)}>
                              <div className="font-medium flex-1 mr-2">
                                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                  <span className={`font-extrabold px-2 py-0.5 rounded-md border text-xs ${
                                    isChecked ? 'bg-slate-200 text-slate-500 border-slate-300' : 'bg-slate-200 text-slate-900 border-slate-300'
                                  }`}>{item.quantity}x</span>

                                  {/* Course Tag */}
                                  {courseLabel && (
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-900 border border-indigo-200">
                                      {courseLabel}
                                    </span>
                                  )}

                                  {/* Seat Tag */}
                                  {item.seatNumber && (
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                                      💺 Asiento {item.seatNumber}
                                    </span>
                                  )}

                                  {/* Hold Tag */}
                                  {isHold && (
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 uppercase animate-pulse">
                                      ⏸️ EN ESPERA
                                    </span>
                                  )}

                                  {/* Prep Time Tag */}
                                  {prepTime ? (
                                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border flex items-center gap-0.5 ${
                                      isChecked 
                                        ? 'bg-slate-100 text-slate-400 border-slate-200' 
                                        : isDelayed
                                          ? 'bg-rose-100 text-rose-700 border-rose-300'
                                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    }`}>
                                      ⏱️ {prepTime}m
                                    </span>
                                  ) : null}

                                  {/* Overdue/Delay Warning */}
                                  {!isChecked && isDelayed && (
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-600 text-white uppercase animate-pulse flex items-center gap-1">
                                      ⚠️ Retrasado (+{itemElapsed - prepTime}m)
                                    </span>
                                  )}
                                </div>

                                <span className={isChecked ? 'text-slate-500' : 'text-slate-900 font-bold'}>{item.itemName}</span>
                                
                                {/* Notes & Excluded Ingredients */}
                                {notesAndExclusions.length > 0 && (
                                  <div className="text-xs text-amber-900 font-bold bg-amber-50/90 border border-amber-200/80 rounded-lg p-1.5 mt-1.5 no-underline space-y-0.5">
                                    {notesAndExclusions.map((detail, dIdx) => (
                                      <div key={dIdx} className="flex items-start gap-1">
                                        <span className="shrink-0 text-amber-600">⚠️</span>
                                        <span>{detail}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 border ${
                                isChecked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                              }`}>
                                {isChecked && <Check size={12} />}
                              </div>
                            </div>

                            {/* Fire Course Button if in Hold */}
                            {isHold && (
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    if (item.path) {
                                      await updateDoc(doc(db, item.path), { courseStatus: 'fired' });
                                    }
                                  } catch (err) {
                                    console.error('Error firing course:', err);
                                  }
                                }}
                                className="mt-2 text-xs font-black bg-amber-500 hover:bg-amber-600 text-slate-950 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 border border-amber-600 transition-all cursor-pointer shadow-sm"
                              >
                                <span>🔥 MARCHAR ESTE PLATO AHORA</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Action Button: 1-CLICK DIRECT COMPLETION */}
                    <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                      <button
                        onClick={() => setSelectedTicketForPrint(ticket)}
                        className="p-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl transition-all cursor-pointer"
                        title="Imprimir sticker de sticker"
                      >
                        <Printer size={16} />
                      </button>
                      
                      <button
                        onClick={() => markTicketReady(ticket)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 cursor-pointer"
                      >
                        <CheckCircle2 size={18} />
                        <span>¡LISTO PARA SERVIR! 🍳</span>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* RECENT HISTORY & UNDO TAB */}
      {activeTab === 'history' && (
        <div className="flex-1 overflow-auto pb-6">
          {historyTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-white rounded-3xl border border-slate-200/80 shadow-sm p-8 text-center">
              <RotateCcw size={36} className="text-slate-300 mb-3" />
              <p className="font-bold text-lg text-slate-800">No hay comandas completadas recientemente</p>
              <p className="text-sm text-slate-500 mt-1">Aquí podrás deshacer un pedido si lo completas por error.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {historyTickets.map((ticket: any) => (
                <div key={ticket.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-black text-lg text-slate-900">{ticket.tableName}</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check size={11} /> Despachado
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 mb-3">
                      Listo a las: {new Date(ticket.readyAt || ticket.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>

                    <div className="space-y-1.5 border-t border-slate-100 pt-3 mb-4">
                      {ticket.items.map((i: any, idx: number) => (
                        <div key={idx} className="text-xs font-bold text-slate-700 flex justify-between">
                          <span>{i.quantity}x {i.itemName}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => undoTicketReady(ticket)}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer border border-slate-200"
                  >
                    <Undo2 size={14} className="text-amber-600" />
                    <span>Deshacer y Volver a Cocina</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PRINT STICKER MODAL */}
      <AnimatePresence>
        {selectedTicketForPrint && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-5 bg-slate-900 text-white flex justify-between items-center print:hidden">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-400">
                    <Printer size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight">Impresora de Stickers de Cocina</h3>
                    <p className="text-xs text-slate-400">Formato térmico para empaques, vasos y platos</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTicketForPrint(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <XCircle size={20} />
                </button>
              </div>

              {/* Print Format Selector */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex gap-2 print:hidden">
                <button
                  onClick={() => setPrintMode('comanda')}
                  className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    printMode === 'comanda'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <FileText size={14} /> Ticket Comanda General
                </button>
                <button
                  onClick={() => setPrintMode('individual_stickers')}
                  className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    printMode === 'individual_stickers'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Tag size={14} /> Stickers Individuales por Ítem
                </button>
              </div>

              {/* Printable Ticket Area */}
              <div className="p-6 overflow-y-auto flex-1 bg-slate-100 flex justify-center">
                <div id="kitchen-sticker-printable" className="bg-white p-5 border border-dashed border-slate-300 w-[280px] font-mono text-slate-900 text-xs shadow-md rounded-lg">
                  
                  {printMode === 'comanda' ? (
                    // MODE A: Full Order Comanda
                    <div>
                      <div className="text-center pb-3 border-b-2 border-black mb-3">
                        <div className="font-black text-base uppercase tracking-widest">*** COCINA / COMANDA ***</div>
                        <div className="font-bold text-sm mt-1 bg-black text-white py-1 px-2 inline-block rounded">
                          {selectedTicketForPrint.tableName}
                        </div>
                        <div className="text-[10px] mt-1 text-slate-700">
                          Hora: {new Date(selectedTicketForPrint.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        
                        {/* Cliente Name display */}
                        {(selectedTicketForPrint.customerName || selectedTicketForPrint.items?.find((i: any) => i.customerName || i.clientName)) && (
                          <div className="text-xs font-black mt-1.5 bg-black text-white py-0.5 px-2 rounded inline-block">
                            👤 CLIENTE: {selectedTicketForPrint.customerName || selectedTicketForPrint.items?.find((i: any) => i.customerName || i.clientName)?.customerName || selectedTicketForPrint.items?.find((i: any) => i.customerName || i.clientName)?.clientName}
                          </div>
                        )}

                        {selectedTicketForPrint.items?.[0]?.waiterName && (
                          <div className="text-[10px] text-slate-600 font-bold mt-1">
                            Mesero: {selectedTicketForPrint.items[0].waiterName}
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 my-3">
                        {selectedTicketForPrint.items.map((item: any, idx: number) => {
                          const notesAndExclusions = getItemNotesAndExclusions(item, ingredients);
                          return (
                            <div key={idx} className="border-b border-slate-200 pb-2 last:border-0">
                              <div className="font-black text-sm flex justify-between">
                                <span>{item.quantity}x {item.itemName}</span>
                              </div>
                              {notesAndExclusions.length > 0 && (
                                <div className="text-[11px] font-black text-black bg-slate-200 p-1.5 rounded mt-1 border border-black/20 space-y-0.5 text-left">
                                  {notesAndExclusions.map((detail, dIdx) => (
                                    <div key={dIdx}>⚠️ {detail}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="text-center pt-3 border-t-2 border-black text-[10px] font-bold uppercase tracking-wider">
                        --- FIN DE COMANDA ---
                      </div>
                    </div>
                  ) : (
                    // MODE B: Individual Stickers (One per item)
                    <div className="space-y-6">
                      {selectedTicketForPrint.items.map((item: any, itemIdx: number) => {
                        const notesAndExclusions = getItemNotesAndExclusions(item, ingredients);
                        const custName = selectedTicketForPrint.customerName || item.customerName || item.clientName;

                        return (
                          <div key={itemIdx} className="bg-white border-2 border-black p-3 text-center rounded">
                            <div className="font-black text-[10px] uppercase border-b border-black pb-1 mb-1">
                              STICKER DE EMPAQUE / COCINA
                            </div>
                            <div className="font-black text-base uppercase bg-black text-white py-0.5 px-1 rounded mb-1">
                              {selectedTicketForPrint.tableName}
                            </div>
                            {custName && (
                              <div className="font-black text-xs bg-slate-100 p-1 rounded border border-black mb-1">
                                👤 Para: {custName}
                              </div>
                            )}
                            <div className="font-black text-sm my-2 text-slate-900 border-y border-dashed border-slate-400 py-1">
                              {item.quantity}x {item.itemName}
                            </div>
                            {notesAndExclusions.length > 0 && (
                              <div className="font-black text-xs bg-slate-200 p-1.5 rounded text-black border border-black mb-1 space-y-0.5 text-left font-bold">
                                {notesAndExclusions.map((detail, dIdx) => (
                                  <div key={dIdx}>⚠️ {detail}</div>
                                ))}
                              </div>
                            )}
                            <div className="text-[9px] text-slate-500 font-mono mt-1">
                              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
              </div>

              {/* Modal Footer Controls */}
              <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3 print:hidden">
                <button
                  onClick={() => setSelectedTicketForPrint(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cerrar
                </button>

                <button
                  onClick={triggerDirectPrint}
                  className="px-6 py-2.5 bg-black hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  <Printer size={16} />
                  <span>Imprimir Sticker Ahora</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Embedded CSS for Thermal Printer standard layout (@media print) */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #kitchen-sticker-printable, #kitchen-sticker-printable * {
            visibility: visible;
          }
          #kitchen-sticker-printable {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 80mm !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>

    </div>
  );
}

