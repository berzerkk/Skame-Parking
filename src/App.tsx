import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./App.module.css";
import logoUrl from "/logo.png";
import maplibregl from "maplibre-gl";
import type { Feature, Point, LineString, Position } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import { getColorFromValue, timeAgo } from "@/utils";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore, doc, setDoc, getDocs, updateDoc, onSnapshot,
  collection, serverTimestamp, writeBatch, GeoPoint
} from "firebase/firestore";
import {
  getAuth, signInAnonymously, signInWithRedirect,
  GoogleAuthProvider, OAuthProvider, linkWithRedirect,
  sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink,
  onAuthStateChanged
} from "firebase/auth";
import { SEED, type Parking } from "@/Parking";

import { FcGoogle } from "react-icons/fc";
import { FaMicrosoft } from "react-icons/fa";

/* ---------------- Firebase ---------------- */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

const auth = getAuth();
const google = new GoogleAuthProvider();
const microsoft = new OAuthProvider("microsoft.com");

// Session anonyme pour lire/écrire selon tes règles
signInAnonymously(auth).catch(console.error);

// Crée/merge un profil user quand connecté
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  try {
    await setDoc(
      doc(db, "users", user.uid),
      {
        uid: user.uid,
        email: user.email || null,
        displayName: user.displayName || null,
        provider: user.providerData?.[0]?.providerId || (user.isAnonymous ? "anonymous" : "unknown"),
        photoURL: user.photoURL || null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    console.error(e);
  }
});

