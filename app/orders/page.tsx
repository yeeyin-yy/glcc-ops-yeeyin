import { getShopifyOrders, money, type ShopOrder } from '@/lib/shopify-orders'

export const dynamic = 'force-dynamic'

const isUnf = (o: ShopOrder) => (o.fulfillment_status || 'unfulfilled') !== 'fulfilled'

// Live Shopify orders, grouped into one section per brand (never mixed).
export default async function Orders() {
  const orders = await getShopifyOrders(500)

  // Group by brand; biggest brand (by order count) first.
  const map = new Map<string, ShopOrder[]>()
  for (const o of orders) {
    if (!map.has(o.brand)) map.set(o.brand, [])
    map.get(o.brand)!.push(o)
  }
  const brands = [...map.entries()].sort((a, b) => b[1].length - a[1].length)
  const totalUnf = orders.filter(isUnf).length

  return (
    <>
      <h1 className="ph">Orders</h1>
      <p className="cap">Live Shopify orders — grouped by brand</p>

      {orders.length === 0 ? (
        <p className="empty">No orders yet. New orders show up here within seconds of coming in.</p>
      ) : (
        <>
          <div className="grid">
            <div className="stat"><p className="l">Orders</p><p className="v">{orders.length}</p></div>
            <div className="stat"><p className="l">Brands</p><p className="v">{brands.length}</p></div>
            <div className="stat"><p className="l">Unfulfilled</p><p className="v">{totalUnf}</p></div>
          </div>

          {/* Overview — count, unfulfilled & revenue per brand */}
          <h2 className="ph" style={{ fontSize: 16, margin: '4px 0 10px' }}>By brand</h2>
          <table className="tbl" style={{ marginBottom: 28 }}>
            <thead><tr><th>Brand</th><th>Orders</th><th>Unfulfilled</th><th>Revenue</th></tr></thead>
            <tbody>
              {brands.map(([brand, list]) => {
                const unf = list.filter(isUnf).length
                const rev = list.reduce((s, o) => s + Number(o.total || 0), 0)
                return (
                  <tr key={brand}>
                    <td data-label="Brand">{brand}</td>
                    <td data-label="Orders">{list.length}</td>
                    <td data-label="Unfulfilled"><span className={`pill ${unf ? 'overdue' : 'done'}`}>{unf}</span></td>
                    <td data-label="Revenue">{money(rev, list[0].currency)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Details — one section per brand, all that brand's orders together */}
          {brands.map(([brand, list]) => {
            const unf = list.filter(isUnf).length
            return (
              <section key={brand} style={{ marginBottom: 30 }}>
                <h2 className="ph" style={{ fontSize: 16, margin: '0 0 10px' }}>
                  {brand} <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 14 }}>· {list.length} order{list.length > 1 ? 's' : ''}{unf ? ` · ${unf} unfulfilled` : ''}</span>
                </h2>
                <table className="tbl">
                  <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Fulfilment</th><th>Date</th></tr></thead>
                  <tbody>
                    {list.map(o => {
                      const u = isUnf(o)
                      return (
                        <tr key={o.id}>
                          <td data-label="Order">{o.order_name}</td>
                          <td data-label="Customer">{o.customer ?? '—'}</td>
                          <td data-label="Items">{o.item_summary || o.items}</td>
                          <td data-label="Total">{money(o.total, o.currency)}</td>
                          <td data-label="Payment"><span className={`pill ${o.financial_status === 'paid' ? 'paid' : 'pending'}`}>{o.financial_status ?? '—'}</span></td>
                          <td data-label="Fulfilment"><span className={`pill ${u ? 'overdue' : 'done'}`}>{u ? 'unfulfilled' : 'fulfilled'}</span></td>
                          <td data-label="Date">{o.ordered_at ? o.ordered_at.slice(0, 10) : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </section>
            )
          })}
        </>
      )}
    </>
  )
}
