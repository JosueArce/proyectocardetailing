import { useEffect, useState } from 'react'
import { ArrowRight, Car, ChevronRight, Instagram, Mail, Menu, MessageCircle, ShieldCheck, Sparkles, X } from './icons'
import { AdminLogin, AdminPortal } from './PortalPanels'
import { AddOn, ServiceCard } from './ServiceCatalog'
import catalog from './serviceCatalogData'

const sampleProjects = [
  { id: 'demo-exterior', title: 'Renovación exterior', description: 'Lavado técnico, descontaminación y acabado brillante de la carrocería.', media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1507136566006-cfc505b114fc?auto=format&fit=crop&w=1200&q=85' }] },
  { id: 'demo-pintura', title: 'Detalle de pintura', description: 'Pulido de carrocería para recuperar profundidad, reflejo y presencia.', media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=900&q=85' }] },
  { id: 'demo-acabado', title: 'Acabado profesional', description: 'Protección final y revisión minuciosa antes de entregar el vehículo.', media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1489824904134-891ab64532f1?auto=format&fit=crop&w=900&q=85' }] },
]
const whatsappBase = 'https://wa.me/50683629162'
const whatsappHref = subject => `${whatsappBase}?text=${encodeURIComponent(subject ? `Hola AutoEstudioCR, quiero consultar por ${subject}.` : 'Hola AutoEstudioCR, quiero información sobre sus servicios de detallado.')}`

function App() {
  const [menu, setMenu] = useState(false)
  const [adminLoginOpen, setAdminLoginOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [projects, setProjects] = useState(sampleProjects)
  const [reviews, setReviews] = useState({ rating: 0, total: 0, googleMapsUrl: '', reviews: [] })
  const [reviewsLoading, setReviewsLoading] = useState(true)

  useEffect(() => { document.body.style.overflow = adminOpen || adminLoginOpen ? 'hidden' : ''; return () => { document.body.style.overflow = '' } }, [adminOpen, adminLoginOpen])
  useEffect(() => { fetch('/api/projects').then(response => response.ok ? response.json() : null).then(result => { if (result?.projects?.length) setProjects(result.projects) }).catch(() => {}) }, [])
  useEffect(() => {
    fetch('/api/reviews').then(response => response.ok ? response.json() : null).then(result => {
      if (result) setReviews({ rating: Number(result.rating) || 0, total: Number(result.total) || 0, googleMapsUrl: result.googleMapsUrl || '', reviews: Array.isArray(result.reviews) ? result.reviews : [] })
    }).catch(() => {}).finally(() => setReviewsLoading(false))
  }, [])
  const openAdmin = () => { setAdminLoginOpen(false); setAdminOpen(true) }

  return <>
    <header className="header">
      <a className="brand brand-logo" href="#inicio" aria-label="AutoEstudioCR Detailing, inicio"><img src="/autoestudiocr-header-logo.svg" alt="AutoEstudioCR Detailing"/></a>
      <nav className={menu ? 'nav open' : 'nav'} aria-label="Navegación principal">
        <a href="#servicios" onClick={() => setMenu(false)}>Servicios</a><a href="#galeria" onClick={() => setMenu(false)}>Resultados</a><a href="#proceso" onClick={() => setMenu(false)}>Proceso</a><a href="#opiniones" onClick={() => setMenu(false)}>Opiniones</a>
        <button className="admin-link" onClick={() => { setAdminLoginOpen(true); setMenu(false) }}>Administrar</button>
      </nav>
      <a className="btn btn-small desktop-cta" href={whatsappHref()} target="_blank" rel="noreferrer">Contáctenos <MessageCircle size={16}/></a>
      <button className="menu-btn" onClick={() => setMenu(!menu)} aria-label="Abrir menú">{menu ? <X/> : <Menu/>}</button>
    </header>

    <main>
      <section className="hero" id="inicio">
        <div className="hero-bg"/><div className="hero-overlay"/>
        <div className="hero-content">
          <div className="eyebrow"><span/> Detallado automotriz de precisión</div>
          <h1>No solo lo lavamos.<br/><em>Lo restauramos.</em></h1>
          <p>Conoce nuestros servicios y resultados. Cada vehículo recibe una valoración personalizada según su tamaño, condición y el acabado que buscas.</p>
          <div className="hero-actions"><a className="btn" href={whatsappHref()} target="_blank" rel="noreferrer">Consultar por WhatsApp <MessageCircle size={18}/></a><a className="text-link" href="#galeria">Ver resultados <ChevronRight size={17}/></a></div>
          <div className="trust-row">{reviews.total > 0 && <><div><strong>{reviews.total}</strong><small>{reviews.total === 1 ? 'Opinión en Google' : 'Opiniones en Google'}</small></div><i/></>}<div><strong>100%</strong><small>Productos profesionales</small></div><i/><div><strong>1 y 3 años</strong><small>Protección cerámica disponible</small></div></div>
        </div>
        <div className="scroll-cue">DESCUBRE <span/></div>
      </section>

      <section className="section catalog-section" id="servicios">
        <div className="section-head"><div><span className="kicker">SERVICIOS AUTOESTUDIOCR</span><h2>{catalog.website.servicesSection.title}<br/><em>para cada nivel de detalle.</em></h2></div><p>{catalog.website.servicesSection.subtitle} Cotizamos cada trabajo después de conocer el vehículo.</p></div>
        <div className="catalog-grid">{catalog.services.map(service => <ServiceCard key={service.id} service={service} contactHref={whatsappHref(service.name)}/>)}</div>
      </section>

      <section className="section addons-section" id="adicionales">
        <div className="section-head"><div><span className="kicker">SERVICIOS ADICIONALES</span><h2>{catalog.additionalServices.subtitle}<br/><em>cada detalle.</em></h2></div><p>{catalog.additionalServices.note}</p></div>
        <div className="addons-grid">{catalog.additionalServices.items.map(addon => <AddOn key={addon.id} addon={addon} contactHref={whatsappHref(addon.name)}/>)}</div>
        <div className="services-cta"><h3>¿Quieres saber cuál servicio necesita tu vehículo?</h3><a className="btn" href={whatsappHref()} target="_blank" rel="noreferrer"><MessageCircle/> Hablar con Josue</a></div>
      </section>

      <section className="section products" id="productos"><div className="section-head"><div><span className="kicker">PRODUCTOS PROFESIONALES</span><h2>Resultados respaldados por<br/><em>una marca líder.</em></h2></div><p>Utilizamos productos profesionales Meguiar&apos;s seleccionados según la superficie y condición de cada vehículo.</p></div><div className="product-grid product-grid-single"><article><span>PRO SERIES</span><h3>MEGUIAR&apos;S</h3><p>Pulimentos, limpieza, protección y acabado profesional</p><ShieldCheck/></article></div></section>

      <section className="gallery-section" id="galeria"><div className="gallery-copy"><span className="kicker">RESULTADOS QUE HABLAN</span><h2>Trabajo real.<br/><em>Resultados reales.</em></h2><p>Explora fotografías y videos de proyectos realizados por AutoEstudioCR.</p></div><div className="gallery-grid">{projects.map(project => <article className="project-card" key={project.id}><div className="project-media">{project.media?.map((item, index) => item.type === 'video' ? <video aria-label={`${project.title}, video ${index + 1}`} controls preload="metadata" src={item.url} key={item.url}/> : <img src={item.url} alt={`${project.title}, fotografía ${index + 1}`} key={item.url}/>)}</div><div className="project-info"><span className="project-type">PROYECTO · {project.media?.length || 0} ARCHIVOS</span><h3>{project.title}</h3><p>{project.description}</p></div></article>)}</div></section>

      <section className="section process" id="proceso"><div className="section-head"><div><span className="kicker">SIMPLE. TRANSPARENTE. PERSONALIZADO.</span><h2>Tu auto en buenas manos,<br/><em>desde el primer mensaje.</em></h2></div></div><div className="steps">{[['01','Escríbenos por WhatsApp','Cuéntanos qué vehículo tienes y qué resultado estás buscando.'],['02','Evaluamos tu auto','Revisamos su condición y recomendamos el tratamiento adecuado.'],['03','Coordinamos contigo','Confirmamos alcance, cotización y disponibilidad directamente por WhatsApp.'],['04','Creamos el resultado','Trabajamos con precisión y te entregamos recomendaciones para conservar el acabado.']].map(([number,title,description]) => <article className={`step ${number === '04' ? 'step-final' : ''}`} key={number}><span aria-hidden="true">{number}</span><div className="step-icon">{number === '04' ? <Car/> : <Sparkles/>}</div><h3>{title}</h3><p>{description}</p>{number === '04' && <small>ATENCIÓN PERSONALIZADA</small>}</article>)}</div></section>

      <section className="testimonial" id="opiniones"><div className="reviews-wrap"><span className="kicker">OPINIONES EN GOOGLE</span><h2>Experiencias que generan <em>confianza.</em></h2>{reviewsLoading ? <p className="reviews-status" role="status">Cargando opiniones…</p> : reviews.reviews.length ? <><div className="reviews-summary" aria-label={`${reviews.rating} de 5 estrellas, ${reviews.total} opiniones en Google`}><strong>{reviews.rating.toLocaleString('es-CR', { maximumFractionDigits: 1 })}</strong><span aria-hidden="true">★★★★★</span><small>{reviews.total} {reviews.total === 1 ? 'opinión' : 'opiniones'} en Google</small></div><div className="reviews-grid">{reviews.reviews.map(review => <article className="review-card" key={review.id}><div className="review-stars" aria-label={`${review.rating} de 5 estrellas`}>{'★'.repeat(Math.max(0, Math.min(5, Math.round(Number(review.rating) || 0))))}</div><blockquote>“{review.text}”</blockquote><p><strong>{review.author}</strong><span>{review.relativeTime}</span></p></article>)}</div>{reviews.googleMapsUrl && <a className="btn review-link" href={reviews.googleMapsUrl} target="_blank" rel="noreferrer">Ver todas en Google <ArrowRight size={17}/></a>}</> : <p className="reviews-status">Muy pronto compartiremos aquí las opiniones publicadas por nuestros clientes en Google.</p>}</div></section>

      <section className="section owner-section"><div className="owner-card"><span className="kicker">HECHO EN COSTA RICA</span><h2>Pasión por cada detalle.</h2><p>Soy <strong>Josue Arce</strong> y creé este estudio para ofrecer en Costa Rica un cuidado automotriz honesto, preciso y de nivel profesional.</p><span className="owner-signature">Josue Arce · Fundador</span></div></section>
      <section className="cta-section"><div><span className="kicker">TU AUTO LO MERECE</span><h2>Hablemos sobre<br/><em>lo que tu vehículo necesita.</em></h2><p>Envíanos fotografías o tus preguntas y recibe atención personalizada.</p><a className="btn" href={whatsappHref()} target="_blank" rel="noreferrer">Contáctenos por WhatsApp <MessageCircle size={18}/></a></div></section>
    </main>

    <a className="whatsapp-float" href={whatsappHref()} target="_blank" rel="noreferrer" aria-label="Contactar a AutoEstudioCR por WhatsApp"><MessageCircle/><span><strong>Contáctenos</strong><small>Atención por WhatsApp</small></span></a>
    <footer><a className="brand brand-logo footer-logo" href="#inicio" aria-label="AutoEstudioCR Detailing, inicio"><img src="/autoestudiocr-logo.svg" alt="AutoEstudioCR Detailing"/></a><p>AutoEstudioCR Detailing es un proyecto costarricense de Josue Arce, dedicado al cuidado automotriz profesional.</p><div className="socials"><a href="mailto:hola@estudioauto.com" aria-label="Correo"><Mail/></a><a href="https://www.instagram.com/autoestudiocr" target="_blank" rel="noreferrer" aria-label="Instagram de AutoEstudioCR"><Instagram/></a><a href={whatsappHref()} target="_blank" rel="noreferrer" aria-label="WhatsApp de AutoEstudioCR"><MessageCircle/></a></div><small>© 2026 AutoEstudioCR Detailing · Costa Rica · Aviso de privacidad</small></footer>

    {adminLoginOpen && <AdminLogin onClose={() => setAdminLoginOpen(false)} onSuccess={openAdmin}/>}
    {adminOpen && <AdminPortal projects={projects} setProjects={setProjects} onClose={() => setAdminOpen(false)}/>}
  </>
}

export default App
