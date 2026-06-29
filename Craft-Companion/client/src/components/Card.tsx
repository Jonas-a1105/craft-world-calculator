import { useTranslation } from '../utils/i18n';
import styles from './Card.module.css';

export default function Card({ title, children }: { title?: string; children: any }) {
  const { t } = useTranslation();
  return (
    <div className={styles.bentoCard}>
      {title && <h3 className={styles.cardTitle}>{t(title)}</h3>}
      {children}
    </div>
  );
}
