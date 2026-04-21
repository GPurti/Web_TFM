import React, { useRef } from 'react';
import './droneIcon.css';
import DroneSvg from '../../assets/iconeDrone.svg?react';

const droneValuesMap = {
  gps_timestamp: "GPS Timestamp",
  voltage_battery: "Battery Voltage",
  system_time: "System Time",
  latitude: "Latitude",
  longitude: "Longitude",
  altitude_ahl: "Altitude AHL",
  altitude_agl: "Altitude AGL",
  altitude_asl: "Altitude AMSL",
  airSpeed: "Air Speed",
  groundSpeed: "Ground Speed",
  heading: "Heading",
  pitch: "Pitch",
  roll: "Roll",
  yaw: "Yaw",
  flight_mode: "Mode",
  armed: "Status",
};

export default function DroneIcon({
  name,
  latitude,
  longitude,
  altitude,
  heading,
  speechBubbleVisible,
  color,
  water,
  telemetry = {}
}) {
  const activeTelemetry = Object.entries(telemetry || {})
    .filter(([key]) => droneValuesMap[key])
    .map(([key, value]) => ({
      label: droneValuesMap[key],
      key,
      value
    }));

  const lastModeRef = useRef(null);
  const lastArmedRef = useRef(null);

  // Guardar último modo válido (ignorar STABILIZE)
  const currentMode = telemetry?.flight_mode;
  const currentArmed = telemetry?.armed;

  if (currentMode && currentMode !== 'STABILIZE') {
    lastModeRef.current = currentMode;
    lastArmedRef.current = currentArmed;
  }

  const displayMode = lastModeRef.current;
  const displayArmed = lastArmedRef.current;

  return (
    <div className="droneIcon">
      {speechBubbleVisible && (
        <div className="droneInfoTab">
          <table border="0">
            <tbody>
              <tr>
                <td className="labelCell">Name:</td>
                <td className="cellTruncate" title={String(name)}>{name}</td>
              </tr>

              {activeTelemetry.map((item, index) => (
                <tr key={index}>
                  <td className="labelCell">{item.label}:</td>
                  <td className="cellTruncate" title={String(item.value ?? '—')}>
                    {item.key === 'armed' ? (
                      <span style={{ fontWeight: 'bold', color: displayArmed ? '#ff4444' : '#44aa44' }}>
                        {displayArmed === true ? 'ARMED' : displayArmed === false ? 'DISARMED' : '—'}
                      </span>
                    ) : item.key === 'flight_mode' ? (
                      <span style={{ fontWeight: 'bold' }}>
                        {displayMode != null ? String(displayMode).toUpperCase() : '—'}
                      </span>
                    ) : item.value != null ? (
                      ['altitude_ahl', 'altitude_agl', 'altitude_asl'].includes(item.key)
                        ? `${item.value} m`
                        : item.value
                    ) : '—'}
                  </td>
                </tr>
              ))}

              {!telemetry.latitude && latitude !== undefined && (
                <tr>
                  <td className="labelCell">Latitude:</td>
                  <td className="cellTruncate" title={String(latitude)}>{latitude}</td>
                </tr>
              )}
              {!telemetry.longitude && longitude !== undefined && (
                <tr>
                  <td className="labelCell">Longitude:</td>
                  <td className="cellTruncate" title={String(longitude)}>{longitude}</td>
                </tr>
              )}
              {!telemetry.altitude_ahl && altitude !== undefined && (
                <tr>
                  <td className="labelCell">Alt:</td>
                  <td className="cellTruncate" title={`${altitude} m`}>{altitude} m</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="droneWithOrientation" style={{ transform: `rotate(${heading ?? 0}deg)` }}>
        <div className="orientationLine" />
        <div className="droneBody">
          <DroneSvg className="droneSvg" style={{ color }}/>
        </div>
      </div>

      {water === false && (
        <span
          className="material-symbols-outlined waterIcon"
          title="Water status: false"
        >
          invert_colors_off
        </span>
      )}

      {water === true && (
        <span
          className="material-symbols-outlined waterIcon"
          title="Water status: true"
          style={{ color: '#0677ce' }}
        >
          invert_colors
        </span>
      )}
    </div>
  );
}
