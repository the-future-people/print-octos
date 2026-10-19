// src/pages/Orders.jsx
//
// The Orders tab: every order on the customer's number, active and
// collected. Signed out, it says what signing in gives them.

import { useNavigate } from 'react-router-dom'
import { useAccount } from '../lib/AccountContext.jsx'
import Header from '../components/Header.jsx'
import { MyOrders } from './Account.jsx'

export default function Orders() {
  const navigate = useNavigate()
  const { account, ready } = useAccount()

  return (
    <div className="min-h-screen bg-white text-ink">
      <Header />
      <main className="max-w-md mx-auto px-4 pb-6">
        {!ready ? null : account ? (
             <MyOrders heading={false} />
        ) : (
          <div className="py-16 text-center">
            <p className="text-lg font-bold">Your orders, all in one place</p>
            <p className="mt-1.5 text-sm leading-relaxed text-body">
              Sign in with your number to see what’s being made, what’s
              ready and everything you’ve collected.
            </p>
            <button onClick={() => navigate('/account?next=/orders')}
                    className="mt-5 px-5 py-2.5 rounded-lg bg-farhat text-white text-sm font-semibold">
              Sign in
            </button>
          </div>
        )}
      </main>
    </div>
  )
}