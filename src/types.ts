export interface InventoryItem {
  id: number;
  name: string;
  quantity: number;
  available: number;
  rented: number;
  price: number;
  created_at?: string;
  updated_at?: string;
}

export interface Customer {
  id: number;
  name: string;
  tax_id: string;
  address: string;
  phone: string;
  created_at?: string;
  updated_at?: string;
}

export interface RentalItem {
  id: number;
  rental_id: number;
  inventory_id: number;
  quantity: number;
  item_name?: string;
  item_price?: number;
}

export interface Rental {
  id: number;
  customer_id: number;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  customer_tax_id?: string;
  delivery_date: string;
  return_date: string;
  status: 'ACTIVE' | 'RETURNED';
  items?: RentalItem[];
  created_at?: string;
}

export interface DashboardStats {
  totalInventory: number;
  availableInventory: number;
  activeRentals: number;
  totalCustomers: number;
}
