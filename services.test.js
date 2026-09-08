import { describe, expect, it } from 'vitest'
import catalog from './services.json'

const expectedServiceOrder = [
  'lavado-basico',
  'detallado-basico',
  'detallado-premium',
  'ceramico-gold-1-ano',
  'ceramico-gold-3-anos',
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
    expect(catalog.additionalServices.items).toHaveLength(6)
    expect(catalog.additionalServices.items.every(item => item.icon)).toBe(true)
  })
})
