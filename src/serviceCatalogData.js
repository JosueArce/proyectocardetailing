import catalog from '../services.json'

export const bookableServices = [
  ...catalog.services.map(service => ({ ...service, kind: 'package' })),
  ...catalog.additionalServices.items.map(service => ({ ...service, category: catalog.additionalServices.title, kind: 'additional' })),
]

export default catalog
