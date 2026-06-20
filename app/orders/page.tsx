import { getShopifyOrders, money } from '@/lib/shopify-orders'

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

  return (
    <>
      <h1 className="ph">Orders</h1>
      <p className="cap">Live Shopify orders across your brands</p>
      <div className="grid">
        {cards.map(([l, v]) => (
          <div className="stat" key={l}><p className="l">{l}</p><p className="v">{v}</p></div>
        ))}
      </div>
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
