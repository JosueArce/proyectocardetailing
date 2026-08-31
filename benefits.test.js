import { describe, expect, it } from 'vitest'
import { calculateBookingBenefit } from './benefits.js'

const completed = Array.from({ length: 3 }, (_, index) => ({ id: index, customerId: 'customer-1', status: 'Completada' }))

describe('beneficios de clientes frecuentes', () => {
  it('aplica mitad de precio después de tres citas completas', () => {
    expect(calculateBookingBenefit({ baseCost: 12000, loyaltyEligible: true, customerId: 'customer-1', bookings: completed })).toMatchObject({ cost: 6000, discount: 6000, benefitType: 'loyalty' })
  })

  it('no aplica el beneficio frecuente a tratamientos cerámicos', () => {
    expect(calculateBookingBenefit({ baseCost: 65000, loyaltyEligible: false, customerId: 'customer-1', bookings: completed }).discount).toBe(0)
  })

  it('limita el beneficio frecuente a los servicios marcados como lavados', () => {
    expect(calculateBookingBenefit({ baseCost: 55000, loyaltyEligible: false, customerId: 'customer-1', bookings: completed }).discount).toBe(0)
  })

  it('permite usar una promoción una vez validada', () => {
    const promotion = { id: 'promo-1', code: 'ROJO10', rewardType: 'percentage', value: 10 }
    expect(calculateBookingBenefit({ baseCost: 20000, loyaltyEligible: false, customerId: 'customer-1', bookings: [], promotion })).toMatchObject({ cost: 18000, discount: 2000, benefitType: 'promotion' })
  })
})