/* ---------------- Seed ---------------- */
async function seedIfEmpty() {
  const snap = await getDocs(collection(db, "parkings"));
  if (!snap.empty) return;

  const batch = writeBatch(db);
  for (const p of SEED) {
    const id = String(p.id);
    const coords = p.coordinates.map(([lng, lat]) => new GeoPoint(lat, lng));
    batch.set(doc(db, "parkings", id), {
      ...p,
      coordinates: coords,
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

/* ---------------- Auth helpers ---------------- */
const actionCodeSettings = {
  url: window.location.origin, // revient sur l’origin, on finalise côté app
  handleCodeInApp: true,
};

async function sendMagicLink(email: string) {
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  localStorage.setItem("emailForSignIn", email);
}

async function completeEmailLinkIfNeeded() {
  if (isSignInWithEmailLink(auth, window.location.href)) {
    const stored = localStorage.getItem("emailForSignIn");
    const email = stored || window.prompt("Confirme ton e-mail") || "";
    if (!email) return;
    await signInWithEmailLink(auth, email, window.location.href);
    localStorage.removeItem("emailForSignIn");
  }
}

async function providerAuthOrLink(provider: GoogleAuthProvider | OAuthProvider) {
  const u = auth.currentUser;
  if (u && u.isAnonymous) {
    // On upgrade le compte anonyme -> garde les données Firestore
    return linkWithRedirect(u, provider);
  }
  return signInWithRedirect(auth, provider);
}

/* ---------------- Popup occupation ---------------- */
export function ParkingPopup({
  parking,
  onClose,
  onApply,
}: {
  parking: Parking;
  onClose: () => void;
  onApply: (newOccupation: number) => void;
}) {
  const [value, setValue] = useState<number>(parking.occupation);
  const sinceText = useMemo(() => timeAgo(parking.lastUpdated), [parking.lastUpdated]);

  return (
    <div className={styles.popup} onClick={(e) => e.stopPropagation()}>
      <div className={styles.popupTitle}>{parking.name}</div>

      <div className={styles.popupInfo}>
        Capacité<strong> ≈ {parking.capacity}</strong> places
      </div>

      <label htmlFor="occupation-slider" className={styles.sliderLabel}>
        Occupation : <strong>{value}%</strong>
      </label>

      <input
        id="occupation-slider"
        className={styles.slider}
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
      />

      <div className={styles.popupSince}>
        Dernière mise à jour il y a {sinceText}
      </div>

      <div className={styles.popupFooter}>
        <button onClick={onClose} className={`${styles.btn} ${styles.btnGhost}`}>
          Annuler
        </button>
        <button
          onClick={() => onApply(value)}
          className={`${styles.btn} ${styles.btnPrimary}`}
        >
          Appliquer
        </button>
      </div>
    </div>
  );
}

/* ---------------- Auth Modal ---------------- */
function AuthModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Finalise la connexion par lien magique si on revient d’un clic mail
    completeEmailLinkIfNeeded().catch(console.error);
  }, []);

  if (!open) return null;

  const doGoogle = async () => {
    try {
      setBusy(true);
      await providerAuthOrLink(google);
    } catch (e: any) {
      setError(e?.message || "Erreur Google");
    } finally {
      setBusy(false);
    }
  };

  const doMicrosoft = async () => {
    try {
      setBusy(true);
      await providerAuthOrLink(microsoft);
    } catch (e: any) {
      setError(e?.message || "Erreur Microsoft");
    } finally {
      setBusy(false);
    }
  };

  const doMagic = async () => {
    try {
      setError(null);
      if (!email || !/.+@.+\..+/.test(email)) {
        setError("Entre un e-mail valide");
        return;
      }
      setBusy(true);
      await sendMagicLink(email);
      setSent(true);
    } catch (e: any) {
      setError(e?.message || "Impossible d’envoyer le lien");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={styles.authOverlay} onClick={onClose} />
      <div className={styles.authModal} role="dialog" aria-modal="true" aria-label="Connexion / Inscription">
        <div className={styles.authStack}>
          <button className={styles.authClose} onClick={onClose} aria-label="Fermer">×</button>
          <h3 className={styles.authTitle}>Connexion / Inscription</h3>
          <p className={styles.authSubtitle}>Choisis une option rapide et sécurisée</p>
          <button className={styles.authBtn} onClick={doGoogle}>
            <FcGoogle size={20} style={{ marginRight: 8 }} />
            Continuer avec Google
          </button>

          <button className={styles.authBtn} onClick={doMicrosoft}>
            <FaMicrosoft color="#2F2F2F" size={20} style={{ marginRight: 8 }} />
            Continuer avec Microsoft
          </button>

          <div className={styles.authDivider}><span>ou</span></div>

          <div className={styles.authEmailRow}>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="ton@email.com"
              className={styles.authInput}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy || sent}
            />
            <button
              className={`${styles.authBtn} ${styles.authEmailBtn}`}
              onClick={doMagic}
              disabled={busy || sent}
            >
              {sent ? "Lien envoyé ✔" : "Recevoir un lien"}
            </button>
          </div>

          {error && <div className={styles.authError}>{error}</div>}

          <p className={styles.authHelper}>
            Astuce : si tu es déjà connecté en anonyme, on **conservera tes données** en reliant ton compte.
          </p>

          <p className={styles.authLegal}>
            En continuant, tu acceptes nos CGU et notre Politique de confidentialité.
          </p>
        </div>
      </div>
    </>
  );
}

/* ---------------- Carte ---------------- */
function CampusMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const [selectedParking, setSelectedParking] = useState<Parking | null>(null);
  const selectedParkingRef = useRef<Parking | null>(null);

  const [parkings, setParkings] = useState<Parking[]>([]);
  const parkingsRef = useRef<Parking[]>(parkings);
  useEffect(() => { parkingsRef.current = parkings; }, [parkings]);

  const centerLng = 7.056407;
  const centerLat = 43.612551;
  const delta = 0.005;

  useEffect(() => {
    (async () => {
      await seedIfEmpty();
      const unsub = onSnapshot(collection(db, "parkings"), (snap) => {
        const rows: Parking[] = snap.docs.map((d) => {
          const data = d.data() as any;
          const coords = (data.coordinates ?? []).map((g: any) => [g._long, g._lat]);
          return { ...data, coordinates: coords };
        });
        setParkings(rows);
      });
      return () => unsub();
    })();
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [centerLng, centerLat],
      zoom: 16,
      minZoom: 15,
      maxZoom: 19,
      maxBounds: [
        [centerLng - delta, centerLat - delta],
        [centerLng + delta, centerLat + delta],
      ],
    });

    mapRef.current = map;

    const closeIfOutside = (e: maplibregl.MapMouseEvent) => {
      if (!selectedParkingRef.current) return;
      const layers = parkingsRef.current.map((p) => `parking-${p.id}`);
      const feats = map.queryRenderedFeatures(e.point, { layers });
      if (feats.length === 0) setSelectedParking(null);
    };
    map.on("click", closeIfOutside);

    return () => {
      map.off("click", closeIfOutside);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;

    let cleanup: (() => void) | undefined;

    function syncLayersWithMap(mm: maplibregl.Map) {
      parkings.forEach((p) => {
        const sourceId = `parking-${p.id}`;
        const layerId = `parking-${p.id}`;

        const source = mm.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
        const isPoint = p.coordinates.length === 1;
        const geometry: Point | LineString = isPoint
          ? ({ type: "Point", coordinates: p.coordinates[0] as Position } as Point)
          : ({ type: "LineString", coordinates: p.coordinates as Position[] } as LineString);

        const data: Feature<Point | LineString> = {
          type: "Feature",
          properties: { id: p.id, size: p.size },
          geometry,
        };

        if (!source) {
          mm.addSource(sourceId, { type: "geojson", data });

          if (isPoint) {
            mm.addLayer({
              id: layerId,
              type: "circle",
              source: sourceId,
              paint: {
                "circle-radius": p.size,
                "circle-color": getColorFromValue(p.occupation ?? 0),
                "circle-opacity": 0.8,
              },
            });
          } else {
            mm.addLayer({
              id: layerId,
              type: "line",
              source: sourceId,
              layout: { "line-join": "round", "line-cap": "round" },
              paint: {
                "line-width": p.size,
                "line-color": getColorFromValue(p.occupation ?? 0),
                "line-opacity": 0.8,
              },
            });
          }
          mm.on("mouseenter", layerId, () => (mm.getCanvas().style.cursor = "pointer"));
          mm.on("mouseleave", layerId, () => (mm.getCanvas().style.cursor = ""));
          mm.on("click", layerId, (e) => {
            const f = e.features?.[0];
            const id = Number(f?.properties?.id ?? p.id);
            const fresh = parkingsRef.current.find((x) => x.id === id) ?? p;
            selectedParkingRef.current = fresh;
            setSelectedParking(fresh);
          });
        } else {
          source.setData(data as any);
          if (mm.getLayer(layerId)) {
            mm.setPaintProperty(layerId, "line-color", getColorFromValue(p.occupation ?? 0));
            mm.setPaintProperty(layerId, "line-width", p.size);
          }
        }
      });
    }

    if (!m.isStyleLoaded()) {
      const onLoad = () => syncLayersWithMap(m);
      m.on("load", onLoad);
      cleanup = () => m.off("load", onLoad);
    } else {
      syncLayersWithMap(m);
    }

    return () => { if (cleanup) cleanup(); };
  }, [parkings]);

  const handleApply = async (newOccupation: number) => {
    if (!selectedParking) return;

    const newColor = getColorFromValue(newOccupation);
    setParkings((prev) =>
      prev.map((p) =>
        p.id === selectedParking.id
          ? { ...p, occupation: newOccupation, lastUpdated: Date.now() }
          : p
      )
    );
    setSelectedParking((prev) =>
      prev ? { ...prev, occupation: newOccupation, lastUpdated: Date.now() } : prev
    );

    const ref = doc(db, "parkings", String(selectedParking.id));
    await updateDoc(ref, {
      occupation: newOccupation,
      lastUpdated: Date.now(),
    }).catch(async () => {
      await setDoc(ref, {
        ...selectedParking,
        occupation: newOccupation,
        lastUpdated: Date.now(),
      });
    });

    const map = mapRef.current;
    const layerId = `parking-${selectedParking.id}`;
    if (map && map.getLayer(layerId)) {
      map.setPaintProperty(layerId, "line-color", newColor);
    }
  };

  return (
    <div className={styles.mapSectionRoot}>
      <div ref={containerRef} className={styles.mapCanvas} />

      {selectedParking && (
        <div onClick={() => setSelectedParking(null)} className={styles.modalOverlay} />
      )}

      {selectedParking && (
        <div className={styles.modalWrapper}>
          <ParkingPopup
            parking={selectedParking}
            onClose={() => setSelectedParking(null)}
            onApply={handleApply}
          />
        </div>
      )}
    </div>
  );
}

