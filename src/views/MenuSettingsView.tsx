import React, { useState, useEffect } from 'react';
import { collection, doc, updateDoc, addDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useRestaurantData, DEFAULT_DELIVERY_ZONES, DEFAULT_PAYMENT_METHODS } from '../hooks/useRestaurantData';
import { MenuItem, MenuItemVariant, Table, Promotion, ExtraOption, DeliveryZone, PaymentMethodItem } from '../types';
import { Settings, Plus, Save, Trash2, X, DollarSign, GripHorizontal, Tag, Sparkles, QrCode, Printer, Download, ExternalLink, Copy, Check, Star, MapPin, Edit, CreditCard, Smartphone, ShieldCheck, AlertCircle, ToggleLeft, ToggleRight, CheckCircle2, ChevronRight, Edit3, Globe, ShoppingBag, UtensilsCrossed, Grid, Building2, Bell, Zap, Lock, ArrowLeft, Clock, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { logAction } from '../lib/logger';
import { playNotificationSound, playSuccessSound, playErrorSound, playClickSound, playCashSound } from '../lib/audio';
import { getMenuItemStockAlert } from '../lib/stockUtils';
import { useBookmarks } from '../lib/bookmarks';
import { useCurrency } from '../context/CurrencyContext';
import CurrencySelector from '../components/CurrencySelector';
import { getQRCodeUrl, getFallbackQRCodeUrl } from '../lib/qrUtils';
import { clearAndSeedQSandwichMenu } from '../lib/seedQSandwich';

export default function MenuSettingsView({ currentUser }: { currentUser?: any }) {
  const { menu = [], tables = [], exchangeRate, settings, promotions = [], ingredients = [] } = useRestaurantData() || {};
  const { activeCurrency, currentRateBs, currencySymbol, updateManualRate, toBolivares, formatBs, formatPrice } = useCurrency();
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const [activeTab, setActiveTab] = useState<'menu' | 'tables' | 'general' | 'toast_pos' | 'promotions' | 'payments' | 'notifications'>('menu');

  useEffect(() => {
    const handleSetTab = (e: any) => {
      if (e.detail) {
        setActiveTab(e.detail);
      }
    };
    const handleSelectMenuItem = (e: any) => {
      if (e.detail?.item) {
        setActiveTab('menu');
        handleEditMenu(e.detail.item);
      } else if (e.detail?.table) {
        setActiveTab('tables');
        setSelectedQRTable(e.detail.table);
      }
    };
    window.addEventListener('set_settings_tab', handleSetTab);
    window.addEventListener('select_menu_item', handleSelectMenuItem);
    return () => {
      window.removeEventListener('set_settings_tab', handleSetTab);
      window.removeEventListener('select_menu_item', handleSelectMenuItem);
    };
  }, [menu, tables]);
  
  // Menu State
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isCreatingMenu, setIsCreatingMenu] = useState(false);
  const [isSavingMenu, setIsSavingMenu] = useState(false);
  const [menuData, setMenuData] = useState({ 
    name: '', 
    price: 0, 
    category: '', 
    image: '',
    recipe: [] as { ingredientId: string; quantity: number }[],
    scheduleType: 'always' as 'always' | 'breakfast' | 'lunch' | 'dinner' | 'custom',
    availableFrom: '',
    availableTo: '',
    alerts: [] as string[],
    extras: [] as ExtraOption[],
    variants: [] as MenuItemVariant[],
    preparationTime: '' as number | ''
  });

  // Variant form input state inside dish modal
  const [variantFormName, setVariantFormName] = useState('');
  const [variantFormPrice, setVariantFormPrice] = useState('');
  const [variantFormIngId, setVariantFormIngId] = useState('');
  const [variantFormQty, setVariantFormQty] = useState('1');

  const [isCreatingCombo, setIsCreatingCombo] = useState(false);
  const [editingComboId, setEditingComboId] = useState<string | null>(null);
  const [comboData, setComboData] = useState<{
    name: string;
    price: number | '';
    description: string;
    image: string;
    items: {
      menuItemId: string;
      name: string;
      price: number;
      quantity: number;
      category?: string;
    }[];
  }>({
    name: '',
    price: '',
    description: '',
    image: '',
    items: []
  });
  const [selectedMenuIdToAdd, setSelectedMenuIdToAdd] = useState('');
  const [selectedQtyToAdd, setSelectedQtyToAdd] = useState<number>(1);
  const [isSeedingQSandwich, setIsSeedingQSandwich] = useState(false);
  const [isSeedingConfirmOpen, setIsSeedingConfirmOpen] = useState(false);

  // In-app Deletion confirmation states (never blocked by browser iframe)
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<Table | null>(null);

  const handleSeedQSandwich = async () => {
    setIsSeedingQSandwich(true);
    setIsSeedingConfirmOpen(false);
    try {
      await clearAndSeedQSandwichMenu();
      playSuccessSound();
    } catch (err) {
      console.error('Error seeding menu:', err);
      playErrorSound();
    } finally {
      setIsSeedingQSandwich(false);
    }
  };

  // Recipe form state inside modal
  const [modalRecipeIngId, setModalRecipeIngId] = useState('');
  const [modalRecipeQty, setModalRecipeQty] = useState('1');

  // Extras form state
  const [extraFormIngId, setExtraFormIngId] = useState('');
  const [extraFormName, setExtraFormName] = useState('');
  const [extraFormPrice, setExtraFormPrice] = useState('');
  const [extraFormQty, setExtraFormQty] = useState('1');

  // Promotions State
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [isCreatingPromo, setIsCreatingPromo] = useState(false);
  const [isSavingPromo, setIsSavingPromo] = useState(false);
  const [promoData, setPromoData] = useState({
    title: '',
    subtitle: '',
    description: '',
    badge: '',
    image: '',
    actionText: '',
    filterCategory: 'All',
    filterQuery: '',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-800'
  });

  // Table State
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [isCreatingTable, setIsCreatingTable] = useState(false);
  const [isSavingTable, setIsSavingTable] = useState(false);
  const [tableData, setTableData] = useState({ number: '', capacity: 4, status: 'free' });
  const [selectedQRTable, setSelectedQRTable] = useState<Table | null>(null);
  const [copiedTableId, setCopiedTableId] = useState<string | null>(null);

  // General & Payments State
  const [rateInput, setRateInput] = useState(exchangeRate.toString());
  
  // Notification Toggles State
  const [notifSound, setNotifSound] = useState(() => localStorage.getItem('notif_sound_enabled') !== 'false');
  const [notifPush, setNotifPush] = useState(() => localStorage.getItem('notif_push_enabled') === 'true');
  const [notifOrders, setNotifOrders] = useState(() => localStorage.getItem('notif_pref_orders') !== 'false');
  const [notifFinance, setNotifFinance] = useState(() => localStorage.getItem('notif_pref_finance') !== 'false');
  const [notifAuth, setNotifAuth] = useState(() => localStorage.getItem('notif_pref_auth') !== 'false');
  const [notifSystem, setNotifSystem] = useState(() => localStorage.getItem('notif_pref_system') !== 'false');
  const [pagoMovilBancoInput, setPagoMovilBancoInput] = useState(settings?.pagoMovilBanco || 'Banesco');
  const [pagoMovilPhoneInput, setPagoMovilPhoneInput] = useState(settings?.pagoMovilPhone || '0412-1234567');
  const [pagoMovilIdInput, setPagoMovilIdInput] = useState(settings?.pagoMovilId || 'V-12345678');
  const [zelleEmailInput, setZelleEmailInput] = useState(settings?.zelleEmail || 'pagos@bistroflow.com');
  const [zelleNameInput, setZelleNameInput] = useState(settings?.zelleName || 'BistroFlow SL');
  const [whatsappPhoneInput, setWhatsappPhoneInput] = useState(settings?.whatsappPhone || '+584121234567');
  const [creditEnabledInput, setCreditEnabledInput] = useState<boolean>(settings?.creditEnabled !== undefined ? settings.creditEnabled : false);
  const [paymentMethodsListInput, setPaymentMethodsListInput] = useState<PaymentMethodItem[]>(
    settings?.paymentMethodsList && Array.isArray(settings.paymentMethodsList) && settings.paymentMethodsList.length > 0
      ? settings.paymentMethodsList
      : DEFAULT_PAYMENT_METHODS
  );
  const [editingMethod, setEditingMethod] = useState<PaymentMethodItem | null>(null);
  const [isCreatingMethod, setIsCreatingMethod] = useState(false);
  const [methodForm, setMethodForm] = useState({
    id: '',
    name: '',
    type: 'custom' as PaymentMethodItem['type'],
    currency: 'USD' as PaymentMethodItem['currency'],
    enabled: true,
    requiresReference: true,
    bank: '',
    phone: '',
    idNumber: '',
    email: '',
    accountHolder: '',
    notes: ''
  });

  // Restaurant General Info State
  const [restaurantNameInput, setRestaurantNameInput] = useState(settings?.restaurantName || 'BistroFlow');
  const [logoUrlInput, setLogoUrlInput] = useState((settings as any)?.logoUrl || '');
  const [sloganInput, setSloganInput] = useState((settings as any)?.slogan || (settings as any)?.tagline || 'SISTEMA GASTRONÓMICO & POS');
  const [restaurantPhoneInput, setRestaurantPhoneInput] = useState(settings?.restaurantPhone || '+584121234567');
  const [restaurantAddressInput, setRestaurantAddressInput] = useState(settings?.restaurantAddress || 'Caracas, Venezuela');
  const [deliveryEnabledInput, setDeliveryEnabledInput] = useState(true);
  const [minDeliveryOrderEnabledInput, setMinDeliveryOrderEnabledInput] = useState<boolean>(
    (settings as any)?.minDeliveryOrderEnabled !== undefined ? (settings as any).minDeliveryOrderEnabled : false
  );
  const [minDeliveryOrderAmountInput, setMinDeliveryOrderAmountInput] = useState<number>(
    (settings as any)?.minDeliveryOrderAmount !== undefined ? Number((settings as any).minDeliveryOrderAmount) : 10
  );
  const [pickupEnabledInput, setPickupEnabledInput] = useState(true);
  const [deliveryZonesInput, setDeliveryZonesInput] = useState<DeliveryZone[]>(
    settings?.deliveryZones || DEFAULT_DELIVERY_ZONES
  );
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [isCreatingZone, setIsCreatingZone] = useState(false);
  const [zoneForm, setZoneForm] = useState({
    name: '',
    priceUSD: '2.50',
    estimatedTime: '20-35 min',
    coveredAreas: ''
  });
  const [qrOrderingEnabledInput, setQrOrderingEnabledInput] = useState(true);
  const [serviceChargeEnabledInput, setServiceChargeEnabledInput] = useState(true);
  const [serviceChargePercentInput, setServiceChargePercentInput] = useState(10);
  const [closeDineInOnPaymentReportInput, setCloseDineInOnPaymentReportInput] = useState(false);
  const [requirePhotoForShiftInput, setRequirePhotoForShiftInput] = useState(true);
  const [autoPrintFormatInput, setAutoPrintFormatInput] = useState<'comanda' | 'individual_stickers'>(
    () => (localStorage.getItem('kds_auto_print_format') as 'comanda' | 'individual_stickers') || 'comanda'
  );
  
  const [storeStatusInput, setStoreStatusInput] = useState<'auto' | 'open' | 'closed'>('auto');
  const [breakfastStartInput, setBreakfastStartInput] = useState('06:00');
  const [breakfastEndInput, setBreakfastEndInput] = useState('09:00');
  const [lunchStartInput, setLunchStartInput] = useState('11:00');
  const [lunchEndInput, setLunchEndInput] = useState('15:00');
  const [dinnerStartInput, setDinnerStartInput] = useState('18:00');
  const [dinnerEndInput, setDinnerEndInput] = useState('23:00');
  const [schedulesInput, setSchedulesInput] = useState<any>({
    monday: { open: '08:00', close: '22:00', closed: false },
    tuesday: { open: '08:00', close: '22:00', closed: false },
    wednesday: { open: '08:00', close: '22:00', closed: false },
    thursday: { open: '08:00', close: '22:00', closed: false },
    friday: { open: '08:00', close: '23:00', closed: false },
    saturday: { open: '08:00', close: '23:00', closed: false },
    sunday: { open: '09:00', close: '21:00', closed: false }
  });

  // Operaciones & KDS Configurables State
  const [suggestedTipsEnabledInput, setSuggestedTipsEnabledInput] = useState(true);
  const [defaultTipPercentInput, setDefaultTipPercentInput] = useState(10);
  const [kdsWarningMinutesInput, setKdsWarningMinutesInput] = useState(8);
  const [kdsCriticalMinutesInput, setKdsCriticalMinutesInput] = useState(15);
  const [kdsWarningColorInput, setKdsWarningColorInput] = useState<'amber' | 'yellow' | 'orange'>('amber');
  const [kdsCriticalColorInput, setKdsCriticalColorInput] = useState<'rose' | 'red' | 'purple'>('rose');
  const [auto86EnabledInput, setAuto86EnabledInput] = useState(true);
  const [coursePacingEnabledInput, setCoursePacingEnabledInput] = useState(true);
  const [seatOrderingEnabledInput, setSeatOrderingEnabledInput] = useState(true);
  const [feedbackEnabledInput, setFeedbackEnabledInput] = useState(true);
  const [kitchenModeInput, setKitchenModeInput] = useState<'kds' | 'direct_print'>(
    (settings as any)?.kitchenMode || localStorage.getItem('kitchenMode') || 'kds'
  );
  const [kitchenPaperWidthInput, setKitchenPaperWidthInput] = useState<'80mm' | '58mm'>((settings as any)?.kitchenPaperWidth || '80mm');
  const [autoPrintKitchenTicketInput, setAutoPrintKitchenTicketInput] = useState<boolean>(
    (settings as any)?.autoPrintKitchenTicket !== undefined ? (settings as any).autoPrintKitchenTicket : true
  );
  const [allowCashierPosInput, setAllowCashierPosInput] = useState<boolean>(
    (settings as any)?.allowCashierPos !== undefined ? (settings as any).allowCashierPos : (localStorage.getItem('allowCashierPos') === 'false' ? false : true)
  );
  const [allowCashierCreditApprovalInput, setAllowCashierCreditApprovalInput] = useState<boolean>(
    (settings as any)?.allowCashierCreditApproval !== undefined ? (settings as any).allowCashierCreditApproval : (localStorage.getItem('allowCashierCreditApproval') === 'false' ? false : true)
  );

  useEffect(() => {
    setRateInput(exchangeRate.toString());
    setPagoMovilBancoInput(settings?.pagoMovilBanco || 'Banesco');
    setPagoMovilPhoneInput(settings?.pagoMovilPhone || '0412-1234567');
    setPagoMovilIdInput(settings?.pagoMovilId || 'V-12345678');
    setZelleEmailInput(settings?.zelleEmail || 'pagos@bistroflow.com');
    setZelleNameInput(settings?.zelleName || 'BistroFlow SL');
    setWhatsappPhoneInput(settings?.whatsappPhone || '+584121234567');
    setRestaurantNameInput(settings?.restaurantName || 'BistroFlow');
    setLogoUrlInput((settings as any)?.logoUrl || '');
    setSloganInput((settings as any)?.slogan || (settings as any)?.tagline || 'SISTEMA GASTRONÓMICO & POS');
    setRestaurantPhoneInput(settings?.restaurantPhone || '+584121234567');
    setRestaurantAddressInput(settings?.restaurantAddress || 'Caracas, Venezuela');
    setDeliveryEnabledInput(settings?.deliveryEnabled !== undefined ? settings?.deliveryEnabled : true);
    setMinDeliveryOrderEnabledInput((settings as any)?.minDeliveryOrderEnabled !== undefined ? (settings as any).minDeliveryOrderEnabled : false);
    setMinDeliveryOrderAmountInput((settings as any)?.minDeliveryOrderAmount !== undefined ? Number((settings as any).minDeliveryOrderAmount) : 10);
    setPickupEnabledInput(settings?.pickupEnabled !== undefined ? settings?.pickupEnabled : true);
    setDeliveryZonesInput(settings?.deliveryZones && settings.deliveryZones.length > 0 ? settings.deliveryZones : DEFAULT_DELIVERY_ZONES);
    setQrOrderingEnabledInput(settings?.qrOrderingEnabled !== undefined ? settings?.qrOrderingEnabled : true);
    setServiceChargeEnabledInput(settings?.serviceChargeEnabled !== undefined ? settings?.serviceChargeEnabled : true);
    setServiceChargePercentInput(settings?.serviceChargePercent !== undefined ? settings?.serviceChargePercent : 10);
    setCloseDineInOnPaymentReportInput(settings?.closeDineInOnPaymentReport !== undefined ? settings?.closeDineInOnPaymentReport : false);
    setRequirePhotoForShiftInput(settings?.requirePhotoForShift !== undefined ? settings?.requirePhotoForShift : true);
    setStoreStatusInput(settings?.storeStatus || 'auto');
    setBreakfastStartInput((settings as any)?.breakfastStart || '06:00');
    setBreakfastEndInput((settings as any)?.breakfastEnd || '09:00');
    setLunchStartInput((settings as any)?.lunchStart || '11:00');
    setLunchEndInput((settings as any)?.lunchEnd || '15:00');
    setDinnerStartInput((settings as any)?.dinnerStart || '18:00');
    setDinnerEndInput((settings as any)?.dinnerEnd || '23:00');
    setSchedulesInput(settings?.schedules || {
      monday: { open: '08:00', close: '22:00', closed: false },
      tuesday: { open: '08:00', close: '22:00', closed: false },
      wednesday: { open: '08:00', close: '22:00', closed: false },
      thursday: { open: '08:00', close: '22:00', closed: false },
      friday: { open: '08:00', close: '23:00', closed: false },
      saturday: { open: '08:00', close: '23:00', closed: false },
      sunday: { open: '09:00', close: '21:00', closed: false }
    });
    setSuggestedTipsEnabledInput(settings?.suggestedTipsEnabled !== undefined ? settings?.suggestedTipsEnabled : true);
    setDefaultTipPercentInput(settings?.defaultTipPercent !== undefined ? settings?.defaultTipPercent : 10);
    setKdsWarningMinutesInput(settings?.kdsWarningMinutes !== undefined ? settings?.kdsWarningMinutes : 8);
    setKdsCriticalMinutesInput(settings?.kdsCriticalMinutes !== undefined ? settings?.kdsCriticalMinutes : 15);
    setKdsWarningColorInput((settings?.kdsWarningColor as any) || 'amber');
    setKdsCriticalColorInput((settings?.kdsCriticalColor as any) || 'rose');
    setAuto86EnabledInput(settings?.auto86Enabled !== undefined ? settings?.auto86Enabled : true);
    setCoursePacingEnabledInput(settings?.coursePacingEnabled !== undefined ? settings?.coursePacingEnabled : true);
    setSeatOrderingEnabledInput(settings?.seatOrderingEnabled !== undefined ? settings?.seatOrderingEnabled : true);
    setFeedbackEnabledInput(settings?.feedbackEnabled !== undefined ? settings?.feedbackEnabled : true);
    setKitchenModeInput((settings as any)?.kitchenMode || 'kds');
    setKitchenPaperWidthInput((settings as any)?.kitchenPaperWidth || '80mm');
    setAutoPrintKitchenTicketInput((settings as any)?.autoPrintKitchenTicket !== undefined ? (settings as any).autoPrintKitchenTicket : true);
    setAllowCashierPosInput((settings as any)?.allowCashierPos !== undefined ? (settings as any).allowCashierPos : true);
    setAllowCashierCreditApprovalInput((settings as any)?.allowCashierCreditApproval !== undefined ? (settings as any).allowCashierCreditApproval : true);
    setCreditEnabledInput(settings?.creditEnabled !== undefined ? settings.creditEnabled : false);
    if (settings?.paymentMethodsList && Array.isArray(settings.paymentMethodsList) && settings.paymentMethodsList.length > 0) {
      setPaymentMethodsListInput(settings.paymentMethodsList);
    }
  }, [exchangeRate, settings]);

  const handleSaveOperationsSettings = async () => {
    try {
      localStorage.setItem('kitchenMode', kitchenModeInput);
      localStorage.setItem('allowCashierPos', String(allowCashierPosInput));
      localStorage.setItem('allowCashierCreditApproval', String(allowCashierCreditApprovalInput));

      await setDoc(doc(db, 'settings', 'general'), {
        suggestedTipsEnabled: suggestedTipsEnabledInput,
        defaultTipPercent: Number(defaultTipPercentInput),
        kdsWarningMinutes: Number(kdsWarningMinutesInput),
        kdsCriticalMinutes: Number(kdsCriticalMinutesInput),
        kdsWarningColor: kdsWarningColorInput,
        kdsCriticalColor: kdsCriticalColorInput,
        auto86Enabled: auto86EnabledInput,
        coursePacingEnabled: coursePacingEnabledInput,
        seatOrderingEnabled: seatOrderingEnabledInput,
        feedbackEnabled: feedbackEnabledInput,
        kitchenMode: kitchenModeInput,
        kitchenPaperWidth: kitchenPaperWidthInput,
        autoPrintKitchenTicket: autoPrintKitchenTicketInput,
        allowCashierPos: allowCashierPosInput,
        allowCashierCreditApproval: allowCashierCreditApprovalInput
      }, { merge: true });

      window.dispatchEvent(new Event('settings_updated'));
      window.dispatchEvent(new Event('storage'));

      await logAction('system', currentUser?.name || 'Administrador', 'Actualizó configuración de Operaciones & KDS', `Modo Cocina: ${kitchenModeInput === 'direct_print' ? 'Impresión Directa' : 'KDS Pantalla'} | Cajero POS: ${allowCashierPosInput ? 'Habilitado' : 'Deshabilitado'} | Ancho Papel: ${kitchenPaperWidthInput}`);
      playSuccessSound();
      alert('⚡ Configuración de Operaciones & Cocina guardada correctamente');
    } catch (err) {
      console.error(err);
      playErrorSound();
      alert('Error guardando configuración de Operaciones & Cocina');
    }
  };

  // MENU LOGIC
  const handleEditMenu = (item: MenuItem) => {
    if (item.isCombo || item.category === 'Combos & Promos') {
      setEditingComboId(item.id);
      setIsCreatingCombo(true);
      setComboData({
        name: item.name,
        price: item.price,
        description: item.description || '',
        image: item.image || '',
        items: item.comboItems || []
      });
      return;
    }
    setEditingItem(item); setIsCreatingMenu(false);
    setMenuData({ 
      name: item.name, 
      price: item.price, 
      category: item.category, 
      image: item.image || '',
      recipe: item.recipe || [],
      scheduleType: item.scheduleType || 'always',
      availableFrom: item.availableFrom || '',
      availableTo: item.availableTo || '',
      alerts: item.alerts || [],
      extras: item.extras || [],
      variants: item.variants || [],
      preparationTime: item.preparationTime || ''
    });
    setModalRecipeIngId('');
    setModalRecipeQty('1');
    setVariantFormName('');
    setVariantFormPrice('');
    setVariantFormIngId('');
    setVariantFormQty('1');
  };
  const handleSaveMenu = async () => {
    if (isSavingMenu) return;
    setIsSavingMenu(true);
    try {
      const payload = {
        name: menuData.name,
        price: Number(menuData.price),
        category: menuData.category,
        image: menuData.image,
        recipe: menuData.recipe || [],
        scheduleType: menuData.scheduleType || 'always',
        availableFrom: menuData.availableFrom || '',
        availableTo: menuData.availableTo || '',
        alerts: menuData.alerts || [],
        extras: menuData.extras || [],
        variants: (menuData.variants || []).filter(v => v.name && v.name.trim() !== ''),
        preparationTime: menuData.preparationTime !== '' ? Number(menuData.preparationTime) : null
      };
      if (isCreatingMenu) {
        await addDoc(collection(db, 'menu'), payload);
        await logAction('system', currentUser?.name || 'Administrador', 'Agregó plato al menú', `Plato: ${payload.name} - Precio: $${payload.price.toFixed(2)}`);
      } else if (editingItem) {
        await updateDoc(doc(db, 'menu', editingItem.id), payload);
        await logAction('system', currentUser?.name || 'Administrador', 'Editó plato del menú', `Plato: ${payload.name} - Precio anterior: $${editingItem.price.toFixed(2)} -> Nuevo: $${payload.price.toFixed(2)}`);
      }
      setEditingItem(null); setIsCreatingMenu(false);
    } catch (err) { alert('Error guardando los cambios'); } finally { setIsSavingMenu(false); }
  };

  const handleSaveCombo = async () => {
    if (!comboData.name.trim()) {
      playErrorSound();
      return;
    }
    const finalPrice = typeof comboData.price === 'number' ? comboData.price : parseFloat(String(comboData.price)) || 0;
    if (finalPrice <= 0) {
      playErrorSound();
      return;
    }
    if (!comboData.items || comboData.items.length === 0) {
      playErrorSound();
      return;
    }

    try {
      const aggregatedRecipe: { ingredientId: string; quantity: number }[] = [];
      const itemNamesWithQty: string[] = [];

      comboData.items.forEach(ci => {
        const menuItem = menu.find(m => m.id === ci.menuItemId);
        itemNamesWithQty.push(`${ci.quantity > 1 ? `${ci.quantity}x ` : ''}${ci.name}`);

        if (menuItem && menuItem.recipe && Array.isArray(menuItem.recipe)) {
          menuItem.recipe.forEach(r => {
            const qtyNeeded = r.quantity * (ci.quantity || 1);
            const existing = aggregatedRecipe.find(ar => ar.ingredientId === r.ingredientId);
            if (existing) {
              existing.quantity += qtyNeeded;
            } else {
              aggregatedRecipe.push({ ingredientId: r.ingredientId, quantity: qtyNeeded });
            }
          });
        }
      });

      const payload = {
        name: comboData.name.trim(),
        price: finalPrice,
        category: 'Combos & Promos',
        image: comboData.image || 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=600',
        description: comboData.description || `Combo compuesto por: ${itemNamesWithQty.join(', ')}`,
        recipe: aggregatedRecipe,
        scheduleType: 'always',
        alerts: itemNamesWithQty,
        preparationTime: 15,
        isCombo: true,
        comboItems: comboData.items
      };

      if (editingComboId) {
        await updateDoc(doc(db, 'menu', editingComboId), payload);
        await logAction('system', currentUser?.name || 'Administrador', 'Actualizó Combo de Menú', `Combo: ${payload.name} - Ítems: ${itemNamesWithQty.join(', ')} - Precio: $${finalPrice.toFixed(2)}`);
      } else {
        await addDoc(collection(db, 'menu'), payload);
        await logAction('system', currentUser?.name || 'Administrador', 'Creó Combo de Menú', `Combo: ${payload.name} - Ítems: ${itemNamesWithQty.join(', ')} - Precio: $${finalPrice.toFixed(2)}`);
      }

      setIsCreatingCombo(false);
      setEditingComboId(null);
      setComboData({ name: '', price: '', description: '', image: '', items: [] });
      setSelectedMenuIdToAdd('');
      setSelectedQtyToAdd(1);
      playSuccessSound();
    } catch (err) {
      console.error(err);
      playErrorSound();
    }
  };

  const handleDeleteMenu = (id: string) => {
    const item = menu.find(m => m.id === id);
    if (item) {
      setItemToDelete(item);
    }
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;
    setIsDeletingItem(true);
    try {
      await deleteDoc(doc(db, 'menu', itemToDelete.id));
      await logAction('system', currentUser?.name || 'Administrador', 'Eliminó plato del menú', `Plato: ${itemToDelete.name}`);
      playSuccessSound();
      setItemToDelete(null);
    } catch (err) {
      console.error('Error deleting menu item:', err);
      playErrorSound();
    } finally {
      setIsDeletingItem(false);
    }
  };

  // TABLE LOGIC
  const handleEditTable = (t: Table) => {
    setEditingTable(t); setIsCreatingTable(false);
    setTableData({ number: t.number, capacity: t.capacity, status: t.status });
  };
  const handleSaveTable = async () => {
    if (isSavingTable) return;
    setIsSavingTable(true);
    try {
      if (isCreatingTable) {
        await addDoc(collection(db, 'tables'), { ...tableData, capacity: Number(tableData.capacity) });
        await logAction('system', currentUser?.name || 'Administrador', 'Agregó mesa', `Mesa ${tableData.number} - Capacidad: ${tableData.capacity}`);
      } else if (editingTable) {
        await updateDoc(doc(db, 'tables', editingTable.id), { ...tableData, capacity: Number(tableData.capacity) });
        await logAction('system', currentUser?.name || 'Administrador', 'Editó mesa', `Mesa anterior: ${editingTable.number} -> Nueva: ${tableData.number} (Capacidad: ${tableData.capacity})`);
      }
      setEditingTable(null); setIsCreatingTable(false);
    } catch (err) { alert('Error guardando mesa'); } finally { setIsSavingTable(false); }
  };
  const handleDeleteTable = async (id: string) => {
    const table = tables.find(t => t.id === id);
    const tableNum = table ? table.number : 'Desconocido';
    if(confirm('¿Eliminar esta mesa?')) {
      await deleteDoc(doc(db, 'tables', id));
      await logAction('system', currentUser?.name || 'Administrador', 'Eliminó mesa', `Mesa ${tableNum}`);
    }
  };

  // PROMOTIONS LOGIC
  const handleEditPromo = (promo: Promotion) => {
    setEditingPromo(promo); setIsCreatingPromo(false);
    setPromoData({
      title: promo.title,
      subtitle: promo.subtitle,
      description: promo.description,
      badge: promo.badge,
      image: promo.image || '',
      actionText: promo.actionText || '',
      filterCategory: promo.filterCategory || 'All',
      filterQuery: promo.filterQuery || '',
      badgeBg: promo.badgeBg || 'bg-red-100',
      badgeText: promo.badgeText || 'text-red-800'
    });
  };
  const handleSavePromo = async () => {
    if (isSavingPromo) return;
    setIsSavingPromo(true);
    try {
      if (isCreatingPromo) {
        await addDoc(collection(db, 'promotions'), promoData);
        await logAction('system', currentUser?.name || 'Administrador', 'Creó promoción', `Título: ${promoData.title}`);
      } else if (editingPromo) {
        await updateDoc(doc(db, 'promotions', editingPromo.id), promoData);
        await logAction('system', currentUser?.name || 'Administrador', 'Editó promoción', `Título: ${promoData.title}`);
      }
      setEditingPromo(null); setIsCreatingPromo(false);
    } catch (err) { alert('Error guardando la promoción'); } finally { setIsSavingPromo(false); }
  };
  const handleDeletePromo = async (id: string) => {
    const promo = promotions.find(p => p.id === id);
    const promoTitle = promo ? promo.title : 'Desconocido';
    if(confirm('¿Eliminar esta promoción?')) {
      await deleteDoc(doc(db, 'promotions', id));
      await logAction('system', currentUser?.name || 'Administrador', 'Eliminó promoción', `Título: ${promoTitle}`);
    }
  };

  // Delivery Zone logic handlers
  const handleOpenCreateZone = () => {
    setZoneForm({ name: '', priceUSD: '2.50', estimatedTime: '20-35 min', coveredAreas: '' });
    setEditingZone(null);
    setIsCreatingZone(true);
  };

  const handleOpenEditZone = (z: DeliveryZone) => {
    setEditingZone(z);
    setZoneForm({
      name: z.name,
      priceUSD: String(z.priceUSD),
      estimatedTime: z.estimatedTime || '20-35 min',
      coveredAreas: z.coveredAreas || ''
    });
    setIsCreatingZone(true);
  };

  const handleSaveZoneModal = () => {
    if (!zoneForm.name.trim()) return;
    const priceNum = parseFloat(zoneForm.priceUSD) || 0;
    if (editingZone) {
      setDeliveryZonesInput(prev => prev.map(z => z.id === editingZone.id ? {
        ...z,
        name: zoneForm.name.trim(),
        priceUSD: priceNum,
        estimatedTime: zoneForm.estimatedTime.trim(),
        coveredAreas: zoneForm.coveredAreas.trim()
      } : z));
    } else {
      const newZone: DeliveryZone = {
        id: 'zone-' + Date.now(),
        name: zoneForm.name.trim(),
        priceUSD: priceNum,
        estimatedTime: zoneForm.estimatedTime.trim(),
        coveredAreas: zoneForm.coveredAreas.trim()
      };
      setDeliveryZonesInput(prev => [...prev, newZone]);
    }
    setEditingZone(null);
    setIsCreatingZone(false);
  };

  const handleDeleteZone = (id: string) => {
    if (confirm('¿Eliminar esta zona de delivery?')) {
      setDeliveryZonesInput(prev => prev.filter(z => z.id !== id));
    }
  };

  // GENERAL LOGIC
  const handleSaveGeneralSettings = async () => {
    try {
      await setDoc(doc(db, 'settings', 'general'), {
        restaurantName: restaurantNameInput,
        logoUrl: logoUrlInput,
        slogan: sloganInput,
        restaurantPhone: restaurantPhoneInput,
        restaurantAddress: restaurantAddressInput,
        deliveryEnabled: deliveryEnabledInput,
        minDeliveryOrderEnabled: minDeliveryOrderEnabledInput,
        minDeliveryOrderAmount: Number(minDeliveryOrderAmountInput) || 0,
        pickupEnabled: pickupEnabledInput,
        deliveryZones: deliveryZonesInput,
        qrOrderingEnabled: qrOrderingEnabledInput,
        serviceChargeEnabled: serviceChargeEnabledInput,
        serviceChargePercent: Number(serviceChargePercentInput),
        closeDineInOnPaymentReport: closeDineInOnPaymentReportInput,
        requirePhotoForShift: requirePhotoForShiftInput,
        storeStatus: storeStatusInput,
        breakfastStart: breakfastStartInput,
        breakfastEnd: breakfastEndInput,
        lunchStart: lunchStartInput,
        lunchEnd: lunchEndInput,
        dinnerStart: dinnerStartInput,
        dinnerEnd: dinnerEndInput
      }, { merge: true });

      const changes: string[] = [];
      if (settings?.restaurantName !== restaurantNameInput) changes.push(`Nombre: ${restaurantNameInput}`);
      if (settings?.storeStatus !== storeStatusInput) changes.push(`Estado: ${storeStatusInput}`);
      if (settings?.qrOrderingEnabled !== qrOrderingEnabledInput) changes.push(`Autoservicio QR: ${qrOrderingEnabledInput ? 'SÍ' : 'NO'}`);
      if (settings?.closeDineInOnPaymentReport !== closeDineInOnPaymentReportInput) changes.push(`Liberación de Mesas: ${closeDineInOnPaymentReportInput ? 'ACTIVO' : 'INACTIVO'}`);
      if (settings?.requirePhotoForShift !== requirePhotoForShiftInput) changes.push(`Foto en Fichaje: ${requirePhotoForShiftInput ? 'SÍ' : 'NO'}`);
      if (settings?.deliveryEnabled !== deliveryEnabledInput) changes.push(`Delivery: ${deliveryEnabledInput ? 'SÍ' : 'NO'}`);
      if (settings?.pickupEnabled !== pickupEnabledInput) changes.push(`Pickup: ${pickupEnabledInput ? 'SÍ' : 'NO'}`);
      if (settings?.serviceChargeEnabled !== serviceChargeEnabledInput) changes.push(`Servicio: ${serviceChargeEnabledInput ? `${serviceChargePercentInput}%` : 'NO'}`);
      if (settings?.serviceChargePercent !== serviceChargePercentInput && serviceChargeEnabledInput) changes.push(`Servicio %: ${serviceChargePercentInput}%`);

      const detailsStr = changes.length > 0 ? changes.join(' | ') : `Nombre: ${restaurantNameInput} | Estado: ${storeStatusInput}`;

      await logAction('system', currentUser?.name || 'Administrador', 'Actualizó configuración general', detailsStr);
      alert('Configuración general actualizada correctamente');
    } catch(err) { alert('Error guardando configuración general'); }
  };

  const handleToggleMethod = (id: string) => {
    setPaymentMethodsListInput(prev => prev.map(m => {
      if (m.id === id) {
        const nextEnabled = !m.enabled;
        if (id === 'credito') {
          setCreditEnabledInput(nextEnabled);
        }
        return { ...m, enabled: nextEnabled };
      }
      return m;
    }));
  };

  const handleToggleCreditMaster = () => {
    const nextVal = !creditEnabledInput;
    setCreditEnabledInput(nextVal);
    setPaymentMethodsListInput(prev => prev.map(m => {
      if (m.id === 'credito') {
        return { ...m, enabled: nextVal };
      }
      return m;
    }));
  };

  const handleOpenEditMethod = (m: PaymentMethodItem) => {
    setEditingMethod(m);
    setIsCreatingMethod(false);
    setMethodForm({
      id: m.id,
      name: m.name,
      type: m.type,
      currency: m.currency,
      enabled: m.enabled,
      requiresReference: m.requiresReference,
      bank: m.details?.bank || '',
      phone: m.details?.phone || '',
      idNumber: m.details?.idNumber || '',
      email: m.details?.email || '',
      accountHolder: m.details?.accountHolder || '',
      notes: m.details?.notes || ''
    });
  };

  const handleOpenCreateMethod = () => {
    setEditingMethod(null);
    setIsCreatingMethod(true);
    setMethodForm({
      id: `custom_${Date.now()}`,
      name: '',
      type: 'custom',
      currency: 'USD',
      enabled: true,
      requiresReference: true,
      bank: '',
      phone: '',
      idNumber: '',
      email: '',
      accountHolder: '',
      notes: ''
    });
  };

  const handleSaveMethodForm = () => {
    if (!methodForm.name.trim()) {
      alert('Por favor ingresa un nombre para el método de pago');
      return;
    }

    const updatedItem: PaymentMethodItem = {
      id: editingMethod ? editingMethod.id : (methodForm.id || `custom_${Date.now()}`),
      name: methodForm.name.trim(),
      type: methodForm.type,
      currency: methodForm.currency,
      enabled: methodForm.enabled,
      requiresReference: methodForm.requiresReference,
      details: {
        bank: methodForm.bank.trim() || undefined,
        phone: methodForm.phone.trim() || undefined,
        idNumber: methodForm.idNumber.trim() || undefined,
        email: methodForm.email.trim() || undefined,
        accountHolder: methodForm.accountHolder.trim() || undefined,
        notes: methodForm.notes.trim() || undefined
      }
    };

    if (updatedItem.id === 'pago_movil') {
      if (updatedItem.details?.bank) setPagoMovilBancoInput(updatedItem.details.bank);
      if (updatedItem.details?.phone) setPagoMovilPhoneInput(updatedItem.details.phone);
      if (updatedItem.details?.idNumber) setPagoMovilIdInput(updatedItem.details.idNumber);
    } else if (updatedItem.id === 'zelle') {
      if (updatedItem.details?.email) setZelleEmailInput(updatedItem.details.email);
      if (updatedItem.details?.accountHolder) setZelleNameInput(updatedItem.details.accountHolder);
    } else if (updatedItem.id === 'credito') {
      setCreditEnabledInput(updatedItem.enabled);
    }

    setPaymentMethodsListInput(prev => {
      const exists = prev.some(m => m.id === updatedItem.id);
      if (exists) {
        return prev.map(m => m.id === updatedItem.id ? updatedItem : m);
      }
      return [...prev, updatedItem];
    });

    setEditingMethod(null);
    setIsCreatingMethod(false);
    playSuccessSound();
  };

  const handleDeleteMethod = (id: string) => {
    if (['pago_movil', 'punto', 'zelle', 'divisa', 'credito'].includes(id)) {
      alert('Los métodos de pago base del sistema no pueden eliminarse, pero puedes desactivarlos con el botón de alternancia.');
      return;
    }
    if (confirm('¿Estás seguro de eliminar este método de pago personalizado?')) {
      setPaymentMethodsListInput(prev => prev.filter(m => m.id !== id));
      playClickSound();
    }
  };

  const handleSavePaymentSettings = async () => {
    try {
      const finalizedList = paymentMethodsListInput.map(m => {
        if (m.id === 'credito') {
          return { ...m, enabled: creditEnabledInput };
        }
        return m;
      });

      await setDoc(doc(db, 'settings', 'general'), {
        exchangeRate: Number(rateInput),
        creditEnabled: creditEnabledInput,
        paymentMethodsList: finalizedList,
        pagoMovilBanco: pagoMovilBancoInput,
        pagoMovilPhone: pagoMovilPhoneInput,
        pagoMovilId: pagoMovilIdInput,
        zelleEmail: zelleEmailInput,
        zelleName: zelleNameInput,
        whatsappPhone: whatsappPhoneInput
      }, { merge: true });

      setPaymentMethodsListInput(finalizedList);

      const changes: string[] = [];
      changes.push(`Crédito: ${creditEnabledInput ? 'ACTIVADO' : 'DESACTIVADO'}`);
      changes.push(`Métodos Activos: ${finalizedList.filter(m => m.enabled).map(m => m.name).join(', ')}`);

      await logAction('system', currentUser?.name || 'Administrador', 'Actualizó métodos de pago y crédito', changes.join(' | '));
      playSuccessSound();
      alert('¡Configuración de métodos de pago y crédito guardada con éxito!');
    } catch(err) { 
      playErrorSound();
      alert('Error guardando métodos de pago'); 
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col space-y-6 pb-20 min-h-full px-2 sm:px-4">
      <header className="mb-6 border-b border-slate-200/80 pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 inline-block mb-1.5">
            Administración del Establecimiento
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">Configuración del Local</h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">Gestiona el menú, mesas, promociones, moneda y configuración general.</p>
        </div>
        {activeTab === 'menu' && !editingItem && !isCreatingMenu && !isCreatingCombo && (
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button 
              onClick={() => { 
                setIsCreatingMenu(true); 
                setMenuData({ 
                  name: '', 
                  price: 0, 
                  category: 'Sandwiches', 
                  image: '', 
                  recipe: [],
                  scheduleType: 'always', 
                  availableFrom: '', 
                  availableTo: '', 
                  alerts: [], 
                  extras: [], 
                  variants: [], 
                  preparationTime: '' 
                }); 
                setVariantFormName('');
                setVariantFormPrice('');
                setVariantFormIngId('');
                setVariantFormQty('1');
              }} 
              className="flex items-center gap-2 px-4 py-2.5 bg-black hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Plus size={16} />
              <span>Nuevo Platillo</span>
            </button>
            <button 
              onClick={() => { 
                setEditingComboId(null);
                setComboData({ name: '', price: '', description: '', image: '', items: [] });
                setSelectedMenuIdToAdd('');
                setSelectedQtyToAdd(1);
                setIsCreatingCombo(true); 
              }} 
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Sparkles size={16} />
              <span>Crear Combo Especial</span>
            </button>
            <button 
              onClick={() => setIsSeedingConfirmOpen(true)}
              disabled={isSeedingQSandwich}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSeedingQSandwich ? <span className="animate-spin">⏳</span> : <span className="font-black">🥪</span>}
              <span>{isSeedingQSandwich ? 'Cargando Menú...' : 'Cargar Menú Q\' Sandwich'}</span>
            </button>
          </div>
        )}
      </header>

      {/* Sub-menu Navegación de Ajustes - Se oculta durante la edición para máxima comodidad */}
      {!editingItem && !isCreatingMenu && !isCreatingCombo && (
        <div className="w-full mb-8">
          <div className="bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth">
          {[
            { id: 'menu', label: 'Menú & Platos', icon: UtensilsCrossed, badge: menu.length },
            { id: 'tables', label: 'Mesas & QR', icon: Grid, badge: tables.length },
            { id: 'promotions', label: 'Promociones', icon: Sparkles, badge: promotions.length },
            { id: 'general', label: 'General & Local', icon: Building2 },
            { id: 'payments', label: 'Moneda & Pagos', icon: DollarSign, highlight: true },
            { id: 'toast_pos', label: 'Operaciones & KDS', icon: Zap },
            { id: 'notifications', label: 'Alertas & Sistema', icon: Bell }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id as any);
                  playClickSound();
                }}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10 scale-[1.01]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 bg-transparent'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-white' : tab.highlight ? 'text-emerald-600' : 'text-slate-400'} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600'
                  }`}>
                    {tab.badge}
                  </span>
                )}
                {tab.highlight && !isActive && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>
      )}

      {activeTab === 'menu' && (
        <>
          {!editingItem && !isCreatingMenu && !isCreatingCombo && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {menu.map(item => {
              const isStarred = isBookmarked(item.id, 'menu');
              return (
                <div key={item.id} className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 flex flex-col group/card">
                  <div className="aspect-video bg-slate-50 rounded-2xl mb-4 overflow-hidden relative group">
                    <img src={item.image || 'https://via.placeholder.com/300x200'} alt={item.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                    
                    {/* Star Bookmark button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBookmark({
                          id: item.id,
                          type: 'menu',
                          name: item.name,
                          details: `$${item.price.toFixed(2)} | ${item.category}`
                        });
                      }}
                      className={`absolute top-3 right-3 p-2 rounded-xl transition-all z-20 ${
                        isStarred 
                          ? 'bg-amber-100 text-amber-500 shadow-md scale-100' 
                          : 'bg-black/40 text-white/80 hover:text-amber-300 hover:bg-black/60 opacity-0 group-hover/card:opacity-100'
                      }`}
                      title={isStarred ? "Quitar de Marcadores" : "Añadir a Marcadores"}
                    >
                      <Star size={14} className={isStarred ? "fill-amber-400 text-amber-500" : ""} />
                    </button>
                  
                  {/* Active tags badges */}
                  {Array.isArray(item.alerts) && item.alerts.length > 0 && (
                    <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1 z-10">
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
                          'Chef-Special': '⭐ Recomend.'
                        };
                        return (
                          <span key={tagId} className="px-1.5 py-0.5 bg-black/85 backdrop-blur text-white text-[9px] font-extrabold rounded-lg uppercase tracking-wider">
                            {labelMap[tagId] || tagId}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg leading-tight">{item.name}</h3>
                  <span className="font-bold text-slate-900 bg-slate-50 px-2 rounded-lg">${item.price.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between mb-6">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{item.category}</span>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full flex items-center gap-1">
                    ⏰ {item.scheduleType === 'breakfast' ? 'Desayuno' : 
                         item.scheduleType === 'lunch' ? 'Almuerzo' : 
                         item.scheduleType === 'dinner' ? 'Cena' : 
                         item.scheduleType === 'custom' ? `${item.availableFrom || '08:00'} - ${item.availableTo || '22:00'}` : 
                         'Siempre'}
                  </span>
                </div>

                {/* Dynamic Inventory / Stock Alert Badge */}
                {(() => {
                  const stockAlert = getMenuItemStockAlert(item, ingredients);
                  if (stockAlert.status === 'out_of_stock') {
                    return (
                      <div className="mb-4 px-3 py-1.5 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                        <span>{stockAlert.text}</span>
                      </div>
                    );
                  }
                  if (stockAlert.status === 'low_stock') {
                    return (
                      <div className="mb-4 px-3 py-1.5 bg-amber-50 border border-amber-100 text-amber-700 text-xs font-bold rounded-xl flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span>{stockAlert.text}</span>
                      </div>
                    );
                  }
                  if (stockAlert.portions !== null) {
                    return (
                      <div className="mb-4 px-3 py-1.5 bg-emerald-50/60 border border-emerald-100/40 text-emerald-700 text-xs font-bold rounded-xl flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>{stockAlert.text}</span>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Variantes Preview Badge */}
                {item.variants && item.variants.length > 0 && (
                  <div className="mb-3 p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-xl">
                    <div className="text-[10px] font-black uppercase text-indigo-800 tracking-wider flex items-center justify-between mb-1.5">
                      <span className="flex items-center gap-1">📏 {item.variants.length} Variantes</span>
                      <span className="text-[9px] font-bold text-indigo-600">
                        ${Math.min(...item.variants.map(v => v.price)).toFixed(2)} - ${Math.max(...item.variants.map(v => v.price)).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {item.variants.map(v => (
                        <span key={v.id} className="text-[9px] font-bold bg-white text-indigo-900 px-2 py-0.5 rounded-md border border-indigo-200/60 shadow-2xs">
                          {v.name}: <span className="font-mono text-indigo-700">${v.price.toFixed(2)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 border-t border-slate-50 pt-4">
                  <button type="button" onClick={() => handleEditMenu(item)} className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-[10px] uppercase tracking-widest py-3 rounded-xl transition-colors cursor-pointer">Editar</button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteMenu(item.id); }} className="w-12 flex items-center justify-center bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-xl transition-colors cursor-pointer" title="Eliminar"><Trash2 size={16} /></button>
                </div>
              </div>
            );
          })}
          </div>
          )}
        </>
      )}

      {activeTab === 'tables' && (
        <>
          {/* TOP CONTROL CARD FOR QR ORDERS */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-[32px] p-6 mb-8 border border-slate-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-2xl shrink-0 ${qrOrderingEnabledInput ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-800 text-slate-400'}`}>
                📱
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base sm:text-lg text-white">Pedidos Directos por Código QR en Mesas</h3>
                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${qrOrderingEnabledInput ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                    {qrOrderingEnabledInput ? '🟢 HABILITADO' : '🔴 DESACTIVADO'}
                  </span>
                </div>
                <p className="text-slate-300 text-xs mt-1 max-w-2xl leading-relaxed">
                  {qrOrderingEnabledInput 
                    ? 'Los comensales pueden escanear el código QR de su mesa y enviar pedidos directamente a cocina.' 
                    : 'La opción de pedir por QR está apagada. Al escanear el QR, los clientes verán el menú únicamente como catálogo informativo.'}
                </p>
              </div>
            </div>

            <button 
              onClick={async () => {
                const newValue = !qrOrderingEnabledInput;
                setQrOrderingEnabledInput(newValue);
                try {
                  await setDoc(doc(db, 'settings', 'restaurant'), { qrOrderingEnabled: newValue }, { merge: true });
                  await logAction('system', currentUser?.name || 'Administrador', 'Cambió estado de Pedidos QR', `Nuevos pedidos QR: ${newValue ? 'HABILITADO' : 'DESACTIVADO'}`);
                  playSuccessSound();
                  alert(newValue ? '✅ Pedidos Directos por QR Activados para todas las mesas' : '⏸️ Pedidos por QR Desactivados (Modo Carta Informativa)');
                } catch (e) {
                  console.error('Error updating qrOrderingEnabled:', e);
                  playErrorSound();
                  alert('Error al actualizar la opción de QR.');
                }
              }}
              className={`px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all duration-200 shrink-0 shadow-lg flex items-center gap-2 cursor-pointer ${
                qrOrderingEnabledInput 
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-emerald-500/20' 
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
              }`}
            >
              <QrCode size={16} />
              <span>{qrOrderingEnabledInput ? 'Desactivar Pedidos QR' : 'Activar Pedidos QR'}</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-slate-500 text-xs">Administra tus mesas y haz clic en sus códigos QR para imprimirlos o compartirlos con tus clientes.</p>
            </div>
            <button onClick={() => { setIsCreatingTable(true); setTableData({ number: '', capacity: 4, status: 'free' }); }} className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-2xl font-bold text-sm shadow-lg shadow-black/10 hover:scale-105 transition-all self-end sm:self-auto cursor-pointer">
              <Plus size={18} /> Nueva Mesa
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {tables.map(t => {
              const qrUrl = `${window.location.origin}/?table=${t.id}`;
              const qrImageUrl = getQRCodeUrl(qrUrl, 200);
              return (
                <div key={t.id} className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 text-center flex flex-col items-center justify-between">
                  <div className="flex flex-col items-center w-full">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mb-3 font-bold text-lg">
                      🍽️
                    </div>
                    <h3 className="font-black text-xl mb-1">Mesa {t.number}</h3>
                    <span className="text-xs font-semibold text-slate-400 mb-4">Capacidad: {t.capacity} comensales</span>
                  </div>
                  
                  {/* Interactive QR Preview Card */}
                  <div 
                    onClick={() => setSelectedQRTable(t)}
                    className="w-full bg-slate-50 hover:bg-slate-100 p-4 rounded-2xl border border-slate-100/60 cursor-pointer transition-all duration-200 group flex flex-col items-center gap-2 mb-4"
                    title="Click para expandir, copiar o imprimir QR"
                  >
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/40 shadow-sm mix-blend-multiply group-hover:scale-[1.03] transition-transform">
                      <img 
                        src={qrImageUrl} 
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = getFallbackQRCodeUrl(qrUrl, 200);
                        }}
                        alt={`QR Mesa ${t.number}`} 
                        className="w-24 h-24 object-contain"
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-black transition-colors">
                      Escanear / Ver QR 🔍
                    </span>
                  </div>

                  <div className="flex w-full gap-2 border-t border-slate-100 pt-4 mt-auto">
                    <button onClick={() => handleEditTable(t)} className="flex-1 text-slate-500 hover:text-black font-bold text-[10px] uppercase tracking-widest bg-slate-50 hover:bg-slate-100 py-3 rounded-xl transition-all">Editar</button>
                    <button onClick={() => setSelectedQRTable(t)} className="px-3 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all" title="Imprimir o compartir QR">
                      <QrCode size={16} />
                    </button>
                    <button onClick={() => handleDeleteTable(t.id)} className="text-rose-500 bg-rose-50 hover:bg-rose-100 p-3 rounded-xl transition-all"><Trash2 size={16}/></button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {activeTab === 'general' && (
        <div className="w-full max-w-4xl mx-auto bg-white rounded-[32px] p-6 sm:p-10 border border-slate-200/80 shadow-sm">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2">🏢 Información del Restaurante</h3>
          <div className="space-y-6">
            {/* LOGO & BRAND IDENTITY */}
            <div className="p-4 bg-slate-50/70 border border-slate-100 rounded-2xl flex flex-col sm:flex-row items-center gap-4">
              <div className="w-16 h-16 rounded-full border-2 border-slate-200 bg-white overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
                {logoUrlInput ? (
                  <img src={logoUrlInput} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#EEF4FF] text-blue-600 font-black text-lg flex items-center justify-center">
                    {(restaurantNameInput || 'B').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 w-full space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Logo / Imagen del Negocio (URL)
                </label>
                <input 
                  type="text" 
                  value={logoUrlInput}
                  onChange={e => setLogoUrlInput(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-black font-medium transition-colors text-xs"
                  placeholder="https://ejemplo.com/logo.png"
                />
                <span className="text-[10px] text-slate-400 block">
                  Aparece en el círculo superior del menú lateral. Si está vacío se mostrará la inicial con estilo circular.
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Nombre del Restaurante</label>
              <input 
                type="text" 
                value={restaurantNameInput}
                onChange={e => setRestaurantNameInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium transition-colors text-sm"
                placeholder="Nombre comercial"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Este nombre aparecerá en el encabezado del menú lateral y la web de clientes.</span>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Eslogan o Subtítulo del Menú</label>
              <input 
                type="text" 
                value={sloganInput}
                onChange={e => setSloganInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium transition-colors text-sm"
                placeholder="Ej. TU PARADA DE SABOR EN LA VÍA... o SISTEMA GASTRONÓMICO & POS"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Texto secundario que se muestra debajo del nombre en el menú lateral.</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Teléfono de Atención</label>
                <input 
                  type="text" 
                  value={restaurantPhoneInput}
                  onChange={e => setRestaurantPhoneInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium transition-colors text-sm"
                  placeholder="Ej. +58 412-1234567"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Ubicación / Dirección</label>
                <input 
                  type="text" 
                  value={restaurantAddressInput}
                  onChange={e => setRestaurantAddressInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium transition-colors text-sm"
                  placeholder="Ej. Las Mercedes, Caracas"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100">
              <h4 className="font-bold text-sm text-slate-800 mb-4 uppercase tracking-wider text-[10px]">Servicios Disponibles para Clientes</h4>
              <div className="space-y-4">
                {/* Kitchen Sticker Printer & Auto-Print Toggle */}
                <div className="flex flex-col gap-4 p-5 bg-amber-50/70 rounded-2xl border border-amber-200/80">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm text-slate-950 flex items-center gap-2">
                        <Printer size={16} className="text-amber-600" />
                        Impresora de Stickers y Comandas (Cocina)
                      </span>
                      <span className="text-xs text-slate-600 block text-wrap max-w-md mt-0.5">
                        Envía automáticamente comandas y stickers de empaque al recibir un pedido en la Pantalla de Cocina (KDS).
                      </span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => {
                        const next = localStorage.getItem('kds_auto_print_enabled') !== 'true';
                        localStorage.setItem('kds_auto_print_enabled', String(next));
                        // Force re-render in UI
                        setDeliveryEnabledInput(prev => prev); // trigger state update
                        playClickSound();
                      }}
                      className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none shrink-0 ${
                        localStorage.getItem('kds_auto_print_enabled') === 'true' ? 'bg-amber-600' : 'bg-slate-300'
                      }`}
                    >
                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                        localStorage.getItem('kds_auto_print_enabled') === 'true' ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  <div className="pt-3 border-t border-amber-200/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div className="text-slate-600">
                      <strong>Estado:</strong> {localStorage.getItem('kds_auto_print_enabled') === 'true' ? '🟢 Auto-impresión Activada' : '⚪ Impresión Manual'}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const printWindow = window.open('', '_blank');
                        if (printWindow) {
                          printWindow.document.write(`
                            <html>
                              <head>
                                <title>Prueba de Sticker - BistroFlow</title>
                                <style>
                                  body { font-family: monospace; font-size: 12px; margin: 0; padding: 10px; width: 280px; text-align: center; }
                                  .box { border: 2px solid #000; padding: 8px; border-radius: 6px; }
                                  .title { font-weight: bold; font-size: 14px; text-transform: uppercase; background: #000; color: #fff; padding: 2px; }
                                </style>
                              </head>
                              <body onload="window.print(); setTimeout(() => window.close(), 1000);">
                                <div class="box">
                                  <div class="title">*** PRUEBA STICKER (${autoPrintFormatInput.toUpperCase()}) ***</div>
                                  <p><b>MESA T1 / COCINA</b></p>
                                  <hr/>
                                  <p><b>1x Hamburguesa Smash Doble</b><br/><small>⚠️ Sin Cebolla, Extra Queso</small></p>
                                  <hr/>
                                  <p><small>Impresora de Cocina OK - BistroFlow</small></p>
                                </div>
                              </body>
                            </html>
                          `);
                        }
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Printer size={13} />
                      <span>Probar Impresión de Sticker</span>
                    </button>
                  </div>

                  {/* Auto-print format selection */}
                  <div className="bg-white/80 p-3.5 rounded-xl border border-amber-200/60 space-y-2">
                    <label className="text-xs font-bold text-slate-800 block">
                      Formato de Impresión Automática:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          localStorage.setItem('kds_auto_print_format', 'comanda');
                          setAutoPrintFormatInput('comanda');
                          playClickSound();
                        }}
                        className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                          autoPrintFormatInput === 'comanda'
                            ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border shrink-0 mt-0.5 flex items-center justify-center ${
                          autoPrintFormatInput === 'comanda' ? 'border-white bg-white' : 'border-slate-300'
                        }`}>
                          {autoPrintFormatInput === 'comanda' && <div className="w-2 h-2 rounded-full bg-amber-600" />}
                        </div>
                        <div>
                          <div className="font-bold text-xs leading-tight">📄 Comanda General</div>
                          <div className={`text-[10px] mt-0.5 ${autoPrintFormatInput === 'comanda' ? 'text-amber-100' : 'text-slate-500'}`}>
                            Un solo ticket con el resumen completo del pedido.
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          localStorage.setItem('kds_auto_print_format', 'individual_stickers');
                          setAutoPrintFormatInput('individual_stickers');
                          playClickSound();
                        }}
                        className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                          autoPrintFormatInput === 'individual_stickers'
                            ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border shrink-0 mt-0.5 flex items-center justify-center ${
                          autoPrintFormatInput === 'individual_stickers' ? 'border-white bg-white' : 'border-slate-300'
                        }`}>
                          {autoPrintFormatInput === 'individual_stickers' && <div className="w-2 h-2 rounded-full bg-amber-600" />}
                        </div>
                        <div>
                          <div className="font-bold text-xs leading-tight">🏷️ Stickers por Ítem</div>
                          <div className={`text-[10px] mt-0.5 ${autoPrintFormatInput === 'individual_stickers' ? 'text-amber-100' : 'text-slate-500'}`}>
                            Un sticker térmico independiente por cada producto/vaso.
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Delivery Toggle & Zones Management */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100/80">
                    <div>
                      <span className="font-bold text-sm text-slate-950 block">Habilitar Pedidos Delivery</span>
                      <span className="text-xs text-slate-400 block">Permitir a los clientes pedir con entrega a domicilio.</span>
                    </div>
                    <button 
                      onClick={() => setDeliveryEnabledInput(!deliveryEnabledInput)}
                      className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${deliveryEnabledInput ? 'bg-black' : 'bg-slate-200'}`}
                    >
                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${deliveryEnabledInput ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* Delivery Minimum Order Rule Toggle & Amount */}
                  {deliveryEnabledInput && (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-sm text-slate-950 flex items-center gap-1.5">
                            <ShoppingBag size={16} className="text-blue-600" />
                            Regla de Pedido Mínimo para Delivery
                          </span>
                          <span className="text-xs text-slate-500 block mt-0.5">
                            Exigir un monto mínimo en productos para permitir pedidos con entrega a domicilio.
                          </span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setMinDeliveryOrderEnabledInput(!minDeliveryOrderEnabledInput)}
                          className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none shrink-0 cursor-pointer ${
                            minDeliveryOrderEnabledInput ? 'bg-blue-600' : 'bg-slate-300'
                          }`}
                        >
                          <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                            minDeliveryOrderEnabledInput ? 'translate-x-6' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>

                      {minDeliveryOrderEnabledInput && (
                        <div className="pt-3 border-t border-slate-200/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="flex-1">
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                              Monto Mínimo de Pedido (USD)
                            </label>
                            <span className="text-[11px] text-slate-400 block">
                              Los clientes no podrán avanzar al pago por delivery si el subtotal de productos es inferior a este monto.
                            </span>
                          </div>
                          <div className="relative w-full sm:w-44 shrink-0">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">$</span>
                            <input 
                              type="number"
                              min="0"
                              step="0.5"
                              value={minDeliveryOrderAmountInput}
                              onChange={e => setMinDeliveryOrderAmountInput(Math.max(0, parseFloat(e.target.value) || 0))}
                              className="w-full pl-8 pr-12 py-2.5 bg-white border border-slate-200 rounded-xl font-black text-sm text-slate-900 outline-none focus:border-blue-600 transition-colors shadow-xs"
                              placeholder="10.00"
                            />
                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">USD</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {deliveryEnabledInput && (
                    <div className="p-5 bg-amber-50/40 rounded-2xl border border-amber-200/80 space-y-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div>
                          <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                            <MapPin size={16} className="text-amber-600" /> Zonas de Delivery y Tarifas de Envío
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Establece el costo del despacho según la zona o distancia del cliente.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenCreateZone}
                          className="px-3.5 py-2 bg-black hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer"
                        >
                          <Plus size={14} /> Agregar Zona
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {deliveryZonesInput.map(zone => (
                          <div key={zone.id} className="p-3.5 bg-white rounded-xl border border-amber-200/60 flex justify-between items-start gap-3 shadow-xs">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-xs text-slate-900">{zone.name}</span>
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-950 font-black text-[11px] rounded-md">
                                  ${zone.priceUSD.toFixed(2)} USD
                                </span>
                              </div>
                              {zone.estimatedTime && (
                                <div className="text-[11px] text-slate-600 font-medium">
                                  ⏱️ Tiempo estimado: <span className="font-bold text-slate-800">{zone.estimatedTime}</span>
                                </div>
                              )}
                              {zone.coveredAreas && (
                                <div className="text-[11px] text-slate-500 leading-snug">
                                  📍 <span className="italic">{zone.coveredAreas}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenEditZone(zone)}
                                className="p-1.5 text-slate-500 hover:text-black hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Editar zona"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteZone(zone.id)}
                                className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Eliminar zona"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Pickup Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100/80">
                  <div>
                    <span className="font-bold text-sm text-slate-950 block">Habilitar Pedidos para Llevar (Pickup)</span>
                    <span className="text-xs text-slate-400 block">Permitir a los clientes pedir y retirar directamente en el local.</span>
                  </div>
                  <button 
                    onClick={() => setPickupEnabledInput(!pickupEnabledInput)}
                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${pickupEnabledInput ? 'bg-black' : 'bg-slate-200'}`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${pickupEnabledInput ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* QR Self-Service Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100/80">
                  <div>
                    <span className="font-bold text-sm text-slate-950 block">Habilitar Opción de Pedir en Autoservicio QR</span>
                    <span className="text-xs text-slate-400 block text-wrap max-w-md">Permitir a los clientes enviar pedidos directamente a cocina desde la mesa usando el código QR. Si se desactiva, podrán escanear el QR solo para ver la carta/menú como catálogo interactivo.</span>
                  </div>
                  <button 
                    onClick={() => setQrOrderingEnabledInput(!qrOrderingEnabledInput)}
                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${qrOrderingEnabledInput ? 'bg-black' : 'bg-slate-200'}`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${qrOrderingEnabledInput ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Close Dine-In Table on Payment Report Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100/80">
                  <div>
                    <span className="font-bold text-sm text-slate-950 block">Liberación Inmediata de Mesas en Sitio</span>
                    <span className="text-xs text-slate-400 block text-wrap max-w-md">Si se activa, la mesa se libera y la sesión se cierra automáticamente al registrar un Pago Móvil o Zelle, sin requerir aprobación del cajero.</span>
                  </div>
                  <button 
                    onClick={() => setCloseDineInOnPaymentReportInput(!closeDineInOnPaymentReportInput)}
                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${closeDineInOnPaymentReportInput ? 'bg-black' : 'bg-slate-200'}`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${closeDineInOnPaymentReportInput ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
                
                {/* Require Photo for Clock In Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100/80">
                  <div>
                    <span className="font-bold text-sm text-slate-950 block">Exigir Foto en Fichaje</span>
                    <span className="text-xs text-slate-400 block text-wrap max-w-md">Si se activa, los empleados deberán tomarse una foto obligatoriamente al abrir o cerrar su turno. Si se desactiva, podrán fichar solo con el PIN.</span>
                  </div>
                  <button 
                    onClick={() => setRequirePhotoForShiftInput(!requirePhotoForShiftInput)}
                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${requirePhotoForShiftInput ? 'bg-black' : 'bg-slate-200'}`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${requirePhotoForShiftInput ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Service Charge Toggle & Percent */}
                <div className="flex flex-col gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100/80">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm text-slate-950 block">Cargo de Servicio a la Mesa / Propina Sugerida</span>
                      <span className="text-xs text-slate-400 block">Activar o desactivar el cobro automático de servicio a la mesa.</span>
                    </div>
                    <button 
                      onClick={() => setServiceChargeEnabledInput(!serviceChargeEnabledInput)}
                      className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${serviceChargeEnabledInput ? 'bg-black' : 'bg-slate-200'}`}
                    >
                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${serviceChargeEnabledInput ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {serviceChargeEnabledInput && (
                    <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600">Porcentaje de Cargo / Propina Sugerida (%)</span>
                      <div className="relative w-28">
                        <input 
                          type="number" 
                          min="0"
                          max="100"
                          value={serviceChargePercentInput}
                          onChange={e => setServiceChargePercentInput(Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-right text-sm font-bold focus:border-black outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* HORARIOS DEL MENÚ DE COMIDAS */}
                <div className="flex flex-col gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100/80 mt-6">
                  <div>
                    <h4 className="font-bold text-sm text-slate-950 flex items-center gap-2">🥣 Horarios de Bloques de Menú</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Define los rangos de horas para el Desayuno, Almuerzo y Cena. Los platos que asocies a estos bloques se activarán y desactivarán automáticamente en la tienda de clientes según estas horas.
                    </p>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-200">
                    {/* Breakfast Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-base">☕</span>
                        <span className="font-bold text-xs text-slate-800">Menú de Desayuno</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          type="time" 
                          value={breakfastStartInput} 
                          onChange={(e) => setBreakfastStartInput(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 px-2.5 text-xs font-bold outline-none focus:border-black"
                        />
                        <span className="text-[10px] font-bold text-slate-400">a</span>
                        <input 
                          type="time" 
                          value={breakfastEndInput} 
                          onChange={(e) => setBreakfastEndInput(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 px-2.5 text-xs font-bold outline-none focus:border-black"
                        />
                      </div>
                    </div>

                    {/* Lunch Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🍔</span>
                        <span className="font-bold text-xs text-slate-800">Menú de Almuerzo</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          type="time" 
                          value={lunchStartInput} 
                          onChange={(e) => setLunchStartInput(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 px-2.5 text-xs font-bold outline-none focus:border-black"
                        />
                        <span className="text-[10px] font-bold text-slate-400">a</span>
                        <input 
                          type="time" 
                          value={lunchEndInput} 
                          onChange={(e) => setLunchEndInput(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 px-2.5 text-xs font-bold outline-none focus:border-black"
                        />
                      </div>
                    </div>

                    {/* Dinner Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🍕</span>
                        <span className="font-bold text-xs text-slate-800">Menú de Cena</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          type="time" 
                          value={dinnerStartInput} 
                          onChange={(e) => setDinnerStartInput(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 px-2.5 text-xs font-bold outline-none focus:border-black"
                        />
                        <span className="text-[10px] font-bold text-slate-400">a</span>
                        <input 
                          type="time" 
                          value={dinnerEndInput} 
                          onChange={(e) => setDinnerEndInput(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 px-2.5 text-xs font-bold outline-none focus:border-black"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ESTADO DE OPERACIÓN DE LA TIENDA ONLINE */}
                <div className="flex flex-col gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100/80 mt-6">
                  <div>
                    <h4 className="font-bold text-sm text-slate-950 flex items-center gap-2">⏰ Estado de Operación (Tienda Online)</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Controla el estado de la tienda online. Al estar en modo <strong>Automático</strong>, la tienda abrirá y cerrará según los <strong>Horarios de Bloques de Menú</strong>.
                    </p>
                  </div>

                  {/* Manual Override Store Status */}
                  <div className="space-y-2 pt-4 border-t border-slate-200">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Estado de Operación</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['auto', 'open', 'closed'] as const).map((status) => (
                        <button
                          type="button"
                          key={status}
                          onClick={() => setStoreStatusInput(status)}
                          className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                            storeStatusInput === status
                              ? 'bg-black border-black text-white'
                              : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                          }`}
                        >
                          {status === 'auto' ? '🔄 Automático' : status === 'open' ? '🟢 Abierto' : '🔴 Cerrado'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <button onClick={handleSaveGeneralSettings} className="w-full bg-black text-white p-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform">
              <Save size={18} /> Guardar Configuración General
            </button>
          </div>
        </div>
      )}

      {activeTab === 'toast_pos' && (
        <div className="w-full max-w-4xl mx-auto bg-white rounded-[32px] p-6 sm:p-10 border border-slate-200/80 shadow-sm space-y-8">
          <div className="border-b border-slate-100 pb-5">
            <span className="text-[10px] uppercase font-black tracking-widest text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100 inline-block mb-1.5">
              Ajustes de Operaciones y Cocina
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              <span>⚡ Módulo de Operaciones Avanzadas & KDS</span>
            </h3>
            <p className="text-slate-500 text-xs sm:text-sm mt-1">
              Personaliza los umbrales de alerta de cocina, colores de tarjetas, propinas sugeridas, auto 86-ing y encuestas de satisfacción.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* CARD 0: MODO DE TRABAJO DE COCINA E IMPRESIÓN DIRECTA */}
            <div className="md:col-span-2 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 shadow-md space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 font-extrabold text-xl">
                    🍳
                  </div>
                  <div>
                    <h4 className="font-extrabold text-white text-base">Modo de Operación de Cocina</h4>
                    <p className="text-slate-300 text-xs">Configura si la cocina dispone de pantalla KDS o si se opera mediante Impresión Térmica Directa.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Selector Modo KDS vs Impresión Directa */}
                <div className="bg-slate-800/90 border border-slate-700/80 p-4 rounded-2xl space-y-3">
                  <label className="text-xs font-black uppercase tracking-wider text-amber-400 block">
                    Modo de Trabajo de Cocina
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setKitchenModeInput('kds')}
                      className={`p-3 rounded-xl text-xs font-black transition-all flex flex-col items-center gap-1.5 border cursor-pointer ${
                        kitchenModeInput === 'kds'
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                          : 'bg-slate-900/80 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      <span className="text-base">📺</span>
                      <span>Pantalla KDS</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setKitchenModeInput('direct_print')}
                      className={`p-3 rounded-xl text-xs font-black transition-all flex flex-col items-center gap-1.5 border cursor-pointer ${
                        kitchenModeInput === 'direct_print'
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                          : 'bg-slate-900/80 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      <span className="text-base">🖨️</span>
                      <span>Impresión Directa</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    {kitchenModeInput === 'direct_print' 
                      ? '⚡ Sin pantalla en cocina. Al enviar comandas desde Caja/Mesero se marcarán como enviadas y se imprimirá el ticket térmico.'
                      : '📺 Pantalla interactiva en cocina. Las comandas entran a la cola KDS para avance manual de platos.'}
                  </p>
                </div>

                {/* Formato de Impresora Térmica */}
                <div className="bg-slate-800/90 border border-slate-700/80 p-4 rounded-2xl space-y-3">
                  <label className="text-xs font-black uppercase tracking-wider text-amber-400 block">
                    Formato de Impresión Térmica
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setKitchenPaperWidthInput('80mm')}
                      className={`p-2.5 rounded-xl text-xs font-black transition-all border cursor-pointer ${
                        kitchenPaperWidthInput === '80mm'
                          ? 'bg-white text-slate-950 border-white shadow-sm'
                          : 'bg-slate-900/80 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      80mm (Estándar POS)
                    </button>
                    <button
                      type="button"
                      onClick={() => setKitchenPaperWidthInput('58mm')}
                      className={`p-2.5 rounded-xl text-xs font-black transition-all border cursor-pointer ${
                        kitchenPaperWidthInput === '58mm'
                          ? 'bg-white text-slate-950 border-white shadow-sm'
                          : 'bg-slate-900/80 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      58mm (Compacto)
                    </button>
                  </div>

                  <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoPrintKitchenTicketInput}
                      onChange={(e) => setAutoPrintKitchenTicketInput(e.target.checked)}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-200">
                      Imprimir comanda de cocina automáticamente al enviar pedido
                    </span>
                  </label>
                </div>

                {/* Acceso de Cajero al Terminal POS / Enviar Comandas */}
                <div className="bg-slate-800/90 border border-slate-700/80 p-4 rounded-2xl md:col-span-2 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-black uppercase tracking-wider text-amber-400 block">
                      Acceso de Cajero a Terminal POS & Envío de Comandas
                    </label>
                    <p className="text-[11px] text-slate-300 leading-tight">
                      Permite que el cajero pueda acceder al Terminal POS para armar pedidos y enviar comandas directamente (recomendado si la cocina opera sin pantalla KDS o la caja toma pedidos).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAllowCashierPosInput(!allowCashierPosInput)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                      allowCashierPosInput ? 'bg-amber-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        allowCashierPosInput ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Validación y Aprobación de Crédito por Cajero vs Administrador */}
                <div className="bg-slate-800/90 border border-slate-700/80 p-4 rounded-2xl md:col-span-2 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-black uppercase tracking-wider text-amber-400 block">
                      Aprobación de Créditos (Fiado CRM) por Cajero
                    </label>
                    <p className="text-[11px] text-slate-300 leading-tight">
                      Si está HABILITADO, el cajero puede aprobar o rechazar pedidos a crédito en Control de Caja. Si está DESACTIVADO, solo el Administrador puede autorizar créditos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAllowCashierCreditApprovalInput(!allowCashierCreditApprovalInput)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                      allowCashierCreditApprovalInput ? 'bg-amber-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        allowCashierCreditApprovalInput ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* CARD 1: KDS UMBRALES Y COLORES */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-3xl p-6 space-y-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-200 flex items-center justify-center text-amber-700 font-extrabold text-lg">
                  🔥
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">Alertas y Colores KDS (Cocina)</h4>
                  <p className="text-[11px] text-slate-500">Tiempos máximos antes de marcar comanda como atrasada.</p>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                {/* Warning Minutes & Color */}
                <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">🟡 Alerta de Advertencia (Warning)</label>
                    <span className="text-xs font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
                      {kdsWarningMinutesInput} min
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block mb-1">Minutos:</span>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={kdsWarningMinutesInput}
                        onChange={(e) => setKdsWarningMinutesInput(Math.max(1, Number(e.target.value)))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-extrabold outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block mb-1">Color Borde:</span>
                      <select
                        value={kdsWarningColorInput}
                        onChange={(e: any) => setKdsWarningColorInput(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold outline-none focus:border-amber-500"
                      >
                        <option value="amber">🟡 Ámbar</option>
                        <option value="yellow">🟨 Amarillo</option>
                        <option value="orange">🟧 Naranja</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Critical Minutes & Color */}
                <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">🔴 Alerta Crítica (Urgente)</label>
                    <span className="text-xs font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100">
                      {kdsCriticalMinutesInput} min
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block mb-1">Minutos:</span>
                      <input
                        type="number"
                        min="2"
                        max="120"
                        value={kdsCriticalMinutesInput}
                        onChange={(e) => setKdsCriticalMinutesInput(Math.max(2, Number(e.target.value)))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-extrabold outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block mb-1">Color Borde:</span>
                      <select
                        value={kdsCriticalColorInput}
                        onChange={(e: any) => setKdsCriticalColorInput(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold outline-none focus:border-rose-500"
                      >
                        <option value="rose">🔴 Rosa / Carmesí</option>
                        <option value="red">🩸 Rojo Oscuro</option>
                        <option value="purple">🟣 Púrpura</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 2: PROPINAS SUGERIDAS */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-3xl p-6 space-y-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-200 flex items-center justify-center text-emerald-700 font-extrabold text-lg">
                  💡
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">Propinas Sugeridas</h4>
                  <p className="text-[11px] text-slate-500">Módulos de propina automática en cobros de caja e hilos de cliente.</p>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-4">
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">Habilitar Propina Sugerida</span>
                    <span className="text-[10px] text-slate-400">Muestra selector de 10%, 15%, 20% al procesar pagos.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSuggestedTipsEnabledInput(!suggestedTipsEnabledInput)}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      suggestedTipsEnabledInput ? 'bg-black' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                      suggestedTipsEnabledInput ? 'left-6' : 'left-0.5'
                    }`} />
                  </button>
                </div>

                {suggestedTipsEnabledInput && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2">
                    <label className="text-xs font-bold text-slate-800 block">Porcentaje Predeterminado (%)</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[10, 15, 20].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setDefaultTipPercentInput(pct)}
                          className={`py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                            defaultTipPercentInput === pct
                              ? 'bg-black text-white border-black'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* CARD 3: AUTO-86ING & INVENTARIO */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-3xl p-6 space-y-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-200 flex items-center justify-center text-indigo-700 font-extrabold text-lg">
                  🚫
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">Agotado Automático (Auto-86)</h4>
                  <p className="text-[11px] text-slate-500">Bloqueo inmediato de platos al agotarse stock en inventario.</p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-4">
                <div>
                  <span className="font-bold text-xs text-slate-900 block">Auto-86 al Agotar Insumo</span>
                  <span className="text-[10px] text-slate-400">Inhabilita automáticamente la adición de items sin existencias.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAuto86EnabledInput(!auto86EnabledInput)}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    auto86EnabledInput ? 'bg-black' : 'bg-slate-300'
                  }`}
                >
                  <span className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                    auto86EnabledInput ? 'left-6' : 'left-0.5'
                  }`} />
                </button>
              </div>
            </div>

            {/* CARD 4: PASES POR TIEMPOS Y ASENTAMIENTOS */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-3xl p-6 space-y-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-200 flex items-center justify-center text-purple-700 font-extrabold text-lg">
                  🍽️
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">Pase por Tiempos & Asientos</h4>
                  <p className="text-[11px] text-slate-500">Organización fina por tiempos y comensales en comandas de mesonero.</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-4">
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">Marcha por Tiempos (Courses)</span>
                    <span className="text-[10px] text-slate-400">Permite pausar/marchar Entradas, Fuertes y Postres.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCoursePacingEnabledInput(!coursePacingEnabledInput)}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      coursePacingEnabledInput ? 'bg-black' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                      coursePacingEnabledInput ? 'left-6' : 'left-0.5'
                    }`} />
                  </button>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-4">
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">Registro por Asiento (Seats)</span>
                    <span className="text-[10px] text-slate-400">Asigna comensal (Asiento 1, 2...) y habilita división en 1-click.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSeatOrderingEnabledInput(!seatOrderingEnabledInput)}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      seatOrderingEnabledInput ? 'bg-black' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                      seatOrderingEnabledInput ? 'left-6' : 'left-0.5'
                    }`} />
                  </button>
                </div>
              </div>
            </div>

            {/* CARD 5: ENCUESTAS DE SATISFACCIÓN */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-3xl p-6 space-y-5 md:col-span-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-200 flex items-center justify-center text-amber-700 font-extrabold text-lg">
                  ⭐
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">Encuestas de Satisfacción Express (Feedback)</h4>
                  <p className="text-[11px] text-slate-500">Muestra modal de calificación en estrellas y comentarios al procesar cobro.</p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-4">
                <div>
                  <span className="font-bold text-xs text-slate-900 block">Habilitar Encuesta al Cliente en Cierre</span>
                  <span className="text-[10px] text-slate-400">Guarda feedback de comensal en tiempo real y alimenta el panel de reputación Admin.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFeedbackEnabledInput(!feedbackEnabledInput)}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    feedbackEnabledInput ? 'bg-black' : 'bg-slate-300'
                  }`}
                >
                  <span className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                    feedbackEnabledInput ? 'left-6' : 'left-0.5'
                  }`} />
                </button>
              </div>
            </div>

          </div>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={handleSaveOperationsSettings}
              className="w-full bg-black hover:bg-slate-800 text-white p-4 rounded-2xl font-black text-sm shadow-lg flex items-center justify-center gap-2 hover:scale-[1.01] transition-transform cursor-pointer"
            >
              <Save size={18} /> Guardar Configuración de Operaciones & KDS
            </button>
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="w-full max-w-5xl mx-auto bg-white rounded-[32px] p-6 sm:p-10 border border-slate-200/80 shadow-sm space-y-8">
          {/* pyDolarVenezuela 3-Rates Selector & Live Rates Dashboard */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] uppercase font-black tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 inline-block mb-1">
                  pyDolarVenezuela • Tasas Oficiales y de Mercado
                </span>
                <h3 className="text-xl font-black text-slate-900">Monitor y Selector de Moneda Activa</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  La moneda y tasa seleccionadas aquí por la Administración rigen todos los precios, cuentas y comandas del restaurante.
                </p>
              </div>
            </div>
            <CurrencySelector variant="expanded" editable={currentUser?.role === 'admin'} />
          </div>

          {/* Admin Quick Direct Exchange Rate Box */}
          <div className="bg-gradient-to-br from-slate-50 to-emerald-50/40 rounded-3xl p-6 border border-slate-200/80">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Control Exclusivo de Administración
                  </span>
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    <Lock size={12} className="text-slate-400" /> Solo Admin en Ajustes
                  </span>
                </div>
                <h4 className="text-base font-black text-slate-900 mt-1">
                  Fijar Tasa de Cambio Manual ({activeCurrency} a Bolívares)
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Tasa que se utilizará en todo el sistema (Caja, Mesas, Delivery, Web Clientes) para calcular los montos en Bolívares (VES).
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <div className="relative flex-1 sm:w-44">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Bs.</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={rateInput}
                    onChange={(e) => setRateInput(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:border-black outline-none shadow-2xs"
                    placeholder="Ej: 874.73"
                  />
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const val = parseFloat(rateInput);
                    if (!isNaN(val) && val > 0) {
                      await updateManualRate(activeCurrency, val);
                      playSuccessSound();
                      alert(`✅ Tasa de cambio de ${activeCurrency} fijada a Bs. ${val.toFixed(2)} exitosamente.`);
                    } else {
                      alert('Ingresa una tasa numérica válida mayor a 0');
                    }
                  }}
                  className="px-4 py-2.5 bg-black hover:bg-slate-800 text-white rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer shrink-0"
                >
                  Guardar Tasa
                </button>
              </div>
            </div>
          </div>

          {/* Master Control: Función de Crédito */}
          <div className={`p-6 rounded-3xl border transition-all ${
            creditEnabledInput 
              ? 'bg-gradient-to-br from-emerald-50/80 to-teal-50/50 border-emerald-200 shadow-xs' 
              : 'bg-slate-50/80 border-slate-200'
          }`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  creditEnabledInput ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-200 text-slate-500'
                }`}>
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-black text-slate-900">
                      Función de Crédito (Cuentas por Cobrar a Clientes)
                    </h4>
                    <span className={`text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full ${
                      creditEnabledInput 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {creditEnabledInput ? '● ACTIVADO' : '○ DESACTIVADO'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                    {creditEnabledInput ? (
                      <>
                        <strong className="text-emerald-900">La función de crédito está habilitada.</strong> El método de pago <strong>&quot;Crédito&quot;</strong> aparecerá como opción activa en comandas y cobros, permitiendo cargar consumos a la cuenta de clientes registrados en el CRM con autorización de PIN.
                      </>
                    ) : (
                      <>
                        <strong className="text-slate-700">La función de crédito está completamente desactivada.</strong> El método de pago <strong>&quot;Crédito&quot;</strong> no aparecerá en ninguna pantalla de cobro ni comanda. Ningún empleado podrá enviar cuentas a crédito mientras esta opción esté inactiva.
                      </>
                    )}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleCreditMaster}
                className={`px-5 py-2.5 rounded-2xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer self-end sm:self-center shrink-0 ${
                  creditEnabledInput
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-md shadow-emerald-700/20'
                    : 'bg-slate-800 hover:bg-black text-white shadow-md'
                }`}
              >
                {creditEnabledInput ? (
                  <>
                    <ToggleRight size={18} />
                    Desactivar Crédito
                  </>
                ) : (
                  <>
                    <ToggleLeft size={18} />
                    Activar Crédito
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Métodos de Pago Activos, Editables y Agregables */}
          <div className="border-t border-slate-100 pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 bg-slate-100 px-3 py-1 rounded-full inline-block mb-1">
                  Configuración Operativa
                </span>
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <CreditCard size={20} className="text-indigo-600" />
                  Métodos de Pago Disponibles
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Puedes activar, desactivar, editar datos bancarios o agregar nuevos métodos personalizados (Zinli, Binance Pay, Punto de Venta, etc.).
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenCreateMethod}
                className="flex items-center gap-2 px-5 py-2.5 bg-black hover:bg-slate-800 text-white rounded-2xl font-black text-xs shadow-md shadow-black/10 hover:scale-105 transition-all cursor-pointer"
              >
                <Plus size={16} />
                Agregar Nuevo Método
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paymentMethodsListInput.map(method => {
                const isSpecialCredit = method.id === 'credito';
                const isCreditBlocked = isSpecialCredit && !creditEnabledInput;

                return (
                  <div 
                    key={method.id} 
                    className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
                      !method.enabled || isCreditBlocked
                        ? 'bg-slate-50/60 border-slate-200/60 opacity-60' 
                        : 'bg-white border-slate-200/90 shadow-xs hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm ${
                            method.type === 'pago_movil' ? 'bg-emerald-50 text-emerald-700' :
                            method.type === 'punto' ? 'bg-blue-50 text-blue-700' :
                            method.type === 'zelle' ? 'bg-indigo-50 text-indigo-700' :
                            method.type === 'credito' ? 'bg-amber-50 text-amber-700' :
                            'bg-purple-50 text-purple-700'
                          }`}>
                            {method.type === 'pago_movil' ? <Smartphone size={18} /> :
                             method.type === 'punto' ? <CreditCard size={18} /> :
                             method.type === 'zelle' ? <DollarSign size={18} /> :
                             method.type === 'credito' ? <ShieldCheck size={18} /> :
                             <Globe size={18} />}
                          </div>
                          <div>
                            <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                              {method.name}
                              {isSpecialCredit && (
                                <span className="text-[9px] bg-amber-100 text-amber-800 font-black px-2 py-0.5 rounded-full uppercase">
                                  CRM / PIN
                                </span>
                              )}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">
                                Moneda: <strong className="text-slate-800">{method.currency}</strong>
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="text-[10px] font-medium text-slate-500">
                                {method.requiresReference ? 'Exige Nro. Ref' : 'Sin Ref obligatoria'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Switch toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleMethod(method.id)}
                          className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                            method.enabled && (!isSpecialCredit || creditEnabledInput)
                              ? 'bg-emerald-600'
                              : 'bg-slate-300'
                          }`}
                          title={method.enabled ? 'Desactivar método' : 'Activar método'}
                        >
                          <span 
                            className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                              method.enabled && (!isSpecialCredit || creditEnabledInput)
                                ? 'transform translate-x-5'
                                : ''
                            }`} 
                          />
                        </button>
                      </div>

                      {/* Details preview */}
                      <div className="py-3 text-xs space-y-1 text-slate-600">
                        {method.details?.bank && (
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase text-slate-400">Banco:</span>
                            <span className="font-bold text-slate-800">{method.details.bank}</span>
                          </div>
                        )}
                        {method.details?.phone && (
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase text-slate-400">Teléfono:</span>
                            <span className="font-mono font-bold text-slate-800">{method.details.phone}</span>
                          </div>
                        )}
                        {method.details?.idNumber && (
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase text-slate-400">Cédula / RIF:</span>
                            <span className="font-mono font-bold text-slate-800">{method.details.idNumber}</span>
                          </div>
                        )}
                        {method.details?.email && (
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase text-slate-400">Correo:</span>
                            <span className="font-mono font-bold text-slate-800">{method.details.email}</span>
                          </div>
                        )}
                        {method.details?.accountHolder && (
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase text-slate-400">Titular:</span>
                            <span className="font-bold text-slate-800">{method.details.accountHolder}</span>
                          </div>
                        )}
                        {method.details?.notes && (
                          <p className="text-[11px] text-slate-500 italic pt-1">
                            {method.details.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleOpenEditMethod(method)}
                        className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 size={13} />
                        Editar Datos
                      </button>
                      {!['pago_movil', 'punto', 'zelle', 'divisa', 'credito'].includes(method.id) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteMethod(method.id)}
                          className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 size={13} />
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Canal de Contacto WhatsApp */}
          <div className="border-t border-slate-100 pt-6">
            <h4 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
              <span>📱 Canal de Contacto y Enlace Directo</span>
            </h4>
            <div className="max-w-md">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                WhatsApp del Local (Formato Internacional con código de país)
              </label>
              <input 
                type="text" 
                value={whatsappPhoneInput}
                onChange={e => setWhatsappPhoneInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-mono font-medium text-sm transition-colors"
                placeholder="+584121234567"
              />
            </div>
          </div>

          {/* Action button */}
          <div className="pt-6 border-t border-slate-100">
            <button 
              type="button"
              onClick={handleSavePaymentSettings} 
              className="w-full bg-black hover:bg-slate-800 text-white p-4 rounded-2xl font-black text-sm shadow-lg flex items-center justify-center gap-2 hover:scale-[1.01] transition-transform cursor-pointer"
            >
              <Save size={18} /> Guardar Configuración de Métodos de Pago y Crédito
            </button>
          </div>

          {/* Modal para Crear / Editar Método de Pago */}
          <AnimatePresence>
            {(isCreatingMethod || editingMethod) && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-[32px] p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto space-y-6"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                        <CreditCard size={20} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-900">
                          {isCreatingMethod ? 'Nuevo Método de Pago' : `Editar: ${editingMethod?.name}`}
                        </h3>
                        <p className="text-xs text-slate-400">Configura nombre, moneda y credenciales de recepción.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setIsCreatingMethod(false); setEditingMethod(null); }}
                      className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="space-y-4 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                        Nombre del Método <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={methodForm.name}
                        onChange={e => setMethodForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Ej. Banesco Panamá, Zinli, Binance Pay USDT..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm font-bold text-slate-900 outline-none focus:border-black"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                          Moneda de Cobro
                        </label>
                        <select
                          value={methodForm.currency}
                          onChange={e => setMethodForm(prev => ({ ...prev, currency: e.target.value as any }))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs font-bold text-slate-800 outline-none focus:border-black"
                        >
                          <option value="USD">USD ($ - Dólar)</option>
                          <option value="Bs">Bs (VES - Bolívares)</option>
                          <option value="EUR">EUR (€ - Euro)</option>
                          <option value="USDT">USDT (₮ - Cripto Peg)</option>
                          <option value="any">Cualquiera / Mixta</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                          Tipo de Canal
                        </label>
                        <select
                          value={methodForm.type}
                          onChange={e => setMethodForm(prev => ({ ...prev, type: e.target.value as any }))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs font-bold text-slate-800 outline-none focus:border-black"
                        >
                          <option value="punto">Punto de Venta POS (Tarjeta)</option>
                          <option value="pago_movil">Pago Móvil</option>
                          <option value="zelle">Zelle / Transferencia Internacional</option>
                          <option value="divisa">Efectivo / Divisa</option>
                          <option value="credito">Crédito a Clientes (CRM)</option>
                          <option value="custom">Canal Personalizado / Cripto</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <input
                        type="checkbox"
                        id="chk_ref"
                        checked={methodForm.requiresReference}
                        onChange={e => setMethodForm(prev => ({ ...prev, requiresReference: e.target.checked }))}
                        className="w-4 h-4 rounded text-black focus:ring-0 cursor-pointer"
                      />
                      <label htmlFor="chk_ref" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                        Exigir número de referencia bancaria al procesar cobro
                      </label>
                    </div>

                    {/* Additional fields */}
                    <div className="space-y-3 pt-2">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Datos del Receptor (Opcionales)
                      </h4>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Banco / Plataforma</label>
                          <input
                            type="text"
                            value={methodForm.bank}
                            onChange={e => setMethodForm(prev => ({ ...prev, bank: e.target.value }))}
                            placeholder="Ej. Banesco, Mercantil, Binance"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium outline-none focus:border-black"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Teléfono</label>
                          <input
                            type="text"
                            value={methodForm.phone}
                            onChange={e => setMethodForm(prev => ({ ...prev, phone: e.target.value }))}
                            placeholder="Ej. 0412-1234567"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono font-medium outline-none focus:border-black"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Cédula / RIF / ID</label>
                          <input
                            type="text"
                            value={methodForm.idNumber}
                            onChange={e => setMethodForm(prev => ({ ...prev, idNumber: e.target.value }))}
                            placeholder="Ej. V-12345678 / J-12345678"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono font-medium outline-none focus:border-black"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Correo Electrónico</label>
                          <input
                            type="text"
                            value={methodForm.email}
                            onChange={e => setMethodForm(prev => ({ ...prev, email: e.target.value }))}
                            placeholder="Ej. pagos@midominio.com"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium outline-none focus:border-black"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Nombre del Titular</label>
                        <input
                          type="text"
                          value={methodForm.accountHolder}
                          onChange={e => setMethodForm(prev => ({ ...prev, accountHolder: e.target.value }))}
                          placeholder="Ej. Inversiones Bistro C.A."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium outline-none focus:border-black"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Instrucciones / Notas para el Mesero o Cliente</label>
                        <textarea
                          value={methodForm.notes}
                          onChange={e => setMethodForm(prev => ({ ...prev, notes: e.target.value }))}
                          rows={2}
                          placeholder="Ej. Solicitar comprobante digital y verificar titular antes de liberar la cuenta..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium outline-none focus:border-black resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => { setIsCreatingMethod(false); setEditingMethod(null); }}
                      className="px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveMethodForm}
                      className="px-6 py-2.5 rounded-2xl text-xs font-black bg-black hover:bg-slate-800 text-white shadow-md transition-all cursor-pointer"
                    >
                      Guardar Método
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {activeTab === 'promotions' && (
        <>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
            <div>
              <h3 className="font-bold text-lg">Banners Promocionales Activos</h3>
              <p className="text-xs text-slate-500">Estos banners se mostrarán en la página principal de tus clientes en un carrusel interactivo.</p>
            </div>
            <button 
              onClick={() => { 
                setIsCreatingPromo(true); 
                setPromoData({ 
                  title: '', 
                  subtitle: '', 
                  description: '', 
                  badge: '¡Oferta! ✨', 
                  image: '', 
                  actionText: 'Ordenar Ahora', 
                  filterCategory: 'All', 
                  filterQuery: '',
                  badgeBg: 'bg-red-100',
                  badgeText: 'text-red-800'
                }); 
              }} 
              className="flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-2xl font-bold text-sm shadow-lg shadow-black/10 hover:scale-105 transition-all self-end sm:self-auto"
            >
              <Plus size={18} /> Nueva Promoción
            </button>
          </div>

          {promotions.length === 0 ? (
            <div className="bg-amber-50/60 border border-amber-100 rounded-3xl p-8 text-center max-w-2xl mx-auto">
              <Sparkles className="text-amber-500 mx-auto mb-4" size={32} />
              <h4 className="font-bold text-amber-900 mb-2">Usando Promociones por Defecto</h4>
              <p className="text-xs text-amber-700 leading-relaxed">
                Actualmente no tienes promociones personalizadas creadas en tu base de datos. 
                BistroFlow está mostrando un set pre-configurado de banners premium (Combos Smash, Delivery Gratis y Hora Feliz).
              </p>
              <p className="text-xs text-amber-800 font-bold mt-4">
                ¡Crea tu primera promoción personalizada arriba para reemplazar las promociones por defecto!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {promotions.map(promo => (
                <div key={promo.id} className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 flex flex-col justify-between">
                  <div>
                    <div className="aspect-video bg-slate-50 rounded-2xl mb-4 overflow-hidden relative group">
                      <img 
                        src={promo.image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500'} 
                        alt={promo.title} 
                        className="w-full h-full object-cover transition-transform group-hover:scale-105" 
                      />
                      <div className="absolute top-3 left-3">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${promo.badgeBg || 'bg-red-100'} ${promo.badgeText || 'text-red-800'}`}>
                          {promo.badge}
                        </span>
                      </div>
                    </div>
                    <div className="mb-4">
                      <h4 className="font-bold text-lg leading-tight text-slate-900 mb-1">{promo.title}</h4>
                      <p className="text-xs font-bold text-amber-600 mb-2">{promo.subtitle}</p>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{promo.description}</p>
                    </div>
                    
                    <div className="space-y-2 border-t border-slate-50 pt-3 mb-6">
                      <div className="flex justify-between text-[11px] font-medium">
                        <span className="text-slate-400">Botón de acción:</span>
                        <span className="text-slate-800 font-bold">{promo.actionText || 'Ver Detalles'}</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-medium">
                        <span className="text-slate-400">Categoría filtro:</span>
                        <span className="text-slate-800 font-bold bg-slate-50 px-2 py-0.5 rounded-md">{promo.filterCategory || 'All'}</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-medium">
                        <span className="text-slate-400">Texto búsqueda filtro:</span>
                        <span className="text-slate-800 font-bold">{promo.filterQuery ? `"${promo.filterQuery}"` : 'Ninguno'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 border-t border-slate-50 pt-4">
                    <button 
                      onClick={() => handleEditPromo(promo)} 
                      className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-[10px] uppercase tracking-widest py-3 rounded-xl transition-colors"
                    >
                      Editar Banner
                    </button>
                    <button 
                      onClick={() => handleDeletePromo(promo.id)} 
                      className="w-12 flex items-center justify-center bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-xl transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* EDITOR DE PLATILLO INLINE (SIN MODALS NI ELEMENTOS FLOTANTES) */}
      <AnimatePresence>
        {(editingItem || isCreatingMenu) && (
          <div className="w-full bg-white rounded-3xl sm:rounded-[36px] border border-slate-200/90 shadow-sm p-5 sm:p-8 relative flex flex-col space-y-6 my-4 animate-fadeIn">
            {/* Header del Editor */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <button 
                  type="button" 
                  onClick={() => { setEditingItem(null); setIsCreatingMenu(false); }} 
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl transition-all text-xs font-bold flex items-center gap-2 cursor-pointer border border-slate-200/70"
                >
                  <ArrowLeft size={16} />
                  <span>Volver al Menú</span>
                </button>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <span>{isCreatingMenu ? 'Nuevo Platillo' : 'Editar Platillo'}</span>
                    {menuData.name && (
                      <span className="text-sm font-bold text-slate-400 font-sans hidden sm:inline">
                        — {menuData.name}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Configura datos generales, precios, receta de insumos y variantes de tamaño o proteínas.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => { setEditingItem(null); setIsCreatingMenu(false); }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveMenu}
                  disabled={isSavingMenu || !menuData.name.trim()}
                  className="px-5 py-2.5 bg-black hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl font-black text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  {isSavingMenu ? <span className="animate-spin">⏳</span> : <Save size={16} />}
                  <span>{isSavingMenu ? 'Guardando...' : 'Guardar Platillo'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Nombre</label>
                  <input type="text" value={menuData.name} onChange={e => setMenuData({...menuData, name: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Precio ($)</label>
                    <input type="number" value={menuData.price} onChange={e => setMenuData({...menuData, price: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Categoría</label>
                    <input type="text" value={menuData.category} onChange={e => setMenuData({...menuData, category: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Tiempo de Cocción Promedio (minutos)</label>
                  <input 
                    type="number" 
                    placeholder="Ej: 15 (Opcional)" 
                    value={menuData.preparationTime} 
                    onChange={e => setMenuData({...menuData, preparationTime: e.target.value !== '' ? Number(e.target.value) : ''})} 
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Imagen del Platillo</label>
                  
                  <div className="space-y-3">
                    {/* File Upload Area */}
                    <div className="border-2 border-dashed border-slate-200 hover:border-black rounded-2xl p-4 transition-colors relative flex flex-col items-center justify-center bg-slate-50">
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setMenuData({ ...menuData, image: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                      />
                      {menuData.image ? (
                        <div className="flex flex-col items-center gap-2">
                          <img src={menuData.image} alt="Preview" className="w-24 h-16 object-cover rounded-xl border border-slate-200" />
                          <span className="text-[10px] font-semibold text-slate-500">Imagen seleccionada</span>
                          <button 
                            type="button" 
                            onClick={(e) => { e.stopPropagation(); setMenuData({ ...menuData, image: '' }); }}
                            className="text-[10px] text-rose-500 hover:underline font-bold z-20 relative"
                          >
                            Quitar Imagen
                          </button>
                        </div>
                      ) : (
                        <div className="text-center">
                          <span className="text-xs font-bold text-slate-700 block mb-0.5">Subir archivo de imagen</span>
                          <span className="text-[10px] text-slate-400 block">Arrastra aquí o haz clic para seleccionar</span>
                        </div>
                      )}
                    </div>

                    {/* Or URL input */}
                    <div className="flex items-center gap-2">
                      <div className="h-px bg-slate-200 flex-1" />
                      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">O ingresa una URL</span>
                      <div className="h-px bg-slate-200 flex-1" />
                    </div>

                    <input 
                      type="text" 
                      value={menuData.image.startsWith('data:image') ? '' : menuData.image} 
                      onChange={e => setMenuData({...menuData, image: e.target.value})} 
                      placeholder="https://..." 
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium text-xs" 
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Horario de Disponibilidad del Plato</label>
                  <select 
                    value={menuData.scheduleType || 'always'} 
                    onChange={e => setMenuData({...menuData, scheduleType: e.target.value as any})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium text-sm mb-3"
                  >
                    <option value="always">Siempre disponible</option>
                    <option value="breakfast">Desayuno (06:00 - 11:30)</option>
                    <option value="lunch">Almuerzo (11:30 - 17:00)</option>
                    <option value="dinner">Cena (17:00 - 23:59)</option>
                    <option value="custom">Horario Personalizado</option>
                  </select>

                  {menuData.scheduleType === 'custom' && (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Disponible Desde</label>
                        <input 
                          type="time" 
                          value={menuData.availableFrom || '08:00'} 
                          onChange={e => setMenuData({...menuData, availableFrom: e.target.value})} 
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none focus:border-black font-bold text-sm" 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Disponible Hasta</label>
                        <input 
                          type="time" 
                          value={menuData.availableTo || '22:00'} 
                          onChange={e => setMenuData({...menuData, availableTo: e.target.value})} 
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none focus:border-black font-bold text-sm" 
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Marcadores de Alerta / Etiquetas del Plato</label>
                  <p className="text-[10px] text-slate-400 mb-3">Selecciona marcas visuales que aparecerán en la carta digital y panel de meseros:</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'Spicy', label: '🌶️ Picante' },
                      { id: 'Gluten-Free', label: '🌾 Sin Gluten' },
                      { id: 'Lactose-Free', label: '🥛 Sin Lactosa' },
                      { id: 'Vegan', label: '🌱 Vegano' },
                      { id: 'Vegetarian', label: '🥗 Vegetariano' },
                      { id: 'Popular', label: '🔥 Más Vendido' },
                      { id: 'New', label: '✨ Nuevo' },
                      { id: 'Slow-Prep', label: '⏳ Prep. Lenta' },
                      { id: 'Chef-Special', label: '⭐ Recomendado' }
                    ].map(tag => {
                      const isSelected = menuData.alerts?.includes(tag.id);
                      return (
                        <button
                          type="button"
                          key={tag.id}
                          onClick={() => {
                            const current = menuData.alerts || [];
                            const next = current.includes(tag.id)
                              ? current.filter(id => id !== tag.id)
                              : [...current, tag.id];
                            setMenuData({ ...menuData, alerts: next });
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                            isSelected
                              ? 'bg-black border-black text-white shadow-sm'
                              : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          {tag.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Receta Base / Escandallo del Plato */}
                <div className="pt-4 border-t border-slate-100">
                  {(() => {
                    const baseFoodCost = (menuData.recipe || []).reduce((acc, ri) => {
                      const ing = ingredients.find(i => i.id === ri.ingredientId);
                      return acc + ((ing?.cost || 0) * ri.quantity);
                    }, 0);
                    const foodCostMargin = menuData.price > 0 ? ((baseFoodCost / menuData.price) * 100) : 0;

                    return (
                      <>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">Receta Base / Insumos Principales</label>
                          {baseFoodCost > 0 && (
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                              foodCostMargin > 35 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              Costo: ${baseFoodCost.toFixed(2)} ({foodCostMargin.toFixed(1)}% FC)
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mb-3">Insumos que se descontarán automáticamente del inventario al preparar este plato:</p>

                        {/* List of current base recipe ingredients */}
                        <div className="space-y-2 mb-3">
                          {(menuData.recipe || []).map((recipeItem, idx) => {
                            const ing = ingredients.find(i => i.id === recipeItem.ingredientId);
                            const ingCost = (ing?.cost || 0) * recipeItem.quantity;
                            return (
                              <div key={idx} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl p-2.5 gap-2">
                                <div className="flex items-center gap-2 flex-wrap flex-1">
                                  <span className="text-xs font-bold text-slate-800">📦 {ing ? ing.name : 'Insumo sin nombre'}</span>
                                  {ing && (
                                    <span className="text-[10px] text-slate-400 font-medium">(Stock: {ing.stock} {ing.unit})</span>
                                  )}
                                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-0.5 rounded-lg ml-auto">
                                    <span className="text-[10px] font-bold text-slate-500">Cant:</span>
                                    <input 
                                      type="number"
                                      step="any"
                                      min="0.01"
                                      value={recipeItem.quantity}
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        const updated = [...(menuData.recipe || [])];
                                        updated[idx] = { ...updated[idx], quantity: val };
                                        setMenuData({ ...menuData, recipe: updated });
                                      }}
                                      className="w-16 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-xs font-black text-slate-900 outline-none text-center"
                                    />
                                    <span className="text-[10px] font-bold text-slate-600">{ing ? ing.unit : 'und'}</span>
                                  </div>
                                  {ingCost > 0 && (
                                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                                      ${ingCost.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                                <button 
                                  type="button"
                                  onClick={() => {
                                    const updated = (menuData.recipe || []).filter((_, i) => i !== idx);
                                    setMenuData({ ...menuData, recipe: updated });
                                  }}
                                  className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            );
                          })}
                          {(menuData.recipe || []).length === 0 && (
                            <p className="text-[10px] italic text-slate-400">No hay ingredientes en la receta base. Agrega insumos para descontar stock al cocinar.</p>
                          )}
                        </div>

                        {/* Add base ingredient form */}
                        <div className="flex gap-2 items-center bg-slate-50/70 border border-slate-200/70 rounded-2xl p-2.5">
                          <div className="flex-1">
                            <select
                              value={modalRecipeIngId}
                              onChange={(e) => setModalRecipeIngId(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl p-2 outline-none focus:border-black text-xs font-medium text-slate-800"
                            >
                              <option value="">-- Seleccionar Insumo de Inventario --</option>
                              {ingredients.map(ing => (
                                <option key={ing.id} value={ing.id}>
                                  📦 {ing.name} (Stock: {ing.stock} {ing.unit})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="w-24 relative flex items-center">
                            <input 
                              type="number"
                              step="any"
                              min="0.01"
                              placeholder="Cant."
                              value={modalRecipeQty}
                              onChange={(e) => setModalRecipeQty(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl p-2 outline-none focus:border-black text-xs font-extrabold text-slate-900"
                            />
                          </div>
                          <button 
                            type="button"
                            onClick={() => {
                              if (modalRecipeIngId) {
                                const qty = parseFloat(modalRecipeQty) || 1;
                                const existingIdx = (menuData.recipe || []).findIndex(r => r.ingredientId === modalRecipeIngId);
                                let updated = [...(menuData.recipe || [])];
                                if (existingIdx >= 0) {
                                  updated[existingIdx] = { ...updated[existingIdx], quantity: updated[existingIdx].quantity + qty };
                                } else {
                                  updated.push({ ingredientId: modalRecipeIngId, quantity: qty });
                                }
                                setMenuData({ ...menuData, recipe: updated });
                                setModalRecipeIngId('');
                                setModalRecipeQty('1');
                              }
                            }}
                            className="px-3 h-[34px] bg-black hover:bg-slate-800 text-white rounded-xl font-black text-xs cursor-pointer flex items-center justify-center shrink-0"
                            title="Agregar Insumo a la Receta Base"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>

                  {/* VARIANTES DEL PLATILLO (TAMAÑOS, PROTEÍNAS Y OPCIONES) */}
                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-800 flex items-center gap-1.5">
                        <span>📏 / 🥩 Variantes del Platillo (Tamaños, Proteínas y Opciones)</span>
                      </label>
                      <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full">
                        {(menuData.variants || []).length} {(menuData.variants || []).length === 1 ? 'Variante' : 'Variantes'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mb-3">
                      Registra opciones de diferente tamaño (ej: 15cm / 30cm, Mediano / Grande) o de proteínas (ej: Pollo, Camarón, Cangrejo) con su precio individual y receta vinculada para descontar el stock exacto:
                    </p>

                    {/* Quick Preset Buttons */}
                    <div className="mb-3 p-2.5 bg-indigo-50/50 border border-indigo-100/80 rounded-2xl">
                      <span className="block text-[9px] font-black uppercase tracking-wider text-indigo-900 mb-1.5">
                        ⚡ Carga Rápida con Presets Inteligentes:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const base = Number(menuData.price) || 8;
                            const p15 = base;
                            const p30 = Math.round(base * 1.35 * 10) / 10;
                            const newVariants: MenuItemVariant[] = [
                              { id: `var-${Date.now()}-1`, name: '15 cm (Regular)', price: p15 },
                              { id: `var-${Date.now()}-2`, name: '30 cm (Grande)', price: p30 }
                            ];
                            setMenuData({ ...menuData, variants: [...(menuData.variants || []), ...newVariants] });
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-[10px] font-bold flex items-center gap-1 shadow-2xs transition-all active:scale-95 cursor-pointer"
                        >
                          <span>🥪 15cm y 30cm</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const base = Number(menuData.price) || 10;
                            const pP = Math.round(base * 0.8 * 10) / 10;
                            const pM = base;
                            const pG = Math.round(base * 1.4 * 10) / 10;
                            const newVariants: MenuItemVariant[] = [
                              { id: `var-${Date.now()}-p`, name: 'Pequeño', price: pP },
                              { id: `var-${Date.now()}-m`, name: 'Mediano', price: pM },
                              { id: `var-${Date.now()}-g`, name: 'Grande (Familiar)', price: pG }
                            ];
                            setMenuData({ ...menuData, variants: [...(menuData.variants || []), ...newVariants] });
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-[10px] font-bold flex items-center gap-1 shadow-2xs transition-all active:scale-95 cursor-pointer"
                        >
                          <span>📏 Pequeño / Mediano / Grande</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const base = Number(menuData.price) || 12;
                            const camIng = ingredients.find(i => i.name.toLowerCase().includes('camarón') || i.name.toLowerCase().includes('camaron'));
                            const cangIng = ingredients.find(i => i.name.toLowerCase().includes('cangrejo') || i.name.toLowerCase().includes('surimi'));
                            const newVariants: MenuItemVariant[] = [
                              { id: `var-${Date.now()}-pol`, name: 'Con Pollo', price: base },
                              { 
                                id: `var-${Date.now()}-cam`, 
                                name: 'Con Camarón', 
                                price: base + 3,
                                ...(camIng ? { recipe: [{ ingredientId: camIng.id, quantity: 0.15 }] } : {})
                              },
                              { 
                                id: `var-${Date.now()}-cang`, 
                                name: 'Con Cangrejo', 
                                price: base + 4,
                                ...(cangIng ? { recipe: [{ ingredientId: cangIng.id, quantity: 0.15 }] } : {})
                              },
                              { 
                                id: `var-${Date.now()}-mix`, 
                                name: 'Con Pollo y Camarón', 
                                price: base + 5,
                                ...(camIng ? { recipe: [{ ingredientId: camIng.id, quantity: 0.12 }] } : {})
                              }
                            ];
                            setMenuData({ ...menuData, variants: [...(menuData.variants || []), ...newVariants] });
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-[10px] font-bold flex items-center gap-1 shadow-2xs transition-all active:scale-95 cursor-pointer"
                        >
                          <span>🍤 Pollo / Camarón / Cangrejo</span>
                        </button>

                        {(menuData.variants || []).length > 0 && (
                          <button
                            type="button"
                            onClick={() => setMenuData({ ...menuData, variants: [] })}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ml-auto"
                          >
                            <Trash2 size={11} />
                            <span>Limpiar Todas</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* List of current variants */}
                    <div className="space-y-2 mb-3">
                      {(menuData.variants || []).map((variant, vIdx) => {
                        return (
                          <div key={variant.id || vIdx} className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3 flex flex-col gap-2 shadow-2xs">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-900 font-black text-[10px] flex items-center justify-center shrink-0">
                                  {vIdx + 1}
                                </span>
                                <input 
                                  type="text"
                                  value={variant.name}
                                  onChange={(e) => {
                                    const updated = [...(menuData.variants || [])];
                                    updated[vIdx] = { ...updated[vIdx], name: e.target.value };
                                    setMenuData({ ...menuData, variants: updated });
                                  }}
                                  placeholder="Nombre de la variante..."
                                  className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-800 outline-none focus:border-indigo-600 flex-1"
                                />
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1">
                                  <span className="text-[10px] font-bold text-slate-400">$</span>
                                  <input 
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={variant.price}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      const updated = [...(menuData.variants || [])];
                                      updated[vIdx] = { ...updated[vIdx], price: val };
                                      setMenuData({ ...menuData, variants: updated });
                                    }}
                                    className="w-16 font-mono text-xs font-black text-indigo-700 outline-none text-right"
                                  />
                                </div>

                                <button 
                                  type="button"
                                  onClick={() => {
                                    const updated = (menuData.variants || []).filter((_, i) => i !== vIdx);
                                    setMenuData({ ...menuData, variants: updated });
                                  }}
                                  className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                                  title="Eliminar Variante"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            {/* Linked Recipe items for this variant */}
                            <div className="pl-7 pr-1 pt-1.5 border-t border-slate-200/60 flex items-center justify-between flex-wrap gap-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
                                  📦 Insumos a descontar:
                                </span>
                                {(variant.recipe && variant.recipe.length > 0) ? (
                                  variant.recipe.map((ri, riIdx) => {
                                    const ing = ingredients.find(i => i.id === ri.ingredientId);
                                    return (
                                      <span key={riIdx} className="inline-flex items-center gap-1 bg-white border border-emerald-200 text-emerald-900 text-[10px] font-black px-2 py-0.5 rounded-lg shadow-2xs">
                                        <span>{ing ? ing.name : 'Insumo'}: {ri.quantity} {ing ? ing.unit : 'und'}</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updated = [...(menuData.variants || [])];
                                            const updatedRecipe = (updated[vIdx].recipe || []).filter((_, i) => i !== riIdx);
                                            updated[vIdx] = { ...updated[vIdx], recipe: updatedRecipe };
                                            setMenuData({ ...menuData, variants: updated });
                                          }}
                                          className="text-rose-400 hover:text-rose-700 cursor-pointer ml-0.5"
                                          title="Quitar insumo de variante"
                                        >
                                          ×
                                        </button>
                                      </span>
                                    );
                                  })
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">
                                    Hereda la receta base del plato
                                  </span>
                                )}
                              </div>

                              {/* Add ingredient mini-picker to variant */}
                              <div className="flex items-center gap-1">
                                <select
                                  onChange={(e) => {
                                    const ingId = e.target.value;
                                    if (!ingId) return;
                                    const ing = ingredients.find(i => i.id === ingId);
                                    const defaultQty = ing && ing.unit === 'kg' ? 0.15 : 1;
                                    const updated = [...(menuData.variants || [])];
                                    const currentRecipe = updated[vIdx].recipe || [];
                                    const existingIdx = currentRecipe.findIndex(r => r.ingredientId === ingId);
                                    let newRecipe = [...currentRecipe];
                                    if (existingIdx >= 0) {
                                      newRecipe[existingIdx] = { ...newRecipe[existingIdx], quantity: newRecipe[existingIdx].quantity + defaultQty };
                                    } else {
                                      newRecipe.push({ ingredientId: ingId, quantity: defaultQty });
                                    }
                                    updated[vIdx] = { ...updated[vIdx], recipe: newRecipe };
                                    setMenuData({ ...menuData, variants: updated });
                                    e.target.value = '';
                                  }}
                                  className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-[10px] font-medium text-slate-700 outline-none cursor-pointer"
                                  defaultValue=""
                                >
                                  <option value="" disabled>+ Vincular Insumo...</option>
                                  {ingredients.map(ing => (
                                    <option key={ing.id} value={ing.id}>
                                      {ing.name} ({ing.unit})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {(menuData.variants || []).length === 0 && (
                        <p className="text-[10px] italic text-slate-400">
                          No hay variantes registradas. El platillo se venderá a precio único (${Number(menuData.price).toFixed(2)}).
                        </p>
                      )}
                    </div>

                    {/* Add New Variant Form */}
                    {(() => {
                      const selectedIngForVar = ingredients.find(i => i.id === variantFormIngId);
                      return (
                        <div className="flex flex-col gap-2.5 bg-slate-50/70 border border-slate-200/70 rounded-2xl p-3">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                            + Registrar Nueva Variante Manual
                          </span>
                          
                          <div className="grid grid-cols-12 gap-2 items-end">
                            <div className="col-span-5 sm:col-span-4">
                              <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                Nombre de Variante
                              </label>
                              <input 
                                type="text" 
                                placeholder="Ej: 30 cm o Con Camarón" 
                                value={variantFormName}
                                onChange={(e) => setVariantFormName(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl p-2 outline-none focus:border-black text-xs font-medium"
                              />
                            </div>

                            <div className="col-span-3 sm:col-span-2">
                              <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                Precio $
                              </label>
                              <input 
                                type="number" 
                                placeholder={Number(menuData.price || 0).toFixed(2)} 
                                value={variantFormPrice}
                                onChange={(e) => setVariantFormPrice(e.target.value)}
                                step="0.01"
                                min="0"
                                className="w-full bg-white border border-slate-200 rounded-xl p-2 outline-none focus:border-black text-xs font-bold text-indigo-600"
                              />
                            </div>

                            <div className="col-span-4 sm:col-span-3">
                              <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                Insumo Específico (Opcional)
                              </label>
                              <select
                                value={variantFormIngId}
                                onChange={(e) => {
                                  const id = e.target.value;
                                  setVariantFormIngId(id);
                                  const selected = ingredients.find(i => i.id === id);
                                  if (selected && !variantFormName) {
                                    setVariantFormName(`Con ${selected.name}`);
                                  }
                                }}
                                className="w-full bg-white border border-slate-200 rounded-xl p-2 outline-none focus:border-black text-[11px] font-medium text-slate-700"
                              >
                                <option value="">-- Sin Insumo Extra --</option>
                                {ingredients.map(ing => (
                                  <option key={ing.id} value={ing.id}>
                                    {ing.name} ({ing.unit})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="col-span-2 sm:col-span-2">
                              <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                Cant. ({selectedIngForVar ? selectedIngForVar.unit : 'und'})
                              </label>
                              <input 
                                type="number" 
                                placeholder="Cant." 
                                value={variantFormQty}
                                onChange={(e) => setVariantFormQty(e.target.value)}
                                step="any"
                                min="0.01"
                                className="w-full bg-white border border-slate-200 rounded-xl p-2 outline-none focus:border-black text-xs font-bold text-slate-800"
                              />
                            </div>

                            <div className="col-span-12 sm:col-span-1 flex justify-end">
                              <button 
                                type="button"
                                onClick={() => {
                                  const name = variantFormName.trim();
                                  const price = parseFloat(variantFormPrice) || Number(menuData.price) || 0;
                                  const qty = parseFloat(variantFormQty) || 1;

                                  if (name) {
                                    const newVariant: MenuItemVariant = {
                                      id: `var-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                                      name,
                                      price,
                                      ...(variantFormIngId ? { recipe: [{ ingredientId: variantFormIngId, quantity: qty }] } : {})
                                    };
                                    setMenuData({ ...menuData, variants: [...(menuData.variants || []), newVariant] });
                                    setVariantFormName('');
                                    setVariantFormPrice('');
                                    setVariantFormIngId('');
                                    setVariantFormQty('1');
                                  }
                                }}
                                className="w-full h-[38px] bg-black hover:bg-slate-800 text-white rounded-xl font-black text-xs cursor-pointer flex items-center justify-center transition-colors shadow-2xs"
                                title="Agregar Variante"
                              >
                                <Plus size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Ingredientes Extras / Adicionales</label>
                  <p className="text-[10px] text-slate-400 mb-3">Define los ingredientes adicionales que los clientes pueden agregar a este platillo:</p>
                  
                  {/* List of current extras */}
                  <div className="space-y-2 mb-3">
                    {(menuData.extras || []).map((extra, idx) => {
                      const linkedIng = ingredients.find(i => i.id === extra.ingredientId || i.name.toLowerCase() === extra.name.toLowerCase());
                      return (
                        <div key={idx} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl p-2.5 gap-2">
                          <div className="flex items-center gap-2 flex-wrap flex-1">
                            <span className="text-xs font-bold text-slate-800">{extra.name}</span>
                            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg">+${extra.price.toFixed(2)}</span>
                            {linkedIng ? (
                              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-lg">
                                <span className="text-[10px] font-bold text-emerald-800">📦 Descontar:</span>
                                <input 
                                  type="number"
                                  step="any"
                                  min="0.01"
                                  value={extra.quantity ?? 1}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    const updated = [...(menuData.extras || [])];
                                    updated[idx] = { 
                                      ...updated[idx], 
                                      ingredientId: linkedIng.id, 
                                      quantity: val 
                                    };
                                    setMenuData({ ...menuData, extras: updated });
                                  }}
                                  className="w-16 bg-white border border-emerald-300 rounded px-1.5 py-0.5 text-xs font-black text-emerald-900 outline-none text-center"
                                />
                                <span className="text-[10px] font-bold text-emerald-700">{linkedIng.unit} de {linkedIng.name}</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">(Sin insumo vinculado)</span>
                            )}
                          </div>
                          <button 
                            type="button"
                            onClick={() => {
                              const updated = (menuData.extras || []).filter((_, i) => i !== idx);
                              setMenuData({ ...menuData, extras: updated });
                            }}
                            className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                    {(menuData.extras || []).length === 0 && (
                      <p className="text-[10px] italic text-slate-400">No hay adicionales configurados para este plato.</p>
                    )}
                  </div>

                  {/* Add extra form */}
                  {(() => {
                    const selectedIngForForm = ingredients.find(i => i.id === extraFormIngId);
                    return (
                      <div className="flex flex-col gap-2.5 bg-slate-50/70 border border-slate-200/70 rounded-2xl p-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                            Vincular Insumo de Inventario (Opcional)
                          </label>
                          <select
                            value={extraFormIngId}
                            onChange={(e) => {
                              const ingId = e.target.value;
                              setExtraFormIngId(ingId);
                              const selectedIng = ingredients.find(i => i.id === ingId);
                              if (selectedIng) {
                                if (!extraFormName) setExtraFormName(selectedIng.name);
                              }
                            }}
                            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 outline-none focus:border-black text-xs font-medium text-slate-800"
                          >
                            <option value="">-- Sin Vincular a Inventario --</option>
                            {ingredients.map(ing => (
                              <option key={ing.id} value={ing.id}>
                                📦 {ing.name} (Stock: {ing.stock} {ing.unit})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-5 sm:col-span-5">
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nombre Extra</label>
                            <input 
                              type="text" 
                              placeholder="Ej: Tocineta Extra" 
                              value={extraFormName}
                              onChange={(e) => setExtraFormName(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl p-2 outline-none focus:border-black text-xs font-medium"
                            />
                          </div>

                          <div className="col-span-3 sm:col-span-3">
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                              Cant. ({selectedIngForForm ? selectedIngForForm.unit : 'uds'})
                            </label>
                            <div className="relative flex items-center">
                              <input 
                                type="number" 
                                placeholder="Cant." 
                                value={extraFormQty}
                                onChange={(e) => setExtraFormQty(e.target.value)}
                                step="any"
                                min="0.01"
                                className="w-full bg-white border border-slate-200 rounded-xl p-2 pr-6 outline-none focus:border-black text-xs font-extrabold text-emerald-800"
                              />
                              {selectedIngForForm && (
                                <span className="absolute right-2 text-[9px] font-extrabold text-emerald-700 pointer-events-none">
                                  {selectedIngForForm.unit}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="col-span-3 sm:col-span-3">
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Precio $</label>
                            <input 
                              type="number" 
                              placeholder="0.00" 
                              value={extraFormPrice}
                              onChange={(e) => setExtraFormPrice(e.target.value)}
                              step="0.01"
                              min="0"
                              className="w-full bg-white border border-slate-200 rounded-xl p-2 outline-none focus:border-black text-xs font-bold text-indigo-600"
                            />
                          </div>

                          <div className="col-span-1 flex justify-end">
                            <button 
                              type="button"
                              onClick={() => {
                                const name = extraFormName.trim();
                                const price = parseFloat(extraFormPrice) || 0;
                                const qty = parseFloat(extraFormQty) || 1;

                                if (name) {
                                  const newExtraOption: ExtraOption = {
                                    name,
                                    price,
                                    ...(extraFormIngId ? { ingredientId: extraFormIngId, quantity: qty } : {})
                                  };
                                  setMenuData({ ...menuData, extras: [...(menuData.extras || []), newExtraOption] });
                                  setExtraFormIngId('');
                                  setExtraFormName('');
                                  setExtraFormPrice('');
                                  setExtraFormQty('1');
                                }
                              }}
                              className="w-full h-[34px] bg-black hover:bg-slate-800 text-white rounded-xl font-black text-xs cursor-pointer flex items-center justify-center transition-colors"
                              title="Agregar Adicional"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
              </div>
            </div>

            {/* Bottom action bar */}
            <div className="pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => { setEditingItem(null); setIsCreatingMenu(false); }}
                className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer text-center"
              >
                Cancelar y Volver al Menú
              </button>
              <button
                type="button"
                onClick={handleSaveMenu}
                disabled={isSavingMenu || !menuData.name.trim()}
                className="w-full sm:w-auto px-8 py-3 bg-black hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl font-black text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSavingMenu ? <span className="animate-spin">⏳</span> : <Save size={18} />}
                <span>{isSavingMenu ? 'Guardando Platillo...' : 'Guardar Platillo'}</span>
              </button>
            </div>
          </div>
        )}

        {isCreatingCombo && (
          <div className="w-full bg-white rounded-3xl sm:rounded-[36px] border border-amber-200/80 shadow-sm p-5 sm:p-8 relative flex flex-col space-y-6 my-4 animate-fadeIn">
            {/* Header del Combo Editor */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-amber-100">
              <div className="flex items-center gap-3">
                <button 
                  type="button"
                  onClick={() => {
                    setIsCreatingCombo(false);
                    setEditingComboId(null);
                  }} 
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl transition-all text-xs font-bold flex items-center gap-2 cursor-pointer border border-slate-200/70"
                >
                  <ArrowLeft size={16} />
                  <span>Volver al Menú</span>
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
                    <Sparkles size={22} />
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                      {editingComboId ? 'Editar Combo / Promoción' : 'Crear Combo / Promoción Especial'}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Arma paquetes combinando platos y bebidas registrados para sincronizar finanzas e inventario automáticamente.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingCombo(false);
                    setEditingComboId(null);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={handleSaveCombo} 
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer shadow-amber-500/25"
                >
                  <Sparkles size={16}/> 
                  <span>{editingComboId ? 'Guardar Cambios' : 'Publicar Combo'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-6">
                {/* Nombre y Precio */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Nombre del Combo</label>
                    <input 
                      type="text" 
                      placeholder="Ej: Super Combo Burger + Papas + Refresco" 
                      value={comboData.name} 
                      onChange={e => setComboData({...comboData, name: e.target.value})} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 outline-none focus:border-amber-500 font-bold text-xs sm:text-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Precio Combo ($)</label>
                    <input 
                      type="number" 
                      step="any"
                      placeholder="12.50" 
                      value={comboData.price} 
                      onChange={e => setComboData({...comboData, price: e.target.value === '' ? '' : parseFloat(e.target.value) || 0})} 
                      className="w-full bg-amber-50/50 border border-amber-300/80 rounded-2xl p-3.5 outline-none focus:border-amber-500 font-black text-amber-700 text-sm" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Descripción o Qué incluye</label>
                  <textarea 
                    rows={2} 
                    placeholder="Incluye hamburguesa especial, papas grill y refresco lata..." 
                    value={comboData.description} 
                    onChange={e => setComboData({...comboData, description: e.target.value})} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 outline-none focus:border-black font-medium text-xs resize-none"
                  />
                </div>

                {/* Platos y Bebidas Registrados */}
                <div className="bg-slate-50/80 border border-slate-200/80 rounded-3xl p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <span>🍽️</span> Platos y Bebidas Registrados
                    </label>
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                      {(comboData.items || []).length} ítems en el combo
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mb-3 leading-relaxed">
                    Cada ítem agregado transferirá sus insumos al combo. Cuando se venda en el POS, el inventario de cada plato y bebida se descontará de forma exacta.
                  </p>

                  {/* Selector con categoría y cantidad */}
                  <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <select 
                      value={selectedMenuIdToAdd}
                      onChange={e => setSelectedMenuIdToAdd(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 rounded-xl p-3 text-xs outline-none focus:border-amber-500 font-medium"
                    >
                      <option value="">-- Seleccionar Platillo o Bebida del Menú --</option>
                      {Array.from(new Set(menu.filter(m => !m.isCombo && m.category !== 'Combos & Promos').map(m => m.category))).map(cat => (
                        <optgroup key={cat} label={`📂 ${cat}`}>
                          {menu.filter(m => m.category === cat && !m.isCombo).map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name} (${m.price.toFixed(2)})
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-white border border-slate-200 rounded-xl px-2 py-1">
                        <span className="text-[10px] font-bold text-slate-400 mr-1.5">Cant:</span>
                        <input 
                          type="number" 
                          min="1" 
                          max="20" 
                          value={selectedQtyToAdd} 
                          onChange={e => setSelectedQtyToAdd(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-10 text-center font-black text-xs outline-none" 
                        />
                      </div>
                      <button 
                        type="button" 
                        onClick={() => {
                          if (selectedMenuIdToAdd) {
                            const foundItem = menu.find(m => m.id === selectedMenuIdToAdd);
                            if (foundItem) {
                              const existingIdx = (comboData.items || []).findIndex(ci => ci.menuItemId === foundItem.id);
                              if (existingIdx >= 0) {
                                const updated = [...(comboData.items || [])];
                                updated[existingIdx].quantity += selectedQtyToAdd;
                                setComboData({...comboData, items: updated});
                              } else {
                                setComboData({
                                  ...comboData, 
                                  items: [
                                    ...(comboData.items || []), 
                                    {
                                      menuItemId: foundItem.id,
                                      name: foundItem.name,
                                      price: foundItem.price,
                                      quantity: selectedQtyToAdd,
                                      category: foundItem.category
                                    }
                                  ]
                                });
                              }
                              setSelectedMenuIdToAdd('');
                              setSelectedQtyToAdd(1);
                            }
                          }
                        }} 
                        className="px-4 py-3 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shrink-0 transition-colors"
                      >
                        <Plus size={15} />
                        <span>Agregar</span>
                      </button>
                    </div>
                  </div>

                  {/* Lista de ítems en el combo */}
                  <div className="space-y-2">
                    {(comboData.items || []).map((ci, idx) => {
                      const itemSubtotal = (ci.price || 0) * (ci.quantity || 1);
                      return (
                        <div key={idx} className="flex items-center justify-between bg-white border border-slate-200/80 rounded-2xl px-3.5 py-2.5 shadow-2xs gap-2">
                          <div className="flex items-center gap-2 overflow-hidden flex-1">
                            <span className="text-base">{ci.category === 'Bebidas' ? '🥤' : '🍔'}</span>
                            <div className="overflow-hidden">
                              <span className="text-xs font-bold text-slate-800 block truncate leading-tight">{ci.name}</span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                ${ci.price.toFixed(2)} c/u • <span className="text-slate-600 font-semibold">{ci.category}</span>
                              </span>
                            </div>
                          </div>

                          {/* Control de cantidad */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...(comboData.items || [])];
                                if (updated[idx].quantity > 1) {
                                  updated[idx].quantity -= 1;
                                  setComboData({...comboData, items: updated});
                                } else {
                                  setComboData({...comboData, items: updated.filter((_, i) => i !== idx)});
                                }
                              }}
                              className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs cursor-pointer"
                            >
                              -
                            </button>
                            <span className="w-6 text-center text-xs font-black text-slate-900">{ci.quantity}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...(comboData.items || [])];
                                updated[idx].quantity += 1;
                                setComboData({...comboData, items: updated});
                              }}
                              className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs cursor-pointer"
                            >
                              +
                            </button>
                          </div>

                          <span className="text-xs font-black text-slate-900 w-16 text-right shrink-0">
                            ${itemSubtotal.toFixed(2)}
                          </span>

                          <button 
                            type="button" 
                            onClick={() => {
                              const updated = (comboData.items || []).filter((_, i) => i !== idx);
                              setComboData({...comboData, items: updated});
                            }} 
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors shrink-0"
                            title="Eliminar ítem del combo"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      );
                    })}

                    {(comboData.items || []).length === 0 && (
                      <div className="py-6 text-center border border-dashed border-slate-200 rounded-2xl bg-white/50">
                        <p className="text-xs font-medium text-slate-400">No hay platos ni bebidas seleccionados todavía.</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Usa el selector superior para armar el combo.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dashboard Financiero del Combo en Tiempo Real */}
                {(() => {
                  const itemsList = comboData.items || [];
                  const regularTotal = itemsList.reduce((acc, ci) => acc + ((ci.price || 0) * (ci.quantity || 1)), 0);
                  const comboPriceNum = typeof comboData.price === 'number' ? comboData.price : (parseFloat(String(comboData.price)) || 0);
                  const savings = Math.max(0, regularTotal - comboPriceNum);
                  const savingsPct = regularTotal > 0 && comboPriceNum > 0 ? Math.round((savings / regularTotal) * 100) : 0;

                  let foodCost = 0;
                  itemsList.forEach(ci => {
                    const mItem = menu.find(m => m.id === ci.menuItemId);
                    if (mItem && mItem.recipe) {
                      mItem.recipe.forEach(r => {
                        const ing = ingredients.find(i => i.id === r.ingredientId);
                        if (ing && ing.cost) {
                          foodCost += ing.cost * r.quantity * (ci.quantity || 1);
                        }
                      });
                    }
                  });
                  const grossProfit = comboPriceNum - foodCost;
                  const profitMargin = comboPriceNum > 0 ? Math.round((grossProfit / comboPriceNum) * 100) : 0;

                  return (
                    <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-3xl p-4 sm:p-5 shadow-lg">
                      <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-3 flex items-center justify-between">
                        <span>📊 Análisis de Rentabilidad del Combo</span>
                        <span className="text-emerald-400 font-bold">100% Integrado con Inventario</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                        <div className="bg-white/10 rounded-2xl p-2.5">
                          <span className="text-[9px] text-slate-300 block uppercase font-bold">Precio Regular</span>
                          <span className="text-sm font-black text-slate-200 line-through">${regularTotal.toFixed(2)}</span>
                        </div>
                        <div className="bg-emerald-500/20 border border-emerald-400/30 rounded-2xl p-2.5">
                          <span className="text-[9px] text-emerald-300 block uppercase font-bold">Ahorro Cliente</span>
                          <span className="text-sm font-black text-emerald-400">-${savings.toFixed(2)} ({savingsPct}%)</span>
                        </div>
                        <div className="bg-white/10 rounded-2xl p-2.5">
                          <span className="text-[9px] text-slate-300 block uppercase font-bold">Costo Insumos</span>
                          <span className="text-sm font-black text-amber-300">${foodCost.toFixed(2)}</span>
                        </div>
                        <div className="bg-white/10 rounded-2xl p-2.5">
                          <span className="text-[9px] text-slate-300 block uppercase font-bold">Margen Bruto</span>
                          <span className="text-sm font-black text-emerald-300">{profitMargin}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Imagen del combo */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Imagen del Combo (URL opcional)</label>
                  <input 
                    type="text" 
                    placeholder="https://images.unsplash.com/photo-..." 
                    value={comboData.image} 
                    onChange={e => setComboData({...comboData, image: e.target.value})} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 outline-none focus:border-black font-medium text-xs" 
                  />
                </div>
              </div>

              {/* Bottom action bar */}
            <div className="pt-5 border-t border-amber-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => {
                  setIsCreatingCombo(false);
                  setEditingComboId(null);
                }}
                className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer text-center"
              >
                Cancelar y Volver al Menú
              </button>
              <button 
                type="button"
                onClick={handleSaveCombo} 
                className="w-full sm:w-auto px-8 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shadow-amber-500/25"
              >
                <Sparkles size={18}/> 
                <span>{editingComboId ? 'Guardar Cambios del Combo' : 'Guardar y Publicar Combo'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal de Confirmación para Eliminar Platillo (In-App, sin window.confirm) */}
        {itemToDelete && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl p-6 sm:p-7 w-full max-w-sm shadow-2xl border border-slate-100 text-center">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-4 mx-auto shadow-inner">
                <Trash2 size={28} />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2">¿Eliminar platillo del menú?</h3>
              <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                ¿Estás seguro de que deseas eliminar permanentemente <strong className="text-slate-800">"{itemToDelete.name}"</strong>? Esta acción no se puede deshacer.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setItemToDelete(null)}
                  className="py-3 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeletingItem}
                  onClick={confirmDeleteItem}
                  className="py-3 px-4 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/25 cursor-pointer disabled:opacity-50"
                >
                  {isDeletingItem ? 'Eliminando...' : 'Sí, Eliminar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal de Confirmación para Cargar Menú Q' Sandwich */}
        {isSeedingConfirmOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl p-6 sm:p-7 w-full max-w-md shadow-2xl border border-slate-100">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 mx-auto text-2xl font-black">
                🥪
              </div>
              <h3 className="text-lg font-black text-slate-900 text-center mb-2">Cargar Menú Oficial Q' Sandwich</h3>
              <p className="text-xs text-slate-500 text-center mb-6 leading-relaxed">
                Esta acción restablecerá el menú y el inventario con los platos oficiales (Sandwiches 15cm y 30cm, Hamburguesas, Club House, Papas, Ensaladas, Bebidas y Postres) extraídos de las imágenes del cliente.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsSeedingConfirmOpen(false)}
                  className="py-3 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isSeedingQSandwich}
                  onClick={handleSeedQSandwich}
                  className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/25 cursor-pointer disabled:opacity-50"
                >
                  {isSeedingQSandwich ? 'Cargando...' : 'Sí, Cargar Menú'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {(editingTable || isCreatingTable) && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[40px] p-8 w-full max-w-sm shadow-2xl relative">
              <button onClick={() => { setEditingTable(null); setIsCreatingTable(false); }} className="absolute top-6 right-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400"><X size={20} /></button>
              <h3 className="text-xl font-bold mb-6">{isCreatingTable ? 'Nueva Mesa' : 'Editar Mesa'}</h3>
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Nombre/Número (Ej: T1)</label>
                  <input type="text" value={tableData.number} onChange={e => setTableData({...tableData, number: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Capacidad</label>
                  <input type="number" value={tableData.capacity} onChange={e => setTableData({...tableData, capacity: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium" />
                </div>
              </div>
              <button onClick={handleSaveTable} className="w-full bg-black text-white p-4 rounded-xl font-bold hover:scale-[1.02] flex justify-center gap-2"><Save size={18}/> Guardar Mesa</button>
            </motion.div>
          </div>
        )}

        {(editingPromo || isCreatingPromo) && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6 overflow-y-auto">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[40px] p-8 w-full max-w-lg shadow-2xl relative my-8">
              <button 
                onClick={() => { setEditingPromo(null); setIsCreatingPromo(false); }} 
                className="absolute top-6 right-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400"
              >
                <X size={20} />
              </button>
              
              <h3 className="text-xl font-bold mb-6">
                {isCreatingPromo ? 'Nueva Promoción' : 'Editar Promoción'}
              </h3>
              
              <div className="space-y-4 mb-8 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Título de la Promoción</label>
                  <input 
                    type="text" 
                    value={promoData.title} 
                    onChange={e => setPromoData({...promoData, title: e.target.value})} 
                    placeholder="Ej: Combo Smash Burger 🍔"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium text-sm" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Subtítulo / Oferta</label>
                  <input 
                    type="text" 
                    value={promoData.subtitle} 
                    onChange={e => setPromoData({...promoData, subtitle: e.target.value})} 
                    placeholder="Ej: 2 Burgers Smash Dobles + Papas"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium text-sm" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Descripción Detallada</label>
                  <textarea 
                    value={promoData.description} 
                    onChange={e => setPromoData({...promoData, description: e.target.value})} 
                    placeholder="Explica detalladamente la promoción para tus clientes..."
                    rows={2}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium text-sm resize-none" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Texto Etiqueta (Badge)</label>
                    <input 
                      type="text" 
                      value={promoData.badge} 
                      onChange={e => setPromoData({...promoData, badge: e.target.value})} 
                      placeholder="Ej: Más Vendido 🔥"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium text-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Estilo Etiqueta</label>
                    <select 
                      value={`${promoData.badgeBg}|${promoData.badgeText}`} 
                      onChange={e => {
                        const [bg, text] = e.target.value.split('|');
                        setPromoData({...promoData, badgeBg: bg, badgeText: text});
                      }}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium text-sm"
                    >
                      <option value="bg-amber-100|text-amber-800">Oro / Amarillo 💛</option>
                      <option value="bg-indigo-100|text-indigo-800">Indigo / Azul 💙</option>
                      <option value="bg-pink-100|text-pink-800">Rosa / Rojo ❤️</option>
                      <option value="bg-emerald-100|text-emerald-800">Esmeralda / Verde 💚</option>
                      <option value="bg-slate-100|text-slate-800">Gris Neutro 🖤</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Imagen de la Promoción</label>
                  
                  <div className="space-y-3">
                    {/* File Upload Area */}
                    <div className="border-2 border-dashed border-slate-200 hover:border-black rounded-2xl p-4 transition-colors relative flex flex-col items-center justify-center bg-slate-50">
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setPromoData({ ...promoData, image: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                      />
                      {promoData.image ? (
                        <div className="flex flex-col items-center gap-2">
                          <img src={promoData.image} alt="Preview" className="w-24 h-16 object-cover rounded-xl border border-slate-200" />
                          <span className="text-[10px] font-semibold text-slate-500">Imagen seleccionada</span>
                          <button 
                            type="button" 
                            onClick={(e) => { e.stopPropagation(); setPromoData({ ...promoData, image: '' }); }}
                            className="text-[10px] text-rose-500 hover:underline font-bold z-20 relative"
                          >
                            Quitar Imagen
                          </button>
                        </div>
                      ) : (
                        <div className="text-center">
                          <span className="text-xs font-bold text-slate-700 block mb-0.5">Subir archivo de imagen</span>
                          <span className="text-[10px] text-slate-400 block">Arrastra aquí o haz clic para seleccionar</span>
                        </div>
                      )}
                    </div>

                    {/* Or URL input */}
                    <div className="flex items-center gap-2">
                      <div className="h-px bg-slate-200 flex-1" />
                      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">O ingresa una URL</span>
                      <div className="h-px bg-slate-200 flex-1" />
                    </div>

                    <input 
                      type="text" 
                      value={promoData.image.startsWith('data:image') ? '' : promoData.image} 
                      onChange={e => setPromoData({...promoData, image: e.target.value})} 
                      placeholder="https://images.unsplash.com/photo-..."
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium text-xs" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Texto del Botón de Acción</label>
                  <input 
                    type="text" 
                    value={promoData.actionText} 
                    onChange={e => setPromoData({...promoData, actionText: e.target.value})} 
                    placeholder="Ej: Pedir Combo - $14.99"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium text-sm" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Filtrar por Categoría</label>
                    <select 
                      value={promoData.filterCategory} 
                      onChange={e => setPromoData({...promoData, filterCategory: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium text-sm"
                    >
                      <option value="All">Todas las Categorías</option>
                      {Array.from(new Set(menu.map(item => item.category))).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Buscar Palabra Clave (Filtro)</label>
                    <input 
                      type="text" 
                      value={promoData.filterQuery} 
                      onChange={e => setPromoData({...promoData, filterQuery: e.target.value})} 
                      placeholder="Ej: Doble (Opcional)"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium text-sm" 
                    />
                  </div>
                </div>
              </div>

              <button 
                onClick={handleSavePromo} 
                className="w-full bg-black text-white p-4 rounded-xl font-bold hover:scale-[1.02] flex justify-center items-center gap-2"
              >
                <Save size={18} /> Guardar Promoción
              </button>
            </motion.div>
          </div>
        )}

      {activeTab === 'notifications' && (
        <div className="w-full max-w-3xl mx-auto bg-white rounded-[32px] p-6 sm:p-10 border border-slate-200/80 shadow-sm space-y-8">
          <h3 className="font-black text-lg mb-2 flex items-center gap-2">🔔 Centro de Alertas y Notificaciones</h3>
          <p className="text-xs text-slate-400 mb-6">Configura cómo deseas enterarte de las acciones del local en tiempo real (pedidos, cajas, inventario y asistencia).</p>
          
          <div className="space-y-6">
            {/* AUDIO & CHIME CONTROLS */}
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100/80">
              <h4 className="font-bold text-sm text-slate-950 mb-1 flex items-center gap-2">🎵 Sonidos del Sistema</h4>
              <p className="text-xs text-slate-400 mb-4">Reproduce un timbre chime de doble tono sintetizado en tiempo real cuando ocurra un evento importante.</p>
              
              <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <div>
                  <span className="font-bold text-xs text-slate-950 block">Habilitar Efectos de Sonido</span>
                  <span className="text-[10px] text-slate-400 block">Tocar un ping de alerta para cada nueva acción.</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      playNotificationSound();
                    }}
                    className="p-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                  >
                    Prueba 🔔
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !notifSound;
                      setNotifSound(next);
                      localStorage.setItem('notif_sound_enabled', String(next));
                      window.dispatchEvent(new Event('notif_pref_changed'));
                      playClickSound();
                    }}
                    className={`p-2.5 px-5 rounded-xl text-xs font-extrabold transition-all ${
                      notifSound 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {notifSound ? 'ACTIVO' : 'INACTIVO'}
                  </button>
                </div>
              </div>
            </div>

            {/* BROWSER DESKTOP PUSH */}
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100/80">
              <h4 className="font-bold text-sm text-slate-950 mb-1 flex items-center gap-2">💻 Notificaciones Push de Escritorio</h4>
              <p className="text-xs text-slate-400 mb-4">Recibe alertas directamente en tu pantalla incluso si la ventana está en segundo plano.</p>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <div>
                  <span className="font-bold text-xs text-slate-950 block">Estado de Permiso del Navegador</span>
                  <span className="text-[10px] text-slate-400 block">
                    {('Notification' in window) 
                      ? `Permiso actual: ${Notification.permission.toUpperCase()}`
                      : 'No soportado en este navegador'}
                  </span>
                </div>
                <div>
                  {('Notification' in window) && Notification.permission !== 'granted' ? (
                    <button
                      type="button"
                      onClick={async () => {
                        const perm = await Notification.requestPermission();
                        if (perm === 'granted') {
                          setNotifPush(true);
                          localStorage.setItem('notif_push_enabled', 'true');
                          window.dispatchEvent(new Event('notif_pref_changed'));
                          playSuccessSound();
                          new Notification('BistroFlow', { body: '¡Notificaciones push configuradas con éxito!' });
                        } else {
                          playErrorSound();
                          alert('Permiso denegado. Habilita las notificaciones en la barra de direcciones de tu navegador.');
                        }
                      }}
                      className="p-3 bg-black hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow"
                    >
                      Solicitar Permiso 📢
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const next = !notifPush;
                        setNotifPush(next);
                        localStorage.setItem('notif_push_enabled', String(next));
                        window.dispatchEvent(new Event('notif_pref_changed'));
                        playClickSound();
                      }}
                      className={`p-2.5 px-5 rounded-xl text-xs font-extrabold transition-all ${
                        notifPush 
                          ? 'bg-emerald-500 text-white' 
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {notifPush ? 'HABILITADO' : 'DESHABILITADO'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* CATEGORIES PREFERENCES */}
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100/80">
              <h4 className="font-bold text-sm text-slate-950 mb-1 flex items-center gap-2">⚙️ Filtro de Canales de Alerta</h4>
              <p className="text-xs text-slate-400 mb-4">Elige qué tipos de acciones deseas que generen notificaciones en tu terminal de control.</p>
              
              <div className="space-y-3">
                {/* Orders toggle */}
                <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                  <span className="font-bold text-xs text-slate-800">🛒 Nuevos Pedidos y Estados de Platillos</span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !notifOrders;
                      setNotifOrders(next);
                      localStorage.setItem('notif_pref_orders', String(next));
                      window.dispatchEvent(new Event('notif_pref_changed'));
                      playClickSound();
                    }}
                    className={`p-1.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                      notifOrders ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {notifOrders ? 'Vigilar' : 'Silenciar'}
                  </button>
                </div>

                {/* Finance toggle */}
                <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                  <span className="font-bold text-xs text-slate-800">💰 Reportes de Pago y Validaciones de Caja</span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !notifFinance;
                      setNotifFinance(next);
                      localStorage.setItem('notif_pref_finance', String(next));
                      window.dispatchEvent(new Event('notif_pref_changed'));
                      playClickSound();
                    }}
                    className={`p-1.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                      notifFinance ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {notifFinance ? 'Vigilar' : 'Silenciar'}
                  </button>
                </div>

                {/* Auth/attendance toggle */}
                <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                  <span className="font-bold text-xs text-slate-800">👤 Asistencia, Entradas y Salidas de Personal</span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !notifAuth;
                      setNotifAuth(next);
                      localStorage.setItem('notif_pref_auth', String(next));
                      window.dispatchEvent(new Event('notif_pref_changed'));
                      playClickSound();
                    }}
                    className={`p-1.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                      notifAuth ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {notifAuth ? 'Vigilar' : 'Silenciar'}
                  </button>
                </div>

                {/* System toggles */}
                <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                  <span className="font-bold text-xs text-slate-800">⚙️ Cambios de Configuración General y Kernel</span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !notifSystem;
                      setNotifSystem(next);
                      localStorage.setItem('notif_pref_system', String(next));
                      window.dispatchEvent(new Event('notif_pref_changed'));
                      playClickSound();
                    }}
                    className={`p-1.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                      notifSystem ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {notifSystem ? 'Vigilar' : 'Silenciar'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <button
              onClick={() => {
                playSuccessSound();
                alert('¡Preferencias de alertas y notificaciones configuradas con éxito!');
              }}
              className="w-full bg-black text-white p-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
            >
              <Save size={18} /> Guardar Preferencias de Alerta
            </button>
          </div>
        </div>
      )}

        {/* Table QR Detail Modal */}
        {selectedQRTable && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }} 
              className="bg-white rounded-[40px] p-8 w-full max-w-md shadow-2xl relative"
            >
              <button 
                onClick={() => { setSelectedQRTable(null); setCopiedTableId(null); }} 
                className="absolute top-6 right-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
              
              {/* Quick Toggle for QR Ordering inside Modal */}
              <div className="mb-6 bg-slate-50 border border-slate-200/80 p-4 rounded-2xl flex items-center justify-between gap-3 text-left">
                <div className="flex items-center gap-2.5">
                  <div className={`w-3 h-3 rounded-full shrink-0 ${qrOrderingEnabledInput ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      {qrOrderingEnabledInput ? 'Pedidos por QR Activados' : 'Pedidos por QR Desactivados'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {qrOrderingEnabledInput ? 'Los clientes pueden pedir directo desde la mesa' : 'Menú en modo catálogo informativo'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    const newValue = !qrOrderingEnabledInput;
                    setQrOrderingEnabledInput(newValue);
                    try {
                      await setDoc(doc(db, 'settings', 'restaurant'), { qrOrderingEnabled: newValue }, { merge: true });
                      await logAction('system', currentUser?.name || 'Administrador', 'Cambió estado de Pedidos QR', `Nuevos pedidos QR: ${newValue ? 'HABILITADO' : 'DESACTIVADO'}`);
                      playSuccessSound();
                    } catch (e) {
                      console.error('Error updating qrOrderingEnabled:', e);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-colors shrink-0 cursor-pointer ${
                    qrOrderingEnabledInput ? 'bg-rose-100 hover:bg-rose-200 text-rose-700' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                  }`}
                >
                  {qrOrderingEnabledInput ? 'Desactivar' : 'Activar'}
                </button>
              </div>

              {/* QR Code Printable placard preview */}
              <div id="qr-placard" className="border-2 border-slate-100 bg-slate-50 rounded-[32px] p-6 flex flex-col items-center text-center shadow-inner mb-6">
                <span className="font-extrabold text-base tracking-tight text-slate-900 mb-1">{settings?.restaurantName || 'BistroFlow'}</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-4">Menú Digital & Auto-servicio</span>
                
                <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200/30 mb-4 mix-blend-multiply">
                  <img 
                    src={getQRCodeUrl(window.location.origin + '/?table=' + selectedQRTable.id, 250)} 
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = getFallbackQRCodeUrl(window.location.origin + '/?table=' + selectedQRTable.id, 250);
                    }}
                    alt={`QR Code Mesa ${selectedQRTable.number}`} 
                    className="w-48 h-48"
                  />
                </div>

                <h4 className="font-black text-2xl tracking-tight uppercase">Mesa {selectedQRTable.number}</h4>
                <p className="text-xs font-semibold text-slate-400 mt-1 mb-4">Capacidad: {selectedQRTable.capacity} comensales</p>
                
                <div className="bg-white/80 border border-slate-200/40 p-3.5 rounded-2xl text-left w-full text-[11px] leading-relaxed text-slate-600 font-medium">
                  <strong className="block text-slate-900 mb-1 font-bold">¿Cómo funciona?</strong>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Abre la cámara de tu teléfono móvil.</li>
                    <li>Apunta y escanea el código QR.</li>
                    <li>Selecciona tus platillos, ingresa tu nombre y confirma la orden directo a cocina.</li>
                  </ol>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => {
                      const url = `${window.location.origin}/?table=${selectedQRTable.id}`;
                      navigator.clipboard.writeText(url);
                      setCopiedTableId(selectedQRTable.id);
                      setTimeout(() => setCopiedTableId(null), 2000);
                    }}
                    className="flex-1 py-3.5 px-4 bg-slate-50 border border-slate-100 hover:bg-slate-100 text-slate-900 rounded-2xl font-bold text-xs flex justify-center items-center gap-2 transition-all active:scale-[0.98]"
                  >
                    {copiedTableId === selectedQRTable.id ? (
                      <>
                        <Check size={16} className="text-emerald-500" /> Copiado!
                      </>
                    ) : (
                      <>
                        <Copy size={16} /> Copiar Enlace
                      </>
                    )}
                  </button>

                  <button 
                    onClick={() => {
                      const tableUrl = window.location.origin + '/?table=' + selectedQRTable.id;
                      const qrUrl = getQRCodeUrl(tableUrl, 350);
                      const printWindow = window.open('', '_blank');
                      if (printWindow) {
                        printWindow.document.write(`
                          <html>
                            <head>
                              <title>Mesa ${selectedQRTable.number} - QR BistroFlow</title>
                              <style>
                                body {
                                  font-family: system-ui, -apple-system, sans-serif;
                                  display: flex;
                                  flex-direction: column;
                                  align-items: center;
                                  justify-content: center;
                                  min-height: 100vh;
                                  margin: 0;
                                  background-color: #ffffff;
                                  color: #000000;
                                  text-align: center;
                                }
                                .card {
                                  border: 3px solid #000000;
                                  border-radius: 32px;
                                  padding: 40px;
                                  max-width: 450px;
                                  box-shadow: 0 10px 30px rgba(0,0,0,0.05);
                                }
                                .logo {
                                  font-weight: 900;
                                  font-size: 24px;
                                  letter-spacing: -0.05em;
                                  margin-bottom: 5px;
                                  text-transform: uppercase;
                                }
                                .tagline {
                                  font-size: 11px;
                                  font-weight: 700;
                                  text-transform: uppercase;
                                  letter-spacing: 0.1em;
                                  color: #64748b;
                                  margin-bottom: 30px;
                                }
                                .qr {
                                  width: 280px;
                                  height: 280px;
                                  margin-bottom: 30px;
                                }
                                .table-num {
                                  font-size: 40px;
                                  font-weight: 950;
                                  letter-spacing: -0.03em;
                                  margin: 0;
                                  text-transform: uppercase;
                                }
                                .capacity {
                                  font-size: 13px;
                                  font-weight: 600;
                                  color: #64748b;
                                  margin-top: 5px;
                                  margin-bottom: 30px;
                                }
                                .steps {
                                  font-size: 12px;
                                  font-weight: 500;
                                  color: #334155;
                                  text-align: left;
                                  display: inline-block;
                                  background: #f8fafc;
                                  padding: 20px 25px;
                                  border-radius: 16px;
                                  border: 1px solid #f1f5f9;
                                }
                                .steps ol {
                                  margin: 0;
                                  padding-left: 20px;
                                }
                                .steps li {
                                  margin-bottom: 6px;
                                }
                                .steps li:last-child {
                                  margin-bottom: 0;
                                }
                                @media print {
                                  body {
                                    min-height: auto;
                                  }
                                  .card {
                                    border: 2px solid #000000;
                                    box-shadow: none;
                                    page-break-inside: avoid;
                                  }
                                }
                              </style>
                            </head>
                            <body>
                              <div class="card">
                                <div class="logo">${settings?.restaurantName || 'BistroFlow'}</div>
                                <div class="tagline">Menú Digital y Auto-servicio QR</div>
                                <img class="qr" src="${qrUrl}" onerror="this.src='https://quickchart.io/qr?size=350&text=' + encodeURIComponent('${tableUrl}')" alt="QR Code" />
                                <h1 class="table-num font-weight: 950;">Mesa ${selectedQRTable.number}</h1>
                                <div class="capacity">Capacidad: ${selectedQRTable.capacity} Personas</div>
                                <div class="steps">
                                  <strong>¿Cómo ordenar?</strong>
                                  <ol>
                                    <li>Escanea el código QR con la cámara de tu celular.</li>
                                    <li>Explora nuestro menú interactivo.</li>
                                    <li>Agrega tus platillos, escribe tu nombre y envía a cocina.</li>
                                  </ol>
                                </div>
                              </div>
                              <script>
                                window.onload = function() {
                                  setTimeout(function() {
                                    window.print();
                                  }, 500);
                                };
                              </script>
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                      }
                    }}
                    className="flex-1 py-3.5 px-4 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-950 rounded-2xl font-bold text-xs flex justify-center items-center gap-2 transition-all active:scale-[0.98]"
                  >
                    <Printer size={16} className="text-indigo-600" /> Imprimir Placard
                  </button>
                </div>

                <a 
                  href={`${window.location.origin}/?table=${selectedQRTable.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-4 bg-black hover:bg-slate-900 text-white rounded-2xl font-bold text-xs flex justify-center items-center gap-2 transition-all active:scale-[0.98] text-center"
                >
                  <ExternalLink size={16} /> Abrir Portal de Clientes
                </a>
              </div>
            </motion.div>
          </div>
        )}

        {/* CREATE / EDIT DELIVERY ZONE MODAL */}
        {isCreatingZone && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-100"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                  <MapPin size={18} className="text-amber-600" />
                  {editingZone ? 'Editar Zona de Delivery' : 'Nueva Zona de Delivery'}
                </h3>
                <button 
                  onClick={() => setIsCreatingZone(false)}
                  className="p-1 text-slate-400 hover:text-black rounded-lg transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nombre de la Zona / Sector</label>
                  <input 
                    type="text" 
                    placeholder="Ej. Zona Altamira - Chacao"
                    value={zoneForm.name}
                    onChange={e => setZoneForm({ ...zoneForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 outline-none focus:border-black transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Costo Envío ($ USD)</label>
                    <input 
                      type="number" 
                      step="0.25"
                      placeholder="2.50"
                      value={zoneForm.priceUSD}
                      onChange={e => setZoneForm({ ...zoneForm, priceUSD: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 outline-none focus:border-black transition-colors"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Equivalente: ~{( (parseFloat(zoneForm.priceUSD) || 0) * exchangeRate ).toFixed(0)} Bs.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tiempo Estimado</label>
                    <input 
                      type="text" 
                      placeholder="Ej. 20-35 min"
                      value={zoneForm.estimatedTime}
                      onChange={e => setZoneForm({ ...zoneForm, estimatedTime: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 outline-none focus:border-black transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Sectores / Referencias Incluidas</label>
                  <textarea 
                    rows={2}
                    placeholder="Ej. Plaza Altamira, Los Palos Grandes, La Castellana, Av. Francisco de Miranda"
                    value={zoneForm.coveredAreas}
                    onChange={e => setZoneForm({ ...zoneForm, coveredAreas: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-black transition-colors resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingZone(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveZoneModal}
                  disabled={!zoneForm.name.trim()}
                  className="flex-1 py-3 bg-black hover:bg-slate-900 text-white rounded-xl font-bold text-xs transition-colors disabled:opacity-40 cursor-pointer"
                >
                  Guardar Zona
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
