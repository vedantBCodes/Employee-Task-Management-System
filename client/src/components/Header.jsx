import Icon from './Icon'

export default function Header({ title, onMenuClick }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-button menu-button" type="button" onClick={onMenuClick} aria-label="Open navigation"><Icon name="menu" /></button>
        <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-divider">/</span><strong>{title}</strong></div>
      </div>
      <div className="topbar-actions">
        <div className="profile-button" aria-label="Workspace profile">
          <span className="profile-avatar">R</span><span className="profile-name">Roots Media</span>
        </div>
      </div>
    </header>
  )
}
