import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./App.module.css";

export default function App() {
  const [open, setOpen] = useState(false);

  // Refs vers les 3 blocs de contenu
  const sec1Ref = useRef<HTMLElement | null>(null);
  const sec2Ref = useRef<HTMLElement | null>(null);
  const sec3Ref = useRef<HTMLElement | null>(null);
  const sections = useMemo(() => [sec1Ref, sec2Ref, sec3Ref], []);

  // État : index du bloc "principalement visible"
  const [activeIndex, setActiveIndex] = useState(0);

  // Observer pour savoir sur quel bloc on est
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        // Choisir l'entrée la plus visible
        const sorted = [...entries].sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = sorted[0];
        if (!top) return;
        const idx = sections.findIndex((r) => r.current === top.target);
        if (idx !== -1) setActiveIndex(idx);
      },
      {
        root: null,
        threshold: [0.25, 0.5, 0.75], // suffisamment sensible
      }
    );
    sections.forEach((r) => r.current && obs.observe(r.current));
    return () => obs.disconnect();
  }, [sections]);

  const scrollToNext = () => {
    const next = sections[activeIndex + 1]?.current;
    if (next) next.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const showArrowMobile = activeIndex < sections.length - 1; // cacher sur le dernier bloc

  return (
    <div className={styles.page}>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a href="/" className={styles.brand}>
            <span className={styles.brandLine1}>SKAME</span>
            <span className={styles.brandLine2}>PARKING</span>
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

      {/* MAIN */}
      <main id="mission" className={styles.main}>
        {/* Bloc 1 */}
        <section ref={sec1Ref} className={styles.section}>
          <h1 className={styles.title}>Notre mission</h1>

          <div className={styles.content}>
            <p>
              Chaque année, les étudiants de <strong>SKEMA</strong> investissent des sommes importantes pour
              suivre une formation.
            </p>
            <p>
              Pourtant, l&apos;un des besoins les plus basiques — <em>pouvoir accéder aux cours</em> — n&apos;est pas
              assuré : les places de stationnement sur le campus de <strong>Sophia Antipolis</strong> sont très
              insuffisantes.
            </p>
            <p>
              Le résultat est simple : même en arrivant tôt, de nombreux étudiants ne trouvent pas de stationnement,
              doivent se garer sur des parkings privés voisins, et s&apos;il n&apos;y a toujours pas de place,
              renoncent à suivre leurs cours. Sans parler du risque d&apos;abîmer leur voiture dû au surnombre sur
              un espace restreint.
            </p>
            <p>Cette situation est inadmissible dans une école privée de ce niveau.</p>
            <p>Notre initiative a deux objectifs :</p>
          </div>

          <div className={styles.block}>
            <h2 className={styles.objTitle}>
              1. Donner une information en temps réel sur l’occupation des parkings
            </h2>
            <ul className={styles.list}>
              <li>
                Grâce à cette application, chaque étudiant peut consulter l’état d’occupation des différentes zones
                de stationnement du campus et signaler leur remplissage (vide, partiel, complet).
              </li>
              <li>Cela permet d’anticiper ses déplacements et d’éviter le stress et la perte de temps.</li>
            </ul>
          </div>
        </section>

        {/* Bloc 2 */}
        <section ref={sec2Ref} className={styles.section}>
          <h1 className={styles.title}>Notre mission</h1>

          <div className={styles.block}>
            <h2 className={styles.objTitle}>2. Faire évoluer l’organisation de SKEMA</h2>
            <p>
              Nous demandons que l’école prenne ses responsabilités et investisse dans de véritables solutions :
            </p>
            <ul className={styles.list}>
              <li>Création ou extension rapide des espaces de stationnement.</li>
              <li>
                Mise en place, dans l’attente, de cours en visio pour les séances qui attirent le plus d’étudiants
                (notamment les cours en amphithéâtre).
              </li>
            </ul>
          </div>
        </section>

        {/* Bloc 3 (fin) */}
        <section ref={sec3Ref} className={styles.section}>
          <h1 className={styles.title}>Notre mission</h1>

          <div className={styles.block}>
            <p>
              Nous croyons qu’une école qui demande un tel investissement financier à ses étudiants doit en retour
              offrir des conditions d’accès et d’organisation à la hauteur du prix payé.
            </p>
            <p>
              En signant la pétition intégrée à l’application, vous contribuez à faire entendre votre voix et à
              changer les choses pour tous.
            </p>

            <div className={styles.petitionBox} id="petition">
              <a href="#petition" className={styles.petitionBtn}>
                Signer la pétition
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Flèche mobile : fixée en bas, cachée sur le dernier bloc */}
      <button
        className={`${styles.mobileArrow} ${showArrowMobile ? styles.mobileArrowVisible : styles.mobileArrowHidden}`}
        aria-label="Aller à la section suivante"
        onClick={scrollToNext}
      >
        <svg viewBox="0 0 24 24" className={styles.mobileArrowIcon} aria-hidden="true">
          <path d="M12 4v14m0 0l-6-6m6 6l6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}
