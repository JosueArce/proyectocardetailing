import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import { sendBookingNotifications, sendBookingUpdateEmail } from './notifications.js'

const app = express()
const port = Number(process.env.PORT || 8080)
const calendarId = process.env.GOOGLE_CALENDAR_ID || 'josue.arce.gonzalez@gmail.com'
const timeZone = 'America/Costa_Rica'
const serviceCatalog = { Esencial: { duration: 90, cost: 25000 }, Signature: { duration: 180, cost: 60000 }, 'Ceramic Pro': { duration: 360, cost: 150000 } }
const requiredFields = ['name', 'phone', 'email', 'vehicle', 'service', 'date', 'time']
const adminEmail = process.env.ADMIN_EMAIL || 'admin@estudioauto.com'
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
const sessionSecret = process.env.SESSION_SECRET || 'development-only-change-me'

// googleapis es una dependencia grande. Se carga solo cuando una petición necesita
// Calendar para que una instancia de Cloud Run con poca memoria pueda iniciar y
// escuchar PORT inmediatamente.
const getCalendar = async () => {
  const { google } = await import('googleapis')
  const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/calendar'] })
  return google.calendar({ version: 'v3', auth })
}

const getGoogleServices = async () => {
  const { google } = await import('googleapis')
  const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] })
  const projectId = await auth.getProjectId()
  return { auth, projectId, firestore: google.firestore({ version: 'v1', auth }), storage: google.storage({ version: 'v1', auth }) }
}

const toFirestoreValue = value => {
  if (value === null || value === undefined) return { nullValue: null }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } }
  if (typeof value === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toFirestoreValue(item)])) } }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  return { stringValue: String(value) }
}
const fromFirestoreValue = value => {
  if ('nullValue' in value) return null
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromFirestoreValue)
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, fromFirestoreValue(item)]))
  if ('booleanValue' in value) return value.booleanValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return value.doubleValue
  return value.stringValue
}
const toFirestoreFields = record => Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined).map(([key, value]) => [key, toFirestoreValue(value)]))
const fromFirestoreDocument = document => ({ id: document.name.split('/').pop(), ...Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, fromFirestoreValue(value)])) })

const saveBooking = async (booking, create = false) => {
  const { projectId, firestore } = await getGoogleServices()
  const parent = `projects/${projectId}/databases/(default)/documents`
  if (!create) {
    const result = await firestore.projects.databases.documents.patch({ name: `${parent}/bookings/${booking.id}`, requestBody: { fields: toFirestoreFields(booking) } })
    return fromFirestoreDocument(result.data)
  }
  const result = await firestore.projects.databases.documents.createDocument({ parent, collectionId: 'bookings', documentId: booking.id, requestBody: { fields: toFirestoreFields(booking) } })
  return fromFirestoreDocument(result.data)
}

