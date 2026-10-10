import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Clock, Flame, Tag, ChevronRight, Sparkles, Percent } from 'lucide-react';
import { FlashDeal } from '../types';

interface FlashDealsBannerProps {
  flashDeals: FlashDeal[];
  onSelectCategory?: (category: string) => void;
  onSearchItem?: (query: string) => void;
}

export default function FlashDealsBanner({
  flashDeals = [],
  onSelectCategory,
  onSearchItem
}: FlashDealsBannerProps) {
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [activeDealIndex, setActiveDealIndex] = useState(0);

  // Live timer tick
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter deals that are strictly live and active right now
  const liveDeals = flashDeals.filter(deal => {
    if (deal.status !== 'active') return false;
    const start = new Date(deal.startsAt).getTime();
    const end = new Date(deal.endsAt).getTime();
    return start <= currentTime && end > currentTime;
  });

  // Rotate between multiple live deals if available
  useEffect(() => {
    if (liveDeals.length <= 1) return;
    const interval = setInterval(() => {
      setActiveDealIndex(prev => (prev + 1) % liveDeals.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [liveDeals.length]);

  if (liveDeals.length === 0) return null;

  const currentDeal = liveDeals[activeDealIndex] || liveDeals[0];

  const diff = Math.max(0, new Date(currentDeal.endsAt).getTime() - currentTime);
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  const handleAction = () => {
    if (currentDeal.appliesTo === 'category' && currentDeal.targetCategory && onSelectCategory) {
      onSelectCategory(currentDeal.targetCategory);
    } else if (currentDeal.subtitle && onSearchItem) {
      onSearchItem(currentDeal.subtitle);
    }
  };

  return (
    <div className="mb-8">
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-r from-rose-950 via-slate-900 to-amber-950 text-white shadow-xl border border-rose-500/20">
        {/* Subtle background glow effect */}
        <div className="absolute -right-20 -top-20 w-72 h-72 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-72 h-72 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative p-6 sm:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Left content: Badges, Title, Description */}
          <div className="space-y-3 max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500 text-white text-[11px] font-black uppercase tracking-wider shadow-sm animate-pulse">
                <Flame size={14} className="fill-white" />
                <span>Oferta Especial Flash</span>
              </span>

              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-amber-300 text-[11px] font-black uppercase tracking-wider border border-white/10">
                <Zap size={13} />
                <span>{currentDeal.badge || 'Por Tiempo Limitado'}</span>
              </span>

              {currentDeal.appliesTo === 'category' && currentDeal.targetCategory && (
                <span className="text-[11px] font-bold text-slate-300 bg-black/40 px-2.5 py-0.5 rounded-full border border-white/5">
                  Válido en: <strong className="text-white">{currentDeal.targetCategory}</strong>
                </span>
              )}
            </div>

            <div>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                <span>{currentDeal.title}</span>
                <span className="inline-block px-2.5 py-0.5 text-xs font-black bg-amber-400 text-slate-950 rounded-lg shrink-0">
                  {currentDeal.discountType === 'percentage' 
                    ? `-${currentDeal.discountValue}%` 
                    : `-$${currentDeal.discountValue}`}
                </span>
              </h3>
              {currentDeal.subtitle && (
                <p className="text-xs sm:text-sm text-rose-300 font-bold mt-1">
                  {currentDeal.subtitle}
                </p>
              )}
              {currentDeal.description && (
                <p className="text-xs text-slate-300/90 mt-1 leading-relaxed">
                  {currentDeal.description}
                </p>
              )}
            </div>
          </div>

          {/* Right: Live Countdown & Action Button */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-4 w-full lg:w-auto">
            {/* Live ticking countdown box */}
            <div className="bg-black/60 backdrop-blur-md border border-white/15 rounded-2xl p-3 px-4 flex items-center gap-3 shadow-inner">
              <Clock size={18} className="text-amber-400 animate-spin" />
              <div>
                <span className="text-[9px] uppercase tracking-widest font-black text-slate-400 block">
                  Termina en:
                </span>
                <div className="font-mono font-black text-base sm:text-lg tracking-wider text-amber-300 flex items-center gap-1.5">
                  <span className="bg-white/10 px-1.5 py-0.5 rounded">{String(hours).padStart(2, '0')}</span>
                  <span>:</span>
                  <span className="bg-white/10 px-1.5 py-0.5 rounded">{String(minutes).padStart(2, '0')}</span>
                  <span>:</span>
                  <span className="bg-white/10 px-1.5 py-0.5 rounded text-rose-400">{String(seconds).padStart(2, '0')}</span>
                </div>
              </div>
            </div>

            {/* Action button */}
            <button
              type="button"
              onClick={handleAction}
              className="w-full sm:w-auto px-5 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-2xl text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-105 cursor-pointer"
            >
              <Sparkles size={16} />
              <span>Ver Menú con Descuento</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Carousel indicators if multiple flash deals are live */}
        {liveDeals.length > 1 && (
          <div className="px-6 pb-3 pt-0 flex justify-center gap-1.5">
            {liveDeals.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveDealIndex(idx)}
                className={`h-1.5 rounded-full transition-all ${
                  activeDealIndex === idx ? 'w-6 bg-amber-400' : 'w-2 bg-white/30'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
