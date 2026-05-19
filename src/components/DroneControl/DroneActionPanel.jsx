// src/components/DroneControl/DroneActionPanel.jsx
import React, { useState, useRef, useEffect } from 'react';
import './DroneActionPanel.css';

export default function DroneActionPanel({ 
  drone, 
  onClose, 
  onEdit,
  onControlMode,
  onRead,        // ← nuevo
  onAuto,        // ← nuevo
  onPosHold, 
  onManual,
  onArm,
  onDisarm,
  onTakeoff,
  onLand,
  onRTL,
  onLoiter,
  onEmergencyStop,
  isConnected = true
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [loading, setLoading] = useState(null);
  const panelRef = useRef(null);

  // Función con confirmación para acciones peligrosas
  const handleActionWithConfirm = (action, callback, confirmMessage) => {
    if (window.confirm(confirmMessage)) {
      handleAction(action, callback);
    }
  };

  const handleAction = async (action, callback) => {
    setLoading(action);
    try {
      await callback();
    } catch (error) {
      console.error(`Error en ${action}:`, error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={`drone-action-panel ${isExpanded ? 'expanded' : 'collapsed'}`} ref={panelRef}>
      {/* Cabecera con flecha para expandir/colapsar */}
      <div className="panel-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="panel-title">
          <span className="drone-icon">🚁</span>
          <span className="drone-name">{drone?.name || drone?.uid}</span>
        </div>
        <div className="header-actions">
          <button className="expand-btn" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}>
            <span className="material-symbols-outlined">
              {isExpanded ? 'expand_more' : 'expand_less'}
            </span>
          </button>
          <button className="close-btn" onClick={(e) => { e.stopPropagation(); onClose(); }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>

      {/* Contenido expandible */}
      {isExpanded && (
        <div className="panel-content">
          {/* Información del drone */}
          <div className="drone-info">
            <div className="info-row">
              <span className="info-label">UID:</span>
              <span className="info-value">{drone?.uid}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Estado:</span>
              <span className={`status-badge ${isConnected ? 'connected' : 'disconnected'}`}>
                {isConnected ? 'Conectado' : 'Desconectado'}
              </span>
            </div>
          </div>

          <div className="actions-grid">
            <button className="action-btn edit" onClick={() => handleAction('edit', onEdit)} disabled={loading}>
              <span className="material-symbols-outlined">edit</span>
              <span>Edit</span>
            </button>

            {/* Read — lee plan y fences activos */}
            <button className="action-btn read" onClick={() => handleAction('read', onRead)} disabled={loading}>
              <span className="material-symbols-outlined">download</span>
              <span>{loading === 'read' ? '...' : 'Read'}</span>
            </button>

            <button className="action-btn control" onClick={() => handleAction('control', onControlMode)} disabled={loading}>
              <span className="material-symbols-outlined">upload</span>
              <span>{loading === 'control' ? '...' : 'Plan'}</span>
            </button>

            {/* AUTO */}
            <button className="action-btn auto" onClick={() => handleActionWithConfirm(
              'auto', onAuto, '⚠️ Start AUTO mission?'
            )} disabled={loading}>
              <span className="material-symbols-outlined">play_arrow</span>
              <span>{loading === 'auto' ? '...' : 'AUTO'}</span>
            </button>

            {/* PosHold */}
            {drone?.telemetry?.uav_type === 'fixed_wing' ? (
              <button className="action-btn poshold" onClick={() => handleActionWithConfirm('manual', onManual, '⚠️ Are you sure you want to set MANUAL mode?')} disabled={loading}>
                <span className="material-symbols-outlined">sports_score</span>
                <span>{loading === 'manual' ? '...' : 'Manual'}</span>
              </button>
            ) : (
              <button className="action-btn poshold" onClick={() => handleAction('poshold', onPosHold)} disabled={loading}>
                <span className="material-symbols-outlined">my_location</span>
                <span>{loading === 'poshold' ? '...' : 'PosHold'}</span>
              </button>
            )}

            {/* resto de botones igual */}
            <button className="action-btn arm" onClick={() => handleActionWithConfirm('arm', onArm, '⚠️ Are you sure you want to ARM the drone?')} disabled={loading}>
              <span className="material-symbols-outlined">power</span>
              <span>{loading === 'arm' ? '...' : 'Arm'}</span>
            </button>
            
            <button className="action-btn disarm" onClick={() => handleActionWithConfirm('disarm', onDisarm, '⚠️ Are you sure you want to DISARM the drone?')} disabled={loading}>
              <span className="material-symbols-outlined">power_off</span>
              <span>{loading === 'disarm' ? '...' : 'Disarm'}</span>
            </button>
            
            <button className="action-btn takeoff" onClick={() => handleActionWithConfirm('takeoff', onTakeoff, '⚠️ Are you sure you want to TAKEOFF? The drone will ascend to 20 meters.')} disabled={loading}>
              <span className="material-symbols-outlined">vertical_align_top</span>
              <span>{loading === 'takeoff' ? '...' : 'Takeoff'}</span>
            </button>
            
            <button className="action-btn land" onClick={() => handleAction('land', onLand)} disabled={loading}>
              <span className="material-symbols-outlined">vertical_align_bottom</span>
              <span>{loading === 'land' ? '...' : drone?.telemetry?.uav_type === 'fixed_wing' ? 'Cruise' : 'Land'}</span>
            </button>
            
            <button className="action-btn rtl" onClick={() => handleAction('rtl', onRTL)} disabled={loading}>
              <span className="material-symbols-outlined">home</span>
              <span>{loading === 'rtl' ? '...' : 'RTL'}</span>
            </button>
            
            <button className="action-btn loiter" onClick={() => handleAction('loiter', onLoiter)} disabled={loading}>
              <span className="material-symbols-outlined">pause_circle</span>
              <span>{loading === 'loiter' ? '...' : 'Loiter'}</span>
            </button>
            
            <button className="action-btn emergency" onClick={() => handleActionWithConfirm('emergency', onEmergencyStop, '🚨 EMERGENCY STOP! Are you sure?')} disabled={loading}>
              <span className="material-symbols-outlined">emergency</span>
              <span>{loading === 'emergency' ? '...' : 'Emergency'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}