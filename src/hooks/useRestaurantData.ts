import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Table, MenuItem, Session, OrderItem, Promotion, Ingredient, DeliveryZone, PaymentMethodItem, Coupon, FlashDeal } from '../types';

export const DEFAULT_DELIVERY_ZONES: DeliveryZone[] = [
  { id: 'zone-1', name: 'Zona Central / Cercana', priceUSD: 2.00, estimatedTime: '20-30 min', coveredAreas: 'Casco Central, avenidas principales y sectores adyacentes' },
  { id: 'zone-2', name: 'Zona Media / Residencial', priceUSD: 3.50, estimatedTime: '30-45 min', coveredAreas: 'Urbanizaciones intermedias y sectores residenciales' },
  { id: 'zone-3', name: 'Zona Lejana / Periferia', priceUSD: 5.00, estimatedTime: '45-60 min', coveredAreas: 'Zonas retiradas, colinas y afueras' }
];

export const DEFAULT_PAYMENT_METHODS: PaymentMethodItem[] = [
  {
    id: 'pago_movil',
    name: 'Pago Móvil',
    type: 'pago_movil',
    currency: 'Bs',
    enabled: true,
    requiresReference: true,
    details: {
      bank: 'Banesco',
      phone: '0412-1234567',
      idNumber: 'V-12345678'
    }
  },
  {
    id: 'punto',
    name: 'Punto de Venta (Bs)',
    type: 'punto',
    currency: 'Bs',
    enabled: true,
    requiresReference: true,
    details: {
      notes: 'Tarjetas de Débito y Crédito Nacionales'
    }
  },
  {
    id: 'zelle',
    name: 'Zelle',
    type: 'zelle',
    currency: 'USD',
    enabled: true,
    requiresReference: true,
    details: {
      email: 'pagos@bistroflow.com',
      accountHolder: 'BistroFlow SL'
    }
  },
  {
    id: 'divisa',
    name: 'Efectivo / Divisa',
    type: 'divisa',
    currency: 'USD',
    enabled: true,
    requiresReference: false,
    details: {
      notes: 'Billetes en efectivo USD / EUR'
    }
  },
  {
    id: 'credito',
    name: 'Crédito',
    type: 'credito',
    currency: 'USD',
    enabled: false,
    requiresReference: false,
    details: {
      notes: 'Crédito a clientes / cuentas por cobrar con autorización de PIN'
    }
  }
];

export const DEFAULT_COUPONS: Coupon[] = [
  {
    id: 'coupon-1',
    code: 'BISTRO20',
    title: '20% OFF en tu Pedido',
    description: 'Aplica 20% de descuento en pedidos mayores a $10',
    discountType: 'percentage',
    discountValue: 20,
    minSpend: 10,
    maxDiscount: 15,
    usageLimit: 100,
    usedCount: 14,
    perUserLimit: 1,
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    applicableChannel: 'all',
    createdAt: new Date().toISOString()
  },
  {
    id: 'coupon-2',
    code: 'BURGER5',
    title: '$5.00 de Descuento Especial',
    description: 'Descuento directo de $5.00 en consumos mayores a $20',
    discountType: 'fixed',
    discountValue: 5,
    minSpend: 20,
    usageLimit: 50,
    usedCount: 8,
    perUserLimit: 1,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    applicableChannel: 'delivery',
    createdAt: new Date().toISOString()
  },
  {
    id: 'coupon-3',
    code: 'VIP15',
    title: '15% de Descuento Clientes VIP',
    description: 'Válido para consumo en salón o delivery',
    discountType: 'percentage',
    discountValue: 15,
    minSpend: 8,
    maxDiscount: 10,
    usageLimit: 200,
    usedCount: 29,
    perUserLimit: 1,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    applicableChannel: 'all',
    createdAt: new Date().toISOString()
  }
];

export const DEFAULT_FLASH_DEALS: FlashDeal[] = [
  {
    id: 'flash-1',
    title: '⚡ Happy Hour 30% OFF en Hamburguesas',
    subtitle: 'Por tiempo limitado en horario especial',
    description: 'Descuento automático del 30% en todas las smash burgers dobles y clásicas.',
    badge: '⚡ FLASH DEAL 30%',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
    discountType: 'percentage',
    discountValue: 30,
    appliesTo: 'category',
    targetCategory: 'Hamburguesa',
    startsAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    endsAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'flash-2',
    title: '🍹 2x1 en Bebidas Artesanales',
    subtitle: 'Por tiempo limitado para celebrar el día',
    description: 'Disfruta tus bebidas y cocteles favoritos con 50% de descuento directo.',
    badge: '⏳ 2x1 BEBIDAS',
    image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800',
    discountType: 'percentage',
    discountValue: 50,
    appliesTo: 'category',
    targetCategory: 'Bebidas',
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    createdAt: new Date().toISOString()
  }
];

