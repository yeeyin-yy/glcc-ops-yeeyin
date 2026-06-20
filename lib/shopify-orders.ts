import { supabase, supabaseConfigured } from './supabase'

// Maps each store's myshopify.com domain → the friendly brand name shown in
// alerts, the daily summary, and the dashboard. Add a store: add one line here.
export const BRANDS: Record<string, string> = {
  'oldtownroboticbarista.myshopify.com': 'Oldtown',
  'iboozee.myshopify.com': 'iBoozee Malaysia',
  'iboozesg.myshopify.com': 'iBoozee Singapore',
  'gaf4ds-1f.myshopify.com': 'X Coffee',
  'fetu0f-by.myshopify.com': 'SG Technician',
  'znjd5u-qj.myshopify.com': 'MY Technician',
}
export const brandFor = (domain?: string) =>
  BRANDS[(domain || '').toLowerCase()] ?? (domain || 'Unknown store')

export type ShopOrder = {
  id: number
  shop_domain: string
  brand: string
  order_name: string
  order_id: number | null
  customer: string | null
  items: number
  item_summary: string | null
  total: number
  currency: string | null
  financial_status: string | null
  fulfillment_status: string | null
  delivery: string | null
  ordered_at: string | null
  created_at: string
}

// Format a money amount with its store currency (Shopify gives ISO codes: SGD, MYR…).
export const money = (n: number, cur?: string | null) =>
  `${cur ? cur + ' ' : ''}${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export async function getShopifyOrders(limit = 300): Promise<ShopOrder[]> {
  if (!supabaseConfigured) return []
  const { data, error } = await supabase
    .from('shopify_orders')
    .select('*')
    .order('ordered_at', { ascending: false })
    .limit(limit)
  if (error) console.warn('[GLCC] could not read shopify_orders:', error.message)
  return (data ?? []) as ShopOrder[]
}
