/**
 * A thumbnail of what the customer sent.
 *
 * Images preview from the file itself, which costs nothing. A PDF
 * cannot — its first page has to be rendered to an image, and that is
 * server work nobody has done yet. So a PDF shows a plain mark rather
 * than a thumbnail, which is honest about what we have.
 */
export default function ArtworkPreview({ file, tone = 'fine' }) {
  const url = file && file.type?.startsWith('image/')
    ? URL.createObjectURL(file)
    : null

  const base = 'w-14 h-14 rounded-lg shrink-0 overflow-hidden flex ' +
               'items-center justify-center'

  if (url) {
    return (
      <button
        onClick={() => window.open(url, '_blank')}
        className={`${base} border border-rule`}
        aria-label="See your artwork full size"
      >
        <img src={url} alt="" className="w-full h-full object-cover" />
      </button>
    )
  }

  return (
    <div
      className={`${base} ${tone === 'refuse' ? 'bg-ink/10' : 'bg-substrate'}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
           strokeLinecap="round" strokeLinejoin="round"
           className="w-6 h-6 text-body">
        <path d="M6 3h9l4 4v14H6z" />
        <path d="M15 3v4h4" />
        <path d="M9 13h6" />
        <path d="M9 17h4" />
      </svg>
    </div>
  )
}