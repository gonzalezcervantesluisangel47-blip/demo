
import React from 'react';
import { TerrainType, Faction } from '../types';

interface HexagonProps {
  x: number;
  y: number;
  terrain: TerrainType;
  factionControl: Faction | null;
  isSelected: boolean;
  isReachable: boolean;
  isAttackable: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}

const TERRAIN_COLORS = {
  [TerrainType.GRASS]: '#4d5d33',
  [TerrainType.MUD]: '#5c4033',
  [TerrainType.TRENCH]: '#3d3d3d',
  [TerrainType.CITY]: '#787878',
  [TerrainType.FOREST]: '#2d3b1e',
  [TerrainType.HQ]: '#1a1a1a',
  [TerrainType.STRATEGIC_POINT]: '#2a2a2a',
};

const Hexagon: React.FC<HexagonProps> = ({ 
  x, y, terrain, factionControl, isSelected, isReachable, isAttackable, onClick, children 
}) => {
  const size = 45;
  const width = Math.sqrt(3) * size;
  const height = 2 * size;
  const xPos = x * width * 0.95 + (y % 2 === 1 ? width / 2 : 0);
  const yPos = y * height * 0.75;

  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = (60 * i - 30) * Math.PI / 180;
    points.push(`${size * Math.cos(angle)},${size * Math.sin(angle)}`);
  }

  let strokeColor = '#222';
  let strokeWidth = 1;
  let fillOpacity = 1;

  if (isSelected) {
    strokeColor = '#facc15';
    strokeWidth = 3;
  } else if (isAttackable) {
    strokeColor = '#ef4444';
    strokeWidth = 3;
    fillOpacity = 0.8;
  } else if (isReachable) {
    strokeColor = '#60a5fa';
    strokeWidth = 2;
  }

  const controlFill = factionControl === Faction.ENTENTE 
    ? 'rgba(59, 130, 246, 0.35)' 
    : factionControl === Faction.CENTRAL 
      ? 'rgba(239, 68, 68, 0.35)' 
      : 'transparent';

  return (
    <g 
      transform={`translate(${xPos + size}, ${yPos + size})`} 
      onClick={onClick}
      className="cursor-pointer transition-all duration-300"
    >
      <polygon
        points={points.join(' ')}
        fill={TERRAIN_COLORS[terrain]}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        fillOpacity={fillOpacity}
      />
      
      {/* Indicador de influencia territorial */}
      <polygon
        points={points.join(' ')}
        fill={controlFill}
        pointerEvents="none"
      />
      
      {terrain === TerrainType.HQ && (
         <g opacity="0.8">
           <circle r="12" fill="none" stroke="gold" strokeWidth="2" strokeDasharray="4 2" />
           <path d="M-8,-8 L8,8 M-8,8 L8,-8" stroke="gold" strokeWidth="1" />
           <foreignObject x="-10" y="-10" width="20" height="20">
             <div className="flex items-center justify-center h-full text-[10px] text-gold-500">
               <i className="fas fa-star text-yellow-500"></i>
             </div>
           </foreignObject>
         </g>
      )}

      {terrain === TerrainType.STRATEGIC_POINT && (
        <g>
          <circle r="15" fill="rgba(0,0,0,0.5)" stroke={factionControl ? (factionControl === Faction.ENTENTE ? '#3b82f6' : '#ef4444') : '#555'} strokeWidth="2" strokeDasharray="2 1" />
          <foreignObject x="-10" y="-15" width="20" height="20">
            <div className={`flex items-center justify-center h-full ${factionControl ? (factionControl === Faction.ENTENTE ? 'text-blue-400' : 'text-red-400') : 'text-stone-500'}`}>
              <i className={`fas ${factionControl ? 'fa-flag' : 'fa-flag-checkered'} text-sm animate-bounce`}></i>
            </div>
          </foreignObject>
        </g>
      )}
      
      {children}
    </g>
  );
};

export default Hexagon;
