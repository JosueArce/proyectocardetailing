import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import { sendBookingNotifications, sendBookingUpdateEmail } from './notifications.js'

const app = express()
const port = Number(process.env.PORT || 8080)
const calendarId = process.env.GOOGLE_CALENDAR_ID || 'josue.arce.gonzalez@gmail.com'
const timeZone = 'America/Costa_Rica'
const serviceCatalog = {
  'Detallado interior': { duration: 120, cost: 5000 },
  'Detallado exterior': { duration: 120, cost: 6000 },
  'Protección cerámica en carrocería': { duration: 360, cost: 50000 },
  'Protección cerámica en aros': { duration: 90, cost: 10000 },
  'Protección cerámica en tapizados': { duration: 120, cost: 20000 },
  'Limpieza profunda de tapizados': { duration: 120, cost: 5000 },
  'Pulido de vidrios y cerámico': { duration: 120, cost: 10000 },
  'Restauración de focos': { duration: 90, cost: 6500 },
  'Pulido de carrocería': { duration: 240, cost: 20000 },
  'Descontaminación exterior': { duration: 180, cost: 15000 },
  'Abrillantado de carrocería': { duration: 180, cost: 20000 },
}
const requiredFields = ['name', 'phone', 'email', 'vehicle', 'service', 'date', 'time']
const adminEmail = process.env.ADMIN_EMAIL || 'admin@estudioauto.com'
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
const sessionSecret = process.env.SESSION_SECRET || 'development-only-change-me'
const firebaseApiKey = process.env.FIREBASE_WEB_API_KEY || ''

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

const documentPath = (projectId, collection, id) => `projects/${projectId}/databases/(default)/documents/${collection}/${id}`
const saveDocument = async (collection, id, data, create = false) => {
  const { projectId, firestore } = await getGoogleServices()
  const requestBody = { fields: toFirestoreFields(data) }
  const result = create
    ? await firestore.projects.databases.documents.createDocument({ parent: `projects/${projectId}/databases/(default)/documents`, collectionId: collection, documentId: id, requestBody })
    : await firestore.projects.databases.documents.patch({ name: documentPath(projectId, collection, id), requestBody })
  return fromFirestoreDocument(result.data)
}
const getDocument = async (collection, id) => {
  const { projectId, firestore } = await getGoogleServices()
  const result = await firestore.projects.databases.documents.get({ name: documentPath(projectId, collection, id) })
  return fromFirestoreDocument(result.data)
}
const listCollection = async collection => {
  const { projectId, firestore } = await getGoogleServices()
  const result = await firestore.projects.databases.documents.list({ parent: `projects/${projectId}/databases/(default)/documents`, collectionId: collection, pageSize: 500 })
  return (result.data.documents || []).map(fromFirestoreDocument)
}

