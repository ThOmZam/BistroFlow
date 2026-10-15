import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  updateDoc, 
  getDocs,
  addDoc,
  getDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logAction } from '../lib/logger';
import { 
  Check, 
  X, 
  DollarSign, 
  User, 
  MapPin, 
  Phone, 
  CreditCard, 
  Clock, 
  FileText,
  AlertCircle,
  CheckCircle2,
  Eye,
  Percent,
  TrendingUp,
  Inbox,
  AlertTriangle,
  ExternalLink,
  ShoppingBag,
  Key,
  Lock,
  Unlock,
  Receipt,
  ArrowLeft,
  PlusCircle,
  MinusCircle,
  Printer,
  Archive,
  RotateCcw,
  Calculator,
  ShieldCheck
} from 'lucide-react';
import { useRestaurantData } from '../hooks/useRestaurantData';
import { useCurrency } from '../context/CurrencyContext';
import CurrencySelector from '../components/CurrencySelector';
import { playClickSound, playCashSound, playSuccessSound, playErrorSound } from '../lib/audio';
import { printKitchenTicket } from '../lib/printer';

export default function CajaView({ currentUser, onViewChange }: { currentUser?: any; onViewChange?: (view: string) => void }) {
  const { settings, tables } = useRestaurantData();
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

  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [validatedSessions, setValidatedSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'validation' | 'tables' | 'delivery_pickup' | 'credits' | 'shifts'>('validation');

  // CASH SHIFT STATES
  const [shiftsList, setShiftsList] = useState<any[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);

  // Open Shift Modal State
  const [isOpeningShiftModalOpen, setIsOpeningShiftModalOpen] = useState(false);
  const [isSubmittingShift, setIsSubmittingShift] = useState(false);
  const [openingShiftName, setOpeningShiftName] = useState('Turno Mañana');
  const [openingCashierName, setOpeningCashierName] = useState('');
  const [openingInitialCashUSD, setOpeningInitialCashUSD] = useState('50.00');
  const [openingInitialCashBs, setOpeningInitialCashBs] = useState('0.00');
  const [openingNotes, setOpeningNotes] = useState('');

  // Advanced Cash Movement Modal State (Full Finance Form)
  const [isCashMovementModalOpen, setIsCashMovementModalOpen] = useState(false);
  const [isSubmittingMovement, setIsSubmittingMovement] = useState(false);
  const [movementType, setMovementType] = useState<'in' | 'out'>('out');
  const [movementCategory, setMovementCategory] = useState('Insumos');
  const [movementAmountUSD, setMovementAmountUSD] = useState('');
  const [movementAmountBs, setMovementAmountBs] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [movementPaymentMethod, setMovementPaymentMethod] = useState('cash');
  const [movementIsFiscal, setMovementIsFiscal] = useState(false);
  const [movementFiscalInvoice, setMovementFiscalInvoice] = useState('');
  const [movementTaxRate, setMovementTaxRate] = useState<number>(16);
  const [movementWithholdingRate, setMovementWithholdingRate] = useState<number>(0);
  const [movementSelectedClientId, setMovementSelectedClientId] = useState('');
  const [clientsList, setClientsList] = useState<any[]>([]);

  // Close Shift & Arqueo Modal State
  const [isClosingShiftModalOpen, setIsClosingShiftModalOpen] = useState(false);
  const [closingCountedCashUSD, setClosingCountedCashUSD] = useState('');
  const [closingCountedCashBs, setClosingCountedCashBs] = useState('');
  const [closingCountedTarjetaBs, setClosingCountedTarjetaBs] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [viewingShiftDetails, setViewingShiftDetails] = useState<any | null>(null);

  // Transfer / Merge Table Modal State
  const [transferSession, setTransferSession] = useState<any | null>(null);
  const [targetTableId, setTargetTableId] = useState<string>('');
  const [transferActionType, setTransferActionType] = useState<'move' | 'merge'>('move');
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

  // Execute Table Transfer / Merge Handler
  const handleExecuteTableTransfer = async () => {
    if (!transferSession || !targetTableId) return;
    const targetTable = tables.find(t => t.id === targetTableId);
    if (!targetTable) return;

    setIsTransferring(true);
    try {
      if (transferActionType === 'move') {
        await updateDoc(doc(db, 'sessions', transferSession.id), {
          tableId: targetTable.id,
          tableNumber: targetTable.number
        });
        await logAction(
          'order',
          currentUser?.name || 'Caja',
          'Movió Mesa',
          `Movió comanda de Mesa ${transferSession.tableNumber || transferSession.tableId} a Mesa ${targetTable.number}`
        );
        playSuccessSound();
        alert(`⚡ Comanda movida exitosamente a la Mesa ${targetTable.number}.`);
      } else {
        const existingTargetSession = activeSessions.find(s => s.tableId === targetTable.id && s.id !== transferSession.id);
        if (existingTargetSession) {
          const mergedAccounts = [...(existingTargetSession.accounts || []), ...(transferSession.accounts || [])];
          const newTotalAmount = (existingTargetSession.totalAmount || 0) + (transferSession.totalAmount || 0);
          
          await updateDoc(doc(db, 'sessions', existingTargetSession.id), {
            accounts: mergedAccounts,
            totalAmount: newTotalAmount
          });
          
          await deleteDoc(doc(db, 'sessions', transferSession.id));

          await logAction(
            'order',
            currentUser?.name || 'Caja',
            'Unió Mesas',
            `Unió la cuenta de Mesa ${transferSession.tableNumber || transferSession.tableId} con la Mesa ${targetTable.number}`
          );
          playSuccessSound();
          alert(`⚡ Cuentas unidas exitosamente en la Mesa ${targetTable.number}. Total consolidado: $${newTotalAmount.toFixed(2)} USD.`);
        } else {
          await updateDoc(doc(db, 'sessions', transferSession.id), {
            tableId: targetTable.id,
            tableNumber: targetTable.number
          });
          playSuccessSound();
          alert(`⚡ Comanda movida a la Mesa ${targetTable.number}.`);
        }
      }
      setTransferSession(null);
    } catch (err) {
      console.error(err);
      playErrorSound();
      alert('Error ejecutando transferencia o unión de mesas.');
    } finally {
      setIsTransferring(false);
    }
  };

  // Keyboard Shortcuts Handler (F2: Cash, F4: Pago Movil, F8: Punto, F9: Zelle, ESC: Close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setMovementPaymentMethod('cash');
        if (!isCashMovementModalOpen) setIsCashMovementModalOpen(true);
      } else if (e.key === 'F4') {
        e.preventDefault();
        setMovementPaymentMethod('pago_movil');
        if (!isCashMovementModalOpen) setIsCashMovementModalOpen(true);
      } else if (e.key === 'F8') {
        e.preventDefault();
        setMovementPaymentMethod('punto');
        if (!isCashMovementModalOpen) setIsCashMovementModalOpen(true);
      } else if (e.key === 'F9') {
        e.preventDefault();
        setMovementPaymentMethod('zelle');
        if (!isCashMovementModalOpen) setIsCashMovementModalOpen(true);
      } else if (e.key === 'Escape') {
        setIsCashMovementModalOpen(false);
        setTransferSession(null);
        setIsOpeningShiftModalOpen(false);
        setIsClosingShiftModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCashMovementModalOpen]);

  // Real-time listener for cashShifts, transactions & clients
  useEffect(() => {
    const unsubShifts = onSnapshot(collection(db, 'cashShifts'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
      setShiftsList(list);
    });

    const unsubTx = onSnapshot(collection(db, 'transactions'), (snap) => {
      setAllTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubClients = onSnapshot(collection(db, 'clients'), (snap) => {
      setClientsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubShifts();
      unsubTx();
      unsubClients();
    };
  }, []);

  const activeShift = shiftsList.find(s => s.status === 'open');

  // Calculate active shift metrics
  const activeShiftStartTime = activeShift ? new Date(activeShift.openedAt).getTime() : 0;
  
  const shiftTransactions = activeShift ? allTransactions.filter(tx => {
    const txTime = new Date(tx.timestamp || 0).getTime();
    return txTime >= activeShiftStartTime;
  }) : [];

  const shiftCompletedSessions = activeShift ? validatedSessions.filter(s => {
    const ts = s.payment?.timestamp || s.startTime;
    return ts && new Date(ts).getTime() >= activeShiftStartTime;
  }) : [];

  // Set of session IDs that already have transaction records to prevent double counting
  const recordedSessionIds = new Set(shiftTransactions.map(tx => tx.sessionId).filter(Boolean));

  // Legacy completed sessions that don't have separate transaction documents
  const unrecordedSessions = shiftCompletedSessions.filter(s => !recordedSessionIds.has(s.id));

  // Helper payment matchers supporting all variants and aliases
  const isCashMethod = (m: string) => ['efectivo', 'cash', 'efectivo_usd', 'divisa'].includes((m || '').toLowerCase());
  const isPagoMovilMethod = (m: string) => ['pago_movil', 'pagomovil'].includes((m || '').toLowerCase());
  const isZelleMethod = (m: string) => (m || '').toLowerCase() === 'zelle';
  const isTarjetaMethod = (m: string) => ['punto_de_venta', 'tarjeta', 'punto', 'tarjeta_debito', 'tarjeta_credito'].includes((m || '').toLowerCase());
  const isCreditoMethod = (m: string) => (m || '').toLowerCase() === 'credito';

  // Breakdowns by payment method during active shift
  const shiftCashUSD = shiftTransactions
    .filter(tx => isCashMethod(tx.method))
    .reduce((sum, tx) => sum + (tx.amount || 0), 0) +
    unrecordedSessions
      .filter(s => isCashMethod(s.payment?.method || s.paymentMethod))
      .reduce((sum, s) => sum + (s.totalAmount || s.pendingPayment?.totalUSD || 0), 0);

  const shiftCashBs = shiftTransactions
    .filter(tx => (tx.method || '').toLowerCase() === 'efectivo_bs')
    .reduce((sum, tx) => sum + (tx.amountBs || 0), 0);

  const shiftPagoMovilUSD = shiftTransactions
    .filter(tx => isPagoMovilMethod(tx.method))
    .reduce((sum, tx) => sum + (tx.amount || 0), 0) +
    unrecordedSessions
      .filter(s => isPagoMovilMethod(s.payment?.method || s.paymentMethod))
      .reduce((sum, s) => sum + (s.totalAmount || s.pendingPayment?.totalUSD || 0), 0);

  const shiftZelleUSD = shiftTransactions
    .filter(tx => isZelleMethod(tx.method))
    .reduce((sum, tx) => sum + (tx.amount || 0), 0) +
    unrecordedSessions
      .filter(s => isZelleMethod(s.payment?.method || s.paymentMethod))
      .reduce((sum, s) => sum + (s.totalAmount || s.pendingPayment?.totalUSD || 0), 0);

  const shiftTarjetaUSD = shiftTransactions
    .filter(tx => isTarjetaMethod(tx.method))
    .reduce((sum, tx) => sum + (tx.amount || 0), 0) +
    unrecordedSessions
      .filter(s => isTarjetaMethod(s.payment?.method || s.paymentMethod))
      .reduce((sum, s) => sum + (s.totalAmount || s.pendingPayment?.totalUSD || 0), 0);

  const shiftCreditoUSD = shiftTransactions
    .filter(tx => isCreditoMethod(tx.method))
    .reduce((sum, tx) => sum + (tx.amount || 0), 0) +
    unrecordedSessions
      .filter(s => isCreditoMethod(s.payment?.method || s.paymentMethod))
      .reduce((sum, s) => sum + (s.totalAmount || s.pendingPayment?.totalUSD || 0), 0);

  // Cash In / Cash Out movements during active shift
  const shiftCashMovements = activeShift?.cashMovements || [];
  const shiftCashInUSD = shiftCashMovements.filter((m: any) => m.type === 'in').reduce((sum: number, m: any) => sum + (Number(m.amountUSD) || 0), 0);
  const shiftCashInBs = shiftCashMovements.filter((m: any) => m.type === 'in').reduce((sum: number, m: any) => sum + (Number(m.amountBs) || 0), 0);
  const shiftCashOutUSD = shiftCashMovements.filter((m: any) => m.type === 'out').reduce((sum: number, m: any) => sum + (Number(m.amountUSD) || 0), 0);
  const shiftCashOutBs = shiftCashMovements.filter((m: any) => m.type === 'out').reduce((sum: number, m: any) => sum + (Number(m.amountBs) || 0), 0);

  // Expected totals in register
  const expectedShiftCashUSD = (Number(activeShift?.initialCashUSD) || 0) + shiftCashUSD + shiftCashInUSD - shiftCashOutUSD;
  const expectedShiftCashBs = (Number(activeShift?.initialCashBs) || 0) + shiftCashBs + shiftCashInBs - shiftCashOutBs;

  const handleOpenShift = async () => {
    if (isSubmittingShift) return;
    if (activeShift) {
      showToast('⚠️ Ya existe un turno de caja abierto actualmente.');
      return;
    }
    setIsSubmittingShift(true);
    try {
      const cashier = openingCashierName.trim() || currentUser?.name || localStorage.getItem('demo_user_name') || 'Cajero';
      await addDoc(collection(db, 'cashShifts'), {
        shiftName: openingShiftName,
        openedBy: cashier,
        openedAt: new Date().toISOString(),
        status: 'open',
        initialCashUSD: Number(openingInitialCashUSD) || 0,
        initialCashBs: Number(openingInitialCashBs) || 0,
        openingNotes: openingNotes.trim(),
        cashMovements: []
      });

      await logAction('finance', cashier, 'Apertura de Turno de Caja', `Turno: ${openingShiftName} - Fondo: $${openingInitialCashUSD}`);
      playSuccessSound();
      showToast('🟢 Turno de Caja abierto exitosamente.');
      setIsOpeningShiftModalOpen(false);
      setOpeningNotes('');
    } catch (err) {
      console.error('Error opening cash shift:', err);
      playErrorSound();
      showToast('❌ Error al abrir el turno de caja.');
    } finally {
      setIsSubmittingShift(false);
    }
  };

  const handleSaveCashMovement = async () => {
    if (isSubmittingMovement || !activeShift) return;
    const usd = Number(movementAmountUSD) || 0;
    const bs = Number(movementAmountBs) || 0;
    const totalUSD = usd > 0 ? usd : (bs > 0 ? bs / exchangeRate : 0);

    if (totalUSD <= 0) {
      alert('Por favor ingresa un monto válido mayor a 0 en USD o Bs.');
      return;
    }
    if (!movementReason.trim()) {
      alert('Por favor indica la descripción o motivo del movimiento.');
      return;
    }
    if (movementType === 'in' && movementCategory === 'Cobro de Crédito' && !movementSelectedClientId) {
      alert('Por favor selecciona el cliente de crédito que realiza el pago.');
      return;
    }

    setIsSubmittingMovement(true);
    try {
      const cashier = currentUser?.name || localStorage.getItem('demo_user_name') || 'Caja';
      const calculatedTax = movementIsFiscal ? Number((totalUSD * (movementTaxRate / (100 + movementTaxRate))).toFixed(2)) : 0;
      const calculatedWithholding = (movementType === 'out' && movementIsFiscal && movementWithholdingRate > 0)
        ? Number((totalUSD * (movementWithholdingRate / 100)).toFixed(2))
        : 0;

      const newMovement = {
        id: `mov_${Date.now()}`,
        type: movementType,
        category: movementCategory,
        amountUSD: totalUSD,
        amountBs: bs > 0 ? bs : totalUSD * exchangeRate,
        reason: movementReason.trim(),
        paymentMethod: movementPaymentMethod,
        isFiscal: movementIsFiscal,
        fiscalInvoice: movementFiscalInvoice,
        timestamp: new Date().toISOString(),
        registeredBy: cashier
      };

      const updatedMovements = [...(activeShift.cashMovements || []), newMovement];
      await updateDoc(doc(db, 'cashShifts', activeShift.id), {
        cashMovements: updatedMovements
      });

      // Post to finance_entries for full P&L, ledger, and fiscal sync
      await addDoc(collection(db, 'finance_entries'), {
        type: movementType === 'in' ? 'income' : 'expense',
        category: movementCategory,
        amount: totalUSD,
        description: `[Caja - ${activeShift.shiftName}] ${movementReason.trim()}`,
        timestamp: new Date().toISOString(),
        isFiscal: movementIsFiscal,
        fiscalInvoice: movementFiscalInvoice || '',
        taxRate: movementTaxRate,
        taxAmount: calculatedTax,
        withholdingRate: movementWithholdingRate,
        withholdingAmount: calculatedWithholding,
        paymentMethod: movementPaymentMethod,
        registeredBy: cashier,
        shiftId: activeShift.id
      });

      // Reduce debt in CRM client profile if Cobro de Crédito
      if (movementType === 'in' && movementCategory === 'Cobro de Crédito' && movementSelectedClientId) {
        const clientRef = doc(db, 'clients', movementSelectedClientId);
        const clientSnap = await getDoc(clientRef);
        if (clientSnap.exists()) {
          const currentDebt = clientSnap.data().debt || 0;
          await updateDoc(clientRef, {
            debt: Math.max(0, currentDebt - totalUSD)
          });
        }
      }

      await logAction('finance', cashier, `Movimiento de Caja (${movementType === 'in' ? 'Ingreso' : 'Egreso'})`, `USD: $${totalUSD.toFixed(2)} - Cat: ${movementCategory} - Motivo: ${movementReason}`);
      playCashSound();
      showToast(`✅ ${movementType === 'in' ? 'Ingreso' : 'Egreso'} registrado y sincronizado con Finanzas.`);
      setIsCashMovementModalOpen(false);
      setMovementAmountUSD('');
      setMovementAmountBs('');
      setMovementReason('');
      setMovementIsFiscal(false);
      setMovementFiscalInvoice('');
      setMovementSelectedClientId('');
    } catch (err) {
      console.error('Error saving cash movement:', err);
      playErrorSound();
      showToast('❌ Error al registrar movimiento.');
    } finally {
      setIsSubmittingMovement(false);
    }
  };

  const handleCloseShift = async () => {
    if (isSubmittingShift || !activeShift) return;
    setIsSubmittingShift(true);
    try {
      const cashier = currentUser?.name || localStorage.getItem('demo_user_name') || 'Caja';
      const actualUSD = Number(closingCountedCashUSD) || 0;
      const actualBs = Number(closingCountedCashBs) || 0;
      const actualTarjetaBs = Number(closingCountedTarjetaBs) || 0;

      const diffUSD = actualUSD - expectedShiftCashUSD;
      const diffBs = actualBs - expectedShiftCashBs;

      const salesSummary = {
        totalCollectedUSD: shiftCashUSD + shiftPagoMovilUSD + shiftZelleUSD + shiftTarjetaUSD + shiftCreditoUSD,
        cashUSD: shiftCashUSD,
        cashBs: shiftCashBs,
        pagoMovilUSD: shiftPagoMovilUSD,
        zelleUSD: shiftZelleUSD,
        tarjetaUSD: shiftTarjetaUSD,
        creditoUSD: shiftCreditoUSD,
        totalOrdersCount: shiftCompletedSessions.length
      };

      const closedData = {
        status: 'closed',
        closedBy: cashier,
        closedAt: new Date().toISOString(),
        closingNotes: closingNotes.trim(),
        expectedCashUSD: expectedShiftCashUSD,
        expectedCashBs: expectedShiftCashBs,
        actualCashUSD: actualUSD,
        actualCashBs: actualBs,
        actualTarjetaBs: actualTarjetaBs,
        differenceUSD: diffUSD,
        differenceBs: diffBs,
        salesSummary
      };

      await updateDoc(doc(db, 'cashShifts', activeShift.id), closedData);

      await logAction('finance', cashier, 'Cierre y Arqueo de Turno de Caja', `Turno: ${activeShift.shiftName} - Dif USD: $${diffUSD.toFixed(2)}`);
      playCashSound();
      showToast('🔒 Turno de Caja cerrado y arqueado correctamente.');
      setIsClosingShiftModalOpen(false);
      setViewingShiftDetails({ id: activeShift.id, ...activeShift, ...closedData });
    } catch (err) {
      console.error('Error closing shift:', err);
      playErrorSound();
      showToast('❌ Error al cerrar el turno.');
    } finally {
      setIsSubmittingShift(false);
    }
  };

  const [viewingDeliveryOrder, setViewingDeliveryOrder] = useState<any | null>(null);
  const [deliveryOrders, setDeliveryOrders] = useState<any[]>([]);

  const [viewingCompletedSession, setViewingCompletedSession] = useState<any | null>(null);
  const [completedSessionOrders, setCompletedSessionOrders] = useState<any[]>([]);
  const [isLoadingCompletedOrders, setIsLoadingCompletedOrders] = useState(false);

  // Listen for global search selection
  useEffect(() => {
    const handleOpenCajaSession = (e: any) => {
      if (e.detail?.session) {
        const sess = e.detail.session;
        if (sess.deliveryType || sess.type === 'delivery' || sess.type === 'pickup' || sess.customerName) {
          setActiveTab('delivery_pickup');
          setViewingDeliveryOrder(sess);
        } else if (sess.paymentStatus === 'pending_validation') {
          setActiveTab('validation');
          setConfirmingSession({ session: sess, type: 'approve' });
        } else {
          setActiveTab('tables');
          if (sess.tableId) {
            setViewingDeliveryOrder(sess);
          }
        }
      } else if (e.detail?.tab) {
        setActiveTab(e.detail.tab);
      }
    };
    const handleSetCajaTab = (e: any) => {
      if (e.detail) {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener('open_caja_session', handleOpenCajaSession);
    window.addEventListener('set_caja_tab', handleSetCajaTab);
    return () => {
      window.removeEventListener('open_caja_session', handleOpenCajaSession);
      window.removeEventListener('set_caja_tab', handleSetCajaTab);
    };
  }, []);

  useEffect(() => {
    if (!viewingCompletedSession) {
      setCompletedSessionOrders([]);
      return;
    }

    const fetchCompletedOrders = async () => {
      setIsLoadingCompletedOrders(true);
      try {
        const accountsList = viewingCompletedSession.accounts || [{ id: 'default', name: 'Única' }];
        const allOrders: any[] = [];
        
        for (const acc of accountsList) {
          const ordersRef = collection(db, 'sessions', viewingCompletedSession.id, 'accounts', acc.id, 'orders');
          const snap = await getDocs(ordersRef);
          snap.forEach(docSnap => {
            allOrders.push({
              id: docSnap.id,
              accountId: acc.id,
              accountName: acc.name,
              ...docSnap.data()
            });
          });
        }
        
        setCompletedSessionOrders(allOrders);
      } catch (err) {
        console.error('Error fetching completed session orders:', err);
      } finally {
        setIsLoadingCompletedOrders(false);
      }
    };

    fetchCompletedOrders();
  }, [viewingCompletedSession]);

  useEffect(() => {
    if (!viewingDeliveryOrder) {
      setDeliveryOrders([]);
      return;
    }
    const unsub = onSnapshot(
      collection(db, 'sessions', viewingDeliveryOrder.id, 'accounts', 'default', 'orders'),
      (snap) => {
        setDeliveryOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );
    return () => unsub();
  }, [viewingDeliveryOrder]);
  
  // Image viewer modal state
  const [viewingReceiptImage, setViewingReceiptImage] = useState<string | null>(null);

  // Stats
  const totalReconciled = validatedSessions.reduce((acc, s) => {
    const isCredit = s.payment?.method === 'credito' || s.paymentMethod === 'credito';
    if (isCredit) return acc;
    return acc + (s.totalAmount || s.pendingPayment?.totalUSD || 0);
  }, 0);

  const totalOpenBalanceUSD = activeSessions.reduce((acc, s) => {
    return acc + (s.totalAmount || 0);
  }, 0);

  // Real-time listener for ALL active sessions
  useEffect(() => {
    const q = query(
      collection(db, 'sessions'), 
      where('status', '==', 'active')
    );

    const unsub = onSnapshot(q, (snap) => {
      const allActive = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setActiveSessions(allActive);
      setIsLoading(false);
    }, (err) => {
      console.error('Error fetching sessions in CajaView:', err);
      setIsLoading(false);
    });

    // Also get validated/completed sessions to list recent ones
    const qComp = query(
      collection(db, 'sessions'),
      where('status', '==', 'completed')
    );
    const unsubComp = onSnapshot(qComp, (snap) => {
      const todayString = new Date().toDateString();
      const allCompleted = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const todayCompleted = allCompleted.filter((s: any) => {
        const ts = s.payment?.timestamp || s.startTime;
        if (!ts) return false;
        return new Date(ts).toDateString() === todayString;
      });
      setValidatedSessions(todayCompleted);
    });

    return () => {
      unsub();
      unsubComp();
    };
  }, []);

  // Filter lists based on states
  const pendingSessions = activeSessions.filter(
    s => s.paymentStatus === 'pending_validation' && (s.pendingPayment || s.paymentReceiptImage || s.paymentReference)
  );
  
  const creditSessions = activeSessions.filter(
    s => s.paymentStatus === 'pending_credit_approval'
  );

  const dineInSessions = activeSessions.filter(
    s => s.paymentStatus !== 'pending_validation' && s.paymentStatus !== 'pending_credit_approval' && s.tableId !== 'delivery' && s.type !== 'delivery' && !s.tableId?.startsWith('delivery')
  );

  const deliveryPickupSessions = activeSessions.filter(
    s => s.paymentStatus !== 'pending_validation' && s.paymentStatus !== 'pending_credit_approval' && (s.tableId === 'delivery' || s.type === 'delivery' || s.tableId?.startsWith('delivery'))
  );

  const [confirmingSession, setConfirmingSession] = useState<{
    session: any;
    type: 'approve' | 'reject';
  } | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

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
          notes: 'Registrado automáticamente desde aprobación de crédito',
          createdAt: new Date().toISOString()
        });
        return newDocRef.id;
      }
    } catch (err) {
      console.error('Error updating client debt in CRM:', err);
      return null;
    }
  };

  const executeApprovePayment = async (session: any) => {
    if (!activeShift) {
      playErrorSound();
      showToast('⚠️ Operación bloqueada: Es obligatorio abrir un turno de caja antes de validar pagos.');
      setIsOpeningShiftModalOpen(true);
      return;
    }

    setIsProcessing(true);
    try {
      const isDelivery = session.type === 'delivery' || session.tableId === 'delivery';
      
      const accounts = session.accounts || [{ id: 'default', name: 'Cuenta 1', status: 'active' }];
      const accountId = session.pendingPayment?.accountId || 'default';
      const paymentMethod = session.pendingPayment?.method || session.paymentMethod || 'pago_movil';
      const paymentRef = session.pendingPayment?.reference || session.paymentReference || 'N/A';
      const totalAmount = session.pendingPayment?.totalUSD || session.totalAmount || 0;
      const receiptImage = session.pendingPayment?.receiptImage || session.paymentReceiptImage || null;

      const updatedAccounts = accounts.map((acc: any) => acc.id === accountId ? { ...acc, status: 'paid' } : acc);
      const allPaid = updatedAccounts.every((acc: any) => acc.status === 'paid');

      // Write audit log
      const reviewerName = currentUser?.name || localStorage.getItem('demo_user_name') || 'Caja';
      const payerName = session.pendingPayment?.creditClient?.nombre || session.customerName || 'Cliente';
      const tableLabel = isDelivery ? 'Delivery' : `Mesa ${session.tableId}`;
      const actionType = paymentMethod === 'credito' ? 'Aprobó crédito' : 'Validó pago';
      await logAction(
        'finance',
        reviewerName,
        `${actionType} (${tableLabel})`,
        `Turno: ${activeShift.shiftName} - Cliente: ${payerName} - Total: $${totalAmount.toFixed(2)} - Método: ${paymentMethod.toUpperCase()}`
      );

      // Record transaction
      const mixedPayments = session.pendingPayment?.mixedPayments;
      if (paymentMethod === 'mixto' && mixedPayments) {
        for (const mp of mixedPayments) {
          await addDoc(collection(db, 'transactions'), {
            sessionId: session.id,
            accountId: accountId,
            shiftId: activeShift.id,
            shiftName: activeShift.shiftName,
            amount: mp.amountUSD,
            amountCents: Math.round(mp.amountUSD * 100),
            method: mp.method,
            reference: mp.reference || null,
            timestamp: new Date().toISOString(),
            approvedBy: 'Caja'
          });
        }
      } else {
        await addDoc(collection(db, 'transactions'), {
          sessionId: session.id,
          accountId: accountId,
          shiftId: activeShift.id,
          shiftName: activeShift.shiftName,
          amount: totalAmount,
          amountCents: Math.round(totalAmount * 100),
          method: paymentMethod,
          timestamp: new Date().toISOString(),
          approvedBy: 'Caja'
        });
      }

      const creditClientData = session.pendingPayment?.creditClient || session.creditClient;
      let resolvedClientId = creditClientData?.clientId || session.pendingPayment?.client?.clientId || null;
      if (paymentMethod === 'credito' && creditClientData) {
        const resId = await processClientCreditDebt(creditClientData, totalAmount);
        if (resId) {
          resolvedClientId = resId;
        }
      }

      if (isDelivery) {
        // For delivery/pickup orders, validating payment leaves session active so it enters Kitchen KDS & Delivery/Pickup tab in Caja
        await updateDoc(doc(db, 'sessions', session.id), {
          status: 'active',
          paymentStatus: 'validated',
          accounts: updatedAccounts,
          customerPhone: session.pendingPayment?.creditClient?.tlf || session.pendingPayment?.client?.tlf || session.customerPhone || '',
          customerName: session.pendingPayment?.creditClient?.nombre || session.pendingPayment?.client?.nombre || session.customerName || 'Cliente',
          totalAmount: totalAmount,
          payment: {
            method: paymentMethod,
            reference: paymentRef,
            currency: session.pendingPayment?.currency || 'USD',
            totalUSD: session.totalAmount || totalAmount,
            totalBs: (session.totalAmount || totalAmount) * exchangeRate,
            timestamp: new Date().toISOString(),
            receiptImage: receiptImage,
            mixedPayments: mixedPayments || null,
            creditClient: session.pendingPayment?.creditClient ? {
              ...session.pendingPayment.creditClient,
              clientId: resolvedClientId
            } : null
          },
          pendingPayment: null
        });
      } else if (allPaid) {
        // Complete the entire session for dine-in tables
        await updateDoc(doc(db, 'sessions', session.id), {
          status: 'completed',
          paymentStatus: 'validated',
          accounts: updatedAccounts,
          customerPhone: session.pendingPayment?.creditClient?.tlf || session.pendingPayment?.client?.tlf || session.customerPhone || '',
          customerName: session.pendingPayment?.creditClient?.nombre || session.pendingPayment?.client?.nombre || session.customerName || 'Cliente',
          totalAmount: totalAmount,
          payment: {
            method: paymentMethod,
            reference: paymentRef,
            currency: session.pendingPayment?.currency || 'USD',
            totalUSD: session.totalAmount || totalAmount,
            totalBs: (session.totalAmount || totalAmount) * exchangeRate,
            timestamp: new Date().toISOString(),
            receiptImage: receiptImage,
            mixedPayments: mixedPayments || null,
            creditClient: session.pendingPayment?.creditClient ? {
              ...session.pendingPayment.creditClient,
              clientId: resolvedClientId
            } : null
          },
          pendingPayment: null
        });

        // Free table if dine-in
        if (session.tableId && session.tableId !== 'delivery' && !session.tableId?.startsWith('delivery')) {
          await updateDoc(doc(db, 'tables', session.tableId), { status: 'free' });
        }
      } else {
        // Splitting bills, some accounts still active
        await updateDoc(doc(db, 'sessions', session.id), {
          accounts: updatedAccounts,
          paymentStatus: null, // cleared for next billing action
          pendingPayment: null
        });

        if (session.tableId && session.tableId !== 'delivery' && !session.tableId?.startsWith('delivery')) {
          await updateDoc(doc(db, 'tables', session.tableId), { status: 'occupied' });
        }
      }

      // If it is a delivery/pickup session, push orders to kitchen (enviado if direct_print, pending if KDS)
      if (isDelivery) {
        const isDirectPrint = (settings as any)?.kitchenMode === 'direct_print';
        const targetStatus = isDirectPrint ? 'enviado' : 'pending';
        const ordersRef = collection(db, 'sessions', session.id, 'accounts', 'default', 'orders');
        const orderSnaps = await getDocs(ordersRef);
        const promises = orderSnaps.docs.map(orderDoc => {
          return updateDoc(doc(db, 'sessions', session.id, 'accounts', 'default', 'orders', orderDoc.id), {
            status: targetStatus
          });
        });
        await Promise.all(promises);

        // Auto-print thermal kitchen ticket if direct print mode or autoPrint is active
        if (isDirectPrint || (settings as any)?.autoPrintKitchenTicket !== false) {
          const itemsToPrint = orderSnaps.docs.map(d => {
            const data = d.data();
            return {
              itemName: data.name || data.itemName || 'Platillo',
              quantity: data.quantity || 1,
              note: data.notes || data.note || '',
              excludedIngredients: data.excludedIngredients || [],
              extras: data.extras || []
            };
          });
          if (itemsToPrint.length > 0) {
            printKitchenTicket({
              tableName: `DELIVERY/LLEVAR: ${session.customerName || 'Cliente'}`,
              waiterName: currentUser?.name || localStorage.getItem('demo_user_name') || 'Caja',
              timestamp: new Date().toISOString(),
              items: itemsToPrint,
              paperWidth: (settings as any)?.kitchenPaperWidth || '80mm',
              restaurantName: (settings as any)?.restaurantName || 'BISTROFLOW'
            });
          }
        }
      }

      setConfirmingSession(null);
      playCashSound();
      showToast('✅ Pago validado con éxito. Transacción guardada.');
    } catch (err) {
      console.error('Error validating payment:', err);
      playErrorSound();
      showToast('❌ Error al validar el pago.');
    } finally {
      setIsProcessing(false);
    }
  };

  const executeRejectPayment = async (session: any) => {
    setIsProcessing(true);
    try {
      const isDelivery = session.type === 'delivery' || session.tableId === 'delivery';

      // Write audit log
      const reviewerName = currentUser?.name || localStorage.getItem('demo_user_name') || 'Caja';
      const payerName = session.customerName || 'Cliente';
      const tableLabel = isDelivery ? 'Delivery' : `Mesa ${session.tableId}`;
      const reasonStr = rejectionReasonInput || 'Pago rechazado por caja';
      const totalAmount = session.pendingPayment?.totalUSD || session.totalAmount || 0;
      await logAction(
        'finance',
        reviewerName,
        `Rechazó pago (${tableLabel})`,
        `Cliente: ${payerName} - Total: $${totalAmount.toFixed(2)} - Razón: ${reasonStr}`
      );

      if (isDelivery) {
        await updateDoc(doc(db, 'sessions', session.id), {
          paymentStatus: 'rejected',
          status: 'completed', // Closes the session
          rejectionReason: rejectionReasonInput || 'Pago no verificado'
        });

        const accountId = 'default';
        const ordersRef = collection(db, 'sessions', session.id, 'accounts', accountId, 'orders');
        const orderSnaps = await getDocs(ordersRef);

        const promises = orderSnaps.docs.map(orderDoc => {
          return updateDoc(doc(db, 'sessions', session.id, 'accounts', accountId, 'orders', orderDoc.id), {
            status: 'rejected'
          });
        });

        await Promise.all(promises);
      } else {
        // Dine-in: just clear the pending payment and restore occupied status
        await updateDoc(doc(db, 'sessions', session.id), {
          paymentStatus: null,
          pendingPayment: null,
          rejectionReason: rejectionReasonInput || 'Pago rechazado por caja'
        });

        if (session.tableId && session.tableId !== 'delivery') {
          await updateDoc(doc(db, 'tables', session.tableId), { status: 'occupied' });
        }
      }

      setConfirmingSession(null);
      setRejectionReasonInput('');
      playErrorSound();
      showToast('❌ Pago rechazado y notificado.');
    } catch (err) {
      console.error('Error rejecting payment:', err);
      playErrorSound();
      showToast('❌ Error al rechazar el pago.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="relative w-full flex-1 flex flex-col space-y-6 pb-16 min-h-full">
      <header className="mb-6 border-b border-slate-200/60 pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:pr-40">
        <div>
          <span className="text-[10px] uppercase tracking-widest font-black text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100 inline-block mb-1.5">
            Módulo de Punto de Venta & Facturación
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">Control de Caja</h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Cajero(a) activo: <strong className="text-indigo-600 font-extrabold">{currentUser?.name || localStorage.getItem('demo_user_name') || 'Caja'}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {onViewChange && (
            <button
              onClick={() => onViewChange('waiter')}
              className="bg-slate-900 hover:bg-black text-white px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <ShoppingBag size={15} className="text-amber-400" />
              <span>Terminal POS / Venta</span>
            </button>
          )}
          <div className="bg-amber-50 text-amber-800 border border-amber-200/80 px-3.5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse"></span>
            <span>Recepción Activa</span>
          </div>
        </div>
      </header>

      {/* SHIFT STATUS BANNER */}
      <div className="mb-8">
        {activeShift ? (
          <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-black text-white p-6 rounded-[28px] shadow-xl border border-emerald-800/40 relative overflow-hidden">
            <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-8">
              <ShieldCheck size={160} />
            </div>
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                    Turno Activo: {activeShift.shiftName}
                  </span>
                  <span className="text-xs text-slate-300 font-bold bg-white/10 px-2.5 py-1 rounded-full">
                    👤 Cajero: {activeShift.openedBy}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    Inició: {new Date(activeShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-baseline gap-4 pt-1 flex-wrap">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Fondo Inicial ($ / Bs)</span>
                    <span className="text-xl font-black text-white">
                      ${(Number(activeShift.initialCashUSD) || 0).toFixed(2)}
                      <span className="text-xs text-emerald-400 font-bold ml-1.5">
                        (Bs. {(Number(activeShift.initialCashBs) || 0).toFixed(2)})
                      </span>
                    </span>
                  </div>
                  <div className="border-l border-white/10 pl-4">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Efectivo Esperado en Caja</span>
                    <span className="text-xl font-black text-emerald-400">
                      ${expectedShiftCashUSD.toFixed(2)}
                      <span className="text-xs text-slate-300 font-bold ml-1.5">
                        (Bs. {expectedShiftCashBs.toFixed(2)})
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5 w-full md:w-auto shrink-0">
                <button
                  onClick={() => setIsCashMovementModalOpen(true)}
                  className="flex-1 md:flex-none px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-white/10 transition-all cursor-pointer"
                >
                  <PlusCircle size={15} className="text-emerald-400" />
                  <span>Entrada / Salida</span>
                </button>
                <button
                  onClick={() => {
                    setClosingCountedCashUSD(expectedShiftCashUSD > 0 ? expectedShiftCashUSD.toFixed(2) : '0.00');
                    setClosingCountedCashBs(expectedShiftCashBs > 0 ? expectedShiftCashBs.toFixed(2) : '0.00');
                    setClosingCountedTarjetaBs('');
                    setIsClosingShiftModalOpen(true);
                  }}
                  className="flex-1 md:flex-none px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  <Lock size={15} />
                  <span>Cierre & Arqueo Z</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-900/5 border border-amber-300/60 p-6 rounded-[28px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-md">
                <Unlock size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                    Caja Cerrada
                  </span>
                  <span className="text-xs text-slate-500 font-bold">Sin turno activo</span>
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-1">Apertura de Turno Requerida</h3>
                <p className="text-xs text-slate-500">
                  Abre el turno de caja para registrar el fondo inicial de efectivo y consolidar las ventas del turno.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpeningShiftModalOpen(true)}
              className="w-full sm:w-auto px-6 py-3.5 bg-slate-900 hover:bg-black text-white font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shrink-0 transition-all cursor-pointer"
            >
              <Key size={16} className="text-amber-400" />
              <span>Abrir Turno de Caja</span>
            </button>
          </div>
        )}
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold block">
                Total Conciliado Hoy
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {formatPrice(totalReconciled)}
            </div>
          </div>
          <div className="text-xs text-slate-500 font-medium mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span>Pagos procesados y validados</span>
            <span className="text-emerald-600 font-bold">✓ Al día</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold block">
                Por Validar (Digitales)
              </span>
              {pendingSessions.length > 0 && (
                <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-ping" />
              )}
            </div>
            <div className="text-2xl sm:text-3xl font-black text-indigo-600 tracking-tight flex items-center gap-2">
              {pendingSessions.length}
              <span className="text-xs text-slate-400 font-bold">transacciones</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100 font-medium">
            Pago Móvil / Zelle / Punto esperando confirmación.
          </p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold block">
                Por Cobrar (Sala / Delivery)
              </span>
              <span className="text-[10px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">
                {dineInSessions.length + deliveryPickupSessions.length} cuentas
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              ${totalOpenBalanceUSD.toFixed(2)}
            </div>
          </div>
          <div className="text-xs text-slate-500 font-medium mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span>Cuentas abiertas en atención</span>
            <span className="text-amber-600 font-bold">En consumo</span>
          </div>
        </div>
      </div>

      {/* Mandatory Cash Shift Opening Banner */}
      {!activeShift && (
        <div className="mb-8 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-rose-500/10 border-2 border-amber-500/30 rounded-[28px] p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
              <Lock size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-black text-slate-950">CAJA CERRADA — Apertura de Turno Requerida</h4>
                <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-2.5 py-0.5 rounded-full uppercase tracking-wider">Facturación Bloqueada</span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Por normativa de arqueo y trazabilidad contable, es <strong>obligatorio aperturar un turno de caja</strong> antes de tomar comandas, validar pagos o cerrar cuentas.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpeningShiftModalOpen(true)}
            className="shrink-0 bg-black hover:bg-slate-800 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all hover:scale-105 cursor-pointer"
          >
            <Key size={16} className="text-amber-400" />
            <span>Abrir Turno de Caja Ahora</span>
          </button>
        </div>
      )}

      {/* Navigation tabs - Standalone Roomy Tab Buttons */}
      <div className="flex items-center gap-3 mb-6 overflow-x-auto whitespace-nowrap w-full scrollbar-none pb-1 shrink-0">
        <button 
          onClick={() => setActiveTab('validation')}
          className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2.5 cursor-pointer shrink-0 ${
            activeTab === 'validation'
              ? 'bg-slate-950 text-white shadow-md scale-[1.01]'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80 shadow-xs'
          }`}
        >
          <ShieldCheck size={16} className={activeTab === 'validation' ? 'text-indigo-400' : 'text-slate-400'} />
          <span>Validación de Pagos</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeTab === 'validation' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-slate-100 text-slate-700'
          }`}>
            {pendingSessions.length}
          </span>
        </button>

        <button 
          onClick={() => setActiveTab('tables')}
          className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2.5 cursor-pointer shrink-0 ${
            activeTab === 'tables'
              ? 'bg-slate-950 text-white shadow-md scale-[1.01]'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80 shadow-xs'
          }`}
        >
          <Receipt size={16} className={activeTab === 'tables' ? 'text-indigo-400' : 'text-slate-400'} />
          <span>Mesas & Cuentas de Sala</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeTab === 'tables' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-slate-100 text-slate-700'
          }`}>
            {dineInSessions.length}
          </span>
        </button>

        <button 
          onClick={() => setActiveTab('delivery_pickup')}
          className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2.5 cursor-pointer shrink-0 ${
            activeTab === 'delivery_pickup'
              ? 'bg-slate-950 text-white shadow-md scale-[1.01]'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80 shadow-xs'
          }`}
        >
          <ShoppingBag size={16} className={activeTab === 'delivery_pickup' ? 'text-amber-400' : 'text-slate-400'} />
          <span>Delivery & Pickup</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeTab === 'delivery_pickup' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-100 text-slate-700'
          }`}>
            {deliveryPickupSessions.length}
          </span>
        </button>

        <button 
          onClick={() => setActiveTab('credits')}
          className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2.5 cursor-pointer shrink-0 ${
            activeTab === 'credits'
              ? 'bg-slate-950 text-white shadow-md scale-[1.01]'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80 shadow-xs'
          }`}
        >
          <CreditCard size={16} className={activeTab === 'credits' ? 'text-rose-400' : 'text-slate-400'} />
          <span>Aprobación de Créditos (CxC)</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeTab === 'credits' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-slate-100 text-slate-700'
          }`}>
            {creditSessions.length}
          </span>
        </button>

        <button 
          onClick={() => setActiveTab('shifts')}
          className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2.5 cursor-pointer shrink-0 ${
            activeTab === 'shifts'
              ? 'bg-slate-950 text-white shadow-md scale-[1.01]'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80 shadow-xs'
          }`}
        >
          <Lock size={16} className={activeTab === 'shifts' ? 'text-emerald-400' : 'text-slate-400'} />
          <span>Turnos & Arqueo Z</span>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
            activeShift ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-100 text-slate-700'
          }`}>
            {activeShift ? '🟢 Abierto' : '🔒 Cerrado'}
          </span>
        </button>
      </div>

      {/* TAB RENDERS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* Left column / core list depending on tab */}
        <div className="lg:col-span-2 space-y-6">
          
          {activeTab === 'shifts' && (
            <div className="space-y-8">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Receipt className="text-amber-600" size={20} />
                  <span>Gestión de Turnos y Arqueos Z</span>
                </h3>
                {!activeShift ? (
                  <button
                    onClick={() => setIsOpeningShiftModalOpen(true)}
                    className="bg-black hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all"
                  >
                    <Key size={14} className="text-amber-400" />
                    <span>Abrir Nuevo Turno</span>
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsCashMovementModalOpen(true)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-200"
                    >
                      <PlusCircle size={14} className="text-emerald-600" />
                      <span>Movimiento Efectivo</span>
                    </button>
                    <button
                      onClick={() => {
                        setClosingCountedCashUSD(expectedShiftCashUSD > 0 ? expectedShiftCashUSD.toFixed(2) : '0.00');
                        setClosingCountedCashBs(expectedShiftCashBs > 0 ? expectedShiftCashBs.toFixed(2) : '0.00');
                        setClosingCountedTarjetaBs('');
                        setIsClosingShiftModalOpen(true);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all"
                    >
                      <Lock size={14} />
                      <span>Cierre Z</span>
                    </button>
                  </div>
                )}
              </div>

              {/* ACTIVE SHIFT LIVE CARD */}
              {activeShift ? (
                <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm space-y-6">
                  <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                        <span className="font-black text-lg text-slate-900">{activeShift.shiftName}</span>
                        <span className="text-xs bg-emerald-50 text-emerald-700 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          Turno en Curso
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Apertura: {new Date(activeShift.openedAt).toLocaleString()} • Responsable: <strong className="text-slate-700">{activeShift.openedBy}</strong>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Fondo Inicial</span>
                      <span className="text-sm font-black text-slate-900">${(Number(activeShift.initialCashUSD) || 0).toFixed(2)} USD</span>
                      <span className="text-xs text-rose-600 font-bold block">Bs. {(Number(activeShift.initialCashBs) || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Breakdown grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">💵 Efectivo USD / Bs</span>
                      <span className="text-base font-black text-slate-900">${shiftCashUSD.toFixed(2)}</span>
                      <span className="text-[10px] font-bold text-rose-600 block">Bs. {shiftCashBs.toFixed(2)}</span>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">📱 Pago Móvil</span>
                      <span className="text-base font-black text-slate-900">${shiftPagoMovilUSD.toFixed(2)}</span>
                      <span className="text-[10px] font-bold text-slate-500 block">Bs. {(shiftPagoMovilUSD * exchangeRate).toFixed(2)}</span>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">📧 Zelle</span>
                      <span className="text-base font-black text-slate-900">${shiftZelleUSD.toFixed(2)}</span>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">💳 Punto de Venta</span>
                      <span className="text-base font-black text-slate-900">${shiftTarjetaUSD.toFixed(2)}</span>
                      <span className="text-[10px] font-bold text-slate-500 block">Bs. {(shiftTarjetaUSD * exchangeRate).toFixed(2)}</span>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">📜 Créditos por Cobrar</span>
                      <span className="text-base font-black text-amber-700">${shiftCreditoUSD.toFixed(2)}</span>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase block">📦 Pedidos Cobrados</span>
                      <span className="text-base font-black text-emerald-900">{shiftCompletedSessions.length} pedidos</span>
                    </div>
                  </div>

                  {/* Cash movements section */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Calculator size={14} className="text-slate-400" />
                        <span>Movimientos de Caja Chica ({shiftCashMovements.length})</span>
                      </span>
                      <button
                        onClick={() => setIsCashMovementModalOpen(true)}
                        className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                      >
                        <PlusCircle size={12} />
                        <span>Registrar Retiro / Ingreso</span>
                      </button>
                    </div>

                    {shiftCashMovements.length === 0 ? (
                      <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                        No se han registrado entradas ni salidas de efectivo en este turno.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-thin pr-1">
                        {shiftCashMovements.map((m: any, idx: number) => (
                          <div key={m.id || idx} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${m.type === 'in' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                              <span className="font-bold text-slate-800">{m.reason}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                ({new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                              </span>
                            </div>
                            <div className="font-bold font-mono">
                              {m.type === 'in' ? '+' : '-'}${Number(m.amountUSD || 0).toFixed(2)} USD
                              {m.amountBs > 0 && <span className="text-[10px] text-slate-400 ml-1">(Bs. {m.amountBs})</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-[32px] p-8 text-center border border-dashed border-slate-200">
                  <Unlock size={36} className="mx-auto text-amber-500 mb-3" />
                  <h4 className="font-black text-slate-800 text-base">Caja Cerrada</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    No hay ningún turno abierto en este momento. Presiona "Abrir Nuevo Turno" para iniciar operaciones.
                  </p>
                </div>
              )}

              {/* CLOSED SHIFTS HISTORY */}
              <div className="space-y-4 pt-4">
                <h4 className="font-black text-slate-900 text-sm flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="flex items-center gap-2">
                    <Archive size={16} className="text-slate-400" />
                    Histórico de Cierres de Turno (Reportes Z)
                  </span>
                  <span className="text-xs font-bold text-slate-400">{shiftsList.filter(s => s.status === 'closed').length} cierres</span>
                </h4>

                {shiftsList.filter(s => s.status === 'closed').length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 italic bg-white rounded-2xl border border-slate-100 p-6">
                    Aún no hay cierres de turno registrados.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {shiftsList.filter(s => s.status === 'closed').map((s: any) => {
                      const diffUSD = Number(s.differenceUSD) || 0;
                      const isExact = Math.abs(diffUSD) < 0.01;
                      const isSurplus = diffUSD > 0.01;
                      return (
                        <div key={s.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-slate-200 transition-all">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-slate-900 text-sm">{s.shiftName}</span>
                              <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">
                                Cajero: {s.closedBy || s.openedBy}
                              </span>
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                isExact ? 'bg-emerald-50 text-emerald-700' : isSurplus ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700'
                              }`}>
                                {isExact ? '✨ Cuadrado' : isSurplus ? `🟢 Sobrante +$${diffUSD.toFixed(2)}` : `🔴 Faltante -$${Math.abs(diffUSD).toFixed(2)}`}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 font-medium">
                              {new Date(s.openedAt).toLocaleDateString()} ({new Date(s.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(s.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                            </p>
                          </div>

                          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 uppercase font-bold block">Consolidado Total</span>
                              <span className="text-sm font-black text-slate-900">${(s.salesSummary?.totalCollectedUSD || 0).toFixed(2)}</span>
                            </div>
                            <button
                              onClick={() => setViewingShiftDetails(s)}
                              className="px-3.5 py-2 bg-slate-100 hover:bg-black hover:text-white text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0"
                            >
                              <Eye size={14} />
                              <span>Ver Reporte Z</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {activeTab === 'validation' && (
            <>
              <h3 className="font-bold text-lg flex items-center gap-2 border-b border-slate-100 pb-3">
                <span>Transacciones por Verificar</span>
                <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-2.5 py-0.5 rounded-full">
                  {pendingSessions.length} pendientes
                </span>
              </h3>

              {isLoading ? (
                <div className="flex justify-center py-20">
                  <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin" />
                </div>
              ) : pendingSessions.length === 0 ? (
                <div className="bg-white rounded-[32px] p-12 text-center border border-slate-100 shadow-sm">
                  <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-4" />
                  <p className="font-bold text-lg text-slate-800">Caja Cuadrada & Al Día</p>
                  <p className="text-slate-400 text-sm mt-1">No hay pagos pendientes de validación digital en este momento.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <AnimatePresence>
                    {pendingSessions.map(session => (
                      <PendingPaymentCard 
                        key={session.id} 
                        session={session} 
                        exchangeRate={exchangeRate}
                        onShowReceipt={(src) => setViewingReceiptImage(src)}
                        onApprove={() => setConfirmingSession({ session, type: 'approve' })}
                        onReject={() => {
                          setConfirmingSession({ session, type: 'reject' });
                          setRejectionReasonInput('');
                        }}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </>
          )}

          {activeTab === 'tables' && (
            <>
              <h3 className="font-bold text-lg flex items-center gap-2 border-b border-slate-100 pb-3">
                <span>Distribución de Mesas Activas</span>
                <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full">
                  {dineInSessions.length} mesas abiertas
                </span>
              </h3>

              {dineInSessions.length === 0 ? (
                <div className="bg-white rounded-[32px] p-12 text-center border border-slate-100 shadow-sm">
                  <Inbox size={48} className="mx-auto text-slate-300 mb-4" />
                  <p className="font-bold text-lg text-slate-800">Sala Vacía</p>
                  <p className="text-slate-400 text-sm mt-1">No hay mesas o cuentas activas en la sala actualmente.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {dineInSessions.map(session => (
                    <CajaTableSessionCard 
                      key={session.id} 
                      session={session} 
                      tables={tables} 
                      exchangeRate={exchangeRate} 
                      onViewDelivery={(s) => setViewingDeliveryOrder(s)}
                      onOpenTransfer={(s) => {
                        setTransferSession(s);
                        setTargetTableId('');
                        setTransferActionType('move');
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'credits' && (
            <>
              <h3 className="font-bold text-lg flex items-center gap-2 border-b border-slate-100 pb-3">
                <span>Solicitudes de Crédito Pendientes</span>
                <span className="text-xs font-bold bg-rose-50 text-rose-600 px-2.5 py-0.5 rounded-full">
                  {creditSessions.length} esperando firma
                </span>
              </h3>

              {(settings as any)?.allowCashierCreditApproval === false && (
                <div className="bg-amber-50 border border-amber-200/90 p-4 rounded-2xl flex items-start gap-3 text-amber-900 text-xs shadow-xs">
                  <Lock size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-extrabold block text-amber-950">Aprobación por Cajero Desactivada en Ajustes</span>
                    <p className="text-amber-800 leading-snug">
                      La validación de crédito por el cajero está actualmente <strong className="text-amber-950">desactivada</strong>. Las solicitudes solo pueden ser aprobadas por un Administrador. Puedes cambiar este comportamiento en <em>Ajustes &gt; Operaciones &amp; KDS</em>.
                    </p>
                  </div>
                </div>
              )}

              {creditSessions.length === 0 ? (
                <div className="bg-white rounded-[32px] p-12 text-center border border-slate-100 shadow-sm">
                  <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-4" />
                  <p className="font-bold text-lg text-slate-800">Cero Créditos Pendientes</p>
                  <p className="text-slate-400 text-sm mt-1">No hay solicitudes de financiamiento esperando por aprobación.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <AnimatePresence>
                    {creditSessions.map(session => (
                      <CreditApprovalCard 
                        key={session.id} 
                        session={session} 
                        exchangeRate={exchangeRate}
                        currentUser={currentUser}
                        onApprove={() => setConfirmingSession({ session, type: 'approve' })}
                        onReject={() => {
                          setConfirmingSession({ session, type: 'reject' });
                          setRejectionReasonInput('');
                        }}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </>
          )}

        </div>

        {/* Right column (recent logs) */}
        <div className="space-y-6">
          <h3 className="font-bold text-lg border-b border-slate-100 pb-3 text-slate-800">
            Últimas Conciliadas (Hoy)
          </h3>

          {validatedSessions.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4">No se han cerrado transacciones hoy.</p>
          ) : (
            <div className="space-y-4">
              {validatedSessions.slice(0, 10).map(session => {
                const isCredit = session.payment?.method === 'credito';
                const paidAccount = session.accounts?.find((a: any) => a.id === session.payment?.accountId || a.status === 'paid');
                const accountName = paidAccount ? paidAccount.name : (session.accounts?.[0]?.name || '');
                const displayName = isCredit 
                  ? session.payment?.creditClient?.nombre 
                  : session.customerName || accountName || 'Cliente';

                const isDelivery = session.type === 'delivery' || session.tableId === 'delivery' || session.tableId?.startsWith('delivery');
                const matchedTable = tables.find((t: any) => t.id === session.tableId);
                const tableLabel = isDelivery 
                  ? '🚚 Delivery' 
                  : matchedTable 
                    ? `🪑 Mesa ${matchedTable.number}` 
                    : session.tableName 
                      ? `🪑 ${session.tableName}` 
                      : session.tableNumber 
                        ? `🪑 Mesa ${session.tableNumber}` 
                        : session.tableId && session.tableId.length < 10 
                          ? `🪑 Mesa ${session.tableId}` 
                          : '🪑 Mesa';
                const waiterLabel = session.waiterName ? `👤 Mesero: ${session.waiterName}` : '👤 Mesero: N/A';
                const totalUSD = session.payment?.totalUSD || session.totalAmount || 0;
                const totalBs = totalUSD * exchangeRate;
                const payMethod = session.payment?.method || session.paymentMethod || 'Pago';

                return (
                  <div 
                    key={session.id} 
                    onClick={() => setViewingCompletedSession(session)}
                    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2.5 group relative overflow-hidden text-left"
                  >
                    {/* Hover indicator strip */}
                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <span className="font-bold text-sm block text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                          {displayName}
                        </span>
                        
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
                          <span className="font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[9px] uppercase">
                            {tableLabel}
                          </span>
                          <span className="text-slate-400">
                            {waiterLabel}
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <span className="text-sm font-black text-slate-900 block">
                          +${totalUSD.toFixed(2)}
                        </span>
                        <span className="text-[9px] text-slate-400 font-medium font-mono block">
                          Bs. {totalBs.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[10px] border-t border-slate-50 pt-2 text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded font-black text-[8px] uppercase tracking-wider ${
                          isCredit ? 'bg-purple-50 text-purple-600' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          {payMethod}
                        </span>
                        {session.payment?.reference && (
                          <span className="font-mono text-slate-500">
                            #{session.payment.reference}
                          </span>
                        )}
                      </div>
                      <span className="font-medium text-slate-400">
                        {session.payment?.timestamp 
                          ? new Date(session.payment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : 'N/A'
                        }
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* FLOATING TOAST NOTIFICATION */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-800 text-sm font-semibold max-w-sm"
          >
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RECEIPT IMAGE LIGHTBOX MODAL */}
      <AnimatePresence>
        {viewingReceiptImage && (
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 cursor-pointer"
            onClick={() => setViewingReceiptImage(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative max-w-md w-full bg-white rounded-3xl p-4 shadow-2xl cursor-default"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-3">
                <span className="font-bold text-xs text-slate-800">Comprobante de Pago Subido</span>
                <button 
                  onClick={() => setViewingReceiptImage(null)}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-full"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="aspect-square bg-slate-100 rounded-2xl overflow-hidden border border-slate-100">
                <img 
                  src={viewingReceiptImage} 
                  alt="Voucher Zoomed" 
                  className="w-full h-full object-contain" 
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* COMPLETED SESSION DETAILS MODAL */}
      <AnimatePresence>
        {viewingCompletedSession && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl overflow-hidden relative border border-slate-100 text-slate-800 text-left"
            >
              {/* Banner header */}
              <div className="bg-indigo-600 text-white p-8 relative">
                <button 
                  onClick={() => setViewingCompletedSession(null)}
                  className="absolute top-6 right-6 p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors"
                  title="Cerrar"
                >
                  <X size={18} />
                </button>
                <span className="text-[10px] bg-white/20 text-white font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                  Transacción Conciliada
                </span>
                <h3 className="text-2xl font-black mt-3 leading-tight truncate">
                  {(() => {
                    const isCredit = viewingCompletedSession.payment?.method === 'credito';
                    const paidAccount = viewingCompletedSession.accounts?.find((a: any) => a.id === viewingCompletedSession.payment?.accountId || a.status === 'paid');
                    const accountName = paidAccount ? paidAccount.name : (viewingCompletedSession.accounts?.[0]?.name || '');
                    return isCredit 
                      ? viewingCompletedSession.payment?.creditClient?.nombre 
                      : viewingCompletedSession.customerName || accountName || 'Cliente';
                  })()}
                </h3>
                <p className="text-white/80 text-xs mt-1">Historial y desglose completo del consumo</p>
              </div>

              {/* Body */}
              <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
                {/* General Session Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="text-[9px] text-slate-400 uppercase font-black block mb-1">Ubicación / Tipo</span>
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      {viewingCompletedSession.type === 'delivery' || viewingCompletedSession.tableId === 'delivery' || viewingCompletedSession.tableId?.startsWith('delivery') 
                        ? '🚚 Delivery / Llevar' 
                        : (() => {
                            const matched = tables.find((t: any) => t.id === viewingCompletedSession.tableId);
                            if (matched) return `🪑 Mesa ${matched.number}`;
                            if (viewingCompletedSession.tableName) return `🪑 ${viewingCompletedSession.tableName}`;
                            if (viewingCompletedSession.tableNumber) return `🪑 Mesa ${viewingCompletedSession.tableNumber}`;
                            if (viewingCompletedSession.tableId && viewingCompletedSession.tableId.length < 10) return `🪑 Mesa ${viewingCompletedSession.tableId}`;
                            return '🪑 Mesa';
                          })()
                      }
                    </span>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="text-[9px] text-slate-400 uppercase font-black block mb-1">Mesero Atendente</span>
                    <span className="text-xs font-bold text-slate-800">
                      👤 {viewingCompletedSession.waiterName || 'No especificado'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="text-[9px] text-slate-400 uppercase font-black block mb-1">Hora de Apertura</span>
                    <span className="text-xs font-medium text-slate-600">
                      {viewingCompletedSession.startTime 
                        ? new Date(viewingCompletedSession.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'N/A'
                      }
                    </span>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="text-[9px] text-slate-400 uppercase font-black block mb-1">Hora de Cierre</span>
                    <span className="text-xs font-semibold text-emerald-600">
                      {viewingCompletedSession.payment?.timestamp 
                        ? new Date(viewingCompletedSession.payment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'N/A'
                      }
                    </span>
                  </div>
                </div>

                {/* Delivery details if delivery */}
                {(viewingCompletedSession.customerPhone || viewingCompletedSession.customerAddress) && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-400">Datos de Contacto y Envío</h4>
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 text-xs space-y-3">
                      {viewingCompletedSession.customerPhone && (
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase font-black block mb-0.5">Teléfono</span>
                          <span className="font-bold text-slate-800">{viewingCompletedSession.customerPhone}</span>
                        </div>
                      )}
                      {viewingCompletedSession.deliveryZoneName && (
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase font-black block mb-0.5">Zona de Delivery</span>
                          <span className="font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                            🛵 {viewingCompletedSession.deliveryZoneName} (+${(viewingCompletedSession.deliveryFee || 0).toFixed(2)} USD)
                          </span>
                        </div>
                      )}
                      {viewingCompletedSession.customerAddress && (
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase font-black block mb-0.5">Dirección</span>
                          <span className="font-medium text-slate-700 leading-relaxed">{viewingCompletedSession.customerAddress}</span>
                        </div>
                      )}
                      {viewingCompletedSession.deliveryReference && (
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase font-black block mb-0.5">Punto de Referencia</span>
                          <span className="font-medium text-slate-600 italic">{viewingCompletedSession.deliveryReference}</span>
                        </div>
                      )}
                      {(viewingCompletedSession.whatsappLocation || viewingCompletedSession.locationUrl) && (
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase font-black block mb-0.5">Ubicación GPS</span>
                          <a 
                            href={(viewingCompletedSession.whatsappLocation || viewingCompletedSession.locationUrl).startsWith('http') ? (viewingCompletedSession.whatsappLocation || viewingCompletedSession.locationUrl) : `https://${viewingCompletedSession.whatsappLocation || viewingCompletedSession.locationUrl}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:underline"
                          >
                            📍 Abrir enlace de ubicación GPS
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Payment summary */}
                <div className="space-y-3">
                  <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-400">Información del Pago</h4>
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 text-xs grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-black block mb-0.5">Método de Pago</span>
                      <span className="font-bold uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {viewingCompletedSession.payment?.method || viewingCompletedSession.paymentMethod || 'Pago'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-black block mb-0.5">Referencia</span>
                      <span className="font-mono font-bold text-slate-800">
                        {viewingCompletedSession.payment?.reference ? `#${viewingCompletedSession.payment.reference}` : (viewingCompletedSession.paymentReference ? `#${viewingCompletedSession.paymentReference}` : 'Sin referencia')}
                      </span>
                    </div>
                    {(viewingCompletedSession.paymentReceiptImage || viewingCompletedSession.payment?.receiptImage) && (
                      <div className="col-span-2 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                        <span className="text-[9px] text-slate-400 uppercase font-black block">Comprobante de Pago</span>
                        <a 
                          href={viewingCompletedSession.paymentReceiptImage || viewingCompletedSession.payment?.receiptImage} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-xl transition-colors"
                        >
                          📷 Ver Comprobante Adjunto
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Plates / Items detail */}
                <div className="space-y-3">
                  <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-400">Platos y Consumos Solicitados</h4>
                  
                  {isLoadingCompletedOrders ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-400 space-y-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
                      <span className="text-xs">Cargando platos...</span>
                    </div>
                  ) : completedSessionOrders.length === 0 ? (
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center text-slate-400 text-xs italic">
                      No se encontraron registros de platos ordenados.
                    </div>
                  ) : (
                    <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 space-y-3">
                      {completedSessionOrders.map((order) => (
                        <div 
                          key={order.id} 
                          className="flex justify-between items-start text-xs pb-3 border-b border-slate-200/50 last:border-0 last:pb-0"
                        >
                          <div className="space-y-0.5 text-left">
                            <div>
                              <span className="font-extrabold text-slate-900">{order.quantity || 1}x</span>{' '}
                              <span className="font-bold text-slate-800">{order.itemName}</span>
                            </div>
                            <span className="text-[9px] text-slate-400 block bg-slate-200/50 px-1.5 py-0.5 rounded-md w-fit">
                              Cuenta: {order.accountName || 'Única'}
                            </span>
                          </div>
                          
                          <div className="text-right">
                            <span className="font-mono font-bold text-slate-900 block">
                              ${((order.price || 0) * (order.quantity || 1)).toFixed(2)}
                            </span>
                            <span className="text-[9px] text-slate-400 block">
                              (${ (order.price || 0).toFixed(2) } c/u)
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Summary calculations */}
                      <div className="pt-4 border-t border-slate-200/80 flex justify-between items-end">
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase font-black block">Total Consumido</span>
                          <span className="text-2xl font-black text-indigo-600">
                            ${(viewingCompletedSession.payment?.totalUSD || viewingCompletedSession.totalAmount || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] text-slate-400 uppercase font-black block">En Bolívares</span>
                          <span className="text-sm font-bold text-slate-700">
                            Bs. {((viewingCompletedSession.payment?.totalUSD || viewingCompletedSession.totalAmount || 0) * exchangeRate).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Close button */}
              <div className="p-8 bg-slate-50 border-t border-slate-100">
                <button 
                  onClick={() => setViewingCompletedSession(null)}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white p-4 rounded-xl font-bold text-sm transition-colors shadow-lg shadow-slate-900/10"
                >
                  Cerrar Detalles
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRMATION APPROVED/REJECTED MODALS */}
      <AnimatePresence>
        {confirmingSession && (
          <div className="absolute inset-0 -m-4 sm:-m-6 md:-m-8 -mb-28 md:-mb-8 z-50 bg-[#F8F9FA] flex flex-col overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-[#F8F9FA] p-6 sm:p-8 w-full h-full flex flex-col justify-between relative"
            >
              <div className="flex items-center gap-3 mb-4 shrink-0 pb-3 border-b border-slate-200">
                <button 
                  onClick={() => setConfirmingSession(null)}
                  className="px-3.5 py-2 bg-slate-200/80 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                  disabled={isProcessing}
                >
                  <ArrowLeft size={16} />
                  <span>Atrás</span>
                </button>
                <h3 className="text-lg font-black text-slate-900">Validación de Transacción / Caja</h3>
              </div>

              {confirmingSession.type === 'approve' ? (
                <>
                  <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
                    <Check size={24} className="text-emerald-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">¿Aprobar Pago / Crédito y Enviar a Cocina?</h3>
                  <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                    Se validará la transacción de <strong className="text-slate-900">${(confirmingSession.session.pendingPayment?.totalUSD || confirmingSession.session.totalAmount || 0).toFixed(2)} USD</strong> (Bs. {((confirmingSession.session.pendingPayment?.totalUSD || confirmingSession.session.totalAmount || 0) * exchangeRate).toFixed(2)}) para <strong>{
                      confirmingSession.session.pendingPayment?.creditClient?.nombre || 
                      confirmingSession.session.customerName || 
                      confirmingSession.session.accounts?.find((a: any) => a.id === confirmingSession.session.pendingPayment?.accountId || a.status === 'paid')?.name || 
                      confirmingSession.session.accounts?.[0]?.name || 
                      'Cliente'
                    }</strong>. 
                  </p>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setConfirmingSession(null)}
                      className="flex-1 py-4 px-5 bg-slate-50 hover:bg-slate-100 text-slate-500 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors"
                      disabled={isProcessing}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => executeApprovePayment(confirmingSession.session)}
                      className="flex-1 py-4 px-5 bg-black hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2"
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : 'Sí, Validar'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mb-6">
                    <AlertCircle size={24} className="text-rose-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Rechazar Transacción</h3>
                  <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                    ¿Estás seguro de que deseas rechazar esta solicitud de <strong className="text-slate-900">${(confirmingSession.session.pendingPayment?.totalUSD || confirmingSession.session.totalAmount || 0).toFixed(2)} USD</strong>? El mesero recibirá la notificación de rechazo.
                  </p>

                  <div className="mb-6">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Razón del rechazo (Opcional)</label>
                    <input
                      type="text"
                      value={rejectionReasonInput}
                      onChange={e => setRejectionReasonInput(e.target.value)}
                      placeholder="Ej. Comprobante ilegible, monto equivocado..."
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium text-sm"
                      disabled={isProcessing}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setConfirmingSession(null)}
                      className="flex-1 py-4 px-5 bg-slate-50 hover:bg-slate-100 text-slate-500 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors"
                      disabled={isProcessing}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => executeRejectPayment(confirmingSession.session)}
                      className="flex-1 py-4 px-5 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2"
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : 'Rechazar Pago'}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* VIEW DELIVERY DETAILS MODAL */}
      <AnimatePresence>
        {viewingDeliveryOrder && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl overflow-hidden relative border border-slate-100 text-slate-800 text-left"
            >
              {/* Banner header */}
              <div className="bg-amber-500 text-white p-8 relative">
                <button 
                  onClick={() => setViewingDeliveryOrder(null)}
                  className="absolute top-6 right-6 p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors"
                  title="Cerrar"
                >
                  <X size={18} />
                </button>
                <span className="text-[10px] bg-white/20 text-white font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                  {viewingDeliveryOrder.deliveryType === 'pickup' ? 'Retiro en Local' : 'Envío a Domicilio'}
                </span>
                <h3 className="text-2xl font-black mt-3 leading-tight truncate">
                  {viewingDeliveryOrder.customerName}
                </h3>
                <p className="text-white/80 text-xs mt-1">Detalles del pedido en curso</p>
              </div>

              {/* Body */}
              <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
                {/* Status Indicator banner */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-amber-500" />
                    <span className="text-xs font-bold text-slate-700">Estado del Pedido:</span>
                  </div>
                  <span className="text-xs bg-amber-100 text-amber-800 font-extrabold px-3 py-1 rounded-xl uppercase tracking-wider">
                    {viewingDeliveryOrder.paymentStatus === 'validated' ? 'Pago Validado' : 'Esperando Pago/Validación'}
                  </span>
                </div>

                {/* Customer Contact Card */}
                <div className="space-y-3">
                  <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-400">Datos de Contacto y Envío</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <span className="text-[9px] text-slate-400 uppercase font-black block mb-1">WhatsApp / Teléfono</span>
                      <a 
                        href={`https://wa.me/${viewingDeliveryOrder.customerPhone?.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1.5"
                      >
                        <Phone size={12} />
                        {viewingDeliveryOrder.customerPhone || 'Sin teléfono'}
                        <ExternalLink size={10} />
                      </a>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <span className="text-[9px] text-slate-400 uppercase font-black block mb-1">Inicio de Sesión</span>
                      <span className="text-xs font-bold text-slate-800">
                        {new Date(viewingDeliveryOrder.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {viewingDeliveryOrder.deliveryType !== 'pickup' && viewingDeliveryOrder.customerAddress && (
                      <div className="col-span-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <span className="text-[9px] text-slate-400 uppercase font-black block mb-1">Dirección de Entrega</span>
                        <div className="flex items-start gap-2 text-xs text-slate-700">
                          <MapPin size={14} className="text-rose-500 shrink-0 mt-0.5" />
                          <span className="font-medium leading-relaxed">{viewingDeliveryOrder.customerAddress}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Items Reciept summary */}
                <div className="space-y-3">
                  <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-400">Productos del Pedido</h4>
                  
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-3">
                    {deliveryOrders.map(order => (
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

                    {deliveryOrders.length === 0 && (
                      <p className="text-xs text-slate-400 italic text-center py-2">Sin productos agregados todavía.</p>
                    )}

                    {/* Total info */}
                    {deliveryOrders.length > 0 && (
                      <div className="pt-4 border-t border-slate-200 flex justify-between items-end">
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase font-black block">Total del Pedido</span>
                          <span className="text-xl font-light text-slate-900">
                            ${deliveryOrders.reduce((sum, o) => sum + (o.price * o.quantity), 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] text-slate-400 uppercase font-black block">En Bolívares</span>
                          <span className="text-sm font-bold text-slate-700">
                            Bs. {(deliveryOrders.reduce((sum, o) => sum + (o.price * o.quantity), 0) * exchangeRate).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment info if present */}
                {viewingDeliveryOrder.paymentMethod && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-400">Información del Pago Registrado</h4>
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 text-xs grid grid-cols-2 gap-3 text-slate-700 text-left animate-fade-in">
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-black block">Método</span>
                        <span className="font-bold uppercase text-slate-900">{viewingDeliveryOrder.paymentMethod}</span>
                      </div>
                      {viewingDeliveryOrder.paymentReference && (
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase font-black block">Referencia</span>
                          <span className="font-mono font-bold text-slate-900">#{viewingDeliveryOrder.paymentReference}</span>
                        </div>
                      )}
                    </div>
                    {(viewingDeliveryOrder.paymentReceiptImage || viewingDeliveryOrder.pendingPayment?.receiptImage) && (
                      <button 
                        onClick={() => setViewingReceiptImage(viewingDeliveryOrder.paymentReceiptImage || viewingDeliveryOrder.pendingPayment?.receiptImage)}
                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors border border-slate-200"
                      >
                        <Eye size={14} />
                        Ver Imagen de Comprobante
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="p-8 bg-slate-50 border-t border-slate-100 flex flex-wrap sm:flex-nowrap gap-3">
                <button 
                  onClick={() => setViewingDeliveryOrder(null)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-5 py-4 rounded-xl font-bold text-sm transition-colors"
                >
                  Cerrar
                </button>
                <button
                  onClick={() => {
                    const formatted = deliveryOrders.map(o => ({
                      itemName: o.name || o.itemName || 'Platillo',
                      quantity: o.quantity || 1,
                      note: o.notes || o.note || '',
                      excludedIngredients: o.excludedIngredients || [],
                      extras: o.extras || []
                    }));
                    printKitchenTicket({
                      tableName: `DELIVERY/LLEVAR: ${viewingDeliveryOrder.customerName || 'Cliente'}`,
                      waiterName: currentUser?.name || localStorage.getItem('demo_user_name') || 'Caja',
                      timestamp: new Date().toISOString(),
                      items: formatted,
                      paperWidth: (settings as any)?.kitchenPaperWidth || '80mm',
                      restaurantName: (settings as any)?.restaurantName || 'BISTROFLOW'
                    });
                  }}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-5 py-4 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 shrink-0 shadow-md"
                  title="Imprimir comanda de cocina en formato térmico (80mm/58mm)"
                >
                  <Printer size={18} />
                  <span>Imprimir Comanda</span>
                </button>
                <button 
                  onClick={async () => {
                    try {
                      const totalUSD = deliveryOrders.reduce((sum, o) => sum + (o.price * o.quantity), 0);
                      
                      // Mark as completed
                      await updateDoc(doc(db, 'sessions', viewingDeliveryOrder.id), {
                        status: 'completed',
                        paymentStatus: 'validated',
                        'payment.totalUSD': totalUSD,
                        'payment.timestamp': new Date().toISOString()
                      });

                      // Mark all orders as delivered
                      const ordersRef = collection(db, 'sessions', viewingDeliveryOrder.id, 'accounts', 'default', 'orders');
                      const orderSnaps = await getDocs(ordersRef);
                      const promises = orderSnaps.docs.map(orderDoc => {
                        return updateDoc(doc(db, 'sessions', viewingDeliveryOrder.id, 'accounts', 'default', 'orders', orderDoc.id), {
                          status: 'delivered'
                        });
                      });
                      await Promise.all(promises);

                      setViewingDeliveryOrder(null);
                      showToast('✅ Pedido entregado y cerrado exitosamente.');
                    } catch (err) {
                      console.error('Error closing delivery session:', err);
                      alert('Error al marcar como entregado.');
                    }
                  }}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/10"
                >
                  <CheckCircle2 size={16} />
                  Marcar como Entregado
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OPEN SHIFT PANEL */}
      <AnimatePresence>
        {isOpeningShiftModalOpen && (
          <div className="absolute inset-0 -m-4 sm:-m-6 md:-m-8 -mb-28 md:-mb-8 z-50 bg-[#F8F9FA] flex flex-col overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-[#F8F9FA] w-full h-full overflow-hidden flex flex-col relative"
            >
              <div className="p-6 bg-slate-900 text-white flex items-center gap-4">
                <button 
                  onClick={() => setIsOpeningShiftModalOpen(false)} 
                  className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <ArrowLeft size={16} />
                  <span>Atrás</span>
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-slate-950 shrink-0">
                    <Key size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-lg">Apertura de Turno de Caja</h3>
                    <p className="text-xs text-slate-400">Inicia un nuevo turno para controlar cobros y arqueos</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4 flex-1 overflow-y-auto min-h-0">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase block mb-1">Nombre / Identificador del Turno</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                    {['Turno Mañana', 'Turno Tarde', 'Turno Noche', 'Turno 24 Horas'].map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setOpeningShiftName(preset)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                          openingShiftName === preset ? 'bg-black text-white border-black' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={openingShiftName}
                    onChange={e => setOpeningShiftName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-900"
                    placeholder="Ej. Turno Especial Fin de Semana"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase block mb-1">Cajero(a) Responsable</label>
                  <input
                    type="text"
                    value={openingCashierName}
                    onChange={e => setOpeningCashierName(e.target.value)}
                    placeholder={currentUser?.name || localStorage.getItem('demo_user_name') || 'Nombre del cajero'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase block mb-1">Fondo Inicial ($ USD)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={openingInitialCashUSD}
                        onChange={e => setOpeningInitialCashUSD(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 pl-7 text-sm font-bold text-slate-900"
                        placeholder="50.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase block mb-1">Fondo Inicial (Bs.)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">Bs</span>
                      <input
                        type="number"
                        step="0.01"
                        value={openingInitialCashBs}
                        onChange={e => setOpeningInitialCashBs(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 pl-9 text-sm font-bold text-slate-900"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase block mb-1">Observaciones / Notas (Opcional)</label>
                  <textarea
                    value={openingNotes}
                    onChange={e => setOpeningNotes(e.target.value)}
                    rows={2}
                    placeholder="Ej. Recibido billetes de $5 y $10 para cambio"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-900"
                  />
                </div>
              </div>

              <div className="p-4 pb-6 sm:p-6 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                <button
                  onClick={() => setIsOpeningShiftModalOpen(false)}
                  className="flex-1 py-3 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleOpenShift}
                  className="flex-1 py-3 px-4 bg-black hover:bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg transition-all"
                >
                  Confirmar Apertura
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADVANCED CASH & FINANCE MOVEMENT MODAL */}
      <AnimatePresence>
        {isCashMovementModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[36px] max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col my-auto max-h-[90vh]"
            >
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md ${movementType === 'in' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                    {movementType === 'in' ? <PlusCircle size={22} /> : <MinusCircle size={22} />}
                  </div>
                  <div>
                    <h3 className="font-black text-lg">Registrar Movimiento Financiero</h3>
                    <p className="text-xs text-slate-400">Sincronización instantánea con Caja Turno y Finanzas</p>
                  </div>
                </div>
                <button onClick={() => setIsCashMovementModalOpen(false)} className="text-slate-400 hover:text-white p-2 rounded-xl transition-colors cursor-pointer">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                {/* Type toggle */}
                <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMovementType('out');
                      setMovementCategory('Insumos');
                    }}
                    className={`py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                      movementType === 'out' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-600 hover:text-black'
                    }`}
                  >
                    🔴 Egreso / Retiro / Gasto
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMovementType('in');
                      setMovementCategory('Otros Ingresos');
                    }}
                    className={`py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                      movementType === 'in' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:text-black'
                    }`}
                  >
                    🟢 Ingreso / Inyección
                  </button>
                </div>

                {/* Amounts Dual */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Monto en USD ($) *</label>
                    <div className="relative">
                      <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="number"
                        step="0.01"
                        value={movementAmountUSD}
                        onChange={e => {
                          const val = e.target.value;
                          setMovementAmountUSD(val);
                          const num = Number(val);
                          if (num > 0) setMovementAmountBs((num * exchangeRate).toFixed(2));
                          else setMovementAmountBs('');
                        }}
                        placeholder="0.00"
                        className="w-full pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:border-black outline-none font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Monto en Bs. (VES)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={movementAmountBs}
                      onChange={e => {
                        const val = e.target.value;
                        setMovementAmountBs(val);
                        const num = Number(val);
                        if (num > 0) setMovementAmountUSD((num / exchangeRate).toFixed(2));
                        else setMovementAmountUSD('');
                      }}
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:border-black outline-none font-mono"
                    />
                  </div>
                </div>

                {/* Category selection */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Categoría Contable</label>
                  <select
                    value={movementCategory}
                    onChange={e => setMovementCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:border-black outline-none cursor-pointer"
                  >
                    {movementType === 'out' ? (
                      <>
                        <option value="Insumos">Insumos e Ingredientes (Compra de Alimentos/Bebidas)</option>
                        <option value="Servicios">Servicios Públicos (Luz, Agua, Gas, Internet)</option>
                        <option value="Nómina">Nómina, Salarios y Propinas de Personal</option>
                        <option value="Alquiler">Alquiler de Local / Establecimiento</option>
                        <option value="Marketing">Marketing y Publicidad</option>
                        <option value="Impuestos">Impuestos / SENIAT / Tasa Municipal</option>
                        <option value="Mantenimiento">Mantenimiento y Reparación de Equipos</option>
                        <option value="Otros Egresos">Otros Egresos Administrativos / Caja Chica</option>
                      </>
                    ) : (
                      <>
                        <option value="Otros Ingresos">Ingreso Vario / Inyección de Caja</option>
                        <option value="Cobro de Crédito">Cobro de Crédito / Abonar Deuda de Cliente</option>
                        <option value="Aporte de Capital">Aporte de Capital de Socios</option>
                        <option value="Eventos Especiales">Ingresos por Evento Especial / Alquiler</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Conditional CRM Debt Client Selector */}
                {movementType === 'in' && movementCategory === 'Cobro de Crédito' && (
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Cliente de Crédito (CRM) *</label>
                    <select
                      value={movementSelectedClientId}
                      onChange={e => {
                        const cid = e.target.value;
                        setMovementSelectedClientId(cid);
                        const client = clientsList.find(c => c.id === cid);
                        if (client) {
                          setMovementReason(`Cobro de crédito de ${client.name} (CI: ${client.cedula || 'N/A'})`);
                          setMovementAmountUSD(String(client.debt || 0));
                          setMovementAmountBs(((client.debt || 0) * exchangeRate).toFixed(2));
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:border-black outline-none cursor-pointer"
                    >
                      <option value="">-- Seleccionar cliente con deuda --</option>
                      {clientsList.map(c => (
                        <option key={c.id} value={c.id}>
                          👤 {c.name} {c.cedula ? `(CI: ${c.cedula})` : ''} - Deuda: ${c.debt || 0} USD
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Description Reason */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Descripción / Concepto / Proveedor *</label>
                  <input
                    type="text"
                    value={movementReason}
                    onChange={e => setMovementReason(e.target.value)}
                    placeholder="Ej. Compra de hielo e insumos urgentes a Distribuidora Los Andes"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:border-black outline-none"
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Vía de Pago / Medio</label>
                  <select
                    value={movementPaymentMethod}
                    onChange={e => setMovementPaymentMethod(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:border-black outline-none cursor-pointer"
                  >
                    <option value="cash">💵 Efectivo ($ USD / Bs)</option>
                    <option value="pagomovil">📱 Pago Móvil</option>
                    <option value="zelle">📧 Zelle</option>
                    <option value="card">💳 Tarjeta (Punto de Venta)</option>
                    <option value="bank_transfer">🏦 Transferencia Bancaria</option>
                  </select>
                </div>

                {/* Fiscal Toggle & Details */}
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={movementIsFiscal}
                      onChange={e => setMovementIsFiscal(e.target.checked)}
                      className="w-4 h-4 rounded text-black border-slate-300"
                    />
                    <span className="text-xs font-bold text-slate-800 select-none">🧾 Movimiento respalda Factura Fiscal (SENIAT)</span>
                  </label>

                  {movementIsFiscal && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-3 pt-2 border-t border-slate-200 overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Nro. Factura / Control</label>
                          <input
                            type="text"
                            value={movementFiscalInvoice}
                            onChange={e => setMovementFiscalInvoice(e.target.value)}
                            placeholder="F-00123"
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold font-mono text-slate-900 focus:border-black outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Alícuota IVA (%)</label>
                          <select
                            value={movementTaxRate}
                            onChange={e => setMovementTaxRate(Number(e.target.value))}
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:border-black outline-none cursor-pointer"
                          >
                            <option value="16">16% (General)</option>
                            <option value="8">8% (Reducido)</option>
                            <option value="0">Exento (0%)</option>
                          </select>
                        </div>
                      </div>

                      {movementType === 'out' && (
                        <div>
                          <label className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Retención ISLR / IVA (%)</label>
                          <select
                            value={movementWithholdingRate}
                            onChange={e => setMovementWithholdingRate(Number(e.target.value))}
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:border-black outline-none cursor-pointer"
                          >
                            <option value="0">Sin retención (0%)</option>
                            <option value="1">1% (Servicios Generales)</option>
                            <option value="2">2% (Honorarios Profesionales)</option>
                            <option value="3">3% (Arrendamiento)</option>
                          </select>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>

              <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCashMovementModalOpen(false)}
                  className="flex-1 py-3 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveCashMovement}
                  disabled={isSubmittingMovement}
                  className={`flex-1 py-3 px-4 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer ${
                    movementType === 'in' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isSubmittingMovement ? 'Procesando...' : 'Guardar y Sincronizar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CLOSE SHIFT & ARQUEO PANEL */}
      <AnimatePresence>
        {isClosingShiftModalOpen && activeShift && (
          <div className="absolute inset-0 -m-4 sm:-m-6 md:-m-8 -mb-28 md:-mb-8 z-50 bg-[#F8F9FA] flex flex-col overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-[#F8F9FA] w-full h-full overflow-hidden flex flex-col relative"
            >
              <div className="p-6 bg-slate-900 text-white flex items-center gap-4 shrink-0">
                <button 
                  onClick={() => setIsClosingShiftModalOpen(false)} 
                  className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <ArrowLeft size={16} />
                  <span>Atrás</span>
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-slate-950 shrink-0">
                    <Lock size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-lg">Cierre de Turno y Arqueo de Caja</h3>
                    <p className="text-xs text-slate-400">Cuadre de efectivo real vs esperado del turno</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto scrollbar-thin flex-1 min-h-0">
                {/* System calculated expected totals */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center justify-between">
                    <span>📊 Resumen Consolidado del Sistema</span>
                    <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                      {shiftCompletedSessions.length} pedidos cobrados
                    </span>
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-white p-3 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Efectivo USD</span>
                      <span className="font-black text-slate-900">${shiftCashUSD.toFixed(2)}</span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Efectivo Bs</span>
                      <span className="font-black text-slate-900">Bs. {shiftCashBs.toFixed(2)}</span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Pago Móvil</span>
                      <span className="font-black text-slate-900">${shiftPagoMovilUSD.toFixed(2)}</span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Zelle</span>
                      <span className="font-black text-slate-900">${shiftZelleUSD.toFixed(2)}</span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Punto de Venta</span>
                      <span className="font-black text-slate-900">${shiftTarjetaUSD.toFixed(2)}</span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Crédito</span>
                      <span className="font-black text-amber-700">${shiftCreditoUSD.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-3 font-mono">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Esperado en Caja ($ USD)</span>
                      <span className="text-lg font-black text-slate-900">${expectedShiftCashUSD.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Esperado en Caja (Bs.)</span>
                      <span className="text-lg font-black text-rose-600">Bs. {expectedShiftCashBs.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* PHYSICAL CASH COUNT INPUTS */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-1.5">
                    <Calculator size={16} className="text-emerald-600" />
                    <span>Conteo Físico Real (Arqueo de Efectivo en Gaveta)</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase block mb-1">Efectivo Contado ($ USD) *</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={closingCountedCashUSD}
                          onChange={e => setClosingCountedCashUSD(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 pl-7 text-base font-black text-slate-900"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase block mb-1">Efectivo Contado (Bs.)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">Bs</span>
                        <input
                          type="number"
                          step="0.01"
                          value={closingCountedCashBs}
                          onChange={e => setClosingCountedCashBs(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 pl-9 text-base font-black text-slate-900"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* REALTIME DIFFERENCE STATUS */}
                {(() => {
                  const countedUSD = Number(closingCountedCashUSD) || 0;
                  const diffUSD = countedUSD - expectedShiftCashUSD;
                  const isExact = Math.abs(diffUSD) < 0.01;
                  const isSurplus = diffUSD > 0.01;
                  return (
                    <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                      isExact ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : isSurplus ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}>
                      <div>
                        <span className="text-[10px] uppercase font-black tracking-wider block">Resultado del Arqueo ($ USD)</span>
                        <span className="font-black text-lg">
                          {isExact ? '✨ Caja Cuadrada Exacta' : isSurplus ? `🟢 Sobrante de Caja: +$${diffUSD.toFixed(2)}` : `🔴 Faltante de Caja: -$${Math.abs(diffUSD).toFixed(2)}`}
                        </span>
                      </div>
                      <div className="text-right font-mono font-bold text-sm">
                        Diferencia: {diffUSD >= 0 ? '+' : ''}${diffUSD.toFixed(2)}
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase block mb-1">Observaciones de Cierre (Opcional)</label>
                  <textarea
                    value={closingNotes}
                    onChange={e => setClosingNotes(e.target.value)}
                    rows={2}
                    placeholder="Ej. Faltante aclarado con gerencia o billete deteriorado reemplazado"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-900"
                  />
                </div>
              </div>

              <div className="p-4 pb-6 sm:p-6 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                <button
                  onClick={() => setIsClosingShiftModalOpen(false)}
                  className="flex-1 py-3 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCloseShift}
                  className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Lock size={16} />
                  <span>Confirmar Cierre Z</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SHIFT REPORT Z DETAILS MODAL */}
      <AnimatePresence>
        {viewingShiftDetails && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] max-w-xl w-full my-8 overflow-hidden shadow-2xl border border-slate-100 flex flex-col"
            >
              <div className="p-6 bg-black text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Receipt size={24} className="text-emerald-400" />
                  <div>
                    <h3 className="font-black text-lg">Reporte Z de Cierre de Turno</h3>
                    <p className="text-xs text-slate-400">{viewingShiftDetails.shiftName}</p>
                  </div>
                </div>
                <button onClick={() => setViewingShiftDetails(null)} className="text-slate-400 hover:text-white p-2">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6 font-mono text-xs text-slate-800">
                <div className="border-b border-dashed border-slate-300 pb-4 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Apertura:</span>
                    <span className="font-bold">{new Date(viewingShiftDetails.openedAt).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cierre:</span>
                    <span className="font-bold">{viewingShiftDetails.closedAt ? new Date(viewingShiftDetails.closedAt).toLocaleString() : 'En curso'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Responsable:</span>
                    <span className="font-bold">{viewingShiftDetails.closedBy || viewingShiftDetails.openedBy}</span>
                  </div>
                </div>

                <div className="border-b border-dashed border-slate-300 pb-4 space-y-1">
                  <div className="font-bold text-slate-900 text-sm mb-2">Resumen de Ventas</div>
                  <div className="flex justify-between">
                    <span>Efectivo USD:</span>
                    <span className="font-bold">${(viewingShiftDetails.salesSummary?.cashUSD || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Efectivo Bs:</span>
                    <span className="font-bold">Bs. {(viewingShiftDetails.salesSummary?.cashBs || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pago Móvil:</span>
                    <span className="font-bold">${(viewingShiftDetails.salesSummary?.pagoMovilUSD || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Zelle:</span>
                    <span className="font-bold">${(viewingShiftDetails.salesSummary?.zelleUSD || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Punto de Venta:</span>
                    <span className="font-bold">${(viewingShiftDetails.salesSummary?.tarjetaUSD || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Créditos:</span>
                    <span className="font-bold">${(viewingShiftDetails.salesSummary?.creditoUSD || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-black pt-2 border-t border-slate-200">
                    <span>Total Consolidado:</span>
                    <span>${(viewingShiftDetails.salesSummary?.totalCollectedUSD || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="font-bold text-slate-900 text-sm mb-2">Cuadre de Efectivo</div>
                  <div className="flex justify-between text-slate-600">
                    <span>Fondo Inicial ($):</span>
                    <span>${(Number(viewingShiftDetails.initialCashUSD) || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Esperado en Caja ($):</span>
                    <span>${(Number(viewingShiftDetails.expectedCashUSD) || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Contado Real ($):</span>
                    <span>${(Number(viewingShiftDetails.actualCashUSD) || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm pt-2 border-t border-slate-200">
                    <span>Diferencia:</span>
                    <span className={viewingShiftDetails.differenceUSD >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                      {viewingShiftDetails.differenceUSD >= 0 ? '+' : ''}${(Number(viewingShiftDetails.differenceUSD) || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {viewingShiftDetails.closingNotes && (
                  <div className="text-xs italic bg-amber-50 text-amber-900 p-3 rounded-xl border border-amber-200">
                    <strong>Notas:</strong> {viewingShiftDetails.closingNotes}
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-3 px-4 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <Printer size={16} />
                  <span>Imprimir Ticket Z</span>
                </button>
                <button
                  onClick={() => setViewingShiftDetails(null)}
                  className="py-3 px-6 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PendingPaymentCard({ session, exchangeRate, onShowReceipt, onApprove, onReject }: { 
  key?: any;
  session: any; 
  exchangeRate: number; 
  onShowReceipt: (src: string) => void;
  onApprove: () => void; 
  onReject: () => void; 
}) {
  const { tables } = useRestaurantData();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    const accountId = session.pendingPayment?.accountId || 'default';
    const unsub = onSnapshot(
      collection(db, 'sessions', session.id, 'accounts', accountId, 'orders'),
      (snap) => {
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );

    return () => unsub();
  }, [session.id, session.pendingPayment?.accountId]);

  const receiptImage = session.pendingPayment?.receiptImage || session.paymentReceiptImage || null;
  const paymentMethod = session.pendingPayment?.method || session.paymentMethod || 'pago_movil';
  const paymentRef = session.pendingPayment?.reference || session.paymentReference || 'N/A';
  const totalAmount = session.pendingPayment?.totalUSD || session.totalAmount || 0;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white rounded-[32px] border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-100">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
              paymentMethod === 'zelle' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'
            }`}>
              {paymentMethod === 'zelle' ? '📧 Zelle' : paymentMethod === 'mixto' ? '🔄 Mixto' : '📱 Pago Móvil'}
            </span>
            {paymentMethod === 'mixto' ? (
              <span className="text-[10px] text-slate-400 font-mono">
                {session.pendingPayment?.mixedPayments?.length || 0} métodos
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-mono">
                Ref: <strong className="text-slate-700">{paymentRef}</strong>
              </span>
            )}
            <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
              {session.tableId.startsWith('delivery') 
                ? 'Delivery' 
                : (() => {
                    const t = tables.find((item: any) => item.id === session.tableId);
                    if (t) return `Mesa ${t.number}`;
                    if (session.tableNumber) return `Mesa ${session.tableNumber}`;
                    if (session.tableId.length < 10) return `Mesa ${session.tableId}`;
                    return 'Mesa';
                  })()
              }
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
              <User size={14} className="text-slate-400" />
              {(() => {
                const accountId = session.pendingPayment?.accountId;
                const paidAccount = session.accounts?.find((a: any) => a.id === accountId);
                return paidAccount 
                  ? `Cuenta: ${paidAccount.name}` 
                  : (session.customerName || 'Cliente');
              })()}
            </div>
            {session.customerPhone && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Phone size={14} className="text-slate-400" />
                {session.customerPhone}
              </div>
            )}
            {session.customerAddress && (
              <div className="flex items-start gap-1.5 text-xs text-slate-500">
                <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span>{session.customerAddress}</span>
                  {session.deliveryZoneName && (
                    <span className="block font-bold text-[11px] text-amber-800 mt-0.5">
                      Zona: {session.deliveryZoneName} (+${(session.deliveryFee || 0).toFixed(2)})
                    </span>
                  )}
                  {session.deliveryReference && (
                    <span className="block text-[10px] text-slate-500 italic">
                      Ref: {session.deliveryReference}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {receiptImage && (
            <button 
              type="button"
              onClick={() => onShowReceipt(receiptImage)}
              className="flex items-center gap-1.5 text-xs text-indigo-600 font-extrabold hover:underline bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl transition-all"
            >
              <Eye size={14} />
              Ver Imagen de Comprobante
            </button>
          )}

          {paymentMethod === 'mixto' && session.pendingPayment?.mixedPayments && (
            <div className="bg-slate-100 rounded-xl p-2 mt-2 space-y-1">
              <span className="text-[9px] font-bold uppercase text-slate-500 mb-1 block">Detalle Pago Mixto</span>
              {session.pendingPayment.mixedPayments.map((p: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-[10px] bg-white p-1.5 rounded-lg">
                  <span className="uppercase font-bold text-slate-700">{p.method.replace('_', ' ')}</span>
                  <div className="flex gap-2">
                    <span className="text-slate-400 font-mono">{p.reference || '-'}</span>
                    <span className="font-bold text-slate-900">${p.amountUSD.toFixed(2)} <span className="text-[9px] text-slate-400 font-medium">({p.currency === "Bs" ? `Bs. ${(p.amountUSD * exchangeRate).toFixed(2)}` : "USD"})</span></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Monto a Validar</span>
            {session.couponCode && (
              <div className="flex items-center justify-between text-xs text-emerald-700 font-bold mb-1 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                <span>🏷️ Cupón ({session.couponCode}):</span>
                <span>-${(session.couponDiscountUSD || 0).toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-black">${totalAmount.toFixed(2)}</span>
              <span className="text-xs font-bold text-slate-500">Bs. {(totalAmount * exchangeRate).toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/60">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Artículos del Pedido</span>
            <div className="space-y-1 max-h-[100px] overflow-y-auto pr-1">
              {items.length === 0 ? (
                <span className="text-[10px] text-slate-400 italic">No se recuperaron items del desglose de cuenta</span>
              ) : (
                items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs text-slate-700">
                    <span className="font-semibold">{item.quantity}x <span className="font-normal text-slate-600">{item.itemName}</span></span>
                    <span className="font-mono text-slate-500">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-6 sm:justify-end">
        <button 
          onClick={onReject}
          className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-100 hover:border-rose-100 hover:bg-rose-50 text-rose-500 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
        >
          <X size={14} />
          Rechazar Pago
        </button>

        <button 
          onClick={onApprove}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-black hover:bg-indigo-600 hover:scale-[1.01] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-black/10"
        >
          <Check size={14} />
          Validar Pago
        </button>
      </div>
    </motion.div>
  );
}

function CajaTableSessionCard({ session, tables, exchangeRate, onViewDelivery, onOpenTransfer }: { key?: any; session: any; tables: any[]; exchangeRate: number; onViewDelivery?: (session: any) => void; onOpenTransfer?: (session: any) => void }) {
  const isDelivery = session.type === 'delivery' || session.tableId?.startsWith('delivery');
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!isDelivery || !session.id) return;
    const ordersRef = collection(db, 'sessions', session.id, 'accounts', 'default', 'orders');
    const unsub = onSnapshot(ordersRef, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error('Error fetching delivery card orders:', err));
    return () => unsub();
  }, [isDelivery, session.id]);
  
  if (isDelivery) {
    const isPickup = session.deliveryType === 'pickup';
    const totalUSD = session.totalAmount || 0;
    const totalBs = totalUSD * exchangeRate;
    const orderNum = session.orderNumber || session.id.substring(0, 4).toUpperCase();

    const allReady = orders.length > 0 && orders.every(o => o.status === 'ready' || o.status === 'delivered');
    const isPreparing = orders.some(o => o.status === 'pending' || o.status === 'preparing');

    return (
      <div className="bg-gradient-to-br from-amber-50/50 to-white rounded-[32px] border border-amber-100 p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full translate-x-12 -translate-y-12" />
        <div className="flex justify-between items-start mb-4 pb-4 border-b border-amber-100/60 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 block">
                {isPickup ? 'Retiro en Local (Pickup)' : 'Envío a Domicilio (Delivery)'}
              </span>
              {allReady ? (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse">
                  🔔 ¡Listo para Despachar!
                </span>
              ) : isPreparing ? (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                  🍳 En Cocina
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-600 border border-slate-200">
                  Pendiente
                </span>
              )}
            </div>
            <h4 className="font-black text-slate-900 text-base">
              Pedido #{orderNum} <span className="text-xs font-medium text-slate-500">({session.customerName})</span>
            </h4>
            {session.waiterName && (
              <span className="text-[10px] text-amber-700 font-extrabold uppercase mt-1 block">
                👤 Creado por: {session.waiterName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <Clock size={12} />
            <span>Inició: {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        <div className="space-y-4 relative z-10">
          <div className="bg-white p-4 rounded-2xl border border-amber-100/50 flex justify-between items-center">
            <div>
              <span className="text-[9px] text-slate-400 uppercase font-black block">Total del Pedido</span>
              <span className="text-lg font-black text-slate-900">${totalUSD.toFixed(2)}</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] text-slate-400 uppercase font-black block">En Bolívares</span>
              <span className="text-xs font-bold text-slate-700">Bs. {totalBs.toFixed(2)}</span>
            </div>
          </div>

          <button 
            onClick={() => onViewDelivery?.(session)}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white p-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10"
          >
            <ShoppingBag size={14} />
            Ver Detalles y Gestionar
          </button>
        </div>
      </div>
    );
  }

  const table = tables.find(t => t.id === session.tableId);
  const tableName = table ? `MESA ${table.number.toString().padStart(2, '0')}` : 'MESA';
  
  const accounts = session.accounts || [{ id: 'default', name: 'Cuenta 1', status: 'active' }];
  
  return (
    <div className="bg-white rounded-[32px] border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4 pb-4 border-b border-slate-50">
        <div>
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Mesa Abierta</span>
          <h4 className="font-black text-slate-900 text-base flex items-center gap-2">
            {tableName}
            {(session.customerName || session.accounts?.[0]?.name) && (
              <span className="text-xs font-medium text-slate-500">
                ({session.customerName || session.accounts?.[0]?.name})
              </span>
            )}
          </h4>
          {session.waiterName && (
            <span className="text-[10px] text-indigo-600 font-bold uppercase mt-1 block">
              👤 Atendido por: {session.waiterName}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <Clock size={12} />
            <span>Inició: {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <button
            onClick={() => onOpenTransfer?.(session)}
            className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-extrabold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200/60"
            title="Mover de mesa o unir cuentas"
          >
            <RotateCcw size={13} className="rotate-90 text-indigo-500" />
            <span>Mover / Unir Mesa</span>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {accounts.map((acc: any) => (
          <CajaAccountRow key={acc.id} sessionId={session.id} account={acc} exchangeRate={exchangeRate} />
        ))}
      </div>
    </div>
  );
}

function CajaAccountRow({ sessionId, account, exchangeRate }: { key?: any; sessionId: string; account: any; exchangeRate: number }) {
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'sessions', sessionId, 'accounts', account.id, 'orders'),
      (snap) => {
        setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );
    return () => unsub();
  }, [sessionId, account.id]);

  const totalUSD = orders.reduce((acc, o) => acc + ((o.price || 0) * (o.quantity || 1)), 0);
  const totalBs = totalUSD * exchangeRate;

  // Group status counts
  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const preparingCount = orders.filter(o => o.status === 'preparing').length;
  const readyCount = orders.filter(o => o.status === 'ready').length;
  const deliveredCount = orders.filter(o => o.status === 'delivered').length;

  return (
    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-xs text-slate-800">{account.name}</span>
          <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
            account.status === 'paid' 
              ? 'bg-emerald-100 text-emerald-800' 
              : 'bg-amber-100 text-amber-800 animate-pulse'
          }`}>
            {account.status === 'paid' ? 'Pagada' : 'Por Pagar'}
          </span>
        </div>

        {/* Order status summary tags */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {orders.length === 0 ? (
            <span className="text-[10px] text-slate-400 italic">Sin pedidos aún</span>
          ) : (
            <>
              {pendingCount > 0 && <span className="text-[9px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded-md">Espera: {pendingCount}</span>}
              {preparingCount > 0 && <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded-md">Cocina: {preparingCount}</span>}
              {readyCount > 0 && <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-md">Listo: {readyCount}</span>}
              {deliveredCount > 0 && <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded-md">Entregado: {deliveredCount}</span>}
            </>
          )}
        </div>
      </div>

      <div className="text-right flex flex-col items-end shrink-0">
        <span className="text-sm font-black text-slate-900">${totalUSD.toFixed(2)}</span>
        <span className="text-[9px] font-bold text-rose-600">Bs. {totalBs.toFixed(2)}</span>
      </div>
    </div>
  );
}

function CreditApprovalCard({ session, exchangeRate, currentUser, onApprove, onReject }: { 
  key?: any;
  session: any; 
  exchangeRate: number; 
  currentUser?: any;
  onApprove: () => void; 
  onReject: () => void; 
}) {
  const { tables, settings } = useRestaurantData();
  const client = session.pendingPayment?.creditClient || {};
  const totalAmount = session.pendingPayment?.totalUSD || session.totalAmount || 0;

  const isCashierApprovalAllowed = (settings as any)?.allowCashierCreditApproval !== false;
  const isAdmin = currentUser?.role === 'admin' || localStorage.getItem('user_role') === 'admin' || currentUser?.role === 'administrador';
  const isBlockedForCashier = !isCashierApprovalAllowed && !isAdmin;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white rounded-[32px] border border-rose-100 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-100">
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black uppercase tracking-widest text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full">
              💳 Solicitud de Crédito
            </span>
            <span className="text-[9px] font-bold text-slate-400">
              {session.tableId.startsWith('delivery') 
                ? 'Delivery' 
                : (() => {
                    const t = tables.find((item: any) => item.id === session.tableId);
                    if (t) return `Mesa ${t.number}`;
                    if (session.tableNumber) return `Mesa ${session.tableNumber}`;
                    if (session.tableId.length < 10) return `Mesa ${session.tableId}`;
                    return 'Mesa';
                  })()
              }
            </span>
            {session.waiterName && (
              <span className="text-[10px] bg-indigo-50 text-indigo-600 font-extrabold uppercase px-2 py-0.5 rounded-lg">
                👤 Solicitante: {session.waiterName}
              </span>
            )}
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <span className="text-[9px] text-slate-400 uppercase font-bold block">Nombre del Cliente</span>
              <span className="font-bold text-slate-950 text-sm flex items-center gap-1">
                <User size={12} className="text-slate-400" />
                {client.nombre || 'N/A'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[9px] text-slate-400 uppercase font-bold block">Teléfono</span>
                <span className="font-bold font-mono text-indigo-600">{client.tlf || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 uppercase font-bold block">Cédula / ID</span>
                <span className="font-bold font-mono text-slate-800">{client.cedula || 'N/A'}</span>
              </div>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 uppercase font-bold block">Correo Electrónico</span>
              <span className="font-medium text-slate-700">{client.email || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 uppercase font-bold block">Dirección de Domicilio</span>
              <span className="font-medium text-slate-600">{client.direccion || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between bg-slate-50 p-5 rounded-2xl border border-slate-100">
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Monto del Crédito</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-rose-700">${totalAmount.toFixed(2)}</span>
              <span className="text-xs font-bold text-slate-500">Bs. {(totalAmount * exchangeRate).toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200">
            {isBlockedForCashier ? (
              <div className="flex gap-2 items-center text-[10px] text-rose-800 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                <Lock size={14} className="text-rose-600 shrink-0" />
                <span>Solo Administradores pueden autorizar créditos (Desactivado para Cajeros en Ajustes).</span>
              </div>
            ) : (
              <div className="flex gap-2 items-center text-[10px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-100/50">
                <AlertCircle size={14} className="text-amber-600 shrink-0" />
                <span>Esta solicitud requiere validación y aprobación antes de ser registrada.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-6 sm:justify-end">
        <button 
          onClick={() => {
            if (isBlockedForCashier) {
              alert('⚠️ La aprobación/denegación de crédito por el cajero está desactivada en Ajustes. Solicita autorización a un Administrador.');
              return;
            }
            onReject();
          }}
          className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-100 hover:border-rose-100 hover:bg-rose-50 text-rose-500 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
        >
          <X size={14} />
          Denegar Crédito
        </button>

        <button 
          onClick={() => {
            if (isBlockedForCashier) {
              alert('⚠️ La aprobación de crédito por el cajero está desactivada en Ajustes. Solicita autorización a un Administrador.');
              return;
            }
            onApprove();
          }}
          className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
            isBlockedForCashier
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
              : 'bg-black hover:bg-emerald-600 hover:scale-[1.01] text-white shadow-lg shadow-black/10 cursor-pointer'
          }`}
          title={isBlockedForCashier ? 'Requiere aprobación de un Administrador (desactivado para Cajero en Ajustes)' : 'Aprobar Crédito'}
        >
          {isBlockedForCashier ? <Lock size={14} /> : <Check size={14} />}
          {isBlockedForCashier ? 'Requiere Administrador' : 'Aprobar Crédito'}
        </button>
      </div>
    </motion.div>
  );
}
