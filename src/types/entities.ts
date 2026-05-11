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
  /** Option axes (Size / Color / Material / ...). Phase 8.1. */
  options?: ProductOption[];
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

/**
 * One option axis declared on a product — Phase 8.1.
 *
 * Variants reference these by `name`, picking one value per axis to
 * form their `option_values` map. A T-shirt with options
 * `[{name:"Size",values:["S","M","L"]}, {name:"Color",values:["Red","Blue"]}]`
 * has 6 variants, one per (Size, Color) pair.
 */
export interface ProductOption {
  name: string;
  position: number;
  values: string[];
}

/**
 * One purchasable variant — Phase 8.1.
 *
 * Themes render a variant picker by mapping each `ProductOption` to a
 * set of radio buttons / swatches, then finding the matching variant
 * via `option_values`. The matching variant's `id` is what
 * `add-to-cart` sends. Use the SDK helper `findVariantByOptions()` to
 * pick the right row given a partial selection.
 *
 * Note: `price` and `compare_at_price` are cents (integers), not
 * decimal — the backend ships these as string-decimals; the SDK
 * parses them to numbers when hydrating.
 */
export interface ProductVariant {
  id: string;
  position: number;
  /** Axis-name → chosen-value map. Single-variant products have `{}`. */
  option_values: Record<string, string>;
  price: number;
  price_currency?: string;
  compare_at_price?: number | null;
  sku?: string | null;
  barcode?: string | null;
  inventory_quantity: number;
  is_in_stock: boolean;
  image_url?: string | null;
  weight?: number | null;
  /** Legacy field — kept for backward compat with pre-Phase-8.1 themes
   *  that read `variant.name`. The backend stops setting this in 8.1;
   *  themes should switch to formatting `option_values` themselves. */
  name?: string;
  /** Alias for `is_in_stock`; preserved for backward compat. */
  in_stock?: boolean;
  /** Alias for `option_values`; preserved for backward compat. */
  options?: Record<string, string>;
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
