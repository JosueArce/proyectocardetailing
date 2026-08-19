import '@testing-library/jest-dom/vitest'

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ eventId: 'calendar-event-test' }) }))
})

afterEach(() => vi.unstubAllGlobals())

