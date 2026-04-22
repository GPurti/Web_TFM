// src/components/DroneControl/DroneControlPanel.jsx
import React, { useState } from 'react';
import './DroneControlPanel.css';

export default function DroneControlPanel({ 
  drone, 
  onExitControl, 
  onSendRoute,
  onSendFence,
  onSendExclusionFence,
  onClearAllFences,
  onPreviewRoute,
  onIncludeReturnChange,
  waypoints = [],
  onClearWaypoints,
  homeLocation = null
}) {
  const [isSending, setIsSending] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [includeReturn, setIncludeReturn] = useState(true);
  const [missionType, setMissionType] = useState('mission'); // 'mission' o 'fence'
  
  const [editableWaypoints, setEditableWaypoints] = useState(() => 
    waypoints.map((wp, index) => ({
      ...wp,
      alt: wp.alt || 40,
      order: index + 1
    }))
  );

  React.useEffect(() => {
    setEditableWaypoints(prev => {
      const newWaypoints = waypoints.map((wp, index) => {
        const existing = prev.find(p => p.id === wp.id);
        return {
          ...wp,
          alt: existing?.alt || wp.alt || 40,
          order: index + 1
        };
      });
      return newWaypoints;
    });
  }, [waypoints]);

  const updateWaypointAltitude = (id, newAlt) => {
    const altValue = parseFloat(newAlt);
    if (isNaN(altValue)) return;
    
    setEditableWaypoints(prev =>
      prev.map(wp =>
        wp.id === id ? { ...wp, alt: Math.min(Math.max(altValue, 10), 500) } : wp
      )
    );
  };

  const getFullRoute = () => {
    const waypointsToSend = editableWaypoints.map(wp => ({
      lat: wp.lat,
      lng: wp.lng,
      alt: wp.alt
    }));
    
    if (!includeReturn || !homeLocation || waypointsToSend.length === 0) {
      return waypointsToSend;
    }
    return [...waypointsToSend, { ...homeLocation, alt: 40, isReturn: true }];
  };

  const handleSend = async () => {
    if (missionType === 'fence') {
      if (editableWaypoints.length < 3) {
        alert('Para un FENCE necesitas al menos 3 puntos');
        return;
      }
      
      const vertices = editableWaypoints.map(wp => ({
        lat: wp.lat,
        lng: wp.lng
      }));
      
      setIsSending(true);
      try {
        await onSendFence(vertices);
        alert(`Fence enviado con ${vertices.length} vértices`);
        setIsPreviewing(false);
      } catch (error) {
        console.error('Error enviando fence:', error);
        alert('Error sending fence');
      } finally {
        setIsSending(false);
      }
      return;
    }
    if (missionType === 'exclusion') {
      if (editableWaypoints.length < 3) {
        alert('Necesitas al menos 3 puntos para una zona de exclusión');
        return;
      }
      const vertices = editableWaypoints.map(wp => ({ lat: wp.lat, lng: wp.lng }));
      setIsSending(true);
      try {
        await onSendExclusionFence([vertices]); // array de zonas
        alert(`Zona de exclusión enviada con ${vertices.length} vértices`);
        setIsPreviewing(false);
      } catch (error) {
        alert('Error enviando zona de exclusión');
      } finally {
        setIsSending(false);
      }
      return;
    }

    // Modo MISSION
    const fullRoute = getFullRoute();
    if (fullRoute.length === 0) {
      alert('No hay waypoints para enviar');
      return;
    }

    setIsSending(true);
    try {
      await onSendRoute(fullRoute);
      alert(`Ruta enviada con ${fullRoute.length} waypoints`);
      setIsPreviewing(false);
    } catch (error) {
      console.error('Error enviando ruta:', error);
      alert('Error sending route');
    } finally {
      setIsSending(false);
    }
  };

  const handlePreview = () => {
    if (missionType === 'fence') {
      if (editableWaypoints.length < 3) {
        alert('Necesitas al menos 3 puntos');
        return;
      }
      setIsPreviewing(!isPreviewing);
      if (onPreviewRoute) {
        onPreviewRoute(!isPreviewing, editableWaypoints, 'fence');
      }
      return;
    }

    if (missionType === 'exclusion') {
      if (editableWaypoints.length < 3) {
        alert('Necesitas al menos 3 puntos');
        return;
      }
      setIsPreviewing(!isPreviewing);
      if (onPreviewRoute) {
        onPreviewRoute(!isPreviewing, editableWaypoints, 'exclusion');
      }
      return;
    }
        
    const fullRoute = getFullRoute();
    if (fullRoute.length === 0) {
      alert('No waypoints to preview');
      return;
    }
    setIsPreviewing(!isPreviewing);
    if (onPreviewRoute) {
      onPreviewRoute(!isPreviewing, fullRoute, 'mission');
    }
  };

  const handleClear = () => {
    setEditableWaypoints([]);
    onClearWaypoints();
    if (isPreviewing) {
      setIsPreviewing(false);
      onPreviewRoute(false, []);
    }
  };

  const handleIncludeReturnChange = (checked) => {
    setIncludeReturn(checked);
    if (onIncludeReturnChange) {
      onIncludeReturnChange(checked);
    }
    if (isPreviewing && missionType === 'mission') {
      const fullRoute = getFullRoute();
      onPreviewRoute(true, fullRoute, 'mission');
    }
  };

  const showPreviewButton = editableWaypoints.length > (missionType === 'fence' || missionType === 'exclusion' ? 2 : 0);  const isPreviewActive = isPreviewing && showPreviewButton;
  const canSend = missionType === 'fence' || missionType === 'exclusion' ? editableWaypoints.length >= 3 : editableWaypoints.length > 0;

  return (
    <div className="drone-control-panel">
      <div className="control-header">
        <h3>🎮 Control Mode: {drone?.name || drone?.uid}</h3>
        <button className="exit-button" onClick={onExitControl}>✖</button>
      </div>

      {/* Selector Mission / Fence */}
      <div className="mission-type-selector">
        <label className="type-label">
          <span>📋 Mission Type:</span>
          <select 
            value={missionType} 
            onChange={(e) => setMissionType(e.target.value)}
            className="type-select"
          >
            <option value="mission">✈️ Mission (Waypoints)</option>
            <option value="fence">🚧 Fence (Geo-fence Zone)</option>
            <option value="exclusion">🚫 Exclusion Zone</option>
          </select>
        </label>
        <div className="type-info">
          {missionType === 'mission' ? (
            <span>📍 Click on map to add waypoints</span>
          ) : (
            <span>🟦 Click on map to add fence vertices (min 3)</span>
          )}
        </div>
      </div>

      <div className="control-stats">
        <p>{missionType === 'fence' ? 'Vertices:' : 'Waypoints:'} {editableWaypoints.length}</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          {showPreviewButton && (
            <button className={`preview-button ${isPreviewActive ? 'active' : ''}`} onClick={handlePreview}>
              {isPreviewActive ? '👁️ Hide' : '👁️ Preview'}
            </button>
          )}
          {editableWaypoints.length > 0 && (
            <button className="clear-button" onClick={handleClear}>Clear All</button>
          )}
        </div>
      </div>

      {/* Tabla para MISSION */}
      {missionType === 'mission' && editableWaypoints.length > 0 && (
        <div className="waypoints-table-container">
          <h4>Waypoints (click altitude to edit):</h4>
          <table className="waypoints-table">
            <thead>
              <tr><th>#</th><th>Latitude</th><th>Longitude</th><th>Altitude (m)</th></tr>
            </thead>
            <tbody>
              {editableWaypoints.map((wp) => (
                <tr key={wp.id}>
                  <td>{wp.order}</td>
                  <td className="coord-cell">{wp.lat.toFixed(6)}</td>
                  <td className="coord-cell">{wp.lng.toFixed(6)}</td>
                  <td className="alt-cell">
                    <input type="number" className="alt-input" value={wp.alt} onChange={(e) => updateWaypointAltitude(wp.id, e.target.value)} min="10" max="500" step="5"/>
                    <span className="alt-unit">m</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {missionType === 'fence' && editableWaypoints.length > 0 && (
        <div className="waypoints-table-container">
          <h4>Fence Vertices (min 3):</h4>
          <table className="waypoints-table">
            <thead><tr><th>#</th><th>Latitude</th><th>Longitude</th></tr></thead>
            <tbody>
              {editableWaypoints.map((wp, idx) => (
                <tr key={wp.id}><td>{idx + 1}</td><td className="coord-cell">{wp.lat.toFixed(6)}</td><td className="coord-cell">{wp.lng.toFixed(6)}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="altitude-info">
            🚧 El drone se mantendrá dentro de esta zona. Si intenta salir, hará RTL.
          </div>
          {editableWaypoints.length > 12 && (
            <div style={{ color: '#ff4444', fontSize: '12px', marginTop: '4px' }}>
              ⚠️ ArduCopter limit: max 16 total vertices across all fences
            </div>
          )}
        </div>
      )}

      {missionType === 'exclusion' && editableWaypoints.length > 0 && (
        <div className="waypoints-table-container">
          <h4>Exclusion Zone Vertices (min 3):</h4>
          <table className="waypoints-table">
            <thead><tr><th>#</th><th>Latitude</th><th>Longitude</th></tr></thead>
            <tbody>
              {editableWaypoints.map((wp, idx) => (
                <tr key={wp.id}>
                  <td>{idx + 1}</td>
                  <td className="coord-cell">{wp.lat.toFixed(6)}</td>
                  <td className="coord-cell">{wp.lng.toFixed(6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="altitude-info">
            🚫 El drone no podrá entrar en esta zona. Si intenta hacerlo, hará RTL.
          </div>
          {editableWaypoints.length > 12 && (
            <div style={{ color: '#ff4444', fontSize: '12px', marginTop: '4px' }}>
              ⚠️ ArduCopter limit: max 16 total vertices across all fences
            </div>
          )}
        </div>
      )}

      {/* Return option - solo MISSION */}
      {missionType === 'mission' && (
        <div className="return-option">
          <label className="return-label">
            <input type="checkbox" checked={includeReturn} onChange={(e) => handleIncludeReturnChange(e.target.checked)}/>
            <span>🏠 Return to home</span>
          </label>
        </div>
      )}

      <div className="control-actions">
        {missionType === 'exclusion' && (
          <button 
            className="clear-fences-button" 
            onClick={onClearAllFences}
            style={{ backgroundColor: '#cc0000', color: 'white' }}
          >
            🗑️ Clear All Fences
          </button>
        )}
        <button className="send-button" onClick={handleSend} disabled={!canSend || isSending}>
          {isSending ? 'Sending...' : `📡 Send ${missionType === 'fence' ? 'Fence' : 'Mission'}`}
        </button>
        <button className="stop-button" onClick={onExitControl}>🛑 Stop</button>
      </div>

      <div className="control-instructions">
        {missionType === 'mission' ? (
          <p>🖱️ Click map → add waypoint | ✏️ Edit altitude | ❌ Click marker to delete</p>
        ) : (
          <p>🖱️ Click map → add vertex (min 3) | ❌ Click marker to delete | 🔴 Red polygon = fence zone</p>
        )}
      </div>
    </div>
  );
}