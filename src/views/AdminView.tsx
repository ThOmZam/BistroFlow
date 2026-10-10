import React, { useState, useEffect, useMemo } from 'react';

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

function SortableItem({ id, children, className }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={className} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

import { 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  ZAxis, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  ReferenceArea
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  Star, 
  AlertTriangle, 
  Hash, 
  Zap, 
  ShoppingBag, 
  Utensils, 
  Briefcase, 
  DollarSign, 
  Clock, 
  Smile, 
  Frown, 
  Meh, 
  ChevronRight, 
  CheckCircle, 
  UserPlus, 
  Trash2, 
  Save, 
  Settings, 
  Shield, 
  BookOpen, 
  Plus, 
  AlertCircle 
} from 'lucide-react';
import { collection, onSnapshot, collectionGroup, doc, updateDoc, setDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { logAction } from '../lib/logger';
import { db } from '../lib/firebase';
import { useRestaurantData } from '../hooks/useRestaurantData';
import CurrencySelector from '../components/CurrencySelector';

type AdminTab = 'intel' | 'payroll' | 'crm' | 'config' | 'payments';

export default function AdminView({ currentUser }: { currentUser?: any }) {
  const { menu, exchangeRate, settings } = useRestaurantData();
  const [activeTab, setActiveTab] = useState<AdminTab>('intel');

  const [adminWidgetOrder, setAdminWidgetOrder] = useState(['ticket', 'orders', 'items', 'revenue']);

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

  function handleDragEndAdmin(event: any) {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setAdminWidgetOrder((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }


  // Core collections states
  const [sessions, setSessions] = useState<any[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Employee Form State
  const [empName, setEmpName] = useState('');
  const [empRole, setEmpRole] = useState<'admin' | 'waiter' | 'cook' | 'finance'>('waiter');
  const [empSchedule, setEmpSchedule] = useState('08:00 - 16:00');
  const [empSalary, setEmpSalary] = useState(250);
  const [empPin, setEmpPin] = useState('');
  const [empError, setEmpError] = useState('');

  // New Client Form State
  const [cliName, setCliName] = useState('');
  const [cliPhone, setCliPhone] = useState('');
  const [cliAddress, setCliAddress] = useState('');
  const [cliSentiment, setCliSentiment] = useState<'happy' | 'neutral' | 'sad'>('happy');
  const [cliDebt, setCliDebt] = useState(0);

  // General config editing states
  const [editedRestName, setEditedRestName] = useState('');
  const [editedRate, setEditedRate] = useState(40);
  const [editedChargePercent, setEditedChargePercent] = useState(10);
  const [editedOpenTime, setEditedOpenTime] = useState('08:00');
  const [editedCloseTime, setEditedCloseTime] = useState('23:00');
  const [pagoMovilBanco, setPagoMovilBanco] = useState('');
  const [pagoMovilPhone, setPagoMovilPhone] = useState('');
  const [pagoMovilId, setPagoMovilId] = useState('');
  const [zelleEmail, setZelleEmail] = useState('');
  const [zelleName, setZelleName] = useState('');

  // Payment methods toggles
  const [pmPagoMovil, setPmPagoMovil] = useState(true);
  const [pmZelle, setPmZelle] = useState(true);
  const [pmCash, setPmCash] = useState(true);

  // Load live data
  useEffect(() => {
    const unsubSessions = onSnapshot(collection(db, 'sessions'), (snap) => {
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubOrders = onSnapshot(collectionGroup(db, 'orders'), (snap) => {
      setAllOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    });

    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snap) => {
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubClients = onSnapshot(collection(db, 'clients'), (snap) => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubSessions();
      unsubOrders();
      unsubEmployees();
      unsubClients();
    };
  }, []);

  // Initialize general config states when settings loads
  useEffect(() => {
    if (settings) {
      setEditedRestName(settings.restaurantName || 'BistroFlow');
      setEditedRate(settings.exchangeRate || 40);
      setEditedChargePercent(settings.serviceChargePercent || 10);
      setEditedOpenTime((settings as any).deliveryStartTime || '08:00');
      setEditedCloseTime((settings as any).deliveryEndTime || '23:00');
      setPagoMovilBanco(settings.pagoMovilBanco || 'Banesco');
      setPagoMovilPhone(settings.pagoMovilPhone || '0412-1234567');
      setPagoMovilId(settings.pagoMovilId || 'V-12345678');
      setZelleEmail(settings.zelleEmail || 'pagos@bistroflow.com');
      setZelleName(settings.zelleName || 'BistroFlow SL');

      const pm = (settings as any).paymentMethods || {};
      setPmPagoMovil(pm.pagoMovil !== false);
      setPmZelle(pm.zelle !== false);
      setPmCash(pm.cash !== false);
    }
  }, [settings]);

  // Dynamic Metrics calculations
  const metrics = useMemo(() => {
    const completed = sessions.filter(s => s.status === 'completed' || s.paymentStatus === 'validated');
    const totalRevenue = completed.reduce((acc, s) => {
      const isCredit = s.payment?.method === 'credito' || s.paymentMethod === 'credito';
      if (isCredit) return acc;
      return acc + (s.totalAmount || 0);
    }, 0);
    const ticketPromedio = completed.length > 0 ? (totalRevenue / completed.length) : 0;
    
    const relevantOrders = allOrders.filter(o => o.status === 'ready' || o.status === 'pending' || o.status === 'preparing');
    const totalItemsSold = relevantOrders.reduce((acc, o) => acc + (o.quantity || 0), 0);
    const articulosPorTicket = completed.length > 0 ? (totalItemsSold / completed.length) : 0;

    const itemSales: Record<string, { name: string; quantity: number; revenue: number; price: number }> = {};
    menu.forEach(item => {
      itemSales[item.id] = { name: item.name, quantity: 0, revenue: 0, price: item.price };
    });

    allOrders.forEach(o => {
      const itemId = o.menuItemId;
      if (itemId && itemSales[itemId]) {
        itemSales[itemId].quantity += (o.quantity || 0);
        itemSales[itemId].revenue += (o.quantity || 0) * (o.price || 0);
      }
    });

    const salesArray = Object.values(itemSales);
    const maxQty = Math.max(...salesArray.map(s => s.quantity), 1);
    
    const chartData = salesArray.map(s => {
      const popularity = Math.round((s.quantity / maxQty) * 80) + 15;
      const margin = Math.round(55 + ((s.price * 7) % 35));
      let category = 'Rompecabezas';
      if (margin > 70 && popularity > 50) category = 'Estrella';
      else if (margin <= 70 && popularity > 50) category = 'Vaca';
      else if (margin <= 70 && popularity <= 50) category = 'Perro';

      return { name: s.name, popularity, margin, category, quantity: s.quantity, revenue: s.revenue };
    });

    const stars = chartData.filter(d => d.category === 'Estrella').sort((a,b) => b.quantity - a.quantity);
    const topEstrella = stars[0]?.name || (chartData.sort((a,b) => b.quantity - a.quantity)[0]?.name || 'Ninguno');

    const dogs = chartData.filter(d => d.category === 'Perro').sort((a,b) => a.quantity - b.quantity);
    const bajaRotacion = dogs[0]?.name || 'Ninguno';

        const isDeliveryStrict = (s: any) => (s.type === 'delivery' || String(s.tableId).startsWith('delivery')) && s.deliveryType !== 'pickup';
    const isPickup = (s: any) => s.deliveryType === 'pickup';
    const isSalon = (s: any) => !isDeliveryStrict(s) && !isPickup(s);

    const delivery = completed.filter(isDeliveryStrict);
    const pickup = completed.filter(isPickup);
    const salon = completed.filter(isSalon);

    const calcSales = (arr: any[]) => arr.reduce((acc, s) => {
      const isCredit = s.payment?.method === 'credito' || s.paymentMethod === 'credito';
      if (isCredit) return acc;
      return acc + (s.totalAmount || 0);
    }, 0);

    const deliverySales = calcSales(delivery);
    const pickupSales = calcSales(pickup);
    const salonSales = calcSales(salon);

    const deliveryPercent = totalRevenue > 0 ? Math.round((deliverySales / totalRevenue) * 100) : 0;
    const pickupPercent = totalRevenue > 0 ? Math.round((pickupSales / totalRevenue) * 100) : 0;
    const salonPercent = totalRevenue > 0 ? Math.round((salonSales / totalRevenue) * 100) : 0;

    // Average Order Time calculations (in minutes)
    let deliveryTimes: number[] = [];
    let pickupTimes: number[] = [];
    let mesaTimes: number[] = [];

    completed.forEach(s => {
      const start = s.startTime ? new Date(s.startTime).getTime() : null;
      const end = s.payment?.timestamp ? new Date(s.payment.timestamp).getTime() : 
                  s.endTime ? new Date(s.endTime).getTime() : null;
      
      if (start && end && end > start) {
        const diffMinutes = Math.round((end - start) / (1000 * 60));
        if (diffMinutes >= 1 && diffMinutes <= 180) {
                    if (isPickup(s)) {
            pickupTimes.push(diffMinutes);
          } else if (isDeliveryStrict(s)) {
            deliveryTimes.push(diffMinutes);
          } else {
            mesaTimes.push(diffMinutes);
          }
        }
      }
    });

        const avgDeliveryTime = deliveryTimes.length > 0 ? Math.round(deliveryTimes.reduce((a,b) => a+b, 0) / deliveryTimes.length) : 0;
    const avgPickupTime = pickupTimes.length > 0 ? Math.round(pickupTimes.reduce((a,b) => a+b, 0) / pickupTimes.length) : 0;
    const avgMesaTime = mesaTimes.length > 0 ? Math.round(mesaTimes.reduce((a,b) => a+b, 0) / mesaTimes.length) : 0;

    return {
      totalRevenue,
      ticketPromedio,
      articulosPorTicket,
      chartData,
      topEstrella,
      bajaRotacion,
            deliveryCount: delivery.length,
      deliverySales,
      deliveryPercent,
      pickupCount: pickup.length,
      pickupSales,
      pickupPercent,
      salonCount: salon.length,
      salonSales,
      salonPercent,
      avgDeliveryTime,
      avgPickupTime,
      avgMesaTime
    };
  }, [sessions, allOrders, menu]);

  // Add Employee Handler
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmpError('');
    if (!empName.trim() || !empPin.trim() || empPin.length !== 4) {
      setEmpError('Por favor completa todos los campos. El PIN debe ser de exactamente 4 dígitos.');
      return;
    }

    // Check PIN uniqueness
    const pinExists = employees.some(emp => emp.pin === empPin);
    if (pinExists || ['1111', '2222', '3333', '4444'].includes(empPin)) {
      setEmpError('Este PIN ya está registrado o es reservado por el sistema.');
      return;
    }

    try {
      await addDoc(collection(db, 'employees'), {
        name: empName.trim(),
        role: empRole,
        schedule: empSchedule,
        salary: Number(empSalary),
        pin: empPin,
        status: 'active',
        createdAt: new Date().toISOString()
      });
      // Clear fields
      setEmpName('');
      setEmpPin('');
      setEmpSchedule('08:00 - 16:00');
      setEmpSalary(250);
    } catch (err) {
      console.error('Error adding employee:', err);
      setEmpError('Ocurrió un error al guardar el empleado.');
    }
  };

  // Toggle Employee Status
  const toggleEmployeeStatus = async (emp: any) => {
    try {
      await updateDoc(doc(db, 'employees', emp.id), {
        status: emp.status === 'active' ? 'inactive' : 'active'
      });
    } catch (err) {
      console.error('Error toggling employee status:', err);
    }
  };

  // Delete Employee
  const handleDeleteEmployee = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este empleado de la nómina?')) {
      try {
        await deleteDoc(doc(db, 'employees', id));
      } catch (err) {
        console.error('Error deleting employee:', err);
      }
    }
  };

  // Add Client Handler
  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliName.trim() || !cliPhone.trim()) return;

    try {
      await addDoc(collection(db, 'clients'), {
        name: cliName.trim(),
        phone: cliPhone.trim(),
        address: cliAddress.trim(),
        sentiment: cliSentiment,
        debt: Number(cliDebt),
        createdAt: new Date().toISOString()
      });
      setCliName('');
      setCliPhone('');
      setCliAddress('');
      setCliSentiment('happy');
      setCliDebt(0);
    } catch (err) {
      console.error('Error adding client:', err);
    }
  };

  // Clear Client Debt
  const clearClientDebt = async (client: any) => {
    try {
      await updateDoc(doc(db, 'clients', client.id), {
        debt: 0
      });
    } catch (err) {
      console.error('Error clearing client debt:', err);
    }
  };

  // Delete Client
  const handleDeleteClient = async (id: string) => {
    if (confirm('¿Deseas eliminar este cliente del CRM?')) {
      try {
        await deleteDoc(doc(db, 'clients', id));
      } catch (err) {
        console.error('Error deleting client:', err);
      }
    }
  };

  // Update sentiment
  const updateClientSentiment = async (id: string, sent: 'happy' | 'neutral' | 'sad') => {
    try {
      await updateDoc(doc(db, 'clients', id), { sentiment: sent });
    } catch (err) {
      console.error('Error updating sentiment:', err);
    }
  };

  // Save General Local Configuration
  const handleSaveConfig = async () => {
    try {

      await logAction('system', currentUser?.name || 'Administrador', 'Actualizó configuración general', `Tasa: ${editedRate} Bs. Nombre: ${editedRestName}`);
      await setDoc(doc(db, 'settings', 'general'), {
        restaurantName: editedRestName.trim(),
        exchangeRate: Number(editedRate),
        serviceChargePercent: Number(editedChargePercent),
        deliveryStartTime: editedOpenTime,
        deliveryEndTime: editedCloseTime,
        pagoMovilBanco,
        pagoMovilPhone,
        pagoMovilId,
        zelleEmail,
        zelleName,
        paymentMethods: {
          pagoMovil: pmPagoMovil,
          zelle: pmZelle,
          cash: pmCash
        }
      }, { merge: true });
      alert('¡Configuración guardada con éxito!');
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Error al guardar la configuración.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-40">
        <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col space-y-6 pb-16 min-h-full">
      {/* Tab Navigation header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200/60 pb-5 mb-8 gap-4">
        <div>
          <span className="text-[10px] uppercase font-black tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 inline-block mb-1.5">Módulo Analítico • Administración</span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            Inteligencia de Negocio
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">Métricas de rendimiento, tiempos de ciclo de servicio y matriz de ingeniería de menú.</p>
        </div>

        <div className="flex items-center gap-2">
          <CurrencySelector variant="compact" />
        </div>
      </div>

      {/* TAB CONTENT: INTEL (METRICS & MENU) */}
      <div className="space-y-10">
        <div className="space-y-10">
          {/* KPI Cards */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndAdmin}>
            <SortableContext items={adminWidgetOrder} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {adminWidgetOrder.map(widgetId => (
                  <SortableItem key={widgetId} id={widgetId} className="h-full cursor-grab active:cursor-grabbing">
                    {widgetId === 'ticket' && <KPICard title="Ticket Promedio" value={`${metrics.ticketPromedio.toFixed(2)}`} sub="Frecuencia real" icon={Hash} />}
                    {widgetId === 'orders' && <KPICard title="Órdenes Totales" value={metrics.deliveryCount + metrics.pickupCount + metrics.salonCount} sub="Pedidos cerrados" icon={Users} />}
                    {widgetId === 'items' && <KPICard title="Artículos / Ticket" value={metrics.articulosPorTicket.toFixed(1)} sub="Variedad" icon={Zap} />}
                    {widgetId === 'revenue' && <KPICard title="Venta Facturada" value={`${metrics.totalRevenue.toFixed(2)}`} sub="Total hoy" icon={TrendingUp} />}
                  </SortableItem>
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* TIEMPO PROMEDIO DE PEDIDO KPI Board */}
          <div className="bg-slate-900 text-white p-8 rounded-[36px] shadow-xl border border-slate-800">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <span className="text-[10px] uppercase font-black tracking-widest text-indigo-300 block mb-1">Rendimiento de Servicio</span>
                <h3 className="text-xl font-extrabold tracking-tight">Tiempo Promedio de Pedido (Principio a Fin)</h3>
                <p className="text-slate-400 text-xs mt-0.5">Medición del ciclo de vida del pedido desde que se abre la cuenta hasta su cobro definitivo.</p>
              </div>
              <div className="flex gap-2 items-center bg-white/10 px-3 py-1.5 rounded-full text-[10px] font-bold font-mono">
                <Clock size={12} className="text-amber-400" />
                <span>Tiempos de Ciclo Activos</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Delivery */}
              <div className="bg-white/5 border border-white/10 p-6 rounded-3xl flex items-center justify-between hover:bg-white/10 transition-all duration-300">
                <div>
                  <span className="text-[10px] text-indigo-300 uppercase font-black block tracking-wider">🛵 Delivery</span>
                  <div className="text-4xl font-black text-white mt-1.5">{metrics.avgDeliveryTime} <span className="text-base font-medium">min</span></div>
                  <span className="text-[10px] text-slate-400 block mt-1">Meta: &lt; 40 min</span>
                </div>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${metrics.avgDeliveryTime <= 40 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  <Clock size={24} />
                </div>
              </div>

              {/* Pickup */}
              <div className="bg-white/5 border border-white/10 p-6 rounded-3xl flex items-center justify-between hover:bg-white/10 transition-all duration-300">
                <div>
                  <span className="text-[10px] text-indigo-300 uppercase font-black block tracking-wider">🛍️ Pickup / Retiro</span>
                  <div className="text-4xl font-black text-white mt-1.5">{metrics.avgPickupTime} <span className="text-base font-medium">min</span></div>
                  <span className="text-[10px] text-slate-400 block mt-1">Meta: &lt; 25 min</span>
                </div>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${metrics.avgPickupTime <= 25 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  <Clock size={24} />
                </div>
              </div>

              {/* Mesa */}
              <div className="bg-white/5 border border-white/10 p-6 rounded-3xl flex items-center justify-between hover:bg-white/10 transition-all duration-300">
                <div>
                  <span className="text-[10px] text-indigo-300 uppercase font-black block tracking-wider">🍽️ Consumo en Mesa</span>
                  <div className="text-4xl font-black text-white mt-1.5">{metrics.avgMesaTime} <span className="text-base font-medium">min</span></div>
                  <span className="text-[10px] text-slate-400 block mt-1">Meta: &lt; 35 min</span>
                </div>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${metrics.avgMesaTime <= 35 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  <Clock size={24} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Menu engineering chart */}
            <div className="bg-white p-8 rounded-[36px] border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-widest">Ingeniería de Menú</h3>
                  <p className="text-slate-400 text-xs">Rentabilidad vs Popularidad del Plato</p>
                </div>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase">Realtime</span>
              </div>
              
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <XAxis type="number" dataKey="popularity" name="Popularidad" hide />
                    <YAxis type="number" dataKey="margin" name="Margen" hide />
                    <ZAxis type="category" dataKey="name" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    
                    {/* Quadrant Areas */}
                    {/* @ts-ignore */}
                    <ReferenceArea x1={50} x2={100} y1={50} y2={100} fill="#f0fff4" fillOpacity={0.5} />
                    {/* @ts-ignore */}
                    <ReferenceArea x1={0} x2={50} y1={50} y2={100} fill="#fffaf0" fillOpacity={0.5} />
                    {/* @ts-ignore */}
                    <ReferenceArea x1={0} x2={50} y1={0} y2={50} fill="#fff5f5" fillOpacity={0.5} />
                    {/* @ts-ignore */}
                    <ReferenceArea x1={50} x2={100} y1={0} y2={50} fill="#f0f9ff" fillOpacity={0.5} />
                    
                    <Scatter name="Platos" data={metrics.chartData}>
                      {metrics.chartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.margin > 70 ? (entry.popularity > 50 ? '#2ED573' : '#ffa502') : (entry.popularity > 50 ? '#1e90ff' : '#FF4757')} 
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Top Ventas (Estrella)</span>
                  <p className="font-bold text-xs mt-1 text-slate-800 truncate">{metrics.topEstrella}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Baja Rotación</span>
                  <p className="font-bold text-xs mt-1 text-slate-800 truncate">{metrics.bajaRotacion}</p>
                </div>
              </div>
            </div>

            {/* Sales channels ratio */}
            <div className="bg-slate-900 text-white p-8 rounded-[36px] shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-6">Canales de Facturación</h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center"><ShoppingBag size={16} /></div>
                      <div>
                        <p className="text-xs font-bold">Delivery a Domicilio</p>
                        <span className="text-[10px] text-slate-500">{metrics.deliveryCount} pedidos</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-emerald-400">${metrics.deliverySales.toFixed(2)}</p>
                      <span className="text-[10px] text-slate-500 font-bold">{metrics.deliveryPercent}%</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center"><ShoppingBag size={16} /></div>
                      <div>
                        <p className="text-xs font-bold">Retiro en Local</p>
                        <span className="text-[10px] text-slate-500">{metrics.pickupCount} pedidos</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-emerald-400">${metrics.pickupSales.toFixed(2)}</p>
                      <span className="text-[10px] text-slate-500 font-bold">{metrics.pickupPercent}%</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center"><Utensils size={16} /></div>
                      <div>
                        <p className="text-xs font-bold">Consumo en Salón</p>
                        <span className="text-[10px] text-slate-500">{metrics.salonCount} pedidos</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-emerald-400">${metrics.salonSales.toFixed(2)}</p>
                      <span className="text-[10px] text-slate-500 font-bold">{metrics.salonPercent}%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-800 rounded-2xl border border-slate-700/50 mt-10">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  <span className="text-[10px] font-black uppercase text-indigo-300">Resumen Automático</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {metrics.deliverySales >= metrics.salonSales 
                    ? 'El delivery es tu canal principal actualmente. Asegura que los horarios de atención y despacho estén al día.'
                    : 'La mayor parte de los ingresos proviene del salón físico. Apoya a los meseros en horas pico.'}
                </p>
              </div>
            </div>
          </div>

          {/* TOAST FEATURE 5: Customer Satisfaction & Feedback Board */}
          <FeedbackAdminSection />
        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, sub, icon: Icon }: any) {
  return (
    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between">
      <div>
        <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
          <Icon size={18} className="text-slate-400" />
        </div>
        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">{title}</span>
        <div className="text-2xl font-black mt-1 text-slate-900">{value}</div>
      </div>
      <div className="text-[9px] font-bold text-emerald-500 mt-2 flex items-center bg-emerald-50/50 w-fit px-2 py-0.5 rounded-md">
        <TrendingUp size={10} className="mr-0.5" /> {sub}
      </div>
    </div>
  );
}

function FeedbackAdminSection() {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'feedback'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setFeedbacks(data.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
    });
    return () => unsub();
  }, []);

  const totalReviews = feedbacks.length;
  const avgRating = totalReviews > 0 
    ? (feedbacks.reduce((acc, f) => acc + (f.rating || 5), 0) / totalReviews).toFixed(1)
    : '5.0';

  return (
    <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <span className="text-[10px] uppercase font-black tracking-widest text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100 inline-block mb-1.5">
            Encuestas Express (Calificaciones)
          </span>
          <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <span>⭐ Satisfacción y Calificaciones</span>
          </h3>
          <p className="text-slate-500 text-xs mt-0.5">Respuestas en tiempo real recopiladas al cerrar comanda o pago.</p>
        </div>

        <div className="flex items-center gap-4 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100">
          <div className="flex items-center gap-1">
            <Star className="text-amber-400 fill-amber-400" size={24} />
            <span className="text-2xl font-black text-slate-900">{avgRating}</span>
            <span className="text-xs text-slate-400 font-bold">/ 5.0</span>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <span className="text-xs font-black text-slate-800 block">{totalReviews}</span>
            <span className="text-[10px] font-bold text-slate-400">Encuestas Totales</span>
          </div>
        </div>
      </div>

      {feedbacks.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-xs italic">
          Aún no hay calificaciones o encuestas registradas.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {feedbacks.map(f => (
            <div key={f.id} className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star 
                      key={star} 
                      size={14} 
                      className={star <= (f.rating || 5) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'} 
                    />
                  ))}
                </div>
                <span className="text-[10px] text-slate-400 font-medium">
                  {f.createdAt ? new Date(f.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>

              {f.sentimentTag && (
                <span className="inline-block text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100">
                  {f.sentimentTag}
                </span>
              )}

              {f.comment && (
                <p className="text-xs text-slate-700 italic bg-white p-2.5 rounded-xl border border-slate-100">
                  "{f.comment}"
                </p>
              )}

              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                <span>{f.customerName ? `Cliente: ${f.customerName}` : 'Anónimo'}</span>
                {f.tableName && <span className="font-bold text-slate-600">{f.tableName}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
