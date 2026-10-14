import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  X, 
  UtensilsCrossed, 
  Users, 
  UserCheck, 
  Receipt, 
  CreditCard, 
  Settings, 
  Grid, 
  ChevronRight, 
  ArrowRight,
  Sparkles,
  Command,
  DollarSign
} from 'lucide-react';
import { useRestaurantData } from '../hooks/useRestaurantData';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewChange: (view: string, extraState?: any) => void;
}

export default function GlobalSearchModal({ isOpen, onClose, onViewChange }: GlobalSearchModalProps) {
  const { menu, tables } = useRestaurantData();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  // Extra Firestore collections loaded for search
  const [customers, setCustomers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [supplierBills, setSupplierBills] = useState<any[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load live data for CRM customers, Employees, Supplier Bills (CxP), and Active Sessions
  useEffect(() => {
    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});

    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snap) => {
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});

    const unsubBills = onSnapshot(collection(db, 'supplier_bills'), (snap) => {
      setSupplierBills(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});

    const unsubSessions = onSnapshot(collection(db, 'sessions'), (snap) => {
      setActiveSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});

    return () => {
      unsubCustomers();
      unsubEmployees();
      unsubBills();
      unsubSessions();
    };
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // Build unified search list
  const q = searchTerm.trim().toLowerCase();

  const results: any[] = [];

  if (q.length >= 1) {
    // 1. Menu Items / Platillos
    menu.forEach(item => {
      if (
        item.name.toLowerCase().includes(q) || 
        (item.category && item.category.toLowerCase().includes(q))
      ) {
        results.push({
          id: `menu-${item.id}`,
          type: 'Platillo / Menú',
          icon: UtensilsCrossed,
          badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
          title: item.name,
          subtitle: `Categoría: ${item.category || 'General'} • $${item.price.toFixed(2)}`,
          action: () => {
            window.dispatchEvent(new CustomEvent('select_menu_item', { detail: { item } }));
            onViewChange('menu_settings');
            onClose();
          }
        });
      }
    });

    // 2. Customers / Clientes CRM & CxC
    customers.forEach(c => {
      const matchName = c.name?.toLowerCase().includes(q);
      const matchPhone = c.phone?.toLowerCase().includes(q);
      const matchEmail = c.email?.toLowerCase().includes(q);
      const matchCredit = c.creditLimit && 'credito'.includes(q);

      if (matchName || matchPhone || matchEmail || matchCredit) {
        const hasCredit = (c.creditBalance || 0) > 0;
        results.push({
          id: `customer-${c.id}`,
          type: hasCredit ? 'Cliente / CxC (Crédito)' : 'Cliente CRM',
          icon: Users,
          badgeBg: hasCredit ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-blue-100 text-blue-800 border-blue-200',
          title: c.name || 'Cliente sin nombre',
          subtitle: `Tel: ${c.phone || 'N/A'} ${c.creditBalance ? `• Saldo Pendiente: $${c.creditBalance.toFixed(2)}` : ''}`,
          action: () => {
            if (hasCredit) {
              window.dispatchEvent(new CustomEvent('set_caja_tab', { detail: 'credits' }));
              onViewChange('caja');
            } else {
              window.dispatchEvent(new CustomEvent('select_customer', { detail: { clientId: c.id } }));
              onViewChange('crm');
            }
            onClose();
          }
        });
      }
    });

    // 3. Employees / Personal / Usuarios
    employees.forEach(emp => {
      if (
        emp.name?.toLowerCase().includes(q) || 
        emp.role?.toLowerCase().includes(q) ||
        emp.email?.toLowerCase().includes(q)
      ) {
        results.push({
          id: `employee-${emp.id}`,
          type: 'Usuario / Empleado',
          icon: UserCheck,
          badgeBg: 'bg-purple-100 text-purple-800 border-purple-200',
          title: emp.name || 'Empleado',
          subtitle: `Rol: ${(emp.role || 'Personal').toUpperCase()} • Estado: ${emp.status || 'Activo'}`,
          action: () => {
            window.dispatchEvent(new CustomEvent('select_employee', { detail: { employeeId: emp.id } }));
            onViewChange('personal');
            onClose();
          }
        });
      }
    });

    // 4. Cuentas Activas / Pedidos / Consumos / Deliveries (Sessions)
    activeSessions.forEach(session => {
      const isDeliveryOrPickup = session.deliveryType || session.type === 'delivery' || session.type === 'pickup';
      const nameMatch = session.customerName?.toLowerCase().includes(q);
      const phoneMatch = session.customerPhone?.toLowerCase().includes(q);
      const tableMatch = session.tableId && `mesa ${session.tableId}`.toLowerCase().includes(q);
      const invoiceMatch = session.invoiceNumber?.toLowerCase().includes(q) || session.id?.toLowerCase().includes(q);
      const typeMatch = ('delivery'.includes(q) || 'pedido'.includes(q) || 'cuenta'.includes(q) || 'retiro'.includes(q) || 'factura'.includes(q));

      if (nameMatch || phoneMatch || tableMatch || invoiceMatch || typeMatch) {
        const isPendingVal = session.paymentStatus === 'pending_validation';
        const isClosed = session.status === 'closed' || session.status === 'completed' || session.isClosed;
        
        let typeLabel = 'Cuenta / Consumo Mesa';
        if (isClosed) {
          typeLabel = 'Cuenta / Factura Cerrada';
        } else if (isDeliveryOrPickup) {
          typeLabel = session.deliveryType === 'pickup' ? 'Pedido Retiro en Local' : 'Pedido Delivery';
        } else if (isPendingVal) {
          typeLabel = 'Pago por Validar (Caja)';
        }

        results.push({
          id: `session-${session.id}`,
          type: typeLabel,
          icon: Receipt,
          badgeBg: isClosed
            ? 'bg-slate-200 text-slate-800 border-slate-300'
            : isPendingVal 
            ? 'bg-amber-100 text-amber-800 border-amber-200' 
            : isDeliveryOrPickup 
            ? 'bg-indigo-100 text-indigo-800 border-indigo-200' 
            : 'bg-emerald-100 text-emerald-800 border-emerald-200',
          title: session.customerName ? `Cuenta: ${session.customerName}` : (session.invoiceNumber ? `Factura #${session.invoiceNumber}` : `Mesa #${session.tableId || 'S/N'}`),
          subtitle: `Estado: ${(session.status || 'activa').toUpperCase()} • ${session.customerPhone ? `Tel: ${session.customerPhone}` : 'Consumo'}`,
          action: () => {
            window.dispatchEvent(new CustomEvent('open_caja_session', { detail: { session } }));
            onViewChange('caja');
            onClose();
          }
        });
      }
    });

    // 5. Cuentas por Pagar (CxP - Supplier Bills)
    supplierBills.forEach(bill => {
      if (
        bill.supplierName?.toLowerCase().includes(q) ||
        bill.invoiceNumber?.toLowerCase().includes(q) ||
        bill.notes?.toLowerCase().includes(q) ||
        'cxp'.includes(q) ||
        'cuentas por pagar'.includes(q) ||
        'proveedores'.includes(q)
      ) {
        results.push({
          id: `bill-${bill.id}`,
          type: 'Cuenta por Pagar (CxP)',
          icon: Receipt,
          badgeBg: 'bg-rose-100 text-rose-800 border-rose-200',
          title: `${bill.supplierName || 'Proveedor'} - ${bill.invoiceNumber || 'Factura'}`,
          subtitle: `Monto: $${(bill.amount || 0).toFixed(2)} • Estado: ${(bill.status || 'pendiente').toUpperCase()}`,
          action: () => {
            window.dispatchEvent(new CustomEvent('set_finance_tab', { detail: 'payable' }));
            onViewChange('finance');
            onClose();
          }
        });
      }
    });

    // 6. Mesas / Salón
    tables.forEach(t => {
      const matchTable = `mesa ${t.number}`.toLowerCase().includes(q) || t.number.toString().includes(q);
      if (matchTable) {
        results.push({
          id: `table-${t.id}`,
          type: 'Mesa / Salón',
          icon: Grid,
          badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
          title: `Mesa #${t.number}`,
          subtitle: `Capacidad: ${t.capacity} personas • Estado: ${t.status === 'free' ? 'Libre' : 'Ocupada'}`,
          action: () => {
            window.dispatchEvent(new CustomEvent('select_table', { detail: { tableId: t.id, tableNumber: t.number } }));
            onViewChange('waiter');
            onClose();
          }
        });
      }
    });

    // 7. Configuración / Ajustes
    const settingsPages = [
      { id: 'menu', name: 'Ajustes de Menú y Platos', keyword: ['menu', 'platos', 'comida', 'precios'], tab: 'menu' },
      { id: 'tables', name: 'Ajustes de Mesas & Códigos QR', keyword: ['mesas', 'qr', 'salon'], tab: 'tables' },
      { id: 'promotions', name: 'Ajustes de Promociones & Banners', keyword: ['promociones', 'ofertas', 'banners'], tab: 'promotions' },
      { id: 'general', name: 'Ajustes Generales del Local & Horarios', keyword: ['general', 'horarios', 'local', 'nombre', 'logo', 'delivery'], tab: 'general' },
      { id: 'payments', name: 'Configuración de Moneda, Tasa & Pagos (Admin)', keyword: ['moneda', 'tasa', 'bcv', 'dolar', 'pagos', 'pago movil', 'zelle', 'credito', 'cxc'], tab: 'payments' },
      { id: 'toast_pos', name: 'Configuración de Operaciones, Impresoras & KDS', keyword: ['pos', 'operaciones', 'impresoras', 'kds', 'cocina'], tab: 'toast_pos' },
      { id: 'notifications', name: 'Alertas & Notificaciones del Sistema', keyword: ['notificaciones', 'alertas', 'sonido'], tab: 'notifications' }
    ];

    settingsPages.forEach(sp => {
      const match = sp.name.toLowerCase().includes(q) || sp.keyword.some(k => k.includes(q)) || 'ajustes'.includes(q) || 'configuracion'.includes(q);
      if (match) {
        results.push({
          id: `settings-${sp.id}`,
          type: 'Configuración / Ajustes',
          icon: Settings,
          badgeBg: 'bg-slate-200 text-slate-800 border-slate-300',
          title: sp.name,
          subtitle: `Sección de Ajustes • Pestaña: ${sp.tab.toUpperCase()}`,
          action: () => {
            window.dispatchEvent(new CustomEvent('set_settings_tab', { detail: sp.tab }));
            onViewChange('menu_settings');
            onClose();
          }
        });
      }
    });
  }

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, results.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + Math.max(1, results.length)) % Math.max(1, results.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          results[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/60 backdrop-blur-md">
          {/* Backdrop Click */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col max-h-[80vh]"
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200/80 bg-slate-50/50">
              <Search className="w-5 h-5 text-indigo-600 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Busca platillos, clientes, personal, CxC, CxP, ajustes..."
                className="w-full bg-transparent text-base sm:text-lg font-medium text-slate-900 placeholder:text-slate-400 outline-none"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              )}
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-mono font-bold text-slate-400 shadow-2xs">
                ESC
              </kbd>
            </div>

            {/* Results Content */}
            <div className="overflow-y-auto p-3 space-y-1 divide-y divide-slate-100 flex-1 min-h-[220px]">
              {q.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100 shadow-2xs">
                    <Command className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Buscador Omnipresente</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      Escribe para buscar al instante en toda la aplicación: platillos, usuarios, clientes, CxC, cuentas por pagar y configuraciones.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    {['Hamburguesa', 'Juan (Cliente)', 'Mesero', 'Factura CxP', 'Tasa Dólar'].map(hint => (
                      <button
                        key={hint}
                        onClick={() => setSearchTerm(hint)}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-xs font-semibold transition-colors cursor-pointer"
                      >
                        {hint}
                      </button>
                    ))}
                  </div>
                </div>
              ) : results.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <p className="text-sm font-semibold text-slate-600">No se encontraron resultados para "{searchTerm}"</p>
                  <p className="text-xs text-slate-400">Intenta buscar por nombre de plato, cliente, rol o sección de ajustes.</p>
                </div>
              ) : (
                results.map((res, idx) => {
                  const Icon = res.icon;
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={res.id}
                      onClick={res.action}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full text-left p-3.5 rounded-2xl flex items-center justify-between gap-4 transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-slate-900 text-white shadow-md' 
                          : 'hover:bg-slate-100/80 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`p-2.5 rounded-xl shrink-0 ${
                          isSelected 
                            ? 'bg-white/20 text-white' 
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                              isSelected
                                ? 'bg-white/20 text-white border-white/30'
                                : res.badgeBg
                            }`}>
                              {res.type}
                            </span>
                          </div>
                          <p className={`text-sm font-bold truncate mt-1 ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                            {res.title}
                          </p>
                          <p className={`text-xs truncate ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                            {res.subtitle}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-bold ${isSelected ? 'text-indigo-300' : 'text-slate-400'}`}>
                          Ir
                        </span>
                        <ChevronRight size={16} className={isSelected ? 'text-white' : 'text-slate-400'} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer Bar */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-[11px] font-medium text-slate-500">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono font-bold text-slate-600 shadow-2xs">↑↓</kbd> Navegar
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono font-bold text-slate-600 shadow-2xs">↵</kbd> Seleccionar
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold">{results.length} resultados</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
