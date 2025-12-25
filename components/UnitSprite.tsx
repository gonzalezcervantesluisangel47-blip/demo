
import React from 'react';
import { UnitType, Faction } from '../types';

interface UnitSpriteProps {
  type: UnitType;
  faction: Faction;
  hasMoved: boolean;
  hpPercentage: number;
  level: number;
}

const UnitSprite: React.FC<UnitSpriteProps> = ({ type, faction, hasMoved, hpPercentage, level }) => {
  const factionColor = faction === Faction.ENTENTE ? '#3b82f6' : '#ef4444';
  
  const getIcon = () => {
    switch (type) {
      case UnitType.INFANTRY: return 'fa-person-rifle';
      case UnitType.ARTILLERY: return 'fa-cannon';
      case UnitType.CAVALRY: return 'fa-horse';
      case UnitType.TANK: return 'fa-truck-monster';
      case UnitType.STURMTRUPPEN: return 'fa-bolt';
      case UnitType.RECON: return 'fa-binoculars';
      case UnitType.HEAVY_ARTILLERY: return 'fa-explosion';
      default: return 'fa-user';
    }
  };

  return (
    <g className={`transition-all duration-300 ${hasMoved ? 'opacity-60' : 'opacity-100'}`}>
      {/* Level Glow */}
      {level > 1 && (
        <circle r="22" fill="none" stroke={level === 3 ? "gold" : "silver"} strokeWidth="2" strokeDasharray="4 2" className="animate-pulse" />
      )}
      
      <circle r="20" fill={factionColor} stroke="white" strokeWidth="2" />
      
      <foreignObject x="-12" y="-12" width="24" height="24">
        <div className="flex items-center justify-center text-white text-sm">
          <i className={`fas ${getIcon()}`}></i>
        </div>
      </foreignObject>

      {/* Veterancy Insignia */}
      {level > 1 && (
        <g transform="translate(14, -14)">
          <circle r="6" fill="#1a1a1a" stroke={level === 3 ? "gold" : "silver"} strokeWidth="1" />
          <text y="2.5" textAnchor="middle" fontSize="6" fill="white" fontWeight="bold" className="font-mono">
            {level === 3 ? '★' : 'v'}
          </text>
        </g>
      )}

      {/* HP Bar */}
      <rect x="-15" y="18" width="30" height="4" fill="#333" />
      <rect x="-15" y="18" width={30 * hpPercentage} height="4" fill={hpPercentage > 0.3 ? "#22c55e" : "#ef4444"} />
    </g>
  );
};

export default UnitSprite;
