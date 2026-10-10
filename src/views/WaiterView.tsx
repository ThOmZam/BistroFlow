import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Plus, 
  Minus,
  ShoppingBag, 
  ChevronRight, 
  Search,
  CheckCircle2,
  Clock,
  CreditCard,
  Banknote,
  Receipt,
  X,
  Trash2,
  AlertCircle,
  Phone,
  MapPin,
  Navigation,
  ExternalLink,
  Info,
  Check,
  Star,
  Scissors,
  UserCheck,
  Lock,
  AlertTriangle,
  Ticket,
  Flame,
  Zap
} from 'lucide-react';
import { collection, addDoc, serverTimestamp, doc, updateDoc, onSnapshot, getDocs, collectionGroup, query, where, getDoc, deleteDoc } from 'firebase/firestore';
import { logAction } from '../lib/logger';
import { db } from '../lib/firebase';
import { useRestaurantData, DEFAULT_PAYMENT_METHODS } from '../hooks/useRestaurantData';
import { playClickSound, playSuccessSound, playErrorSound } from '../lib/audio';
import { Table, MenuItem, Session, CourseType, CourseStatus, ExtraOption, PaymentMethodItem, Coupon } from '../types';
import { useBookmarks } from '../lib/bookmarks';
import { getMenuItemStockAlert, isMenuItem86ed } from '../lib/stockUtils';
import { useCurrency } from '../context/CurrencyContext';
import CurrencySelector from '../components/CurrencySelector';

