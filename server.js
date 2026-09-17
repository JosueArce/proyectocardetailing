import crypto from 'node:crypto'
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const app = express()
const port = Number(process.env.PORT || 8080)
const adminEmail = process.env.ADMIN_EMAIL || 'josue.arce.gonzalez@gmail.com'
const adminPassword = process.env.ADMIN_PASSWORD || ''
const sessionSecret = process.env.SESSION_SECRET || 'development-only-change-me'
const googlePlaceId = process.env.GOOGLE_PLACE_ID || ''
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || ''
let reviewsCache = { expiresAt: 0, payload: null }

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
const documentPath = (projectId, collection, id) => `projects/${projectId}/databases/(default)/documents/${collection}/${id}`

const saveProject = async (id, data) => {
  const { projectId, firestore } = await getGoogleServices()
  const result = await firestore.projects.databases.documents.createDocument({
    parent: `projects/${projectId}/databases/(default)/documents`,
    collectionId: 'projects',
    documentId: id,
    requestBody: { fields: toFirestoreFields(data) },
  })
  return fromFirestoreDocument(result.data)
}
const getProject = async id => {
  const { projectId, firestore } = await getGoogleServices()
  const result = await firestore.projects.databases.documents.get({ name: documentPath(projectId, 'projects', id) })
  return fromFirestoreDocument(result.data)
}
const listProjects = async () => {
  const { projectId, firestore } = await getGoogleServices()
  const result = await firestore.projects.databases.documents.list({ parent: `projects/${projectId}/databases/(default)/documents`, collectionId: 'projects', pageSize: 500 })
  return (result.data.documents || []).map(fromFirestoreDocument)
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

const signSession = value => crypto.createHmac('sha256', sessionSecret).update(value).digest('hex')
const getCookie = (request, name) => request.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.slice(name.length + 1)
const requireAdmin = (request, response, next) => {
  const cookie = getCookie(request, 'admin_session')
  if (!cookie) return response.status(401).json({ error: 'Se requiere una sesión administrativa.' })
  const [expires, signature] = decodeURIComponent(cookie).split('.')
  const expected = signSession(expires)
  if (!signature || Number(expires) < Date.now() || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return response.status(401).json({ error: 'La sesión administrativa expiró.' })
  next()
}

app.disable('x-powered-by')
app.use(express.json({ limit: '30mb' }))

app.get('/api/reviews', async (_request, response) => {
  if (!googlePlaceId || !googleMapsApiKey) return response.json({ rating: 0, total: 0, reviews: [], googleMapsUrl: '' })
  if (reviewsCache.payload && reviewsCache.expiresAt > Date.now()) return response.json(reviewsCache.payload)
  try {
    const placesResponse = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(googlePlaceId)}?languageCode=es`, { headers: { 'X-Goog-Api-Key': googleMapsApiKey, 'X-Goog-FieldMask': 'reviews,rating,userRatingCount,googleMapsUri' } })
    if (!placesResponse.ok) throw new Error(`Places API respondió ${placesResponse.status}`)
    const place = await placesResponse.json()
    const payload = { rating: place.rating || 0, total: place.userRatingCount || 0, googleMapsUrl: place.googleMapsUri || '', reviews: (place.reviews || []).map((review, index) => ({ id: review.name || `google-${index}`, author: review.authorAttribution?.displayName || 'Cliente de Google', rating: review.rating || 5, text: review.text?.text || review.originalText?.text || '', relativeTime: review.relativePublishTimeDescription || 'Opinión en Google' })).filter(review => review.text) }
    reviewsCache = { expiresAt: Date.now() + 60 * 60 * 1000, payload }
    return response.json(payload)
  } catch (error) {
    console.error(JSON.stringify({ severity: 'ERROR', message: 'No se pudieron consultar las opiniones públicas', detail: error.message }))
    return response.json({ rating: 0, total: 0, reviews: [], googleMapsUrl: '' })
  }
})

app.get('/api/projects', async (_request, response) => {
  try {
    const projects = (await listProjects()).filter(project => project.published !== false).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    let storedMedia = new Map()
    try { storedMedia = await listProjectMedia(projects.map(project => project.id)) } catch (error) { console.error(JSON.stringify({ severity: 'WARNING', message: 'No se pudo sincronizar el portafolio con Storage', detail: error.message })) }
    return response.json({ projects: projects.map(project => ({ ...project, media: storedMedia.get(project.id)?.length ? storedMedia.get(project.id) : project.media || [] })) })
  } catch (error) {
    console.error(JSON.stringify({ severity: 'ERROR', message: 'No se pudieron consultar los proyectos', detail: error.message }))
    return response.status(502).json({ error: 'No pudimos cargar los proyectos en este momento.' })
  }
})

app.get('/api/projects/:projectId/media-file', async (request, response) => {
  try {
    const project = await getProject(request.params.projectId)
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
  } catch { return response.status(404).end() }
})

app.get('/api/projects/:projectId/media/:mediaIndex', async (request, response) => {
  try {
    const project = await getProject(request.params.projectId)
    const media = project.published === false ? null : project.media?.[Number(request.params.mediaIndex)]
    if (!media?.storagePath || !process.env.STORAGE_BUCKET) return response.status(404).end()
    const { auth } = await getGoogleServices()
    const client = await auth.getClient()
    const result = await client.request({ url: `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(process.env.STORAGE_BUCKET)}/o/${encodeURIComponent(media.storagePath)}?alt=media`, method: 'GET', responseType: 'stream' })
    response.setHeader('Content-Type', media.mimeType || (media.type === 'video' ? 'video/mp4' : 'image/jpeg'))
    response.setHeader('Cache-Control', 'public, max-age=86400')
    return result.data.pipe(response)
  } catch { return response.status(404).end() }
})

app.post('/api/admin/login', (request, response) => {
  if (!adminPassword) return response.status(503).json({ error: 'El acceso administrativo no está configurado.' })
  if (request.body?.email !== adminEmail || request.body?.password !== adminPassword) return response.status(401).json({ error: 'Credenciales administrativas incorrectas.' })
  const expires = String(Date.now() + 8 * 60 * 60 * 1000)
  response.setHeader('Set-Cookie', `admin_session=${encodeURIComponent(`${expires}.${signSession(expires)}`)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`)
  return response.json({ ok: true })
})

app.post('/api/admin/projects', requireAdmin, async (request, response) => {
  const { title, description, media = [] } = request.body || {}
  if (!String(title || '').trim() || !String(description || '').trim()) return response.status(400).json({ error: 'Agrega el nombre y la descripción del proyecto.' })
  if (!Array.isArray(media) || !media.length || media.length > 6) return response.status(400).json({ error: 'Selecciona entre 1 y 6 fotografías o videos.' })
  const id = crypto.randomUUID()
  try {
    const uploadedMedia = []
    for (const [index, item] of media.entries()) uploadedMedia.push(await uploadProjectMedia(item, id, index))
    const project = await saveProject(id, { title: String(title).trim(), description: String(description).trim(), media: uploadedMedia, published: true, createdAt: new Date().toISOString() })
    return response.status(201).json({ project })
  } catch (error) {
    console.error(JSON.stringify({ severity: 'ERROR', message: 'No se pudo publicar el proyecto', projectId: id, detail: error.message }))
    return response.status(502).json({ error: error.message?.includes('15 MB') ? error.message : 'No pudimos publicar el proyecto. Revisa los archivos e intenta nuevamente.' })
  }
})

app.get('/robots.txt', (request, response) => {
  const origin = process.env.PUBLIC_SITE_URL || `${request.protocol}://${request.get('host')}`
  response.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /gracias\nSitemap: ${origin}/sitemap.xml\n`)
})
app.get('/sitemap.xml', (request, response) => {
  const origin = process.env.PUBLIC_SITE_URL || `${request.protocol}://${request.get('host')}`
  response.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}</loc><changefreq>weekly</changefreq><priority>1.0</priority></url></urlset>`)
})
app.get('/health', (_request, response) => response.type('text').send('ok'))

const root = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(root, 'dist')
if (fs.existsSync(dist)) app.use(express.static(dist, { index: false }))
app.get('/gracias', (_request, response) => {
  const indexPath = path.join(dist, 'index.html')
  if (!fs.existsSync(indexPath)) return response.status(503).type('text').send('Aplicación no compilada.')
  const html = fs.readFileSync(indexPath, 'utf8').replace(
    /<meta\s+name=["']robots["']\s+content=["'][^"']*["']\s*\/?\s*>/i,
    '<meta name="robots" content="noindex,nofollow">',
  )
  return response.type('html').send(html)
})
app.get(/.*/, (_request, response) => response.sendFile(path.join(dist, 'index.html')))

const server = app.listen(port, '0.0.0.0', () => console.log(JSON.stringify({ severity: 'INFO', message: `AutoEstudioCR escuchando en el puerto ${port}`, port, nodeEnv: process.env.NODE_ENV || 'development' })))
server.on('error', error => { console.error(JSON.stringify({ severity: 'CRITICAL', message: 'No se pudo abrir el puerto HTTP', port, code: error.code, detail: error.message })); process.exit(1) })
