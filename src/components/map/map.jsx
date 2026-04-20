
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import supabase from "../../supabaseClient";
import EditDroneModal from "../popup/popupEditDevice";
import MqttClient from "../mqttClient";
import MapStyleMenu from "./mapStyleMenu";
import SeeDronesMap from "./seeDronesMap";
import MapOverlays from "./mapOverlays";
import FireRoute from "../Fire/fireRoute";
import AeroZonesLayer from "./aeroZonesLayer";
import DroneControlPanel from "../DroneControl/DroneControlPanel";
import ControlWaypoints from "../DroneControl/ControlWaypoints";
import RoutePreview from "../DroneControl/RoutePreview";

// Componente para mostrar rutas activas (persistentes) - AZUL
function ActiveRoutesLayer({ activeRoutes, dronesLocations, map }) {
  const layersRef = useRef({});

  useEffect(() => {
    if (!map) return;

    // Limpiar capas anteriores
    Object.values(layersRef.current).forEach(layer => {
      if (layer.polyline) map.removeLayer(layer.polyline);
      if (layer.decorator) map.removeLayer(layer.decorator);
      if (layer.markers) layer.markers.forEach(m => map.removeLayer(m));
    });
    layersRef.current = {};

    // Dibujar cada ruta activa
    Object.entries(activeRoutes).forEach(([droneUid, route]) => {
      const { waypoints } = route;
      if (!waypoints || waypoints.length === 0) return;

      // Obtener ubicación actual del drone (si está disponible)
      const droneLocation = dronesLocations[droneUid];
      
      const allPoints = [];
      //if (droneLocation && droneLocation.lat && droneLocation.lng) {
      //  allPoints.push([droneLocation.lat, droneLocation.lng]);
      //}
      waypoints.forEach(wp => {
        allPoints.push([wp.lat, wp.lng]);
      });

      if (allPoints.length < 2) return;

      // 👈 COLOR AZUL para rutas de control (diferente a fuegos rojos)
      const polyline = L.polyline(allPoints, {
        color: '#3399ff',
        weight: 4,
        opacity: 0.9,
        dashArray: '5, 10'
      }).addTo(map);

      const decorator = L.polylineDecorator(polyline, {
        patterns: [{
          offset: 25,
          repeat: 100,
          symbol: L.Symbol.arrowHead({
            pixelSize: 12,
            polygon: true,
            pathOptions: {
              color: '#3399ff',
              weight: 2,
              fillOpacity: 0.9,
              fillColor: '#3399ff'
            },
          }),
        }],
      }).addTo(map);

      // Marcadores azules para waypoints
      const markers = [];
      waypoints.forEach((wp, index) => {
        const marker = L.marker([wp.lat, wp.lng], {
          icon: L.divIcon({
            html: `<div style="
              background-color: #3399ff;
              width: 22px;
              height: 22px;
              border-radius: 50%;
              border: 2px solid white;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
              color: white;
              font-size: 11px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            ">${index + 1}</div>`,
            className: '',
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          })
        }).addTo(map);
        markers.push(marker);
      });

      layersRef.current[droneUid] = { polyline, decorator, markers };
    });

    return () => {
      Object.values(layersRef.current).forEach(layer => {
        if (layer.polyline) map.removeLayer(layer.polyline);
        if (layer.decorator) map.removeLayer(layer.decorator);
        if (layer.markers) layer.markers.forEach(m => map.removeLayer(m));
      });
    };
  }, [activeRoutes, dronesLocations, map]);

  return null;
}
// Componente para mostrar fences persistentes
function FenceLayer({ fences, map }) {
  const layersRef = useRef({});

  useEffect(() => {
    if (!map || !map._container) return;

    // Limpiar capas anteriores
    Object.values(layersRef.current).forEach(layer => {
      if (layer.polygon && map.hasLayer(layer.polygon)) map.removeLayer(layer.polygon);
      if (layer.polyline && map.hasLayer(layer.polyline)) map.removeLayer(layer.polyline);
    });
    layersRef.current = {};

    // Dibujar cada fence
    Object.entries(fences).forEach(([droneUid, fence]) => {
      const { vertices } = fence;
      if (!vertices || vertices.length < 3) return;

      const points = vertices.map(v => [v.lat, v.lng]);
      const closedPoints = [...points, points[0]];

      try {
        // Polígono rojo translúcido
        const polygon = L.polygon(closedPoints, {
          color: '#ff4444',
          weight: 3,
          opacity: 0.8,
          fillColor: '#ff4444',
          fillOpacity: 0.25,
          dashArray: '5, 10'
        }).addTo(map);

        // Línea que conecta los vértices
        const polyline = L.polyline(points, {
          color: '#ff4444',
          weight: 2,
          opacity: 0.6,
          dashArray: '3, 8'
        }).addTo(map);

        layersRef.current[droneUid] = { polygon, polyline };
      } catch (err) {
        console.warn('Error dibujando fence:', err);
      }
    });

    return () => {
      Object.values(layersRef.current).forEach(layer => {
        if (layer.polygon && map.hasLayer(layer.polygon)) map.removeLayer(layer.polygon);
        if (layer.polyline && map.hasLayer(layer.polyline)) map.removeLayer(layer.polyline);
      });
    };
  }, [fences, map]);

  return null;
}

