import { Marker } from 'react-leaflet';
import L from 'leaflet';
import ReactDOMServer from 'react-dom/server';
import DroneIcon from '../DroneManagement/droneIcon';
import { useMemo } from 'react';

function DroneMarker({ drone, onSelectDrone, onDroneClick, isBusy }) {
  const droneDivIcon = useMemo(() => {
    const iconHtml = ReactDOMServer.renderToString(
      <DroneIcon
        name={drone.name}
        latitude={drone.latitude}
        longitude={drone.longitude}
        altitude={drone.telemetry?.altitude || 0}
        heading={drone.telemetry?.heading || 0}
        speechBubbleVisible={drone.SpeechBubbleDroneIcone}
        color={drone.color}
        water={drone.water}
        telemetry={drone.telemetry}
      />
    );

    const busyStyle = isBusy ? 'filter: drop-shadow(0 0 10px red);' : '';

    return L.divIcon({
      html: `<div style="${busyStyle}">${iconHtml}</div>`,
      className: '',
      iconAnchor: [32, 32],
    });
  }, [
    drone.name,
    drone.latitude,
    drone.longitude,
    drone.telemetry?.altitude,
    drone.telemetry?.heading,
    drone.color,
    drone.SpeechBubbleDroneIcone,
    drone.water,
    isBusy,
  ]);

  const handleClick = () => {
    // Primero notificamos al padre para que muestre el panel de acciones
    if (onDroneClick) {
      onDroneClick(drone);
    }

  };

  return (
    <Marker
      key={`drone-${drone.uid}-${drone.id}`}
      position={[drone.latitude, drone.longitude]}
      icon={droneDivIcon}
      eventHandlers={{
        click: handleClick,
      }}
    />
  );
}

export default function SeeDronesMap({ drones, onSelectDrone, onDroneClick, busyDrones = {} }) {
  return (
    <>
      {drones.filter((d) => d.show).map((d) => (
        <DroneMarker
          key={`drone-${d.uid}-${d.id}`}
          drone={d}
          onSelectDrone={onSelectDrone}
          onDroneClick={onDroneClick}
          isBusy={!!busyDrones[d.uid]}
        />
      ))}
    </>
  );
}