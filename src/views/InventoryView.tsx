import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useRestaurantData } from '../hooks/useRestaurantData';
import { Ingredient, MenuItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { playClickSound, playSuccessSound, playErrorSound } from '../lib/audio';
import { 
  Plus, 
  AlertTriangle, 
  RefreshCw, 
  Database, 
  Trash2, 
  Edit, 
  DollarSign, 
  ClipboardList, 
  TrendingUp, 
  Percent, 
  Save, 
  X, 
  Eye, 
  PackageCheck,
  TrendingDown,
  ShoppingBag,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

interface IngredientWithCost extends Ingredient {
  cost?: number; // USD cost per unit
}

export default function InventoryView() {
  const { menu, exchangeRate } = useRestaurantData();
  const [ingredients, setIngredients] = useState<IngredientWithCost[]>([]);
  const [activeTab, setActiveTab] = useState<'stock' | 'recipes' | 'purchases' | 'waste'>('stock');
  const [isSeeding, setIsSeeding] = useState(false);

  // Modal states for stock
  const [editingIng, setEditingIng] = useState<IngredientWithCost | null>(null);
  const [isCreatingIng, setIsCreatingIng] = useState(false);
  const [isSavingIng, setIsSavingIng] = useState(false);
  const [ingForm, setIngForm] = useState({
    name: '',
    unit: 'und',
    stock: 0,
    minStock: 5,
    cost: 0
  });

  // Modal states for Recipes
  const [selectedRecipeItem, setSelectedRecipeItem] = useState<MenuItem | null>(null);
  const [recipeIngredients, setRecipeIngredients] = useState<{ ingredientId: string; quantity: number }[]>([]);
  const [newRecipeIngId, setNewRecipeIngId] = useState('');
  const [newRecipeQty, setNewRecipeQty] = useState('');
  const [isSavingRecipe, setIsSavingRecipe] = useState(false);

  // Purchase Form State
  const [purchaseIngId, setPurchaseIngId] = useState('');
  const [purchaseQty, setPurchaseQty] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseMinStock, setPurchaseMinStock] = useState<string>('');
  const [isSubmittingPurchase, setIsSubmittingPurchase] = useState(false);

  // Waste Form State
  const [wasteIngId, setWasteIngId] = useState('');
  const [wasteQty, setWasteQty] = useState('');
  const [wasteReason, setWasteReason] = useState('Dañado/Vencido');
  const [wasteNote, setWasteNote] = useState('');
  const [isSubmittingWaste, setIsSubmittingWaste] = useState(false);
  const [wastes, setWastes] = useState<any[]>([]);

  // Search, Filter & Sort states for Insumos (Stock)
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'critical' | 'optimal'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'cost' | 'status'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Search & Filter states for Recetas
  const [recipeSearchTerm, setRecipeSearchTerm] = useState('');
  const [recipeCategoryFilter, setRecipeCategoryFilter] = useState<string>('all');

  useEffect(() => {
    return onSnapshot(collection(db, 'inventory_wastes'), (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      list.sort((a: any, b: any) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() || 0 : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() || 0 : 0;
        return timeB - timeA;
      });
      setWastes(list);
    });
  }, []);

  useEffect(() => {
    if (purchaseIngId) {
      const selected = ingredients.find(i => i.id === purchaseIngId);
      if (selected) {
        setPurchaseMinStock(selected.minStock.toString());
      }
    } else {
      setPurchaseMinStock('');
    }
  }, [purchaseIngId, ingredients]);

  useEffect(() => {
    return onSnapshot(collection(db, 'inventory'), (snap) => {
      setIngredients(snap.docs.map(d => ({ ...d.data(), id: d.id } as IngredientWithCost)));
    });
  }, []);

  const seedData = async () => {
    setIsSeeding(true);
    try {
      const batch = writeBatch(db);

      // Seed Ingredients with Costs
      const ingItems = [
        { name: 'Pan de Hamburguesa', unit: 'und', stock: 100, minStock: 20, cost: 0.40 },
        { name: 'Carne de Res (150g)', unit: 'und', stock: 50, minStock: 10, cost: 2.20 },
        { name: 'Queso Cheddar', unit: 'und', stock: 200, minStock: 50, cost: 0.15 },
        { name: 'Salsa Bistro', unit: 'ml', stock: 5000, minStock: 1000, cost: 0.002 },
        { name: 'Papas Congeladas', unit: 'kg', stock: 40, minStock: 5, cost: 1.80 },
        { name: 'Tomate Fresco', unit: 'kg', stock: 15, minStock: 3, cost: 1.20 },
        { name: 'Lechuga', unit: 'und', stock: 12, minStock: 3, cost: 0.80 },
      ];

      for (const item of ingItems) {
        const ref = doc(collection(db, 'inventory'));
        batch.set(ref, item);
      }

      await batch.commit();
      alert('¡Insumos inicializados correctamente con costos demo!');
    } catch (err) {
      console.error(err);
      alert('Error al seedear data');
    }
    setIsSeeding(false);
  };

  // INGREDIENT ACTIONS
  const handleEditIng = (ing: IngredientWithCost) => {
    setEditingIng(ing);
    setIsCreatingIng(false);
    setIngForm({
      name: ing.name,
      unit: ing.unit,
      stock: ing.stock,
      minStock: ing.minStock,
      cost: ing.cost || 0
    });
  };

  const handleOpenCreateIng = () => {
    setIsCreatingIng(true);
    setEditingIng(null);
    setIngForm({
      name: '',
      unit: 'und',
      stock: 0,
      minStock: 5,
      cost: 0
    });
  };

  const handleSaveIng = async () => {
    if (isSavingIng) return;
    if (!ingForm.name.trim()) return;
    setIsSavingIng(true);
    try {
      const dataToSave = {
        name: ingForm.name.trim(),
        unit: ingForm.unit,
        stock: Number(ingForm.stock),
        minStock: Number(ingForm.minStock),
        cost: Number(ingForm.cost)
      };

      if (isCreatingIng) {
        await addDoc(collection(db, 'inventory'), dataToSave);
      } else if (editingIng) {
        await updateDoc(doc(db, 'inventory', editingIng.id), dataToSave);
      }
      setIsCreatingIng(false);
      setEditingIng(null);
    } catch (err) {
      alert('Error guardando insumo');
    } finally {
      setIsSavingIng(false);
    }
  };

  const handleDeleteIng = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este insumo del inventario?')) {
      try {
        await deleteDoc(doc(db, 'inventory', id));
      } catch (err) {
        alert('Error eliminando insumo');
      }
    }
  };

  // RECIPE ACTIONS
  const handleOpenRecipeModal = (item: MenuItem) => {
    setSelectedRecipeItem(item);
    setRecipeIngredients(item.recipe || []);
    setNewRecipeIngId('');
    setNewRecipeQty('');
  };

  const handleAddRecipeIngredient = () => {
    if (!newRecipeIngId || !newRecipeQty || Number(newRecipeQty) <= 0) return;
    
    // Check if ingredient already in recipe
    if (recipeIngredients.some(ri => ri.ingredientId === newRecipeIngId)) {
      alert('Este insumo ya forma parte de la receta.');
      return;
    }

    setRecipeIngredients([
      ...recipeIngredients,
      { ingredientId: newRecipeIngId, quantity: Number(newRecipeQty) }
    ]);
    setNewRecipeIngId('');
    setNewRecipeQty('');
  };

  const handleRemoveRecipeIngredient = (ingId: string) => {
    setRecipeIngredients(recipeIngredients.filter(ri => ri.ingredientId !== ingId));
  };

  const handleSaveRecipe = async () => {
    if (isSavingRecipe || !selectedRecipeItem) return;
    setIsSavingRecipe(true);
    try {
      await updateDoc(doc(db, 'menu', selectedRecipeItem.id), {
        recipe: recipeIngredients
      });
      setSelectedRecipeItem(null);
    } catch (err) {
      alert('Error guardando la receta del plato');
    } finally {
      setIsSavingRecipe(false);
    }
  };

  // PURCHASE ACTION
  const handleRegisterPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingPurchase) return;
    if (!purchaseIngId || !purchaseQty || !purchasePrice) return;
    
    setIsSubmittingPurchase(true);
    try {
      const selectedIng = ingredients.find(i => i.id === purchaseIngId);
      if (!selectedIng) return;

      const qty = Number(purchaseQty);
      const totalPaid = Number(purchasePrice);
      const newUnitCost = totalPaid / qty;

      // New Stock and update cost and minStock
      const newStock = selectedIng.stock + qty;
      const newMinStock = purchaseMinStock !== '' ? Number(purchaseMinStock) : selectedIng.minStock;
      
      await updateDoc(doc(db, 'inventory', selectedIng.id), {
        stock: newStock,
        cost: newUnitCost, // Set latest purchase cost as active cost
        minStock: newMinStock
      });

      // Automatically register expense in Finance
      await addDoc(collection(db, 'finance_entries'), {
        type: 'expense',
        category: 'Insumos',
        amount: totalPaid,
        description: `Compra de Insumo: ${qty} ${selectedIng.unit} de ${selectedIng.name} (Registrado desde Inventario)`,
        timestamp: new Date().toISOString(),
        isFiscal: false,
        paymentMethod: 'cash'
      });

      alert(`Compra registrada con éxito. Stock de ${selectedIng.name} actualizado a ${newStock} ${selectedIng.unit}, stock mínimo de alerta fijado en ${newMinStock}. Se ha registrado automáticamente el gasto de $${totalPaid.toFixed(2)} USD en Finanzas.`);
      setPurchaseIngId('');
      setPurchaseQty('');
      setPurchasePrice('');
      setPurchaseMinStock('');
    } catch (err) {
      console.error(err);
      alert('Error registrando la compra.');
    }
    setIsSubmittingPurchase(false);
  };

  // WASTE ACTION
  const handleRegisterWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wasteIngId || !wasteQty || !wasteReason) return;
    
    setIsSubmittingWaste(true);
    try {
      const selectedIng = ingredients.find(i => i.id === wasteIngId);
      if (!selectedIng) return;

      const qty = Number(wasteQty);
      if (qty <= 0) {
        alert('Por favor ingresa una cantidad válida mayor a 0.');
        setIsSubmittingWaste(false);
        return;
      }

      if (selectedIng.stock < qty) {
        if (!confirm(`La cantidad a mermar (${qty} ${selectedIng.unit}) es mayor al stock disponible (${selectedIng.stock} ${selectedIng.unit}). ¿Deseas forzar el registro? El stock quedará en negativo.`)) {
          setIsSubmittingWaste(false);
          return;
        }
      }

      const totalLoss = qty * (selectedIng.cost || 0);
      const newStock = selectedIng.stock - qty;

      // Update Stock in Inventory
      await updateDoc(doc(db, 'inventory', selectedIng.id), {
        stock: newStock
      });

      // Save waste record
      const wasteDocRef = await addDoc(collection(db, 'inventory_wastes'), {
        ingredientId: selectedIng.id,
        ingredientName: selectedIng.name,
        unit: selectedIng.unit,
        quantity: qty,
        cost: selectedIng.cost || 0,
        totalLoss: totalLoss,
        reason: wasteReason,
        note: wasteNote.trim(),
        timestamp: new Date().toISOString()
      });

      // Automatically register expense in Finance
      await addDoc(collection(db, 'finance_entries'), {
        type: 'expense',
        category: 'Mermas y Desperdicios',
        amount: totalLoss,
        description: `Merma de Insumo: ${qty} ${selectedIng.unit} de ${selectedIng.name} por ${wasteReason}. Nota: ${wasteNote.trim() || 'Sin notas.'}`,
        timestamp: new Date().toISOString(),
        isFiscal: false,
        paymentMethod: 'cash',
        wasteRefId: wasteDocRef.id // Add waste reference to delete easily later if needed!
      });

      playSuccessSound();
      alert(`Merma registrada con éxito. Stock de ${selectedIng.name} reducido a ${newStock} ${selectedIng.unit}. Pérdida calculada de $${totalLoss.toFixed(2)} USD registrada en Finanzas.`);
      
      setWasteIngId('');
      setWasteQty('');
      setWasteReason('Dañado/Vencido');
      setWasteNote('');
    } catch (err) {
      console.error(err);
      playErrorSound();
      alert('Error registrando la merma.');
    }
    setIsSubmittingWaste(false);
  };

  const handleDeleteWaste = async (waste: any) => {
    if (!confirm(`¿Estás seguro de cancelar esta merma? Se devolverán ${waste.quantity} ${waste.unit} al stock de ${waste.ingredientName} y se revertirá el gasto en finanzas.`)) return;

    try {
      const ing = ingredients.find(i => i.id === waste.ingredientId);
      if (ing) {
        // Return stock
        await updateDoc(doc(db, 'inventory', waste.ingredientId), {
          stock: ing.stock + waste.quantity
        });
      }

      // Delete the waste record
      await deleteDoc(doc(db, 'inventory_wastes', waste.id));

      // Revert/delete the finance entry that has wasteRefId matching this waste.id
      const { getDocs, query, where, collection: firestoreCollection } = await import('firebase/firestore');
      const financeQuery = query(firestoreCollection(db, 'finance_entries'), where('wasteRefId', '==', waste.id));
      const financeSnap = await getDocs(financeQuery);
      for (const docSnapshot of financeSnap.docs) {
        await deleteDoc(doc(db, 'finance_entries', docSnapshot.id));
      }

      playSuccessSound();
      alert('Registro de merma cancelado. Stock e informe financiero restaurados.');
    } catch (err) {
      console.error(err);
      playErrorSound();
      alert('Error al cancelar la merma.');
    }
  };

  // Cost calculations helpers
  const calculateFoodCost = (item: MenuItem) => {
    if (!item.recipe || item.recipe.length === 0) return 0;
    return item.recipe.reduce((total, ri) => {
      const ingredient = ingredients.find(ing => ing.id === ri.ingredientId);
      const ingCost = ingredient?.cost || 0;
      return total + (ingCost * ri.quantity);
    }, 0);
  };

  // Stock status counts
  const criticalCount = ingredients.filter(ing => ing.stock <= ing.minStock).length;
  const optimalCount = ingredients.filter(ing => ing.stock > ing.minStock).length;
  const lowStockCount = criticalCount;

  // Filtered & sorted ingredients list for Insumos (Stock) tab
  const filteredAndSortedIngredients = ingredients
    .filter((ing) => {
      const term = searchTerm.trim().toLowerCase();
      const matchesSearch = !term || 
        ing.name.toLowerCase().includes(term) || 
        ing.unit.toLowerCase().includes(term);

      const isLow = ing.stock <= ing.minStock;
      if (filterStatus === 'critical' && !isLow) return false;
      if (filterStatus === 'optimal' && isLow) return false;

      return matchesSearch;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
      } else if (sortBy === 'stock') {
        comparison = a.stock - b.stock;
      } else if (sortBy === 'cost') {
        comparison = (a.cost || 0) - (b.cost || 0);
      } else if (sortBy === 'status') {
        const aLow = a.stock <= a.minStock ? 1 : 0;
        const bLow = b.stock <= b.minStock ? 1 : 0;
        comparison = bLow - aLow; // Critical first by default
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Alphabetically sorted ingredients for Purchase and Waste form selectors
  const sortedIngredientsAlphabetical = [...ingredients].sort((a, b) => 
    a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
  );

  // Categories for Recipe Filter
  const recipeCategories = Array.from(new Set(menu.map(i => i.category))).filter(Boolean);

  // Filtered Recipes list
  const filteredRecipes = menu.filter((item) => {
    const term = recipeSearchTerm.trim().toLowerCase();
    const matchesSearch = !term || 
      item.name.toLowerCase().includes(term) || 
      item.category.toLowerCase().includes(term);

    if (recipeCategoryFilter !== 'all' && item.category !== recipeCategoryFilter) {
      return false;
    }
    return matchesSearch;
  });

  return (
    <div className="w-full flex-1 flex flex-col space-y-6 pb-16 min-h-full">
      <header className="mb-8 border-b border-slate-200/60 pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:pr-40">
        <div>
          <span className="text-[10px] uppercase tracking-widest font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 inline-block mb-1.5">
            Módulo de Control de Insumos & Recetas
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">Inventario y Costos</h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">Control exhaustivo de stock, costos unitarios de insumos y rentabilidad por receta.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {ingredients.length === 0 && (
            <button 
              onClick={seedData} 
              disabled={isSeeding}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSeeding ? <RefreshCw size={14} className="animate-spin" /> : <Database size={14} />}
              <span>Cargar Insumos Demo</span>
            </button>
          )}
          <button 
            onClick={handleOpenCreateIng}
            className="flex items-center gap-2 px-5 py-2.5 bg-black hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Nuevo Insumo</span>
          </button>
        </div>
      </header>

      {/* Low Stock Banner Alert */}
      {lowStockCount > 0 && (
        <div className="mb-8 p-4 bg-rose-50 border border-rose-100 rounded-3xl flex items-center gap-4 text-rose-950">
          <div className="w-10 h-10 bg-rose-500 text-white rounded-2xl flex items-center justify-center">
            <AlertTriangle size={20} />
          </div>
          <div>
            <div className="font-bold text-sm">Stock Crítico Detectado</div>
            <p className="text-rose-600 text-xs">Hay {lowStockCount} insumo(s) que están por debajo de su stock de alerta.</p>
          </div>
        </div>
      )}

      {/* SUB-MENU TABS DE NAVEGACIÓN DE INVENTARIO */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200/90 shadow-sm flex items-center gap-2 overflow-x-auto scrollbar-none w-full sm:w-fit mb-6 shrink-0">
        {[
          { 
            id: 'stock', 
            label: 'Insumos (Stock)', 
            icon: ClipboardList, 
            badge: ingredients.length > 0 ? ingredients.length : null,
            badgeColor: 'bg-slate-100 text-slate-800 font-extrabold'
          },
          { 
            id: 'recipes', 
            label: 'Costos de Recetas', 
            icon: TrendingUp, 
            badge: menu.length > 0 ? menu.length : null,
            badgeColor: 'bg-indigo-50 text-indigo-700 font-extrabold'
          },
          { 
            id: 'purchases', 
            label: 'Registrar Compra', 
            icon: ShoppingBag, 
            badge: null
          },
          { 
            id: 'waste', 
            label: 'Mermas y Bajas', 
            icon: Trash2, 
            badge: wastes.length > 0 ? wastes.length : null,
            badgeColor: 'bg-rose-50 text-rose-700 font-extrabold'
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                playClickSound();
                setActiveTab(tab.id as any);
              }}
              className={`flex items-center gap-2.5 px-4 sm:px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-black text-white shadow-md scale-[1.01]'
                  : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-amber-400' : 'text-slate-500'} />
              <span>{tab.label}</span>
              {tab.badge !== null && tab.badge !== undefined && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                  isActive ? 'bg-white/20 text-white font-black' : tab.badgeColor
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      {ingredients.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center bg-white rounded-[40px] border border-slate-100 shadow-sm p-8 text-center">
          <PackageCheck className="text-slate-200 mb-4" size={48} />
          <h4 className="font-bold text-slate-800 mb-1">Tu inventario está vacío</h4>
          <p className="text-slate-400 text-sm max-w-sm mb-6">Comienza registrando un insumo o haz clic en "Cargar Insumos Demo" arriba para poblar la base de datos de prueba.</p>
        </div>
      ) : (
        <>
          {activeTab === 'stock' && (
            <div className="space-y-4">
              {/* Controls Bar: Search & Filters */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 sm:p-5 space-y-4">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                  {/* Search Bar */}
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar insumo por nombre o unidad (ej. Queso, Carne, kg)..."
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-medium placeholder:text-slate-400 outline-none focus:border-black focus:bg-white transition-all"
                    />
                    {searchTerm && (
                      <button 
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none shrink-0">
                    <button
                      onClick={() => setFilterStatus('all')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                        filterStatus === 'all' 
                          ? 'bg-black text-white shadow-xs' 
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span>Todos</span>
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${filterStatus === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                        {ingredients.length}
                      </span>
                    </button>

                    <button
                      onClick={() => setFilterStatus('critical')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                        filterStatus === 'critical' 
                          ? 'bg-rose-600 text-white shadow-xs' 
                          : 'bg-rose-50 text-rose-700 border border-rose-100 hover:bg-rose-100'
                      }`}
                    >
                      <AlertTriangle size={12} />
                      <span>Stock Crítico</span>
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${filterStatus === 'critical' ? 'bg-white/20 text-white' : 'bg-rose-200/60 text-rose-800'}`}>
                        {criticalCount}
                      </span>
                    </button>

                    <button
                      onClick={() => setFilterStatus('optimal')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                        filterStatus === 'optimal' 
                          ? 'bg-emerald-600 text-white shadow-xs' 
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100'
                      }`}
                    >
                      <span>Óptimo</span>
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${filterStatus === 'optimal' ? 'bg-white/20 text-white' : 'bg-emerald-200/60 text-emerald-800'}`}>
                        {optimalCount}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Sort Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-2 text-slate-500 font-medium flex-wrap">
                    <div className="flex items-center gap-1 text-slate-400">
                      <Filter size={13} />
                      <span>Ordenar por:</span>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                      {[
                        { id: 'name', label: 'Nombre' },
                        { id: 'stock', label: 'Stock' },
                        { id: 'cost', label: 'Costo' },
                        { id: 'status', label: 'Estado' },
                      ].map((s) => (
                        <button
                          key={s.id}
                          onClick={() => {
                            if (sortBy === s.id) {
                              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            } else {
                              setSortBy(s.id as any);
                              setSortOrder('asc');
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                            sortBy === s.id 
                              ? 'bg-white text-black shadow-xs' 
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                      title="Cambiar orden ascendente/descendente"
                    >
                      {sortOrder === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                      <span>{sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}</span>
                    </button>

                    {(searchTerm || filterStatus !== 'all') && (
                      <button
                        onClick={() => { setSearchTerm(''); setFilterStatus('all'); }}
                        className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer ml-1"
                      >
                        Limpiar Filtros
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Insumos Table */}
              <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                {filteredAndSortedIngredients.length === 0 ? (
                  <div className="py-16 px-4 text-center space-y-3">
                    <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                      <Search size={22} />
                    </div>
                    <h5 className="font-bold text-slate-800 text-sm">No se encontraron insumos</h5>
                    <p className="text-slate-400 text-xs max-w-sm mx-auto">
                      No hay insumos que coincidan con la búsqueda o el filtro seleccionado.
                    </p>
                    <button
                      onClick={() => { setSearchTerm(''); setFilterStatus('all'); }}
                      className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-black transition-colors inline-block mt-2"
                    >
                      Mostrar Todos los Insumos
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                          <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-slate-400">Insumo</th>
                          <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-slate-400">Costo Unitario ($)</th>
                          <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-slate-400">Stock Actual</th>
                          <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-slate-400">Alerta Min.</th>
                          <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-slate-400">Estado</th>
                          <th className="p-6"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAndSortedIngredients.map((ing) => {
                          const isLow = ing.stock <= ing.minStock;
                          return (
                            <tr key={ing.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                              <td className="p-6">
                                <div className="font-bold text-slate-900">{ing.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono uppercase">Unidad: {ing.unit}</div>
                              </td>
                              <td className="p-6">
                                <div className="font-mono font-bold text-slate-800">
                                  ${(ing.cost || 0).toFixed(ing.unit === 'ml' ? 4 : 2)}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  Bs. {((ing.cost || 0) * exchangeRate).toFixed(2)}
                                </div>
                              </td>
                              <td className="p-6">
                                <div className={`font-mono font-bold text-lg ${isLow ? 'text-rose-500' : 'text-slate-900'}`}>
                                  {ing.stock} <span className="text-xs text-slate-400 font-bold uppercase">{ing.unit}</span>
                                </div>
                              </td>
                              <td className="p-6">
                                <div className="font-mono text-slate-400 text-sm">
                                  {ing.minStock} <span className="text-[10px] uppercase">{ing.unit}</span>
                                </div>
                              </td>
                              <td className="p-6">
                                {isLow ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight bg-rose-50 text-rose-600 border border-rose-100">
                                    <AlertTriangle size={10} /> Stock Crítico
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight bg-emerald-50 text-emerald-600 border border-emerald-100">
                                    Óptimo
                                  </span>
                                )}
                              </td>
                              <td className="p-6 text-right">
                                <div className="flex gap-2 justify-end">
                                  <button 
                                    onClick={() => handleEditIng(ing)}
                                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-black transition-colors"
                                    title="Editar Insumo"
                                  >
                                    <Edit size={16} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteIng(ing.id)}
                                    className="p-2 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                                    title="Eliminar Insumo"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'recipes' && (
            <div className="space-y-4">
              {/* Recipe Search & Category Bar */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text"
                    value={recipeSearchTerm}
                    onChange={(e) => setRecipeSearchTerm(e.target.value)}
                    placeholder="Buscar plato o receta..."
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-medium placeholder:text-slate-400 outline-none focus:border-black focus:bg-white transition-all"
                  />
                  {recipeSearchTerm && (
                    <button 
                      onClick={() => setRecipeSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs text-slate-400 font-bold shrink-0">Categoría:</span>
                  <select
                    value={recipeCategoryFilter}
                    onChange={(e) => setRecipeCategoryFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-bold outline-none focus:border-black w-full sm:w-auto"
                  >
                    <option value="all">Todas ({menu.length})</option>
                    {recipeCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[650px]">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-slate-400">Plato / Bebida</th>
                        <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-slate-400">Precio Venta</th>
                        <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-slate-400">Costo Estimado (Alimentos)</th>
                        <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-slate-400">Margen Bruto ($)</th>
                        <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-slate-400">Margen %</th>
                        <th className="p-6"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecipes.map((item) => {
                        const foodCost = calculateFoodCost(item);
                        const grossMargin = item.price - foodCost;
                        const marginPercent = item.price > 0 ? (grossMargin / item.price) * 100 : 0;
                        
                        return (
                          <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                            <td className="p-6 flex items-center gap-4">
                              {item.image && (
                                <img src={item.image} alt={item.name} className="w-12 h-12 rounded-xl object-cover" />
                              )}
                              <div>
                                <div className="font-bold text-slate-900">{item.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono uppercase">{item.category}</div>
                                <div className="text-[10px] text-slate-400 block mt-0.5">
                                  Receta: {item.recipe?.length || 0} ingredientes
                                </div>
                              </div>
                            </td>
                            <td className="p-6">
                              <div className="font-mono font-bold text-slate-900">${item.price.toFixed(2)}</div>
                              <div className="text-[10px] text-slate-400 font-mono">Bs. {(item.price * exchangeRate).toFixed(2)}</div>
                            </td>
                            <td className="p-6">
                              <div className="font-mono font-bold text-slate-800">${foodCost.toFixed(2)}</div>
                              <div className="text-[10px] text-slate-400 font-mono">Bs. {(foodCost * exchangeRate).toFixed(2)}</div>
                            </td>
                            <td className="p-6">
                              <div className={`font-mono font-bold ${grossMargin > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                ${grossMargin.toFixed(2)}
                              </div>
                            </td>
                            <td className="p-6">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                                  marginPercent > 60 
                                    ? 'bg-emerald-50 text-emerald-700' 
                                    : marginPercent > 40 
                                    ? 'bg-amber-50 text-amber-700' 
                                    : 'bg-rose-50 text-rose-700'
                                }`}>
                                  {marginPercent.toFixed(1)}%
                                </span>
                                {marginPercent < 40 && (
                                  <span className="text-slate-400" title="Margen bajo para estándares de restauración"><TrendingDown size={14} className="text-rose-400" /></span>
                                )}
                              </div>
                            </td>
                            <td className="p-6 text-right">
                              <button 
                                onClick={() => handleOpenRecipeModal(item)}
                                className="text-xs bg-black text-white hover:bg-slate-800 px-4 py-2 rounded-xl font-bold transition-colors cursor-pointer"
                              >
                                Configurar Receta
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'purchases' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Registrar compra */}
              <div className="md:col-span-1 bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 h-fit">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-black text-white rounded-lg flex items-center justify-center">
                    <ShoppingBag size={16} />
                  </div>
                  <h3 className="font-bold text-slate-900">Registrar Compra</h3>
                </div>

                <form onSubmit={handleRegisterPurchase} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Seleccionar Insumo</label>
                    <select
                      value={purchaseIngId}
                      onChange={e => setPurchaseIngId(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-black"
                    >
                      <option value="">Selecciona...</option>
                      {sortedIngredientsAlphabetical.map(i => (
                        <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Cantidad</label>
                      <input
                        type="number"
                        step="any"
                        value={purchaseQty}
                        onChange={e => setPurchaseQty(e.target.value)}
                        required
                        placeholder="Ej. 10"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Total Pagado ($)</label>
                      <input
                        type="number"
                        step="any"
                        value={purchasePrice}
                        onChange={e => setPurchasePrice(e.target.value)}
                        required
                        placeholder="Ej. 4.00"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-black"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Stock Mínimo de Alerta</label>
                    <input
                      type="number"
                      step="any"
                      value={purchaseMinStock}
                      onChange={e => setPurchaseMinStock(e.target.value)}
                      required
                      placeholder="Mínimo para alerta"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-black"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Si el stock disponible de este insumo es menor a este valor, el sistema te alertará automáticamente.
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingPurchase}
                    className="w-full bg-black text-white py-4 rounded-xl font-bold text-xs uppercase tracking-wider hover:scale-[1.02] transition-all shadow-md mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmittingPurchase ? 'Registrando...' : 'Ingresar al Inventario'}
                  </button>
                </form>
              </div>

              {/* Explicación de costeo */}
              <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-[32px] p-8 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg mb-4">¿Cómo se calcula la Rentabilidad de tu Restaurante?</h3>
                  <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                    <p>
                      <strong>1. Costo del Plato (Food Cost):</strong> Se calcula sumando el costo de todos los insumos necesarios para producir la porción del plato. Es crucial tener las recetas cargadas con las cantidades precisas de cada insumo.
                    </p>
                    <p>
                      <strong>2. Margen de Contribución:</strong> Es la diferencia entre el precio de venta y el costo del plato. Te indica cuánto dinero te deja neto cada plato vendido para cubrir los costos fijos (personal, alquiler, servicios).
                    </p>
                    <p>
                      <strong>3. Registro de Compras:</strong> Al registrar una nueva compra de insumos, el sistema actualiza el stock automáticamente y ajusta el Costo Unitario del insumo con el precio de compra más reciente, lo que actualiza de inmediato el Food Cost de todos tus platos en tiempo real.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-white/70 rounded-2xl border border-slate-200 text-xs font-mono text-slate-500 mt-6">
                  💡 <strong>Tip BistroFlow:</strong> Los restaurantes exitosos suelen operar con un Margen de Contribución Bruto de entre el <strong>60% y el 70%</strong> en alimentos, lo que equivale a un Food Cost de entre 30% y 40%.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'waste' && (
            <div className="space-y-8 animate-fade-in">
              {/* Resumen de Mermas */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-3xl border border-slate-100 p-6 flex items-center gap-4 shadow-sm">
                  <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 shrink-0">
                    <Trash2 size={22} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Incidentes</span>
                    <span className="text-2xl font-black text-slate-900">{wastes.length}</span>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-100 p-6 flex items-center gap-4 shadow-sm">
                  <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 shrink-0">
                    <DollarSign size={22} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Pérdida Económica</span>
                    <span className="text-2xl font-black text-rose-600">
                      ${wastes.reduce((sum, w) => sum + (w.totalLoss || 0), 0).toFixed(2)}
                    </span>
                    <span className="text-xs text-slate-400 font-medium block">
                      Bs. {(wastes.reduce((sum, w) => sum + (w.totalLoss || 0), 0) * exchangeRate).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-100 p-6 flex items-center gap-4 shadow-sm">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 shrink-0">
                    <AlertTriangle size={22} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Insumo Crítico</span>
                    <span className="text-sm font-bold text-slate-800 line-clamp-1">
                      {(() => {
                        const lossByIng: { [key: string]: { name: string; loss: number } } = {};
                        wastes.forEach(w => {
                          if (!lossByIng[w.ingredientId]) lossByIng[w.ingredientId] = { name: w.ingredientName, loss: 0 };
                          lossByIng[w.ingredientId].loss += (w.totalLoss || 0);
                        });
                        const sorted = Object.values(lossByIng).sort((a, b) => b.loss - a.loss);
                        return sorted.length > 0 ? `${sorted[0].name} ($${sorted[0].loss.toFixed(2)})` : 'Ninguno';
                      })()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Formulario de Registro */}
                <div className="lg:col-span-1 bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 h-fit">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 bg-rose-500 text-white rounded-lg flex items-center justify-center">
                      <Trash2 size={16} />
                    </div>
                    <h3 className="font-bold text-slate-900">Registrar Desperdicio</h3>
                  </div>

                  <form onSubmit={handleRegisterWaste} className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Insumo Afectado</label>
                      <select
                        value={wasteIngId}
                        onChange={e => setWasteIngId(e.target.value)}
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-black"
                      >
                        <option value="">Selecciona...</option>
                        {sortedIngredientsAlphabetical.map(i => (
                          <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Cantidad</label>
                        <input
                          type="number"
                          step="any"
                          value={wasteQty}
                          onChange={e => setWasteQty(e.target.value)}
                          required
                          placeholder="Ej. 1.5"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-black"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Motivo Merma</label>
                        <select
                          value={wasteReason}
                          onChange={e => setWasteReason(e.target.value)}
                          required
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-black"
                        >
                          <option value="Dañado/Vencido">Dañado / Vencido</option>
                          <option value="Error de Cocina">Error de Cocina</option>
                          <option value="Derrame/Caída">Derrame / Caída</option>
                          <option value="Devolución de Cliente">Devolución</option>
                          <option value="Otro">Otro</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Notas / Justificación</label>
                      <textarea
                        value={wasteNote}
                        onChange={e => setWasteNote(e.target.value)}
                        placeholder="Ej. Tomates de caja superior llegaron con hongo o se quemó la ración..."
                        rows={3}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-black resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingWaste}
                      className="w-full bg-black text-white py-4 rounded-xl font-bold text-xs uppercase tracking-wider hover:scale-[1.02] transition-all shadow-md mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSubmittingWaste ? 'Procesando...' : 'Registrar Merma'}
                    </button>
                  </form>
                </div>

                {/* Historial de Mermas */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden p-6">
                    <h3 className="font-bold text-slate-900 text-sm mb-4">Registro Histórico de Incidentes</h3>
                    {wastes.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 italic text-sm">
                        No se han registrado incidentes de mermas o desperdicios hasta ahora. ¡Excelente gestión de cocina!
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[500px]">
                          <thead>
                            <tr className="border-b border-slate-100 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                              <th className="pb-3 pr-4">Fecha / Insumo</th>
                              <th className="pb-3 pr-4">Cantidad mermada</th>
                              <th className="pb-3 pr-4">Pérdida Económica</th>
                              <th className="pb-3 pr-4">Motivo</th>
                              <th className="pb-3">Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {wastes.map(w => {
                              const wasteDate = new Date(w.timestamp).toLocaleString('es-ES', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              });
                              return (
                                <tr key={w.id} className="border-b border-slate-50 hover:bg-slate-50/20 text-xs transition-colors">
                                  <td className="py-4 pr-4">
                                    <div className="font-bold text-slate-900">{w.ingredientName}</div>
                                    <div className="text-[10px] text-slate-400">{wasteDate}</div>
                                    {w.note && (
                                      <div className="text-[10px] text-slate-500 italic mt-0.5 line-clamp-1" title={w.note}>
                                        "{w.note}"
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-4 pr-4 font-bold font-mono text-slate-800">
                                    {w.quantity} <span className="text-[10px] text-slate-400 uppercase">{w.unit}</span>
                                  </td>
                                  <td className="py-4 pr-4">
                                    <div className="font-mono font-bold text-rose-600">${(w.totalLoss || 0).toFixed(2)}</div>
                                    <div className="text-[9px] text-slate-400 font-mono">Bs. {((w.totalLoss || 0) * exchangeRate).toFixed(2)}</div>
                                  </td>
                                  <td className="py-4 pr-4">
                                    <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                      w.reason === 'Dañado/Vencido' 
                                        ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                                        : w.reason === 'Error de Cocina'
                                        ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                        : w.reason === 'Devolución de Cliente'
                                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                        : 'bg-slate-100 text-slate-700'
                                    }`}>
                                      {w.reason}
                                    </span>
                                  </td>
                                  <td className="py-4">
                                    <button
                                      onClick={() => handleDeleteWaste(w)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                      title="Revertir Merma"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Recomendación Logística */}
                  <div className="bg-gradient-to-r from-slate-900 to-slate-850 text-slate-200 rounded-[32px] p-6 shadow-md">
                    <h4 className="font-bold text-white text-sm mb-2 flex items-center gap-1.5">
                      <AlertTriangle size={16} className="text-amber-400" />
                      Recomendación Logística para Reducción de Mermas
                    </h4>
                    <p className="text-slate-300 text-xs leading-relaxed">
                      El registro de mermas te permite cuantificar el costo real de tus desperdicios. 
                      Para optimizar, implementa el sistema <strong>FIFO / PEPS</strong> (Primero en Entrar, Primero en Salir) 
                      en tus cámaras frías y estanterías. Si los desperdicios por "Error de Cocina" superan el 15% del total de mermas, 
                      realiza una calibración de recetas estándar con tu personal de cocina.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL: CREATE / EDIT INGREDIENT */}
      <AnimatePresence>
        {(isCreatingIng || editingIng) && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[32px] shadow-2xl max-w-md w-full overflow-hidden border border-slate-100"
            >
              <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-lg text-slate-950">
                  {isCreatingIng ? 'Nuevo Insumo' : 'Editar Insumo'}
                </h3>
                <button onClick={() => { setIsCreatingIng(false); setEditingIng(null); }} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-black transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Nombre del Insumo</label>
                  <input 
                    type="text" 
                    value={ingForm.name}
                    onChange={e => setIngForm({ ...ingForm, name: e.target.value })}
                    placeholder="Ej. Tomates, Queso Cheddar..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-black"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Unidad de Medida</label>
                    <select 
                      value={ingForm.unit}
                      onChange={e => setIngForm({ ...ingForm, unit: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-black"
                    >
                      <option value="und">Unidad (und)</option>
                      <option value="kg">Kilogramo (kg)</option>
                      <option value="g">Gramo (g)</option>
                      <option value="lt">Litro (lt)</option>
                      <option value="ml">Mililitro (ml)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Costo Unitario ($)</label>
                    <input 
                      type="number" 
                      step="any"
                      value={ingForm.cost}
                      onChange={e => setIngForm({ ...ingForm, cost: Number(e.target.value) })}
                      placeholder="Ej. 1.50"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-black text-right font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Stock Inicial</label>
                    <input 
                      type="number" 
                      step="any"
                      value={ingForm.stock}
                      onChange={e => setIngForm({ ...ingForm, stock: Number(e.target.value) })}
                      placeholder="0"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-black text-right font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Mínimo de Alerta</label>
                    <input 
                      type="number" 
                      step="any"
                      value={ingForm.minStock}
                      onChange={e => setIngForm({ ...ingForm, minStock: Number(e.target.value) })}
                      placeholder="5"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-black text-right font-mono"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex gap-3">
                  <button 
                    onClick={() => { setIsCreatingIng(false); setEditingIng(null); }}
                    className="flex-1 py-4 border border-slate-200 text-slate-500 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSaveIng}
                    disabled={!ingForm.name.trim() || isSavingIng}
                    className="flex-1 py-4 bg-black text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:scale-[1.02] transition-all flex justify-center items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <Save size={14} /> {isSavingIng ? 'Guardando...' : 'Guardar Insumo'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CONFIGURE RECIPE */}
      <AnimatePresence>
        {selectedRecipeItem && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[32px] shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100"
            >
              <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h3 className="font-bold text-lg text-slate-950">Receta Estándar</h3>
                  <p className="text-xs text-slate-400">Configura la receta de <strong>{selectedRecipeItem.name}</strong></p>
                </div>
                <button onClick={() => setSelectedRecipeItem(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-black transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[500px] overflow-y-auto">
                {/* Form to add ingredient to recipe */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">Agregar Insumo a la Receta</h4>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <select
                      value={newRecipeIngId}
                      onChange={e => setNewRecipeIngId(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-black"
                    >
                      <option value="">Insumo...</option>
                      {sortedIngredientsAlphabetical.map(ing => (
                        <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                      ))}
                    </select>
                    
                    <div className="relative w-full sm:w-28">
                      <input 
                        type="number" 
                        step="any"
                        placeholder="Cant."
                        value={newRecipeQty}
                        onChange={e => setNewRecipeQty(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none text-right focus:border-black"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] uppercase font-bold">
                        {ingredients.find(i => i.id === newRecipeIngId)?.unit || 'u'}
                      </span>
                    </div>

                    <button
                      onClick={handleAddRecipeIngredient}
                      className="bg-black text-white hover:bg-slate-800 px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 shrink-0"
                    >
                      <Plus size={14} /> Añadir
                    </button>
                  </div>
                </div>

                {/* Recipe List */}
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-3">Insumos de esta Receta</h4>
                  {recipeIngredients.length === 0 ? (
                    <p className="text-slate-400 text-xs italic text-center py-4">No hay insumos definidos en la receta de este plato.</p>
                  ) : (
                    <div className="space-y-2">
                      {recipeIngredients.map((ri, index) => {
                        const ing = ingredients.find(i => i.id === ri.ingredientId);
                        if (!ing) return null;
                        const lineCost = (ing.cost || 0) * ri.quantity;
                        
                        return (
                          <div key={ri.ingredientId || index} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl text-xs">
                            <div className="flex-1">
                              <span className="font-bold text-slate-800">{ing.name}</span>
                              <span className="text-slate-400 ml-2 font-mono">
                                ({ri.quantity} {ing.unit})
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="font-mono text-slate-500 font-medium">
                                Costo: ${lineCost.toFixed(2)}
                              </span>
                              <button 
                                onClick={() => handleRemoveRecipeIngredient(ri.ingredientId)}
                                className="text-rose-400 hover:text-rose-600 p-1"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Cost Summary */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-sm bg-slate-50 p-4 rounded-2xl">
                  <div>
                    <span className="text-slate-400 text-xs block font-bold uppercase tracking-widest">Costo total alimentos</span>
                    <span className="font-mono font-bold text-slate-900 text-lg">
                      ${recipeIngredients.reduce((total, ri) => {
                        const ing = ingredients.find(i => i.id === ri.ingredientId);
                        return total + ((ing?.cost || 0) * ri.quantity);
                      }, 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 text-xs block font-bold uppercase tracking-widest">Precio Venta Plato</span>
                    <span className="font-mono font-bold text-emerald-600 text-lg">
                      ${selectedRecipeItem.price.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                <button 
                  onClick={() => setSelectedRecipeItem(null)}
                  className="flex-1 py-4 border border-slate-200 text-slate-500 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveRecipe}
                  className="flex-1 py-4 bg-black text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:scale-[1.02] transition-all flex justify-center items-center gap-2"
                >
                  <Save size={14} /> Guardar Receta
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
