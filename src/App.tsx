import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./App.module.css";
import logoUrl from "./assets/logo.png";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getColorFromValue, timeAgo } from "@/utils";

type Parking = {
  id: number;
  name: string;
  lastUpdated: number;
  capacity: number;
  occupation: number;
  coordinates: [number, number][];
  paint: { "line-color": string; "line-width": number };
  open: boolean;
};


const Parkings: Parking[] = [
  {
    id: 1,
    name: "Parking Skema Nord",
    lastUpdated: Date.now() - 1000 * 60 * 7,
    capacity: 50,
    occupation: 75,
    coordinates: [
      [7.0562, 43.6124],
      [7.0566, 43.6124],
      [7.0566, 43.6127],
      [7.0562, 43.6127],
      [7.0562, 43.6124],
    ],
    paint: { "line-color": getColorFromValue(75), "line-width": 6 },
    open: true,
  },
];

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
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Titre */}
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>
        {parking.name}
      </div>

      {/* Capacité + approximations */}
      <div style={{ fontSize: 13, marginBottom: 10, color: "#333" }}>
        Capacité<strong> ≈ {parking.capacity}</strong> places
        <div style={{ marginTop: 4, color: "#555" }}>
        </div>
      </div>

      {/* Slider Occupation */}
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
      {/* Personnalisation du curseur */}
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

      {/* Ligne "dernière mise à jour" */}
      <div
        style={{
          fontSize: 12,
          color: "#555",
          marginTop: 6,
          marginBottom: 12,
        }}
      >
        Dernière mise à jour il y a {sinceText}
      </div>

      {/* Boutons actions */}
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

function CampusMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [selectedParking, setSelectedParking] = useState<Parking | null>(null);
  const selectedParkingRef = useRef<Parking | null>(null);

  const [parkings, setParkings] = useState<Parking[]>([...Parkings]);

  const parkingsRef = useRef<Parking[]>(parkings);
  useEffect(() => {
    parkingsRef.current = parkings;
  }, [parkings]);

  const centerLng = 7.056407;
  const centerLat = 43.612551;
  const delta = 0.005;

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
      parkings.forEach((p) => {
        const sourceId = `parking-${p.id}`;
        const layerId = `parking-${p.id}`;

        map.addSource(sourceId, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: { id: p.id },
            geometry: { type: "LineString", coordinates: p.coordinates },
          },
        });

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
          const fresh = parkingsRef.current.find(x => x.id === id) ?? p;
          setSelectedParking(fresh);
        });
      });
    });

    const closeIfOutside = (e: maplibregl.MapMouseEvent) => {
      if (!selectedParkingRef.current) return;
      const layers = Parkings.map((p) => `parking-${p.id}`);
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

  const handleApply = (newOccupation: number) => {
    if (!selectedParking) return;
    const newColor = getColorFromValue(newOccupation);
    setParkings(prev =>
      prev.map(p =>
        p.id === selectedParking.id
          ? { ...p, occupation: newOccupation, lastUpdated: Date.now() }
          : p
      )
    );
    setSelectedParking(prev =>
      prev ? { ...prev, occupation: newOccupation, lastUpdated: Date.now() } : prev
    );
    const map = mapRef.current;
    const layerId = `parking-${selectedParking.id}`;
    if (map && map.getLayer(layerId)) {
      map.setPaintProperty(layerId, "line-color", newColor);
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", height: 720 }}>
      {/* Carte */}
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

      {/* Popup centré visuellement */}
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
        <section className={styles.section} aria-label="Carte campus">
          <CampusMap />
        </section>

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