/* ---------------- App ---------------- */
export default function App() {
  const [open, setOpen] = useState(false);
  const [nearBottom, setNearBottom] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    const handle = () => {
      const docEl = document.documentElement;
      const full =
        Math.max(docEl.scrollHeight, document.body.scrollHeight) ||
        docEl.scrollHeight;
      const y = window.scrollY || window.pageYOffset;
      const vh = window.innerHeight;
      setNearBottom(vh + y >= full - 120);
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
            <span />
            <span />
            <span />
          </button>

          <nav className={`${styles.nav} ${open ? styles.navOpen : ""}`}>
            <a href="#mission" className={styles.navLink} onClick={() => setOpen(false)}>
              Notre mission
            </a>
            <a href="https://Ko-fi.com/skameparking" target="_blank" rel="noreferrer" className={styles.navLink} onClick={() => setOpen(false)}>
              Don
            </a>
            <a
              href="#login"
              className={`${styles.cta} ${styles.navLink}`}
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
                setAuthOpen(true);
              }}
            >
              Connexion/Inscription
            </a>
          </nav>
        </div>
      </header>

      <main id="mission" className={styles.main}>
        <section className={styles.section} aria-label="Carte campus">
          <CampusMap />
        </section>

        <section className={styles.section}>
          <h1 className={styles.title}>Notre mission</h1>

          <div className={styles.text}>
            <p>
              Chaque année, les étudiants de <strong>SKEMA</strong> investissent des
              sommes importantes pour suivre une formation.
            </p>
            <p>
              Pourtant, l&apos;un des besoins les plus basiques —{" "}
              <em>pouvoir accéder aux cours</em> — n&apos;est pas assuré : les places
              de stationnement sur le campus de <strong>Sophia Antipolis</strong> sont
              très insuffisantes.
            </p>
            <p>
              Le résultat est simple : même en arrivant tôt, de nombreux étudiants ne
              trouvent pas de stationnement, doivent se garer sur des parkings privés
              voisins, et s&apos;il n&apos;y a toujours pas de place, renoncent à
              suivre leurs cours. Sans parler du risque d&apos;abîmer leur voiture dû au
              surnombre sur un espace restreint.
            </p>
            <p>Cette situation est inadmissible dans une école privée de ce niveau.</p>
            <p>Notre initiative a deux objectifs :</p>
          </div>

          <div className={styles.text}>
            <h2 className={styles.objTitle}>
              1. Donner une information en temps réel sur l&apos;occupation des parkings
            </h2>
            <ul className={styles.list}>
              <li>
                Consulter l&apos;état d&apos;occupation des différentes zones et
                signaler leur remplissage (vide, partiel, complet).
              </li>
              <li>
                Anticiper ses déplacements et éviter le stress et la perte de temps.
              </li>
            </ul>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.text}>
            <h2 className={styles.objTitle}>2. Faire évoluer l&apos;organisation de SKEMA</h2>
            <p>
              Nous demandons que l&apos;école prenne ses responsabilités et investisse
              dans de véritables solutions :
            </p>
            <ul className={styles.list}>
              <li>Création ou extension rapide des espaces de stationnement.</li>
              <li>
                Mise en place, dans l&apos;attente, de cours en visio pour les séances
                qui attirent le plus d&apos;étudiants (notamment en amphithéâtre).
              </li>
            </ul>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.text}>
            <p>
              Nous croyons qu&apos;une école qui demande un tel investissement financier
              doit offrir des conditions d&apos;accès et d&apos;organisation à la
              hauteur.
            </p>
            <p>
              En signant la pétition intégrée à l&apos;application, vous contribuez à
              faire entendre votre voix et à changer les choses pour tous.
            </p>

            <div className={styles.petitionBox} id="petition">
              <a href="#petition" className={styles.petitionBtn}>
                Signer la pétition
              </a>
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
            <path
              d="M12 4v14m0 0l-6-6m6 6l6-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
