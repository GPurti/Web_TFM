import { GeoJSON } from 'react-leaflet';
import geoZones from '../../data/ZGUAS_Aero.json';

export default function AeroZonesLayer() {
  const styleFeature = (feature) => {
    const type = feature.properties?.ExtendedProperties || '';
    let color = '#2196F3';
  
    if (['ATZ', 'CTA', 'CTR', 'FIZ', 'TMA'].includes(type)) color = '#2196F3';
    else if (['P-Prohibida', 'R-Restringida', 'TRA', 'TSA-Temporalmente Segregada'].includes(type)) color = '#FF0000';
    else if (['Aeródromo', 'Base militar de hidroaviones', 'Helipuerto', 'Superficie'].includes(type)) color = '#FFA500';
    else if (type === 'RVF') color = '#FFFF00';
  
    return {
      color,
      weight: 1,
      fillOpacity: 0.4,
    };
  };

  return <GeoJSON data={geoZones} style={styleFeature} />;
}
