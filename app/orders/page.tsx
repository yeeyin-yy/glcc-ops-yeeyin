import { getShopifyOrders, money, type ShopOrder } from '@/lib/shopify-orders'

export const dynamic = 'force-dynamic'

// Live Shopify orders across every connected store, newest first.
export default async function Orders() {
  const orders = await getShopifyOrders(300)
  const brands = new Set(orders.map(o => o.brand))
  const unfulfilled = orders.filter(o => (o.fulfillment_status || 'unfulfilled') !== 'fulfilled').length

  const cards: [string, string | number][] = [
    ['Orders', orders.length],
    ['Brands', brands.size],
    ['Unfulfilled', unfulfilled],
  ]

  // This-week revenue by brand (last 7 days). Currencies differ per brand, so we
  // keep each brand's total in its own currency; bars are sized by order count.
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString()
  const week = orders.filter(o => (o.ordered_at ?? o.created_at) >= weekAgo)
  const byBrand = new Map<string, { count: number; total: number; currency: string | null }>()
  for (const o of week) {
    const b = byBrand.get(o.brand) ?? { count: 0, total: 0, currency: o.currency }
    b.count++; b.total += Number(o.total || 0); b.currency = o.currency
    byBrand.set(o.brand, b)
  }
  const weekRows = [...byBrand.entries()].sort((a, b) => b[1].count - a[1].count)
  const maxCount = Math.max(1, ...weekRows.map(([, v]) => v.count))

  return (
    <>
      <h1 className="ph">Orders</h1>
      <p className="cap">Live Shopify orders across your brands</p>
      <div className="grid">
        {cards.map(([l, v]) => (
          <div className="stat" key={l}><p className="l">{l}</p><p className="v">{v}</p></div>
        ))}
      </div>

      {weekRows.length > 0 && (
        <div className="stat" style={{ marginBottom: 24 }}>
          <p className="l" style={{ marginBottom: 12 }}>This week by brand · last 7 days</p>
          {weekRows.map(([brand, v]) => (
            <div key={brand} style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0' }}>
              <div style={{ width: 140, flexShrink: 0, fontSize: 13 }}>{brand}</div>
              <div style={{ flex: 1, minWidth: 0, height: 10, background: 'var(--surface2)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ width: `${(v.count / maxCount) * 100}%`, height: '100%', background: 'var(--amber)' }} />
              </div>
              <div style={{ width: 150, flexShrink: 0, textAlign: 'right', fontSize: 13 }}>
                {v.count} · {money(v.total, v.currency)}
              </div>
            </div>
          ))}
        </div>
      )}
      {orders.length === 0 ? (
        <p className="empty">No orders yet. Once a store&apos;s webhook is connected, new orders show up here within seconds.</p>
      ) : (
        <table className="tbl">
          <thead><tr><th>Order</th><th>Brand</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Fulfilment</th><th>Date</th></tr></thead>
          <tbody>
            {orders.map(o => {
              const unf = (o.fulfillment_status || 'unfulfilled') !== 'fulfilled'
              return (
                <tr key={o.id}>
                  <td data-label="Order">{o.order_name}</td>
                  <td data-label="Brand">{o.brand}</td>
                  <td data-label="Customer">{o.customer ?? '—'}</td>
                  <td data-label="Items">{o.item_summary || o.items}</td>
                  <td data-label="Total">{money(o.total, o.currency)}</td>
                  <td data-label="Payment"><span className={`pill ${o.financial_status === 'paid' ? 'paid' : 'pending'}`}>{o.financial_status ?? '—'}</span></td>
                  <td data-label="Fulfilment"><span className={`pill ${unf ? 'overdue' : 'done'}`}>{unf ? 'unfulfilled' : 'fulfilled'}</span></td>
                  <td data-label="Date">{o.ordered_at ? o.ordered_at.slice(0, 10) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </>
  )
}
