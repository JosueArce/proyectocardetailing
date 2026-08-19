const ownerEmail = process.env.OWNER_EMAIL || 'josue.arce.gonzalez@gmail.com'

const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character])
const costaRicaPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.length === 8 ? `506${digits}` : digits
}

async function sendEmail(booking, fetchImpl) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) return { channel: 'email', status: 'skipped', reason: 'not_configured' }
  const recipients = [...new Set([booking.email, ownerEmail].filter(Boolean))]
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: `Cita confirmada · ${booking.service} · ${booking.date}`,
      html: `<h2>Tu cita de detallado fue registrada</h2><p>Hola ${escapeHtml(booking.name)},</p><p>Estos son los datos de la cita:</p><ul><li><strong>Servicio:</strong> ${escapeHtml(booking.service)}</li><li><strong>Vehículo:</strong> ${escapeHtml(booking.vehicle)}</li><li><strong>Fecha:</strong> ${escapeHtml(booking.date)}</li><li><strong>Hora:</strong> ${escapeHtml(booking.time)}</li><li><strong>Costo estimado:</strong> ₡${Number(booking.cost || 0).toLocaleString('es-CR')}</li></ul><p>Josue se comunicará contigo si necesita confirmar algún detalle.</p>`,
    }),
  })
  if (!response.ok) throw new Error(`Resend respondió ${response.status}: ${await response.text()}`)
  return { channel: 'email', status: 'sent' }
}

async function sendWhatsApp(booking, fetchImpl) {
  if (booking.whatsappOptIn !== true) return { channel: 'whatsapp', status: 'skipped', reason: 'no_opt_in' }
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME
  if (!token || !phoneNumberId || !templateName) return { channel: 'whatsapp', status: 'skipped', reason: 'not_configured' }
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v23.0'
  const response = await fetchImpl(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: costaRicaPhone(booking.phone),
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'es' },
        components: [{ type: 'body', parameters: [booking.name, booking.service, booking.date, booking.time, booking.vehicle].map(text => ({ type: 'text', text: String(text) })) }],
      },
    }),
  })
  if (!response.ok) throw new Error(`WhatsApp respondió ${response.status}: ${await response.text()}`)
  return { channel: 'whatsapp', status: 'sent' }
}

export async function sendBookingNotifications(booking, fetchImpl = fetch) {
  const results = await Promise.allSettled([sendEmail(booking, fetchImpl), sendWhatsApp(booking, fetchImpl)])
  return results.map((result, index) => result.status === 'fulfilled' ? result.value : ({ channel: index === 0 ? 'email' : 'whatsapp', status: 'failed', reason: result.reason.message }))
}
