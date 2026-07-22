import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Sparkles, Tag } from 'lucide-react';
import { Promotion } from '../types';

interface PromotionsBannerProps {
  onPromoClick: (filterCategory: string, filterQuery: string) => void;
  categories: string[];
  promotions?: Promotion[];
}

const DEFAULT_PROMOTIONS: Promotion[] = [
  {
    id: 'default-1',
    title: "Combo Smash Burger 🍔",
    subtitle: "2 Burgers Smash Dobles + Papas + Bebidas",
    description: "Nuestra smash burger doble con cheddar fundido y salsa Bistro secreta. ¡Pídelas hoy con 25% de descuento!",
    badge: "Más Vendido 🔥",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80",
    actionText: "Pedir Combo - $14.99",
    filterCategory: "Hamburguesa",
    filterQuery: "Smash",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-800"
  },
  {
    id: 'default-2',
    title: "Delivery Gratis 🛵",
    subtitle: "En todos tus pedidos mayores a $15 USD",
    description: "¡Ahorra en el envío! Utiliza el cupón BISTROFREE en tu pedido de delivery o supera los $15 para envío automático sin costo.",
    badge: "Envío Gratis ✨",
    image: "https://images.unsplash.com/photo-1526367790999-0150786486a9?w=800&auto=format&fit=crop&q=80",
    actionText: "Explorar Platos",
    filterCategory: "All",
    filterQuery: "",
    badgeBg: "bg-indigo-100",
    badgeText: "text-indigo-800"
  },
  {
    id: 'default-3',
    title: "Tardes de Postres 2x1 🍰",
    subtitle: "De 3:00 PM a 6:00 PM de Lunes a Viernes",
    description: "Disfruta el doble de dulzura. Pide un postre participante y llévate el segundo gratis (se descuenta al pagar en caja o delivery).",
    badge: "Hora Feliz 🍩",
    image: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800&auto=format&fit=crop&q=80",
    actionText: "Ver Dulces",
    filterCategory: "Postres",
    filterQuery: "",
    badgeBg: "bg-pink-100",
    badgeText: "text-pink-800"
  }
];

export default function PromotionsBanner({ onPromoClick, categories, promotions = [] }: PromotionsBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const displayPromotions = promotions && promotions.length > 0 ? promotions : DEFAULT_PROMOTIONS;

  // Auto-slide loop
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % displayPromotions.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [displayPromotions.length]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev === 0 ? displayPromotions.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev + 1) % displayPromotions.length);
  };

  if (displayPromotions.length === 0) return null;

  return (
    <div className="mb-8 relative group">
      {/* Header section with icons */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-black text-lg text-slate-800 flex items-center gap-2">
          <Tag size={18} className="text-red-500 animate-bounce" />
          <span>Promociones y Destacados</span>
          <span className="text-[10px] bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
            ¡Hoy!
          </span>
        </h3>
        
        {/* Navigation arrows for desktop */}
        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button 
            onClick={handlePrev}
            className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm"
          >
            <ChevronLeft size={16} />
          </button>
          <button 
            onClick={handleNext}
            className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Main Banner Container */}
      <div className="relative overflow-hidden rounded-[32px] h-60 sm:h-56 bg-slate-950 shadow-lg border border-slate-100">
        <AnimatePresence mode="wait">
          {displayPromotions.map((promo, idx) => {
            if (idx !== currentIndex) return null;
            
            // Generate some nice defaults for styles if they aren't configured in admin
            const bgBadge = promo.badgeBg || "bg-amber-100";
            const textBadge = promo.badgeText || "text-amber-800";
            const filterCat = promo.filterCategory || "All";
            const filterQ = promo.filterQuery || "";
            const actText = promo.actionText || "Ver Detalles";

            return (
              <motion.div
                key={promo.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                onClick={() => onPromoClick(filterCat, filterQ)}
                className="absolute inset-0 flex flex-col sm:flex-row cursor-pointer"
              >
                {/* Left Side Content */}
                <div className="flex-1 p-6 md:p-8 flex flex-col justify-between z-10 relative bg-gradient-to-r from-slate-950 via-slate-900/90 to-slate-900/40">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${bgBadge} ${textBadge}`}>
                        {promo.badge}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                        <Sparkles size={10} className="text-yellow-400 fill-yellow-400" />
                        Exclusivo Web
                      </span>
                    </div>
                    
                    <h4 className="text-lg sm:text-xl font-black text-white tracking-tight pt-1 leading-tight">
                      {promo.title}
                    </h4>
                    <p className="text-xs font-bold text-amber-400 line-clamp-1">
                      {promo.subtitle}
                    </p>
                    <p className="text-[11px] text-slate-300 mt-1 line-clamp-2 leading-relaxed max-w-lg hidden sm:block">
                      {promo.description}
                    </p>
                  </div>

                  <div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onPromoClick(filterCat, filterQ);
                      }}
                      className="mt-3 px-5 py-2.5 bg-white text-black rounded-xl text-xs font-black hover:bg-amber-400 transition-colors flex items-center gap-2 shadow-md hover:scale-[1.02] transition-transform duration-300"
                    >
                      <span>{actText}</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                {/* Right Side Image with blend and zoom effects */}
                <div className="w-full sm:w-1/3 md:w-2/5 h-1/3 sm:h-full relative overflow-hidden shrink-0">
                  <div className="absolute inset-0 bg-gradient-to-t sm:bg-gradient-to-r from-slate-950 via-slate-950/10 to-transparent z-10" />
                  <motion.img 
                    src={promo.image} 
                    alt={promo.title} 
                    initial={{ scale: 1.1 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 6 }}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Indicator dots */}
      <div className="flex justify-center gap-1.5 mt-4">
        {displayPromotions.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`h-2.5 rounded-full transition-all duration-300 ${
              idx === currentIndex 
                ? 'w-7 bg-slate-900' 
                : 'w-2.5 bg-slate-200 hover:bg-slate-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
