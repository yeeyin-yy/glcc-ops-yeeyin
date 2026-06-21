import { getRecords, m, type Rec } from '@/lib/records'
import { StatusToggle, EditCell } from './Controls'

export const dynamic = 'force-dynamic'

// Each licensee carries its OWN currency (SGD vs MYR) — never mix or sum across.
const money = (n: unknown, cur: unknown) =>
  `${cur || 'RM'} ${Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Your licensees, built from real Shopify orders + customer contact/address.
// One records row per licensee (category='licensee'); details live in meta.
// Contact, address, machines & contract are inline-editable; grouped by brand.
export default async function Licensee() {
  const all = await getRecords()
  const rows = all.filter(r => r.category === 'licensee')

  const map = new Map<string, Rec[]>()
  for (const r of rows) {
    const b = String(m(r, 'brand'))
    if (!map.has(b)) map.set(b, [])
    map.get(b)!.push(r)
  }
  const brands = [...map.entries()].sort((a, b) => b[1].length - a[1].length)
  for (const [, list] of brands) list.sort((a, b) => Number(b.meta?.spent || 0) - Number(a.meta?.spent || 0))

  const active = rows.filter(r => r.status === 'active').length
  const onboarding = rows.filter(r => r.status === 'onboarding').length

  const cards: [string, string | number][] = [
    ['Total', rows.length],
    ['Active', active],
    ['Onboarding', onboarding],
    ['Brands', brands.length],
  ]

  return (
    <>
      <h1 className="ph">Licensee</h1>
      <p className="cap">Built from real Shopify orders · contact, address, machines &amp; contract are editable</p>

      <div className="grid">
        {cards.map(([l, v]) => (
          <div className="stat" key={l}><p className="l">{l}</p><p className="v">{v}</p></div>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="empty">No licensees yet. They appear here once your Shopify orders are synced.</p>
      ) : (
        brands.map(([brand, list]) => (
          <section key={brand} style={{ marginBottom: 30 }}>
            <h2 className="ph" style={{ fontSize: 16, margin: '0 0 10px' }}>
              {brand} <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 14 }}>· {list.length} licensee{list.length > 1 ? 's' : ''}</span>
            </h2>
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Licensee</th><th>Contact</th><th>Address</th><th>Machines</th><th>Contract</th>
                    <th>Orders</th><th>Spent</th><th>Last order</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(r => (
                    <tr key={r.id}>
                      <td data-label="Licensee">{r.title}</td>
                      <td data-label="Contact" style={{ overflowWrap: 'anywhere' }}>
                        <div>{m(r, 'email')}</div>
                        <div style={{ color: 'var(--muted)', fontSize: 12 }}>{m(r, 'phone')}</div>
                      </td>
                      <td data-label="Address" style={{ maxWidth: 280, overflowWrap: 'anywhere' }}>{m(r, 'address')}</td>
                      <td data-label="Machines"><EditCell id={r.id} field="machines" value={String(r.meta?.machines ?? '')} placeholder="0" type="number" /></td>
                      <td data-label="Contract"><EditCell id={r.id} field="contract" value={String(r.meta?.contract ?? '')} placeholder="—" /></td>
                      <td data-label="Orders">{m(r, 'orders')}</td>
                      <td data-label="Spent">{money(r.meta?.spent, r.meta?.currency)}</td>
                      <td data-label="Last order">{m(r, 'last_order')}</td>
                      <td data-label="Status"><StatusToggle id={r.id} status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </>
  )
}
