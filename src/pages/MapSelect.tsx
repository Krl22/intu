import React, { useCallback, useEffect, useState } from "react";
import { Map, Marker } from "react-map-gl";
import type { ViewState, ViewStateChangeEvent } from "react-map-gl";
import { Button } from "@/components/ui/button";
import { Crosshair, ArrowLeft, Check } from "lucide-react";
import Pin from "@/components/Pin";
import { useLocation, useNavigate } from "react-router-dom";
import "mapbox-gl/dist/mapbox-gl.css";

const MapSelect: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as {
    userLoc?: { lat: number; lng: number };
  } | null;

  const [viewState, setViewState] = useState<ViewState | null>(null);

  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Helper para crear ViewState completo
  const makeViewState = useCallback(
    (lat: number, lng: number, zoom = 15): ViewState => ({
      latitude: lat,
      longitude: lng,
      zoom,
      bearing: 0,
      pitch: 0,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    }),
    []
  );

  // Usar ubicación pasada desde Home inmediatamente (evita salto inicial)
  useEffect(() => {
    if (!viewState && navState?.userLoc) {
      setViewState(
        makeViewState(navState.userLoc.lat, navState.userLoc.lng, 15)
      );
      setUserLocation(navState.userLoc);
    }
  }, [navState, viewState, makeViewState]);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          setViewState((vs) =>
            makeViewState(latitude, longitude, vs?.zoom ?? 15)
          );
        },
        (err) => {
          console.warn("No se pudo obtener la geolocalización:", err);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    }
  }, [makeViewState]);

  const centerOnUser = useCallback(() => {
    if (userLocation) {
      setViewState((vs) =>
        vs
          ? { ...vs, latitude: userLocation.lat, longitude: userLocation.lng }
          : makeViewState(userLocation.lat, userLocation.lng, 15)
      );
    }
  }, [userLocation, makeViewState]);

  const confirmDestination = useCallback(() => {
    if (!viewState) return;
    const destination = { lat: viewState.latitude, lng: viewState.longitude };
    navigate("/route", { state: { destination } });
  }, [navigate, viewState]);

  return (
    <div className="fixed inset-0 z-50">
      {!viewState ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <div className="text-gray-600">Cargando mapa…</div>
        </div>
      ) : (
        <Map
          {...viewState}
          onMove={(evt: ViewStateChangeEvent) => setViewState(evt.viewState)}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          mapboxAccessToken={import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}
          style={{ width: "100%", height: "100%" }}
        >
          {userLocation && (
            <Marker
              longitude={userLocation.lng}
              latitude={userLocation.lat}
              anchor="bottom"
            >
              <div className="bg-sky-500 w-5 h-5 rounded-full border-2 border-white shadow-md" />
            </Marker>
          )}
        </Map>
      )}

      {/* Top Bar */}
      <div className="absolute top-4 left-4">
        <Button
          variant="outline"
          className="bg-white"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver
        </Button>
      </div>
      <div className="absolute top-4 right-4">
        <Button variant="secondary" className="bg-white" onClick={centerOnUser}>
          <Crosshair className="h-4 w-4 mr-2" /> Mi ubicación
        </Button>
      </div>

      {/* Center Pin */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full pointer-events-none">
        <Pin size={40} className="drop-shadow-lg" />
      </div>

      {/* Confirm Button */}
      <div className="absolute bottom-6 left-0 right-0 px-6">
        <Button
          className="w-full py-6 bg-blue-600 hover:bg-blue-700"
          onClick={confirmDestination}
        >
          <Check className="h-4 w-4 mr-2" /> Usar este destino
        </Button>
      </div>
    </div>
  );
};

export default MapSelect;
