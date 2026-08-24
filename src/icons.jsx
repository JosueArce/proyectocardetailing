const icon = (children) => function Icon({ size = 24, ...props }) {
  return <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" {...props}>{children}</svg>
}

export const ArrowRight = icon(<><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>)
export const ChevronRight = icon(<path d="m9 18 6-6-6-6"/>)
export const Check = icon(<path d="m5 12 4 4L19 6"/>)
export const X = icon(<><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>)
export const Menu = icon(<><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></>)
export const Sparkles = icon(<><path d="m12 3-1.3 3.7L7 8l3.7 1.3L12 13l1.3-3.7L17 8l-3.7-1.3L12 3Z"/><path d="m5 14-.8 2.2L2 17l2.2.8L5 20l.8-2.2L8 17l-2.2-.8L5 14Z"/><path d="m19 14-.6 1.4L17 16l1.4.6L19 18l.6-1.4L21 16l-1.4-.6L19 14Z"/></>)
export const Droplets = icon(<><path d="M7 16.5A3.5 3.5 0 0 1 3.5 13C3.5 10.5 7 6 7 6s3.5 4.5 3.5 7A3.5 3.5 0 0 1 7 16.5Z"/><path d="M16.5 20a4 4 0 0 1-4-4c0-2.8 4-8 4-8s4 5.2 4 8a4 4 0 0 1-4 4Z"/></>)
export const ShieldCheck = icon(<><path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>)

export const Seat = icon(<><path d="M7 4v8a3 3 0 0 0 3 3h7"/><path d="M6 20v-3h12v3M8 4a2 2 0 1 0-4 0v7a6 6 0 0 0 6 6"/></>)
export const Wheel = icon(<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="m12 9 2-5M9.5 13.5 5 17M14.5 13.5 19 17"/></>)
export const PaintShield = icon(<><path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z"/><path d="M8 14c2-4 6-4 8-8M9 9h.01M15 14h.01"/></>)
export const Window = icon(<><path d="M5 19 8 5h8l3 14Z"/><path d="M7 15h10M10 8h4"/></>)
export const Headlight = icon(<><path d="M14 7c-5 0-8 2-8 5s3 5 8 5c2 0 4-2 4-5s-2-5-4-5Z"/><path d="M3 8 1 6M3 12H1M3 16l-2 2"/></>)
export const Polisher = icon(<><rect x="4" y="8" width="14" height="7" rx="2"/><path d="M9 8V5h6v3M18 10h3v3h-3M7 15v3h8v-3"/></>)
export const Spray = icon(<><path d="M9 7h7l2 3v10H6V10l3-3Z"/><path d="M11 7V4h5M16 4l3 1M9 12h6"/></>)

export const CalendarDays = icon(<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></>)
export const Car = icon(<><path d="m5 17-2-2V9l2-5h14l2 5v6l-2 2H5Z"/><path d="M3 10h18M7 14h.01M17 14h.01M5 17v3M19 17v3"/></>)
export const Clock3 = icon(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5h4"/></>)
export const Mail = icon(<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>)
export const MessageCircle = icon(<><path d="M21 11.5a8.5 8.5 0 0 1-9 8.5 9 9 0 0 1-4-.9L3 21l1.9-4.6A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></>)
export const Instagram = icon(<><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/></>)
