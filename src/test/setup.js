import '@testing-library/jest-dom/vitest'

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url, options = {}) => {
    if (url === '/api/admin/login') return { ok: true, json: async () => ({ ok: true }) }
    if (url === '/api/admin/bookings') return { ok: true, json: async () => ({ bookings: JSON.parse(localStorage.getItem('detail-bookings') || '[]') }) }
    if (url === '/api/admin/system-status') return { ok: true, json: async () => ({ firestore: { ok: true }, storage: { ok: true, bucket: 'test-evidence' } }) }
    if (url === '/api/booking-updates') {
      const body = JSON.parse(options.body)
      return { ok: true, json: async () => ({ booking: { ...body.booking, ...body.changes }, notification: { status: 'sent' } }) }
    }
    return { ok: true, json: async () => ({ eventId: 'calendar-event-test' }) }
  }))
})

afterEach(() => vi.unstubAllGlobals())
