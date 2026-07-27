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
  getDoc
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
  ShoppingBag
} from 'lucide-react';
import { useRestaurantData } from '../hooks/useRestaurantData';
import { playClickSound, playCashSound, playSuccessSound, playErrorSound } from '../lib/audio';

export default function CajaView({ currentUser }: { currentUser?: any }) {
  const { settings, tables } = useRestaurantData();
  const exchangeRate = settings?.exchangeRate || 40;

  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [validatedSessions, setValidatedSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'validation' | 'tables' | 'delivery_pickup' | 'credits'>('validation');

  const [viewingDeliveryOrder, setViewingDeliveryOrder] = useState<any | null>(null);
  const [deliveryOrders, setDeliveryOrders] = useState<any[]>([]);

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
      const allCompleted = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setValidatedSessions(allCompleted);
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
        `Cliente: ${payerName} - Total: $${totalAmount.toFixed(2)} - Método: ${paymentMethod.toUpperCase()}`
      );

      // Record transaction
      const mixedPayments = session.pendingPayment?.mixedPayments;
      if (paymentMethod === 'mixto' && mixedPayments) {
        for (const mp of mixedPayments) {
          await addDoc(collection(db, 'transactions'), {
            sessionId: session.id,
            accountId: accountId,
            amount: mp.amountUSD,
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
          amount: totalAmount,
          method: paymentMethod,
          timestamp: new Date().toISOString(),
          approvedBy: 'Caja'
        });
      }

      let resolvedClientId = session.pendingPayment?.creditClient?.clientId || session.pendingPayment?.client?.clientId || null;
      if (paymentMethod === 'credito' && session.pendingPayment?.creditClient) {
        const resId = await processClientCreditDebt(session.pendingPayment.creditClient, totalAmount);
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

      // If it is a delivery session, we must also push all its orders to 'pending' (sent to kitchen)
      if (isDelivery) {
        const ordersRef = collection(db, 'sessions', session.id, 'accounts', 'default', 'orders');
        const orderSnaps = await getDocs(ordersRef);
        const promises = orderSnaps.docs.map(orderDoc => {
          return updateDoc(doc(db, 'sessions', session.id, 'accounts', 'default', 'orders', orderDoc.id), {
            status: 'pending' // Enters kitchen queue
          });
        });
        await Promise.all(promises);
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
    <div className="max-w-7xl mx-auto pb-16 px-4 sm:px-6 w-full min-w-0 overflow-x-hidden md:overflow-x-visible">
      <header className="mb-8 border-b border-slate-200/60 pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:pr-40">
        <div>
          <span className="text-[10px] uppercase tracking-widest font-black text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100 inline-block mb-1.5">
            Módulo de Punto de Venta & Facturación
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">Control de Caja</h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Cajero(a) activo: <strong className="text-indigo-600 font-extrabold">{currentUser?.name || localStorage.getItem('demo_user_name') || 'Caja'}</strong>
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-amber-50 text-amber-700 border border-amber-200/80 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse"></span>
            Recepción & Verificación Activa
          </div>
        </div>
      </header>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-1">Total Conciliado Hoy</span>
            <div className="text-3xl font-black text-slate-900">${totalReconciled.toFixed(2)}</div>
          </div>
          <div className="text-xs text-rose-600 font-bold mt-2">
            Bs. {(totalReconciled * exchangeRate).toFixed(2)}
          </div>
        </div>

        <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-1">Pagos Pendientes</span>
            <div className="text-3xl font-black text-indigo-600 flex items-center gap-2">
              {pendingSessions.length}
              {pendingSessions.length > 0 && (
                <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-ping" />
              )}
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2 font-medium">Bancos / Móvil / Zelle esperando confirmación.</p>
        </div>

        <div className="bg-black text-white p-6 rounded-[28px] shadow-xl flex flex-col justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-1">Tasa de Cambio</span>
            <div className="text-3xl font-black">Bs. {exchangeRate.toFixed(2)}</div>
          </div>
          <p className="text-xs text-slate-400 mt-2">Usado para la conversión de bolívares en cobros.</p>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex gap-6 border-b border-slate-100 mb-8 pb-4 overflow-x-auto whitespace-nowrap w-full scrollbar-none">
        <button 
          onClick={() => setActiveTab('validation')}
          className={`pb-2 px-1 font-bold text-sm tracking-wide transition-colors relative ${activeTab === 'validation' ? 'text-black font-black' : 'text-slate-400 hover:text-black'}`}
        >
          Validación de Pagos ({pendingSessions.length})
          {activeTab === 'validation' && (
            <motion.div layoutId="activeTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />
          )}
        </button>
        <button 
          onClick={() => setActiveTab('tables')}
          className={`pb-2 px-1 font-bold text-sm tracking-wide transition-colors relative ${activeTab === 'tables' ? 'text-black font-black' : 'text-slate-400 hover:text-black'}`}
        >
          Mesas & Cuentas de Sala ({dineInSessions.length})
          {activeTab === 'tables' && (
            <motion.div layoutId="activeTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />
          )}
        </button>
        <button 
          onClick={() => setActiveTab('delivery_pickup')}
          className={`pb-2 px-1 font-bold text-sm tracking-wide transition-colors relative ${activeTab === 'delivery_pickup' ? 'text-black font-black' : 'text-slate-400 hover:text-black'}`}
        >
          Delivery & Pickup ({deliveryPickupSessions.length})
          {activeTab === 'delivery_pickup' && (
            <motion.div layoutId="activeTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />
          )}
        </button>
        <button 
          onClick={() => setActiveTab('credits')}
          className={`pb-2 px-1 font-bold text-sm tracking-wide transition-colors relative ${activeTab === 'credits' ? 'text-black font-black' : 'text-slate-400 hover:text-black'}`}
        >
          Aprobación de Créditos ({creditSessions.length})
          {activeTab === 'credits' && (
            <motion.div layoutId="activeTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />
          )}
        </button>
      </div>

      {/* TAB RENDERS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* Left column / core list depending on tab */}
        <div className="lg:col-span-2 space-y-6">
          
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
                return (
                  <div 
                    key={session.id} 
                    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-bold text-sm block text-slate-900 line-clamp-1">{displayName}</span>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {session.payment?.timestamp 
                            ? new Date(session.payment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : 'N/A'
                          }
                        </span>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${isCredit ? 'text-purple-600 bg-purple-50' : 'text-emerald-600 bg-emerald-50'}`}>
                        +${(session.payment?.totalUSD || session.totalAmount || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] border-t border-slate-50 pt-2 text-slate-400">
                      <span className="capitalize">Método: {session.payment?.method || session.paymentMethod || 'Pago'}</span>
                      <span>Bs. {((session.payment?.totalUSD || session.totalAmount || 0) * exchangeRate).toFixed(2)}</span>
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

      {/* CONFIRMATION APPROVED/REJECTED MODALS */}
      <AnimatePresence>
        {confirmingSession && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[40px] p-8 w-full max-w-md shadow-2xl relative"
            >
              <button 
                onClick={() => setConfirmingSession(null)}
                className="absolute top-6 right-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                disabled={isProcessing}
              >
                <X size={20} />
              </button>

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
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => setViewingDeliveryOrder(null)}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 p-4 rounded-xl font-bold text-sm transition-colors"
                >
                  Cerrar
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
              {session.tableId.startsWith('delivery') ? 'Delivery' : `Mesa ${session.tableId}`}
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
                {session.customerAddress}
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

function CajaTableSessionCard({ session, tables, exchangeRate, onViewDelivery }: { key?: any; session: any; tables: any[]; exchangeRate: number; onViewDelivery?: (session: any) => void }) {
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
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
          <Clock size={12} />
          <span>Inició: {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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

function CreditApprovalCard({ session, exchangeRate, onApprove, onReject }: { 
  key?: any;
  session: any; 
  exchangeRate: number; 
  onApprove: () => void; 
  onReject: () => void; 
}) {
  const client = session.pendingPayment?.creditClient || {};
  const totalAmount = session.pendingPayment?.totalUSD || session.totalAmount || 0;

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
              {session.tableId.startsWith('delivery') ? 'Delivery' : `Mesa ${session.tableId}`}
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
            <div className="flex gap-2 items-center text-[10px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-100/50">
              <AlertCircle size={14} className="text-amber-600 shrink-0" />
              <span>Esta solicitud requiere validación y aprobación de caja antes de ser registrada.</span>
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
          Denegar Crédito
        </button>

        <button 
          onClick={onApprove}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-black hover:bg-emerald-600 hover:scale-[1.01] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-black/10"
        >
          <Check size={14} />
          Aprobar Crédito
        </button>
      </div>
    </motion.div>
  );
}
