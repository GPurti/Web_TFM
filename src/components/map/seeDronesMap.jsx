import { Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import ReactDOMServer from 'react-dom/server';
import DroneIcon from '../DroneManagement/droneIcon';
import { useMemo, useCallback, useRef, useEffect, useState } from 'react';

function DroneMarker({ drone, realTimeDrones, onSelectDrone, onDroneClick, isBusy }) {
  const markerRef = useRef(null);
  const map = useMap();
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

  const positionRef = useRef({ lat: drone.latitude, lng: drone.longitude });

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

  useEffect(() => {
  if (!markerRef.current) return;
    const element = markerRef.current.getElement();
    if (!element) return;

    // Actualitzar rotació del drone
    const orientationDiv = element.querySelector('.droneWithOrientation');
    if (orientationDiv) {
      const heading = filteredTelemetry?.heading || 0;
      orientationDiv.style.transform = `rotate(${heading}deg)`;
    }

    // Actualitzar bombolla de telemetria
    if (!drone.SpeechBubbleDroneIcone) return;
    const bubble = element.querySelector('.droneInfoTab');
    if (!bubble) return;

    const newHtml = ReactDOMServer.renderToString(
      <DroneIcon
        name={drone.name}
        latitude={rtData.lat ?? drone.latitude}
        longitude={rtData.lng ?? drone.longitude}
        altitude={filteredTelemetry?.altitude_asl || 0}
        heading={filteredTelemetry?.heading || 0}
        speechBubbleVisible={true}
        color={drone.color}
        water={drone.water}
        telemetry={filteredTelemetry}
      />
    );
    const temp = document.createElement('div');
    temp.innerHTML = newHtml;
    const newBubble = temp.querySelector('.droneInfoTab');
    if (newBubble) {
      bubble.innerHTML = newBubble.innerHTML;
    }
  }, [filteredTelemetry]);

  // ← icona base: només es recrea quan canvien propietats estructurals
  const droneDivIcon = useMemo(() => {
    const iconHtml = ReactDOMServer.renderToString(
      <DroneIcon
        name={drone.name}
        latitude={drone.latitude}
        longitude={drone.longitude}
        altitude={0}
        heading={0}
        speechBubbleVisible={drone.SpeechBubbleDroneIcone}
        color={drone.color}
        water={drone.water}
        telemetry={filteredTelemetry}
      />
    );

    const busyStyle = isBusy ? 'filter: drop-shadow(0 0 10px red);' : '';

    return L.divIcon({
      html: `<div style="position: relative; cursor: pointer;">
        <div style="${busyStyle} transition: all 0.1s ease;">${iconHtml}</div>
        <div style="position: absolute; top: -20px; left: -20px; right: -20px; bottom: -20px; background: transparent; z-index: 10;"></div>
      </div>`,
      className: 'drone-marker',
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });
  }, [
    drone.uid,
    drone.name,
    drone.color,
    drone.SpeechBubbleDroneIcone,
    drone.water,
    isBusy,
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
    if (markerRef.current) {
      const element = markerRef.current.getElement();
      if (element) {
        element.style.cursor = 'pointer';
        element.style.filter = 'drop-shadow(0 0 8px rgba(149, 246, 13, 0.8))';
        element.style.transition = 'filter 0.2s ease';
      }
    }
  }, []);

  const handleMouseOut = useCallback(() => {
    if (markerRef.current) {
      const element = markerRef.current.getElement();
      if (element) {
        element.style.filter = isBusy ? 'drop-shadow(0 0 10px red)' : '';
      }
    }
  }, [isBusy]);

  return (
    <Marker
      ref={markerRef}
      position={[positionRef.current.lat, positionRef.current.lng]}
      icon={droneDivIcon}
      zIndexOffset={1000}
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