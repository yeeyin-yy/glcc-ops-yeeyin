import { sendMessage } from '@/lib/telegram'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { money, type ShopOrder } from '@/lib/shopify-orders'

export const dynamic = 'force-dynamic'

// Daily 8am (00:00 UTC) cron: rolls up the last 24h of Shopify orders, grouped by
// brand, and Telegrams the owner. Reads from our own table (filled by the webhook),
// so it never touches Shopify directly.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('forbidden', { status: 401 })
  }
  const owner = process.env.OWNER_CHAT_ID?.trim()
  if (!supabaseConfigured) return Response.json({ ok: false, reason: 'supabase_not_configured' })

  const since = new Date(Date.now() - 24 * 3600e3).toISOString()
  const { data } = await supabase
    .from('shopify_orders')
    .select('*')
    .gte('ordered_at', since)
    .order('ordered_at', { ascending: false })
  const orders = (data ?? []) as ShopOrder[]

  if (orders.length === 0) {
    if (owner) await sendMessage(owner, '🌅 <b>Daily order summary</b>\nNo new orders in the last 24h.')
    return Response.json({ ok: true, orders: 0 })
  }

  const byBrand: Record<string, ShopOrder[]> = {}
  for (const o of orders) (byBrand[o.brand] ||= []).push(o)

  let msg = `🌅 <b>Daily order summary</b> — last 24h · ${orders.length} order(s)\n`
  for (const [brand, list] of Object.entries(byBrand)) {
    const cur = list[0].currency
    const sum = list.reduce((s, o) => s + Number(o.total || 0), 0)
    const unfulfilled = list.filter(o => (o.fulfillment_status || 'unfulfilled') !== 'fulfilled').length
    msg += `\n<b>${brand}</b> — ${list.length} order(s), ${money(sum, cur)}`
    if (unfulfilled) msg += ` · ⚠️ ${unfulfilled} unfulfilled`
    msg += '\n'
    for (const o of list.slice(0, 10)) {
      msg += `• ${o.order_name} ${o.customer || ''} — ${o.item_summary || o.items + ' item(s)'} (${money(o.total, o.currency)})\n`
    }
    if (list.length > 10) msg += `…and ${list.length - 10} more\n`
  }

  if (owner) await sendMessage(owner, msg.slice(0, 4096))
  return Response.json({ ok: true, orders: orders.length, brands: Object.keys(byBrand).length })
}
