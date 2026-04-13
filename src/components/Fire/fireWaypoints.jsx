import { Marker, useMapEvents } from 'react-leaflet';
import supabase from '../../supabaseClient';

function FireWaypoints({ fireLocations, setFireLocations, onFireRemoved, controlMode }) {
  const saveFireLocation = async (lat, lng) => {
    const { data, error } = await supabase
      .from('missions')
      .insert([
        {
          latitud: lat,
          longitude: lng,
          see: false,
          seePublic: true,
          waypoints: JSON.stringify([]),
          stateFireRoute: false,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error saving mission:', error);
      alert('Failed to save point to the database');
      return null;
    }
    return data;
  };
  const fireIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    // O usa un icono de fuego más específico:
    // iconUrl: 'https://cdn-icons-png.flaticon.com/512/182/182292.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  useMapEvents({
    click: async (e) => {
      if (controlMode) {
        console.log('🎮 Modo control activo, ignorando creación de fuego');
        return;
      }
      
      if (!addFireMode) {
        console.log('❌ Modo añadir fuegos desactivado. Actívalo desde el menú lateral.');
        return;
      }
      
      // Crear fuego TEMPORAL (solo visual, NO se guarda en BD)
      const newFire = {
        id: Date.now(),
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        temporary: true,  // 👈 Marcar como temporal
      };
      
      // Notificar a App.jsx para guardar en pendingFires
      if (onFireCreated) {
        onFireCreated(newFire);
      }
      
      // Mostrar en el mapa inmediatamente
      setFireLocations((prev) => [...prev, newFire]);
      
      console.log('➕ Fuego temporal añadido (visible pero sin asignación):', newFire);
    },
  });

  const handleDragEnd = (id, e) => {
    // 👇 No permitir drag en modo control
    if (controlMode) {
      console.log('🎮 Modo control activo, ignorando drag de fuego');
      return;
    }
    
    const newPos = e.target.getLatLng();
    setFireLocations((prev) =>
      prev.map((fire) =>
        fire.id === id ? { ...fire, lat: newPos.lat, lng: newPos.lng } : fire
      )
    );
  };

  const handleRightClick = (id) => {
    // 👇 No permitir eliminar fuegos en modo control
    if (controlMode) {
      console.log('🎮 Modo control activo, ignorando eliminación de fuego');
      return;
    }
    
    // 1. Notificar al padre (Map) que este fuego se va a eliminar
    if (onFireRemoved) {
      onFireRemoved(id);
    }
    // 2. Eliminar el fuego del estado local
    setFireLocations((prev) => prev.filter((fire) => fire.id !== id));
  };

  return fireLocations.map((fire) => (
    <Marker
      key={fire.id}
      position={[fire.lat, fire.lng]}
      draggable
      eventHandlers={{
        dragend: (e) => handleDragEnd(fire.id, e),
        contextmenu: () => handleRightClick(fire.id),
      }}
    />
  ));
}

export default FireWaypoints;