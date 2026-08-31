export const calculateBookingBenefit = ({ baseCost, loyaltyEligible = false, customerId, customerEmail = '', bookings = [], promotion = null }) => {
  if (!customerId) return { cost: baseCost, discount: 0, benefitType: '', benefitLabel: '' }

  const customerBookings = bookings.filter(booking => booking.customerId === customerId || (!booking.customerId && customerEmail && booking.email?.toLowerCase() === customerEmail.toLowerCase()))
  const completed = customerBookings.filter(booking => booking.status === 'Completada').length
  const loyaltyUsed = customerBookings.filter(booking => booking.benefitType === 'loyalty' && booking.status !== 'Cancelada').length
  const loyaltyAvailable = Math.floor(completed / 3) > loyaltyUsed && loyaltyEligible
  const loyaltyDiscount = loyaltyAvailable ? Math.round(baseCost * 0.5) : 0

  let promotionDiscount = 0
  if (promotion?.rewardType === 'percentage') promotionDiscount = Math.round(baseCost * Math.min(100, Math.max(0, Number(promotion.value))) / 100)
  if (promotion?.rewardType === 'fixed') promotionDiscount = Math.min(baseCost, Math.max(0, Number(promotion.value)))

  if (promotion && (promotion.rewardType === 'gift' || promotionDiscount >= loyaltyDiscount)) return {
    cost: baseCost - promotionDiscount,
    discount: promotionDiscount,
    benefitType: 'promotion',
    benefitLabel: promotion.rewardType === 'gift' ? promotion.description : `Código ${promotion.code}`,
    promotionId: promotion.id,
    promotionCode: promotion.code,
  }
  if (loyaltyAvailable) return { cost: baseCost - loyaltyDiscount, discount: loyaltyDiscount, benefitType: 'loyalty', benefitLabel: 'Beneficio frecuente: 50% de descuento' }
  return { cost: baseCost, discount: 0, benefitType: '', benefitLabel: '' }
}
