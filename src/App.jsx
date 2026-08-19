import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, Car, Check, ChevronRight, Droplets, Instagram, Mail, Menu, MessageCircle, ShieldCheck, Sparkles, X } from './icons'
import { AccessModal, AdminLogin, AdminPortal, CustomerPortal } from './PortalPanels'

const services = [
  { icon: Droplets, name: 'Esencial', price: '₡25.000', cost: 25000, time: '60–90 min', desc: 'El cuidado preciso para mantener tu auto impecable.', features: ['Lavado exterior premium', 'Aspirado interior', 'Limpieza de cristales', 'Brillo de neumáticos'] },
  { icon: Sparkles, name: 'Signature', price: '₡60.000', cost: 60000, time: '2–3 horas', popular: true, desc: 'Una renovación completa, por dentro y por fuera.', features: ['Todo lo del plan Esencial', 'Descontaminado de pintura', 'Limpieza profunda interior', 'Cera premium de 3 meses'] },
  { icon: ShieldCheck, name: 'Ceramic Pro', price: '₡150.000', cost: 150000, time: '5–6 horas', desc: 'Protección de alto desempeño y brillo extraordinario.', features: ['Corrección ligera de pintura', 'Recubrimiento cerámico', 'Protección UV e hidrofóbica', 'Garantía de 12 meses'] },
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
  const [adminLoginOpen, setAdminLoginOpen] = useState(false)
  const [accessOpen, setAccessOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [bookingError, setBookingError] = useState('')
  const [bookingSaving, setBookingSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [bookings, setBookings] = useState(() => JSON.parse(localStorage.getItem('detail-bookings') || '[]'))
  const [accounts, setAccounts] = useState(() => JSON.parse(localStorage.getItem('detail-accounts') || '[]'))
  const [currentAccount, setCurrentAccount] = useState(() => JSON.parse(localStorage.getItem('detail-session') || 'null'))
  const [blockedDates, setBlockedDates] = useState(() => JSON.parse(localStorage.getItem('detail-blocked-dates') || '[]'))
  const [expenses, setExpenses] = useState(() => JSON.parse(localStorage.getItem('detail-expenses') || '[]'))
  const minDate = useMemo(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10), [])

  useEffect(() => { localStorage.setItem('detail-bookings', JSON.stringify(bookings)) }, [bookings])
  useEffect(() => { localStorage.setItem('detail-accounts', JSON.stringify(accounts)) }, [accounts])
  useEffect(() => { localStorage.setItem('detail-session', JSON.stringify(currentAccount)) }, [currentAccount])
  useEffect(() => { localStorage.setItem('detail-blocked-dates', JSON.stringify(blockedDates)) }, [blockedDates])
  useEffect(() => { localStorage.setItem('detail-expenses', JSON.stringify(expenses)) }, [expenses])
  useEffect(() => { document.body.style.overflow = bookingOpen || adminOpen || accessOpen || adminLoginOpen ? 'hidden' : ''; return () => { document.body.style.overflow = '' } }, [bookingOpen, adminOpen, accessOpen, adminLoginOpen])

  const openBooking = (service) => { setForm(f => ({ ...f, service: service || f.service, name: currentAccount?.name || f.name, email: currentAccount?.email || f.email, phone: currentAccount?.phone || f.phone })); setSubmitted(false); setBookingError(''); setBookingOpen(true); setMenu(false) }
  const submit = async (e) => {
    e.preventDefault()
    const cost = services.find(s => s.name === form.service)?.cost || 0
    setBookingSaving(true); setBookingError('')
    try {
      const response = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, cost }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No fue posible confirmar la cita.')
      setBookings(prev => [{ ...form, cost, calendarEventId: result.eventId, id: Date.now(), status: 'Pendiente', createdAt: new Date().toISOString() }, ...prev])
      setSubmitted(true)
    } catch (error) { setBookingError(error.message) } finally { setBookingSaving(false) }
  }
  const saveAccount = account => { setAccounts(list => [...list, account]); setCurrentAccount(account); setAccessOpen(false) }
  const addCar = car => { const updated = {...currentAccount,cars:[...currentAccount.cars,car]}; setCurrentAccount(updated); setAccounts(list => list.map(a => a.id === updated.id ? updated : a)) }

  return <>
    <header className="header">
      <a className="brand" href="#inicio" aria-label="Inicio"><span className="brand-mark"><Sparkles size={18}/></span><span>ESTUDIO<span>AUTO</span></span></a>
      <nav className={menu ? 'nav open' : 'nav'} aria-label="Navegación principal">
        <a href="#servicios" onClick={() => setMenu(false)}>Servicios</a><a href="#galeria" onClick={() => setMenu(false)}>Resultados</a><a href="#proceso" onClick={() => setMenu(false)}>Proceso</a><a href="#opiniones" onClick={() => setMenu(false)}>Opiniones</a>
        <button className="admin-link" onClick={() => { setAdminLoginOpen(true); setMenu(false) }}>Administrar</button>
        <button className="admin-link account-link" onClick={() => { setAccessOpen(true); setMenu(false) }}>{currentAccount ? `Hola, ${currentAccount.name.split(' ')[0]}` : 'Mi cuenta'}</button>
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

      <section className="section products" id="productos"><div className="section-head"><div><span className="kicker">PRODUCTOS PROFESIONALES</span><h2>Resultados respaldados por<br/><em>marcas líderes.</em></h2></div><p>Seleccionamos químicos, pulimentos y protecciones profesionales según la superficie y condición de cada vehículo.</p></div><div className="product-grid">{[['CARPRO','Cerámicos y descontaminación'],["MEGUIAR'S",'Pulimentos y acabado'],['KOCH-CHEMIE','Limpieza especializada'],['VONIXX','Protección y brillo']].map(([brand,desc]) => <article key={brand}><span>PRO SERIES</span><h3>{brand}</h3><p>{desc}</p><ShieldCheck/></article>)}</div></section>

      <section className="gallery-section" id="galeria"><div className="gallery-copy"><span className="kicker">RESULTADOS QUE HABLAN</span><h2>La diferencia está<br/><em>en los detalles.</em></h2><p>Desliza para descubrir acabados que transforman.</p></div><div className="gallery-grid">{gallery.map(g => <figure className={g.span || ''} key={g.url}><img src={g.url} alt={g.label}/><figcaption>{g.label}<span>Ver proyecto →</span></figcaption></figure>)}</div></section>

      <section className="section process" id="proceso"><div className="section-head"><div><span className="kicker">SIMPLE. TRANSPARENTE. EXCEPCIONAL.</span><h2>Tu auto en buenas manos,<br/><em>desde el primer clic.</em></h2></div></div><div className="steps">{[['01','Reserva en línea','Elige el servicio, día y hora que mejor te funcionen.'],['02','Evaluamos tu auto','Revisamos cada detalle y confirmamos el tratamiento ideal.'],['03','Creamos la magia','Nuestros especialistas trabajan con precisión y productos premium.'],['04','Vuelve a estrenar','Recibe tu vehículo impecable y disfruta el resultado.']].map(([n,t,d]) => <div className="step" key={n}><span>{n}</span><div className="step-icon">{n === '01' ? <CalendarDays/> : n === '04' ? <Car/> : <Sparkles/>}</div><h3>{t}</h3><p>{d}</p></div>)}</div></section>

      <section className="testimonial" id="opiniones"><div><div className="quote">“</div><div className="stars">★★★★★</div><blockquote>Mi auto no se veía así ni cuando salió de la agencia. La atención, el cuidado y el resultado superaron completamente mis expectativas.</blockquote><p><strong>CARLOS M.</strong><span>Cliente Signature · BMW Serie 3</span></p></div></section>

      <section className="section owner-section"><div className="owner-card"><span className="kicker">HECHO EN COSTA RICA</span><h2>Pasión por cada detalle.</h2><p>Soy <strong>Josue Arce</strong>, tengo 29 años y creé este estudio para ofrecer en Costa Rica un cuidado automotriz honesto, preciso y de nivel profesional.</p><span className="owner-signature">Josue Arce · Fundador</span></div></section>

      <section className="cta-section"><div><span className="kicker">TU AUTO LO MERECE</span><h2>¿Listo para volver<br/>a <em>enamorarte de tu auto?</em></h2><p>Reserva hoy. Nosotros nos encargamos del resto.</p><button className="btn" onClick={() => openBooking()}>Reservar mi cita <ArrowRight size={18}/></button></div></section>
    </main>

    <footer><a className="brand" href="#inicio"><span className="brand-mark"><Sparkles size={18}/></span><span>ESTUDIO<span>AUTO</span></span></a><p>Un proyecto costarricense de Josue Arce. El nombre comercial y los datos de contacto pueden actualizarse cuando la marca esté definida.</p><div className="socials"><a href="mailto:hola@estudioauto.com" aria-label="Correo"><Mail/></a><a href="https://instagram.com" aria-label="Instagram"><Instagram/></a><a href="https://wa.me/50600000000" aria-label="WhatsApp"><MessageCircle/></a></div><small>© 2026 Estudio Auto · Costa Rica · Aviso de privacidad</small></footer>

    {bookingOpen && <div className="modal-backdrop" onMouseDown={() => setBookingOpen(false)}><section className="modal" onMouseDown={e => e.stopPropagation()} aria-modal="true" role="dialog"><button className="close" aria-label="Cerrar" onClick={() => setBookingOpen(false)}><X/></button>{submitted ? <div className="success"><span><Check/></span><span className="kicker">CITA REGISTRADA</span><h2>¡Gracias, {form.name.split(' ')[0]}!</h2><p>Tu cita para <strong>{form.service}</strong> fue agregada al calendario. Josue recibió los datos para confirmarla.</p><button className="btn" onClick={() => { setBookingOpen(false); setForm(emptyForm) }}>Listo</button></div> : <><span className="kicker">RESERVA TU EXPERIENCIA</span><h2>Agenda tu cita</h2><p className="modal-intro">No necesitas una cuenta para reservar. Elige el horario ideal y te contactaremos.</p><form onSubmit={submit}><label>Nombre completo<input required value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder="Tu nombre"/></label><div className="form-row"><label>Teléfono<input required type="tel" value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} placeholder="+506 8888-8888"/></label><label>Correo<input required type="email" value={form.email} onChange={e => setForm({...form,email:e.target.value})} placeholder="tu@correo.com"/></label></div><label>Vehículo{currentAccount?.cars?.length ? <select required value={form.vehicle} onChange={e => setForm({...form,vehicle:e.target.value})}><option value="">Selecciona un vehículo</option>{currentAccount.cars.map(c => <option key={c.id}>{c.make} {c.model} {c.year}</option>)}</select> : <input required value={form.vehicle} onChange={e => setForm({...form,vehicle:e.target.value})} placeholder="Marca, modelo y año"/>}</label><label>Servicio<select value={form.service} onChange={e => setForm({...form,service:e.target.value})}>{services.map(s => <option key={s.name} value={s.name}>{s.name} · {s.price}</option>)}</select></label><div className="form-row"><label>Fecha<input required type="date" min={minDate} value={form.date} onChange={e => setForm({...form,date:e.target.value})}/>{blockedDates.includes(form.date) && <span className="field-error">Esta fecha no está disponible.</span>}</label><label>Hora<select required value={form.time} onChange={e => setForm({...form,time:e.target.value})}><option value="">Selecciona</option><option>09:00</option><option>11:00</option><option>14:00</option><option>16:00</option></select></label></div><label>Notas (opcional)<textarea value={form.notes} onChange={e => setForm({...form,notes:e.target.value})} placeholder="Cuéntanos algo que debamos saber..."/></label>{bookingError && <p className="form-error" role="alert">{bookingError}</p>}<button disabled={bookingSaving || blockedDates.includes(form.date)} className="btn full" type="submit">{bookingSaving ? 'Confirmando en Calendar…' : <>Solicitar reservación <ArrowRight size={18}/></>}</button><small className="privacy"><ShieldCheck size={14}/> La cita se registrará en el calendario del negocio.</small></form></>}</section></div>}

    {accessOpen && !currentAccount && <AccessModal accounts={accounts} onClose={() => setAccessOpen(false)} onLogin={a => { setCurrentAccount(a); setAccessOpen(false) }} onRegister={saveAccount}/>}
    {currentAccount && accessOpen && <CustomerPortal account={currentAccount} bookings={bookings} onAddCar={addCar} onLogout={() => { setCurrentAccount(null); setAccessOpen(false) }} onClose={() => setAccessOpen(false)}/>}
    {adminLoginOpen && <AdminLogin onClose={() => setAdminLoginOpen(false)} onSuccess={() => { setAdminLoginOpen(false); setAdminOpen(true) }}/>}
    {adminOpen && <AdminPortal bookings={bookings} setBookings={setBookings} blockedDates={blockedDates} setBlockedDates={setBlockedDates} expenses={expenses} setExpenses={setExpenses} onClose={() => setAdminOpen(false)}/>}
  </>
}

export default App
