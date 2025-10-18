import styles from "./App.module.css";
import { Link } from "react-router-dom";
import { FaLinkedin, FaTiktok, FaInstagram } from "react-icons/fa";

export default function Contact() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.section}>
          <h1 className={styles.title}>Contact</h1>

          <div className={styles.text}>
            <p>
              Une question, un problème technique ou une suggestion concernant
              l'application ?
            </p>
            <p>Tu peux nous contacter à :</p>
            <p>skameparking@hotmail.com</p>
          </div>

          <h1 className={styles.title}>Réseaux sociaux</h1>
          <div className={styles.socials}>
            <a href="https://www.linkedin.com/company/skame-parking/">
              <FaLinkedin />
            </a>
            <a href="https://www.tiktok.com/@skameparking">
              <FaTiktok />
            </a>
            <a href="https://www.instagram.com/skameparking/">
              <FaInstagram />
            </a>
          </div>

          <div className={styles.petitionBox}>
            <Link to="/" className={styles.petitionBtn}>
              Retourner à la carte
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
