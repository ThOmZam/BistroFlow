import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Keyboard, 
  Bell, 
  Lock, 
  Command,
  Star,
  ShieldCheck,
  UtensilsCrossed,
  ChefHat,
  DollarSign,
  LayoutDashboard,
  Package,
  Wallet,
  Users,
  UserCheck,
  Sparkles,
  Settings,
  Clock,
  MessageSquare,
  TrendingUp
} from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';
import { useBookmarks } from '../lib/bookmarks';

interface TopBarProps {
  onOpenSearch: () => void;
  onOpenShortcuts: () => void;
  currentUser?: any;
  activeView?: string;
  onViewChange?: (view: string) => void;
  restaurantName?: string;
  logoUrl?: string;
}

const VIEW_LABELS: Record<string, { label: string; icon: any }> = {
  waiter: { label: 'Mesas', icon: UtensilsCrossed },
  kitchen: { label: 'Cocina', icon: ChefHat },
  caja: { label: 'Caja', icon: DollarSign },
  dashboard: { label: 'Inicio', icon: LayoutDashboard },
  menu_settings: { label: 'Menú', icon: UtensilsCrossed },
  inventory: { label: 'Inventario', icon: Package },
  finance: { label: 'Finanzas', icon: Wallet },
  crm: { label: 'Clientes', icon: Users },
  personal: { label: 'Personal', icon: UserCheck },
  marketing: { label: 'Marketing', icon: Sparkles },
  kernel: { label: 'Ajustes', icon: Settings },
  my_shift: { label: 'Mi Turno', icon: Clock },
  chat: { label: 'Chat', icon: MessageSquare },
  analytics: { label: 'Reportes', icon: TrendingUp },
};

import { useRestaurantData } from '../hooks/useRestaurantData';

