export interface Spot {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Seaward normal of the coast, °. */
  facingDeg: number;
  /** How much the tide level matters for this spot, 0–1. */
  tideWeight: number;
  /** Czech one-liner: what to see, where to stand. */
  note: string;
}

export const DEFAULT_SPOT_ID = 'san-juan-canal';

export const SPOTS: readonly Spot[] = [
  {
    id: 'san-juan-canal',
    name: 'Playa de San Juan de la Canal',
    lat: 43.474,
    lon: -3.893,
    facingDeg: 0,
    tideWeight: 0.4,
    note: 'Úzká zátoka mezi skalními stěnami – vlny se tu tříští o skály.',
  },
  {
    id: 'costa-quebrada',
    name: 'Costa Quebrada (La Arnía)',
    lat: 43.476,
    lon: -3.917,
    facingDeg: 340,
    tideWeight: 0.4,
    note: 'Skalní žebra a útesy, nejlepší kolem přílivu.',
  },
  {
    id: 'cabo-mayor',
    name: 'Faro de Cabo Mayor',
    lat: 43.49,
    lon: -3.791,
    facingDeg: 0,
    tideWeight: 0.3,
    note: 'Útesy pod majákem, vlny bijí přímo do skal.',
  },
  {
    id: 'sardinero',
    name: 'El Sardinero',
    lat: 43.474,
    lon: -3.783,
    facingDeg: 60,
    tideWeight: 0.2,
    note: 'Chráněná městská pláž – klidná varianta na srovnání.',
  },
  {
    id: 'cabo-ajo',
    name: 'Cabo de Ajo',
    lat: 43.512,
    lon: -3.587,
    facingDeg: 0,
    tideWeight: 0.3,
    note: 'Nejsevernější mys Kantábrie, velmi odkrytý.',
  },
  {
    id: 'canallave',
    name: 'Playa de Canallave',
    lat: 43.45,
    lon: -3.962,
    facingDeg: 330,
    tideWeight: 0.3,
    note: 'Odkrytá surfařská pláž u dun Liencres.',
  },
  {
    id: 'punta-afuera',
    name: 'Punta del Torco de Afuera (Suances)',
    lat: 43.442,
    lon: -4.043,
    facingDeg: 0,
    tideWeight: 0.3,
    note: 'Mys s majákem u ústí řeky v Suances.',
  },
];

export function getSpot(id: string): Spot | undefined {
  return SPOTS.find((s) => s.id === id);
}
