
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Faction, Unit, Tile, UnitType, TerrainType, GameState, Territory } from './types';
import { MAP_WIDTH, MAP_HEIGHT, INITIAL_MAP, UNIT_STATS, TERRAIN_MODIFIERS, UNIT_COSTS, VETERANCY_THRESHOLDS, generateInitialMap, CAMPAIGN_TERRITORIES } from './constants';
import { generateWarReport } from './services/geminiService';
import Hexagon from './components/Hexagon';
import UnitSprite from './components/UnitSprite';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(() => {
    const map: Tile[][] = INITIAL_MAP.map((row, y) => 
      row.map((terrain, x) => ({ 
        x, y, terrain, 
        factionControl: terrain === TerrainType.HQ ? (x === 0 ? Faction.ENTENTE : Faction.CENTRAL) : null 
      }))
    );

    return {
      turn: 1,
      currentFaction: Faction.ENTENTE,
      units: [],
      map,
      selectedUnitId: null,
      selectedTile: null,
      logs: ["Operaciones iniciadas."],
      victory: null,
      newsReport: "Esperando órdenes del Alto Mando.",
      screen: 'menu',
      budget: { [Faction.ENTENTE]: 60, [Faction.CENTRAL]: 100 },
      activeTerritory: null
    };
  });

  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);

  const getUnitAt = useCallback((x: number, y: number) => gameState.units.find(u => u.x === x && u.y === y), [gameState.units]);

  function getNeighbors(x: number, y: number) {
    const neighbors = [];
    const evenOffsets = [[1,0], [1,-1], [0,-1], [-1,0], [0,1], [1,1]];
    const oddOffsets = [[1,0], [0,-1], [-1,-1], [-1,0], [-1,1], [0,1]];
    const offsets = y % 2 === 0 ? evenOffsets : oddOffsets;
    for (const [dx, dy] of offsets) {
      const nx = x + dx; const ny = y + dy;
      if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT) neighbors.push({x: nx, y: ny});
    }
    return neighbors;
  }

  function getDistance(x1: number, y1: number, x2: number, y2: number) {
    const toCube = (x: number, y: number) => {
      const q = x - (y + (y & 1)) / 2;
      const r = y;
      return {q, r, s: -q - r};
    };
    const a = toCube(x1, y1); const b = toCube(x2, y2);
    return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.s - b.s));
  }

  // Capturar sector: Captura el punto y sus vecinos inmediatos (Mecánica estilo Company of Heroes)
  const captureSector = (x: number, y: number, faction: Faction, currentMap: Tile[][]) => {
    const neighbors = getNeighbors(x, y);
    const affectedTiles = [{x, y}, ...neighbors];
    
    return currentMap.map((row, ry) => 
      row.map((tile, rx) => {
        const isAffected = affectedTiles.some(t => t.x === rx && t.y === ry);
        if (isAffected) {
          return { ...tile, factionControl: faction };
        }
        return tile;
      })
    );
  };

  const getReachable = useCallback((unitId: string) => {
    const unit = gameState.units.find(u => u.id === unitId);
    if (!unit || unit.hasMoved) return [];
    const reachable: {x: number, y: number}[] = [];
    const queue: {x: number, y: number, dist: number}[] = [{x: unit.x, y: unit.y, dist: 0}];
    const visited = new Set<string>();
    while (queue.length > 0) {
      const {x, y, dist} = queue.shift()!;
      const key = `${x},${y}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (dist > 0) reachable.push({x, y});
      if (dist < unit.moveRange) {
        for (const n of getNeighbors(x, y)) {
          const terrain = gameState.map[n.y]?.[n.x]?.terrain;
          if (!terrain) continue;
          if (getUnitAt(n.x, n.y)) continue; 
          const moveCost = TERRAIN_MODIFIERS[terrain].moveCost;
          if (dist + moveCost <= unit.moveRange) queue.push({x: n.x, y: n.y, dist: dist + moveCost});
        }
      }
    }
    return reachable;
  }, [gameState.units, gameState.map, getUnitAt]);

  const reachableTiles = useMemo(() => {
    if (!gameState.selectedUnitId) return [];
    return getReachable(gameState.selectedUnitId);
  }, [gameState.selectedUnitId, getReachable]);

  const attackableTiles = useMemo(() => {
    if (!gameState.selectedUnitId) return [];
    const unit = gameState.units.find(u => u.id === gameState.selectedUnitId);
    if (!unit || unit.hasAttacked) return [];
    
    const tiles: {x: number, y: number}[] = [];
    // Radio de ataque teórico visual
    for (let dy = -unit.range; dy <= unit.range; dy++) {
      for (let dx = -unit.range; dx <= unit.range; dx++) {
        const tx = unit.x + dx;
        const ty = unit.y + dy;
        if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
          if (getDistance(unit.x, unit.y, tx, ty) <= unit.range) {
            tiles.push({x: tx, y: ty});
          }
        }
      }
    }
    return tiles;
  }, [gameState.selectedUnitId, gameState.units]);

  const executeAttack = (attacker: Unit, defender: Unit) => {
    const terrain = gameState.map[defender.y][defender.x].terrain;
    const defenseBonus = TERRAIN_MODIFIERS[terrain].defense;
    const damage = Math.max(1, attacker.attack - (defender.defense + defenseBonus) + Math.floor(Math.random() * 3));
    const newHp = Math.max(0, defender.hp - damage);
    const died = newHp <= 0;
    const xpGained = 2 + (died ? 10 : 0);

    let newUnits = gameState.units.map(u => {
      if (u.id === defender.id) return { ...u, hp: newHp };
      if (u.id === attacker.id) {
        const updatedAttacker = { ...u, experience: u.experience + xpGained, hasAttacked: true, hasMoved: true };
        // Lógica de subida de nivel simplificada aquí o via checkLevelUp
        return updatedAttacker; 
      }
      return u;
    });

    if (died) newUnits = newUnits.filter(u => u.id !== defender.id);

    setGameState(prev => {
      const remainingFactions = new Set(newUnits.map(u => u.faction));
      return {
        ...prev,
        units: newUnits,
        logs: [`${attacker.faction} atacó. ${damage} bajas causadas.`, ...prev.logs],
        selectedUnitId: null,
        victory: remainingFactions.size === 1 ? Array.from(remainingFactions)[0] : prev.victory
      };
    });
  };

  const startBattle = (territory: Territory) => {
    const newMapLayout = generateInitialMap();
    setGameState(prev => ({
      ...prev,
      screen: 'playing',
      activeTerritory: territory,
      turn: 1,
      currentFaction: Faction.ENTENTE,
      budget: { [Faction.ENTENTE]: 80, [Faction.CENTRAL]: 100 },
      units: [
        { id: 'e1', type: UnitType.INFANTRY, faction: Faction.ENTENTE, x: 1, y: 1, ...UNIT_STATS[UnitType.INFANTRY], hasMoved: false, hasAttacked: false, maxHp: UNIT_STATS[UnitType.INFANTRY].hp, experience: 0, level: 1 },
        { id: 'c1', type: UnitType.INFANTRY, faction: Faction.CENTRAL, x: 20, y: 13, ...UNIT_STATS[UnitType.INFANTRY], hasMoved: false, hasAttacked: false, maxHp: UNIT_STATS[UnitType.INFANTRY].hp, experience: 0, level: 1 },
      ],
      map: newMapLayout.map((row, y) => 
        row.map((terrain, x) => ({ 
          x, y, terrain, 
          factionControl: terrain === TerrainType.HQ ? (x === 0 ? Faction.ENTENTE : Faction.CENTRAL) : null 
        }))
      ),
      logs: [`Batalla iniciada en ${territory.name}.`],
      victory: null
    }));
  };

  const handleTileClick = (x: number, y: number) => {
    if (gameState.victory || isAiThinking) return;
    const unitAtTile = getUnitAt(x, y);
    const tile = gameState.map[y][x];

    // Selección de unidades
    if (unitAtTile && unitAtTile.faction === gameState.currentFaction) {
      setGameState(prev => ({ ...prev, selectedUnitId: unitAtTile.id, selectedTile: null }));
      return;
    }

    // Selección de HQ para reclutamiento
    if (tile.terrain === TerrainType.HQ && tile.factionControl === gameState.currentFaction) {
      setGameState(prev => ({ ...prev, selectedTile: {x, y}, selectedUnitId: null }));
      return;
    }

    if (gameState.selectedUnitId) {
      const unit = gameState.units.find(u => u.id === gameState.selectedUnitId)!;
      
      // Movimiento y Captura
      if (reachableTiles.some(t => t.x === x && t.y === y)) {
        let newMap = gameState.map.map((row, ry) => 
          row.map((tile, rx) => rx === x && ry === y ? { ...tile, factionControl: unit.faction } : tile)
        );

        // Si es un Punto Estratégico, capturar el sector
        if (tile.terrain === TerrainType.STRATEGIC_POINT) {
          newMap = captureSector(x, y, unit.faction, newMap);
          setGameState(p => ({ ...p, logs: [`¡Punto estratégico capturado por ${unit.faction}!`, ...p.logs] }));
        }

        const newUnits = gameState.units.map(u => u.id === unit.id ? { ...u, x, y, hasMoved: true } : u);
        setGameState(prev => ({ ...prev, map: newMap, units: newUnits, selectedUnitId: null }));
        return;
      }

      // Ataque
      if (unitAtTile && unitAtTile.faction !== gameState.currentFaction) {
        if (attackableTiles.some(t => t.x === x && t.y === y)) {
          executeAttack(unit, unitAtTile);
          return;
        }
      }
    }
    setGameState(prev => ({ ...prev, selectedUnitId: null, selectedTile: null }));
  };

  const recruitUnit = (type: UnitType) => {
    const cost = UNIT_COSTS[type];
    if (gameState.budget[gameState.currentFaction] < cost) return;
    const hqTile = gameState.selectedTile!;
    const neighbors = getNeighbors(hqTile.x, hqTile.y);
    const spawnPoint = neighbors.find(n => !getUnitAt(n.x, n.y));
    if (!spawnPoint) return;

    const newUnit: Unit = {
      id: `${gameState.currentFaction[0]}-${Date.now()}`,
      type, faction: gameState.currentFaction, x: spawnPoint.x, y: spawnPoint.y,
      ...UNIT_STATS[type], maxHp: UNIT_STATS[type].hp, hasMoved: true, hasAttacked: true, experience: 0, level: 1
    };

    setGameState(prev => ({
      ...prev,
      units: [...prev.units, newUnit],
      budget: { ...prev.budget, [prev.currentFaction]: prev.budget[prev.currentFaction] - cost },
      selectedTile: null
    }));
  };

  const endTurn = async () => {
    if (isAiThinking) return;
    const nextFaction = gameState.currentFaction === Faction.ENTENTE ? Faction.CENTRAL : Faction.ENTENTE;
    const isNewCycle = nextFaction === Faction.ENTENTE;
    
    // Ingresos por ciudades y puntos estratégicos
    const controlledTiles = gameState.map.flat().filter(t => t.factionControl === nextFaction);
    const cities = controlledTiles.filter(t => t.terrain === TerrainType.CITY).length;
    const stratPoints = controlledTiles.filter(t => t.terrain === TerrainType.STRATEGIC_POINT).length;
    const income = 20 + (cities * 10) + (stratPoints * 15);

    setIsLoadingReport(true);
    const report = await generateWarReport(gameState.turn, nextFaction, gameState.logs, gameState.units, gameState.map);
    setIsLoadingReport(false);

    setGameState(prev => ({
      ...prev,
      turn: isNewCycle ? prev.turn + 1 : prev.turn,
      currentFaction: nextFaction,
      units: prev.units.map(u => ({ ...u, hasMoved: false, hasAttacked: false })),
      budget: { ...prev.budget, [nextFaction]: prev.budget[nextFaction] + income },
      selectedUnitId: null, selectedTile: null, newsReport: report,
      logs: [`--- Turno: ${nextFaction} (+${income} PTS) ---`, ...prev.logs]
    }));
  };

  // IA Básica (Potencias Centrales)
  useEffect(() => {
    if (gameState.currentFaction === Faction.CENTRAL && !gameState.victory && gameState.screen === 'playing') {
      const runAi = async () => {
        setIsAiThinking(true);
        await new Promise(r => setTimeout(r, 1500));
        
        // IA muy básica: Mueve la primera unidad disponible hacia el frente
        const aiUnits = gameState.units.filter(u => u.faction === Faction.CENTRAL && !u.hasMoved);
        if (aiUnits.length > 0) {
          const unit = aiUnits[0];
          const moves = getReachable(unit.id);
          if (moves.length > 0) {
            // Mueve hacia la izquierda (Entente HQ)
            const bestMove = moves.reduce((prev, curr) => curr.x < prev.x ? curr : prev);
            handleTileClick(bestMove.x, bestMove.y);
          }
        }

        setIsAiThinking(false);
        endTurn();
      };
      runAi();
    }
  }, [gameState.currentFaction, gameState.screen]);

  // Pantalla de Menú
  if (gameState.screen === 'menu') {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-3xl bg-stone-900 border-4 border-double border-stone-800 p-16 shadow-[0_0_80px_rgba(255,0,0,0.2)] relative">
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-red-950 text-white px-4 py-1 font-typewriter text-[10px] tracking-[0.3em] uppercase border border-red-800">Estado Mayor General</div>
          <h1 className="text-6xl md:text-9xl font-bold mb-8 text-stone-500 font-typewriter tracking-tighter drop-shadow-2xl">TRINCHERAS <br/> <span className="text-red-900">1914</span></h1>
          <p className="text-stone-500 font-typewriter mb-12 text-lg italic leading-relaxed">"La guerra ha comenzado. El mapa de Europa está a punto de ser redibujado con sangre."</p>
          <button onClick={() => setGameState(p => ({...p, screen: 'intro'}))} className="bg-stone-200 text-black px-16 py-6 text-3xl font-bold font-typewriter hover:bg-white shadow-2xl border-b-8 border-stone-400 active:translate-y-2 active:border-b-0 transition-all">INICIAR CAMPAÑA</button>
        </div>
      </div>
    );
  }

  // Pantalla de Intro
  if (gameState.screen === 'intro') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-12 text-center font-typewriter">
        <div className="max-w-2xl space-y-12 animate-in fade-in duration-1000">
          <h2 className="text-4xl text-red-900 font-bold uppercase tracking-widest">Órdenes de Movilización</h2>
          <p className="text-xl text-stone-400 italic">"Las campanas de las iglesias han dejado de doblar por la paz. Los trenes van llenos de hombres jóvenes hacia un destino incierto. Usted ha sido asignado al Alto Mando para romper el estancamiento."</p>
          <p className="text-stone-500">Mecánica Detectada: Capture los Puntos Estratégicos para controlar sectores enteros del frente y asegurar suministros constantes.</p>
          <button onClick={() => setGameState(p => ({...p, screen: 'campaign'}))} className="text-red-800 hover:text-red-500 text-3xl uppercase tracking-[0.4em] pt-12 animate-pulse transition-colors">Abrir Mapa Táctico</button>
        </div>
      </div>
    );
  }

  // Pantalla de Campaña (Selección de Territorio)
  if (gameState.screen === 'campaign') {
    return (
      <div className="min-h-screen bg-[#1a1712] p-8 flex flex-col items-center">
        <header className="mb-12 text-center">
          <h2 className="text-stone-800 font-typewriter text-5xl mb-2 uppercase tracking-widest">TEATRO DE OPERACIONES</h2>
          <div className="h-1 bg-stone-800 w-96 mx-auto opacity-20"></div>
          <p className="text-stone-600 font-typewriter mt-4">Elija un sector para iniciar la ofensiva táctica.</p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-6xl w-full">
          {CAMPAIGN_TERRITORIES.map(t => (
            <div key={t.id} className="bg-[#e8dcc4] border-4 border-stone-900 p-8 shadow-[20px_20px_0px_rgba(0,0,0,0.2)] relative group cursor-pointer hover:-translate-y-2 transition-all" onClick={() => startBattle(t)}>
              <div className="absolute -top-4 -right-4 bg-stone-900 text-white px-4 py-2 text-xs font-typewriter uppercase border-2 border-[#e8dcc4]">{t.difficulty}</div>
              <h3 className="text-3xl font-bold text-stone-900 font-typewriter mb-4 border-b-2 border-stone-900/20 pb-2">{t.name}</h3>
              <p className="text-stone-800 italic text-base mb-8 leading-relaxed font-serif">{t.description}</p>
              <div className="flex justify-between items-center border-t border-stone-900/10 pt-4">
                <span className="text-stone-600 text-xs font-typewriter">OBJETIVO: CONQUISTA TOTAL</span>
                <span className="bg-red-950 text-stone-200 px-6 py-3 font-bold font-typewriter text-sm group-hover:bg-red-800 transition-colors">DESPLEGAR TROPAS</span>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setGameState(p => ({...p, screen: 'menu'}))} className="mt-16 text-stone-800 hover:text-black font-typewriter uppercase text-sm border-b-2 border-stone-900/30 pb-1">Volver al Cuartel General</button>
      </div>
    );
  }

  // Pantalla de Juego
  const conquestStats = {
    entente: Math.round((gameState.map.flat().filter(t => t.factionControl === Faction.ENTENTE).length / (MAP_WIDTH * MAP_HEIGHT)) * 100),
    central: Math.round((gameState.map.flat().filter(t => t.factionControl === Faction.CENTRAL).length / (MAP_WIDTH * MAP_HEIGHT)) * 100)
  };

  return (
    <div className="min-h-screen p-2 md:p-4 flex flex-col items-center gap-3 bg-[#080808]">
      <header className="w-full max-w-[1600px] flex flex-col gap-2 bg-stone-900/40 p-3 rounded-lg border border-stone-800 shadow-2xl">
        <div className="flex justify-between items-center">
           <div className="flex items-center gap-6">
             <button onClick={() => setGameState(p => ({...p, screen: 'campaign'}))} className="text-stone-600 hover:text-stone-300 font-typewriter text-xs uppercase"><i className="fas fa-map mr-2"></i> Mapa táctico</button>
             <div className="h-4 w-px bg-stone-800"></div>
             <div className="text-stone-300 font-typewriter text-sm">RECURSOS: <span className={gameState.currentFaction === Faction.ENTENTE ? 'text-blue-500' : 'text-red-600'}>{gameState.budget[gameState.currentFaction]} PTS</span></div>
           </div>
           <div className="text-stone-300 font-typewriter text-sm uppercase">{gameState.activeTerritory?.name} - SECTOR ACTIVO</div>
           <div className="text-stone-300 font-typewriter text-sm">TURNO {gameState.turn} - {gameState.currentFaction.toUpperCase()}</div>
        </div>
        <div className="w-full h-5 bg-stone-950 rounded-sm overflow-hidden border border-stone-800 flex shadow-inner relative">
           <div className="bg-blue-800 transition-all duration-1000 flex items-center justify-center text-[9px] font-bold" style={{ width: `${conquestStats.entente}%` }}>{conquestStats.entente}%</div>
           <div className="bg-red-800 transition-all duration-1000 flex items-center justify-center text-[9px] font-bold" style={{ width: `${conquestStats.central}%` }}>{conquestStats.central}%</div>
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[8px] uppercase tracking-widest text-stone-500">Control de Territorio</div>
        </div>
      </header>

      <main className="w-full max-w-[1600px] grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-9 bg-stone-900 border border-stone-800 rounded shadow-2xl overflow-hidden p-1 relative">
          <div className="overflow-auto max-h-[78vh] scrollbar-hide">
            <svg viewBox={`0 0 ${MAP_WIDTH * 85} ${MAP_HEIGHT * 75}`} className="w-full h-auto min-w-[1400px]">
              {gameState.map.map((row, y) => 
                row.map((tile, x) => {
                  const unit = getUnitAt(x, y);
                  return (
                    <Hexagon
                      key={`${x}-${y}`} x={x} y={y} terrain={tile.terrain} factionControl={tile.factionControl}
                      isSelected={gameState.selectedUnitId === unit?.id || (gameState.selectedTile?.x === x && gameState.selectedTile?.y === y)}
                      isReachable={reachableTiles.some(t => t.x === x && t.y === y)}
                      isAttackable={attackableTiles.some(t => t.x === x && t.y === y)}
                      onClick={() => handleTileClick(x, y)}
                    >
                      {unit && (
                        <UnitSprite 
                          type={unit.type} faction={unit.faction} 
                          hasMoved={unit.hasMoved && unit.hasAttacked}
                          hpPercentage={unit.hp / unit.maxHp}
                          level={unit.level}
                        />
                      )}
                    </Hexagon>
                  );
                })
              )}
            </svg>
          </div>
          <div className="absolute bottom-6 right-6 flex items-center gap-4">
            {isAiThinking && <div className="text-red-600 font-typewriter text-sm animate-pulse italic">Telegramas enemigos interceptados...</div>}
            <button onClick={endTurn} disabled={isLoadingReport || isAiThinking || !!gameState.victory} className="bg-stone-200 text-black px-12 py-4 rounded font-typewriter hover:bg-white shadow-2xl disabled:opacity-20 uppercase text-lg border-b-4 border-stone-400 active:translate-y-1 active:border-b-0 transition-all">
              {isLoadingReport ? 'INFORME EN CAMINO...' : 'PASAR ALTO MANDO'}
            </button>
          </div>
        </div>

        <div className="lg:col-span-3 flex flex-col gap-4 h-full">
          {gameState.selectedTile ? (
            <section className="bg-stone-950 border-2 border-yellow-900/40 p-4 rounded shadow-2xl animate-in slide-in-from-bottom">
              <h3 className="text-yellow-600 font-typewriter text-xs mb-4 uppercase tracking-widest border-b border-yellow-900/20 pb-2">Movilización de Reservas</h3>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(UNIT_COSTS).map(([type, cost]) => (
                  <button key={type} onClick={() => recruitUnit(type as UnitType)} disabled={gameState.budget[gameState.currentFaction] < cost} className="flex justify-between items-center bg-stone-900 hover:bg-stone-800 p-3 rounded text-xs font-mono disabled:opacity-20 border border-stone-800 transition-colors">
                    <span className="text-stone-300 uppercase">{type}</span>
                    <span className="text-yellow-600">{cost} PTS</span>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <>
              <section className="bg-stone-900/80 p-5 rounded border border-stone-800 shadow-xl min-h-[140px]">
                <h3 className="text-stone-500 font-typewriter text-[10px] mb-3 border-b border-stone-800 pb-1 uppercase tracking-widest">INFORME DE GEMINI</h3>
                <div className="font-typewriter text-sm text-stone-300 italic">
                  {isLoadingReport ? "Cifrando reporte de guerra..." : `"${gameState.newsReport}"`}
                </div>
              </section>
              <section className="bg-stone-950 p-4 rounded border border-stone-900 shadow-inner">
                 <h3 className="text-stone-600 font-typewriter text-[10px] mb-3 uppercase border-b border-stone-900 pb-1">Ficha Técnica</h3>
                 {gameState.selectedUnitId ? (
                   (() => {
                     const u = gameState.units.find(un => un.id === gameState.selectedUnitId)!;
                     return (
                       <div className="space-y-3 font-mono">
                         <div className="flex justify-between items-start">
                           <div className="text-stone-100 font-bold text-lg uppercase">{u.type}</div>
                           <div className="px-2 py-0.5 rounded text-[10px] bg-stone-800 text-stone-200">NV {u.level}</div>
                         </div>
                         <div className="grid grid-cols-2 gap-2 text-[10px] text-stone-500">
                           <span>DAÑO: {u.attack}</span>
                           <span>BLINDAJE: {u.defense}</span>
                           <span>COBERTURA: {u.hp}/{u.maxHp}</span>
                           <span>RANGO: {u.range}</span>
                         </div>
                         <div className="text-[9px] text-stone-400 italic">XP acumulada: {u.experience}</div>
                       </div>
                     );
                   })()
                 ) : <div className="text-stone-700 italic text-xs font-typewriter text-center py-4">Seleccione una unidad para análisis...</div>}
              </section>
              <section className="bg-stone-950 flex-1 p-4 rounded border border-stone-900 overflow-hidden flex flex-col min-h-[250px] shadow-inner">
                <h3 className="text-stone-600 font-typewriter text-[10px] mb-3 uppercase tracking-widest">Registro de Operaciones</h3>
                <div className="flex-1 overflow-y-auto space-y-2 font-mono text-[9px] text-stone-500 scrollbar-hide">
                  {gameState.logs.slice(0, 20).map((log, idx) => (
                    <div key={idx} className={`${idx === 0 ? 'text-stone-300 bg-stone-900/40 p-1' : ''} border-l border-stone-800 pl-2`}>{`> ${log}`}</div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      {gameState.victory && (
        <div className="fixed inset-0 bg-black/98 flex flex-col items-center justify-center z-[200] p-12 text-center animate-in zoom-in-95 duration-1000">
          <h2 className="text-9xl font-typewriter text-red-900 mb-8 drop-shadow-[0_0_40px_rgba(255,0,0,0.4)] uppercase">Sectores Tomados</h2>
          <p className="text-3xl text-stone-400 mb-16 max-w-3xl font-typewriter italic leading-relaxed">"El bando de {gameState.victory} ha logrado la superioridad táctica en {gameState.activeTerritory?.name}. La línea enemiga se ha derrumbado."</p>
          <button onClick={() => setGameState(p => ({...p, screen: 'campaign'}))} className="bg-stone-100 text-black px-24 py-6 rounded-sm font-bold uppercase text-3xl font-typewriter hover:bg-white shadow-[0_0_50px_rgba(255,255,255,0.1)] transition-all">VOLVER AL MAPA ESTRATÉGICO</button>
        </div>
      )}
    </div>
  );
};

export default App;
