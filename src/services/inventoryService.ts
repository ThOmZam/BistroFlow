import { 
  collection, 
  doc, 
  runTransaction, 
  getDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { MenuItem, Ingredient } from '../types';

export const inventoryService = {
  /**
   * Deduct ingredients from inventory based on order items.
   * This should be called when an order is moved to 'preparing' or 'delivered' 
   * depending on restaurant policy. Here we'll do it when it's moved to 'preparing'.
   */
  async deductIngredients(menuItemId: string, quantity: number, excludedIngredientIds: string[] = []) {
    try {
      await runTransaction(db, async (transaction) => {
        const menuItemDoc = await transaction.get(doc(db, 'menu', menuItemId));
        if (!menuItemDoc.exists()) throw new Error('Menu item not found');
        
        const menuItem = menuItemDoc.data() as MenuItem;
        if (!menuItem.recipe) return;

        for (const ingredientRef of menuItem.recipe) {
          if (excludedIngredientIds.includes(ingredientRef.ingredientId)) {
            // Skip stock deduction for this ingredient because it was deselected/excluded
            continue;
          }
          const ingredientDoc = await transaction.get(doc(db, 'inventory', ingredientRef.ingredientId));
          if (!ingredientDoc.exists()) continue;
          
          const ingredient = ingredientDoc.data() as Ingredient;
          const newStock = ingredient.stock - (ingredientRef.quantity * quantity);
          
          transaction.update(doc(db, 'inventory', ingredientRef.ingredientId), {
            stock: newStock
          });
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'inventory');
    }
  }
};
