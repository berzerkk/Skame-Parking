import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./App.module.css";
import maplibregl from "maplibre-gl";
import type { Feature, Point, LineString, Position } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import { getColorFromValue, timeAgo } from "@/utils";
import { checkCooldown, startCooldown, fmtCountdown } from "@/cooldown";
import {
    doc,
    setDoc,
    getDocs,
    updateDoc,
    onSnapshot,
    collection,
    serverTimestamp,
    writeBatch,
    GeoPoint,
} from "firebase/firestore";

import { db } from "@/FirebaseClient";

import { SEED, type Parking } from "@/Parking";
import { supabase } from "@/supabaseClient";

const COOLDOWN_MIN = 30;

const STYLE_LIGHT = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const STYLE_DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export async function uploadParkingPhoto(
    parkingId: string | number,
    file: File
): Promise<string> {
    if (!file.type.startsWith("image/")) throw new Error("Fichier non image.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Image trop lourde (>5 Mo)");
    const path = `${parkingId}/photo.jpg`;
    const { error } = await supabase.storage.from("parkings").upload(path, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: "3600",
    });
    if (error) throw error;
    const { data } = supabase.storage.from("parkings").getPublicUrl(path);
    return data.publicUrl;
}

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

function ParkingPopup({
    parking,
    onClose,
    onApply,
    cooldownKey,
}: {
    parking: Parking;
    onClose: () => void;
    onApply: (newOccupation: number) => void | Promise<void>;
    cooldownKey: string;
}) {
    const getParkingPhotoUrl = (p: any): string | undefined =>
        p ? (typeof p.photo === "string" ? p.photo : p.photo?.url) : undefined;

    const [editMode, setEditMode] = useState(false); // lecture par défaut
    const [value, setValue] = useState<number>(parking.occupation);
    const [remainingMs, setRemainingMs] = useState<number>(0);
    const [applying, setApplying] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [remoteUrl, setRemoteUrl] = useState<string | undefined>(() => getParkingPhotoUrl(parking));
    const [stagedFile, setStagedFile] = useState<File | null>(null);
    const [stagedPreviewUrl, setStagedPreviewUrl] = useState<string | undefined>(undefined);

    useEffect(() => {
        const url = getParkingPhotoUrl(parking);
        const busted = (parking as any)?.photoUpdatedAt ? `${url}?v=${(parking as any).photoUpdatedAt}` : url;
        setRemoteUrl(busted);
        // reset staging et retour lecture quand on change de parking
        if (stagedPreviewUrl) URL.revokeObjectURL(stagedPreviewUrl);
        setStagedFile(null);
        setStagedPreviewUrl(undefined);
        setEditMode(false);
        setValue(parking.occupation);
    }, [parking]);

    useEffect(() => {
        const { remainingMs } = checkCooldown(cooldownKey);
        setRemainingMs(remainingMs);
        if (remainingMs > 0) {
            const id = setInterval(() => {
                const { remainingMs: r } = checkCooldown(cooldownKey);
                setRemainingMs(r);
                if (r <= 0) clearInterval(id);
            }, 500);
            return () => clearInterval(id);
        }
    }, [cooldownKey]);

    const onPickFileClick = () => {
        if (!editMode) return;
        fileInputRef.current?.click();
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            if (stagedPreviewUrl) URL.revokeObjectURL(stagedPreviewUrl);
            setStagedFile(file);
            setStagedPreviewUrl(URL.createObjectURL(file));
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };

    // Appliquer = soit passer en édition (si lecture), soit sauvegarder (si édition)
    const handlePrimary = async () => {
        if (!editMode) {
            setEditMode(true);
            return;
        }

        // édition → sauvegarde
        const { allowed, remainingMs } = checkCooldown(cooldownKey);
        if (!allowed) {
            alert(`Trop rapide ! Réessaie dans ${fmtCountdown(remainingMs)}.`);
            return;
        }
        try {
            setApplying(true);

            if (stagedFile) {
                const url = await uploadParkingPhoto(parking.id, stagedFile);
                const ts = Date.now();
                await setDoc(doc(db, "parkings", String(parking.id)), { photo: url, photoUpdatedAt: ts }, { merge: true });
                setRemoteUrl(`${url}?v=${ts}`);
            }

            const res = onApply(value);
            if (res && typeof (res as any).then === "function") await (res as Promise<void>);
            // après sauvegarde, on ferme
            onClose();
        } catch (err: any) {
            alert(err?.message || "Erreur lors de l’enregistrement");
        } finally {
            setApplying(false);
        }
    };

    // Secondaire :
    // - Lecture: Fermer
    // - Édition: Annuler → ferme le popup (et jette les changements)
    const handleSecondary = () => {
        // cleanup éventuel
        if (stagedPreviewUrl) URL.revokeObjectURL(stagedPreviewUrl);
        setStagedFile(null);
        setStagedPreviewUrl(undefined);
        setUploading(false);
        setApplying(false);
        setValue(parking.occupation);
        onClose(); // <<< en édition, "Annuler" ferme bien la modale
    };

    // URLs d’affichage :
    const readPhotoUrl = remoteUrl; // lecture: on montre la photo existante si présente
    const editPreviewUrl = stagedPreviewUrl;

    const primaryLabel = editMode
        ? (applying ? "Enregistrement..." : remainingMs > 0 ? fmtCountdown(remainingMs) : "Appliquer")
        : "Modifier";
    const secondaryLabel = editMode ? "Annuler" : "Fermer";

    return (
        <div className={styles.popup} onClick={(e) => e.stopPropagation()}>
            <div className={styles.popupTitle}>{parking.name}</div>

            {/* Bloc photo */}
            <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
                <label className={styles.sliderLabel}>Photo du parking</label>

                <div
                    {...(editMode
                        ? {
                            role: "button" as const,
                            tabIndex: 0,
                            onClick: onPickFileClick,
                            onKeyDown: (e: any) => (e.key === "Enter" || e.key === " " ? onPickFileClick() : null),
                            title: "Choisir une photo",
                            "aria-label": "Choisir une photo du parking",
                        }
                        : {})}
                    style={{
                        width: "100%",
                        maxHeight: 150,
                        borderRadius: 8,
                        overflow: "hidden",
                        border: (editMode ? editPreviewUrl : readPhotoUrl) ? "none" : "1px dashed #ccc",
                        position: "relative",
                        aspectRatio: "16 / 9",
                        background: "#f8f8f8",
                        cursor: editMode ? "pointer" : "default",
                        display: "grid",
                        placeItems: "center",
                    }}
                >
                    {editMode ? (
                        editPreviewUrl ? (
                            <img
                                src={editPreviewUrl}
                                alt={`${parking.name} - photo`}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                        ) : (
                            <div style={{ textAlign: "center", color: "#666", fontSize: 13, userSelect: "none" }}>
                                Cliquer pour ajouter une photo
                            </div>
                        )
                    ) : readPhotoUrl ? (
                        <img
                            src={readPhotoUrl}
                            alt={`${parking.name} - photo`}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                    ) : (
                        <div style={{ width: "100%", height: "100%" }} />
                    )}

                    {editMode && stagedFile && (
                        <div
                            style={{
                                position: "absolute",
                                bottom: 8,
                                right: 8,
                                padding: "4px 8px",
                                borderRadius: 999,
                                background: "rgba(0,0,0,0.6)",
                                color: "white",
                                fontSize: 12,
                            }}
                        >
                            Modif non enregistrée
                        </div>
                    )}
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={onFileChange}
                    disabled={!editMode || uploading || applying}
                    style={{ display: "none" }}
                />

                {editMode && uploading && <div style={{ fontSize: 12, color: "#666" }}>Préparation de l’aperçu…</div>}
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
                style={{ ["--thumb" as any]: getColorFromValue(value), pointerEvents: editMode ? "auto" : "none" }}
                disabled={!editMode || applying}
            />

            <div className={styles.popupSince}>Dernière mise à jour il y a {timeAgo(parking.lastUpdated)}</div>

            <div className={styles.popupFooter}>
                <button onClick={handleSecondary} className={`${styles.btn} ${styles.btnGhost}`} disabled={applying}>
                    {secondaryLabel}
                </button>
                <button
                    onClick={handlePrimary}
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    aria-live="polite"
                    aria-busy={applying || undefined}
                    disabled={editMode ? (remainingMs > 0 || applying) : false}
                >
                    {primaryLabel}
                </button>
            </div>
        </div>
    );
}





