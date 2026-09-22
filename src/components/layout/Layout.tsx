import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export function Layout() {
  return (
    <div className="min-h-screen bg-bg text-zinc-100">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <div className="pl-60 print:pl-0">
        <div className="print:hidden">
          <Header />
        </div>
        <main className="p-6 print:p-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
