import { useAuth } from '../context/AuthContext'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  const { user, logout } = useAuth()

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Temple Dashboard</h1>
        <div className={styles.userInfo}>
          <span className={styles.username}>{user?.username}</span>
          <span className={styles.role}>{user?.role}</span>
          <button onClick={logout} className={styles.logout}>
            Logout
          </button>
        </div>
      </header>
      <main className={styles.main}>
        <p className={styles.welcome}>Welcome, {user?.username}! 🙏</p>
        <p className={styles.hint}>Dashboard coming soon — Phase 2.</p>
      </main>
    </div>
  )
}
