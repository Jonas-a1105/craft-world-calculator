import styles from './Skeleton.module.css';

// Base skeleton block
function SkeletonBase({ className }: { className: string }) {
  return <div className={`${styles.skeleton} ${className}`} />;
}

// Line (full width)
export function SkeletonLine({ width }: { width?: string }) {
  return (
    <div
      className={`${styles.skeleton} ${styles.line}`}
      style={width ? { width } : undefined}
    />
  );
}

// Short line
export function SkeletonLineShort() {
  return <div className={`${styles.skeleton} ${styles.line} ${styles.lineShort}`} />;
}

// Avatar circle
export function SkeletonAvatar() {
  return <div className={`${styles.skeleton} ${styles.avatar}`} />;
}

// Card skeleton with title and lines
export function SkeletonCard({ lines = 4 }: { lines?: number }) {
  return (
    <div className={styles.card}>
      <div className={`${styles.skeleton} ${styles.cardTitle}`} />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={styles.row}>
          <div className={`${styles.skeleton} ${styles.cell} ${styles.cellWide}`} />
          <div className={`${styles.skeleton} ${styles.cell} ${i === 0 ? styles.cellNarrow : ''}`} />
        </div>
      ))}
    </div>
  );
}

// Table skeleton
export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className={`${styles.skeleton} ${styles.tableSkeleton}`}>
      <div className={styles.tableHeader}>
        {Array.from({ length: cols }).map((_, i) => (
          <div
            key={i}
            className={`${styles.skeleton} ${styles.tableCell} ${i === 0 ? styles.tableCellWide : i === cols - 1 ? styles.tableCellNarrow : ''}`}
          />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className={styles.tableRow}>
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className={`${styles.skeleton} ${styles.tableCell} ${c === 0 ? styles.tableCellWide : c === cols - 1 ? styles.tableCellNarrow : ''}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// Block (custom height)
export function SkeletonBlock({ height = 120 }: { height?: number }) {
  return (
    <div
      className={`${styles.skeleton} ${styles.block}`}
      style={{ height }}
    />
  );
}

// Stat card skeleton (used in dashboards)
export function SkeletonStatCard() {
  return (
    <div className={styles.statCard}>
      <div className={`${styles.skeleton} ${styles.statLabel}`} />
      <div className={`${styles.skeleton} ${styles.statValue}`} />
    </div>
  );
}

// Stat grid skeleton (4 stats)
export function SkeletonStatGrid() {
  return (
    <div className={styles.statGrid}>
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonStatCard key={i} />
      ))}
    </div>
  );
}

// Full dashboard page skeleton (2-column bento grid)
export function SkeletonDashboardPage() {
  return (
    <div className={styles.dashboardFull}>
      <SkeletonStatGrid />
      <div className={styles.dashboardGrid}>
        <SkeletonCard lines={5} />
        <SkeletonCard lines={4} />
        <SkeletonTable rows={4} cols={5} />
        <SkeletonCard lines={3} />
      </div>
    </div>
  );
}

// Single column page skeleton (for forms, calculators, etc.)
export function SkeletonSingleColumn() {
  return (
    <div className={styles.dashboardFull}>
      <SkeletonCard lines={3} />
      <SkeletonCard lines={6} />
      <SkeletonTable rows={3} cols={4} />
    </div>
  );
}

// Two cards side by side
export function SkeletonTwoCards() {
  return (
    <div className={styles.dashboardGrid}>
      <SkeletonCard lines={5} />
      <SkeletonCard lines={4} />
    </div>
  );
}
