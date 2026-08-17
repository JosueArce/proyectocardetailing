import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, Car, Check, ChevronRight, Clock3, Droplets, Instagram, Mail, Menu, MessageCircle, ShieldCheck, Sparkles, X } from './icons'

const services = [
  { icon: Droplets, name: 'Esencial', price: '$49', time: '60–90 min', desc: 'El cuidado preciso para mantener tu auto impecable.', features: ['Lavado exterior premium', 'Aspirado interior', 'Limpieza de cristales', 'Brillo de neumáticos'] },
  { icon: Sparkles, name: 'Signature', price: '$119', time: '2–3 horas', popular: true, desc: 'Una renovación completa, por dentro y por fuera.', features: ['Todo lo del plan Esencial', 'Descontaminado de pintura', 'Limpieza profunda interior', 'Cera premium de 3 meses'] },
  { icon: ShieldCheck, name: 'Ceramic Pro', price: '$299', time: '5–6 horas', desc: 'Protección de alto desempeño y brillo extraordinario.', features: ['Corrección ligera de pintura', 'Recubrimiento cerámico', 'Protección UV e hidrofóbica', 'Garantía de 12 meses'] },
]

const gallery = [
  { url: 'https://images.unsplash.com/photo-1507136566006-cfc505b114fc?auto=format&fit=crop&w=1200&q=85', label: 'Detail exterior', span: 'wide' },
  { url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=900&q=85', label: 'Brillo profundo' },
  { url: 'https://images.unsplash.com/photo-1489824904134-891ab64532f1?auto=format&fit=crop&w=900&q=85', label: 'Acabado premium' },
]

const emptyForm = { name: '', phone: '', email: '', vehicle: '', service: 'Signature', date: '', time: '', notes: '' }

function App() {
  const [menu, setMenu] = useState(false)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [bookings, setBookings] = useState(() => JSON.parse(localStorage.getItem('detail-bookings') || '[]'))
  const minDate = useMemo(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10), [])

  useEffect(() => { localStorage.setItem('detail-bookings', JSON.stringify(bookings)) }, [bookings])
  useEffect(() => { document.body.style.overflow = bookingOpen || adminOpen ? 'hidden' : ''; return () => { document.body.style.overflow = '' } }, [bookingOpen, adminOpen])

  const openBooking = (service) => { setForm(f => ({ ...f, service: service || f.service })); setSubmitted(false); setBookingOpen(true); setMenu(false) }
  const submit = (e) => {
    e.preventDefault()
    setBookings(prev => [{ ...form, id: Date.now(), status: 'Pendiente', createdAt: new Date().toISOString() }, ...prev])
    setSubmitted(true)
  }
  const updateStatus = (id, status) => setBookings(b => b.map(item => item.id === id ? { ...item, status } : item))

  return <>
    <header className="header">
      <a className="brand" href="#inicio" aria-label="Inicio"><span className="brand-mark"><Sparkles size={18}/></span><span>ESTUDIO<span>AUTO</span></span></a>
      <nav className={menu ? 'nav open' : 'nav'} aria-label="Navegación principal">
        <a href="#servicios" onClick={() => setMenu(false)}>Servicios</a><a href="#galeria" onClick={() => setMenu(false)}>Resultados</a><a href="#proceso" onClick={() => setMenu(false)}>Proceso</a><a href="#opiniones" onClick={() => setMenu(false)}>Opiniones</a>
        <button className="admin-link" onClick={() => { setAdminOpen(true); setMenu(false) }}>Administrar</button>
      </nav>
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
          <div className="trust-row"><div><strong>4.9</strong><span className="stars">★★★★★</span><small>+180 clientes felices</small></div><i/><div><strong>100%</strong><small>Productos profesionales</small></div><i/><div><strong>12m</strong><small>Protección disponible</small></div></div>
        </div>
        <div className="scroll-cue">DESCUBRE <span/></div>
      </section>

      <section className="section intro" id="servicios">
        <div className="section-head"><div><span className="kicker">SERVICIOS DISEÑADOS PARA TI</span><h2>Elige el nivel de<br/><em>cuidado perfecto.</em></h2></div><p>Desde un mantenimiento impecable hasta protección cerámica de larga duración. Cada detalle cuenta.</p></div>
        <div className="service-grid">{services.map(({ icon: Icon, ...s }) => <article className={`service-card ${s.popular ? 'featured' : ''}`} key={s.name}>{s.popular && <span className="popular">MÁS ELEGIDO</span>}<div className="service-icon"><Icon/></div><div className="service-title"><div><h3>{s.name}</h3><span>{s.time}</span></div><strong><small>desde</small>{s.price}</strong></div><p>{s.desc}</p><ul>{s.features.map(f => <li key={f}><Check size={15}/>{f}</li>)}</ul><button onClick={() => openBooking(s.name)}>Elegir {s.name}<ArrowRight size={17}/></button></article>)}</div>
      </section>

      <section className="gallery-section" id="galeria"><div className="gallery-copy"><span className="kicker">RESULTADOS QUE HABLAN</span><h2>La diferencia está<br/><em>en los detalles.</em></h2><p>Desliza para descubrir acabados que transforman.</p></div><div className="gallery-grid">{gallery.map(g => <figure className={g.span || ''} key={g.url}><img src={g.url} alt={g.label}/><figcaption>{g.label}<span>Ver proyecto →</span></figcaption></figure>)}</div></section>

      <section className="section process" id="proceso"><div className="section-head"><div><span className="kicker">SIMPLE. TRANSPARENTE. EXCEPCIONAL.</span><h2>Tu auto en buenas manos,<br/><em>desde el primer clic.</em></h2></div></div><div className="steps">{[['01','Reserva en línea','Elige el servicio, día y hora que mejor te funcionen.'],['02','Evaluamos tu auto','Revisamos cada detalle y confirmamos el tratamiento ideal.'],['03','Creamos la magia','Nuestros especialistas trabajan con precisión y productos premium.'],['04','Vuelve a estrenar','Recibe tu vehículo impecable y disfruta el resultado.']].map(([n,t,d]) => <div className="step" key={n}><span>{n}</span><div className="step-icon">{n === '01' ? <CalendarDays/> : n === '04' ? <Car/> : <Sparkles/>}</div><h3>{t}</h3><p>{d}</p></div>)}</div></section>

      <section className="testimonial" id="opiniones"><div><div className="quote">“</div><div className="stars">★★★★★</div><blockquote>Mi auto no se veía así ni cuando salió de la agencia. La atención, el cuidado y el resultado superaron completamente mis expectativas.</blockquote><p><strong>CARLOS M.</strong><span>Cliente Signature · BMW Serie 3</span></p></div></section>

      <section className="cta-section"><div><span className="kicker">TU AUTO LO MERECE</span><h2>¿Listo para volver<br/>a <em>enamorarte de tu auto?</em></h2><p>Reserva hoy. Nosotros nos encargamos del resto.</p><button className="btn" onClick={() => openBooking()}>Reservar mi cita <ArrowRight size={18}/></button></div></section>
    </main>

    <footer><a className="brand" href="#inicio"><span className="brand-mark"><Sparkles size={18}/></span><span>ESTUDIO<span>AUTO</span></span></a><p>El nombre y los datos de contacto son editables cuando tu marca esté definida.</p><div className="socials"><a href="mailto:hola@estudioauto.com" aria-label="Correo"><Mail/></a><a href="https://instagram.com" aria-label="Instagram"><Instagram/></a><a href="https://wa.me/15555555555" aria-label="WhatsApp"><MessageCircle/></a></div><small>© 2026 Estudio Auto · Aviso de privacidad</small></footer>

    {bookingOpen && <div className="modal-backdrop" onMouseDown={() => setBookingOpen(false)}><section className="modal" onMouseDown={e => e.stopPropagation()} aria-modal="true" role="dialog"><button className="close" onClick={() => setBookingOpen(false)}><X/></button>{submitted ? <div className="success"><span><Check/></span><span className="kicker">SOLICITUD RECIBIDA</span><h2>¡Gracias, {form.name.split(' ')[0]}!</h2><p>Tu cita para <strong>{form.service}</strong> quedó registrada. Nos comunicaremos contigo para confirmarla.</p><button className="btn" onClick={() => { setBookingOpen(false); setForm(emptyForm) }}>Listo</button></div> : <><span className="kicker">RESERVA TU EXPERIENCIA</span><h2>Agenda tu cita</h2><p className="modal-intro">Déjanos tus datos y confirma el horario ideal. Te contactaremos a la brevedad.</p><form onSubmit={submit}><label>Nombre completo<input required value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder="Tu nombre"/></label><div className="form-row"><label>Teléfono<input required type="tel" value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} placeholder="(555) 000-0000"/></label><label>Correo<input required type="email" value={form.email} onChange={e => setForm({...form,email:e.target.value})} placeholder="tu@correo.com"/></label></div><label>Vehículo<input required value={form.vehicle} onChange={e => setForm({...form,vehicle:e.target.value})} placeholder="Marca, modelo y año"/></label><label>Servicio<select value={form.service} onChange={e => setForm({...form,service:e.target.value})}>{services.map(s => <option key={s.name}>{s.name}</option>)}</select></label><div className="form-row"><label>Fecha<input required type="date" min={minDate} value={form.date} onChange={e => setForm({...form,date:e.target.value})}/></label><label>Hora<select required value={form.time} onChange={e => setForm({...form,time:e.target.value})}><option value="">Selecciona</option><option>09:00</option><option>11:00</option><option>14:00</option><option>16:00</option></select></label></div><label>Notas (opcional)<textarea value={form.notes} onChange={e => setForm({...form,notes:e.target.value})} placeholder="Cuéntanos algo que debamos saber..."/></label><button className="btn full" type="submit">Solicitar reservación <ArrowRight size={18}/></button><small className="privacy"><ShieldCheck size={14}/> Tus datos están protegidos y solo se usarán para gestionar tu cita.</small></form></>}</section></div>}

    {adminOpen && <div className="modal-backdrop" onMouseDown={() => setAdminOpen(false)}><section className="modal admin-modal" onMouseDown={e => e.stopPropagation()}><button className="close" onClick={() => setAdminOpen(false)}><X/></button><span className="kicker">PANEL DE ADMINISTRACIÓN</span><h2>Reservaciones</h2><p className="modal-intro">Consulta las solicitudes y contacta a cada cliente.</p>{bookings.length === 0 ? <div className="empty"><CalendarDays/><h3>Aún no hay reservaciones</h3><p>Las nuevas solicitudes aparecerán aquí.</p></div> : <div className="booking-list">{bookings.map(b => <article className="booking-item" key={b.id}><div className="booking-top"><div><strong>{b.name}</strong><span>{b.vehicle}</span></div><select className={`status ${b.status.toLowerCase()}`} value={b.status} onChange={e => updateStatus(b.id,e.target.value)}><option>Pendiente</option><option>Confirmada</option><option>Completada</option></select></div><div className="booking-meta"><span><Sparkles/>{b.service}</span><span><CalendarDays/>{b.date}</span><span><Clock3/>{b.time}</span></div>{b.notes && <p className="notes">“{b.notes}”</p>}<div className="contact-actions"><a href={`https://wa.me/${b.phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola ${b.name}, te contactamos para confirmar tu cita de detallado.`)}`} target="_blank" rel="noreferrer"><MessageCircle/> WhatsApp</a><a href={`mailto:${b.email}?subject=Tu cita de detallado`}><Mail/> Correo</a></div></article>)}</div>}</section></div>}
  </>
}

export default App