const uploadReceipt = async (dataUrl, fileName, bookingId) => {
  if (!dataUrl) return ''
  const match = /^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!match) throw new Error('El comprobante debe ser JPG, PNG, WEBP o PDF.')
  const body = Buffer.from(match[2], 'base64')
  if (body.length > 5 * 1024 * 1024) throw new Error('El comprobante supera el límite de 5 MB.')
  const bucket = process.env.STORAGE_BUCKET
  if (!bucket) throw new Error('STORAGE_BUCKET no está configurado.')
  const { auth } = await getGoogleServices()
  const objectName = `bookings/${bookingId}/payments/${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const client = await auth.getClient()
  await client.request({
    url: `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(objectName)}`,
    method: 'POST',
    headers: { 'Content-Type': match[1], 'Content-Length': String(body.length) },
    data: body,
  })
  return objectName
}

const deleteReceipt = async objectName => {
  if (!objectName || !process.env.STORAGE_BUCKET) return
  try {
    const { auth } = await getGoogleServices()
    const client = await auth.getClient()
    await client.request({ url: `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(process.env.STORAGE_BUCKET)}/o/${encodeURIComponent(objectName)}`, method: 'DELETE' })
  } catch (error) {
    console.error(JSON.stringify({ severity: 'WARNING', message: 'No se pudo limpiar un comprobante huérfano', objectName, detail: error.response?.data?.error || error.message }))
  }
}

app.disable('x-powered-by')
app.use(express.json({ limit: '8mb' }))

app.get('/health', (_request, response) => response.type('text').send('ok'))

const signSession = value => crypto.createHmac('sha256', sessionSecret).update(value).digest('hex')
const requireAdmin = (request, response, next) => {
  const cookie = request.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith('admin_session='))?.split('=')[1]
  if (!cookie) return response.status(401).json({ error: 'Se requiere una sesión administrativa.' })
  const [expires, signature] = decodeURIComponent(cookie).split('.')
  const expected = signSession(expires)
  if (!signature || Number(expires) < Date.now() || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return response.status(401).json({ error: 'La sesión administrativa expiró.' })
  next()
}

app.post('/api/admin/login', (request, response) => {
  if (request.body?.email !== adminEmail || request.body?.password !== adminPassword) return response.status(401).json({ error: 'Credenciales administrativas incorrectas.' })
  const expires = String(Date.now() + 8 * 60 * 60 * 1000)
  const token = encodeURIComponent(`${expires}.${signSession(expires)}`)
  response.setHeader('Set-Cookie', `admin_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`)
  return response.json({ ok: true })
})

app.get('/api/admin/bookings', requireAdmin, async (_request, response) => {
  try {
    const { projectId, firestore } = await getGoogleServices()
    const parent = `projects/${projectId}/databases/(default)/documents`
    const result = await firestore.projects.databases.documents.list({ parent, collectionId: 'bookings', pageSize: 200, orderBy: 'createdAt desc' })
    return response.json({ bookings: (result.data.documents || []).map(fromFirestoreDocument) })
  } catch (error) {
    console.error(JSON.stringify({ severity: 'ERROR', message: 'No se pudieron consultar las reservaciones', error: error.response?.data?.error || error.message }))
    return response.status(502).json({ error: 'No fue posible consultar las reservaciones.' })
  }
})

app.get('/api/admin/system-status', requireAdmin, async (_request, response) => {
  const checks = { firestore: { ok: false }, storage: { ok: false } }
  try {
    const { projectId, firestore, storage } = await getGoogleServices()
    const parent = `projects/${projectId}/databases/(default)/documents`
    const documents = await firestore.projects.databases.documents.list({ parent, collectionId: 'bookings', pageSize: 1 })
    checks.firestore = { ok: true, projectId, bookingsDetected: (documents.data.documents || []).length > 0 }
    const bucket = process.env.STORAGE_BUCKET
    if (!bucket) checks.storage = { ok: false, error: 'STORAGE_BUCKET no está configurado' }
    else {
      await storage.objects.list({ bucket, maxResults: 1 })
      checks.storage = { ok: true, bucket }
    }
  } catch (error) {
    const message = error.response?.data?.error?.message || error.message
    if (!checks.firestore.ok) checks.firestore.error = message
    else checks.storage.error = message
  }
  return response.status(checks.firestore.ok && checks.storage.ok ? 200 : 503).json(checks)
})

app.post('/api/bookings', async (request, response) => {
  const booking = request.body || {}
  if (requiredFields.some(field => !String(booking[field] || '').trim())) {
    return response.status(400).json({ error: 'Faltan datos obligatorios de la cita.' })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(booking.date) || !/^\d{2}:\d{2}$/.test(booking.time)) {
    return response.status(400).json({ error: 'La fecha o la hora no tienen un formato válido.' })
  }
  if (!serviceCatalog[booking.service]) return response.status(400).json({ error: 'El servicio seleccionado no es válido.' })
  if (!['sinpe', 'cash'].includes(booking.paymentMethod)) return response.status(400).json({ error: 'El método de pago no es válido.' })
  if (booking.paymentMethod === 'sinpe' && (!booking.paymentEvidenceName || !booking.paymentEvidenceData)) return response.status(400).json({ error: 'Debes adjuntar el comprobante de SINPE Móvil.' })

  let stage = booking.paymentMethod === 'sinpe' ? 'storage' : 'calendar'
  let uploadedReceipt = ''
  try {
    const { duration, cost } = serviceCatalog[booking.service]
    const confirmedBooking = { ...booking, id: crypto.randomUUID(), cost, status: 'Pendiente', paymentStatus: 'Pendiente', createdAt: new Date().toISOString() }
    if (booking.paymentMethod === 'sinpe') {
      uploadedReceipt = await uploadReceipt(booking.paymentEvidenceData, booking.paymentEvidenceName, confirmedBooking.id)
      confirmedBooking.paymentEvidencePath = uploadedReceipt
    }
    delete confirmedBooking.paymentEvidenceData
    stage = 'calendar'
    const calendar = await getCalendar()
    const start = new Date(`${booking.date}T${booking.time}:00-06:00`)
    const end = new Date(start.getTime() + duration * 60_000)
    const event = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: `${booking.service} · ${booking.vehicle}`,
        description: [`Cliente: ${booking.name}`, `Teléfono: ${booking.phone}`, `Vehículo: ${booking.vehicle}`, `Servicio: ${booking.service}`, `Costo: ₡${cost.toLocaleString('es-CR')}`, `Pago: ${booking.paymentMethod === 'sinpe' ? 'SINPE Móvil' : 'Efectivo'} · Pendiente`, booking.notes ? `Notas: ${booking.notes}` : ''].filter(Boolean).join('\n'),
        start: { dateTime: start.toISOString(), timeZone },
        end: { dateTime: end.toISOString(), timeZone },
      },
    })
    confirmedBooking.calendarEventId = event.data.id
    stage = 'firestore'
    const storedBooking = await saveBooking(confirmedBooking, true)
    stage = 'notifications'
    const notifications = await sendBookingNotifications(storedBooking)
    console.log(JSON.stringify({ severity: 'INFO', message: 'Notificaciones de reservación procesadas', eventId: event.data.id, notifications }))
    return response.status(201).json({ booking: storedBooking, eventId: event.data.id, htmlLink: event.data.htmlLink, notifications, paymentStatus: storedBooking.paymentStatus })
  } catch (error) {
    const detail = error.response?.data?.error || error.errors || error.message
    console.error(JSON.stringify({ severity: 'ERROR', message: 'No se pudo completar la reservación', stage, calendarId, detail }))
    if (stage === 'calendar') await deleteReceipt(uploadedReceipt)
    const publicErrors = {
      calendar: 'No pudimos completar tu solicitud en este momento. Por favor intenta nuevamente.',
      storage: 'No pudimos adjuntar el comprobante. Verifica que sea una imagen o PDF menor de 5 MB e intenta nuevamente; también puedes elegir pago en efectivo.',
      firestore: 'No pudimos guardar tu reservación en este momento. Por favor intenta nuevamente.',
      notifications: 'Tu cita quedó registrada, pero no pudimos enviar la confirmación. Josue se comunicará contigo.',
    }
    return response.status(502).json({ error: publicErrors[stage] })
  }
})

app.post('/api/booking-updates', requireAdmin, async (request, response) => {
  const { booking, changes = {}, changeLabel = 'Actualización de cita' } = request.body || {}
  if (!booking?.email || !booking?.service) return response.status(400).json({ error: 'La reservación no es válida.' })
  const updatedBooking = { ...booking, ...changes }
  if (changes.status === 'Completada' && updatedBooking.paymentStatus !== 'Pagado') return response.status(400).json({ error: 'Debes registrar el pago antes de completar la cita.' })
  try {
    if (booking.calendarEventId) {
      const calendar = await getCalendar()
      if (changes.status === 'Cancelada') await calendar.events.delete({ calendarId, eventId: booking.calendarEventId })
      else {
        const start = new Date(`${updatedBooking.date}T${updatedBooking.time}:00-06:00`)
        const duration = serviceCatalog[updatedBooking.service]?.duration || 120
        const end = new Date(start.getTime() + duration * 60_000)
        await calendar.events.patch({ calendarId, eventId: booking.calendarEventId, requestBody: { description: [`Estado: ${updatedBooking.status}`, `Cliente: ${updatedBooking.name}`, `Teléfono: ${updatedBooking.phone}`, `Vehículo: ${updatedBooking.vehicle}`, `Servicio: ${updatedBooking.service}`, updatedBooking.workDone ? `Trabajo realizado: ${updatedBooking.workDone}` : ''].filter(Boolean).join('\n'), start: { dateTime: start.toISOString(), timeZone }, end: { dateTime: end.toISOString(), timeZone } } })
      }
    }
    const storedBooking = await saveBooking(updatedBooking)
    const notification = await sendBookingUpdateEmail(storedBooking, changeLabel)
    console.log(JSON.stringify({ severity: 'INFO', message: 'Actualización de cita notificada', bookingId: booking.id, changeLabel, notification }))
    return response.json({ booking: storedBooking, notification })
  } catch (error) {
    console.error(JSON.stringify({ severity: 'ERROR', message: 'No se pudo actualizar o notificar la cita', bookingId: booking.id, error: error.response?.data?.error || error.message }))
    return response.status(502).json({ error: 'No fue posible actualizar y notificar la cita.' })
  }
})

const root = path.dirname(fileURLToPath(import.meta.url))
app.use('/assets', express.static(path.join(root, 'dist', 'assets'), { maxAge: '7d', immutable: true }))
app.get(/.*/, (_request, response) => response.sendFile(path.join(root, 'dist', 'index.html')))

app.listen(port, '0.0.0.0', () => console.log(JSON.stringify({ severity: 'INFO', message: `Estudio Auto escuchando en el puerto ${port}`, calendarId, timeZone })))
