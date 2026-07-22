import { useState, useEffect } from 'react';
import { collectionGroup, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { OrderItem } from '../types';

export function useOrders() {
  const [orders, setOrders] = useState<OrderItem[]>([]);

  useEffect(() => {
    // Collection group query to find all 'orders' in all sessions/accounts
    const q = query(
      collectionGroup(db, 'orders'),
      where('status', 'in', ['pending', 'preparing', 'ready']),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map(d => ({ ...d.data(), id: d.id, path: d.ref.path } as OrderItem & { path: string })));
    }, (err) => {
      console.error('KDS Listen error:', err);
    });

    return () => unsubscribe();
  }, []);

  return { orders };
}
