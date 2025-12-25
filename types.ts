
export enum Faction {
  ENTENTE = 'Triple Entente',
  CENTRAL = 'Potencias Centrales'
}

export enum UnitType {
  INFANTRY = 'Infantería',
  ARTILLERY = 'Artillería',
  CAVALRY = 'Caballería',
  TANK = 'Tanque',
  STURMTRUPPEN = 'Sturmtruppen',
  RECON = 'Reconocimiento',
  HEAVY_ARTILLERY = 'Gran Artillería'
}

export enum TerrainType {
  GRASS = 'Pasto',
  MUD = 'Lodo',
  TRENCH = 'Trinchera',
  CITY = 'Ciudad',
  FOREST = 'Bosque',
  HQ = 'Cuartel General',
  STRATEGIC_POINT = 'Punto Estratégico'
}

export interface Unit {
  id: string;
  type: UnitType;
  faction: Faction;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  range: number;
  moveRange: number;
  hasMoved: boolean;
  hasAttacked: boolean;
  x: number;
  y: number;
  experience: number;
  level: number;
}

export interface Tile {
  x: number;
  y: number;
  terrain: TerrainType;
  factionControl: Faction | null;
}

export interface Territory {
  id: string;
  name: string;
  description: string;
  difficulty: 'Fácil' | 'Normal' | 'Difícil' | 'Extremo';
  unlocked: boolean;
  conquered: boolean;
}

export interface GameState {
  turn: number;
  currentFaction: Faction;
  units: Unit[];
  map: Tile[][];
  selectedUnitId: string | null;
  selectedTile: {x: number, y: number} | null;
  logs: string[];
  victory: Faction | null;
  newsReport: string;
  screen: 'menu' | 'intro' | 'campaign' | 'playing' | 'tutorial';
  budget: { [key in Faction]: number };
  activeTerritory: Territory | null;
}
