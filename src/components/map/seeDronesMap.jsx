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
  
  // Usar ref para almacenar la posición actual sin causar re-render
  const positionRef = useRef({
    lat: drone.latitude,
    lng: drone.longitude
  });

  // Actualizar posición del marcador cuando llega telemetría SIN re-crear el marcador
  useEffect(() => {
    const rtData = realTimeDrones?.[drone.uid];
    if (rtData && rtData.lat && rtData.lng) {
      const newLat = rtData.lat;
      const newLng = rtData.lng;
      
      if (positionRef.current.lat !== newLat || positionRef.current.lng !== newLng) {
        positionRef.current = { lat: newLat, lng: newLng };
        
        // Actualizar posición del marcador existente sin recrearlo
        if (markerRef.current) {
          markerRef.current.setLatLng([newLat, newLng]);
        }
      }
    }
  }, [realTimeDrones, drone.uid]);

  // Datos combinados para el icono
  const rtData = realTimeDrones?.[drone.uid] || {};
  const mergedDrone = useMemo(() => ({
    ...drone,
    latitude: rtData.lat ?? drone.latitude,
    longitude: rtData.lng ?? drone.longitude,
    telemetry: rtData.telemetry ?? drone.telemetry,
  }), [drone, rtData.lat, rtData.lng, rtData.telemetry]);

  // Icono con área de clic agrandada
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
        telemetry={mergedDrone.telemetry}
      />
    );

    const busyStyle = isBusy ? 'filter: drop-shadow(0 0 10px red);' : '';
    const hoverStyle = isHovered ? 'filter: drop-shadow(0 0 15px yellow); transform: scale(1.05);' : '';

    // 👇 IMPORTANTE: Agrandar el área de clic con un div transparente más grande
    return L.divIcon({
      html: `<div style="position: relative; cursor: pointer;">
        <div style="${busyStyle} ${hoverStyle} transition: all 0.1s ease;">${iconHtml}</div>
        <div style="position: absolute; top: -20px; left: -20px; right: -20px; bottom: -20px; background: transparent; z-index: 10;"></div>
      </div>`,
      className: 'drone-marker',
      iconSize: [48, 48],      // Tamaño total del icono
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
    isBusy,
    isHovered,
  ]);

  // Actualizar el icono cuando cambie el estado de hover
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setIcon(droneDivIcon);
    }
  }, [droneDivIcon]);

  const handleClick = useCallback((e) => {
    // Limpiar timeout anterior si existe
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    
    // Detener propagación de forma más agresiva
    if (e && e.originalEvent) {
      e.originalEvent.stopPropagation();
      e.originalEvent.stopImmediatePropagation();
      e.originalEvent.preventDefault();
    }
    if (e) {
      L.DomEvent.stopPropagation(e);
      L.DomEvent.preventDefault(e);
    }
    
    console.log('🖱️ DroneMarker CLICK - drone:', drone.uid, drone.name);
    
    // Usar timeout para evitar dobles clics
    clickTimeoutRef.current = setTimeout(() => {
      if (onDroneClick) {
        onDroneClick(drone);
      }
      if (onSelectDrone) {
        onSelectDrone(drone);
      }
    }, 50);
  }, [drone, onDroneClick, onSelectDrone]);

  const handleMouseOver = useCallback(() => {
    setIsHovered(true);
    // Aumentar zIndex temporalmente
    if (markerRef.current) {
      markerRef.current.bringToFront();
      // Cambiar el cursor a pointer más explícitamente
      const element = markerRef.current.getElement();
      if (element) {
        element.style.cursor = 'pointer';
      }
    }
  }, []);

  const handleMouseOut = useCallback(() => {
    setIsHovered(false);
  }, []);

  // Posición inicial del marcador
  const initialPosition = [positionRef.current.lat, positionRef.current.lng];

  return (
    <Marker
      ref={markerRef}
      key={`drone-${drone.uid}`}
      position={initialPosition}
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