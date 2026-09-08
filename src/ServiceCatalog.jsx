import catalog from './serviceCatalogData'
import { Car, Droplets, Headlight, PaintShield, Polisher, Seat, ShieldCheck, Sparkles, Spray, Wheel, Window } from './icons'

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

export function ServiceCard({ service, contactHref }) {
  return <article className={`catalog-card ${service.featured ? 'featured-package' : ''}`}>
    <header><span>{service.category}</span><h3>{service.name}</h3>{catalog.website.servicesSection.showDescriptions && <p>{service.shortDescription}</p>}</header>
    <div className="included-heading"><span>Incluye</span><i/></div>
    <ul className="catalog-includes">{service.includedServices.map(item => <li key={item.id}><span className="included-icon"><ServiceIcon name={item.icon}/></span>{item.name}</li>)}</ul>
    {catalog.website.servicesSection.showRecommendedText && <p className="recommended-copy">{service.recommendedFor}</p>}
    <a className="btn catalog-contact" href={contactHref} target="_blank" rel="noreferrer">Consultar por WhatsApp</a>
  </article>
}

export function AddOn({ addon, contactHref }) {
  return <article className="addon-card"><span className="addon-icon"><ServiceIcon name={addon.icon}/></span><div><h3>{addon.name}</h3></div><a href={contactHref} target="_blank" rel="noreferrer" aria-label={`Consultar por ${addon.name} en WhatsApp`}>Consultar</a></article>
}
