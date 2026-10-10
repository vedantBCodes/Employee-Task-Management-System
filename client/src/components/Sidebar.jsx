import { NavLink } from 'react-router-dom'
import Icon from './Icon'

const navigation = [
  { label: 'Dashboard', path: '/', icon: 'grid' },
  { label: 'Employees', path: '/employees', icon: 'users' },
  { label: 'Tasks', path: '/tasks', icon: 'check' },
]

export default function Sidebar({ open, onNavigate }) {
  return (
    <>
      {open && <button className="sidebar-scrim" aria-label="Close navigation" onClick={onNavigate} />}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <NavLink to="/" className="brand" onClick={onNavigate}>
          <span className="brand-mark">R</span>
          <span className="brand-copy"><strong>Roots Media</strong><small>People &amp; work</small></span>
        </NavLink>
        <div className="nav-section-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.path === '/'} onClick={onNavigate} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
              <Icon name={item.icon} /><span>{item.label}</span>{item.path !== '/' && <span className="nav-arrow">›</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-help-icon">?</div>
          <div><strong>Need a hand?</strong><span>Visit the help center</span></div>
          <Icon name="arrow" size={16} />
        </div>
      </aside>
    </>
  )
}
