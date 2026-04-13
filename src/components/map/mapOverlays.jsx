import { TileLayer, WMSTileLayer } from 'react-leaflet';

export default function MapOverlays({ showVolantOverlay, showFires }) {
  return (
    <>
      {showVolantOverlay && (
        <TileLayer
          url="https://tiles.via.volantautonomy.com/blue/bcndc/100/phantom/{z}/{x}/{y}.png"
          opacity={0.7}
          tileSize={256}
          zIndex={1000}
        />
      )}

      {showFires && (
        <WMSTileLayer
          url="https://firms.modaps.eosdis.nasa.gov/mapserver/wms/fires/96ec0f3bf592ea467613a8d674384235/fires_viirs_noaa20_7"
          layers="fires_viirs_noaa20_7"
          format="image/png"
          transparent={true}
          opacity={1}
          zIndex={1100}
        />
      )}
    </>
  );
}
