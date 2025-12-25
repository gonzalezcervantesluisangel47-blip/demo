
import { GoogleGenAI } from "@google/genai";
import { Faction, Unit, Tile } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateWarReport = async (
  turn: number,
  faction: Faction,
  recentEvents: string[],
  units: Unit[],
  map: Tile[][]
): Promise<string> => {
  try {
    const totalTiles = map.length * map[0].length;
    const ententeTiles = map.flat().filter(t => t.factionControl === Faction.ENTENTE).length;
    const centralTiles = map.flat().filter(t => t.factionControl === Faction.CENTRAL).length;
    
    const ententePercent = Math.round((ententeTiles / totalTiles) * 100);
    const centralPercent = Math.round((centralTiles / totalTiles) * 100);

    const prompt = `
      Actúa como un corresponsal de guerra durante la Primera Guerra Mundial en 1914.
      Escribe un "Parte de Guerra" corto y atmosférico (máximo 70 palabras) para la facción: ${faction}.
      Escribe OBLIGATORIAMENTE en ESPAÑOL.
      Turno: ${turn}
      Estado de la Conquista:
      - Control de la Entente: ${ententePercent}%
      - Control de las Potencias Centrales: ${centralPercent}%
      - Eventos recientes: ${recentEvents.slice(-2).join(', ')}
      
      Estilo: Bélico, dramático. Habla sobre la ganancia o pérdida de terreno, la moral de las tropas y la visión de la victoria o la derrota inminente.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Las líneas de comunicación han sido cortadas.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "El frente permanece en silencio absoluto.";
  }
};
