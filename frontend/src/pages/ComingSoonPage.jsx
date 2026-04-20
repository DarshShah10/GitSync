import { Rocket, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import styles from './ComingSoonPage.module.css'

export default function ComingSoonPage() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <div className={styles.iconWrap}>
        <Rocket size={40} strokeWidth={1.5} />
      </div>
      <h2 className={styles.title}>Feature in Development</h2>
      <p className={styles.subtitle}>
        We're working hard to bring this feature to the Sovereign Cloud OS. 
        Stay tuned for upcoming updates!
      </p>
      <button className={styles.backBtn} onClick={() => navigate(-1)}>
        <ArrowLeft size={18} /> Go Back
      </button>
    </div>
  )
}
