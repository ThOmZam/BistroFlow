import { collection, getDocs, addDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';

export async function clearAndSeedQSandwichMenu() {
  try {
    // 1. Clear existing menu collection
    const menuSnapshot = await getDocs(collection(db, 'menu'));
    const batch = writeBatch(db);
    menuSnapshot.docs.forEach((d) => {
      batch.delete(d.ref);
    });
    await batch.commit();

    // 2. Clear existing inventory collection
    const invSnapshot = await getDocs(collection(db, 'inventory'));
    const invBatch = writeBatch(db);
    invSnapshot.docs.forEach((d) => {
      invBatch.delete(d.ref);
    });
    await invBatch.commit();

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
        alerts: ['Mediano: $10', 'Grande: $12', 'Con Pollo: $12/$14', 'Con Camarón: $14/$16', 'Con Pollo y Camarón: $15/$17', 'Con Cangrejo: $12/$14', 'Con Pollo y Cangrejo: $14/$16']
      },
      {
        name: 'Salad Fish',
        price: 12.0,
        category: 'Ensaladas',
        image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        alerts: ['Mediano: $12', 'Grande: $14']
      },
      {
        name: 'Ensalada Primavera',
        price: 15.0,
        category: 'Ensaladas',
        image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        alerts: ['Mediano: $15', 'Grande: $17']
      },
      {
        name: 'Salad Fitness',
        price: 14.0,
        category: 'Ensaladas',
        image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        alerts: ['Mediano: $14', 'Grande: $16']
      },
      {
        name: 'Salad Ranch',
        price: 14.0,
        category: 'Ensaladas',
        image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        alerts: ['Mediano: $14', 'Grande: $16']
      },
      {
        name: 'Marítima (Ensalada)',
        price: 15.0,
        category: 'Ensaladas',
        image: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        alerts: ['Mediano: $15', 'Grande: $17']
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
        alerts: ['Mediano: $15', 'Grande: $17']
      },
      {
        name: 'Deli Pollo',
        price: 15.0,
        category: 'Ensaladas',
        image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        alerts: ['Mediano: $15', 'Grande: $17']
      },

      // SANDWICHES
      {
        name: 'Pollo Especial (Sandwich)',
        price: 7.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&q=80&w=600',
        preparationTime: 10,
        scheduleType: 'always',
        alerts: ['15cm: $7', '30cm: $9']
      },
      {
        name: 'Pollo Tradicional (Sandwich)',
        price: 10.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&q=80&w=600',
        preparationTime: 10,
        scheduleType: 'always',
        alerts: ['15cm: $10', '30cm: $12']
      },
      {
        name: 'Pollo Champiñón (Sandwich)',
        price: 8.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&q=80&w=600',
        preparationTime: 10,
        scheduleType: 'always',
        alerts: ['15cm: $8', '30cm: $10']
      },
      {
        name: 'Pollo Teriyaki (Sandwich)',
        price: 8.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&q=80&w=600',
        preparationTime: 10,
        scheduleType: 'always',
        alerts: ['15cm: $8', '30cm: $10']
      },
      {
        name: 'Pollo Premium (Sandwich)',
        price: 10.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=600',
        preparationTime: 10,
        scheduleType: 'always',
        alerts: ['15cm: $10', '30cm: $12']
      },
      {
        name: 'Pollo 4 Quesos (Sandwich)',
        price: 13.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        alerts: ['15cm: $13', '30cm: $15']
      },
      {
        name: 'Ranchero (Sandwich)',
        price: 10.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        alerts: ['15cm: $10', '30cm: $12']
      },
      {
        name: 'Lomito Tradicional (Sandwich)',
        price: 13.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        alerts: ['15cm: $13', '30cm: $15']
      },
      {
        name: 'Lomito Champiñón (Sandwich)',
        price: 13.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        alerts: ['15cm: $13', '30cm: $15']
      },
      {
        name: 'Lomito 4 Quesos (Sandwich)',
        price: 14.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        alerts: ['15cm: $14', '30cm: $16']
      },
      {
        name: "Q' Camarón (Sandwich)",
        price: 14.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        alerts: ['15cm: $14', '30cm: $16']
      },
      {
        name: "Q' Cangrejo (Sandwich)",
        price: 10.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        alerts: ['15cm: $10', '30cm: $12']
      },
      {
        name: 'Marítimo (Sandwich)',
        price: 16.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        alerts: ['15cm: $16', '30cm: $18']
      },
      {
        name: 'Italianisima (Sandwich)',
        price: 16.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        alerts: ['15cm: $16', '30cm: $18']
      },
      {
        name: 'Atún (Sandwich)',
        price: 8.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&q=80&w=600',
        preparationTime: 10,
        scheduleType: 'always',
        alerts: ['15cm: $8', '30cm: $10']
      },
      {
        name: 'Mediterraneo (Sandwich)',
        price: 8.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=600',
        preparationTime: 10,
        scheduleType: 'always',
        alerts: ['15cm: $8', '30cm: $10']
      },
      {
        name: "Q' Sandwich",
        price: 16.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        alerts: ['15cm: $16', '30cm: $18']
      },
      {
        name: "Q' Cesar (Sandwich)",
        price: 10.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&q=80&w=600',
        preparationTime: 10,
        scheduleType: 'always',
        alerts: ['15cm: $10', '30cm: $12']
      },
      {
        name: 'Vegetariano (Sandwich)',
        price: 8.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&q=80&w=600',
        preparationTime: 10,
        scheduleType: 'always',
        alerts: ['15cm: $8', '30cm: $10']
      },
      {
        name: 'Pernil (Sandwich)',
        price: 8.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=600',
        preparationTime: 10,
        scheduleType: 'always',
        alerts: ['15cm: $8', '30cm: $10']
      },
      {
        name: 'Sencillo (Sandwich)',
        price: 6.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&q=80&w=600',
        preparationTime: 8,
        scheduleType: 'always',
        alerts: ['15cm: $6', '30cm: $8']
      },
      {
        name: 'Parrillero (Sandwich)',
        price: 8.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        alerts: ['15cm: $8', '30cm: $10']
      },
      {
        name: 'Lomo de Cerdo (Sandwich)',
        price: 10.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=600',
        preparationTime: 10,
        scheduleType: 'always',
        alerts: ['15cm: $10', '30cm: $12']
      },
      {
        name: 'Roast Beef tradicional (Sandwich)',
        price: 13.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        alerts: ['15cm: $13', '30cm: $15']
      },
      {
        name: 'Roast Beef 4 Quesos (Sandwich)',
        price: 14.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        alerts: ['15cm: $14', '30cm: $16']
      },
      {
        name: 'Roast Beef Champiñón (Sandwich)',
        price: 13.0,
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=600',
        preparationTime: 12,
        scheduleType: 'always',
        alerts: ['15cm: $13', '30cm: $15']
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
      { name: 'Papas para Fritar', stock: 100, minStock: 25, unit: 'kg', cost: 1.8 }
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
