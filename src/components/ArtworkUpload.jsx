import { useEffect, useRef, useState } from 'react'
import { uploadFile, acceptWarning } from '../api/client'
import ArtworkPreview from './ArtworkPreview.jsx'

/**
 * Sending artwork, and being told whether it will print.
 *
 * Behind the wait, Octos opens the file, measures every image in it,
 * works out the effective resolution at the size ordered, compares the
 * shape and counts the pages. A customer who sees none of that is
 * looking at a frozen button, so the stages are named as they pass.
 *
 * The first is real: upload progress is reported by the browser, and
 * on a phone most of the wait is the bytes leaving it. The last is
 * paced — the server does the work in one request and cannot report
 * its own middle.
 *
 * Refuse blocks the order. Warn proceeds once the customer has said
 * carry on, and that acceptance is recorded rather than assumed.
 */

const STAGES = [
  { key: 'sent', label: 'Received your file' },
  { key: 'read', label: 'Opened it and measured the artwork' },
  { key: 'judged', label: 'Checking it prints well at the size you chose' },
]

const VERDICTS = {
  fine: {
    band: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
    label: 'Good to print',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8.5 12.5l2.5 2.5 4.5-5" />
      </>
    ),
  },
  warn: {
    band: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
    label: 'Worth a look first',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5" />
        <path d="M12 16v.5" />
      </>
    ),
  },
  refuse: {
    band: 'bg-farhat/5 border-farhat/30',
    text: 'text-farhat',
    label: 'We can’t print this one',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.5l5 5" />
        <path d="M14.5 9.5l-5 5" />
      </>
    ),
  },
}