function ExclusionFenceLayer({ exclusionFences, map }) {
  const layersRef = useRef({});

  useEffect(() => {
    if (!map || !map._container) return;

    Object.values(layersRef.current).forEach(layer => {
      if (layer.polygon && map.hasLayer(layer.polygon)) map.removeLayer(layer.polygon);
    });
    layersRef.current = {};

    exclusionFences.forEach((fence, idx) => {
      if (!fence || fence.length < 3) return;
      const points = fence.map(v => [v.lat, v.lng]);
      try {
        const polygon = L.polygon(points, {
          color: '#ff0000',
          weight: 3,
          opacity: 0.9,
          fillColor: '#ff0000',
          fillOpacity: 0.2,
          dashArray: '8, 5'
        }).addTo(map);
        polygon.bindTooltip('🚫 Exclusion Zone', { permanent: false });
        layersRef.current[idx] = { polygon };
      } catch (err) {
        console.warn('Error dibujando exclusion fence:', err);
      }
    });

    return () => {
      Object.values(layersRef.current).forEach(layer => {
        if (layer.polygon && map.hasLayer(layer.polygon)) map.removeLayer(layer.polygon);
      });
    };
  }, [exclusionFences, map]);

  return null;
}

const fireIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function FireWaypoints({ fireLocations, setFireLocations, addFireToMapAndDB, onFireRemoved, controlMode, addFireMode }) {
  useMapEvents({
    click: async (e) => {
      if (controlMode) {
        //console.log('🎮 Modo control activo, ignorando creación de fuego');
        return;
      }
      
      if (!addFireMode) {
        //console.log('❌ Modo añadir fuegos desactivado. Actívalo desde el menú lateral.');
        return;
      }
      
      const newFire = {
        id: Date.now(),
        lat: e.latlng.lat,
        lng: e.latlng.lng,
      };
      
      addFireToMapAndDB(newFire);
      
      //console.log('➕ Fuego añadido directamente a BD:', newFire);
    },
  });

  const handleDragEnd = (id, e) => {
    if (controlMode) {
      //console.log('🎮 Modo control activo, ignorando drag de fuego');
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
    if (controlMode) {
      //console.log('🎮 Modo control activo, ignorando eliminación de fuego');
      return;
    }
    
    if (onFireRemoved) {
      onFireRemoved(id);
    }
    setFireLocations((prev) => prev.filter((fire) => fire.id !== id));
  };

  return fireLocations.map((fire) => (
    <Marker
      key={fire.id}
      position={[fire.lat, fire.lng]}
      icon={fireIcon}
      draggable
      eventHandlers={{
        dragend: (e) => handleDragEnd(fire.id, e),
        contextmenu: () => handleRightClick(fire.id),
      }}
    />
  ));
}

export default function Map({ 
  visibleDrones, 
  visibleFireLocation,
  controlMode = false,
  selectedControlDrone = null,
  controlWaypoints = [],
  setControlWaypoints = () => {},
  onControlModeSelect = () => {},
  onExitControlMode = () => {},
  addFireMode = false,
  onRouteActivated = () => {},
  onFenceActivated = () => {}, 
  activeRoutes = {},  
  activeFences = {}, 
  onDroneClick = () => {}
}) {
  const [drones, setDrones] = useState([]);
  const [selectedDrone, setSelectedDrone] = useState(null);
  const [mapStyle, setMapStyle] = useState("standard");
  const [showVolantOverlay, setShowVolantOverlay] = useState(false);
  const [showFires, setShowFires] = useState(false);
  const [showAero, setShowAero] = useState(false);
  const [fireLocations, setFireLocations] = useState([]);
  const [mqttClient, setMqttClient] = useState(null);
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [fireAssignments, setFireAssignments] = useState([]);
  const [fireMarker, setFireMarker] = useState(null);
  const droneIds = useMemo(() => drones.map((d) => d.uid), [drones]);
  const [realTimeDrones, setRealTimeDrones] = useState({});
  const mapRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [assignedFires, setAssignedFires] = useState({});
  const [droneBusy, setDroneBusy] = useState({});
  const [droneHomeLocation, setDroneHomeLocation] = useState(null);
  const [localMissionType, setLocalMissionType] = useState('mission'); 
  
  const [localControlMode, setLocalControlMode] = useState(controlMode);
  const [localSelectedControlDrone, setLocalSelectedControlDrone] = useState(selectedControlDrone);
  const [localControlWaypoints, setLocalControlWaypoints] = useState(controlWaypoints);
  const [showRoutePreview, setShowRoutePreview] = useState(false);
  const [droneCurrentLocation, setDroneCurrentLocation] = useState(null);
  const [previewFullRoute, setPreviewFullRoute] = useState([]);
  const [includeReturn, setIncludeReturn] = useState(true);
  const [localExclusionFences, setLocalExclusionFences] = useState([]); // [[{lat,lng},...], ...]

  // Sincronizar props con estado local
  useEffect(() => {
    setLocalControlMode(controlMode);
  }, [controlMode]);

  useEffect(() => {
    setLocalSelectedControlDrone(selectedControlDrone);
  }, [selectedControlDrone]);

  useEffect(() => {
    setLocalControlWaypoints(controlWaypoints);
  }, [controlWaypoints]);

  useEffect(() => {
    if (localSelectedControlDrone) {
      //console.log('🎮 Actualizando ubicación para:', localSelectedControlDrone.name);
      
      const realTimeDrone = realTimeDrones[localSelectedControlDrone.uid];
      let currentLat, currentLng;
      
      if (realTimeDrone && realTimeDrone.lat && realTimeDrone.lng) {
        currentLat = realTimeDrone.lat;
        currentLng = realTimeDrone.lng;
        //console.log('📍 Usando telemetría en tiempo real:', { lat: currentLat, lng: currentLng });
      } else if (localSelectedControlDrone.telemetry?.latitude && localSelectedControlDrone.telemetry?.longitude) {
        currentLat = localSelectedControlDrone.telemetry.latitude;
        currentLng = localSelectedControlDrone.telemetry.longitude;
        //console.log('📍 Usando telemetría del objeto drone:', { lat: currentLat, lng: currentLng });
      } else if (localSelectedControlDrone.latitude && localSelectedControlDrone.longitude) {
        currentLat = localSelectedControlDrone.latitude;
        currentLng = localSelectedControlDrone.longitude;
        //console.log('📍 Usando home location de la BD:', { lat: currentLat, lng: currentLng });
      }
      
      if (currentLat && currentLng) {
        setDroneCurrentLocation({ lat: currentLat, lng: currentLng });
        setDroneHomeLocation({ lat: currentLat, lng: currentLng });
        //console.log(`🏠 Ubicación actual del drone establecida en: (${currentLat.toFixed(6)}, ${currentLng.toFixed(6)})`);
      } else {
        console.warn('⚠️ No se pudo obtener ubicación para el drone');
        const defaultLat = 41.808905;
        const defaultLng = 2.163105;
        setDroneCurrentLocation({ lat: defaultLat, lng: defaultLng });
        setDroneHomeLocation({ lat: defaultLat, lng: defaultLng });
        //console.log(`🏠 Usando ubicación por defecto: (${defaultLat}, ${defaultLng})`);
      }
    }
  }, [localSelectedControlDrone, realTimeDrones]);

  const tileLayers = {
    standard: {
      name: "OpenStreetMap",
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: "&copy; OpenStreetMap contributors",
    },
    topographic: {
      name: "Topographic",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles &copy; Esri &mdash; Source: USGS, Esri, TANA, DeLorme",
    },
    satellite: {
      name: "Satellite",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: "Imagery &copy; Esri, DigitalGlobe, GeoEye",
    },
  };

  const getFullRouteForPreview = (waypoints, withReturn) => {
    if (!withReturn || !droneHomeLocation || waypoints.length === 0) {
      return waypoints;
    }
    return [...waypoints, { ...droneHomeLocation, id: 'home', isReturn: true }];
  };

  const handleSendRoute = async (fullRoute) => {
    //console.log('🔍 FULL ROUTE RECIBIDO EN MAP:', JSON.stringify(fullRoute, null, 2));
    if (!mqttClient || !localSelectedControlDrone) {
      console.error('No hay conexión MQTT o drone seleccionado');
      alert('Error: No hay conexión MQTT');
      return;
    }

    const mqttMessage = {
      action: 'AUTO',
      waypoints: fullRoute.map(wp => ({
        lat: wp.lat,
        lon: wp.lng,
        alt: wp.alt || 40
      }))
    };
    //console.log('📤 MQTT MESSAGE:', JSON.stringify(mqttMessage, null, 2));
    const topic = `${localSelectedControlDrone.uid}_action`;
    
    return new Promise((resolve, reject) => {
      mqttClient.publish(topic, JSON.stringify(mqttMessage), { qos: 1 }, (err) => {
        if (err) {
          console.error('Error enviando ruta:', err);
          reject(err);
        } else {
          //console.log(`✅ Ruta enviada a ${topic} con ${fullRoute.length} waypoints`);
          
          // 👇 ACTIVAR RUTA PERSISTENTE (AZUL)
          if (onRouteActivated) {
            onRouteActivated(localSelectedControlDrone.uid, fullRoute);
          }
          
          //console.log('🎮 Cerrando modo control - volviendo a vista normal');
          setLocalControlMode(false);
          setLocalSelectedControlDrone(null);
          setLocalControlWaypoints([]);
          setShowRoutePreview(false);
          
          if (onExitControlMode) {
            onExitControlMode();
          }
          
          resolve();
        }
      });
    });
  };

  const handleSendFence = async (vertices) => {
    console.log('🚧 Enviando FENCE con vértices:', vertices);
    if (!mqttClient || !localSelectedControlDrone) {
      console.error('No hay conexión MQTT o drone seleccionado');
      alert('Error: No hay conexión MQTT');
      return;
    }

    const mqttMessage = {
      action: 'FENCE',
      vertices: vertices.map(v => ({
        lat: v.lat,
        lon: v.lng
      })),
      action_on_break: 'RTL'
    };
    
    console.log('📤 MQTT FENCE MESSAGE:', JSON.stringify(mqttMessage, null, 2));
    const topic = `${localSelectedControlDrone.uid}_action`;
    
    return new Promise((resolve, reject) => {
      mqttClient.publish(topic, JSON.stringify(mqttMessage), { qos: 1 }, (err) => {
        if (err) {
          console.error('Error enviando fence:', err);
          reject(err);
        } else {
          console.log(`✅ Fence enviado a ${topic} con ${vertices.length} vértices`);
          
          // 👇 ACTIVAR FENCE PERSISTENTE
          if (onFenceActivated) {
            onFenceActivated(localSelectedControlDrone.uid, vertices);
          }
          
          console.log('🎮 Cerrando modo control - volviendo a vista normal');
          setLocalControlMode(false);
          setLocalSelectedControlDrone(null);
          setLocalControlWaypoints([]);
          setShowRoutePreview(false);
          
          if (onExitControlMode) {
            onExitControlMode();
          }
          
          resolve();
        }
      });
    });
  };

  const handleSendExclusionFence = async (zones) => {
    if (!mqttClient || !localSelectedControlDrone) {
      alert('Error: No hay conexión MQTT');
      return;
    }
    const mqttMessage = {
      action: 'EXCLUSION_FENCE',
      vertices: zones.map(zone => zone.map(v => ({ lat: v.lat, lon: v.lng }))),
      action_on_break: 'RTL'
    };
    const topic = `${localSelectedControlDrone.uid}_action`;
    return new Promise((resolve, reject) => {
      mqttClient.publish(topic, JSON.stringify(mqttMessage), { qos: 1 }, (err) => {
        if (err) { reject(err); return; }
        console.log(`✅ Exclusion fence enviado`);
        setLocalExclusionFences(prev => [...prev, ...zones]);
        setLocalControlMode(false);
        setLocalSelectedControlDrone(null);
        setLocalControlWaypoints([]);
        setShowRoutePreview(false);
        if (onExitControlMode) onExitControlMode();
        resolve();
      });
    });
  };

  const handleClearAllFences = async () => {
    if (!mqttClient || !localSelectedControlDrone) return;
    const mqttMessage = { action: 'CLEAR_EXCLUSION_FENCES' };  // ← nombre nuevo
    const topic = `${localSelectedControlDrone.uid}_action`;
    mqttClient.publish(topic, JSON.stringify(mqttMessage), { qos: 1 }, (err) => {
      if (!err) {
        console.log('✅ Exclusion fences borradas');
        setLocalExclusionFences([]);
      }
    });
  };

  const handleExitControl = () => {
    //console.log('🎮 Saliendo del modo control');
    setLocalControlMode(false);
    setLocalSelectedControlDrone(null);
    setLocalControlWaypoints([]);
    setShowRoutePreview(false);
    if (setControlWaypoints) {
      setControlWaypoints([]);
    }
    onExitControlMode();
  };

  const handleClearWaypoints = () => {
    setLocalControlWaypoints([]);
    setShowRoutePreview(false);
    if (setControlWaypoints) {
      setControlWaypoints([]);
    }
  };

  const handlePreviewRoute = (show, data, type = 'mission') => {
    console.log('👁️ Preview route:', { show, type, dataLength: data?.length });
    setShowRoutePreview(show);
    setLocalMissionType(type);
    if (show && data) {
      setPreviewFullRoute(data);
    } else {
      setPreviewFullRoute([]);
    }
  };

  const handleIncludeReturnChange = (checked) => {
    setIncludeReturn(checked);
    if (showRoutePreview && localControlWaypoints.length > 0 && localMissionType === 'mission') {
      const newFullRoute = getFullRouteForPreview(localControlWaypoints, checked);
      setPreviewFullRoute(newFullRoute);
    }
  };

  const completeMission = (droneUid, fireId) => {
    //console.log(`🏁 Misión completada: drone ${droneUid} liberado del fuego ${fireId}`);
    
    setDroneBusy(prev => {
      const newBusy = { ...prev };
      delete newBusy[droneUid];
      return newBusy;
    });
    
    setAssignedFires(prev => {
      const newAssigned = { ...prev };
      delete newAssigned[fireId];
      return newAssigned;
    });
    
    setFireAssignments(prev => 
      prev.filter(a => a.fireId !== fireId)
    );

    supabase
      .from('missions')
      .update({ drone: 'completed' })
      .eq('id', fireId)
      .then(({ error }) => {
        if (error) {
          console.error('Error actualizando misión completada:', error);
        } else {
          //console.log(`✅ Misión ${fireId} marcada como completada en BD`);
        }
      });
  };

  const handleFireRemoved = (fireId) => {
    //console.log(`🗑️ Fuego eliminado: ${fireId}, limpiando asignaciones`);
    
    setAssignedFires((prev) => {
      const newAssigned = { ...prev };
      const droneUid = prev[fireId];
      delete newAssigned[fireId];
      
      if (droneUid) {
        setDroneBusy((busy) => {
          const newBusy = { ...busy };
          delete newBusy[droneUid];
          return newBusy;
        });
      }
      
      return newAssigned;
    });
    
    setFireAssignments((prev) => prev.filter((a) => a.fireId !== fireId));
  };

  const addFireToMapAndDB = async (fire) => {
    const exists = fireLocations.some(
      (f) =>
        Math.abs(f.lat - fire.lat) < 0.0001 &&
        Math.abs(f.lng - fire.lng) < 0.0001
    );

    if (exists) {
      console.warn("Fire already exists at this location, ignored");
      return;
    }

    const { data, error } = await supabase.from("missions").insert([
      {
        latitud: fire.lat,
        longitude: fire.lng,
        see: true,
        drone: 'pending',
      },
    ]).select();

    if (error) {
      console.error("Error saving mission:", error.message);
      return;
    }

    const savedFire = data[0];
    //console.log("✅ Misión guardada en BD:", savedFire);

    const newFire = {
      id: savedFire.id,
      lat: savedFire.latitud,
      lng: savedFire.longitude,
    };

    setFireLocations((prev) => [...prev, newFire]);
  };
  
  const getClosestDrone = (droneList, fire, droneBusyMap) => {
    //console.log("🔍 Buscando drone para fuego:", fire.id);
    
    const availableDrones = droneList.filter(
      (drone) => 
        drone.water === true && 
        drone.latitude && 
        drone.longitude &&
        !droneBusyMap[drone.uid]
    );
    
    //console.log("Drones disponibles:", availableDrones.map(d => d.uid));
    
    if (availableDrones.length === 0) return null;
    
    const dronesWithDistance = availableDrones.map(drone => ({
      drone,
      distance: Math.sqrt(
        (drone.latitude - fire.lat) ** 2 + 
        (drone.longitude - fire.lng) ** 2
      )
    }));
    
    dronesWithDistance.sort((a, b) => a.distance - b.distance);
    return dronesWithDistance[0].drone;
  };

  useEffect(() => {
    const initializeMap = async () => {
      //console.log('🔄 Inicializando mapa - sincronizando con BD');
      
      setAssignedFires({});
      setDroneBusy({});
      setFireAssignments([]);
      setFireLocations([]);
      
      const { data: missions, error } = await supabase
        .from("missions")
        .select("*")
        .eq("see", true);

      if (error) {
        console.error("Error fetching saved routes:", error);
        return;
      }

      //console.log('📦 Misiones encontradas en BD:', missions?.length || 0);

      if (missions && missions.length > 0) {
        const firesFromDB = missions.map(m => ({
          id: m.id,
          lat: m.latitud,
          lng: m.longitude,
        }));
        
        const newAssignedFires = {};
        const newDroneBusy = {};
        
        missions.forEach(mission => {
          if (mission.drone && mission.drone !== 'pending' && mission.drone !== 'completed') {
            newAssignedFires[mission.id] = mission.drone;
            newDroneBusy[mission.drone] = true;
          }
        });
        
        setFireLocations(firesFromDB);
        setAssignedFires(newAssignedFires);
        setDroneBusy(newDroneBusy);
        //console.log('✅ Misiones cargadas:', firesFromDB.length);
        //console.log('📋 Drones ocupados:', Object.keys(newDroneBusy));
      } else {
        //console.log('📭 No hay misiones en BD');
      }
      
      setSavedRoutes(missions || []);
    };

    initializeMap();
  }, []);

  useEffect(() => {
    const fetchDrones = async () => {
      const { data, error } = await supabase.from("DroneList").select("*");
      if (!error) {
        setDrones(data || []);
      } else {
        console.error("Error fetching drones:", error.message);
      }
    };
    fetchDrones();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("realtime-drones")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "DroneList" },
        (payload) => {
          //console.log("Change on drone list:", payload);

          const newDrone = payload.new;
          const oldDrone = payload.old;

          setDrones((prev) => {
            switch (payload.eventType) {
              case "INSERT":
                return [...prev, newDrone];
              case "UPDATE":
                return prev.map((drone) =>
                  drone.id === newDrone.id ? newDrone : drone
                );
              case "DELETE":
                return prev.filter((drone) => drone.id !== oldDrone.id);
              default:
                return prev;
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("realtime-missions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "missions" },
        (payload) => {
          //console.log("Change on missions:", payload);
          const { new: newMission, old: oldMission } = payload;

          setSavedRoutes((prev) => {
            switch (payload.eventType) {
              case "INSERT":
                return newMission.see ? [...prev, newMission] : prev;
              case "UPDATE":
                const exists = prev.some((m) => m.id === newMission.id);
                if (newMission.see) {
                  return exists
                    ? prev.map((m) => (m.id === newMission.id ? newMission : m))
                    : [...prev, newMission];
                } else {
                  return prev.filter((m) => m.id !== newMission.id);
                }
              case "DELETE":
                return prev.filter((m) => m.id !== oldMission.id);
              default:
                return prev;
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDroneUpdate = (uid, latitude, longitude, altitudeValue, heading, telemetry) => {
    setDrones((prevDrones) => {
      const index = prevDrones.findIndex((drone) => drone.uid === uid);
      if (index === -1) return prevDrones;

      const updatedDrone = {
        ...prevDrones[index],
        latitude,
        longitude,
        telemetry: {
          ...prevDrones[index].telemetry,
          ...telemetry,
          altitude: altitudeValue,
          heading: heading,
        },
      };

      const updatedDrones = [...prevDrones];
      updatedDrones[index] = updatedDrone;

      return updatedDrones;
    });
    setRealTimeDrones(prev => ({
      ...prev,
      [uid]: { 
        lat: latitude, 
        lng: longitude, 
        alt: altitudeValue, 
        heading, 
        telemetry: { latitude, longitude, altitude_asl: altitudeValue, heading, ...telemetry } 
      }
    }));

  };
  

  useEffect(() => {
    if (addFireMode) {
      //console.log('🚫 Modo añadir fuegos activo - NO se asignan drones');
      return;
    }
    
    //console.group('🔄 Asignando fuegos a drones');
    //console.log('Fuegos actuales:', fireLocations);
    //console.log('Fuegos ya asignados:', assignedFires);
    //console.log('Drones ocupados:', droneBusy);
    
    if (drones.length === 0 || fireLocations.length === 0) {
      setFireAssignments([]);
      console.groupEnd();
      return;
    }

    const pendingFires = fireLocations.filter(
      fire => !assignedFires[fire.id]
    );
    
    //console.log('Fuegos pendientes:', pendingFires.length);
    
    if (pendingFires.length === 0) {
      //console.log('No hay fuegos pendientes');
      console.groupEnd();
      return;
    }

    const currentDroneBusy = { ...droneBusy };
    const newAssignments = [];
    const newAssignedFires = { ...assignedFires };
    let hasChanges = false;

    for (const fire of pendingFires) {
      const availableDrones = drones.filter(
        drone => drone.water === true && 
                drone.latitude && 
                drone.longitude &&
                !currentDroneBusy[drone.uid]
      );
      
      if (availableDrones.length === 0) {
        //console.log(`❌ No hay drones disponibles para fuego ${fire.id}`);
        continue;
      }
      
      let closestDrone = null;
      let minDistance = Infinity;
      
      for (const drone of availableDrones) {
        const distance = Math.sqrt(
          Math.pow(drone.latitude - fire.lat, 2) + 
          Math.pow(drone.longitude - fire.lng, 2)
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestDrone = drone;
        }
      }
      
      if (closestDrone) {
        //console.log(`✅ Fuego ${fire.id} asignado a drone ${closestDrone.uid}`);
        
        currentDroneBusy[closestDrone.uid] = true;
        newAssignedFires[fire.id] = closestDrone.uid;
        
        newAssignments.push({
          fireId: fire.id,
          fire: fire,
          drone: closestDrone
        });
        
        hasChanges = true;

        supabase
          .from('missions')
          .update({ drone: closestDrone.uid })
          .eq('id', fire.id)
          .then(({ error }) => {
            if (error) {
              console.error('Error actualizando drone en BD:', error);
            } else {
              //console.log(`✅ BD actualizada: fuego ${fire.id} → drone ${closestDrone.uid}`);
            }
          });
      }
    }

    if (hasChanges) {
      setFireAssignments(prev => [...prev, ...newAssignments]);
      setAssignedFires(newAssignedFires);
      setDroneBusy(currentDroneBusy);
    }
    
    console.groupEnd();
  }, [fireLocations, drones, addFireMode]);

  const toggleFires = () => setShowFires((prev) => !prev);

  const fireRoutes = useMemo(() => {
    //console.log('🔄 Recalculando fireRoutes, misiones:', savedRoutes.length);
    
    return savedRoutes
      .filter((mission) => {
        if (!mission.drone || mission.drone === 'pending' || mission.drone === 'completed') {
          return false;
        }
        
        const droneExists = drones.some(d => d.uid === mission.drone);
        if (!droneExists) return false;
        
        if (!mission.latitud || !mission.longitude) return false;
        
        return true;
      })
      .map((mission) => {
        const assignedDrone = drones.find((d) => d.uid === mission.drone);
        
        return (
          <FireRoute
            key={`fire-route-${mission.id}`}
            drone={assignedDrone}
            fireLocation={{ 
              lat: mission.latitud, 
              lng: mission.longitude 
            }}
            homeLocation={{ 
              lat: assignedDrone.latitude, 
              lng: assignedDrone.longitude 
            }}
            mqttClient={mqttClient}
            savedWaypoints={mission.waypoints}
            missionId={mission.id}
            onRouteGenerated={(routeData) => {
              //console.log(`🎯 Ruta generada para misión ${mission.id}`);
            }}
          />
        );
      });
  }, [savedRoutes, drones, mqttClient]);

  // Componente para seleccionar drone por clic en el mapa
  function ClickToSelectDrone({ map, drones, realTimeDrones, onDroneClick }) {
    useMapEvents({
      click: (e) => {
        // Pequeño delay para dar oportunidad al marcador de procesar su clic primero
        setTimeout(() => {
          const clickLat = e.latlng.lat;
          const clickLng = e.latlng.lng;
          
          // Encontrar el drone más cercano al clic
          let closestDrone = null;
          let minDistance = 50; // Radio máximo en metros para considerar selección
          
          drones.forEach(drone => {
            if (!drone.show) return;
            
            const rtData = realTimeDrones[drone.uid] || {};
            const droneLat = rtData.lat ?? drone.latitude;
            const droneLng = rtData.lng ?? drone.longitude;
            
            if (!droneLat || !droneLng) return;
            
            // Calcular distancia en metros (aproximación)
            const R = 6371000; // Radio de la Tierra en metros
            const φ1 = clickLat * Math.PI / 180;
            const φ2 = droneLat * Math.PI / 180;
            const Δφ = (droneLat - clickLat) * Math.PI / 180;
            const Δλ = (droneLng - clickLng) * Math.PI / 180;
            
            const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                      Math.cos(φ1) * Math.cos(φ2) *
                      Math.sin(Δλ/2) * Math.sin(Δλ/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distance = R * c;
            
            if (distance < minDistance) {
              minDistance = distance;
              closestDrone = drone;
            }
          });
          
          if (closestDrone && minDistance < 30) {
            console.log('🎯 Drone seleccionado por clic cercano:', closestDrone.uid, 'distancia:', minDistance.toFixed(2), 'm');
            onDroneClick(closestDrone);
          }
        }, 100);
      }
    });
    
    return null;
  }

  return (
    <>
      <MqttClient
        onDroneUpdate={handleDroneUpdate}
        onClientReady={setMqttClient}
        onFireDetection={(fire) => {
          //console.log("New fire from MQTT:", fire);
          addFireToMapAndDB(fire);
        }}
        onMissionComplete={completeMission}
      />
      <MapStyleMenu
        mapInstance={mapInstance}
        mapRef={mapRef}
        mapStyle={mapStyle}
        setMapStyle={setMapStyle}
        showVolantOverlay={showVolantOverlay}
        setShowVolantOverlay={setShowVolantOverlay}
        showFires={showFires}
        toggleFires={toggleFires}
        setShowAero={setShowAero}
        showAero={showAero}
      />
      <MapContainer
        center={[41.808905, 2.163105]}
        zoom={18}
        scrollWheelZoom={true}
        style={{ height: "100vh", width: "100vw" }}
        whenCreated={(mapInstance) => (mapRef.current = mapInstance)}
        ref={setMapInstance}
        maxZoom={22}
        // 👇 AÑADE ESTAS OPCIONES
        doubleClickZoom={false}
        tap={false}
      >
        <TileLayer
          attribution={tileLayers[mapStyle].attribution}
          url={tileLayers[mapStyle].url}
          maxZoom={22}
        />

        {!localControlMode && (
          <FireWaypoints
            fireLocations={fireLocations}
            setFireLocations={setFireLocations}
            addFireToMapAndDB={addFireToMapAndDB}
            onFireRemoved={handleFireRemoved}
            controlMode={localControlMode}
            addFireMode={addFireMode}
          />
        )}

        {!localControlMode && (
          <MapOverlays
            showVolantOverlay={showVolantOverlay}
            showFires={showFires}
          />
        )}

        {showAero && <AeroZonesLayer />}

        <ControlWaypoints
          waypoints={localControlWaypoints}
          setWaypoints={(newWaypoints) => {
            console.log('🔄 Actualizando puntos:', newWaypoints);
            setLocalControlWaypoints(newWaypoints);
            if (setControlWaypoints) {
              setControlWaypoints(newWaypoints);
            }
          }}
          enabled={localControlMode && localSelectedControlDrone}
          missionType={localMissionType} // 👈 Esta línea debe existir
        />

        <RoutePreview
          waypoints={showRoutePreview ? previewFullRoute : []}
          droneLocation={droneCurrentLocation}
          homeLocation={localMissionType === 'mission' && includeReturn ? droneHomeLocation : null}
          map={mapInstance}
          enabled={showRoutePreview && localControlMode && localControlWaypoints.length > (localMissionType === 'fence' ? 2 : 0)}
          previewType={localMissionType}  // 👈 AÑADE ESTA LÍNEA (o cámbiala si ya existe)
        />

        <SeeDronesMap 
          drones={localControlMode && localSelectedControlDrone ? [localSelectedControlDrone] : drones}
          onDroneClick={(drone) => {
            console.log('🖱️ SeeDronesMap click detectado en map.jsx:', drone?.uid);
            onDroneClick(drone);
          }}
          busyDrones={droneBusy}
          realTimeDrones={realTimeDrones}
        />
        
        {!localControlMode && savedRoutes.map((mission) => (
          <Marker
            key={`fire-${mission.id}`}
            position={[mission.latitud, mission.longitude]}
            icon={fireIcon}
          />
        ))}

        {!localControlMode && fireRoutes}

        {/* 👇 RUTAS ACTIVAS PERSISTENTES (AZULES) */}
        {Object.keys(activeRoutes).length > 0 && (
          <ActiveRoutesLayer
            activeRoutes={activeRoutes}
            dronesLocations={realTimeDrones}
            map={mapInstance}
          />
        )}

        {Object.keys(activeFences).length > 0 && (
          <FenceLayer
            fences={activeFences}
            map={mapInstance}
          />
        )}

        <ExclusionFenceLayer
          exclusionFences={localExclusionFences}
          map={mapInstance}
        />


        {!localControlMode && (
          <ClickToSelectDrone 
            map={mapInstance} 
            drones={drones} 
            realTimeDrones={realTimeDrones}
            onDroneClick={onDroneClick}
          />
        )}
        


      </MapContainer>

      {localControlMode && localSelectedControlDrone && (
        <DroneControlPanel
          drone={localSelectedControlDrone}
          onExitControl={handleExitControl}
          onSendRoute={handleSendRoute}
          onSendFence={handleSendFence}
          onSendExclusionFence={handleSendExclusionFence} 
          onClearAllFences={handleClearAllFences}  
          onPreviewRoute={handlePreviewRoute}
          onIncludeReturnChange={handleIncludeReturnChange}
          waypoints={localControlWaypoints}
          onClearWaypoints={handleClearWaypoints}
          homeLocation={droneHomeLocation}
        />
      )}

      {selectedDrone && (
        <EditDroneModal
          drone={selectedDrone}
          onSave={async (updatedDrone) => {
            const { error } = await supabase
              .from("DroneList")
              .update({
                uid: updatedDrone.uid,
                name: updatedDrone.name,
                color: updatedDrone.color,
                SpeechBubbleDroneIcone: updatedDrone.SpeechBubbleDroneIcone,
                telemetry: updatedDrone.telemetry,
                latitude: updatedDrone.latitude,
                longitude: updatedDrone.longitude,
              })
              .eq("id", updatedDrone.id);

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
          onControlDrone={(drone) => {
            //console.log('🔴 onControlDrone llamado desde map.jsx');
            setLocalControlMode(true);
            setLocalSelectedControlDrone(drone);
            setLocalControlWaypoints([]);
            setSelectedDrone(null);
            onControlModeSelect(drone);
          }}
        />
      )}
    </>
  );
}