import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Phone, 
  MapPin, 
  UserPlus, 
  Trash2, 
  Smile, 
  Frown, 
  Meh, 
  Coins, 
  Search, 
  Plus, 
  CheckCircle,
  TrendingUp,
  AlertCircle,
  Calendar,
  DollarSign,
  ShoppingBag,
  Clipboard,
  Check,
  Edit,
  Save,
  X,
  MessageCircle,
  ExternalLink,
  Award,
  Clock,
  Utensils,
  ChevronRight,
  ChevronLeft,
  Filter,
  ArrowUpDown,
  ArrowLeft,
  Star
} from 'lucide-react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, collectionGroup } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { useBookmarks } from '../lib/bookmarks';

export default function CRMView() {
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const [clients, setClients] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'vip' | 'debtors' | 'frequent' | 'new'>('all');
  const [orderByField, setOrderByField] = useState<'name' | 'spend' | 'orders' | 'debt' | 'date'>('name');
  
  const [isLoading, setIsLoading] = useState(true);
  const [activeProfileTab, setActiveProfileTab] = useState<'history' | 'details'>('history');

  // Listen for global search selection
  useEffect(() => {
    const handleSelectCustomer = (e: any) => {
      if (e.detail?.clientId) {
        setSelectedClientId(e.detail.clientId);
      }
    };
    window.addEventListener('select_customer', handleSelectCustomer);
    return () => window.removeEventListener('select_customer', handleSelectCustomer);
  }, []);
  
  // Registration Modal State
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [cliName, setCliName] = useState('');
  const [cliPhone, setCliPhone] = useState('');
  const [cliAddress, setCliAddress] = useState('');
  const [cliCedula, setCliCedula] = useState('');
  const [cliCorreo, setCliCorreo] = useState('');
  const [cliSentiment, setCliSentiment] = useState<'happy' | 'neutral' | 'sad'>('happy');
  const [cliNotes, setCliNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCedula, setEditCedula] = useState('');
  const [editCorreo, setEditCorreo] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saveSuccessFeedback, setSaveSuccessFeedback] = useState(false);
  
  // Clipboard copy state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);

  // Saldar Deuda Modal State
  const [isSaldarModalOpen, setIsSaldarModalOpen] = useState(false);
  const [saldarClient, setSaldarClient] = useState<any | null>(null);
  const [saldarMethod, setSaldarMethod] = useState<'cash' | 'pago_movil' | 'zelle'>('cash');
  const [saldarAmount, setSaldarAmount] = useState<string>('0');
  const [saldarReference, setSaldarReference] = useState('');

  // Load core collections
  useEffect(() => {
    const unsubClients = onSnapshot(collection(db, 'clients'), (snap) => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    });

    const unsubSessions = onSnapshot(collection(db, 'sessions'), (snap) => {
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubOrders = onSnapshot(collectionGroup(db, 'orders'), (snap) => {
      setAllOrders(snap.docs.map(d => ({ id: d.id, path: d.ref.path, ...d.data() })));
    });

    return () => {
      unsubClients();
      unsubSessions();
      unsubOrders();
    };
  }, []);

  // Selected client is null by default so that the full client list table is shown first.

  // Compute calculated values for each client (LTV, total orders, relationship status)
  const enrichedClients = useMemo(() => {
    return clients.map(client => {
      const cleanPhone = client.phone ? client.phone.replace(/\D/g, '') : '';
      const clientNameLower = client.name ? client.name.toLowerCase().trim() : '';

      // Match sessions by multiple criteria: Client ID, Cedula, Name, or Phone
      const clientSessions = sessions.filter((s: any) => {
        const clientCedulaLower = client.cedula ? client.cedula.toString().trim().toLowerCase() : '';

        // 1. Direct Client ID Match (including s.clientId)
        const sClientId = s.clientId || 
                          s.payment?.creditClient?.clientId || 
                          s.pendingPayment?.creditClient?.clientId || 
                          s.payment?.client?.clientId || 
                          s.pendingPayment?.client?.clientId;
        if (sClientId && sClientId === client.id) return true;

        // 2. Cedula Match
        const sCedula = s.payment?.creditClient?.cedula || 
                        s.pendingPayment?.creditClient?.cedula || 
                        s.payment?.client?.cedula || 
                        s.pendingPayment?.client?.cedula ||
                        s.cedula;
        if (clientCedulaLower && sCedula) {
          const c1 = clientCedulaLower.replace(/\D/g, '');
          const c2 = sCedula.toString().trim().replace(/\D/g, '');
          if (c1 && c2 && c1 === c2) return true;
        }

        // 3. Name Match (Fuzzy / overlapping match)
        const sNameLower = (s.customerName || '').toLowerCase().trim();
        const sCreditNameLower = (s.payment?.creditClient?.nombre || 
                                  s.pendingPayment?.creditClient?.nombre || 
                                  s.payment?.client?.nombre || 
                                  s.pendingPayment?.client?.nombre || '').toLowerCase().trim();

        const cleanWords = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 2);
        
        const isFuzzyMatch = (a: string, b: string) => {
          if (!a || !b) return false;
          const wordsA = cleanWords(a);
          const wordsB = cleanWords(b);
          if (wordsA.length === 0 || wordsB.length === 0) return false;
          
          let overlaps = 0;
          for (const wA of wordsA) {
            for (const wB of wordsB) {
              if (wA === wB || (wA.length >= 5 && wB.length >= 5 && (wA.startsWith(wB.substring(0, 5)) || wB.startsWith(wA.substring(0, 5))))) {
                overlaps++;
              }
            }
          }
          return overlaps >= 1;
        };

        const hasNameMatch = isFuzzyMatch(sNameLower, clientNameLower) || 
                             isFuzzyMatch(sCreditNameLower, clientNameLower);

        // 4. Phone Match
        const sPhones = [
          s.customerPhone,
          s.payment?.creditClient?.tlf,
          s.pendingPayment?.creditClient?.tlf,
          s.payment?.client?.tlf,
          s.pendingPayment?.client?.tlf,
          s.phone
        ].map(p => p ? p.toString().replace(/\D/g, '') : '').filter(Boolean);

        const hasPhoneMatch = cleanPhone && sPhones.some(sp => sp && (sp.includes(cleanPhone) || cleanPhone.includes(sp)));

        return hasNameMatch || hasPhoneMatch;
      });

      // Filter completed/paid sessions to calculate total spend
      const completedSessions = clientSessions.filter((s: any) => 
        s.status === 'completed' || s.status === 'closed' || s.paymentStatus === 'validated'
      );

      const totalSpend = completedSessions.reduce((sum, s) => {
        const amt = s.totalAmount !== undefined && s.totalAmount !== null && s.totalAmount > 0 
          ? s.totalAmount 
          : (s.payment?.totalUSD || s.pendingPayment?.totalUSD || 0);
        return sum + amt;
      }, 0);
      const totalOrdersCount = clientSessions.length;
      const averageOrderValue = totalOrdersCount > 0 ? totalSpend / totalOrdersCount : 0;

      // Status tags
      const isVIP = totalSpend >= 150 || (totalOrdersCount >= 5 && client.sentiment === 'happy');
      const isFrequent = totalOrdersCount >= 3;
      const isNew = client.createdAt ? (Date.now() - new Date(client.createdAt).getTime()) < 7 * 24 * 60 * 60 * 1000 : false;
      const isDebtor = (client.debt || 0) > 0;

      return {
        ...client,
        sessions: clientSessions,
        totalSpend,
        totalOrdersCount,
        averageOrderValue,
        isVIP,
        isFrequent,
        isNew,
        isDebtor
      };
    });
  }, [clients, sessions]);

  // Filter and sort clients list
  const filteredClients = useMemo(() => {
    let list = enrichedClients.filter(c => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        (c.name || '').toLowerCase().includes(query) ||
        (c.phone || '').includes(query) ||
        (c.address || '').toLowerCase().includes(query);

      if (!matchesSearch) return false;

      switch (activeFilter) {
        case 'vip':
          return c.isVIP;
        case 'debtors':
          return c.isDebtor;
        case 'frequent':
          return c.isFrequent;
        case 'new':
          return c.isNew;
        case 'all':
        default:
          return true;
      }
    });

    // Apply sorting
    return [...list].sort((a, b) => {
      switch (orderByField) {
        case 'spend':
          return b.totalSpend - a.totalSpend;
        case 'orders':
          return b.totalOrdersCount - a.totalOrdersCount;
        case 'debt':
          return (b.debt || 0) - (a.debt || 0);
        case 'date':
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        case 'name':
        default:
          return (a.name || '').localeCompare(b.name || '');
      }
    });
  }, [enrichedClients, searchQuery, activeFilter, orderByField]);

  // Selected client details
  const selectedClient = useMemo(() => {
    return enrichedClients.find(c => c.id === selectedClientId) || null;
  }, [enrichedClients, selectedClientId]);

  // Sync profile editing fields when client changes or editing begins
  useEffect(() => {
    if (selectedClient) {
      setEditName(selectedClient.name || '');
      setEditPhone(selectedClient.phone || '');
      setEditAddress(selectedClient.address || '');
      setEditCedula(selectedClient.cedula || '');
      setEditCorreo(selectedClient.correo || '');
      setEditNotes(selectedClient.notes || '');
    }
  }, [selectedClient, isEditingProfile]);

  // Extract individual ordered items from allOrders belonging to the selected client's sessions
  const selectedClientOrdersWithItems = useMemo(() => {
    if (!selectedClient) return [];

    const sessionIds = selectedClient.sessions.map((s: any) => s.id);
    
    return selectedClient.sessions.map((session: any) => {
      // Find orders matching this sessionId (from path prefix or explicit field)
      const items = allOrders.filter(o => {
        if (o.sessionId === session.id) return true;
        if (o.path) {
          const parts = o.path.split('/');
          return parts[1] === session.id;
        }
        return false;
      });

      return {
        ...session,
        items
      };
    }).sort((a: any, b: any) => new Date(b.startTime || 0).getTime() - new Date(a.startTime || 0).getTime());
  }, [selectedClient, allOrders]);

  // Create client
  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!cliName.trim() || !cliPhone.trim()) {
      setFormError('El nombre y el teléfono son campos requeridos.');
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'clients'), {
        name: cliName.trim(),
        phone: cliPhone.trim(),
        address: cliAddress.trim(),
        cedula: cliCedula.trim(),
        correo: cliCorreo.trim(),
        sentiment: cliSentiment,
        debt: 0,
        notes: cliNotes.trim(),
        createdAt: new Date().toISOString()
      });
      
      // Select the newly added client automatically
      setSelectedClientId(docRef.id);
      
      // Reset form & close modal
      setCliName('');
      setCliPhone('');
      setCliAddress('');
      setCliCedula('');
      setCliCorreo('');
      setCliSentiment('happy');
      setCliNotes('');
      setIsAddingClient(false);
    } catch (err) {
      console.error('Error adding client:', err);
      setFormError('Hubo un error al registrar el cliente.');
    }
  };

  // Update client details
  const handleUpdateClient = async () => {
    if (!selectedClientId) return;
    try {
      await updateDoc(doc(db, 'clients', selectedClientId), {
        name: editName.trim(),
        phone: editPhone.trim(),
        address: editAddress.trim(),
        cedula: editCedula.trim(),
        correo: editCorreo.trim(),
        notes: editNotes.trim()
      });
      setIsEditingProfile(false);
      setSaveSuccessFeedback(true);
      setTimeout(() => setSaveSuccessFeedback(false), 3000);
    } catch (err) {
      console.error('Error updating client profile:', err);
    }
  };

  // Quick Save Comments only
  const handleSaveNotesOnly = async () => {
    if (!selectedClientId) return;
    try {
      await updateDoc(doc(db, 'clients', selectedClientId), {
        notes: editNotes.trim()
      });
      setSaveSuccessFeedback(true);
      setTimeout(() => setSaveSuccessFeedback(false), 3000);
    } catch (err) {
      console.error('Error saving comments:', err);
    }
  };

  // Open modal to clear/saldar client debt
  const openSaldarModal = (client: any) => {
    setSaldarClient(client);
    setSaldarAmount(Number(client.debt || 0).toFixed(2));
    setSaldarMethod('cash');
    setSaldarReference('');
    setIsSaldarModalOpen(true);
  };

  const handleSaldarDeudaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saldarClient) return;

    const amountPaid = Number(saldarAmount);
    if (isNaN(amountPaid) || amountPaid <= 0) {
      alert('Por favor ingrese un monto válido para saldar.');
      return;
    }

    try {
      const remainingDebt = Math.max(0, (saldarClient.debt || 0) - amountPaid);
      
      // 1. Update client's debt in firestore
      await updateDoc(doc(db, 'clients', saldarClient.id), {
        debt: remainingDebt
      });

      // 2. Add manual finance entry as income (Cobro de Crédito)
      await addDoc(collection(db, 'finance_entries'), {
        type: 'income',
        category: 'Cobro de Crédito',
        amount: amountPaid,
        description: `Cobro de crédito saldado desde CRM para ${saldarClient.name}${saldarReference ? ` (Ref: ${saldarReference})` : ''}`,
        timestamp: new Date().toISOString(),
        isFiscal: false,
        paymentMethod: saldarMethod,
        isAutomatic: false
      });

      // 3. Add to general cash desk transactions
      await addDoc(collection(db, 'transactions'), {
        sessionId: `crm-debt-${saldarClient.id}-${Date.now()}`,
        amount: amountPaid,
        method: saldarMethod,
        reference: saldarReference || 'Cobro CRM',
        timestamp: new Date().toISOString(),
        approvedBy: 'CRM (Caja)',
        clientId: saldarClient.id,
        clientName: saldarClient.name
      });

      setIsSaldarModalOpen(false);
      setSaldarClient(null);
    } catch (err) {
      console.error('Error processing debt payment:', err);
      alert('Error procesando el abono de deuda.');
    }
  };

  // Delete client
  const handleDeleteClient = async (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar permanentemente este cliente de la base de datos? Se borrará su historial del CRM.')) {
      try {
        await deleteDoc(doc(db, 'clients', id));
        setSelectedClientId(null);
      } catch (err) {
        console.error('Error deleting client:', err);
      }
    }
  };

  // Update Client Sentiment
  const updateClientSentiment = async (id: string, sent: 'happy' | 'neutral' | 'sad') => {
    try {
      await updateDoc(doc(db, 'clients', id), { sentiment: sent });
    } catch (err) {
      console.error('Error updating sentiment:', err);
    }
  };

  // Copy to clipboard helper
  const copyToClipboard = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // General metrics for the entire CRM dashboard
  const globalMetrics = useMemo(() => {
    const totalCount = enrichedClients.length;
    const happyCount = enrichedClients.filter(c => c.sentiment === 'happy').length;
    const happyPercent = totalCount > 0 ? Math.round((happyCount / totalCount) * 100) : 100;
    const totalDebtAmount = enrichedClients.reduce((sum, c) => sum + (c.debt || 0), 0);
    
    // Average lifetime spend
    const clientsWithSpend = enrichedClients.filter(c => c.totalSpend > 0);
    const averageLTV = clientsWithSpend.length > 0 
      ? clientsWithSpend.reduce((sum, c) => sum + c.totalSpend, 0) / clientsWithSpend.length 
      : 0;

    return {
      totalCount,
      happyPercent,
      totalDebtAmount,
      averageLTV
    };
  }, [enrichedClients]);

  // Color generator for avatar badges based on initials
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-indigo-100 text-indigo-700 border-indigo-200',
      'bg-emerald-100 text-emerald-700 border-emerald-200',
      'bg-amber-100 text-amber-700 border-amber-200',
      'bg-rose-100 text-rose-700 border-rose-200',
      'bg-sky-100 text-sky-700 border-sky-200',
      'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
      'bg-slate-100 text-slate-700 border-slate-200'
    ];
    const code = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
    return colors[code % colors.length];
  };

  return (
    <div className="w-full space-y-6 flex-1 flex flex-col min-h-0 pb-16" id="crm-enterprise-view">
      
      {/* SECTION HEADER */}
      <div className="border-b border-slate-200/60 pb-5 shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:pr-40">
        <div>
          <span className="text-[10px] uppercase font-black tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 inline-block mb-1.5">
            Módulo Comercial de Alto Rendimiento
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">CRM 360 de Clientes</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">Visión integrada de deudas, valor de vida (LTV), historial de compras y comentarios.</p>
        </div>
        
        {/* Register client trigger */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button 
            onClick={() => setIsAddingClient(true)}
            className="bg-black hover:bg-slate-800 text-white font-bold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md transition-all cursor-pointer"
          >
            <UserPlus size={16} />
            <span>Registrar Cliente</span>
          </button>
        </div>
      </div>

      {/* GLOBAL METRICS / CLIENT METRICS BENTO GRID */}
      {!selectedClient ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Users size={22} />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider truncate">Clientes Totales</span>
              <span className="text-xl font-black text-slate-900 tracking-tight mt-0.5">{globalMetrics.totalCount}</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Smile size={22} />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider truncate">Índice Satisfacción</span>
              <span className="text-xl font-black text-emerald-600 tracking-tight mt-0.5">{globalMetrics.happyPercent}%</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <Coins size={22} />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider truncate">Cuentas por Cobrar</span>
              <span className="text-xl font-black text-rose-600 tracking-tight mt-0.5">${globalMetrics.totalDebtAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <TrendingUp size={22} />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider truncate">LTV Promedio</span>
              <span className="text-xl font-black text-slate-900 tracking-tight mt-0.5">${globalMetrics.averageLTV.toFixed(2)}</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* MAIN LAYOUT */}
      <div className="flex-1 flex flex-col min-h-0">
        {!selectedClient ? (
          <>
            {/* SEARCH, SORTING & FILTERS CONTAINER */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4 mb-6 shrink-0">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                
                {/* Search Input */}
                <div className="relative w-full md:max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text"
                    placeholder="Buscar por nombre, teléfono, dirección..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200/60 focus:border-black outline-none rounded-xl text-xs font-semibold placeholder:text-slate-400 transition-colors"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black font-extrabold text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Order selector */}
                <div className="flex items-center gap-1.5 self-end md:self-auto text-xs font-bold text-slate-500">
                  <ArrowUpDown size={13} className="text-slate-400" />
                  <span className="text-slate-400">Ordenar por:</span>
                  <select
                    value={orderByField}
                    onChange={e => setOrderByField(e.target.value as any)}
                    className="bg-slate-50 px-3 py-1.5 border border-slate-200/60 rounded-xl text-slate-700 outline-none cursor-pointer hover:text-black font-extrabold text-xs"
                  >
                    <option value="name">Nombre A-Z</option>
                    <option value="spend">Mayor Consumo ($)</option>
                    <option value="orders">Más Pedidos</option>
                    <option value="debt">Mayor Deuda</option>
                    <option value="date">Registro Reciente</option>
                  </select>
                </div>

              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100/60">
                {/* Quick Filters Horizontal list */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide text-xs">
                  {[
                    { id: 'all', label: 'Todos los Clientes' },
                    { id: 'vip', label: '⭐ VIP' },
                    { id: 'debtors', label: '⚠️ Con Deuda' },
                    { id: 'frequent', label: '🔄 Frecuentes' },
                    { id: 'new', label: '📅 Nuevos' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveFilter(tab.id as any)}
                      className={`px-4 py-2 rounded-full font-black border uppercase tracking-wider whitespace-nowrap transition-all text-[10px] ${
                        activeFilter === tab.id
                          ? 'bg-black text-white border-black shadow-sm'
                          : 'bg-slate-50 text-slate-500 border-slate-200/50 hover:bg-slate-100 hover:text-slate-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <span className="text-xs font-black text-slate-400">
                  {filteredClients.length} {filteredClients.length === 1 ? 'cliente encontrado' : 'clientes encontrados'}
                </span>
              </div>
            </div>

            {/* CLIENTS TABLE */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-x-auto overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-black uppercase tracking-wider text-slate-400 select-none">
                      <th className="py-4 px-6">Cliente</th>
                      <th className="py-4 px-6">Teléfono</th>
                      <th className="py-4 px-6 text-center">Humor</th>
                      <th className="py-4 px-6 text-center">Pedidos</th>
                      <th className="py-4 px-6 text-right">Consumo Total</th>
                      <th className="py-4 px-6 text-right">Saldo por Cobrar</th>
                      <th className="py-4 px-6 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredClients.map(client => {
                      const initials = (client.name || 'C').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
                      const isStarred = isBookmarked(client.id, 'client');
                      return (
                        <tr 
                          key={client.id}
                          onClick={() => {
                            setSelectedClientId(client.id);
                            setIsEditingProfile(false);
                          }}
                          className="hover:bg-slate-50/50 cursor-pointer transition-colors group"
                        >
                          {/* Name and avatar info */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3.5 min-w-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleBookmark({
                                    id: client.id,
                                    type: 'client',
                                    name: client.name || 'Cliente',
                                    details: `Tel: ${client.phone || 'N/A'}`
                                  });
                                }}
                                className={`p-1.5 rounded-lg transition-all shrink-0 ${
                                  isStarred 
                                    ? 'text-amber-500 bg-amber-50' 
                                    : 'text-slate-300 hover:text-amber-400 opacity-40 group-hover:opacity-100 hover:bg-slate-100'
                                }`}
                                title={isStarred ? "Quitar de Marcadores" : "Añadir a Marcadores"}
                              >
                                <Star size={14} className={isStarred ? "fill-amber-400 text-amber-500" : ""} />
                              </button>
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 border uppercase tracking-wider ${getAvatarColor(client.name || 'C')}`}>
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <span className="font-extrabold text-slate-900 group-hover:text-black block truncate mb-1">
                                  {client.name}
                                </span>
                                <div className="flex gap-1.5 flex-wrap">
                                  {client.isVIP && (
                                    <span className="text-[8px] font-black bg-amber-100 text-amber-800 border border-amber-200/40 uppercase tracking-widest px-1.5 py-0.2 rounded">
                                      VIP
                                    </span>
                                  )}
                                  {client.isFrequent && !client.isVIP && (
                                    <span className="text-[8px] font-black bg-purple-100 text-purple-800 border border-purple-200/40 uppercase tracking-widest px-1.5 py-0.2 rounded">
                                      Frecuente
                                    </span>
                                  )}
                                  {client.isNew && (
                                    <span className="text-[8px] font-black bg-sky-100 text-sky-800 border border-sky-200/40 uppercase tracking-widest px-1.5 py-0.2 rounded">
                                      Nuevo
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Phone */}
                          <td className="py-4 px-6 font-bold font-mono text-slate-500 whitespace-nowrap">
                            {client.phone}
                          </td>

                          {/* Humor Sentiment */}
                          <td className="py-4 px-6 text-center whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-50 border border-slate-100">
                              <span>{client.sentiment === 'happy' ? '😄' : client.sentiment === 'sad' ? '😞' : '😐'}</span>
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                                {client.sentiment === 'happy' ? 'Satisfecho' : client.sentiment === 'sad' ? 'Detractor' : 'Neutral'}
                              </span>
                            </span>
                          </td>

                          {/* Pedidos count */}
                          <td className="py-4 px-6 text-center">
                            <span className="inline-block text-[10px] font-black text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                              {client.totalOrdersCount} ped.
                            </span>
                          </td>

                          {/* Consumo total */}
                          <td className="py-4 px-6 text-right font-black font-mono text-indigo-600 whitespace-nowrap">
                            ${client.totalSpend.toFixed(2)}
                          </td>

                          {/* Outstanding debt */}
                          <td className="py-4 px-6 text-right font-black font-mono whitespace-nowrap">
                            {client.debt > 0 ? (
                              <span className="text-rose-600 bg-rose-50 border border-rose-100/70 px-2 py-1 rounded-lg">
                                ${client.debt.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal italic text-[11px]">
                                Saldado
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-6 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => {
                                  setSelectedClientId(client.id);
                                  setIsEditingProfile(false);
                                }}
                                className="px-3 py-1.5 bg-black hover:bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-transform active:scale-95 shadow-sm"
                              >
                                Ver Perfil
                              </button>
                              <button
                                onClick={() => handleDeleteClient(client.id)}
                                className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 rounded-xl transition-all shadow-sm"
                                title="Eliminar del CRM"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredClients.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-20 px-4 text-slate-400 bg-slate-50/20">
                          <Users className="mx-auto text-slate-300 mb-2.5 animate-pulse" size={36} />
                          <p className="text-sm font-black text-slate-700">No se encontraron clientes</p>
                          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Prueba ajustando el término de búsqueda o seleccionando otro filtro de relación.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          /* ACTIVE 360° CLIENT PROFILE BOARD (FULL SCREEN DETAILED PROFILE VIEW) */
          <div className="flex-1 flex flex-col min-h-0">
            
            {/* VOLVER HEADER PANEL */}
            <div className="mb-5 flex items-center shrink-0">
              <button 
                onClick={() => setSelectedClientId(null)}
                className="flex items-center gap-2 text-slate-500 hover:text-black font-extrabold text-xs transition-all active:scale-95 group"
              >
                <ChevronLeft size={16} className="text-slate-500 group-hover:-translate-x-0.5 transition-transform" />
                <span className="uppercase tracking-widest text-[10px]">Volver al Directorio de Clientes</span>
              </button>
            </div>

            <motion.div 
              key={selectedClient.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col min-h-0"
            >
              
              {/* BEAUTIFUL PROFILE CARD */}
              <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start justify-between gap-6 md:gap-8 shrink-0 relative overflow-hidden">
                <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-4 flex-1 w-full">
                  <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
                    {/* Big Avatar with initials */}
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center font-black text-2xl shadow-sm border-4 border-slate-50 ${getAvatarColor(selectedClient.name || 'C')}`}>
                      {(selectedClient.name || 'C').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
                        <h2 className="text-2xl font-black text-slate-900 leading-tight tracking-tight">
                          {selectedClient.name}
                        </h2>
                        
                        <div className="flex gap-1 shrink-0">
                          {selectedClient.isVIP && (
                            <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-200/50">
                              VIP
                            </span>
                          )}
                          {selectedClient.isFrequent && !selectedClient.isVIP && (
                            <span className="bg-purple-100 text-purple-800 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-purple-200/50">
                              Frecuente
                            </span>
                          )}
                          {selectedClient.isDebtor && (
                            <span className="bg-rose-100 text-rose-800 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-rose-200/50">
                              Deudor
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-slate-400 text-xs font-semibold font-mono">
                        {selectedClient.correo || 'Sin correo registrado'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Pill Badges with contact info */}
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-2">
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 text-slate-600 px-3 py-1.5 rounded-full text-xs font-bold font-mono shadow-sm">
                      <Phone size={12} className="text-slate-400" />
                      <span>{selectedClient.phone}</span>
                    </div>
                    {selectedClient.cedula && (
                      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 text-slate-600 px-3 py-1.5 rounded-full text-xs font-bold font-mono shadow-sm">
                        <span className="text-[9px] font-black uppercase text-slate-400">CI:</span>
                        <span>{selectedClient.cedula}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 text-slate-600 px-3 py-1.5 rounded-full text-xs font-bold font-mono shadow-sm">
                      <Calendar size={12} className="text-slate-400" />
                      <span>Reg: {selectedClient.createdAt ? new Date(selectedClient.createdAt).toLocaleDateString() : 'N/A'}</span>
                    </div>
                    <div className={`flex items-center gap-1.5 border px-3 py-1.5 rounded-full text-xs font-bold shadow-sm ${
                      selectedClient.sentiment === 'happy' 
                        ? 'bg-emerald-50/50 border-emerald-100 text-emerald-700' 
                        : selectedClient.sentiment === 'sad'
                        ? 'bg-rose-50/50 border-rose-100 text-rose-700'
                        : 'bg-amber-50/50 border-amber-100 text-amber-700'
                    }`}>
                      <span>{selectedClient.sentiment === 'happy' ? '😄' : selectedClient.sentiment === 'sad' ? '😞' : '😐'}</span>
                      <span className="text-[10px] uppercase tracking-wider font-black">
                        {selectedClient.sentiment === 'happy' ? 'Satisfecho' : selectedClient.sentiment === 'sad' ? 'Detractor' : 'Neutral'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sentiment Quick Actions Area */}
                <div className="flex flex-col items-center md:items-end justify-between gap-4 md:self-stretch w-full md:w-auto shrink-0">
                  {/* Interactive Sentiment pills */}
                  <div className="flex bg-slate-50/85 border border-slate-150 rounded-2xl p-1 shadow-inner items-center">
                    <button 
                      onClick={() => updateClientSentiment(selectedClient.id, 'happy')}
                      className={`p-2 rounded-xl transition-all ${
                        selectedClient.sentiment === 'happy' 
                          ? 'bg-white text-emerald-600 shadow-sm' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                      title="Humor: Muy Contento"
                    >
                      <Smile size={18} />
                    </button>
                    <button 
                      onClick={() => updateClientSentiment(selectedClient.id, 'neutral')}
                      className={`p-2 rounded-xl transition-all ${
                        selectedClient.sentiment === 'neutral' 
                          ? 'bg-white text-amber-600 shadow-sm' 
                          : 'text-slate-400 hover:text-slate-500'
                      }`}
                      title="Humor: Neutral"
                    >
                      <Meh size={18} />
                    </button>
                    <button 
                      onClick={() => updateClientSentiment(selectedClient.id, 'sad')}
                      className={`p-2 rounded-xl transition-all ${
                        selectedClient.sentiment === 'sad' 
                          ? 'bg-white text-rose-600 shadow-sm' 
                          : 'text-slate-400 hover:text-rose-500'
                      }`}
                      title="Humor: Insatisfecho"
                    >
                      <Frown size={18} />
                    </button>
                  </div>

                  {/* Edit and Delete buttons */}
                  <div className="flex items-center gap-2.5 w-full md:w-auto justify-center md:justify-end">
                    <button 
                      onClick={() => setIsEditingProfile(!isEditingProfile)}
                      className={`px-4.5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2.5 shadow-sm active:scale-[0.98] ${
                        isEditingProfile
                          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/50'
                          : 'bg-black hover:bg-slate-900 text-white'
                      }`}
                    >
                      {isEditingProfile ? (
                        <>
                          <X size={13} />
                          Cancelar Edición
                        </>
                      ) : (
                        <>
                          <Edit size={13} />
                          Editar Datos
                        </>
                      )}
                    </button>

                    <button 
                      onClick={() => handleDeleteClient(selectedClient.id)}
                      className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-100 rounded-2xl transition-all shadow-sm active:scale-[0.98]"
                      title="Eliminar cliente del CRM"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* TWO-COLUMN GRID LAYOUT (BENTO STYLE) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 items-start flex-1 min-h-0">
                
                {/* LEFT COLUMN: Metrics & Core Tabs (8 columns) */}
                <div className="lg:col-span-8 space-y-6 flex flex-col min-h-0">
                  
                  {/* BENTO STATS FOR THE CLIENT */}
                  <div className="grid grid-cols-2 gap-4 shrink-0">
                    <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <Award size={18} />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider truncate">Valor de Vida (LTV)</span>
                        <span className="text-base font-black text-slate-900 tracking-tight mt-0.5 block">${selectedClient.totalSpend.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                        <ShoppingBag size={18} />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider truncate">Pedidos Totales</span>
                        <span className="text-base font-black text-slate-900 tracking-tight mt-0.5 block">{selectedClient.totalOrdersCount} órdenes</span>
                      </div>
                    </div>

                    <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                        <TrendingUp size={18} />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider truncate">Ticket Promedio</span>
                        <span className="text-base font-black text-slate-900 tracking-tight mt-0.5 block">${selectedClient.averageOrderValue.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm flex items-center justify-between gap-2">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                          <Coins size={18} />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider truncate">Saldo por Cobrar</span>
                          <span className={`text-base font-black tracking-tight mt-0.5 block ${selectedClient.debt > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                            ${(selectedClient.debt || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      {selectedClient.debt > 0 && (
                        <button 
                          onClick={() => openSaldarModal(selectedClient)}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black text-[9px] uppercase tracking-widest px-2.5 py-1.5 rounded-xl transition-colors border border-emerald-100 shrink-0"
                        >
                          Saldar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* MAIN TAB PORT CONTAINER */}
                  <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm flex flex-col min-h-0 flex-1">
                    
                    {/* TAB SELECTOR */}
                    <div className="px-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/15">
                      <div className="flex">
                        <button 
                          onClick={() => setActiveProfileTab('history')}
                          className={`py-4 px-4 font-black text-xs uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
                            activeProfileTab === 'history' && !isEditingProfile
                              ? 'border-black text-black'
                              : 'border-transparent text-slate-400 hover:text-slate-600'
                          }`}
                          disabled={isEditingProfile}
                        >
                          <Clock size={13} />
                          Historial de Compras ({selectedClientOrdersWithItems.length})
                        </button>
                        <button 
                          onClick={() => setActiveProfileTab('details')}
                          className={`py-4 px-4 font-black text-xs uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
                            activeProfileTab === 'details' && !isEditingProfile
                              ? 'border-black text-black'
                              : 'border-transparent text-slate-400 hover:text-slate-600'
                          }`}
                          disabled={isEditingProfile}
                        >
                          <Clipboard size={13} />
                          Detalles y Comentarios
                        </button>
                      </div>

                      {isEditingProfile && (
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100/50 px-2.5 py-1 rounded-lg">
                          Modo Edición Activo
                        </span>
                      )}
                    </div>

                    {/* SCROLLABLE CONTENT BODY */}
                    <div className="flex-1 overflow-y-auto p-6 min-h-0">
                      
                      {isEditingProfile ? (
                        /* PROFILE EDIT MODE INTERFACE */
                        <motion.div 
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-4"
                        >
                          <h4 className="font-extrabold text-sm text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                            <Edit size={14} className="text-indigo-600" />
                            Editar Ficha de Cliente
                          </h4>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Nombre Completo</label>
                              <input 
                                type="text"
                                required
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:border-black outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Teléfono / WhatsApp</label>
                              <input 
                                type="text"
                                required
                                value={editPhone}
                                onChange={e => setEditPhone(e.target.value)}
                                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold font-mono focus:border-black outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Dirección Predeterminada de Entrega</label>
                            <textarea 
                              value={editAddress}
                              onChange={e => setEditAddress(e.target.value)}
                              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold focus:border-black outline-none h-20 resize-none"
                              placeholder="Av, Calle, Residencia, Apto, Punto de referencia..."
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Cédula / RIF</label>
                              <input 
                                type="text"
                                value={editCedula}
                                onChange={e => setEditCedula(e.target.value)}
                                placeholder="Ej. V-15443221"
                                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:border-black outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Correo Electrónico</label>
                              <input 
                                type="email"
                                value={editCorreo}
                                onChange={e => setEditCorreo(e.target.value)}
                                placeholder="Ej. cliente@gmail.com"
                                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:border-black outline-none"
                              />
                            </div>
                          </div>

                          <div className="pt-2 flex gap-3">
                            <button
                              onClick={handleUpdateClient}
                              className="px-5 py-3 bg-black hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow transition-transform active:scale-95 flex items-center gap-2"
                            >
                              <Save size={14} />
                              Guardar Cambios
                            </button>
                            <button
                              onClick={() => setIsEditingProfile(false)}
                              className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                            >
                              Cancelar
                            </button>
                          </div>
                        </motion.div>
                      ) : activeProfileTab === 'history' ? (
                        /* TAB 1: HISTORY TIMELINE */
                        <div className="space-y-6">
                          {selectedClientOrdersWithItems.length === 0 ? (
                            <div className="text-center py-12 px-4 text-slate-400">
                              <ShoppingBag className="mx-auto text-slate-300 mb-2" size={28} />
                              <p className="text-xs font-bold text-slate-700">Sin compras registradas</p>
                              <p className="text-[10px] mt-1 max-w-xs mx-auto">Este cliente no ha cerrado ninguna sesión de mesa ni colocado pedidos delivery en el sistema todavía.</p>
                            </div>
                          ) : (
                            <div className="relative pl-6 border-l-2 border-slate-200 space-y-6">
                              {selectedClientOrdersWithItems.map((session, sIdx) => {
                                const dateObj = new Date(session.startTime);
                                const formattedDate = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
                                const formattedTime = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                                
                                const isDeliv = session.type === 'delivery' || session.tableId?.startsWith('delivery-');
                                
                                return (
                                  <div key={session.id || sIdx} className="relative">
                                    
                                    {/* Timeline bullet */}
                                    <div className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center shadow-sm ${
                                      session.status === 'active' 
                                        ? 'bg-sky-500 animate-pulse' 
                                        : 'bg-indigo-600'
                                    }`} />

                                    <div className="bg-slate-50/40 hover:bg-slate-50/85 p-5 rounded-2xl border border-slate-100 transition-all space-y-3.5">
                                      
                                      {/* Timeline Item Header */}
                                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-extrabold text-xs text-slate-900 bg-white border border-slate-100 px-2.5 py-0.5 rounded-md shadow-sm">
                                            {isDeliv ? `🍔 Delivery #${session.orderNumber || session.id.substring(0, 4)}` : `🍽️ Dine-In ${session.tableName || 'Mesa'}`}
                                          </span>
                                          <span className="text-[10px] font-mono font-bold text-slate-400 flex items-center gap-1">
                                            <Clock size={11} />
                                            {formattedDate} • {formattedTime}
                                          </span>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                          {/* Total session amount */}
                                          <span className="font-bold text-xs text-slate-900 font-mono">
                                            Total: <strong className="text-indigo-600">${(session.totalAmount || session.payment?.totalUSD || session.pendingPayment?.totalUSD || (session.items && session.items.length > 0 ? session.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0) : 0)).toFixed(2)}</strong>
                                          </span>

                                          {/* Session status tag */}
                                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-widest ${
                                            session.status === 'completed' || session.status === 'closed' || session.paymentStatus === 'validated'
                                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                                              : 'bg-amber-50 text-amber-700 border border-amber-200/50'
                                          }`}>
                                            {session.status === 'completed' || session.status === 'closed' || session.paymentStatus === 'validated' ? 'Completado' : 'Activo'}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Items list ordered */}
                                      <div className="bg-white p-3 rounded-xl border border-slate-100/80 space-y-2">
                                        <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest">Platos consumidos</span>
                                        
                                        {session.items && session.items.length > 0 ? (
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                            {session.items.map((item: any, iIdx: number) => (
                                              <div key={item.id || iIdx} className="flex justify-between items-center text-[11px] text-slate-700 font-medium">
                                                <span className="truncate">
                                                  <strong className="text-black font-black mr-1">{item.quantity}x</strong>
                                                  {item.itemName}
                                                </span>
                                                <span className="font-bold font-mono text-slate-400">${(item.price * item.quantity).toFixed(2)}</span>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <span className="text-[10px] text-slate-400 italic">No hay detalles de comanda registrados para esta sesión</span>
                                        )}
                                      </div>

                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* TAB 2: METADATA DETAILS & NOTES */
                        <div className="space-y-4">
                          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                <MessageCircle size={16} />
                              </div>
                              <span className="text-xs font-black uppercase tracking-wider text-slate-900">Historial de Contacto y Notas Internas</span>
                            </div>
                            
                            {saveSuccessFeedback && (
                              <span className="text-[10px] font-extrabold text-emerald-600 flex items-center gap-1 animate-pulse bg-emerald-50 border border-emerald-100/60 px-2 py-1 rounded-lg">
                                <CheckCircle size={12} />
                                Guardado con éxito
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-500 leading-relaxed">
                            Registra alergias, preferencias alimenticias especiales, instrucciones de despacho o feedback clave de este cliente para que todo el personal pueda verlo al instante.
                          </p>

                          <textarea
                            value={editNotes}
                            onChange={e => setEditNotes(e.target.value)}
                            className="w-full p-4 bg-slate-50 border border-slate-100 focus:border-indigo-500 focus:bg-white rounded-2xl text-xs font-semibold outline-none transition-all h-48 placeholder:text-slate-400 shadow-inner leading-relaxed focus:ring-2 focus:ring-indigo-100"
                            placeholder="Ej: Es alérgico a los camarones. Siempre pide salsa de ajo adicional. El delivery requiere llamar por teléfono antes de llegar para abrir el portón..."
                          />

                          <div className="flex justify-end pt-1">
                            <button
                              onClick={handleSaveNotesOnly}
                              className="bg-black hover:bg-slate-900 text-white font-black text-xs px-6 py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2.5 cursor-pointer"
                            >
                              <Save size={15} />
                              Guardar Notas de Seguimiento
                            </button>
                          </div>
                        </div>
                      )}

                    </div>
                  </div>

                </div>

                {/* RIGHT COLUMN: Contact Options & Delivery Address (4 columns) */}
                <div className="lg:col-span-4 space-y-6 shrink-0">
                  
                  {/* Address Card */}
                  <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center">
                          <MapPin size={16} />
                        </div>
                        <span className="text-xs font-black uppercase tracking-wider text-slate-900">Dirección de Despacho</span>
                      </div>
                      {selectedClient.address && (
                        <button
                          onClick={() => copyToClipboard(selectedClient.address, 'address-copy')}
                          className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100/50"
                        >
                          {copiedId === 'address-copy' ? (
                            <>
                              <Check size={11} className="text-emerald-500" />
                              <span className="text-emerald-500 font-extrabold">¡Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Clipboard size={11} />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {selectedClient.address ? (
                      <div className="p-4 bg-slate-50/80 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-700 flex items-start gap-3 shadow-inner">
                        <MapPin size={16} className="text-indigo-500 shrink-0 mt-0.5" />
                        <p className="leading-relaxed text-slate-600 font-medium">{selectedClient.address}</p>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50/50 border border-slate-100/60 rounded-2xl text-xs text-slate-400 italic flex flex-col items-center justify-center text-center py-6 gap-2">
                        <MapPin size={20} className="text-slate-300" />
                        <span>No se ha registrado ninguna dirección predeterminada de delivery.</span>
                      </div>
                    )}
                  </div>

                  {/* WhatsApp quick launcher */}
                  <div className="p-6 bg-emerald-50/40 border border-emerald-100/40 rounded-[32px] shadow-sm space-y-4">
                    <div className="flex items-center gap-2 border-b border-emerald-100/30 pb-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <MessageCircle size={16} />
                      </div>
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-800 font-bold">Canal de WhatsApp</span>
                    </div>
                    
                    <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                      Envía un mensaje rápido al cliente para coordinar entregas o enviarle promociones directas.
                    </p>

                    <div className="pt-1">
                      <a 
                        href={`https://wa.me/${selectedClient.phone ? selectedClient.phone.replace(/[^0-9]/g, '') : ''}?text=Hola%20${encodeURIComponent(selectedClient.name || '')},%20le%20escribimos%20de%20nuestro%20restaurante%20para...`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-3.5 rounded-xl flex items-center justify-center gap-2.5 shadow-md shadow-emerald-600/15 hover:shadow-lg hover:shadow-emerald-600/20 transition-all hover:scale-[1.01] active:scale-95 cursor-pointer"
                      >
                        <MessageCircle size={15} />
                        Enviar WhatsApp Directo
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>

                </div>

              </div>

            </motion.div>

          </div>
        )}
      </div>

      {/* REGISTRATION MODAL OVERLAY */}
      <AnimatePresence>
        {isAddingClient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingClient(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[32px] border border-slate-100 shadow-2xl max-w-lg w-full overflow-hidden z-10 flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="bg-slate-900 text-white p-6 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center">
                    <UserPlus size={18} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-white">Registrar Ficha en CRM</h3>
                    <p className="text-slate-400 text-[11px]">Agrega un nuevo cliente de delivery o salón a la base</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAddingClient(false)}
                  className="p-1.5 hover:bg-white/10 rounded-xl transition-colors text-slate-300"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form container */}
              <form onSubmit={handleAddClient} className="p-6 overflow-y-auto space-y-4 flex-1">
                
                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Nombre Completo *</label>
                  <input 
                    type="text" 
                    required
                    value={cliName}
                    onChange={e => setCliName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className="w-full p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Teléfono / WhatsApp *</label>
                  <input 
                    type="text" 
                    required
                    value={cliPhone}
                    onChange={e => setCliPhone(e.target.value)}
                    placeholder="Ej. +584121234567"
                    className="w-full p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-bold font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Dirección Predeterminada de Despacho</label>
                  <textarea 
                    value={cliAddress}
                    onChange={e => setCliAddress(e.target.value)}
                    placeholder="Ej. Calle Principal Las Mercedes, Edif Los Caobos, Apto 5B..."
                    className="w-full p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-semibold h-16 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Cédula / RIF</label>
                    <input 
                      type="text" 
                      value={cliCedula}
                      onChange={e => setCliCedula(e.target.value)}
                      placeholder="Ej. V-15443221"
                      className="w-full p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Correo Electrónico</label>
                    <input 
                      type="email" 
                      value={cliCorreo}
                      onChange={e => setCliCorreo(e.target.value)}
                      placeholder="Ej. cliente@gmail.com"
                      className="w-full p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Humor Inicial</label>
                  <select 
                    value={cliSentiment}
                    onChange={e => setCliSentiment(e.target.value as any)}
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-black"
                  >
                    <option value="happy">😄 Muy Satisfecho</option>
                    <option value="neutral">😐 Neutral</option>
                    <option value="sad">😞 Detractor / Insatisfecho</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Notas del Agente / Comentarios</label>
                  <textarea 
                    value={cliNotes}
                    onChange={e => setCliNotes(e.target.value)}
                    placeholder="Detalles sobre entregas, alergias, platos preferidos..."
                    className="w-full p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-semibold h-16 resize-none"
                  />
                </div>

                {formError && (
                  <div className="p-3.5 bg-rose-50 text-rose-600 text-[10px] font-bold rounded-xl border border-rose-100 flex items-center gap-2">
                    <AlertCircle size={14} />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Submit button */}
                <button 
                  type="submit"
                  className="w-full bg-black hover:bg-slate-900 text-white p-4 rounded-xl text-xs font-bold transition-all shadow-md shadow-black/10 flex items-center justify-center gap-2 pt-3.5"
                >
                  <UserPlus size={16} />
                  Agregar Cliente al CRM
                </button>

              </form>
            </motion.div>
          </div>
        )}

        {isSaldarModalOpen && saldarClient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSaldarModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[32px] border border-slate-100 shadow-2xl max-w-md w-full overflow-hidden z-10 flex flex-col"
            >
              {/* Modal Header */}
              <div className="bg-slate-900 text-white p-6 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center">
                    <Coins size={18} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-white">Saldar Deuda de Cliente</h3>
                    <p className="text-slate-400 text-[11px]">Registra un abono o pago total para la cuenta a crédito</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsSaldarModalOpen(false)}
                  className="p-1.5 hover:bg-white/10 rounded-xl transition-colors text-slate-300"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form container */}
              <form onSubmit={handleSaldarDeudaSubmit} className="p-6 space-y-4">
                
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Cliente</div>
                  <div className="text-sm font-black text-slate-800">{saldarClient.name}</div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">{saldarClient.phone || 'Sin Teléfono'}</div>
                  <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-500">Deuda Pendiente Total:</span>
                    <span className="text-base font-black text-rose-600">${Number(saldarClient.debt || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Monto del Pago (USD)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0.01"
                    required
                    value={saldarAmount}
                    onChange={e => setSaldarAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-sm font-black text-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Método de Pago Usado</label>
                  <select 
                    value={saldarMethod}
                    onChange={e => setSaldarMethod(e.target.value as any)}
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-black"
                  >
                    <option value="cash">💵 Efectivo ($)</option>
                    <option value="pago_movil">📱 Pago Móvil (Bs)</option>
                    <option value="zelle">📧 Zelle</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Referencia de Pago (Opcional)</label>
                  <input 
                    type="text" 
                    value={saldarReference}
                    onChange={e => setSaldarReference(e.target.value)}
                    placeholder="Ej. Ref #584492"
                    className="w-full p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-semibold"
                  />
                </div>

                {/* Submit button */}
                <button 
                  type="submit"
                  className="w-full bg-black hover:bg-slate-900 text-white p-4 rounded-xl text-xs font-bold transition-all shadow-md shadow-black/10 flex items-center justify-center gap-2 pt-3.5 mt-2"
                >
                  <Coins size={16} />
                  Confirmar y Registrar Pago
                </button>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
