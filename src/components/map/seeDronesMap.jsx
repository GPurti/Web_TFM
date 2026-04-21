import { Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import ReactDOMServer from 'react-dom/server';
import DroneIcon from '../DroneManagement/droneIcon';
import { useMemo, useCallback, useRef, useEffect, useState } from 'react';

function DroneMarker({ drone, realTimeDrones, onSelectDrone, onDroneClick, isBusy }) {
  const markerRef = useRef(null);
  const map = useMap();
  const [isHovered, setIsHovered] = useState(false);
  const clickTimeoutRef = useRef(null);
  const lastValidModeRef = useRef(null);
  const lastValidArmedRef = useRef(null);

  const rtData = realTimeDrones?.[drone.uid] || {};

  const mergedDrone = useMemo(() => ({
    ...drone,
    latitude: rtData.lat ?? drone.latitude,
    longitude: rtData.lng ?? drone.longitude,
    telemetry: rtData.telemetry ?? drone.telemetry,
  }), [drone, rtData.lat, rtData.lng, rtData.telemetry]);

  // Actualizar último modo válido (ignorar STABILIZE)
  const mergedTelemetry = rtData.telemetry ?? drone.telemetry;
  if (mergedTelemetry?.flight_mode && mergedTelemetry.flight_mode !== 'STABILIZE') {
    lastValidModeRef.current = mergedTelemetry.flight_mode;
    lastValidArmedRef.current = mergedTelemetry.armed;
  }
  const filteredTelemetry = useMemo(() => {
    const telemetry = rtData.telemetry ?? drone.telemetry;
    
    if (telemetry?.flight_mode && telemetry.flight_mode !== 'STABILIZE') {
      lastValidModeRef.current = telemetry.flight_mode;
      lastValidArmedRef.current = telemetry.armed;
    }

    return {
      ...telemetry,
      flight_mode: lastValidModeRef.current,
      armed: lastValidArmedRef.current,
    };
  }, [rtData.telemetry, drone.telemetry]);

  const positionRef = useRef({
    lat: drone.latitude,
    lng: drone.longitude
  });

  useEffect(() => {
    const rt = realTimeDrones?.[drone.uid];
    if (rt && rt.lat && rt.lng) {
      if (positionRef.current.lat !== rt.lat || positionRef.current.lng !== rt.lng) {
        positionRef.current = { lat: rt.lat, lng: rt.lng };
        if (markerRef.current) {
          markerRef.current.setLatLng([rt.lat, rt.lng]);
        }
      }
    }
  }, [realTimeDrones, drone.uid]);

  const droneDivIcon = useMemo(() => {
    const iconHtml = ReactDOMServer.renderToString(
      <DroneIcon
        name={mergedDrone.name}
        latitude={mergedDrone.latitude}
        longitude={mergedDrone.longitude}
        altitude={mergedDrone.telemetry?.altitude_asl || mergedDrone.telemetry?.altitude || 0}
        heading={mergedDrone.telemetry?.heading || 0}
        speechBubbleVisible={mergedDrone.SpeechBubbleDroneIcone}
        color={mergedDrone.color}
        water={mergedDrone.water}
        telemetry={filteredTelemetry}
      />
    );

    const busyStyle = isBusy ? 'filter: drop-shadow(0 0 10px red);' : '';
    const hoverStyle = isHovered ? 'filter: drop-shadow(0 0 15px yellow); transform: scale(1.05);' : '';

    return L.divIcon({
      html: `<div style="position: relative; cursor: pointer;">
        <div style="${busyStyle} ${hoverStyle} transition: all 0.1s ease;">${iconHtml}</div>
        <div style="position: absolute; top: -20px; left: -20px; right: -20px; bottom: -20px; background: transparent; z-index: 10;"></div>
      </div>`,
      className: 'drone-marker',
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });
  }, [
    mergedDrone.name,
    mergedDrone.latitude,
    mergedDrone.longitude,
    mergedDrone.telemetry?.altitude_asl,
    mergedDrone.telemetry?.altitude,
    mergedDrone.telemetry?.heading,
    mergedDrone.color,
    mergedDrone.SpeechBubbleDroneIcone,
    mergedDrone.water,
    filteredTelemetry.flight_mode,  // ← solo el campo, no el objeto entero
    filteredTelemetry.armed, 
    isBusy,
    isHovered,
  ]);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setIcon(droneDivIcon);
    }
  }, [droneDivIcon]);

  const handleClick = useCallback((e) => {
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    if (e?.originalEvent) {
      e.originalEvent.stopPropagation();
      e.originalEvent.stopImmediatePropagation();
      e.originalEvent.preventDefault();
    }
    if (e) {
      L.DomEvent.stopPropagation(e);
      L.DomEvent.preventDefault(e);
    }
    clickTimeoutRef.current = setTimeout(() => {
      if (onDroneClick) onDroneClick(drone);
      if (onSelectDrone) onSelectDrone(drone);
    }, 50);
  }, [drone, onDroneClick, onSelectDrone]);

  const handleMouseOver = useCallback(() => {
    setIsHovered(true);
    if (markerRef.current) {
      markerRef.current.bringToFront();
      const element = markerRef.current.getElement();
      if (element) element.style.cursor = 'pointer';
    }
  }, []);

  const handleMouseOut = useCallback(() => setIsHovered(false), []);

  return (
    <Marker
      ref={markerRef}
      position={[positionRef.current.lat, positionRef.current.lng]}
      icon={droneDivIcon}
      zIndexOffset={isHovered ? 3000 : 1000}
      riseOnHover={true}
      riseOffset={500}
      interactive={true}
      bubblingMouseEvents={false}
      eventHandlers={{
        click: handleClick,
        mouseover: handleMouseOver,
        mouseout: handleMouseOut,
      }}
    />
  );
}

export default function SeeDronesMap({ drones, realTimeDrones, onSelectDrone, onDroneClick, busyDrones = {} }) {
  // Filtrar solo drones visibles y con coordenadas válidas
  const visibleDrones = useMemo(() => 
    drones.filter(d => d.show && d.latitude && d.longitude),
    [drones]
  );
  
  return (
    <>
      {visibleDrones.map((d) => (
        <DroneMarker
          key={`drone-${d.uid}`}
          drone={d}
          realTimeDrones={realTimeDrones}
          onSelectDrone={onSelectDrone}
          onDroneClick={onDroneClick}
          isBusy={!!busyDrones[d.uid]}
        />
      ))}
    </>
  );
}