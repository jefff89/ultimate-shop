import { useState } from 'react'
import { Link, useRouteContext } from '@tanstack/react-router'
import SignInPopover from 'src/components/auth/Signin'
import SignoutButton from 'src/components/auth/Signout'
import { Home, Menu, X } from 'lucide-react'
import TanChatAIAssistant from './demo-AIAssistant.tsx'

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const { user } = useRouteContext('/')
  const isSignedIn = Boolean(user)

  return (
    <>
      <header className="p-4 flex items-center gap-3 bg-gray-800 text-white shadow-lg">
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 hover:bg-gray-700  rounded-lg transition-colors"
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>
        <h1 className="ml-4 text-xl font-semibold text-chart-4">
          <Link to="/">ShopAi</Link>
        </h1>

        {isSignedIn && <Link to="/dashboard">Dashboard</Link>}

        <div className="ml-auto">
          {isSignedIn ? <SignoutButton /> : <SignInPopover />}
        </div>
      </header>

      <aside
        className={`fixed top-0 left-0 h-full w-80 bg-gray-900 text-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold">Navigation</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <Link
            to="/"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2"
            activeProps={{
              className:
                'flex items-center gap-3 p-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors mb-2',
            }}
          >
            <Home size={20} />
            <span className="font-medium">Home</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-700 bg-gray-800 flex flex-col gap-2">
          <TanChatAIAssistant />
        </div>
      </aside>
    </>
  )
}
