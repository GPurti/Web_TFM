import { useState } from 'react';
import './MapStyleMenu.css';

export default function MapStyleMenu({
  mapInstance,
  mapRef,
  mapStyle,
  setMapStyle,
  showVolantOverlay,
  setShowVolantOverlay,
  showFires,
  toggleFires,
  showAero,
  setShowAero,
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  const handleMapStyleChange = (style) => {
    setMapStyle(style);
  };

  const goToUserLocation = () => {
    if (!mapInstance) return;

    mapInstance.locate({ setView: true, maxZoom: 16 });

    mapInstance.once('locationfound', (e) => {
      mapInstance.setView(e.latlng, 16);
    });

    mapInstance.once('locationerror', (err) => {
      console.error('No se pudo obtener la ubicación:', err.message);
      alert('No se pudo obtener tu ubicación');
    });
  };
  
  return (
    <div className="mapStyleMenu" onClick={(e) => e.stopPropagation()}>
      <div className="lateralButtons">
        <button
          className="menuToggle"
          onClick={goToUserLocation}
          title="Ir a mi ubicación"
        >
          <span className="material-symbols-outlined">my_location</span>
        </button>

        <button
          className="menuToggle"
          onClick={() => setIsOpen(!isOpen)}
          title="Abrir menú de estilos"
        >
          <span className="material-symbols-outlined">map</span>
        </button>
      </div>

      {isOpen && (
        <div className="menuDropdown">
          <div className="menuSection">
            <div className="sectionTitle">Map Styles</div>
            <button
              className={`menuItem ${mapStyle === 'standard' ? 'selected' : ''}`}
              onClick={() => handleMapStyleChange('standard')}
            >
              Standard
              {mapStyle === 'standard' && <span className="check">✔</span>}
            </button>
            <button
              className={`menuItem ${mapStyle === 'topographic' ? 'selected' : ''}`}
              onClick={() => handleMapStyleChange('topographic')}
            >
              Topographic
              {mapStyle === 'topographic' && <span className="check">✔</span>}
            </button>
            <button
              className={`menuItem ${mapStyle === 'satellite' ? 'selected' : ''}`}
              onClick={() => handleMapStyleChange('satellite')}
            >
              Satellite
              {mapStyle === 'satellite' && <span className="check">✔</span>}
            </button>
          </div>

          <hr />

          <div className="menuSection">
            <div className="sectionTitle">Filters</div>
            <button
              className={`menuItem ${showVolantOverlay ? 'selected' : ''}`}
              onClick={() => setShowVolantOverlay(!showVolantOverlay)}
            >
              Volant
              {showVolantOverlay && <span className="check">✔</span>}
            </button>
            <button
              className={`menuItem ${showFires ? 'selected' : ''}`}
              onClick={toggleFires}
            >
              Fires
              {showFires && <span className="check">✔</span>}
            </button>
            <button
              className={`menuItem ${showAero ? 'selected' : ''}`}
              onClick={() => setShowAero(!showAero)}
            >
              Aero
              {showAero && <span className="check">✔</span>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