export default function ArtworkUpload({ order, result, onResult }) {
  const input = useRef(null)
  const [chosen, setChosen] = useState(null)
  const [stage, setStage] = useState(null)
  const [progress, setProgress] = useState(0)
  const [problem, setProblem] = useState('')

  const busy = stage !== null

  // The first two stages are real events. The third is paced, because
  // the server does its work in one request and cannot narrate itself.
  useEffect(() => {
    if (stage !== 'read') return
    const timer = setTimeout(() => setStage('judged'), 700)
    return () => clearTimeout(timer)
  }, [stage])

  async function send(file) {
    if (!file || !order) return

    setChosen(file)
    setProblem('')
    setProgress(0)
    setStage('sent')

    try {
      const { data } = await uploadFile(
        order.order_number, order.access_token, file,
        percent => {
          setProgress(percent)
          if (percent >= 100) setStage('read')
        },
      )
      setStage(null)
      onResult(data)
    } catch (err) {
      setStage(null)
      setChosen(null)
      setProblem(
        err.response?.data?.detail ||
        'We couldn’t read that file. Try sending it again.',
      )
    }
  }

  async function accept() {
    setProblem('')
    try {
      const { data } = await acceptWarning(order.order_number, order.access_token)
      onResult(data)
    } catch (err) {
      setProblem(
        err.response?.data?.detail ||
        'We couldn’t record that. Try again in a moment.',
      )
    }
  }

  const verdict = result ? VERDICTS[result.verdict] : null

  return (
    <div className="mt-5 pt-5 border-t border-rule">
      <p className="text-[0.95rem] font-semibold">Your artwork</p>
      <p className="mt-0.5 text-xs text-body">
        We’ll check it prints well before you pay.
      </p>

      <input
        ref={input}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.webp"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          // Cleared straight away, so choosing the same file again
          // still counts as a change. Without this, a customer who
          // re-exports their artwork under the same name picks it and
          // nothing happens.
          e.target.value = ''
          send(file)
        }}
      />

      {/* ── Nothing sent yet ──────────────────────────────────── */}

      {!result && !busy && (
        <button
          onClick={() => input.current?.click()}
          disabled={!order}
          className="mt-3 w-full px-4 py-6 rounded-xl border-[1.5px] border-dashed
                     border-rule bg-substrate/40 hover:border-ink hover:bg-substrate/70
                     disabled:opacity-40 transition-colors focus:outline-none
                     focus-visible:ring-2 focus-visible:ring-ink"
        >
          <span className="inline-flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
                 strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"
                 aria-hidden="true">
              <path d="M7 16a4 4 0 0 1-.9-7.9 5.5 5.5 0 0 1 10.6-1.3A4.2 4.2 0 0 1 18 16h-1" />
              <path d="M12 12v8" />
              <path d="M9 15l3-3 3 3" />
            </svg>
            <span className="text-[0.95rem] font-semibold">Choose a file</span>
          </span>
          <span className="mt-1.5 block text-xs text-body">
            PDF, JPEG, PNG, TIFF or WEBP
          </span>
        </button>
      )}

      {/* ── On its way ────────────────────────────────────────── */}

      {busy && (
        <div className="mt-3 rounded-xl border border-rule overflow-hidden">
          <div className="px-3 py-3 flex items-center gap-3 border-b border-rule">
            <ArtworkPreview file={chosen} />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{chosen?.name}</p>
              <p className="text-xs text-body tabular-nums">
                {chosen ? `${(chosen.size / 1024).toFixed(0)} kB` : ''}
              </p>
            </div>
          </div>

          <div className="px-3.5 py-3">
            {STAGES.map(({ key, label }, i) => {
              const index = STAGES.findIndex(s => s.key === stage)
              const done = i < index
              const current = i === index
              if (!done && !current) return null

              return (
                <div key={key} className="flex items-center gap-2.5 mb-2 last:mb-0">
                  {done ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                         className="w-3.5 h-3.5 shrink-0 text-emerald-600"
                         aria-hidden="true">
                      <path d="M5 12.5l4.5 4.5L19 7" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="2.2" strokeLinecap="round"
                         className="w-3.5 h-3.5 shrink-0 text-farhat animate-spin"
                         aria-hidden="true">
                      <path d="M12 3a9 9 0 1 0 9 9" />
                    </svg>
                  )}
                  <span className={`text-xs ${done ? 'text-body' : 'font-medium'}`}>
                    {label}
                    {current && key === 'sent' && progress > 0 && (
                      <span className="tabular-nums"> · {progress}%</span>
                    )}
                  </span>
                </div>
              )
            })}

            <div className="mt-2.5 h-[3px] rounded-full bg-substrate overflow-hidden">
              <div
                className="h-full bg-farhat rounded-full transition-all duration-300"
                style={{ width: stage === 'sent' ? `${Math.max(8, progress * 0.6)}%`
                               : stage === 'read' ? '75%' : '92%' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Checked ───────────────────────────────────────────── */}

      {result && !busy && (
        <div className={`mt-3 rounded-xl border overflow-hidden ${
          result.verdict === 'refuse' ? 'border-farhat/30' : 'border-rule'
        }`}>
          <div className="px-3 py-3 flex items-center gap-3 border-b border-inherit">
            <ArtworkPreview file={chosen} tone={result.verdict} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{result.filename}</p>
              <p className="text-xs text-body tabular-nums">
                {result.size_kb ? `${result.size_kb} kB` : ''}
                {result.width_px ? ` · ${result.width_px} × ${result.height_px} px` : ''}
              </p>
            </div>
            <button
              onClick={() => input.current?.click()}
              className="shrink-0 text-xs font-semibold text-farhat hover:underline"
            >
              Change
            </button>
          </div>

          {verdict && (
            <div className={`px-3.5 py-2.5 flex items-center gap-2 border-b ${verdict.band}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
                   strokeLinecap="round" strokeLinejoin="round"
                   className={`w-4 h-4 shrink-0 ${verdict.text}`} aria-hidden="true">
                {verdict.icon}
              </svg>
              <span className={`text-sm font-bold ${verdict.text}`}>
                {verdict.label}
              </span>
            </div>
          )}

          <ul className="px-3.5 py-3 space-y-2">
            {(result.checks || []).map((check, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <CheckMark verdict={check.verdict} />
                <span className={`text-xs leading-relaxed ${
                  check.verdict === 'fine' ? 'text-body' : 'text-ink'
                }`}>
                  {check.message}
                </span>
              </li>
            ))}
          </ul>

          {result.verdict === 'warn' && !result.warning_accepted && (
            <div className="px-3.5 pb-3">
              <button
                onClick={accept}
                className="w-full px-4 py-2.5 rounded-lg border border-ink text-sm
                           font-semibold hover:bg-ink hover:text-white
                           transition-colors focus:outline-none focus-visible:ring-2
                           focus-visible:ring-ink"
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

function CheckMark({ verdict }) {
  if (verdict === 'fine') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor"
           className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-500" aria-hidden="true">
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm5 7.2l-6.1 6.9a1 1 0 0 1-1.5 0L6 12.6a1 1 0 0 1 1.5-1.3l2.6 2.9 5.4-6.1A1 1 0 0 1 17 9.2z" />
      </svg>
    )
  }
  if (verdict === 'warn') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor"
           className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" aria-hidden="true">
        <path d="M12.9 3.6l8.3 14.4a1 1 0 0 1-.9 1.5H3.7a1 1 0 0 1-.9-1.5l8.3-14.4a1 1 0 0 1 1.8 0zM12 8a1 1 0 0 0-1 1v4a1 1 0 0 0 2 0V9a1 1 0 0 0-1-1zm0 8.2a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="currentColor"
         className="w-3.5 h-3.5 mt-0.5 shrink-0 text-farhat" aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm3.5 12.1a1 1 0 0 1-1.4 1.4L12 13.4l-2.1 2.1a1 1 0 0 1-1.4-1.4l2.1-2.1-2.1-2.1a1 1 0 0 1 1.4-1.4l2.1 2.1 2.1-2.1a1 1 0 0 1 1.4 1.4L13.4 12z" />
    </svg>
  )
}