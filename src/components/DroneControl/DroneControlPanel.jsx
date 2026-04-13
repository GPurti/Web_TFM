import React, { useState } from 'react';
import './DroneControlPanel.css';

export default function DroneControlPanel({ 
  drone, 
  onExitControl, 
  onSendRoute,
  onPreviewRoute,
  onIncludeReturnChange, // 👈 NUEVO: callback cuando cambia el toggle
  waypoints = [],
  onClearWaypoints,
  homeLocation = null
}) {
  const [isSending, setIsSending] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [includeReturn, setIncludeReturn] = useState(true);

  // 👇 Cuando cambia el toggle, notificar al padre
  const handleIncludeReturnChange = (checked) => {
    setIncludeReturn(checked);
    if (onIncludeReturnChange) {
      onIncludeReturnChange(checked);
    }
    // Si hay vista previa activa, actualizarla
    if (isPreviewing) {
      const fullRoute = getFullRouteWithReturn(checked);
      onPreviewRoute(true, fullRoute);
    }
  };

  const getFullRouteWithReturn = (withReturn) => {
    if (!withReturn || !homeLocation || waypoints.length === 0) {
      return waypoints;
    }
    return [...waypoints, { ...homeLocation, id: 'home', isReturn: true }];
  };

  const getFullRoute = () => {
    return getFullRouteWithReturn(includeReturn);
  };

  const handleSendRoute = async () => {
    const fullRoute = getFullRoute();
    if (fullRoute.length === 0) {
      alert('No hay waypoints para enviar');
      return;
    }

    setIsSending(true);
    try {
      await onSendRoute(fullRoute);
      alert(`Ruta enviada al drone con ${fullRoute.length} puntos`);
      setIsPreviewing(false);
    } catch (error) {
      console.error('Error enviando ruta:', error);
      alert('Error al enviar la ruta');
    } finally {
      setIsSending(false);
    }
  };

  const handlePreviewRoute = () => {
    const fullRoute = getFullRoute();
    if (fullRoute.length === 0) {
      alert('No hay waypoints para previsualizar');
      return;
    }
    setIsPreviewing(!isPreviewing);
    if (onPreviewRoute) {
      onPreviewRoute(!isPreviewing, fullRoute);
    }
  };

  const handleClear = () => {
    onClearWaypoints();
    if (isPreviewing) {
      setIsPreviewing(false);
      onPreviewRoute(false, []);
    }
  };

  const showPreviewButton = waypoints.length > 0;
  const isPreviewActive = isPreviewing && showPreviewButton;

  return (
    <div className="drone-control-panel">
      <div className="control-header">
        <h3>🎮 Modo Control: {drone?.name || drone?.uid}</h3>
        <button className="exit-button" onClick={onExitControl}>✖</button>
      </div>

      <div className="control-stats">
        <p>Waypoints: {waypoints.length}</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          {showPreviewButton && (
            <button 
              className={`preview-button ${isPreviewActive ? 'active' : ''}`} 
              onClick={handlePreviewRoute}
              title={isPreviewActive ? 'Ocultar vista previa' : 'Mostrar vista previa de la ruta'}
            >
              {isPreviewActive ? '👁️ Ocultar' : '👁️ Vista Previa'}
            </button>
          )}
          {waypoints.length > 0 && (
            <button className="clear-button" onClick={handleClear}>
              Limpiar
            </button>
          )}
        </div>
      </div>

      <div className="return-option">
        <label className="return-label">
          <input
            type="checkbox"
            checked={includeReturn}
            onChange={(e) => handleIncludeReturnChange(e.target.checked)}
          />
          <span>🏠 Regresar a punto de inicio después de los waypoints</span>
        </label>
      </div>

      <div className="control-actions">
        <button 
          className="send-button" 
          onClick={handleSendRoute}
          disabled={waypoints.length === 0 || isSending}
        >
          {isSending ? 'Enviando...' : '📡 Enviar al dron'}
        </button>

        <button className="stop-button" onClick={onExitControl}>
          🛑 Detener control
        </button>
      </div>

      {waypoints.length > 0 && (
        <div className="waypoints-list">
          <h4>Lista de waypoints:</h4>
          <ul>
            {waypoints.map((wp, index) => (
              <li key={wp.id || index}>
                {index + 1}. ({wp.lat.toFixed(6)}, {wp.lng.toFixed(6)})
              </li>
            ))}
            {includeReturn && waypoints.length > 0 && homeLocation && (
              <li className="return-waypoint">
                {waypoints.length + 1}. Regreso a casa ({homeLocation.lat.toFixed(6)}, {homeLocation.lng.toFixed(6)})
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="control-instructions">
        <p>🖱️ Haz clic en el mapa para añadir waypoints</p>
        <p>➡️ El drone seguirá el orden establecido</p>
        <p>🏠 Al finalizar, regresará automáticamente al punto de inicio</p>
        <p>❌ Haz clic en un waypoint para eliminarlo</p>
        <p>👁️ Usa "Vista Previa" para ver la ruta completa</p>
      </div>
    </div>
  );
}