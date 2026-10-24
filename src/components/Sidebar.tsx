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
  UtensilsCrossed,
  Plus,
  X,
  Grid,
  LayoutGrid
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, query, where, collectionGroup } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Role } from '../types';
import { playSuccessSound } from '../lib/audio';
import { useRestaurantData } from '../hooks/useRestaurantData';

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

  const [isInsideTable, setIsInsideTable] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);

  useEffect(() => {
    setIsMobileMoreOpen(false);
  }, [activeView]);

  // Hide mobile bottom navigation bar when inside a table comanda modal
  useEffect(() => {
    const handleTableModal = (e: any) => {
      setIsInsideTable(!!e.detail?.isOpen);
    };
    window.addEventListener('table_modal_state', handleTableModal);
    return () => window.removeEventListener('table_modal_state', handleTableModal);
  }, []);

  // Alert Badge states
  const [tableWaitingBillCount, setTableWaitingBillCount] = useState(0);
  const [cajaPendingCount, setCajaPendingCount] = useState(0);
  const [kitchenActiveCount, setKitchenActiveCount] = useState(0);
  const [chatMessagesCount, setChatMessagesCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);

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

    // 5. Count low stock items in ingredients for Stock badge
    const unsubIngredients = onSnapshot(collection(db, 'ingredients'), (snap) => {
      const low = snap.docs.filter(d => {
        const data = d.data();
        const stock = Number(data.stock ?? 0);
        const minStock = Number(data.minStock ?? 5);
        return stock <= minStock;
      });
      setLowStockCount(low.length);
    }, () => {});

    return () => {
      unsubTables();
      unsubSessions();
      unsubKitchen();
      unsubChats();
      unsubIngredients();
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

  const [, setSettingsTick] = useState(0);

  useEffect(() => {
    const handleSettingsUpdate = () => setSettingsTick(t => t + 1);
    window.addEventListener('settings_updated', handleSettingsUpdate);
    window.addEventListener('storage', handleSettingsUpdate);
    return () => {
      window.removeEventListener('settings_updated', handleSettingsUpdate);
      window.removeEventListener('storage', handleSettingsUpdate);
    };
  }, []);

  const { settings } = useRestaurantData();
  const localKitchenMode = localStorage.getItem('kitchenMode');
  const isDirectPrint = localKitchenMode ? localKitchenMode === 'direct_print' : (settings as any)?.kitchenMode === 'direct_print';

  const localAllowCashier = localStorage.getItem('allowCashierPos');
  const allowCashierPos = localAllowCashier !== null ? localAllowCashier === 'true' : ((settings as any)?.allowCashierPos !== undefined ? (settings as any).allowCashierPos : true);

  const waiterRoles = ['admin', 'waiter', ...(allowCashierPos ? ['finance'] : [])];

  // Structured menu divided by sections matching the user's design reference
  const menuSections = [
    {
      category: 'OPERACIÓN & VENTAS',
      items: [
        { id: 'dashboard', label: 'Panel General', icon: LayoutDashboard, roles: ['admin', 'waiter', 'cook', 'finance'], badge: 0 },
        { id: 'waiter', label: 'Terminal POS', icon: Store, roles: waiterRoles, badge: tableWaitingBillCount },
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

  // Filter sections and items based on active user role & kitchen mode
  const visibleSections = menuSections
    .map(section => ({
      ...section,
      items: section.items.filter(item => {
        if (item.id === 'kitchen' && isDirectPrint) return false;
        return item.roles.includes(role);
      })
    }))
    .filter(section => section.items.length > 0);

  // Flat list for mobile bar
  const allVisibleItems = visibleSections.flatMap(s => s.items);

  // Fixed 4 primary buttons + 1 "Más" button for mobile matching Screenshot 1:
  // 1. Inicio (LayoutGrid)
  // 2. POS (Store)
  // 3. Caja (Wallet)
  // 4. Stock (Package)
  const mobilePrimaryTabs = [
    { id: 'dashboard', label: 'Inicio', icon: LayoutGrid, badge: 0 },
    { id: 'waiter', label: 'POS', icon: Store, badge: tableWaitingBillCount },
    { id: 'caja', label: 'Caja', icon: Wallet, badge: cajaPendingCount },
    { id: 'inventory', label: 'Stock', icon: Package, badge: lowStockCount },
  ];

  const primaryIds = mobilePrimaryTabs.map(t => t.id);
  const isMoreSelected = !primaryIds.includes(activeView);

  // Tools list for "Más Herramientas" drawer matching Screenshot 2:
  const moreToolsList = [
    {
      id: 'compras',
      title: 'Compras & Proveedores',
      subtitle: 'Órdenes de compra y gestión de proveedores',
      icon: Truck,
      roles: ['admin'],
      action: () => {
        onViewChange('inventory');
        setIsMobileMoreOpen(false);
      }
    },
    {
      id: 'crm',
      title: 'Clientes & Fiado (CRM)',
      subtitle: 'Deudas, abonos e historial de clientes',
      icon: Users,
      roles: ['admin'],
      action: () => {
        onViewChange('crm');
        setIsMobileMoreOpen(false);
      }
    },
    {
      id: 'finance',
      title: 'Caja & Finanzas',
      subtitle: 'Cierre Z, flujo de caja e ingresos',
      icon: Wallet,
      roles: ['admin', 'finance'],
      action: () => {
        onViewChange('finance');
        setIsMobileMoreOpen(false);
      }
    },
    {
      id: 'analytics',
      title: 'Estadísticas & IA',
      subtitle: 'Métricas de ventas y Asistente IA',
      icon: TrendingUp,
      roles: ['admin'],
      action: () => {
        onViewChange('analytics');
        setIsMobileMoreOpen(false);
      }
    },
    {
      id: 'marketing',
      title: 'Marketing & Descuentos',
      subtitle: 'Cupones y promociones',
      icon: Sparkles,
      roles: ['admin'],
      action: () => {
        onViewChange('marketing');
        setIsMobileMoreOpen(false);
      }
    },
    {
      id: 'personal',
      title: 'Personal & Turnos',
      subtitle: 'PINs de acceso, cajeros/contadores y asistencia',
      icon: UserCheck,
      roles: ['admin'],
      action: () => {
        onViewChange('personal');
        setIsMobileMoreOpen(false);
      }
    },
    {
      id: 'kernel',
      title: 'Bitácora de Auditoría',
      subtitle: 'Trazabilidad forense e historial de cambios global',
      icon: ShieldCheck,
      roles: ['admin'],
      action: () => {
        onViewChange('kernel');
        setIsMobileMoreOpen(false);
      }
    },
    {
      id: 'menu_settings',
      title: 'Configuración del Menú',
      subtitle: 'Platos, combos, mesas y ajustes del local',
      icon: Settings,
      roles: ['admin'],
      action: () => {
        onViewChange('menu_settings');
        setIsMobileMoreOpen(false);
      }
    },
    {
      id: 'kitchen',
      title: 'Cocina (KDS)',
      subtitle: 'Monitor de comandas y tiempos de preparación',
      icon: ChefHat,
      roles: ['admin', 'cook'],
      action: () => {
        onViewChange('kitchen');
        setIsMobileMoreOpen(false);
      }
    },
    {
      id: 'chat',
      title: 'Chat del Equipo',
      subtitle: 'Comunicación interna entre colaboradores',
      icon: MessageSquare,
      roles: ['admin', 'waiter', 'cook', 'finance'],
      badge: chatMessagesCount > 0 ? '•' : 0,
      action: () => {
        onViewChange('chat');
        setIsMobileMoreOpen(false);
      }
    },
    {
      id: 'my_shift',
      title: 'Mi Turno & Perfil',
      subtitle: 'Control de asistencia, horario y perfil personal',
      icon: User,
      roles: ['admin', 'waiter', 'cook', 'finance'],
      action: () => {
        onViewChange('my_shift');
        setIsMobileMoreOpen(false);
      }
    }
  ].filter(tool => tool.roles.includes(role));

  const moreHasBadge = moreToolsList.some(tool => !!tool.badge);

  const sidebarTheme = (settings as any)?.sidebarTheme || localStorage.getItem('restaurant_sidebar_theme') || 'minimalist';
  const bgTheme = (settings as any)?.bgTheme || localStorage.getItem('restaurant_bg_theme') || 'kinetic';
  const rawBrandColor = (settings as any)?.brandColor || localStorage.getItem('restaurant_brand_color') || '#2563eb';
  const isWhiteOrLight = !rawBrandColor || rawBrandColor.toLowerCase() === '#ffffff' || rawBrandColor.toLowerCase() === '#fff' || rawBrandColor.toLowerCase() === 'white';
  const safeBrandColor = isWhiteOrLight ? '#2563eb' : rawBrandColor;
  const brandColor = rawBrandColor;

  const isDarkSidebar = sidebarTheme === 'dark' || bgTheme === 'dark_luxury';
  const isBrandSidebar = sidebarTheme === 'brand';

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 80 : 272 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        style={isBrandSidebar ? { backgroundColor: brandColor } : undefined}
        className={`hidden md:flex h-screen flex-col relative z-50 select-none shrink-0 transition-colors ${
          isDarkSidebar 
            ? 'bg-[#0B0F17] text-white border-r border-slate-800/80 shadow-2xl' 
            : isBrandSidebar 
              ? 'text-white border-r border-white/10 shadow-2xl' 
              : 'bg-white text-slate-900 border-r border-slate-100 shadow-xs'
        }`}
      >
        {/* Top Header: Business Logo, Name, Slogan & Collapse Toggle */}
        <div className={`pt-5 pb-3 transition-all ${
          isDarkSidebar 
            ? 'border-b border-slate-800/70' 
            : isBrandSidebar 
              ? 'border-b border-white/15' 
              : 'border-b border-slate-100/70'
        } ${isCollapsed ? 'px-3 flex flex-col items-center justify-center' : 'px-4 flex items-center justify-between gap-2.5'}`}>
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <button 
                onClick={toggleCollapse}
                title="Expandir menú"
                className={`w-11 h-11 rounded-full border overflow-hidden flex items-center justify-center shadow-xs transition-all cursor-pointer group ${
                  isDarkSidebar 
                    ? 'border-slate-800 bg-slate-900 text-white' 
                    : isBrandSidebar 
                      ? 'border-white/20 bg-white/10 text-white' 
                      : 'border-slate-100 bg-[#EEF4FF] text-blue-600'
                }`}
              >
                {logoUrl ? (
                  <img src={logoUrl} alt={restaurantName} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-black text-sm group-hover:scale-110 transition-transform">
                    {restaurantName.charAt(0).toUpperCase()}
                  </span>
                )}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Circular Brand Avatar */}
                <div className={`w-11 h-11 rounded-full border overflow-hidden flex items-center justify-center shadow-xs shrink-0 ${
                  isDarkSidebar 
                    ? 'border-slate-800 bg-slate-900 text-white' 
                    : isBrandSidebar 
                      ? 'border-white/20 bg-white/10 text-white' 
                      : 'border-slate-100 bg-[#EEF4FF] text-blue-600'
                }`}>
                  {logoUrl ? (
                    <img src={logoUrl} alt={restaurantName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-black text-base">
                      {restaurantName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Brand Name & Tagline */}
                <div className="min-w-0 flex-1">
                  <h1 className={`font-black text-sm tracking-tight truncate leading-tight ${
                    isDarkSidebar || isBrandSidebar ? 'text-white' : 'text-slate-900'
                  }`}>
                    {restaurantName}
                  </h1>
                  <p className={`text-[9.5px] font-bold tracking-wider uppercase truncate mt-0.5 ${
                    isDarkSidebar ? 'text-slate-400' : isBrandSidebar ? 'text-white/70' : 'text-slate-400'
                  }`}>
                    {slogan}
                  </p>
                </div>
              </div>

              {/* Collapse Round Button */}
              <button 
                onClick={toggleCollapse}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                  isDarkSidebar 
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' 
                    : isBrandSidebar 
                      ? 'bg-white/20 hover:bg-white/30 text-white' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
                }`}
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
                <div className={`text-[10px] font-bold tracking-wider px-3.5 uppercase ${
                  isDarkSidebar ? 'text-slate-500' : isBrandSidebar ? 'text-white/60' : 'text-slate-400'
                } ${sectionIdx === 0 ? 'pt-1.5 pb-1.5' : 'pt-3 pb-1.5'}`}>
                  {section.category}
                </div>
              ) : (
                sectionIdx > 0 && <div className={`w-8 mx-auto my-2 border-t ${
                  isDarkSidebar ? 'border-slate-800' : isBrandSidebar ? 'border-white/20' : 'border-slate-200/60'
                }`} />
              )}

              {/* Section Items */}
              {section.items.map((item) => {
                const isSelected = activeView === item.id;
                const hasBadge = !!item.badge;
                const isDot = item.badge === '•';
                const IconComponent = item.icon;

                const buttonClass = isSelected
                  ? isBrandSidebar
                    ? 'bg-white text-slate-900 font-black shadow-md'
                    : isDarkSidebar
                      ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/30'
                      : 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20'
                  : isBrandSidebar
                    ? 'text-white/80 hover:bg-white/15 hover:text-white font-medium'
                    : isDarkSidebar
                      ? 'text-slate-400 hover:bg-slate-800/60 hover:text-white font-medium'
                      : 'text-slate-600 font-medium hover:bg-slate-100/80 hover:text-slate-900';

                return (
                  <button
                    key={item.id}
                    onClick={() => onViewChange(item.id)}
                    title={isCollapsed ? item.label : undefined}
                    style={isSelected && !isBrandSidebar && brandColor ? { backgroundColor: brandColor } : undefined}
                    className={`w-full flex items-center transition-all relative ${
                      isCollapsed 
                        ? 'justify-center p-2.5 rounded-full my-0.5' 
                        : 'gap-3.5 px-4 py-2.5 rounded-full my-0.5 text-left'
                    } ${buttonClass}`}
                  >
                    {/* Active Curved Left Indicator Accent */}
                    {isSelected && (
                      <span className="absolute left-0 bg-white/80 rounded-r-full top-2 bottom-2 w-1" />
                    )}

                    {/* Icon with notification badge */}
                    <div className="relative shrink-0 flex items-center justify-center">
                      <IconComponent 
                        size={19} 
                        className={`transition-colors ${
                          isSelected 
                            ? isBrandSidebar ? 'text-slate-900 stroke-[2.5]' : 'text-white stroke-[2.25]' 
                            : isDarkSidebar ? 'text-slate-400 stroke-[1.85]' : isBrandSidebar ? 'text-white/80 stroke-[1.85]' : 'text-slate-500 stroke-[1.85]'
                        }`} 
                      />
                      {hasBadge && (
                        <span className={`absolute -top-1.5 -right-1.5 rounded-full flex items-center justify-center font-black leading-none ${
                          isDot 
                            ? 'w-2 h-2 bg-emerald-400 ring-2 ring-blue-600' 
                            : 'text-[8.5px] min-w-4 h-4 px-1 bg-rose-500 text-white ring-2 ring-white shadow-xs'
                        }`}>
                          {!isDot && item.badge}
                        </span>
                      )}
                    </div>

                    {/* Label */}
                    {!isCollapsed && (
                      <span className={`text-xs truncate tracking-tight ${
                        isSelected 
                          ? isBrandSidebar ? 'font-black text-slate-900' : 'font-bold text-white' 
                          : 'font-medium'
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
                {restaurantName || 'BISTROFLOW'} POS • <span className="text-blue-600 font-black">PRO</span> • <span className="text-slate-500 font-mono">v1.2.5</span>
              </p>
            </div>
          )}
        </div>
      </motion.aside>

      {/* Mobile Suspended Floating Pill Navigation Dock (Menú Flotante Píldora - Exact match from reference) */}
      {!isInsideTable && (
        <>
          <nav 
            aria-label="Navegación Móvil"
            className="md:hidden fixed bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-50 bg-white border border-slate-200/90 shadow-[0_12px_28px_rgba(0,0,0,0.12),0_4px_10px_rgba(0,0,0,0.06)] rounded-full p-1.5 grid grid-cols-5 items-center w-[92vw] max-w-[400px] select-none ring-1 ring-black/[0.04]"
          >
            {mobilePrimaryTabs.map((item) => {
              const isSelected = activeView === item.id && !isMobileMoreOpen;
              const hasBadge = !!item.badge;
              const IconComponent = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setIsMobileMoreOpen(false);
                    onViewChange(item.id);
                  }}
                  style={isSelected ? { backgroundColor: safeBrandColor, color: '#ffffff' } : undefined}
                  className={`relative flex flex-col items-center justify-center h-[48px] rounded-full transition-all duration-200 cursor-pointer ${
                    isSelected 
                      ? 'bg-[#2563EB] text-white shadow-md shadow-blue-500/25' 
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="relative flex items-center justify-center">
                    <IconComponent 
                      size={18} 
                      className={isSelected ? 'text-white stroke-[2.2]' : 'text-slate-700 stroke-[1.9]'} 
                    />
                    {hasBadge && (
                      <span className="absolute -top-1 -right-2 text-[9px] min-w-[16px] h-4 px-1 bg-rose-500 text-white rounded-full flex items-center justify-center font-black ring-2 ring-white shadow-xs">
                        {typeof item.badge === 'number' && item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] tracking-tight mt-0.5 leading-none ${
                    isSelected ? 'text-white font-bold' : 'text-slate-700 font-semibold'
                  }`}>
                    {item.label}
                  </span>
                </button>
              );
            })}

            {/* 5th Pill button: "Más" */}
            <button
              onClick={() => setIsMobileMoreOpen(prev => !prev)}
              style={isMoreSelected || isMobileMoreOpen ? { backgroundColor: safeBrandColor, color: '#ffffff' } : undefined}
              className={`relative flex flex-col items-center justify-center h-[48px] rounded-full transition-all duration-200 cursor-pointer ${
                isMoreSelected || isMobileMoreOpen
                  ? 'bg-[#2563EB] text-white shadow-md shadow-blue-500/25' 
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Sparkles 
                  size={18} 
                  className={isMoreSelected || isMobileMoreOpen ? 'text-white stroke-[2.2]' : 'text-slate-700 stroke-[1.9]'} 
                />
                {moreHasBadge && (
                  <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white shadow-xs" />
                )}
              </div>
              <span className={`text-[10px] tracking-tight mt-0.5 leading-none ${
                isMoreSelected || isMobileMoreOpen ? 'text-white font-bold' : 'text-slate-700 font-semibold'
              }`}>
                Más
              </span>
            </button>
          </nav>

          {/* Slide-up Sheet for "Más Herramientas" matching Screenshot 2 */}
          <AnimatePresence>
            {isMobileMoreOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsMobileMoreOpen(false)}
                  className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-50 cursor-pointer"
                />
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                  className="md:hidden fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] border-t border-slate-100 z-50 p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl max-h-[85vh] flex flex-col"
                >
                  {/* Sheet Header matching Screenshot 2 */}
                  <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-3.5 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Sparkles size={20} className="stroke-[2.2]" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-base leading-tight">Más Herramientas</h3>
                        <p className="text-xs text-slate-400 font-normal mt-0.5">Gestión avanzada del negocio</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsMobileMoreOpen(false)}
                      className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                      title="Cerrar"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Single column tool card list matching Screenshot 2 */}
                  <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 scrollbar-thin">
                    {moreToolsList.map((tool) => (
                      <button
                        key={tool.id}
                        onClick={tool.action}
                        className={`w-full bg-slate-50/70 hover:bg-slate-100/90 border rounded-2xl p-3.5 flex items-center gap-3.5 transition-all text-left cursor-pointer group ${
                          activeView === tool.id ? 'border-blue-400 bg-blue-50/50 shadow-2xs' : 'border-slate-100/90'
                        }`}
                      >
                        <div className="w-11 h-11 rounded-xl bg-white shadow-2xs border border-slate-100/90 flex items-center justify-center text-slate-700 shrink-0 group-hover:scale-105 transition-transform">
                          <tool.icon size={22} className={activeView === tool.id ? 'text-blue-600' : 'text-slate-700 stroke-[1.8]'} />
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <h4 className="text-sm font-bold text-slate-900 leading-snug truncate">{tool.title}</h4>
                          <p className="text-xs text-slate-400 font-normal mt-0.5 truncate">{tool.subtitle}</p>
                        </div>
                        {tool.badge ? (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-rose-500 text-white shrink-0">
                            {tool.badge}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>

                  {/* Bottom Actions: Audio Toggle & Logout */}
                  <div className="pt-3.5 border-t border-slate-100 mt-3 grid grid-cols-2 gap-2 shrink-0">
                    <button
                      onClick={toggleSound}
                      className="flex items-center justify-center gap-2 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
                    >
                      {soundEnabled ? (
                        <>
                          <Volume2 size={16} className="text-emerald-500" />
                          <span>Audio Activo</span>
                        </>
                      ) : (
                        <>
                          <VolumeX size={16} className="text-slate-400" />
                          <span>Sin Audio</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setIsMobileMoreOpen(false);
                        onLogout();
                      }}
                      className="flex items-center justify-center gap-2 p-3 bg-rose-50 hover:bg-rose-100 rounded-xl text-xs font-bold text-rose-600 cursor-pointer"
                    >
                      <LogOut size={16} />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}
    </>
  );
}
