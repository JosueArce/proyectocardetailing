import '@testing-library/jest-dom/vitest'

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url, options = {}) => {
    if (url === '/api/admin/login') return { ok: true, json: async () => ({ ok: true }) }
    if (url === '/api/booking-updates') {
      const body = JSON.parse(options.body)
      return { ok: true, json: async () => ({ booking: { ...body.booking, ...body.changes }, notification: { status: 'sent' } }) }
    }
    return { ok: true, json: async () => ({ eventId: 'calendar-event-test' }) }
  }))
})

afterEach(() => vi.unstubAllGlobals())
