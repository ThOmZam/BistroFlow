import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  Star, 
  X, 
  Check, 
  Trash2, 
  Shield, 
  ShoppingBag, 
  DollarSign, 
  Clock, 
  User, 
  Volume2, 
  VolumeX, 
  BellRing,
  Table as TableIcon,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, limit, addDoc, collectionGroup, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { playNotificationSound } from '../lib/audio';
import { getBookmarks, toggleBookmark, Bookmark } from '../lib/bookmarks';
import { useRestaurantData } from '../hooks/useRestaurantData';

interface NotificationManagerProps {
  currentUser: {
    name: string;
    role: string;
  };
  onViewChange: (view: string) => void;
}

interface InAppAlert {
  id: string;
  type: 'system' | 'auth' | 'order' | 'finance';
  actorName: string;
  actorRole?: string;
  action: string;
  details: string;
  timestamp: number;
  read: boolean;
}

export default function NotificationManager({ currentUser, onViewChange }: NotificationManagerProps) {
  const isAdmin = currentUser?.role === 'admin';
  const { tables, menu, activeSessions } = useRestaurantData();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'alerts' | 'bookmarks'>('alerts');
  
  // Settings & Toggles (Local overrides sync with establishment preferences)
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('notif_sound_enabled') !== 'false');
  const [pushEnabled, setPushEnabled] = useState(() => localStorage.getItem('notif_push_enabled') === 'true');
  const [filterType, setFilterType] = useState<string>('all');

  // Real-time alerts & ready orders
  const [alerts, setAlerts] = useState<InAppAlert[]>([]);
  const [toasts, setToasts] = useState<InAppAlert[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [readyOrders, setReadyOrders] = useState<any[]>([]);
  const appLoadTime = useRef(Date.now() - 5000); // 5 seconds grace period to avoid load spam

  // Sync Ready Orders for Waiters/Staff Alerts
  useEffect(() => {
    const qReady = query(collectionGroup(db, 'orders'), where('status', '==', 'ready'));
    const unsubReady = onSnapshot(qReady, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => {
        list.push({
          id: docSnap.id,
          docRefPath: docSnap.ref.path,
          ...docSnap.data()
        });
      });
      setReadyOrders(list);
    }, (err) => {
      console.error('Error listening to ready orders:', err);
    });

    return () => unsubReady();
  }, []);

  // Sync Bookmarks State
  useEffect(() => {
    setBookmarks(getBookmarks());
    
    const handleSync = () => {
      setBookmarks(getBookmarks());
    };
    
    window.addEventListener('bookmarks_updated', handleSync);
    return () => window.removeEventListener('bookmarks_updated', handleSync);
  }, []);

  // Auto fallback for non-admins if on bookmarks tab
  useEffect(() => {
    if (!isAdmin && activeTab === 'bookmarks') {
      setActiveTab('alerts');
    }
  }, [isAdmin, activeTab]);

  // Request browser Notification Permission
  const requestPushPermission = async () => {
    if (!('Notification' in window)) {
      alert('Las notificaciones de navegador no son soportadas en este navegador.');
      return;
    }
    
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setPushEnabled(true);
        localStorage.setItem('notif_push_enabled', 'true');
        new Notification('BistroFlow', {
          body: '¡Notificaciones de escritorio activadas con éxito!',
          icon: '/favicon.ico'
        });
      } else {
        setPushEnabled(false);
        localStorage.setItem('notif_push_enabled', 'false');
      }
    } catch (e) {
      console.warn('Error requesting permission', e);
    }
  };

  // Toggle Sound Preference
  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      localStorage.setItem('notif_sound_enabled', String(next));
      window.dispatchEvent(new Event('notif_pref_changed'));
      return next;
    });
  };

  const [prefsUpdated, setPrefsUpdated] = useState(0);
  useEffect(() => {
    const handlePrefsChange = () => {
      setPrefsUpdated(p => p + 1);
      setSoundEnabled(localStorage.getItem('notif_sound_enabled') !== 'false');
      setPushEnabled(localStorage.getItem('notif_push_enabled') === 'true');
    };
    window.addEventListener('notif_pref_changed', handlePrefsChange);
    return () => window.removeEventListener('notif_pref_changed', handlePrefsChange);
  }, []);

  // Setup Activity Logs real-time listener
  useEffect(() => {
    // Read user alerts preferences (what to notify)
    const alertPrefNewOrders = localStorage.getItem('notif_pref_orders') !== 'false';
    const alertPrefFinance = localStorage.getItem('notif_pref_finance') !== 'false';
    const alertPrefAuth = localStorage.getItem('notif_pref_auth') !== 'false';
    const alertPrefSystem = localStorage.getItem('notif_pref_system') !== 'false';

    const q = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(15));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const logTime = data.timestamp ? new Date(data.timestamp).getTime() : Date.now();
          
          // Only alert for new logs generated after the app was loaded
          if (logTime > appLoadTime.current) {
            const newAlert: InAppAlert = {
              id: change.doc.id,
              type: data.type || 'system',
              actorName: data.actorName || 'Sistema',
              actorRole: data.actorRole || '',
              action: data.action || '',
              details: data.details || '',
              timestamp: logTime,
              read: false
            };

            // Filter according to client-side notification preferences
            let shouldAlert = true;
            if (newAlert.type === 'order' && !alertPrefNewOrders) shouldAlert = false;
            if (newAlert.type === 'finance' && !alertPrefFinance) shouldAlert = false;
            if (newAlert.type === 'auth' && !alertPrefAuth) shouldAlert = false;
            if (newAlert.type === 'system' && !alertPrefSystem) shouldAlert = false;

            if (shouldAlert) {
              // Append alert to list
              setAlerts(prev => [newAlert, ...prev]);

              // Trigger Audio
              if (soundEnabled) {
                playNotificationSound();
              }

              // Trigger Browser Notification
              if (pushEnabled && Notification.permission === 'granted') {
                new Notification(`BistroFlow: ${newAlert.action}`, {
                  body: `${newAlert.actorName} - ${newAlert.details}`,
                  tag: newAlert.id
                });
              }

              // Trigger dynamic toast
              setToasts(prev => [...prev.slice(-2), newAlert]); // limit toast queue to max 3 items
              
              // Auto-dismiss toast in 5 seconds
              setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== newAlert.id));
              }, 5000);
            }
          }
        }
      });
    }, (err) => {
      console.error('Error listening to activity logs for alerts:', err);
    });

    return () => unsubscribe();
  }, [soundEnabled, pushEnabled, prefsUpdated]);

  const markAllAsRead = () => {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
  };

  const clearAllAlerts = () => {
    setAlerts([]);
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'auth': return <Shield size={16} className="text-purple-500" />;
      case 'order': return <ShoppingBag size={16} className="text-emerald-500" />;
      case 'finance': return <DollarSign size={16} className="text-amber-500" />;
      default: return <Clock size={16} className="text-rose-500" />;
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filterType === 'all') return true;
    return alert.type === filterType;
  });

  const unreadCount = alerts.filter(a => !a.read).length + readyOrders.length;

  return (
    <>
      {/* Floating Control Pill */}
      <div className="fixed top-4 right-4 md:top-6 md:right-8 z-50 flex items-center gap-2">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-lg hover:shadow-xl transition-all rounded-full p-1.5 px-3.5 flex items-center gap-2.5"
        >
          {/* Star bookmarks stats (ADMIN ONLY) */}
          {isAdmin && (
            <>
              <button 
                onClick={() => { setIsOpen(true); setActiveTab('bookmarks'); }}
                className="flex items-center gap-1.5 text-slate-500 hover:text-amber-500 transition-colors relative py-1 px-2 rounded-lg hover:bg-amber-50/80"
                title="Seguimiento de Casos y Favoritos (Admin)"
              >
                <Star size={16} className={bookmarks.length > 0 ? 'fill-amber-400 text-amber-500' : 'text-slate-400'} />
                <span className="text-[11px] font-bold text-slate-700 hidden sm:inline">Casos</span>
                {bookmarks.length > 0 && (
                  <span className="text-[10px] font-black bg-amber-500 text-white px-1.5 py-0.2 rounded-full min-w-[18px] text-center">
                    {bookmarks.length}
                  </span>
                )}
              </button>

              <div className="w-[1px] h-4 bg-slate-200" />
            </>
          )}

          {/* Bell notification stats */}
          <button 
            onClick={() => { setIsOpen(true); setActiveTab('alerts'); }}
            className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 transition-colors relative py-1 px-2 rounded-lg hover:bg-slate-100/80"
            title="Centro de Alertas y Notificaciones"
          >
            <div className="relative">
              <Bell size={16} className={unreadCount > 0 ? 'animate-bounce text-emerald-500' : ''} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border border-white animate-pulse" />
              )}
            </div>
            {unreadCount > 0 && (
              <span className="text-[10px] font-extrabold text-rose-500 hidden sm:inline">
                {unreadCount}
              </span>
            )}
          </button>
        </motion.div>
      </div>

      {/* Floating Toast Notification Stack (Fades in, auto-fades out) */}
      <div className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
              className="bg-slate-900 border border-slate-800 text-white p-4 rounded-2xl shadow-2xl flex items-start gap-3 pointer-events-auto cursor-pointer hover:bg-slate-850 transition-colors"
              onClick={() => {
                setIsOpen(true);
                setActiveTab('alerts');
                // Mark as read
                setAlerts(prev => prev.map(a => a.id === toast.id ? { ...a, read: true } : a));
                setToasts(prev => prev.filter(t => t.id !== toast.id));
              }}
            >
              <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center shrink-0">
                {getAlertIcon(toast.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-100">{toast.action}</span>
                  <span className="text-[9px] text-slate-500 font-mono ml-auto">
                    {new Date(toast.timestamp).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 truncate">{toast.details}</p>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Por: {toast.actorName}</p>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setToasts(prev => prev.filter(t => t.id !== toast.id));
                }}
                className="text-slate-500 hover:text-white shrink-0 p-0.5 rounded"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Main Slide-over Drawer Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black z-50 cursor-pointer"
            />

            {/* Sliding Panel Container */}
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 max-w-md w-full bg-slate-50 border-l border-slate-200 shadow-2xl z-50 flex flex-col h-full"
            >
              {/* Header */}
              <div className="p-6 bg-white border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                    <BellRing size={20} className="text-emerald-500" /> Control y Monitoreo
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">Alertas de sistema y marcadores favoritos en tiempo real</p>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Tab Selector */}
              <div className="px-6 bg-white flex border-b border-slate-100">
                <button
                  onClick={() => setActiveTab('alerts')}
                  className={`flex-1 py-3.5 text-xs font-black uppercase tracking-wider text-center border-b-2 transition-all ${
                    activeTab === 'alerts' 
                      ? 'border-emerald-500 text-emerald-600 bg-emerald-50/20' 
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  🔔 Alertas ({alerts.length})
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setActiveTab('bookmarks')}
                    className={`flex-1 py-3.5 text-xs font-black uppercase tracking-wider text-center border-b-2 transition-all ${
                      activeTab === 'bookmarks' 
                        ? 'border-amber-500 text-amber-600 bg-amber-50/20' 
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    ⭐ Casos ({bookmarks.length})
                  </button>
                )}
              </div>

              {/* Quick Preferences Toolbar */}
              <div className="px-6 py-2.5 bg-slate-100/80 border-b border-slate-200/50 flex items-center justify-between text-xs">
                <button 
                  onClick={toggleSound}
                  className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 transition-colors"
                  title="Activar/Desactivar Sonido"
                >
                  {soundEnabled ? <Volume2 size={15} className="text-emerald-500" /> : <VolumeX size={15} className="text-slate-400" />}
                  <span className="font-bold text-[10px] uppercase">Sonido: {soundEnabled ? 'SÍ' : 'NO'}</span>
                </button>

                {!pushEnabled && (
                  <button 
                    onClick={requestPushPermission}
                    className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors border border-emerald-200/50"
                  >
                    Activar Push 💻
                  </button>
                )}
                {pushEnabled && (
                  <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wider flex items-center gap-1">
                    🟢 Push Navegador Activo
                  </span>
                )}
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {activeTab === 'alerts' && (
                  <>
                    {/* HIGH PRIORITY KITCHEN READY ORDERS */}
                    {readyOrders.length > 0 && (
                      <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3.5 shadow-sm space-y-2 mb-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                            <span className="animate-bounce">🔔</span> ¡{readyOrders.length} {readyOrders.length === 1 ? 'PLATILLO LISTO' : 'PLATILLOS LISTOS'} PARA SERVIR!
                          </span>
                          <button 
                            onClick={() => { onViewChange('waiter'); setIsOpen(false); }}
                            className="text-[10px] font-bold text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            Ver Mesas <ChevronRight size={12} />
                          </button>
                        </div>

                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {readyOrders.map(ro => {
                            const match = ro.docRefPath?.match(/sessions\/([^\/]+)/);
                            const sessionId = match ? match[1] : null;
                            const session = activeSessions.find(s => s.id === sessionId);
                            let targetLabel = 'Mesa';
                            if (session) {
                              if (session.type === 'delivery') {
                                targetLabel = `Llevar: ${session.customerName || 'Cliente'}`;
                              } else {
                                const table = tables.find(t => t.id === session.tableId);
                                targetLabel = table ? `Mesa ${table.number}` : `Mesa ${session.tableId}`;
                              }
                            }
                            return (
                              <div key={ro.id} className="bg-white p-2.5 rounded-xl border border-emerald-100 flex items-center justify-between gap-2 text-xs">
                                <div>
                                  <div className="font-extrabold text-slate-900">{ro.quantity}x {ro.itemName}</div>
                                  <div className="text-[10px] text-emerald-700 font-bold">Para: {targetLabel}</div>
                                </div>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await updateDoc(doc(db, ro.docRefPath), { status: 'delivered' });
                                    } catch(err) {
                                      console.error(err);
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[10px] flex items-center gap-1 shrink-0 cursor-pointer shadow-sm"
                                >
                                  <Check size={11} /> Entregado
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Header Controls for Alerts */}
                    {alerts.length > 0 && (
                      <div className="flex justify-between items-center pb-2 border-b border-slate-200/50">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Notificaciones Recientes</span>
                        <div className="flex gap-2">
                          <button 
                            onClick={markAllAsRead}
                            className="text-[10px] font-bold text-slate-500 hover:text-slate-900 transition-colors"
                          >
                            Marcar leídas
                          </button>
                          <span className="text-slate-300">|</span>
                          <button 
                            onClick={clearAllAlerts}
                            className="text-[10px] font-bold text-rose-500 hover:text-rose-700 transition-colors"
                          >
                            Limpiar todo
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Filter Category Buttons */}
                    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
                      {['all', 'order', 'finance', 'auth', 'system'].map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setFilterType(cat)}
                          className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg border transition-all ${
                            filterType === cat
                              ? 'bg-slate-900 border-slate-900 text-white'
                              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                          }`}
                        >
                          {cat === 'all' ? 'Todos' : cat === 'order' ? 'Pedidos' : cat === 'finance' ? 'Caja' : cat === 'auth' ? 'Sesión' : 'Sistema'}
                        </button>
                      ))}
                    </div>

                    {/* Alerts list */}
                    {filteredAlerts.length === 0 ? (
                      <div className="py-12 flex flex-col items-center justify-center text-center text-slate-300">
                        <Bell size={36} className="mb-2 stroke-[1.5]" />
                        <span className="text-xs font-bold text-slate-400">No hay alertas disponibles</span>
                        <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">Las acciones y eventos importantes aparecerán aquí en tiempo real.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredAlerts.map((alert) => (
                          <div 
                            key={alert.id}
                            onClick={() => {
                              // Mark single as read
                              setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, read: true } : a));
                              // Jump/navigate to matching views based on category
                              if (alert.type === 'order') onViewChange('waiter');
                              else if (alert.type === 'finance') onViewChange('caja');
                              else if (alert.type === 'system') onViewChange('kernel');
                              else if (alert.type === 'auth') onViewChange('personal');
                              setIsOpen(false);
                            }}
                            className={`p-4 rounded-2xl border transition-all cursor-pointer flex gap-3 ${
                              alert.read 
                                ? 'bg-white border-slate-100 hover:border-slate-200' 
                                : 'bg-emerald-50/40 border-emerald-100 shadow-sm shadow-emerald-500/5 hover:border-emerald-200'
                            }`}
                          >
                            <div className="w-8 h-8 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center shrink-0">
                              {getAlertIcon(alert.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs font-black ${alert.read ? 'text-slate-800' : 'text-slate-950 font-extrabold'}`}>
                                  {alert.action}
                                </span>
                                {!alert.read && (
                                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0" />
                                )}
                                <span className="text-[9px] text-slate-400 font-mono ml-auto shrink-0">
                                  {new Date(alert.timestamp).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{alert.details}</p>
                              <div className="flex items-center gap-1.5 mt-2">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                                  {alert.actorName} {alert.actorRole ? `(${alert.actorRole})` : ''}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {activeTab === 'bookmarks' && (
                  <>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block pb-2 border-b border-slate-200/50">
                      Elementos en Monitoreo Activo
                    </span>

                    {bookmarks.length === 0 ? (
                      <div className="py-12 flex flex-col items-center justify-center text-center text-slate-300">
                        <Star size={36} className="mb-2 stroke-[1.5]" />
                        <span className="text-xs font-bold text-slate-400">Sin marcadores guardados</span>
                        <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">Marca mesas, platos, clientes o personal con la estrella para vigilarlos en tiempo real.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {bookmarks.map((b) => {
                          // Resolve dynamic/realtime values based on type
                          let statusLabel = 'Monitor Activo';
                          let statusColor = 'bg-slate-100 text-slate-600';
                          let detailsText = b.details || 'Acceso directo';
                          
                          if (b.type === 'table') {
                            const realTable = tables.find(t => t.id === b.id);
                            const activeSess = activeSessions.find(s => s.tableId === b.id);
                            
                            if (activeSess) {
                              const accNames = activeSess.accounts?.map((a: any) => a.name).filter(Boolean).join(', ');
                              const clientName = activeSess.customerName || accNames || 'Sin nombre registrado';
                              detailsText = `👤 Cliente: ${clientName}`;
                            } else {
                              detailsText = realTable?.status === 'free' ? 'Mesa disponible (Sin cliente)' : 'Sin cliente asignado';
                            }

                            if (realTable) {
                              if (realTable.status === 'free') {
                                statusLabel = 'Mesa Libre 🟢';
                                statusColor = 'bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold';
                              } else if (realTable.status === 'waiting_bill') {
                                statusLabel = `Pidiendo Cuenta ($${activeSess?.totalAmount?.toFixed(2) || '0.00'}) 🔔`;
                                statusColor = 'bg-amber-50 border border-amber-100 text-amber-700 font-bold';
                              } else {
                                statusLabel = `Ocupada ($${activeSess?.totalAmount?.toFixed(2) || '0.00'}) 🔴`;
                                statusColor = 'bg-rose-50 border border-rose-100 text-rose-700 font-bold';
                              }
                            }
                          } else if (b.type === 'menu') {
                            const realMenuItem = menu.find(m => m.id === b.id);
                            if (realMenuItem) {
                              statusLabel = `$${realMenuItem.price.toFixed(2)} | Categoría: ${realMenuItem.category}`;
                              statusColor = 'bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold';
                            }
                          }

                          return (
                            <div 
                              key={`${b.type}-${b.id}`}
                              className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-start gap-3 hover:border-slate-300 transition-all"
                            >
                              <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                                {b.type === 'table' ? <TableIcon size={16} className="text-slate-600" /> :
                                 b.type === 'menu' ? <ShoppingBag size={16} className="text-slate-600" /> :
                                 b.type === 'client' ? <User size={16} className="text-slate-600" /> :
                                 <Clock size={16} className="text-slate-600" />}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-extrabold text-slate-900 truncate">
                                    {b.name}
                                  </span>
                                  <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider ml-auto">
                                    {b.type === 'table' ? 'Mesa' : b.type === 'menu' ? 'Plato' : b.type === 'client' ? 'Cliente' : 'Personal'}
                                  </span>
                                </div>
                                
                                <p className={`text-[11px] mt-1 font-medium ${b.type === 'table' && detailsText.includes('👤') ? 'text-slate-800 font-bold bg-slate-50 p-1.5 rounded-lg border border-slate-100' : 'text-slate-400'}`}>
                                  {detailsText}
                                </p>
                                
                                <div className="flex items-center justify-between mt-3">
                                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${statusColor}`}>
                                    {statusLabel}
                                  </span>

                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => {
                                        if (b.type === 'table' || b.type === 'employee') onViewChange('waiter');
                                        else if (b.type === 'menu') onViewChange('menu_settings');
                                        else if (b.type === 'client') onViewChange('crm');
                                        setIsOpen(false);
                                      }}
                                      className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-black transition-colors"
                                    >
                                      Ir <ChevronRight size={12} />
                                    </button>
                                    <button 
                                      onClick={() => toggleBookmark(b)}
                                      className="p-1 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
                                      title="Quitar de Marcadores"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
