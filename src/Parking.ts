import { getColorFromValue } from "@/utils";

export type Parking = {
    id: number;
    name: string;
    lastUpdated: number;
    capacity: number;
    occupation: number;
    coordinates: [number, number][];
    paint: { "line-color": string; "line-width": number };
    open: boolean;
};

export const SEED: Parking[] = [
    {
        id: 1,
        name: "Parking Novotel",
        lastUpdated: Date.now() - 1000 * 60 * 7,
        capacity: 50,
        occupation: 75,
        coordinates: [
            [7.058096, 43.613590],
            [7.058429, 43.613751],
            [7.058788, 43.614141],
            [7.059145, 43.614246],
            [7.059400, 43.614052],
            [7.059598, 43.614133],
        ],
        paint: { "line-color": getColorFromValue(75), "line-width": 10 },
        open: true,
    },
    {
        id: 2,
        name: "Parking CROUS",
        lastUpdated: Date.now() - 1000 * 60 * 7,
        capacity: 50,
        occupation: 75,
        coordinates: [
            [7.057624, 43.614007],
            [7.057694, 43.614054],
            [7.057739, 43.614126],
            [7.057750, 43.614310],
            [7.057678, 43.614755],
            [7.057552, 43.615333],
        ],
        paint: { "line-color": getColorFromValue(75), "line-width": 10 },
        open: true,
    },
    {
        id: 3,
        name: "Parking rue",
        lastUpdated: Date.now() - 1000 * 60 * 7,
        capacity: 50,
        occupation: 75,
        coordinates: [
            [7.055760, 43.614054],
            [7.055854, 43.614062],
            [7.055937, 43.614060],
            [7.056039, 43.614068],
            [7.056077, 43.614072],
        ],
        paint: { "line-color": getColorFromValue(75), "line-width": 10 },
        open: true,
    },
];