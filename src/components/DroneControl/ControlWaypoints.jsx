import { useMapEvents, Marker } from 'react-leaflet';
import L from 'leaflet';

const controlWaypointIcon = new L.DivIcon({
  html: '<div style="background-color: #ff6b6b; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(255,0,0,0.5);"></div>',
  className: '',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export default function ControlWaypoints({ waypoints, setWaypoints, enabled = false }) {
  useMapEvents({
    click: (e) => {
      if (!enabled) return;
      
      console.log('🖱️ Click en mapa - coordenadas crudas:', {
        lat: e.latlng.lat,
        lng: e.latlng.lng
      });
      
      const newWaypoint = {
        id: Date.now(),
        lat: e.latlng.lat,
        lng: e.latlng.lng,
      };
      
      setWaypoints(prev => [...prev, newWaypoint]);
      console.log('➕ Waypoint añadido:', newWaypoint);
    }
  });

  const handleMarkerClick = (id, e) => {
    e.originalEvent.stopPropagation(); // Evitar que el clic se propague al mapa
    console.log('❌ Eliminando waypoint:', id);
    setWaypoints(prev => prev.filter(wp => wp.id !== id));
  };

  return (
    <>
      {enabled && waypoints.map((wp, index) => (
        <Marker
          key={wp.id}
          position={[wp.lat, wp.lng]}
          icon={controlWaypointIcon}
          eventHandlers={{
            click: (e) => handleMarkerClick(wp.id, e)
          }}
        >
          {/* Número de orden */}
          <div style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            background: '#ff6b6b',
            color: 'white',
            borderRadius: '50%',
            width: '18px',
            height: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: 'bold',
            border: '1px solid white',
            pointerEvents: 'none'
          }}>
            {index + 1}
          </div>
        </Marker>
      ))}
    </>
  );
}