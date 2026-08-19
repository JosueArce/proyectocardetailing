import express from 'express'
import { google } from 'googleapis'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { sendBookingNotifications } from './notifications.js'

const app = express()
const port = Number(process.env.PORT || 8080)
const calendarId = process.env.GOOGLE_CALENDAR_ID || 'josue.arce.gonzalez@gmail.com'
const timeZone = 'America/Costa_Rica'

const serviceCatalog = { Esencial: { duration: 90, cost: 25000 }, Signature: { duration: 180, cost: 60000 }, 'Ceramic Pro': { duration: 360, cost: 150000 } }
const requiredFields = ['name', 'phone', 'email', 'vehicle', 'service', 'date', 'time']

app.disable('x-powered-by')
app.use(express.json({ limit: '32kb' }))

app.get('/health', (_request, response) => response.type('text').send('ok'))

app.post('/api/bookings', async (request, response) => {
  const booking = request.body || {}
  if (requiredFields.some(field => !String(booking[field] || '').trim())) {
    return response.status(400).json({ error: 'Faltan datos obligatorios de la cita.' })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(booking.date) || !/^\d{2}:\d{2}$/.test(booking.time)) {
    return response.status(400).json({ error: 'La fecha o la hora no tienen un formato válido.' })
  }

  if (!serviceCatalog[booking.service]) return response.status(400).json({ error: 'El servicio seleccionado no es válido.' })

  try {
    const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/calendar'] })
    const calendar = google.calendar({ version: 'v3', auth })
    const start = new Date(`${booking.date}T${booking.time}:00-06:00`)

    const { duration, cost } = serviceCatalog[booking.service]
    const confirmedBooking = { ...booking, cost }

    const end = new Date(start.getTime() + duration * 60_000)
    const event = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: `${booking.service} · ${booking.vehicle}`,

        description: [`Cliente: ${booking.name}`, `Teléfono: ${booking.phone}`, `Vehículo: ${booking.vehicle}`, `Servicio: ${booking.service}`, `Costo: ₡${cost.toLocaleString('es-CR')}`, booking.notes ? `Notas: ${booking.notes}` : ''].filter(Boolean).join('\n'),

        start: { dateTime: start.toISOString(), timeZone },
        end: { dateTime: end.toISOString(), timeZone },
      },
    })

    const notifications = await sendBookingNotifications(confirmedBooking)
    console.log(JSON.stringify({ severity: 'INFO', message: 'Notificaciones de reservación procesadas', eventId: event.data.id, notifications }))
    return response.status(201).json({ eventId: event.data.id, htmlLink: event.data.htmlLink, notifications })
  } catch (error) {
    const calendarError = error.response?.data?.error || error.errors || error.message
    console.error(JSON.stringify({ severity: 'ERROR', message: 'No se pudo crear el evento de Google Calendar', calendarId, calendarError }))

    return response.status(502).json({ error: 'No fue posible confirmar la cita en el calendario. Intenta nuevamente.' })
  }
})

const root = path.dirname(fileURLToPath(import.meta.url))
app.use('/assets', express.static(path.join(root, 'dist', 'assets'), { maxAge: '7d', immutable: true }))
app.get(/.*/, (_request, response) => response.sendFile(path.join(root, 'dist', 'index.html')))

app.listen(port, '0.0.0.0', () => console.log(JSON.stringify({ severity: 'INFO', message: `Estudio Auto escuchando en el puerto ${port}`, calendarId, timeZone })))

