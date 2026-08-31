import '@testing-library/jest-dom/vitest'

const jsonResponse = (body, ok = true) => ({
  ok,
  json: async () => body,
})

const requestBody = options => JSON.parse(options.body || '{}')

const mockApi = async (url, options = {}) => {
  if (url === '/api/auth/me') return jsonResponse({ error: 'Sin sesión' }, false)
  if (url === '/api/projects') return jsonResponse({ projects: [] })
  if (url === '/api/reviews') return jsonResponse({ reviews: [], googleMapsUrl: '' })
  if (url === '/api/auth/password-reset') return jsonResponse({ message: 'Si existe una cuenta con ese correo, recibirás un enlace para crear una nueva contraseña.' })

  if (url === '/api/auth/register' || url === '/api/auth/login') {
    const body = requestBody(options)
    return jsonResponse({
      account: {
        id: 'customer-test',
        name: body.name || 'Ana López',
        email: body.email,
        phone: body.phone || '88889999',
        role: 'customer',
        cars: [],
      },
      bookings: [],
    })
  }

  if (url === '/api/auth/logout') return jsonResponse({ ok: true })
  if (url === '/api/vehicles') {
    const body = requestBody(options)
    return jsonResponse({ vehicle: { ...body, id: 'vehicle-test', year: Number(body.year) } })
  }

  if (url === '/api/admin/login') return jsonResponse({ ok: true })
  if (url === '/api/admin/bookings') {
    return jsonResponse({ bookings: JSON.parse(localStorage.getItem('detail-bookings') || '[]') })
  }
  if (url === '/api/admin/system-status') return jsonResponse({ ok: true })
  if (url === '/api/admin/operations') return jsonResponse({ blockedDates: [], expenses: [], promotions: [] })
  if (url === '/api/admin/blocked-dates') return jsonResponse({ date: requestBody(options).date })
  if (url.startsWith('/api/admin/blocked-dates/')) return jsonResponse({ ok: true })

  if (url === '/api/admin/expenses') {
    return jsonResponse({ expense: { ...requestBody(options), id: 'expense-test' } })
  }
  if (url === '/api/admin/promotions') {
    const body = requestBody(options)
    return jsonResponse({ promotion: { ...body, id: 'promotion-test', active: true } })
  }
  if (url === '/api/promotions/validate') return jsonResponse({ promotion: { id: 'promotion-test', code: requestBody(options).code, rewardType: 'percentage', value: 10, description: '10% de descuento' } })
  if (url === '/api/admin/projects') {
    const body = requestBody(options)
    return jsonResponse({
      project: {
        id: 'project-test',
        title: body.title,
        description: body.description,
        media: body.media.map((item, index) => ({
          type: item.type,
          url: `/api/projects/project-test/media/${index}`,
        })),
      },
    })
  }
  if (url === '/api/booking-updates') {
    const body = requestBody(options)
    return jsonResponse({
      booking: { ...body.booking, ...body.changes },
      notification: { status: 'sent' },
    })
  }

  return jsonResponse({ eventId: 'calendar-event-test' })
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(mockApi))
})

afterEach(() => vi.unstubAllGlobals())
