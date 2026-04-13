import { useEffect, useRef } from 'react';

export default function SaveMission({
  drone,
  fireLocation,
  mqttClient,
  onRouteGenerated,
  stateFireRoute,
  sendTrigger = 0,
  waypointsFromMission = null
}) {
  const lastTrigger = useRef(null);
  const hasPublishedRef = useRef(false);

  useEffect(() => {
    // Solo proceder si tenemos waypoints
    if (!waypointsFromMission || waypointsFromMission.length === 0) {
      console.log('⏳ Esperando waypoints para enviar...');
      return;
    }

    if (lastTrigger.current === sendTrigger) return;
    lastTrigger.current = sendTrigger;
    hasPublishedRef.current = false;

    async function sendRoute() {
      try {
        console.log('📦 Waypoints a enviar:', waypointsFromMission);

        if (stateFireRoute && mqttClient?.connected && !hasPublishedRef.current) {
          const mqttMessage = {
            action: 'AUTO',
            waypoints: waypointsFromMission.map(({ lat, lng, alt }) => ({
              lat,
              lon: lng,
              alt: alt || 20,
            })),
          };

          const topic = `${drone.uid}_action`;

          mqttClient.publish(topic, JSON.stringify(mqttMessage), { qos: 1 }, (err) => {
            if (err) {
              console.error(`Error sending route via MQTT (${topic}):`, err);
            } else {
              console.log(`✅ Ruta enviada a "${topic}" con ${waypointsFromMission.length} waypoints`);
              hasPublishedRef.current = true;
            }
          });
        }

        if (typeof onRouteGenerated === 'function') {
          onRouteGenerated(waypointsFromMission);
        }

      } catch (error) {
        console.error('Error sending route:', error);
      }
    }

    sendRoute();
  }, [
    drone,
    fireLocation,
    mqttClient,
    onRouteGenerated,
    stateFireRoute,
    sendTrigger,
    waypointsFromMission
  ]);

  return null;
}