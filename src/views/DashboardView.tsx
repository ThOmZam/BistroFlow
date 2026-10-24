import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, getDocs, doc, updateDoc, collectionGroup } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useRestaurantData } from '../hooks/useRestaurantData';
import { useCurrency } from '../context/CurrencyContext';
import { 
  DollarSign, 
  Users, 
  Flame, 
  AlertCircle, 
  CheckCircle2, 
  TrendingUp, 
  Smartphone, 
  Clock, 
  ShoppingBag, 
  Receipt,
  X,
  Bell,
  ArrowRight,
  Sparkles,
  Info,
  ChefHat,
  Coins
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableItem({ id, isEditingLayout, children, className }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id, disabled: !isEditingLayout });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={className} {...(isEditingLayout ? attributes : {})} {...(isEditingLayout ? listeners : {})}>
      {children}
    </div>
  );
}

export default function DashboardView({ currentUser, onViewChange }: { currentUser: any; onViewChange: (view: string) => void }) {
  const { tables, settings } = useRestaurantData();
  const { activeCurrency, currentRateBs, formatPrice, toBolivares, formatBs } = useCurrency();
  const exchangeRate = currentRateBs || settings?.exchangeRate || 874.73;
  const [sessions, setSessions] = useState<any[]>([]);
  const [kitchenOrders, setKitchenOrders] = useState<any[]>([]);
  const [chatsCount, setChatsCount] = useState(0);

  const defaultLayout = [
    'revenue', 'tables', 'validations', 'deliveries', 
    'salon_sales', 'delivery_sales', 'pickup_sales', 'service_time',
    'alerts', 'salon', 'caja', 'cocina', 'chat'
  ];
  const [dashboardLayout, setDashboardLayout] = useState(() => {
    const saved = localStorage.getItem('bistro_dashboard_layout_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return defaultLayout;
  });

  useEffect(() => {
    localStorage.setItem('bistro_dashboard_layout_v2', JSON.stringify(dashboardLayout));
  }, [dashboardLayout]);

  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [showWidgetSettings, setShowWidgetSettings] = useState(false);

  const WIDGET_CONFIGS: Record<string, { label: string; span: string }> = {
    revenue: { label: 'Venta Acumulada', span: 'col-span-1 md:col-span-6 lg:col-span-3' },
    tables: { label: 'Mesas Ocupadas', span: 'col-span-1 md:col-span-6 lg:col-span-3' },
    validations: { label: 'Caja por Validar', span: 'col-span-1 md:col-span-6 lg:col-span-3' },
    deliveries: { label: 'Envíos en Curso', span: 'col-span-1 md:col-span-6 lg:col-span-3' },
    salon_sales: { label: 'Ventas Salón', span: 'col-span-1 md:col-span-6 lg:col-span-3' },
    delivery_sales: { label: 'Ventas Delivery', span: 'col-span-1 md:col-span-6 lg:col-span-3' },
    pickup_sales: { label: 'Ventas Pickup', span: 'col-span-1 md:col-span-6 lg:col-span-3' },
    service_time: { label: 'Prom. Ciclo Servicio', span: 'col-span-1 md:col-span-6 lg:col-span-3' },
    alerts: { label: 'Alertas', span: 'col-span-2 md:col-span-12 lg:col-span-8' },
    salon: { label: 'Estado Salón', span: 'col-span-2 md:col-span-12 lg:col-span-4' },
    caja: { label: 'Estado Caja', span: 'col-span-2 md:col-span-12 lg:col-span-4' },
    cocina: { label: 'Estado Cocina', span: 'col-span-2 md:col-span-12 lg:col-span-4' },
    chat: { label: 'Chat Interno', span: 'col-span-2 md:col-span-12 lg:col-span-4' }
  };


  const [isLoading, setIsLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: any) {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setDashboardLayout((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  const toggleWidget = (widgetId: string) => {
    setDashboardLayout(prev => {
      if (prev.includes(widgetId)) {
        return prev.filter(id => id !== widgetId);
      } else {
        return [...prev, widgetId];
      }
    });
  };


  // Load live active sessions & kitchen orders
  useEffect(() => {
    const unsubSessions = onSnapshot(collection(db, 'sessions'), (snap) => {
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    });

    const unsubChats = onSnapshot(collection(db, 'chats'), (snap) => {
      setChatsCount(snap.size);
    });

    // Listen to pending kitchen orders
    const qKitchen = query(
      collectionGroup(db, 'orders'),
      where('status', '==', 'pending')
    );
    const unsubKitchen = onSnapshot(qKitchen, (snap) => {
      setKitchenOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error('Error listening to kitchen orders in Dashboard:', err);
    });

    return () => {
      unsubSessions();
      unsubChats();
      unsubKitchen();
    };
  }, []);

  // Compute live states
  const activeSessions = useMemo(() => sessions.filter(s => s.status === 'active'), [sessions]);
  const completedSessions = useMemo(() => sessions.filter(s => s.status === 'completed' || s.paymentStatus === 'validated'), [sessions]);

  // Analytics Metrics
  const {
    deliverySalesUSD,
    pickupSalesUSD,
    dineInSalesUSD,
    deliveryCount,
    pickupCount,
    dineInCount,
    avgServiceTimeMinutes
  } = useMemo(() => {
    let deliverySalesUSD = 0;
    let pickupSalesUSD = 0;
    let dineInSalesUSD = 0;
    let deliveryCount = 0;
    let pickupCount = 0;
    let dineInCount = 0;

    let totalServiceTime = 0;
    let serviceTimeCount = 0;

    completedSessions.forEach(s => {
      const isCredit = s.payment?.method === 'credito' || s.paymentMethod === 'credito';
      const amount = isCredit ? 0 : (s.totalAmount || 0);

      const isDeliveryType = s.type === 'delivery' || (s.tableId && String(s.tableId).startsWith('delivery'));
      const isPickup = s.deliveryType === 'pickup';

      if (isDeliveryType && !isPickup) {
        deliverySalesUSD += amount;
        deliveryCount++;
      } else if (isDeliveryType && isPickup) {
        pickupSalesUSD += amount;
        pickupCount++;
      } else {
        dineInSalesUSD += amount;
        dineInCount++;
      }

      const start = s.startTime ? new Date(s.startTime).getTime() : null;
      const end = s.payment?.timestamp ? new Date(s.payment.timestamp).getTime() : null;
      if (start && end && end > start) {
        totalServiceTime += (end - start);
        serviceTimeCount++;
      }
    });

    return {
      deliverySalesUSD,
      pickupSalesUSD,
      dineInSalesUSD,
      deliveryCount,
      pickupCount,
      dineInCount,
      avgServiceTimeMinutes: serviceTimeCount > 0 ? Math.round((totalServiceTime / serviceTimeCount) / 1000 / 60) : 0
    };
  }, [completedSessions]);

  // Earnings calculation
  const salesUSD = useMemo(() => {
    return completedSessions.reduce((sum, s) => {
      const isCredit = s.payment?.method === 'credito' || s.paymentMethod === 'credito';
      if (isCredit) return sum;
      return sum + (s.totalAmount || 0);
    }, 0);
  }, [completedSessions]);
  const salesBs = salesUSD * exchangeRate;

  // Active Tables States
  const occupiedTables = tables.filter(t => t.status === 'occupied').length;
  const waitingBillTables = tables.filter(t => t.status === 'waiting_bill').length;
  const freeTables = tables.length - occupiedTables - waitingBillTables;

  // Cashier Validation Alerts
  const pendingValidations = useMemo(() => {
    return activeSessions.filter(s => s.paymentStatus === 'pending_validation' || s.paymentStatus === 'pending_credit_approval');
  }, [activeSessions]);

  // Delivery Active Orders
  const activeDeliveries = useMemo(() => {
    return activeSessions.filter(s => s.type === 'delivery' || s.tableId?.startsWith('delivery-'));
  }, [activeSessions]);

  // Alerts List builder
  const alerts = useMemo(() => {
    const list: { id: string; type: 'warning' | 'info' | 'success' | 'alert'; message: string; time: string; link: string }[] = [];

    // Table waiting bill
    tables.forEach(t => {
      if (t.status === 'waiting_bill') {
        list.push({
          id: `table-bill-${t.id}`,
          type: 'warning',
          message: `Mesa ${t.number} solicita la cuenta total.`,
          time: 'Hace un momento',
          link: 'waiter'
        });
      }
    });

    // Pending payment validation
    pendingValidations.forEach(pv => {
      const isCredit = pv.paymentStatus === 'pending_credit_approval';
      list.push({
        id: `pay-val-${pv.id}`,
        type: 'alert',
        message: `${pv.customerName || 'Cliente'}: Pago de $${(pv.totalAmount || 0).toFixed(2)} por ${isCredit ? 'Crédito' : pv.paymentMethod || 'Pago Móvil'} en espera de validación.`,
        time: 'Requiere Caja',
        link: 'caja'
      });
    });

    // Active deliveries waiting confirmation/food
    activeDeliveries.forEach(ad => {
      if (ad.paymentStatus !== 'validated') {
        list.push({
          id: `deliv-pay-${ad.id}`,
          type: 'info',
          message: `Pedido Delivery #${ad.orderNumber || ad.id.substring(0, 4)} (${ad.customerName}) requiere validación de pago.`,
          time: 'Pendiente',
          link: 'caja'
        });
      }
    });

    return list;
  }, [tables, pendingValidations, activeDeliveries]);

  // Group kitchen orders by batch/timestamp for KDS preview
  const groupedTickets = useMemo(() => {
    const groups: Record<string, any> = {};

    kitchenOrders.forEach((order: any) => {
      const key = order.batchId || order.timestamp; // Group key
      if (!groups[key]) {
        groups[key] = {
          id: key,
          tableName: order.tableName || 'Desconocido',
          timestamp: order.timestamp,
          isDelivery: order.isDelivery,
          customerName: order.customerName,
          items: []
        };
      }
      groups[key].items.push(order);
    });

    // Sort by oldest first
    return Object.values(groups).sort((a: any, b: any) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [kitchenOrders]);

  // Cash desk total today (Validated Sessions Total)
  const totalReconciled = useMemo(() => {
    return completedSessions.reduce((acc, s) => {
      const isCredit = s.payment?.method === 'credito' || s.paymentMethod === 'credito';
      if (isCredit) return acc;
      return acc + (s.totalAmount || s.pendingPayment?.totalUSD || 0);
    }, 0);
  }, [completedSessions]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-40">
        <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 1. Waiter (Mesero) Dashboard

  const dashboardMetrics = {
    totalSales: salesUSD || 0,
    activeTables: occupiedTables || 0,
    validationsPending: pendingValidations.length || 0,
    activeDeliveries: activeDeliveries.length || 0,
    salonCount: dineInCount || 0,
    pickupCount: pickupCount || 0,
    deliveryCount: deliveryCount || 0,
  };

  const salesByChannel = {
    salon: dineInSalesUSD || 0,
    pickup: pickupSalesUSD || 0,
    delivery: deliverySalesUSD || 0,
  };

  const avgServiceTime = avgServiceTimeMinutes || 0;
  
  // mockAlerts maps from the 'alerts' array which has { id, type, message, time, link }
  const mockAlerts = (alerts || []).map(a => ({
    id: a.id,
    type: a.type === 'alert' ? 'critical' : a.type,
    title: a.message,
    desc: 'Atención requerida',
    time: a.time
  }));

  if (currentUser.role === 'waiter') {
    return (
      <div className="w-full flex-1 flex flex-col pb-16 min-h-full">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-indigo-600 text-white text-[10px] font-black tracking-widest px-2.5 py-1 rounded-full uppercase">
              Servicio / Mesero
            </span>
            <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs text-slate-400 font-mono">Conectado</span>
          </div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            ¡Hola, {currentUser.name}! 👋
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Gestiona tus mesas, atiende comandas y mantén informada a la cocina.
          </p>
        </header>

        {/* Waiter KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
              <Users size={24} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-black text-slate-400 block">Mesas Ocupadas</span>
              <div className="text-2xl font-black text-slate-900">{occupiedTables} / {tables.length}</div>
            </div>
          </div>

          <div className={`p-6 rounded-[28px] border transition-colors flex items-center gap-4 ${
            waitingBillTables > 0 ? 'bg-amber-50/50 border-amber-200 text-amber-900' : 'bg-white border-slate-100 shadow-sm'
          }`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              waitingBillTables > 0 ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-slate-50 text-slate-400'
            }`}>
              <Receipt size={24} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-black text-slate-400 block">Pidiendo Cuenta</span>
              <div className="text-2xl font-black">{waitingBillTables} mesas</div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
              <Clock size={24} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-black text-slate-400 block">Mesas Libres</span>
              <div className="text-2xl font-black text-slate-900">{freeTables}</div>
            </div>
          </div>
        </div>

        {/* Main Content Layout for Waiter */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Floor Status */}
          <div className="lg:col-span-2 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-base text-slate-900">Mapa Rápido de Salón</h3>
              <button 
                onClick={() => onViewChange('waiter')}
                className="text-xs font-bold text-indigo-600 hover:underline"
              >
                Ver Salón
              </button>
            </div>
            
            <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
              {tables.map(table => {
                const isOccupied = table.status === 'occupied';
                const isWaitingBill = table.status === 'waiting_bill';
                return (
                  <div 
                    key={table.id}
                    onClick={() => onViewChange('waiter')}
                    className={`aspect-square rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105 border ${
                      isWaitingBill 
                        ? 'bg-amber-100 border-amber-300 text-amber-800 font-bold animate-pulse shadow-sm' 
                        : isOccupied 
                        ? 'bg-indigo-50 border-indigo-100 text-indigo-800 font-semibold' 
                        : 'bg-slate-50 border-slate-100 text-slate-400'
                    }`}
                  >
                    <span className="text-xs font-black">M-{table.number}</span>
                    <span className="text-[8px] font-bold mt-1 opacity-75">
                      {isWaitingBill ? 'Pide Cuenta' : isOccupied ? 'Ocupada' : 'Libre'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Service Actions & Alerts */}
          <div className="space-y-6">
            <div className="bg-slate-900 text-white p-6 rounded-[32px] flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-extrabold block mb-2">Comandos Rápidos</span>
                <h4 className="text-base font-black mb-2">Atención de Clientes</h4>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Abre el panel de salón para tomar pedidos, modificar comensales, imprimir comandas o solicitar la cuenta a la caja.
                </p>
              </div>
              <button 
                onClick={() => onViewChange('waiter')}
                className="w-full bg-white hover:bg-slate-100 text-black p-3.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 mt-6"
              >
                Abrir Salón y Mesas <ArrowRight size={14} />
              </button>
            </div>

            {/* Notifications specifically for waiters */}
            <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100">
              <h4 className="font-extrabold text-sm text-slate-900 mb-3 flex items-center gap-1.5">
                <Bell size={16} className="text-indigo-600" />
                Alertas de Salón
              </h4>
              <div className="space-y-3">
                {tables.filter(t => t.status === 'waiting_bill').map(t => (
                  <div key={t.id} className="bg-white p-3 rounded-xl border border-amber-100 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-black text-amber-800">Mesa {t.number}</span>
                      <p className="text-[10px] text-slate-500 mt-0.5">Pidiendo la cuenta total.</p>
                    </div>
                    <button 
                      onClick={() => onViewChange('waiter')}
                      className="bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded-lg text-[9px] uppercase tracking-wider"
                    >
                      Ir
                    </button>
                  </div>
                ))}
                {tables.filter(t => t.status === 'waiting_bill').length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">No hay solicitudes de cuentas activas.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Kitchen / Cook (Cocina) Dashboard
  if (currentUser.role === 'cook') {
    return (
      <div className="w-full flex-1 flex flex-col pb-16 min-h-full">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-amber-600 text-white text-[10px] font-black tracking-widest px-2.5 py-1 rounded-full uppercase flex items-center gap-1">
              <Flame size={10} /> Cocina / KDS
            </span>
            <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs text-slate-400 font-mono">Fuegos Activos</span>
          </div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            ¡Hola, Chef {currentUser.name}! 🍳
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Revisa las comandas pendientes de preparación y mantén el ritmo de salida del menú.
          </p>
        </header>

        {/* Cook KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
              <ChefHat size={24} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-black text-slate-400 block">Comandas Pendientes</span>
              <div className="text-2xl font-black text-slate-900">{groupedTickets.length} comandas</div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shrink-0">
              <Flame size={24} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-black text-slate-400 block">Platos por Preparar</span>
              <div className="text-2xl font-black text-slate-900">{kitchenOrders.length} platos</div>
            </div>
          </div>
        </div>

        {/* Main Content Layout for Kitchen */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Active Tickets Queue Preview */}
          <div className="lg:col-span-2 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <ChefHat size={18} /> Cola de Comandas (Viejo a Nuevo)
              </h3>
              <button 
                onClick={() => onViewChange('kitchen')}
                className="text-xs font-bold text-amber-600 hover:underline"
              >
                Pantalla KDS Completa
              </button>
            </div>

            <div className="space-y-4">
              {groupedTickets.slice(0, 3).map((ticket: any) => (
                <div key={ticket.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-2">
                    <span className="font-black text-sm text-slate-800">{ticket.tableName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(ticket.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {ticket.items.map((item: any, idx: number) => (
                      <div key={idx} className="text-xs font-semibold text-slate-700 flex justify-between">
                        <span>{item.quantity}x {item.itemName}</span>
                        {item.note && <span className="text-amber-600 italic">"{item.note}"</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {groupedTickets.length === 0 && (
                <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                  <span className="font-bold text-xs text-slate-700">¡Fuegos despejados!</span>
                  <p className="text-[10px] mt-0.5 text-slate-400">No hay pedidos pendientes en la cola de cocina.</p>
                </div>
              )}

              {groupedTickets.length > 3 && (
                <button 
                  onClick={() => onViewChange('kitchen')}
                  className="w-full text-center text-xs font-bold text-indigo-500 hover:underline pt-2"
                >
                  Y {groupedTickets.length - 3} comanda(s) más. Ver todo...
                </button>
              )}
            </div>
          </div>

          {/* Kitchen Action Card & Reminders */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-amber-600 to-rose-600 text-white p-6 rounded-[32px] shadow-lg shadow-amber-500/10 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-amber-200 font-extrabold block mb-2">Control de Despacho</span>
                <h4 className="text-base font-black mb-2">Pantalla de Cocina (KDS)</h4>
                <p className="text-white/90 text-xs leading-relaxed">
                  Marca las comandas listas para que los meseros retiren los platos de inmediato. Deduce ingredientes automáticamente.
                </p>
              </div>
              <button 
                onClick={() => onViewChange('kitchen')}
                className="w-full bg-white hover:bg-slate-100 text-slate-900 p-3.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 mt-6 shadow-md"
              >
                Abrir Pantalla KDS <ArrowRight size={14} />
              </button>
            </div>

            <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100">
              <h4 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider mb-2">Consejos del Día</h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                "La cocina excelente se define por la consistencia, el calor de los platos al salir y el trabajo en equipo con la sala."
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Caja (Caja y Facturación) Dashboard
  if (currentUser.role === 'finance') {
    return (
      <div className="w-full flex-1 flex flex-col pb-16 min-h-full">
        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-emerald-600 text-white text-[10px] font-black tracking-widest px-2.5 py-1 rounded-full uppercase">
                Caja y Facturación
              </span>
              <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs text-slate-400 font-mono">Caja Abierta</span>
            </div>
            <h2 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              ¡Hola, {currentUser.name}! 🪙
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Supervisa las validaciones de pagos, gestiona créditos de clientes y mantén el saldo al día.
            </p>
          </div>

          {/* Quick Official Exchange Rate Adjuster (ReadOnly for Cashier) */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm text-xs flex items-center gap-3">
            <span className="text-slate-500 font-medium">Oficial: <strong className="text-slate-800">1$ = {exchangeRate} Bs.</strong></span>
          </div>
        </header>

        {/* Caja KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
              <DollarSign size={24} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-black text-slate-400 block">Total en Caja (Efectivo/Val.)</span>
              <div className="text-2xl font-black text-slate-900">${totalReconciled.toFixed(2)}</div>
              <span className="text-[10px] font-mono text-slate-400">Bs. {(totalReconciled * exchangeRate).toFixed(2)}</span>
            </div>
          </div>

          <div className={`p-6 rounded-[28px] border transition-colors flex items-center gap-4 ${
            pendingValidations.length > 0 ? 'bg-rose-50/40 border-rose-200 text-rose-900' : 'bg-white border-slate-100 shadow-sm'
          }`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              pendingValidations.length > 0 ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-slate-50 text-slate-400'
            }`}>
              <Receipt size={24} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-black text-slate-400 block">Por Validar</span>
              <div className="text-2xl font-black">{pendingValidations.length} pagos</div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
              <ShoppingBag size={24} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-black text-slate-400 block">Deliveries Activos</span>
              <div className="text-2xl font-black text-slate-900">{activeDeliveries.length} pedidos</div>
            </div>
          </div>
        </div>

        {/* Main Content Layout for Caja */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Actionable Validations List */}
          <div className="lg:col-span-2 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <Receipt size={18} className="text-black" /> Validaciones de Pago Urgentes
              </h3>
              <button 
                onClick={() => onViewChange('caja')}
                className="text-xs font-bold text-indigo-600 hover:underline"
              >
                Ver Caja Completa
              </button>
            </div>

            <div className="space-y-3">
              {pendingValidations.slice(0, 4).map((pv: any) => {
                const isCredit = pv.paymentStatus === 'pending_credit_approval';
                return (
                  <div key={pv.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                    <div>
                      <span className="font-black text-xs text-slate-800">{pv.customerName || 'Cliente'}</span>
                      <div className="text-[10px] text-slate-500 font-medium mt-0.5 uppercase tracking-wider">
                        {isCredit ? 'Autorización de Crédito' : `Monto: $${(pv.totalAmount || 0).toFixed(2)} por ${pv.paymentMethod || 'Pago Móvil'}`}
                      </div>
                    </div>
                    <button 
                      onClick={() => onViewChange('caja')}
                      className="text-[10px] font-black uppercase bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-2 rounded-xl shadow-sm transition-all"
                    >
                      Validar
                    </button>
                  </div>
                );
              })}

              {pendingValidations.length === 0 && (
                <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                  <span className="font-bold text-xs text-slate-700">¡Caja totalmente al día!</span>
                  <p className="text-[10px] mt-0.5 text-slate-400">Todos los pagos han sido validados y conciliados correctamente.</p>
                </div>
              )}

              {pendingValidations.length > 4 && (
                <button 
                  onClick={() => onViewChange('caja')}
                  className="w-full text-center text-xs font-bold text-indigo-500 hover:underline pt-2"
                >
                  Y {pendingValidations.length - 4} pago(s) más. Ver todo...
                </button>
              )}
            </div>
          </div>

          {/* Quick Control Center Card */}
          <div className="space-y-6">
            <div className="bg-slate-900 text-white p-6 rounded-[32px] flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-extrabold block mb-2">Atajos de Facturación</span>
                <h4 className="text-base font-black mb-2">Panel Control de Caja</h4>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Gestiona las entregas de delivery, autoriza créditos de clientes recurrentes y valida los comprobantes recibidos por Pago Móvil o Zelle.
                </p>
              </div>
              <button 
                onClick={() => onViewChange('caja')}
                className="w-full bg-white hover:bg-slate-100 text-black p-3.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 mt-6"
              >
                Abrir Control de Caja <ArrowRight size={14} />
              </button>
            </div>

            {/* Helpful cashier reminders (Replaces Finanzas direct link) */}
            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
              <h4 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider mb-2">Recordatorios de Caja</h4>
              <ul className="text-xs text-slate-600 space-y-2 font-semibold">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500">✔</span>
                  <span>Verifica siempre la referencia del Pago Móvil en tu banco antes de validar.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500">✔</span>
                  <span>Registra los abonos a créditos en el módulo "Control de Caja".</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. Default: Admin Dashboard
  return (
    <div className="w-full flex-1 flex flex-col pb-16 min-h-full">
      {/* Dynamic Header */}
      <header className="mb-8 border-b border-slate-200/60 pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:pr-40">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-black text-white text-[10px] font-black tracking-widest px-2.5 py-1 rounded-full uppercase">
              {currentUser.role === 'admin' ? 'Administrador' : 'Panel General'}
            </span>
            <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs text-slate-400 font-mono">Live Sync</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            ¡Hola, {currentUser.name}! <Sparkles className="text-amber-500" size={24} />
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5 font-medium">
            Aquí tienes un resumen completo y en tiempo real del restaurante <strong>{settings?.restaurantName}</strong>.
          </p>
        </div>
        
        {/* Rapid rate settings & Layout edit */}
        <div className="flex items-center gap-3 flex-wrap shrink-0">
          <div className="flex gap-3 bg-white p-2.5 px-3 rounded-2xl border border-slate-200 shadow-sm items-center">
            <div className="text-xs text-slate-500">
              Tasa Oficial: <strong className="text-slate-900">1$ = {exchangeRate} Bs.</strong>
            </div>
            <button 
              onClick={() => onViewChange('analytics')}
              className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1 rounded-lg transition-colors cursor-pointer"
            >
              Ajustar
            </button>
          </div>
          <div className="relative z-10 flex items-center gap-2">
            <button
              onClick={() => setIsEditingLayout(!isEditingLayout)}
              className={`text-xs font-bold px-4 py-3 rounded-2xl border transition-all ${isEditingLayout ? 'bg-indigo-600 text-white border-indigo-700 shadow-lg shadow-indigo-200' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
            >
              {isEditingLayout ? 'Guardar Diseño' : 'Editar Dashboard'}
            </button>
            {isEditingLayout && (
              <button
                onClick={() => setShowWidgetSettings(!showWidgetSettings)}
                className="ml-2 text-xs font-bold px-4 py-3 rounded-2xl border transition-all bg-slate-800 text-white hover:bg-slate-700 shadow-lg"
              >
                Widgets
              </button>
            )}
            
            {showWidgetSettings && isEditingLayout && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 z-[100]">
                <h4 className="font-bold text-slate-900 mb-3 text-sm">Gestionar Widgets</h4>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {Object.keys(WIDGET_CONFIGS).map(id => (
                    <label key={id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={dashboardLayout.includes(id)}
                        onChange={() => toggleWidget(id)}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-slate-700">{WIDGET_CONFIGS[id].label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      
      {/* Draggable KPI Grid */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={dashboardLayout} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 md:grid-cols-12 lg:grid-cols-12 gap-3 sm:gap-4 md:gap-6 mb-8 sm:mb-10">
            {dashboardLayout.map(widgetId => {
              const config = WIDGET_CONFIGS[widgetId] || { span: 'col-span-1 md:col-span-6 lg:col-span-3' };
              
              return (
                <SortableItem 
                  key={widgetId} 
                  id={widgetId} 
                  isEditingLayout={isEditingLayout} 
                  className={`h-full relative group transition-all ${config.span} ${isEditingLayout ? 'cursor-grab active:cursor-grabbing ring-4 ring-indigo-500/20 ring-offset-4 rounded-2xl sm:rounded-[40px] z-10' : ''}`}
                >
                  {isEditingLayout && (
                    <div className="absolute inset-0 bg-indigo-50/20 backdrop-blur-[1px] border-2 border-indigo-400 border-dashed rounded-2xl sm:rounded-[32px] z-10 flex items-center justify-center cursor-grab active:cursor-grabbing pointer-events-none">
                      <span className="text-indigo-700 font-bold text-xs sm:text-sm uppercase tracking-widest bg-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-full shadow-md pointer-events-auto cursor-grab active:cursor-grabbing">Mover Panel</span>
                    </div>
                  )}

                  {widgetId === 'revenue' || widgetId === 'tables' || widgetId === 'validations' || widgetId === 'deliveries' || widgetId === 'salon_sales' || widgetId === 'delivery_sales' || widgetId === 'pickup_sales' || widgetId === 'service_time' ? (
                    <div className={`${isEditingLayout ? 'opacity-50 pointer-events-none' : ''} h-full`}>
                      {widgetId === 'revenue' && (
                        <div className="bg-white p-3.5 sm:p-5 md:p-6 rounded-2xl sm:rounded-[32px] shadow-sm border border-slate-100 flex flex-col h-full hover:shadow-md transition-shadow relative overflow-hidden group">
                          <div className="absolute -right-4 -top-4 sm:-right-6 sm:-top-6 w-16 h-16 sm:w-24 sm:h-24 bg-emerald-50 rounded-full group-hover:scale-110 transition-transform"></div>
                          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4 relative z-10">
                            <div className="p-2 sm:p-3 bg-emerald-50 text-emerald-600 rounded-xl sm:rounded-2xl shrink-0">
                              <DollarSign size={16} className="sm:w-5 sm:h-5 stroke-[2.5px]" />
                            </div>
                            <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-emerald-500 truncate">Ventas</span>
                          </div>
                          <div className="relative z-10 mt-auto">
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 sm:mb-1 block truncate">Venta Acumulada ({activeCurrency})</span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-800 tracking-tighter">{formatPrice(dashboardMetrics.totalSales)}</span>
                            </div>
                            <span className="text-[10px] sm:text-xs font-bold text-slate-400 mt-1 sm:mt-2 block truncate">{formatBs(toBolivares(dashboardMetrics.totalSales))}</span>
                          </div>
                        </div>
                      )}
                      
                      {widgetId === 'tables' && (
                        <div className="bg-white p-3.5 sm:p-5 md:p-6 rounded-2xl sm:rounded-[32px] shadow-sm border border-slate-100 flex flex-col h-full hover:shadow-md transition-shadow relative overflow-hidden group">
                          <div className="absolute -right-4 -top-4 sm:-right-6 sm:-top-6 w-16 h-16 sm:w-24 sm:h-24 bg-indigo-50 rounded-full group-hover:scale-110 transition-transform"></div>
                          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4 relative z-10">
                            <div className="p-2 sm:p-3 bg-indigo-50 text-indigo-600 rounded-xl sm:rounded-2xl shrink-0">
                              <Users size={16} className="sm:w-5 sm:h-5 stroke-[2.5px]" />
                            </div>
                            <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-indigo-500 truncate">Mesas</span>
                          </div>
                          <div className="relative z-10 mt-auto">
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 sm:mb-1 block truncate">Mesas Ocupadas</span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-800 tracking-tighter">{dashboardMetrics.activeTables}</span>
                              <span className="text-xs sm:text-sm font-bold text-slate-400">/ {tables.length}</span>
                            </div>
                            <span className="text-[10px] sm:text-xs font-bold text-slate-400 mt-1 sm:mt-2 block truncate">{Math.round((dashboardMetrics.activeTables / Math.max(1, tables.length)) * 100)}% ocupación</span>
                          </div>
                        </div>
                      )}

                      {widgetId === 'validations' && (
                        <div className="bg-white p-3.5 sm:p-5 md:p-6 rounded-2xl sm:rounded-[32px] shadow-sm border border-slate-100 flex flex-col h-full hover:shadow-md transition-shadow relative overflow-hidden group">
                          <div className="absolute -right-4 -top-4 sm:-right-6 sm:-top-6 w-16 h-16 sm:w-24 sm:h-24 bg-amber-50 rounded-full group-hover:scale-110 transition-transform"></div>
                          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4 relative z-10">
                            <div className="p-2 sm:p-3 bg-amber-50 text-amber-600 rounded-xl sm:rounded-2xl shrink-0">
                              <Receipt size={16} className="sm:w-5 sm:h-5 stroke-[2.5px]" />
                            </div>
                            <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-amber-500 truncate">Caja</span>
                          </div>
                          <div className="relative z-10 mt-auto">
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 sm:mb-1 block truncate">Por Validar</span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-800 tracking-tighter">{dashboardMetrics.validationsPending}</span>
                            </div>
                            <span className="text-[10px] sm:text-xs font-bold text-slate-400 mt-1 sm:mt-2 block truncate">
                              {dashboardMetrics.validationsPending === 0 ? 'Todo al día' : 'Pendientes de revisión'}
                            </span>
                          </div>
                        </div>
                      )}

                      {widgetId === 'deliveries' && (
                        <div className="bg-white p-3.5 sm:p-5 md:p-6 rounded-2xl sm:rounded-[32px] shadow-sm border border-slate-100 flex flex-col h-full hover:shadow-md transition-shadow relative overflow-hidden group">
                          <div className="absolute -right-4 -top-4 sm:-right-6 sm:-top-6 w-16 h-16 sm:w-24 sm:h-24 bg-orange-50 rounded-full group-hover:scale-110 transition-transform"></div>
                          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4 relative z-10">
                            <div className="p-2 sm:p-3 bg-orange-50 text-orange-600 rounded-xl sm:rounded-2xl shrink-0">
                              <ShoppingBag size={16} className="sm:w-5 sm:h-5 stroke-[2.5px]" />
                            </div>
                            <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-orange-500 truncate">Envíos</span>
                          </div>
                          <div className="relative z-10 mt-auto">
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 sm:mb-1 block truncate">Delivery Activos</span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-800 tracking-tighter">{dashboardMetrics.activeDeliveries}</span>
                            </div>
                            <span className="text-[10px] sm:text-xs font-bold text-slate-400 mt-1 sm:mt-2 block truncate">
                              {dashboardMetrics.activeDeliveries === 0 ? 'Sin envíos en curso' : 'En curso hoy'}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {widgetId === 'salon_sales' && (
                        <div className="bg-white p-3.5 sm:p-5 md:p-6 rounded-2xl sm:rounded-[32px] shadow-sm border border-slate-100 flex flex-col h-full hover:shadow-md transition-shadow relative overflow-hidden group">
                          <div className="absolute -right-4 -top-4 sm:-right-6 sm:-top-6 w-16 h-16 sm:w-24 sm:h-24 bg-indigo-50 rounded-full group-hover:scale-110 transition-transform"></div>
                          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4 relative z-10">
                            <div className="p-2 sm:p-3 bg-indigo-50 text-indigo-600 rounded-xl sm:rounded-2xl shrink-0">
                              <Users size={16} className="sm:w-5 sm:h-5 stroke-[2.5px]" />
                            </div>
                            <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-indigo-500 truncate">Salón</span>
                          </div>
                          <div className="relative z-10 mt-auto">
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 sm:mb-1 block truncate">Ventas Salón</span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-800 tracking-tighter">{formatPrice(salesByChannel.salon)}</span>
                            </div>
                            <span className="text-[10px] sm:text-xs font-bold text-slate-400 mt-1 sm:mt-2 block truncate">
                              {dashboardMetrics.salonCount} pedidos
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {widgetId === 'pickup_sales' && (
                        <div className="bg-white p-3.5 sm:p-5 md:p-6 rounded-2xl sm:rounded-[32px] shadow-sm border border-slate-100 flex flex-col h-full hover:shadow-md transition-shadow relative overflow-hidden group">
                          <div className="absolute -right-4 -top-4 sm:-right-6 sm:-top-6 w-16 h-16 sm:w-24 sm:h-24 bg-orange-50 rounded-full group-hover:scale-110 transition-transform"></div>
                          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4 relative z-10">
                            <div className="p-2 sm:p-3 bg-orange-50 text-orange-600 rounded-xl sm:rounded-2xl shrink-0">
                              <ShoppingBag size={16} className="sm:w-5 sm:h-5 stroke-[2.5px]" />
                            </div>
                            <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-orange-500 truncate">Pickup</span>
                          </div>
                          <div className="relative z-10 mt-auto">
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 sm:mb-1 block truncate">Ventas Retiro</span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-800 tracking-tighter">{formatPrice(salesByChannel.pickup)}</span>
                            </div>
                            <span className="text-[10px] sm:text-xs font-bold text-slate-400 mt-1 sm:mt-2 block truncate">
                              {dashboardMetrics.pickupCount} pedidos
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {widgetId === 'delivery_sales' && (
                        <div className="bg-white p-3.5 sm:p-5 md:p-6 rounded-2xl sm:rounded-[32px] shadow-sm border border-slate-100 flex flex-col h-full hover:shadow-md transition-shadow relative overflow-hidden group">
                          <div className="absolute -right-4 -top-4 sm:-right-6 sm:-top-6 w-16 h-16 sm:w-24 sm:h-24 bg-violet-50 rounded-full group-hover:scale-110 transition-transform"></div>
                          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4 relative z-10">
                            <div className="p-2 sm:p-3 bg-violet-50 text-violet-600 rounded-xl sm:rounded-2xl shrink-0">
                              <Smartphone size={16} className="sm:w-5 sm:h-5 stroke-[2.5px]" />
                            </div>
                            <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-violet-500 truncate">Delivery</span>
                          </div>
                          <div className="relative z-10 mt-auto">
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 sm:mb-1 block truncate">Ventas Delivery</span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-800 tracking-tighter">{formatPrice(salesByChannel.delivery)}</span>
                            </div>
                            <span className="text-[10px] sm:text-xs font-bold text-slate-400 mt-1 sm:mt-2 block truncate">
                              {dashboardMetrics.deliveryCount} pedidos
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {widgetId === 'service_time' && (
                        <div className="bg-white p-3.5 sm:p-5 md:p-6 rounded-2xl sm:rounded-[32px] shadow-sm border border-slate-100 flex flex-col h-full hover:shadow-md transition-shadow relative overflow-hidden group">
                          <div className="absolute -right-4 -top-4 sm:-right-6 sm:-top-6 w-16 h-16 sm:w-24 sm:h-24 bg-blue-50 rounded-full group-hover:scale-110 transition-transform"></div>
                          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4 relative z-10">
                            <div className="p-2 sm:p-3 bg-blue-50 text-blue-600 rounded-xl sm:rounded-2xl shrink-0">
                              <Clock size={16} className="sm:w-5 sm:h-5 stroke-[2.5px]" />
                            </div>
                            <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-blue-500 truncate">Tiempo</span>
                          </div>
                          <div className="relative z-10 mt-auto">
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 sm:mb-1 block truncate">Prom. Ciclo Servicio</span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-800 tracking-tighter">{avgServiceTime}</span>
                              <span className="text-xs sm:text-sm font-bold text-slate-400 block ml-0.5">min</span>
                            </div>
                            <span className="text-[10px] sm:text-xs font-bold text-slate-400 mt-1 sm:mt-2 block truncate">
                              Mesa abierta a cobro
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={`${isEditingLayout ? 'opacity-50 pointer-events-none' : ''} h-full`}>
                      {widgetId === 'alerts' && (
                        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm h-full">
                          <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
                              <Bell size={24} className="stroke-[2.5px]" />
                            </div>
                            <div>
                              <h3 className="font-black text-slate-900 text-lg">Alertas de Operación Activas</h3>
                              <p className="text-sm font-medium text-slate-500">Notificaciones urgentes que requieren atención</p>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <AnimatePresence>
                              {mockAlerts.length > 0 ? mockAlerts.map(alert => (
                                <motion.div 
                                  key={alert.id}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className={`p-4 rounded-2xl flex items-start gap-4 border ${
                                    alert.type === 'critical' ? 'bg-red-50/50 border-red-100' :
                                    alert.type === 'warning' ? 'bg-amber-50/50 border-amber-100' :
                                    'bg-blue-50/50 border-blue-100'
                                  }`}
                                >
                                  <div className={`mt-1 ${
                                    alert.type === 'critical' ? 'text-red-500' :
                                    alert.type === 'warning' ? 'text-amber-500' :
                                    'text-blue-500'
                                  }`}>
                                    <AlertCircle size={18} className="stroke-[2.5px]" />
                                  </div>
                                  <div className="flex-1">
                                    <p className="font-bold text-slate-800 text-sm">{alert.title}</p>
                                    <p className="text-xs font-medium text-slate-600 mt-1">{alert.desc}</p>
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">{alert.time}</span>
                                </motion.div>
                              )) : (
                                <div className="p-8 text-center bg-slate-50 rounded-3xl border border-slate-100 border-dashed">
                                  <CheckCircle2 size={32} className="mx-auto text-emerald-400 mb-3" />
                                  <p className="font-bold text-slate-700">Todo operando con normalidad</p>
                                  <p className="text-sm font-medium text-slate-500">No hay alertas críticas</p>
                                </div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      )}
                      
                      {widgetId === 'salon' && (
                        <div className="bg-indigo-600 p-8 rounded-[40px] shadow-xl h-full text-white relative overflow-hidden group">
                          <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500 rounded-full blur-3xl opacity-50 -mr-20 -mt-20 pointer-events-none"></div>
                          
                          <div className="relative z-10 flex flex-col h-full">
                            <div className="flex items-center justify-between mb-8">
                              <div>
                                <h3 className="font-black text-2xl tracking-tight">Salón</h3>
                                <p className="text-indigo-200 text-sm font-medium">Estado del Comedor</p>
                              </div>
                              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
                                <Users size={24} className="text-white" />
                              </div>
                            </div>
                            
                            <div className="space-y-4 mb-8">
                              <div className="flex justify-between items-center bg-indigo-700/50 p-4 rounded-2xl border border-indigo-500/30">
                                <span className="font-medium text-indigo-100 text-sm">Ocupación:</span>
                                <span className="font-black text-xl">{Math.round((dashboardMetrics.activeTables / Math.max(1, tables.length)) * 100)}%</span>
                              </div>
                              <div className="flex justify-between items-center bg-indigo-700/50 p-4 rounded-2xl border border-indigo-500/30">
                                <span className="font-medium text-indigo-100 text-sm">Mesas Libres:</span>
                                <span className="font-black text-xl">{tables.length - dashboardMetrics.activeTables}</span>
                              </div>
                            </div>
                            
                            <div className="mt-auto pt-4 border-t border-indigo-500/30">
                              <button 
                                onClick={() => onViewChange('salon')}
                                className="w-full bg-white hover:bg-indigo-50 text-indigo-900 p-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2"
                              >
                                Ver Mapa de Mesas
                                <ArrowRight size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {widgetId === 'caja' && (
                        <div className="bg-amber-500 p-8 rounded-[40px] shadow-xl h-full text-white relative overflow-hidden">
                          <div className="absolute right-0 top-0 w-64 h-64 bg-amber-400 rounded-full blur-3xl opacity-50 -mr-20 -mt-20 pointer-events-none"></div>
                          
                          <div className="relative z-10 flex flex-col h-full">
                            <div className="flex items-center justify-between mb-8">
                              <div>
                                <h3 className="font-black text-2xl tracking-tight">Caja</h3>
                                <p className="text-amber-100 text-sm font-medium">Flujo de Efectivo</p>
                              </div>
                              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                                <Receipt size={24} className="text-white" />
                              </div>
                            </div>
                            
                            <div className="space-y-4 mb-8">
                              <div className="flex justify-between items-center bg-amber-600/50 p-4 rounded-2xl border border-amber-400/30">
                                <span className="font-medium text-amber-100 text-sm">Por Validar:</span>
                                <span className="font-black text-xl">{dashboardMetrics.validationsPending}</span>
                              </div>
                              <div className="flex justify-between items-center bg-amber-600/50 p-4 rounded-2xl border border-amber-400/30">
                                <span className="font-medium text-amber-100 text-sm">Tasa del Día:</span>
                                <span className="font-black text-xl">{exchangeRate} Bs</span>
                              </div>
                            </div>
                            
                            <div className="mt-auto pt-4 border-t border-amber-400/30">
                              <button 
                                onClick={() => onViewChange('caja')}
                                className="w-full bg-white hover:bg-amber-50 text-amber-900 p-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2"
                              >
                                Ir a Caja
                                <ArrowRight size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {widgetId === 'cocina' && (
                        <div className="bg-rose-500 p-8 rounded-[40px] shadow-xl h-full text-white relative overflow-hidden">
                          <div className="absolute right-0 top-0 w-64 h-64 bg-rose-400 rounded-full blur-3xl opacity-50 -mr-20 -mt-20 pointer-events-none"></div>
                          
                          <div className="relative z-10 flex flex-col h-full">
                            <div className="flex items-center justify-between mb-8">
                              <div>
                                <h3 className="font-black text-2xl tracking-tight">Cocina</h3>
                                <p className="text-rose-100 text-sm font-medium">Producción KDS</p>
                              </div>
                              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                                <Flame size={24} className="text-white" />
                              </div>
                            </div>
                            
                            <div className="space-y-4 mb-8">
                              <div className="flex justify-between items-center bg-rose-600/50 p-4 rounded-2xl border border-rose-400/30">
                                <span className="font-medium text-rose-100 text-sm">Órdenes Activas:</span>
                                <span className="font-black text-xl">{kitchenOrders.filter(o => o.status !== 'completed').length}</span>
                              </div>
                              <div className="flex justify-between items-center bg-rose-600/50 p-4 rounded-2xl border border-rose-400/30">
                                <span className="font-medium text-rose-100 text-sm">Estado General:</span>
                                <span className="font-black text-sm px-3 py-1 bg-white/20 rounded-full uppercase tracking-wider">{kitchenOrders.filter(o => o.status !== 'completed').length > 10 ? 'Alta Demanda' : 'Operativo'}</span>
                              </div>
                            </div>
                            
                            <div className="mt-auto pt-4 border-t border-rose-400/30">
                              <button 
                                onClick={() => onViewChange('kitchen')}
                                className="w-full bg-white hover:bg-rose-50 text-rose-900 p-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2"
                              >
                                Ver KDS
                                <ArrowRight size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {widgetId === 'chat' && (
                        <div className="bg-slate-900 p-8 rounded-[40px] shadow-xl h-full text-white relative overflow-hidden">
                          <div className="absolute right-0 top-0 w-64 h-64 bg-slate-800 rounded-full blur-3xl opacity-50 -mr-20 -mt-20 pointer-events-none"></div>
                          
                          <div className="relative z-10 flex flex-col h-full">
                            <div className="flex items-center justify-between mb-8">
                              <div>
                                <h3 className="font-black text-2xl tracking-tight">Comunicación</h3>
                                <p className="text-slate-400 text-sm font-medium">Equipo y Staff</p>
                              </div>
                              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md relative">
                                <Users size={24} className="text-white" />
                                {chatsCount > 0 && (
                                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-slate-900"></span>
                                )}
                              </div>
                            </div>
                            
                            <div className="space-y-4 mb-8">
                              <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                                <span className="font-medium text-slate-300 text-sm">Mensajes Nuevos:</span>
                                <span className="font-black text-xl">{chatsCount}</span>
                              </div>
                              <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                                <span className="font-medium text-slate-300 text-sm">Equipo Conectado:</span>
                                <span className="font-black text-xl">4</span>
                              </div>
                            </div>
                            
                            <div className="mt-auto pt-4 border-t border-slate-800">
                              <button 
                                onClick={() => onViewChange('chat')}
                                className="w-full bg-white hover:bg-slate-100 text-slate-950 p-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-white/5"
                              >
                                Abrir Chat Interno
                                <ArrowRight size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </SortableItem>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
