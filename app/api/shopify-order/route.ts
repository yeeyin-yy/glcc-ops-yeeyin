import { supabase } from '@/lib/supabase'
import { brandFor, money } from '@/lib/shopify-orders'
import { sendMessage } from '@/lib/telegram'

export const dynamic = 'force-dynamic'

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Shopify "orders/create" webhook target. Every store points its webhook here:
//   https://<app>/api/shopify-order?key=<SHOPIFY_WEBHOOK_TOKEN>
// One shared token guards all stores (simpler than per-store HMAC across 6 shops);
// the store is identified by the X-Shopify-Shop-Domain header → brand.
export async function POST(req: Request) {
  const url = new URL(req.url)
  if (url.searchParams.get('key') !== process.env.SHOPIFY_WEBHOOK_TOKEN?.trim()) {
    return new Response('forbidden', { status: 401 })
  }

  const domain = req.headers.get('x-shopify-shop-domain') || ''
  const brand = brandFor(domain)
  const o: any = await req.json().catch(() => null)
  // Always answer 200 quickly so Shopify doesn't retry-storm; just skip if unparseable.
  if (!o) return Response.json({ ok: true })

  const items: any[] = o.line_items || []
  const itemCount = items.reduce((s, li) => s + (Number(li.quantity) || 0), 0)
  const itemSummary =
    items.slice(0, 6).map(li => `${li.quantity}× ${li.title}`).join(', ') + (items.length > 6 ? ', …' : '')
  const customer = o.customer
    ? `${o.customer.first_name ?? ''} ${o.customer.last_name ?? ''}`.trim()
    : (o.billing_address?.name || o.shipping_address?.name || '')
  const delivery = o.shipping_lines?.[0]?.title || (o.shipping_address ? 'Shipping' : 'Self pickup')

  const row = {
    shop_domain: domain,
    brand,
    order_name: o.name || `#${o.order_number ?? ''}`,
    order_id: o.id ?? null,
    customer: customer || null,
    items: itemCount,
    item_summary: itemSummary || null,
    total: Number(o.total_price) || 0,
    currency: o.currency || null,
    financial_status: o.financial_status || null,
    fulfillment_status: o.fulfillment_status || 'unfulfilled',
    delivery,
    ordered_at: o.created_at || null,
  }

  // One route, two jobs, decided by the Shopify topic header:
  //  • orders/create (or no topic) → save the new order + fire the instant alert.
  //  • any update event (e.g. orders/fulfilled, orders/updated) → just refresh the
  //    status so the 3-day nudge stops chasing a shipped order. NO alert.
  // This means adding an "Order fulfillment" webhook later needs zero code changes.
  const topic = (req.headers.get('x-shopify-topic') || '').toLowerCase()
  const isCreate = topic === '' || topic === 'orders/create'

  if (!isCreate) {
    const { error } = await supabase
      .from('shopify_orders')
      .update({ fulfillment_status: row.fulfillment_status, financial_status: row.financial_status })
      .eq('shop_domain', row.shop_domain)
      .eq('order_id', row.order_id)
    if (error) console.error('[shopify-order] status update failed:', error.message)
    return Response.json({ ok: true })
  }

  // Save. Ignore duplicates (Shopify retries the same webhook on any non-2xx / timeout).
  const { error } = await supabase
    .from('shopify_orders')
    .upsert(row, { onConflict: 'shop_domain,order_id', ignoreDuplicates: true })
  if (error) console.error('[shopify-order] save failed:', error.message)

  // Instant Telegram alert so an order is never missed → no delivery delay.
  const owner = process.env.OWNER_CHAT_ID?.trim()
  if (owner) {
    const pay = row.financial_status === 'paid' ? '✅ Paid' : `⏳ ${esc(row.financial_status || 'pending')}`
    const msg =
      `🛒 <b>New order — ${esc(brand)}</b>\n` +
      `${esc(row.order_name)} · <b>${esc(row.customer || 'Guest')}</b>\n` +
      `${esc(row.item_summary || itemCount + ' item(s)')}\n` +
      `${esc(money(row.total, row.currency))} · ${pay}\n` +
      `📦 ${esc(row.delivery)}`
    await sendMessage(owner, msg)
  }

  return Response.json({ ok: true })
}
