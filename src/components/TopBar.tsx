import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Keyboard, 
  Bell, 
  Lock, 
  Command,
  Star,
  UserCheck,
  ShieldCheck
} from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';
import { useBookmarks } from '../lib/bookmarks';

interface TopBarProps {
  onOpenSearch: () => void;
  onOpenShortcuts: () => void;
  currentUser?: any;
}

export default function TopBar({ onOpenSearch, onOpenShortcuts, currentUser }: TopBarProps) {
  const { activeCurrency, currentRateBs } = useCurrency();
  const { bookmarks } = useBookmarks();
  const [unreadCount, setUnreadCount] = useState(0);

  // Listen to live counts broadcast by NotificationManager
  useEffect(() => {
    const handleCounts = (e: any) => {
      if (e.detail) {
        if (typeof e.detail.unreadCount === 'number') setUnreadCount(e.detail.unreadCount);
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

  return (
    <header className="w-full bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 shrink-0 z-30 shadow-2xs">
      {/* Left: Global Search Trigger */}
      <div className="flex-1 max-w-md lg:max-w-xl">
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

      {/* Right: Currency Rate + Quick Action Icons + User Pill */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Active Rate Tag */}
        <div 
          title="Moneda y tasa configuradas exclusivamente por el Administrador en Ajustes"
          className="hidden md:flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs select-none shadow-2xs"
        >
          <Lock size={12} className="text-emerald-700 shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
            Tasa {activeCurrency}:
          </span>
          <span className="font-mono font-black text-emerald-900">
            Bs. {currentRateBs.toFixed(2)}
          </span>
        </div>

        {/* Keyboard Shortcuts Trigger */}
        <button
          onClick={onOpenShortcuts}
          type="button"
          title="Atajos de Teclado (F1 / Ctrl+K / Alt+1-9)"
          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-black rounded-xl transition-all cursor-pointer relative shadow-2xs border border-slate-200 hover:scale-105 active:scale-95"
        >
          <Keyboard size={18} />
        </button>

        {/* Favoritos & Monitoreo Directo */}
        <button
          onClick={handleOpenBookmarks}
          type="button"
          title="Favoritos & Monitoreo (Mesas, Platos, Clientes)"
          className="p-2 bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-600 rounded-xl transition-all cursor-pointer relative shadow-2xs border border-slate-200 hover:scale-105 active:scale-95"
        >
          <Star size={18} className={bookmarks.length > 0 ? "fill-amber-400 text-amber-500" : "text-slate-600"} />
          {bookmarks.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white shadow-xs">
              {bookmarks.length > 9 ? '9+' : bookmarks.length}
            </span>
          )}
        </button>

        {/* Notificaciones & Alertas */}
        <button
          onClick={handleOpenNotifications}
          type="button"
          title="Alertas & Notificaciones del Sistema"
          className="p-2 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 rounded-xl transition-all cursor-pointer relative shadow-2xs border border-slate-200 hover:scale-105 active:scale-95"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white shadow-xs animate-bounce">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* User Pill */}
        {currentUser && (
          <div className="hidden sm:flex items-center gap-2 pl-2.5 ml-1 border-l border-slate-200/80">
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-black text-xs flex items-center justify-center shadow-xs">
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="hidden lg:block text-left leading-tight">
              <div className="text-xs font-black text-slate-900 truncate max-w-[100px]">
                {currentUser.name || 'Usuario'}
              </div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                {currentUser.role === 'admin' ? (
                  <span className="text-indigo-600 flex items-center gap-0.5">
                    <ShieldCheck size={10} /> Admin
                  </span>
                ) : (
                  <span className="text-slate-500">
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
