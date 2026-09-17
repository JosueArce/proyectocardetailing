const projectId = process.env.PROJECT_ID
const bucket = process.env.BUCKET
const accessToken = process.env.ACCESS_TOKEN

if (!projectId || !bucket || !accessToken) {
  throw new Error('PROJECT_ID, BUCKET y ACCESS_TOKEN son obligatorios para el hard reset.')
}

const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
const request = async (url, options = {}) => {
  const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } })
  if (response.ok) return response.status === 204 ? null : response.json()
  const detail = await response.text()
  throw new Error(`${options.method || 'GET'} ${url} respondió ${response.status}: ${detail}`)
}

const deleteFirebaseUsers = async () => {
  const endpoint = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`
  let deleted = 0
  do {
    const result = await request(`${endpoint}:query`, {
      method: 'POST',
      body: JSON.stringify({ returnUserInfo: true, maxResults: 500 }),
    })
    const localIds = (result.userInfo || []).map(user => user.localId).filter(Boolean)
    if (localIds.length) {
      await request(`${endpoint}:batchDelete`, { method: 'POST', body: JSON.stringify({ localIds, force: true }) })
      deleted += localIds.length
    }
    if (!localIds.length) break
  } while (true)
  return deleted
}

const firestoreRoot = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`
const listCollectionIds = async parent => {
  const ids = []
  let pageToken
  do {
    const result = await request(`${parent}:listCollectionIds`, { method: 'POST', body: JSON.stringify({ pageSize: 1000, ...(pageToken ? { pageToken } : {}) }) })
    ids.push(...(result.collectionIds || []))
    pageToken = result.nextPageToken
  } while (pageToken)
  return ids
}

let deletedDocuments = 0
const deleteDocumentTree = async documentName => {
  for (const collectionId of await listCollectionIds(documentName)) await deleteCollection(documentName, collectionId)
  await request(documentName, { method: 'DELETE' })
  deletedDocuments += 1
}
const deleteCollection = async (parent, collectionId) => {
  do {
    const url = `${parent}/${encodeURIComponent(collectionId)}?pageSize=100`
    const result = await request(url)
    const documents = result.documents || []
    for (const document of documents) await deleteDocumentTree(document.name.replace('projects/', 'https://firestore.googleapis.com/v1/projects/'))
    if (!documents.length) break
  } while (true)
}

const deleteFirestoreData = async () => {
  for (const collectionId of await listCollectionIds(firestoreRoot)) await deleteCollection(firestoreRoot, collectionId)
  return deletedDocuments
}

const deleteStorageObjects = async () => {
  let pageToken
  const objectNames = []
  do {
    const result = await request(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o?maxResults=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`)
    objectNames.push(...(result.items || []).map(object => object.name))
    pageToken = result.nextPageToken
  } while (pageToken)
  for (const objectName of objectNames) await request(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}`, { method: 'DELETE' })
  return objectNames.length
}

console.log(`Iniciando hard reset del proyecto ${projectId}...`)
const users = await deleteFirebaseUsers()
const documents = await deleteFirestoreData()
const objects = await deleteStorageObjects()
console.log(`Hard reset terminado: ${users} usuarios, ${documents} documentos y ${objects} objetos eliminados.`)