export function useRestaurantData() {
  const [tables, setTables] = useState<Table[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [flashDeals, setFlashDeals] = useState<FlashDeal[]>([]);
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(40); // Default Bs/$ 
  const [settings, setSettings] = useState({
    exchangeRate: 40,
    pagoMovilBanco: 'Banesco',
    pagoMovilPhone: '0412-1234567',
    pagoMovilId: 'V-12345678',
    zelleEmail: 'pagos@bistroflow.com',
    zelleName: 'BistroFlow SL',
    whatsappPhone: '+584121234567',
    restaurantName: 'BistroFlow',
    logoUrl: '',
    slogan: 'SISTEMA GASTRONÓMICO & POS',
    restaurantPhone: '+584121234567',
    restaurantAddress: 'Caracas, Venezuela',
    deliveryEnabled: true,
    pickupEnabled: true,
    deliveryZones: DEFAULT_DELIVERY_ZONES,
    minDeliveryOrderEnabled: false,
    minDeliveryOrderAmount: 10,
    serviceChargeEnabled: true,
    serviceChargePercent: 10,
    closeDineInOnPaymentReport: false,
    requirePhotoForShift: true,
    scheduleEnabled: false,
    storeStatus: 'auto', // 'auto' | 'open' | 'closed'
    breakfastStart: '06:00',
    breakfastEnd: '09:00',
    lunchStart: '11:00',
    lunchEnd: '15:00',
    dinnerStart: '18:00',
    dinnerEnd: '23:00',
    schedules: {
      monday: { open: '08:00', close: '22:00', closed: false },
      tuesday: { open: '08:00', close: '22:00', closed: false },
      wednesday: { open: '08:00', close: '22:00', closed: false },
      thursday: { open: '08:00', close: '22:00', closed: false },
      friday: { open: '08:00', close: '23:00', closed: false },
      saturday: { open: '08:00', close: '23:00', closed: false },
      sunday: { open: '09:00', close: '21:00', closed: false }
    } as any,
    suggestedTipsEnabled: true,
    defaultTipPercent: 10,
    kdsWarningMinutes: 8,
    kdsCriticalMinutes: 15,
    kdsWarningColor: 'amber', // 'amber' | 'yellow' | 'orange' | 'purple'
    kdsCriticalColor: 'rose', // 'rose' | 'red' | 'crimson'
    kitchenMode: localStorage.getItem('kitchenMode') || 'kds', // 'kds' | 'direct_print'
    kitchenPaperWidth: '80mm', // '80mm' | '58mm'
    autoPrintKitchenTicket: true,
    allowCashierPos: localStorage.getItem('allowCashierPos') === 'false' ? false : true,
    allowCashierCreditApproval: localStorage.getItem('allowCashierCreditApproval') === 'false' ? false : true,
    auto86Enabled: true,
    coursePacingEnabled: true,
    seatOrderingEnabled: true,
    feedbackEnabled: true,
    creditEnabled: false,
    paymentMethodsList: DEFAULT_PAYMENT_METHODS
  });

  useEffect(() => {
    const unsubTables = onSnapshot(collection(db, 'tables'), (snap) => {
      setTables(snap.docs.map(d => ({ ...d.data(), id: d.id } as Table)));
    });

    const unsubMenu = onSnapshot(collection(db, 'menu'), (snap) => {
      setMenu(snap.docs.map(d => ({ ...d.data(), id: d.id } as MenuItem)));
    });

    const unsubIngredients = onSnapshot(collection(db, 'inventory'), (snap) => {
      setIngredients(snap.docs.map(d => ({ ...d.data(), id: d.id } as Ingredient)));
    });

    const unsubPromotions = onSnapshot(collection(db, 'promotions'), (snap) => {
      setPromotions(snap.docs.map(d => ({ ...d.data(), id: d.id } as Promotion)));
    });

    const unsubCoupons = onSnapshot(collection(db, 'coupons'), (snap) => {
      if (snap.empty) {
        setCoupons(DEFAULT_COUPONS);
      } else {
        setCoupons(snap.docs.map(d => ({ ...d.data(), id: d.id } as Coupon)));
      }
    });

    const unsubFlashDeals = onSnapshot(collection(db, 'flash_deals'), (snap) => {
      if (snap.empty) {
        setFlashDeals(DEFAULT_FLASH_DEALS);
      } else {
        setFlashDeals(snap.docs.map(d => ({ ...d.data(), id: d.id } as FlashDeal)));
      }
    });

    const unsubSessions = onSnapshot(
      query(collection(db, 'sessions'), where('status', '==', 'active')),
      (snap) => {
        setActiveSessions(snap.docs.map(d => ({ ...d.data(), id: d.id } as Session)));
      }
    );

    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const activeCurr = data.activeCurrency || 'USD';
        let rate = Number(data.exchangeRate) || 874.73;
        if (data.currencyRates && data.currencyRates[activeCurr]?.rate) {
          rate = Number(data.currencyRates[activeCurr].rate);
        }
        setExchangeRate(rate);
        setSettings({
          activeCurrency: activeCurr,
          currencyRates: data.currencyRates || null,
          exchangeRate: rate,
          pagoMovilBanco: data.pagoMovilBanco || 'Banesco',
          pagoMovilPhone: data.pagoMovilPhone || '0412-1234567',
          pagoMovilId: data.pagoMovilId || 'V-12345678',
          zelleEmail: data.zelleEmail || 'pagos@bistroflow.com',
          zelleName: data.zelleName || 'BistroFlow SL',
          whatsappPhone: data.whatsappPhone || '+584121234567',
          restaurantName: data.restaurantName || 'BistroFlow',
          logoUrl: data.logoUrl || '',
          slogan: data.slogan || data.tagline || 'SISTEMA GASTRONÓMICO & POS',
          restaurantPhone: data.restaurantPhone || '+584121234567',
          restaurantAddress: data.restaurantAddress || 'Caracas, Venezuela',
          deliveryEnabled: data.deliveryEnabled !== undefined ? data.deliveryEnabled : true,
          pickupEnabled: data.pickupEnabled !== undefined ? data.pickupEnabled : true,
          deliveryZones: data.deliveryZones && data.deliveryZones.length > 0 ? data.deliveryZones : DEFAULT_DELIVERY_ZONES,
          minDeliveryOrderEnabled: data.minDeliveryOrderEnabled !== undefined ? data.minDeliveryOrderEnabled : false,
          minDeliveryOrderAmount: data.minDeliveryOrderAmount !== undefined ? Number(data.minDeliveryOrderAmount) : 10,
          serviceChargeEnabled: data.serviceChargeEnabled !== undefined ? data.serviceChargeEnabled : true,
          serviceChargePercent: data.serviceChargePercent !== undefined ? data.serviceChargePercent : 10,
          closeDineInOnPaymentReport: data.closeDineInOnPaymentReport !== undefined ? data.closeDineInOnPaymentReport : false,
          requirePhotoForShift: data.requirePhotoForShift !== undefined ? data.requirePhotoForShift : true,
          scheduleEnabled: data.scheduleEnabled !== undefined ? data.scheduleEnabled : false,
          storeStatus: data.storeStatus || 'auto',
          breakfastStart: data.breakfastStart || '06:00',
          breakfastEnd: data.breakfastEnd || '09:00',
          lunchStart: data.lunchStart || '11:00',
          lunchEnd: data.lunchEnd || '15:00',
          dinnerStart: data.dinnerStart || '18:00',
          dinnerEnd: data.dinnerEnd || '23:00',
          schedules: data.schedules || {
            monday: { open: '08:00', close: '22:00', closed: false },
            tuesday: { open: '08:00', close: '22:00', closed: false },
            wednesday: { open: '08:00', close: '22:00', closed: false },
            thursday: { open: '08:00', close: '22:00', closed: false },
            friday: { open: '08:00', close: '23:00', closed: false },
            saturday: { open: '08:00', close: '23:00', closed: false },
            sunday: { open: '09:00', close: '21:00', closed: false }
          },
          suggestedTipsEnabled: data.suggestedTipsEnabled !== undefined ? data.suggestedTipsEnabled : true,
          defaultTipPercent: data.defaultTipPercent !== undefined ? data.defaultTipPercent : 10,
          kdsWarningMinutes: data.kdsWarningMinutes !== undefined ? data.kdsWarningMinutes : 8,
          kdsCriticalMinutes: data.kdsCriticalMinutes !== undefined ? data.kdsCriticalMinutes : 15,
          kdsWarningColor: data.kdsWarningColor || 'amber',
          kdsCriticalColor: data.kdsCriticalColor || 'rose',
          kitchenMode: data.kitchenMode || localStorage.getItem('kitchenMode') || 'kds',
          kitchenPaperWidth: data.kitchenPaperWidth || '80mm',
          autoPrintKitchenTicket: data.autoPrintKitchenTicket !== undefined ? data.autoPrintKitchenTicket : true,
          allowCashierPos: data.allowCashierPos !== undefined ? data.allowCashierPos : (localStorage.getItem('allowCashierPos') === 'false' ? false : true),
          allowCashierCreditApproval: data.allowCashierCreditApproval !== undefined ? data.allowCashierCreditApproval : (localStorage.getItem('allowCashierCreditApproval') === 'false' ? false : true),
          auto86Enabled: data.auto86Enabled !== undefined ? data.auto86Enabled : true,
          coursePacingEnabled: data.coursePacingEnabled !== undefined ? data.coursePacingEnabled : true,
          seatOrderingEnabled: data.seatOrderingEnabled !== undefined ? data.seatOrderingEnabled : true,
          feedbackEnabled: data.feedbackEnabled !== undefined ? data.feedbackEnabled : true,
          creditEnabled: data.creditEnabled !== undefined ? data.creditEnabled : false,
          paymentMethodsList: data.paymentMethodsList && Array.isArray(data.paymentMethodsList) && data.paymentMethodsList.length > 0
            ? data.paymentMethodsList
            : DEFAULT_PAYMENT_METHODS
        });
      }
    });

    return () => {
      unsubTables();
      unsubMenu();
      unsubIngredients();
      unsubPromotions();
      unsubCoupons();
      unsubFlashDeals();
      unsubSessions();
      unsubSettings();
    };
  }, []);

  return { tables, menu, ingredients, promotions, activeSessions, exchangeRate, settings, coupons, flashDeals };
}
