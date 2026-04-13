import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet-polylinedecorator';

export default function RoutePreview({ waypoints, droneLocation, homeLocation, map, enabled = false }) {
  const layersRef = useRef({ polyline: null, decorator: null });

  useEffect(() => {
    if (!enabled || !map || waypoints.length < 2) {
      if (layersRef.current.polyline) {
        map.removeLayer(layersRef.current.polyline);
        layersRef.current.polyline = null;
      }
      if (layersRef.current.decorator) {
        map.removeLayer(layersRef.current.decorator);
        layersRef.current.decorator = null;
      }
      return;
    }

    // Construir la ruta completa: droneLocation -> waypoints
    const allPoints = [
      [droneLocation.lat, droneLocation.lng],
      ...waypoints.map(wp => [wp.lat, wp.lng])
    ];
    
    // 👇 Solo añadir punto de retorno si homeLocation existe
    if (homeLocation && waypoints.length > 0) {
      allPoints.push([homeLocation.lat, homeLocation.lng]);
    }

    const polyline = L.polyline(allPoints, {
      color: '#ff6b6b',
      weight: 3,
      opacity: 0.8,
      dashArray: '5, 10'
    }).addTo(map);

    const decorator = L.polylineDecorator(polyline, {
      patterns: [
        {
          offset: 25,
          repeat: 100,
          symbol: L.Symbol.arrowHead({
            pixelSize: 12,
            polygon: true,
            pathOptions: {
              color: '#ff6b6b',
              weight: 1,
              fillOpacity: 0.9,
              fillColor: '#ff6b6b'
            },
          }),
        },
      ],
    }).addTo(map);

    layersRef.current = { polyline, decorator };

    return () => {
      if (layersRef.current.polyline) {
        map.removeLayer(layersRef.current.polyline);
      }
      if (layersRef.current.decorator) {
        map.removeLayer(layersRef.current.decorator);
      }
    };
  }, [waypoints, droneLocation, homeLocation, map, enabled]);

  return null;
}