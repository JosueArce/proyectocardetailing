import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import { sendBookingNotifications, sendBookingUpdateEmail } from './notifications.js'
import { calculateBookingBenefit } from './benefits.js'

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
const requiredFields = ['name', 'phone', 'email', 'vehicle', 'date', 'time']
const resolveServices = booking => {
  const requested = Array.isArray(booking.services) ? booking.services : [booking.service]
  const names = [...new Set(requested.map(value => String(value || '').trim()).filter(Boolean))]
  if (!names.length || names.some(name => !serviceCatalog[name])) return null
  return {
    names,
    label: names.join(' + '),
    cost: names.reduce((total, name) => total + serviceCatalog[name].cost, 0),
    duration: names.reduce((total, name) => total + serviceCatalog[name].duration, 0),
  }
}
const adminEmail = process.env.ADMIN_EMAIL || 'josue.arce.gonzalez@gmail.com'
const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!'
const adminPhone = process.env.ADMIN_PHONE || '83629162'
const sessionSecret = process.env.SESSION_SECRET || 'development-only-change-me'
const firebaseApiKey = process.env.FIREBASE_WEB_API_KEY || ''
const googlePlaceId = process.env.GOOGLE_PLACE_ID || ''
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || ''
let reviewsCache = { expiresAt: 0, payload: null }

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

const uploadProjectMedia = async (item, projectId, index) => {
  const match = /^data:(image\/(?:jpeg|png|webp)|video\/(?:mp4|webm|quicktime));base64,([A-Za-z0-9+/=]+)$/.exec(item.data || '')
  if (!match) throw new Error('Los proyectos aceptan JPG, PNG, WEBP, MP4, WEBM o MOV.')
  const body = Buffer.from(match[2], 'base64')
  if (body.length > 15 * 1024 * 1024) throw new Error('Cada archivo debe pesar menos de 15 MB.')
  const bucket = process.env.STORAGE_BUCKET
  if (!bucket) throw new Error('El almacenamiento de proyectos no está configurado.')
  const type = match[1].startsWith('video/') ? 'video' : 'image'
  const safeName = String(item.name || `archivo-${index}`).replace(/[^a-zA-Z0-9._-]/g, '_')
  const objectName = `projects/${projectId}/${type === 'video' ? 'videos' : 'photos'}/${String(index + 1).padStart(2, '0')}-${safeName}`
  const { auth } = await getGoogleServices()
  const client = await auth.getClient()
  await client.request({ url: `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(objectName)}`, method: 'POST', headers: { 'Content-Type': match[1], 'Content-Length': String(body.length) }, data: body })
  return { type, storagePath: objectName, mimeType: match[1], url: `/api/projects/${projectId}/media/${index}` }
}

const projectMediaType = object => {
  if (object.contentType?.startsWith('image/')) return 'image'
  if (object.contentType?.startsWith('video/')) return 'video'
  if (/\.(?:jpe?g|png|webp)$/i.test(object.name || '')) return 'image'
  if (/\.(?:mp4|webm|mov)$/i.test(object.name || '')) return 'video'
  return null
}

const listProjectMedia = async projectIds => {
  const bucket = process.env.STORAGE_BUCKET
  if (!bucket || !projectIds.length) return new Map()
  const { storage } = await getGoogleServices()
  const allowed = new Set(projectIds)
  const grouped = new Map(projectIds.map(id => [id, []]))
  let pageToken
  do {
    const result = await storage.objects.list({ bucket, prefix: 'projects/', maxResults: 1000, pageToken })
    for (const object of result.data.items || []) {
      const match = /^projects\/([^/]+)\/(photos|videos)\/(.+)$/.exec(object.name || '')
      const type = match && projectMediaType(object)
      if (!match || !type || !allowed.has(match[1])) continue
      grouped.get(match[1]).push({ type, storagePath: object.name, mimeType: object.contentType || (type === 'video' ? 'video/mp4' : 'image/jpeg') })
    }
    pageToken = result.data.nextPageToken
  } while (pageToken)
  for (const [projectId, media] of grouped) {
    media.sort((a, b) => a.storagePath.localeCompare(b.storagePath, 'es', { numeric: true }))
    grouped.set(projectId, media.map(item => ({ ...item, url: `/api/projects/${encodeURIComponent(projectId)}/media-file?path=${encodeURIComponent(item.storagePath)}` })))
  }
  return grouped
}

app.disable('x-powered-by')
app.use(express.json({ limit: '30mb' }))

