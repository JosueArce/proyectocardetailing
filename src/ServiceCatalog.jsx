import catalog from './serviceCatalogData'
import { Car, Check, Droplets, Headlight, PaintShield, Polisher, Seat, ShieldCheck, Sparkles, Spray, Wheel, Window } from './icons'

const iconComponents = {
  'car-wash-foam': Droplets,
  'car-wash': Droplets,
  wheel: Wheel,
  'car-seat': Seat,
  vacuum: Spray,
  'car-window': Window,
  'tire-shine': Sparkles,
  'interior-trim': Seat,
  engine: Car,
  'wheel-arch': Wheel,
  checklist: Check,
  car: Car,
  decontamination: Spray,
  windshield: Window,
  'water-shield': ShieldCheck,
  shield: ShieldCheck,
  polisher: Polisher,
  'ceramic-coating': PaintShield,
  'water-repellent': Droplets,
  headlight: Headlight,
  'diamond-shine': Sparkles,
  'paint-gun': Spray,
  'car-seat-clean': Seat,
  'steam-cleaner': Spray,
}

export function ServiceIcon({ name }) {
  const Icon = iconComponents[name] || Sparkles
  return <Icon/>
}

export function ServiceCard({ service, onReserve, onToggle, selected }) {
  return <article className={`catalog-card ${service.featured ? 'featured-package' : ''}`}>
    <header><span>{service.category}</span><h3>{service.name}</h3>{catalog.website.servicesSection.showDescriptions && <p>{service.shortDescription}</p>}</header>
    <div className="included-heading"><span>Incluye</span><i/></div>
    <ul className="catalog-includes">{service.includedServices.map(item => <li key={item.id}><span className="included-icon"><ServiceIcon name={item.icon}/></span>{item.name}</li>)}</ul>
    {catalog.website.servicesSection.showRecommendedText && <p className="recommended-copy">{service.recommendedFor}</p>}
    <div className="catalog-actions"><button className="outline-btn" onClick={() => onToggle(service.name)}>{selected ? 'Quitar de selección' : 'Agregar a mi selección'}</button><button className="btn" onClick={() => onReserve(service.name)}>{catalog.website.cta.buttonText}</button></div>
  </article>
}

export function AddOn({ addon, selected, onToggle }) {
  return <article className={`addon-card ${selected ? 'selected' : ''}`}><span className="addon-icon"><ServiceIcon name={addon.icon}/></span><div><h3>{addon.name}</h3></div><button onClick={() => onToggle(addon.name)}>{selected ? <><Check/> Agregado</> : <><Sparkles/> Agregar</>}</button></article>
}
