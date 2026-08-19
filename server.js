import express from 'express'
import { google } from 'googleapis'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const app = express()
const port = Number(process.env.PORT || 8080)
const calendarId = process.env.GOOGLE_CALENDAR_ID || 'josue.arce.gonzalez@gmail.com'
const timeZone = 'America/Costa_Rica'
const serviceDurationMinutes = { Esencial: 90, Signature: 180, 'Ceramic Pro': 360 }
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

  try {
    const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/calendar'] })
    const calendar = google.calendar({ version: 'v3', auth })
    const start = new Date(`${booking.date}T${booking.time}:00-06:00`)
    const duration = serviceDurationMinutes[booking.service] || 120
    const end = new Date(start.getTime() + duration * 60_000)
    const event = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: `${booking.service} · ${booking.vehicle}`,
        description: [`Cliente: ${booking.name}`, `Teléfono: ${booking.phone}`, `Vehículo: ${booking.vehicle}`, `Servicio: ${booking.service}`, `Costo: ₡${Number(booking.cost || 0).toLocaleString('es-CR')}`, booking.notes ? `Notas: ${booking.notes}` : ''].filter(Boolean).join('\n'),
        start: { dateTime: start.toISOString(), timeZone },
        end: { dateTime: end.toISOString(), timeZone },
      },
    })
    return response.status(201).json({ eventId: event.data.id, htmlLink: event.data.htmlLink })
  } catch (error) {
    console.error('No se pudo crear el evento de Calendar:', error.message)
    return response.status(502).json({ error: 'No fue posible confirmar la cita en el calendario. Intenta nuevamente.' })
  }
})

const root = path.dirname(fileURLToPath(import.meta.url))
app.use('/assets', express.static(path.join(root, 'dist', 'assets'), { maxAge: '7d', immutable: true }))
app.get(/.*/, (_request, response) => response.sendFile(path.join(root, 'dist', 'index.html')))

app.listen(port, '0.0.0.0', () => console.log(`Estudio Auto escuchando en el puerto ${port}`))
