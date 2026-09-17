const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim()

export function initializeAnalytics() {
  if (!measurementId || typeof window === 'undefined') return false

  window.dataLayer = window.dataLayer || []
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments) }
  window.gtag('js', new Date())
  window.gtag('config', measurementId, {
    debug_mode: new URLSearchParams(window.location.search).has('debug_analytics'),
  })

  if (!document.querySelector(`script[data-ga4-id="${measurementId}"]`)) {
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
    script.dataset.ga4Id = measurementId
    document.head.append(script)
  }
  return true
}

export function trackWhatsappContact(buttonLocation) {
  if (typeof window === 'undefined') return
  window.gtag?.('event', 'whatsapp_contact', {
    page_location: window.location.href,
    button_location: buttonLocation,
    contact_method: 'whatsapp',
  })
}
