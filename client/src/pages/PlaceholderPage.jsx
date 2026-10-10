import { NavLink } from 'react-router-dom'
import Icon from '../components/Icon'

export default function PlaceholderPage({ title, description }) {
  return (
    <div className="page-content placeholder-page">
      <div className="eyebrow">WORKSPACE</div>
      <h1>{title}</h1>
      <p>{description}</p>
      <div className="placeholder-card"><span className="empty-icon"><Icon name={title === 'Employees' ? 'users' : 'check'} size={22} /></span><strong>{title} workspace</strong><p>This section is ready for the next implementation step.</p><NavLink to="/" className="text-link">Back to dashboard <span>→</span></NavLink></div>
    </div>
  )
}