const firebaseAuth = async (action, body) => {
  if (!firebaseApiKey) throw new Error('Firebase Authentication no está configurado.')
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${firebaseApiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error?.message || 'No fue posible autenticar la cuenta.')
  return result
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
const getCookie = (request, name) => request.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.slice(name.length + 1)
const readCustomerSession = request => {
  const cookie = getCookie(request, 'customer_session')
  if (!cookie) return null
  const [uid, expires, signature] = decodeURIComponent(cookie).split('.')
  const expected = signSession(`${uid}.${expires}`)
  if (!uid || !signature || Number(expires) < Date.now() || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  return uid
}
const setCustomerSession = (response, uid) => {
  const expires = String(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const value = `${uid}.${expires}`
  response.setHeader('Set-Cookie', `customer_session=${encodeURIComponent(`${value}.${signSession(value)}`)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`)
}
const requireCustomer = (request, response, next) => {
  request.customerId = readCustomerSession(request)
  if (!request.customerId) return response.status(401).json({ error: 'Inicia sesión para continuar.' })
  next()
}
const requireAdmin = (request, response, next) => {
  const cookie = getCookie(request, 'admin_session')
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

app.post('/api/auth/register', async (request, response) => {
  const { name, email, phone, password } = request.body || {}
  if (!name || !email || !phone || !password || password.length < 6) return response.status(400).json({ error: 'Completa todos los datos y usa una contraseña de al menos 6 caracteres.' })
  try {
    const identity = await firebaseAuth('signUp', { email, password, returnSecureToken: true })
    const account = await saveDocument('users', identity.localId, { name, email: email.toLowerCase(), phone, role: 'customer', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, true)
    setCustomerSession(response, identity.localId)
    return response.status(201).json({ account: { ...account, cars: [] }, bookings: [] })
  } catch (error) {
    const duplicate = error.message.includes('EMAIL_EXISTS')
    return response.status(duplicate ? 409 : 502).json({ error: duplicate ? 'Ya existe una cuenta con este correo.' : 'No pudimos crear tu cuenta en este momento.' })
  }
})

app.post('/api/auth/login', async (request, response) => {
  try {
    const identity = await firebaseAuth('signInWithPassword', { email: request.body?.email, password: request.body?.password, returnSecureToken: true })
    const account = await getDocument('users', identity.localId)
    const vehicles = (await listCollection('vehicles')).filter(vehicle => vehicle.customerId === identity.localId)
    const bookings = (await listCollection('bookings')).filter(booking => booking.customerId === identity.localId || booking.email?.toLowerCase() === account.email?.toLowerCase())
    setCustomerSession(response, identity.localId)
    return response.json({ account: { ...account, cars: vehicles }, bookings })
  } catch {
    return response.status(401).json({ error: 'Correo o contraseña incorrectos.' })
  }
})

app.post('/api/auth/logout', (_request, response) => {
  response.setHeader('Set-Cookie', 'customer_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0')
  return response.json({ ok: true })
})

app.get('/api/auth/me', requireCustomer, async (request, response) => {
  try {
    const account = await getDocument('users', request.customerId)
    const vehicles = (await listCollection('vehicles')).filter(vehicle => vehicle.customerId === request.customerId)
    const bookings = (await listCollection('bookings')).filter(booking => booking.customerId === request.customerId || booking.email?.toLowerCase() === account.email?.toLowerCase())
    return response.json({ account: { ...account, cars: vehicles }, bookings })
  } catch {
    return response.status(401).json({ error: 'Tu sesión ya no está disponible.' })
  }
})

app.post('/api/vehicles', requireCustomer, async (request, response) => {
  const { make, model, year, plate = '', color = '' } = request.body || {}
  if (!make || !model || !/^\d{4}$/.test(String(year))) return response.status(400).json({ error: 'Completa marca, modelo y un año válido.' })
  const id = crypto.randomUUID()
  try {
    const vehicle = await saveDocument('vehicles', id, { customerId: request.customerId, make, model, year: Number(year), plate: plate.toUpperCase(), color, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, true)
    return response.status(201).json({ vehicle })
  } catch {
    return response.status(502).json({ error: 'No pudimos guardar el vehículo.' })
  }
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
  const ok = checks.firestore.ok && checks.storage.ok
  return response.status(ok ? 200 : 503).json({ ok })
})

app.get('/api/admin/operations', requireAdmin, async (_request, response) => {
  try {
    const [blockedDates, expenses] = await Promise.all([listCollection('blockedDates'), listCollection('expenses')])
    return response.json({ blockedDates: blockedDates.map(item => item.date), expenses })
  } catch {
    return response.status(502).json({ error: 'No pudimos consultar la configuración operativa.' })
  }
})

app.post('/api/admin/blocked-dates', requireAdmin, async (request, response) => {
  const date = request.body?.date
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return response.status(400).json({ error: 'Selecciona una fecha válida.' })
  try {
    await saveDocument('blockedDates', date, { date, reason: request.body?.reason || '', createdAt: new Date().toISOString() }, true)
    return response.status(201).json({ date })
  } catch (error) {
    if (error.response?.status === 409) return response.json({ date })
    return response.status(502).json({ error: 'No pudimos bloquear la fecha.' })
  }
})

app.delete('/api/admin/blocked-dates/:date', requireAdmin, async (request, response) => {
  try {
    const { projectId, firestore } = await getGoogleServices()
    await firestore.projects.databases.documents.delete({ name: documentPath(projectId, 'blockedDates', request.params.date) })
    return response.json({ ok: true })
  } catch {
    return response.status(502).json({ error: 'No pudimos desbloquear la fecha.' })
  }
})

app.post('/api/admin/expenses', requireAdmin, async (request, response) => {
  const { concept, amount, date } = request.body || {}
  if (!concept || !(Number(amount) >= 0) || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return response.status(400).json({ error: 'Completa correctamente el gasto.' })
  try {
    const id = crypto.randomUUID()
    const expense = await saveDocument('expenses', id, { concept, amount: Number(amount), date, month: date.slice(0, 7), createdAt: new Date().toISOString() }, true)
    return response.status(201).json({ expense })
  } catch {
    return response.status(502).json({ error: 'No pudimos guardar el gasto.' })
  }
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

  let stage = 'availability'
  let uploadedReceipt = ''
  try {
    const { duration, cost } = serviceCatalog[booking.service]
    const [existingBookings, blockedDates] = await Promise.all([listCollection('bookings'), listCollection('blockedDates')])
    if (blockedDates.some(item => item.date === booking.date)) return response.status(409).json({ error: 'Esa fecha no está disponible. Elige otro día.' })
    if (existingBookings.some(item => item.date === booking.date && item.time === booking.time && !['Cancelada', 'cancelled'].includes(item.status))) return response.status(409).json({ error: 'Ese horario acaba de ocuparse. Elige otra hora disponible.' })
    const customerId = readCustomerSession(request)
    const confirmedBooking = { ...booking, id: crypto.randomUUID(), customerId, cost, status: 'Pendiente', paymentStatus: 'Pendiente', createdAt: new Date().toISOString() }
    if (booking.paymentMethod === 'sinpe') {
      stage = 'storage'
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
      availability: 'No pudimos confirmar la disponibilidad en este momento. Por favor intenta nuevamente.',
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
