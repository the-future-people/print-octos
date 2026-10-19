// src/pages/Terms.jsx
//
// Terms of service and privacy policy. A holding page until the real
// text is written; both stores require a privacy policy before release.

import Header from '../components/Header.jsx'

export default function Terms() {
  return (
    <div className="min-h-screen bg-white text-ink">
      <Header />
      <main className="max-w-md mx-auto px-5 py-8">
        <h1 className="text-lg font-bold">Our terms and privacy policy</h1>
        <p className="mt-2 text-sm leading-relaxed text-body">
          We’re finishing these and they’ll be here soon. In short: we use your
          phone number and first name only to run your orders and tell you
          about them, and we never sell or share them.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-body">
          Questions in the meantime? Call us on{' '}
          <a href="tel:0556244194" className="font-semibold text-farhat">055 624 4194</a>.
        </p>
      </main>
    </div>
  )
}