import './globals.css'
import Sidebar from './_components/Sidebar'
import ConnStatus from './_components/ConnStatus'

export const metadata = {
  title: 'Your AI HQ',
  description: 'GLCC Starter — your business in one place',
}

// viewport-fit=cover is required for env(safe-area-inset-*) to resolve on
// notched phones; width/initial-scale keep iOS from auto-zooming.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app">
          <Sidebar />
          <main className="main"><ConnStatus />{children}</main>
        </div>
      </body>
    </html>
  )
}
