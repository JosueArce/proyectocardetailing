import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendBookingNotifications } from './notifications'

const booking = { name: 'Ana', email: 'ana@example.com', phone: '8888-9999', vehicle: 'Toyota RAV4', service: 'Signature', date: '2030-06-15', time: '09:00', cost: 60000, whatsappOptIn: true }
const keys = ['RESEND_API_KEY', 'EMAIL_FROM', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_TEMPLATE_NAME']

afterEach(() => keys.forEach(key => delete process.env[key]))

describe('notificaciones de reservación', () => {
  it('omite proveedores que todavía no están configurados', async () => {
    const results = await sendBookingNotifications(booking, vi.fn())
    expect(results).toEqual([
      { channel: 'email', status: 'skipped', reason: 'not_configured' },
      { channel: 'whatsapp', status: 'skipped', reason: 'not_configured' },
    ])
  })

  it('envía correo y plantilla de WhatsApp con teléfono de Costa Rica', async () => {
    process.env.RESEND_API_KEY = 'resend-test'
    process.env.EMAIL_FROM = 'Citas <citas@example.com>'
    process.env.WHATSAPP_ACCESS_TOKEN = 'whatsapp-test'
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123456'
    process.env.WHATSAPP_TEMPLATE_NAME = 'cita_registrada'
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' })

    const results = await sendBookingNotifications(booking, fetchMock)

    expect(results).toEqual([{ channel: 'email', status: 'sent' }, { channel: 'whatsapp', status: 'sent' }])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.resend.com/emails')
    const whatsappPayload = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(whatsappPayload.to).toBe('50688889999')
    expect(whatsappPayload.template.name).toBe('cita_registrada')
  })

  it('no envía WhatsApp sin consentimiento del cliente', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'whatsapp-test'
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123456'
    process.env.WHATSAPP_TEMPLATE_NAME = 'cita_registrada'
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' })
    const results = await sendBookingNotifications({ ...booking, whatsappOptIn: false }, fetchMock)
    expect(results[1]).toEqual({ channel: 'whatsapp', status: 'skipped', reason: 'no_opt_in' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
