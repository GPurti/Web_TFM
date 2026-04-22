// src/components/DroneControl/RoutePreview.jsx
import { useEffect, useRef } from 'react';
import L from 'leaflet';

export default function RoutePreview({ 
  waypoints, 
  droneLocation, 
  homeLocation, 
  map, 
  enabled = false,
  previewType = 'mission'
}) {
  const layersRef = useRef({});

  useEffect(() => {
    // Limpiar capas anteriores
    if (layersRef.current.polygon) {
      map?.removeLayer(layersRef.current.polygon);
    }
    if (layersRef.current.polyline) {
      map?.removeLayer(layersRef.current.polyline);
    }
    if (layersRef.current.decorator) map?.removeLayer(layersRef.current.decorator);
    if (layersRef.current.launchMarker) map?.removeLayer(layersRef.current.launchMarker);

    layersRef.current = {};

    if (!enabled || !map) {
      return;
    }

    console.log('🎨 RoutePreview - previewType:', previewType, 'waypoints:', waypoints?.length);

    try {
      if (previewType === 'fence' && waypoints && waypoints.length >= 3) {
        // Dibujar polígono para FENCE
        const points = waypoints.map(wp => [wp.lat, wp.lng]);
        const closedPoints = [...points, points[0]];
        
        const polygon = L.polygon(closedPoints, {
          color: '#ff4444',
          weight: 3,
          opacity: 0.8,
          fillColor: '#ff4444',
          fillOpacity: 0.25,
          dashArray: '5, 10'
        }).addTo(map);

        polygon.bindPopup(`
          <b>🚧 Zona de Geofence</b><br>
          El drone no puede salir de esta área.<br>
          Si intenta salir → <b style="color: #ff4444;">RTL (Return to Launch)</b>
        `);
        
        layersRef.current = { polygon };
        console.log('✅ Fence preview dibujado');
      } 
      else if (previewType === 'mission' && waypoints && waypoints.length >= 1 && droneLocation) {
        const allPoints = [[droneLocation.lat, droneLocation.lng]];
        waypoints.forEach(wp => allPoints.push([wp.lat, wp.lng]));
        if (homeLocation) allPoints.push([homeLocation.lat, homeLocation.lng]);

        const polyline = L.polyline(allPoints, {
          color: '#309ddc',
          weight: 3,
          opacity: 0.8,
          dashArray: '5, 10'
        }).addTo(map);

        // Flechas en toda la ruta incluyendo launch → primer waypoint
        const decorator = L.polylineDecorator(polyline, {
          patterns: [{
            offset: 25,
            repeat: 80,
            symbol: L.Symbol.arrowHead({
              pixelSize: 10,
              polygon: true,
              pathOptions: {
                color: '#ff6b6b',
                weight: 2,
                fillOpacity: 0.9,
                fillColor: '#ff6b6b'
              }
            })
          }]
        }).addTo(map);

        // Marcador especial para el launch point
        const launchMarker = L.marker([droneLocation.lat, droneLocation.lng], {
          icon: L.divIcon({
            html: `<div style="
              background-color: #ff6b6b;
              width: 22px;
              height: 22px;
              border-radius: 50%;
              border: 2px solid white;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            ">🏠</div>`,
            className: '',
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          })
        }).addTo(map);

        layersRef.current = { polyline, decorator, launchMarker };
        console.log('✅ Mission preview dibujado con flechas');
      }
    } catch (err) {
      console.warn('Error en RoutePreview:', err);
    }

    return () => {
      if (layersRef.current.polygon) map?.removeLayer(layersRef.current.polygon);
      if (layersRef.current.polyline) map?.removeLayer(layersRef.current.polyline);
      if (layersRef.current.decorator) map?.removeLayer(layersRef.current.decorator);
      if (layersRef.current.launchMarker) map?.removeLayer(layersRef.current.launchMarker);

    };
  }, [waypoints, droneLocation, homeLocation, map, enabled, previewType]);

  return null;
}