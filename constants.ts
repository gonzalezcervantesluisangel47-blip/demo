
import { UnitType, TerrainType, Faction, Territory } from './types';

export const MAP_WIDTH = 22;
export const MAP_HEIGHT = 15;

export const UNIT_COSTS = {
  [UnitType.INFANTRY]: 15,
  [UnitType.RECON]: 20,
  [UnitType.CAVALRY]: 25,
  [UnitType.ARTILLERY]: 30,
  [UnitType.STURMTRUPPEN]: 35,
  [UnitType.TANK]: 50,
  [UnitType.HEAVY_ARTILLERY]: 60,
};

export const UNIT_STATS = {
  [UnitType.INFANTRY]: { hp: 12, attack: 4, defense: 3, range: 1, moveRange: 2 },
  [UnitType.ARTILLERY]: { hp: 8, attack: 7, defense: 1, range: 3, moveRange: 1 },
  [UnitType.CAVALRY]: { hp: 10, attack: 5, defense: 2, range: 1, moveRange: 4 },
  [UnitType.TANK]: { hp: 20, attack: 8, defense: 6, range: 1, moveRange: 2 },
  [UnitType.STURMTRUPPEN]: { hp: 14, attack: 9, defense: 2, range: 1, moveRange: 3 },
  [UnitType.RECON]: { hp: 8, attack: 4, defense: 2, range: 1, moveRange: 5 },
  [UnitType.HEAVY_ARTILLERY]: { hp: 8, attack: 10, defense: 1, range: 4, moveRange: 1 }
};

export const TERRAIN_MODIFIERS = {
  [TerrainType.GRASS]: { defense: 0, moveCost: 1 },
  [TerrainType.MUD]: { defense: -1, moveCost: 2 },
  [TerrainType.TRENCH]: { defense: 3, moveCost: 1 },
  [TerrainType.CITY]: { defense: 2, moveCost: 1 },
  [TerrainType.FOREST]: { defense: 1, moveCost: 2 },
  [TerrainType.HQ]: { defense: 5, moveCost: 1 },
  [TerrainType.STRATEGIC_POINT]: { defense: 1, moveCost: 1 }
};

export const VETERANCY_THRESHOLDS = [0, 15, 40];

export const CAMPAIGN_TERRITORIES: Territory[] = [
  { id: 'flanders', name: 'Frente de Flandes', description: 'Terreno pantanoso y trincheras profundas. El lodo es tu peor enemigo.', difficulty: 'Fácil', unlocked: true, conquered: false },
  { id: 'somme', name: 'Valle del Somme', description: 'Grandes planicies ideales para el despliegue de tanques y caballería.', difficulty: 'Normal', unlocked: true, conquered: false },
  { id: 'verdun', name: 'Fortaleza de Verdún', description: 'Un asedio brutal en terreno boscoso y colinas fortificadas.', difficulty: 'Difícil', unlocked: true, conquered: false },
  { id: 'tannenberg', name: 'Cerco de Tannenberg', description: 'Enormes distancias y superioridad numérica enemiga en el frente oriental.', difficulty: 'Extremo', unlocked: true, conquered: false },
];

export const generateInitialMap = (): TerrainType[][] => {
  const map: TerrainType[][] = [];
  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row: TerrainType[] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      let terrain = TerrainType.GRASS;
      if (x === 0 && y === 0) terrain = TerrainType.HQ;
      else if (x === MAP_WIDTH - 1 && y === MAP_HEIGHT - 1) terrain = TerrainType.HQ;
      else {
        // Puntos estratégicos en ubicaciones clave
        const isStrat = (
          (x === 5 && y === 7) || 
          (x === 16 && y === 7) || 
          (x === 11 && y === 3) || 
          (x === 11 && y === 11) ||
          (x === 6 && y === 3) ||
          (x === 15 && y === 12)
        );

        if (isStrat) {
          terrain = TerrainType.STRATEGIC_POINT;
        } else {
          const rand = Math.random();
          const isCenter = Math.abs(x - MAP_WIDTH / 2) < 4;
          if (isCenter) {
            if (rand < 0.65) terrain = TerrainType.MUD;
            else if (rand < 0.85) terrain = TerrainType.TRENCH;
            else terrain = TerrainType.GRASS;
          } else {
            if (rand < 0.15) terrain = TerrainType.FOREST;
            else if (rand < 0.05) terrain = TerrainType.CITY;
            else if (rand < 0.04) terrain = TerrainType.TRENCH;
            else terrain = TerrainType.GRASS;
          }
        }
      }
      row.push(terrain);
    }
    map.push(row);
  }
  return map;
};

export const INITIAL_MAP = generateInitialMap();
