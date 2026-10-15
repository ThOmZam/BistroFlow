import { collection, getDocs, addDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';

export async function clearAndSeedQSandwichMenu() {
  try {
    // 1. Clear existing menu collection safely in chunks
    const menuSnapshot = await getDocs(collection(db, 'menu'));
    const menuDocs = menuSnapshot.docs;
    for (let i = 0; i < menuDocs.length; i += 400) {
      const chunk = menuDocs.slice(i, i + 400);
      const batch = writeBatch(db);
      chunk.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    // 2. Clear existing inventory collection safely in chunks
    const invSnapshot = await getDocs(collection(db, 'inventory'));
    const invDocs = invSnapshot.docs;
    for (let i = 0; i < invDocs.length; i += 400) {
      const chunk = invDocs.slice(i, i + 400);
      const batch = writeBatch(db);
      chunk.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    // 3. Insert Q' Sandwich Official Menu Items
    const qSandwichMenu = [
      // ENSALADAS
      {
        name: 'Ensalada César',
        price: 10.0,
        category: 'Ensaladas',
        image: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        variants: [
          { id: 'cesar-med', name: 'Mediano (Sencilla)', price: 10.0 },
          { id: 'cesar-grd', name: 'Grande (Sencilla)', price: 12.0 },
          { id: 'cesar-pol-med', name: 'Mediano Con Pollo', price: 12.0 },
          { id: 'cesar-pol-grd', name: 'Grande Con Pollo', price: 14.0 },
          { id: 'cesar-cam-med', name: 'Mediano Con Camarón', price: 14.0 },
          { id: 'cesar-cam-grd', name: 'Grande Con Camarón', price: 16.0 },
          { id: 'cesar-cang-med', name: 'Mediano Con Cangrejo', price: 12.0 },
          { id: 'cesar-cang-grd', name: 'Grande Con Cangrejo', price: 14.0 },
          { id: 'cesar-mix-grd', name: 'Grande Con Pollo y Camarón', price: 17.0 }
        ]
      },
      {
        name: 'Salad Fish',
        price: 12.0,
        category: 'Ensaladas',
        image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        variants: [
          { id: 'fish-med', name: 'Mediano', price: 12.0 },
          { id: 'fish-grd', name: 'Grande', price: 14.0 }
        ]
      },
      {
        name: 'Ensalada Primavera',
        price: 15.0,
        category: 'Ensaladas',
        image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        variants: [
          { id: 'prim-med', name: 'Mediano', price: 15.0 },
          { id: 'prim-grd', name: 'Grande', price: 17.0 }
        ]
      },
      {
        name: 'Salad Fitness',
        price: 14.0,
        category: 'Ensaladas',
        image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        variants: [
          { id: 'fit-med', name: 'Mediano', price: 14.0 },
          { id: 'fit-grd', name: 'Grande', price: 16.0 }
        ]
      },
      {
        name: 'Salad Ranch',
        price: 14.0,
        category: 'Ensaladas',
        image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        variants: [
          { id: 'ranch-med', name: 'Mediano', price: 14.0 },
          { id: 'ranch-grd', name: 'Grande', price: 16.0 }
        ]
      },
      {
        name: 'Marítima (Ensalada)',
        price: 15.0,
        category: 'Ensaladas',
        image: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        variants: [
          { id: 'mar-cam-med', name: 'Mediano Con Camarón', price: 15.0 },
          { id: 'mar-cam-grd', name: 'Grande Con Camarón', price: 17.0 },
          { id: 'mar-cang-med', name: 'Mediano Con Cangrejo', price: 15.0 },
          { id: 'mar-cang-grd', name: 'Grande Con Cangrejo', price: 17.0 },
          { id: 'mar-mix-grd', name: 'Grande Con Pollo y Camarón', price: 18.5 }
        ]
      },
      {
        name: 'Salad Bowl',
        price: 17.0,
        category: 'Ensaladas',
        image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        alerts: ['Precio Único / Grande: $17']
      },
      {
        name: 'Italianisima (Ensalada)',
        price: 15.0,
        category: 'Ensaladas',
        image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        alerts: ['Mediano: $15', 'Grande: $17'],
        variants: [
          { id: 'it-med', name: 'Mediano', price: 15.0 },
          { id: 'it-grd', name: 'Grande', price: 17.0 }
        ]
      },
      {
        name: 'Deli Pollo',
        price: 15.0,
        category: 'Ensaladas',
        image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        alerts: ['Mediano: $15', 'Grande: $17'],
        variants: [
          { id: 'dp-med', name: 'Mediano', price: 15.0 },
          { id: 'dp-grd', name: 'Grande', price: 17.0 }
        ]
      },

      // SANDWICHES
      {
        name: 'Pollo Especial (Sandwich)',
        price: 7.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&q=80&w=600',
        preparationTime: 10,
        scheduleType: 'always',
        variants: [
          { id: 'pe-15', name: '15 cm (Regular)', price: 7.0 },
          { id: 'pe-30', name: '30 cm (Grande)', price: 9.0 }
        ]
      },
      {
        name: 'Pollo Tradicional (Sandwich)',
        price: 10.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&q=80&w=600',
        preparationTime: 10,
        scheduleType: 'always',
        variants: [
          { id: 'pt-15', name: '15 cm (Regular)', price: 10.0 },
          { id: 'pt-30', name: '30 cm (Grande)', price: 12.0 }
        ]
      },
      {
        name: 'Pollo Champiñón (Sandwich)',
        price: 8.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&q=80&w=600',
        preparationTime: 10,
        scheduleType: 'always',
        variants: [
          { id: 'pc-15', name: '15 cm (Regular)', price: 8.0 },
          { id: 'pc-30', name: '30 cm (Grande)', price: 10.0 }
        ]
      },
      {
        name: 'Pollo Teriyaki (Sandwich)',
        price: 8.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&q=80&w=600',
        preparationTime: 10,
        scheduleType: 'always',
        variants: [
          { id: 'py-15', name: '15 cm (Regular)', price: 8.0 },
          { id: 'py-30', name: '30 cm (Grande)', price: 10.0 }
        ]
      },
      {
        name: 'Pollo Premium (Sandwich)',
        price: 10.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=600',
        preparationTime: 10,
        scheduleType: 'always',
        variants: [
          { id: 'pp-15', name: '15 cm (Regular)', price: 10.0 },
          { id: 'pp-30', name: '30 cm (Grande)', price: 12.0 }
        ]
      },
      {
        name: 'Pollo 4 Quesos (Sandwich)',
        price: 13.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        variants: [
          { id: 'p4-15', name: '15 cm (Regular)', price: 13.0 },
          { id: 'p4-30', name: '30 cm (Grande)', price: 15.0 }
        ]
      },
      {
        name: 'Ranchero (Sandwich)',
        price: 10.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        variants: [
          { id: 'ra-15', name: '15 cm (Regular)', price: 10.0 },
          { id: 'ra-30', name: '30 cm (Grande)', price: 12.0 }
        ]
      },
      {
        name: 'Lomito Tradicional (Sandwich)',
        price: 13.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        variants: [
          { id: 'lt-15', name: '15 cm (Regular)', price: 13.0 },
          { id: 'lt-30', name: '30 cm (Grande)', price: 15.0 }
        ]
      },
      {
        name: 'Lomito Champiñón (Sandwich)',
        price: 13.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        variants: [
          { id: 'lc-15', name: '15 cm (Regular)', price: 13.0 },
          { id: 'lc-30', name: '30 cm (Grande)', price: 15.0 }
        ]
      },
      {
        name: 'Lomito 4 Quesos (Sandwich)',
        price: 14.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        variants: [
          { id: 'l4-15', name: '15 cm (Regular)', price: 14.0 },
          { id: 'l4-30', name: '30 cm (Grande)', price: 16.0 }
        ]
      },
      {
        name: "Q' Camarón (Sandwich)",
        price: 14.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        variants: [
          { id: 'qc-15', name: '15 cm (Regular)', price: 14.0 },
          { id: 'qc-30', name: '30 cm (Grande)', price: 16.0 }
        ]
      },
      {
        name: "Q' Cangrejo (Sandwich)",
        price: 10.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        variants: [
          { id: 'qg-15', name: '15 cm (Regular)', price: 10.0 },
          { id: 'qg-30', name: '30 cm (Grande)', price: 12.0 }
        ]
      },
      {
        name: 'Marítimo (Sandwich)',
        price: 16.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        variants: [
          { id: 'ms-15', name: '15 cm (Regular)', price: 16.0 },
          { id: 'ms-30', name: '30 cm (Grande)', price: 18.0 }
        ]
      },
      {
        name: 'Italianisima (Sandwich)',
        price: 16.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        variants: [
          { id: 'it-15', name: '15 cm (Regular)', price: 16.0 },
          { id: 'it-30', name: '30 cm (Grande)', price: 18.0 }
        ]
      },
      {
        name: 'Atún (Sandwich)',
        price: 8.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&q=80&w=600',
        preparationTime: 10,
        scheduleType: 'always',
        variants: [
          { id: 'at-15', name: '15 cm (Regular)', price: 8.0 },
          { id: 'at-30', name: '30 cm (Grande)', price: 10.0 }
        ]
      },
      {
        name: 'Mediterraneo (Sandwich)',
        price: 8.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=600',
        preparationTime: 10,
        scheduleType: 'always',
        variants: [
          { id: 'md-15', name: '15 cm (Regular)', price: 8.0 },
          { id: 'md-30', name: '30 cm (Grande)', price: 10.0 }
        ]
      },
      {
        name: "Q' Sandwich",
        price: 16.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        variants: [
          { id: 'qs-15', name: '15 cm (Regular)', price: 16.0 },
          { id: 'qs-30', name: '30 cm (Grande)', price: 18.0 }
        ]
      },
      {
        name: "Q' Cesar (Sandwich)",
        price: 10.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&q=80&w=600',
        preparationTime: 10,
        scheduleType: 'always',
        variants: [
          { id: 'qc-15', name: '15 cm (Regular)', price: 10.0 },
          { id: 'qc-30', name: '30 cm (Grande)', price: 12.0 }
        ]
      },
      {
        name: 'Vegetariano (Sandwich)',
        price: 8.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&q=80&w=600',
        preparationTime: 10,
        scheduleType: 'always',
        variants: [
          { id: 'vg-15', name: '15 cm (Regular)', price: 8.0 },
          { id: 'vg-30', name: '30 cm (Grande)', price: 10.0 }
        ]
      },
      {
        name: 'Pernil (Sandwich)',
        price: 8.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=600',
        preparationTime: 10,
        scheduleType: 'always',
        variants: [
          { id: 'pn-15', name: '15 cm (Regular)', price: 8.0 },
          { id: 'pn-30', name: '30 cm (Grande)', price: 10.0 }
        ]
      },
      {
        name: 'Sencillo (Sandwich)',
        price: 6.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&q=80&w=600',
        preparationTime: 8,
        scheduleType: 'always',
        variants: [
          { id: 'sc-15', name: '15 cm (Regular)', price: 6.0 },
          { id: 'sc-30', name: '30 cm (Grande)', price: 8.0 }
        ]
      },
      {
        name: 'Parrillero (Sandwich)',
        price: 8.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        variants: [
          { id: 'pr-15', name: '15 cm (Regular)', price: 8.0 },
          { id: 'pr-30', name: '30 cm (Grande)', price: 10.0 }
        ]
      },
      {
        name: 'Lomo de Cerdo (Sandwich)',
        price: 10.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=600',
        preparationTime: 10,
        scheduleType: 'always',
        variants: [
          { id: 'lc-15', name: '15 cm (Regular)', price: 10.0 },
          { id: 'lc-30', name: '30 cm (Grande)', price: 12.0 }
        ]
      },
      {
        name: 'Roast Beef tradicional (Sandwich)',
        price: 13.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        variants: [
          { id: 'rb-15', name: '15 cm (Regular)', price: 13.0 },
          { id: 'rb-30', name: '30 cm (Grande)', price: 15.0 }
        ]
      },
      {
        name: 'Roast Beef 4 Quesos (Sandwich)',
        price: 14.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        variants: [
          { id: 'rb4-15', name: '15 cm (Regular)', price: 14.0 },
          { id: 'rb4-30', name: '30 cm (Grande)', price: 16.0 }
        ]
      },
      {
        name: 'Roast Beef Champiñón (Sandwich)',
        price: 13.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        variants: [
          { id: 'rbc-15', name: '15 cm (Regular)', price: 13.0 },
          { id: 'rbc-30', name: '30 cm (Grande)', price: 15.0 }
        ]
      },

      // ENROLLADOS
      {
        name: 'Enrollado Marítimo',
        price: 16.0,
        category: 'Enrollados',
        image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        alerts: ['Precio Único: $16']
      },
      {
        name: 'Enrollado Mixto',
        price: 16.0,
        category: 'Enrollados',
        image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        alerts: ['Precio Único: $16']
      },
      {
        name: 'Enrollado Pollo',
        price: 12.0,
        category: 'Enrollados',
        image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&q=80&w=600',
        preparationTime: 10,
        scheduleType: 'always',
        alerts: ['Precio Único: $12']
      },
      {
        name: 'Enrollado Carne',
        price: 12.0,
        category: 'Enrollados',
        image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&q=80&w=600',
        preparationTime: 10,
        scheduleType: 'always',
        alerts: ['Precio Único: $12']
      },
      {
        name: 'Enrollado Camarón',
        price: 14.0,
        category: 'Enrollados',
        image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        alerts: ['Precio Único: $14']
      },

      // HAMBURGUESAS
      {
        name: 'Hamburguesa Pollo a la plancha',
        price: 10.0,
        category: 'Hamburguesas',
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=600',
        preparationTime: 15,
        scheduleType: 'always',
        alerts: ['Incluye Papas Fritas']
      },
      {
        name: 'Hamburguesa Lomito',
        price: 15.0,
        category: 'Hamburguesas',
        image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&q=80&w=600',
        preparationTime: 15,
        scheduleType: 'always',
        alerts: ['Incluye Papas Fritas']
      },
      {
        name: 'Hamburguesa Pollo Crispy',
        price: 10.0,
        category: 'Hamburguesas',
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=600',
        preparationTime: 15,
        scheduleType: 'always',
        alerts: ['Incluye Papas Fritas']
      },
      {
        name: 'Hamburguesa Carne',
        price: 10.0,
        category: 'Hamburguesas',
        image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&q=80&w=600',
        preparationTime: 15,
        scheduleType: 'always',
        alerts: ['Incluye Papas Fritas']
      },
      {
        name: 'Hamburguesa Mixta',
        price: 15.0,
        category: 'Hamburguesas',
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=600',
        preparationTime: 15,
        scheduleType: 'always',
        alerts: ['Incluye Papas Fritas']
      },
      {
        name: 'Hamburguesa Marítima',
        price: 16.0,
        category: 'Hamburguesas',
        image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&q=80&w=600',
        preparationTime: 15,
        scheduleType: 'always',
        alerts: ['Incluye Papas Fritas']
      },
      {
        name: 'Hamburguesa Camarón',
        price: 15.0,
        category: 'Hamburguesas',
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=600',
        preparationTime: 15,
        scheduleType: 'always',
        alerts: ['Incluye Papas Fritas']
      },
      {
        name: 'Hamburguesa Lomo de Cerdo',
        price: 10.0,
        category: 'Hamburguesas',
        image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&q=80&w=600',
        preparationTime: 15,
        scheduleType: 'always',
        alerts: ['Incluye Papas Fritas']
      },

      // CLUB HOUSE
      {
        name: 'Club House Pollo o Pernil',
        price: 10.0,
        category: 'Club House',
        image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=600',
        preparationTime: 15,
        scheduleType: 'always',
        alerts: ['Precio: $10']
      },
      {
        name: 'Club House Marítimo',
        price: 16.0,
        category: 'Club House',
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&q=80&w=600',
        preparationTime: 15,
        scheduleType: 'always',
        alerts: ['Precio: $16']
      },
      {
        name: 'Club House Camarón',
        price: 14.0,
        category: 'Club House',
        image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=600',
        preparationTime: 15,
        scheduleType: 'always',
        alerts: ['Precio: $14']
      },
      {
        name: 'Super Club House',
        price: 35.0,
        category: 'Club House',
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&q=80&w=600',
        preparationTime: 20,
        scheduleType: 'always',
        alerts: ['Incluye Doble Club House, 8 tequeños, 8 chupeticas, papas y refresco']
      },

      // PAPAS
      {
        name: 'Papas Tradicionales',
        price: 3.5,
        category: 'Papas & Acompañantes',
        image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&q=80&w=600',
        preparationTime: 8,
        scheduleType: 'always',
        alerts: ['300g de papas fritas']
      },
      {
        name: 'Papas Bacon',
        price: 6.0,
        category: 'Papas & Acompañantes',
        image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&q=80&w=600',
        preparationTime: 10,
        scheduleType: 'always',
        alerts: ['250g + tocineta + queso fundido']
      },
      {
        name: 'Papas Crispy',
        price: 7.0,
        category: 'Papas & Acompañantes',
        image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&q=80&w=600',
        preparationTime: 10,
        scheduleType: 'always',
        alerts: ['250g + Pollo Crispy + tocineta + queso']
      },
      {
        name: 'Salchipapas',
        price: 6.0,
        category: 'Papas & Acompañantes',
        image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&q=80&w=600',
        preparationTime: 10,
        scheduleType: 'always',
        alerts: ['250g + salchichas + tocineta + queso']
      },
      {
        name: 'Papas Grill',
        price: 12.0,
        category: 'Papas & Acompañantes',
        image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        alerts: ['250g + carne + pollo + chorizo + queso']
      },

      // POSTRES
      {
        name: 'Torta de Piña',
        price: 3.0,
        category: 'Postres',
        image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&q=80&w=600',
        preparationTime: 5,
        scheduleType: 'always'
      },
      {
        name: 'Torta de Chocolate',
        price: 3.0,
        category: 'Postres',
        image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=80&w=600',
        preparationTime: 5,
        scheduleType: 'always'
      },
      {
        name: 'Torta de Vainilla',
        price: 2.0,
        category: 'Postres',
        image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&q=80&w=600',
        preparationTime: 5,
        scheduleType: 'always'
      },
      {
        name: 'Galletas',
        price: 3.0,
        category: 'Postres',
        image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&q=80&w=600',
        preparationTime: 2,
        scheduleType: 'always'
      },
      {
        name: 'Palmeritas por Kg',
        price: 10.0,
        category: 'Postres',
        image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=600',
        preparationTime: 2,
        scheduleType: 'always'
      },
      {
        name: 'Pie de Limón',
        price: 3.0,
        category: 'Postres',
        image: 'https://images.unsplash.com/photo-1519869325930-281384150729?auto=format&fit=crop&q=80&w=600',
        preparationTime: 5,
        scheduleType: 'always'
      },
      {
        name: 'Marquesa de Chocolate',
        price: 3.0,
        category: 'Postres',
        image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=80&w=600',
        preparationTime: 5,
        scheduleType: 'always'
      },
      {
        name: 'Tres Leches',
        price: 3.0,
        category: 'Postres',
        image: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&q=80&w=600',
        preparationTime: 5,
        scheduleType: 'always'
      },

      // BEBIDAS & REFRESCOS
      {
        name: 'Refresco en Lata 355ml',
        price: 2.0,
        category: 'Bebidas',
        image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=600',
        preparationTime: 1,
        scheduleType: 'always',
        alerts: ['Coca-Cola', 'Chinotto', 'Frescolita']
      },
      {
        name: 'Refresco Familiar 1.5L',
        price: 3.5,
        category: 'Bebidas',
        image: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&q=80&w=600',
        preparationTime: 1,
        scheduleType: 'always',
        alerts: ['Para compartir']
      },
      {
        name: 'Jugo Natural de Naranja',
        price: 3.0,
        category: 'Bebidas',
        image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&q=80&w=600',
        preparationTime: 4,
        scheduleType: 'always',
        alerts: ['Natural 450ml']
      },
      {
        name: 'Jugo de Fresa o Parchita',
        price: 3.5,
        category: 'Bebidas',
        image: 'https://images.unsplash.com/photo-1525385133512-2f3bdd039054?auto=format&fit=crop&q=80&w=600',
        preparationTime: 4,
        scheduleType: 'always',
        alerts: ['Fruta Natural 450ml']
      },
      {
        name: 'Té Frío Nestea Limón',
        price: 2.5,
        category: 'Bebidas',
        image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&q=80&w=600',
        preparationTime: 2,
        scheduleType: 'always',
        alerts: ['Vaso 500ml con hielo']
      },
      {
        name: 'Agua Mineral 500ml',
        price: 1.5,
        category: 'Bebidas',
        image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&q=80&w=600',
        preparationTime: 1,
        scheduleType: 'always',
        alerts: ['Botella fría']
      },
      {
        name: 'Cerveza Polar / Zulia',
        price: 2.5,
        category: 'Bebidas',
        image: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&q=80&w=600',
        preparationTime: 1,
        scheduleType: 'always',
        alerts: ['Tercio bien frío']
      }
    ];

    for (const item of qSandwichMenu) {
      await addDoc(collection(db, 'menu'), item);
    }

    // 4. Insert Base Ingredients Inventory
    const qSandwichIngredients = [
      { name: 'Pechuga de Pollo', stock: 45, minStock: 10, unit: 'kg', cost: 6.5 },
      { name: 'Tiras de Lomito', stock: 30, minStock: 8, unit: 'kg', cost: 9.0 },
      { name: 'Carne de Hamburguesa', stock: 50, minStock: 12, unit: 'kg', cost: 5.5 },
      { name: 'Camarones', stock: 20, minStock: 5, unit: 'kg', cost: 12.0 },
      { name: 'Cangrejo / Surimi', stock: 15, minStock: 4, unit: 'kg', cost: 8.0 },
      { name: 'Jamón', stock: 25, minStock: 5, unit: 'kg', cost: 4.5 },
      { name: 'Tocineta', stock: 20, minStock: 5, unit: 'kg', cost: 7.0 },
      { name: 'Queso Amarillo / Cheddar', stock: 30, minStock: 6, unit: 'kg', cost: 6.0 },
      { name: 'Queso Mozzarella', stock: 25, minStock: 5, unit: 'kg', cost: 6.5 },
      { name: 'Lechuga', stock: 40, minStock: 10, unit: 'kg', cost: 2.0 },
      { name: 'Tomate', stock: 35, minStock: 10, unit: 'kg', cost: 2.5 },
      { name: 'Papas para Fritar', stock: 100, minStock: 25, unit: 'kg', cost: 1.8 },
      { name: 'Pan de Sandwich 15/30cm', stock: 80, minStock: 20, unit: 'und', cost: 0.8 },
      { name: 'Pan de Hamburguesa', stock: 60, minStock: 15, unit: 'und', cost: 0.6 },
      { name: 'Refresco Lata 355ml', stock: 120, minStock: 24, unit: 'und', cost: 0.8 },
      { name: 'Refresco Familiar 1.5L', stock: 40, minStock: 10, unit: 'und', cost: 1.5 },
      { name: 'Agua Mineral 500ml', stock: 80, minStock: 20, unit: 'und', cost: 0.5 },
      { name: 'Cerveza Polar / Zulia', stock: 72, minStock: 24, unit: 'und', cost: 1.2 }
    ];

    for (const ing of qSandwichIngredients) {
      await addDoc(collection(db, 'inventory'), ing);
    }

    return true;
  } catch (err) {
    console.error('Error seeding Q Sandwich menu:', err);
    throw err;
  }
}
