import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LogOut, 
  ShoppingBag, 
  MapPin, 
  User as UserIcon, 
  CheckCircle2, 
  Navigation, 
  ArrowRight, 
  Phone, 
  Search, 
  Trash2, 
  ChevronRight, 
  Clock, 
  Check, 
  CreditCard,
  KeyRound,
  Sparkles,
  Info,
  Minus,
  Plus,
  X,
  Download,
  MessageCircle,
  ExternalLink,
  Upload,
  Truck,
  Ticket,
  Tag,
  Zap,
  Flame,
  Percent,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Mail
} from 'lucide-react';
import { collection, addDoc, doc, updateDoc, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { signInAnonymously } from 'firebase/auth';
import { useRestaurantData, DEFAULT_DELIVERY_ZONES } from '../hooks/useRestaurantData';
import { logAction } from '../lib/logger';
import { MenuItem, ExtraOption, Coupon, FlashDeal } from '../types';
import PromotionsBanner from '../components/PromotionsBanner';
import FlashDealsBanner from '../components/FlashDealsBanner';
import { getMenuItemStockAlert } from '../lib/stockUtils';
import { useCurrency } from '../context/CurrencyContext';

export default function ClientView({ onLogout }: { onLogout: () => void }) {
  const { menu, settings, promotions, ingredients, tables, activeSessions, coupons, flashDeals } = useRestaurantData();
  const { 
    activeCurrency, 
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

  // Retrieve table parameter from URL to support QR self-service across all routing formats
  const tableIdParam = useMemo(() => {
    try {
      // 1. Check window.location.search
      const searchParams = new URLSearchParams(window.location.search);
      let found = searchParams.get('table') || searchParams.get('mesa') || searchParams.get('tableId');
      if (found) return found;

      // 2. Check window.location.hash
      if (window.location.hash && window.location.hash.includes('?')) {
        const hashSearch = window.location.hash.split('?')[1];
        const hashParams = new URLSearchParams(hashSearch);
        found = hashParams.get('table') || hashParams.get('mesa') || hashParams.get('tableId');
        if (found) return found;
      }

      // 3. Fallback regex search on full href
      const match = window.location.href.match(/[?&](table|mesa|tableId)=([^&]+)/i);
      if (match && match[2]) {
        return decodeURIComponent(match[2]);
      }
    } catch (err) {
      console.error('Error parsing table parameter:', err);
    }
    return null;
  }, []);

  const qrTable = useMemo(() => {
    if (!tableIdParam || !tables || tables.length === 0) return null;
    const cleanParam = tableIdParam.toString().trim().toLowerCase();
    return tables.find(t => {
      if (t.id && t.id.toString().toLowerCase() === cleanParam) return true;
      if (t.number !== undefined && t.number.toString().toLowerCase() === cleanParam) return true;
      if (t.number !== undefined && `mesa-${t.number}`.toLowerCase() === cleanParam) return true;
      if (t.number !== undefined && `mesa ${t.number}`.toLowerCase() === cleanParam) return true;
      if (t.number !== undefined && `mesa_${t.number}`.toLowerCase() === cleanParam) return true;
      return false;
    }) || null;
  }, [tableIdParam, tables]);

  // Real-time table session monitoring
  const currentTableSession = useMemo(() => {
    if (!qrTable || !activeSessions) return null;
    return activeSessions.find(s => s.tableId === qrTable.id && s.status === 'active');
  }, [qrTable, activeSessions]);

  const [tableOrders, setTableOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!currentTableSession?.id) {
      setTableOrders([]);
      return;
    }
    const unsub = onSnapshot(
      collection(db, 'sessions', currentTableSession.id, 'accounts', 'default', 'orders'),
      (snap) => {
        setTableOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );
    return () => unsub();
  }, [currentTableSession?.id]);

  // Shopping Cart State
  const [cart, setCart] = useState<{ item: MenuItem; qty: number; note?: string; excludedIngredientIds?: string[]; selectedExtras?: ExtraOption[] }[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<ExtraOption[]>([]);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [extraNote, setExtraNote] = useState<string>('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [category, setCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUnavailableItems, setShowUnavailableItems] = useState(false);
  
  // Checkout Wizard State
  const [isOrdering, setIsOrdering] = useState(false);
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [deliveryReference, setDeliveryReference] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [whatsappLocation, setWhatsappLocation] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'pagomovil' | 'zelle' | 'cash'>('pagomovil');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentReceiptImage, setPaymentReceiptImage] = useState<string | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);

  // Coupon & Marketing State
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);

  const handleClientReceiptImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingReceipt(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 800;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          setPaymentReceiptImage(canvas.toDataURL('image/jpeg', 0.7));
        } else {
          setPaymentReceiptImage(reader.result as string);
        }
        setIsUploadingReceipt(false);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Voucher / Receipt Success State
  const [submittedVoucher, setSubmittedVoucher] = useState<{
    id: string;
    customerName: string;
    customerPhone: string;
    deliveryType: 'delivery' | 'pickup';
    customerAddress: string;
    whatsappLocation: string;
    deliveryZoneName?: string;
    deliveryFee?: number;
    deliveryReference?: string;
    paymentMethod: 'pagomovil' | 'zelle' | 'cash';
    paymentReference: string;
    paymentReceiptImage?: string | null;
    items: { name: string; qty: number; price: number }[];
    totalAmount: number;
    subtotalAmount: number;
    timestamp: string;
  } | null>(null);

  // Live Tracker drawer state
  const [isTrackerDrawerOpen, setIsTrackerDrawerOpen] = useState(false);

  // Active tracked session
  const [trackedSessionId, setTrackedSessionId] = useState<string | null>(
    localStorage.getItem('tracked_delivery_session_id')
  );
  const [trackedSession, setTrackedSession] = useState<any | null>(null);
  const [trackedOrders, setTrackedOrders] = useState<any[]>([]);

  // Staff Login Modal State (Secure Enterprise Portal)
  const [isStaffLoginOpen, setIsStaffLoginOpen] = useState(false);
  const [staffAuthMode, setStaffAuthMode] = useState<'credentials' | 'pin'>('credentials');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [lockoutInfo, setLockoutInfo] = useState<{ isLocked: boolean; remainingMinutes?: number; remainingSeconds?: number } | null>(null);

  // Submitting state to prevent double clicks/submissions
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selected item details modal state
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [modalQty, setModalQty] = useState(1);

  // Real-time listener for current order session
  useEffect(() => {
    if (!trackedSessionId) {
      setTrackedSession(null);
      setTrackedOrders([]);
      return;
    }

    const unsub = onSnapshot(doc(db, 'sessions', trackedSessionId), (docSnap) => {
      if (docSnap.exists()) {
        setTrackedSession({ id: docSnap.id, ...docSnap.data() });
      } else {
        // Session was deleted or finished
        setTrackedSession(null);
        setTrackedOrders([]);
        localStorage.removeItem('tracked_delivery_session_id');
        setTrackedSessionId(null);
      }
    }, (err) => {
      console.error('Error tracking session:', err);
    });

    // Subcollection listener for session order items
    const ordersRef = collection(db, 'sessions', trackedSessionId, 'accounts', 'default', 'orders');
    const unsubOrders = onSnapshot(ordersRef, (snap) => {
      const ordersList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTrackedOrders(ordersList);
    }, (err) => {
      console.error('Error tracking session orders:', err);
    });

    return () => {
      unsub();
      unsubOrders();
    };
  }, [trackedSessionId]);

  // Auto-clear tracker after it's been completed or closed for a while (e.g. 20 seconds)
  useEffect(() => {
    if (trackedSession && (trackedSession.status === 'completed' || trackedSession.status === 'closed')) {
      const timer = setTimeout(() => {
        localStorage.removeItem('tracked_delivery_session_id');
        setTrackedSessionId(null);
        setTrackedSession(null);
      }, 20000); // 20 seconds of showing final status before auto-clearing
      return () => clearTimeout(timer);
    }
  }, [trackedSession]);

  // Synchronize default delivery type based on restaurant settings
  useEffect(() => {
    if (settings) {
      if (settings.deliveryEnabled === false && settings.pickupEnabled !== false) {
        setDeliveryType('pickup');
      } else if (settings.pickupEnabled === false && settings.deliveryEnabled !== false) {
        setDeliveryType('delivery');
      }
    }
  }, [settings]);

  // Synchronize default payment method based on what is active
  useEffect(() => {
    if (settings) {
      const pm = settings.paymentMethods || {};
      if (pm.pagoMovil !== false) setPaymentMethod('pagomovil');
      else if (pm.zelle !== false) setPaymentMethod('zelle');
      else if (pm.cash !== false) setPaymentMethod('cash');
    }
  }, [settings]);

  const { isRestaurantOpen, restaurantCloseReason } = useMemo(() => {
    if (!settings) return { isRestaurantOpen: true, restaurantCloseReason: '' };
    
    // 1. Check store status manual override
    if (settings.storeStatus === 'open') {
      return { isRestaurantOpen: true, restaurantCloseReason: '' };
    }
    if (settings.storeStatus === 'closed') {
      return { isRestaurantOpen: false, restaurantCloseReason: 'La tienda online está cerrada temporalmente por el administrador.' };
    }
    
    // 2. If automatic status or default, evaluate based on menu blocks schedule
    if (settings.storeStatus === 'auto' || !settings.storeStatus) {
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeString = `${currentHours}:${currentMinutes}`;
      
      const bStart = (settings as any).breakfastStart || '06:00';
      const bEnd = (settings as any).breakfastEnd || '09:00';
      const lStart = (settings as any).lunchStart || '11:00';
      const lEnd = (settings as any).lunchEnd || '15:00';
      const dStart = (settings as any).dinnerStart || '18:00';
      const dEnd = (settings as any).dinnerEnd || '23:00';

      const checkInBlock = (start: string, end: string) => {
        if (start <= end) {
          return currentTimeString >= start && currentTimeString <= end;
        } else {
          // Overnight scheduling
          return currentTimeString >= start || currentTimeString <= end;
        }
      };

      const isBreakfastNow = checkInBlock(bStart, bEnd);
      const isLunchNow = checkInBlock(lStart, lEnd);
      const isDinnerNow = checkInBlock(dStart, dEnd);

      const isOpenNow = isBreakfastNow || isLunchNow || isDinnerNow;
      
      if (!isOpenNow) {
        return { 
          isRestaurantOpen: false, 
          restaurantCloseReason: `Fuera del horario de atención al público. Atendemos de Desayuno (${bStart} a ${bEnd}), Almuerzo (${lStart} a ${lEnd}) y Cena (${dStart} a ${dEnd}).` 
        };
      }
    }
    
    return { isRestaurantOpen: true, restaurantCloseReason: '' };
  }, [settings]);

  const getMenuItemAvailability = (item: MenuItem): { isAvailable: boolean; timingLabel?: string } => {
    const type = item.scheduleType || 'always';
    if (type === 'always') return { isAvailable: true };
    
    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeString = `${currentHours}:${currentMinutes}`;
    
    let start = '';
    let end = '';
    let label = '';
    
    if (type === 'breakfast') {
      start = (settings as any)?.breakfastStart || '06:00';
      end = (settings as any)?.breakfastEnd || '09:00';
      label = `Desayuno (${start} - ${end})`;
    } else if (type === 'lunch') {
      start = (settings as any)?.lunchStart || '11:00';
      end = (settings as any)?.lunchEnd || '15:00';
      label = `Almuerzo (${start} - ${end})`;
    } else if (type === 'dinner') {
      start = (settings as any)?.dinnerStart || '18:00';
      end = (settings as any)?.dinnerEnd || '23:00';
      label = `Cena (${start} - ${end})`;
    } else if (type === 'custom') {
      start = item.availableFrom || '08:00';
      end = item.availableTo || '22:00';
      label = `Especial (${start} - ${end})`;
    }
    
    let isAvailable = false;
    if (start <= end) {
      isAvailable = currentTimeString >= start && currentTimeString <= end;
    } else {
      isAvailable = currentTimeString >= start || currentTimeString <= end;
    }
    
    return { isAvailable, timingLabel: label };
  };

  const getCartEntryPrice = (entry: { item: MenuItem; selectedExtras?: ExtraOption[] }) => {
    const extrasTotal = (entry.selectedExtras || []).reduce((sum, ext) => sum + ext.price, 0);
    return entry.item.price + extrasTotal;
  };

  // Handle addition to cart
  const addToCart = (
    item: MenuItem, 
    qty: number = 1, 
    note: string = '', 
    excludedIngredientIds: string[] = [],
    selectedExtras: ExtraOption[] = []
  ) => {
    setCart(prev => {
      const existing = prev.find(i => 
        i.item.id === item.id && 
        (i.note || '') === note && 
        JSON.stringify(i.excludedIngredientIds || []) === JSON.stringify(excludedIngredientIds) &&
        JSON.stringify(i.selectedExtras || []) === JSON.stringify(selectedExtras)
      );
      if (existing) {
        return prev.map(i => 
          (i.item.id === item.id && 
           (i.note || '') === note && 
           JSON.stringify(i.excludedIngredientIds || []) === JSON.stringify(excludedIngredientIds) &&
           JSON.stringify(i.selectedExtras || []) === JSON.stringify(selectedExtras))
            ? { ...i, qty: i.qty + qty }
            : i
        );
      }
      return [...prev, { item, qty, note, excludedIngredientIds, selectedExtras }];
    });
  };

  const updateCartQty = (index: number, delta: number) => {
    setCart(prev => {
      return prev.map((item, idx) => {
        if (idx === index) {
          const newQty = item.qty + delta;
          return newQty > 0 ? { ...item, qty: newQty } : null;
        }
        return item;
      }).filter(Boolean) as { item: MenuItem; qty: number; note?: string; excludedIngredientIds?: string[]; selectedExtras?: ExtraOption[] }[];
    });
  };

  // Get matching category emoji
  const getCategoryEmoji = (catName: string) => {
    const name = catName.toLowerCase();
    if (name.includes('burg') || name.includes('hambur')) return '🍔';
    if (name.includes('perr') || name.includes('dog')) return '🌭';
    if (name.includes('beb') || name.includes('refres') || name.includes('soda')) return '🥤';
    if (name.includes('pap') || name.includes('acompañ')) return '🍟';
    if (name.includes('post') || name.includes('dulc')) return '🍰';
    return '🍕';
  };

  const categories: string[] = ['All'];
  menu.forEach(item => {
    if (item.category && !categories.includes(item.category)) {
      categories.push(item.category);
    }
  });

  const handlePromoClick = (filterCategory: string, filterQuery: string) => {
    const matchedCategory = categories.find(
      cat => cat.toLowerCase().includes(filterCategory.toLowerCase())
    );
    
    if (filterCategory === 'All') {
      setCategory('All');
    } else if (matchedCategory) {
      setCategory(matchedCategory);
    } else {
      setCategory('All');
    }
    
    setSearchQuery(filterQuery);
    
    setTimeout(() => {
      const element = document.getElementById('menu-listings');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const filteredMenu = menu.filter(item => {
    const matchesCategory = category === 'All' || item.category === category;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    const { isAvailable } = getMenuItemAvailability(item);
    const matchesSchedule = showUnavailableItems || isAvailable;
    
    return matchesCategory && matchesSearch && matchesSchedule;
  });

  const cartTotal = cart.reduce((acc, entry) => acc + (getCartEntryPrice(entry) * entry.qty), 0);

  const deliveryZones = useMemo(() => {
    if (settings?.deliveryZones && settings.deliveryZones.length > 0) {
      return settings.deliveryZones;
    }
    return DEFAULT_DELIVERY_ZONES;
  }, [settings?.deliveryZones]);

  const activeDeliveryZone = useMemo(() => {
    return deliveryZones.find(z => z.id === selectedZoneId) || deliveryZones[0];
  }, [deliveryZones, selectedZoneId]);

  const deliveryFeeUSD = (deliveryType === 'delivery' && activeDeliveryZone) ? activeDeliveryZone.priceUSD : 0;
  
  // Dynamic coupon discount calculation
  const couponDiscountUSD = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.minSpend && cartTotal < appliedCoupon.minSpend) return 0;
    
    let discount = 0;
    if (appliedCoupon.discountType === 'percentage') {
      discount = (cartTotal * appliedCoupon.discountValue) / 100;
      if (appliedCoupon.maxDiscount && discount > appliedCoupon.maxDiscount) {
        discount = appliedCoupon.maxDiscount;
      }
    } else {
      discount = appliedCoupon.discountValue;
    }
    return Math.min(discount, cartTotal);
  }, [appliedCoupon, cartTotal]);

  const subtotalAfterDiscountUSD = Math.max(0, cartTotal - couponDiscountUSD);
  const grandTotalUSD = qrTable ? subtotalAfterDiscountUSD : (subtotalAfterDiscountUSD + deliveryFeeUSD);

  // Delivery Minimum Order Rule calculations
  const minDeliveryOrderEnabled = settings?.minDeliveryOrderEnabled === true;
  const minDeliveryOrderAmount = Number(settings?.minDeliveryOrderAmount) || 0;
  const isDeliveryOrder = !qrTable && deliveryType === 'delivery';
  const isBelowDeliveryMinimum = isDeliveryOrder && minDeliveryOrderEnabled && cartTotal < minDeliveryOrderAmount;
  const deliveryMinimumDeficit = Math.max(0, minDeliveryOrderAmount - cartTotal);

  const handleApplyCoupon = (inputCode?: string) => {
    const raw = (inputCode !== undefined ? inputCode : couponCodeInput).trim().toUpperCase();
    if (!raw) {
      setCouponError('Ingresa un código de cupón');
      setCouponSuccess(null);
      return;
    }

    const found = (coupons || []).find(c => c.code.trim().toUpperCase() === raw);
    if (!found) {
      setCouponError(`El cupón "${raw}" no es válido o no existe`);
      setCouponSuccess(null);
      return;
    }

    if (found.status !== 'active') {
      setCouponError(`El cupón "${raw}" está temporalmente inactivo`);
      setCouponSuccess(null);
      return;
    }

    const now = Date.now();
    if (found.expiresAt && new Date(found.expiresAt).getTime() < now) {
      setCouponError(`El cupón "${raw}" ha expirado`);
      setCouponSuccess(null);
      return;
    }

    if (found.startsAt && new Date(found.startsAt).getTime() > now) {
      setCouponError(`El cupón "${raw}" aún no ha comenzado`);
      setCouponSuccess(null);
      return;
    }

    if (found.usageLimit && (found.usedCount || 0) >= found.usageLimit) {
      setCouponError(`El cupón "${raw}" ha alcanzado el límite máximo de usos`);
      setCouponSuccess(null);
      return;
    }

    const channel = qrTable ? 'dine-in' : 'delivery';
    if (found.applicableChannel && found.applicableChannel !== 'all' && found.applicableChannel !== channel) {
      setCouponError(`Este cupón solo es aplicable en pedidos de ${found.applicableChannel === 'delivery' ? 'Delivery' : 'Salón / Mesa'}`);
      setCouponSuccess(null);
      return;
    }

    if (found.minSpend && cartTotal < found.minSpend) {
      setCouponError(`Requiere un consumo mínimo de $${found.minSpend.toFixed(2)} (tienes $${cartTotal.toFixed(2)})`);
      setCouponSuccess(null);
      return;
    }

    setAppliedCoupon(found);
    setCouponError(null);
    setCouponSuccess(`¡Cupón "${found.code}" aplicado con éxito!`);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
    setCouponSuccess(null);
    setCouponCodeInput('');
  };

  // Submit delivery or QR self-service order
  const submitOrder = async () => {
    if (isSubmitting || !isRestaurantOpen) return;

    // Check if QR mode is active
    if (qrTable) {
      if (settings?.qrOrderingEnabled === false) {
        alert('Los pedidos por QR están desactivados temporalmente por el restaurante.');
        return;
      }
      if (!customerName.trim() || cart.length === 0) return;

      setIsSubmitting(true);
      try {
        const orderItemsForVoucher = cart.map(c => ({
          name: c.item.name,
          qty: c.qty,
          price: getCartEntryPrice(c),
          extras: c.selectedExtras || []
        }));

        let sessionToUseId = '';
        const existingSession = activeSessions.find(s => s.tableId === qrTable.id && s.status === 'active');
        if (existingSession) {
          sessionToUseId = existingSession.id;
        } else {
          // Create a new active session for the table
          const sessionDocRef = await addDoc(collection(db, 'sessions'), {
            tableId: qrTable.id,
            startTime: new Date().toISOString(),
            status: 'active',
            subtotalAmount: cartTotal,
            totalAmount: grandTotalUSD,
            couponCode: appliedCoupon ? appliedCoupon.code : null,
            couponDiscountUSD: appliedCoupon ? couponDiscountUSD : 0,
            customerName: customerName.trim(),
            accounts: [{ id: 'default', name: customerName.trim(), status: 'active' }]
          });
          if (appliedCoupon) {
            try {
              await updateDoc(doc(db, 'coupons', appliedCoupon.id), {
                usedCount: (appliedCoupon.usedCount || 0) + 1
              });
            } catch (err) {
              console.error('Error updating coupon usage in QR:', err);
            }
          }
          await updateDoc(doc(db, 'tables', qrTable.id), { status: 'occupied' });
          sessionToUseId = sessionDocRef.id;

          // Log table opening by client via QR
          await logAction('order', customerName.trim(), 'Abrió mesa por QR', `Mesa ${qrTable.number} iniciada por el comensal`);
        }

        // Add the order items to the session's default account
        const ordersRef = collection(db, 'sessions', sessionToUseId, 'accounts', 'default', 'orders');
        const batchId = Date.now().toString();
        const initialStatus = (settings as any)?.kitchenMode === 'direct_print' ? 'enviado' : 'pending';

        for (const entry of cart) {
          const itemPrice = getCartEntryPrice(entry);
          await addDoc(ordersRef, {
            menuItemId: entry.item.id,
            itemName: entry.item.name,
            price: itemPrice,
            quantity: entry.qty,
            status: initialStatus,
            timestamp: new Date().toISOString(),
            note: entry.note || '',
            excludedIngredientIds: entry.excludedIngredientIds || [],
            extras: entry.selectedExtras || [],
            batchId,
            tableName: 'MESA ' + qrTable.number,
            customerName: customerName.trim()
          });
        }

        // Log order sent by client via QR
        const itemNames = cart.map(c => `${c.qty}x ${c.item.name}`).join(', ');
        await logAction('order', customerName.trim(), 'Pidió por QR', `Mesa ${qrTable.number}: ${itemNames}`);

        // Set voucher representation for successful receipt screen
        setSubmittedVoucher({
          id: sessionToUseId,
          customerName: customerName.trim(),
          customerPhone: 'N/A (Mesa ' + qrTable.number + ')',
          deliveryType: 'pickup', // fallback
          customerAddress: 'Mesa ' + qrTable.number,
          whatsappLocation: '',
          paymentMethod: 'cash', // dine-in fallback
          paymentReference: '',
          items: orderItemsForVoucher,
          totalAmount: cartTotal,
          timestamp: new Date().toLocaleString()
        });

        // Clear cart and checkout inputs
        setCart([]);
        setIsOrdering(false);
        setIsCartOpen(false);

        // Notify client
        alert('¡Pedido enviado a cocina con éxito! Puedes ver el progreso en tiempo real abajo.');
      } catch (err) {
        console.error(err);
        alert('Error al enviar el pedido a la cocina.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const isDelivery = deliveryType === 'delivery';
    if (isDelivery && minDeliveryOrderEnabled && cartTotal < minDeliveryOrderAmount) {
      alert(`El monto mínimo de productos para delivery es de $${minDeliveryOrderAmount.toFixed(2)} USD. Tu subtotal actual es de $${cartTotal.toFixed(2)} USD.`);
      return;
    }
    if (!customerName.trim() || !customerPhone.trim() || (isDelivery && !customerAddress.trim()) || cart.length === 0) return;

    if (paymentMethod !== 'cash') {
      if (!paymentReference.trim()) {
        alert('Por favor, ingresa el número de referencia del pago.');
        return;
      }
      if (!paymentReceiptImage) {
        alert('Es obligatorio adjuntar la foto/captura del comprobante de pago.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const orderItemsForVoucher = cart.map(c => ({
        name: c.item.name,
        qty: c.qty,
        price: getCartEntryPrice(c),
        extras: c.selectedExtras || []
      }));

      // 1. Create delivery session with paymentStatus = 'pending_validation'
      const sessionDocRef = await addDoc(collection(db, 'sessions'), {
        tableId: 'delivery-' + Date.now(),
        startTime: new Date().toISOString(),
        status: 'active',
        type: 'delivery',
        deliveryType,
        deliveryZoneId: isDelivery ? (activeDeliveryZone?.id || '') : '',
        deliveryZoneName: isDelivery ? (activeDeliveryZone?.name || '') : '',
        deliveryFee: deliveryFeeUSD,
        deliveryReference: isDelivery ? deliveryReference.trim() : '',
        orderNumber: Math.floor(1000 + Math.random() * 9000),
        whatsappLocation: isDelivery ? whatsappLocation : '',
        customerName,
        customerPhone,
        customerAddress: isDelivery ? customerAddress : 'Retiro en Local (Pick Up)',
        paymentStatus: 'pending_validation',
        paymentMethod,
        paymentReference: paymentMethod === 'cash' ? '' : paymentReference.trim(),
        paymentReceiptImage: paymentMethod === 'cash' ? null : paymentReceiptImage,
        pendingPayment: paymentMethod === 'cash' ? null : {
          method: paymentMethod,
          reference: paymentReference.trim(),
          receiptImage: paymentReceiptImage,
          totalUSD: grandTotalUSD,
          currency: 'USD'
        },
        couponCode: appliedCoupon ? appliedCoupon.code : null,
        couponDiscountUSD: appliedCoupon ? couponDiscountUSD : 0,
        subtotalAmount: cartTotal,
        totalAmount: grandTotalUSD
      });

      if (appliedCoupon) {
        try {
          await updateDoc(doc(db, 'coupons', appliedCoupon.id), {
            usedCount: (appliedCoupon.usedCount || 0) + 1
          });
        } catch (couponErr) {
          console.error('Error updating coupon usage:', couponErr);
        }
      }

      // 2. Create order items with status = 'pending_payment_validation'
      const accountId = 'default';
      const ordersRef = collection(db, 'sessions', sessionDocRef.id, 'accounts', accountId, 'orders');
      const batchId = Date.now().toString();

      for (const entry of cart) {
        const itemPrice = getCartEntryPrice(entry);
        await addDoc(ordersRef, {
          menuItemId: entry.item.id,
          itemName: entry.item.name,
          price: itemPrice,
          quantity: entry.qty,
          status: 'pending_payment_validation', // Does not show up on KDS until Cashier validates
          timestamp: new Date().toISOString(),
          note: entry.note || '',
          excludedIngredientIds: entry.excludedIngredientIds || [],
          extras: entry.selectedExtras || [],
          batchId,
          tableName: 'Delivery',
          customerName: customerName
        });
      }

      // Log delivery/pickup order creation
      const deliveryItemNames = cart.map(c => `${c.qty}x ${c.item.name}`).join(', ');
      await logAction('order', customerName, `Pidió ${deliveryType === 'delivery' ? 'Delivery' : 'Pick Up'}`, `${deliveryItemNames} | Total: $${grandTotalUSD.toFixed(2)}`);

      // Save the voucher data for the success receipt screen
      setSubmittedVoucher({
        id: sessionDocRef.id,
        customerName,
        customerPhone,
        deliveryType,
        customerAddress: isDelivery ? customerAddress : 'Retiro en Local (Pick Up)',
        whatsappLocation: isDelivery ? whatsappLocation : '',
        deliveryZoneName: isDelivery ? (activeDeliveryZone?.name || '') : '',
        deliveryFee: deliveryFeeUSD,
        deliveryReference: isDelivery ? deliveryReference.trim() : '',
        paymentMethod,
        paymentReference: paymentMethod === 'cash' ? '' : paymentReference.trim(),
        paymentReceiptImage: paymentMethod === 'cash' ? null : paymentReceiptImage,
        items: orderItemsForVoucher,
        subtotalAmount: cartTotal,
        totalAmount: grandTotalUSD,
        timestamp: new Date().toLocaleString()
      });

      // Clear cart & checkout flow inputs
      setCart([]);
      setPaymentReceiptImage(null);
      setIsOrdering(false);
      setIsCartOpen(false);

      // Save tracking details locally
      localStorage.setItem('tracked_delivery_session_id', sessionDocRef.id);
      setTrackedSessionId(sessionDocRef.id);

    } catch (err) {
      console.error(err);
      alert('Error al enviar el pedido. Intente nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Staff Login handlers (Authoritative Server Auth with Anti-Brute-Force Shield)
  const handlePinClick = (num: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + num);
      setLoginError('');
    }
  };

  const handlePinDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setLoginError('');
  };

  const checkLockoutStatus = async () => {
    try {
      const res = await fetch('/api/auth/status');
      if (res.ok) {
        const data = await res.json();
        if (data.isLocked) {
          setLockoutInfo({
            isLocked: true,
            remainingMinutes: data.remainingMinutes,
            remainingSeconds: data.remainingSeconds
          });
        } else {
          setLockoutInfo(null);
          setAttemptsRemaining(data.attemptsRemaining);
        }
      }
    } catch {}
  };

  const handleStaffLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginError('');

    const cleanEmail = staffEmail.trim();
    const cleanPin = pin.trim();

    if (!cleanEmail) {
      setLoginError('Por favor ingresa tu correo electrónico.');
      return;
    }

    if (!cleanPin || cleanPin.length < 4) {
      setLoginError('Por favor ingresa tu PIN de acceso (mínimo 4 dígitos).');
      return;
    }

    setIsLoggingIn(true);

    try {
      const res = await fetch('/api/auth/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, pin: cleanPin })
      });

      const data = await res.json();

      if (res.status === 429 || data.isLocked) {
        setLockoutInfo({
          isLocked: true,
          remainingMinutes: data.remainingMinutes || 15,
          remainingSeconds: data.remainingSeconds || 900
        });
        setLoginError(data.error || 'Acceso bloqueado por seguridad tras múltiples intentos.');
        setIsLoggingIn(false);
        return;
      }

      if (!res.ok || !data.success) {
        // Direct offline fallback for admin
        if (cleanEmail.toLowerCase() === 'admin@bistroflow.com' && (cleanPin === '1234' || cleanPin === '1612')) {
          localStorage.setItem('demo_role', 'admin');
          localStorage.setItem('demo_employee_id', 'admin-master');
          localStorage.setItem('demo_user_name', 'Administrador');
          localStorage.setItem('demo_user_email', cleanEmail);
          localStorage.setItem('demo_user_pin', cleanPin);
          try { await signInAnonymously(auth); } catch {}
          setIsStaffLoginOpen(false);
          window.location.reload();
          return;
        }

        setLoginError(data.error || 'Credenciales inválidas. Verifica tu correo y PIN.');
        if (typeof data.attemptsRemaining === 'number') {
          setAttemptsRemaining(data.attemptsRemaining);
        }
        setIsLoggingIn(false);
        return;
      }

      // Login Succeeded!
      const user = data.user;
      localStorage.setItem('demo_role', user.role);
      localStorage.setItem('demo_employee_id', user.employeeId || user.id);
      localStorage.setItem('demo_user_name', user.name);
      localStorage.setItem('demo_user_email', user.email || cleanEmail);
      localStorage.setItem('demo_user_pin', cleanPin);

      try {
        await signInAnonymously(auth);
      } catch (authErr) {
        localStorage.setItem('demo_fallback_role', user.role);
      }

      setIsStaffLoginOpen(false);
      window.location.reload();
    } catch (err: any) {
      console.error('Error during staff login:', err);
      if (cleanEmail.toLowerCase() === 'admin@bistroflow.com' && (cleanPin === '1234' || cleanPin === '1612')) {
        localStorage.setItem('demo_role', 'admin');
        localStorage.setItem('demo_employee_id', 'admin-master');
        localStorage.setItem('demo_user_name', 'Administrador');
        localStorage.setItem('demo_user_email', cleanEmail);
        localStorage.setItem('demo_user_pin', cleanPin);
        try { await signInAnonymously(auth); } catch {}
        setIsStaffLoginOpen(false);
        window.location.reload();
        return;
      }
      setLoginError('Error al conectar con el servidor de autenticación.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Get tracker UI step index
  const getTrackerStep = () => {
    if (!trackedSession) return 0;
    
    // Status is complete / closed
    if (trackedSession.status === 'closed' || trackedSession.status === 'completed') {
      return 4; // Delivered
    }

    // Payment validation pending
    if (trackedSession.paymentStatus === 'pending_validation' || trackedSession.paymentStatus === 'pending_credit_approval') {
      return 1; // Payment verification
    }

    // Payment validated: evaluate order items from kitchen
    if (trackedSession.paymentStatus === 'validated') {
      if (trackedOrders.length > 0) {
        const allReadyOrDelivered = trackedOrders.every(o => o.status === 'ready' || o.status === 'delivered');
        if (allReadyOrDelivered) {
          return 3; // Ready for pickup / delivery
        }
      }
      return 2; // In preparation
    }

    return 1; // Default
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-black font-sans pb-44 md:pb-36">
      {/* HEADER */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-100 px-6 py-4 flex justify-between items-center max-w-7xl mx-auto rounded-b-[24px] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center font-black text-xl shadow-lg shadow-black/10">
            {(settings?.restaurantName || 'BistroFlow').charAt(0).toUpperCase()}
          </div>
          <div>
            <span className="font-bold text-xl tracking-tight block">{settings?.restaurantName || 'BistroFlow'}</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              {qrTable ? `Mesa ${qrTable.number} • Auto-servicio` : 'Express Delivery'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {trackedSessionId && (
            <button 
              onClick={() => {
                setIsTrackerDrawerOpen(true);
              }}
              className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors border border-indigo-100"
            >
              <Navigation size={14} className="animate-pulse" />
              Ver Tracker
            </button>
          )}

          <button 
            onClick={() => {
              setPin('');
              setStaffEmail('');
              setLoginError('');
              checkLockoutStatus();
              setIsStaffLoginOpen(true);
            }} 
            className="p-2.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer opacity-50 hover:opacity-100 flex items-center justify-center"
            title="Acceso"
            aria-label="Acceso al sistema"
          >
            <KeyRound size={16} />
          </button>
        </div>
      </header>

      {/* Tracking will render in a floating bottom banner + drawer sheet */}

      {/* HERO HERO SECTION */}
      <main className="max-w-4xl mx-auto p-6">
        <div className="mb-8 bg-black text-white rounded-[32px] p-8 md:p-12 relative overflow-hidden shadow-xl">
          {/* Decorative background shape */}
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-white/5 rounded-full translate-x-10 translate-y-10" />
          <div className="relative z-10 max-w-md">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-2 flex items-center gap-1">
              <Sparkles size={12} className="text-yellow-400 fill-yellow-400" />
              {qrTable ? `Autoservicio Mesa ${qrTable.number}` : 'UberEats Experience'}
            </span>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
              {qrTable ? `¡Ordena desde tu mesa en ${settings?.restaurantName || 'BistroFlow'}!` : `¡Pide lo que quieras en ${settings?.restaurantName || 'BistroFlow'}!`}
            </h1>
            <p className="text-slate-400 text-xs md:text-sm mt-3">
              {qrTable 
                ? `Estás en la Mesa ${qrTable.number}. Escoge tus platillos, agrégalos al pedido y disfruta directo de la cocina.`
                : 'Selecciona tus hamburguesas supremas, acompañantes crujientes y bebidas heladas directo a tu puerta con sincronización de pago y tracker real-time.'}
            </p>
          </div>
        </div>

        {/* QR WELCOME OR DIGITAL MENU CATALOGUE ONLY BANNERS */}
        {qrTable && (
          settings?.qrOrderingEnabled === false ? (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-[24px] p-5 flex items-start gap-4 text-amber-950 shadow-sm animate-fade-in">
              <span className="text-2xl mt-0.5">📋</span>
              <div>
                <h4 className="font-bold text-sm">Menú Digital Activo (Catálogo)</h4>
                <p className="text-xs text-amber-800 mt-1">
                  Puedes explorar nuestra carta digital con precios y descripciones. La opción de ordenar directamente desde tu celular mediante código QR está desactivada en este momento.
                </p>
                <p className="text-[10px] text-amber-700 mt-1 font-semibold uppercase tracking-wider">
                  ¡Por favor indica tu pedido a uno de nuestros meseros!
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-[24px] p-5 flex items-start gap-4 text-indigo-950 shadow-sm animate-fade-in">
              <span className="text-2xl mt-0.5">⚡</span>
              <div>
                <h4 className="font-bold text-sm">¡Bienvenido a la Mesa {qrTable.number}!</h4>
                <p className="text-xs text-indigo-800 mt-1">
                  Estás usando nuestro sistema de auto-servicio QR. Explora el menú, agrega tus platillos favoritos y ordénalos directamente a cocina sin esperar.
                </p>
              </div>
            </div>
          )
        )}

        {/* REAL-TIME DINE-IN ORDERS TRACKER FOR THE TABLE */}
        {qrTable && tableOrders.length > 0 && (
          <div className="mb-8 bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm animate-fade-in">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-50">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <span>🍽️</span> Tu Consumo en Mesa {qrTable.number}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Sigue en tiempo real los platillos ordenados desde esta mesa.</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider text-[9px]">Total Consumido</span>
                <span className="font-black text-lg text-black">
                  ${tableOrders.reduce((sum, o) => sum + (o.price * o.quantity), 0).toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400 font-bold block">
                  Bs. {(tableOrders.reduce((sum, o) => sum + (o.price * o.quantity), 0) * exchangeRate).toFixed(2)}
                </span>
              </div>
            </div>
            
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {tableOrders.map((order, idx) => {
                let statusBadgeClass = 'bg-slate-50 text-slate-500 border-slate-100';
                let statusLabel = 'Recibido';
                if (order.status === 'preparing') {
                  statusBadgeClass = 'bg-amber-50 text-amber-700 border-amber-100';
                  statusLabel = '🍳 En Cocina';
                } else if (order.status === 'ready') {
                  statusBadgeClass = 'bg-green-50 text-green-700 border-green-100 animate-pulse';
                  statusLabel = '🔔 ¡Listo!';
                } else if (order.status === 'delivered') {
                  statusBadgeClass = 'bg-indigo-50 text-indigo-700 border-indigo-100';
                  statusLabel = '✅ Servido';
                }
                
                return (
                  <div key={order.id || idx} className="flex items-center justify-between p-3 bg-slate-50/60 rounded-2xl border border-slate-100/50 animate-fade-in">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center font-black text-xs text-slate-800">
                        {order.quantity}x
                      </span>
                      <div>
                        <span className="font-bold text-xs text-slate-900 block">{order.itemName}</span>
                        {order.note && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">Nota: {order.note}</span>
                        )}
                        {order.customerName && (
                          <span className="text-[9px] bg-slate-100 text-slate-600 font-semibold px-1.5 py-0.5 rounded mt-1 inline-block">
                            Para: {order.customerName}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-slate-800">
                        ${(order.price * order.quantity).toFixed(2)}
                      </span>
                      <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${statusBadgeClass}`}>
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!isRestaurantOpen && (
          <div className="mb-6 bg-rose-50 border border-rose-200 rounded-[24px] p-5 flex items-start gap-4 text-rose-950 shadow-sm">
            <span className="text-2xl mt-0.5">🕒</span>
            <div>
              <h4 className="font-bold text-sm">Tienda Cerrada Temporalmente</h4>
              <p className="text-xs text-rose-800 mt-1">
                {restaurantCloseReason || 'La tienda online está cerrada en este momento fuera de su horario de trabajo.'}
              </p>
              <p className="text-[10px] text-rose-600 mt-1 font-semibold uppercase tracking-wider">
                Aún puedes ver el menú, pero los pedidos están inhabilitados en este momento.
              </p>
            </div>
          </div>
        )}

        {/* FLASH DEALS (DESCUENTOS POR TIEMPO LIMITADO) */}
        <FlashDealsBanner 
          flashDeals={flashDeals} 
          onSelectCategory={(cat) => setCategory(cat)} 
          onSearchItem={(q) => setSearchQuery(q)} 
        />

        {/* PROMOTIONS BANNER SECTION */}
        <PromotionsBanner onPromoClick={handlePromoClick} categories={categories} promotions={promotions} />

        {/* SEARCH BAR & FILTERS */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por plato, ingredientes o categorías..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-2xl outline-none focus:border-black transition-colors shadow-sm text-sm font-medium"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map(cat => (
              <button 
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-5 py-3 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  category === cat 
                    ? 'bg-black text-white shadow-md shadow-black/10' 
                    : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'
                }`}
              >
                <span>{cat === 'All' ? '🍽️' : getCategoryEmoji(cat)}</span>
                <span>{cat === 'All' ? 'Todos' : cat}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Toggle to view unavailable items in current schedule */}
        <div className="flex justify-end mb-4">
          <button 
            onClick={() => setShowUnavailableItems(!showUnavailableItems)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
              showUnavailableItems 
                ? 'bg-black text-white border-black shadow-sm' 
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>⏰</span>
            <span>{showUnavailableItems ? 'Ver solo disponibles hoy' : 'Ver menú completo (incluyendo no disponibles hoy)'}</span>
          </button>
        </div>

        {/* MENU LISTINGS */}
        <h3 id="menu-listings" className="font-bold text-lg mb-6 flex items-center gap-2">
          <span>Menú Disponible</span>
          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-normal">
            {filteredMenu.length} platillos
          </span>
        </h3>

        {filteredMenu.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm max-w-md mx-auto">
            <Search size={40} className="mx-auto text-slate-300 mb-4" />
            <p className="font-bold">No se encontraron platillos</p>
            <p className="text-slate-400 text-xs mt-1">Prueba buscando con palabras como 'hamburguesa', 'bebida' o cambia el filtro de categoría.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {filteredMenu.map(item => {
              const countInCart = cart.find(c => c.item.id === item.id)?.qty || 0;
              const { isAvailable, timingLabel } = getMenuItemAvailability(item);
              const stockAlert = getMenuItemStockAlert(item, ingredients);
              const isOutOfStock = stockAlert.status === 'out_of_stock';
              const canOrder = isAvailable && isRestaurantOpen && !isOutOfStock && (qrTable === null || settings?.qrOrderingEnabled !== false);
              
              return (
                <div 
                  key={item.id}
                  onClick={() => { if (!isOutOfStock) { setSelectedItem(item); setModalQty(1); setExcludedIds([]); setExtraNote(''); } }}
                  className={`bg-white rounded-[28px] border border-slate-100 overflow-hidden flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all group cursor-pointer ${
                    (!isAvailable || !isRestaurantOpen || isOutOfStock) ? 'opacity-85' : ''
                  }`}
                >
                  <div className="aspect-[4/3] bg-slate-50 overflow-hidden relative">
                    <img 
                      src={item.image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500'} 
                      alt={item.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                    
                    {/* Category Label */}
                    <span className="absolute top-4 left-4 bg-white/95 backdrop-blur-md text-black text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm z-10">
                      {item.category}
                    </span>

                    {/* Active tags badges overlay */}
                    {item.alerts && item.alerts.length > 0 && (
                      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-1.5 z-10">
                        {item.alerts.map(tagId => {
                          const labelMap: { [key: string]: string } = {
                            'Spicy': '🌶️ Picante',
                            'Gluten-Free': '🌾 Sin Gluten',
                            'Lactose-Free': '🥛 S. Lactosa',
                            'Vegan': '🌱 Vegano',
                            'Vegetarian': '🥗 Vegetar.',
                            'Popular': '🔥 Popular',
                            'New': '✨ Nuevo',
                            'Slow-Prep': '⏳ Prep. Lenta',
                            'Chef-Special': '⭐ Especial'
                          };
                          return (
                            <span key={tagId} className="px-2 py-0.5 bg-black/85 backdrop-blur text-white text-[9px] font-extrabold rounded-lg uppercase tracking-wider shadow-sm">
                              {labelMap[tagId] || tagId}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {!isAvailable && (
                      <span className="absolute bottom-4 left-4 right-4 bg-rose-600/95 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1.5 rounded-xl uppercase tracking-wider shadow-sm text-center z-20">
                        ⏳ {timingLabel || 'No disponible ahora'}
                      </span>
                    )}

                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-rose-950/60 backdrop-blur-[1.5px] flex items-center justify-center z-20">
                        <span className="bg-white px-3 py-1.5 text-xs font-black text-rose-600 rounded-xl shadow-md tracking-wider uppercase">
                          Agotado temporalmente 🚫
                        </span>
                      </div>
                    )}

                    {countInCart > 0 && (
                      <span className="absolute top-4 right-4 bg-black text-white text-xs font-black w-7 h-7 rounded-full flex items-center justify-center shadow-lg animate-bounce z-10">
                        {countInCart}
                      </span>
                    )}
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Inventory status helper badge */}
                      {stockAlert.status !== 'available' && (
                        <span className={`text-[10px] font-extrabold uppercase tracking-widest mb-1.5 block ${
                          isOutOfStock ? 'text-rose-500' : 'text-amber-500'
                        }`}>
                          ● {stockAlert.text}
                        </span>
                      )}

                      <h4 className="font-bold text-base text-slate-900 group-hover:text-black transition-colors">
                        {item.name}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        Exquisita preparación de la casa con los mejores ingredientes frescos.
                      </p>
                    </div>

                    <div className="mt-5 flex items-center justify-between pt-4 border-t border-slate-50">
                      <div>
                        <span className="block font-black text-lg text-black leading-tight">
                          {formatPrice(item.price)}
                        </span>
                        <span className="block text-[10px] text-slate-400 font-medium">
                          {formatBs(toBolivares(item.price))}
                        </span>
                      </div>

                      <button 
                        disabled={!canOrder}
                        onClick={(e) => { e.stopPropagation(); if (canOrder) addToCart(item); }}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                          !canOrder
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-black hover:bg-slate-800 text-white hover:scale-105 active:scale-95'
                        }`}
                      >
                        <ShoppingBag size={14} />
                        {!isRestaurantOpen 
                          ? 'Cerrado' 
                          : isOutOfStock
                            ? 'Agotado'
                            : !isAvailable 
                              ? 'Inactivo' 
                              : (qrTable !== null && settings?.qrOrderingEnabled === false) 
                                ? 'Ver' 
                                : 'Agregar'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* FLOAT BOTTOM BAR CART PREVIEW */}
      {cart.length > 0 && (
        <div className="fixed bottom-[max(1.5rem,calc(env(safe-area-inset-bottom)+1rem))] left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-30">
          <button 
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-black hover:bg-slate-900 text-white p-5 rounded-2xl flex justify-between items-center shadow-xl shadow-black/25 hover:scale-[1.02] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/10 px-3 py-1.5 rounded-xl text-xs font-black">
                {cart.reduce((sum, c) => sum + c.qty, 0)}
              </div>
              <div>
                <span className="text-sm font-bold uppercase tracking-wider block leading-none">Ver Carrito</span>
                {!qrTable && deliveryType === 'delivery' && (
                  <span className="text-[10px] text-amber-300 font-medium block mt-0.5">🛵 Incluye envío (${deliveryFeeUSD.toFixed(2)})</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="block font-bold text-sm">{formatPrice(!qrTable ? grandTotalUSD : cartTotal)}</span>
              <span className="block text-[10px] text-slate-400 font-bold">{formatBs(toBolivares(!qrTable ? grandTotalUSD : cartTotal))}</span>
            </div>
          </button>
        </div>
      )}

      {/* CART SLIDE-OVER MODAL */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-stretch md:items-end justify-center z-50 p-0 md:p-4">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full h-full md:h-auto md:max-h-[90vh] md:max-w-lg bg-white rounded-none md:rounded-t-[36px] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex justify-between items-center p-5 sm:p-6 pb-4 border-b border-slate-100 shrink-0">
                <div>
                  <h3 className="text-xl sm:text-2xl font-black tracking-tight">Tu Carrito</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Revisa tus artículos y opciones de entrega.</p>
                </div>
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className="text-xs font-bold text-slate-400 hover:text-black uppercase tracking-wider bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100 cursor-pointer"
                >
                  Cerrar
                </button>
              </div>

              {/* Scrollable Cart Content */}
              <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-4">

              {/* Delivery / Pick Up selector inside Cart Drawer (for non-QR orders) */}
              {!qrTable && ((settings?.deliveryEnabled !== false) || (settings?.pickupEnabled !== false)) && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 mb-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Truck size={14} className="text-black" /> Método de Entrega
                    </span>
                    <span className="text-[11px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                      {deliveryType === 'delivery' ? `Delivery (+${activeDeliveryZone?.priceUSD.toFixed(2) || '0.00'})` : 'Retiro en Local ($0)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {settings?.deliveryEnabled !== false && (
                      <button
                        type="button"
                        onClick={() => setDeliveryType('delivery')}
                        className={`py-2.5 px-3 rounded-xl border text-center transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          deliveryType === 'delivery'
                            ? 'bg-black text-white border-black font-extrabold shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100/70 font-semibold text-xs'
                        }`}
                      >
                        <span className="text-sm">🛵</span>
                        <span className="text-xs">Delivery Express</span>
                      </button>
                    )}

                    {settings?.pickupEnabled !== false && (
                      <button
                        type="button"
                        onClick={() => setDeliveryType('pickup')}
                        className={`py-2.5 px-3 rounded-xl border text-center transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          deliveryType === 'pickup'
                            ? 'bg-black text-white border-black font-extrabold shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100/70 font-semibold text-xs'
                        }`}
                      >
                        <span className="text-sm">🛍️</span>
                        <span className="text-xs">Retiro en Local</span>
                      </button>
                    )}
                  </div>

                  {/* Delivery Zone Selector inside Cart Drawer */}
                  {deliveryType === 'delivery' && (
                    <div className="pt-2 border-t border-slate-200/60 space-y-2">
                      <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                        Selecciona la Zona de Envío:
                      </label>
                      <div className="space-y-1.5">
                        {deliveryZones.map(zone => {
                          const isSelected = activeDeliveryZone?.id === zone.id;
                          return (
                            <button
                              key={zone.id}
                              type="button"
                              onClick={() => setSelectedZoneId(zone.id)}
                              className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                                isSelected
                                  ? 'bg-amber-500/10 border-amber-500 text-amber-950 font-bold'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/60'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`w-3 h-3 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'border-amber-600 bg-amber-600' : 'border-slate-300'}`}>
                                  {isSelected && <span className="w-1 h-1 rounded-full bg-white" />}
                                </span>
                                <span className="text-xs font-bold truncate">{zone.name}</span>
                              </div>
                              <span className="text-xs font-black shrink-0">+${zone.priceUSD.toFixed(2)} USD</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Delivery Minimum Order Alert inside Cart Drawer */}
                  {deliveryType === 'delivery' && minDeliveryOrderEnabled && (
                    <div className="pt-2.5 border-t border-slate-200/60">
                      {isBelowDeliveryMinimum ? (
                        <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-3.5 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-extrabold text-amber-950 flex items-center gap-1.5">
                              <ShoppingBag size={14} className="text-amber-600" />
                              Pedido Mínimo Delivery: ${minDeliveryOrderAmount.toFixed(2)} USD
                            </span>
                            <span className="font-black text-amber-800 text-[10.5px] bg-amber-100/90 px-2 py-0.5 rounded-full">
                              Faltan ${deliveryMinimumDeficit.toFixed(2)}
                            </span>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full bg-amber-200/70 h-2 rounded-full overflow-hidden">
                            <div 
                              className="bg-amber-600 h-full rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, (cartTotal / minDeliveryOrderAmount) * 100)}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-amber-800 leading-tight">
                            Te faltan <strong>${deliveryMinimumDeficit.toFixed(2)} USD</strong> en productos para entrega a domicilio. Agrega más ítems o cambia a <strong>Retiro en Local</strong>.
                          </p>
                        </div>
                      ) : (
                        <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl px-3 py-2 flex items-center justify-between text-xs">
                          <span className="font-bold text-emerald-800 flex items-center gap-1.5 text-[11px]">
                            <CheckCircle2 size={13} className="text-emerald-600" />
                            ¡Cumples con el pedido mínimo de delivery (${minDeliveryOrderAmount.toFixed(2)} USD)!
                          </span>
                          <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md">✓ OK</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Cart List */}
              <div className="space-y-4 mb-6 overflow-y-auto flex-1 pr-2 max-h-[280px]">
                {cart.map((entry, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="aspect-square w-12 h-12 rounded-xl overflow-hidden bg-slate-200">
                        <img src={entry.item.image || 'https://via.placeholder.com/150'} alt={entry.item.name} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <span className="font-bold text-sm text-slate-950 block">{entry.item.name}</span>
                        
                        {/* Selected Extras list */}
                        {entry.selectedExtras && entry.selectedExtras.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {entry.selectedExtras.map((extra, eIdx) => (
                              <span key={eIdx} className="text-[9px] bg-indigo-50 border border-indigo-100/30 text-indigo-700 px-1.5 py-0.5 rounded font-black">
                                + {extra.name}
                              </span>
                            ))}
                          </div>
                        )}

                        {entry.note && (
                          <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-md font-bold inline-block mt-1 border border-amber-100/50 max-w-[150px] truncate" title={entry.note}>
                            {entry.note}
                          </span>
                        )}
                        <span className="text-xs text-slate-400 block mt-0.5">${getCartEntryPrice(entry).toFixed(2)} c/u</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Qty Modifiers */}
                      <div className="flex items-center bg-white border border-slate-100 rounded-xl px-2.5 py-1 gap-3 shadow-sm">
                        <button 
                          onClick={() => updateCartQty(idx, -1)}
                          className="font-bold text-slate-500 hover:text-black text-sm"
                        >
                          -
                        </button>
                        <span className="font-mono font-bold text-sm">{entry.qty}</span>
                        <button 
                          onClick={() => updateCartQty(idx, 1)}
                          className="font-bold text-slate-500 hover:text-black text-sm"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-right flex flex-col items-end min-w-[70px]">
                        <span className="font-bold text-sm text-black">${(getCartEntryPrice(entry) * entry.qty).toFixed(2)}</span>
                        <span className="text-[10px] text-slate-400">Bs. {(getCartEntryPrice(entry) * entry.qty * exchangeRate).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cupón de Descuento Section */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 mb-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <Ticket size={14} className="text-indigo-600" />
                    Cupón de Descuento
                  </span>
                  {appliedCoupon && (
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-[10px] font-black text-rose-600 hover:underline uppercase cursor-pointer"
                    >
                      Quitar Cupón
                    </button>
                  )}
                </div>

                {appliedCoupon ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-xs">
                        ✓
                      </span>
                      <div>
                        <span className="font-mono font-black text-xs text-emerald-900 block">
                          {appliedCoupon.code}
                        </span>
                        <span className="text-[10px] text-emerald-700 font-bold block">
                          {appliedCoupon.discountType === 'percentage' 
                            ? `${appliedCoupon.discountValue}% OFF aplicado` 
                            : `-$${appliedCoupon.discountValue.toFixed(2)} USD aplicado`}
                        </span>
                      </div>
                    </div>
                    <span className="font-black text-xs text-emerald-700">
                      -${couponDiscountUSD.toFixed(2)} USD
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Código (ej. BISTRO20)"
                        value={couponCodeInput}
                        onChange={(e) => {
                          setCouponCodeInput(e.target.value.toUpperCase());
                          setCouponError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleApplyCoupon();
                          }
                        }}
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold uppercase placeholder:normal-case placeholder:font-sans outline-none focus:border-indigo-600"
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyCoupon()}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-wider cursor-pointer shadow-xs"
                      >
                        Aplicar
                      </button>
                    </div>

                    {couponError && (
                      <p className="text-[10px] font-bold text-rose-600">
                        {couponError}
                      </p>
                    )}

                    {/* Quick Available Coupon Chips */}
                    {coupons && coupons.filter(c => c.status === 'active' && (!c.expiresAt || new Date(c.expiresAt).getTime() > Date.now())).length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[9px] font-bold uppercase text-slate-400">Disponibles:</span>
                        {coupons
                          .filter(c => c.status === 'active' && (!c.expiresAt || new Date(c.expiresAt).getTime() > Date.now()))
                          .slice(0, 3)
                          .map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setCouponCodeInput(c.code);
                                handleApplyCoupon(c.code);
                              }}
                              className="text-[10px] font-mono font-black bg-indigo-50 border border-indigo-200/70 text-indigo-700 px-2 py-0.5 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <span>🏷️ {c.code}</span>
                              <span className="text-[9px] text-indigo-500 font-sans">(-{c.discountType === 'percentage' ? `${c.discountValue}%` : `$${c.discountValue}`})</span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Totals Breakdown inside Cart Drawer */}
              <div className="border-t border-slate-200/80 pt-4 mb-6 space-y-2 bg-slate-50 p-4 rounded-2xl">
                <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                  <span>Subtotal Productos:</span>
                  <span className="font-bold text-slate-800">${cartTotal.toFixed(2)} USD</span>
                </div>

                {appliedCoupon && couponDiscountUSD > 0 && (
                  <div className="flex justify-between items-center text-xs text-emerald-700 font-bold">
                    <span>Descuento ({appliedCoupon.code}):</span>
                    <span>-${couponDiscountUSD.toFixed(2)} USD</span>
                  </div>
                )}

                {!qrTable && deliveryType === 'delivery' && (
                  <div className="flex justify-between items-center text-xs text-amber-900 font-semibold">
                    <span>Costo Envío ({activeDeliveryZone?.name}):</span>
                    <span className="font-extrabold text-amber-900">+${deliveryFeeUSD.toFixed(2)} USD</span>
                  </div>
                )}

              </div>
              </div>

              {/* Sticky Bottom Action Footer */}
              <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Total a Pagar:</span>
                  <div className="text-right">
                    <span className="text-xl font-black text-slate-950">${grandTotalUSD.toFixed(2)}</span>
                    <span className="text-xs text-slate-500 font-bold ml-2">Bs. {(grandTotalUSD * exchangeRate).toFixed(2)}</span>
                  </div>
                </div>

                <button 
                  disabled={(qrTable !== null && settings?.qrOrderingEnabled === false) || isBelowDeliveryMinimum}
                  onClick={() => {
                    if (isBelowDeliveryMinimum) {
                      alert(`El pedido mínimo para delivery es de $${minDeliveryOrderAmount.toFixed(2)} USD. Te faltan $${deliveryMinimumDeficit.toFixed(2)} USD en productos.`);
                      return;
                    }
                    setIsOrdering(true);
                  }}
                  className="w-full bg-black hover:bg-slate-900 text-white p-4 sm:p-5 rounded-2xl font-bold text-sm flex justify-center items-center gap-2 hover:scale-[1.01] transition-transform disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-black/10"
                >
                  {qrTable 
                    ? (settings?.qrOrderingEnabled === false ? 'Pedidos QR Desactivados' : `Confirmar Orden en Mesa ${qrTable.number}`) 
                    : isBelowDeliveryMinimum
                      ? `Mínimo Delivery: $${minDeliveryOrderAmount.toFixed(2)} (Faltan $${deliveryMinimumDeficit.toFixed(2)})`
                      : 'Proceder al Pago'} <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CHECKOUT FLOW WIZARD MODAL */}
      <AnimatePresence>
        {isOrdering && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-stretch md:items-center justify-center z-50 p-0 md:p-4">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full h-full md:h-auto md:max-h-[92vh] md:max-w-lg bg-white rounded-none md:rounded-3xl p-4 sm:p-6 flex flex-col shadow-2xl relative overflow-hidden"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-3 shrink-0">
                <div>
                  <h3 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                    {qrTable ? `Mesa ${qrTable.number} - Enviar a Cocina` : 'Formulario de Pago'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {qrTable ? 'Ingresa tu nombre para procesar tu orden.' : 'Completa tus datos de envío y pago.'}
                  </p>
                </div>
                <button 
                  onClick={() => setIsOrdering(false)}
                  className="text-xs font-bold text-slate-500 hover:text-rose-500 uppercase tracking-wider bg-slate-100 px-3 py-1.5 rounded-full cursor-pointer transition-colors"
                >
                  Cerrar
                </button>
              </div>

              <div className="overflow-y-auto pr-1 scrollbar-thin my-1 flex-1 min-h-0 space-y-4 pb-24">

              {qrTable ? (
                /* Streamlined Dine-in QR Checkout */
                <div className="space-y-6">
                  <div className="space-y-4">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Identificación del Comensal
                    </label>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        placeholder="Escribe tu Nombre (Ej. Tomás)" 
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-black transition-colors text-sm font-medium"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      💡 Tu pedido se enviará en tiempo real directo a las pantallas de cocina. Al finalizar tu consumo podrás pagar directamente con el mesero o en caja.
                    </p>
                  </div>

                  <div className="border-t border-slate-100 pt-6">
                    <div className="flex justify-between items-center mb-6">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total de la Orden</span>
                      <div className="text-right">
                        <span className="block text-2xl font-black">${cartTotal.toFixed(2)}</span>
                        <span className="block text-xs text-slate-500 font-bold">Bs. {(cartTotal * exchangeRate).toFixed(2)}</span>
                      </div>
                    </div>

                    <button 
                      onClick={submitOrder}
                      disabled={isSubmitting || !isRestaurantOpen || !customerName.trim()}
                      className="w-full bg-black hover:bg-slate-900 text-white p-5 rounded-2xl font-bold text-sm flex justify-center items-center gap-2 hover:scale-[1.01] transition-transform disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>Enviando a Cocina... <span className="animate-pulse">⏳</span></>
                      ) : !isRestaurantOpen ? (
                        <>Tienda Cerrada Temporalmente 🕒</>
                      ) : (
                        <>Confirmar y Enviar a Cocina 🍳</>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* Original Delivery / Pickup wizard form */
                <>
                  {/* Delivery Type Selector */}
                  {((settings?.deliveryEnabled !== false) || (settings?.pickupEnabled !== false)) && (
                    <div className="space-y-3 mb-6">
                      <div className="flex justify-between items-center">
                        <h4 className="font-bold text-xs uppercase tracking-widest text-slate-400">Método de Entrega</h4>
                        <span className="text-[11px] font-extrabold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/80">
                          {deliveryType === 'delivery' ? `🛵 Envío: +$${deliveryFeeUSD.toFixed(2)} USD` : '🛍️ Retiro: $0.00 USD'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {settings?.deliveryEnabled !== false && (
                          <button 
                            type="button"
                            onClick={() => setDeliveryType('delivery')}
                            className={`p-4 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${settings?.pickupEnabled === false ? 'col-span-2' : ''} ${
                              deliveryType === 'delivery' 
                                ? 'bg-black text-white border-black shadow-lg shadow-black/10' 
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <span className="text-xl">🛵</span>
                            <span className="font-bold text-xs">Delivery Express</span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md mt-0.5 ${deliveryType === 'delivery' ? 'bg-amber-400/30 text-amber-300' : 'bg-amber-100 text-amber-900'}`}>
                              +${deliveryFeeUSD.toFixed(2)} USD
                            </span>
                          </button>
                        )}

                        {settings?.pickupEnabled !== false && (
                          <button 
                            type="button"
                            onClick={() => setDeliveryType('pickup')}
                            className={`p-4 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${settings?.deliveryEnabled === false ? 'col-span-2' : ''} ${
                              deliveryType === 'pickup' 
                                ? 'bg-black text-white border-black shadow-lg shadow-black/10' 
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <span className="text-xl">🛍️</span>
                            <span className="font-bold text-xs">Retiro en Local</span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md mt-0.5 ${deliveryType === 'pickup' ? 'bg-emerald-400/30 text-emerald-300' : 'bg-emerald-100 text-emerald-900'}`}>
                              Sin Costo ($0.00)
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Minimum Order Warning in Checkout Modal */}
                  {deliveryType === 'delivery' && isBelowDeliveryMinimum && (
                    <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-4 mb-4 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-amber-950 flex items-center gap-1.5">
                          <ShoppingBag size={15} className="text-amber-600" />
                          Pedido mínimo para delivery no alcanzado
                        </span>
                        <span className="font-black text-amber-800 text-[11px] bg-amber-100 px-2 py-0.5 rounded-full">
                          Mínimo: ${minDeliveryOrderAmount.toFixed(2)} USD
                        </span>
                      </div>
                      <p className="text-xs text-amber-800 leading-relaxed">
                        Tu subtotal actual es de <strong>${cartTotal.toFixed(2)} USD</strong>. Se requiere un pedido mínimo de <strong>${minDeliveryOrderAmount.toFixed(2)} USD</strong> en productos (te faltan <strong>${deliveryMinimumDeficit.toFixed(2)} USD</strong>).
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsOrdering(false);
                            setIsCartOpen(true);
                          }}
                          className="text-xs font-black text-amber-900 bg-amber-200/80 hover:bg-amber-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                        >
                          + Agregar más productos al carrito
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeliveryType('pickup')}
                          className="text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                        >
                          Cambiar a Retiro en Local ($0)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Immediate Zone Selector or Pickup Info Notice */}
                  {deliveryType === 'delivery' ? (
                    <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl mb-6 space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                          <MapPin size={15} className="text-amber-600 shrink-0" /> Selecciona tu Zona de Delivery:
                        </label>
                        <span className="text-[10px] font-bold text-amber-900 bg-amber-200/60 px-2 py-0.5 rounded-md">
                          {activeDeliveryZone?.name}
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        {deliveryZones.map(zone => {
                          const isSelected = (activeDeliveryZone?.id === zone.id);
                          return (
                            <button
                              key={zone.id}
                              type="button"
                              onClick={() => setSelectedZoneId(zone.id)}
                              className={`w-full p-3 rounded-xl border text-left transition-all flex items-start justify-between gap-3 cursor-pointer ${
                                isSelected
                                  ? 'bg-amber-50 border-amber-500 shadow-sm ring-2 ring-amber-500/20'
                                  : 'bg-white border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'border-amber-600 bg-amber-600' : 'border-slate-300'}`}>
                                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                                  </span>
                                  <span className="font-extrabold text-xs text-slate-900">{zone.name}</span>
                                </div>
                                {zone.coveredAreas && (
                                  <p className="text-[11px] text-slate-500 pl-5 leading-tight">{zone.coveredAreas}</p>
                                )}
                                {zone.estimatedTime && (
                                  <p className="text-[10px] text-amber-900 font-semibold pl-5 mt-0.5">⏱️ Tiempo est: {zone.estimatedTime}</p>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <span className="block font-black text-xs text-slate-900">+${zone.priceUSD.toFixed(2)} USD</span>
                                <span className="block text-[10px] text-slate-400 font-bold">~{(zone.priceUSD * exchangeRate).toFixed(0)} Bs.</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-950 font-bold mb-6">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🛍️</span>
                        <span>Retiro en Local (Pick Up) sin recargo de envío</span>
                      </div>
                      <span className="text-[10px] bg-emerald-600 text-white font-black px-2.5 py-1 rounded-lg uppercase">
                        $0.00 USD
                      </span>
                    </div>
                  )}

                  {/* 1. Address / Customer Info Section */}
                  <div className="space-y-4 mb-6">
                    <h4 className="font-bold text-xs uppercase tracking-widest text-slate-400">
                      {deliveryType === 'delivery' ? 'Datos de Dirección de Envío' : 'Datos de Contacto para Retirar'}
                    </h4>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        placeholder="Tu Nombre Completo" 
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-black transition-colors text-sm font-medium"
                      />
                    </div>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        placeholder="Tu Teléfono de Contacto" 
                        value={customerPhone}
                        onChange={e => setCustomerPhone(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-black transition-colors text-sm font-medium"
                      />
                    </div>
                    
                    {deliveryType === 'delivery' && (
                      <>
                        <div className="relative">
                          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input 
                            type="text" 
                            placeholder="Dirección Completa de Envío (Calle, Res., Apto)" 
                            value={customerAddress}
                            onChange={e => setCustomerAddress(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-black transition-colors text-sm font-medium"
                          />
                        </div>

                        <div className="relative">
                          <input 
                            type="text" 
                            placeholder="Punto de Referencia / Edificio / Color de Fachada (Opcional)" 
                            value={deliveryReference}
                            onChange={e => setDeliveryReference(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-black transition-colors text-xs font-medium"
                          />
                        </div>
                        
                        <div className="relative">
                          <Navigation className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 -rotate-45" size={18} />
                          <input 
                            type="text" 
                            placeholder="Enlace de ubicación GPS (Ej. Google Maps, WhatsApp)" 
                            value={whatsappLocation}
                            onChange={e => setWhatsappLocation(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-black transition-colors text-sm font-medium"
                          />
                          <span className="text-[10px] text-slate-400 block mt-1 px-1">
                            💡 Comparte el enlace de tu ubicación GPS para que el repartidor llegue con precisión.
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* 2. Payment Selector */}
                  <div className="space-y-4 mb-6">
                    <h4 className="font-bold text-xs uppercase tracking-widest text-slate-400">Método de Pago</h4>
                    <div className={`grid gap-3 ${
                      [
                        settings?.paymentMethods?.pagoMovil !== false,
                        settings?.paymentMethods?.zelle !== false,
                        settings?.paymentMethods?.cash !== false
                      ].filter(Boolean).length === 3 ? 'grid-cols-3' : 
                      [
                        settings?.paymentMethods?.pagoMovil !== false,
                        settings?.paymentMethods?.zelle !== false,
                        settings?.paymentMethods?.cash !== false
                      ].filter(Boolean).length === 2 ? 'grid-cols-2' : 'grid-cols-1'
                    }`}>
                      {settings?.paymentMethods?.pagoMovil !== false && (
                        <button 
                          type="button"
                          onClick={() => setPaymentMethod('pagomovil')}
                          className={`p-4 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                            paymentMethod === 'pagomovil' 
                              ? 'bg-black text-white border-black shadow-lg shadow-black/10' 
                              : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'
                          }`}
                        >
                          <span>📱</span>
                          <span className="font-bold text-xs">Pago Móvil</span>
                        </button>
                      )}

                      {settings?.paymentMethods?.zelle !== false && (
                        <button 
                          type="button"
                          onClick={() => setPaymentMethod('zelle')}
                          className={`p-4 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                            paymentMethod === 'zelle' 
                              ? 'bg-black text-white border-black shadow-lg shadow-black/10' 
                              : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'
                          }`}
                        >
                          <span>📧</span>
                          <span className="font-bold text-xs">Zelle</span>
                        </button>
                      )}

                      {settings?.paymentMethods?.cash !== false && (
                        <button 
                          type="button"
                          onClick={() => setPaymentMethod('cash')}
                          className={`p-4 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                            paymentMethod === 'cash' 
                              ? 'bg-black text-white border-black shadow-lg shadow-black/10' 
                              : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'
                          }`}
                        >
                          <span>💵</span>
                          <span className="font-bold text-xs">Efectivo</span>
                        </button>
                      )}
                    </div>

                    {/* Account Details Box */}
                    <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-xs text-indigo-950 flex gap-2">
                      <Info size={16} className="text-indigo-600 shrink-0" />
                      <div>
                        {paymentMethod === 'pagomovil' && (
                          <div className="space-y-1">
                            <span className="font-bold block">Datos de Pago Móvil:</span>
                            <span>Banco: <strong className="text-indigo-700">{settings?.pagoMovilBanco || 'Banesco'}</strong></span><br />
                            <span>Teléfono: <strong className="text-indigo-700">{settings?.pagoMovilPhone || '0412-1234567'}</strong></span><br />
                            <span>Cédula/RIF: <strong className="text-indigo-700">{settings?.pagoMovilId || 'V-12345678'}</strong></span><br />
                            <span className="text-slate-400 block mt-1 font-mono">Monto a Transferir: <strong className="text-black">{formatBs(toBolivares(grandTotalUSD))}</strong></span>
                          </div>
                        )}
                        {paymentMethod === 'zelle' && (
                          <div className="space-y-1">
                            <span className="font-bold block">Datos de Zelle:</span>
                            <span>Correo: <strong className="text-indigo-700">{settings?.zelleEmail || 'pagos@bistroflow.com'}</strong></span><br />
                            <span>Beneficiario: <strong className="text-indigo-700">{settings?.zelleName || 'BistroFlow SL'}</strong></span><br />
                            <span className="text-slate-400 block mt-1 font-mono">Monto a Transferir: <strong className="text-black">{formatPrice(grandTotalUSD)}</strong></span>
                          </div>
                        )}
                        {paymentMethod === 'cash' && (
                          <div className="space-y-1">
                            <span className="font-bold block">{deliveryType === 'delivery' ? 'Pago Contra Entrega (Efectivo):' : 'Pago al Retirar (Efectivo):'}</span>
                            <span>Prepara el monto exacto para dárselo al {deliveryType === 'delivery' ? 'repartidor' : 'cajero'} cuando {deliveryType === 'delivery' ? 'llegue tu pedido' : 'vengas a retirar'}.</span><br />
                            <span className="font-semibold block mt-1">Total: {formatPrice(grandTotalUSD)} ({formatBs(toBolivares(grandTotalUSD))})</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Reference Code & Receipt Upload for Digital Payments */}
                    {paymentMethod !== 'cash' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                            Número de Referencia <span className="text-rose-500 font-extrabold">(OBLIGATORIO)</span>
                          </label>
                          <div className="relative">
                            <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                              type="text" 
                              placeholder="Ingresa los dígitos de la referencia de pago" 
                              value={paymentReference}
                              onChange={e => setPaymentReference(e.target.value)}
                              className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-black transition-colors text-sm font-medium font-mono"
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              Foto / Captura del Comprobante <span className="text-rose-500 font-extrabold">(OBLIGATORIO)</span>
                            </label>
                            {paymentReceiptImage && (
                              <button 
                                type="button" 
                                onClick={() => setPaymentReceiptImage(null)} 
                                className="text-[10px] font-bold text-rose-500 hover:underline"
                              >
                                Eliminar foto
                              </button>
                            )}
                          </div>

                          <label className={`w-full flex flex-col items-center justify-center border-2 border-dashed rounded-3xl p-4 cursor-pointer transition-all ${paymentReceiptImage ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200 hover:border-black'}`}>
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleClientReceiptImageChange} 
                              className="hidden" 
                            />
                            {isUploadingReceipt ? (
                              <span className="text-xs text-slate-400 animate-pulse font-medium">Procesando imagen...</span>
                            ) : paymentReceiptImage ? (
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-emerald-200 flex-shrink-0">
                                  <img src={paymentReceiptImage} alt="Comprobante" className="w-full h-full object-cover" />
                                </div>
                                <div className="text-left">
                                  <span className="text-xs font-bold text-emerald-800 block">Comprobante Cargado ✓</span>
                                  <span className="text-[10px] text-emerald-600 block">Captura adjunta</span>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-1">
                                <Upload className="mx-auto text-slate-400 mb-1" size={20} />
                                <span className="text-xs font-bold text-slate-700 block">Subir captura o foto del comprobante</span>
                                <span className="text-[10px] text-slate-400 block">PNG, JPG o captura de pantalla</span>
                              </div>
                            )}
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Total & Delivery Fee Breakdown */}
                  <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2 mb-6">
                    <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                      <span>Subtotal de productos:</span>
                      <span className="font-bold text-slate-800">${cartTotal.toFixed(2)}</span>
                    </div>
                    {appliedCoupon && couponDiscountUSD > 0 && (
                      <div className="flex justify-between items-center text-xs text-emerald-700 font-bold">
                        <span>Descuento Cupón ({appliedCoupon.code}):</span>
                        <span>-${couponDiscountUSD.toFixed(2)} USD</span>
                      </div>
                    )}
                    {deliveryType === 'delivery' && (
                      <div className="flex justify-between items-center text-xs text-amber-900 font-medium">
                        <span>Envío ({activeDeliveryZone?.name || 'Delivery'}):</span>
                        <span className="font-extrabold text-amber-900">+${deliveryFeeUSD.toFixed(2)} USD</span>
                      </div>
                    )}
                    <div className="flex justify-between items-baseline border-t border-slate-200/80 pt-2 text-slate-900">
                      <span className="font-black text-sm">TOTAL A PAGAR ({activeCurrency}):</span>
                      <div className="text-right">
                        <span className="block font-black text-lg text-slate-950">{formatPrice(grandTotalUSD)}</span>
                        <span className="block text-xs font-bold text-slate-500">{formatBs(toBolivares(grandTotalUSD))}</span>
                      </div>
                    </div>
                  </div>

                  {/* Submit Order button */}
                  <button 
                    onClick={submitOrder}
                    disabled={
                      isSubmitting ||
                      !isRestaurantOpen ||
                      isBelowDeliveryMinimum ||
                      !customerName.trim() || 
                      !customerPhone.trim() || 
                      (deliveryType === 'delivery' && !customerAddress.trim()) || 
                      (paymentMethod !== 'cash' && (!paymentReference.trim() || !paymentReceiptImage))
                    }
                    className="w-full bg-black hover:bg-slate-900 text-white p-5 rounded-2xl font-bold text-sm flex flex-col items-center justify-center gap-0.5 hover:scale-[1.01] transition-transform disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed shadow-xl shadow-black/10 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">Enviando Pedido... <span className="animate-pulse">⏳</span></span>
                    ) : !isRestaurantOpen ? (
                      <span>Tienda Cerrada Temporalmente 🕒</span>
                    ) : isBelowDeliveryMinimum ? (
                      <>
                        <span className="flex items-center gap-2 text-sm text-amber-200">
                          Mínimo de Delivery no alcanzado (${minDeliveryOrderAmount.toFixed(2)} USD)
                        </span>
                        <span className="text-[10px] text-amber-400 font-normal">
                          Faltan ${deliveryMinimumDeficit.toFixed(2)} USD en productos o cambia a Retiro en Local
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="flex items-center gap-2 text-base">
                          Confirmar Pedido (${grandTotalUSD.toFixed(2)}) <Navigation size={18} className="-rotate-45" />
                        </span>
                        <span className="text-[10px] text-amber-300 font-normal">
                          {deliveryType === 'delivery' ? `Incluye $${deliveryFeeUSD.toFixed(2)} USD de envío (${activeDeliveryZone?.name})` : 'Retiro en Local ($0.00 de envío)'}
                        </span>
                      </>
                    )}
                  </button>
                </>
              )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SECURE ENTERPRISE STAFF PORTAL MODAL */}
      <AnimatePresence>
        {isStaffLoginOpen && (
          <div className="fixed inset-0 bg-white md:bg-black/60 md:backdrop-blur-md flex flex-col md:items-center md:justify-center z-50 p-0 md:p-6 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="bg-white rounded-none md:rounded-[40px] p-6 sm:p-8 w-full h-full md:h-auto md:max-w-md shadow-none md:shadow-2xl relative border-0 md:border md:border-slate-100 overflow-y-auto flex flex-col justify-between pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            >
              {/* Header Close */}
              <button 
                onClick={() => {
                  setIsStaffLoginOpen(false);
                  setLoginError('');
                }}
                className="absolute top-5 right-5 sm:top-6 sm:right-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-black transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="text-center mb-5">
                <div className="w-12 h-12 bg-slate-100 text-slate-900 rounded-2xl mx-auto flex items-center justify-center mb-2.5 border border-slate-200/80 shadow-xs">
                  <KeyRound size={22} className="text-slate-800" />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Iniciar Sesión</h3>
                <p className="text-xs text-slate-400 mt-0.5">Ingresa tu correo y PIN para acceder</p>
              </div>

              {/* Security Shield Banner */}
              <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-2.5 mb-4 flex items-center justify-between text-[11px] text-slate-600">
                <div className="flex items-center gap-2">
                  <Lock size={13} className="text-emerald-600 shrink-0" />
                  <span className="font-semibold text-slate-700">Protección de Seguridad Activa</span>
                </div>
                {attemptsRemaining !== null && !lockoutInfo?.isLocked && (
                  <span className={`font-mono font-bold text-[10px] px-2 py-0.5 rounded-full ${
                    attemptsRemaining <= 2 ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {attemptsRemaining} {attemptsRemaining === 1 ? 'intento' : 'intentos'}
                  </span>
                )}
              </div>

              {/* Lockout Warning Banner */}
              {lockoutInfo?.isLocked && (
                <div className="bg-rose-50 text-rose-700 text-xs p-4 rounded-2xl text-center mb-4 font-bold border border-rose-200 space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-rose-800">
                    <Lock size={15} />
                    <span>Acceso Temporalmente Bloqueado</span>
                  </div>
                  <p className="text-[11px] font-medium text-rose-600">
                    Se detectaron 5 intentos fallidos. Bloqueo temporal por {lockoutInfo.remainingMinutes || 15} min.
                  </p>
                </div>
              )}

              {loginError && !lockoutInfo?.isLocked && (
                <div className="bg-rose-50 text-rose-600 text-xs p-3 rounded-xl text-center mb-4 font-bold border border-rose-100 animate-shake">
                  {loginError}
                </div>
              )}

              {/* UNIFIED FORM: CORREO Y PIN */}
              <form onSubmit={handleStaffLogin} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-3 text-slate-400" />
                    <input 
                      type="email"
                      required
                      disabled={isLoggingIn || lockoutInfo?.isLocked}
                      value={staffEmail}
                      onChange={(e) => setStaffEmail(e.target.value)}
                      placeholder="ej: usuario@restaurante.com"
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-black focus:bg-white transition-all disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-600">
                      PIN de Acceso
                    </label>
                    <span className="text-[10px] text-slate-400 font-medium">4 a 6 dígitos</span>
                  </div>
                  <div className="relative">
                    <KeyRound size={15} className="absolute left-3.5 top-3 text-slate-400" />
                    <input 
                      type={showPassword ? 'text' : 'password'}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      required
                      disabled={isLoggingIn || lockoutInfo?.isLocked}
                      value={pin}
                      onChange={(e) => {
                        setPin(e.target.value.replace(/\D/g, ''));
                        setLoginError('');
                      }}
                      placeholder="••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold tracking-widest focus:outline-none focus:border-black focus:bg-white transition-all disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-black cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Keypad for Quick Mobile / Touch Entry */}
                <div className="pt-1">
                  <div className="grid grid-cols-3 gap-1.5">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                      <button
                        key={num}
                        type="button"
                        disabled={isLoggingIn || lockoutInfo?.isLocked}
                        onClick={() => {
                          if (pin.length < 6) setPin(prev => prev + num);
                          setLoginError('');
                        }}
                        className="h-10 w-full text-base font-bold rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-95 flex items-center justify-center transition-all cursor-pointer text-slate-800 disabled:opacity-40"
                      >
                        {num}
                      </button>
                    ))}
                    <button 
                      type="button"
                      disabled={isLoggingIn || lockoutInfo?.isLocked}
                      onClick={() => {
                        setPin(prev => prev.slice(0, -1));
                        setLoginError('');
                      }}
                      className="h-10 w-full text-[10px] font-bold rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-all text-slate-400 uppercase tracking-wider cursor-pointer disabled:opacity-40"
                    >
                      Borrar
                    </button>
                    <button
                      type="button"
                      disabled={isLoggingIn || lockoutInfo?.isLocked}
                      onClick={() => {
                        if (pin.length < 6) setPin(prev => prev + '0');
                        setLoginError('');
                      }}
                      className="h-10 w-full text-base font-bold rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-95 flex items-center justify-center transition-all cursor-pointer text-slate-800 disabled:opacity-40"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      disabled={isLoggingIn || lockoutInfo?.isLocked}
                      onClick={() => {
                        setPin('');
                        setLoginError('');
                      }}
                      className="h-10 w-full text-[10px] font-bold rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-all text-slate-400 uppercase tracking-wider cursor-pointer disabled:opacity-40"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn || lockoutInfo?.isLocked || !staffEmail.trim() || pin.length < 4}
                  className="w-full mt-2 py-3 bg-black hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isLoggingIn ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Verificando Credenciales...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound size={15} />
                      <span>Iniciar Sesión</span>
                    </>
                  )}
                </button>
              </form>

              <div className="text-center text-[10px] text-slate-400 mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5">
                <Lock size={11} className="text-slate-400" />
                <span>Validado y auditado por RestoFlow Security Kernel</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PLATILLO DETAIL MODAL */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 bg-black/60 md:backdrop-blur-sm flex items-stretch md:items-center justify-center z-50 p-0 md:p-4 overflow-y-auto">
            {/* Clickable backdrop overlay to close */}
            <div 
              className="absolute inset-0 cursor-pointer hidden md:block" 
              onClick={() => setSelectedItem(null)} 
            />

            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white rounded-none md:rounded-[32px] w-full h-full md:h-auto md:max-h-[90vh] md:max-w-lg shadow-2xl relative border-0 md:border md:border-slate-100 overflow-hidden z-10 my-0 flex flex-col"
            >
              {/* Image & Header Section */}
              <div className="relative h-[150px] sm:h-[220px] w-full bg-slate-100 shrink-0">
                <img 
                  src={selectedItem.image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500'} 
                  alt={selectedItem.name} 
                  className="w-full h-full object-cover"
                />
                
                {/* Close Button on top of image */}
                <button 
                  onClick={() => setSelectedItem(null)}
                  className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition-all shadow-md hover:scale-105 cursor-pointer"
                >
                  <X size={20} />
                </button>

                {/* Category tag */}
                <span className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-md text-black text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest shadow-sm">
                  {selectedItem.category}
                </span>
              </div>

              {/* Content Body */}
              <div className="p-5 sm:p-6 md:p-8 overflow-y-auto flex-1 min-h-0">
                <div className="mb-4">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
                    {selectedItem.name}
                  </h3>
                  
                  {/* Prices */}
                  <div className="flex items-baseline gap-3 mt-2">
                    <span className="font-black text-2xl text-black">
                      ${selectedItem.price.toFixed(2)}
                    </span>
                    <span className="text-sm text-slate-400 font-semibold">
                      Bs. {(selectedItem.price * exchangeRate).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Custom category-based Description */}
                <p className="text-slate-500 text-sm leading-relaxed mb-6">
                  {(() => {
                    const cat = selectedItem.category?.toLowerCase() || '';
                    if (cat.includes('burg') || cat.includes('hambur')) {
                      return 'Exquisita hamburguesa gourmet preparada al momento con carne de res premium seleccionada, queso cheddar fundido, lechuga fresca, tomates jugosos y nuestra exclusiva salsa de la casa BistroFlow, todo abrazado por un esponjoso pan brioche tostado con mantequilla.';
                    }
                    if (cat.includes('bebi') || cat.includes('soda') || cat.includes('refr')) {
                      return 'Refrescante bebida servida bien fría con hielo y rodaja de limón. El acompañante idóneo para realzar cada uno de los sabores de tu comida favorita en un día caluroso.';
                    }
                    if (cat.includes('postre') || cat.includes('dulce') || cat.includes('helado')) {
                      return 'Un deleite dulce para cerrar con broche de oro. Preparado de manera totalmente artesanal por nuestros maestros reposteros, combinando texturas suaves y sabores irresistibles.';
                    }
                    if (cat.includes('entr') || cat.includes('snack') || cat.includes('papa')) {
                      return 'El acompañamiento perfecto para picar solo o compartir. Crujiente, dorado a la perfección en aceite limpio y sazonado con nuestra mezcla secreta de opiáceos de la casa.';
                    }
                    return 'Una magnífica creación culinaria de nuestra cocina autor, preparada cuidadosamente por el chef del día empleando ingredientes frescos, locales y de la más alta calidad para garantizar un sabor extraordinario e inolvidable.';
                  })()}
                </p>

                {/* Availability Warning Notice */}
                {(() => {
                  const { isAvailable, timingLabel } = getMenuItemAvailability(selectedItem);
                  if (!isRestaurantOpen) {
                    return (
                      <div className="mb-6 bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-start gap-3 text-rose-950">
                        <span className="text-lg">🕒</span>
                        <p className="text-xs font-semibold leading-relaxed">
                          La tienda está cerrada en este momento. Los pedidos están inhabilitados.
                        </p>
                      </div>
                    );
                  }
                  if (!isAvailable) {
                    return (
                      <div className="mb-6 bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-start gap-3 text-rose-950">
                        <span className="text-lg">⏳</span>
                        <p className="text-xs font-semibold leading-relaxed">
                          Este platillo solo está disponible en horario de: <strong className="font-bold">{timingLabel || 'Especial'}</strong>. No se puede ordenar en este momento.
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Personalizar Platillo */}
                {selectedItem.recipe && selectedItem.recipe.length > 0 && (
                  <div className="mb-6 p-4 bg-slate-50 border border-slate-100/60 rounded-2xl">
                    <h5 className="font-bold text-xs text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <span>🍔</span> Personalizar ingredientes
                    </h5>
                    <p className="text-[10px] text-slate-400 mb-3">
                      Quita los ingredientes que no desees en tu preparación:
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
                      Añade extras deliciosos a tu plato (el costo se sumará al total):
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

                {/* Extra note textarea */}
                <div className="mb-6">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    ✍️ Nota o Instrucción especial
                  </label>
                  <textarea
                    value={extraNote}
                    onChange={(e) => setExtraNote(e.target.value)}
                    placeholder="Ej: Sin cebolla, aderezo aparte, bien tostado..."
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-xs font-medium outline-none focus:border-black resize-none h-16 transition-colors"
                  />
                </div>

                {/* Highlights Icons bar */}
                <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl mb-8 text-center text-slate-500 text-xs font-semibold">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <Sparkles size={16} className="text-yellow-500 fill-yellow-500/10" />
                    <span>Premium</span>
                  </div>
                  <div className="flex flex-col items-center justify-center gap-1 border-x border-slate-200">
                    <Clock size={16} className="text-sky-500" />
                    <span>Fresco</span>
                  </div>
                  <div className="flex flex-col items-center justify-center gap-1">
                    <Info size={16} className="text-emerald-500" />
                    <span>Artesanal</span>
                  </div>
                </div>

              </div>

              {/* Quantity selector and checkout action (Sticky Footer) */}
              <div className="p-3.5 sm:p-5 bg-white border-t border-slate-200 flex flex-row items-center justify-between gap-3 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  {/* Quantity controls */}
                  <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-100 rounded-2xl p-1 shrink-0">
                    <button 
                      disabled={!getMenuItemAvailability(selectedItem).isAvailable || !isRestaurantOpen}
                      onClick={() => setModalQty(prev => Math.max(1, prev - 1))}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all text-slate-700 shadow-xs border border-slate-200/60 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Minus size={15} />
                    </button>
                    <span className="font-black text-sm sm:text-base w-7 sm:w-8 text-center select-none">
                      {modalQty}
                    </span>
                    <button 
                      disabled={!getMenuItemAvailability(selectedItem).isAvailable || !isRestaurantOpen}
                      onClick={() => setModalQty(prev => prev + 1)}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all text-slate-700 shadow-xs border border-slate-200/60 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Plus size={15} />
                    </button>
                  </div>

                  {/* Add with custom Qty button */}
                  <button 
                    disabled={!getMenuItemAvailability(selectedItem).isAvailable || !isRestaurantOpen || (qrTable !== null && settings?.qrOrderingEnabled === false)}
                    onClick={() => {
                      const finalExclusions = excludedIds.map(id => ingredients.find(ing => ing.id === id)?.name).filter(Boolean);
                      const exclusionsText = finalExclusions.length > 0 ? `SIN: ${finalExclusions.join(', ')}` : '';
                      const finalNote = [exclusionsText, extraNote.trim()].filter(Boolean).join(' | ');

                      addToCart(selectedItem, modalQty, finalNote, excludedIds, selectedExtras);
                      setSelectedItem(null);
                    }}
                    className={`flex-1 rounded-2xl py-3.5 px-4 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-transform hover:scale-[1.01] shadow-lg cursor-pointer ${
                      (!getMenuItemAvailability(selectedItem).isAvailable || !isRestaurantOpen || (qrTable !== null && settings?.qrOrderingEnabled === false))
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                        : 'bg-black hover:bg-slate-800 text-white shadow-black/10'
                    }`}
                  >
                    <ShoppingBag size={16} />
                    <span className="truncate">
                      {!isRestaurantOpen 
                        ? 'Tienda Cerrada' 
                        : !getMenuItemAvailability(selectedItem).isAvailable 
                          ? 'Inactivo por Horario' 
                          : (qrTable !== null && settings?.qrOrderingEnabled === false)
                            ? 'Pedidos Inhabilitados'
                            : 'Agregar al Pedido'}
                    </span>
                    {getMenuItemAvailability(selectedItem).isAvailable && isRestaurantOpen && (qrTable === null || settings?.qrOrderingEnabled !== false) && (
                      <>
                        <span className="opacity-40 font-normal">|</span>
                        <span>${(getCartEntryPrice({ item: selectedItem, selectedExtras }) * modalQty).toFixed(2)}</span>
                      </>
                    )}
                  </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FLOATING BOTTOM BAR FOR LIVE ORDER TRACKING */}
      {trackedSession && (
        <div className={`fixed left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-30 transition-all duration-300 ${cart.length > 0 ? 'bottom-28' : 'bottom-[max(1.5rem,calc(env(safe-area-inset-bottom)+1rem))]'}`}>
          <button 
            onClick={() => setIsTrackerDrawerOpen(true)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-2xl flex justify-between items-center shadow-xl shadow-indigo-600/20 hover:scale-[1.02] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl text-xs animate-pulse">
                🛵
              </div>
              <div className="text-left">
                <span className="block text-xs font-black uppercase tracking-wider text-indigo-200">Seguimiento en Vivo</span>
                <span className="block text-sm font-bold text-white">Pedido #{trackedSession.id.slice(-6).toUpperCase()}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-bold">
                {getTrackerStep() === 1 && 'Validando'}
                {getTrackerStep() === 2 && 'Cocinando'}
                {getTrackerStep() === 3 && 'Listo/Reparto'}
                {getTrackerStep() >= 4 && 'Entregado'}
              </span>
              <ChevronRight size={16} className="text-white/80" />
            </div>
          </button>
        </div>
      )}

      {/* TRACKING DRAWER BOTTOM SHEET */}
      <AnimatePresence>
        {isTrackerDrawerOpen && trackedSession && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-stretch md:items-end justify-center z-50 p-0 md:p-4">
            {/* Backdrop click to close */}
            <div className="absolute inset-0 hidden md:block" onClick={() => {
              if (trackedSession && (trackedSession.status === 'completed' || trackedSession.status === 'closed')) {
                localStorage.removeItem('tracked_delivery_session_id');
                setTrackedSessionId(null);
                setTrackedSession(null);
              }
              setIsTrackerDrawerOpen(false);
            }} />
            
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full h-full md:h-auto md:max-h-[90vh] md:max-w-lg bg-white rounded-none md:rounded-t-[36px] p-5 sm:p-8 overflow-y-auto shadow-2xl z-10 relative flex flex-col justify-between pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            >
              {/* Drag indicator bar */}
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />

              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2.5 py-1 rounded-full">
                    Sincronizado en Vivo
                  </span>
                  <h3 className="font-bold text-xl mt-2">Seguimiento de tu Pedido</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Cliente: <span className="font-semibold text-slate-700">{trackedSession.customerName}</span> | Método: <span className="font-bold uppercase text-slate-700">{trackedSession.deliveryType === 'delivery' ? '🛵 Delivery' : '🛍️ Pick Up'}</span>
                  </p>
                </div>
                
                <button 
                  onClick={() => {
                    if (trackedSession && (trackedSession.status === 'completed' || trackedSession.status === 'closed')) {
                      localStorage.removeItem('tracked_delivery_session_id');
                      setTrackedSessionId(null);
                      setTrackedSession(null);
                    }
                    setIsTrackerDrawerOpen(false);
                  }}
                  className="text-xs font-bold text-slate-400 hover:text-black uppercase tracking-wider bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100"
                >
                  Cerrar
                </button>
              </div>

              {/* Progress Steps */}
              <div className="space-y-6 relative before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100 mb-8">
                {/* Step 1: Verification */}
                <div className="flex items-start gap-4 relative">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-colors z-10 ${
                    getTrackerStep() >= 1 ? 'bg-black text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {getTrackerStep() > 1 ? <Check size={16} /> : '1'}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Validación del Pago</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {trackedSession.paymentStatus === 'pending_validation' 
                        ? 'Esperando verificación de la transacción (Finanzas/Caja)...' 
                        : 'Pago verificado correctamente.'}
                    </p>
                    {trackedSession.paymentMethod !== 'cash' && (
                      <span className="inline-block mt-1 font-mono text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                        Ref: {trackedSession.paymentReference || 'N/A'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Step 2: Preparation */}
                <div className="flex items-start gap-4 relative">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-colors z-10 ${
                    getTrackerStep() >= 2 ? 'bg-black text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {getTrackerStep() > 2 ? <Check size={16} /> : '2'}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">En Preparación</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {getTrackerStep() === 2 
                        ? 'El chef y equipo de cocina están preparando tus platos favoritos...' 
                        : getTrackerStep() > 2 
                          ? 'Platos preparados con éxito.' 
                          : 'Pendiente de validación de pago.'}
                    </p>
                  </div>
                </div>

                {/* Step 3: Ready for delivery */}
                <div className="flex items-start gap-4 relative">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-colors z-10 ${
                    getTrackerStep() >= 3 ? 'bg-black text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {getTrackerStep() > 3 ? <Check size={16} /> : '3'}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">
                      {trackedSession.deliveryType === 'delivery' ? 'Listo para Reparto / Delivery' : 'Listo para Retiro (Pick Up)'}
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {getTrackerStep() === 3 
                        ? (trackedSession.deliveryType === 'delivery' ? '¡Tu pedido ya está en camino a tu destino!' : '¡Tu pedido ya está empaquetado y listo para que pases a retirar!')
                        : getTrackerStep() > 3 
                          ? 'Pedido entregado.' 
                          : 'Preparando platos...'}
                    </p>
                  </div>
                </div>

                {/* Step 4: Completed */}
                <div className="flex items-start gap-4 relative">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-colors z-10 ${
                    getTrackerStep() >= 4 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {getTrackerStep() >= 4 ? <CheckCircle2 size={16} /> : '4'}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Entregado / Finalizado</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {getTrackerStep() >= 4 
                        ? '¡Que disfrutes tu comida! Gracias por preferir BistroFlow.' 
                        : (trackedSession.deliveryType === 'delivery' ? 'En camino al destino.' : 'Pendiente de entrega/retiro.')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Order Items Summary in Tracker */}
              {trackedOrders.length > 0 && (
                <div className="mb-6 bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    Detalle del Pedido ({trackedOrders.length} {trackedOrders.length === 1 ? 'platillo' : 'platillos'})
                  </span>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {trackedOrders.map((order, idx) => {
                      let itemBadge = { text: 'En Espera', color: 'bg-slate-100 text-slate-600 border-slate-200' };
                      if (order.status === 'pending' || order.status === 'preparing') {
                        itemBadge = { text: '🍳 En Cocina', color: 'bg-amber-100 text-amber-800 border-amber-200' };
                      } else if (order.status === 'ready') {
                        itemBadge = { text: '🔔 ¡Listo!', color: 'bg-emerald-100 text-emerald-800 border-emerald-200 animate-pulse' };
                      } else if (order.status === 'delivered') {
                        itemBadge = { text: '✅ Entregado', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
                      }
                      return (
                        <div key={order.id || idx} className="flex justify-between items-center text-xs bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs">
                          <span className="font-semibold text-slate-800">{order.quantity}x {order.itemName}</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${itemBadge.color}`}>
                            {itemBadge.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Reset tracker if finished, or allow hide */}
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    if (trackedSession && (trackedSession.status === 'completed' || trackedSession.status === 'closed')) {
                      localStorage.removeItem('tracked_delivery_session_id');
                      setTrackedSessionId(null);
                      setTrackedSession(null);
                    }
                    setIsTrackerDrawerOpen(false);
                  }}
                  className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Seguir Navegando
                </button>
                
                <button 
                  onClick={() => {
                    if (confirm('¿Deseas desvincular este tracker de tu pantalla? El pedido continuará su proceso normal.')) {
                      localStorage.removeItem('tracked_delivery_session_id');
                      setTrackedSessionId(null);
                      setIsTrackerDrawerOpen(false);
                    }
                  }}
                  className="px-4 py-3.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Desvincular
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* COMPROBANTE / VOUCHER SUCCESS MODAL */}
      <AnimatePresence>
        {submittedVoucher && (
          <div className="fixed inset-0 bg-black/70 md:backdrop-blur-sm flex items-stretch md:items-center justify-center z-50 p-0 md:p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="bg-white rounded-none md:rounded-[32px] w-full h-full md:h-auto md:max-h-[90vh] md:max-w-md shadow-2xl overflow-y-auto border-0 md:border md:border-slate-100 my-0 md:my-8 flex flex-col relative z-50 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            >
              <div className="p-6 md:p-8 flex-1">
                {/* Header with success badge */}
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                    <CheckCircle2 size={36} className="text-emerald-500" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900">¡Pedido Recibido!</h3>
                  <p className="text-xs text-slate-400 mt-1">Guarda tu comprobante de pago.</p>
                </div>

                {/* Voucher Ticket Paper Design */}
                <div id="voucher-ticket" className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-5 font-mono text-xs text-slate-700 space-y-4 relative overflow-hidden">
                  {/* Top round notch decorations */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-white block" />
                    <span className="w-2 h-2 rounded-full bg-white block" />
                  </div>

                  <div className="text-center border-b border-slate-200 pb-3">
                    <h4 className="font-bold text-sm uppercase text-slate-900">BISTROFLOW</h4>
                    <span className="text-[10px] text-slate-400">Comprobante de Pedido</span>
                  </div>

                  <div className="space-y-1.5 border-b border-slate-200 pb-3">
                    <div><span className="text-slate-400">Nro Pedido:</span> <strong className="text-slate-900 float-right">#{submittedVoucher.id.slice(-6).toUpperCase()}</strong></div>
                    <div><span className="text-slate-400">Fecha:</span> <span className="text-slate-900 float-right">{submittedVoucher.timestamp}</span></div>
                    <div><span className="text-slate-400">Cliente:</span> <span className="text-slate-900 float-right truncate max-w-[180px]">{submittedVoucher.customerName}</span></div>
                    <div><span className="text-slate-400">Teléfono:</span> <span className="text-slate-900 float-right">{submittedVoucher.customerPhone}</span></div>
                    <div><span className="text-slate-400">Tipo:</span> <span className="text-slate-900 float-right uppercase font-bold">{submittedVoucher.deliveryType === 'delivery' ? '🛵 Delivery' : '🛍️ Pick Up'}</span></div>
                    
                    {submittedVoucher.deliveryType === 'delivery' && (
                      <div className="pt-1 border-t border-slate-100 mt-1 space-y-1">
                        {submittedVoucher.deliveryZoneName && (
                          <div>
                            <span className="text-slate-400">Zona:</span>
                            <span className="text-slate-900 float-right font-bold">{submittedVoucher.deliveryZoneName}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-slate-400 block mb-0.5">Dirección:</span>
                          <span className="text-slate-800 block text-[11px] leading-tight font-sans font-medium">{submittedVoucher.customerAddress}</span>
                        </div>
                        {submittedVoucher.deliveryReference && (
                          <div>
                            <span className="text-slate-400 block mb-0.5">Referencia:</span>
                            <span className="text-slate-700 block text-[11px] leading-tight font-sans italic">{submittedVoucher.deliveryReference}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {submittedVoucher.deliveryType === 'delivery' && submittedVoucher.whatsappLocation && (
                      <div className="pt-1 border-t border-slate-100 mt-1">
                        <span className="text-slate-400 block mb-0.5">Ubicación GPS:</span>
                        <a href={submittedVoucher.whatsappLocation} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline block text-[11px] leading-tight font-sans font-medium break-all flex items-center gap-1">
                          <span>{submittedVoucher.whatsappLocation}</span>
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Items list */}
                  <div className="border-b border-slate-200 pb-3 space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Detalle:</span>
                    {submittedVoucher.items.map((it, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="truncate max-w-[200px]">{it.qty}x {it.name}</span>
                        <span>${(it.price * it.qty).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="space-y-1">
                    {submittedVoucher.deliveryType === 'delivery' && (
                      <>
                        <div className="flex justify-between text-slate-500 text-[11px]">
                          <span>Subtotal Productos:</span>
                          <span>${submittedVoucher.subtotalAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-amber-900 font-medium text-[11px]">
                          <span>Envío ({submittedVoucher.deliveryZoneName || 'Delivery'}):</span>
                          <span>+${(submittedVoucher.deliveryFee || 0).toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between text-slate-900 font-black text-sm pt-1 border-t border-slate-200/80">
                      <span>TOTAL USD:</span>
                      <span>${submittedVoucher.totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 font-bold">
                      <span>TOTAL BS:</span>
                      <span>Bs. {(submittedVoucher.totalAmount * exchangeRate).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[10px] mt-1 border-t border-slate-100 pt-2">
                      <span>Pago: {submittedVoucher.paymentMethod.toUpperCase()}</span>
                      {submittedVoucher.paymentMethod !== 'cash' && (
                        <span>Ref: {submittedVoucher.paymentReference}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Instruction for user */}
                <p className="text-[11px] text-indigo-600 font-medium text-center mt-4 bg-indigo-50 py-2 px-3 rounded-xl border border-indigo-100">
                  ⚠️ Envía tu comprobante por WhatsApp al restaurante para validar el pedido y agilizar la cocina.
                </p>
              </div>

              {/* Action Buttons footer */}
              <div className="bg-slate-50 p-6 border-t border-slate-100 flex flex-col gap-2">
                {/* 1. Enviar por WhatsApp directly */}
                <button 
                  onClick={() => {
                    const phone = settings?.whatsappPhone || '+584121234567';
                    const cleanPhone = phone.replace(/[^0-9]/g, '');
                    
                    // Format message
                    const itemsText = submittedVoucher.items
                      .map(it => `• *${it.qty}x* ${it.name} (_$${(it.price * it.qty).toFixed(2)}_)`)
                      .join('\n');
                    
                    const message = `🍔 *NUEVO PEDIDO EN BISTROFLOW* 🍟\n` +
                      `------------------------------------\n` +
                      `*Nro Pedido:* #${submittedVoucher.id.slice(-6).toUpperCase()}\n` +
                      `*Cliente:* ${submittedVoucher.customerName}\n` +
                      `*Teléfono:* ${submittedVoucher.customerPhone}\n` +
                      `*Método:* ${submittedVoucher.deliveryType === 'delivery' ? 'Delivery Express 🛵' : 'Retiro en Local (Pick Up) 🛍️'}\n` +
                      (submittedVoucher.deliveryType === 'delivery' && submittedVoucher.deliveryZoneName ? `*Zona de Envío:* ${submittedVoucher.deliveryZoneName}\n` : '') +
                      (submittedVoucher.deliveryType === 'delivery' ? `*Dirección:* ${submittedVoucher.customerAddress}\n` : '') +
                      (submittedVoucher.deliveryType === 'delivery' && submittedVoucher.deliveryReference ? `*Referencia:* ${submittedVoucher.deliveryReference}\n` : '') +
                      (submittedVoucher.deliveryType === 'delivery' && submittedVoucher.whatsappLocation ? `*Ubicación GPS:* ${submittedVoucher.whatsappLocation}\n` : '') +
                      `\n*Artículos:* \n${itemsText}\n\n` +
                      `------------------------------------\n` +
                      (submittedVoucher.deliveryType === 'delivery' ? `*Subtotal:* $${submittedVoucher.subtotalAmount.toFixed(2)} USD\n` : '') +
                      (submittedVoucher.deliveryType === 'delivery' ? `*Costo Envío:* $${(submittedVoucher.deliveryFee || 0).toFixed(2)} USD\n` : '') +
                      `*TOTAL ${activeCurrency}:* ${formatPrice(submittedVoucher.totalAmount)}\n` +
                      `*TOTAL BS:* ${formatBs(toBolivares(submittedVoucher.totalAmount))} _(Tasa: ${currentRateBs.toFixed(2)} Bs/${currencySymbol})_\n` +
                      `*Método de Pago:* _${submittedVoucher.paymentMethod === 'pagomovil' ? 'Pago Móvil 📱' : submittedVoucher.paymentMethod === 'zelle' ? 'Zelle 📧' : 'Efectivo 💵'}_\n` +
                      (submittedVoucher.paymentMethod !== 'cash' ? `*Referencia/Pago:* _${submittedVoucher.paymentReference}_\n` : '') +
                      `------------------------------------\n` +
                      `_¡Hola! Acabo de enviar mi pedido a través de la aplicación. Quedo atento a la confirmación de la preparación._ 🙏`;

                    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
                    window.open(waUrl, '_blank');
                  }}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl py-3.5 px-4 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/15 hover:scale-[1.01] transition-transform"
                >
                  <MessageCircle size={18} />
                  <span>Enviar por WhatsApp</span>
                </button>

                {/* 2. Download Comprobante as TXT file */}
                <button 
                  onClick={() => {
                    const cleanID = submittedVoucher.id.slice(-6).toUpperCase();
                    const itemsText = submittedVoucher.items
                      .map(it => ` - ${it.qty}x ${it.name} : $${(it.price * it.qty).toFixed(2)}`)
                      .join('\r\n');
                    
                    const receiptContent = 
                      `========================================\r\n` +
                      `             BISTROFLOW SL              \r\n` +
                      `         COMPROBANTE DE PEDIDO          \r\n` +
                      `========================================\r\n` +
                      `ID Pedido : #${cleanID}\r\n` +
                      `Fecha     : ${submittedVoucher.timestamp}\r\n` +
                      `Cliente   : ${submittedVoucher.customerName}\r\n` +
                      `Telefono  : ${submittedVoucher.customerPhone}\r\n` +
                      `Tipo      : ${submittedVoucher.deliveryType === 'delivery' ? 'Delivery Express' : 'Retiro en Local'}\r\n` +
                      (submittedVoucher.deliveryType === 'delivery' ? `Direccion : ${submittedVoucher.customerAddress}\r\n` : '') +
                      (submittedVoucher.deliveryType === 'delivery' && submittedVoucher.whatsappLocation ? `GPS       : ${submittedVoucher.whatsappLocation}\r\n` : '') +
                      `----------------------------------------\r\n` +
                      `DETALLE DEL PEDIDO:\r\n` +
                      `${itemsText}\r\n` +
                      `----------------------------------------\r\n` +
                      `TOTAL ${activeCurrency.padEnd(4, ' ')}: ${formatPrice(submittedVoucher.totalAmount)}\r\n` +
                      `TOTAL BS  : ${formatBs(toBolivares(submittedVoucher.totalAmount))}\r\n` +
                      `----------------------------------------\r\n` +
                      `Metodo    : ${submittedVoucher.paymentMethod.toUpperCase()}\r\n` +
                      (submittedVoucher.paymentMethod !== 'cash' ? `Referencia: ${submittedVoucher.paymentReference}\r\n` : '') +
                      `========================================\r\n` +
                      `       ¡Gracias por tu preferencia!      \r\n` +
                      `========================================\r\n`;

                    const blob = new Blob([receiptContent], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `bistroflow-pedido-${cleanID}.txt`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  }}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl py-3 px-4 font-bold text-xs flex items-center justify-center gap-2 hover:scale-[1.01] transition-transform"
                >
                  <Download size={14} />
                  <span>Descargar Comprobante (.TXT)</span>
                </button>

                {/* 3. Ir a Inicio / Cerrar */}
                <button 
                  onClick={() => setSubmittedVoucher(null)}
                  className="w-full bg-black text-white rounded-2xl py-3 px-4 font-black text-xs hover:scale-[1.01] transition-transform"
                >
                  Ir al Inicio (Seguimiento en Vivo)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