app.get('/api/reviews', async (_request, response) => {
  if (!googlePlaceId || !googleMapsApiKey) return response.json({ reviews: [], googleMapsUrl: '' })
  if (reviewsCache.payload && reviewsCache.expiresAt > Date.now()) return response.json(reviewsCache.payload)
  try {
    const placesResponse = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(googlePlaceId)}?languageCode=es`, {
      headers: { 'X-Goog-Api-Key': googleMapsApiKey, 'X-Goog-FieldMask': 'reviews,rating,userRatingCount,googleMapsUri' },
    })
    if (!placesResponse.ok) throw new Error(`Places API respondió ${placesResponse.status}`)
    const place = await placesResponse.json()
    const payload = {
      rating: place.rating || 0,
      total: place.userRatingCount || 0,
      googleMapsUrl: place.googleMapsUri || '',
      reviews: (place.reviews || []).map((review, index) => ({ id: review.name || `google-${index}`, author: review.authorAttribution?.displayName || 'Cliente de Google', rating: review.rating || 5, text: review.text?.text || review.originalText?.text || '', relativeTime: review.relativePublishTimeDescription || 'Opinión en Google' })).filter(review => review.text),
    }
    reviewsCache = { expiresAt: Date.now() + 60 * 60 * 1000, payload }
    response.json(payload)
  } catch (error) {
    console.error(JSON.stringify({ severity: 'ERROR', message: 'No se pudieron consultar las opiniones públicas', detail: error.message }))
    response.json({ reviews: [], googleMapsUrl: '' })
  }
})

app.get('/robots.txt', (request, response) => {
  const origin = process.env.PUBLIC_SITE_URL || `${request.protocol}://${request.get('host')}`
  response.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`)
})

app.get('/sitemap.xml', (request, response) => {
  const origin = process.env.PUBLIC_SITE_URL || `${request.protocol}://${request.get('host')}`
  response.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}</loc><changefreq>weekly</changefreq><priority>1.0</priority></url></urlset>`)
})

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
  return response.json({ ok: true, admin: { name: 'Josue Arce', email: adminEmail, phone: adminPhone } })
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

app.get('/api/projects', async (_request, response) => {
  try {
    const projects = (await listCollection('projects')).filter(project => project.published !== false).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    let storedMedia = new Map()
    try {
      storedMedia = await listProjectMedia(projects.map(project => project.id))
    } catch (error) {
      console.error(JSON.stringify({ severity: 'WARNING', message: 'Se usará la metadata guardada porque no se pudo sincronizar el portafolio con Storage', detail: error.response?.data?.error || error.message }))
    }
    return response.json({ projects: projects.map(project => ({ ...project, media: storedMedia.get(project.id)?.length ? storedMedia.get(project.id) : project.media || [] })) })
  } catch (error) {
    console.error(JSON.stringify({ severity: 'ERROR', message: 'No se pudieron consultar los proyectos', detail: error.response?.data?.error || error.message }))
    return response.status(502).json({ error: 'No pudimos cargar los proyectos en este momento.' })
  }
})

app.get('/api/projects/:projectId/media-file', async (request, response) => {
  try {
    const project = await getDocument('projects', request.params.projectId)
    const storagePath = String(request.query.path || '')
    if (project.published === false || !storagePath.startsWith(`projects/${request.params.projectId}/`) || !/^projects\/[^/]+\/(photos|videos)\/.+/.test(storagePath) || !process.env.STORAGE_BUCKET) return response.status(404).end()
    const { auth, storage } = await getGoogleServices()
    const metadata = await storage.objects.get({ bucket: process.env.STORAGE_BUCKET, object: storagePath })
    const type = projectMediaType(metadata.data)
    if (!type) return response.status(415).end()
    const client = await auth.getClient()
    const result = await client.request({ url: `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(process.env.STORAGE_BUCKET)}/o/${encodeURIComponent(storagePath)}?alt=media`, method: 'GET', responseType: 'stream' })
    response.setHeader('Content-Type', metadata.data.contentType || (type === 'video' ? 'video/mp4' : 'image/jpeg'))
    response.setHeader('Cache-Control', 'public, max-age=3600')
    return result.data.pipe(response)
  } catch (error) {
    console.error(JSON.stringify({ severity: 'ERROR', message: 'No se pudo entregar el archivo sincronizado del proyecto', projectId: request.params.projectId, detail: error.response?.data?.error || error.message }))
    return response.status(404).end()
  }
})

app.get('/api/projects/:projectId/media/:mediaIndex', async (request, response) => {
  try {
    const project = await getDocument('projects', request.params.projectId)
    if (project.published === false) return response.status(404).end()
    const media = project.media?.[Number(request.params.mediaIndex)]
    if (!media?.storagePath || !process.env.STORAGE_BUCKET) return response.status(404).end()
    const { auth } = await getGoogleServices()
    const client = await auth.getClient()
    const result = await client.request({ url: `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(process.env.STORAGE_BUCKET)}/o/${encodeURIComponent(media.storagePath)}?alt=media`, method: 'GET', responseType: 'stream' })
    response.setHeader('Content-Type', media.mimeType || (media.type === 'video' ? 'video/mp4' : 'image/jpeg'))
    response.setHeader('Cache-Control', 'public, max-age=86400')
    return result.data.pipe(response)
  } catch (error) {
    console.error(JSON.stringify({ severity: 'ERROR', message: 'No se pudo entregar un archivo del proyecto', detail: error.response?.data?.error || error.message }))
    return response.status(404).end()
  }
})

app.post('/api/admin/projects', requireAdmin, async (request, response) => {
  const { title, description, media = [] } = request.body || {}
  if (!String(title || '').trim() || !String(description || '').trim()) return response.status(400).json({ error: 'Agrega el nombre y la descripción del proyecto.' })
  if (!Array.isArray(media) || !media.length || media.length > 6) return response.status(400).json({ error: 'Selecciona entre 1 y 6 fotografías o videos.' })
  const id = crypto.randomUUID()
  try {
    const uploadedMedia = []
    for (const [index, item] of media.entries()) uploadedMedia.push(await uploadProjectMedia(item, id, index))
    const project = await saveDocument('projects', id, { title: String(title).trim(), description: String(description).trim(), media: uploadedMedia, published: true, createdAt: new Date().toISOString() }, true)
    return response.status(201).json({ project })
  } catch (error) {
    console.error(JSON.stringify({ severity: 'ERROR', message: 'No se pudo publicar el proyecto', projectId: id, detail: error.response?.data?.error || error.message }))
    return response.status(502).json({ error: error.message?.includes('15 MB') ? error.message : 'No pudimos publicar el proyecto. Revisa los archivos e intenta nuevamente.' })
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
    const [blockedDates, expenses, promotions] = await Promise.all([listCollection('blockedDates'), listCollection('expenses'), listCollection('promotions')])
    return response.json({ blockedDates: blockedDates.map(item => item.date), expenses, promotions })
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

app.get('/api/admin/promotions', requireAdmin, async (_request, response) => {
  try { return response.json({ promotions: await listCollection('promotions') }) }
  catch { return response.status(502).json({ error: 'No pudimos consultar las promociones.' }) }
})

app.post('/api/admin/promotions', requireAdmin, async (request, response) => {
  const code = String(request.body?.code || '').trim().toUpperCase().replace(/\s+/g, '')
  const rewardType = request.body?.rewardType
  const value = Number(request.body?.value || 0)
  const description = String(request.body?.description || '').trim()
  if (!/^[A-Z0-9_-]{3,24}$/.test(code) || !['percentage', 'fixed', 'gift'].includes(rewardType) || !description) return response.status(400).json({ error: 'Completa un código válido, el tipo y la descripción.' })
  if (rewardType === 'percentage' && (!(value > 0) || value > 100)) return response.status(400).json({ error: 'El porcentaje debe estar entre 1 y 100.' })
  if (rewardType === 'fixed' && !(value > 0)) return response.status(400).json({ error: 'El descuento debe ser mayor que cero.' })
  try {
    const existing = (await listCollection('promotions')).find(promotion => promotion.code === code)
    if (existing) return response.status(409).json({ error: 'Ese código ya existe.' })
    const id = crypto.randomUUID()
    const promotion = await saveDocument('promotions', id, { code, rewardType, value: rewardType === 'gift' ? 0 : value, description, active: true, createdAt: new Date().toISOString() }, true)
    return response.status(201).json({ promotion })
  } catch { return response.status(502).json({ error: 'No pudimos crear la promoción.' }) }
})

app.post('/api/promotions/validate', requireCustomer, async (request, response) => {
  const code = String(request.body?.code || '').trim().toUpperCase().replace(/\s+/g, '')
  try {
    const [promotions, bookings] = await Promise.all([listCollection('promotions'), listCollection('bookings')])
    const promotion = promotions.find(item => item.code === code && item.active !== false)
    if (!promotion) return response.status(404).json({ error: 'El código no existe o ya no está disponible.' })
    if (bookings.some(booking => booking.customerId === request.customerId && booking.promotionId === promotion.id)) return response.status(409).json({ error: 'Ya utilizaste este código anteriormente.' })
    return response.json({ promotion })
  } catch { return response.status(502).json({ error: 'No pudimos validar el código en este momento.' }) }
})

app.post('/api/bookings', async (request, response) => {
  const booking = request.body || {}
  if (requiredFields.some(field => !String(booking[field] || '').trim())) {
    return response.status(400).json({ error: 'Faltan datos obligatorios de la cita.' })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(booking.date) || !/^\d{2}:\d{2}$/.test(booking.time)) {
    return response.status(400).json({ error: 'La fecha o la hora no tienen un formato válido.' })
  }
  const selection = resolveServices(booking)
  if (!selection) return response.status(400).json({ error: 'Selecciona al menos un servicio válido.' })
  if (!['sinpe', 'cash'].includes(booking.paymentMethod)) return response.status(400).json({ error: 'El método de pago no es válido.' })
  if (booking.paymentMethod === 'sinpe' && (!booking.paymentEvidenceName || !booking.paymentEvidenceData)) return response.status(400).json({ error: 'Debes adjuntar el comprobante de SINPE Móvil.' })

  let stage = 'availability'
  let uploadedReceipt = ''
  try {
    const { names, label, duration, cost: baseCost } = selection
    const [existingBookings, blockedDates, promotions] = await Promise.all([listCollection('bookings'), listCollection('blockedDates'), listCollection('promotions')])
    if (blockedDates.some(item => item.date === booking.date)) return response.status(409).json({ error: 'Esa fecha no está disponible. Elige otro día.' })
    const requestedStart = new Date(`${booking.date}T${booking.time}:00-06:00`)
    const requestedEnd = new Date(requestedStart.getTime() + duration * 60_000)
    const overlaps = existingBookings.some(item => {
      if (item.date !== booking.date || ['Cancelada', 'cancelled'].includes(item.status)) return false
      const existingStart = new Date(`${item.date}T${item.time}:00-06:00`)
      const existingDuration = resolveServices(item)?.duration || 120
      const existingEnd = new Date(existingStart.getTime() + existingDuration * 60_000)
      return requestedStart < existingEnd && requestedEnd > existingStart
    })
    if (overlaps) return response.status(409).json({ error: 'Ese horario no tiene tiempo suficiente para todos los servicios seleccionados. Elige otra hora disponible.' })
    const customerId = readCustomerSession(request)
    const requestedCode = String(booking.promotionCode || '').trim().toUpperCase().replace(/\s+/g, '')
    if (requestedCode && !customerId) return response.status(401).json({ error: 'Inicia sesión para redimir un código promocional.' })
    const promotion = requestedCode ? promotions.find(item => item.code === requestedCode && item.active !== false) : null
    if (requestedCode && !promotion) return response.status(400).json({ error: 'El código promocional no es válido.' })
    if (promotion && existingBookings.some(item => item.customerId === customerId && item.promotionId === promotion.id && item.status !== 'Cancelada')) return response.status(409).json({ error: 'Ya utilizaste este código anteriormente.' })
    const benefit = calculateBookingBenefit({ baseCost, services: names, customerId, customerEmail: booking.email, bookings: existingBookings, promotion })
    const cost = benefit.cost
    const confirmedBooking = { ...booking, services: names, service: label, id: crypto.randomUUID(), customerId, baseCost, cost, discount: benefit.discount, benefitType: benefit.benefitType, benefitLabel: benefit.benefitLabel, promotionId: benefit.promotionId, promotionCode: benefit.promotionCode, status: 'Pendiente', paymentStatus: 'Pendiente', createdAt: new Date().toISOString() }
    delete confirmedBooking.promotion
    if (booking.paymentMethod === 'sinpe') {
      stage = 'storage'
      uploadedReceipt = await uploadReceipt(booking.paymentEvidenceData, booking.paymentEvidenceName, confirmedBooking.id)
      confirmedBooking.paymentEvidencePath = uploadedReceipt
    }
    delete confirmedBooking.paymentEvidenceData
    stage = 'calendar'
    const calendar = await getCalendar()
    const start = requestedStart
    const end = requestedEnd
    const event = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: `${label} · ${booking.vehicle}`,
        description: [`Cliente: ${booking.name}`, `Teléfono: ${booking.phone}`, `Vehículo: ${booking.vehicle}`, `Servicios: ${names.join(', ')}`, `Costo original: ₡${baseCost.toLocaleString('es-CR')}`, benefit.discount ? `Beneficio: ${benefit.benefitLabel} (-₡${benefit.discount.toLocaleString('es-CR')})` : '', `Costo total: ₡${cost.toLocaleString('es-CR')}`, `Pago: ${booking.paymentMethod === 'sinpe' ? 'SINPE Móvil' : 'Efectivo'} · Pendiente`, booking.notes ? `Notas: ${booking.notes}` : ''].filter(Boolean).join('\n'),
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
  const warnings = []
  if (booking.calendarEventId) {
    try {
      const calendar = await getCalendar()
      if (changes.status === 'Cancelada') await calendar.events.delete({ calendarId, eventId: booking.calendarEventId })
      else {
        const start = new Date(`${updatedBooking.date}T${updatedBooking.time}:00-06:00`)
        const duration = resolveServices(updatedBooking)?.duration || 120
        const end = new Date(start.getTime() + duration * 60_000)
        await calendar.events.patch({ calendarId, eventId: booking.calendarEventId, requestBody: { description: [`Estado: ${updatedBooking.status}`, `Cliente: ${updatedBooking.name}`, `Teléfono: ${updatedBooking.phone}`, `Vehículo: ${updatedBooking.vehicle}`, `Servicios: ${(updatedBooking.services || [updatedBooking.service]).join(', ')}`, updatedBooking.workDone ? `Trabajo realizado: ${updatedBooking.workDone}` : ''].filter(Boolean).join('\n'), start: { dateTime: start.toISOString(), timeZone }, end: { dateTime: end.toISOString(), timeZone } } })
      }
    } catch (error) {
      warnings.push('No pudimos sincronizar el cambio con la agenda externa. Revisa el evento manualmente.')
      console.error(JSON.stringify({ severity: 'WARNING', message: 'La cita se actualizará aunque falle la sincronización de agenda', bookingId: booking.id, eventId: booking.calendarEventId, error: error.response?.data?.error || error.message }))
    }
  }

  let storedBooking
  try {
    storedBooking = await saveBooking(updatedBooking)
  } catch (error) {
    console.error(JSON.stringify({ severity: 'ERROR', message: 'No se pudo guardar la actualización de la cita', bookingId: booking.id, error: error.response?.data?.error || error.message }))
    return response.status(502).json({ error: 'No fue posible guardar la actualización de la cita.' })
  }

  let notification
  try {
    notification = await sendBookingUpdateEmail(storedBooking, changeLabel)
    console.log(JSON.stringify({ severity: 'INFO', message: 'Actualización de cita notificada', bookingId: booking.id, changeLabel, notification }))
  } catch (error) {
    warnings.push('La cita fue actualizada, pero no pudimos enviar la notificación por correo.')
    notification = { channel: 'email', status: 'failed' }
    console.error(JSON.stringify({ severity: 'WARNING', message: 'La cita se guardó aunque falló la notificación', bookingId: booking.id, error: error.response?.data?.error || error.message }))
  }

  return response.json({ booking: storedBooking, notification, warning: warnings.join(' ') || undefined })
})

const root = path.dirname(fileURLToPath(import.meta.url))
app.use('/assets', express.static(path.join(root, 'dist', 'assets'), { maxAge: '7d', immutable: true }))
// Vite copia los recursos de public/ a la raíz de dist. Deben servirse antes
// del fallback SPA para que el logo, favicon y futuros archivos públicos no
// reciban index.html como respuesta.
app.use(express.static(path.join(root, 'dist'), { index: false, maxAge: '1h' }))
app.get(/.*/, (_request, response) => response.sendFile(path.join(root, 'dist', 'index.html')))

const server = app.listen(port, '0.0.0.0', () => console.log(JSON.stringify({ severity: 'INFO', message: `AutoEstudioCR escuchando en el puerto ${port}`, port, nodeEnv: process.env.NODE_ENV || 'development', calendarId, timeZone })))
server.on('error', error => {
  console.error(JSON.stringify({ severity: 'CRITICAL', message: 'El servidor no pudo iniciar', port, code: error.code, detail: error.message }))
  process.exit(1)
})
