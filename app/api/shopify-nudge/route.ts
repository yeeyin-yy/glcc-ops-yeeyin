import { sendMessage } from '@/lib/telegram'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { money, type ShopOrder } from '@/lib/shopify-orders'

export const dynamic = 'force-dynamic'

// Daily nudge: orders still unfulfilled 3+ days after they were placed, so nothing
// slips into a long delivery delay. Reads our own table — no Shopify call.
// NOTE: fulfillment_status is captured at order-creation time. To have this stop
// nagging the moment YOU ship an order, add an "Order fulfillment" webhook per store
// (route already updates the row by topic) — optional precision upgrade.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('forbidden', { status: 401 })
  }
  const owner = process.env.OWNER_CHAT_ID?.trim()
  if (!supabaseConfigured) return Response.json({ ok: false, reason: 'supabase_not_configured' })

  const cutoff = new Date(Date.now() - 3 * 864e5).toISOString()
  const { data } = await supabase
    .from('shopify_orders')
    .select('*')
    .lte('ordered_at', cutoff)
    .order('ordered_at', { ascending: true })
  const stale = ((data ?? []) as ShopOrder[]).filter(o => (o.fulfillment_status || 'unfulfilled') !== 'fulfilled')

  // Stay quiet when there's nothing to chase.
  if (stale.length === 0) return Response.json({ ok: true, stale: 0 })

  const byBrand: Record<string, ShopOrder[]> = {}
  for (const o of stale) (byBrand[o.brand] ||= []).push(o)

  let msg = `⏰ <b>Unfulfilled 3+ days</b> — ${stale.length} order(s) still need shipping\n`
  for (const [brand, list] of Object.entries(byBrand)) {
    msg += `\n<b>${brand}</b> (${list.length})\n`
    for (const o of list.slice(0, 10)) {
      const days = Math.floor((Date.now() - new Date(o.ordered_at || o.created_at).getTime()) / 864e5)
      msg += `• ${o.order_name} ${o.customer || ''} — ${o.item_summary || o.items + ' item(s)'} · ${days}d (${money(o.total, o.currency)})\n`
    }
    if (list.length > 10) msg += `…and ${list.length - 10} more\n`
  }

  if (owner) await sendMessage(owner, msg.slice(0, 4096))
  return Response.json({ ok: true, stale: stale.length })
}
