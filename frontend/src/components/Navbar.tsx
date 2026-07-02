import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './Navbar.module.css'

const LINKS = {
  super_admin: [
    { to: '/temples', label: 'Temples' },
    { to: '/users', label: 'Users' },
  ],
  admin: [
    { to: '/', label: 'Dashboard' },
    { to: '/festivals', label: 'Festivals' },
    { to: '/families', label: 'Families' },
    { to: '/reports', label: 'Reports' },
    { to: '/reminders', label: 'Reminders' },
  ],
  viewer: [
    { to: '/', label: 'Dashboard' },
    { to: '/my-family', label: 'My Family' },
  ],
}

export default function Navbar() {
  const { user, logout, activeTempleId, setActiveTempleId } = useAuth()
  if (!user) return null

  const links = LINKS[user.role] ?? []

  return (
    <nav className={styles.nav}>
      <span className={styles.brand}>Temple Dashboard</span>
      <div className={styles.links}>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
          >
            {l.label}
          </NavLink>
        ))}
      </div>
      <div className={styles.right}>
        {user.temples.length === 1 && (
          <span className={styles.templeBadge}>{user.temples[0].name}</span>
        )}
        {user.temples.length > 1 && (
          <select
            className={styles.templeSelect}
            value={activeTempleId ?? ''}
            onChange={(e) => setActiveTempleId(Number(e.target.value))}
            aria-label="Active temple"
          >
            {user.temples.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        <span className={styles.username}>{user.username}</span>
        <span className={styles.role}>{user.role.replace('_', ' ')}</span>
        <button onClick={logout} className={styles.logout}>
          Logout
        </button>
      </div>
    </nav>
  )
}
