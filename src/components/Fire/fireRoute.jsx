import { useEffect, useState } from 'react';
import { CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-polylinedecorator';
import GenerateRouteMission from './generateRouteMission';
import SaveMission from './saveMissions';

export default function FireRoute({ 
  drone, 
  fireLocation, 
  homeLocation,
  mqttClient, 
  savedWaypoints = null,
  missionId,
  onRouteGenerated 
}) {
  const [waypoints, setWaypoints] = useState(savedWaypoints || []);
  const [zoom, setZoom] = useState(13);
  const [generateTrigger, setGenerateTrigger] = useState(0);
  const [routeGenerated, setRouteGenerated] = useState(!!savedWaypoints);
  const map = useMap();

  // Cuando lleguen waypoints guardados, actualizar
  useEffect(() => {
    if (savedWaypoints && savedWaypoints.length > 0) {
      setWaypoints(savedWaypoints);
      setRouteGenerated(true);
    }
  }, [savedWaypoints]);

  // 🎯 SOLO generar ruta si:
  // 1. Hay drone
  // 2. Hay fireLocation
  // 3. NO hay waypoints guardados
  // 4. NO se ha generado ya una ruta
  useEffect(() => {
    if (!drone || !fireLocation) {
      console.log('⏳ Esperando datos para generar ruta...');
      return;
    }
    
    if (savedWaypoints && savedWaypoints.length > 0) {
      console.log('✅ Usando waypoints guardados');
      return;
    }
    
    if (routeGenerated) {
      console.log('✅ Ruta ya generada previamente');
      return;
    }

    console.log(`🔄 Generando ruta para ${drone.uid} hacia fuego ${fireLocation.lat},${fireLocation.lng}`);
    setGenerateTrigger(prev => prev + 1);
  }, [drone, fireLocation, savedWaypoints]);

  // Manejar zoom del mapa
  useEffect(() => {
    if (!map) return;
    setZoom(map.getZoom());
    const handleZoom = () => setZoom(map.getZoom());
    map.on('zoom', handleZoom);
    return () => map.off('zoom', handleZoom);
  }, [map]);

  // Dibujar polyline cuando hay waypoints
  useEffect(() => {
    if (waypoints.length < 2 || !map) return;

    const positions = waypoints.map((wp) =>
      wp.position ? [wp.position.lat, wp.position.lng] : [wp.lat, wp.lng]
    );

    const polyline = L.polyline(positions, { color: '#0095ffff', dashArray: '6, 9'}).addTo(map);

    const decorator = L.polylineDecorator(polyline, {
      patterns: [{
        offset: 25,
        repeat: 200,
        symbol: L.Symbol.arrowHead({
          pixelSize: 12,
          polygon: true,
          pathOptions: { color: '#0095ffff', weight: 1, fillOpacity: 0.9 },
        }),
      }],
    }).addTo(map);

    return () => {
      map.removeLayer(polyline);
      map.removeLayer(decorator);
    };
  }, [waypoints, map]);

  // Callback cuando la ruta se genera
  const handleRouteGenerated = (routeData) => {
    console.log(`✅ Ruta generada para ${drone.uid}:`, routeData);
    if (routeData.waypoints && routeData.waypoints.length > 0) {
      setWaypoints(routeData.waypoints);
      setRouteGenerated(true);
      
      if (onRouteGenerated) {
        onRouteGenerated(routeData);
      }
    } else {
      console.error('❌ Ruta vacía recibida');
    }
  };

  const getScaledRadius = () => 10 * (zoom / 13);

  return (
    <>
      {/* Generar ruta SOLO si es necesario */}
      {drone && fireLocation && !savedWaypoints && !routeGenerated && (
        <GenerateRouteMission
          drone={drone}
          fireLocation={fireLocation}
          homeLocation={homeLocation}
          missionId={missionId}
          onRouteGenerated={handleRouteGenerated}
          trigger={generateTrigger}
          addExtraPoint={false}
        />
      )}

      {/* Enviar por MQTT (solo cuando hay waypoints) */}
      {routeGenerated && waypoints.length > 0 && mqttClient && (
        <SaveMission
          drone={drone}
          fireLocation={fireLocation}
          mqttClient={mqttClient}
          waypointsFromMission={waypoints}
          stateFireRoute={true}
          sendTrigger={generateTrigger}
          onRouteGenerated={(wps) => console.log(`📤 Enviando ruta de ${drone.uid} por MQTT`)}
        />
      )}

      {/* Dibujar puntos de la ruta */}
      {waypoints.map((wp, idx) => (
        <CircleMarker
          key={idx}
          center={wp.position ? [wp.position.lat, wp.position.lng] : [wp.lat, wp.lng]}
          radius={getScaledRadius()}
          pathOptions={{
            color: '#0095ffff',
            fillColor: '#0095ffff',
            fillOpacity: 0.9,
          }}
        />
      ))}
    </>
  );
}