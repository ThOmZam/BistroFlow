import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Table, MenuItem, Session, OrderItem, Promotion, Ingredient } from '../types';

export function useRestaurantData() {
  const [tables, setTables] = useState<Table[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
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
    restaurantPhone: '+584121234567',
    restaurantAddress: 'Caracas, Venezuela',
    deliveryEnabled: true,
    pickupEnabled: true,
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
    auto86Enabled: true,
    coursePacingEnabled: true,
    seatOrderingEnabled: true,
    feedbackEnabled: true
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

    const unsubSessions = onSnapshot(
      query(collection(db, 'sessions'), where('status', '==', 'active')),
      (snap) => {
        setActiveSessions(snap.docs.map(d => ({ ...d.data(), id: d.id } as Session)));
      }
    );

    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const rate = data.exchangeRate || 40;
        setExchangeRate(rate);
        setSettings({
          exchangeRate: rate,
          pagoMovilBanco: data.pagoMovilBanco || 'Banesco',
          pagoMovilPhone: data.pagoMovilPhone || '0412-1234567',
          pagoMovilId: data.pagoMovilId || 'V-12345678',
          zelleEmail: data.zelleEmail || 'pagos@bistroflow.com',
          zelleName: data.zelleName || 'BistroFlow SL',
          whatsappPhone: data.whatsappPhone || '+584121234567',
          restaurantName: data.restaurantName || 'BistroFlow',
          restaurantPhone: data.restaurantPhone || '+584121234567',
          restaurantAddress: data.restaurantAddress || 'Caracas, Venezuela',
          deliveryEnabled: data.deliveryEnabled !== undefined ? data.deliveryEnabled : true,
          pickupEnabled: data.pickupEnabled !== undefined ? data.pickupEnabled : true,
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
          auto86Enabled: data.auto86Enabled !== undefined ? data.auto86Enabled : true,
          coursePacingEnabled: data.coursePacingEnabled !== undefined ? data.coursePacingEnabled : true,
          seatOrderingEnabled: data.seatOrderingEnabled !== undefined ? data.seatOrderingEnabled : true,
          feedbackEnabled: data.feedbackEnabled !== undefined ? data.feedbackEnabled : true
        });
      }
    });

    return () => {
      unsubTables();
      unsubMenu();
      unsubIngredients();
      unsubPromotions();
      unsubSessions();
      unsubSettings();
    };
  }, []);

  return { tables, menu, ingredients, promotions, activeSessions, exchangeRate, settings };
}
