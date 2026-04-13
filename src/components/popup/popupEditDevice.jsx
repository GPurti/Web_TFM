import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './popup.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const droneValuesMap = {
  gps_timestamp: "GPS Timestamp",
  voltage_battery: "Battery Voltage",
  system_time: "System Time",
  latitude: "Latitude",
  longitude: "Longitude",
  altitude_ahl: "Altitude AHL",
  altitude_agl: "Altitude AGL",
  altitude_asl: "Altitude ASL",
  airSpeed: "Air Speed",
  groundSpeed: "Ground Speed",
  heading: "Heading",
  pitch: "Pitch",
  roll: "Roll",
  yaw: "Yaw"
};

export default function EditDroneModal({ drone, onClose, onSave, onControlDrone }) { // 👈 NUEVO PROP
  const defaultColor = '#e4ecfb';
  const [uid, setUid] = useState(drone.uid || '');
  const [name, setName] = useState(drone.name || '');
  const [color, setColor] = useState(drone.color || defaultColor);
  const [latitude, setLatitude] = useState(drone.latitude || 0);
  const [longitude, setLongitude] = useState(drone.longitude || 0);
  const [speechBubbleEnabled, setSpeechBubbleEnabled] = useState(drone.SpeechBubbleDroneIcone ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [telemetry, setTelemetry] = useState({});

  useEffect(() => {
    if (drone.telemetry) {
      setTelemetry(drone.telemetry);
    } else {
      const initTelemetry = {};
      Object.keys(droneValuesMap).forEach(field => initTelemetry[field] = false);
      setTelemetry(initTelemetry);
    }
  }, [drone]);

  const toggleTelemetryValue = (field) => {
    setTelemetry(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleControlClick = () => {
    console.log('🟢 handleControlClick - INICIO');
    console.log('🟢 onControlDrone existe?', typeof onControlDrone, onControlDrone);
    
    if (onControlDrone) {
      console.log('🟢 Llamando a onControlDrone con:', drone);
      onClose();
      onControlDrone(drone);
    } else {
      console.error('🟢 ERROR: onControlDrone no está definido');
    }
    console.log('🟢 handleControlClick - FIN');
  };
  
  const handleSave = async () => {
    if (!name.trim() || !uid.trim()) {
      setError('All required fields must be completed.');
      return;
    }

    setLoading(true);
    setError(null);

    const dataToSave = {
      id: drone.id,
      uid,
      name,
      color,
      latitude,
      longitude,
      SpeechBubbleDroneIcone: speechBubbleEnabled,
      telemetry
    };

    try {
      await onSave(dataToSave);
      onClose();
    } catch (err) {
      console.error(err);
      setError('Error saving changes.');
    } finally {
      setLoading(false);
    }
  };

  function DraggableMarker({ position, setPosition }) {
    const [draggable] = useState(true);

    useMapEvents({
      click(e) {
        setPosition([e.latlng.lat, e.latlng.lng]);
      },
    });

    return (
      <Marker
        position={position}
        draggable={draggable}
        eventHandlers={{
          dragend(e) {
            const marker = e.target;
            const latLng = marker.getLatLng();
            setPosition([latLng.lat, latLng.lng]);
          },
        }}
      />
    );
  }

  return (
    <div className="popupOverlay" onClick={onClose}>
      <div className="popupContent2" onClick={e => e.stopPropagation()}>
        <div className="principalBox">
          <button onClick={onClose} className="CloseButton">✖</button>
          <h1>Edit drone</h1>
          <div className='princiaplBoxColumns'>
            <label>
              Drone UID
              <input type="text" value={uid} onChange={e => setUid(e.target.value)} disabled={loading} placeholder="Drone UID" />
            </label>

            <label>
              Drone Name
              <input type="text" value={name} onChange={e => setName(e.target.value)} disabled={loading} placeholder="Drone name" />
            </label>

            <div className="telemetryWrapper">
              <label>Drone Values</label>
              <div className="telemetryList">
                {Object.keys(droneValuesMap).map((field) => (
                  <p key={field}>
                    <input
                      type="checkbox"
                      checked={telemetry[field] || false}
                      onChange={() => toggleTelemetryValue(field)}
                    />
                    {droneValuesMap[field]}
                  </p>
                ))}
              </div>
            </div>
              
            <label>
              Drone Color
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="text"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  disabled={loading}
                  placeholder="#RRGGBB"
                  style={{ flex: 1, height: '40px', fontSize: '16px', padding: '5px' }}
                />
                <span 
                  className="material-symbols-outlined" 
                  style={{ cursor: 'pointer' }}
                  title="Reset color"
                  onClick={() => setColor(defaultColor)}
                >
                  refresh
                </span>
                <span 
                  className="material-symbols-outlined" 
                  style={{ cursor: 'pointer', color: color }}
                  title="Edit color"
                  onClick={() => document.getElementById('hiddenColorInput').click()}
                >
                  edit
                </span>
                <input
                  type="color"
                  id="hiddenColorInput"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  style={{ display: 'none' }}
                />
              </div>
            </label>

            <label>
              Home (Lat / Long)
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="text"
                  value={latitude}
                  onChange={e => setLatitude(e.target.value)}
                  disabled={loading}
                  placeholder="Latitude"
                  style={{ flex: 1, height: '40px', fontSize: '16px', padding: '5px' }}
                />
                <input
                  type="text"
                  value={longitude}
                  onChange={e => setLongitude(e.target.value)}
                  disabled={loading}
                  placeholder="Longitude"
                  style={{ flex: 1, height: '40px', fontSize: '16px', padding: '5px' }}
                />
                <span 
                  className="material-symbols-outlined"
                  style={{ cursor: 'pointer', fontSize: '28px' }}
                  title="Select on map"
                  onClick={() => setMapOpen(true)}
                >
                  edit_location_alt
                </span>
              </div>
            </label>

            <label
              className="checkboxAppleWrapper"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
                fontWeight: 'bold',
                fontSize: '16px',
                color: 'black',
              }}
            >
              <span>Hide / Show bubble</span>
              <div className="checkboxApple">
                <input
                  className="yep"
                  id="checkApple"
                  type="checkbox"
                  checked={speechBubbleEnabled}
                  onChange={() => setSpeechBubbleEnabled(prev => !prev)}
                />
                <label htmlFor="checkApple"></label>
              </div>
            </label>
          </div>

          {error && <p style={{ color: 'red' }}>{error}</p>}

          {/* 👇 NUEVO: Botones en la misma línea */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            

            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              style={{
                flex: 1,
                background: loading ? '#cccccc' : 'green',
                color: 'white',
                padding: '10px',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
              }}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {mapOpen && (
        <div
          className="popupOverlay"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 2000 }}
          onClick={() => setMapOpen(false)}
        >
          <div
            className="popupContent"
            style={{ width: '90%', height: '450px', maxWidth: '600px', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ flex: 1 }}>
              <MapContainer
                center={[latitude || 0, longitude || 0]}
                zoom={13}
                style={{ width: '100%', height: '100%' }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <DraggableMarker
                  position={[latitude || 0, longitude || 0]}
                  setPosition={(pos) => {
                    setLatitude(pos[0].toFixed(6));
                    setLongitude(pos[1].toFixed(6));
                  }}
                />
              </MapContainer>
            </div>
            <div style={{ padding: '10px', background: '#f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Lat: {latitude} , Lng: {longitude}</span>
              <button
                onClick={() => setMapOpen(false)}
                style={{ padding: '5px 10px', cursor: 'pointer', borderRadius: '4px', border: 'none', background: '#4caf50', color: 'white' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}