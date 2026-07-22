import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  onSnapshot, 
  query,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Search, 
  SlidersHorizontal, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight,
  CheckCircle2,
  Filter,
  Tag,
  Briefcase,
  PlusCircle,
  FileText,
  Download,
  Trash2,
  Edit3,
  Percent,
  Settings2,
  BookOpen,
  Printer,
  ChevronRight,
  Calculator,
  AlertCircle,
  Clock,
  Inbox,
  X,
  User,
  MapPin,
  Phone,
  Info
} from 'lucide-react';
import { useRestaurantData } from '../hooks/useRestaurantData';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Legend
} from 'recharts';

type FinanceTab = 'overview' | 'ledger' | 'payable' | 'fiscal' | 'pl';

interface FinanceEntry {
  id?: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  timestamp: string;
  isFiscal: boolean;
  fiscalInvoice?: string;
  taxRate?: number;
  taxAmount?: number;
  withholdingRate?: number;
  withholdingAmount?: number;
  paymentMethod: string;
  isAutomatic?: boolean;
  sessionId?: string;
  accountId?: string;
}

interface SupplierBill {
  id?: string;
  supplierName: string;
  amount: number;
  description: string;
  dueDate: string;
  status: 'pending' | 'paid';
  isFiscal: boolean;
  fiscalInvoice?: string;
  category: string;
  paymentMethod?: string;
  timestamp: string;
  paidAt?: string;
}

