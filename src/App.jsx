import { useEffect, useState, useCallback } from 'react';
import './App.css';
import LateralMenu from './components/lateralMenu/lateralMenu';
import Map from './components/map/map';
import MqttClient from './components/mqttClient';
import EditDroneModal from './components/popup/popupEditDevice';
import supabase from './supabaseClient';
import Login from './components/login';
import FloatingDroneList from './components/floatingWindows/floatingDroneList';
import FloatingUsers from './components/floatingWindows/floatingUsers';
import DroneActionPanel from './components/DroneControl/DroneActionPanel';

function App() {
  // 1. TODOS LOS useState PRIMERO
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [drones, setDrones] = useState([]);
  const [visibleDrones, setVisibleDrones] = useState({});
  const [selectedDrone, setSelectedDrone] = useState(null);
  const [mqttClient, setMqttClient] = useState(null);
  const [realTimeDrones, setRealTimeDrones] = useState({});
  const [isFloatingDronesVisible, setIsFloatingDronesVisible] = useState(false);
  const [isFloatingUsersVisible, setIsFloatingUsersVisible] = useState(false);
  const [controlMode, setControlMode] = useState(false);
  const [selectedControlDrone, setSelectedControlDrone] = useState(null);
  const [controlWaypoints, setControlWaypoints] = useState([]);
  const [addFireMode, setAddFireMode] = useState(false);
  const [selectedActionDrone, setSelectedActionDrone] = useState(null);
  const [activeFences, setActiveFences] = useState({});
  
  // 👇 NUEVO: Estado para rutas activas (múltiples drones)
  const [activeRoutes, setActiveRoutes] = useState({}); // { [droneUid]: { waypoints, startTime, type } }

  // 2. FUNCIONES QUE NO DEPENDEN DE OTRAS FUNCIONES
  const fetchDrones = async () => {
    const { data, error } = await supabase.from('DroneList').select('*');
    if (!error) {
      setDrones(data || []);
      const visibilityMap = {};
      (data || []).forEach(drone => {
        visibilityMap[drone.id] = drone.show !== undefined ? drone.show : true;
      });
      setVisibleDrones(visibilityMap);
    } else {
      console.error('Error fetching drones:', error.message);
    }
  };

  const handleClientReady = useCallback((client) => {
    setMqttClient(client);
  }, []);

  const handleDroneUpdate = useCallback((uid, lat, lng, alt, heading, rest) => {
    setRealTimeDrones(prev => ({
      ...prev,
      [uid]: { lat, lng, alt, heading, telemetry: { latitude: lat, longitude: lng, altitude_asl: alt, heading, ...rest } },
    }));
  }, []);

  const handleNewDroneDetected = useCallback((newDrone) => {
    //console.log('🚁 Nuevo drone detectado automáticamente:', newDrone);
    setDrones(prev => {
      if (prev.some(d => d.uid === newDrone.uid)) return prev;
      return [...prev, newDrone];
    });
    setVisibleDrones(prev => ({
      ...prev,
      [newDrone.id]: true
    }));
  }, []);

  // 👇 AÑADE ESTA FUNCIÓN
  const handleFenceActivated = useCallback((droneUid, vertices) => {
    console.log('🚧 Fence activado para', droneUid, 'con', vertices.length, 'vértices');
    setActiveFences(prev => ({
      ...prev,
      [droneUid]: {
        vertices,
        startTime: Date.now(),
        type: 'fence'
      }
    }));
  }, []);

  const toggleDroneVisibility = async (droneId) => {
    const currentVisible = visibleDrones[droneId] ?? true;
    const { error } = await supabase
      .from('DroneList')
      .update({ show: !currentVisible })
      .eq('id', droneId);

    if (error) {
      console.error('Error actualizando visibilidad:', error.message);
      return;
    }

    setVisibleDrones(prev => ({
      ...prev,
      [droneId]: !currentVisible,
    }));
  };

  const handleEditSave = async (updatedDrone) => {
    const { error } = await supabase
      .from('DroneList')
      .update({
        uid: updatedDrone.uid,
        name: updatedDrone.name,
        color: updatedDrone.color,
        SpeechBubbleDroneIcone: updatedDrone.SpeechBubbleDroneIcone,
        show: visibleDrones[updatedDrone.id] ?? true,
      })
      .eq('id', updatedDrone.id);

    if (error) {
      console.error('Error updating drone:', error);
      return;
    }

    setDrones(prev =>
      prev.map(d => (d.id === updatedDrone.id ? { ...d, ...updatedDrone } : d))
    );
    setSelectedDrone(null);
  };

  const handleAddFireMode = useCallback(() => {
    if (controlMode) {
      alert('Primero sal del modo control');
      return;
    }
    setAddFireMode(prev => !prev);
  }, [controlMode]);

  const handleControlModeSelect = useCallback((drone) => {
    //console.log('🎮 Entrando en modo control para:', drone?.uid);
    setControlMode(true);
    setSelectedControlDrone(drone);
    setControlWaypoints([]);
    setSelectedDrone(null);
    setIsFloatingDronesVisible(false);
    if (addFireMode) {
      setAddFireMode(false);
    }
  }, [addFireMode]);

  const handleExitControlMode = useCallback(() => {
    //console.log('🎮 Saliendo del modo control');
    setControlMode(false);
    setSelectedControlDrone(null);
    setControlWaypoints([]);
  }, []);

  const handleRouteActivated = useCallback((droneUid, waypoints) => {
    const droneData = realTimeDrones[droneUid];
    const startPosition = droneData 
      ? { lat: droneData.lat, lng: droneData.lng }
      : null;

    setActiveRoutes(prev => ({
      ...prev,
      [droneUid]: {
        waypoints,
        startPosition,
        startTime: Date.now(),
        type: 'control_route'
      }
    }));
  }, [realTimeDrones]);

  // 👇 NUEVO: Función para limpiar una ruta activa
  const handleClearRoute = useCallback((droneUid) => {
    //console.log('🧹 Limpiando ruta activa para', droneUid);
    setActiveRoutes(prev => {
      const newRoutes = { ...prev };
      delete newRoutes[droneUid];
      return newRoutes;
    });
  }, []);

  // 3. FUNCIONES PARA COMANDOS MQTT
  const sendDroneCommand = useCallback((droneUid, command, extraParams = {}) => {
    if (!mqttClient) {
      console.error('❌ Cliente MQTT no disponible');
      alert('Error: No hay conexión MQTT');
      return false;
    }

    const topic = `${droneUid}_action`;
    
    let message = {};
    
    switch (command) {
      case 'ARM':
        message = { action: 'ARM' };
        break;
      case 'DISARM':
        message = { action: 'DISARM' };
        break;
      case 'TAKEOFF':
        message = { action: 'TAKEOFF', alt: extraParams.alt || 20 };
        break;
      case 'LAND_NOW':
        message = { action: 'LAND_NOW' };
        break;
      case 'RTL':
        message = { action: 'RTL' };
        break;
      case 'HOLD_POSITION':
        message = { action: 'HOLD_POSITION' };
        break;
      case 'EMERGENCY_STOP':
        message = { action: 'EMERGENCY_STOP' };
        break;
      case 'GUIDED':
        message = { 
          action: 'GUIDED', 
          new_lat: extraParams.lat, 
          new_lon: extraParams.lng, 
          new_alt: extraParams.alt || 30 
        };
        break;
      case 'AUTO':
        message = { 
          action: 'AUTO', 
          waypoints: extraParams.waypoints || [] 
        };
        break;
      default:
        message = { action: command, ...extraParams };
    }

    const payload = JSON.stringify(message);
    
    //console.log(`📡 Enviando comando ${command} a ${topic}:`, payload);
    
    mqttClient.publish(topic, payload, { qos: 1 }, (err) => {
      if (err) {
        console.error(`❌ Error enviando comando ${command}:`, err);
      } else {
        //console.log(`✅ Comando ${command} enviado a ${topic}`);
      }
    });
    
    return true;
  }, [mqttClient]);

  const handleArm = useCallback(() => {
    if (!selectedActionDrone) return;
    sendDroneCommand(selectedActionDrone.uid, 'ARM');
  }, [selectedActionDrone, sendDroneCommand]);

  const handleDisarm = useCallback(() => {
    if (!selectedActionDrone) return;
    sendDroneCommand(selectedActionDrone.uid, 'DISARM');
  }, [selectedActionDrone, sendDroneCommand]);

  const handleTakeoff = useCallback(() => {
    if (!selectedActionDrone) return;
    sendDroneCommand(selectedActionDrone.uid, 'TAKEOFF', { alt: 20 });
  }, [selectedActionDrone, sendDroneCommand]);

  const handleLand = useCallback(() => {
    if (!selectedActionDrone) return;
    sendDroneCommand(selectedActionDrone.uid, 'LAND_NOW');
  }, [selectedActionDrone, sendDroneCommand]);

  const handleRTL = useCallback(() => {
    if (!selectedActionDrone) return;
    sendDroneCommand(selectedActionDrone.uid, 'RTL');
  }, [selectedActionDrone, sendDroneCommand]);

  const handleLoiter = useCallback(() => {
    if (!selectedActionDrone) return;
    sendDroneCommand(selectedActionDrone.uid, 'HOLD_POSITION');
  }, [selectedActionDrone, sendDroneCommand]);

  const handleEmergencyStop = useCallback(() => {
    if (!selectedActionDrone) return;
    sendDroneCommand(selectedActionDrone.uid, 'EMERGENCY_STOP');
  }, [selectedActionDrone, sendDroneCommand]);

  const handleDroneClick = useCallback((drone) => {
    //console.log('🖱️ Drone seleccionado:', drone?.uid);
    setSelectedActionDrone(drone);
  }, []);

  // 4. useEffect
  useEffect(() => {
    const initSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setLoadingSession(false);
    };
    initSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) fetchDrones();
  }, [session]);

  // 5. Renderizado
  if (loadingSession) return null;
  if (!session) return <Login />;

  return (
    <section className="container">
      <MqttClient
        onClientReady={handleClientReady}
        onDroneUpdate={handleDroneUpdate}
        onNewDroneDetected={handleNewDroneDetected}
      />

      <div className="lateralMenu" style={{ display: controlMode ? 'none' : 'block' }}>
        <LateralMenu
          drones={drones}
          visibleDrones={visibleDrones}
          toggleDroneVisibility={toggleDroneVisibility}
          onEditDrone={setSelectedDrone}
          mqttClient={mqttClient}
          realTimeDrones={realTimeDrones}
          isFloatingDronesVisible={isFloatingDronesVisible}
          isFloatingUsersVisible={isFloatingUsersVisible}
          onRestoreDrones={() => setIsFloatingDronesVisible(true)}
          onRestoreUsers={() => setIsFloatingUsersVisible(true)}
          onAddFireMode={handleAddFireMode}
          isAddFireModeActive={addFireMode}
        />
      </div>

      <div className="map">
        <Map
          drones={drones}
          visibleDrones={visibleDrones}
          realTimeDrones={realTimeDrones}
          controlMode={controlMode}
          selectedControlDrone={selectedControlDrone}
          controlWaypoints={controlWaypoints}
          setControlWaypoints={setControlWaypoints}
          onControlModeSelect={handleControlModeSelect}
          onExitControlMode={handleExitControlMode}
          addFireMode={addFireMode}
          onDroneClick={handleDroneClick}
          activeRoutes={activeRoutes}
          activeFences={activeFences}  
          onRouteActivated={handleRouteActivated}
          onFenceActivated={handleFenceActivated}
          onClearRoute={handleClearRoute}
          onSendFence={() => {}}
        />

        {isFloatingDronesVisible && !controlMode && (
          <FloatingDroneList
            drones={drones}
            onMinimize={() => setIsFloatingDronesVisible(false)}
            onControlDrone={handleControlModeSelect}
          />
        )}

        {isFloatingUsersVisible && !controlMode && (
          <FloatingUsers
            onMinimize={() => setIsFloatingUsersVisible(false)}
            session={session}
          />
        )}
      </div>

      {/* Panel de acciones del drone */}
      {selectedActionDrone && (
        <DroneActionPanel
          drone={selectedActionDrone}
          onClose={() => setSelectedActionDrone(null)}
          onEdit={() => {
            setSelectedDrone(selectedActionDrone);
            setSelectedActionDrone(null); 
          }}
          onControlMode={() => handleControlModeSelect(selectedActionDrone)}
          onArm={handleArm}
          onDisarm={handleDisarm}
          onTakeoff={handleTakeoff}
          onLand={handleLand}
          onRTL={handleRTL}
          onLoiter={handleLoiter}
          onEmergencyStop={handleEmergencyStop}
          isConnected={true}
        />
      )}

      {/* Modal de edición de drone */}
      {selectedDrone && (
        <EditDroneModal
          drone={selectedDrone}
          onSave={handleEditSave}
          onClose={() => setSelectedDrone(null)}
          onControlDrone={handleControlModeSelect}
        />
      )}
    </section>
  );
}

export default App;