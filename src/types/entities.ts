/** Core store entity */
export interface Store {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  subdomain?: string;
  logo_url?: string;
  description?: string;
  currency: string;
  default_language: string;
  use_nextjs_storefront: boolean;
  social_links?: Record<string, string>;
}

/** Product entity */
export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  compare_at_price?: number;
  currency: string;
  images: ProductImage[];
  variants: ProductVariant[];
  category?: string;
  tags?: string[];
  in_stock: boolean;
  seo_title?: string;
  seo_description?: string;
}

export interface ProductImage {
  id: string;
  url: string;
  alt?: string;
  position: number;
}

export interface ProductVariant {
  id: string;
  name: string;
  price: number;
  compare_at_price?: number;
  sku?: string;
  in_stock: boolean;
  inventory_quantity?: number;
  options: Record<string, string>;
}

/** Collection entity */
export interface Collection {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  product_count: number;
  products?: Product[];
}

/** Cart entity */
export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  total: number;
  currency: string;
  discount_code?: string;
  discount_amount?: number;
  note?: string;
}

export interface CartItem {
  id: string;
  product_id: string;
  variant_id?: string;
  name: string;
  image_url?: string;
  price: number;
  quantity: number;
  variant_name?: string;
}

/** Customer entity */
export interface Customer {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  avatar_url?: string;
  orders_count: number;
  total_spent: number;
}

/** Order entity */
export interface Order {
  id: string;
  order_number: string;
  status: string;
  total: number;
  currency: string;
  items: OrderItem[];
  created_at: string;
  shipping_address?: Address;
}

export interface OrderItem {
  product_id: string;
  variant_id?: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postal_code?: string;
  country: string;
}

/** Page entity */
export interface Page {
  type: string;
  title: string;
  handle?: string;
  data?: Record<string, any>;
}
