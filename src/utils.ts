export function getColorFromValue(v: number): string {
    if (v <= 50) {
        const t = v / 50;
        const r = Math.round(0 + (255 - 0) * t);
        const g = Math.round(200 + (255 - 200) * t);
        const b = 0;
        return `rgb(${r}, ${g}, ${b})`;
    } else {
        const t = (v - 50) / 50;
        const r = 255;
        const g = Math.round(255 - 255 * t);
        const b = 0;
        return `rgb(${r}, ${g}, ${b})`;
    }
}

export function timeAgo(ts: number): string {
    const secs = Math.floor((Date.now() - ts) / 1000);
    if (secs < 60) return `${secs} seconde${secs > 1 ? "s" : ""}`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins} minute${mins > 1 ? "s" : ""}`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} heure${hours > 1 ? "s" : ""}`;
    const days = Math.floor(hours / 24);
    return `${days} jour${days > 1 ? "s" : ""}`;
}