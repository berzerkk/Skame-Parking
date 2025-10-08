import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./App.module.css";
import logoUrl from "./assets/logo.png";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getColorFromValue, timeAgo } from "@/utils";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc, getDocs, updateDoc, onSnapshot, collection, serverTimestamp, writeBatch, GeoPoint } from "firebase/firestore";
import { type Parking, SEED } from "@/Parking";
import { getAuth, signInAnonymously } from "firebase/auth";


const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);


const auth = getAuth();
signInAnonymously(auth).catch(console.error);

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
      paint: { "line-color": getColorFromValue(p.occupation), "line-width": 10 },
      lastUpdated: Date.now(),
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

/* ---------------- Popup ---------------- */
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
  const color = useMemo(() => getColorFromValue(value), [value]);

  return (
    <div
      style={{
        position: "relative",
        background: "white",
        borderRadius: 12,
        boxShadow: "0 10px 32px rgba(0,0,0,0.25)",
        padding: "16px 18px 14px",
        minWidth: 260,
        maxWidth: 340,
        pointerEvents: "auto",
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>
        {parking.name}
      </div>

      <div style={{ fontSize: 13, marginBottom: 10, color: "#333" }}>
        Capacité<strong> ≈ {parking.capacity}</strong> places
      </div>

      <label
        htmlFor="occupation-slider"
        style={{ display: "block", fontSize: 13, marginBottom: 6 }}
      >
        Occupation : <strong>{value}%</strong>
      </label>

      <input
        id="occupation-slider"
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        style={{
          width: "100%",
          marginBottom: 8,
          appearance: "none",
          height: 6,
          borderRadius: 3,
          background:
            "linear-gradient(90deg, #00C853 0%, #FFD600 50%, #D50000 100%)",
          outline: "none",
          cursor: "pointer",
        }}
      />
      <style>
        {`
          #occupation-slider::-webkit-slider-thumb {
            appearance: none;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: ${color};
            border: 2px solid white;
            box-shadow: 0 0 3px rgba(0,0,0,0.4);
          }
          #occupation-slider::-moz-range-thumb {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: ${color};
            border: 2px solid white;
            box-shadow: 0 0 3px rgba(0,0,0,0.4);
          }
        `}
      </style>

      <div style={{ fontSize: 12, color: "#555", marginTop: 6, marginBottom: 12 }}>
        Dernière mise à jour il y a {sinceText}
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={onClose}
          style={{
            appearance: "none",
            border: "1px solid #ccc",
            background: "#fff",
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Annuler
        </button>
        <button
          onClick={() => onApply(value)}
          style={{
            appearance: "none",
            border: "none",
            background: "#111",
            color: "white",
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 14,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Appliquer
        </button>
      </div>
    </div>
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
  useEffect(() => {
    parkingsRef.current = parkings;
  }, [parkings]);

  const centerLng = 7.056407;
  const centerLat = 43.612551;
  const delta = 0.005;

  // Seed Firestore si vide + subscribe temps réel
  useEffect(() => {
    (async () => {
      await seedIfEmpty();
      const unsub = onSnapshot(collection(db, "parkings"), (snap) => {
        const rows: Parking[] = snap.docs.map((d) => {
          const data = d.data() as any;
          const coords = (data.coordinates ?? []).map(
            (g: any) => [g._long, g._lat]
          );
          return {
            ...data,
            coordinates: coords,
            paint: {
              "line-color": getColorFromValue(data.occupation ?? 0),
              "line-width": data?.paint?.["line-width"] ?? 10,
            },
          };
        });
        setParkings(rows);
      });
      return () => unsub();
    })();
  }, []);

  // Init Map
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

    map.on("load", () => {
      // Les couches seront ajoutées/maj dans l’effet suivant (syncLayersWithMap)
    });

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

  // Ajoute / met à jour les couches quand parkings change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return; // On sort immédiatement si pas de carte

    let cleanup: (() => void) | undefined; // <-- on déclare un cleanup optionnel

    // Fonction de synchro des couches
    function syncLayersWithMap() {
      parkings.forEach((p) => {
        console.log(p);

        const sourceId = `parking-${p.id}`;
        const layerId = `parking-${p.id}`;

        const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
        const data = {
          type: "Feature" as const,
          properties: { id: p.id },
          geometry: { type: "LineString" as const, coordinates: p.coordinates },
        };

        if (!source) {
          // Ajoute la source et la couche
          map.addSource(sourceId, { type: "geojson", data });
          map.addLayer({
            id: layerId,
            type: "line",
            source: sourceId,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": p.paint["line-color"],
              "line-width": p.paint["line-width"],
            },
          });

          map.on("mouseenter", layerId, () => (map.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", layerId, () => (map.getCanvas().style.cursor = ""));
          map.on("click", layerId, (e) => {
            const f = e.features?.[0];
            const id = Number(f?.properties?.id ?? p.id);
            const fresh = parkingsRef.current.find((x) => x.id === id) ?? p;
            selectedParkingRef.current = fresh;
            setSelectedParking(fresh);
          });
        } else {
          // Mise à jour
          source.setData(data as any);
          if (map.getLayer(layerId)) {
            map.setPaintProperty(layerId, "line-color", p.paint["line-color"]);
            map.setPaintProperty(layerId, "line-width", p.paint["line-width"]);
          }
        }
      });
    }

    // Si le style n'est pas encore chargé, on attend
    if (!map.isStyleLoaded()) {
      const onLoad = () => syncLayersWithMap();
      map.on("load", onLoad);
      cleanup = () => map.off("load", onLoad); // <-- on garde le cleanup ici
    } else {
      // Sinon, on synchronise directement
      syncLayersWithMap();
    }

    // Toujours retourner une fonction de nettoyage
    return () => {
      if (cleanup) cleanup();
    };
  }, [parkings]);

  const handleApply = async (newOccupation: number) => {
    if (!selectedParking) return;

    const newColor = getColorFromValue(newOccupation);
    // Optimistic UI
    setParkings((prev) =>
      prev.map((p) =>
        p.id === selectedParking.id
          ? {
            ...p,
            occupation: newOccupation,
            lastUpdated: Date.now(),
            paint: { ...p.paint, "line-color": newColor },
          }
          : p
      )
    );
    setSelectedParking((prev) =>
      prev
        ? {
          ...prev,
          occupation: newOccupation,
          lastUpdated: Date.now(),
          paint: { ...prev.paint, "line-color": newColor },
        }
        : prev
    );

    // Persist Firestore
    const ref = doc(db, "parkings", String(selectedParking.id));
    await updateDoc(ref, {
      occupation: newOccupation,
      lastUpdated: Date.now(),
      "paint.line-color": newColor,
    }).catch(async (e) => {
      // si le doc n'existe pas (edge), on le crée
      await setDoc(ref, {
        ...selectedParking,
        occupation: newOccupation,
        lastUpdated: Date.now(),
        paint: { ...selectedParking.paint, "line-color": newColor },
      });
    });

    // Met à jour la couche MapLibre
    const map = mapRef.current;
    const layerId = `parking-${selectedParking.id}`;
    if (map && map.getLayer(layerId)) {
      map.setPaintProperty(layerId, "line-color", newColor);
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", height: 720 }}>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 6,
          overflow: "hidden",
          boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
        }}
      />

      {selectedParking && (
        <div
          onClick={() => setSelectedParking(null)}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 9,
            background: "transparent",
          }}
        />
      )}

      {selectedParking && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
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
            <a href="#don" className={styles.navLink} onClick={() => setOpen(false)}>
              Don
            </a>
            <a
              href="#login"
              className={`${styles.cta} ${styles.navLink}`}
              onClick={() => setOpen(false)}
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
          <svg
            viewBox="0 0 24 24"
            className={styles.mobileArrowIcon}
            aria-hidden="true"
          >
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
    </div>
  );
}
