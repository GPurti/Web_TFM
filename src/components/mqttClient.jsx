import { useEffect, useRef } from 'react';
import mqtt from 'mqtt';
import supabase from '../supabaseClient';

export default function MqttClient({
  onDroneUpdate,
  onClientReady,
  onFireDetection,
  onMissionComplete,
  onNewDroneDetected,
}) {
  const knownUidsRef = useRef([]);
  const onDroneUpdateRef = useRef(onDroneUpdate);
  const onClientReadyRef = useRef(onClientReady);
  const onFireDetectionRef = useRef(onFireDetection);
  const onMissionCompleteRef = useRef(onMissionComplete);
  const onNewDroneDetectedRef = useRef(onNewDroneDetected);
  const clientRef = useRef(null);
  
  // Control ABSOLUTO
  const registeredDronesRef = useRef(new Set());
  const pendingRegistrationRef = useRef(new Set());
  const messageCounterRef = useRef(0);

  useEffect(() => {
    onDroneUpdateRef.current = onDroneUpdate;
  }, [onDroneUpdate]);

  useEffect(() => {
    onClientReadyRef.current = onClientReady;
  }, [onClientReady]);

  useEffect(() => {
    onFireDetectionRef.current = onFireDetection;
  }, [onFireDetection]);

  useEffect(() => {
    onMissionCompleteRef.current = onMissionComplete;
  }, [onMissionComplete]);

  useEffect(() => {
    onNewDroneDetectedRef.current = onNewDroneDetected;
  }, [onNewDroneDetected]);

  // Cargar UIDs conocidos al iniciar
  useEffect(() => {
    const fetchDroneUids = async () => {
      //console.log('🔍 Cargando drones existentes...');
      const { data, error } = await supabase.from('DroneList').select('uid');
      if (!error) {
        knownUidsRef.current = data.map((d) => d.uid);
        data.forEach(d => registeredDronesRef.current.add(d.uid));
        //console.log('📋 Drones en BD:', Array.from(registeredDronesRef.current));
      } else {
        console.error('❌ Error cargando drones:', error);
      }
    };
    fetchDroneUids();
  }, []);

  // Función para registrar un nuevo drone
  const registerNewDrone = async (droneUid, telemetryData = {}) => {
    const callId = ++messageCounterRef.current;
    //console.log(`[${callId}] 🆕 Intentando registrar:`, droneUid);
    
    // BARRERA 1: Set permanente
    if (registeredDronesRef.current.has(droneUid)) {
      //console.log(`[${callId}] 🚫 BLOQUEADO por registeredDronesRef:`, droneUid);
      return null;
    }

    // BARRERA 2: Registro en curso
    if (pendingRegistrationRef.current.has(droneUid)) {
      //console.log(`[${callId}] ⏳ BLOQUEADO por pendingRegistrationRef:`, droneUid);
      return null;
    }

    //console.log(`[${callId}] ✅ Pasando barreras, marcando como pendiente...`);
    pendingRegistrationRef.current.add(droneUid);

    try {
      // BARRERA 3: Verificar BD
      //console.log(`[${callId}] 🔍 Verificando en BD:`, droneUid);
      const { data: existingDrone, error: selectError } = await supabase
        .from('DroneList')
        .select('uid')
        .eq('uid', droneUid)
        .maybeSingle();

      if (selectError) {
        console.error(`[${callId}] ❌ Error en select:`, selectError);
        return null;
      }

      if (existingDrone) {
        //console.log(`[${callId}] ⚠️ Ya existe en BD:`, droneUid);
        registeredDronesRef.current.add(droneUid);
        return null;
      }

      //console.log(`[${callId}] 📦 Insertando nuevo drone...`);
      const newDrone = {
        uid: droneUid,
        name: telemetryData.name || `Drone ${droneUid.slice(0, 4)}`,
        latitude: telemetryData.latitude || 0,
        longitude: telemetryData.longitude || 0,
        color: telemetryData.color || '#' + Math.floor(Math.random()*16777215).toString(16),
        SpeechBubbleDroneIcone: false,
        show: true,
        water: telemetryData.water || false,
        Status: true,
        telemetry: {
          altitude: telemetryData.altitude || telemetryData.altitude_asl || 0,
          heading: telemetryData.heading || 0,
          ...telemetryData
        }
      };

      const { data, error } = await supabase
        .from('DroneList')
        .insert([newDrone])
        .select();

      if (error) {
        console.error(`[${callId}] ❌ Error insertando:`, error);
        return null;
      }

      //console.log(`[${callId}] ✅ REGISTRO EXITOSO:`, data[0]);
      
      // 🚨 MARCAR COMO REGISTRADO PERMANENTEMENTE
      registeredDronesRef.current.add(droneUid);
      //console.log(`[${callId}] 📝 registeredDronesRef actualizado:`, Array.from(registeredDronesRef.current));
      
      return data[0];

    } finally {
      pendingRegistrationRef.current.delete(droneUid);
      //console.log(`[${callId}] 🔓 pendingRegistrationRef liberado`);
    }
  };

  useEffect(() => {
    if (clientRef.current) return;

    const mqttClient = mqtt.connect(import.meta.env.VITE_URL_MQTT, {
      clientId: 'mqtt_map_' + Math.random().toString(16).substring(2, 8),
      username: import.meta.env.VITE_USERNAME_MQTT,
      password: import.meta.env.VITE_PASSWORD_MQTT,
      clean: false,
      connectTimeout: 4000,
      reconnectPeriod: 1000,
    });

    clientRef.current = mqttClient;

    mqttClient.on('connect', () => {
      //console.log('✅ Connected to MQTT broker');
      mqttClient.subscribe('#', { qos: 0 }, (err) => {
        if (err) console.error('Subscription error:', err.message);
      });
      onClientReadyRef.current?.(mqttClient);
    });

    mqttClient.on('message', async (topic, message) => {
      const msgId = ++messageCounterRef.current;
      //console.log(`\n[${msgId}] 📨 MENSAJE RECIBIDO:`, topic);

      try {
        const payload = JSON.parse(message.toString());
        //console.log(`[${msgId}] 📦 Payload:`, payload);

        // Detección de incendios
        if (topic === 'fire_detection' && payload.coordinates) {
          //console.log(`[${msgId}] 🔥 Fire detection`);
          const { lat, lon } = payload.coordinates;
          onFireDetectionRef.current?.({
            id: Date.now(),
            lat,
            lng: lon,
          });
          return;
        }

        // 📡 TELEMETRÍA
        if (topic.endsWith('_telemetry')) {
          const droneUid = topic.replace('_telemetry', '');
          //console.log(`[${msgId}] 📡 Telemetría de:`, droneUid);
          //console.log(`[${msgId}] 🎯 registeredDronesRef contiene:`, Array.from(registeredDronesRef.current));
          
          if (!registeredDronesRef.current.has(droneUid)) {
            //console.log(`[${msgId}] 🆕 Drone NO registrado, intentando registrar...`);
            const newDrone = await registerNewDrone(droneUid, payload);
            if (newDrone && onNewDroneDetectedRef.current) {
              //console.log(`[${msgId}] 📢 Notificando nuevo drone...`);
              onNewDroneDetectedRef.current(newDrone);
            }
          } else {
            //console.log(`[${msgId}] ✅ Drone YA registrado, solo telemetría`);
          }

          // Siempre procesar telemetría
          const { latitude, longitude, altitude_asl, heading, ...rest } = payload;
          if (latitude && longitude) {
            //console.log(`[${msgId}] 📍 Actualizando posición:`, { latitude, longitude });
            onDroneUpdateRef.current?.(
              droneUid,
              latitude,
              longitude,
              altitude_asl,
              heading,
              rest
            );
          }
          return;
        }

        // Misión completada
        if (topic.endsWith('_mission_complete')) {
          const droneUid = topic.replace('_mission_complete', '');
          const { fireId, status } = payload;
          if (status === 'completed' || status === 'success') {
            onMissionCompleteRef.current?.(droneUid, fireId);
          }
        }

      } catch (err) {
        console.warn(`[${msgId}] ❌ Error:`, err.message);
      }
    });

    return () => {
      if (clientRef.current) {
        clientRef.current.end(true);
        clientRef.current = null;
      }
    };
  }, []);

  return null;
}
