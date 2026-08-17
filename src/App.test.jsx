import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

describe('sitio de detallado automotriz', () => {
  it('presenta los servicios y sus precios', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Esencial' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Signature' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ceramic Pro' })).toBeInTheDocument()
    expect(screen.getByText('$119')).toBeInTheDocument()
  })

  it('registra una cita y permite gestionarla desde el panel', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getAllByRole('button', { name: /reservar mi cita/i })[0])
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText(/nombre completo/i), 'Sofía Méndez')
    await user.type(within(dialog).getByLabelText(/teléfono/i), '5551234567')
    await user.type(within(dialog).getByLabelText(/correo/i), 'sofia@example.com')
    await user.type(within(dialog).getByLabelText(/vehículo/i), 'Mazda 3 2024')
    await user.type(within(dialog).getByLabelText(/fecha/i), '2030-05-20')
    await user.selectOptions(within(dialog).getByLabelText(/hora/i), '11:00')
    await user.click(within(dialog).getByRole('button', { name: /solicitar reservación/i }))

    expect(within(dialog).getByRole('heading', { name: /gracias, sofía/i })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('detail-bookings'))).toHaveLength(1)

    await user.click(within(dialog).getByRole('button', { name: 'Listo' }))
    await user.click(screen.getByRole('button', { name: 'Administrar' }))
    const admin = screen.getByText('PANEL DE ADMINISTRACIÓN').closest('section')
    expect(within(admin).getByText('Sofía Méndez')).toBeInTheDocument()
    expect(within(admin).getByText('Mazda 3 2024')).toBeInTheDocument()
    expect(within(admin).getByRole('link', { name: /whatsapp/i })).toHaveAttribute('href', expect.stringContaining('5551234567'))
  })

  it('muestra el estado vacío del panel cuando no hay citas', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Administrar' }))
    expect(screen.getByRole('heading', { name: 'Aún no hay reservaciones' })).toBeInTheDocument()
  })
})
