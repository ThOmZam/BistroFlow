import React, { useState, useEffect } from 'react';
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
  ExternalLink,
  Info,
  Check,
  Star
} from 'lucide-react';
import { collection, addDoc, serverTimestamp, doc, updateDoc, onSnapshot, getDocs, collectionGroup, query, where, getDoc, deleteDoc } from 'firebase/firestore';
import { logAction } from '../lib/logger';
import { db } from '../lib/firebase';
import { useRestaurantData } from '../hooks/useRestaurantData';
import { playClickSound, playSuccessSound, playErrorSound } from '../lib/audio';
import { Table, MenuItem, Session, CourseType, CourseStatus } from '../types';
import { useBookmarks } from '../lib/bookmarks';
import { getMenuItemStockAlert, isMenuItem86ed } from '../lib/stockUtils';

export default function WaiterView({ currentUser }: { currentUser?: any }) {
  const { tables, menu, ingredients, activeSessions, exchangeRate, settings } = useRestaurantData();
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [cart, setCart] = useState<{ 
    item: MenuItem; 
    qty: number; 
    note?: string; 
    excludedIngredientIds?: string[];
    course?: CourseType;
    courseStatus?: CourseStatus;
    seatNumber?: number;
  }[]>([]);
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
  const [menuSearch, setMenuSearch] = useState('');
  const [tableFilter, setTableFilter] = useState<'all' | 'free' | 'occupied' | 'ready'>('all');
  const [showReadyDetails, setShowReadyDetails] = useState(true);
  const { isBookmarked, toggleBookmark } = useBookmarks();

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

  const [isOpeningTable, setIsOpeningTable] = useState<Table | null>(null);
  const [firstAccountName, setFirstAccountName] = useState('');
  const [isCreatingDelivery, setIsCreatingDelivery] = useState(false);
  const [deliveryName, setDeliveryName] = useState('');

  const createDelivery = async () => {
    if (!deliveryName.trim()) return;
    try {
      const docRef = await addDoc(collection(db, 'sessions'), {
        tableId: 'delivery',
        type: 'delivery',
        customerName: deliveryName.trim(),
        orderNumber: Math.floor(1000 + Math.random() * 9000),
        startTime: new Date().toISOString(),
        status: 'active',
        totalAmount: 0,
        accounts: [{ id: 'default', name: deliveryName.trim(), status: 'active' }],
        waiterId: currentUser?.employeeId || localStorage.getItem('demo_employee_id') || 'fallback-waiter',
        waiterName: currentUser?.name || localStorage.getItem('demo_user_name') || 'Mesero',
        createdBy: currentUser?.employeeId || localStorage.getItem('demo_employee_id') || 'fallback-waiter'
      });
      
      const waiterName = currentUser?.name || localStorage.getItem('demo_user_name') || 'Mesero';
      await logAction('order', waiterName, 'Creó delivery manual', `Para: ${deliveryName.trim()}`);

      setSelectedTable({ id: 'delivery-' + docRef.id, number: deliveryName.trim(), capacity: 1, status: 'occupied' });
      setActiveAccountId('default');
      setIsCreatingDelivery(false);
      setDeliveryName('');
    } catch (err) {
      console.error(err);
    }
  };

  const startSession = async (table: Table) => {
    if (!firstAccountName.trim()) return;
    
    // Prevent duplicate sessions
    if (activeSessions.some(s => s.tableId === table.id)) {
      alert('Ya existe una sesión activa para esta mesa.');
      setIsOpeningTable(null);
      setFirstAccountName('');
      return;
    }

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
    }
  };

  // Advanced POS state extensions: Course, Seat, Auto-86
  const [selectedCourse, setSelectedCourse] = useState<CourseType>('main');
  const [selectedCourseStatus, setSelectedCourseStatus] = useState<CourseStatus>('fired');
  const [selectedSeatNumber, setSelectedSeatNumber] = useState<number>(1);

  const addToCart = (
    item: MenuItem, 
    qty: number = 1, 
    note: string = '', 
    excludedIngredientIds: string[] = [],
    course: CourseType = 'main',
    courseStatus: CourseStatus = 'fired',
    seatNumber: number = 1
  ) => {
    playClickSound();
    setCart(prev => {
      const existing = prev.find(i => 
        i.item.id === item.id && 
        (i.note || '') === note && 
        i.course === course &&
        i.courseStatus === courseStatus &&
        i.seatNumber === seatNumber &&
        JSON.stringify(i.excludedIngredientIds || []) === JSON.stringify(excludedIngredientIds)
      );
      if (existing) {
        return prev.map(i => 
          (i.item.id === item.id && 
           (i.note || '') === note && 
           i.course === course &&
           i.courseStatus === courseStatus &&
           i.seatNumber === seatNumber &&
           JSON.stringify(i.excludedIngredientIds || []) === JSON.stringify(excludedIngredientIds))
            ? { ...i, qty: i.qty + qty }
            : i
        );
      }
      return [...prev, { item, qty, note, excludedIngredientIds, course, courseStatus, seatNumber }];
    });
  };

  const sendOrder = async () => {
    if (!selectedTable || cart.length === 0) return;
    const session = getSessionForTable(selectedTable.id);
    if (!session) return;

    try {
      const accountId = activeAccountId;
      const ordersRef = collection(db, 'sessions', session.id, 'accounts', accountId, 'orders');
      const batchId = Date.now().toString();
      const itemNames = cart.map(c => c.qty + 'x ' + c.item.name).join(', ');
      const waiterName = currentUser?.name || localStorage.getItem('demo_user_name') || 'Mesero';
      await logAction('order', waiterName, 'Envió un pedido a cocina', `Mesa ${selectedTable.number}: ${itemNames}`);

      for (const entry of cart) {
        await addDoc(ordersRef, {
          menuItemId: entry.item.id,
          itemName: entry.item.name,
          price: entry.item.price,
          quantity: entry.qty,
          status: 'pending',
          timestamp: new Date().toISOString(),
          note: entry.note || '',
          course: entry.course || entry.item.course || 'main',
          courseStatus: entry.courseStatus || 'fired',
          seatNumber: entry.seatNumber || 1,
          excludedIngredientIds: entry.excludedIngredientIds || [],
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
    }
  };

  const [isPaying, setIsPaying] = useState(false);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pago_movil');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentCurrency, setPaymentCurrency] = useState('Bs');
  const [mixedPayments, setMixedPayments] = useState<{ id: string, method: string, amountUSD: number, currency: string, reference: string, receiptImage: string | null }[]>([]);
  const [currentMixtoCurrency, setCurrentMixtoCurrency] = useState('Bs');
  const [currentMixedAmount, setCurrentMixedAmount] = useState('');

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

      if ((paymentMethod === 'pago_movil' || paymentMethod === 'zelle') && !paymentRef.trim()) {
        alert('Por favor, ingresa el número de referencia del pago.');
        return;
      }

      // Mandatory receipt for Delivery/Pickup if Zelle/Pago Movil, and optional for Dine-in
      if ((paymentMethod === 'pago_movil' || paymentMethod === 'zelle') && isDelivery && !receiptImage) {
        alert('Para pedidos de Delivery / Pickup, es obligatorio subir la imagen del comprobante de pago.');
        return;
      }

      const accounts = session.accounts || [{ id: 'default', name: 'Cuenta 1', status: 'active' }];
      
      let isAdminPinValid = false;
      if (paymentMethod === 'credito' && adminPin.trim()) {
        isAdminPinValid = adminPin.trim() === '1111';
        if (!isAdminPinValid) {
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
              amount: mp.amountUSD,
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
            amount: finalTotal,
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
      setIncludeTip(false);
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

  const [includeTip, setIncludeTip] = useState(true);
  const activeOrdersTotal = activeOrders.reduce((acc, o) => {
    const itemPrice = o.price !== undefined ? o.price : (menu.find(m => m.name === o.itemName)?.price || 0);
    return acc + (itemPrice * (o.quantity || 1));
  }, 0);
  
  const showServiceCharge = settings?.serviceChargeEnabled !== false && settings?.suggestedTipsEnabled !== false;
  const servicePercent = showServiceCharge ? (settings?.serviceChargePercent !== undefined ? settings.serviceChargePercent : 10) : 0;
  const tipAmount = includeTip && showServiceCharge ? activeOrdersTotal * (servicePercent / 100) : 0;
  const finalTotal = activeOrdersTotal + tipAmount;

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
        <div className={`flex-1 bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm overflow-hidden flex flex-col ${selectedTable ? 'hidden lg:flex' : 'flex'}`}>
          {/* HEADER & TABLE STATUS FILTER */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-5 shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-slate-800">Mapa de Mesas</h2>
            <p className="text-slate-400 text-[11px] sm:text-xs">
              Mesero activo: <strong className="text-indigo-600 font-extrabold">{currentUser?.name || localStorage.getItem('demo_user_name') || 'Mesero'}</strong>
            </p>
          </div>
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

        <div className="flex-1 relative rounded-3xl p-4 overflow-auto">
          {tables.length === 0 && activeSessions.filter(s => s.type === 'delivery').length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-300 font-medium italic">
              Sin mesas cargadas. Ve a Admin para configurar.
            </div>
          )}
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
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

      {/* Right: Management Panel (Visible when table selected or on wide screens) */}
      <AnimatePresence>
        {selectedTable && (
          <motion.div
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            className="w-full lg:w-[480px] h-full bg-white rounded-[32px] border border-slate-100 shadow-xl flex flex-col overflow-hidden"
          >
            <div className="p-4 sm:p-5 border-b border-slate-50 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-base sm:text-lg">
                  {selectedTable.id.startsWith('delivery-') ? 'Llevar: ' : 'Mesa '}{selectedTable.number}
                </h3>
                <p className="text-slate-400 text-[11px] sm:text-xs">Gestión de comanda</p>
              </div>
              <button 
                onClick={() => setSelectedTable(null)}
                className="p-1.5 hover:bg-slate-50 text-slate-400 rounded-full transition-colors text-xs sm:text-sm font-bold"
              >
                Cerrar
              </button>
            </div>

            {selectedTable.id.startsWith('delivery-') && (
              (() => {
                const session = getSessionForTable(selectedTable.id);
                if (!session) return null;
                return (
                  <div className="mx-6 mt-4 p-5 bg-amber-50/70 border border-amber-100 rounded-3xl text-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-900 uppercase tracking-wider text-[10px]">Información del Pedido</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        session.paymentStatus === 'validated' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        Pago: {session.paymentStatus === 'validated' ? 'Validado' : 'Por Validar'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-slate-700">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Cliente</span>
                        <span className="font-bold text-slate-900">{session.customerName || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Teléfono</span>
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

                    <div className="text-slate-700">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Tipo / Dirección</span>
                      <span className="font-bold text-slate-900 block capitalize text-xs">
                        {session.deliveryType === 'pickup' ? 'Retiro en Local' : 'Delivery a domicilio'}
                      </span>
                      {session.customerAddress && (
                        <span className="text-slate-600 block mt-0.5 text-xs">{session.customerAddress}</span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-amber-200/40 text-slate-700">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Método de Pago</span>
                        <span className="font-bold text-slate-900 uppercase">{session.paymentMethod || 'Efectivo'}</span>
                      </div>
                      {session.paymentReference && (
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Referencia</span>
                          <span className="font-bold text-slate-900 font-mono">#{session.paymentReference}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()
            )}

            {selectedTable.id.startsWith('delivery-') ? (
              (() => {
                const session = getSessionForTable(selectedTable.id);
                if (!session) {
                  return (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400">
                      <AlertCircle size={32} className="mb-2" />
                      <p>No se encontró la sesión del pedido.</p>
                    </div>
                  );
                }

                const totalUSD = activeOrders.reduce((sum, o) => sum + (o.price * o.quantity), 0);
                const totalBs = totalUSD * exchangeRate;

                return (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Compact, clean summary of delivery items */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      
                      {/* Products List */}
                      <div className="space-y-3">
                        <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Productos Solicitados</span>
                        <div className="bg-slate-50 border border-slate-100/80 rounded-3xl p-5 space-y-3">
                          {activeOrders.map(order => (
                            <div key={order.id} className="flex justify-between items-center text-xs pb-3 border-b border-slate-200/40 last:border-0 last:pb-0">
                              <div>
                                <span className="font-extrabold text-slate-900">{order.quantity}x</span>{' '}
                                <span className="font-medium text-slate-700">{order.itemName}</span>
                                {order.status && (
                                  <span className={`ml-2 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                                    order.status === 'ready' ? 'bg-emerald-100 text-emerald-800' :
                                    order.status === 'preparing' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {order.status === 'ready' ? 'Listo' : order.status === 'preparing' ? 'En cocina' : 'Pendiente'}
                                  </span>
                                )}
                              </div>
                              <span className="font-mono font-bold text-slate-900">
                                ${(order.price * order.quantity).toFixed(2)}
                              </span>
                            </div>
                          ))}

                          {activeOrders.length === 0 && (
                            <p className="text-xs text-slate-400 italic text-center py-2">Sin productos agregados todavía.</p>
                          )}

                          {activeOrders.length > 0 && (
                            <div className="pt-4 border-t border-slate-200/60 flex justify-between items-end">
                              <div>
                                <span className="text-[9px] text-slate-400 uppercase font-black block">Total del Pedido</span>
                                <span className="text-xl font-light text-slate-900">
                                  ${totalUSD.toFixed(2)}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-[9px] text-slate-400 uppercase font-black block">En Bolívares</span>
                                <span className="text-sm font-bold text-slate-700">
                                  Bs. {totalBs.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Info alert */}
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex gap-2 text-[11px] text-slate-500 leading-relaxed">
                        <Info size={14} className="text-slate-400 shrink-0 mt-0.5" />
                        <span>Este pedido fue realizado por {session.customerName}. El pago se encuentra en estado <strong className="text-slate-700 capitalize">"{session.paymentStatus === 'validated' ? 'validado' : 'esperando validación'}"</strong>. Una vez entregado al cliente, presiona el botón inferior para cerrar este pedido permanentemente.</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="p-6 bg-white border-t border-slate-100 flex flex-col gap-2">
                      <button 
                        onClick={async () => {
                          try {
                            // Mark as completed
                            await updateDoc(doc(db, 'sessions', session.id), {
                              status: 'completed',
                              paymentStatus: 'validated', // automatically validate if delivered
                              'payment.totalUSD': totalUSD,
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

                            // Write audit log
                            const waiterName = currentUser?.name || localStorage.getItem('demo_user_name') || 'Mesero';
                            await logAction('order', waiterName, 'Entregó y cerró delivery', `Pedido de ${session.customerName} - Total: $${totalUSD.toFixed(2)}`);

                            setSelectedTable(null);
                          } catch (err) {
                            console.error('Error closing delivery session:', err);
                            alert('Error al marcar como entregado.');
                          }
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.01] shadow-lg shadow-emerald-600/10"
                      >
                        <CheckCircle2 size={18} />
                        Marcar como Entregado
                      </button>

                      <button 
                        onClick={async () => {
                          if (confirm('¿Está seguro de que desea cancelar este pedido?')) {
                            try {
                              await updateDoc(doc(db, 'sessions', session.id), {
                                status: 'cancelled'
                              });

                              // Write audit log
                              const waiterName = currentUser?.name || localStorage.getItem('demo_user_name') || 'Mesero';
                              await logAction('order', waiterName, 'Canceló delivery', `Pedido de ${session.customerName}`);

                              setSelectedTable(null);
                            } catch (err) {
                              console.error('Error cancelling delivery session:', err);
                            }
                          }
                        }}
                        className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 p-3 rounded-xl text-xs font-bold transition-all"
                      >
                        Cancelar Pedido
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : !getSessionForTable(selectedTable.id) ? (
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

                      {/* Feature: 1-Click Bill Split by Seat */}
                      <button
                        onClick={async () => {
                          if (!selectedTable) return;
                          const session = getSessionForTable(selectedTable.id);
                          if (!session) return;

                          try {
                            const ordersRef = collection(db, 'sessions', session.id, 'accounts', 'default', 'orders');
                            const snap = await getDocs(ordersRef);
                            const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));

                            const seats = [...new Set(orders.map((o: any) => o.seatNumber || 1))].sort((a, b) => a - b);
                            if (seats.length <= 1) {
                              alert('Se requiere registrar items con al menos 2 asientos distintos para dividir automáticamente.');
                              return;
                            }

                            const newAccounts = seats.map(s => ({
                              id: `seat_${s}`,
                              name: `Asiento ${s}`,
                              status: 'active'
                            }));

                            await updateDoc(doc(db, 'sessions', session.id), { accounts: newAccounts });

                            for (const orderDoc of snap.docs) {
                              const o = orderDoc.data();
                              const seat = o.seatNumber || 1;
                              const targetAccId = `seat_${seat}`;

                              await addDoc(collection(db, 'sessions', session.id, 'accounts', targetAccId, 'orders'), o);
                              await deleteDoc(doc(db, 'sessions', session.id, 'accounts', 'default', 'orders', orderDoc.id));
                            }

                            playSuccessSound();
                            alert(`✅ Cuenta dividida en ${seats.length} asientos automáticamente.`);
                          } catch (err) {
                            console.error('Error splitting by seat:', err);
                            playErrorSound();
                          }
                        }}
                        className="text-xs bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/80 px-3 py-1.5 rounded-xl font-extrabold flex items-center gap-1 transition-all shadow-sm"
                        title="Dividir la cuenta por número de asiento registrado"
                      >
                        ⚡ Dividir por Asiento
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

                    <div className="flex-1 overflow-auto p-3 sm:p-4 grid grid-cols-2 gap-3 sm:gap-4">
                      {filteredMenu.map(item => {
                        const stockAlert = getMenuItemStockAlert(item, ingredients);
                        const isOutOfStock = stockAlert.status === 'out_of_stock';
                        return (
                          <button
                            key={item.id}
                            disabled={isOutOfStock}
                            onClick={() => { setSelectedItem(item); setModalQty(1); setExcludedIds([]); setExtraNote(''); }}
                            className={`group border border-slate-100 hover:border-black rounded-2xl p-2.5 sm:p-3 text-left transition-all duration-200 flex flex-col hover:shadow-md bg-white relative ${
                              isOutOfStock ? 'opacity-55 cursor-not-allowed' : ''
                            }`}
                          >
                            <div className="aspect-[4/3] bg-slate-50 rounded-xl mb-2 overflow-hidden w-full relative">
                              <img src={item.image || 'https://via.placeholder.com/150'} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                              
                              {/* Custom tags badges overlay */}
                              {item.alerts && item.alerts.length > 0 && (
                                <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1 z-10">
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
                                      <span key={tagId} title={labelTitle[tagId] || tagId} className="px-1 py-0.5 bg-black/85 backdrop-blur text-white text-[10px] font-bold rounded-md">
                                        {labelMap[tagId] || tagId}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}

                              {isOutOfStock && (
                                <div className="absolute inset-0 bg-rose-950/60 backdrop-blur-[1px] flex items-center justify-center">
                                  <span className="bg-white/95 px-2.5 py-1 text-[9px] font-black text-rose-600 rounded-lg shadow-sm tracking-wider uppercase">
                                    Agotado 🚫
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Inventory status helper text */}
                            {stockAlert.status !== 'available' && (
                              <span className={`text-[9px] font-extrabold uppercase tracking-wider mb-1 block ${
                                isOutOfStock ? 'text-rose-500' : 'text-amber-500 animate-pulse'
                              }`}>
                                {stockAlert.text}
                              </span>
                            )}
                            
                            <h5 className="font-bold text-xs sm:text-sm text-slate-900 tracking-tight leading-tight truncate w-full mb-1">{item.name}</h5>
                            <div className="flex items-baseline justify-between gap-1 mt-auto w-full">
                              <span className="text-xs sm:text-sm text-slate-950 font-black">${item.price.toFixed(2)}</span>
                              <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold">Bs. {(item.price * exchangeRate).toFixed(0)}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Cart / Order Summary */}
                    {cart.length > 0 && (
                      <div className="p-3 sm:p-3.5 bg-slate-50 border-t border-slate-100 shrink-0">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Nuevo Pedido</span>
                          <span className="text-[10px] bg-slate-200 text-slate-600 font-black px-1.5 py-0.5 rounded-full">{cart.length} items</span>
                        </div>
                        
                        <div className="space-y-2 max-h-24 overflow-auto mb-3 border-b border-slate-200 pb-2">
                          {cart.map((entry, index) => (
                            <div key={index} className="flex items-start justify-between text-xs group gap-2">
                              <span className="text-slate-500 block">
                                <span className="font-bold text-black">{entry.qty}x</span> {entry.item.name}
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
                                <span className="font-mono text-[11px]">${(entry.item.price * entry.qty).toFixed(2)}</span>
                                <button
                                  onClick={() => setCart(cart.filter((_, i) => i !== index))}
                                  className="text-rose-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Eliminar"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between mb-2.5 pt-1">
                          <span className="font-bold text-xs text-slate-700">Total Nuevo Pedido</span>
                          <div className="text-right flex items-baseline gap-1.5">
                            <span className="text-base font-black text-slate-950">${cart.reduce((acc, c) => acc + c.item.price * c.qty, 0).toFixed(2)}</span>
                            <span className="text-xs text-slate-400 font-bold">Bs. {(cart.reduce((acc, c) => acc + c.item.price * c.qty, 0) * exchangeRate).toFixed(0)}</span>
                          </div>
                        </div>

                        <button 
                          disabled={cart.length === 0}
                          onClick={sendOrder}
                          className={`w-full text-white py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                            cart.length > 0 
                              ? 'bg-black hover:bg-slate-800 shadow-lg shadow-black/10 hover:scale-[1.01]' 
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                          }`}
                        >
                          <ShoppingBag size={14} />
                          Enviar a Cocina
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex-1 flex flex-col relative bg-slate-50 overflow-hidden">
                    <div className="flex-1 overflow-auto p-3.5 sm:p-4">
                      {/* TOAST FEATURE: Course Firing Bar */}
                      <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3 mb-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-amber-900 uppercase tracking-wider flex items-center gap-1">
                            <span>🔥 Pase por Tiempos (Pase de Cocina)</span>
                          </span>
                          {activeOrders.some(o => o.courseStatus === 'hold') && (
                            <span className="text-[9px] bg-amber-500 text-white font-extrabold px-2 py-0.5 rounded-full animate-pulse">
                              Platos en Espera ⏳
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={async () => {
                              if (!selectedTable) return;
                              const session = getSessionForTable(selectedTable.id);
                              if (!session) return;
                              const ordersRef = collection(db, 'sessions', session.id, 'accounts', activeAccountId, 'orders');
                              const snap = await getDocs(ordersRef);
                              const holds = snap.docs.filter(d => d.data().courseStatus === 'hold' && d.data().course === 'main');
                              for (const d of holds) {
                                await updateDoc(doc(db, 'sessions', session.id, 'accounts', activeAccountId, 'orders', d.id), { courseStatus: 'fired' });
                              }
                              playSuccessSound();
                              alert('🔥 Platos Fuertes marchados a cocina.');
                            }}
                            className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-3 py-1.5 rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-1"
                          >
                            🔥 Marchar Fuertes
                          </button>
                          <button
                            onClick={async () => {
                              if (!selectedTable) return;
                              const session = getSessionForTable(selectedTable.id);
                              if (!session) return;
                              const ordersRef = collection(db, 'sessions', session.id, 'accounts', activeAccountId, 'orders');
                              const snap = await getDocs(ordersRef);
                              const holds = snap.docs.filter(d => d.data().courseStatus === 'hold' && d.data().course === 'dessert');
                              for (const d of holds) {
                                await updateDoc(doc(db, 'sessions', session.id, 'accounts', activeAccountId, 'orders', d.id), { courseStatus: 'fired' });
                              }
                              playSuccessSound();
                              alert('🍰 Postres marchados a cocina.');
                            }}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black px-3 py-1.5 rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-1"
                          >
                            🍰 Marchar Postres
                          </button>
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-4">
                        <h4 className="font-bold text-xs sm:text-sm mb-3 flex justify-between uppercase tracking-wider text-slate-800">
                          <span>Items Registrados</span>
                          <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md text-[10px] font-black">{activeOrders.length}</span>
                        </h4>
                        <div className="space-y-3">
                          {activeOrders.map(order => {
                            const itemPrice = order.price !== undefined ? order.price : (menu.find(m => m.name === order.itemName)?.price || 0);
                            return (
                            <div key={order.id} className="flex justify-between items-start text-xs sm:text-sm border-b border-slate-50 pb-2.5 last:border-0 last:pb-0">
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
                                <span className="font-mono text-xs font-semibold text-slate-900">${(itemPrice * (order.quantity || 1)).toFixed(2)}</span>
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
                          <span className="font-mono text-sm font-bold">${activeOrdersTotal.toFixed(2)}</span>
                        </div>
                        
                        {showServiceCharge && (
                          <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
                            <label className="flex items-center gap-2 cursor-pointer group">
                              <input type="checkbox" className="w-4 h-4 rounded text-black border-slate-200 border-2" checked={includeTip} onChange={e => setIncludeTip(e.target.checked)} />
                              <span className="font-bold text-xs group-hover:text-black text-slate-500 transition-colors">
                                Incluir {servicePercent}% Servicio
                              </span>
                            </label>
                            <span className="font-mono text-xs font-bold text-slate-600">${tipAmount.toFixed(2)}</span>
                          </div>
                        )}

                        <div className="flex items-end justify-between">
                          <div>
                            <div className="font-black text-slate-400 text-[10px] uppercase tracking-widest mb-1">Total a Pagar</div>
                            <div className="text-2xl font-black text-slate-950">${finalTotal.toFixed(2)}</div>
                          </div>
                          <div className="text-right flex flex-col items-end">
                            <div className="font-black text-slate-400 text-[9px] uppercase tracking-widest mb-1">En Bolívares</div>
                            <div className="text-lg font-black text-slate-800">Bs. {(finalTotal * exchangeRate).toFixed(0)}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 sm:p-4 bg-white border-t border-slate-100 flex flex-col gap-2 shrink-0">
                      {activeOrders.length > 0 ? (
                        <button 
                          onClick={() => setIsPaying(true)}
                          className="w-full bg-black text-white p-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-lg shadow-black/10"
                        >
                          <Receipt size={18} />
                          Cerrar Mesa y Pagar
                        </button>
                      ) : (
                        <button 
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
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </div>
      {/* Payment Modal */}
      {/* Creating Delivery Modal */}
      <AnimatePresence>
        {isCreatingDelivery && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[40px] p-8 w-full max-w-sm shadow-2xl relative"
            >
              <button 
                onClick={() => {
                  setIsCreatingDelivery(false);
                  setDeliveryName('');
                }}
                className="absolute top-6 right-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                title="Cerrar"
              >
                <X size={20} />
              </button>
              
              <h3 className="text-xl font-bold mb-4">Nuevo Delivery / Para Llevar</h3>
              <p className="text-sm text-slate-500 mb-6">Ingresa el nombre del cliente</p>

              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Nombre del cliente</label>
                  <input 
                    type="text" 
                    value={deliveryName}
                    onChange={e => setDeliveryName(e.target.value)}
                    placeholder="Ej. María Gómez"
                    autoFocus
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') createDelivery();
                    }}
                  />
                </div>
              </div>

              <button 
                onClick={createDelivery}
                disabled={!deliveryName.trim()}
                className={`w-full text-white p-4 rounded-xl font-bold transition-all flex justify-center items-center gap-2 ${deliveryName.trim() ? 'bg-black shadow-lg hover:scale-[1.02]' : 'bg-slate-300 cursor-not-allowed'}`}
              >
                Crear Pedido
              </button>
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
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[40px] p-8 w-full max-w-lg shadow-2xl relative my-8"
            >
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
                className="absolute top-6 right-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
              
              <h3 className="text-xl font-bold mb-1">Procesar Pago</h3>
              <p className="text-sm text-slate-500 mb-6">
                {selectedTable.id.startsWith('delivery-') ? 'Pedido Delivery/Llevar: ' : 'Mesa '}{selectedTable.number}
              </p>

              {/* Total Card */}
              <div className="bg-slate-50 p-6 rounded-3xl mb-6 border border-slate-100">
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest block mb-1">Total a cobrar</span>
                    <div className="text-3xl font-light text-slate-900">${finalTotal.toFixed(2)}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest block mb-1">En Bolívares</span>
                    <div className="text-xl font-bold text-rose-600">Bs. {(finalTotal * exchangeRate).toFixed(2)}</div>
                    <div className="text-[9px] text-slate-400 font-medium">Tasa: {exchangeRate} Bs/$</div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Method selector */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Método de Pago</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'pago_movil', label: 'Pago Móvil' },
                      { id: 'zelle', label: 'Zelle' },
                      { id: 'divisa', label: 'Divisa ($)' },
                      { id: 'punto', label: 'Punto (Bs)' },
                      { id: 'credito', label: 'Crédito' },
                      { id: 'mixto', label: 'Mixto' }
                    ].map(method => (
                      <button 
                        key={method.id}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(method.id);
                          if (method.id === 'zelle') setPaymentCurrency('USD');
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
                {(paymentMethod === 'pago_movil' || paymentMethod === 'zelle') && paymentMethod !== 'mixto' && (
                  <div className="space-y-4">
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
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Referencia (Obligatorio)</label>
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

                    {/* Image Receipt Uploader */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          Comprobante de Pago 
                          {selectedTable.id.startsWith('delivery-') ? (
                            <span className="text-rose-500 ml-1 font-extrabold">(OBLIGATORIO)</span>
                          ) : (
                            <span className="text-slate-400 ml-1 font-normal">(Opcional)</span>
                          )}
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
                        <label className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-3xl p-4 cursor-pointer transition-all ${receiptImage ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200 hover:border-black'}`}>
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

                        {/* Demo generator for convenience */}
                        {!receiptImage && (
                          <button 
                            type="button"
                            onClick={() => {
                              // generate a small mock blue/green image of a voucher
                              const mockCanvas = document.createElement('canvas');
                              mockCanvas.width = 100;
                              mockCanvas.height = 100;
                              const ctx = mockCanvas.getContext('2d');
                              if (ctx) {
                                ctx.fillStyle = '#065f46';
                                ctx.fillRect(0, 0, 100, 100);
                                ctx.fillStyle = '#ffffff';
                                ctx.font = 'bold 12px sans-serif';
                                ctx.fillText('VOUCHER', 18, 45);
                                ctx.fillText('OK', 40, 65);
                                setReceiptImage(mockCanvas.toDataURL('image/jpeg'));
                              }
                            }}
                            className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-[10px] font-bold text-slate-600 transition-colors"
                          >
                            Demo Voucher
                          </button>
                        )}
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
                        <span className="text-[9px] text-slate-400 block mt-1 italic">PIN Admin Demo es: 1111. Si no lo ingresa, se enviará la solicitud de crédito a la cola de aprobación de Caja.</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Action Button */}
              <button 
                onClick={handlePayment}
                disabled={isUploadingReceipt || isSubmittingPayment}
                className="w-full bg-black text-white p-4 rounded-xl font-bold shadow-lg hover:scale-[1.02] flex justify-center items-center gap-2 transition-transform mt-8"
              >
                {isSubmittingPayment ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Procesando...
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
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6 overflow-y-auto">
            <div className="absolute inset-0 cursor-pointer" onClick={() => setSelectedItem(null)} />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl relative border border-slate-100 overflow-hidden z-10 my-8 flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="relative aspect-[16/10] w-full bg-slate-100 flex-shrink-0">
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
                    <span className="font-black text-2xl text-black">${selectedItem.price.toFixed(2)}</span>
                    <span className="text-sm text-slate-400 font-semibold">Bs. {(selectedItem.price * exchangeRate).toFixed(2)}</span>
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
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 flex-shrink-0">
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
                      selectedSeatNumber
                    );
                    setSelectedItem(null);
                  }}
                  className="flex-1 bg-black hover:bg-slate-800 text-white p-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-transform hover:scale-[1.01] shadow-lg"
                >
                  Agregar al Pedido
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
