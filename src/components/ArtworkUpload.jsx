import { useRef, useState } from 'react'
import { uploadFile, acceptWarning } from '../api/client'

/**
 * Sending artwork, and being told whether it will print.
 *
 * The verdict depends on the size ordered, so it changes when the
 * dimensions do — a file that was fine on a small print is refused
 * across six feet. That is why this takes a `recheck` and why the
 * parent re-runs it.
 *
 * Refuse blocks. Warn proceeds once the customer has said carry on,
 * and that acceptance is recorded rather than assumed.
 */
export default function ArtworkUpload({ order, result, onResult }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')

  async function send(file) {
    if (!file || !order) return
    setBusy(true)
    setProblem('')
    try {
      const { data } = await uploadFile(order.order_number, order.access_token, file)
      onResult(data)
    } catch (err) {
      setProblem(
        err.response?.data?.detail ||
        'We couldn’t read that file. Try sending it again.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function accept() {
    setBusy(true)
    setProblem('')
    try {
      const { data } = await acceptWarning(order.order_number, order.access_token)
      onResult(data)
    } catch (err) {
      setProblem(
        err.response?.data?.detail ||
        'We couldn’t record that. Try again in a moment.',
      )
    } finally {
      setBusy(false)
    }
  }

  const tone = {
    fine:   { dot: 'text-emerald-600', label: 'Looks good' },
    warn:   { dot: 'text-amber-600',   label: 'Worth a look' },
    refuse: { dot: 'text-farhat',      label: 'We can’t print this' },
  }[result?.verdict] || null

  return (
    <div className="mt-5 pt-5 border-t border-rule">
      <p className="text-sm font-semibold">Your artwork</p>
      <p className="mt-1 text-xs text-body">
        PDF, JPEG, PNG, TIFF or WEBP.
      </p>

      <input
        ref={input}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.webp"
        className="hidden"
        onChange={e => send(e.target.files?.[0])}
      />

      {!result && (
        <button
          onClick={() => input.current?.click()}
          disabled={busy || !order}
          className="mt-3 w-full px-4 py-6 rounded-xl border border-dashed border-rule
                     hover:border-ink disabled:opacity-40 transition-colors
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          <span className="block text-sm font-medium">
            {busy ? 'Checking your file…' : 'Choose a file'}
          </span>
          <span className="mt-1 block text-xs text-body">
            We’ll check it prints well at the size you’ve chosen
          </span>
        </button>
      )}

      {result && (
        <div className="mt-3 rounded-xl border border-rule overflow-hidden">
          <div className="px-3.5 py-2.5 flex items-center justify-between gap-3
                          border-b border-rule">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{result.filename}</p>
              <p className="text-xs text-body">
                {result.size_kb ? `${result.size_kb} kB` : ''}
                {result.width_px ? ` · ${result.width_px} × ${result.height_px}` : ''}
              </p>
            </div>
            <button
              onClick={() => input.current?.click()}
              disabled={busy}
              className="shrink-0 text-xs font-semibold text-farhat hover:underline"
            >
              Change
            </button>
          </div>

          {tone && (
            <p className={`px-3.5 pt-2.5 text-xs font-semibold ${tone.dot}`}>
              {tone.label}
            </p>
          )}

          <ul className="px-3.5 py-2.5 space-y-1.5">
            {(result.checks || []).map((check, i) => (
              <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                  check.verdict === 'fine' ? 'bg-emerald-500'
                  : check.verdict === 'warn' ? 'bg-amber-500'
                  : 'bg-farhat'
                }`} aria-hidden="true" />
                <span className={check.verdict === 'fine' ? 'text-body' : 'text-ink'}>
                  {check.message}
                </span>
              </li>
            ))}
          </ul>

          {result.verdict === 'warn' && !result.warning_accepted && (
            <div className="px-3.5 pb-3">
              <button
                onClick={accept}
                disabled={busy}
                className="w-full px-4 py-2.5 rounded-lg border border-ink text-sm
                           font-semibold hover:bg-ink hover:text-white
                           disabled:opacity-40 transition-colors
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
              >
                I understand — print it anyway
              </button>
            </div>
          )}
        </div>
      )}

      {problem && <p className="mt-3 text-sm text-farhat">{problem}</p>}
    </div>
  )
}