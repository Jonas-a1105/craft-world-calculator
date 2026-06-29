import React, { useMemo, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { logout } from '../services/api';
import styles from './Layout.module.css';
import { useTranslation } from '../utils/i18n';

function translateNode(node: any, t: any): any {
  if (node === null || node === undefined) return node;

  if (typeof node === 'string') {
    const trimmed = node.trim();
    if (!trimmed) return node;
    const translated = t(trimmed);
    return node.replace(trimmed, translated);
  }

  if (typeof node !== 'object') {
    return node;
  }

  if (Array.isArray(node)) {
    return node.map((child) => translateNode(child, t));
  }

  if (React.isValidElement(node)) {
    const element = node as React.ReactElement<any>;
    const type = element.type;

    if (type === 'script' || type === 'style' || type === 'textarea' || type === 'select') {
      return element;
    }

    let newProps = { ...element.props };
    let changed = false;

    if (element.props.placeholder && typeof element.props.placeholder === 'string') {
      const translatedPlaceholder = t(element.props.placeholder);
      if (translatedPlaceholder !== element.props.placeholder) {
        newProps.placeholder = translatedPlaceholder;
        changed = true;
      }
    }

    if (element.props.children) {
      const translatedChildren = translateNode(element.props.children, t);
      if (translatedChildren !== element.props.children) {
        newProps.children = translatedChildren;
        changed = true;
      }
    }

    if (changed) {
      return React.cloneElement(element, newProps);
    }
  }

  return node;
}

export default function Layout({ children }: { children: any }) {
  const location = useLocation();
  const { t } = useTranslation();

  const translatedChildren = useMemo(() => {
    return translateNode(children, t);
  }, [children, t]);

  const isTabActive = (path: string) => {
    return location.pathname === path;
  };

  const navLinks = [
    { path: '/home', label: t('nav.home') },
    { path: '/empire-dashboard', label: t('nav.empire') },
    { path: '/resource-planner', label: t('nav.planner') },
    { path: '/profitability', label: t('nav.profitability') },
    { path: '/calculator', label: t('nav.calculator') },
    { path: '/inventory-value', label: t('nav.inventoryValue') },
    { path: '/upgrade-advisor', label: t('nav.upgradeAdvisor') },
    { path: '/compare', label: t('nav.compare') },
    { path: '/timers', label: t('nav.timers') },
    { path: '/matrix', label: t('nav.matrix') },
    { path: '/settings', label: t('nav.settings') },
  ];

  const navRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!navRef.current) return;
    const current = navRef.current;
    current.setAttribute('data-down', 'true');
    current.setAttribute('data-start-x', String(e.pageX - current.offsetLeft));
    current.setAttribute('data-scroll-left', String(current.scrollLeft));
  };

  const handleMouseLeave = () => {
    if (!navRef.current) return;
    navRef.current.setAttribute('data-down', 'false');
  };

  const handleMouseUp = () => {
    if (!navRef.current) return;
    navRef.current.setAttribute('data-down', 'false');
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!navRef.current || navRef.current.getAttribute('data-down') !== 'true') return;
    e.preventDefault();
    const current = navRef.current;
    const startX = Number(current.getAttribute('data-start-x') || 0);
    const scrollLeftVal = Number(current.getAttribute('data-scroll-left') || 0);
    const x = e.pageX - current.offsetLeft;
    const walk = (x - startX) * 1.8;
    current.scrollLeft = scrollLeftVal - walk;
  };

  useEffect(() => {
    // Automatically scroll the active link into view
    if (!navRef.current) return;
    // Wait a tiny bit to ensure DOM elements have rendered
    setTimeout(() => {
      if (!navRef.current) return;
      const activeEl = navRef.current.querySelector(`[class*="navTabBtnActive"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }, 100);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      <nav className={styles.navbar}>
        <div className={styles.navLeft}>
          <Link to="/home">
            <img src="/assets/logo.png" className={styles.logoImg} alt="Logo" />
          </Link>
        </div>
        
        <div
          className={styles.navCenter}
          ref={navRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          style={{ cursor: 'grab' }}
        >
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`${styles.navTabBtn} ${isTabActive(link.path) ? styles.navTabBtnActive : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className={styles.navRight}>
          <button
            className="retroBtn retroBtnRed"
            onClick={() => {
              logout();
              window.location.href = '/signin';
            }}
          >
            {t('nav.signOut')}
          </button>
        </div>
      </nav>
      <div className="app-container flex-grow">
        <main className={styles.mainContent}>{translatedChildren}</main>
      </div>
    </div>
  );
}
