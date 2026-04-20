// src/components/DroneControl/ControlWaypoints.jsx
import { useMapEvents, Marker } from 'react-leaflet';
import L from 'leaflet';

const missionIcon = new L.DivIcon({
  html: '<div style="background-color: #ff6b6b; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(255,0,0,0.5);"></div>',
  className: '',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const fenceIcon = new L.DivIcon({
  html: '<div style="background-color: #3399ff; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(51,153,255,0.5);"></div>',
  className: '',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export default function ControlWaypoints({ waypoints, setWaypoints, enabled = false, missionType = 'mission' }) {
  useMapEvents({
    click: (e) => {
      if (!enabled) return;
      
      const newPoint = {
        id: Date.now(),
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        alt: 40
      };
      
      setWaypoints(prev => [...prev, newPoint]);
      console.log(`➕ ${missionType === 'fence' ? 'Vértice' : 'Waypoint'} añadido:`, newPoint);
    }
  });

  const handleClick = (id, e) => {
    e.originalEvent?.stopPropagation();
    setWaypoints(prev => prev.filter(wp => wp.id !== id));
  };

  const icon = missionType === 'fence' ? fenceIcon : missionIcon;
  const color = missionType === 'fence' ? '#3399ff' : '#ff6b6b';

  return (
    <>
      {enabled && waypoints.map((wp, index) => (
        <Marker
          key={wp.id}
          position={[wp.lat, wp.lng]}
          icon={icon}
          eventHandlers={{ click: (e) => handleClick(wp.id, e) }}
        >
          <div style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            background: color,
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