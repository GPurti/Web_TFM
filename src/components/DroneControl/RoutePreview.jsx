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
        // Ruta para MISSION
        const allPoints = [[droneLocation.lat, droneLocation.lng]];
        waypoints.forEach(wp => allPoints.push([wp.lat, wp.lng]));
        if (homeLocation) allPoints.push([homeLocation.lat, homeLocation.lng]);

        const polyline = L.polyline(allPoints, {
          color: '#ff6b6b',
          weight: 3,
          opacity: 0.8,
          dashArray: '5, 10'
        }).addTo(map);

        layersRef.current = { polyline };
        console.log('✅ Mission preview dibujado');
      }
    } catch (err) {
      console.warn('Error en RoutePreview:', err);
    }

    return () => {
      if (layersRef.current.polygon) map?.removeLayer(layersRef.current.polygon);
      if (layersRef.current.polyline) map?.removeLayer(layersRef.current.polyline);
    };
  }, [waypoints, droneLocation, homeLocation, map, enabled, previewType]);

  return null;
}