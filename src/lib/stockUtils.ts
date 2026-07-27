import { MenuItem, Ingredient } from '../types';

export interface StockAlert {
  status: 'available' | 'low_stock' | 'out_of_stock';
  text: string;
  portions: number | null;
}

export function getMenuItemStockAlert(item: MenuItem, ingredients: Ingredient[] = [], auto86Enabled: boolean = true): StockAlert {
  if (!item) {
    return { status: 'available', text: '', portions: null };
  }

  if (item.is86ed) {
    return {
      status: 'out_of_stock',
      text: 'Agotado (86)',
      portions: 0
    };
  }

  if (!item.recipe || item.recipe.length === 0 || !Array.isArray(ingredients)) {
    return { status: 'available', text: '', portions: null };
  }

  let minPortions = Infinity;
  let isOutOfStock = false;
  let isLowStock = false;
  let outOfStockIngs: string[] = [];
  let lowStockIngs: string[] = [];

  for (const ri of item.recipe) {
    const ing = ingredients.find(i => i.id === ri.ingredientId);
    if (!ing) continue;

    // Calculate available portions for this ingredient
    const availablePortions = Math.floor(ing.stock / ri.quantity);
    if (availablePortions < minPortions) {
      minPortions = availablePortions;
    }

    if (ing.stock < ri.quantity) {
      isOutOfStock = true;
      outOfStockIngs.push(ing.name);
    } else if (ing.stock <= ing.minStock) {
      isLowStock = true;
      lowStockIngs.push(ing.name);
    }
  }

  if (minPortions === Infinity) {
    return { status: 'available', text: '', portions: null };
  }

  if ((isOutOfStock || minPortions <= 0) && auto86Enabled) {
    const detail = outOfStockIngs.length > 0 ? ` (Falta ${outOfStockIngs[0]})` : '';
    return { 
      status: 'out_of_stock', 
      text: `Agotado / 86${detail}`, 
      portions: 0 
    };
  }

  if (isLowStock || minPortions <= 4) {
    return { 
      status: 'low_stock', 
      text: `Stock Bajo (${minPortions} porc.)`, 
      portions: minPortions 
    };
  }

  return { 
    status: 'available', 
    text: `Disponible (${minPortions} porc.)`, 
    portions: minPortions 
  };
}

export function isMenuItem86ed(item: MenuItem, ingredients: Ingredient[] = [], auto86Enabled: boolean = true): boolean {
  if (!item) return false;
  if (item.is86ed) return true;
  if (!auto86Enabled) return false;
  const alert = getMenuItemStockAlert(item, ingredients, auto86Enabled);
  return alert.status === 'out_of_stock';
}
