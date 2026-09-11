import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

const googleReviews = { rating: 5, total: 2, googleMapsUrl: 'https://maps.google.com/?cid=autoestudiocr', reviews: [{ id: 'review-1', author: 'María', rating: 5, text: 'Excelente trabajo y atención.', relativeTime: 'Hace una semana' }] }

const apiMock = async (url, options = {}) => {
  if (url === '/api/projects') return { ok: true, json: async () => ({ projects: [] }) }
  if (url === '/api/reviews') return { ok: true, json: async () => googleReviews }
  if (url === '/api/admin/login') return { ok: true, json: async () => ({ ok: true }) }
  if (url === '/api/admin/projects') {
    const body = JSON.parse(options.body)
    return { ok: true, json: async () => ({ project: { id: 'project-1', title: body.title, description: body.description, media: body.media.map((item, index) => ({ type: item.type.startsWith('video/') ? 'video' : 'image', url: `/api/projects/project-1/media/${index}` })) } }) }
  }
  return { ok: false, json: async () => ({ error: 'Ruta no disponible' }) }
}

beforeEach(() => vi.stubGlobal('fetch', vi.fn(apiMock)))
afterEach(() => vi.unstubAllGlobals())

describe('sitio informativo de AutoEstudioCR', () => {
  it('muestra el catálogo sin precios, cuentas, carrito ni reservas', async () => {
    const { container } = render(<App />)
    expect(screen.getByRole('heading', { name: 'Lavado Básico' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Detallado Premium' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cerámico Gold · 3 Años' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Restauración de focos con pulido' })).toBeInTheDocument()
    expect(container.querySelector('header.header .brand-logo img')).toHaveAttribute('src', '/autoestudiocr-header-logo.svg')
    expect(document.body).not.toHaveTextContent(/₡[0-9]/)
    expect(screen.queryByRole('button', { name: /reservar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /mi cuenta/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /carrito/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/sinpe móvil/i)).not.toBeInTheDocument()
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/projects'))
    expect(fetch).not.toHaveBeenCalledWith('/api/auth/me')
  })

  it('dirige todos los paquetes y adicionales a WhatsApp', () => {
    render(<App />)
    const packageCard = screen.getByRole('heading', { name: 'Lavado Básico' }).closest('article')
    expect(within(packageCard).getByRole('link', { name: /consultar por whatsapp/i })).toHaveAttribute('href', expect.stringContaining('wa.me/50683629162'))
    expect(within(packageCard).getByRole('link', { name: /consultar por whatsapp/i })).toHaveAttribute('href', expect.stringContaining('Lavado%20B%C3%A1sico'))
    expect(screen.getByRole('link', { name: /consultar por restauración de focos/i })).toHaveAttribute('href', expect.stringContaining('wa.me/50683629162'))
    expect(screen.getByRole('link', { name: 'Contactar a AutoEstudioCR por WhatsApp' })).toHaveAttribute('href', expect.stringContaining('wa.me/50683629162'))
  })

  it('muestra opiniones reales recibidas desde Google Places', async () => {
    render(<App />)
    expect(await screen.findByText('2', { selector: '.trust-row strong' })).toBeInTheDocument()
    expect(screen.getByText(/Excelente trabajo y atención/)).toBeInTheDocument()
    expect(screen.getByText('María')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ver todas en google/i })).toHaveAttribute('href', googleReviews.googleMapsUrl)
  })

  it('mantiene el acceso administrativo solo para publicar proyectos', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Administrar' }))
    const login = screen.getByRole('dialog')
    expect(within(login).getByText(/únicamente para publicar trabajos/i)).toBeInTheDocument()
    await user.type(within(login).getByLabelText('Correo'), 'josue.arce.gonzalez@gmail.com')
    await user.type(within(login).getByLabelText('Contraseña'), 'Admin123!')
    await user.click(within(login).getByRole('button', { name: 'Ingresar' }))
    expect(await screen.findByRole('heading', { name: 'Publicar proyecto' })).toBeInTheDocument()
    expect(screen.queryByText(/citas del mes/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/promociones/i)).not.toBeInTheDocument()
  })

  it('publica varias fotografías o videos desde el panel', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Administrar' }))
    let dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('Correo'), 'josue.arce.gonzalez@gmail.com')
    await user.type(within(dialog).getByLabelText('Contraseña'), 'Admin123!')
    await user.click(within(dialog).getByRole('button', { name: 'Ingresar' }))
    dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText(/nombre del proyecto/i), 'Toyota renovado')
    await user.type(within(dialog).getByLabelText(/descripción del trabajo/i), 'Limpieza profunda y protección.')
    await user.upload(within(dialog).getByLabelText(/fotos y videos/i), [new File(['foto'], 'final.jpg', { type: 'image/jpeg' }), new File(['video'], 'proceso.mp4', { type: 'video/mp4' })])
    expect(await within(dialog).findByText('2 archivos seleccionados')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /publicar en resultados/i }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/admin/projects', expect.objectContaining({ method: 'POST' })))
    expect(screen.getByRole('heading', { name: 'Toyota renovado' })).toBeInTheDocument()
  })
})
