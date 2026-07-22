import React, { useState, useEffect } from 'react';
import { collection, doc, updateDoc, addDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useRestaurantData } from '../hooks/useRestaurantData';
import { MenuItem, Table, Promotion } from '../types';
import { Settings, Plus, Save, Trash2, X, DollarSign, GripHorizontal, Tag, Sparkles, QrCode, Printer, Download, ExternalLink, Copy, Check, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { logAction } from '../lib/logger';
import { playNotificationSound, playSuccessSound, playErrorSound, playClickSound, playCashSound } from '../lib/audio';
import { getMenuItemStockAlert } from '../lib/stockUtils';
import { useBookmarks } from '../lib/bookmarks';

export default function MenuSettingsView({ currentUser }: { currentUser?: any }) {
  const { menu, tables, exchangeRate, settings, promotions, ingredients } = useRestaurantData();
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const [activeTab, setActiveTab] = useState<'menu' | 'tables' | 'general' | 'promotions' | 'payments' | 'notifications'>('menu');
  
  // Menu State
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isCreatingMenu, setIsCreatingMenu] = useState(false);
  const [menuData, setMenuData] = useState({ 
    name: '', 
    price: 0, 
    category: '', 
    image: '',
    scheduleType: 'always' as 'always' | 'breakfast' | 'lunch' | 'dinner' | 'custom',
    availableFrom: '',
    availableTo: '',
    alerts: [] as string[]
  });

  // Promotions State
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [isCreatingPromo, setIsCreatingPromo] = useState(false);
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

  // Restaurant General Info State
  const [restaurantNameInput, setRestaurantNameInput] = useState(settings?.restaurantName || 'BistroFlow');
  const [restaurantPhoneInput, setRestaurantPhoneInput] = useState(settings?.restaurantPhone || '+584121234567');
  const [restaurantAddressInput, setRestaurantAddressInput] = useState(settings?.restaurantAddress || 'Caracas, Venezuela');
  const [deliveryEnabledInput, setDeliveryEnabledInput] = useState(true);
  const [pickupEnabledInput, setPickupEnabledInput] = useState(true);
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

  useEffect(() => {
    setRateInput(exchangeRate.toString());
    setPagoMovilBancoInput(settings?.pagoMovilBanco || 'Banesco');
    setPagoMovilPhoneInput(settings?.pagoMovilPhone || '0412-1234567');
    setPagoMovilIdInput(settings?.pagoMovilId || 'V-12345678');
    setZelleEmailInput(settings?.zelleEmail || 'pagos@bistroflow.com');
    setZelleNameInput(settings?.zelleName || 'BistroFlow SL');
    setWhatsappPhoneInput(settings?.whatsappPhone || '+584121234567');
    setRestaurantNameInput(settings?.restaurantName || 'BistroFlow');
    setRestaurantPhoneInput(settings?.restaurantPhone || '+584121234567');
    setRestaurantAddressInput(settings?.restaurantAddress || 'Caracas, Venezuela');
    setDeliveryEnabledInput(settings?.deliveryEnabled !== undefined ? settings?.deliveryEnabled : true);
    setPickupEnabledInput(settings?.pickupEnabled !== undefined ? settings?.pickupEnabled : true);
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
  }, [exchangeRate, settings]);

  // MENU LOGIC
  const handleEditMenu = (item: MenuItem) => {
    setEditingItem(item); setIsCreatingMenu(false);
    setMenuData({ 
      name: item.name, 
      price: item.price, 
      category: item.category, 
      image: item.image || '',
      scheduleType: item.scheduleType || 'always',
      availableFrom: item.availableFrom || '',
      availableTo: item.availableTo || '',
      alerts: item.alerts || []
    });
  };
  const handleSaveMenu = async () => {
    try {
      const payload = {
        name: menuData.name,
        price: Number(menuData.price),
        category: menuData.category,
        image: menuData.image,
        scheduleType: menuData.scheduleType || 'always',
        availableFrom: menuData.availableFrom || '',
        availableTo: menuData.availableTo || '',
        alerts: menuData.alerts || []
      };
      if (isCreatingMenu) {
        await addDoc(collection(db, 'menu'), payload);
        await logAction('system', currentUser?.name || 'Administrador', 'Agregó plato al menú', `Plato: ${payload.name} - Precio: $${payload.price.toFixed(2)}`);
      } else if (editingItem) {
        await updateDoc(doc(db, 'menu', editingItem.id), payload);
        await logAction('system', currentUser?.name || 'Administrador', 'Editó plato del menú', `Plato: ${payload.name} - Precio anterior: $${editingItem.price.toFixed(2)} -> Nuevo: $${payload.price.toFixed(2)}`);
      }
      setEditingItem(null); setIsCreatingMenu(false);
    } catch (err) { alert('Error guardando los cambios'); }
  };
  const handleDeleteMenu = async (id: string) => {
    const item = menu.find(m => m.id === id);
    const itemName = item ? item.name : 'Desconocido';
    if(confirm('¿Eliminar este plato?')) {
      await deleteDoc(doc(db, 'menu', id));
      await logAction('system', currentUser?.name || 'Administrador', 'Eliminó plato del menú', `Plato: ${itemName}`);
    }
  };

  // TABLE LOGIC
  const handleEditTable = (t: Table) => {
    setEditingTable(t); setIsCreatingTable(false);
    setTableData({ number: t.number, capacity: t.capacity, status: t.status });
  };
  const handleSaveTable = async () => {
    try {
      if (isCreatingTable) {
        await addDoc(collection(db, 'tables'), { ...tableData, capacity: Number(tableData.capacity) });
        await logAction('system', currentUser?.name || 'Administrador', 'Agregó mesa', `Mesa ${tableData.number} - Capacidad: ${tableData.capacity}`);
      } else if (editingTable) {
        await updateDoc(doc(db, 'tables', editingTable.id), { ...tableData, capacity: Number(tableData.capacity) });
        await logAction('system', currentUser?.name || 'Administrador', 'Editó mesa', `Mesa anterior: ${editingTable.number} -> Nueva: ${tableData.number} (Capacidad: ${tableData.capacity})`);
      }
      setEditingTable(null); setIsCreatingTable(false);
    } catch (err) { alert('Error guardando mesa'); }
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
    try {
      if (isCreatingPromo) {
        await addDoc(collection(db, 'promotions'), promoData);
        await logAction('system', currentUser?.name || 'Administrador', 'Creó promoción', `Título: ${promoData.title}`);
      } else if (editingPromo) {
        await updateDoc(doc(db, 'promotions', editingPromo.id), promoData);
        await logAction('system', currentUser?.name || 'Administrador', 'Editó promoción', `Título: ${promoData.title}`);
      }
      setEditingPromo(null); setIsCreatingPromo(false);
    } catch (err) { alert('Error guardando la promoción'); }
  };
  const handleDeletePromo = async (id: string) => {
    const promo = promotions.find(p => p.id === id);
    const promoTitle = promo ? promo.title : 'Desconocido';
    if(confirm('¿Eliminar esta promoción?')) {
      await deleteDoc(doc(db, 'promotions', id));
      await logAction('system', currentUser?.name || 'Administrador', 'Eliminó promoción', `Título: ${promoTitle}`);
    }
  };

  // GENERAL LOGIC
  const handleSaveGeneralSettings = async () => {
    try {
      await setDoc(doc(db, 'settings', 'general'), {
        restaurantName: restaurantNameInput,
        restaurantPhone: restaurantPhoneInput,
        restaurantAddress: restaurantAddressInput,
        deliveryEnabled: deliveryEnabledInput,
        pickupEnabled: pickupEnabledInput,
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

  const handleSavePaymentSettings = async () => {
    try {
      await setDoc(doc(db, 'settings', 'general'), {
        exchangeRate: Number(rateInput),
        pagoMovilBanco: pagoMovilBancoInput,
        pagoMovilPhone: pagoMovilPhoneInput,
        pagoMovilId: pagoMovilIdInput,
        zelleEmail: zelleEmailInput,
        zelleName: zelleNameInput,
        whatsappPhone: whatsappPhoneInput
      }, { merge: true });

      const changes: string[] = [];
      if (settings?.exchangeRate !== Number(rateInput)) changes.push(`Tasa: ${rateInput} Bs.`);
      if (settings?.pagoMovilBanco !== pagoMovilBancoInput) changes.push(`PM Banco: ${pagoMovilBancoInput}`);
      if (settings?.pagoMovilPhone !== pagoMovilPhoneInput) changes.push(`PM Teléfono: ${pagoMovilPhoneInput}`);
      if (settings?.pagoMovilId !== pagoMovilIdInput) changes.push(`PM Cédula: ${pagoMovilIdInput}`);
      if (settings?.zelleEmail !== zelleEmailInput) changes.push(`Zelle Email: ${zelleEmailInput}`);
      if (settings?.zelleName !== zelleNameInput) changes.push(`Zelle Titular: ${zelleNameInput}`);
      if (settings?.whatsappPhone !== whatsappPhoneInput) changes.push(`WhatsApp: ${whatsappPhoneInput}`);

      const detailsStr = changes.length > 0 ? changes.join(' | ') : `Tasa: ${rateInput} Bs. | Banco: ${pagoMovilBancoInput}`;

      await logAction('system', currentUser?.name || 'Administrador', 'Actualizó métodos de pago y tasa', detailsStr);
      alert('Métodos de pago actualizados correctamente');
    } catch(err) { alert('Error guardando métodos de pago'); }
  };

  return (
    <div className="max-w-7xl mx-auto w-full pb-16 px-4 sm:px-6">
      <header className="mb-8 border-b border-slate-200/60 pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:pr-40">
        <div>
          <span className="text-[10px] uppercase tracking-widest font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 inline-block mb-1.5">
            Administración del Establecimiento
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">Configuración del Local</h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">Gestiona el menú, mesas, promociones y configuración general.</p>
        </div>
        {activeTab === 'menu' && (
          <div className="flex items-center gap-2.5 shrink-0">
            <button 
              onClick={() => { setIsCreatingMenu(true); setMenuData({ name: '', price: 0, category: 'Hamburguesas', image: '', scheduleType: 'always', availableFrom: '', availableTo: '', alerts: [] }); }} 
              className="flex items-center gap-2 px-5 py-2.5 bg-black hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Plus size={16} />
              <span>Nuevo Platillo</span>
            </button>
          </div>
        )}
      </header>

      <div className="flex gap-2 border-b border-slate-200 mb-8 overflow-x-auto">
        <button onClick={() => setActiveTab('menu')} className={`pb-3 px-4 text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'menu' ? 'border-b-2 border-black text-black' : 'text-slate-400 hover:text-black'}`}>Menú</button>
        <button onClick={() => setActiveTab('tables')} className={`pb-3 px-4 text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'tables' ? 'border-b-2 border-black text-black' : 'text-slate-400 hover:text-black'}`}>Mesas</button>
        <button onClick={() => setActiveTab('promotions')} className={`pb-3 px-4 text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'promotions' ? 'border-b-2 border-black text-black' : 'text-slate-400 hover:text-black'}`}>Promociones y Banners</button>
        <button onClick={() => setActiveTab('general')} className={`pb-3 px-4 text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'general' ? 'border-b-2 border-black text-black' : 'text-slate-400 hover:text-black'}`}>Configuración General</button>
        <button onClick={() => setActiveTab('payments')} className={`pb-3 px-4 text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'payments' ? 'border-b-2 border-black text-black' : 'text-slate-400 hover:text-black'}`}>Métodos de Pago</button>
        <button onClick={() => setActiveTab('notifications')} className={`pb-3 px-4 text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'notifications' ? 'border-b-2 border-black text-black' : 'text-slate-400 hover:text-black'}`}>🔔 Alertas y Notificaciones</button>
      </div>

      {activeTab === 'menu' && (
        <>
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
                  {item.alerts && item.alerts.length > 0 && (
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

                <div className="flex gap-2 border-t border-slate-50 pt-4">
                  <button onClick={() => handleEditMenu(item)} className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-[10px] uppercase tracking-widest py-3 rounded-xl transition-colors">Editar</button>
                  <button onClick={() => handleDeleteMenu(item.id)} className="w-12 flex items-center justify-center bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-xl transition-colors"><Trash2 size={16} /></button>
                </div>
              </div>
            );
          })}
          </div>
        </>
      )}

      {activeTab === 'tables' && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-slate-500 text-xs">Administra tus mesas y haz clic en sus códigos QR para imprimirlos o compartirlos con tus clientes.</p>
            </div>
            <button onClick={() => { setIsCreatingTable(true); setTableData({ number: '', capacity: 4, status: 'free' }); }} className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-2xl font-bold text-sm shadow-lg shadow-black/10 hover:scale-105 transition-all self-end sm:self-auto">
              <Plus size={18} /> Nueva Mesa
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {tables.map(t => {
              const qrUrl = `${window.location.origin}/?table=${t.id}`;
              const chartApiUrl = `https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=${encodeURIComponent(qrUrl)}`;
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
                        src={chartApiUrl} 
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
        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm max-w-2xl">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2">🏢 Información del Restaurante</h3>
          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Nombre del Restaurante</label>
              <input 
                type="text" 
                value={restaurantNameInput}
                onChange={e => setRestaurantNameInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium transition-colors text-sm"
                placeholder="Nombre comercial"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Este nombre aparecerá como el título principal en la web de tus clientes y el panel de administración.</span>
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

                {/* Delivery Toggle */}
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

      {activeTab === 'payments' && (
        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm max-w-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-bold text-lg mb-6 flex items-center gap-2"><DollarSign /> Moneda y Cambio</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Tasa de Cambio (Bolívares por $)</label>
                  <input 
                    type="number" 
                    value={rateInput}
                    onChange={e => setRateInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">WhatsApp del Local (Formato Internacional)</label>
                  <input 
                    type="text" 
                    value={whatsappPhoneInput}
                    onChange={e => setWhatsappPhoneInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium transition-colors"
                    placeholder="+584121234567"
                  />
                </div>
              </div>

              <h3 className="font-bold text-lg mt-8 mb-6 flex items-center gap-2">📧 Cuenta Zelle</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Correo Zelle</label>
                  <input 
                    type="text" 
                    value={zelleEmailInput}
                    onChange={e => setZelleEmailInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium transition-colors"
                    placeholder="pagos@bistroflow.com"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Nombre del Titular</label>
                  <input 
                    type="text" 
                    value={zelleNameInput}
                    onChange={e => setZelleNameInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium transition-colors"
                    placeholder="BistroFlow SL"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-6 flex items-center gap-2">📱 Pago Móvil</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Banco</label>
                  <input 
                    type="text" 
                    value={pagoMovilBancoInput}
                    onChange={e => setPagoMovilBancoInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium transition-colors"
                    placeholder="Banesco"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Teléfono</label>
                  <input 
                    type="text" 
                    value={pagoMovilPhoneInput}
                    onChange={e => setPagoMovilPhoneInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium transition-colors"
                    placeholder="0412-1234567"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Cédula / RIF</label>
                  <input 
                    type="text" 
                    value={pagoMovilIdInput}
                    onChange={e => setPagoMovilIdInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-black font-medium transition-colors"
                    placeholder="V-12345678"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <button onClick={handleSavePaymentSettings} className="w-full bg-black text-white p-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform">
              <Save size={18} /> Guardar Métodos de Pago
            </button>
          </div>
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

      {/* MODALS */}
      <AnimatePresence>
        {(editingItem || isCreatingMenu) && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[40px] p-8 w-full max-w-md shadow-2xl relative">
              <button onClick={() => { setEditingItem(null); setIsCreatingMenu(false); }} className="absolute top-6 right-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400"><X size={20} /></button>
              <h3 className="text-xl font-bold mb-6">{isCreatingMenu ? 'Nuevo Platillo' : 'Editar Platillo'}</h3>
              <div className="space-y-4 mb-8">
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
              </div>
              <button onClick={handleSaveMenu} className="w-full bg-black text-white p-4 rounded-xl font-bold hover:scale-[1.02] flex justify-center gap-2"><Save size={18}/> Guardar Cambios</button>
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
        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm max-w-2xl">
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
              
              <div className="text-center mb-6">
                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">Autoservicio Mesa</span>
                <h3 className="text-2xl font-black mt-2 tracking-tight">Código QR de Mesa {selectedQRTable.number}</h3>
                <p className="text-xs text-slate-400 mt-1">Comparte o imprime el código QR para que los clientes ordenen desde su mesa.</p>
              </div>

              {/* QR Code Printable placard preview */}
              <div id="qr-placard" className="border-2 border-slate-100 bg-slate-50 rounded-[32px] p-6 flex flex-col items-center text-center shadow-inner mb-6">
                <span className="font-extrabold text-base tracking-tight text-slate-900 mb-1">{settings?.restaurantName || 'BistroFlow'}</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-4">Menú Digital & Auto-servicio</span>
                
                <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200/30 mb-4 mix-blend-multiply">
                  <img 
                    src={`https://chart.googleapis.com/chart?cht=qr&chs=250x250&chl=${encodeURIComponent(window.location.origin + '/?table=' + selectedQRTable.id)}`} 
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
                      const qrUrl = `https://chart.googleapis.com/chart?cht=qr&chs=350x350&chl=${encodeURIComponent(window.location.origin + '/?table=' + selectedQRTable.id)}`;
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
                                <img class="qr" src="${qrUrl}" alt="QR Code" />
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
      </AnimatePresence>
    </div>
  );
}
