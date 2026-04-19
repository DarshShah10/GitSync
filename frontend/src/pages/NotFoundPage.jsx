import { Link } from 'react-router-dom'
import styles from './NotFoundPage.module.css'

export default function NotFoundPage() {
  return (
    <div className={styles.page}>
      <span className={styles.code}>404</span>
      <h1 className={styles.title}>Page not found</h1>
      <p className={styles.sub}>The page you're looking for doesn't exist.</p>
      <Link to="/" className={styles.link}>← Back to Overview</Link>
    </div>
  )
}
