// The payment open in Paystack's panel, if any. Held in memory only:
// it matters for the minutes the panel is open, and nothing else.
let pending = null

export const setPaying = reference => { pending = reference }
export const takePaying = () => { const r = pending; pending = null; return r }