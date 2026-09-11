import { describe, expect, it } from 'vitest'
import catalog from './services.json'

const expectedServiceOrder = [
  'lavado-basico',
  'detallado-basico',
  'detallado-premium',
  'paquete-ceramico',
]

describe('catálogo oficial de servicios', () => {
  it('mantiene el orden comercial solicitado', () => {
    expect(catalog.services.map(service => service.id)).toEqual(expectedServiceOrder)
  })

  it('no define ni habilita precios públicos', () => {
    expect(catalog.website.servicesSection.showPrices).toBe(false)
    expect(catalog.additionalServices.showPrices).toBe(false)
    for (const service of catalog.services) {
      expect(service.showPrice).toBe(false)
      expect(service).not.toHaveProperty('prices')
      expect(service).not.toHaveProperty('startingPrice')
    }
  })

  it('define inclusiones, iconos y servicios adicionales', () => {
    expect(catalog.services.every(service => service.includedServices.length > 0)).toBe(true)
    expect(catalog.services.flatMap(service => service.includedServices).every(item => item.icon)).toBe(true)
    expect(catalog.additionalServices.items).toHaveLength(9)
    expect(catalog.additionalServices.items.every(item => item.icon)).toBe(true)
  })

  it('incluye los tratamientos añadidos a los detallados básico y premium', () => {
    const basic = catalog.services.find(service => service.id === 'detallado-basico')
    const premium = catalog.services.find(service => service.id === 'detallado-premium')

    expect(basic.includedServices.map(item => item.name)).toEqual(expect.arrayContaining([
      'Uso de shampoo pH balanceado',
      'Aplicación de cera de protección en spray profesional',
    ]))
    expect(premium.includedServices.map(item => item.name)).toEqual(expect.arrayContaining([
      'Aplicación de protección hidrofóbica en llantas',
      'Limpieza detallada de vidrios exteriores e interiores',
      'Limpieza de bordes de puertas y zonas de difícil acceso',
    ]))
  })

  it('ofrece protección cerámica de uno a cinco años', () => {
    const ceramic = catalog.services.find(service => service.id === 'paquete-ceramico')
    expect(ceramic.includedServices.map(item => item.name)).toContain('Recubrimiento cerámico con opciones de 1 a 5 años')
    expect(ceramic.recommendedFor).toMatch(/entre 1 y 5 años/i)
  })
})
