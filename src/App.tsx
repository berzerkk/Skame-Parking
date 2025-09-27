import { useEffect, useState } from "react";
import styles from "./App.module.css";
import logoUrl from "./assets/logo.png";

export default function App() {
  const [open, setOpen] = useState(false);
  const [nearBottom, setNearBottom] = useState(false);

  useEffect(() => {
    const handle = () => {
      const doc = document.documentElement;
      const full =
        Math.max(doc.scrollHeight, document.body.scrollHeight) || doc.scrollHeight;
      const y = window.scrollY || window.pageYOffset;
      const vh = window.innerHeight;
      setNearBottom(vh + y >= full - 120); // masque la flèche ~120px avant le bas
    };
    handle();
    window.addEventListener("scroll", handle, { passive: true });
    window.addEventListener("resize", handle);
    return () => {
      window.removeEventListener("scroll", handle);
      window.removeEventListener("resize", handle);
    };
  }, []);

  const scrollToBottom = () => {
    const h = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight
    );
    window.scrollTo({ top: h, behavior: "smooth" });
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a href="/" className={styles.brand}>
            <img src={logoUrl} alt="Skame Parking" className={styles.brandLogo} />
          </a>

          <button
            className={styles.burger}
            aria-label="Ouvrir le menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span /><span /><span />
          </button>

          <nav className={`${styles.nav} ${open ? styles.navOpen : ""}`}>
            <a href="#mission" className={styles.navLink} onClick={() => setOpen(false)}>
              Notre mission
            </a>
            <a href="#don" className={styles.navLink} onClick={() => setOpen(false)}>
              Don
            </a>
            <a href="#login" className={`${styles.cta} ${styles.navLink}`} onClick={() => setOpen(false)}>
              Connexion/Inscription
            </a>
          </nav>
        </div>
      </header>

      <main id="mission" className={styles.main}>
        <section className={styles.section}>
          <h1 className={styles.title}>Notre mission</h1>

          <div className={styles.text}>
            <p>Chaque année, les étudiants de <strong>SKEMA</strong> investissent des sommes importantes pour suivre une formation.</p>
            <p>Pourtant, l&apos;un des besoins les plus basiques — <em>pouvoir accéder aux cours</em> — n&apos;est pas assuré : les places de stationnement sur le campus de <strong>Sophia Antipolis</strong> sont très insuffisantes.</p>
            <p>Le résultat est simple : même en arrivant tôt, de nombreux étudiants ne trouvent pas de stationnement, doivent se garer sur des parkings privés voisins, et s&apos;il n&apos;y a toujours pas de place, renoncent à suivre leurs cours. Sans parler du risque d&apos;abîmer leur voiture dû au surnombre sur un espace restreint.</p>
            <p>Cette situation est inadmissible dans une école privée de ce niveau.</p>
            <p>Notre initiative a deux objectifs :</p>
          </div>

          <div className={styles.text}>
            <h2 className={styles.objTitle}>1. Donner une information en temps réel sur l&apos;occupation des parkings</h2>
            <ul className={styles.list}>
              <li>Consulter l&apos;état d&apos;occupation des différentes zones et signaler leur remplissage (vide, partiel, complet).</li>
              <li>Anticiper ses déplacements et éviter le stress et la perte de temps.</li>
            </ul>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.text}>
            <h2 className={styles.objTitle}>2. Faire évoluer l&apos;organisation de SKEMA</h2>
            <p>Nous demandons que l&apos;école prenne ses responsabilités et investisse dans de véritables solutions :</p>
            <ul className={styles.list}>
              <li>Création ou extension rapide des espaces de stationnement.</li>
              <li>Mise en place, dans l&apos;attente, de cours en visio pour les séances qui attirent le plus d&apos;étudiants (notamment en amphithéâtre).</li>
            </ul>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.text}>
            <p>Nous croyons qu&apos;une école qui demande un tel investissement financier doit offrir des conditions d&apos;accès et d&apos;organisation à la hauteur.</p>
            <p>En signant la pétition intégrée à l&apos;application, vous contribuez à faire entendre votre voix et à changer les choses pour tous.</p>

            <div className={styles.petitionBox} id="petition">
              <a href="#petition" className={styles.petitionBtn}>Signer la pétition</a>
            </div>
          </div>
        </section>
      </main>

      {!nearBottom && (
        <button
          className={styles.mobileArrow}
          aria-label="Aller en bas de page"
          onClick={scrollToBottom}
        >
          <svg viewBox="0 0 24 24" className={styles.mobileArrowIcon} aria-hidden="true">
            <path d="M12 4v14m0 0l-6-6m6 6l6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