export default function CampusMap({ nightmode }: { nightmode: boolean }) {
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
            style: nightmode ? STYLE_DARK : STYLE_LIGHT,
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
    }, [nightmode]);

    const syncLayersWithMap = useCallback((mm: maplibregl.Map) => {
        parkings.forEach((p) => {
            const sourceId = `parking-${p.id}`;
            const layerId = `parking-${p.id}`;
            const isPoint = p.coordinates.length === 1;

            const geometry: Point | LineString = isPoint
                ? ({ type: "Point", coordinates: p.coordinates[0] as Position } as Point)
                : ({ type: "LineString", coordinates: p.coordinates as Position[] } as LineString);

            const data: Feature<Point | LineString> = { type: "Feature", properties: { id: p.id, size: p.size }, geometry };

            const src = mm.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
            if (!src) {
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
                const pick = (e: any) => {
                    const f = e.features?.[0];
                    const id = Number(f?.properties?.id ?? p.id);
                    const fresh = parkingsRef.current.find((x) => x.id === id) ?? p;
                    selectedParkingRef.current = fresh;
                    setSelectedParking(fresh);
                };
                mm.on("click", layerId, pick);
                mm.on("touchstart", layerId, pick);
            } else {
                src.setData(data as any);
                if (mm.getLayer(layerId)) {
                    if (isPoint) {
                        mm.setPaintProperty(layerId, "circle-color", getColorFromValue(p.occupation ?? 0));
                        mm.setPaintProperty(layerId, "circle-radius", p.size);
                    } else {
                        mm.setPaintProperty(layerId, "line-color", getColorFromValue(p.occupation ?? 0));
                        mm.setPaintProperty(layerId, "line-width", p.size);
                    }
                }
            }
        });
    }, [parkings]);

    useEffect(() => {
        const m = mapRef.current;
        if (!m) return;

        if (!m.isStyleLoaded()) {
            const onLoad = () => syncLayersWithMap(m);
            m.on("load", onLoad);
            return () => { m.off("load", onLoad); };
        }
        syncLayersWithMap(m);
    }, [parkings, syncLayersWithMap]);

    useEffect(() => {
        const m = mapRef.current;
        if (!m) return;

        const styleUrl = nightmode ? STYLE_DARK : STYLE_LIGHT;
        m.setStyle(styleUrl);
        const reapplyOnce = () => {
            if (!m.isStyleLoaded()) return;
            m.off("idle", reapplyOnce);
            syncLayersWithMap(m);
        };
        m.on("idle", reapplyOnce);

        return () => { m.off("idle", reapplyOnce); };
    }, [nightmode, syncLayersWithMap]);

    const handleApply = async (newOccupation: number) => {
        if (!selectedParking) return;

        const key = `edit:${selectedParking.id}`;
        const { allowed, remainingMs } = checkCooldown(key);
        if (!allowed) {
            alert(`Trop rapide ! Réessaie dans ${fmtCountdown(remainingMs)}.`);
            return;
        }

        const newColor = getColorFromValue(newOccupation);
        setParkings((prev) =>
            prev.map((p) =>
                p.id === selectedParking.id ? { ...p, occupation: newOccupation, lastUpdated: Date.now() } : p
            )
        );
        setSelectedParking((prev) => prev ? { ...prev, occupation: newOccupation, lastUpdated: Date.now() } : prev);

        const ref = doc(db, "parkings", String(selectedParking.id));
        await updateDoc(ref, { occupation: newOccupation, lastUpdated: Date.now() })
            .catch(async () => {
                await setDoc(ref, { ...selectedParking, occupation: newOccupation, lastUpdated: Date.now() });
            });

        const map = mapRef.current;
        const layerId = `parking-${selectedParking.id}`;
        if (map && map.getLayer(layerId)) {
            map.setPaintProperty(layerId, "line-color", newColor);
            map.setPaintProperty(layerId, "circle-color", newColor);
        }
        startCooldown(key, COOLDOWN_MIN);
    };

    return (
        <div className={styles.mapSectionRoot}>
            <div ref={containerRef} className={styles.mapCanvas} />
            {selectedParking && <div onClick={() => setSelectedParking(null)} className={styles.modalOverlay} />}
            {selectedParking && (
                <div className={styles.modalWrapper}>
                    <ParkingPopup
                        parking={selectedParking}
                        onClose={() => setSelectedParking(null)}
                        onApply={handleApply}
                        cooldownKey={`edit:${selectedParking.id}`}
                    />
                </div>
            )}
        </div>
    );
}
