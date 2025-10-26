// src/Header.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import styles from "./App.module.css";
import logoUrl from "/logo.png";
import { FaSun, FaMoon } from "react-icons/fa";
import { IoClose } from "react-icons/io5";

export default function Header({ nightmode, onToggleNightmode, }: { nightmode: boolean; onToggleNightmode: () => void; }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.brand}>
            <img src={logoUrl} alt="Skame Parking" className={styles.brandLogo} />
          </Link>

          <button className={styles.burger} aria-label="Ouvrir le menu" aria-expanded={open} onClick={() => setOpen(true)}>
            <span /><span /><span />
          </button>

          <nav className={styles.nav}>
            <Link to="/#mission" className={styles.navLink}>Notre mission</Link>
            <a href="https://Ko-fi.com/skameparking" target="_blank" rel="noreferrer" className={styles.navLink}>Don</a>
            <a href="https://c.org/CwFHpvtnz2" target="_blank" rel="noopener noreferrer" className={styles.navLink}>Pétition</a>
            <Link to="/contact" className={styles.navLink}>Contact / Réseaux sociaux</Link>
            <button className={styles.nightModeBtn} onClick={onToggleNightmode}>
              {nightmode ? <FaSun /> : <FaMoon />}
            </button>
          </nav>
        </div>
      </header >

      <div className={`${styles.navOverlay} ${open ? styles.navOverlayOpen : ""}`} onClick={() => setOpen(false)} aria-hidden={!open} />
      <div className={`${styles.navPanel} ${open ? styles.navPanelOpen : ""}`} role="dialog" aria-modal="true" aria-label="Menu" aria-hidden={!open}>
        <div className={styles.navPanelHeader}>
          <h3 className={styles.navPanelTitle}>Menu</h3>
          <button className={styles.navClose} onClick={() => setOpen(false)} aria-label="Fermer le menu">
            <IoClose />
          </button>
        </div>

        <div className={styles.navMenu}>
          <Link to="/#mission" onClick={() => setOpen(false)}>Notre mission</Link>
          <Link to="/contact" onClick={() => setOpen(false)}>Contact / Réseaux sociaux</Link>
          <a href="https://Ko-fi.com/skameparking" target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>Don</a>

          <a onClick={() => { onToggleNightmode(); }}>{nightmode ? "Mode clair" : "Mode sombre"}</a>
        </div>
      </div >
    </>
  );
}