export default function TopBar({ 
  onOpenSearch, 
  onOpenShortcuts, 
  currentUser, 
  activeView,
  onViewChange,
  restaurantName = "Q' Sandwich",
  logoUrl
}: TopBarProps) {
  const { activeCurrency, currentRateBs } = useCurrency();
  const { bookmarks } = useBookmarks();
  const { settings } = useRestaurantData();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isInsideTable, setIsInsideTable] = useState(false);

  const sidebarTheme = (settings as any)?.sidebarTheme || 'minimalist';
  const bgTheme = (settings as any)?.bgTheme || 'kinetic';
  const brandColor = (settings as any)?.brandColor || '#2563eb';

  const isDark = sidebarTheme === 'dark' || bgTheme === 'dark_luxury';
  const isBrand = sidebarTheme === 'brand';

  // Hide TopBar when waiter is inside a table comanda view
  useEffect(() => {
    const handleTableModal = (e: any) => {
      setIsInsideTable(!!e.detail?.isOpen);
    };
    window.addEventListener('table_modal_state', handleTableModal);
    return () => window.removeEventListener('table_modal_state', handleTableModal);
  }, []);

  // Listen to live notification counts broadcast
  useEffect(() => {
    const handleCounts = (e: any) => {
      if (e.detail && typeof e.detail.unreadCount === 'number') {
        setUnreadCount(e.detail.unreadCount);
      }
    };

    window.addEventListener('notification_counts_updated', handleCounts);
    return () => window.removeEventListener('notification_counts_updated', handleCounts);
  }, []);

  const handleOpenNotifications = () => {
    window.dispatchEvent(new CustomEvent('open_notifications_drawer'));
  };

  const handleOpenBookmarks = () => {
    window.dispatchEvent(new CustomEvent('open_cases_drawer'));
  };

  if (isInsideTable) {
    return null;
  }

  const currentViewInfo = activeView ? VIEW_LABELS[activeView] || { label: activeView, icon: UtensilsCrossed } : null;

  return (
    <header 
      className={`w-full px-3 sm:px-6 py-2 sm:py-2.5 items-center justify-between gap-2 sm:gap-3 shrink-0 z-30 shadow-2xs transition-colors ${
        activeView === 'kitchen' ? 'hidden md:flex' : 'flex'
      } ${
        isDark 
          ? 'bg-[#090D16] text-white border-b border-slate-800/80' 
          : 'bg-white text-slate-900 border-b border-slate-200/90'
      }`}
    >
      {/* Left: Mobile Brand Header & Desktop Omnipresent Search Bar */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0 max-w-full md:max-w-md lg:max-w-xl">
        {/* Mobile-only Branding Header (Logo + Restaurant Name + Active Section) */}
        <div className="flex md:hidden items-center gap-2 min-w-0 shrink-0">
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt={restaurantName} 
              className="w-8 h-8 rounded-xl object-cover border border-slate-200/90 shrink-0 shadow-2xs" 
            />
          ) : (
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center font-black shadow-2xs shrink-0 text-xs">
              {restaurantName ? restaurantName.charAt(0).toUpperCase() : 'Q'}
            </div>
          )}
          <div className="min-w-0 leading-tight">
            <div className="text-xs font-black text-slate-900 tracking-tight truncate max-w-[100px] xs:max-w-[130px]">
              {restaurantName}
            </div>
            {currentViewInfo && (
              <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider block truncate max-w-[90px]">
                {currentViewInfo.label}
              </span>
            )}
          </div>
        </div>

        {/* Desktop Search Bar Trigger */}
        <div className="hidden md:block w-full">
          <button
            onClick={onOpenSearch}
            type="button"
            className="w-full flex items-center justify-between gap-3 bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200/90 hover:border-slate-300 px-3.5 py-2 rounded-xl text-slate-500 hover:text-slate-900 transition-all cursor-pointer group shadow-2xs"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Search size={16} className="text-indigo-600 group-hover:scale-110 transition-transform shrink-0" />
              <span className="text-xs sm:text-sm font-medium truncate">
                Buscar platos, clientes, usuarios, CxC, CxP, ajustes...
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] font-mono font-bold text-slate-500 shadow-2xs">
                <Command size={10} /> K
              </kbd>
            </div>
          </button>
        </div>
      </div>

      {/* Desktop Floating Pill Quick Navigation Bar */}
      {onViewChange && (
        <div className="hidden xl:flex items-center gap-1 bg-slate-100/90 p-1 rounded-full border border-slate-200/90 shadow-2xs select-none">
          {[
            { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
            { id: 'waiter', label: 'POS', icon: UtensilsCrossed },
            { id: 'kitchen', label: 'Cocina', icon: ChefHat },
            { id: 'caja', label: 'Caja', icon: DollarSign },
            { id: 'inventory', label: 'Stock', icon: Package }
          ].map(tab => {
            const isSel = activeView === tab.id;
            const IconComp = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onViewChange(tab.id)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSel 
                    ? 'bg-slate-900 text-white shadow-xs scale-105' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                }`}
              >
                <IconComp size={13} className={isSel ? 'text-amber-400' : 'text-slate-400'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Right Controls: Tasa de Cambio + Search Button + Quick Actions + User Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Mobile Search Icon Button */}
        <button
          onClick={onOpenSearch}
          type="button"
          title="Buscar en el sistema..."
          className="flex md:hidden items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-indigo-600 rounded-xl transition-all cursor-pointer border border-slate-200/90 shadow-2xs active:scale-95"
        >
          <Search size={16} className="text-indigo-600 shrink-0" />
          <span className="hidden xs:inline text-xs font-bold text-slate-700">Buscar</span>
        </button>

        {/* Currency Exchange Rate Badge (Compact on Mobile, Full on Desktop) */}
        <div 
          title="Moneda y tasa de cambio configuradas por el Administrador"
          className="flex items-center gap-1 sm:gap-2 bg-emerald-50 border border-emerald-200/90 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs select-none shadow-2xs"
        >
          <Lock size={12} className="text-emerald-700 shrink-0 hidden sm:inline" />
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
            <span className="hidden sm:inline">Tasa {activeCurrency}: </span>
            <span className="sm:hidden">Bs.</span>
          </span>
          <span className="font-mono font-black text-emerald-900 text-xs">
            <span className="hidden sm:inline">Bs. </span>{currentRateBs.toFixed(2)}
          </span>
        </div>

        {/* Keyboard Shortcuts Trigger (Desktop only) */}
        <button
          onClick={onOpenShortcuts}
          type="button"
          title="Atajos de Teclado (F1 / Ctrl+K)"
          className="hidden md:flex p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-black rounded-xl transition-all cursor-pointer relative shadow-2xs border border-slate-200 hover:scale-105 active:scale-95"
        >
          <Keyboard size={18} />
        </button>

        {/* Favoritos & Monitoreo Directo */}
        <button
          onClick={handleOpenBookmarks}
          type="button"
          title="Favoritos & Monitoreo"
          className="p-1.5 sm:p-2 bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-600 rounded-xl transition-all cursor-pointer relative shadow-2xs border border-slate-200 hover:scale-105 active:scale-95"
        >
          <Star size={16} className={bookmarks.length > 0 ? "fill-amber-400 text-amber-500" : "text-slate-600"} />
          {bookmarks.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center border border-white shadow-xs">
              {bookmarks.length > 9 ? '9+' : bookmarks.length}
            </span>
          )}
        </button>

        {/* Notificaciones & Alertas */}
        <button
          onClick={handleOpenNotifications}
          type="button"
          title="Alertas & Notificaciones del Sistema"
          className="p-1.5 sm:p-2 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 rounded-xl transition-all cursor-pointer relative shadow-2xs border border-slate-200 hover:scale-105 active:scale-95"
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[9px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center border border-white shadow-xs animate-bounce">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* User Profile Pill */}
        {currentUser && (
          <div className="flex items-center gap-1.5 sm:gap-2 sm:pl-2.5 sm:ml-1 sm:border-l border-slate-200/80">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-900 text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0 ring-1 ring-slate-200">
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="hidden lg:block text-left leading-tight">
              <div className="text-xs font-black text-slate-900 truncate max-w-[100px]">
                {currentUser.name || 'Usuario'}
              </div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-0.5">
                {currentUser.role === 'admin' ? (
                  <span className="text-indigo-600 flex items-center gap-0.5 font-extrabold">
                    <ShieldCheck size={10} /> Admin
                  </span>
                ) : (
                  <span className="text-slate-500 capitalize">
                    {currentUser.role}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
