import '@testing-library/jest-dom/vitest'

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url, options = {}) => {
    if (url === '/api/auth/me') return { ok: false, json: async () => ({ error: 'Sin sesión' }) }
    if (url === '/api/projects') return { ok: true, json: async () => ({ projects: [] }) }
    if (url === '/api/auth/register' || url === '/api/auth/login') {
      const body = JSON.parse(options.body)
      return { ok: true, json: async () => ({ account: { id: 'customer-test', name: body.name || 'Ana López', email: body.email, phone: body.phone || '88889999', role: 'customer', cars: [] }, bookings: [] }) }
    }
    if (url === '/api/auth/logout') return { ok: true, json: async () => ({ ok: true }) }
    if (url === '/api/vehicles') {
      const body = JSON.parse(options.body)
      return { ok: true, json: async () => ({ vehicle: { ...body, id: 'vehicle-test', year: Number(body.year) } }) }
    }
    if (url === '/api/admin/login') return { ok: true, json: async () => ({ ok: true }) }
    if (url === '/api/admin/bookings') return { ok: true, json: async () => ({ bookings: JSON.parse(localStorage.getItem('detail-bookings') || '[]') }) }
    if (url === '/api/admin/system-status') return { ok: true, json: async () => ({ ok: true }) }
    if (url === '/api/admin/operations') return { ok: true, json: async () => ({ blockedDates: [], expenses: [] }) }
    if (url === '/api/admin/blocked-dates') return { ok: true, json: async () => ({ date: JSON.parse(options.body).date }) }
    if (url.startsWith('/api/admin/blocked-dates/')) return { ok: true, json: async () => ({ ok: true }) }
    if (url === '/api/admin/expenses') { const body = JSON.parse(options.body); return { ok: true, json: async () => ({ expense: { ...body, id: 'expense-test' } }) } }
    if (url === '/api/admin/projects') { const body = JSON.parse(options.body); return { ok: true, json: async () => ({ project: { id: 'project-test', title: body.title, description: body.description, media: body.media.map((item, index) => ({ type: item.type, url: `/api/projects/project-test/media/${index}` })) } }) } }
    if (url === '/api/booking-updates') {
      const body = JSON.parse(options.body)
      return { ok: true, json: async () => ({ booking: { ...body.booking, ...body.changes }, notification: { status: 'sent' } }) }
    }
    return { ok: true, json: async () => ({ eventId: 'calendar-event-test' }) }
  }))
})

afterEach(() => vi.unstubAllGlobals())
