export type Role = 'admin' | 'waiter' | 'cook' | 'client' | 'finance';
export type TableStatus = 'free' | 'occupied' | 'waiting_bill';
export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered';
export type SessionStatus = 'active' | 'closed';

export interface User {
  id: string;
  name: string;
  role: Role;
  pin: string;
}

export interface Table {
  id: string;
  number: number | string;
  status: TableStatus;
  x?: number;
  y?: number;
  capacity?: number;
}

export interface Session {
  id: string;
  tableId: string;
  startTime: string;
  status: SessionStatus;
  totalAmount: number;
  type?: 'dine-in' | 'delivery';
  customerName?: string;
  customerAddress?: string;
  accounts?: { id: string; name: string; status?: 'active' | 'paid' }[];
  tipAmount?: number;
  tipPercent?: number;
}

export interface Account {
  id: string;
  sessionId: string;
  label: string;
}

export type CourseType = 'starter' | 'main' | 'dessert' | 'beverage';
export type CourseStatus = 'hold' | 'fired';

export interface OrderItem {
  id: string;
  accountId: string;
  menuItemId: string;
  quantity: number;
  status: OrderStatus;
  timestamp: string;
  note?: string;
  course?: CourseType;
  courseStatus?: CourseStatus;
  seatNumber?: number;
  // Extended info for UI
  menuItem?: MenuItem;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  recipe?: { ingredientId: string; quantity: number }[];
  scheduleType?: 'always' | 'breakfast' | 'lunch' | 'dinner' | 'custom';
  availableFrom?: string;
  availableTo?: string;
  alerts?: string[];
  course?: CourseType;
  is86ed?: boolean;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  stock: number;
  minStock: number;
}

export interface Transaction {
  id: string;
  sessionId: string;
  amount: number;
  method: 'cash' | 'digital';
  timestamp: string;
  tipAmount?: number;
  rating?: number;
  feedbackComment?: string;
}

export interface Promotion {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  image: string;
  actionText?: string;
  filterCategory?: string;
  filterQuery?: string;
  accentColor?: string;
  badgeBg?: string;
  badgeText?: string;
}

export interface CustomerFeedback {
  id?: string;
  orderId?: string;
  sessionId?: string;
  tableName?: string;
  customerName?: string;
  rating: number; // 1 to 5 stars
  tags: string[];
  comment?: string;
  timestamp: string;
}