export default function FinanceView() {
  const { settings, tables } = useRestaurantData();
  const exchangeRate = settings?.exchangeRate || 40;

  // Real-time states
  const [sessions, setSessions] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [manualEntries, setManualEntries] = useState<FinanceEntry[]>([]);
  const [supplierBills, setSupplierBills] = useState<SupplierBill[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedDebtClientId, setSelectedDebtClientId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Detail view state
  const [selectedDetailEntry, setSelectedDetailEntry] = useState<FinanceEntry | null>(null);
  const [currentDetailOrders, setCurrentDetailOrders] = useState<any[]>([]);

  // Exportación Contable state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportPeriod, setExportPeriod] = useState<'current_month' | 'last_month' | 'current_quarter' | 'current_year' | 'custom'>('current_month');
  const [exportStartDate, setExportStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [exportEndDate, setExportEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [exportModule, setExportModule] = useState<'all' | 'fiscal' | 'payable' | 'pl'>('all');
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv' | 'pdf'>('excel');

  const getPaymentMethodText = (method: string) => {
    const m = (method || '').toLowerCase();
    if (m === 'cash' || m === 'divisa') return 'Efectivo';
    if (m === 'pagomovil' || m === 'pago_movil') return 'Pago Móvil';
    if (m === 'zelle') return 'Zelle';
    if (m === 'card' || m === 'punto') return 'Tarjeta de Crédito/Débito';
    if (m === 'bank_transfer' || m === 'transfer_bank') return 'Transferencia Bancaria';
    if (m === 'credito') return 'Crédito de Cliente';
    return 'Transferencia / Otro';
  };

  const getPaymentMethodLabel = (method: string) => {
    const m = (method || '').toLowerCase();
    if (m === 'cash' || m === 'divisa') return '💵 Efectivo ($)';
    if (m === 'pagomovil' || m === 'pago_movil') return '📱 Pago Móvil';
    if (m === 'zelle') return '📧 Zelle';
    if (m === 'card' || m === 'punto') return '💳 Tarjeta (Punto/Bs)';
    if (m === 'bank_transfer' || m === 'transfer_bank') return '🏦 Transferencia Bancaria';
    if (m === 'credito') return '👤 Crédito de Cliente';
    return '🏦 Transferencia / Otro';
  };

  const handleExportEntryAsTXT = (entry: any, orders: any[]) => {
    const dateStr = new Date(entry.timestamp).toLocaleString();
    const paymentText = getPaymentMethodText(entry.paymentMethod);
    const reference = entry.paymentReference || entry.reference || 'N/A';
    
    let text = `========================================
         DETALLE DE TRANSACCION POS
========================================
Ref ID:      #${entry.id ? entry.id.substring(0, 8) : 'N/A'}
Concepto:    ${entry.description}
Fecha/Hora:  ${dateStr}
Categoría:   ${entry.category}
Método Pago: ${paymentText}
Referencia:  ${reference}
----------------------------------------\n`;

    if (orders && orders.length > 0) {
      text += `Cant. Detalle                Precio    Total
----------------------------------------\n`;
      orders.forEach(o => {
        const qty = o.quantity || 1;
        const price = o.price || 0;
        const total = qty * price;
        const qtyStr = `${qty}x`.padEnd(5);
        const nameStr = (o.itemName || o.menuItem?.name || 'Producto').substring(0, 22).padEnd(22);
        const priceStr = `$${price.toFixed(2)}`.padStart(6);
        const totalStr = `$${total.toFixed(2)}`.padStart(7);
        text += `${qtyStr}${nameStr}${priceStr} ${totalStr}\n`;
        if (o.note) {
          text += `     * Nota: ${o.note}\n`;
        }
      });
      text += `----------------------------------------\n`;
    }

    text += `MONTO TOTAL:`.padEnd(30) + `$${entry.amount.toFixed(2)}`.padStart(10) + `\n`;
    text += `EQUIVALENTE:`.padEnd(25) + `Bs. ${(entry.amount * exchangeRate).toFixed(2)}`.padStart(15) + `\n`;

    if (entry.isFiscal) {
      text += `----------------------------------------\n`;
      text += `Factura Fiscal: #${entry.fiscalInvoice || 'N/A'}\n`;
      text += `IVA (${entry.taxRate || 16}%): $${(entry.taxAmount || 0).toFixed(2)}\n`;
    }

    text += `========================================
       ¡Gracias por su preferencia!
========================================\n`;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Transaccion_${entry.id ? entry.id.substring(0, 8) : 'N/A'}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintEntry = (entry: any, orders: any[]) => {
    const dateStr = new Date(entry.timestamp).toLocaleString();
    const paymentText = getPaymentMethodText(entry.paymentMethod);
    const reference = entry.paymentReference || entry.reference || 'N/A';
    
    let ordersHtml = '';
    if (orders && orders.length > 0) {
      ordersHtml = `
        <hr style="border: none; border-top: 1px dashed #000; margin: 10px 0;" />
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr>
              <th align="left">Cant.</th>
              <th align="left">Producto</th>
              <th align="right">P.Unit</th>
              <th align="right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${orders.map(o => `
              <tr>
                <td>${o.quantity || 1}x</td>
                <td>${o.itemName || o.menuItem?.name || 'Producto'}</td>
                <td align="right">$${Number(o.price || 0).toFixed(2)}</td>
                <td align="right">$${((o.price || 0) * (o.quantity || 1)).toFixed(2)}</td>
              </tr>
              ${o.note ? `<tr><td colspan="4" style="font-style: italic; font-size: 9px; padding-left: 10px;">* Nota: ${o.note}</td></tr>` : ''}
            `).join('')}
          </tbody>
        </table>
      `;
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Imprimir Transacción</title>
            <style>
              body { font-family: 'Courier New', Courier, monospace; width: 80mm; margin: 0 auto; padding: 10px; color: #000; }
              h2, h3 { text-align: center; margin: 5px 0; }
              hr { border: none; border-top: 1px dashed #000; }
              table { width: 100%; border-collapse: collapse; font-size: 12px; }
              .center { text-align: center; }
              .bold { font-weight: bold; }
              .text-xs { font-size: 12px; }
              .flex-row { display: flex; justify-content: space-between; }
              @media print {
                body { width: 100%; margin: 0; }
              }
            </style>
          </head>
          <body onload="window.print(); window.close();">
            <div class="text-xs">
              <h2 class="center">BISTROFLOW</h2>
              <h3 class="center">${entry.isAutomatic ? 'TICKET DE CONSUMO POS' : 'COMPROBANTE DE TRANSACCION'}</h3>
              <hr />
              <p><strong>Ref ID:</strong> #${entry.id ? entry.id.substring(0, 8) : 'N/A'}</p>
              <p><strong>Concepto:</strong> ${entry.description}</p>
              <p><strong>Fecha:</strong> ${dateStr}</p>
              <p><strong>Categoría:</strong> ${entry.category}</p>
              <p><strong>Método:</strong> ${paymentText}</p>
              <p><strong>Referencia:</strong> ${reference}</p>
              ${ordersHtml}
              <hr />
              <div class="flex-row" style="margin: 5px 0;">
                <span class="bold">TOTAL:</span>
                <span class="bold">$${entry.amount.toFixed(2)}</span>
              </div>
              <div class="flex-row" style="margin: 5px 0;">
                <span class="bold">EQUIVALENTE:</span>
                <span class="bold">Bs. ${(entry.amount * exchangeRate).toFixed(2)}</span>
              </div>
              ${entry.isFiscal ? `
                <hr />
                <p><strong>Factura Fiscal SENIAT:</strong> #${entry.fiscalInvoice || 'N/A'}</p>
                <p><strong>IVA Aplicado (${entry.taxRate || 16}%):</strong> $${(entry.taxAmount || 0).toFixed(2)}</p>
              ` : ''}
              <hr />
              <p class="center bold">¡Gracias por su preferencia!</p>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  // View state
  const [activeTab, setActiveTab] = useState<FinanceTab>('overview');
  
  // Modals state
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinanceEntry | null>(null);
  const [isAddingBill, setIsAddingBill] = useState(false);

  // Bill payment quick state
  const [payingBillId, setPayingBillId] = useState<string | null>(null);
  const [payBillMethod, setPayBillMethod] = useState<string>('cash');

  // Form states (Create / Edit)
  const [formData, setFormData] = useState<Omit<FinanceEntry, 'id'>>({
    type: 'expense',
    category: 'Insumos',
    amount: 0,
    description: '',
    timestamp: new Date().toISOString().substring(0, 16),
    isFiscal: false,
    fiscalInvoice: '',
    taxRate: 16,
    taxAmount: 0,
    withholdingRate: 0,
    withholdingAmount: 0,
    paymentMethod: 'cash'
  });

  // Bill creation form state
  const [billFormData, setBillFormData] = useState<Omit<SupplierBill, 'id' | 'status' | 'timestamp'>>({
    supplierName: '',
    amount: 0,
    description: '',
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10), // 15 days default due date
    isFiscal: false,
    fiscalInvoice: '',
    category: 'Insumos',
    paymentMethod: 'cash'
  });

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedType, setSelectedType] = useState('all'); // 'all', 'income', 'expense'
  const [selectedFiscalFilter, setSelectedFiscalFilter] = useState('all'); // 'all', 'fiscal', 'non-fiscal'
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });

  // Food cost simulation coefficient (if no raw material expenses are loaded)
  const [foodCostPercent, setFoodCostPercent] = useState<number>(35);

  // Listeners
  useEffect(() => {
    // 1. Listen to sessions
    const unsubSessions = onSnapshot(query(collection(db, 'sessions')), (snap) => {
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 2. Listen to transactions (completed table/delivery payments)
    const unsubTrans = onSnapshot(query(collection(db, 'transactions')), (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 3. Listen to finance_entries (manual ledger additions)
    const unsubManual = onSnapshot(query(collection(db, 'finance_entries')), (snap) => {
      const entries = snap.docs.map(d => ({ id: d.id, ...d.data() } as FinanceEntry));
      // Sort newest first
      entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setManualEntries(entries);
      setIsLoading(false);
    }, (err) => {
      console.error('Error loading manual finance entries:', err);
      setIsLoading(false);
    });

    // 4. Listen to supplier bills (accounts payable)
    const unsubBills = onSnapshot(query(collection(db, 'supplier_bills')), (snap) => {
      const bills = snap.docs.map(d => ({ id: d.id, ...d.data() } as SupplierBill));
      // Sort: pending first, then by due date
      bills.sort((a, b) => {
        if (a.status === 'pending' && b.status === 'paid') return -1;
        if (a.status === 'paid' && b.status === 'pending') return 1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
      setSupplierBills(bills);
    }, (err) => {
      console.error('Error loading supplier bills:', err);
    });

    // 5. Listen to clients (CRM)
    const unsubClients = onSnapshot(query(collection(db, 'clients')), (snap) => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error('Error loading clients in Finance:', err);
    });

    return () => {
      unsubSessions();
      unsubTrans();
      unsubManual();
      unsubBills();
      unsubClients();
    };
  }, []);

  // Compute automated incomes from cash desk (Caja sales)
  const salesIncomes = useMemo(() => {
    // Each transaction in 'transactions' is an approved payment!
    return transactions
      .filter(t => t.method !== 'credito')
      .map(t => {
      // Find session to get customer name / table
      const session = sessions.find(s => s.id === t.sessionId);
      
      let originName = 'Venta Caja';
      if (session) {
        if (session.type === 'delivery') {
          originName = `Delivery: ${session.customerName || 'Cliente'}`;
        } else {
          const table = (tables || []).find(tb => tb.id === session.tableId);
          const tableLabel = table ? `Mesa ${table.number}` : `Mesa ${session.tableId}`;
          const clientName = session.customerName ? ` (${session.customerName})` : '';
          originName = `${tableLabel}${clientName}`;
        }
      }

      const sessionPayment = session?.payment || {};

      // Standardize as a FinanceEntry
      return {
        id: `sale-${t.id}`,
        sessionId: t.sessionId,
        accountId: t.accountId || 'default',
        type: 'income' as const,
        category: 'Ventas de Restaurante',
        amount: Number(t.amount || 0),
        description: `Venta facturada - ${originName}`,
        timestamp: t.timestamp || new Date().toISOString(),
        isFiscal: true, // sales are fiscal transactions by default in POS
        fiscalInvoice: t.fiscalInvoice || `F-${t.id?.substring(0, 6).toUpperCase() || 'POS'}`,
        taxRate: 16, // 16% VAT is standard
        taxAmount: Number(t.amount || 0) * (16 / 116), // VAT included in total amount
        paymentMethod: t.method || 'cash',
        paymentReference: t.reference || sessionPayment.reference || session?.pendingPayment?.reference || null,
        receiptImage: t.receiptImage || sessionPayment.receiptImage || session?.pendingPayment?.receiptImage || null,
        clientId: t.clientId || sessionPayment.creditClient?.clientId || session?.pendingPayment?.creditClient?.clientId || session?.pendingPayment?.client?.clientId || null,
        clientName: t.clientName || sessionPayment.creditClient?.nombre || session?.pendingPayment?.creditClient?.nombre || session?.pendingPayment?.client?.nombre || null,
        waiterName: session?.waiterName || null,
        isAutomatic: true
      };
    });
  }, [transactions, sessions, tables]);

  // Combine automatic sales incomes with manual entries
  const allEntries = useMemo(() => {
    const combined = [...salesIncomes, ...manualEntries];
    // Sort chronologically newest first
    return combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [salesIncomes, manualEntries]);

  // Calculate stats based on ALL entries
  const stats = useMemo(() => {
    let totalIncomes = 0;
    let totalExpenses = 0;
    
    // Taxes accumulation
    let totalIvaDebito = 0; // VAT collected (from sales/income)
    let totalIvaCredito = 0; // VAT paid (from expenses)
    let totalIgtfCollected = 0; // 3% for cash USD or mobile transactions if configured
    let totalWithholdings = 0; // ISLR withheld

    allEntries.forEach(entry => {
      if (entry.type === 'income') {
        totalIncomes += entry.amount;
        if (entry.isFiscal) {
          // Assume 16% is inside the amount
          const rate = entry.taxRate || 16;
          totalIvaDebito += entry.amount * (rate / (100 + rate));
        }
        // If payment was cash USD, collect IGTF 3% as reference
        if (entry.paymentMethod === 'cash' && entry.amount > 0) {
          totalIgtfCollected += entry.amount * 0.03;
        }
      } else {
        totalExpenses += entry.amount;
        if (entry.isFiscal) {
          const rate = entry.taxRate || 16;
          // Expenses usually exclude tax or include it. Let's assume tax rate is added
          totalIvaCredito += entry.amount * (rate / (100 + rate));
        }
        if (entry.withholdingAmount) {
          totalWithholdings += entry.withholdingAmount;
        }
      }
    });

    // If there are no raw material entries logged, simulate food cost
    // to give a realistic baseline
    const rawMaterialExpenseCount = manualEntries.filter(e => e.type === 'expense' && e.category === 'Insumos').length;
    let simulatedFoodCost = 0;
    if (rawMaterialExpenseCount === 0) {
      simulatedFoodCost = totalIncomes * (foodCostPercent / 100);
      totalExpenses += simulatedFoodCost;
    }

    const netProfit = totalIncomes - totalExpenses;
    const netMargin = totalIncomes > 0 ? (netProfit / totalIncomes) * 100 : 0;
    const ivaToPay = Math.max(0, totalIvaDebito - totalIvaCredito);

    const totalPendingPayable = supplierBills
      .filter(b => b.status === 'pending')
      .reduce((sum, b) => sum + b.amount, 0);

    return {
      totalIncomes,
      totalExpenses,
      simulatedFoodCost,
      netProfit,
      netMargin,
      totalIvaDebito,
      totalIvaCredito,
      ivaToPay,
      totalIgtfCollected,
      totalWithholdings,
      totalPendingPayable
    };
  }, [allEntries, manualEntries, foodCostPercent, supplierBills]);

  // Apply filters to ledger
  const filteredEntries = useMemo(() => {
    return allEntries.filter(entry => {
      // 1. Search Query
      const desc = (entry.description || '').toLowerCase();
      const cat = (entry.category || '').toLowerCase();
      const matchSearch = desc.includes(searchQuery.toLowerCase()) || cat.includes(searchQuery.toLowerCase());

      // 2. Type Filter
      const matchType = selectedType === 'all' || entry.type === selectedType;

      // 3. Category Filter
      const matchCategory = selectedCategory === 'all' || entry.category === selectedCategory;

      // 4. Method Filter
      let matchMethod = selectedMethod === 'all';
      if (!matchMethod && entry.paymentMethod) {
        const sel = selectedMethod;
        const entryMethod = entry.paymentMethod.toLowerCase();
        if (sel === 'cash') {
          matchMethod = entryMethod === 'cash' || entryMethod === 'divisa';
        } else if (sel === 'pagomovil') {
          matchMethod = entryMethod === 'pagomovil' || entryMethod === 'pago_movil';
        } else if (sel === 'zelle') {
          matchMethod = entryMethod === 'zelle';
        } else if (sel === 'card') {
          matchMethod = entryMethod === 'card' || entryMethod === 'punto';
        } else if (sel === 'bank_transfer') {
          matchMethod = entryMethod === 'bank_transfer' || entryMethod === 'credito';
        } else {
          matchMethod = entryMethod === sel;
        }
      }

      // 5. Fiscal Filter
      const matchFiscal = selectedFiscalFilter === 'all' || 
        (selectedFiscalFilter === 'fiscal' && entry.isFiscal) ||
        (selectedFiscalFilter === 'non-fiscal' && !entry.isFiscal);

      // 6. Date Range
      let matchDate = true;
      if (dateRange.start) {
        matchDate = matchDate && new Date(entry.timestamp) >= new Date(dateRange.start);
      }
      if (dateRange.end) {
        // add 1 day to end date to include whole day
        const endDate = new Date(dateRange.end);
        endDate.setDate(endDate.getDate() + 1);
        matchDate = matchDate && new Date(entry.timestamp) <= endDate;
      }

      return matchSearch && matchType && matchCategory && matchMethod && matchFiscal && matchDate;
    });
  }, [allEntries, searchQuery, selectedType, selectedCategory, selectedMethod, selectedFiscalFilter, dateRange]);

  // Chart data: Income vs Expenses grouped by date
  const chartData = useMemo(() => {
    const dailyMap: Record<string, { date: string; ingresos: number; egresos: number }> = {};
    
    // Sort chronologically ascending for the chart
    const chronological = [...allEntries].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // Only take the last 15 days or entries with data to avoid cluttering
    chronological.forEach(entry => {
      const dateStr = new Date(entry.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { date: dateStr, ingresos: 0, egresos: 0 };
      }
      if (entry.type === 'income') {
        dailyMap[dateStr].ingresos += entry.amount;
      } else {
        dailyMap[dateStr].egresos += entry.amount;
      }
    });

    return Object.values(dailyMap).slice(-10); // last 10 active days
  }, [allEntries]);

  // Category breakdown data for charts
  const categoryBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    allEntries.forEach(entry => {
      if (entry.type === 'expense') {
        breakdown[entry.category] = (breakdown[entry.category] || 0) + entry.amount;
      }
    });

    return Object.entries(breakdown).map(([name, value]) => ({
      name,
      value
    })).sort((a, b) => b.value - a.value);
  }, [allEntries]);

  // Handle Form Input Changes with auto-calculated taxes
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => {
        const next = { ...prev, [name]: checked };
        if (name === 'isFiscal') {
          // Reset taxes if untoggled
          if (!checked) {
            next.taxAmount = 0;
            next.withholdingAmount = 0;
            next.withholdingRate = 0;
          } else {
            // Auto calculate standard 16% IVA
            next.taxAmount = next.amount * ((next.taxRate || 16) / 100);
          }
        }
        return next;
      });
    } else {
      setFormData(prev => {
        const numValue = (name === 'amount' || name === 'taxRate' || name === 'withholdingRate') ? Number(value) : value;
        const next = { ...prev, [name]: numValue };

        // Handle reactive tax calculations
        if (next.isFiscal) {
          const rate = next.taxRate || 16;
          // Calculate tax based on amount
          next.taxAmount = Number((next.amount * (rate / 100)).toFixed(2));
          
          if (next.type === 'expense' && next.withholdingRate) {
            next.withholdingAmount = Number((next.amount * (next.withholdingRate / 100)).toFixed(2));
          } else {
            next.withholdingAmount = 0;
          }
        }

        return next;
      });
    }
  };

  // Create manual entry
  const handleSubmitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.amount <= 0 || !formData.description.trim()) {
      alert('Por favor ingrese un monto válido y una descripción.');
      return;
    }

    if (formData.type === 'income' && formData.category === 'Cobro de Crédito' && !selectedDebtClientId) {
      alert('Por favor seleccione el cliente de crédito que está realizando el pago.');
      return;
    }

    try {
      const entryData = {
        ...formData,
        amount: Number(formData.amount),
        taxAmount: formData.isFiscal ? Number(formData.taxAmount) : 0,
        withholdingAmount: (formData.isFiscal && formData.type === 'expense') ? Number(formData.withholdingAmount) : 0,
        timestamp: new Date(formData.timestamp).toISOString()
      };

      if (editingEntry && editingEntry.id) {
        // Edit
        await updateDoc(doc(db, 'finance_entries', editingEntry.id), entryData);
        setEditingEntry(null);
      } else {
        // Add
        await addDoc(collection(db, 'finance_entries'), entryData);

        // Subtract debt from client profile
        if (formData.type === 'income' && formData.category === 'Cobro de Crédito' && selectedDebtClientId) {
          const clientRef = doc(db, 'clients', selectedDebtClientId);
          const clientSnap = await getDoc(clientRef);
          if (clientSnap.exists()) {
            const currentDebt = clientSnap.data().debt || 0;
            await updateDoc(clientRef, {
              debt: Math.max(0, currentDebt - Number(formData.amount))
            });
          }
        }
      }

      // Reset form
      setFormData({
        type: 'expense',
        category: 'Insumos',
        amount: 0,
        description: '',
        timestamp: new Date().toISOString().substring(0, 16),
        isFiscal: false,
        fiscalInvoice: '',
        taxRate: 16,
        taxAmount: 0,
        withholdingRate: 0,
        withholdingAmount: 0,
        paymentMethod: 'cash'
      });
      setSelectedDebtClientId('');
      setIsAddingEntry(false);
    } catch (err) {
      console.error('Error saving financial entry:', err);
      alert('Error de conexión al guardar el registro financiero.');
    }
  };

  // Delete manual entry
  const handleDeleteEntry = async (id: string) => {
    if (id.startsWith('sale-')) {
      alert('Las ventas automáticas de caja no se pueden eliminar desde Finanzas. Deben ser anuladas o devueltas en el módulo de Caja.');
      return;
    }

    if (confirm('¿Está seguro de que desea eliminar este registro financiero de forma permanente? Esta acción no se puede deshacer.')) {
      try {
        await deleteDoc(doc(db, 'finance_entries', id));
      } catch (err) {
        console.error('Error deleting entry:', err);
        alert('Error al eliminar el registro.');
      }
    }
  };

  // Start Editing manual entry
  const startEditEntry = (entry: FinanceEntry) => {
    if (entry.id?.startsWith('sale-')) {
      alert('Las ventas automáticas de caja no se pueden editar desde Finanzas.');
      return;
    }
    setEditingEntry(entry);
    setFormData({
      type: entry.type,
      category: entry.category,
      amount: entry.amount,
      description: entry.description,
      timestamp: new Date(entry.timestamp).toISOString().substring(0, 16),
      isFiscal: entry.isFiscal,
      fiscalInvoice: entry.fiscalInvoice || '',
      taxRate: entry.taxRate || 16,
      taxAmount: entry.taxAmount || 0,
      withholdingRate: entry.withholdingRate || 0,
      withholdingAmount: entry.withholdingAmount || 0,
      paymentMethod: entry.paymentMethod || 'cash'
    });
    setIsAddingEntry(true);
  };

  // Helper to compute date range for accounting export
  const getExportDateRange = () => {
    let start = new Date(exportStartDate + 'T00:00:00');
    let end = new Date(exportEndDate + 'T23:59:59');

    const now = new Date();
    if (exportPeriod === 'current_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (exportPeriod === 'last_month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (exportPeriod === 'current_quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), qMonth, 1, 0, 0, 0);
      end = new Date(now.getFullYear(), qMonth + 3, 0, 23, 59, 59);
    } else if (exportPeriod === 'current_year') {
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    }
    return { start, end };
  };

  // Exportación Contable Multiformato (Excel / CSV / PDF)
  const handleRunAccountingExport = (overrideFormat?: 'excel' | 'csv' | 'pdf') => {
    const fmt = overrideFormat || exportFormat;
    const { start, end } = getExportDateRange();

    const exportEntries = allEntries.filter(entry => {
      const entryDate = new Date(entry.timestamp);
      if (entryDate < start || entryDate > end) return false;
      if (exportModule === 'fiscal' && !entry.isFiscal) return false;
      return true;
    });

    const totalIng = exportEntries.filter(e => e.type === 'income').reduce((acc, e) => acc + e.amount, 0);
    const totalEgr = exportEntries.filter(e => e.type === 'expense').reduce((acc, e) => acc + e.amount, 0);
    const utilNeta = totalIng - totalEgr;
    const totalIva = exportEntries.reduce((acc, e) => acc + (e.taxAmount || 0), 0);
    const totalRet = exportEntries.reduce((acc, e) => acc + (e.withholdingAmount || 0), 0);

    const restaurantName = settings?.restaurantName || 'RESTAURANTE Y CAFE';
    const RIF = settings?.rif || 'J-50012345-0';
    const periodStr = `${start.toLocaleDateString()} al ${end.toLocaleDateString()}`;

    if (fmt === 'excel') {
      // Structure compatible with MS Excel with UTF-8 BOM
      let content = '\uFEFF';
      content += `REPORTE CONTABLE Y FINANCIERO - ${restaurantName.toUpperCase()}\n`;
      content += `RIF / REGISTRO FISCAL:;${RIF}\n`;
      content += `PERIODO AUDITADO:;${periodStr}\n`;
      content += `FECHA DE GENERACION:;${new Date().toLocaleString()}\n`;
      content += `TASA OFICIAL BCV:;${exchangeRate.toFixed(2)} VES/USD\n`;
      content += `\n`;
      content += `RESUMEN CONTABLE EJECUTIVO\n`;
      content += `Total Ingresos Operativos (USD):;${totalIng.toFixed(2)};Monto Equiv. VES:;${(totalIng * exchangeRate).toFixed(2)}\n`;
      content += `Total Egresos Operativos (USD):;${totalEgr.toFixed(2)};Monto Equiv. VES:;${(totalEgr * exchangeRate).toFixed(2)}\n`;
      content += `Utilidad Neta del Ejercicio (USD):;${utilNeta.toFixed(2)};Monto Equiv. VES:;${(utilNeta * exchangeRate).toFixed(2)}\n`;
      content += `Total IVA Cobrado (USD):;${totalIva.toFixed(2)};Monto Equiv. VES:;${(totalIva * exchangeRate).toFixed(2)}\n`;
      content += `Total Retenciones (USD):;${totalRet.toFixed(2)};Monto Equiv. VES:;${(totalRet * exchangeRate).toFixed(2)}\n`;
      content += `\n`;
      content += `LIBRO DIARIO DE ASIENTOS CONTABLES (${exportEntries.length} Registros)\n`;
      content += `N_ASIENTO;FECHA;HORA;TIPO_MOVIMIENTO;CATEGORIA;CONCEPTO_DESCRIPCION;METODO_PAGO;MONTO_USD;TASA_BCV_VES;MONTO_EQUIV_VES;FACTURA_FISCAL;BASE_IMPONIBLE_USD;IVA_USD;RETENCION_USD\n`;

      exportEntries.forEach((e, idx) => {
        const d = new Date(e.timestamp);
        const fechaStr = d.toLocaleDateString();
        const horaStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const tipoStr = e.type === 'income' ? 'Ingreso (Crédito)' : 'Egreso (Débito)';
        const catStr = e.category.replace(/;/g, ',');
        const descStr = e.description.replace(/;/g, ',').replace(/\n/g, ' ');
        const metodoStr = getPaymentMethodText(e.paymentMethod);
        const montoUSD = e.amount.toFixed(2);
        const tasaBCV = exchangeRate.toFixed(2);
        const montoVES = (e.amount * exchangeRate).toFixed(2);
        const factFiscal = e.fiscalInvoice || 'N/A';
        const baseImp = e.isFiscal ? (e.amount - (e.taxAmount || 0)).toFixed(2) : '0.00';
        const ivaUSD = (e.taxAmount || 0).toFixed(2);
        const retUSD = (e.withholdingAmount || 0).toFixed(2);

        content += `${idx + 1};${fechaStr};${horaStr};${tipoStr};${catStr};${descStr};${metodoStr};${montoUSD};${tasaBCV};${montoVES};${factFiscal};${baseImp};${ivaUSD};${retUSD}\n`;
      });

      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Reporte_Contable_Excel_${restaurantName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (fmt === 'csv') {
      // Technical CSV for accounting software (Profit, Galac, Saint, SAP, Odoo)
      let content = `FECHA,HORA,TIPO,CATEGORIA,CONCEPTO,METODO_PAGO,FACTURA_FISCAL,MONTO_USD,TASA_BCV,MONTO_VES,IVA_USD,RETENCION_USD\n`;

      exportEntries.forEach((e) => {
        const d = new Date(e.timestamp);
        const fechaStr = d.toISOString().split('T')[0];
        const horaStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const tipoStr = e.type.toUpperCase();
        const catStr = `"${e.category.replace(/"/g, '""')}"`;
        const descStr = `"${e.description.replace(/"/g, '""').replace(/\n/g, ' ')}"`;
        const metodoStr = e.paymentMethod.toUpperCase();
        const factFiscal = `"${(e.fiscalInvoice || 'N/A').replace(/"/g, '""')}"`;
        const montoUSD = e.amount.toFixed(2);
        const tasaBCV = exchangeRate.toFixed(2);
        const montoVES = (e.amount * exchangeRate).toFixed(2);
        const ivaUSD = (e.taxAmount || 0).toFixed(2);
        const retUSD = (e.withholdingAmount || 0).toFixed(2);

        content += `${fechaStr},${horaStr},${tipoStr},${catStr},${descStr},${metodoStr},${factFiscal},${montoUSD},${tasaBCV},${montoVES},${ivaUSD},${retUSD}\n`;
      });

      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Export_Contable_Sistemas_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (fmt === 'pdf') {
      window.print();
    }
  };

  // Export ledger shortcut
  const exportToCSV = () => {
    setIsExportModalOpen(true);
  };

  // Print current list
  const triggerPrint = () => {
    window.print();
  };

  // Submit new Supplier Bill (Cuentas por Pagar)
  const handleSubmitBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (billFormData.amount <= 0 || !billFormData.supplierName.trim()) {
      alert('Por favor ingrese un monto válido y un nombre de proveedor.');
      return;
    }

    try {
      const billData = {
        ...billFormData,
        amount: Number(billFormData.amount),
        status: 'pending' as const,
        timestamp: new Date().toISOString()
      };

      await addDoc(collection(db, 'supplier_bills'), billData);

      // Reset form
      setBillFormData({
        supplierName: '',
        amount: 0,
        description: '',
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
        isFiscal: false,
        fiscalInvoice: '',
        category: 'Insumos',
        paymentMethod: 'cash'
      });
      setIsAddingBill(false);
    } catch (err) {
      console.error('Error saving supplier bill:', err);
      alert('Error de conexión al guardar la cuenta por pagar.');
    }
  };

  // Delete Supplier Bill
  const handleDeleteBill = async (id: string) => {
    if (confirm('¿Está seguro de que desea eliminar esta cuenta por pagar de forma permanente? Esta acción no se puede deshacer.')) {
      try {
        await deleteDoc(doc(db, 'supplier_bills', id));
      } catch (err) {
        console.error('Error deleting supplier bill:', err);
        alert('Error al eliminar el registro.');
      }
    }
  };

  // Pay Supplier Bill
  const handlePayBill = async (bill: SupplierBill, method: string) => {
    if (!bill.id) return;
    try {
      // 1. Update bill status
      await updateDoc(doc(db, 'supplier_bills', bill.id), {
        status: 'paid',
        paymentMethod: method,
        paidAt: new Date().toISOString()
      });

      // 2. Add as manual expense in ledger
      const taxRateValue = bill.isFiscal ? 16 : 0;
      const calculatedTaxAmount = bill.isFiscal ? Number((bill.amount * (16 / 116)).toFixed(2)) : 0;

      await addDoc(collection(db, 'finance_entries'), {
        type: 'expense',
        category: bill.category || 'Insumos',
        amount: Number(bill.amount),
        description: `Pago a Proveedor: ${bill.supplierName} - ${bill.description}`,
        timestamp: new Date().toISOString(),
        isFiscal: bill.isFiscal,
        fiscalInvoice: bill.fiscalInvoice || '',
        taxRate: taxRateValue,
        taxAmount: calculatedTaxAmount,
        withholdingRate: 0,
        withholdingAmount: 0,
        paymentMethod: method
      });

      setPayingBillId(null);
    } catch (err) {
      console.error('Error processing bill payment:', err);
      alert('Error al procesar el pago de la cuenta por pagar.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-40">
        <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto w-full pb-16 px-4 sm:px-6">
      {/* Header */}
      <header className="mb-8 border-b border-slate-200/60 pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:pr-40">
        <div>
          <span className="text-[10px] uppercase tracking-widest font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 inline-block mb-1.5">
            Módulo de Administración Tributaria & Contable
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">Control Financiero Integral</h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Libro diario de ingresos, egresos, conciliación fiscal, IVA, retenciones e informes de pérdidas y ganancias.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button 
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs shadow-md shadow-slate-900/10 transition-all cursor-pointer"
          >
            <Download size={16} />
            <span>Exportación Contable</span>
          </button>

          <button 
            onClick={() => {
              setEditingEntry(null);
              setFormData({
                type: 'expense',
                category: 'Insumos',
                amount: 0,
                description: '',
                timestamp: new Date().toISOString().substring(0, 16),
                isFiscal: false,
                fiscalInvoice: '',
                taxRate: 16,
                taxAmount: 0,
                withholdingRate: 0,
                withholdingAmount: 0,
                paymentMethod: 'cash'
              });
              setIsAddingEntry(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <PlusCircle size={16} />
            <span>Registrar Movimiento</span>
          </button>
        </div>
      </header>

      {/* Main Stats KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {/* Total Incomes */}
        <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start">
              <span className="text-[9px] uppercase tracking-widest text-slate-400 font-extrabold">Ingresos Totales (USD)</span>
              <span className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600"><TrendingUp size={14} /></span>
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">${stats.totalIncomes.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="text-xs text-slate-500 font-semibold font-mono mt-0.5">
              Bs. {(stats.totalIncomes * exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-50 text-[10px] text-slate-400">
            Sincronizado con Caja en tiempo real
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start">
              <span className="text-[9px] uppercase tracking-widest text-slate-400 font-extrabold">Egresos Operacionales</span>
              <span className="p-1.5 bg-rose-50 rounded-lg text-rose-600"><TrendingDown size={14} /></span>
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">${stats.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="text-xs text-slate-500 font-semibold font-mono mt-0.5">
              Bs. {(stats.totalExpenses * exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-50 text-[10px] text-slate-400 flex justify-between">
            <span>Incluye nómina y compras</span>
            {stats.simulatedFoodCost > 0 && <span className="text-amber-500 font-semibold">Costo Alim. Sim.</span>}
          </div>
        </div>

        {/* Net Profit Margin */}
        <div className={`p-6 rounded-[28px] shadow-sm relative overflow-hidden flex flex-col justify-between ${stats.netProfit >= 0 ? 'bg-slate-900 text-white' : 'bg-rose-950 text-white'}`}>
          <div>
            <div className="flex justify-between items-start">
              <span className="text-[9px] uppercase tracking-widest text-slate-400 font-extrabold">Utilidad Neta del Ejercicio</span>
              <span className={`p-1.5 rounded-lg ${stats.netProfit >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                {stats.netProfit >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              </span>
            </div>
            <div className={`text-2xl font-black mt-2 ${stats.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ${stats.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-400 font-mono mt-0.5">
              Bs. {(stats.netProfit * exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] flex justify-between items-center text-slate-400">
            <span>Margen de Utilidad:</span>
            <span className={`font-bold ${stats.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {stats.netMargin.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Fiscal & Supplier Liabilities */}
        <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start">
              <span className="text-[9px] uppercase tracking-widest text-slate-400 font-extrabold">Pasivos a Corto Plazo (USD)</span>
              <span className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600"><Briefcase size={14} /></span>
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">
              ${(stats.totalPendingPayable + stats.ivaToPay).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-500 font-semibold font-mono mt-0.5">
              Bs. {((stats.totalPendingPayable + stats.ivaToPay) * exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-50 text-[10px] text-slate-500 flex flex-col gap-1">
            <div className="flex justify-between">
              <span>Deuda Proveedores:</span>
              <span className="font-bold text-slate-900">${stats.totalPendingPayable.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Impuestos por Declarar (IVA):</span>
              <span className="font-bold text-rose-600">${stats.ivaToPay.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Menu Navigation */}
      <div className="flex border-b border-slate-200 mb-8 overflow-x-auto gap-4 scrollbar-none">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-4 px-1 text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 cursor-pointer ${
            activeTab === 'overview' ? 'border-black text-black font-black' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <TrendingUp size={16} />
          Flujo de Caja y Métricas
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          className={`pb-4 px-1 text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 cursor-pointer ${
            activeTab === 'ledger' ? 'border-black text-black font-black' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <BookOpen size={16} />
          Libro de Diario (Ledger)
        </button>
        <button
          onClick={() => setActiveTab('payable')}
          className={`pb-4 px-1 text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 cursor-pointer ${
            activeTab === 'payable' ? 'border-black text-black font-black' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Briefcase size={16} />
          Cuentas por Pagar (Proveedores)
          {supplierBills.filter(b => b.status === 'pending').length > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">
              {supplierBills.filter(b => b.status === 'pending').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('fiscal')}
          className={`pb-4 px-1 text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 cursor-pointer ${
            activeTab === 'fiscal' ? 'border-black text-black font-black' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <FileText size={16} />
          Control Fiscal e Impuestos
        </button>
        <button
          onClick={() => setActiveTab('pl')}
          className={`pb-4 px-1 text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 cursor-pointer ${
            activeTab === 'pl' ? 'border-black text-black font-black' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Calculator size={16} />
          Estado de Pérdidas y Ganancias (P&L)
        </button>
      </div>

      {/* Tabs Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.15 }}
        >
          {/* TAB 1: OVERVIEW & FLOW */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Cash Flow Line Chart */}
                <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm lg:col-span-2">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">Historial de Flujo de Caja (USD)</h3>
                      <p className="text-xs text-slate-400">Tendencia histórica de ingresos vs egresos operacionales diarios.</p>
                    </div>
                  </div>
                  
                  {chartData.length === 0 ? (
                    <div className="h-[280px] flex items-center justify-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed text-xs">
                      No hay suficientes transacciones para graficar el flujo.
                    </div>
                  ) : (
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorEgresos" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderRadius: '16px', border: 'none', color: '#fff' }}
                            labelStyle={{ fontWeight: 'bold', fontSize: '11px', color: '#94a3b8' }}
                            itemStyle={{ fontSize: '12px' }}
                          />
                          <Legend verticalAlign="top" height={36} iconType="circle" />
                          <Area type="monotone" name="Ingresos ($)" dataKey="ingresos" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorIngresos)" />
                          <Area type="monotone" name="Egresos ($)" dataKey="egresos" stroke="#f43f5e" strokeWidth={2.5} fillOpacity={1} fill="url(#colorEgresos)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Expense Breakdown */}
                <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 mb-1">Distribución de Egresos</h3>
                    <p className="text-xs text-slate-400 mb-6">Categorías de gasto registradas en el mes actual.</p>

                    {categoryBreakdown.length === 0 ? (
                      <div className="py-12 text-center text-slate-300 italic text-xs">
                        No se han registrado egresos operacionales todavía.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {categoryBreakdown.map((item, index) => {
                          const percent = (item.value / stats.totalExpenses) * 100;
                          const colors = ['bg-rose-500', 'bg-indigo-500', 'bg-amber-500', 'bg-sky-500', 'bg-purple-500', 'bg-slate-500'];
                          const color = colors[index % colors.length];

                          return (
                            <div key={item.name} className="space-y-1">
                              <div className="flex justify-between text-xs font-semibold">
                                <span className="text-slate-700">{item.name}</span>
                                <span className="text-slate-900 font-bold">${item.value.toFixed(2)} ({percent.toFixed(0)}%)</span>
                              </div>
                              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div className={`${color} h-full rounded-full`} style={{ width: `${percent}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Slider to adjust simulation cost */}
                  <div className="mt-6 pt-5 border-t border-slate-100 bg-slate-50 p-4 rounded-2xl">
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                      <span>Simulador Food Cost: {foodCostPercent}%</span>
                      <span className="text-emerald-600">Utilidad: {100 - foodCostPercent}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="10" 
                      max="70" 
                      value={foodCostPercent} 
                      onChange={e => setFoodCostPercent(Number(e.target.value))}
                      className="w-full accent-black h-1 bg-slate-200 rounded-lg cursor-pointer"
                    />
                    <p className="text-[9px] text-slate-400 leading-normal mt-1.5">
                      Ajusta este porcentaje si no registras los insumos del inventario manualmente como egreso para modelar tu costo promedio de producción.
                    </p>
                  </div>
                </div>
              </div>

              {/* Cash Balance Breakdown Card */}
              <div className="bg-slate-900 text-white p-8 rounded-[36px] shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-1/3 w-36 h-36 bg-indigo-500/10 rounded-full blur-3xl" />
                
                <h3 className="text-lg font-bold text-emerald-400">Balance del Caja Chica & Conciliación Bancaria</h3>
                <p className="text-slate-400 text-xs mt-1">Saldos proyectados del efectivo real y fondos conciliados por pasarela de pago.</p>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-8">
                  {/* Cash USD */}
                  <div className="border-l-2 border-emerald-500 pl-4">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Caja Efectivo (USD)</span>
                    <span className="text-xl font-bold mt-1 block">
                      ${allEntries.filter(e => e.paymentMethod === 'cash' || e.paymentMethod === 'divisa').reduce((acc, e) => acc + (e.type === 'income' ? e.amount : -e.amount), 0).toFixed(2)}
                    </span>
                  </div>

                  {/* Pago Movil */}
                  <div className="border-l-2 border-indigo-500 pl-4">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Pago Móvil (Bs.)</span>
                    <span className="text-xl font-bold mt-1 block">
                      Bs. {(allEntries.filter(e => e.paymentMethod === 'pagomovil' || e.paymentMethod === 'pago_movil').reduce((acc, e) => acc + (e.type === 'income' ? e.amount : -e.amount), 0) * exchangeRate).toFixed(2)}
                    </span>
                  </div>

                  {/* Zelle */}
                  <div className="border-l-2 border-sky-400 pl-4">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Bancos USA (Zelle)</span>
                    <span className="text-xl font-bold mt-1 block">
                      ${allEntries.filter(e => e.paymentMethod === 'zelle').reduce((acc, e) => acc + (e.type === 'income' ? e.amount : -e.amount), 0).toFixed(2)}
                    </span>
                  </div>

                  {/* Card / Transfer */}
                  <div className="border-l-2 border-slate-500 pl-4">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Tarjetas y Bancos VES</span>
                    <span className="text-xl font-bold mt-1 block">
                      Bs. {(allEntries.filter(e => e.paymentMethod === 'card' || e.paymentMethod === 'punto' || e.paymentMethod === 'bank_transfer' || e.paymentMethod === 'credito').reduce((acc, e) => acc + (e.type === 'income' ? e.amount : -e.amount), 0) * exchangeRate).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LEDGER (LIBRO DE DIARIO) */}
          {activeTab === 'ledger' && (
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 sm:p-8">
              {/* Filters Header */}
              <div className="space-y-4 mb-8">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Libro Diario General de Cuentas</h3>
                    <p className="text-xs text-slate-400">Listado consolidado de cobros por caja y egresos administrativos de la empresa.</p>
                  </div>
                  
                  {/* Export buttons */}
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                      onClick={exportToCSV}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      <Download size={14} />
                      Exportar CSV
                    </button>
                    <button 
                      onClick={triggerPrint}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      <Printer size={14} />
                      Imprimir Libro
                    </button>
                  </div>
                </div>

                {/* Filter Controls Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-4 border-t border-slate-50">
                  {/* Search Description */}
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Buscar descripción..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-9 pr-3 py-2.5 w-full bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-black font-semibold"
                    />
                  </div>

                  {/* Type Filter */}
                  <select
                    value={selectedType}
                    onChange={e => setSelectedType(e.target.value)}
                    className="bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 text-xs font-bold text-slate-600 outline-none focus:border-black cursor-pointer"
                  >
                    <option value="all">📍 Todos los Tipos</option>
                    <option value="income">🟢 Ingresos</option>
                    <option value="expense">🔴 Egresos</option>
                  </select>

                  {/* Method Filter */}
                  <select
                    value={selectedMethod}
                    onChange={e => setSelectedMethod(e.target.value)}
                    className="bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 text-xs font-bold text-slate-600 outline-none focus:border-black cursor-pointer"
                  >
                    <option value="all">💳 Todos los Métodos</option>
                    <option value="cash">💵 Efectivo</option>
                    <option value="pagomovil">📱 Pago Móvil</option>
                    <option value="zelle">📧 Zelle</option>
                    <option value="card">💳 Tarjeta de Débito/Crédito</option>
                    <option value="bank_transfer">🏦 Transferencia Bancaria</option>
                  </select>

                  {/* Fiscal Filter */}
                  <select
                    value={selectedFiscalFilter}
                    onChange={e => setSelectedFiscalFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 text-xs font-bold text-slate-600 outline-none focus:border-black cursor-pointer"
                  >
                    <option value="all">⚖️ Todos los Registros</option>
                    <option value="fiscal">🧾 Con Factura Fiscal</option>
                    <option value="non-fiscal">📝 Sin Factura Fiscal</option>
                  </select>

                  {/* Category Filter */}
                  <select
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    className="bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 text-xs font-bold text-slate-600 outline-none focus:border-black cursor-pointer"
                  >
                    <option value="all">📁 Todas las Categorías</option>
                    <option value="Ventas de Restaurante">Ventas de Restaurante</option>
                    <option value="Insumos">Insumos e Ingredientes</option>
                    <option value="Nómina">Nómina y Personal</option>
                    <option value="Alquiler">Alquiler de Local</option>
                    <option value="Servicios">Servicios Públicos (Luz/Internet)</option>
                    <option value="Marketing">Marketing y Publicidad</option>
                    <option value="Impuestos">Impuestos / Tasas Municipales</option>
                    <option value="Aporte de Capital">Aporte de Capital</option>
                    <option value="Eventos Especiales">Eventos Especiales</option>
                    <option value="Otros Egresos">Otros Egresos</option>
                  </select>
                </div>

                {/* Date Filter Row */}
                <div className="flex flex-wrap gap-4 items-center bg-slate-50 p-3 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5"><Calendar size={12} /> Rango de Fechas:</span>
                  <div className="flex items-center gap-2">
                    <input 
                      type="date" 
                      value={dateRange.start}
                      onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                      className="bg-white border border-slate-100 rounded-lg px-2.5 py-1 text-xs outline-none font-semibold text-slate-600 cursor-pointer"
                    />
                    <span className="text-slate-400 text-xs">hasta</span>
                    <input 
                      type="date" 
                      value={dateRange.end}
                      onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                      className="bg-white border border-slate-100 rounded-lg px-2.5 py-1 text-xs outline-none font-semibold text-slate-600 cursor-pointer"
                    />
                  </div>
                  {(dateRange.start || dateRange.end) && (
                    <button 
                      onClick={() => setDateRange({ start: '', end: '' })}
                      className="text-xs text-rose-500 hover:text-rose-700 font-bold"
                    >
                      Limpiar rango
                    </button>
                  )}
                </div>
              </div>

              {/* Entries Table */}
              {filteredEntries.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <SlidersHorizontal size={40} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-sm font-bold text-slate-600">No se encontraron movimientos financieros</p>
                  <p className="text-xs text-slate-400 mt-0.5">Modifica los filtros de búsqueda o registra un nuevo movimiento.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <th className="pb-4 font-bold">Concepto / Descripción</th>
                        <th className="pb-4 font-bold">Tipo y Categoría</th>
                        <th className="pb-4 font-bold">Fecha de Registro</th>
                        <th className="pb-4 font-bold">Estatus Fiscal</th>
                        <th className="pb-4 font-bold">Método</th>
                        <th className="pb-4 font-bold text-right">Monto (USD / Bs.)</th>
                        <th className="pb-4 font-bold text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium">
                      {filteredEntries.map((entry) => {
                        const isIncome = entry.type === 'income';
                        const isAutomatic = (entry as any).isAutomatic;
                        
                        return (
                          <tr 
                            key={entry.id} 
                            onClick={() => setSelectedDetailEntry(entry)}
                            className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                          >
                            {/* Concept / Desc */}
                            <td className="py-4 max-w-[280px]">
                              <span className="font-bold text-slate-900 block truncate" title={entry.description}>
                                {entry.description}
                              </span>
                              {isAutomatic && (
                                <span className="inline-flex mt-1 text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 bg-sky-50 text-sky-600 rounded-md border border-sky-100">
                                  Autogenerado Caja
                                </span>
                              )}
                            </td>

                            {/* Type and Cat */}
                            <td className="py-4">
                              <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${isIncome ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isIncome ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                {entry.category}
                              </span>
                            </td>

                            {/* Timestamp */}
                            <td className="py-4 text-slate-500 font-mono text-[11px]">
                              {new Date(entry.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                            </td>

                            {/* Fiscal invoice status */}
                            <td className="py-4">
                              {entry.isFiscal ? (
                                <div className="space-y-0.5">
                                  <span className="text-[10px] bg-slate-900 text-white font-mono px-1.5 py-0.5 rounded uppercase font-black">
                                    FACTURA
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-mono block">
                                    {entry.fiscalInvoice || 'Sin número'}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[10px] font-bold">No Fiscal</span>
                              )}
                            </td>

                            {/* Payment Method */}
                            <td className="py-4">
                              <span className="font-bold text-slate-600 uppercase tracking-wider text-[9px] whitespace-nowrap">
                                {getPaymentMethodLabel(entry.paymentMethod || '')}
                              </span>
                            </td>

                            {/* Amount USD/VES */}
                            <td className="py-4 text-right">
                              <span className={`font-black text-sm block ${isIncome ? 'text-emerald-600' : 'text-slate-900'}`}>
                                {isIncome ? '+' : '-'}${entry.amount.toFixed(2)}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono font-bold block">
                                Bs. {(entry.amount * exchangeRate).toFixed(2)}
                              </span>
                            </td>

                            {/* Action Buttons */}
                            <td className="py-4 text-center" onClick={(e) => e.stopPropagation()}>
                              {isAutomatic ? (
                                <span className="text-[10px] text-slate-400 font-semibold italic">Solo lectura</span>
                              ) : (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => startEditEntry(entry)}
                                    className="p-1.5 text-slate-400 hover:text-black hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                                    title="Editar Registro"
                                  >
                                    <Edit3 size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteEntry(entry.id!)}
                                    className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                    title="Eliminar Registro"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB: ACCOUNTS PAYABLE (CUENTAS POR PAGAR) */}
          {activeTab === 'payable' && (
            <div className="space-y-6">
              {/* Tab Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Cuentas por Pagar a Proveedores</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Control de pasivos, facturas a crédito de proveedores y fechas de vencimiento.</p>
                </div>
                <button
                  onClick={() => setIsAddingBill(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-black text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-all cursor-pointer"
                >
                  <PlusCircle size={14} />
                  Registrar Cuenta por Pagar
                </button>
              </div>

              {/* Sub-KPIs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center gap-4">
                  <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                    <TrendingDown size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-extrabold block">Deuda Pendiente Total</span>
                    <span className="text-xl font-black text-slate-900">${stats.totalPendingPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-[10px] text-slate-400 font-mono block">Bs. {(stats.totalPendingPayable * exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center gap-4">
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                    <Clock size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-extrabold block">Facturas Pendientes</span>
                    <span className="text-xl font-black text-slate-900">
                      {supplierBills.filter(b => b.status === 'pending').length} facturas
                    </span>
                    <span className="text-[10px] text-slate-400 block">Por liquidar con caja chica o bancos</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center gap-4">
                  <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-extrabold block">Facturas Vencidas</span>
                    <span className="text-xl font-black text-red-600">
                      {supplierBills.filter(b => b.status === 'pending' && new Date(b.dueDate + 'T23:59:59') < new Date()).length} facturas
                    </span>
                    <span className="text-[10px] text-slate-400 block">Excedieron la fecha límite de pago</span>
                  </div>
                </div>
              </div>

              {/* Bills List Card */}
              <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 sm:p-8">
                {supplierBills.length === 0 ? (
                  <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Inbox size={40} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-sm font-bold text-slate-600">No hay cuentas por pagar registradas</p>
                    <p className="text-xs text-slate-400 mt-0.5">Las facturas que adquieras a crédito con proveedores aparecerán aquí.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          <th className="pb-4 font-bold">Proveedor / Detalle</th>
                          <th className="pb-4 font-bold">Categoría</th>
                          <th className="pb-4 font-bold">Vencimiento</th>
                          <th className="pb-4 font-bold">Impuestos (IVA)</th>
                          <th className="pb-4 font-bold">Estatus</th>
                          <th className="pb-4 font-bold text-right">Monto</th>
                          <th className="pb-4 font-bold text-center">Acciones de Pago</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-medium">
                        {supplierBills.map((bill) => {
                          const isPending = bill.status === 'pending';
                          const isOverdue = isPending && new Date(bill.dueDate + 'T23:59:59') < new Date();
                          
                          // Days remaining
                          let daysText = '';
                          if (isPending) {
                            const diffTime = new Date(bill.dueDate + 'T23:59:59').getTime() - new Date().getTime();
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            if (diffDays < 0) {
                              daysText = `Vencida por ${Math.abs(diffDays)} días`;
                            } else if (diffDays === 0) {
                              daysText = 'Vence hoy';
                            } else {
                              daysText = `Vence en ${diffDays} días`;
                            }
                          }

                          return (
                            <tr key={bill.id} className={`hover:bg-slate-50/50 transition-colors ${isOverdue ? 'bg-rose-50/20' : ''}`}>
                              {/* Supplier / Details */}
                              <td className="py-4">
                                <span className="font-black text-slate-900 block text-sm">{bill.supplierName}</span>
                                <span className="text-slate-400 text-[11px] block mt-0.5">{bill.description}</span>
                              </td>

                              {/* Category */}
                              <td className="py-4">
                                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full font-bold text-[9px] uppercase">
                                  {bill.category}
                                </span>
                              </td>

                              {/* Due Date */}
                              <td className="py-4">
                                <span className="font-semibold block">{new Date(bill.dueDate + 'T12:00:00').toLocaleDateString([], { dateStyle: 'medium' })}</span>
                                {isPending ? (
                                  <span className={`text-[10px] font-bold block mt-0.5 ${isOverdue ? 'text-rose-600 font-black' : 'text-slate-400'}`}>
                                    {daysText}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">
                                    Pagada el {new Date(bill.paidAt!).toLocaleDateString()}
                                  </span>
                                )}
                              </td>

                              {/* Fiscal status */}
                              <td className="py-4">
                                {bill.isFiscal ? (
                                  <div className="space-y-0.5">
                                    <span className="inline-block text-[9px] bg-slate-900 text-white font-mono px-1.5 py-0.5 rounded uppercase font-black">
                                      FACTURA FISCAL
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-mono block">
                                      {bill.fiscalInvoice || 'Sin número'}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-[10px] font-bold">Nota de Entrega</span>
                                )}
                              </td>

                              {/* Status */}
                              <td className="py-4">
                                {isPending ? (
                                  <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${isOverdue ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${isOverdue ? 'bg-red-600' : 'bg-amber-500'}`} />
                                    {isOverdue ? 'Vencido' : 'Por Pagar'}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    Saldado
                                  </span>
                                )}
                              </td>

                              {/* Amount */}
                              <td className="py-4 text-right">
                                <span className="font-black text-sm text-slate-950 block">${bill.amount.toFixed(2)}</span>
                                <span className="text-[10px] text-slate-400 font-mono font-bold block">Bs. {(bill.amount * exchangeRate).toFixed(2)}</span>
                              </td>

                              {/* Action - Inline payment choice */}
                              <td className="py-4">
                                <div className="flex items-center justify-center gap-2">
                                  {isPending ? (
                                    payingBillId === bill.id ? (
                                      <div className="bg-slate-50 border border-slate-200 p-2 rounded-xl flex items-center gap-2 shadow-sm">
                                        <select
                                          value={payBillMethod}
                                          onChange={e => setPayBillMethod(e.target.value)}
                                          className="bg-white border border-slate-200 text-[11px] font-bold rounded px-1.5 py-1 cursor-pointer"
                                        >
                                          <option value="cash">💵 Efectivo USD</option>
                                          <option value="pagomovil">📱 Pago Móvil</option>
                                          <option value="zelle">📧 Zelle USD</option>
                                          <option value="card">💳 Tarjeta (VES)</option>
                                          <option value="bank_transfer">🏦 Transf (VES)</option>
                                        </select>
                                        <button
                                          onClick={() => handlePayBill(bill, payBillMethod)}
                                          className="px-2 py-1 bg-emerald-600 text-white rounded font-bold text-[10px] hover:bg-emerald-700 transition-colors cursor-pointer"
                                        >
                                          Pagar
                                        </button>
                                        <button
                                          onClick={() => setPayingBillId(null)}
                                          className="text-slate-400 hover:text-slate-600 text-[10px] font-bold"
                                        >
                                          X
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          setPayingBillId(bill.id!);
                                          setPayBillMethod('cash');
                                        }}
                                        className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer"
                                      >
                                        Liquidar Deuda
                                      </button>
                                    )
                                  ) : (
                                    <div className="text-slate-400 text-[11px] italic flex items-center gap-1.5">
                                      <CheckCircle2 size={12} className="text-emerald-500" />
                                      {bill.paymentMethod === 'cash' ? '💵 Efectivo' : bill.paymentMethod === 'pagomovil' ? '📱 PMóvil' : bill.paymentMethod === 'zelle' ? '📧 Zelle' : '💳 Banco'}
                                    </div>
                                  )}

                                  <button
                                    onClick={() => handleDeleteBill(bill.id!)}
                                    className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                    title="Eliminar Cuenta"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: FISCAL & TAXES (CONTROL FISCAL) */}
          {activeTab === 'fiscal' && (
            <div className="space-y-6">
              {/* Informative alert about Venezuelan fiscal obligations */}
              <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-3xl text-xs text-indigo-900 leading-relaxed flex gap-3">
                <FileText size={20} className="text-indigo-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-extrabold mb-1">Declaración de Impuestos y Cumplimiento de SENIAT</h4>
                  <p>
                    Este módulo consolida el Débito Fiscal del Impuesto al Valor Agregado (IVA) acumulado por ventas, restando el Crédito Fiscal justificado por egresos válidos de insumos o servicios con facturas de proveedores fiscales. También registra la estimación del Impuesto a las Grandes Transacciones Financieras (IGTF - 3% sobre USD en efectivo).
                  </p>
                </div>
              </div>

              {/* Fiscal Stats Board */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* VAT Debit */}
                <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] uppercase tracking-widest text-slate-400 font-extrabold block">Débito Fiscal Recaudado (IVA 16%)</span>
                    <div className="text-3xl font-black text-rose-600 mt-2">${stats.totalIvaDebito.toFixed(2)}</div>
                    <div className="text-xs text-slate-400 font-mono font-bold mt-1">
                      Bs. {(stats.totalIvaDebito * exchangeRate).toFixed(2)}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-4 leading-normal">Total IVA cobrado de facturas y ventas por caja registradas en el período.</p>
                </div>

                {/* VAT Credit */}
                <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] uppercase tracking-widest text-slate-400 font-extrabold block">Crédito Fiscal Deducible (IVA Pagado)</span>
                    <div className="text-3xl font-black text-emerald-600 mt-2">${stats.totalIvaCredito.toFixed(2)}</div>
                    <div className="text-xs text-slate-400 font-mono font-bold mt-1">
                      Bs. {(stats.totalIvaCredito * exchangeRate).toFixed(2)}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-4 leading-normal">IVA deducible proveniente de egresos operacionales justificados con Factura Fiscal.</p>
                </div>

                {/* Estimated IGTF + Withholdings */}
                <div className="bg-slate-900 text-white p-6 rounded-[28px] shadow-sm relative overflow-hidden flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] uppercase tracking-widest text-slate-400 font-extrabold block">Retenciones Acumuladas & IGTF 3%</span>
                    <div className="text-3xl font-black text-indigo-400 mt-2">
                      ${(stats.totalWithholdings + stats.totalIgtfCollected).toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-1">
                      Bs. {((stats.totalWithholdings + stats.totalIgtfCollected) * exchangeRate).toFixed(2)}
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] flex justify-between text-slate-400">
                    <span>Retenciones ISLR: ${stats.totalWithholdings.toFixed(2)}</span>
                    <span>IGTF Efectivo: ${stats.totalIgtfCollected.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Fiscal Invoice Log Ledger */}
              <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 sm:p-8">
                <h3 className="text-base font-extrabold text-slate-900 mb-2">Registro y Conciliación Tributaria de Facturas</h3>
                <p className="text-xs text-slate-400 mb-6">Listado de transacciones con efecto tributario (con Factura Fiscal justificativa).</p>
                
                {allEntries.filter(e => e.isFiscal).length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-sm font-bold text-slate-500">No hay facturas fiscales registradas</p>
                    <p className="text-xs text-slate-400 mt-0.5">Las ventas de caja y gastos con factura tributaria aparecerán aquí.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          <th className="pb-4 font-bold">Nro. Factura</th>
                          <th className="pb-4 font-bold">Detalle / Proveedor</th>
                          <th className="pb-4 font-bold">Monto Base USD</th>
                          <th className="pb-4 font-bold text-right">Alícuota IVA</th>
                          <th className="pb-4 font-bold text-right">Monto IVA USD</th>
                          <th className="pb-4 font-bold text-right">Retenciones Deducidas</th>
                          <th className="pb-4 font-bold text-right">Total Facturado USD</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-medium">
                        {allEntries.filter(e => e.isFiscal).map(entry => {
                          const isIncome = entry.type === 'income';
                          const rate = entry.taxRate || 16;
                          const baseAmount = isIncome 
                            ? entry.amount * (100 / (100 + rate)) // VAT included
                            : entry.amount; // for expense, assume amount is the base or total. Let's show as standard
                          const vatAmount = entry.taxAmount || 0;
                          const total = isIncome ? entry.amount : (entry.amount + (entry.taxAmount || 0) - (entry.withholdingAmount || 0));

                          return (
                            <tr 
                              key={entry.id} 
                              onClick={() => setSelectedDetailEntry(entry)}
                              className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                            >
                              <td className="py-4">
                                <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                                  #{entry.fiscalInvoice || 'N/A'}
                                </span>
                              </td>
                              <td className="py-4">
                                <span className="font-bold text-slate-800 block truncate max-w-[200px]">{entry.description}</span>
                                <span className="text-[9px] text-slate-400 uppercase font-black">{entry.category}</span>
                              </td>
                              <td className="py-4 font-mono">${baseAmount.toFixed(2)}</td>
                              <td className="py-4 text-right font-bold text-slate-500">{rate}%</td>
                              <td className="py-4 text-right font-mono text-rose-500">${vatAmount.toFixed(2)}</td>
                              <td className="py-4 text-right font-mono text-indigo-500">
                                {entry.withholdingAmount ? `-$${entry.withholdingAmount.toFixed(2)} (${entry.withholdingRate}%)` : '$0.00'}
                              </td>
                              <td className="py-4 text-right font-black text-slate-900">${total.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: PROFIT AND LOSS (PL) REPORT */}
          {activeTab === 'pl' && (
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 sm:p-8 space-y-8">
              {/* Report Header */}
              <div className="flex justify-between items-center pb-6 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Estado de Resultados Proyectado (P&L)</h3>
                  <p className="text-xs text-slate-400">Balance condensado de ingresos y costos operacionales para auditoría contable.</p>
                </div>
                <div className="bg-slate-50 px-4 py-2 rounded-xl text-xs font-mono font-bold text-slate-500">
                  Ejercicio: {new Date().toLocaleString([], { month: 'long', year: 'numeric' }).toUpperCase()}
                </div>
              </div>

              {/* Grid with breakdown of Income and Cost details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* 1. INGRESOS OPERACIONALES */}
                <div className="space-y-4">
                  <h4 className="text-xs uppercase tracking-widest font-black text-emerald-600 flex justify-between">
                    <span>1. Ingresos y Ventas</span>
                    <span>USD</span>
                  </h4>
                  
                  <div className="divide-y divide-slate-100/60 text-xs">
                    {/* POS Sales (automatic) */}
                    <div className="py-3 flex justify-between font-medium">
                      <span className="text-slate-600">Ventas de Salón y Delivery (Caja POS)</span>
                      <span className="font-bold text-slate-900">${salesIncomes.reduce((acc, s) => acc + s.amount, 0).toFixed(2)}</span>
                    </div>

                    {/* Manual Incomes */}
                    {Array.from(new Set(manualEntries.filter(e => e.type === 'income').map(e => e.category))).map(cat => {
                      const amount = manualEntries.filter(e => e.type === 'income' && e.category === cat).reduce((acc, e) => acc + e.amount, 0);
                      return (
                        <div key={cat} className="py-3 flex justify-between font-medium">
                          <span className="text-slate-600">{cat}</span>
                          <span className="font-bold text-slate-900">${amount.toFixed(2)}</span>
                        </div>
                      );
                    })}

                    {manualEntries.filter(e => e.type === 'income').length === 0 && (
                      <div className="py-3 flex justify-between font-medium text-slate-400 italic">
                        <span>Sin otros ingresos adicionales</span>
                        <span>$0.00</span>
                      </div>
                    )}

                    <div className="py-4 flex justify-between font-extrabold text-sm text-emerald-700 bg-emerald-50/50 px-3 rounded-xl mt-2">
                      <span>Ingresos Totales Brutos</span>
                      <span>${stats.totalIncomes.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* 2. EGRESOS Y COSTO DE PRODUCCION */}
                <div className="space-y-4">
                  <h4 className="text-xs uppercase tracking-widest font-black text-rose-500 flex justify-between">
                    <span>2. Costos de Venta y Egresos</span>
                    <span>USD</span>
                  </h4>
                  
                  <div className="divide-y divide-slate-100/60 text-xs">
                    {/* Simulated Food cost if applicable */}
                    {stats.simulatedFoodCost > 0 && (
                      <div className="py-3 flex justify-between font-medium">
                        <span className="text-slate-600">Costo Estimado de Alimentos (Simulación: {foodCostPercent}%)</span>
                        <span className="font-bold text-slate-900">${stats.simulatedFoodCost.toFixed(2)}</span>
                      </div>
                    )}

                    {/* Manual Expenses by Category */}
                    {Array.from(new Set(manualEntries.filter(e => e.type === 'expense').map(e => e.category))).map(cat => {
                      const amount = manualEntries.filter(e => e.type === 'expense' && e.category === cat).reduce((acc, e) => acc + e.amount, 0);
                      return (
                        <div key={cat} className="py-3 flex justify-between font-medium">
                          <span className="text-slate-600">{cat}</span>
                          <span className="font-bold text-slate-900">${amount.toFixed(2)}</span>
                        </div>
                      );
                    })}

                    {manualEntries.filter(e => e.type === 'expense').length === 0 && stats.simulatedFoodCost === 0 && (
                      <div className="py-3 flex justify-between font-medium text-slate-400 italic">
                        <span>Sin gastos registrados</span>
                        <span>$0.00</span>
                      </div>
                    )}

                    <div className="py-4 flex justify-between font-extrabold text-sm text-rose-700 bg-rose-50/50 px-3 rounded-xl mt-2">
                      <span>Egresos Totales Operativos</span>
                      <span>${stats.totalExpenses.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Profit Bottom line summary */}
              <div className="p-8 bg-slate-950 text-white rounded-[28px] mt-8 flex flex-col sm:flex-row justify-between items-center gap-6">
                <div>
                  <h4 className="text-xs uppercase tracking-widest font-black text-emerald-400">Resultado Neto Consolidado del Ejercicio</h4>
                  <div className="text-3xl font-black text-white mt-1">
                    ${stats.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-1">
                    Equivalente en Bolívares: Bs. {(stats.netProfit * exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-slate-900 border border-slate-800 px-6 py-4 rounded-2xl flex flex-col items-center">
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold">MARGEN OPERACIONAL</span>
                  <span className={`text-2xl font-black mt-1 ${stats.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                    {stats.netMargin.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* CREATE SUPPLIER BILL MODAL */}
      <AnimatePresence>
        {isAddingBill && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[32px] w-full max-w-lg p-6 sm:p-8 shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-xl font-extrabold text-slate-900 mb-2">
                📦 Nueva Factura por Pagar (Proveedor)
              </h3>
              <p className="text-xs text-slate-400 mb-6">
                Registre un pasivo o compromiso de pago a crédito con un proveedor. Cuando sea liquidado se registrará el gasto automáticamente en tu caja diaria.
              </p>

              <form onSubmit={handleSubmitBill} className="space-y-4">
                {/* Supplier Name */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Nombre del Proveedor</label>
                  <input 
                    type="text" 
                    required
                    value={billFormData.supplierName}
                    onChange={e => setBillFormData(prev => ({ ...prev, supplierName: e.target.value }))}
                    placeholder="Ej. Distribuidora Polar, Carnes El Corral, etc."
                    className="px-3 py-2.5 w-full bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-black font-semibold text-slate-800"
                  />
                </div>

                {/* Amount and Due Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Monto de la Deuda (USD)</label>
                    <div className="relative">
                      <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="number" 
                        step="0.01"
                        required
                        value={billFormData.amount || ''}
                        onChange={e => setBillFormData(prev => ({ ...prev, amount: Number(e.target.value) }))}
                        placeholder="0.00"
                        className="pl-8 pr-3 py-2.5 w-full bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-black font-bold font-mono text-slate-800"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Fecha de Vencimiento</label>
                    <input 
                      type="date" 
                      required
                      value={billFormData.dueDate}
                      onChange={e => setBillFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                      className="px-3 py-2.5 w-full bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-black font-semibold text-slate-600 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Category selection */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Categoría del Gasto</label>
                  <select
                    value={billFormData.category}
                    onChange={e => setBillFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="px-3 py-2.5 w-full bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-black font-bold cursor-pointer text-slate-700"
                  >
                    <option value="Insumos">Insumos e Ingredientes (Alimentos/Bebidas)</option>
                    <option value="Servicios">Servicios Públicos o Logística</option>
                    <option value="Alquiler">Alquiler / Mantenimiento</option>
                    <option value="Marketing">Marketing / Publicidad</option>
                    <option value="Otros Egresos">Otros Egresos Administrativos</option>
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Detalle / Concepto</label>
                  <input 
                    type="text" 
                    required
                    value={billFormData.description}
                    onChange={e => setBillFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Ej. Compra de 50kg de carne regulada a crédito"
                    className="px-3 py-2.5 w-full bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-black font-semibold text-slate-800"
                  />
                </div>

                {/* Fiscal Toggle */}
                <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={billFormData.isFiscal}
                      onChange={e => setBillFormData(prev => ({ ...prev, isFiscal: e.target.checked }))}
                      className="w-4 h-4 rounded text-black border-slate-200 border-2"
                    />
                    <span className="text-xs font-bold text-slate-700 select-none">🧾 Factura Fiscal Asociada (IVA Crédito Fiscal)</span>
                  </label>

                  {billFormData.isFiscal && (
                    <div className="pt-3 border-t border-slate-200">
                      <label className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Nro. de Factura / Control</label>
                      <input 
                        type="text" 
                        required={billFormData.isFiscal}
                        value={billFormData.fiscalInvoice || ''}
                        onChange={e => setBillFormData(prev => ({ ...prev, fiscalInvoice: e.target.value }))}
                        placeholder="F-004321"
                        className="px-2.5 py-1.5 w-full bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-black font-bold font-mono"
                      />
                    </div>
                  )}
                </div>

                {/* Form Buttons */}
                <div className="flex justify-end gap-2 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setIsAddingBill(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="px-6 py-2.5 bg-black text-white rounded-xl text-xs font-extrabold transition-all hover:bg-slate-800 shadow-md cursor-pointer"
                  >
                    Registrar Factura
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATE & EDIT MANUEL ENTRY MODAL */}
      <AnimatePresence>
        {isAddingEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[32px] w-full max-w-lg p-6 sm:p-8 shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-xl font-extrabold text-slate-900 mb-2">
                {editingEntry ? '✏️ Editar Registro Financiero' : '💰 Registrar Movimiento de Caja'}
              </h3>
              <p className="text-xs text-slate-400 mb-6">
                Ingrese los detalles del ingreso o egreso manual. Todos los campos de impuestos se calcularán automáticamente.
              </p>

              <form onSubmit={handleSubmitEntry} className="space-y-4">
                {/* Type toggle */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: 'expense', category: 'Insumos' }))}
                    className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      formData.type === 'expense' ? 'bg-black text-white shadow-md' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    🔴 Egreso / Gasto
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: 'income', category: 'Otros Ingresos' }))}
                    className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      formData.type === 'income' ? 'bg-black text-white shadow-md' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    🟢 Ingreso Manual
                  </button>
                </div>

                {/* Amount */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Monto (USD)</label>
                    <div className="relative">
                      <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="number" 
                        step="0.01"
                        name="amount"
                        required
                        value={formData.amount || ''}
                        onChange={handleFormChange}
                        placeholder="0.00"
                        className="pl-8 pr-3 py-2.5 w-full bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-black font-bold font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Monto Equivalente (VES)</label>
                    <input 
                      type="text" 
                      disabled
                      value={formData.amount ? `Bs. ${(formData.amount * exchangeRate).toFixed(2)}` : 'Bs. 0.00'}
                      className="px-3 py-2.5 w-full bg-slate-100 border border-transparent rounded-xl text-xs font-bold font-mono text-slate-500"
                    />
                  </div>
                </div>

                {/* Category Selection */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Categoría</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleFormChange}
                    className="px-3 py-2.5 w-full bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-black font-bold cursor-pointer text-slate-700"
                  >
                    {formData.type === 'expense' ? (
                      <>
                        <option value="Insumos">Insumos e Ingredientes (Alimentos/Bebidas)</option>
                        <option value="Nómina">Nómina y Salarios del Personal</option>
                        <option value="Alquiler">Alquiler del Establecimiento</option>
                        <option value="Servicios">Servicios Públicos (Luz, Agua, Internet, Gas)</option>
                        <option value="Marketing">Marketing y Publicidad</option>
                        <option value="Impuestos">Impuestos / Tasas Municipales o SENIAT</option>
                        <option value="Otros Egresos">Otros Egresos Administrativos</option>
                      </>
                    ) : (
                      <>
                        <option value="Cobro de Crédito">Cobro de Crédito / Pago de Cliente</option>
                        <option value="Otros Ingresos">Otros Ingresos Varios</option>
                        <option value="Aporte de Capital">Aportes y Capital de Socios</option>
                        <option value="Eventos Especiales">Ingresos por Eventos Especiales</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Conditional CRM client picker for debt collection */}
                {formData.type === 'income' && formData.category === 'Cobro de Crédito' && (
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Seleccionar Cliente de Crédito *</label>
                    <select
                      value={selectedDebtClientId}
                      required
                      onChange={e => {
                        const cid = e.target.value;
                        setSelectedDebtClientId(cid);
                        const client = clients.find(c => c.id === cid);
                        if (client) {
                          setFormData(prev => ({
                            ...prev,
                            description: `Abono/Pago de crédito de ${client.name} (CI: ${client.cedula || 'N/A'})`,
                            amount: client.debt || 0
                          }));
                        }
                      }}
                      className="px-3 py-2.5 w-full bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-black font-bold cursor-pointer text-slate-700"
                    >
                      <option value="">-- Seleccionar de la lista --</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>
                          👤 {c.name} {c.cedula ? `(CI: ${c.cedula})` : ''} - Deuda actual: ${c.debt || 0}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Description */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Descripción / Concepto</label>
                  <input 
                    type="text" 
                    name="description"
                    required
                    value={formData.description}
                    onChange={handleFormChange}
                    placeholder="Ej. Pago de nómina quincenal o Compra de hortalizas"
                    className="px-3 py-2.5 w-full bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-black font-semibold text-slate-800"
                  />
                </div>

                {/* Date and Payment Method */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Fecha</label>
                    <input 
                      type="datetime-local" 
                      name="timestamp"
                      required
                      value={formData.timestamp}
                      onChange={handleFormChange}
                      className="px-3 py-2.5 w-full bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-black font-semibold text-slate-600 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Método de Pago</label>
                    <select
                      name="paymentMethod"
                      value={formData.paymentMethod}
                      onChange={handleFormChange}
                      className="px-3 py-2.5 w-full bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-black font-bold cursor-pointer text-slate-700"
                    >
                      <option value="cash">💵 Efectivo</option>
                      <option value="pagomovil">📱 Pago Móvil</option>
                      <option value="zelle">📧 Zelle</option>
                      <option value="card">💳 Tarjeta Débito/Crédito</option>
                      <option value="bank_transfer">🏦 Transferencia Bancaria</option>
                    </select>
                  </div>
                </div>

                {/* Fiscal Toggle */}
                <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      name="isFiscal"
                      checked={formData.isFiscal}
                      onChange={handleFormChange}
                      className="w-4 h-4 rounded text-black border-slate-200 border-2"
                    />
                    <span className="text-xs font-bold text-slate-700 select-none">🧾 Movimiento justifica Factura Fiscal (SENIAT)</span>
                  </label>

                  {formData.isFiscal && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-3 pt-3 border-t border-slate-200 overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Nro. de Factura</label>
                          <input 
                            type="text" 
                            name="fiscalInvoice"
                            required={formData.isFiscal}
                            value={formData.fiscalInvoice}
                            onChange={handleFormChange}
                            placeholder="F-00123"
                            className="px-2.5 py-1.5 w-full bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-black font-bold font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Alícuota IVA (%)</label>
                          <select
                            name="taxRate"
                            value={formData.taxRate}
                            onChange={handleFormChange}
                            className="px-2.5 py-1.5 w-full bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-black font-bold cursor-pointer text-slate-700"
                          >
                            <option value="16">16% (General)</option>
                            <option value="8">8% (Reducido)</option>
                            <option value="0">Exento (0%)</option>
                          </select>
                        </div>
                      </div>

                      {formData.type === 'expense' && (
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div>
                            <label className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Retención ISLR (%)</label>
                            <select
                              name="withholdingRate"
                              value={formData.withholdingRate}
                              onChange={handleFormChange}
                              className="px-2.5 py-1.5 w-full bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-black font-bold cursor-pointer text-slate-700"
                            >
                              <option value="0">Sin retención (0%)</option>
                              <option value="1">1% (Servicios Generales)</option>
                              <option value="2">2% (Honorarios Profesionales)</option>
                              <option value="3">3% (Arrendamiento)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">IVA Retenido Proyectado</label>
                            <input 
                              type="text" 
                              disabled
                              value={formData.withholdingAmount ? `$ ${formData.withholdingAmount.toFixed(2)}` : '$ 0.00'}
                              className="px-2.5 py-1.5 w-full bg-slate-100 border border-transparent rounded-lg text-xs font-bold font-mono text-slate-500"
                            />
                          </div>
                        </div>
                      )}

                      <div className="p-2.5 bg-indigo-50/50 rounded-xl text-[10px] text-indigo-900 flex justify-between font-semibold font-mono">
                        <span>IVA Calculado: ${formData.taxAmount?.toFixed(2)}</span>
                        {formData.type === 'expense' && formData.withholdingAmount ? (
                          <span>Monto Neto con Retención: ${(formData.amount + (formData.taxAmount || 0) - (formData.withholdingAmount || 0)).toFixed(2)}</span>
                        ) : null}
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Form Buttons */}
                <div className="flex justify-end gap-2 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setIsAddingEntry(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="px-6 py-2.5 bg-black text-white rounded-xl text-xs font-extrabold transition-all hover:bg-slate-800 shadow-md cursor-pointer"
                  >
                    {editingEntry ? 'Guardar Cambios' : 'Registrar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TRANSACTION DETAIL MODAL */}
      <AnimatePresence>
        {selectedDetailEntry && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6 overflow-y-auto"
            onClick={() => { setSelectedDetailEntry(null); setCurrentDetailOrders([]); }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl overflow-hidden relative border border-slate-100 text-slate-800 text-left"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className={`${selectedDetailEntry.type === 'income' ? 'bg-emerald-600' : 'bg-slate-900'} text-white p-8 relative`}>
                <button 
                  onClick={() => { setSelectedDetailEntry(null); setCurrentDetailOrders([]); }}
                  className="absolute top-6 right-6 p-2 bg-white/15 hover:bg-white/25 text-white rounded-full transition-colors cursor-pointer"
                  title="Cerrar"
                >
                  <X size={18} />
                </button>
                <span className="text-[10px] bg-white/20 text-white font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                  {selectedDetailEntry.type === 'income' ? 'Ingreso Consolidado' : 'Egreso Registrado'}
                </span>
                <h3 className="text-xl font-black mt-3 leading-tight">
                  {selectedDetailEntry.isAutomatic ? 'Detalles del Pedido POS' : 'Registro de Caja Manual'}
                </h3>
                <p className="text-white/80 text-xs mt-1">Verificación de consumo y datos financieros</p>
              </div>

              {/* Body */}
              <div className="p-8 space-y-6 max-h-[65vh] overflow-y-auto">
                
                {/* General Ledger Info */}
                <div className="space-y-4">
                  <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 space-y-3">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-black block">Concepto</span>
                      <span className="font-bold text-slate-900 text-sm leading-snug block">
                        {selectedDetailEntry.description}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-xs pt-1 border-t border-slate-100">
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-black block">Categoría</span>
                        <span className="font-bold text-slate-800">{selectedDetailEntry.category}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-black block">Método de Pago</span>
                        <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                          {getPaymentMethodLabel(selectedDetailEntry.paymentMethod || '')}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-black block">Fecha y Hora</span>
                        <span className="font-semibold text-slate-700">
                          {new Date(selectedDetailEntry.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-black block">Tipo de Registro</span>
                        <span className={`inline-flex items-center gap-1.5 font-bold text-[10px] uppercase mt-0.5 px-2.5 py-0.5 rounded-full ${selectedDetailEntry.type === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${selectedDetailEntry.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {selectedDetailEntry.type === 'income' ? 'Ingreso' : 'Egreso'}
                        </span>
                      </div>
                    </div>

                    {/* Reference & Proof of payment details */}
                    {((selectedDetailEntry as any).waiterName || selectedDetailEntry.paymentReference || selectedDetailEntry.receiptImage || selectedDetailEntry.clientName) && (
                      <div className="pt-3 border-t border-slate-100 space-y-3 text-xs">
                        {(selectedDetailEntry as any).waiterName && (
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-black block">Atendido por (Mesero)</span>
                            <span className="font-bold text-slate-900 block mt-0.5">
                              👤 {(selectedDetailEntry as any).waiterName}
                            </span>
                          </div>
                        )}
                        {selectedDetailEntry.clientName && (
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-black block">Cliente Asociado</span>
                            <span className="font-bold text-slate-900 block mt-0.5">
                              👤 {selectedDetailEntry.clientName}
                            </span>
                          </div>
                        )}
                        {selectedDetailEntry.paymentReference && (
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-black block">Código de Referencia</span>
                            <span className="font-mono font-bold text-slate-900 block mt-0.5 bg-slate-100 px-2.5 py-1 rounded inline-block">
                              🔑 {selectedDetailEntry.paymentReference}
                            </span>
                          </div>
                        )}
                        {selectedDetailEntry.receiptImage && (
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-black block mb-1">Comprobante de Pago</span>
                            <div className="mt-1 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 relative group max-h-48 flex justify-center items-center">
                              <img 
                                src={selectedDetailEntry.receiptImage} 
                                alt="Comprobante" 
                                className="max-h-48 object-contain cursor-zoom-in"
                                onClick={() => window.open(selectedDetailEntry.receiptImage, '_blank')}
                              />
                            </div>
                            <span className="text-[9px] text-slate-400 mt-1 block font-medium">
                              * Haz clic en la imagen para abrirla en tamaño completo en otra pestaña.
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* If it's an automatic restaurant sale, load the orders dynamically */}
                {selectedDetailEntry.sessionId ? (
                  <div className="space-y-4">
                    <RestaurantOrderDetails 
                      sessionId={selectedDetailEntry.sessionId} 
                      accountId={selectedDetailEntry.accountId || 'default'} 
                      exchangeRate={exchangeRate} 
                      onOrdersLoaded={(orders) => setCurrentDetailOrders(orders)}
                    />
                  </div>
                ) : null}

                {/* Fiscal Information if present */}
                {selectedDetailEntry.isFiscal ? (
                  <div className="space-y-3">
                    <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-400">Declaración Fiscal SENIAT</h4>
                    <div className="bg-amber-50/50 p-5 rounded-3xl border border-amber-100/50 text-xs space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-700">Factura Fiscal Asociada:</span>
                        <span className="font-mono font-black text-slate-900 bg-amber-100 px-2 py-0.5 rounded text-[10px]">
                          #{selectedDetailEntry.fiscalInvoice || 'N/A'}
                        </span>
                      </div>
                      
                      <div className="divide-y divide-slate-200/50 text-xs space-y-2 pt-1">
                        <div className="flex justify-between font-medium pt-1">
                          <span className="text-slate-500">Monto Imponible (Base):</span>
                          <span>${(selectedDetailEntry.type === 'income' ? selectedDetailEntry.amount * (100 / (100 + (selectedDetailEntry.taxRate || 16))) : selectedDetailEntry.amount).toFixed(2)} USD</span>
                        </div>
                        <div className="flex justify-between font-medium pt-2">
                          <span className="text-slate-500">Alícuota IVA:</span>
                          <span>{selectedDetailEntry.taxRate || 16}%</span>
                        </div>
                        <div className="flex justify-between font-medium pt-2">
                          <span className="text-slate-500">Monto IVA Débito/Crédito:</span>
                          <span className="text-rose-600 font-bold font-mono">${(selectedDetailEntry.taxAmount || 0).toFixed(2)} USD</span>
                        </div>
                        {selectedDetailEntry.withholdingAmount ? (
                          <div className="flex justify-between font-medium pt-2 text-indigo-700">
                            <span>Retención ISLR aplicada ({selectedDetailEntry.withholdingRate}%):</span>
                            <span className="font-bold font-mono">-${selectedDetailEntry.withholdingAmount.toFixed(2)} USD</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-xs text-slate-400 font-bold">🧾 Este movimiento no posee efectos fiscales de SENIAT</span>
                  </div>
                )}

                {/* Total Section */}
                <div className="bg-slate-900 text-white p-6 rounded-3xl flex justify-between items-center">
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider font-extrabold block">Monto Consolidado</span>
                    <span className="text-2xl font-black text-white">${selectedDetailEntry.amount.toFixed(2)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider font-extrabold block">Conversión Oficial</span>
                    <span className="text-base font-bold text-emerald-400">Bs. {(selectedDetailEntry.amount * exchangeRate).toFixed(2)}</span>
                  </div>
                </div>

              </div>

              {/* Footer action */}
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center gap-3">
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleExportEntryAsTXT(selectedDetailEntry, currentDetailOrders)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-black bg-white hover:bg-slate-50 font-bold text-[11px] uppercase tracking-wider transition-all cursor-pointer"
                    title="Exportar detalle del pedido"
                  >
                    <Download size={14} /> Exportar
                  </button>
                  <button 
                    onClick={() => handlePrintEntry(selectedDetailEntry, currentDetailOrders)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-black bg-white hover:bg-slate-50 font-bold text-[11px] uppercase tracking-wider transition-all cursor-pointer"
                    title="Imprimir ticket de consumo"
                  >
                    <Printer size={14} /> Imprimir
                  </button>
                </div>

                <button 
                  onClick={() => {
                    setSelectedDetailEntry(null);
                    setCurrentDetailOrders([]);
                  }}
                  className="px-5 py-3 rounded-2xl bg-black hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Entendido
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* MODAL 3: Exportación Contable (Excel / CSV / PDF) */}
        {isExportModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6 relative overflow-hidden my-8"
            >
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 inline-block mb-1">
                    Centro de Reportes Contables
                  </span>
                  <h3 className="text-xl font-black text-slate-900">Exportación Contable Oficial</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Genera el paquete de información financiera estructurado listo para tu firma contable o contador.
                  </p>
                </div>
                <button 
                  onClick={() => setIsExportModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Step 1: Format Selector (The 3 required formats) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 block">
                  1. Formato de Salida Requerido:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setExportFormat('excel')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      exportFormat === 'excel'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-extrabold text-xs flex items-center gap-1.5">
                      <span>📊 Excel (.csv)</span>
                    </div>
                    <div className={`text-[10px] mt-1 leading-tight ${exportFormat === 'excel' ? 'text-emerald-100' : 'text-slate-400'}`}>
                      Estructurado con tildes UTF-8, libro diario y resumen.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportFormat('csv')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      exportFormat === 'csv'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-extrabold text-xs flex items-center gap-1.5">
                      <span>📑 CSV Técnico</span>
                    </div>
                    <div className={`text-[10px] mt-1 leading-tight ${exportFormat === 'csv' ? 'text-emerald-100' : 'text-slate-400'}`}>
                      Estandarizado para Profit, Galac, Saint, SAP u Odoo.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportFormat('pdf')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      exportFormat === 'pdf'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-extrabold text-xs flex items-center gap-1.5">
                      <span>📄 PDF Contable</span>
                    </div>
                    <div className={`text-[10px] mt-1 leading-tight ${exportFormat === 'pdf' ? 'text-emerald-100' : 'text-slate-400'}`}>
                      Informe de auditoría imprimible con membrete y firmas.
                    </div>
                  </button>
                </div>
              </div>

              {/* Step 2: Period Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 block">
                  2. Período Contable a Exportar:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setExportPeriod('current_month')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      exportPeriod === 'current_month'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Mes Actual
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportPeriod('last_month')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      exportPeriod === 'last_month'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Mes Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportPeriod('current_quarter')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      exportPeriod === 'current_quarter'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Trimestre
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportPeriod('custom')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      exportPeriod === 'custom'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Personalizado
                  </button>
                </div>

                {exportPeriod === 'custom' && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Desde:</label>
                      <input
                        type="date"
                        value={exportStartDate}
                        onChange={(e) => setExportStartDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Hasta:</label>
                      <input
                        type="date"
                        value={exportEndDate}
                        onChange={(e) => setExportEndDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3: Module Filter */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 block">
                  3. Alcance del Reporte:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExportModule('all')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      exportModule === 'all'
                        ? 'bg-slate-100 text-slate-900 border-slate-400 font-extrabold'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold">📗 Libro Diario Completo</div>
                    <div className="text-[10px] text-slate-400 font-normal">Todos los ingresos y egresos registrados.</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportModule('fiscal')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      exportModule === 'fiscal'
                        ? 'bg-slate-100 text-slate-900 border-slate-400 font-extrabold'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold">🏛️ Solo Movimientos Fiscales</div>
                    <div className="text-[10px] text-slate-400 font-normal">Facturas fiscales con IVA y retenciones.</div>
                  </button>
                </div>
              </div>

              {/* Live Summary Preview Box */}
              {(() => {
                const { start, end } = getExportDateRange();
                const filtered = allEntries.filter(entry => {
                  const entryDate = new Date(entry.timestamp);
                  if (entryDate < start || entryDate > end) return false;
                  if (exportModule === 'fiscal' && !entry.isFiscal) return false;
                  return true;
                });
                const ing = filtered.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
                const egr = filtered.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);

                return (
                  <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-2 border border-slate-800">
                    <div className="flex justify-between items-center text-[10px] uppercase tracking-wider text-slate-400 font-black">
                      <span>Resumen de Cierre a Exportar</span>
                      <span className="text-emerald-400 font-bold">{filtered.length} Asientos Contables</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800">
                      <div>
                        <span className="text-[9px] text-slate-400 block font-bold">Ingresos</span>
                        <span className="text-sm font-black text-emerald-400">${ing.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block font-bold">Egresos</span>
                        <span className="text-sm font-black text-rose-400">${egr.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block font-bold">Utilidad Neta</span>
                        <span className="text-sm font-black text-white">${(ing - egr).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(false)}
                  className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleRunAccountingExport();
                    if (exportFormat !== 'pdf') {
                      setIsExportModalOpen(false);
                    }
                  }}
                  className="flex-[2] py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Download size={16} />
                  <span>
                    {exportFormat === 'pdf' ? 'Vista Previa e Imprimir PDF' : `Descargar ${exportFormat === 'excel' ? 'Excel (.csv)' : 'CSV'}`}
                  </span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RestaurantOrderDetails({ 
  sessionId, 
  accountId, 
  exchangeRate, 
  onOrdersLoaded 
}: { 
  sessionId: string; 
  accountId: string; 
  exchangeRate: number; 
  onOrdersLoaded?: (orders: any[]) => void; 
}) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'sessions', sessionId, 'accounts', accountId, 'orders'),
      (snap) => {
        const loadedOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setOrders(loadedOrders);
        setLoading(false);
        if (onOrdersLoaded) {
          onOrdersLoaded(loadedOrders);
        }
      },
      (err) => {
        console.error("Error loading orders in modal:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [sessionId, accountId]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <p className="text-xs text-slate-400 italic text-center py-4">
        Sin productos registrados en esta orden.
      </p>
    );
  }

  return (
    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2.5">
      <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">
        Consumo Detallado del Cliente
      </h4>
      <div className="space-y-2">
        {orders.map((o) => (
          <div key={o.id} className="flex justify-between items-center text-xs pb-2 border-b border-slate-200/50 last:border-0 last:pb-0">
            <div>
              <span className="font-extrabold text-slate-900">{o.quantity}x</span>{' '}
              <span className="font-semibold text-slate-700">{o.itemName || o.menuItem?.name || 'Producto'}</span>
              {o.note && (
                <span className="block text-[10px] text-slate-400 italic font-normal">
                  Nota: {o.note}
                </span>
              )}
            </div>
            <div className="text-right">
              <span className="font-mono font-bold text-slate-900">
                ${((o.price || 0) * (o.quantity || 1)).toFixed(2)}
              </span>
              <span className="block text-[9px] text-slate-400">
                (${Number(o.price || 0).toFixed(2)} c/u)
              </span>
            </div>
          </div>
        ))}
      </div>
      
      <div className="pt-3 border-t border-slate-200 flex justify-between items-end">
        <div>
          <span className="text-[9px] text-slate-400 uppercase font-black block">Subtotal Consumo</span>
          <span className="text-base font-bold text-slate-900">
            ${orders.reduce((sum, o) => sum + ((o.price || 0) * (o.quantity || 1)), 0).toFixed(2)}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[9px] text-slate-400 uppercase font-black block">Equivalente Bs.</span>
          <span className="text-xs font-bold text-slate-600">
            Bs. {(orders.reduce((sum, o) => sum + ((o.price || 0) * (o.quantity || 1)), 0) * exchangeRate).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
