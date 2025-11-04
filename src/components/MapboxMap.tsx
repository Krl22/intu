import React, { useCallback, useState } from "react";
import { Map, Marker } from "react-map-gl";
import type { MapMouseEvent } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface MapboxMapProps {
  onLocationSelect: (location: {
    lat: number;
    lng: number;
    address?: string;
  }) => void;
}

const MapboxMap: React.FC<MapboxMapProps> = ({ onLocationSelect }) => {
  const [viewState, setViewState] = useState({
    longitude: -74.006,
    latitude: 40.7128,
    zoom: 12,
  });

  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(
    null
  );

  const handleMapClick = useCallback(
    (event: MapMouseEvent) => {
      const { lng, lat } = event.lngLat;
      setMarker({ lat, lng });

      // Aquí podrías hacer reverse geocoding para obtener la dirección
      // Por ahora solo pasamos las coordenadas
      onLocationSelect({ lat, lng });
    },
    [onLocationSelect]
  );

  return (
    <div className="w-full h-full">
      <Map
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onClick={handleMapClick}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        mapboxAccessToken={import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}
        style={{ width: "100%", height: "100%" }}
      >
        {marker && (
          <Marker longitude={marker.lng} latitude={marker.lat} anchor="bottom">
            <div className="bg-red-500 w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
          </Marker>
        )}
      </Map>
    </div>
  );
};

export default MapboxMap;
