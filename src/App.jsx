import { useEffect, useState } from 'react'
import { ArrowRight, CalendarDays, Car, Check, ChevronRight, Instagram, Mail, Menu, MessageCircle, ShieldCheck, ShoppingCart, Sparkles, X } from './icons'
import { AccessModal, AdminLogin, AdminPortal, CustomerPortal } from './PortalPanels'
import { AddOn, ServiceCard } from './ServiceCatalog'
import catalog, { bookableServices } from './serviceCatalogData'

const services = bookableServices
const serviceGroups = [{ label: catalog.website.servicesSection.title, items: catalog.services }, { label: catalog.additionalServices.title, items: catalog.additionalServices.items }]

const sampleProjects = [
  { id: 'demo-exterior', title: 'Renovación exterior', description: 'Lavado técnico, descontaminación y acabado brillante de la carrocería.', media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1507136566006-cfc505b114fc?auto=format&fit=crop&w=1200&q=85' }] },
  { id: 'demo-pintura', title: 'Detalle de pintura', description: 'Pulido de carrocería para recuperar profundidad, reflejo y presencia.', media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=900&q=85' }] },
  { id: 'demo-acabado', title: 'Acabado profesional', description: 'Protección final y revisión minuciosa antes de entregar el vehículo.', media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1489824904134-891ab64532f1?auto=format&fit=crop&w=900&q=85' }] },
]
const sinpePhone = import.meta.env.VITE_SINPE_PHONE || '+506 8362-9162'
const whatsappUrl = 'https://wa.me/50683629162?text=Hola%20AutoEstudioCR%2C%20quiero%20consultar%20sobre%20sus%20servicios%20y%20reservar%20una%20cita.'
const emptyForm = { name: '', phone: '', email: '', vehicle: '', services: [], date: '', time: '', notes: '', promotionCode: '', promotion: null, whatsappOptIn: false, paymentMethod: 'sinpe', paymentStatus: 'Pendiente', paymentEvidenceName: '', paymentEvidenceData: '' }
const minBookingDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

function App() {
  const [menu, setMenu] = useState(false)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [adminLoginOpen, setAdminLoginOpen] = useState(false)
  const [accessOpen, setAccessOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [bookingError, setBookingError] = useState('')
  const [bookingSaving, setBookingSaving] = useState(false)
  const [notificationResults, setNotificationResults] = useState([])
  const [systemStatus, setSystemStatus] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [bookings, setBookings] = useState(() => JSON.parse(localStorage.getItem('detail-bookings') || '[]'))
  const [currentAccount, setCurrentAccount] = useState(null)
  const [blockedDates, setBlockedDates] = useState(() => JSON.parse(localStorage.getItem('detail-blocked-dates') || '[]'))
  const [expenses, setExpenses] = useState(() => JSON.parse(localStorage.getItem('detail-expenses') || '[]'))
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem('detail-service-cart') || '[]').filter(name => services.some(service => service.name === name)))
  const [projects, setProjects] = useState(sampleProjects)
  const [promotions, setPromotions] = useState([])
  const [reviews, setReviews] = useState({ rating: 0, total: 0, googleMapsUrl: '', reviews: [] })
  const [reviewsLoading, setReviewsLoading] = useState(true)

  useEffect(() => { localStorage.setItem('detail-bookings', JSON.stringify(bookings)) }, [bookings])
  useEffect(() => { localStorage.setItem('detail-blocked-dates', JSON.stringify(blockedDates)) }, [blockedDates])
  useEffect(() => { localStorage.setItem('detail-expenses', JSON.stringify(expenses)) }, [expenses])
  useEffect(() => { localStorage.setItem('detail-service-cart', JSON.stringify(cart)) }, [cart])
  useEffect(() => { document.body.style.overflow = bookingOpen || adminOpen || accessOpen || adminLoginOpen || cartOpen ? 'hidden' : ''; return () => { document.body.style.overflow = '' } }, [bookingOpen, adminOpen, accessOpen, adminLoginOpen, cartOpen])

  const toggleCart = service => setCart(current => current.includes(service) ? current.filter(item => item !== service) : [...current, service])
  const toggleFormService = service => setForm(current => ({ ...current, services: current.services.includes(service) ? current.services.filter(item => item !== service) : [...current.services, service] }))
  const openBooking = (service) => {
    const selected = service ? [...new Set([...cart, service])] : cart
    setForm(f => ({ ...f, services: selected.length ? selected : f.services, name: currentAccount?.name || f.name, email: currentAccount?.email || f.email, phone: currentAccount?.phone || f.phone }))
    setSubmitted(false); setBookingError(''); setNotificationResults([]); setBookingOpen(true); setCartOpen(false); setMenu(false)
  }
  const submit = async (e) => {
    e.preventDefault()
    if (!form.services.length) return setBookingError('Selecciona al menos un servicio para continuar.')
    const cost = 0
    const service = form.services.join(' + ')
    setBookingSaving(true); setBookingError('')
    try {
      const response = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, service, cost }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No fue posible confirmar la cita.')
      setBookings(prev => [result.booking || { ...form, service, cost, paymentStatus: result.paymentStatus || 'Pendiente', calendarEventId: result.eventId, id: Date.now(), status: 'Pendiente', createdAt: new Date().toISOString() }, ...prev])
      setNotificationResults(result.notifications || [])
      setCart([])
      setSubmitted(true)
    } catch (error) { setBookingError(error.message) } finally { setBookingSaving(false) }
  }
  useEffect(() => { fetch('/api/auth/me').then(async response => { if (response.ok) { const result = await response.json(); setCurrentAccount(result.account); setBookings(result.bookings || []) } }) }, [])
  useEffect(() => { fetch('/api/projects').then(response => response.ok ? response.json() : null).then(result => { if (result?.projects?.length) setProjects(result.projects) }).catch(() => {}) }, [])
  useEffect(() => {
    fetch('/api/reviews')
      .then(response => response.ok ? response.json() : null)
      .then(result => {
        if (result) setReviews({ rating: Number(result.rating) || 0, total: Number(result.total) || 0, googleMapsUrl: result.googleMapsUrl || '', reviews: Array.isArray(result.reviews) ? result.reviews : [] })
      })
      .catch(() => {})
      .finally(() => setReviewsLoading(false))
  }, [])
  const authenticate = result => { setCurrentAccount(result.account); setBookings(result.bookings || []); setAccessOpen(false) }
  const addCar = async car => { const response = await fetch('/api/vehicles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(car) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'No pudimos guardar el vehículo.'); setCurrentAccount(account => ({ ...account, cars: [...(account.cars || []), result.vehicle] })) }
  const logout = async () => { await fetch('/api/auth/logout', { method: 'POST' }); setCurrentAccount(null); setBookings([]); setAccessOpen(false) }
  const selectPaymentEvidence = file => {
    if (!file) return setForm(current => ({ ...current, paymentEvidenceName: '', paymentEvidenceData: '' }))
    if (file.size > 5 * 1024 * 1024) return setBookingError('El comprobante no puede superar 5 MB.')
    const reader = new FileReader()
    reader.onload = () => setForm(current => ({ ...current, paymentEvidenceName: file.name, paymentEvidenceData: String(reader.result) }))
    reader.readAsDataURL(file)
  }
  const openAdmin = async () => {
    const [bookingsResponse, statusResponse, operationsResponse] = await Promise.all([fetch('/api/admin/bookings'), fetch('/api/admin/system-status'), fetch('/api/admin/operations')])
    const result = await bookingsResponse.json()
    setSystemStatus(await statusResponse.json())
    if (operationsResponse.ok) { const operations = await operationsResponse.json(); setBlockedDates(operations.blockedDates || []); setExpenses(operations.expenses || []); setPromotions(operations.promotions || []) }
    if (bookingsResponse.ok) setBookings(result.bookings || [])
    setAdminLoginOpen(false)
    setAdminOpen(true)
  }
  const saveBlockedDate = async date => { const response = await fetch('/api/admin/blocked-dates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setBlockedDates(list => list.includes(date) ? list : [...list, date]) }
  const removeBlockedDate = async date => { const response = await fetch(`/api/admin/blocked-dates/${date}`, { method: 'DELETE' }); if (!response.ok) throw new Error('No pudimos desbloquear la fecha.'); setBlockedDates(list => list.filter(item => item !== date)) }
  const saveExpense = async expense => { const response = await fetch('/api/admin/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(expense) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setExpenses(list => [result.expense, ...list]) }
  const savePromotion = async promotion => { const response = await fetch('/api/admin/promotions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(promotion) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setPromotions(list => [result.promotion, ...list]) }
  const validatePromotion = async () => { setBookingError(''); const response = await fetch('/api/promotions/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: form.promotionCode }) }); const result = await response.json(); if (!response.ok) return setBookingError(result.error); setForm(current => ({ ...current, promotionCode: result.promotion.code, promotion: result.promotion })) }
  const accountBookings = currentAccount ? bookings.filter(item => item.customerId === currentAccount.id || item.email?.toLowerCase() === currentAccount.email.toLowerCase()) : []
  const completedAccountBookings = accountBookings.filter(item => item.status === 'Completada').length
  const availableLoyaltyRewards = Math.floor(completedAccountBookings / 3) - accountBookings.filter(item => item.benefitType === 'loyalty' && item.status !== 'Cancelada').length

  return <>
    <header className="header">
      <a className="brand brand-logo" href="#inicio" aria-label="AutoEstudioCR Detailing, inicio"><img src="/autoestudiocr-logo.svg" alt="AutoEstudioCR Detailing"/></a>
      <nav className={menu ? 'nav open' : 'nav'} aria-label="Navegación principal">
        <a href="#servicios" onClick={() => setMenu(false)}>Servicios</a><a href="#galeria" onClick={() => setMenu(false)}>Resultados</a><a href="#proceso" onClick={() => setMenu(false)}>Proceso</a><a href="#opiniones" onClick={() => setMenu(false)}>Opiniones</a>
        <button className="admin-link" onClick={() => { setAdminLoginOpen(true); setMenu(false) }}>Administrar</button>
        <button className="admin-link account-link" onClick={() => { setAccessOpen(true); setMenu(false) }}>{currentAccount ? `Hola, ${currentAccount.name.split(' ')[0]}` : 'Mi cuenta'}</button>
      </nav>
      <button className="cart-trigger" onClick={() => setCartOpen(true)} aria-label={`Carrito de servicios, ${cart.length} seleccionados`}><ShoppingCart/><span>{cart.length}</span></button>
      <button className="btn btn-small desktop-cta" onClick={() => openBooking()}>Reservar cita <ArrowRight size={16}/></button>
      <button className="menu-btn" onClick={() => setMenu(!menu)} aria-label="Abrir menú">{menu ? <X/> : <Menu/>}</button>
    </header>

    <main>
      <section className="hero" id="inicio">
        <div className="hero-bg"/><div className="hero-overlay"/>
        <div className="hero-content">
          <div className="eyebrow"><span/> Detallado automotriz de precisión</div>
          <h1>No solo lo lavamos.<br/><em>Lo restauramos.</em></h1>
          <p>Un servicio de cuidado excepcional que devuelve a tu vehículo el brillo, la presencia y la protección que merece.</p>
          <div className="hero-actions"><button className="btn" onClick={() => openBooking()}>Reservar mi cita <ArrowRight size={18}/></button><a className="text-link" href="#galeria">Ver resultados <ChevronRight size={17}/></a></div>
          <div className="trust-row">
            {reviews.total > 0 && <><div><strong>{reviews.total}</strong><small>{reviews.total === 1 ? 'Opinión en Google' : 'Opiniones en Google'}</small></div><i/></>}
            <div><strong>100%</strong><small>Productos profesionales</small></div><i/>
            <div><strong>1 y 3 años</strong><small>Protección cerámica disponible</small></div>
          </div>
        </div>
        <div className="scroll-cue">DESCUBRE <span/></div>
      </section>

      <section className="section catalog-section" id="servicios">
        <div className="section-head"><div><span className="kicker">SERVICIOS AUTOESTUDIOCR</span><h2>{catalog.website.servicesSection.title}<br/><em>para cada nivel de detalle.</em></h2></div><p>{catalog.website.servicesSection.subtitle}</p></div>
        <div className="catalog-grid">{catalog.services.map(service => <ServiceCard key={service.id} service={service} selected={cart.includes(service.name)} onToggle={toggleCart} onReserve={openBooking}/>)}</div>
      </section>

      <section className="section addons-section" id="adicionales">
        <div className="section-head"><div><span className="kicker">SERVICIOS ADICIONALES</span><h2>{catalog.additionalServices.subtitle}<br/><em>cada detalle.</em></h2></div><p>{catalog.additionalServices.note}</p></div>
        <div className="addons-grid">{catalog.additionalServices.items.map(addon => <AddOn key={addon.id} addon={addon} selected={cart.includes(addon.name)} onToggle={toggleCart}/>)}</div>
        {catalog.website.cta.enabled && <div className="services-cta"><h3>{catalog.website.cta.title}</h3><div><button className="btn" onClick={() => openBooking()}>{catalog.website.cta.buttonText}</button><a className="outline-btn" href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle/> {catalog.website.cta.secondaryButtonText}</a></div></div>}
      </section>

      <section className="section products" id="productos"><div className="section-head"><div><span className="kicker">PRODUCTOS PROFESIONALES</span><h2>Resultados respaldados por<br/><em>una marca líder.</em></h2></div><p>Utilizamos productos profesionales Meguiar&apos;s seleccionados según la superficie y condición de cada vehículo.</p></div><div className="product-grid product-grid-single"><article><span>PRO SERIES</span><h3>MEGUIAR&apos;S</h3><p>Pulimentos, limpieza, protección y acabado profesional</p><ShieldCheck/></article></div></section>

      <section className="gallery-section" id="galeria"><div className="gallery-copy"><span className="kicker">RESULTADOS QUE HABLAN</span><h2>Trabajo real.<br/><em>Resultados reales.</em></h2><p>Explora fotografías y videos de proyectos realizados por AutoEstudioCR.</p></div><div className="gallery-grid">{projects.map(project => <article className="project-card" key={project.id}><div className="project-media">{project.media?.map((item, index) => item.type === 'video' ? <video aria-label={`${project.title}, video ${index + 1}`} controls preload="metadata" src={item.url} key={item.url}/> : <img src={item.url} alt={`${project.title}, fotografía ${index + 1}`} key={item.url}/>)}</div><div className="project-info"><span className="project-type">PROYECTO · {project.media?.length || 0} ARCHIVOS</span><h3>{project.title}</h3><p>{project.description}</p></div></article>)}</div></section>

      <section className="section process" id="proceso"><div className="section-head"><div><span className="kicker">SIMPLE. TRANSPARENTE. EXCEPCIONAL.</span><h2>Tu auto en buenas manos,<br/><em>desde el primer clic.</em></h2></div></div><div className="steps">{[['01','Reserva en línea','Elige los servicios, el día y la hora que mejor te funcionen.'],['02','Evaluamos tu auto','Revisamos cada detalle y confirmamos contigo el tratamiento ideal.'],['03','Creamos la magia','Trabajamos con precisión, productos profesionales y atención minuciosa.'],['04','Entrega y recomendaciones','Revisamos juntos el resultado, te explicamos los cuidados posteriores y entregamos tu vehículo impecable.']].map(([n,t,d]) => <article className={`step ${n === '04' ? 'step-final' : ''}`} key={n}><span aria-hidden="true">{n}</span><div className="step-icon">{n === '01' ? <CalendarDays/> : n === '04' ? <Car/> : <Sparkles/>}</div><h3>{t}</h3><p>{d}</p>{n === '04' && <small>PROCESO COMPLETADO</small>}</article>)}</div></section>

      <section className="testimonial" id="opiniones">
        <div className="reviews-wrap">
          <span className="kicker">OPINIONES EN GOOGLE</span>
          <h2>Experiencias que generan <em>confianza.</em></h2>
          {reviewsLoading ? <p className="reviews-status" role="status">Cargando opiniones…</p> : reviews.reviews.length ? <>
            <div className="reviews-summary" aria-label={`${reviews.rating} de 5 estrellas, ${reviews.total} opiniones en Google`}><strong>{reviews.rating.toLocaleString('es-CR', { maximumFractionDigits: 1 })}</strong><span aria-hidden="true">★★★★★</span><small>{reviews.total} {reviews.total === 1 ? 'opinión' : 'opiniones'} en Google</small></div>
            <div className="reviews-grid">{reviews.reviews.map(review => <article className="review-card" key={review.id}><div className="review-stars" aria-label={`${review.rating} de 5 estrellas`}>{'★'.repeat(Math.max(0, Math.min(5, Math.round(Number(review.rating) || 0))))}</div><blockquote>“{review.text}”</blockquote><p><strong>{review.author}</strong><span>{review.relativeTime}</span></p></article>)}</div>
            {reviews.googleMapsUrl && <a className="btn review-link" href={reviews.googleMapsUrl} target="_blank" rel="noreferrer">Ver todas en Google <ArrowRight size={17}/></a>}
          </> : <p className="reviews-status">Muy pronto compartiremos aquí las opiniones publicadas por nuestros clientes en Google.</p>}
        </div>
      </section>

      <section className="section owner-section"><div className="owner-card"><span className="kicker">HECHO EN COSTA RICA</span><h2>Pasión por cada detalle.</h2><p>Soy <strong>Josue Arce</strong>, tengo 29 años y creé este estudio para ofrecer en Costa Rica un cuidado automotriz honesto, preciso y de nivel profesional.</p><span className="owner-signature">Josue Arce · Fundador</span></div></section>

      <section className="cta-section"><div><span className="kicker">TU AUTO LO MERECE</span><h2>¿Listo para volver<br/>a <em>enamorarte de tu auto?</em></h2><p>Reserva hoy. Nosotros nos encargamos del resto.</p><button className="btn" onClick={() => openBooking()}>Reservar mi cita <ArrowRight size={18}/></button></div></section>
    </main>

    <a className="whatsapp-float" href={whatsappUrl} target="_blank" rel="noreferrer" aria-label="Contactar a AutoEstudioCR por WhatsApp"><MessageCircle/><span><strong>Contáctenos</strong><small>Reservar por WhatsApp</small></span></a>

    <footer><a className="brand brand-logo footer-logo" href="#inicio" aria-label="AutoEstudioCR Detailing, inicio"><img src="/autoestudiocr-logo.svg" alt="AutoEstudioCR Detailing"/></a><p>AutoEstudioCR Detailing es un proyecto costarricense de Josue Arce, dedicado al cuidado automotriz profesional.</p><div className="socials"><a href="mailto:hola@estudioauto.com" aria-label="Correo"><Mail/></a><a href="https://www.instagram.com/autoestudiocr" target="_blank" rel="noreferrer" aria-label="Instagram de AutoEstudioCR"><Instagram/></a><a href={whatsappUrl} target="_blank" rel="noreferrer" aria-label="WhatsApp de AutoEstudioCR"><MessageCircle/></a></div><small>© 2026 AutoEstudioCR Detailing · Costa Rica · Aviso de privacidad</small></footer>

    {cartOpen && <div className="cart-backdrop" onMouseDown={() => setCartOpen(false)}><aside className="service-cart" onMouseDown={event => event.stopPropagation()} aria-label="Carrito de servicios"><div className="cart-heading"><div><span className="kicker">TU SELECCIÓN</span><h2>Servicios</h2></div><button aria-label="Cerrar carrito" onClick={() => setCartOpen(false)}><X/></button></div>{cart.length ? <><div className="cart-items">{cart.map(name => { const item = services.find(service => service.name === name); return <div key={name}><span><strong>{name}</strong><small>{item?.category}</small></span><button aria-label={`Quitar ${name}`} onClick={() => toggleCart(name)}><X/></button></div> })}</div><div className="cart-total"><span>{cart.length} {cart.length === 1 ? 'servicio seleccionado' : 'servicios seleccionados'}</span></div><button className="btn full" onClick={() => openBooking()}>Continuar con la reserva <ArrowRight size={17}/></button><button className="clear-cart" onClick={() => setCart([])}>Vaciar selección</button></> : <div className="cart-empty"><ShoppingCart/><h3>Tu carrito está vacío</h3><p>Agrega uno o varios servicios mientras navegas por el catálogo.</p><button onClick={() => setCartOpen(false)}>Explorar servicios</button></div>}</aside></div>}

    {bookingOpen && <div className="modal-backdrop" onMouseDown={() => setBookingOpen(false)}><section className="modal booking-modal" onMouseDown={e => e.stopPropagation()} aria-modal="true" role="dialog"><button className="close" aria-label="Cerrar" onClick={() => setBookingOpen(false)}><X/></button>{submitted ? <div className="success"><span><Check/></span><span className="kicker">CITA REGISTRADA</span><h2>¡Gracias, {form.name.split(' ')[0]}!</h2><p>Tu cita para <strong>{form.services.join(', ')}</strong> fue agregada al calendario. Josue recibió los datos para confirmarla.</p>{notificationResults.some(n => n.status === 'sent') && <div className="notification-status">{notificationResults.filter(n => n.status === 'sent').map(n => <span key={n.channel}><Check size={14}/>{n.channel === 'email' ? 'Correo enviado' : 'WhatsApp enviado'}</span>)}</div>}<button className="btn" onClick={() => { setBookingOpen(false); setForm(emptyForm) }}>Listo</button></div> : <><span className="kicker">RESERVA TU EXPERIENCIA</span><h2>Agenda tu cita</h2><p className="modal-intro">No necesitas una cuenta para reservar. Combina todos los servicios que quieras recibir.</p><form onSubmit={submit}><label>Nombre completo<input required value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder="Tu nombre"/></label><div className="form-row"><label>Teléfono<input required type="tel" value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} placeholder="+506 8888-8888"/></label><label>Correo<input required type="email" value={form.email} onChange={e => setForm({...form,email:e.target.value})} placeholder="tu@correo.com"/></label></div><label>Vehículo{currentAccount?.cars?.length ? <select required value={form.vehicle} onChange={e => setForm({...form,vehicle:e.target.value})}><option value="">Selecciona un vehículo</option>{currentAccount.cars.map(c => <option key={c.id}>{c.make} {c.model} {c.year}</option>)}</select> : <input required value={form.vehicle} onChange={e => setForm({...form,vehicle:e.target.value})} placeholder="Marca, modelo y año"/>}</label><fieldset className="service-selector"><legend>Servicios <span>Selecciona uno o varios</span></legend>{serviceGroups.map(group => <div className="service-option-group" key={group.label}><strong>{group.label}</strong>{group.items.map(service => <label className={form.services.includes(service.name) ? 'selected' : ''} key={service.id}><input type="checkbox" checked={form.services.includes(service.name)} onChange={() => toggleFormService(service.name)}/><span>{service.name}</span></label>)}</div>)}<div className="selected-total"><span>{form.services.length} {form.services.length === 1 ? 'servicio seleccionado' : 'servicios seleccionados'}</span></div></fieldset>{currentAccount ? <div className="benefits-panel"><div><strong>Beneficios de tu cuenta</strong><span>{completedAccountBookings} citas completadas</span></div>{availableLoyaltyRewards > 0 && <p>Tu próximo lavado regular puede recibir 50% de descuento. No aplica a tratamientos cerámicos.</p>}<label>Código promocional<div className="promo-redeem"><input value={form.promotionCode} onChange={event => setForm({...form,promotionCode:event.target.value.toUpperCase(),promotion:null})} placeholder="AUTOESTUDIO"/><button type="button" onClick={validatePromotion}>Redimir</button></div></label>{form.promotion && <small>✓ {form.promotion.description}</small>}</div> : <p className="benefits-login">Inicia sesión para acumular citas, obtener el beneficio frecuente y redimir promociones.</p>}<div className="form-row"><label>Fecha<input required type="date" min={minBookingDate} value={form.date} onChange={e => setForm({...form,date:e.target.value})}/>{blockedDates.includes(form.date) && <span className="field-error">Esta fecha no está disponible.</span>}</label><label>Hora<select required value={form.time} onChange={e => setForm({...form,time:e.target.value})}><option value="">Selecciona</option><option>09:00</option><option>11:00</option><option>14:00</option><option>16:00</option></select></label></div><fieldset className="payment-options"><legend>Método de pago</legend><label className={form.paymentMethod === 'sinpe' ? 'payment-option selected' : 'payment-option'}><input type="radio" name="paymentMethod" value="sinpe" checked={form.paymentMethod === 'sinpe'} onChange={e => setForm({...form,paymentMethod:e.target.value,paymentEvidenceName:'',paymentEvidenceData:''})}/><span><strong>SINPE Móvil</strong><small>Transferencia y comprobante</small></span></label><label className={form.paymentMethod === 'cash' ? 'payment-option selected' : 'payment-option'}><input type="radio" name="paymentMethod" value="cash" checked={form.paymentMethod === 'cash'} onChange={e => setForm({...form,paymentMethod:e.target.value,paymentEvidenceName:'',paymentEvidenceData:''})}/><span><strong>Efectivo</strong><small>Pago el día de la cita</small></span></label><label className="payment-option disabled"><input type="radio" name="paymentMethod" value="card" disabled/><span><strong>Tarjeta</strong><small>Próximamente</small></span></label></fieldset>{form.paymentMethod === 'sinpe' && <div className="sinpe-panel"><span>Envía el monto a</span><strong>{sinpePhone}</strong><label className="file-upload"><span>Seleccionar archivo</span><input aria-label="Comprobante SINPE" required type="file" accept="image/*,application/pdf" onChange={e => selectPaymentEvidence(e.target.files?.[0])}/></label>{form.paymentEvidenceName && <small>✓ {form.paymentEvidenceName}</small>}<p>La reserva permanecerá pendiente hasta que Josue revise el comprobante.</p></div>}{form.paymentMethod === 'cash' && <p className="cash-note">Pagarás el día de la cita. Josue marcará el pago como recibido antes de completar el servicio.</p>}<label>Notas (opcional)<textarea value={form.notes} onChange={e => setForm({...form,notes:e.target.value})} placeholder="Cuéntanos algo que debamos saber..."/></label><label className="consent-check"><input type="checkbox" checked={form.whatsappOptIn} onChange={e => setForm({...form,whatsappOptIn:e.target.checked})}/><span>Acepto recibir la confirmación y recordatorios de esta cita por WhatsApp.</span></label>{bookingError && <p className="form-error" role="alert">{bookingError}</p>}<button disabled={bookingSaving || blockedDates.includes(form.date)} className="btn full" type="submit">{bookingSaving ? 'Registrando tu cita…' : <>Solicitar reservación <ArrowRight size={18}/></>}</button><small className="privacy"><ShieldCheck size={14}/> La cita se registrará en el calendario del negocio.</small></form></>}</section></div>}

    {accessOpen && !currentAccount && <AccessModal onClose={() => setAccessOpen(false)} onAuthenticated={authenticate}/>}
    {currentAccount && accessOpen && <CustomerPortal account={currentAccount} bookings={bookings} onAddCar={addCar} onLogout={logout} onClose={() => setAccessOpen(false)}/>}
    {adminLoginOpen && <AdminLogin onClose={() => setAdminLoginOpen(false)} onSuccess={openAdmin}/>}
    {adminOpen && <AdminPortal bookings={bookings} setBookings={setBookings} blockedDates={blockedDates} onBlockDate={saveBlockedDate} onUnblockDate={removeBlockedDate} expenses={expenses} onAddExpense={saveExpense} promotions={promotions} onAddPromotion={savePromotion} projects={projects} setProjects={setProjects} systemStatus={systemStatus} onClose={() => setAdminOpen(false)}/>}
  </>
}

export default App
