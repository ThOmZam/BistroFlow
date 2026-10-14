import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard,
  Store,
  ChefHat,
  Package,
  Truck,
  Users,
  MessageSquare,
  Wallet,
  Coins,
  DollarSign,
  UserCheck,
  ShieldCheck,
  User,
  Clock,
  TrendingUp,
  Sparkles,
  Settings,
  Volume2,
  VolumeX,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Flame,
  Terminal,
  UtensilsCrossed
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, query, where, collectionGroup } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Role } from '../types';
import { playSuccessSound } from '../lib/audio';

interface SidebarProps {
  role: Role;
  onLogout: () => void;
  activeView: string;
  onViewChange: (view: string) => void;
  restaurantName?: string;
  logoUrl?: string;
  slogan?: string;
  hasActiveClockIn?: boolean;
}

export default function Sidebar({ 
  role, 
  onLogout, 
  activeView, 
  onViewChange, 
  restaurantName = 'BistroFlow',
  logoUrl,
  slogan = 'SISTEMA GASTRONÓMICO & POS',
  hasActiveClockIn 
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  // Sound state
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('notif_sound_enabled') !== 'false';
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
      },
      () => {}
    );

    // 2. Active sessions with pending payment validations
    const unsubSessions = onSnapshot(
      query(collection(db, 'sessions'), where('status', '==', 'active')),
      (snap) => {
        const active = snap.docs.map(d => d.data());
        const pendingVal = active.filter(s => s.paymentStatus === 'pending_validation' || s.paymentStatus === 'pending_credit_approval');
        setCajaPendingCount(pendingVal.length);
      },
      () => {}
    );

    // 3. Count actual pending orders in kitchen queue
    const unsubKitchen = onSnapshot(
      query(collectionGroup(db, 'orders'), where('status', '==', 'pending')),
      (snap) => {
        setKitchenActiveCount(snap.size);
      },
      () => {}
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
    }, () => {});

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

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('notif_sound_enabled', String(next));
    window.dispatchEvent(new Event('storage'));
    if (next) {
      try { playSuccessSound(); } catch {}
    }
  };

  // Structured menu divided by sections matching the user's design reference
  const menuSections = [
    {
      category: 'OPERACIÓN & VENTAS',
      items: [
        { id: 'dashboard', label: 'Panel General', icon: LayoutDashboard, roles: ['admin', 'waiter', 'cook', 'finance'], badge: 0 },
        { id: 'waiter', label: 'Terminal POS', icon: Store, roles: ['admin', 'waiter'], badge: tableWaitingBillCount },
        { id: 'kitchen', label: 'Cocina (KDS)', icon: ChefHat, roles: ['admin', 'cook'], badge: kitchenActiveCount },
        { id: 'inventory', label: 'Inventario & Stock', icon: Package, roles: ['admin'], badge: 0 },
        { id: 'crm', label: 'Clientes & Fiado', icon: Users, roles: ['admin'], badge: 0 },
        { id: 'chat', label: 'Chat Interno', icon: MessageSquare, roles: ['admin', 'waiter', 'cook', 'finance'], badge: chatMessagesCount > 0 ? '•' : 0 }
      ]
    },
    {
      category: 'CAJA & CONTROL',
      items: [
        { id: 'caja', label: 'Caja & Finanzas', icon: Wallet, roles: ['admin', 'finance'], badge: cajaPendingCount },
        { id: 'finance', label: 'Balances & Reportes', icon: DollarSign, roles: ['admin'], badge: 0 },
        { id: 'personal', label: 'Personal & Turnos', icon: UserCheck, roles: ['admin'], badge: 0 },
        { id: 'kernel', label: 'Bitácora de Auditoría', icon: ShieldCheck, roles: ['admin'], badge: 0 },
        { id: 'my_shift', label: 'Mi Turno & Perfil', icon: User, roles: ['admin', 'waiter', 'cook', 'finance'], badge: 0 }
      ]
    },
    {
      category: 'ESTRATEGIA & AJUSTES',
      items: [
        { id: 'analytics', label: 'Estadísticas & IA', icon: TrendingUp, roles: ['admin'], badge: 0 },
        { id: 'marketing', label: 'Marketing & Cupones', icon: Sparkles, roles: ['admin'], badge: 0 },
        { id: 'menu_settings', label: 'Configuración', icon: Settings, roles: ['admin'], badge: 0 }
      ]
    }
  ];

  // Filter sections and items based on active user role
  const visibleSections = menuSections
    .map(section => ({
      ...section,
      items: section.items.filter(item => item.roles.includes(role))
    }))
    .filter(section => section.items.length > 0);

  // Flat list for mobile bar
  const allVisibleItems = visibleSections.flatMap(s => s.items);

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 80 : 272 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="hidden md:flex h-screen bg-white border-r border-slate-100 flex-col relative z-50 shadow-xs select-none shrink-0"
      >
        {/* Top Header: Business Logo, Name, Slogan & Collapse Toggle */}
        <div className={`pt-5 pb-3 border-b border-slate-100/70 transition-all ${isCollapsed ? 'px-3 flex flex-col items-center justify-center' : 'px-4 flex items-center justify-between gap-2.5'}`}>
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <button 
                onClick={toggleCollapse}
                title="Expandir menú"
                className="w-11 h-11 rounded-full border border-slate-100 bg-[#EEF4FF] overflow-hidden flex items-center justify-center shadow-xs hover:ring-2 hover:ring-blue-200 transition-all cursor-pointer group"
              >
                {logoUrl ? (
                  <img src={logoUrl} alt={restaurantName} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-black text-blue-600 text-sm group-hover:scale-110 transition-transform">
                    {restaurantName.charAt(0).toUpperCase()}
                  </span>
                )}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Circular Brand Avatar */}
                <div className="w-11 h-11 rounded-full border border-slate-100 bg-[#EEF4FF] overflow-hidden flex items-center justify-center shadow-xs shrink-0">
                  {logoUrl ? (
                    <img src={logoUrl} alt={restaurantName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-black text-blue-600 text-base">
                      {restaurantName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Brand Name & Tagline */}
                <div className="min-w-0 flex-1">
                  <h1 className="font-black text-slate-900 text-sm tracking-tight truncate leading-tight">
                    {restaurantName}
                  </h1>
                  <p className="text-[9.5px] font-bold text-slate-400 tracking-wider uppercase truncate mt-0.5">
                    {slogan}
                  </p>
                </div>
              </div>

              {/* Collapse Round Button */}
              <button 
                onClick={toggleCollapse}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors shrink-0"
                title="Contraer menú"
              >
                <ChevronLeft size={15} strokeWidth={2.5} />
              </button>
            </>
          )}
        </div>

        {/* Scrollable Navigation Sections */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 scrollbar-none space-y-3">
          {visibleSections.map((section, sectionIdx) => (
            <div key={section.category} className="space-y-0.5">
              {/* Section Header or Divider */}
              {!isCollapsed ? (
                <div className={`text-[10px] font-bold text-slate-400 tracking-wider px-3.5 uppercase ${sectionIdx === 0 ? 'pt-1.5 pb-1.5' : 'pt-3 pb-1.5'}`}>
                  {section.category}
                </div>
              ) : (
                sectionIdx > 0 && <div className="w-8 mx-auto my-2 border-t border-slate-200/60" />
              )}

              {/* Section Items */}
              {section.items.map((item) => {
                const isSelected = activeView === item.id;
                const hasBadge = !!item.badge;
                const isDot = item.badge === '•';
                const IconComponent = item.icon;

                return (
                  <button
                    key={item.id}
                    onClick={() => onViewChange(item.id)}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full flex items-center transition-all relative ${
                      isCollapsed 
                        ? 'justify-center p-2.5 rounded-2xl my-0.5' 
                        : 'gap-3.5 px-3.5 py-2.5 rounded-2xl my-0.5 text-left'
                    } ${
                      isSelected 
                        ? 'bg-[#EEF4FF] text-blue-600 font-bold shadow-xs' 
                        : 'text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {/* Active Curved Left Indicator Accent (Exact Match to Screenshot) */}
                    {isSelected && (
                      <span className={`absolute left-0 bg-blue-600 rounded-r-full ${
                        isCollapsed ? 'top-2 bottom-2 w-1' : 'top-1.5 bottom-1.5 w-1'
                      }`} />
                    )}

                    {/* Icon with notification badge */}
                    <div className="relative shrink-0 flex items-center justify-center">
                      <IconComponent 
                        size={20} 
                        className={`transition-colors ${
                          isSelected ? 'text-blue-600 stroke-[2.25]' : 'text-slate-400 stroke-[1.85]'
                        }`} 
                      />
                      {hasBadge && (
                        <span className={`absolute -top-1.5 -right-1.5 rounded-full flex items-center justify-center font-black leading-none ${
                          isDot 
                            ? 'w-2 h-2 bg-emerald-500 ring-2 ring-white' 
                            : 'text-[8.5px] min-w-4 h-4 px-1 bg-rose-500 text-white ring-2 ring-white shadow-xs'
                        }`}>
                          {!isDot && item.badge}
                        </span>
                      )}
                    </div>

                    {/* Label */}
                    {!isCollapsed && (
                      <span className={`text-xs truncate tracking-tight ${
                        isSelected ? 'font-bold text-blue-600' : 'font-medium text-slate-700'
                      }`}>
                        {item.label}
                      </span>
                    )}

                    {/* Clock-in badge indicator for "Mi Turno" */}
                    {!isCollapsed && item.id === 'my_shift' && role !== 'admin' && (
                      <span className={`ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        hasActiveClockIn ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800 animate-pulse'
                      }`}>
                        {hasActiveClockIn ? 'En Turno' : 'Fichar'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom Section: Divider, Sound Toggle, Logout & Footer Branding */}
        <div className="px-3 pt-1 pb-3 shrink-0 space-y-1">
          {/* Subtle Divider */}
          <div className="border-t border-slate-100/90 my-1.5 mx-1" />

          {/* Sound Toggle (Exact match: Green speaker) */}
          <button
            onClick={toggleSound}
            title={soundEnabled ? 'Silenciar sonidos del sistema' : 'Activar sonidos del sistema'}
            className={`w-full flex items-center transition-colors rounded-2xl ${
              isCollapsed 
                ? 'justify-center p-2.5 hover:bg-slate-50' 
                : 'gap-3 px-3.5 py-2.5 hover:bg-slate-50 text-left'
            }`}
          >
            <div className="shrink-0 flex items-center justify-center">
              {soundEnabled ? (
                <Volume2 size={20} className="text-emerald-500 stroke-[2.25]" />
              ) : (
                <VolumeX size={20} className="text-slate-400 stroke-[2.25]" />
              )}
            </div>
            {!isCollapsed && (
              <span className="text-xs font-semibold text-slate-700 truncate">
                {soundEnabled ? 'Sonido Activado' : 'Sonido Silenciado'}
              </span>
            )}
          </button>

          {/* Cerrar Sesión (Exact match: Red logout button) */}
          <button
            id="desktop-logout-btn"
            onClick={onLogout}
            title="Cerrar Sesión"
            className={`w-full flex items-center transition-colors rounded-2xl ${
              isCollapsed 
                ? 'justify-center p-2.5 hover:bg-rose-50 text-rose-600' 
                : 'gap-3 px-3.5 py-2.5 hover:bg-rose-50 text-left text-rose-600 font-bold'
            }`}
          >
            <div className="shrink-0 flex items-center justify-center">
              <LogOut size={20} className="text-rose-500 stroke-[2.25]" />
            </div>
            {!isCollapsed && (
              <span className="text-xs font-bold text-rose-600 truncate">
                Cerrar Sesión
              </span>
            )}
          </button>

          {/* Bottom Brand / PRO Footer (Exact match from screenshot) */}
          {!isCollapsed && (
            <div className="pt-2 text-center select-none">
              <p className="text-[9px] font-black tracking-widest text-slate-400 uppercase">
                {restaurantName || 'BISTROFLOW'} POS • <span className="text-blue-600 font-black">PRO</span>
              </p>
            </div>
          )}
        </div>
      </motion.aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1 px-2 w-full justify-start select-none touch-pan-x -webkit-overflow-scrolling-touch">
          {allVisibleItems.map((item) => {
            const isSelected = activeView === item.id;
            const hasBadge = !!item.badge;
            const isDot = item.badge === '•';
            const IconComponent = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all shrink-0 min-w-[70px] ${
                  isSelected 
                    ? 'text-blue-600 font-bold scale-[1.02] bg-blue-50/60' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <div className="relative mb-0.5">
                  <IconComponent 
                    size={18} 
                    className={isSelected ? 'text-blue-600 stroke-[2.5]' : 'text-slate-400 stroke-[1.8]'} 
                  />
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
                <span className="text-[9px] tracking-tight truncate w-[66px] text-center font-semibold">
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* Mobile Sound Toggle */}
          <button
            onClick={toggleSound}
            className="flex flex-col items-center justify-center p-2 rounded-xl text-emerald-600 hover:text-emerald-700 transition-colors shrink-0 min-w-[65px]"
          >
            {soundEnabled ? (
              <Volume2 size={18} className="mb-0.5 text-emerald-500" />
            ) : (
              <VolumeX size={18} className="mb-0.5 text-slate-400" />
            )}
            <span className="text-[9px] font-semibold text-slate-600">Audio</span>
          </button>

          {/* Mobile Logout */}
          <button
            onClick={onLogout}
            className="flex flex-col items-center justify-center p-2 rounded-xl text-rose-500 hover:text-rose-600 transition-colors shrink-0 min-w-[65px]"
          >
            <LogOut size={18} className="mb-0.5 text-rose-500" />
            <span className="text-[9px] font-bold text-rose-600">Salir</span>
          </button>
        </div>
      </nav>
    </>
  );
}