export default function WaiterView({ currentUser }: { currentUser?: any }) {
  const { tables, menu, ingredients, activeSessions, settings, coupons } = useRestaurantData();
  const { 
    activeCurrency, 
    setActiveCurrency, 
    rates, 
    currentRate, 
    currentRateBs, 
    currencySymbol,
    convert,
    toBolivares,
    formatPrice,
    formatActive,
    formatBs,
    formatWithBs 
  } = useCurrency();
  const exchangeRate = currentRateBs || settings?.exchangeRate || 874.73;
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [cart, setCart] = useState<{ 
    item: MenuItem; 
    qty: number; 
    note?: string; 
    excludedIngredientIds?: string[];
    course?: CourseType;
    courseStatus?: CourseStatus;
    seatNumber?: number;
    selectedExtras?: ExtraOption[];
  }[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<ExtraOption[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [modalQty, setModalQty] = useState(1);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [extraNote, setExtraNote] = useState<string>('');
  const [category, setCategory] = useState('All');
  const [activeTab, setActiveTab] = useState<'menu' | 'bill'>('menu');
  const [activeAccountId, setActiveAccountId] = useState('default');
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [readyOrdersList, setReadyOrdersList] = useState<any[]>([]);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [activeShift, setActiveShift] = useState<any | null>(null);
  const [menuSearch, setMenuSearch] = useState('');
  const [tableFilter, setTableFilter] = useState<'all' | 'free' | 'occupied' | 'ready'>('all');
  const [showReadyDetails, setShowReadyDetails] = useState(true);
  const { isBookmarked, toggleBookmark } = useBookmarks();

  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'cashShifts'), (snap) => {
      const openShift = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).find((s: any) => s.status === 'open');
      setActiveShift(openShift || null);
    });
    return () => unsub();
  }, []);

  React.useEffect(() => {
    const q = query(collectionGroup(db, 'orders'), where('status', '==', 'ready'));
    const unsub = onSnapshot(q, (snap) => {
      setReadyOrdersList(snap.docs.map(doc => ({ id: doc.id, ...doc.data(), docRefPath: doc.ref.path })));
    }, (err) => {
      console.error('Error loading ready orders:', err);
    });
    return () => unsub();
  }, []);

  const categories = ['All', ...new Set(menu.map(m => m.category))];
  const filteredMenu = menu.filter(item => {
    const matchesCategory = category === 'All' || item.category === category;
    const matchesSearch = item.name.toLowerCase().includes(menuSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const filteredTables = tables.filter(t => {
    if (tableFilter === 'free') return t.status === 'free';
    if (tableFilter === 'occupied') return t.status === 'occupied';
    if (tableFilter === 'ready') {
      const session = activeSessions.find(s => s.tableId === t.id);
      return session && readyOrdersList.some(o => o.docRefPath?.includes(`/sessions/${session.id}/`));
    }
    return true;
  });

  const getSessionForTable = (tableId: string) => {
    if (tableId.startsWith('delivery-')) {
      return activeSessions.find(s => s.id === tableId.replace('delivery-', ''));
    }
    return activeSessions.find(s => s.tableId === tableId);
  };

  React.useEffect(() => {
    if (!selectedTable) return;
    const session = getSessionForTable(selectedTable.id);
    if (!session) {
      setActiveOrders([]);
      return;
    }

    const unsub = onSnapshot(collection(db, 'sessions', session.id, 'accounts', activeAccountId, 'orders'), (snap) => {
      setActiveOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [selectedTable, activeSessions, activeAccountId]);

  // Sync active account when table changes
  React.useEffect(() => {
    if (!selectedTable) {
      setActiveAccountId('default');
      return;
    }
    const session = getSessionForTable(selectedTable.id);
    if (!session) {
      setActiveAccountId('default');
      return;
    }
    const accounts = session.accounts || [{ id: 'default', name: 'Cuenta 1', status: 'active' }];
    const activeAccs = accounts.filter((a: any) => a.status !== 'paid');
    
    // Only reset if current activeAccountId doesn't belong to this session's accounts at all
    const belongsToSession = accounts.some((a: any) => a.id === activeAccountId);
    if (!belongsToSession && activeAccs.length > 0) {
      setActiveAccountId(activeAccs[0].id);
    }
  }, [selectedTable]);

  const DEFAULT_DELIVERY_ZONES = React.useMemo(() => [
    { id: 'zone_casco_urbano', name: 'Casco Urbano / Centro', priceUSD: 2.00, coveredAreas: 'Centro, Av. Principal, Plaza Bolivar', estimatedTime: '20-30 min' },
    { id: 'zone_norte_este', name: 'Zona Norte / Este', priceUSD: 3.50, coveredAreas: 'El Bosque, Las Chimeneas, Trigal', estimatedTime: '30-40 min' },
    { id: 'zone_periferica', name: 'Zona Periférica / Lejana', priceUSD: 5.00, coveredAreas: 'Naguanagua, San Diego, Zonas Industriales', estimatedTime: '45-60 min' }
  ], []);

  const deliveryZones = React.useMemo(() => {
    if (settings?.deliveryZones && settings.deliveryZones.length > 0) {
      return settings.deliveryZones;
    }
    return DEFAULT_DELIVERY_ZONES;
  }, [settings?.deliveryZones, DEFAULT_DELIVERY_ZONES]);

  const [isOpeningTable, setIsOpeningTable] = useState<Table | null>(null);
  const [firstAccountName, setFirstAccountName] = useState('');
  const [isSubmittingStartSession, setIsSubmittingStartSession] = useState(false);
  const [isCreatingDelivery, setIsCreatingDelivery] = useState(false);
  const [isSubmittingDelivery, setIsSubmittingDelivery] = useState(false);
  const [isSendingOrder, setIsSendingOrder] = useState(false);
  const [deliveryName, setDeliveryName] = useState('');
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [selectedZoneId, setSelectedZoneId] = useState<string>('zone_casco_urbano');
  const [deliveryReference, setDeliveryReference] = useState('');
  const [deliveryWhatsappLocation, setDeliveryWhatsappLocation] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryPaymentMethod, setDeliveryPaymentMethod] = useState('Efectivo');
  const [deliveryPaymentReference, setDeliveryPaymentReference] = useState('');
  const [deliveryReceiptImage, setDeliveryReceiptImage] = useState<string | null>(null);

  // Editing delivery states
  const [isEditingDeliveryInfo, setIsEditingDeliveryInfo] = useState<any | null>(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editDeliveryType, setEditDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [editSelectedZoneId, setEditSelectedZoneId] = useState<string>('zone_casco_urbano');
  const [editDeliveryReference, setEditDeliveryReference] = useState('');
  const [editWhatsappLocation, setEditWhatsappLocation] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editCustomerAddress, setEditCustomerAddress] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('Efectivo');
  const [editPaymentReference, setEditPaymentReference] = useState('');
  const [editDeliveryReceiptImage, setEditDeliveryReceiptImage] = useState<string | null>(null);
  const [viewingReceiptModal, setViewingReceiptModal] = useState<string | null>(null);
  const [isDeliveryInfoCollapsed, setIsDeliveryInfoCollapsed] = useState(false);

  const renderPaymentAccountDetails = (method: string) => {
    if (method === 'Pago Móvil') {
      return (
        <div className="p-3 bg-indigo-50/90 border border-indigo-100 rounded-2xl text-xs text-indigo-950 space-y-1 my-2">
          <div className="flex items-center gap-1.5 font-bold text-indigo-900">
            <Info size={14} className="text-indigo-600 shrink-0" /> Datos de Pago Móvil del Local:
          </div>
          <div className="text-[11px] pl-5 space-y-0.5">
            <div>Banco: <strong className="text-indigo-700">{settings?.pagoMovilBanco || 'Banesco'}</strong></div>
            <div>Teléfono: <strong className="text-indigo-700">{settings?.pagoMovilPhone || '0412-1234567'}</strong></div>
            <div>Cédula / RIF: <strong className="text-indigo-700">{settings?.pagoMovilId || 'V-12345678'}</strong></div>
          </div>
        </div>
      );
    }
    if (method === 'Zelle') {
      return (
        <div className="p-3 bg-indigo-50/90 border border-indigo-100 rounded-2xl text-xs text-indigo-950 space-y-1 my-2">
          <div className="flex items-center gap-1.5 font-bold text-indigo-900">
            <Info size={14} className="text-indigo-600 shrink-0" /> Datos de Zelle del Local:
          </div>
          <div className="text-[11px] pl-5 space-y-0.5">
            <div>Correo Zelle: <strong className="text-indigo-700">{settings?.zelleEmail || 'pagos@bistroflow.com'}</strong></div>
            <div>Beneficiario: <strong className="text-indigo-700">{settings?.zelleName || 'BistroFlow SL'}</strong></div>
          </div>
        </div>
      );
    }
    if (method === 'Transferencia') {
      return (
        <div className="p-3 bg-indigo-50/90 border border-indigo-100 rounded-2xl text-xs text-indigo-950 space-y-1 my-2">
          <div className="flex items-center gap-1.5 font-bold text-indigo-900">
            <Info size={14} className="text-indigo-600 shrink-0" /> Datos de Transferencia Bancaria del Local:
          </div>
          <div className="text-[11px] pl-5 space-y-0.5">
            <div>Banco: <strong className="text-indigo-700">{settings?.pagoMovilBanco || 'Banesco'}</strong></div>
            <div>Cuenta / Teléfono: <strong className="text-indigo-700">{settings?.pagoMovilPhone || '0412-1234567'}</strong></div>
            <div>RIF / Titular: <strong className="text-indigo-700">{settings?.pagoMovilId || 'V-12345678'}</strong></div>
          </div>
        </div>
      );
    }
    return null;
  };

  const createDelivery = async () => {
    if (isSubmittingDelivery) return;
    if (!deliveryName.trim()) return;
    if (deliveryPaymentMethod !== 'Efectivo') {
      if (!deliveryPaymentReference.trim()) {
        alert('Por favor ingresa la referencia de pago.');
        return;
      }
      if (!deliveryReceiptImage) {
        alert('Es obligatorio adjuntar la captura o foto del comprobante de pago.');
        return;
      }
    }

    setIsSubmittingDelivery(true);
    try {
      const activeZone = deliveryZones.find(z => z.id === selectedZoneId) || deliveryZones[0];
      const isDeliveryMode = deliveryType === 'delivery';
      const fee = isDeliveryMode ? (activeZone?.priceUSD || 0) : 0;

      const docRef = await addDoc(collection(db, 'sessions'), {
        tableId: 'delivery',
        type: 'delivery',
        customerName: deliveryName.trim(),
        deliveryType: deliveryType,
        customerPhone: deliveryPhone.trim(),
        customerAddress: isDeliveryMode ? deliveryAddress.trim() : 'Retiro en Local (Pick Up)',
        deliveryZoneId: isDeliveryMode ? (activeZone?.id || '') : '',
        deliveryZoneName: isDeliveryMode ? (activeZone?.name || '') : '',
        deliveryFee: fee,
        deliveryReference: isDeliveryMode ? deliveryReference.trim() : '',
        whatsappLocation: isDeliveryMode ? deliveryWhatsappLocation.trim() : '',
        paymentMethod: deliveryPaymentMethod,
        paymentReference: deliveryPaymentReference.trim(),
        paymentReceiptImage: deliveryPaymentMethod === 'Efectivo' ? null : deliveryReceiptImage,
        paymentStatus: 'pending',
        orderNumber: Math.floor(1000 + Math.random() * 9000),
        startTime: new Date().toISOString(),
        status: 'active',
        totalAmount: fee,
        accounts: [{ id: 'default', name: deliveryName.trim(), status: 'active' }],
        waiterId: currentUser?.employeeId || localStorage.getItem('demo_employee_id') || 'fallback-waiter',
        waiterName: currentUser?.name || localStorage.getItem('demo_user_name') || 'Mesero',
        createdBy: currentUser?.employeeId || localStorage.getItem('demo_employee_id') || 'fallback-waiter'
      });
      
      const waiterName = currentUser?.name || localStorage.getItem('demo_user_name') || 'Mesero';
      await logAction('order', waiterName, 'Creó delivery manual', `Para: ${deliveryName.trim()} | Tipo: ${deliveryType === 'delivery' ? 'Delivery' : 'Pick Up'} | Fee: $${fee.toFixed(2)}`);

      setSelectedTable({ id: 'delivery-' + docRef.id, number: deliveryName.trim(), capacity: 1, status: 'occupied' });
      setActiveAccountId('default');
      setIsCreatingDelivery(false);
      setDeliveryName('');
      setDeliveryPhone('');
      setDeliveryAddress('');
      setDeliveryReference('');
      setDeliveryWhatsappLocation('');
      setDeliveryPaymentMethod('Efectivo');
      setDeliveryPaymentReference('');
      setDeliveryReceiptImage(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingDelivery(false);
    }
  };

  const startSession = async (table: Table) => {
    if (isSubmittingStartSession) return;
    if (!firstAccountName.trim()) return;
    
    // Prevent duplicate sessions
    if (activeSessions.some(s => s.tableId === table.id)) {
      alert('Ya existe una sesión activa para esta mesa.');
      setIsOpeningTable(null);
      setFirstAccountName('');
      return;
    }

    setIsSubmittingStartSession(true);
    try {
      const docRef = await addDoc(collection(db, 'sessions'), {
        tableId: table.id,
        startTime: new Date().toISOString(),
        status: 'active',
        totalAmount: 0,
        customerName: firstAccountName.trim(),
        accounts: [{ id: 'default', name: firstAccountName.trim(), status: 'active' }],
        waiterId: currentUser?.employeeId || localStorage.getItem('demo_employee_id') || 'fallback-waiter',
        waiterName: currentUser?.name || localStorage.getItem('demo_user_name') || 'Mesero',
        createdBy: currentUser?.employeeId || localStorage.getItem('demo_employee_id') || 'fallback-waiter'
      });
      await updateDoc(doc(db, 'tables', table.id), { status: 'occupied' });
      
      const waiterName = currentUser?.name || localStorage.getItem('demo_user_name') || 'Mesero';
      await logAction('order', waiterName, 'Abrió la mesa', `Mesa ${table.number} para ${firstAccountName.trim()}`);

      // Select the table instantly so the UI switches to Menu automatically
      setSelectedTable({ ...table, status: 'occupied' });
      setActiveAccountId('default'); // reset account when starting new table
      setIsOpeningTable(null);
      setFirstAccountName('');
    } catch (err) {
      console.error(err);
      alert('Error al abrir la mesa');
    } finally {
      setIsSubmittingStartSession(false);
    }
  };

  // Advanced POS state extensions: Course, Seat, Auto-86
  const [selectedCourse, setSelectedCourse] = useState<CourseType>('main');
  const [selectedCourseStatus, setSelectedCourseStatus] = useState<CourseStatus>('fired');
  const [selectedSeatNumber, setSelectedSeatNumber] = useState<number>(1);

  const getCartEntryPrice = (entry: { item: MenuItem; selectedExtras?: ExtraOption[] }) => {
    const extrasTotal = (entry.selectedExtras || []).reduce((sum, ext) => sum + ext.price, 0);
    return entry.item.price + extrasTotal;
  };

  const addToCart = (
    item: MenuItem, 
    qty: number = 1, 
    note: string = '', 
    excludedIngredientIds: string[] = [],
    course: CourseType = 'main',
    courseStatus: CourseStatus = 'fired',
    seatNumber: number = 1,
    selectedExtras: ExtraOption[] = []
  ) => {
    playClickSound();
    setCart(prev => {
      const existing = prev.find(i => 
        i.item.id === item.id && 
        (i.note || '') === note && 
        i.course === course &&
        i.courseStatus === courseStatus &&
        i.seatNumber === seatNumber &&
        JSON.stringify(i.excludedIngredientIds || []) === JSON.stringify(excludedIngredientIds) &&
        JSON.stringify(i.selectedExtras || []) === JSON.stringify(selectedExtras)
      );
      if (existing) {
        return prev.map(i => 
          (i.item.id === item.id && 
           (i.note || '') === note && 
           i.course === course &&
           i.courseStatus === courseStatus &&
           i.seatNumber === seatNumber &&
           JSON.stringify(i.excludedIngredientIds || []) === JSON.stringify(excludedIngredientIds) &&
           JSON.stringify(i.selectedExtras || []) === JSON.stringify(selectedExtras))
            ? { ...i, qty: i.qty + qty }
            : i
        );
      }
      return [...prev, { item, qty, note, excludedIngredientIds, course, courseStatus, seatNumber, selectedExtras }];
    });
  };

  const sendOrder = async () => {
    if (isSendingOrder || !selectedTable || cart.length === 0) return;
    const session = getSessionForTable(selectedTable.id);
    if (!session) return;

    setIsSendingOrder(true);
    try {
      const accountId = activeAccountId;
      const ordersRef = collection(db, 'sessions', session.id, 'accounts', accountId, 'orders');
      const batchId = Date.now().toString();
      const itemNames = cart.map(c => c.qty + 'x ' + c.item.name).join(', ');
      const waiterName = currentUser?.name || localStorage.getItem('demo_user_name') || 'Mesero';
      await logAction('order', waiterName, 'Envió un pedido a cocina', `Mesa ${selectedTable.number}: ${itemNames}`);

      for (const entry of cart) {
        const itemPrice = getCartEntryPrice(entry);
        await addDoc(ordersRef, {
          menuItemId: entry.item.id,
          itemName: entry.item.name,
          price: itemPrice,
          quantity: entry.qty,
          status: 'pending',
          timestamp: new Date().toISOString(),
          note: entry.note || '',
          course: entry.course || entry.item.course || 'main',
          courseStatus: entry.courseStatus || 'fired',
          seatNumber: entry.seatNumber || 1,
          excludedIngredientIds: entry.excludedIngredientIds || [],
          extras: entry.selectedExtras || [],
          batchId,
          tableName: 'MESA ' + selectedTable.number,
          waiterName: currentUser?.name || localStorage.getItem('demo_user_name') || 'Mesero'
        });
      }

      setCart([]);
      setSelectedTable(null);
      playSuccessSound();
    } catch (err) {
      console.error(err);
      playErrorSound();
    } finally {
      setIsSendingOrder(false);
    }
  };

  const [isPaying, setIsPaying] = useState(false);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pago_movil');
  const [paymentRef, setPaymentRef] = useState('');

  const availablePaymentMethods = useMemo(() => {
    const list: PaymentMethodItem[] = (settings?.paymentMethodsList && Array.isArray(settings.paymentMethodsList) && settings.paymentMethodsList.length > 0)
      ? settings.paymentMethodsList
      : DEFAULT_PAYMENT_METHODS;
    
    const isCreditActive = settings?.creditEnabled === true;

    return list.filter(m => {
      if (!m.enabled) return false;
      if (m.id === 'credito' && !isCreditActive) return false;
      return true;
    });
  }, [settings?.paymentMethodsList, settings?.creditEnabled]);

  useEffect(() => {
    if (paymentMethod === 'credito' && settings?.creditEnabled !== true) {
      const fallback = availablePaymentMethods[0]?.id || 'pago_movil';
      setPaymentMethod(fallback);
    }
  }, [settings?.creditEnabled, availablePaymentMethods, paymentMethod]);
  const [paymentCurrency, setPaymentCurrency] = useState('Bs');
  const [mixedPayments, setMixedPayments] = useState<{ id: string, method: string, amountUSD: number, currency: string, reference: string, receiptImage: string | null }[]>([]);
  const [currentMixtoCurrency, setCurrentMixtoCurrency] = useState('Bs');
  const [currentMixedAmount, setCurrentMixedAmount] = useState('');
  const [includeTip, setIncludeTip] = useState(true);

  // Waiter Coupon / Marketing Discount State
  const [appliedWaiterCoupon, setAppliedWaiterCoupon] = useState<Coupon | null>(null);
  const [waiterCouponCode, setWaiterCouponCode] = useState('');
  const [waiterCouponError, setWaiterCouponError] = useState<string | null>(null);

  const servicePercent = settings?.serviceChargePercent || 10;

  // Itemized Split & Partial Payment States
  const [isPartialModalOpen, setIsPartialModalOpen] = useState(false);
  const [partialItemQuantities, setPartialItemQuantities] = useState<{ [orderId: string]: number }>({});
  const [partialPayerName, setPartialPayerName] = useState('');
  const [isProcessingPartialPayment, setIsProcessingPartialPayment] = useState(false);
  const [partialPaymentStep, setPartialPaymentStep] = useState<'select' | 'pay'>('select');

  const initPartialModal = () => {
    const initialQtyMap: { [orderId: string]: number } = {};
    activeOrders.forEach(o => {
      initialQtyMap[o.id] = 0;
    });
    setPartialItemQuantities(initialQtyMap);
    setPartialPayerName('');
    setPartialPaymentStep('select');
    setIsPartialModalOpen(true);
  };

  const partialSubtotal = activeOrders.reduce((sum, order) => {
    const qty = partialItemQuantities[order.id] || 0;
    return sum + (order.price || 0) * qty;
  }, 0);

  const partialTip = includeTip ? partialSubtotal * (servicePercent / 100) : 0;
  const partialTotal = partialSubtotal + partialTip;
  const partialTotalSelectedItems = Object.values(partialItemQuantities).reduce((a: number, b: number) => a + b, 0);

  const handleMoveSelectedToNewPerson = async () => {
    if (!selectedTable || partialTotalSelectedItems === 0) return;
    const personName = partialPayerName.trim() || `Persona ${Date.now().toString().slice(-4)}`;
    const session = getSessionForTable(selectedTable.id);
    if (!session) return;

    try {
      const newAccId = `acc_${Date.now()}`;
      const currentAccounts = session.accounts || [{ id: 'default', name: 'Cuenta 1', status: 'active' }];
      const updatedAccounts = [...currentAccounts, { id: newAccId, name: personName, status: 'active' }];

      await updateDoc(doc(db, 'sessions', session.id), { accounts: updatedAccounts });

      for (const order of activeOrders) {
        const qtyToMove = partialItemQuantities[order.id] || 0;
        if (qtyToMove <= 0) continue;

        const currentOrderRef = doc(db, 'sessions', session.id, 'accounts', activeAccountId, 'orders', order.id);
        const newAccOrdersRef = collection(db, 'sessions', session.id, 'accounts', newAccId, 'orders');

        const cleanOrderData = {
          menuItemId: order.menuItemId || '',
          itemName: order.itemName || '',
          price: order.price || 0,
          quantity: qtyToMove,
          status: order.status || 'pending',
          timestamp: order.timestamp || new Date().toISOString(),
          note: order.note || '',
          course: order.course || 'main',
          courseStatus: order.courseStatus || 'fired',
          seatNumber: order.seatNumber || 1,
          excludedIngredientIds: order.excludedIngredientIds || [],
          extras: order.extras || [],
          batchId: order.batchId || '',
          tableName: order.tableName || '',
          waiterName: order.waiterName || ''
        };

        if (qtyToMove >= order.quantity) {
          await addDoc(newAccOrdersRef, cleanOrderData);
          await deleteDoc(currentOrderRef);
        } else {
          await addDoc(newAccOrdersRef, cleanOrderData);
          await updateDoc(currentOrderRef, { quantity: order.quantity - qtyToMove });
        }
      }

      const waiterName = currentUser?.name || localStorage.getItem('demo_user_name') || 'Mesero';
      await logAction('order', waiterName, 'Separó consumo por persona', `Mesa ${selectedTable.number}: Se movieron ${partialTotalSelectedItems} ítems a la cuenta de ${personName}`);

      playSuccessSound();
      setIsPartialModalOpen(false);
      setActiveAccountId(newAccId);
      alert(`✅ ${partialTotalSelectedItems} ítems movidos a la cuenta de ${personName}.`);
    } catch (err) {
      console.error('Error moving selected items to new person:', err);
      playErrorSound();
    }
  };

  const handleProcessPartialPayment = async () => {
    if (!selectedTable || partialTotal <= 0) return;
    const session = getSessionForTable(selectedTable.id);
    if (!session) return;

    const payerName = partialPayerName.trim() || 'Comensal';

    if (paymentMethod !== 'divisa' && paymentMethod !== 'punto' && paymentMethod !== 'credito') {
      if (!paymentRef.trim()) {
        alert('Por favor, ingresa el número de referencia del pago.');
        return;
      }
      if (!receiptImage) {
        alert('Es obligatorio subir la imagen o captura del comprobante de pago.');
        return;
      }
    }

    try {
      setIsProcessingPartialPayment(true);
      const waiterName = currentUser?.name || localStorage.getItem('demo_user_name') || 'Mesero';

      // 1. Deduct or delete paid quantities
      for (const order of activeOrders) {
        const paidQty = partialItemQuantities[order.id] || 0;
        if (paidQty <= 0) continue;

        const orderRef = doc(db, 'sessions', session.id, 'accounts', activeAccountId, 'orders', order.id);
        if (paidQty >= order.quantity) {
          await deleteDoc(orderRef);
        } else {
          await updateDoc(orderRef, { quantity: order.quantity - paidQty });
        }
      }

      // 2. Add transaction record
      await addDoc(collection(db, 'transactions'), {
        sessionId: session.id,
        accountId: activeAccountId,
        amount: partialTotal,
        method: paymentMethod,
        reference: paymentRef || null,
        timestamp: new Date().toISOString(),
        approvedBy: waiterName,
        clientName: payerName,
        isPartialPayment: true
      });

      // 3. Log action
      await logAction(
        'finance',
        waiterName,
        `Procesó pago parcial por consumo ($${partialTotal.toFixed(2)})`,
        `Mesa ${selectedTable.number} - Cliente: ${payerName} - Método: ${paymentMethod.toUpperCase()}`
      );

      // 4. Check remaining orders across session accounts
      let remainingOrdersCount = 0;
      const currentAccounts = session.accounts || [{ id: 'default', name: 'Cuenta 1', status: 'active' }];
      for (const acc of currentAccounts) {
        const oSnap = await getDocs(collection(db, 'sessions', session.id, 'accounts', acc.id, 'orders'));
        remainingOrdersCount += oSnap.size;
      }

      if (remainingOrdersCount === 0) {
        const updatedAccounts = currentAccounts.map((a: any) => ({ ...a, status: 'paid' }));
        await updateDoc(doc(db, 'sessions', session.id), {
          status: 'completed',
          paymentStatus: 'validated',
          accounts: updatedAccounts
        });
        if (session.tableId && session.tableId !== 'delivery' && !session.tableId.startsWith('delivery')) {
          await updateDoc(doc(db, 'tables', selectedTable.id), { status: 'free' });
        }
        alert(`🎉 ¡Pago de $${partialTotal.toFixed(2)} por ${payerName} procesado! Todos los consumos de la mesa fueron saldados. Mesa liberada.`);
        setSelectedTable(null);
      } else {
        alert(`✅ Pago de $${partialTotal.toFixed(2)} por ${payerName} procesado con éxito. Se restaron los ítems de la cuenta de la mesa.`);
      }

      playSuccessSound();
      setIsPartialModalOpen(false);
      setReceiptImage(null);
      setPaymentRef('');
    } catch (err) {
      console.error('Error processing partial payment:', err);
      playErrorSound();
    } finally {
      setIsProcessingPartialPayment(false);
    }
  };

  // Delivery view modal states
  const [viewingDeliveryInfo, setViewingDeliveryInfo] = useState<Session | null>(null);
  const [deliveryInfoOrders, setDeliveryInfoOrders] = useState<any[]>([]);

  React.useEffect(() => {
    if (!viewingDeliveryInfo) {
      setDeliveryInfoOrders([]);
      return;
    }
    const unsub = onSnapshot(collection(db, 'sessions', viewingDeliveryInfo.id, 'accounts', 'default', 'orders'), (snap) => {
      setDeliveryInfoOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [viewingDeliveryInfo]);

  // Credit registration states
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientIdForCredit, setSelectedClientIdForCredit] = useState<string>('');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [nonCreditClientMode, setNonCreditClientMode] = useState<'none' | 'existing' | 'new'>('none');

  useEffect(() => {
    const unsubClients = onSnapshot(collection(db, 'clients'), (snap) => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubClients();
  }, []);

  const [creditName, setCreditName] = useState('');
  const [creditPhone, setCreditPhone] = useState('');
  const [creditId, setCreditId] = useState('');
  const [creditAddress, setCreditAddress] = useState('');
  const [creditEmail, setCreditEmail] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [adminPinError, setAdminPinError] = useState('');

  // Receipt image state
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);

  const processClientCreditDebt = async (creditClientData: {
    clientId?: string;
    nombre: string;
    tlf: string;
    cedula: string;
    direccion: string;
    email: string;
  }, amountToAdd: number): Promise<string | null> => {
    try {
      const clientsRef = collection(db, 'clients');
      
      if (creditClientData.clientId) {
        const clientRef = doc(db, 'clients', creditClientData.clientId);
        const clientSnap = await getDoc(clientRef);
        if (clientSnap.exists()) {
          const currentDebt = clientSnap.data().debt || 0;
          await updateDoc(clientRef, {
            debt: currentDebt + amountToAdd,
            phone: creditClientData.tlf,
            address: creditClientData.direccion,
            cedula: creditClientData.cedula,
            correo: creditClientData.email
          });
          return creditClientData.clientId;
        }
      }

      let foundClientId = '';
      let foundClientDebt = 0;

      if (creditClientData.cedula) {
        const q = query(clientsRef, where('cedula', '==', creditClientData.cedula));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          foundClientId = qSnap.docs[0].id;
          foundClientDebt = qSnap.docs[0].data().debt || 0;
        }
      }

      if (!foundClientId && creditClientData.nombre) {
        const q = query(clientsRef, where('name', '==', creditClientData.nombre));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          foundClientId = qSnap.docs[0].id;
          foundClientDebt = qSnap.docs[0].data().debt || 0;
        }
      }

      if (foundClientId) {
        await updateDoc(doc(db, 'clients', foundClientId), {
          debt: foundClientDebt + amountToAdd,
          phone: creditClientData.tlf,
          address: creditClientData.direccion,
          cedula: creditClientData.cedula,
          correo: creditClientData.email
        });
        return foundClientId;
      } else {
        const newDocRef = await addDoc(clientsRef, {
          name: creditClientData.nombre,
          phone: creditClientData.tlf,
          address: creditClientData.direccion,
          cedula: creditClientData.cedula,
          correo: creditClientData.email,
          debt: amountToAdd,
          sentiment: 'happy',
          notes: 'Registrado automáticamente desde venta a crédito',
          createdAt: new Date().toISOString()
        });
        return newDocRef.id;
      }
    } catch (err) {
      console.error('Error recording client debt in CRM:', err);
      return null;
    }
  };

  const handlePayment = async () => {
    if (!selectedTable) return;
    const session = getSessionForTable(selectedTable.id);
    if (!session) return;
    if (isSubmittingPayment) return;

    if (!activeShift) {
      playErrorSound();
      alert('Operación Bloqueada: No hay un turno de caja abierto en este momento. Es obligatorio que el Cajero o Administrador realice la Apertura de Caja antes de facturar o procesar pagos.');
      return;
    }

    try {
      const isDelivery = selectedTable.id.startsWith('delivery-');

      // Validation for mandatory fields
      if (paymentMethod === 'mixto') {
        const totalMixed = mixedPayments.reduce((sum, p) => sum + p.amountUSD, 0);
        if (Math.abs(totalMixed - finalTotal) > 0.01) {
          alert(`El total de los pagos mixtos (${totalMixed.toFixed(2)}) debe coincidir con el total a cobrar (${finalTotal.toFixed(2)}).`);
          return;
        }
      }

      // Enforce reference & receipt image for all electronic payment methods (online and on-site)
      if (paymentMethod !== 'efectivo' && paymentMethod !== 'credito' && paymentMethod !== 'mixto') {
        if (!paymentRef.trim()) {
          alert('Por favor, ingresa el número de referencia del pago.');
          return;
        }
        if (!receiptImage) {
          alert('Es obligatorio subir la imagen o captura del comprobante de pago.');
          return;
        }
      }

      if (paymentMethod === 'mixto') {
        const hasDigitalInMixed = mixedPayments.some(p => p.method === 'pago_movil' || p.method === 'zelle' || p.method === 'punto' || p.method === 'transferencia');
        if (hasDigitalInMixed) {
          const missingRef = mixedPayments.some(p => (p.method === 'pago_movil' || p.method === 'zelle' || p.method === 'punto' || p.method === 'transferencia') && !p.reference?.trim());
          if (missingRef) {
            alert('Por favor, ingresa la referencia para cada método de pago electrónico en el pago mixto.');
            return;
          }
          if (!receiptImage) {
            alert('Es obligatorio subir la imagen o captura del comprobante de pago para la transacción.');
            return;
          }
        }
      }

      const accounts = session.accounts || [{ id: 'default', name: 'Cuenta 1', status: 'active' }];
      
      let isAdminPinValid = false;
      if (paymentMethod === 'credito' && adminPin.trim()) {
        try {
          const q = query(collection(db, 'employees'), where('pin', '==', adminPin.trim()), where('role', '==', 'admin'));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const adminEmp = snap.docs[0].data();
            if (adminEmp.status !== 'inactive') {
              isAdminPinValid = true;
            }
          }
        } catch (err) {
          console.error('Error validating admin PIN:', err);
        }
      }

      // Validation for mandatory fields
      if (paymentMethod === 'credito') {
        if (!creditName.trim() || !creditPhone.trim() || !creditId.trim() || !creditAddress.trim() || !creditEmail.trim()) {
          alert('Para otorgar crédito, es obligatorio registrar todos los datos del cliente (Nombre, Teléfono, Cédula, Dirección, Email).');
          return;
        }

        // If admin PIN is supplied, validate it
        if (adminPin.trim()) {
          if (!isAdminPinValid) {
            setAdminPinError('PIN de Administrador incorrecto.');
            return;
          }
          // PIN is correct! Approved instantly.
        }
      } else {
        // Validation for optional client CRM registration if they selected 'new'
        if (nonCreditClientMode === 'new') {
          if (!creditName.trim() || !creditPhone.trim() || !creditId.trim()) {
            alert('Para registrar un nuevo cliente en el CRM, es obligatorio ingresar Nombre, Teléfono y Cédula / RIF.');
            return;
          }
        }
      }

      setIsSubmittingPayment(true);

      // Resolve CRM client ID and data before processing
      let associatedClientId = null;
      let finalClientName = '';
      let finalClientPhone = '';

      if (paymentMethod === 'credito') {
        associatedClientId = selectedClientIdForCredit || null;
        finalClientName = creditName.trim();
        finalClientPhone = creditPhone.trim();
      } else {
        if (nonCreditClientMode === 'existing' && selectedClientIdForCredit) {
          associatedClientId = selectedClientIdForCredit;
          finalClientName = creditName.trim();
          finalClientPhone = creditPhone.trim();
        } else if (nonCreditClientMode === 'new') {
          // Check if already exists in CRM by cedula
          let foundClientId = '';
          const clientsRef = collection(db, 'clients');
          if (creditId.trim()) {
            const q = query(clientsRef, where('cedula', '==', creditId.trim()));
            const qSnap = await getDocs(q);
            if (!qSnap.empty) {
              foundClientId = qSnap.docs[0].id;
            }
          }

          if (foundClientId) {
            await updateDoc(doc(db, 'clients', foundClientId), {
              phone: creditPhone.trim(),
              address: creditAddress.trim(),
              correo: creditEmail.trim()
            });
            associatedClientId = foundClientId;
          } else {
            const newClientDoc = await addDoc(clientsRef, {
              name: creditName.trim(),
              phone: creditPhone.trim(),
              address: creditAddress.trim(),
              cedula: creditId.trim(),
              correo: creditEmail.trim(),
              debt: 0,
              sentiment: 'happy',
              notes: 'Registrado automáticamente desde procesamiento de pago',
              createdAt: new Date().toISOString()
            });
            associatedClientId = newClientDoc.id;
          }
          finalClientName = creditName.trim();
          finalClientPhone = creditPhone.trim();
        }
      }

      // Instant approval (Cash, Card, Admin-approved Credit, or digital payments when auto-close is enabled)
      const closeDineInOnReport = !isDelivery && settings?.closeDineInOnPaymentReport === true;
      let instantApproved = paymentMethod === 'divisa' || 
                              paymentMethod === 'punto' || 
                              (paymentMethod === 'credito' && isAdminPinValid) ||
                              (closeDineInOnReport && (paymentMethod === 'pago_movil' || paymentMethod === 'zelle'));
      
      if (paymentMethod === 'mixto') {
         instantApproved = mixedPayments.every(p => 
           p.method === 'divisa' || p.method === 'punto' || (closeDineInOnReport && (p.method === 'pago_movil' || p.method === 'zelle'))
         );
      }

      if (instantApproved) {
        // Log instant approval payment
        const waiterName = currentUser?.name || localStorage.getItem('demo_user_name') || 'Mesero';
        const logMsg = `Procesó pago instantáneo ($${finalTotal.toFixed(2)})`;
        await logAction('finance', waiterName, logMsg, `Mesa ${selectedTable.number} - Método: ${paymentMethod.toUpperCase()}`);

        // If an associated client exists, update the specific account's name to the client's name so it is saved in ledger/accounts
        const updatedAccounts = accounts.map((acc: any) => {
          if (acc.id === activeAccountId) {
            return { 
              ...acc, 
              status: 'paid',
              name: finalClientName || acc.name 
            };
          }
          return acc;
        });
        const allPaid = updatedAccounts.every((acc: any) => acc.status === 'paid');

        // Record a transaction
        if (paymentMethod === 'mixto') {
          for (const mp of mixedPayments) {
            await addDoc(collection(db, 'transactions'), {
              sessionId: session.id,
              accountId: activeAccountId,
              shiftId: activeShift?.id || null,
              shiftName: activeShift?.shiftName || null,
              amount: mp.amountUSD,
              amountCents: Math.round(mp.amountUSD * 100),
              method: mp.method,
              reference: mp.reference,
              timestamp: new Date().toISOString(),
              approvedBy: (closeDineInOnReport && (mp.method === 'pago_movil' || mp.method === 'zelle') ? 'Auto-Approved (Setting)' : 'Waiter'),
              clientId: associatedClientId || null,
              clientName: finalClientName || null
            });
          }
        } else {
          await addDoc(collection(db, 'transactions'), {
            sessionId: session.id,
            accountId: activeAccountId,
            shiftId: activeShift?.id || null,
            shiftName: activeShift?.shiftName || null,
            amount: finalTotal,
            amountCents: Math.round(finalTotal * 100),
            method: paymentMethod,
            reference: paymentRef || null,
            timestamp: new Date().toISOString(),
            approvedBy: paymentMethod === 'credito' ? 'Admin PIN' : (closeDineInOnReport && (paymentMethod === 'pago_movil' || paymentMethod === 'zelle') ? 'Auto-Approved (Setting)' : 'Waiter'),
            clientId: associatedClientId || null,
            clientName: finalClientName || null
          });
        }

        if (paymentMethod === 'credito') {
          const resId = await processClientCreditDebt({
            clientId: selectedClientIdForCredit || undefined,
            nombre: creditName.trim(),
            tlf: creditPhone.trim(),
            cedula: creditId.trim(),
            direccion: creditAddress.trim(),
            email: creditEmail.trim()
          }, finalTotal);
          if (resId) {
            associatedClientId = resId;
          }
        }

        if (allPaid) {
          await updateDoc(doc(db, 'sessions', session.id), { 
            status: 'completed',
            accounts: updatedAccounts,
            paymentStatus: 'validated',
            customerName: finalClientName || session.customerName || accounts.find((a: any) => a.id === activeAccountId)?.name || 'Cliente',
            customerPhone: finalClientPhone || session.customerPhone || '',
            totalAmount: finalTotal,
            payment: {
              method: paymentMethod,
              reference: paymentMethod === 'mixto' ? 'MIXTO' : (paymentRef || 'EFECTIVO'),
              currency: paymentCurrency,
              totalUSD: finalTotal,
              totalBs: finalTotal * exchangeRate,
              tipUSD: tipAmount,
              timestamp: new Date().toISOString(),
              receiptImage: receiptImage || null,
              mixedPayments: paymentMethod === 'mixto' ? mixedPayments : null,
              creditClient: (paymentMethod === 'credito' || finalClientName) ? {
                clientId: associatedClientId || null,
                nombre: finalClientName || creditName.trim(),
                tlf: creditPhone.trim(),
                cedula: creditId.trim(),
                direccion: creditAddress.trim(),
                email: creditEmail.trim()
              } : null
            }
          });

          // Close any ghost sessions
          const ghostSessions = activeSessions.filter(s => s.tableId === session.tableId && s.id !== session.id);
          for (const ghost of ghostSessions) {
            await updateDoc(doc(db, 'sessions', ghost.id), { status: 'completed' }).catch(console.error);
          }

          if (!isDelivery) {
            await updateDoc(doc(db, 'tables', selectedTable.id), { status: 'free' });
          }
          setSelectedTable(null);
          setCart([]);
          setActiveTab('menu');
        } else {
          // Only this account is paid
          await updateDoc(doc(db, 'sessions', session.id), { accounts: updatedAccounts });
          const nextActive = updatedAccounts.find((acc: any) => acc.status !== 'paid');
          if (nextActive) setActiveAccountId(nextActive.id);
          setActiveTab('menu');
        }

        alert('✅ Pago procesado y confirmado con éxito.');
      } else {
        // Log non-instant payment
        const waiterName = currentUser?.name || localStorage.getItem('demo_user_name') || 'Mesero';
        if (paymentMethod === 'credito') {
          await logAction('finance', waiterName, 'Solicitó crédito para cliente', `Mesa ${selectedTable.number} - Cliente: ${creditName.trim()} - Total: $${finalTotal.toFixed(2)}`);
        } else {
          await logAction('finance', waiterName, 'Registró pago pendiente de validación', `Mesa ${selectedTable.number} - Método: ${paymentMethod.toUpperCase()} - Total: $${finalTotal.toFixed(2)}`);
        }

        // Needs Confirmation/Validation from Caja
        if (paymentMethod === 'credito') {
          // Enviar a caja para aprobación de crédito
          await updateDoc(doc(db, 'sessions', session.id), {
            paymentStatus: 'pending_credit_approval',
            customerName: finalClientName || session.customerName || accounts.find((a: any) => a.id === activeAccountId)?.name || 'Cliente',
            customerPhone: finalClientPhone || session.customerPhone || '',
            totalAmount: finalTotal,
            pendingPayment: {
              accountId: activeAccountId,
              method: 'credito',
              totalUSD: finalTotal,
              totalBs: finalTotal * exchangeRate,
              tipUSD: tipAmount,
              timestamp: new Date().toISOString(),
              creditClient: {
                clientId: selectedClientIdForCredit || null,
                nombre: creditName.trim(),
                tlf: creditPhone.trim(),
                cedula: creditId.trim(),
                direccion: creditAddress.trim(),
                email: creditEmail.trim()
              }
            }
          });
          
          if (!isDelivery) {
            await updateDoc(doc(db, 'tables', selectedTable.id), { status: 'waiting_bill' });
          }
          setSelectedTable(null);
          setCart([]);
          setActiveTab('menu');
          alert('ℹ️ Solicitud de crédito enviada. Debe ser autorizada por el Administrador o Caja.');
        } else {
          // Pago Móvil or Zelle -> Enviar a cola de validación
          await updateDoc(doc(db, 'sessions', session.id), {
            paymentStatus: 'pending_validation',
            customerName: finalClientName || session.customerName || accounts.find((a: any) => a.id === activeAccountId)?.name || 'Cliente',
            customerPhone: finalClientPhone || session.customerPhone || '',
            totalAmount: finalTotal,
            pendingPayment: {
              accountId: activeAccountId,
              method: paymentMethod,
              reference: paymentMethod === 'mixto' ? 'MIXTO' : paymentRef.trim(),
              currency: paymentCurrency,
              totalUSD: finalTotal,
              totalBs: finalTotal * exchangeRate,
              tipUSD: tipAmount,
              receiptImage: receiptImage,
              timestamp: new Date().toISOString(),
              mixedPayments: paymentMethod === 'mixto' ? mixedPayments : null,
              client: finalClientName ? {
                clientId: associatedClientId || null,
                nombre: finalClientName,
                tlf: creditPhone.trim(),
                cedula: creditId.trim(),
                direccion: creditAddress.trim(),
                email: creditEmail.trim()
              } : null
            }
          });

          if (!isDelivery) {
            await updateDoc(doc(db, 'tables', selectedTable.id), { status: 'waiting_bill' });
          }
          setSelectedTable(null);
          setCart([]);
          setActiveTab('menu');
          alert('ℹ️ Pago registrado. Esperando validación en Caja.');
        }
      }

      setIsPaying(false);
      setPaymentRef('');
      setReceiptImage(null);
      setSelectedClientIdForCredit('');
      setCreditName('');
      setCreditPhone('');
      setCreditId('');
      setCreditAddress('');
      setCreditEmail('');
      setAdminPin('');
      setAdminPinError('');
      setIncludeTip(true);
      setNonCreditClientMode('none');
                  setMixedPayments([]);
                  setCurrentMixedAmount('');
    } catch (err) {
      console.error(err);
      alert('Error procesando el pago: ' + (err as Error).message);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingReceipt(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 500;
        const MAX_HEIGHT = 500;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setReceiptImage(dataUrl);
          setIsUploadingReceipt(false);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleAddAccount = async () => {
    if (!selectedTable) return;
    const session = getSessionForTable(selectedTable.id);
    if (!session) return;
    if (!newAccountName.trim()) return;
    
    try {
      const accounts = session.accounts || [{ id: 'default', name: 'Cuenta 1', status: 'active' }];
      const newAccountId = 'cuenta-' + Date.now();
      
      const newAccounts = [...accounts, { id: newAccountId, name: newAccountName.trim(), status: 'active' }];
      
      await updateDoc(doc(db, 'sessions', session.id), { accounts: newAccounts });
      
      // Add audit log
      const waiterName = currentUser?.name || localStorage.getItem('demo_user_name') || 'Mesero';
      await logAction('order', waiterName, 'Abrió una cuenta', `Mesa ${selectedTable.number} - Cuenta: ${newAccountName.trim()}`);

      setActiveAccountId(newAccountId);
      setIsAddingAccount(false);
      setNewAccountName('');
    } catch (err) {
      console.error(err);
    }
  };

  const activeOrdersTotal = activeOrders.reduce((acc, o) => {
    const itemPrice = o.price !== undefined ? o.price : (menu.find(m => m.name === o.itemName)?.price || 0);
    return acc + (itemPrice * (o.quantity || 1));
  }, 0);

  const waiterCouponDiscount = useMemo(() => {
    if (!appliedWaiterCoupon) return 0;
    if (appliedWaiterCoupon.minSpend && activeOrdersTotal < appliedWaiterCoupon.minSpend) return 0;
    let disc = 0;
    if (appliedWaiterCoupon.discountType === 'percentage') {
      disc = (activeOrdersTotal * appliedWaiterCoupon.discountValue) / 100;
      if (appliedWaiterCoupon.maxDiscount && disc > appliedWaiterCoupon.maxDiscount) {
        disc = appliedWaiterCoupon.maxDiscount;
      }
    } else {
      disc = appliedWaiterCoupon.discountValue;
    }
    return Math.min(disc, activeOrdersTotal);
  }, [appliedWaiterCoupon, activeOrdersTotal]);

  const activeOrdersSubtotalAfterCoupon = Math.max(0, activeOrdersTotal - waiterCouponDiscount);
  const showServiceCharge = settings?.serviceChargeEnabled !== false && settings?.suggestedTipsEnabled !== false;
  const tipAmount = includeTip && showServiceCharge ? activeOrdersSubtotalAfterCoupon * (servicePercent / 100) : 0;
  const finalTotal = activeOrdersSubtotalAfterCoupon + tipAmount;

  return (
    <div className="h-full flex flex-col gap-4">
      {/* KITCHEN ALERTS BANNER - Always visible at top of Waiter View */}
      {readyOrdersList.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3.5 sm:p-4 shrink-0 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="animate-bounce text-base">🔔</span>
              <span className="text-xs sm:text-sm font-black uppercase text-emerald-900 tracking-wider">
                ¡HAY {readyOrdersList.length} {readyOrdersList.length === 1 ? 'PLATILLO LISTO' : 'PLATILLOS LISTOS'} PARA SERVIR!
              </span>
            </div>
            <button 
              onClick={() => setShowReadyDetails(!showReadyDetails)}
              className="text-[10px] sm:text-xs font-black text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              {showReadyDetails ? 'Ocultar' : 'Ver Detalles'}
            </button>
          </div>
          
          {showReadyDetails && (
            <div className="space-y-2 mt-3 max-h-44 overflow-auto pr-1">
              {readyOrdersList.map(order => {
                const match = order.docRefPath?.match(/sessions\/([^\/]+)/);
                const sessionId = match ? match[1] : null;
                const session = activeSessions.find(s => s.id === sessionId);
                let targetLabel = 'Desconocido';
                if (session) {
                  if (session.type === 'delivery') {
                    targetLabel = `Llevar: ${session.customerName || 'Cliente'}`;
                  } else {
                    const table = tables.find(t => t.id === session.tableId);
                    targetLabel = table ? `Mesa ${table.number}` : `Mesa ${session.tableId}`;
                  }
                }
                return (
                  <div key={order.id} className="flex items-center justify-between bg-white p-2.5 sm:p-3 rounded-xl border border-emerald-100/60 shadow-sm text-xs gap-3">
                    <div className="flex flex-col">
                      <span className="font-extrabold text-slate-800 text-sm">
                        {order.quantity}x {order.itemName}
                      </span>
                      <span className="text-[11px] text-slate-500 font-bold mt-0.5">
                        Para: <span className="text-emerald-700 font-extrabold">{targetLabel}</span>
                      </span>
                    </div>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await updateDoc(doc(db, order.docRefPath), { status: 'delivered' });
                        } catch (err) {
                          console.error("Error marking delivered:", err);
                        }
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-sm transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Check size={13} /> Entregado
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 flex gap-8 min-h-0">
        {/* Left: Table Map */}
        <div className={`flex-1 bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm overflow-hidden flex flex-col transition-all duration-300 ${selectedTable ? 'hidden lg:flex lg:mr-[540px] xl:mr-[600px]' : 'flex'}`}>
          {/* HEADER & TABLE STATUS FILTER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-slate-800">Mapa de Mesas</h2>
            <p className="text-slate-400 text-[11px] sm:text-xs">
              Mesero activo: <strong className="text-indigo-600 font-extrabold">{currentUser?.name || localStorage.getItem('demo_user_name') || 'Mesero'}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/50 self-start sm:self-auto">
              {[
                { id: 'all', label: 'Todas' },
                { id: 'free', label: 'Libres', dot: 'bg-slate-300' },
                { id: 'occupied', label: 'Ocupadas', dot: 'bg-rose-500' },
                { id: 'ready', label: 'Con Platos', dot: 'bg-emerald-500 animate-pulse' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setTableFilter(f.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all ${
                    tableFilter === f.id ? 'bg-black text-white shadow' : 'text-slate-500 hover:text-black hover:bg-white'
                  }`}
                >
                  {f.dot && <span className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />}
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 relative rounded-3xl p-4 overflow-auto">
          {tables.length === 0 && activeSessions.filter(s => s.type === 'delivery').length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-300 font-medium italic">
              Sin mesas cargadas. Ve a Admin para configurar.
            </div>
          )}
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 sm:gap-6 mb-8">
            {filteredTables.map((table) => {
              const session = getSessionForTable(table.id);
              const hasReadyOrders = session && readyOrdersList.some(o => o.docRefPath?.includes(`/sessions/${session.id}/`));
              const isStarred = isBookmarked(table.id, 'table');
              return (
                <motion.button
                  key={table.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedTable(table)}
                  className={`aspect-square rounded-[24px] flex flex-col items-center justify-center transition-all relative group/card ${
                    table.status === 'free' 
                      ? 'bg-slate-50 border-2 border-dashed border-slate-200 hover:border-black' 
                      : hasReadyOrders
                        ? 'bg-emerald-50 border-2 border-emerald-500 shadow-lg shadow-emerald-500/10'
                        : 'bg-rose-50 border-2 border-rose-500 shadow-md'
                  }`}
                >
                  {/* Bookmark Star Button (Admin Only) */}
                  {currentUser?.role === 'admin' && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBookmark({
                          id: table.id,
                          type: 'table',
                          name: `Mesa ${table.number.toString().padStart(2, '0')}`,
                          details: table.status === 'free' ? 'Disponible' : 'Ocupada'
                        });
                      }}
                      className={`absolute top-2 left-2 p-1.5 rounded-xl transition-all z-10 cursor-pointer ${
                        isStarred 
                          ? 'bg-amber-100/90 text-amber-500 shadow-sm' 
                          : 'bg-slate-200/50 text-slate-400 opacity-0 group-hover/card:opacity-100 hover:bg-amber-50 hover:text-amber-500'
                      }`}
                      title={isStarred ? "Quitar de Marcadores" : "Añadir a Marcadores"}
                    >
                      <Star size={13} className={isStarred ? "fill-amber-400 text-amber-500" : ""} />
                    </div>
                  )}

                  {session && (
                    <div className={`absolute top-0 right-0 p-2 text-white text-[8px] font-bold px-2 rounded-bl-xl ${hasReadyOrders ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}>
                      {hasReadyOrders ? 'LISTO 🔔' : 'En curso'}
                    </div>
                  )}
                  <span className={`text-xs font-bold ${table.status === 'free' ? 'text-slate-400' : hasReadyOrders ? 'text-emerald-950 font-extrabold' : 'text-rose-900'}`}>
                    MESA {table.number.toString().padStart(2, '0')}
                  </span>
                  <span className={`text-[10px] font-bold uppercase mt-1 ${table.status === 'free' ? 'text-emerald-500' : hasReadyOrders ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {table.status === 'free' ? 'DISPONIBLE' : hasReadyOrders ? 'PLATO LISTO 🍽️' : 'OCUPADA'}
                  </span>
                </motion.button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mb-6 border-t border-slate-100 pt-6">
            <div>
              <h2 className="text-lg font-semibold">Delivery / Para Llevar</h2>
              <p className="text-slate-400 text-xs">Gestiona pedidos para llevar.</p>
            </div>
            <button
              onClick={() => setIsCreatingDelivery(true)}
              className="bg-black text-white px-4 py-2 rounded-xl text-xs font-bold hover:scale-105 transition-transform"
            >
              + Nuevo Pedido
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {activeSessions.filter(s => s.type === 'delivery').map(session => (
              <motion.button
                key={session.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setSelectedTable({ id: 'delivery-' + session.id, number: session.customerName || 'Llevar', status: 'occupied', capacity: 1 });
                  setViewingDeliveryInfo(session);
                }}
                className="aspect-square rounded-[24px] flex flex-col items-center justify-center transition-all relative bg-amber-50 border-2 border-amber-500 shadow-md"
              >
                <div className="absolute top-0 right-0 p-2 bg-amber-500 text-white text-[8px] font-bold px-2 rounded-bl-xl">
                  Llevar
                </div>
                <span className="text-xs font-bold text-amber-900 truncate px-2 w-full text-center">
                  {session.customerName || 'Delivery'}
                </span>
                <span className="text-[10px] font-bold uppercase mt-1 text-amber-600">
                  ACTIVO
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Management Panel - From extreme top to extreme bottom */}
      <AnimatePresence>
        {selectedTable && (
          <>
            {/* Backdrop for mobile / tablet screens */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTable(null)}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[65] lg:hidden"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 w-full h-screen h-[100dvh] z-[70] bg-white shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-3.5 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white/95 backdrop-blur-sm z-10">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setSelectedTable(null)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl transition-colors text-xs font-black flex items-center gap-1 cursor-pointer"
                    title="Cerrar comanda"
                  >
                    <X size={16} />
                    <span className="sm:hidden text-[11px]">Volver</span>
                  </button>
                  <div>
                    <h3 className="font-extrabold text-base sm:text-lg text-slate-900 leading-tight flex items-center gap-2">
                      <span>{selectedTable.id.startsWith('delivery-') ? 'Llevar: ' : 'Mesa '}{selectedTable.number}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        selectedTable.status === 'free' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {selectedTable.status === 'free' ? 'Libre' : 'Ocupada'}
                      </span>
                    </h3>
                    <p className="text-slate-400 text-[10px] sm:text-xs">Gestión de comanda y pedidos</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedTable(null)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-black rounded-xl transition-all text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <X size={14} />
                  <span>Cerrar</span>
                </button>
              </div>

            {selectedTable.id.startsWith('delivery-') && (
              (() => {
                const session = getSessionForTable(selectedTable.id);
                if (!session) return null;
                return (
                  <div className="mx-3 sm:mx-6 mt-2 sm:mt-4 p-3 sm:p-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-xs space-y-2 shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-amber-950 uppercase tracking-wider text-[10px]">Info Pedido</span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingDeliveryInfo(session);
                            setEditCustomerName(session.customerName || '');
                            setEditDeliveryType(session.deliveryType || 'delivery');
                            setEditSelectedZoneId(session.deliveryZoneId || deliveryZones[0]?.id || '');
                            setEditDeliveryReference(session.deliveryReference || '');
                            setEditWhatsappLocation((session as any).whatsappLocation || (session as any).locationUrl || '');
                            setEditCustomerPhone(session.customerPhone || '');
                            setEditCustomerAddress(session.customerAddress || '');
                            setEditPaymentMethod(session.paymentMethod || 'Efectivo');
                            setEditPaymentReference(session.paymentReference || '');
                            setEditDeliveryReceiptImage((session as any).paymentReceiptImage || (session as any).payment?.receiptImage || null);
                          }}
                          className="text-[10px] text-amber-800 hover:text-amber-950 hover:underline font-extrabold flex items-center gap-0.5"
                          title="Editar información"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsDeliveryInfoCollapsed(!isDeliveryInfoCollapsed)}
                          className="text-[10px] text-indigo-700 hover:underline font-extrabold ml-1 bg-amber-100/80 px-2 py-0.5 rounded-lg"
                        >
                          {isDeliveryInfoCollapsed ? ' Ver más ▼' : ' Ocultar ▲'}
                        </button>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        session.paymentStatus === 'validated' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {session.paymentStatus === 'validated' ? 'Validado' : 'Por Validar'}
                      </span>
                    </div>

                    {!isDeliveryInfoCollapsed ? (
                      <div className="space-y-2 pt-1 border-t border-amber-200/40">
                        <div className="grid grid-cols-2 gap-2 text-slate-700">
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-bold block">Cliente</span>
                            <span className="font-bold text-slate-900">{session.customerName || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-bold block">Teléfono</span>
                            <a 
                              href={`https://wa.me/${session.customerPhone?.replace(/[^0-9+]/g, '')}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="font-bold text-indigo-600 hover:underline flex items-center gap-1"
                            >
                              {session.customerPhone || 'N/A'}
                            </a>
                          </div>
                        </div>

                        <div className="text-slate-700 space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] text-slate-400 uppercase font-bold">Tipo de Entrega</span>
                            {session.deliveryType === 'delivery' && (
                              <span className="text-[9px] font-extrabold text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded-full">
                                Envío: ${((session as any).deliveryFee || 0).toFixed(2)}
                              </span>
                            )}
                          </div>
                          <span className="font-bold text-slate-900 block capitalize text-xs">
                            {session.deliveryType === 'pickup' ? '🛍️ Retiro en Local' : `🛵 Delivery (${(session as any).deliveryZoneName || 'Zona Estándar'})`}
                          </span>
                          {session.customerAddress && (
                            <span className="text-slate-700 block text-xs font-medium">📍 {session.customerAddress}</span>
                          )}
                          {(session as any).deliveryReference && (
                            <span className="text-slate-500 block text-[11px] italic">Ref: {(session as any).deliveryReference}</span>
                          )}
                          {((session as any).whatsappLocation || (session as any).locationUrl) && (
                            <a 
                              href={((session as any).whatsappLocation || (session as any).locationUrl).startsWith('http') ? ((session as any).whatsappLocation || (session as any).locationUrl) : `https://${((session as any).whatsappLocation || (session as any).locationUrl)}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-extrabold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 px-2 py-0.5 rounded-xl mt-1 transition-colors cursor-pointer"
                            >
                              <Navigation size={11} className="-rotate-45 text-indigo-600" /> Abrir GPS
                              <ExternalLink size={9} className="ml-0.5 opacity-70" />
                            </a>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-amber-200/40 text-slate-700">
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-bold block">Pago</span>
                            <span className="font-bold text-slate-900 uppercase">{session.paymentMethod || 'Efectivo'}</span>
                          </div>
                          {session.paymentReference && (
                            <div>
                              <span className="text-[9px] text-slate-400 uppercase font-bold block">Referencia</span>
                              <span className="font-bold text-slate-900 font-mono">#{session.paymentReference}</span>
                            </div>
                          )}
                        </div>
                        {((session as any).paymentReceiptImage || (session as any).payment?.receiptImage) && (
                          <div className="pt-1 border-t border-amber-200/40 flex items-center justify-between">
                            <span className="text-[9px] text-slate-400 uppercase font-bold">Comprobante</span>
                            <button
                              type="button"
                              onClick={() => setViewingReceiptModal((session as any).paymentReceiptImage || (session as any).payment?.receiptImage)}
                              className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                            >
                              📷 Ver Comprobante
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-700 flex items-center justify-between font-medium">
                        <span className="truncate max-w-[220px]">
                          <strong>{session.customerName}</strong> • {session.deliveryType === 'pickup' ? '🛍️ Retiro' : '🛵 Delivery'} ({session.paymentMethod || 'Efectivo'})
                        </span>
                        <span className="text-indigo-700 font-bold shrink-0">📍 {session.customerAddress ? 'Con Dirección' : 'Sin Dir'}</span>
                      </div>
                    )}
                  </div>
                );
              })()
            )}

            {!getSessionForTable(selectedTable.id) ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                  <Users className="text-slate-300" size={32} />
                </div>
                <h4 className="font-bold text-slate-900 mb-2">Mesa Disponible</h4>
                <p className="text-slate-400 text-sm mb-8">No hay una sesión activa para esta mesa.</p>
                <button 
                  onClick={() => setIsOpeningTable(selectedTable)}
                  className="w-full bg-black text-white p-5 rounded-xl text-sm font-medium shadow-lg hover:shadow-xl transition-shadow"
                >
                  Abrir Mesa
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* HIGH-VISIBILITY ACCOUNT SELECTION BOARD */}
                {!selectedTable.id.startsWith('delivery-') && (
                  <div className="bg-slate-50 p-3 sm:p-4 border-b border-slate-100 shrink-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Cuentas / Personas en Mesa {selectedTable.number}
                      </span>
                      <span className="text-[8px] bg-indigo-50 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wide">
                        Selecciona para ordenar
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(getSessionForTable(selectedTable.id)?.accounts || [{ id: 'default', name: 'Cuenta 1', status: 'active' }]).map((acc: any) => {
                        const isActive = activeAccountId === acc.id;
                        const isPaid = acc.status === 'paid';
                        return (
                          <button
                            key={acc.id}
                            disabled={isPaid}
                            onClick={() => setActiveAccountId(acc.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 border shadow-sm ${
                              isActive
                                ? 'bg-black text-white border-black scale-[1.01]'
                                : isPaid 
                                  ? 'bg-slate-100 text-slate-400 border-slate-200/50 line-through cursor-not-allowed'
                                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${isPaid ? 'bg-slate-300' : isActive ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                            <span>{acc.name}</span>
                            {isPaid && (
                              <span className="text-[8px] bg-slate-200 text-slate-500 font-black px-1.5 py-0.5 rounded tracking-wider">
                                PAGADO
                              </span>
                            )}
                          </button>
                        );
                      })}
                      <button 
                        onClick={() => setIsAddingAccount(true)}
                        className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100/50 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 transition-all shadow-sm"
                        title="Dividir cuenta / Agregar Persona"
                      >
                        <Plus size={14} /> + Persona
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex px-4 border-b border-slate-100 items-center justify-between shrink-0 bg-white">
                  <div className="flex gap-6">
                    <button 
                      onClick={() => setActiveTab('menu')} 
                      className={`py-3 px-1.5 font-bold text-xs sm:text-sm tracking-wider uppercase transition-colors relative ${
                        activeTab === 'menu' ? 'text-black' : 'text-slate-400 hover:text-black'
                      }`}
                    >
                      Menú
                      {activeTab === 'menu' && (
                        <span className="absolute bottom-0 left-0 w-full h-0.5 bg-black rounded-full" />
                      )}
                    </button>
                    <button 
                      onClick={() => setActiveTab('bill')} 
                      className={`py-3 px-1.5 font-bold text-xs sm:text-sm tracking-wider uppercase transition-colors relative ${
                        activeTab === 'bill' ? 'text-black' : 'text-slate-400 hover:text-black'
                      }`}
                    >
                      Ver Comanda ({activeOrders.length})
                      {activeTab === 'bill' && (
                        <span className="absolute bottom-0 left-0 w-full h-0.5 bg-black rounded-full" />
                      )}
                    </button>
                  </div>
                </div>
                
                {activeTab === 'menu' ? (
                  <>
                    {/* Menu Browser with Search */}
                    <div className="p-2 sm:p-3 border-b border-slate-50 shrink-0 space-y-2 bg-slate-50/40">
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Buscar plato o bebida..."
                          value={menuSearch}
                          onChange={(e) => setMenuSearch(e.target.value)}
                          className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-black placeholder-slate-400 font-medium"
                        />
                        {menuSearch && (
                          <button 
                            onClick={() => setMenuSearch('')}
                            className="absolute right-2.5 top-2 text-slate-400 hover:text-black cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                        {categories.map(cat => (
                          <button 
                            key={cat}
                            onClick={() => setCategory(cat)}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                              category === cat ? 'bg-black text-white scale-[1.01]' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-0 p-2.5 sm:p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-4 content-start pb-28 sm:pb-12">
                      {filteredMenu.map(item => {
                        const stockAlert = getMenuItemStockAlert(item, ingredients);
                        const isOutOfStock = stockAlert.status === 'out_of_stock';
                        return (
                          <button
                            key={item.id}
                            disabled={isOutOfStock}
                            onClick={() => { setSelectedItem(item); setModalQty(1); setExcludedIds([]); setExtraNote(''); setSelectedExtras([]); }}
                            className={`group border border-slate-100 hover:border-black rounded-2xl p-2 sm:p-3 text-left transition-all duration-200 flex flex-col hover:shadow-md bg-white relative ${
                              isOutOfStock ? 'opacity-55 cursor-not-allowed' : ''
                            }`}
                          >
                            <div className="aspect-[16/10] sm:aspect-[4/3] bg-slate-50 rounded-xl mb-2 overflow-hidden w-full relative">
                              <img src={item.image || 'https://via.placeholder.com/150'} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                              
                              {/* Custom tags badges overlay */}
                              {item.alerts && item.alerts.length > 0 && (
                                <div className="absolute bottom-1.5 left-1.5 right-1.5 flex flex-wrap gap-1 z-10">
                                  {item.alerts.map(tagId => {
                                    const labelMap: { [key: string]: string } = {
                                      'Spicy': '🌶️',
                                      'Gluten-Free': '🌾',
                                      'Lactose-Free': '🥛',
                                      'Vegan': '🌱',
                                      'Vegetarian': '🥗',
                                      'Popular': '🔥',
                                      'New': '✨',
                                      'Slow-Prep': '⏳',
                                      'Chef-Special': '⭐'
                                    };
                                    const labelTitle: { [key: string]: string } = {
                                      'Spicy': 'Picante',
                                      'Gluten-Free': 'Sin Gluten',
                                      'Lactose-Free': 'Sin Lactosa',
                                      'Vegan': 'Vegano',
                                      'Vegetarian': 'Vegetariano',
                                      'Popular': 'Más Vendido',
                                      'New': 'Nuevo',
                                      'Slow-Prep': 'Prep. Lenta',
                                      'Chef-Special': 'Recomendado'
                                    };
                                    return (
                                      <span key={tagId} title={labelTitle[tagId] || tagId} className="px-1 py-0.5 bg-black/85 backdrop-blur text-white text-[9px] font-bold rounded-md">
                                        {labelMap[tagId] || tagId}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}

                              {isOutOfStock && (
                                <div className="absolute inset-0 bg-rose-950/60 backdrop-blur-[1px] flex items-center justify-center">
                                  <span className="bg-white/95 px-2 py-0.5 text-[8px] sm:text-[9px] font-black text-rose-600 rounded-lg shadow-sm tracking-wider uppercase">
                                    Agotado 🚫
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Inventory status helper text */}
                            {stockAlert.status !== 'available' && (
                              <span className={`text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider mb-0.5 block ${
                                isOutOfStock ? 'text-rose-500' : 'text-amber-500 animate-pulse'
                              }`}>
                                {stockAlert.text}
                              </span>
                            )}
                            
                            <h5 className="font-extrabold text-xs sm:text-sm text-slate-900 tracking-tight leading-tight line-clamp-2 w-full mb-1 min-h-[2rem] flex items-center">{item.name}</h5>
                            <div className="flex items-baseline justify-between gap-1 mt-auto w-full pt-1 border-t border-slate-50">
                              <span className="text-xs sm:text-sm text-slate-950 font-black">{formatPrice(item.price)}</span>
                              <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold">{formatBs(toBolivares(item.price))}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Cart / Order Summary */}
                    {cart.length > 0 && (
                      <div className="p-3.5 sm:p-4 bg-white border-t border-slate-200 shrink-0 z-20 shadow-[0_-8px_25px_rgba(0,0,0,0.08)] pb-[max(1rem,env(safe-area-inset-bottom))]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Nuevo Pedido</span>
                          <span className="text-[10px] bg-slate-900 text-white font-black px-2 py-0.5 rounded-full">{cart.length} {cart.length === 1 ? 'ítem' : 'ítems'}</span>
                        </div>
                        
                        <div className="space-y-2 max-h-28 overflow-y-auto mb-3 border-b border-slate-100 pb-2.5">
                          {cart.map((entry, index) => (
                            <div key={index} className="flex items-start justify-between text-xs group gap-2">
                              <span className="text-slate-500 block">
                                <span className="font-bold text-black">{entry.qty}x</span> {entry.item.name}
                                
                                {/* Selected Extras list */}
                                {entry.selectedExtras && entry.selectedExtras.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {entry.selectedExtras.map((extra, eIdx) => (
                                      <span key={eIdx} className="text-[8px] bg-indigo-50 border border-indigo-100/30 text-indigo-700 px-1.5 py-0.5 rounded font-black uppercase tracking-wide">
                                        + {extra.name}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {entry.excludedIngredientIds && entry.excludedIngredientIds.length > 0 && (
                                  <span className="flex flex-wrap gap-1 mt-0.5">
                                    {entry.excludedIngredientIds.map(id => {
                                      const ing = ingredients.find(i => i.id === id);
                                      if (!ing) return null;
                                      return (
                                        <span key={id} className="text-[8px] bg-rose-50 text-rose-600 font-extrabold px-1.5 py-0.5 rounded border border-rose-100 uppercase tracking-wide">
                                          Sin {ing.name}
                                        </span>
                                      );
                                    })}
                                  </span>
                                )}
                                {entry.note && (
                                  <span className="block text-[9px] text-amber-600 italic mt-0.5">"{entry.note}"</span>
                                )}
                              </span>
                              <div className="flex items-center gap-2.5 flex-shrink-0">
                                <span className="font-mono text-[11px] font-bold text-slate-900">${(getCartEntryPrice(entry) * entry.qty).toFixed(2)}</span>
                                <button
                                  onClick={() => setCart(cart.filter((_, i) => i !== index))}
                                  className="text-rose-400 hover:text-rose-600 p-1 rounded-lg transition-colors cursor-pointer"
                                  title="Eliminar"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between mb-3 pt-0.5">
                          <span className="font-bold text-xs text-slate-700">Total a Enviar ({activeCurrency})</span>
                          <div className="text-right flex items-baseline gap-1.5">
                            <span className="text-lg font-black text-slate-950">{formatPrice(cart.reduce((acc, c) => acc + getCartEntryPrice(c) * c.qty, 0))}</span>
                            <span className="text-xs text-slate-400 font-bold">{formatBs(toBolivares(cart.reduce((acc, c) => acc + getCartEntryPrice(c) * c.qty, 0)))}</span>
                          </div>
                        </div>

                        <button 
                          disabled={cart.length === 0 || isSendingOrder}
                          onClick={sendOrder}
                          className={`w-full text-white py-3.5 px-4 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 ${
                            cart.length > 0 && !isSendingOrder
                              ? 'bg-black hover:bg-slate-800 shadow-black/10' 
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                          }`}
                        >
                          <ShoppingBag size={16} />
                          {isSendingOrder ? 'Enviando a Cocina...' : 'Enviar a Cocina'}
                        </button>
                      </div>
                    )}

                    {/* Quick navigation to bill when cart is empty but table has active consumption */}
                    {cart.length === 0 && activeOrders.length > 0 && (
                      <div className="p-3 bg-white border-t border-slate-100 shrink-0 flex items-center justify-between gap-3 shadow-[0_-4px_15px_rgba(0,0,0,0.05)] pb-[max(0.75rem,env(safe-area-inset-bottom))] z-20">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                          <span className="text-xs font-bold text-slate-700 truncate">
                            {activeOrders.length} {activeOrders.length === 1 ? 'ítem comandado' : 'ítems comandados'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('bill')}
                          className="bg-black hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm active:scale-95 transition-all shrink-0 cursor-pointer"
                        >
                          <Receipt size={14} />
                          Ver Cuenta y Cobrar →
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex-1 flex flex-col relative bg-slate-50 overflow-hidden min-h-0">
                    <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 min-h-0">
                      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-4">
                        <h4 className="font-bold text-xs sm:text-sm mb-3 flex justify-between uppercase tracking-wider text-slate-800">
                          <span>Items Registrados</span>
                          <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md text-[10px] font-black">{activeOrders.length}</span>
                        </h4>
                        <div className="space-y-3">
                          {activeOrders.map(order => {
                            const itemPrice = order.price !== undefined ? order.price : (menu.find(m => m.name === order.itemName)?.price || 0);
                            const menuItem = menu.find(m => m.id === order.menuItemId || m.name === order.itemName);
                            const prepTime = menuItem?.preparationTime;
                            const orderElapsed = order.timestamp ? Math.max(0, Math.floor((Date.now() - new Date(order.timestamp).getTime()) / 60000)) : 0;
                            const isDelayed = prepTime && orderElapsed > prepTime && (order.status === 'pending' || order.status === 'preparing');
                            return (
                            <div key={order.id} className={`flex justify-between items-start text-xs sm:text-sm border-b border-slate-50 pb-2.5 last:border-0 last:pb-0 p-1.5 rounded-lg transition-colors ${isDelayed ? 'bg-rose-50/60 border-rose-100' : ''}`}>
                              <div className="flex flex-col flex-1 pr-2">
                                <span className="font-semibold text-slate-900"><span className="font-bold text-black">{order.quantity}x</span> {order.itemName}</span>
                                
                                {/* Excluded Ingredients Pills */}
                                {order.excludedIngredientIds && order.excludedIngredientIds.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {order.excludedIngredientIds.map((id: string) => {
                                      const ing = ingredients.find(i => i.id === id);
                                      if (!ing) return null;
                                      return (
                                        <span key={id} className="text-[8px] bg-rose-50 text-rose-600 font-extrabold px-1.5 py-0.5 rounded border border-rose-100 uppercase tracking-wide">
                                          Sin {ing.name}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Seat & Course Badges */}
                                <div className="flex flex-wrap items-center gap-1 mt-1">
                                  {order.seatNumber && (
                                    <span className="text-[8px] bg-slate-900 text-white font-black px-1.5 py-0.5 rounded">
                                      💺 Asiento {order.seatNumber}
                                    </span>
                                  )}
                                  {order.course && (
                                    <span className="text-[8px] bg-indigo-100 text-indigo-900 font-bold px-1.5 py-0.5 rounded capitalize">
                                      {order.course === 'starter' ? '🥗 Entrada' : order.course === 'dessert' ? '🍰 Postre' : order.course === 'beverage' ? '🍹 Bebida' : '🥩 Fuerte'}
                                    </span>
                                  )}
                                  {order.courseStatus === 'hold' && (
                                    <span className="text-[8px] bg-amber-100 text-amber-900 font-black px-1.5 py-0.5 rounded border border-amber-300">
                                      ⏳ En Espera
                                    </span>
                                  )}
                                </div>

                                {/* Special Instructions / Note */}
                                {order.note && (
                                  <span className="text-[10px] text-amber-600 italic mt-1 font-medium bg-amber-50/50 border border-amber-100/40 rounded px-1.5 py-0.5 self-start">
                                    " {order.note} "
                                  </span>
                                )}

                                <div className="flex items-center gap-2 mt-2">
                                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                    order.status === 'ready' 
                                      ? 'bg-emerald-100 text-emerald-800' 
                                      : order.status === 'preparing'
                                        ? 'bg-indigo-100 text-indigo-800'
                                        : order.status === 'delivered'
                                          ? 'bg-slate-100 text-slate-500'
                                          : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {order.status === 'ready' ? 'Listo 🔔' : order.status === 'preparing' ? 'En cocina 🍳' : order.status === 'delivered' ? 'Entregado ✓' : 'Pendiente ⏳'}
                                  </span>

                                  {prepTime ? (
                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                                      isDelayed 
                                        ? 'bg-rose-100 text-rose-700 border border-rose-300 animate-pulse' 
                                        : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                    }`}>
                                      ⏱️ {prepTime}m
                                    </span>
                                  ) : null}

                                  {isDelayed && (
                                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-rose-600 text-white animate-pulse">
                                      ⚠️ Retrasado (+{orderElapsed - prepTime}m)
                                    </span>
                                  )}

                                  {order.status === 'ready' && (
                                    <button
                                      onClick={async () => {
                                        try {
                                          if (!selectedTable) return;
                                          const tableSession = getSessionForTable(selectedTable.id);
                                          if (!tableSession) return;
                                          await updateDoc(doc(db, 'sessions', tableSession.id, 'accounts', activeAccountId, 'orders', order.id), {
                                            status: 'delivered'
                                          });
                                        } catch (err) {
                                          console.error("Error marking as delivered:", err);
                                        }
                                      }}
                                      className="text-[8px] bg-emerald-600 hover:bg-emerald-700 text-white font-black px-1.5 py-0.5 rounded shadow-sm hover:scale-105 transition-all flex items-center gap-1 cursor-pointer"
                                    >
                                      <Check size={9} /> Servido
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col items-end shrink-0 pt-0.5">
                                <span className="font-mono text-xs font-semibold text-slate-900">{formatPrice(itemPrice * (order.quantity || 1))}</span>
                              </div>
                            </div>
                            );
                          })}
                          {activeOrders.length === 0 && (
                            <div className="text-center text-slate-400 text-xs py-4 italic">No hay pedidos registrados</div>
                          )}
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-bold text-xs text-slate-500 uppercase tracking-wider">Subtotal</span>
                          <span className="font-mono text-sm font-bold">{formatPrice(activeOrdersTotal)}</span>
                        </div>
                        
                        {showServiceCharge && (
                          <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
                            <label className="flex items-center gap-2 cursor-pointer group">
                              <input type="checkbox" className="w-4 h-4 rounded text-black border-slate-200 border-2" checked={includeTip} onChange={e => setIncludeTip(e.target.checked)} />
                              <span className="font-bold text-xs group-hover:text-black text-slate-500 transition-colors">
                                Incluir {servicePercent}% Servicio
                              </span>
                            </label>
                            <span className="font-mono text-xs font-bold text-slate-600">{formatPrice(tipAmount)}</span>
                          </div>
                        )}

                        <div className="flex items-end justify-between">
                          <div>
                            <div className="font-black text-slate-400 text-[10px] uppercase tracking-widest mb-1">Total a Pagar ({activeCurrency})</div>
                            <div className="text-2xl font-black text-slate-950">{formatPrice(finalTotal)}</div>
                          </div>
                          <div className="text-right flex flex-col items-end">
                            <div className="font-black text-slate-400 text-[9px] uppercase tracking-widest mb-1">En Bolívares</div>
                            <div className="text-lg font-black text-slate-800">{formatBs(toBolivares(finalTotal))}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 sm:p-4 bg-white border-t border-slate-200 flex flex-col gap-2 shrink-0 z-20 shadow-[0_-8px_25px_rgba(0,0,0,0.08)] pb-[max(1rem,env(safe-area-inset-bottom))]">
                      {selectedTable.id.startsWith('delivery-') ? (
                        <>
                          {activeOrders.length > 0 ? (
                            <>
                              <button 
                                type="button"
                                onClick={async () => {
                                  try {
                                    const session = getSessionForTable(selectedTable.id);
                                    if (!session) return;
                                    
                                    // Mark as completed
                                    await updateDoc(doc(db, 'sessions', session.id), {
                                      status: 'completed',
                                      paymentStatus: 'validated', // automatically validate if delivered
                                      'payment.totalUSD': finalTotal,
                                      'payment.timestamp': new Date().toISOString()
                                    });

                                    // Mark all orders as delivered
                                    const ordersRef = collection(db, 'sessions', session.id, 'accounts', 'default', 'orders');
                                    const orderSnaps = await getDocs(ordersRef);
                                    const promises = orderSnaps.docs.map(orderDoc => {
                                      return updateDoc(doc(db, 'sessions', session.id, 'accounts', 'default', 'orders', orderDoc.id), {
                                        status: 'delivered'
                                      });
                                    });
                                    await Promise.all(promises);

                                    const waiterName = currentUser?.name || localStorage.getItem('demo_user_name') || 'Mesero';
                                    await logAction('order', waiterName, 'Entregó y cerró delivery', `Pedido de ${session.customerName} - Total: $${finalTotal.toFixed(2)}`);

                                    setSelectedTable(null);
                                    alert('✅ Pedido entregado, cobrado y cerrado con éxito.');
                                  } catch (err) {
                                    console.error('Error closing delivery session:', err);
                                    alert('Error al marcar como entregado.');
                                  }
                                }}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-lg shadow-emerald-600/10"
                              >
                                <CheckCircle2 size={18} />
                                Marcar como Entregado y Cerrar
                              </button>

                              <button 
                                type="button"
                                onClick={() => setIsPaying(true)}
                                className="w-full bg-black text-white p-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-lg shadow-black/10"
                              >
                                <Receipt size={18} />
                                Cerrar Pedido y Procesar Pago
                              </button>
                            </>
                          ) : (
                            <button 
                              type="button"
                              onClick={async () => {
                                if (!selectedTable) return;
                                const session = getSessionForTable(selectedTable.id);
                                if (!session) return;
                                
                                await updateDoc(doc(db, 'sessions', session.id), { status: 'cancelled' });
                                
                                const waiterName = currentUser?.name || localStorage.getItem('demo_user_name') || 'Mesero';
                                await logAction('order', waiterName, 'Canceló delivery (sin consumo)', `Pedido de ${session.customerName}`);
                                
                                setSelectedTable(null);
                                setActiveTab('menu');
                              }}
                              className="w-full bg-rose-50 text-rose-600 p-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:bg-rose-100"
                            >
                              <X size={18} />
                              Cancelar Pedido (Sin consumo)
                            </button>
                          )}
                        </>
                      ) : (
                        activeOrders.length > 0 ? (
                          <>
                            {!activeShift && (
                              <div className="mb-2 p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl flex items-center gap-2 text-xs text-amber-800">
                                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                                <span><strong>Caja Cerrada:</strong> Facturación bloqueada hasta abrir turno.</span>
                              </div>
                            )}
                            <button 
                              type="button"
                              onClick={() => setIsPaying(true)}
                              className="w-full bg-black text-white p-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-lg shadow-black/10"
                            >
                              <Receipt size={18} />
                              Cerrar Mesa y Pagar
                            </button>
                          </>
                        ) : (
                          <button 
                            type="button"
                            onClick={async () => {
                              if (!selectedTable) return;
                              const session = getSessionForTable(selectedTable.id);
                              if (!session) return;
                              
                              // Cancelar mesa sin consumo
                              await updateDoc(doc(db, 'sessions', session.id), { status: 'cancelled' });
                              
                              // Close any ghost sessions for this table just in case
                              const ghostSessions = activeSessions.filter(s => s.tableId === session.tableId && s.id !== session.id);
                              for (const ghost of ghostSessions) {
                                await updateDoc(doc(db, 'sessions', ghost.id), { status: 'cancelled' }).catch(console.error);
                              }
                              
                              if (!selectedTable.id.startsWith('delivery-')) {
                                await updateDoc(doc(db, 'tables', selectedTable.id), { status: 'free' });
                              }

                              // Write audit log
                              const waiterName = currentUser?.name || localStorage.getItem('demo_user_name') || 'Mesero';
                              await logAction('order', waiterName, 'Canceló mesa (sin consumo)', `Mesa ${selectedTable.number}`);
                              
                              setSelectedTable(null);
                              setActiveTab('menu');
                            }}
                            className="w-full bg-rose-50 text-rose-600 p-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:bg-rose-100"
                          >
                            <X size={18} />
                            Cancelar Mesa (Sin consumo)
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </div>
      {/* Payment Modal */}
      {/* Creating Delivery Modal */}
      <AnimatePresence>
        {isCreatingDelivery && (
          <div className="fixed inset-0 z-[70] bg-white sm:bg-black/50 sm:backdrop-blur-sm flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 overflow-hidden">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-none sm:rounded-3xl p-4 sm:p-6 w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-md shadow-2xl relative flex flex-col overflow-hidden"
            >
              <div className="flex justify-between items-start mb-2 pr-8 shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">Nuevo Delivery / Para Llevar</h3>
                  <p className="text-xs text-slate-500">Completa los datos del nuevo pedido.</p>
                </div>
                <button 
                  onClick={() => {
                    setIsCreatingDelivery(false);
                    setDeliveryName('');
                    setDeliveryPhone('');
                    setDeliveryAddress('');
                    setDeliveryReference('');
                    setDeliveryWhatsappLocation('');
                    setDeliveryPaymentMethod('Efectivo');
                    setDeliveryPaymentReference('');
                  }}
                  className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors cursor-pointer"
                  title="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto pr-1 scrollbar-thin my-2 flex-1">
                {/* Delivery Type Selector */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Tipo de Pedido</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDeliveryType('delivery')}
                      className={`py-2.5 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                        deliveryType === 'delivery'
                          ? 'bg-black text-white border-black shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>🚚 Delivery</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliveryType('pickup')}
                      className={`py-2.5 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                        deliveryType === 'pickup'
                          ? 'bg-black text-white border-black shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>🥡 Para Llevar</span>
                    </button>
                  </div>
                </div>

                {/* Customer Name */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Nombre del Cliente</label>
                  <input 
                    type="text" 
                    value={deliveryName}
                    onChange={e => setDeliveryName(e.target.value)}
                    placeholder="Ej. María Gómez"
                    autoFocus
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3 outline-none focus:border-black font-medium text-sm"
                  />
                </div>

                {/* Customer Phone */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Teléfono / WhatsApp</label>
                  <input 
                    type="tel" 
                    value={deliveryPhone}
                    onChange={e => setDeliveryPhone(e.target.value)}
                    placeholder="Ej. +58 412 1234567"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3 outline-none focus:border-black font-medium text-sm"
                  />
                </div>

                {/* Delivery Address & Zone (only if type is delivery) */}
                {deliveryType === 'delivery' && (
                  <div className="space-y-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                        Zona de Envío <span className="text-amber-600 font-bold">(Tarifa de Delivery)</span>
                      </label>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {deliveryZones.map(zone => {
                          const isSelected = selectedZoneId === zone.id;
                          return (
                            <button
                              key={zone.id}
                              type="button"
                              onClick={() => setSelectedZoneId(zone.id)}
                              className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                                isSelected
                                  ? 'bg-black text-white border-black font-bold shadow-sm'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <div>
                                <span className="text-xs font-bold block">{zone.name}</span>
                                {zone.coveredAreas && (
                                  <span className={`text-[10px] block ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                                    {zone.coveredAreas}
                                  </span>
                                )}
                              </div>
                              <span className={`text-xs font-black shrink-0 ${isSelected ? 'text-amber-300' : 'text-slate-900'}`}>
                                +${zone.priceUSD.toFixed(2)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Dirección de Entrega</label>
                      <textarea 
                        value={deliveryAddress}
                        onChange={e => setDeliveryAddress(e.target.value)}
                        placeholder="Calle, avenida, edificio, nro de casa..."
                        rows={2}
                        className="w-full bg-white border border-slate-200 rounded-2xl p-2.5 outline-none focus:border-black font-medium text-xs resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Punto de Referencia</label>
                      <input 
                        type="text" 
                        value={deliveryReference}
                        onChange={e => setDeliveryReference(e.target.value)}
                        placeholder="Ej. Frente a la panadería, portón negro..."
                        className="w-full bg-white border border-slate-200 rounded-2xl p-2.5 outline-none focus:border-black font-medium text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Enlace de Ubicación GPS (Opcional)</label>
                      <div className="relative flex items-center">
                        <Navigation className="absolute left-3 text-slate-400 -rotate-45" size={14} />
                        <input 
                          type="text" 
                          value={deliveryWhatsappLocation}
                          onChange={e => setDeliveryWhatsappLocation(e.target.value)}
                          placeholder="Ej. https://maps.google.com/?q=... o link de WhatsApp"
                          className="w-full bg-white border border-slate-200 rounded-2xl pl-8 pr-3 py-2.5 outline-none focus:border-black font-medium text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Method Selector */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Método de Pago</label>
                  <select
                    value={deliveryPaymentMethod}
                    onChange={e => setDeliveryPaymentMethod(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3 outline-none focus:border-black font-medium text-xs"
                  >
                    <option value="Efectivo">Efectivo ($ / Bs)</option>
                    <option value="Pago Móvil">Pago Móvil (Bs)</option>
                    <option value="Zelle">Zelle ($)</option>
                    <option value="Transferencia">Transferencia Bancaria</option>
                    <option value="Punto de Venta">Punto de Venta (Bs)</option>
                  </select>
                </div>

                {/* Payment Reference & Receipt Photo for non-cash delivery */}
                {deliveryPaymentMethod !== 'Efectivo' && (
                  <div className="space-y-3">
                    {renderPaymentAccountDetails(deliveryPaymentMethod)}

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                        Referencia de Pago <span className="text-rose-500 font-extrabold">(OBLIGATORIO)</span>
                      </label>
                      <input 
                        type="text" 
                        value={deliveryPaymentReference}
                        onChange={e => setDeliveryPaymentReference(e.target.value)}
                        placeholder="Nro de referencia o confirmación"
                        required
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3 outline-none focus:border-black font-medium text-xs font-mono"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          Comprobante / Foto de Pago <span className="text-rose-500 font-extrabold">(OBLIGATORIO)</span>
                        </label>
                        {deliveryReceiptImage && (
                          <button 
                            type="button" 
                            onClick={() => setDeliveryReceiptImage(null)} 
                            className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
                          >
                            Eliminar foto
                          </button>
                        )}
                      </div>

                      <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-2.5 cursor-pointer transition-all ${deliveryReceiptImage ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200 hover:border-black'}`}>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setDeliveryReceiptImage(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }} 
                          className="hidden" 
                        />
                        {deliveryReceiptImage ? (
                          <div className="flex items-center gap-3 w-full">
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-emerald-200 shrink-0">
                              <img src={deliveryReceiptImage} alt="Comprobante" className="w-full h-full object-cover" />
                            </div>
                            <div className="text-left">
                              <span className="text-xs font-bold text-emerald-800 block">Comprobante Adjuntado ✓</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-1">
                            <span className="text-xs font-bold text-slate-600 block">Subir captura / foto del comprobante</span>
                            <span className="text-[10px] text-slate-400 block">Soporta PNG, JPG</span>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 shrink-0">
                <button 
                  onClick={createDelivery}
                  disabled={!deliveryName.trim()}
                  className={`w-full text-white py-3.5 px-4 rounded-2xl font-bold text-sm transition-all flex justify-center items-center gap-2 cursor-pointer ${deliveryName.trim() ? 'bg-black shadow-lg hover:scale-[1.01]' : 'bg-slate-300 cursor-not-allowed'}`}
                >
                  Crear Pedido
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Editing Delivery Info Modal */}
      <AnimatePresence>
        {isEditingDeliveryInfo && (
          <div className="fixed inset-0 z-[70] bg-white sm:bg-black/50 sm:backdrop-blur-sm flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 overflow-hidden">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-none sm:rounded-3xl p-4 sm:p-6 w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-md shadow-2xl relative flex flex-col overflow-hidden"
            >
              <div className="flex justify-between items-start mb-2 pr-8 shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">Editar Datos del Pedido</h3>
                  <p className="text-xs text-slate-500">Actualiza los datos de contacto y envío de este pedido.</p>
                </div>
                <button 
                  onClick={() => setIsEditingDeliveryInfo(null)}
                  className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors cursor-pointer"
                  title="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto pr-1 scrollbar-thin my-2 flex-1">
                {/* Delivery Type Selector */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Tipo de Pedido</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditDeliveryType('delivery')}
                      className={`py-2.5 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                        editDeliveryType === 'delivery'
                          ? 'bg-black text-white border-black shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>🚚 Delivery</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditDeliveryType('pickup')}
                      className={`py-2.5 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                        editDeliveryType === 'pickup'
                          ? 'bg-black text-white border-black shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>🥡 Para Llevar</span>
                    </button>
                  </div>
                </div>

                {/* Customer Name */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Nombre del Cliente</label>
                  <input 
                    type="text" 
                    value={editCustomerName}
                    onChange={e => setEditCustomerName(e.target.value)}
                    placeholder="Ej. María Gómez"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3 outline-none focus:border-black font-medium text-sm"
                  />
                </div>

                {/* Customer Phone */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Teléfono / WhatsApp</label>
                  <input 
                    type="tel" 
                    value={editCustomerPhone}
                    onChange={e => setEditCustomerPhone(e.target.value)}
                    placeholder="Ej. +58 412 1234567"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3 outline-none focus:border-black font-medium text-sm"
                  />
                </div>

                {/* Delivery Address & Zone (only if type is delivery) */}
                {editDeliveryType === 'delivery' && (
                  <div className="space-y-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                        Zona de Envío <span className="text-amber-600 font-bold">(Tarifa de Delivery)</span>
                      </label>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {deliveryZones.map(zone => {
                          const isSelected = editSelectedZoneId === zone.id;
                          return (
                            <button
                              key={zone.id}
                              type="button"
                              onClick={() => setEditSelectedZoneId(zone.id)}
                              className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                                isSelected
                                  ? 'bg-black text-white border-black shadow-sm'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <div>
                                <span className="text-xs font-bold block">{zone.name}</span>
                                {zone.coveredAreas && (
                                  <span className={`text-[10px] block ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                                    {zone.coveredAreas}
                                  </span>
                                )}
                              </div>
                              <span className={`text-xs font-black shrink-0 ${isSelected ? 'text-amber-300' : 'text-slate-900'}`}>
                                +${zone.priceUSD.toFixed(2)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Dirección de Entrega</label>
                      <textarea 
                        value={editCustomerAddress}
                        onChange={e => setEditCustomerAddress(e.target.value)}
                        placeholder="Calle, avenida, edificio, nro de casa..."
                        rows={2}
                        className="w-full bg-white border border-slate-200 rounded-2xl p-2.5 outline-none focus:border-black font-medium text-xs resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Punto de Referencia</label>
                      <input 
                        type="text" 
                        value={editDeliveryReference}
                        onChange={e => setEditDeliveryReference(e.target.value)}
                        placeholder="Ej. Frente a la panadería, portón negro..."
                        className="w-full bg-white border border-slate-200 rounded-2xl p-2.5 outline-none focus:border-black font-medium text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Enlace de Ubicación GPS (Opcional)</label>
                      <div className="relative flex items-center">
                        <Navigation className="absolute left-3 text-slate-400 -rotate-45" size={14} />
                        <input 
                          type="text" 
                          value={editWhatsappLocation}
                          onChange={e => setEditWhatsappLocation(e.target.value)}
                          placeholder="Ej. https://maps.google.com/?q=... o link de WhatsApp"
                          className="w-full bg-white border border-slate-200 rounded-2xl pl-8 pr-3 py-2.5 outline-none focus:border-black font-medium text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Method Selector */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Método de Pago</label>
                  <select
                    value={editPaymentMethod}
                    onChange={e => setEditPaymentMethod(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3 outline-none focus:border-black font-medium text-xs"
                  >
                    <option value="Efectivo">Efectivo ($ / Bs)</option>
                    <option value="Pago Móvil">Pago Móvil (Bs)</option>
                    <option value="Zelle">Zelle ($)</option>
                    <option value="Transferencia">Transferencia Bancaria</option>
                    <option value="Punto de Venta">Punto de Venta (Bs)</option>
                  </select>
                </div>

                {/* Payment Reference & Receipt Photo */}
                {editPaymentMethod !== 'Efectivo' && (
                  <div className="space-y-3">
                    {renderPaymentAccountDetails(editPaymentMethod)}

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Referencia de Pago / Banco (Opcional)</label>
                      <input 
                        type="text" 
                        value={editPaymentReference}
                        onChange={e => setEditPaymentReference(e.target.value)}
                        placeholder="Nro de referencia o confirmación"
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3 outline-none focus:border-black font-medium text-xs font-mono"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          Comprobante / Foto de Pago (Opcional)
                        </label>
                        {editDeliveryReceiptImage && (
                          <button 
                            type="button" 
                            onClick={() => setEditDeliveryReceiptImage(null)} 
                            className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
                          >
                            Eliminar foto
                          </button>
                        )}
                      </div>

                      <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-2.5 cursor-pointer transition-all ${editDeliveryReceiptImage ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200 hover:border-black'}`}>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setEditDeliveryReceiptImage(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }} 
                          className="hidden" 
                        />
                        {editDeliveryReceiptImage ? (
                          <div className="flex items-center gap-3 w-full">
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-emerald-200 shrink-0">
                              <img src={editDeliveryReceiptImage} alt="Comprobante" className="w-full h-full object-cover" />
                            </div>
                            <div className="text-left">
                              <span className="text-xs font-bold text-emerald-800 block">Comprobante Adjuntado ✓</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-1">
                            <span className="text-xs font-bold text-slate-600 block">Subir captura / foto del comprobante</span>
                            <span className="text-[10px] text-slate-400 block">Soporta PNG, JPG</span>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100 shrink-0">
                <button 
                  type="button"
                  onClick={() => setIsEditingDeliveryInfo(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={async () => {
                    if (!editCustomerName.trim()) return;
                    try {
                      const activeZone = deliveryZones.find(z => z.id === editSelectedZoneId) || deliveryZones[0];
                      const isDeliveryMode = editDeliveryType === 'delivery';
                      const fee = isDeliveryMode ? (activeZone?.priceUSD || 0) : 0;

                      await updateDoc(doc(db, 'sessions', isEditingDeliveryInfo.id), {
                        customerName: editCustomerName.trim(),
                        deliveryType: editDeliveryType,
                        customerPhone: editCustomerPhone.trim(),
                        customerAddress: isDeliveryMode ? editCustomerAddress.trim() : 'Retiro en Local (Pick Up)',
                        deliveryZoneId: isDeliveryMode ? (activeZone?.id || '') : '',
                        deliveryZoneName: isDeliveryMode ? (activeZone?.name || '') : '',
                        deliveryFee: fee,
                        deliveryReference: isDeliveryMode ? editDeliveryReference.trim() : '',
                        whatsappLocation: isDeliveryMode ? editWhatsappLocation.trim() : '',
                        paymentMethod: editPaymentMethod,
                        paymentReference: editPaymentReference.trim(),
                        paymentReceiptImage: editDeliveryReceiptImage,
                        accounts: [{ id: 'default', name: editCustomerName.trim(), status: 'active' }]
                      });
                      
                      setSelectedTable(prev => prev ? { ...prev, number: editCustomerName.trim() } : null);
                      setIsEditingDeliveryInfo(null);
                    } catch (err) {
                      console.error('Error saving delivery details edit:', err);
                    }
                  }}
                  disabled={!editCustomerName.trim()}
                  className={`flex-1 text-white p-4 rounded-xl font-bold transition-all ${editCustomerName.trim() ? 'bg-black hover:bg-slate-800' : 'bg-slate-300 cursor-not-allowed'}`}
                >
                  Guardar Cambios
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Opening Table Modal */}
      <AnimatePresence>
        {isOpeningTable && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[40px] p-8 w-full max-w-sm shadow-2xl relative"
            >
              <button 
                onClick={() => {
                  setIsOpeningTable(null);
                  setFirstAccountName('');
                }}
                className="absolute top-6 right-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                title="Cerrar"
              >
                <X size={20} />
              </button>
              
              <h3 className="text-xl font-bold mb-4">Abrir Mesa</h3>
              <p className="text-sm text-slate-500 mb-6">Mesa {isOpeningTable.number}</p>

              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Nombre del cliente (Titular)</label>
                  <input 
                    type="text" 
                    value={firstAccountName}
                    onChange={e => setFirstAccountName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    autoFocus
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') startSession(isOpeningTable);
                    }}
                  />
                </div>
              </div>

              <button 
                onClick={() => startSession(isOpeningTable)}
                disabled={!firstAccountName.trim()}
                className={`w-full text-white p-4 rounded-xl font-bold transition-all flex justify-center items-center gap-2 ${firstAccountName.trim() ? 'bg-black shadow-lg hover:scale-[1.02]' : 'bg-slate-300 cursor-not-allowed'}`}
              >
                Abrir Mesa
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddingAccount && selectedTable && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[40px] p-8 w-full max-w-sm shadow-2xl relative"
            >
              <button 
                onClick={() => {
                  setIsAddingAccount(false);
                  setNewAccountName('');
                }}
                className="absolute top-6 right-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                title="Cerrar"
              >
                <X size={20} />
              </button>
              
              <h3 className="text-xl font-bold mb-4">Nueva Cuenta</h3>
              <p className="text-sm text-slate-500 mb-6">
                {selectedTable.id.startsWith('delivery-') ? 'Llevar: ' : 'Mesa '}{selectedTable.number}
              </p>

              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Nombre de la persona</label>
                  <input 
                    type="text" 
                    value={newAccountName}
                    onChange={e => setNewAccountName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    autoFocus
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddAccount();
                    }}
                  />
                </div>
              </div>

              <button 
                onClick={handleAddAccount}
                disabled={!newAccountName.trim()}
                className={`w-full text-white p-4 rounded-xl font-bold transition-all flex justify-center items-center gap-2 ${newAccountName.trim() ? 'bg-black shadow-lg hover:scale-[1.02]' : 'bg-slate-300 cursor-not-allowed'}`}
              >
                <Plus size={18} /> Crear Cuenta
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPaying && selectedTable && (
          <div className="fixed inset-0 z-[70] bg-white sm:bg-black/60 sm:backdrop-blur-sm flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 overflow-hidden">
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="bg-white rounded-none sm:rounded-[36px] w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-lg shadow-2xl relative flex flex-col overflow-hidden border-0 sm:border border-slate-100"
            >
              {/* Header */}
              <div className="p-4 sm:p-6 border-b border-slate-100 bg-white z-10 shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setIsPaying(false);
                      setReceiptImage(null);
                      setSelectedClientIdForCredit('');
                      setCreditName('');
                      setCreditPhone('');
                      setCreditId('');
                      setCreditAddress('');
                      setCreditEmail('');
                      setAdminPin('');
                      setAdminPinError('');
                      setNonCreditClientMode('none');
                    }}
                    className="sm:hidden p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-800 transition-colors text-xs font-black flex items-center gap-1 cursor-pointer"
                  >
                    ← Volver
                  </button>
                  <div>
                    <h3 className="text-base sm:text-xl font-black text-slate-900 leading-tight">Procesar Pago</h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {selectedTable.id.startsWith('delivery-') ? 'Pedido Delivery/Llevar: ' : 'Mesa '}{selectedTable.number}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsPaying(false);
                    setReceiptImage(null);
                    setSelectedClientIdForCredit('');
                    setCreditName('');
                    setCreditPhone('');
                    setCreditId('');
                    setCreditAddress('');
                    setCreditEmail('');
                    setAdminPin('');
                    setAdminPinError('');
                    setNonCreditClientMode('none');
                  }}
                  className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors cursor-pointer hidden sm:block"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Cash Shift Status Notification */}
              {!activeShift ? (
                <div className="mx-5 sm:mx-6 mt-4 p-4 bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl flex items-start gap-3">
                  <Lock className="text-amber-600 shrink-0 mt-0.5" size={20} />
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-950">Apertura de Caja Requerida</h4>
                    <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                      No se puede emitir el cobro porque <strong>no hay ningún turno de caja abierto</strong>. Por normativa fiscal y de arqueo, solicita al cajero o administrador realizar la <strong>Apertura de Turno</strong> en el módulo de Caja.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mx-5 sm:mx-6 mt-3 px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-bold text-emerald-950">Caja Abierta: {activeShift.shiftName}</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-medium">Cajero: {activeShift.openedBy}</span>
                </div>
              )}

              {/* Scrollable Body */}
              <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
                {/* Option to pay only specific items / consumption at table close */}
                {!selectedTable.id.startsWith('delivery-') && (
                  <div className="bg-purple-50/80 border border-purple-200/80 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <Scissors size={18} />
                        </div>
                        <div>
                          <span className="text-xs font-black text-purple-950 block">¿Pago parcial o dividido por consumo?</span>
                          <span className="text-[10px] text-purple-700 font-medium block">Cobrar únicamente los platos consumidos por 1 persona</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsPaying(false);
                          initPartialModal();
                        }}
                        className="text-xs bg-purple-900 hover:bg-black text-white font-extrabold px-3.5 py-2 rounded-xl transition-all shrink-0 shadow-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>Seleccionar Platos</span> →
                      </button>
                    </div>
                  </div>
                )}

                {/* Cupones de descuento en Comanda */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 mb-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Ticket size={14} className="text-indigo-600" />
                      Cupón de Descuento Promocional
                    </span>
                    {appliedWaiterCoupon && (
                      <button
                        type="button"
                        onClick={() => {
                          setAppliedWaiterCoupon(null);
                          setWaiterCouponError(null);
                          setWaiterCouponCode('');
                        }}
                        className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer uppercase"
                      >
                        Quitar cupón
                      </button>
                    )}
                  </div>

                  {appliedWaiterCoupon ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-xs">
                          ✓
                        </span>
                        <div>
                          <span className="font-mono font-black text-xs text-emerald-950 block">
                            {appliedWaiterCoupon.code}
                          </span>
                          <span className="text-[10px] text-emerald-700 font-bold block">
                            {appliedWaiterCoupon.discountType === 'percentage' 
                              ? `${appliedWaiterCoupon.discountValue}% OFF aplicado` 
                              : `-$${appliedWaiterCoupon.discountValue} USD aplicado`}
                          </span>
                        </div>
                      </div>
                      <span className="font-black text-xs text-emerald-700">
                        -{formatPrice(waiterCouponDiscount)}
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Código de cupón (ej: BISTRO20)"
                          value={waiterCouponCode}
                          onChange={(e) => {
                            setWaiterCouponCode(e.target.value.toUpperCase());
                            setWaiterCouponError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const raw = waiterCouponCode.trim().toUpperCase();
                              if (!raw) return;
                              const found = (coupons || []).find(c => c.code.trim().toUpperCase() === raw);
                              if (!found) {
                                setWaiterCouponError('Cupón no encontrado');
                                return;
                              }
                              if (found.status !== 'active') {
                                setWaiterCouponError('Cupón temporalmente inactivo');
                                return;
                              }
                              if (found.minSpend && activeOrdersTotal < found.minSpend) {
                                setWaiterCouponError(`Consumo mínimo: $${found.minSpend}`);
                                return;
                              }
                              setAppliedWaiterCoupon(found);
                              setWaiterCouponError(null);
                            }
                          }}
                          className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold uppercase outline-none focus:border-indigo-600"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const raw = waiterCouponCode.trim().toUpperCase();
                            if (!raw) return;
                            const found = (coupons || []).find(c => c.code.trim().toUpperCase() === raw);
                            if (!found) {
                              setWaiterCouponError('Cupón no encontrado');
                              return;
                            }
                            if (found.status !== 'active') {
                              setWaiterCouponError('Cupón temporalmente inactivo');
                              return;
                            }
                            if (found.minSpend && activeOrdersTotal < found.minSpend) {
                              setWaiterCouponError(`Consumo mínimo: $${found.minSpend}`);
                              return;
                            }
                            setAppliedWaiterCoupon(found);
                            setWaiterCouponError(null);
                          }}
                          className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl cursor-pointer"
                        >
                          Aplicar
                        </button>
                      </div>
                      {waiterCouponError && (
                        <p className="text-[10px] font-bold text-rose-600">{waiterCouponError}</p>
                      )}

                      {/* Quick Available Coupons Chips */}
                      {coupons && coupons.filter(c => c.status === 'active' && (!c.expiresAt || new Date(c.expiresAt).getTime() > Date.now())).length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <span className="text-[9px] font-bold uppercase text-slate-400">Cupones:</span>
                          {coupons
                            .filter(c => c.status === 'active' && (!c.expiresAt || new Date(c.expiresAt).getTime() > Date.now()))
                            .slice(0, 3)
                            .map(c => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setWaiterCouponCode(c.code);
                                  setAppliedWaiterCoupon(c);
                                  setWaiterCouponError(null);
                                }}
                                className="text-[10px] font-mono font-black bg-indigo-50 border border-indigo-200/70 text-indigo-700 px-2 py-0.5 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer"
                              >
                                🏷️ {c.code} (-{c.discountType === 'percentage' ? `${c.discountValue}%` : `$${c.discountValue}`})
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

              {/* Total Card */}
              <div className="bg-slate-50 p-6 rounded-3xl mb-6 border border-slate-100">
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest block mb-1">Total a cobrar ({activeCurrency})</span>
                    <div className="text-3xl font-light text-slate-900">{formatPrice(finalTotal)}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest block mb-1">En Bolívares</span>
                    <div className="text-xl font-bold text-rose-600">{formatBs(toBolivares(finalTotal))}</div>
                    <div className="text-[9px] text-slate-400 font-medium">Tasa ({activeCurrency}): {currentRateBs.toFixed(2)} Bs/{currencySymbol}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Method selector */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Método de Pago</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      ...availablePaymentMethods.map(m => ({ id: m.id, label: m.name, currency: m.currency, methodObj: m })),
                      { id: 'mixto', label: 'Mixto', currency: 'any', methodObj: null }
                    ].map(method => (
                      <button 
                        key={method.id}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(method.id);
                          if (method.methodObj?.currency === 'Bs') setPaymentCurrency('Bs');
                          else if (method.methodObj?.currency === 'EUR') setPaymentCurrency('EUR');
                          else if (method.methodObj?.currency === 'USDT') setPaymentCurrency('USDT');
                          else if (method.id === 'pago_movil' || method.id === 'punto') setPaymentCurrency('Bs');
                          else setPaymentCurrency('USD');
                        }}
                        className={`p-3 rounded-2xl border text-xs font-bold transition-all ${paymentMethod === method.id ? 'border-none bg-black text-white shadow-md' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                      >
                        {method.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Punto de Venta info card */}
                {paymentMethod === 'punto' && (
                  <div className="bg-blue-50/50 border border-blue-100 rounded-3xl p-5 space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-blue-100/50">
                      <span className="font-bold text-xs text-blue-900">Punto de Venta (Tarjeta POS)</span>
                      <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">VES / Bolívares</span>
                    </div>
                    <div className="text-xs text-slate-700 space-y-2">
                      <p className="text-slate-600 font-medium">
                        {availablePaymentMethods.find(m => m.id === 'punto')?.details?.notes || 'Procesar tarjeta de débito o crédito nacional en el punto físico del local.'}
                      </p>
                      <div className="flex items-center justify-between pt-1 border-t border-blue-100/40">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Total en Bolívares:</span>
                        <span className="font-extrabold text-blue-900 text-base">{formatBs(toBolivares(finalTotal))}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Custom method info card */}
                {(() => {
                  const customObj = availablePaymentMethods.find(m => m.id === paymentMethod && !['pago_movil', 'zelle', 'divisa', 'punto', 'credito', 'mixto'].includes(m.id));
                  if (!customObj) return null;
                  return (
                    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-3">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                        <span className="font-bold text-xs text-slate-900">{customObj.name}</span>
                        <span className="text-[10px] bg-slate-200 text-slate-800 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          Moneda: {customObj.currency}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                        {customObj.details?.bank && (
                          <div><span className="text-[9px] uppercase font-bold text-slate-400 block">Banco/Plataforma</span><span className="font-bold">{customObj.details.bank}</span></div>
                        )}
                        {customObj.details?.phone && (
                          <div><span className="text-[9px] uppercase font-bold text-slate-400 block">Teléfono</span><span className="font-mono font-bold">{customObj.details.phone}</span></div>
                        )}
                        {customObj.details?.email && (
                          <div className="col-span-2"><span className="text-[9px] uppercase font-bold text-slate-400 block">Correo / ID</span><span className="font-mono font-bold break-all">{customObj.details.email}</span></div>
                        )}
                        {customObj.details?.accountHolder && (
                          <div className="col-span-2"><span className="text-[9px] uppercase font-bold text-slate-400 block">Titular</span><span className="font-bold">{customObj.details.accountHolder}</span></div>
                        )}
                        {customObj.details?.notes && (
                          <div className="col-span-2 pt-1"><p className="text-[11px] text-slate-600 italic">{customObj.details.notes}</p></div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Pago Móvil info & share card */}
                {paymentMethod === 'pago_movil' && (
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-3xl p-5 space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-emerald-100/50">
                      <span className="font-bold text-xs text-emerald-800">Datos de Pago Móvil</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Copiar / Compartir</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-bold block">Banco</span>
                        <span className="font-bold">{settings?.pagoMovilBanco || 'Mercantil (0105)'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-bold block">Teléfono</span>
                        <span className="font-bold font-mono">{settings?.pagoMovilPhone || '0412-1234567'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-bold block">Cédula / RIF</span>
                        <span className="font-bold font-mono">{settings?.pagoMovilId || 'V-12345678'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-bold block">Monto Total</span>
                        <span className="font-bold text-emerald-700">Bs. {(finalTotal * exchangeRate).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Zelle info & share card */}
                {paymentMethod === 'zelle' && (
                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-3xl p-5 space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-indigo-100/50">
                      <span className="font-bold text-xs text-indigo-800">Datos de Zelle</span>
                      <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Copiar / Compartir</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                      <div className="col-span-2">
                        <span className="text-[9px] text-slate-400 uppercase font-bold block">Correo Electrónico</span>
                        <span className="font-bold font-mono text-indigo-900 break-all">{settings?.zelleEmail || 'pagos@bistroflow.com'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-bold block">Titular</span>
                        <span className="font-bold">{settings?.zelleName || 'BistroFlow S.A.'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-bold block">Monto Total</span>
                        <span className="font-bold text-indigo-700">${finalTotal.toFixed(2)} USD</span>
                      </div>
                    </div>
                  </div>
                )}

                
                {paymentMethod === 'mixto' && (
                  <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 space-y-4">
                    <div className="pb-2 border-b border-slate-200/50 flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">Pagos Mixtos</span>
                      <span className="text-xs font-bold font-mono text-slate-700 text-right">Restante: <br className="sm:hidden" /><span className="text-rose-600">${Math.max(0, finalTotal - mixedPayments.reduce((s, p) => s + p.amountUSD, 0)).toFixed(2)}</span> <span className="text-[10px] text-slate-400 font-medium">/ Bs. {(Math.max(0, finalTotal - mixedPayments.reduce((s, p) => s + p.amountUSD, 0)) * exchangeRate).toFixed(2)}</span></span>
                    </div>

                    {mixedPayments.length > 0 && (
                      <div className="space-y-2">
                        {mixedPayments.map(p => (
                          <div key={p.id} className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-100 text-xs">
                            <div>
                              <span className="font-bold block uppercase">{p.method.replace('_', ' ')}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{p.reference || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-bold font-mono text-slate-700">${p.amountUSD.toFixed(2)} <span className="text-[9px] text-slate-400">({p.currency === "Bs" ? `Bs. ${(p.amountUSD * exchangeRate).toFixed(2)}` : "USD"})</span></span>
                              <button type="button" onClick={() => setMixedPayments(mixedPayments.filter(x => x.id !== p.id))} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg"><Trash2 size={14}/></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {finalTotal - mixedPayments.reduce((s, p) => s + p.amountUSD, 0) > 0.001 && (
                      <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Método</label>
                            <select id="mixto_method" onChange={(e) => setCurrentMixtoCurrency(e.target.value === 'divisa' || e.target.value === 'zelle' ? 'USD' : 'Bs')} className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2 outline-none text-xs">
                              <option value="pago_movil">Pago Móvil</option>
                              <option value="zelle">Zelle</option>
                              <option value="divisa">Divisa ($)</option>
                              <option value="punto">Punto (Bs)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Monto ({currentMixtoCurrency})</label>
                            <input 
                              type="number" 
                              id="mixto_amount"
                              placeholder="Ej. 10" 
                              step="0.01"
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2 outline-none text-xs"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Referencia</label>
                            <input 
                              type="text" 
                              id="mixto_ref"
                              placeholder="Obligatorio para digital" 
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2 outline-none text-xs"
                            />
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={() => {
                            const m = (document.getElementById('mixto_method') as HTMLSelectElement).value;
                            const rawAmt = parseFloat((document.getElementById('mixto_amount') as HTMLInputElement).value) || 0;
                            const ref = (document.getElementById('mixto_ref') as HTMLInputElement).value;
                            
                            if (rawAmt <= 0) return alert('Ingrese un monto válido');
                            if ((m === 'pago_movil' || m === 'zelle' || m === 'punto') && !ref.trim()) return alert('Referencia requerida para este método');
                            
                            const currency = (m === 'pago_movil' || m === 'punto') ? 'Bs' : 'USD';
                            const amtUSD = currency === 'Bs' ? rawAmt / exchangeRate : rawAmt;
                            
                            setMixedPayments([...mixedPayments, { id: Date.now().toString(), method: m, amountUSD: amtUSD, currency, reference: ref, receiptImage: null }]);
                            (document.getElementById('mixto_amount') as HTMLInputElement).value = '';
                            (document.getElementById('mixto_ref') as HTMLInputElement).value = '';
                          }}
                          className="w-full py-2 bg-indigo-50 text-indigo-700 font-bold text-[10px] uppercase rounded-xl hover:bg-indigo-100"
                        >
                          + Agregar Pago
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Image Upload and Reference for digital payments */}
                {(paymentMethod === 'pago_movil' || paymentMethod === 'zelle' || paymentMethod === 'punto' || paymentMethod === 'transferencia' || paymentMethod === 'mixto') && (
                  <div className="space-y-4 mt-4">
                    {paymentMethod !== 'mixto' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Moneda del Pago</label>
                          <select 
                            value={paymentCurrency}
                            onChange={(e) => setPaymentCurrency(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium text-sm appearance-none"
                          >
                            <option value="Bs">Bolívares (Bs)</option>
                            <option value="USD">Dólares ($)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Referencia <span className="text-rose-500 font-extrabold">(OBLIGATORIO)</span></label>
                          <input 
                            type="text" 
                            value={paymentRef}
                            onChange={e => setPaymentRef(e.target.value)}
                            placeholder="Ej. 123456"
                            required
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium text-sm font-mono"
                          />
                        </div>
                      </div>
                    )}

                    {/* Image Receipt Uploader */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          Comprobante / Captura de Pago <span className="text-rose-500 ml-1 font-extrabold">(OBLIGATORIO)</span>
                        </label>
                        {receiptImage && (
                          <button 
                            type="button" 
                            onClick={() => setReceiptImage(null)} 
                            className="text-[10px] font-bold text-rose-500 hover:underline"
                          >
                            Eliminar imagen
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-4">
                        <label className={`w-full flex flex-col items-center justify-center border-2 border-dashed rounded-3xl p-4 cursor-pointer transition-all ${receiptImage ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200 hover:border-black'}`}>
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleImageChange} 
                            className="hidden" 
                          />
                          {isUploadingReceipt ? (
                            <span className="text-xs text-slate-400 animate-pulse font-medium">Procesando imagen...</span>
                          ) : receiptImage ? (
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-emerald-200">
                                <img src={receiptImage} alt="Voucher Preview" className="w-full h-full object-cover" />
                              </div>
                              <div className="text-left">
                                <span className="text-xs font-bold text-emerald-800 block">Comprobante Cargado</span>
                                <span className="text-[9px] text-emerald-600 block">Imagen optimizada</span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center">
                              <span className="text-xs font-bold text-slate-600 block">Subir captura o foto</span>
                              <span className="text-[9px] text-slate-400 block">Soporta PNG, JPG</span>
                            </div>
                          )}
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* CRM Client Selector for non-credit payments */}
                {paymentMethod !== 'credito' && (
                  <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 space-y-4">
                    <div className="pb-3 border-b border-slate-200/50 flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1">
                        👤 CRM: Control de Pedidos
                      </span>
                      <span className="text-[9px] font-bold text-slate-400">(Opcional)</span>
                    </div>

                    <div className="flex gap-2">
                      {[
                        { id: 'none', label: 'Sin Registro' },
                        { id: 'existing', label: 'Elegir de CRM' },
                        { id: 'new', label: 'Nuevo Cliente' }
                      ].map(mode => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => {
                            setNonCreditClientMode(mode.id as any);
                            // Clear inputs when switching mode
                            setSelectedClientIdForCredit('');
                            setCreditName('');
                            setCreditPhone('');
                            setCreditId('');
                            setCreditAddress('');
                            setCreditEmail('');
                          }}
                          className={`flex-1 py-2 px-1 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
                            nonCreditClientMode === mode.id
                              ? 'bg-black text-white border-transparent shadow-sm'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>

                    {nonCreditClientMode === 'existing' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Buscar Cliente en CRM</label>
                          <select
                            value={selectedClientIdForCredit}
                            onChange={e => {
                              const cid = e.target.value;
                              setSelectedClientIdForCredit(cid);
                              if (cid === '') {
                                setCreditName('');
                                setCreditPhone('');
                                setCreditId('');
                                setCreditAddress('');
                                setCreditEmail('');
                              } else {
                                const found = clients.find(c => c.id === cid);
                                if (found) {
                                  setCreditName(found.name || '');
                                  setCreditPhone(found.phone || '');
                                  setCreditId(found.cedula || '');
                                  setCreditAddress(found.address || '');
                                  setCreditEmail(found.correo || '');
                                }
                              }
                            }}
                            className="w-full bg-white border border-slate-200 rounded-xl p-3 outline-none focus:border-black font-semibold text-xs cursor-pointer text-slate-700"
                          >
                            <option value="">-- Seleccione Cliente --</option>
                            {clients.map(c => (
                              <option key={c.id} value={c.id}>
                                👤 {c.name} {c.cedula ? `(CI: ${c.cedula})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        {selectedClientIdForCredit && (
                          <div className="p-3 bg-white border border-slate-100 rounded-2xl text-[11px] text-slate-600 space-y-1">
                            <div><strong className="text-slate-800">Nombre:</strong> {creditName}</div>
                            <div><strong className="text-slate-800">Teléfono:</strong> {creditPhone}</div>
                            <div><strong className="text-slate-800">Cédula:</strong> {creditId}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {nonCreditClientMode === 'new' && (
                      <div className="space-y-3 text-xs">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Nombre Completo *</label>
                          <input 
                            type="text" 
                            value={creditName}
                            onChange={e => setCreditName(e.target.value)}
                            placeholder="Ej. Juan Pérez"
                            required
                            className="w-full bg-white border border-slate-200 rounded-xl p-3 outline-none focus:border-black font-medium"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Teléfono *</label>
                            <input 
                              type="tel" 
                              value={creditPhone}
                              onChange={e => setCreditPhone(e.target.value)}
                              placeholder="Ej. +584125556677"
                              required
                              className="w-full bg-white border border-slate-200 rounded-xl p-3 outline-none focus:border-black font-medium"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Cédula / RIF *</label>
                            <input 
                              type="text" 
                              value={creditId}
                              onChange={e => setCreditId(e.target.value)}
                              placeholder="Ej. V-12345678"
                              required
                              className="w-full bg-white border border-slate-200 rounded-xl p-3 outline-none focus:border-black font-medium"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Dirección (Opcional)</label>
                          <input 
                            type="text" 
                            value={creditAddress}
                            onChange={e => setCreditAddress(e.target.value)}
                            placeholder="Ej. Chacao, Caracas"
                            className="w-full bg-white border border-slate-200 rounded-xl p-3 outline-none focus:border-black font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Email (Opcional)</label>
                          <input 
                            type="email" 
                            value={creditEmail}
                            onChange={e => setCreditEmail(e.target.value)}
                            placeholder="Ej. juan@gmail.com"
                            className="w-full bg-white border border-slate-200 rounded-xl p-3 outline-none focus:border-black font-medium"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Crédito client registration form */}
                {paymentMethod === 'credito' && (
                  <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 space-y-4">
                    <div className="pb-3 border-b border-slate-200/50 flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">Registro de Cliente de Crédito</span>
                      <span className="text-[9px] font-bold text-slate-400">(Campos Obligatorios)</span>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Buscar Cliente en CRM (Opcional)</label>
                        <select
                          value={selectedClientIdForCredit}
                          onChange={e => {
                            const cid = e.target.value;
                            setSelectedClientIdForCredit(cid);
                            if (cid === '') {
                              setCreditName('');
                              setCreditPhone('');
                              setCreditId('');
                              setCreditAddress('');
                              setCreditEmail('');
                            } else {
                              const found = clients.find(c => c.id === cid);
                              if (found) {
                                setCreditName(found.name || '');
                                setCreditPhone(found.phone || '');
                                setCreditId(found.cedula || '');
                                setCreditAddress(found.address || '');
                                setCreditEmail(found.correo || '');
                              }
                            }
                          }}
                          className="w-full bg-white border border-slate-100 rounded-xl p-3 outline-none focus:border-black font-semibold text-xs cursor-pointer text-slate-700 mb-2"
                        >
                          <option value="">-- Registrar Nuevo Cliente --</option>
                          {clients.map(c => (
                            <option key={c.id} value={c.id}>
                              👤 {c.name} {c.cedula ? `(CI: ${c.cedula})` : ''} - Deuda: ${c.debt || 0}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Nombre Completo</label>
                        <input 
                          type="text" 
                          value={creditName}
                          onChange={e => setCreditName(e.target.value)}
                          placeholder="Ej. Carlos Mendoza"
                          required
                          className="w-full bg-white border border-slate-100 rounded-xl p-3 outline-none focus:border-black font-medium"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Teléfono</label>
                          <input 
                            type="tel" 
                            value={creditPhone}
                            onChange={e => setCreditPhone(e.target.value)}
                            placeholder="Ej. +584125556677"
                            required
                            className="w-full bg-white border border-slate-100 rounded-xl p-3 outline-none focus:border-black font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Cédula / RIF</label>
                          <input 
                            type="text" 
                            value={creditId}
                            onChange={e => setCreditId(e.target.value)}
                            placeholder="Ej. V-15443221"
                            required
                            className="w-full bg-white border border-slate-100 rounded-xl p-3 outline-none focus:border-black font-medium"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Dirección de Domicilio</label>
                        <input 
                          type="text" 
                          value={creditAddress}
                          onChange={e => setCreditAddress(e.target.value)}
                          placeholder="Ej. Av. Francisco de Miranda, Chacao"
                          required
                          className="w-full bg-white border border-slate-100 rounded-xl p-3 outline-none focus:border-black font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Email</label>
                        <input 
                          type="email" 
                          value={creditEmail}
                          onChange={e => setCreditEmail(e.target.value)}
                          placeholder="Ej. carlos@gmail.com"
                          required
                          className="w-full bg-white border border-slate-100 rounded-xl p-3 outline-none focus:border-black font-medium"
                        />
                      </div>
                    </div>

                    <div className="border-t border-slate-200/50 pt-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                          <AlertCircle size={14} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">Autorización de Crédito</span>
                      </div>
                      
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">PIN de Aprobación Admin (Opcional para validar al instante)</label>
                        <input 
                          type="password" 
                          maxLength={4}
                          value={adminPin}
                          onChange={e => {
                            setAdminPin(e.target.value);
                            setAdminPinError('');
                          }}
                          placeholder="Ingrese PIN Admin para auto-aprobación"
                          className="w-full bg-white border border-slate-100 rounded-xl p-3 outline-none focus:border-black font-mono text-center tracking-[0.5em] text-sm"
                        />
                        {adminPinError && (
                          <span className="text-[10px] text-rose-500 font-bold block mt-1">{adminPinError}</span>
                        )}
                        <span className="text-[9px] text-slate-400 block mt-1 italic">Requiere autorización de Administrador. Si no dispone de autorización, se enviará la solicitud de crédito a la cola de Caja.</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

              {/* Sticky Footer Confirm Action Button */}
              <div className="p-4 sm:p-5 border-t border-slate-200 bg-white sm:bg-slate-50 shrink-0 z-20 shadow-[0_-8px_25px_rgba(0,0,0,0.08)] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                <button 
                  onClick={handlePayment}
                  disabled={isUploadingReceipt || isSubmittingPayment || !activeShift}
                  className={`w-full p-4 rounded-2xl font-bold shadow-lg flex justify-center items-center gap-2 transition-all cursor-pointer text-sm ${
                    !activeShift
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                      : 'bg-black hover:bg-slate-800 text-white'
                  }`}
                >
                  {isSubmittingPayment ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Procesando...
                    </>
                  ) : !activeShift ? (
                    <>
                      <Lock size={18} />
                      Caja Cerrada (Apertura Requerida para Facturar)
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      {paymentMethod === 'pago_movil' || paymentMethod === 'zelle' 
                        ? 'Confirmar Pago (Enviar a Caja)' 
                        : paymentMethod === 'credito' && !adminPin.trim()
                          ? 'Solicitar Crédito'
                          : 'Confirmar y Cerrar'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {viewingDeliveryInfo && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl overflow-hidden relative border border-slate-100"
            >
              {/* Banner header */}
              <div className="bg-amber-500 text-white p-8 relative">
                <button 
                  onClick={() => setViewingDeliveryInfo(null)}
                  className="absolute top-6 right-6 p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors"
                  title="Cerrar"
                >
                  <X size={18} />
                </button>
                <span className="text-[10px] bg-white/20 text-white font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                  {viewingDeliveryInfo.deliveryType === 'pickup' ? 'Retiro en Local' : 'Envío a Domicilio'}
                </span>
                <h3 className="text-2xl font-black mt-3 leading-tight truncate">
                  {viewingDeliveryInfo.customerName}
                </h3>
                <p className="text-white/80 text-xs mt-1">Detalles del pedido en curso</p>
              </div>

              {/* Body */}
              <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto text-slate-800">
                {/* Status Indicator banner */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-amber-500" />
                    <span className="text-xs font-bold text-slate-700">Estado del Pedido:</span>
                  </div>
                  <span className="text-xs bg-amber-100 text-amber-800 font-extrabold px-3 py-1 rounded-xl uppercase tracking-wider">
                    {viewingDeliveryInfo.paymentStatus === 'validated' ? 'Pago Validado' : 'Esperando Pago/Validación'}
                  </span>
                </div>

                {/* Customer Contact Card */}
                <div className="space-y-3">
                  <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-400">Datos de Contacto y Envío</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <span className="text-[9px] text-slate-400 uppercase font-black block mb-1">WhatsApp / Teléfono</span>
                      <a 
                        href={`https://wa.me/${viewingDeliveryInfo.customerPhone?.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1.5"
                      >
                        <Phone size={12} />
                        {viewingDeliveryInfo.customerPhone || 'Sin teléfono'}
                        <ExternalLink size={10} />
                      </a>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <span className="text-[9px] text-slate-400 uppercase font-black block mb-1">Inicio de Sesión</span>
                      <span className="text-xs font-bold text-slate-800">
                        {new Date(viewingDeliveryInfo.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {viewingDeliveryInfo.deliveryType !== 'pickup' && viewingDeliveryInfo.customerAddress && (
                      <div className="col-span-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <span className="text-[9px] text-slate-400 uppercase font-black block mb-1">Dirección de Entrega</span>
                        <div className="flex items-start gap-2 text-xs text-slate-700">
                          <MapPin size={14} className="text-rose-500 shrink-0 mt-0.5" />
                          <span className="font-medium leading-relaxed">{viewingDeliveryInfo.customerAddress}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Items Reciept summary */}
                <div className="space-y-3">
                  <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-400">Productos del Pedido</h4>
                  
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-3">
                    {deliveryInfoOrders.map(order => (
                      <div key={order.id} className="flex justify-between items-center text-xs pb-2 border-b border-slate-200/50 last:border-0 last:pb-0">
                        <div>
                          <span className="font-extrabold text-slate-900">{order.quantity}x</span>{' '}
                          <span className="font-medium text-slate-700">{order.itemName}</span>
                        </div>
                        <span className="font-mono font-bold text-slate-900">
                          ${(order.price * order.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}

                    {deliveryInfoOrders.length === 0 && (
                      <p className="text-xs text-slate-400 italic text-center py-2">Sin productos agregados todavía.</p>
                    )}

                    {/* Total info */}
                    {deliveryInfoOrders.length > 0 && (
                      <div className="pt-4 border-t border-slate-200 flex justify-between items-end">
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase font-black block">Total Acumulado</span>
                          <span className="text-xl font-light text-slate-900">
                            ${deliveryInfoOrders.reduce((sum, o) => sum + (o.price * o.quantity), 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] text-slate-400 uppercase font-black block">En Bolívares</span>
                          <span className="text-sm font-bold text-slate-700">
                            Bs. {(deliveryInfoOrders.reduce((sum, o) => sum + (o.price * o.quantity), 0) * exchangeRate).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment info if present */}
                {viewingDeliveryInfo.paymentMethod && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-400">Información del Pago Registrado</h4>
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 text-xs grid grid-cols-2 gap-3 text-slate-700">
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-black block">Método</span>
                        <span className="font-bold uppercase text-slate-900">{viewingDeliveryInfo.paymentMethod}</span>
                      </div>
                      {viewingDeliveryInfo.paymentReference && (
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase font-black block">Referencia</span>
                          <span className="font-mono font-bold text-slate-900">#{viewingDeliveryInfo.paymentReference}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => setViewingDeliveryInfo(null)}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 p-4 rounded-xl font-bold text-sm transition-colors"
                >
                  Cerrar Detalles
                </button>
                <button 
                  onClick={() => {
                    setSelectedTable({ id: 'delivery-' + viewingDeliveryInfo.id, number: viewingDeliveryInfo.customerName || 'Llevar', status: 'occupied', capacity: 1 });
                    setViewingDeliveryInfo(null);
                  }}
                  className="flex-1 bg-black hover:bg-slate-800 text-white p-4 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] flex items-center justify-center gap-2 shadow-lg shadow-black/10"
                >
                  <ShoppingBag size={16} />
                  Gestionar Pedido
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* WAITER: ITEM DETAIL/CUSTOMIZATION MODAL */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[70] bg-white sm:bg-black/40 sm:backdrop-blur-sm flex flex-col sm:items-center sm:justify-center p-0 sm:p-6 overflow-hidden">
            <div className="hidden sm:block absolute inset-0 cursor-pointer" onClick={() => setSelectedItem(null)} />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-none sm:rounded-[32px] w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-lg shadow-2xl relative border-0 sm:border border-slate-100 overflow-hidden z-10 flex flex-col"
            >
              {/* Header */}
              <div className="relative h-[180px] sm:h-[240px] w-full bg-slate-100 flex-shrink-0">
                <img src={selectedItem.image || 'https://via.placeholder.com/300'} alt={selectedItem.name} className="w-full h-full object-cover" />
                <button 
                  onClick={() => setSelectedItem(null)}
                  className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition-all shadow-md"
                >
                  <X size={20} />
                </button>
                <span className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-md text-black text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest shadow-sm">
                  {selectedItem.category}
                </span>
              </div>

              {/* Body */}
              <div className="p-6 md:p-8 overflow-y-auto flex-1">
                <div className="mb-4">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">{selectedItem.name}</h3>
                  <div className="flex items-baseline gap-3 mt-2">
                    <span className="font-black text-2xl text-black">{formatPrice(selectedItem.price)}</span>
                    <span className="text-sm text-slate-400 font-semibold">{formatBs(toBolivares(selectedItem.price))}</span>
                  </div>
                </div>

                {/* Personalizar Platillo */}
                {selectedItem.recipe && selectedItem.recipe.length > 0 && (
                  <div className="mb-6 p-4 bg-slate-50 border border-slate-100/60 rounded-2xl">
                    <h5 className="font-bold text-xs text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <span>🍔</span> Personalizar ingredientes
                    </h5>
                    <p className="text-[10px] text-slate-400 mb-3">
                      Quita los ingredientes que el cliente no desee:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedItem.recipe.map((ri) => {
                        const ing = ingredients.find(i => i.id === ri.ingredientId);
                        if (!ing) return null;
                        const isExcluded = excludedIds.includes(ri.ingredientId);
                        return (
                          <label 
                            key={ri.ingredientId} 
                            className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer select-none transition-all ${
                              isExcluded 
                                ? 'bg-rose-50/40 border-rose-100 text-slate-400 line-through' 
                                : 'bg-white border-slate-100 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <input 
                              type="checkbox"
                              checked={!isExcluded}
                              onChange={() => {
                                if (isExcluded) {
                                  setExcludedIds(prev => prev.filter(id => id !== ri.ingredientId));
                                } else {
                                  setExcludedIds(prev => [...prev, ri.ingredientId]);
                                }
                              }}
                              className="accent-black rounded border-slate-300 w-3.5 h-3.5"
                            />
                            <span className="text-xs font-semibold">{ing.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Ingredientes Extras */}
                {selectedItem.extras && selectedItem.extras.length > 0 && (
                  <div className="mb-6 p-4 bg-indigo-50/30 border border-indigo-100/50 rounded-2xl">
                    <h5 className="font-bold text-xs text-indigo-950 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <span>🧀</span> Agregar Adicionales / Extras
                    </h5>
                    <p className="text-[10px] text-slate-400 mb-3">
                      Añade extras deliciosos al plato:
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {selectedItem.extras.map((extra, idx) => {
                        const isSelected = selectedExtras.some(e => e.name === extra.name);
                        return (
                          <label 
                            key={idx} 
                            className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer select-none transition-all ${
                              isSelected 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-950 shadow-sm font-bold' 
                                : 'bg-white border-slate-100 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input 
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  if (isSelected) {
                                    setSelectedExtras(prev => prev.filter(e => e.name !== extra.name));
                                  } else {
                                    setSelectedExtras(prev => [...prev, extra]);
                                  }
                                }}
                                className="accent-indigo-600 rounded border-indigo-300 w-3.5 h-3.5"
                              />
                              <span className="text-xs">{extra.name}</span>
                            </div>
                            <span className="text-xs font-black text-indigo-600 bg-indigo-50/50 px-2 py-0.5 rounded-lg border border-indigo-100/40">
                              +${extra.price.toFixed(2)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Preset Custom Note Chips */}
                <div className="mb-4">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Notas o Preferencias Rápidas
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {['Término Medio', 'Bien Cocido', 'Sin Sal', 'Salsa Aparte', 'Poco Picante', 'Bien Tostado'].map(preset => {
                      const isSelected = extraNote.includes(preset);
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setExtraNote(prev => prev.replace(preset, '').replace(/^,\s*|,\s*$/, '').replace(/\s*,\s*,*/g, ', ').trim());
                            } else {
                              setExtraNote(prev => prev.trim() ? `${prev.trim()}, ${preset}` : preset);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all border ${
                            isSelected 
                              ? 'bg-black text-white border-black shadow-sm' 
                              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          {preset}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* TOAST FEATURE: Course Firing & Seat Selection */}
                <div className="mb-6 p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-indigo-900 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>🍽️ Tiempo de Entrega (Pase por Tiempos)</span>
                      <span className="text-[9px] text-indigo-600 bg-white px-2 py-0.5 rounded-full font-bold">KDS Avanzado</span>
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { id: 'starter', label: '🥗 Entrada' },
                        { id: 'main', label: '🥩 Fuerte' },
                        { id: 'dessert', label: '🍰 Postre' },
                        { id: 'beverage', label: '🍹 Bebida' }
                      ].map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedCourse(c.id as CourseType)}
                          className={`py-2 rounded-xl text-xs font-black transition-all border ${
                            selectedCourse === c.id
                              ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                              : 'bg-white text-indigo-950 border-indigo-200/80 hover:bg-indigo-100/50'
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-indigo-100/80">
                    <span className="text-xs font-bold text-indigo-900">Estado de Envío:</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedCourseStatus('fired')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                          selectedCourseStatus === 'fired'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 border border-indigo-200'
                        }`}
                      >
                        🔥 Marchar Ya
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedCourseStatus('hold')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                          selectedCourseStatus === 'hold'
                            ? 'bg-amber-500 text-slate-950 shadow-sm'
                            : 'bg-white text-slate-600 border border-indigo-200'
                        }`}
                      >
                        ⏳ En Espera
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-indigo-100/80">
                    <label className="block text-[10px] font-black text-indigo-900 uppercase tracking-wider mb-2">
                      💺 Asiento / Comensal
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSelectedSeatNumber(s)}
                          className={`w-8 h-8 rounded-xl text-xs font-black transition-all border ${
                            selectedSeatNumber === s
                              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                              : 'bg-white text-slate-700 border-indigo-200 hover:bg-slate-100'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Extra note text area */}
                <div className="mb-6">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    ✍️ Nota o Instrucción especial
                  </label>
                  <textarea
                    value={extraNote}
                    onChange={(e) => setExtraNote(e.target.value)}
                    placeholder="Ej: Sin cebolla, término medio, etc..."
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-xs font-medium outline-none focus:border-black resize-none h-16 transition-colors"
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="p-4 pb-6 sm:p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0 z-20 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-8px_25px_rgba(0,0,0,0.06)]">
                {/* Quantity Controls */}
                <div className="flex items-center justify-between sm:justify-start gap-4 bg-slate-100 rounded-2xl p-1.5 self-center sm:setModalQty">
                  <button 
                    onClick={() => setModalQty(prev => Math.max(1, prev - 1))}
                    className="w-10 h-10 rounded-xl bg-white flex items-center justify-center hover:bg-slate-100 active:scale-95 transition-all text-slate-600 shadow-sm border border-slate-100"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="font-black text-base w-8 text-center select-none">{modalQty}</span>
                  <button 
                    onClick={() => setModalQty(prev => prev + 1)}
                    className="w-10 h-10 rounded-xl bg-white flex items-center justify-center hover:bg-slate-100 active:scale-95 transition-all text-slate-600 shadow-sm border border-slate-100"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {/* Confirm additions */}
                <button 
                  onClick={() => {
                    const finalExclusions = excludedIds.map(id => ingredients.find(ing => ing.id === id)?.name).filter(Boolean);
                    const exclusionsText = finalExclusions.length > 0 ? `SIN: ${finalExclusions.join(', ')}` : '';
                    const finalNote = [exclusionsText, extraNote.trim()].filter(Boolean).join(' | ');

                    addToCart(
                      selectedItem, 
                      modalQty, 
                      finalNote, 
                      excludedIds, 
                      selectedCourse, 
                      selectedCourseStatus, 
                      selectedSeatNumber,
                      selectedExtras
                    );
                    setSelectedItem(null);
                  }}
                  className="flex-1 bg-black hover:bg-slate-800 text-white p-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-transform hover:scale-[1.01] shadow-lg"
                >
                  <span>Agregar al Pedido</span>
                  <span className="opacity-40 font-normal">|</span>
                  <span>{formatPrice(getCartEntryPrice({ item: selectedItem, selectedExtras }) * modalQty)}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal for Itemized Split & Partial Payment by Consumption */}
      <AnimatePresence>
        {isPartialModalOpen && selectedTable && (
          <div className="fixed inset-0 z-[70] bg-white sm:bg-black/50 sm:backdrop-blur-sm flex flex-col sm:items-center sm:justify-center p-0 sm:p-6 overflow-hidden">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-none sm:rounded-[32px] p-4 sm:p-8 w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-xl shadow-2xl relative flex flex-col overflow-hidden"
            >
              <button
                onClick={() => setIsPartialModalOpen(false)}
                className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
              >
                <X size={18} />
              </button>

              <div className="mb-4 pr-8">
                <div className="flex items-center gap-2 text-purple-600 mb-1 font-extrabold text-xs uppercase tracking-wider">
                  <Scissors size={16} /> Pago y Separación por Consumo
                </div>
                <h3 className="text-xl font-black text-slate-900">
                  Seleccionar Ítems a Pagar
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedTable.id.startsWith('delivery-') ? 'Pedido: ' : 'Mesa '}{selectedTable.number} • Escoge qué platos va a pagar o separar esta persona.
                </p>
              </div>

              {/* Name input */}
              <div className="mb-4">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                  Nombre de la Persona / Comensal
                </label>
                <div className="relative">
                  <UserCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Ej: Thomas"
                    value={partialPayerName}
                    onChange={e => setPartialPayerName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-purple-600 transition-colors text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              {/* Quick select controls */}
              <div className="flex justify-between items-center mb-2 px-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Platos en la Cuenta ({activeOrders.length})
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const allMap: { [id: string]: number } = {};
                      activeOrders.forEach(o => { allMap[o.id] = o.quantity || 1; });
                      setPartialItemQuantities(allMap);
                    }}
                    className="text-[10px] font-bold text-indigo-600 hover:underline"
                  >
                    Seleccionar Todos
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      const zeroMap: { [id: string]: number } = {};
                      activeOrders.forEach(o => { zeroMap[o.id] = 0; });
                      setPartialItemQuantities(zeroMap);
                    }}
                    className="text-[10px] font-bold text-slate-400 hover:underline"
                  >
                    Deseleccionar
                  </button>
                </div>
              </div>

              {/* List of items */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 my-2 max-h-[280px]">
                {activeOrders.map(order => {
                  const selectedQty = partialItemQuantities[order.id] || 0;
                  const maxQty = order.quantity || 1;
                  const unitPrice = order.price || 0;
                  const isSelected = selectedQty > 0;

                  return (
                    <div
                      key={order.id}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                        isSelected ? 'bg-purple-50/60 border-purple-200 shadow-xs' : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="pr-2 min-w-0">
                        <div className="font-bold text-xs text-slate-800 truncate">{order.itemName}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          ${unitPrice.toFixed(2)} c/u {order.seatNumber ? `• 💺 Asiento ${order.seatNumber}` : ''}
                        </div>
                        {isSelected && (
                          <div className="text-[10px] font-black text-purple-700 mt-0.5">
                            Subtotal: ${(unitPrice * selectedQty).toFixed(2)} USD
                          </div>
                        )}
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center border border-slate-200 rounded-xl bg-white overflow-hidden shadow-xs">
                          <button
                            type="button"
                            onClick={() => setPartialItemQuantities(prev => ({ ...prev, [order.id]: Math.max(0, selectedQty - 1) }))}
                            className="px-2.5 py-1 text-slate-600 font-black hover:bg-slate-100 transition-colors"
                          >-</button>
                          <span className="px-2 text-xs font-black font-mono w-10 text-center">
                            {selectedQty}/{maxQty}
                          </span>
                          <button
                            type="button"
                            onClick={() => setPartialItemQuantities(prev => ({ ...prev, [order.id]: Math.min(maxQty, selectedQty + 1) }))}
                            className="px-2.5 py-1 text-slate-600 font-black hover:bg-slate-100 transition-colors"
                          >+</button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {activeOrders.length === 0 && (
                  <div className="p-8 text-center text-slate-400 italic text-xs">
                    No hay ítems consumidos registrados en esta cuenta.
                  </div>
                )}
              </div>

              {/* Summary Footer */}
              <div className="mt-4 pt-4 border-t border-slate-100 bg-slate-50/80 -mx-6 sm:-mx-8 -mb-6 sm:-mb-8 p-6 sm:p-8 rounded-b-[32px] space-y-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="flex justify-between items-center text-xs text-slate-600">
                    <span className="font-bold">Subtotal Platos ({partialTotalSelectedItems} ítems):</span>
                    <span className="font-mono font-bold text-slate-900">${partialSubtotal.toFixed(2)} USD</span>
                  </div>

                  <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-100">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={includeTip}
                        onChange={e => setIncludeTip(e.target.checked)}
                        className="w-4 h-4 rounded text-purple-700 accent-purple-700 cursor-pointer"
                      />
                      <span className="font-bold text-slate-700">
                        + Servicio de Mesa ({servicePercent}%)
                      </span>
                    </label>
                    <span className="font-mono font-bold text-purple-700">{formatPrice(partialTip)}</span>
                  </div>

                  <div className="flex justify-between items-end pt-2 border-t border-slate-200">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
                        Total Comensal ({activeCurrency})
                      </span>
                      <div className="text-2xl font-black text-slate-900">
                        {formatPrice(partialTotal)}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
                        En Bolívares
                      </span>
                      <div className="text-lg font-extrabold text-purple-800 font-mono">
                        {formatBs(toBolivares(partialTotal))}
                      </div>
                    </div>
                  </div>
                </div>

                {partialPaymentStep === 'select' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={handleMoveSelectedToNewPerson}
                      disabled={partialTotalSelectedItems === 0}
                      className="w-full bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-800 py-3.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all border border-slate-200"
                    >
                      <Users size={16} /> Mover a Nueva Persona
                    </button>

                    <button
                      type="button"
                      onClick={() => setPartialPaymentStep('pay')}
                      disabled={partialTotalSelectedItems === 0}
                      className="w-full bg-purple-700 hover:bg-purple-800 disabled:opacity-40 text-white py-3.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-purple-200"
                    >
                      <CreditCard size={16} /> Cobrar Este Consumo
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 bg-white p-4 rounded-2xl border border-purple-100">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-700">Procesando Pago de {partialPayerName || 'Comensal'}</span>
                      <button 
                        type="button" 
                        onClick={() => setPartialPaymentStep('select')}
                        className="text-[10px] font-bold text-purple-600 hover:underline"
                      >
                        ← Cambiar selección
                      </button>
                    </div>

                    {/* Payment Method Selector */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Método de Pago</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {availablePaymentMethods.map(m => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setPaymentMethod(m.id);
                              if (m.currency === 'Bs') setPaymentCurrency('Bs');
                              else if (m.currency === 'EUR') setPaymentCurrency('EUR');
                              else if (m.currency === 'USDT') setPaymentCurrency('USDT');
                              else if (m.id === 'pago_movil' || m.id === 'punto') setPaymentCurrency('Bs');
                              else setPaymentCurrency('USD');
                            }}
                            className={`py-2 px-3 rounded-xl border text-[11px] font-bold transition-all ${paymentMethod === m.id ? 'bg-purple-900 text-white border-purple-900 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}`}
                          >
                            {m.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Reference & Receipt Image for Digital Payments */}
                    {paymentMethod !== 'divisa' && paymentMethod !== 'punto' && paymentMethod !== 'credito' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                            Nro. de Referencia <span className="text-rose-500 font-bold">(Obligatorio)</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Ej. 123456"
                            value={paymentRef}
                            onChange={e => setPaymentRef(e.target.value)}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-purple-600 text-xs font-mono font-bold"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              Foto / Captura Comprobante <span className="text-rose-500 font-bold">(Obligatorio)</span>
                            </label>
                            {receiptImage && (
                              <button type="button" onClick={() => setReceiptImage(null)} className="text-[9px] font-bold text-rose-500 hover:underline">
                                Eliminar
                              </button>
                            )}
                          </div>
                          <label className={`flex items-center justify-center p-3 border-2 border-dashed rounded-xl cursor-pointer transition-all ${receiptImage ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-200 hover:border-purple-600'}`}>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onloadend = () => setReceiptImage(reader.result as string);
                                reader.readAsDataURL(file);
                              }}
                              className="hidden"
                            />
                            {receiptImage ? (
                              <div className="flex items-center gap-2">
                                <img src={receiptImage} alt="Comprobante" className="w-8 h-8 rounded object-cover border border-emerald-300" />
                                <span className="text-xs font-bold text-emerald-800">Comprobante Adjuntado ✓</span>
                              </div>
                            ) : (
                              <span className="text-xs font-bold text-slate-500">📷 Subir foto de pago</span>
                            )}
                          </label>
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleProcessPartialPayment}
                      disabled={isProcessingPartialPayment || partialTotal <= 0}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white py-3.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-200"
                    >
                      {isProcessingPartialPayment ? 'Procesando...' : `Confirmar Pago Parcial de $${partialTotal.toFixed(2)}`}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full Resolution Receipt Image Modal */}
      <AnimatePresence>
        {viewingReceiptModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-4 max-w-lg w-full relative shadow-2xl space-y-3"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                  🧾 Comprobante de Pago
                </h3>
                <button 
                  onClick={() => setViewingReceiptModal(null)}
                  className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="max-h-[75vh] overflow-auto rounded-2xl border border-slate-200 bg-slate-950 flex items-center justify-center p-2">
                <img src={viewingReceiptModal} alt="Comprobante de Pago" className="max-w-full max-h-[70vh] object-contain rounded-xl" />
              </div>
              <button 
                onClick={() => setViewingReceiptModal(null)}
                className="w-full bg-black text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer"
              >
                Cerrar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
