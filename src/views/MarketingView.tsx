import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useRestaurantData, DEFAULT_COUPONS, DEFAULT_FLASH_DEALS } from '../hooks/useRestaurantData';
import { Coupon, FlashDeal, MenuItem } from '../types';
import { useCurrency } from '../context/CurrencyContext';
import { logAction } from '../lib/logger';
import { playClickSound, playSuccessSound, playErrorSound } from '../lib/audio';
import { 
  Zap, 
  Tag, 
  Ticket, 
  Clock, 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  Copy, 
  Calendar, 
  Sparkles, 
  TrendingUp, 
  ShoppingBag, 
  Percent, 
  DollarSign, 
  AlertCircle, 
  X, 
  Flame, 
  Share2, 
  Eye, 
  CheckCircle2,
  Users,
  Search,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function MarketingView({ currentUser }: { currentUser?: any }) {
  const { coupons, flashDeals, menu, settings } = useRestaurantData();
  const { formatPrice, formatBs, toBolivares, currencySymbol, activeCurrency } = useCurrency();

  const [activeTab, setActiveTab] = useState<'flash_deals' | 'coupons' | 'analytics'>('flash_deals');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // FLASH DEALS MODAL & FORM STATE
  const [isFlashModalOpen, setIsFlashModalOpen] = useState(false);
  const [editingFlashDeal, setEditingFlashDeal] = useState<FlashDeal | null>(null);
  const [flashForm, setFlashForm] = useState({
    title: '',
    subtitle: '',
    description: '',
    badge: '⚡ VENTA FLASH',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 20,
    appliesTo: 'all' as 'all' | 'category' | 'items',
    targetCategory: '',
    targetItemIds: [] as string[],
    startsAt: new Date().toISOString().slice(0, 16),
    endsAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 16),
    status: 'active' as FlashDeal['status']
  });

  // COUPONS MODAL & FORM STATE
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [couponForm, setCouponForm] = useState({
    code: '',
    title: '',
    description: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 15,
    minSpend: 10,
    maxDiscount: 15,
    usageLimit: 100,
    perUserLimit: 1,
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    startsAt: new Date().toISOString().slice(0, 16),
    status: 'active' as Coupon['status'],
    applicableChannel: 'all' as 'all' | 'delivery' | 'dine-in'
  });

  // Timer tick for live countdowns
  const [currentTime, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Copy code helper
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    playClickSound();
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Generate random coupon code
  const handleGenerateRandomCode = () => {
    const prefixes = ['BISTRO', 'BURGER', 'PROMO', 'FLASH', 'VIP', 'OFF'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(10 + Math.random() * 90);
    setCouponForm(prev => ({ ...prev, code: `${prefix}${num}` }));
    playClickSound();
  };

  // OPEN FLASH MODAL
  const handleOpenCreateFlash = () => {
    setEditingFlashDeal(null);
    setFlashForm({
      title: '',
      subtitle: '',
      description: '',
      badge: '⚡ FLASH DEAL 25%',
      image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
      discountType: 'percentage',
      discountValue: 25,
      appliesTo: 'all',
      targetCategory: menu[0]?.category || '',
      targetItemIds: [],
      startsAt: new Date().toISOString().slice(0, 16),
      endsAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 16),
      status: 'active'
    });
    setIsFlashModalOpen(true);
  };

  const handleOpenEditFlash = (deal: FlashDeal) => {
    setEditingFlashDeal(deal);
    setFlashForm({
      title: deal.title,
      subtitle: deal.subtitle || '',
      description: deal.description || '',
      badge: deal.badge || '⚡ OFERTA LIMITADA',
      image: deal.image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
      discountType: deal.discountType,
      discountValue: deal.discountValue,
      appliesTo: deal.appliesTo,
      targetCategory: deal.targetCategory || '',
      targetItemIds: deal.targetItemIds || [],
      startsAt: deal.startsAt.slice(0, 16),
      endsAt: deal.endsAt.slice(0, 16),
      status: deal.status
    });
    setIsFlashModalOpen(true);
  };

  // SAVE FLASH DEAL
  const handleSaveFlashDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flashForm.title.trim()) {
      alert('Por favor asigna un título a la oferta flash.');
      return;
    }

    try {
      const payload: Omit<FlashDeal, 'id'> = {
        title: flashForm.title.trim(),
        subtitle: flashForm.subtitle.trim(),
        description: flashForm.description.trim(),
        badge: flashForm.badge.trim(),
        image: flashForm.image.trim(),
        discountType: flashForm.discountType,
        discountValue: Number(flashForm.discountValue) || 0,
        appliesTo: flashForm.appliesTo,
        targetCategory: flashForm.appliesTo === 'category' ? flashForm.targetCategory : undefined,
        targetItemIds: flashForm.appliesTo === 'items' ? flashForm.targetItemIds : undefined,
        startsAt: new Date(flashForm.startsAt).toISOString(),
        endsAt: new Date(flashForm.endsAt).toISOString(),
        status: flashForm.status,
        createdAt: editingFlashDeal ? editingFlashDeal.createdAt : new Date().toISOString()
      };

      if (editingFlashDeal) {
        await updateDoc(doc(db, 'flash_deals', editingFlashDeal.id), payload);
        await logAction('system', currentUser?.name || 'Admin', 'Actualizó oferta flash', `Título: ${payload.title} (-${payload.discountValue}${payload.discountType === 'percentage' ? '%' : '$'})`);
      } else {
        await addDoc(collection(db, 'flash_deals'), payload);
        await logAction('system', currentUser?.name || 'Admin', 'Creó nueva oferta flash', `Título: ${payload.title} (-${payload.discountValue}${payload.discountType === 'percentage' ? '%' : '$'})`);
      }

      setIsFlashModalOpen(false);
      playSuccessSound();
    } catch (err) {
      console.error('Error saving flash deal:', err);
      playErrorSound();
      alert('Error guardando la oferta flash.');
    }
  };

  // DELETE FLASH DEAL
  const handleDeleteFlashDeal = async (id: string, title: string) => {
    if (confirm(`¿Estás seguro de eliminar la oferta flash "${title}"?`)) {
      try {
        await deleteDoc(doc(db, 'flash_deals', id));
        await logAction('system', currentUser?.name || 'Admin', 'Eliminó oferta flash', `Título: ${title}`);
        playClickSound();
      } catch (err) {
        console.error('Error deleting flash deal:', err);
      }
    }
  };

  // TOGGLE FLASH STATUS
  const handleToggleFlashStatus = async (deal: FlashDeal) => {
    try {
      const nextStatus = deal.status === 'active' ? 'paused' : 'active';
      await updateDoc(doc(db, 'flash_deals', deal.id), { status: nextStatus });
      playClickSound();
    } catch (err) {
      console.error('Error toggling flash deal:', err);
    }
  };

  // OPEN COUPON MODAL
  const handleOpenCreateCoupon = () => {
    setEditingCoupon(null);
    setCouponForm({
      code: 'BISTRO' + Math.floor(10 + Math.random() * 90),
      title: '',
      description: '',
      discountType: 'percentage',
      discountValue: 15,
      minSpend: 10,
      maxDiscount: 15,
      usageLimit: 100,
      perUserLimit: 1,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      startsAt: new Date().toISOString().slice(0, 16),
      status: 'active',
      applicableChannel: 'all'
    });
    setIsCouponModalOpen(true);
  };

  const handleOpenEditCoupon = (c: Coupon) => {
    setEditingCoupon(c);
    setCouponForm({
      code: c.code,
      title: c.title,
      description: c.description || '',
      discountType: c.discountType,
      discountValue: c.discountValue,
      minSpend: c.minSpend || 0,
      maxDiscount: c.maxDiscount || 0,
      usageLimit: c.usageLimit || 100,
      perUserLimit: c.perUserLimit || 1,
      expiresAt: (c.expiresAt || new Date().toISOString()).slice(0, 16),
      startsAt: (c.startsAt || new Date().toISOString()).slice(0, 16),
      status: c.status,
      applicableChannel: c.applicableChannel || 'all'
    });
    setIsCouponModalOpen(true);
  };

  // SAVE COUPON
  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = couponForm.code.trim().toUpperCase().replace(/\s+/g, '');
    if (!cleanCode) {
      alert('Por favor ingresa un código de cupón válido.');
      return;
    }
    if (!couponForm.title.trim()) {
      alert('Por favor ingresa un título para el cupón.');
      return;
    }

    try {
      const payload: Omit<Coupon, 'id'> = {
        code: cleanCode,
        title: couponForm.title.trim(),
        description: couponForm.description.trim(),
        discountType: couponForm.discountType,
        discountValue: Number(couponForm.discountValue) || 0,
        minSpend: Number(couponForm.minSpend) || 0,
        maxDiscount: couponForm.maxDiscount ? Number(couponForm.maxDiscount) : undefined,
        usageLimit: couponForm.usageLimit ? Number(couponForm.usageLimit) : null,
        usedCount: editingCoupon ? editingCoupon.usedCount : 0,
        perUserLimit: Number(couponForm.perUserLimit) || 1,
        expiresAt: new Date(couponForm.expiresAt).toISOString(),
        startsAt: new Date(couponForm.startsAt).toISOString(),
        status: couponForm.status,
        applicableChannel: couponForm.applicableChannel,
        createdAt: editingCoupon ? editingCoupon.createdAt : new Date().toISOString()
      };

      if (editingCoupon) {
        await updateDoc(doc(db, 'coupons', editingCoupon.id), payload);
        await logAction('system', currentUser?.name || 'Admin', 'Actualizó cupón de descuento', `Código: ${payload.code}`);
      } else {
        await addDoc(collection(db, 'coupons'), payload);
        await logAction('system', currentUser?.name || 'Admin', 'Creó nuevo cupón de descuento', `Código: ${payload.code}`);
      }

      setIsCouponModalOpen(false);
      playSuccessSound();
    } catch (err) {
      console.error('Error saving coupon:', err);
      playErrorSound();
      alert('Error guardando el cupón.');
    }
  };

  // DELETE COUPON
  const handleDeleteCoupon = async (id: string, code: string) => {
    if (confirm(`¿Estás seguro de eliminar el cupón "${code}"?`)) {
      try {
        await deleteDoc(doc(db, 'coupons', id));
        await logAction('system', currentUser?.name || 'Admin', 'Eliminó cupón de descuento', `Código: ${code}`);
        playClickSound();
      } catch (err) {
        console.error('Error deleting coupon:', err);
      }
    }
  };

  // TOGGLE COUPON STATUS
  const handleToggleCouponStatus = async (c: Coupon) => {
    try {
      const nextStatus = c.status === 'active' ? 'paused' : 'active';
      await updateDoc(doc(db, 'coupons', c.id), { status: nextStatus });
      playClickSound();
    } catch (err) {
      console.error('Error toggling coupon status:', err);
    }
  };

  // Countdown formatter helper
  const getRemainingTime = (endsAt: string, startsAt?: string) => {
    const end = new Date(endsAt).getTime();
    const start = startsAt ? new Date(startsAt).getTime() : 0;
    
    if (start > currentTime) {
      const diff = start - currentTime;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return { status: 'scheduled', text: `Inicia en ${hours}h ${mins}m` };
    }

    if (end < currentTime) {
      return { status: 'expired', text: 'Oferta Finalizada' };
    }

    const diff = end - currentTime;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);

    return { 
      status: 'active', 
      text: `${String(hours).padStart(2, '0')}h : ${String(mins).padStart(2, '0')}m : ${String(secs).padStart(2, '0')}s`,
      hours, mins, secs
    };
  };

  // Stats calculation
  const totalCouponsUsed = coupons.reduce((sum, c) => sum + (c.usedCount || 0), 0);
  const activeFlashCount = flashDeals.filter(d => d.status === 'active' && new Date(d.endsAt).getTime() > currentTime).length;
  const activeCouponsCount = coupons.filter(c => c.status === 'active' && (!c.expiresAt || new Date(c.expiresAt).getTime() > currentTime)).length;

  return (
    <div className="w-full flex-1 flex flex-col space-y-6 pb-12 min-h-full">
      {/* Top Header */}
      <header className="border-b border-slate-200/60 pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
        <div>
          <span className="text-[10px] uppercase tracking-widest font-black text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-100 inline-block mb-1.5">
            Módulo de Crecimiento y Fidelización
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <Flame className="text-rose-500 fill-rose-500" size={28} />
            <span>Marketing, Descuentos & Cupones</span>
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Crea ofertas especiales por tiempo limitado con temporizador en vivo y cupones de descuento automáticos.
          </p>
        </div>

        {/* Global Quick Action */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {activeTab === 'flash_deals' ? (
            <button
              onClick={handleOpenCreateFlash}
              className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs shadow-md shadow-rose-600/20 hover:scale-105 transition-all cursor-pointer"
            >
              <Zap size={16} />
              + Crear Descuento Flash
            </button>
          ) : (
            <button
              onClick={handleOpenCreateCoupon}
              className="flex items-center gap-2 px-5 py-2.5 bg-black hover:bg-slate-800 text-white rounded-2xl font-black text-xs shadow-md shadow-black/10 hover:scale-105 transition-all cursor-pointer"
            >
              <Plus size={16} />
              + Crear Nuevo Cupón
            </button>
          )}
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <Zap size={24} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Ofertas Flash Vivas</span>
            <span className="text-2xl font-black text-slate-900">{activeFlashCount}</span>
            <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">Con cuenta regresiva activa</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Ticket size={24} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Cupones Activos</span>
            <span className="text-2xl font-black text-slate-900">{activeCouponsCount}</span>
            <span className="text-[10px] text-indigo-600 font-bold block mt-0.5">Disponibles para canje</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Users size={24} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Canjes Totales</span>
            <span className="text-2xl font-black text-slate-900">{totalCouponsUsed}</span>
            <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Clientes beneficiados</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Percent size={24} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Canal Delivery & Salón</span>
            <span className="text-xl font-black text-slate-900">100% Sincronizado</span>
            <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">Validación server-side</span>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-200/80 gap-2 sm:gap-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('flash_deals')}
          className={`pb-3 px-3 sm:px-4 text-xs sm:text-sm font-black whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'flash_deals'
              ? 'border-b-2 border-rose-600 text-rose-600'
              : 'text-slate-400 hover:text-slate-800'
          }`}
        >
          <Zap size={16} />
          <span>Ofertas por Tiempo Limitado (Flash Deals)</span>
          <span className="text-[10px] px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full font-bold">
            {flashDeals.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('coupons')}
          className={`pb-3 px-3 sm:px-4 text-xs sm:text-sm font-black whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'coupons'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-400 hover:text-slate-800'
          }`}
        >
          <Ticket size={16} />
          <span>Cupones de Descuento Promocionales</span>
          <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-bold">
            {coupons.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 px-3 sm:px-4 text-xs sm:text-sm font-black whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'analytics'
              ? 'border-b-2 border-black text-black'
              : 'text-slate-400 hover:text-slate-800'
          }`}
        >
          <TrendingUp size={16} />
          <span>Métricas & Retorno</span>
        </button>
      </div>

      {/* TAB 1: FLASH DEALS (DESCUENTOS POR TIEMPO LIMITADO) */}
      {activeTab === 'flash_deals' && (
        <div className="space-y-6 flex-1 flex flex-col">
          <div className="bg-rose-50/60 border border-rose-100 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-black shrink-0">
                ⚡
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">
                  ¿Cómo funcionan las Ofertas Flash por Tiempo Limitado?
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
                  Aparecen en la parte superior del menú con un <strong>reloj de cuenta regresiva en vivo</strong>. Al cumplirse el plazo programado, la oferta expira automáticamente sin intervención manual.
                </p>
              </div>
            </div>

            <button
              onClick={handleOpenCreateFlash}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs shrink-0 cursor-pointer"
            >
              + Nueva Oferta Flash
            </button>
          </div>

          {flashDeals.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 p-8 space-y-4 flex-1 flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto">
                <Zap size={32} />
              </div>
              <h3 className="font-extrabold text-slate-800 text-lg">No hay ofertas flash configuradas</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Crea tu primera promoción por tiempo limitado para incentivar las ventas en horarios de baja demanda.
              </p>
              <button
                onClick={handleOpenCreateFlash}
                className="px-5 py-2.5 bg-rose-600 text-white rounded-2xl font-black text-xs hover:scale-105 transition-all"
              >
                Crear Oferta Flash Ahora
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-6 w-full flex-1">
              {flashDeals.map(deal => {
                const timerInfo = getRemainingTime(deal.endsAt, deal.startsAt);
                const isDealActive = deal.status === 'active' && timerInfo.status === 'active';

                return (
                  <div
                    key={deal.id}
                    className={`bg-white rounded-[32px] border overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between ${
                      isDealActive ? 'border-rose-200 ring-2 ring-rose-500/10' : 'border-slate-200 opacity-80'
                    }`}
                  >
                    <div>
                      {/* Image Header with Countdown Overlay */}
                      <div className="relative aspect-video bg-slate-100 overflow-hidden group">
                        <img
                          src={deal.image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800'}
                          alt={deal.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                        {/* Top Badges */}
                        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
                            <Zap size={12} />
                            {deal.badge || 'FLASH DEAL'}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleToggleFlashStatus(deal)}
                            className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full shadow-md transition-colors cursor-pointer ${
                              deal.status === 'active' ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-200'
                            }`}
                          >
                            {deal.status === 'active' ? '● ACTIVO' : '○ PAUSADO'}
                          </button>
                        </div>

                        {/* Bottom Live Countdown Overlay */}
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                          <div className="bg-black/80 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/20 flex items-center gap-2">
                            <Clock size={14} className={isDealActive ? 'text-amber-400 animate-spin' : 'text-slate-400'} />
                            <span className="font-mono font-black text-xs">
                              {timerInfo.text}
                            </span>
                          </div>

                          <span className="text-xs font-black bg-rose-500/90 px-2.5 py-1 rounded-xl">
                            {deal.discountType === 'percentage' ? `-${deal.discountValue}%` : `-$${deal.discountValue}`}
                          </span>
                        </div>
                      </div>

                      {/* Content Area */}
                      <div className="p-5 space-y-3">
                        <div>
                          <h4 className="font-extrabold text-slate-900 text-base leading-tight">
                            {deal.title}
                          </h4>
                          {deal.subtitle && (
                            <p className="text-xs text-rose-600 font-bold mt-0.5">{deal.subtitle}</p>
                          )}
                          {deal.description && (
                            <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                              {deal.description}
                            </p>
                          )}
                        </div>

                        {/* Conditions and Target */}
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold uppercase text-slate-400">Aplica a:</span>
                            <span className="font-bold text-slate-800">
                              {deal.appliesTo === 'all' && 'Todo el Menú'}
                              {deal.appliesTo === 'category' && `Categoría: ${deal.targetCategory || 'Todas'}`}
                              {deal.appliesTo === 'items' && `${deal.targetItemIds?.length || 0} productos específicos`}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold uppercase text-slate-400">Vigencia:</span>
                            <span className="text-[11px] font-medium text-slate-600">
                              {new Date(deal.startsAt).toLocaleDateString('es-VE')} → {new Date(deal.endsAt).toLocaleDateString('es-VE')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="p-4 pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenEditFlash(deal)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 size={13} />
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteFlashDeal(deal.id, deal.title)}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 size={13} />
                        Eliminar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: COUPONS (CUPONES DE DESCUENTO) */}
      {activeTab === 'coupons' && (
        <div className="space-y-6 flex-1 flex flex-col">
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shrink-0">
                🎟️
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">
                  Sistema de Cupones Promocionales (Delivery y Salón)
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
                  Tus clientes y meseros pueden ingresar el código al pagar. El sistema valida consumo mínimo, fecha de expiración y tope de descuento en la moneda activa.
                </p>
              </div>
            </div>

            <button
              onClick={handleOpenCreateCoupon}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs shrink-0 cursor-pointer"
            >
              + Crear Cupón
            </button>
          </div>

          {coupons.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 p-8 space-y-4 flex-1 flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto">
                <Ticket size={32} />
              </div>
              <h3 className="font-extrabold text-slate-800 text-lg">No hay cupones creados</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Diseña códigos de descuento para premiar a clientes habituales o realizar campañas en redes sociales.
              </p>
              <button
                onClick={handleOpenCreateCoupon}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-2xl font-black text-xs hover:scale-105 transition-all"
              >
                Crear Mi Primer Cupón
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-6 w-full flex-1">
              {coupons.map(coupon => {
                const isExpired = coupon.expiresAt && new Date(coupon.expiresAt).getTime() < currentTime;
                const isDepleted = coupon.usageLimit && (coupon.usedCount || 0) >= coupon.usageLimit;
                const isActive = coupon.status === 'active' && !isExpired && !isDepleted;

                return (
                  <div
                    key={coupon.id}
                    className={`bg-white rounded-[32px] p-6 border shadow-xs hover:shadow-md transition-all flex flex-col justify-between ${
                      isActive ? 'border-slate-200' : 'border-slate-200 bg-slate-50/60 opacity-75'
                    }`}
                  >
                    <div className="space-y-4">
                      {/* Code Banner */}
                      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-xl font-mono font-black text-sm flex items-center gap-1.5 tracking-wider">
                            <span>{coupon.code}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(coupon.code)}
                              className="text-indigo-400 hover:text-indigo-700 transition-colors ml-1"
                              title="Copiar código"
                            >
                              {copiedCode === coupon.code ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            </button>
                          </div>

                          <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                            isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {isExpired ? 'Expirado' : isDepleted ? 'Agotado' : coupon.status === 'active' ? 'Activo' : 'Pausado'}
                          </span>
                        </div>

                        {/* Switch */}
                        <button
                          type="button"
                          onClick={() => handleToggleCouponStatus(coupon)}
                          className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                            coupon.status === 'active' ? 'bg-emerald-600' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                              coupon.status === 'active' ? 'transform translate-x-5' : ''
                            }`}
                          />
                        </button>
                      </div>

                      {/* Title & Discount Highlight */}
                      <div>
                        <div className="flex items-baseline justify-between gap-2">
                          <h4 className="font-extrabold text-slate-900 text-base leading-snug">
                            {coupon.title}
                          </h4>
                          <span className="text-xl font-black text-rose-600 shrink-0">
                            {coupon.discountType === 'percentage' ? `${coupon.discountValue}% OFF` : `-$${coupon.discountValue}`}
                          </span>
                        </div>
                        {coupon.description && (
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            {coupon.description}
                          </p>
                        )}
                      </div>

                      {/* Conditions list */}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs text-slate-600">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Consumo Mínimo:</span>
                          <span className="font-bold text-slate-800">
                            {coupon.minSpend ? formatPrice(coupon.minSpend) : 'Sin mínimo'}
                          </span>
                        </div>

                        {coupon.maxDiscount && (
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] uppercase font-bold text-slate-400">Tope Máximo:</span>
                            <span className="font-bold text-slate-800">
                              {formatPrice(coupon.maxDiscount)}
                            </span>
                          </div>
                        )}

                        <div className="flex justify-between items-center">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Canal:</span>
                          <span className="font-bold text-slate-800 capitalize">
                            {coupon.applicableChannel === 'delivery' ? 'Solo Delivery' : coupon.applicableChannel === 'dine-in' ? 'Solo Salón' : 'Delivery y Salón'}
                          </span>
                        </div>

                        {/* Usage Counter Bar */}
                        <div className="pt-2 border-t border-slate-200/50">
                          <div className="flex justify-between text-[10px] font-bold mb-1">
                            <span className="text-slate-400 uppercase">Canjes realizados:</span>
                            <span className="text-indigo-600">
                              {coupon.usedCount || 0} {coupon.usageLimit ? `/ ${coupon.usageLimit}` : 'usos'}
                            </span>
                          </div>
                          {coupon.usageLimit && (
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-indigo-600 h-full rounded-full transition-all"
                                style={{ width: `${Math.min(100, ((coupon.usedCount || 0) / coupon.usageLimit) * 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Expiration date */}
                      {coupon.expiresAt && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <Calendar size={13} />
                          <span>Válido hasta: {new Date(coupon.expiresAt).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenEditCoupon(coupon)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 size={13} />
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteCoupon(coupon.id, coupon.code)}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 size={13} />
                        Eliminar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ANALYTICS & STRATEGY */}
      {activeTab === 'analytics' && (
        <div className="space-y-6 flex-1 flex flex-col">
          <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-slate-100 shadow-xs space-y-6 flex-1">
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="text-amber-500" size={22} />
              <span>Estrategia de Promociones Recomendada para BistroFlow</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                <span className="text-[10px] uppercase font-black tracking-widest text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full inline-block">
                  Paso 1: Adquisición
                </span>
                <h4 className="font-extrabold text-slate-900 text-sm">Cupón de Bienvenida</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Crea un cupón permanente como <strong>BIENVENIDO</strong> con 15% de descuento en la primera orden para nuevos clientes por WhatsApp y QR.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                <span className="text-[10px] uppercase font-black tracking-widest text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full inline-block">
                  Paso 2: Horarios Muertos
                </span>
                <h4 className="font-extrabold text-slate-900 text-sm">Ofertas Flash 2 Horas</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Programa descuentos especiales de 3:00 PM a 5:00 PM (Happy Hour) para empujar rotación de bebidas y postres con el temporizador activo.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                <span className="text-[10px] uppercase font-black tracking-widest text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full inline-block">
                  Paso 3: Ticket Promedio
                </span>
                <h4 className="font-extrabold text-slate-900 text-sm">Cupón con Consumo Mínimo</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Establece cupones de $5.00 con consumo mínimo de $25.00 para incentivar combos familiares y compras de mayor volumen.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREAR / EDITAR OFERTA FLASH */}
      <AnimatePresence>
        {isFlashModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                    <Zap size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">
                      {editingFlashDeal ? 'Editar Descuento Flash' : 'Nueva Oferta por Tiempo Limitado'}
                    </h3>
                    <p className="text-xs text-slate-400">Configura la vigencia, porcentaje y temporizador regresivo.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFlashModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveFlashDeal} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                    Título de la Oferta <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={flashForm.title}
                    onChange={e => setFlashForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Ej. ¡Happy Hour 30% OFF en Smash Burgers!"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm font-bold text-slate-900 outline-none focus:border-rose-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                      Subtítulo Promocional
                    </label>
                    <input
                      type="text"
                      value={flashForm.subtitle}
                      onChange={e => setFlashForm(prev => ({ ...prev, subtitle: e.target.value }))}
                      placeholder="Ej. Válido hoy de 5 PM a 8 PM"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium outline-none focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                      Texto del Badge
                    </label>
                    <input
                      type="text"
                      value={flashForm.badge}
                      onChange={e => setFlashForm(prev => ({ ...prev, badge: e.target.value }))}
                      placeholder="Ej. ⚡ FLASH DEAL 30%"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                      Tipo de Descuento
                    </label>
                    <select
                      value={flashForm.discountType}
                      onChange={e => setFlashForm(prev => ({ ...prev, discountType: e.target.value as any }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none focus:border-rose-500"
                    >
                      <option value="percentage">Porcentaje (% OFF)</option>
                      <option value="fixed">Monto Fijo ($ / Moneda activa)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                      Valor del Descuento
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={flashForm.discountType === 'percentage' ? 100 : 1000}
                      value={flashForm.discountValue}
                      onChange={e => setFlashForm(prev => ({ ...prev, discountValue: Number(e.target.value) }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-black text-rose-600 outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                {/* Scope: Applies to */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                    ¿A qué productos aplica el descuento?
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'all', label: 'Todo el Menú' },
                      { id: 'category', label: 'Por Categoría' },
                      { id: 'items', label: 'Platos Específicos' }
                    ].map(scope => (
                      <button
                        key={scope.id}
                        type="button"
                        onClick={() => setFlashForm(prev => ({ ...prev, appliesTo: scope.id as any }))}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                          flashForm.appliesTo === scope.id
                            ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {scope.label}
                      </button>
                    ))}
                  </div>

                  {flashForm.appliesTo === 'category' && (
                    <div className="mt-3">
                      <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">
                        Selecciona la Categoría Objetivo
                      </label>
                      <select
                        value={flashForm.targetCategory}
                        onChange={e => setFlashForm(prev => ({ ...prev, targetCategory: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none"
                      >
                        {Array.from(new Set(menu.map(m => m.category))).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Image URL */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                    URL de Imagen o Banner
                  </label>
                  <input
                    type="url"
                    value={flashForm.image}
                    onChange={e => setFlashForm(prev => ({ ...prev, image: e.target.value }))}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono outline-none focus:border-rose-500"
                  />
                </div>

                {/* Dates: Starts and Ends */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">
                      Fecha y Hora de Inicio
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={flashForm.startsAt}
                      onChange={e => setFlashForm(prev => ({ ...prev, startsAt: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">
                      Fecha y Hora de Finalización (Expiración)
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={flashForm.endsAt}
                      onChange={e => setFlashForm(prev => ({ ...prev, endsAt: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-rose-600 outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsFlashModalOpen(false)}
                    className="px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-2xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 transition-all cursor-pointer"
                  >
                    {editingFlashDeal ? 'Guardar Cambios' : 'Publicar Oferta Flash'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CREAR / EDITAR CUPÓN */}
      <AnimatePresence>
        {isCouponModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <Ticket size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">
                      {editingCoupon ? 'Editar Cupón de Descuento' : 'Nuevo Cupón Promocional'}
                    </h3>
                    <p className="text-xs text-slate-400">Define código, porcentaje, monto mínimo y límite de canjes.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCouponModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveCoupon} className="space-y-4 text-xs">
                {/* Coupon Code with generator */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Código del Cupón <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateRandomCode}
                      className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      🎲 Generar Aleatorio
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={couponForm.code}
                    onChange={e => setCouponForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    placeholder="Ej. BISTRO20, FINDEBURGER"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-base font-mono font-black tracking-wider text-indigo-900 outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                    Título Promocional <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={couponForm.title}
                    onChange={e => setCouponForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Ej. 20% OFF en toda tu orden"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none focus:border-indigo-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                      Tipo de Descuento
                    </label>
                    <select
                      value={couponForm.discountType}
                      onChange={e => setCouponForm(prev => ({ ...prev, discountType: e.target.value as any }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none focus:border-indigo-600"
                    >
                      <option value="percentage">Porcentaje (% OFF)</option>
                      <option value="fixed">Monto Fijo ($ / Moneda activa)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                      Valor del Descuento
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={couponForm.discountType === 'percentage' ? 100 : 1000}
                      value={couponForm.discountValue}
                      onChange={e => setCouponForm(prev => ({ ...prev, discountValue: Number(e.target.value) }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-black text-rose-600 outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                      Consumo Mínimo Requerido ($)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={couponForm.minSpend}
                      onChange={e => setCouponForm(prev => ({ ...prev, minSpend: Number(e.target.value) }))}
                      placeholder="0 (Sin mínimo)"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                      Tope Máximo de Descuento ($)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={couponForm.maxDiscount}
                      onChange={e => setCouponForm(prev => ({ ...prev, maxDiscount: Number(e.target.value) }))}
                      placeholder="Opcional para %"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                      Límite Total de Canjes
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={couponForm.usageLimit}
                      onChange={e => setCouponForm(prev => ({ ...prev, usageLimit: Number(e.target.value) }))}
                      placeholder="Ej. 100 usos"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                      Canal de Venta Aplicable
                    </label>
                    <select
                      value={couponForm.applicableChannel}
                      onChange={e => setCouponForm(prev => ({ ...prev, applicableChannel: e.target.value as any }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none"
                    >
                      <option value="all">Delivery y Salón</option>
                      <option value="delivery">Solo Delivery a Domicilio</option>
                      <option value="dine-in">Solo Salón / Mesa</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                    Fecha de Caducidad (Válido Hasta)
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={couponForm.expiresAt}
                    onChange={e => setCouponForm(prev => ({ ...prev, expiresAt: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCouponModalOpen(false)}
                    className="px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-2xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                  >
                    {editingCoupon ? 'Guardar Cambios' : 'Crear Cupón'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
