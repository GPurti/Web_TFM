import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import supabase from '../../supabaseClient';
import EditDroneModal from '../popup/popupEditDevice';
import MqttClient from '../mqttClient';
import MapStyleMenu from './mapStyleMenu';
import SeeDronesMap from './seeDronesMap';
import MapOverlays from './mapOverlays';
import FireRoute from './fireRoute';

export default function Map({ visibleDrones }) {
  const [drones, setDrones] = useState([]);
  const [selectedDrone, setSelectedDrone] = useState(null);
  const [mapStyle, setMapStyle] = useState('standard');
  const [showVolantOverlay, setShowVolantOverlay] = useState(false);
  const [showFires, setShowFires] = useState(false);
  const [hasGeneratedRoute, setHasGeneratedRoute] = useState(false);

  const fireLocation = { lat: 41.809742, lng: 2.233562 };

  const tileLayers = {
    standard: {
      name: 'OpenStreetMap',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors',
    },
    topographic: {
      name: 'Topographic',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; Source: USGS, Esri, TANA, DeLorme',
    },
    satellite: {
      name: 'Satellite',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Imagery &copy; Esri, DigitalGlobe, GeoEye',
    },
  };

  useEffect(() => {
    const fetchDrones = async () => {
      const { data, error } = await supabase.from('DroneList').select('*');
      if (!error) setDrones(data || []);
      else console.error('Error fetching drones:', error.message);
    };
    fetchDrones();
  }, []);

  // 👇 NUEVO: Suscribirse a cambios en tiempo real
  useEffect(() => {
    const channel = supabase
      .channel('drone-list-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'DroneList' },
        (payload) => {
          console.log('🆕 Nuevo drone detectado en BD:', payload.new);
          setDrones(prev => {
            if (prev.some(d => d.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const handleDroneUpdate = useCallback((uid, latitude, longitude, altitude, heading) => {
    setDrones(prevDrones => {
      const index = prevDrones.findIndex(drone => drone.uid === uid);
      if (index === -1) return prevDrones;

      const updatedDrone = {
        ...prevDrones[index],
        latitude,
        longitude,
        altitude: altitude ?? prevDrones[index].altitude,
        heading: heading ?? prevDrones[index].heading,
      };

      const updatedDrones = [...prevDrones];
      updatedDrones[index] = updatedDrone;

      return updatedDrones;
    });
  }, []);

  const toggleFires = () => {
    setShowFires(prev => !prev);
  };

  const closestDrone = useMemo(() => {
    if (!drones || drones.length === 0) return null;

    return drones.reduce((closest, drone) => {
      const dist = Math.sqrt(
        (drone.latitude - fireLocation.lat) ** 2 +
        (drone.longitude - fireLocation.lng) ** 2
      );
      if (!closest || dist < closest.distance) {
        return { drone, distance: dist };
      }
      return closest;
    }, null)?.drone;
  }, [drones, fireLocation]);

  return (
    <>
      <MqttClient 
        onDroneUpdate={handleDroneUpdate}
        onNewDroneDetected={(newDrone) => {
          // Ya se actualiza vía Supabase, pero podríamos hacer algo extra
          console.log('Drone detectado vía MQTT:', newDrone);
        }}
      />

      <MapStyleMenu
        mapStyle={mapStyle}
        setMapStyle={setMapStyle}
        showVolantOverlay={showVolantOverlay}
        setShowVolantOverlay={setShowVolantOverlay}
        showFires={showFires}
        toggleFires={toggleFires}
      />

      <MapContainer
        center={[41.808905, 2.163105]}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: '100vh', width: '100vw' }}
      >
        <TileLayer
          attribution={tileLayers[mapStyle].attribution}
          url={tileLayers[mapStyle].url}
        />

        <MapOverlays
          showVolantOverlay={showVolantOverlay}
          showFires={showFires}
        />

        <SeeDronesMap drones={drones} onSelectDrone={setSelectedDrone} />

        {closestDrone && !hasGeneratedRoute && (
          <FireRoute
            drone={closestDrone}
            fireLocation={fireLocation}
            onRouteGenerated={() => setHasGeneratedRoute(true)}
          />
        )}
      </MapContainer>

      {selectedDrone && (
        <EditDroneModal
          drone={selectedDrone}
          onSave={async (updatedDrone) => {
            const { error } = await supabase
              .from('DroneList')
              .update({
                uid: updatedDrone.uid,
                name: updatedDrone.name,
                color: updatedDrone.color,
                SpeechBubbleDroneIcone: updatedDrone.SpeechBubbleDroneIcone,
              })
              .eq('id', updatedDrone.id);

            if (!error) {
              setDrones((prev) =>
                prev.map((d) =>
                  d.id === updatedDrone.id ? { ...d, ...updatedDrone } : d
                )
              );
              setSelectedDrone(null);
            }
          }}
          onClose={() => setSelectedDrone(null)}
        />
      )}
    </>
  );
}