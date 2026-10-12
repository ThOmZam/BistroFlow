import React, { useState, useEffect } from 'react';
import { 
  BarChart2, 
  ChefHat, 
  LayoutDashboard, 
  LogOut, 
  Package, 
  Settings, 
  Table as TableIcon,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  TrendingUp,
  Terminal,
  MessageSquare,
  Bell,
  Users,
  Briefcase,
  Coins,
  Wallet,
  Clock,
  Flame
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, query, where, collectionGroup } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Role } from '../types';

interface SidebarProps {
  role: Role;
  onLogout: () => void;
  activeView: string;
  onViewChange: (view: string) => void;
  restaurantName?: string;
  hasActiveClockIn?: boolean;
}

export default function Sidebar({ role, onLogout, activeView, onViewChange, restaurantName, hasActiveClockIn }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  // Alert Badge states
  const [tableWaitingBillCount, setTableWaitingBillCount] = useState(0);
  const [cajaPendingCount, setCajaPendingCount] = useState(0);
  const [kitchenActiveCount, setKitchenActiveCount] = useState(0);
  const [chatMessagesCount, setChatMessagesCount] = useState(0);

  // Update chat read timestamp when entering chat view
  useEffect(() => {
    if (activeView === 'chat') {
      localStorage.setItem('last_chat_read_time', new Date().toISOString());
      setChatMessagesCount(0);
    }
  }, [activeView]);

  useEffect(() => {
    // 1. Tables waiting for bill
    const unsubTables = onSnapshot(
      query(collection(db, 'tables'), where('status', '==', 'waiting_bill')),
      (snap) => {
        setTableWaitingBillCount(snap.size);
      }
    );

    // 2. Active sessions with pending payment validations
    const unsubSessions = onSnapshot(
      query(collection(db, 'sessions'), where('status', '==', 'active')),
      (snap) => {
        const active = snap.docs.map(d => d.data());
        const pendingVal = active.filter(s => s.paymentStatus === 'pending_validation' || s.paymentStatus === 'pending_credit_approval');
        setCajaPendingCount(pendingVal.length);
      }
    );

    // 3. Count actual pending orders in kitchen queue (so badge clears when orders are completed)
    const unsubKitchen = onSnapshot(
      query(collectionGroup(db, 'orders'), where('status', '==', 'pending')),
      (snap) => {
        setKitchenActiveCount(snap.size);
      },
      (err) => {
        console.error('Error listening to kitchen orders in sidebar:', err);
      }
    );

    // 4. Count unread chats for chat indicator
    const unsubChats = onSnapshot(collection(db, 'chats'), (snap) => {
      if (activeView === 'chat') {
        setChatMessagesCount(0);
        return;
      }
      const lastRead = localStorage.getItem('last_chat_read_time') || '';
      const unreadCount = snap.docs.filter(d => {
        const data = d.data();
        return !lastRead || (data.timestamp && data.timestamp > lastRead);
      }).length;
      setChatMessagesCount(unreadCount);
    });

    return () => {
      unsubTables();
      unsubSessions();
      unsubKitchen();
      unsubChats();
    };
  }, [activeView]);

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  const menuItems = [
    // 1. OPERACIÓN EN VIVO
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'waiter', 'cook', 'finance'], badge: 0, category: 'Operación' },
    { id: 'waiter', label: 'Salón y Mesas', icon: TableIcon, roles: ['admin', 'waiter'], badge: tableWaitingBillCount, category: 'Operación' },
    { id: 'kitchen', label: 'Cocina (KDS)', icon: ChefHat, roles: ['admin', 'cook'], badge: kitchenActiveCount, category: 'Operación' },
    { id: 'caja', label: 'Control de Caja', icon: Wallet, roles: ['admin', 'finance'], badge: cajaPendingCount, category: 'Operación' },
    { id: 'chat', label: 'Chat Interno', icon: MessageSquare, roles: ['admin', 'waiter', 'cook', 'finance'], badge: chatMessagesCount > 0 ? '•' : 0, category: 'Operación' },

    // 2. GESTIÓN Y ADMINISTRACIÓN
    { id: 'marketing', label: 'Marketing & Cupones', icon: Flame, roles: ['admin'], badge: 0, category: 'Gestión' },
    { id: 'finance', label: 'Finanzas', icon: DollarSign, roles: ['admin'], badge: 0, category: 'Gestión' },
    { id: 'menu_settings', label: 'Menú y Precios', icon: Settings, roles: ['admin'], badge: 0, category: 'Gestión' },
    { id: 'inventory', label: 'Inventario', icon: Package, roles: ['admin'], badge: 0, category: 'Gestión' },
    { id: 'crm', label: 'CRM / Clientes', icon: Users, roles: ['admin'], badge: 0, category: 'Gestión' },
    { id: 'personal', label: 'Personal / Acceso', icon: Briefcase, roles: ['admin'], badge: 0, category: 'Gestión' },

    // 3. INTELIGENCIA Y SISTEMA
    { id: 'analytics', label: 'Admin Intel', icon: BarChart2, roles: ['admin'], badge: 0, category: 'Sistema' },
    { id: 'kernel', label: 'Kernel / Acciones', icon: Terminal, roles: ['admin'], badge: 0, category: 'Sistema' },

    // 4. ASISTENCIA
    { id: 'my_shift', label: 'Mi Turno (Asistencia)', icon: Clock, roles: ['admin', 'waiter', 'cook', 'finance'], badge: 0, category: 'Personal' },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(role) && item.id !== 'my_shift');
  const myShiftItem = menuItems.find(item => item.id === 'my_shift');

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 80 : 260 }}
        className="hidden md:flex h-screen bg-white border-r border-slate-200 flex-col transition-all duration-300 ease-in-out relative z-50 shadow-sm py-8 space-y-6"
      >
        <div className="px-6 flex items-center justify-between">
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-2"
              >
                <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center font-black text-xl text-white">
                  {(restaurantName || 'BistroFlow').charAt(0).toUpperCase()}
                </div>
                <span className="font-bold text-xl tracking-tight">{restaurantName || 'BistroFlow'}</span>
              </motion.div>
            )}
          </AnimatePresence>
          <button 
            onClick={toggleCollapse}
            className="p-1 hover:bg-slate-50 rounded-lg text-slate-400"
            title={isCollapsed ? "Expandir" : "Contraer"}
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-4 flex flex-col space-y-1.5 overflow-y-auto">
          {filteredItems.map((item, idx) => {
            const isSelected = activeView === item.id;
            const hasBadge = !!item.badge;
            const isDot = item.badge === '•';
            const showCategoryHeader = !isCollapsed && role === 'admin' && (
              idx === 0 || item.category !== filteredItems[idx - 1]?.category
            );

            return (
              <React.Fragment key={item.id}>
                {showCategoryHeader && (
                  <div className={`text-[9px] font-black uppercase tracking-wider text-slate-400 px-3 ${idx === 0 ? 'pt-1 pb-1' : 'pt-4 pb-1'}`}>
                    {item.category}
                  </div>
                )}
                <button
                  onClick={() => onViewChange(item.id)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-2xl transition-all relative ${
                    isSelected 
                      ? 'bg-slate-100 text-black font-extrabold shadow-sm' 
                      : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  <div className="relative">
                    <item.icon size={22} className={isSelected ? 'text-black' : 'text-slate-400'} />
                    {hasBadge && (
                      <span className={`absolute -top-1.5 -right-1.5 rounded-full flex items-center justify-center font-black leading-none ${
                        isDot 
                          ? 'w-2 h-2 bg-emerald-500 ring-2 ring-white' 
                          : 'text-[9px] min-w-4 h-4 px-1 bg-rose-500 text-white ring-2 ring-white'
                      }`}>
                        {!isDot && item.badge}
                      </span>
                    )}
                  </div>
                  {!isCollapsed && (
                    <span className="font-semibold text-xs text-left truncate">{item.label}</span>
                  )}
                  
                  {/* Tiny marker dot for selected menu */}
                  {isSelected && !isCollapsed && (
                    <div className="w-1.5 h-1.5 rounded-full bg-black ml-auto" />
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        {myShiftItem && (
          <div className="px-4">
            <button
              onClick={() => onViewChange('my_shift')}
              className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all relative ${
                activeView === 'my_shift'
                  ? 'bg-slate-100 text-black font-extrabold shadow-sm' 
                  : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Clock size={22} className={activeView === 'my_shift' ? 'text-black' : 'text-slate-400'} />
                {!isCollapsed && (
                  <span className="font-semibold text-xs text-left truncate">Mi Turno (Asistencia)</span>
                )}
              </div>
              {!isCollapsed && role !== 'admin' && (
                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                  hasActiveClockIn ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800 animate-pulse'
                }`}>
                  {hasActiveClockIn ? '🟢 En Turno' : '🔴 Sin Fichar'}
                </span>
              )}
            </button>
          </div>
        )}

        <div className="p-4 border-t border-slate-100 italic font-mono text-[9px] text-slate-400 uppercase tracking-widest text-center">
          {!isCollapsed && <span>System Ver 1.1.0</span>}
        </div>

        <div className="p-4">
          <button
            id="desktop-logout-btn"
            onClick={onLogout}
            className={`w-full flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl text-rose-500 hover:bg-rose-50 transition-colors border border-dashed border-rose-100 bg-rose-50/20`}
          >
            <LogOut size={22} />
            {!isCollapsed && <span className="font-extrabold text-[9px] uppercase tracking-wider text-center">Cerrar Sesión</span>}
          </button>
        </div>
      </motion.aside>

      {/* Mobile Bottom Nav with Alert Badges */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1.5 px-3 w-full justify-start select-none touch-pan-x -webkit-overflow-scrolling-touch">
          {filteredItems.map((item) => {
            const isSelected = activeView === item.id;
            const hasBadge = !!item.badge;
            const isDot = item.badge === '•';

            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all shrink-0 min-w-[72px] ${
                  isSelected 
                    ? 'text-black font-black scale-[1.03]' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <div className="relative mb-0.5">
                  <item.icon size={18} className={isSelected ? 'text-black stroke-[2.5]' : 'text-slate-400'} />
                  {hasBadge && (
                    <span className={`absolute -top-1 -right-1.5 rounded-full flex items-center justify-center font-black leading-none ${
                      isDot 
                        ? 'w-1.5 h-1.5 bg-emerald-500 ring-1 ring-white' 
                        : 'text-[7px] min-w-3.5 h-3.5 px-0.5 bg-rose-500 text-white ring-1 ring-white'
                    }`}>
                      {!isDot && item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[9px] tracking-tight truncate w-[68px] text-center font-semibold">{item.label}</span>
              </button>
            );
          })}
          {myShiftItem && (
            <button
              onClick={() => onViewChange('my_shift')}
              className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all shrink-0 min-w-[72px] ${
                activeView === 'my_shift'
                  ? 'text-black font-black scale-[1.03]' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="relative mb-0.5">
                <Clock size={18} className={activeView === 'my_shift' ? 'text-black stroke-[2.5]' : 'text-slate-400'} />
              </div>
              <span className="text-[9px] tracking-tight truncate w-[68px] text-center font-semibold">Mi Turno</span>
            </button>
          )}
          <button
            onClick={onLogout}
            className="flex flex-col items-center justify-center p-2 rounded-xl text-rose-500 hover:text-rose-600 transition-colors shrink-0 min-w-[72px]"
          >
            <LogOut size={18} className="mb-0.5" />
            <span className="text-[9px] font-semibold">Salir</span>
          </button>
        </div>
      </nav>
    </>
  );
}
