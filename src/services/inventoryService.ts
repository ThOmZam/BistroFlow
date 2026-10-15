import { 
  collection, 
  doc, 
  runTransaction, 
  getDocs 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { MenuItem, Ingredient, ExtraOption } from '../types';

export const inventoryService = {
  /**
   * Deduct ingredients from inventory based on order items, including extras.
   * Reads all required documents prior to writing to adhere strictly to Firestore transaction rules.
   */
  async deductIngredients(
    menuItemId: string, 
    quantity: number, 
    excludedIngredientIds: string[] = [],
    extras: ExtraOption[] = [],
    variantId?: string
  ) {
    try {
      // Fetch all inventory items first to allow matching extras by ingredient name if ingredientId is unassigned
      const inventorySnap = await getDocs(collection(db, 'inventory'));
      const allIngredients = inventorySnap.docs.map(d => ({ id: d.id, ...d.data() } as Ingredient));

      await runTransaction(db, async (transaction) => {
        const menuItemDoc = await transaction.get(doc(db, 'menu', menuItemId));
        if (!menuItemDoc.exists()) {
          console.warn(`Menu item ${menuItemId} not found for inventory deduction`);
          return;
        }

        const menuItem = menuItemDoc.data() as MenuItem;
        const deductionsMap = new Map<string, number>(); // ingredientId -> total quantity to deduct

        // Look for selected variant if any
        const matchedVariant = menuItem.variants?.find(v => v.id === variantId);

        // A) Process Recipe (Use variant recipe if defined, otherwise base recipe)
        const activeRecipe = (matchedVariant && matchedVariant.recipe && matchedVariant.recipe.length > 0)
          ? matchedVariant.recipe
          : menuItem.recipe;

        if (activeRecipe && Array.isArray(activeRecipe)) {
          for (const recipeItem of activeRecipe) {
            if (excludedIngredientIds.includes(recipeItem.ingredientId)) {
              // Skip stock deduction for this ingredient because it was deselected/excluded
              continue;
            }
            const currentQty = deductionsMap.get(recipeItem.ingredientId) || 0;
            deductionsMap.set(recipeItem.ingredientId, currentQty + (recipeItem.quantity * quantity));
          }
        }

        // A.1) If variant name mentions a protein or ingredient (e.g. "Camarón", "Cangrejo") and not yet deducted
        if (matchedVariant && matchedVariant.name) {
          const vNameLower = matchedVariant.name.toLowerCase();
          const matchedIng = allIngredients.find(ing => 
            vNameLower.includes(ing.name.toLowerCase()) || 
            ing.name.toLowerCase().includes(vNameLower.replace(/^(con|de|en|y)\s+/i, '').trim())
          );
          if (matchedIng && !deductionsMap.has(matchedIng.id)) {
            const currentQty = deductionsMap.get(matchedIng.id) || 0;
            // Deduct standard 0.15kg or 1 unit if not specified
            const defaultQty = matchedIng.unit === 'kg' ? 0.15 : 1;
            deductionsMap.set(matchedIng.id, currentQty + (defaultQty * quantity));
          }
        }

        // A.2) Process Combo items directly matching inventory (e.g. drinks, bottles)
        if (menuItem.isCombo && menuItem.comboItems && Array.isArray(menuItem.comboItems)) {
          for (const ci of menuItem.comboItems) {
            const matchedDirect = allIngredients.find(ing => 
              ing.name.toLowerCase().trim() === ci.name.toLowerCase().trim() ||
              ci.name.toLowerCase().includes(ing.name.toLowerCase().trim())
            );
            if (matchedDirect && !deductionsMap.has(matchedDirect.id)) {
              const currentQty = deductionsMap.get(matchedDirect.id) || 0;
              deductionsMap.set(matchedDirect.id, currentQty + ((ci.quantity || 1) * quantity));
            }
          }
        }

        // B) Process Extras / Adicionales
        if (extras && Array.isArray(extras) && extras.length > 0) {
          for (const extra of extras) {
            let matchedIngId: string | undefined = extra.ingredientId;

            // If no explicit ingredientId on extra, search inventory by name
            if (!matchedIngId && extra.name) {
              const extraNameClean = extra.name.toLowerCase().replace(/^(extra|adicional|sin)\s+/i, '').trim();
              const matchedIng = allIngredients.find(ing => {
                const ingNameClean = ing.name.toLowerCase().trim();
                return ingNameClean === extraNameClean || 
                       extra.name.toLowerCase().includes(ingNameClean) ||
                       ingNameClean.includes(extraNameClean);
              });

              if (matchedIng) {
                matchedIngId = matchedIng.id;
              }
            }

            if (matchedIngId) {
              const extraQty = (extra.quantity || 1) * quantity;
              const currentQty = deductionsMap.get(matchedIngId) || 0;
              deductionsMap.set(matchedIngId, currentQty + extraQty);
            }
          }
        }

        if (deductionsMap.size === 0) return;

        // READ ALL Ingredient Docs in Transaction BEFORE ANY WRITES
        const ingredientDocsMap = new Map<string, { ref: any; currentStock: number }>();
        for (const [ingredientId] of deductionsMap.entries()) {
          const ingRef = doc(db, 'inventory', ingredientId);
          const ingDoc = await transaction.get(ingRef);
          if (ingDoc.exists()) {
            const data = ingDoc.data() as Ingredient;
            ingredientDocsMap.set(ingredientId, {
              ref: ingRef,
              currentStock: data.stock || 0
            });
          }
        }

        // WRITE ALL Updates
        for (const [ingredientId, deductQty] of deductionsMap.entries()) {
          const ingData = ingredientDocsMap.get(ingredientId);
          if (ingData) {
            const newStock = Math.max(0, ingData.currentStock - deductQty);
            transaction.update(ingData.ref, { stock: newStock });
          }
        }
      });
    } catch (error) {
      console.error('Error deducting ingredients and extras:', error);
      handleFirestoreError(error, OperationType.WRITE, 'inventory');
    }
  }
};
