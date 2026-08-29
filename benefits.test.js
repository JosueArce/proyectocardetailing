import { describe, expect, it } from 'vitest'
import { calculateBookingBenefit, containsCeramicTreatment } from './benefits.js'

const completed = Array.from({ length: 3 }, (_, index) => ({ id: index, customerId: 'customer-1', status: 'Completada' }))

describe('beneficios de clientes frecuentes', () => {
  it('aplica mitad de precio después de tres citas completas', () => {
    expect(calculateBookingBenefit({ baseCost: 6000, services: ['Detallado exterior'], customerId: 'customer-1', bookings: completed })).toMatchObject({ cost: 3000, discount: 3000, benefitType: 'loyalty' })
  })

  it('no aplica el beneficio frecuente a tratamientos cerámicos', () => {
    expect(containsCeramicTreatment(['Protección cerámica en carrocería'])).toBe(true)
    expect(calculateBookingBenefit({ baseCost: 50000, services: ['Protección cerámica en carrocería'], customerId: 'customer-1', bookings: completed }).discount).toBe(0)
  })

  it('limita el beneficio frecuente a detallados interior y exterior', () => {
    expect(calculateBookingBenefit({ baseCost: 20000, services: ['Pulido de carrocería'], customerId: 'customer-1', bookings: completed }).discount).toBe(0)
  })

  it('permite usar una promoción una vez validada', () => {
    const promotion = { id: 'promo-1', code: 'ROJO10', rewardType: 'percentage', value: 10 }
    expect(calculateBookingBenefit({ baseCost: 20000, services: ['Pulido de carrocería'], customerId: 'customer-1', bookings: [], promotion })).toMatchObject({ cost: 18000, discount: 2000, benefitType: 'promotion' })
  })
})
