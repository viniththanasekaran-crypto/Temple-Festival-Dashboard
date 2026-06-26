import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  const { user } = useAuth()

  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        <p className={styles.welcome}>Welcome, {user?.username}!</p>
        <p className={styles.hint}>Dashboard coming soon — Phase 6.</p>
      </main>
    </div>
  )
}
