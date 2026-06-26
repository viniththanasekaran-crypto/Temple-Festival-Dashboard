import Navbar from '../components/Navbar'
import styles from './Dashboard.module.css'

export default function Temples() {
  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        <p className={styles.welcome}>Temples</p>
        <p className={styles.hint}>Temple management coming soon — Phase 2.</p>
      </main>
    </div>
  )
}
