import { useRef, useState } from 'react'
import { ShieldCheck, X } from './icons'

function CloseButton({ onClick }) {
  return <button className="close" aria-label="Cerrar" onClick={onClick}><X/></button>
}

const readMediaFile = file => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve({ name: file.name, type: file.type, data: String(reader.result) })
  reader.onerror = () => reject(new Error(`No pudimos leer ${file.name}.`))
  reader.readAsDataURL(file)
})

function ProjectManager({ setProjects }) {
  const [form, setForm] = useState({ title: '', description: '' })
  const [files, setFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const inputRef = useRef(null)

  const selectFiles = event => {
    const incoming = [...(event.target.files || [])]
    setError('')
    setFiles(current => {
      const known = new Set(current.map(file => `${file.name}-${file.size}-${file.lastModified}`))
      return [...current, ...incoming.filter(file => !known.has(`${file.name}-${file.size}-${file.lastModified}`))].slice(0, 6)
    })
    event.target.value = ''
  }

  const submit = async event => {
    event.preventDefault()
    setError(''); setNotice('')
    if (!files.length) return setError('Selecciona al menos una fotografía o video.')
    if (files.some(file => file.size > 15 * 1024 * 1024)) return setError('Cada archivo debe pesar menos de 15 MB.')
    if (files.reduce((total, file) => total + file.size, 0) > 20 * 1024 * 1024) return setError('La publicación completa no puede superar 20 MB.')
    setSaving(true)
    try {
      const media = await Promise.all(files.map(readMediaFile))
      const response = await fetch('/api/admin/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, media }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No pudimos publicar el proyecto.')
      setProjects(current => [result.project, ...current.filter(project => !String(project.id).startsWith('demo-'))])
      setForm({ title: '', description: '' }); setFiles([])
      setNotice('Proyecto publicado correctamente.')
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSaving(false)
    }
  }

  return <section className="project-manager">
    <div className="project-manager-heading"><div><span className="kicker">PORTAFOLIO</span><h3>Publicar proyecto</h3></div><span>FOTOS + VIDEOS</span></div>
    <p>Agrega trabajos reales al apartado “Resultados que hablan”. El nombre y la descripción se guardan en Firestore; los archivos, en Cloud Storage.</p>
    <form onSubmit={submit}>
      <label>Nombre del proyecto<input required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="Ej. Restauración Toyota Hilux"/></label>
      <label>Descripción del trabajo<textarea required value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Describe los tratamientos y el resultado..."/></label>
      <label className="project-file"><span>Elegir fotos o videos</span><small>Hasta 6 archivos JPG, PNG, WEBP, MP4, WEBM o MOV.</small><input ref={inputRef} aria-label="Fotos y videos del proyecto" type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" onChange={selectFiles}/></label>
      {files.length > 0 && <div className="project-file-list"><strong>{files.length} {files.length === 1 ? 'archivo seleccionado' : 'archivos seleccionados'}</strong>{files.map(file => <span key={`${file.name}-${file.size}-${file.lastModified}`}><span>{file.name}<small>{(file.size / 1024 / 1024).toFixed(1)} MB</small></span><button type="button" aria-label={`Quitar ${file.name}`} onClick={() => setFiles(current => current.filter(item => item !== file))}><X/></button></span>)}</div>}
      {notice && <p className="form-notice" role="status">{notice}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn" disabled={saving}>{saving ? 'Publicando…' : 'Publicar en resultados'}</button>
    </form>
  </section>
}

export function AdminLogin({ onClose, onSuccess }) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async event => {
    event.preventDefault(); setError(''); setSaving(true)
    try {
      const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No pudimos iniciar la sesión administrativa.')
      onSuccess(result)
    } catch (submitError) { setError(submitError.message) } finally { setSaving(false) }
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal admin-login" onMouseDown={event => event.stopPropagation()} role="dialog" aria-modal="true"><CloseButton onClick={onClose}/><span className="kicker">ACCESO PRIVADO</span><h2>Administración</h2><p className="modal-intro">Este acceso se utiliza únicamente para publicar trabajos del portafolio.</p><form onSubmit={submit}><label>Correo<input required type="email" autoComplete="username" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })}/></label><label>Contraseña<input required type="password" autoComplete="current-password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })}/></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="btn full" disabled={saving}>{saving ? 'Ingresando…' : 'Ingresar'}</button></form></section></div>
}

export function AdminPortal({ projects, setProjects, onClose }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal admin-modal portfolio-dashboard" onMouseDown={event => event.stopPropagation()} role="dialog" aria-modal="true"><CloseButton onClick={onClose}/><span className="kicker">PANEL DE ADMINISTRACIÓN</span><div className="portfolio-admin-title"><div><h2>Portafolio</h2><p>Publica fotografías y videos para mantener la página actualizada.</p></div><span role="img" aria-label="Servicios disponibles"><ShieldCheck/></span></div><ProjectManager setProjects={setProjects}/><div className="portfolio-admin-list"><h3>Proyectos visibles ({projects.filter(project => !String(project.id).startsWith('demo-')).length})</h3><p>Los trabajos publicados aparecen automáticamente en la sección pública.</p></div></section></div>
}
