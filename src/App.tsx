/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signInAnonymously, signOut } from 'firebase/auth';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { User, Role } from './types';
import Sidebar from './components/Sidebar';
import AuthView from './views/AuthView';
import WaiterView from './views/WaiterView';
import KDSView from './views/KDSView';
import AdminView from './views/AdminView';
import InventoryView from './views/InventoryView';
import ClientView from './views/ClientView';
import CRMView from './views/CRMView';
import PersonalView from './views/PersonalView';
import MenuSettingsView from './views/MenuSettingsView';
import MarketingView from './views/MarketingView';
import KernelView from './views/KernelView';
import FinanceView from './views/FinanceView';
import CajaView from './views/CajaView';
import DashboardView from './views/DashboardView';
import ChatView from './views/ChatView';
import MyShiftView from './views/MyShiftView';
import { useRestaurantData } from './hooks/useRestaurantData';
import { useCurrency } from './context/CurrencyContext';
import { logAction } from './lib/logger';
import NotificationManager from './components/NotificationManager';
import TopBar from './components/TopBar';
import GlobalSearchModal from './components/GlobalSearchModal';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { Lock, Clock } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState('dashboard');
  const [fallbackRole, setFallbackRole] = useState<string | null>(localStorage.getItem('demo_fallback_role'));
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [kitchenOrdersCount, setKitchenOrdersCount] = useState(0);
  const [hasActiveClockIn, setHasActiveClockIn] = useState<boolean>(true);

  const { tables, exchangeRate, settings } = useRestaurantData();
  const { activeCurrency, currentRateBs, currencySymbol } = useCurrency();
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [isInsideTable, setIsInsideTable] = useState(false);

  // Sync with table comanda state to eliminate layout margins and floating modal effect
  useEffect(() => {
    const handleTableModal = (e: any) => {
      setIsInsideTable(!!e.detail?.isOpen);
    };
    window.addEventListener('table_modal_state', handleTableModal);
    return () => window.removeEventListener('table_modal_state', handleTableModal);
  }, []);

  // Redirect away from kitchen/KDS view if direct print mode without KDS is active
  useEffect(() => {
    const handleCheckDirectPrint = () => {
      const isDirectPrint = localStorage.getItem('kitchenMode') === 'direct_print' || (settings as any)?.kitchenMode === 'direct_print';
      if ((activeView === 'kitchen' || activeView === 'kds') && isDirectPrint) {
        setActiveView('dashboard');
      }
    };
    handleCheckDirectPrint();
    window.addEventListener('settings_updated', handleCheckDirectPrint);
    window.addEventListener('storage', handleCheckDirectPrint);
    return () => {
      window.removeEventListener('settings_updated', handleCheckDirectPrint);
      window.removeEventListener('storage', handleCheckDirectPrint);
    };
  }, [activeView, settings]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'sessions'), (snap) => {
      setAllSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const completedSessions = allSessions.filter(s => s.status === 'completed' || s.paymentStatus === 'validated');
  const totalSales = completedSessions.reduce((acc, s) => {
    const isCredit = s.payment?.method === 'credito' || s.paymentMethod === 'credito';
    if (isCredit) return acc;
    return acc + (s.totalAmount || 0);
  }, 0);
  
  const occupiedTables = tables.filter(t => t.status === 'occupied').length;
  const totalTables = tables.length || 1;
  const occupancyPercent = Math.round((occupiedTables / totalTables) * 100);

  // Listen to employee active clock-in status
  useEffect(() => {
    if (!currentUser?.employeeId || currentUser.role === 'admin' || currentUser.role === 'client') {
      setHasActiveClockIn(true);
      return;
    }

    const q = query(
      collection(db, 'attendance'),
      where('employeeId', '==', currentUser.employeeId),
      where('status', '==', 'checked_in')
    );

    const unsub = onSnapshot(q, (snap) => {
      const isCheckedIn = !snap.empty;
      setHasActiveClockIn(isCheckedIn);
      if (!isCheckedIn && activeView !== 'my_shift') {
        setActiveView('my_shift');
      }
    });

    return () => unsub();
  }, [currentUser?.employeeId, currentUser?.role]);
  useEffect(() => {
    // We can count pending orders dynamically
    const q = query(collection(db, 'sessions'), where('status', '==', 'active'));
    const unsub = onSnapshot(q, async (snap) => {
      let count = 0;
      for (const d of snap.docs) {
        // Just checking default account orders
        const ordersSnap = await getDocs(collection(db, 'sessions', d.id, 'accounts', 'default', 'orders'));
        const pending = ordersSnap.docs.filter(o => o.data().status === 'pending');
        count += pending.length;
      }
      setKitchenOrdersCount(count);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'waiter') setActiveView('waiter');
      else if (currentUser.role === 'cook') setActiveView('kitchen');
      else if (currentUser.role === 'finance') setActiveView('caja');
      else if (currentUser.role === 'admin') setActiveView('dashboard');
    }
  }, [currentUser]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser || fallbackRole) {
        const storedRole = fallbackRole || localStorage.getItem('demo_role') || 'client';
        const storedName = localStorage.getItem('demo_user_name');
        const storedEmail = localStorage.getItem('demo_user_email') || '';
        const storedPin = localStorage.getItem('demo_user_pin') || '';
        
        let userName = storedName;
        if (!storedName) {
          if (storedRole === 'admin') userName = 'Administrador';
          else if (storedRole === 'waiter') userName = 'Mesero';
          else if (storedRole === 'cook') userName = 'Cocina';
          else if (storedRole === 'client') userName = 'Cliente';
          else if (storedRole === 'finance') userName = 'Caja / Finanzas';
          else userName = 'Colaborador';
        }

        const storedEmpId = localStorage.getItem('demo_employee_id') || ('fallback-' + storedRole);

        setCurrentUser({
          id: fbUser?.uid || 'offline-user-id',
          uid: fbUser?.uid || 'offline-user-id',
          employeeId: storedEmpId,
          name: userName,
          role: storedRole as Role,
          email: storedEmail,
          pin: storedPin
        } as User & { uid: string; employeeId: string });
      } else {
        setCurrentUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [fallbackRole]);

  const handleLogout = () => {
    if (currentUser) {
      logAction('auth', currentUser.name, 'Cerró sesión', `Rol: ${currentUser.role.toUpperCase()}`);
    }
    localStorage.removeItem('demo_role');
    localStorage.removeItem('demo_fallback_role');
    localStorage.removeItem('demo_user_name');
    localStorage.removeItem('demo_user_email');
    localStorage.removeItem('demo_user_pin');
    localStorage.removeItem('demo_employee_id');
    localStorage.removeItem('tracked_delivery_session_id');
    setFallbackRole(null);
    signOut(auth);
    setCurrentUser(null);
  };

  const bgTheme = (settings as any)?.bgTheme || 'kinetic';
  const sidebarTheme = (settings as any)?.sidebarTheme || 'minimalist';
  
  const isDarkApp = bgTheme === 'dark_luxury' || sidebarTheme === 'dark';

  useEffect(() => {
    if (isDarkApp) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkApp]);

  useKeyboardShortcuts({
    onOpenSearch: () => setIsSearchOpen(true),
    onOpenShortcuts: () => setIsShortcutsOpen(true),
    onViewChange: setActiveView,
    currentUserRole: currentUser?.role
  });

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Default to guest client delivery dashboard on initial entry
  if (!currentUser || currentUser.role === 'client') {
    return <ClientView onLogout={handleLogout} />;
  }

  const isOperationalView = ['waiter', 'kitchen', 'caja', 'dashboard', 'chat'].includes(activeView);
  const isBlockedByClockIn = currentUser.role !== 'admin' && !hasActiveClockIn && isOperationalView;
  
  const appBgClass = isDarkApp 
    ? 'bg-[#090D16] text-slate-100' 
    : bgTheme === 'warm_silk' 
      ? 'bg-[#FAF7F2] text-slate-900' 
      : bgTheme === 'pure_white' 
        ? 'bg-[#FFFFFF] text-slate-900' 
        : 'bg-[#F8F9FA] text-slate-900';

  return (
    <div className={`flex flex-col md:flex-row h-screen h-[100dvh] overflow-hidden font-sans transition-colors ${appBgClass}`}>
      <Sidebar 
        role={currentUser.role} 
        onLogout={handleLogout} 
        activeView={activeView}
        onViewChange={setActiveView}
        restaurantName={settings?.restaurantName || 'BistroFlow'}
        logoUrl={(settings as any)?.logoUrl || ''}
        slogan={(settings as any)?.slogan || (settings as any)?.tagline || 'SISTEMA GASTRONÓMICO & POS'}
        hasActiveClockIn={hasActiveClockIn}
      />
      
      {/* Right Content Column: Fixed Top Header + Main Content View */}
      <div className={`flex-1 flex flex-col min-w-0 h-full overflow-hidden transition-colors ${appBgClass}`}>
        {/* Global Superior Top Bar - Flush Edge to Edge */}
        <TopBar 
          onOpenSearch={() => setIsSearchOpen(true)} 
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          currentUser={currentUser}
          activeView={activeView}
          onViewChange={setActiveView}
          restaurantName={settings?.restaurantName || 'Q\' Sandwich'}
          logoUrl={(settings as any)?.logoUrl || ''}
        />

        <NotificationManager currentUser={currentUser} onViewChange={setActiveView} hideFloatingPill={true} />
        
        <main className={`flex-1 flex flex-col min-w-0 w-full relative ${
          isInsideTable 
            ? 'p-0 overflow-hidden' 
            : activeView === 'kds'
              ? 'overflow-auto p-2 sm:p-4 md:p-6 pb-20 md:pb-6'
              : 'overflow-auto p-4 sm:p-6 md:p-8 pb-28 md:pb-8'
        }`}>

        {isBlockedByClockIn ? (
          <div className="flex-1 flex items-center justify-center p-4 md:p-8">
            <div className="bg-white rounded-[32px] p-8 max-w-md w-full border border-slate-200 shadow-xl text-center space-y-6">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                <Lock size={32} />
              </div>
              
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-700 bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
                  Acceso Restringido • Asistencia
                </span>
                <h2 className="text-xl font-black text-slate-900 pt-1">
                  Entrada Requerida (Clock In)
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Hola <strong className="text-slate-800">{currentUser.name}</strong>. Para acceder a tus funciones de trabajo (<strong>{activeView.toUpperCase()}</strong>), primero debes registrar tu <strong>Fichaje de Entrada</strong> en el módulo de Asistencia.
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl text-left border border-slate-100 space-y-2 text-xs font-medium">
                <div className="flex justify-between text-slate-600">
                  <span>Empleado:</span>
                  <strong className="text-slate-900">{currentUser.name}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Rol de Trabajo:</span>
                  <strong className="text-slate-900 capitalize">{currentUser.role === 'waiter' ? 'Mesero' : currentUser.role === 'cook' ? 'Cocina / KDS' : currentUser.role === 'finance' ? 'Cajero / Finanzas' : currentUser.role}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Estado de Turno:</span>
                  <span className="font-extrabold text-rose-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    Sin Fichar Entrada
                  </span>
                </div>
              </div>

              <button
                onClick={() => setActiveView('my_shift')}
                className="w-full py-4 bg-slate-900 hover:bg-black text-white font-black rounded-2xl text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
              >
                <Clock size={16} className="text-amber-400" />
                <span>Ir a Mi Turno y Fichar Entrada</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {activeView === 'dashboard' && (
              <DashboardView currentUser={currentUser} onViewChange={setActiveView} />
            )}
            {activeView === 'chat' && <ChatView currentUser={currentUser} />}
            {activeView === 'my_shift' && <MyShiftView currentUser={currentUser as any} />}
            
            {activeView === 'waiter' && <WaiterView currentUser={currentUser} />}
            {activeView === 'kitchen' && <KDSView currentUser={currentUser} />}
            {activeView === 'caja' && <CajaView currentUser={currentUser} onViewChange={setActiveView} />}
            {activeView === 'finance' && currentUser.role === 'admin' && <FinanceView />}
            {activeView === 'inventory' && currentUser.role === 'admin' && <InventoryView />}
            {activeView === 'analytics' && currentUser.role === 'admin' && <AdminView currentUser={currentUser} />}
            {activeView === 'crm' && currentUser.role === 'admin' && <CRMView />}
            {activeView === 'personal' && currentUser.role === 'admin' && <PersonalView />}
            {activeView === 'marketing' && currentUser.role === 'admin' && <MarketingView currentUser={currentUser} />}
            {activeView === 'kernel' && currentUser.role === 'admin' && <KernelView />}
            {activeView === 'menu_settings' && currentUser.role === 'admin' && <MenuSettingsView currentUser={currentUser} />}
          </>
        )}
      </main>
      </div>

      {/* Global Modals for Search and Shortcuts */}
      <GlobalSearchModal 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
        onViewChange={setActiveView} 
      />
      
      <KeyboardShortcutsModal 
        isOpen={isShortcutsOpen} 
        onClose={() => setIsShortcutsOpen(false)} 
        onViewChange={setActiveView} 
      />
    </div>
  );
}

