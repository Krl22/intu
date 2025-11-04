import React, { useEffect, useRef, useState } from "react";
import { Map, Marker, Source, Layer } from "react-map-gl";
import type { MapRef, ViewState } from "react-map-gl";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Pin from "@/components/Pin";
import { db, firestore } from "@/lib/firebase";
import { ref, push, set, onValue, serverTimestamp, update } from "firebase/database";
import { doc as fsDoc, setDoc as fsSetDoc, serverTimestamp as fsServerTimestamp, getDoc } from "firebase/firestore";
import { useAuth } from "@/context/useAuth";
import { getDrivingRoute, lineBounds } from "@/lib/directions";
import "mapbox-gl/dist/mapbox-gl.css";

interface RouteState {
  destination: { lat: number; lng: number; address?: string };
}

const RoutePreview: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as RouteState | null;

  // Helper para construir un ViewState completo y tipado
  const makeViewState = (lat: number, lng: number, zoom = 13): ViewState => ({
    latitude: lat,
    longitude: lng,
    zoom,
    bearing: 0,
    pitch: 0,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [routeGeo, setRouteGeo] = useState<GeoJSON.LineString | null>(null);
  const [summary, setSummary] = useState<{
    distanceMeters: number;
    durationSeconds: number;
  } | null>(null);
  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [rideStatus, setRideStatus] = useState<"searching"|"accepted"|"in_progress"|"completed"|"cancelled"|null>(null);
  const [viewState, setViewState] = useState<ViewState | null>(
    state?.destination
      ? makeViewState(state.destination.lat, state.destination.lng, 13)
      : null
  );
  const mapRef = useRef<MapRef | null>(null);

  useEffect(() => {
    if (!state?.destination) return;
    // Get user location
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          setOrigin({ lat: 40.7128, lng: -74.006 }); // fallback
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } else {
      setOrigin({ lat: 40.7128, lng: -74.006 });
    }
  }, [state]);

  useEffect(() => {
    const run = async () => {
      if (!origin || !state?.destination) return;
      if (rideStatus === "in_progress" || rideStatus === "accepted") return; // en aceptado mostramos conductor→cliente
      try {
        const res = await getDrivingRoute(
          origin,
          state.destination,
          import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
        );
        setRouteGeo(res.geometry);
        setSummary(res.summary);
        const b = lineBounds(res.geometry);
        mapRef.current?.fitBounds(
          [
            [b.minLng, b.minLat],
            [b.maxLng, b.maxLat],
          ],
          { padding: 60, duration: 800 }
        );
      } catch (e) {
        console.error(e);
      }
    };
    run();
  }, [origin, state, rideStatus]);

  // Cuando el viaje fue aceptado, mostrar ruta conductor→cliente (origen)
  useEffect(() => {
    const run = async () => {
      if (rideStatus !== "accepted") return;
      if (!driverLoc || !origin) return;
      try {
        const res = await getDrivingRoute(
          driverLoc,
          origin,
          import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
        );
        setRouteGeo(res.geometry);
        setSummary(res.summary);
        const b = lineBounds(res.geometry);
        mapRef.current?.fitBounds(
          [
            [b.minLng, b.minLat],
            [b.maxLng, b.maxLat],
          ],
          { padding: 60, duration: 600 }
        );
      } catch (e) {
        console.error(e);
      }
    };
    run();
  }, [rideStatus, driverLoc, origin]);

  // Cuando el viaje está en progreso, mostrar ruta conductor→destino y actualizar con su ubicación
  useEffect(() => {
    const run = async () => {
      if (rideStatus !== "in_progress") return;
      if (!driverLoc || !state?.destination) return;
      try {
        const res = await getDrivingRoute(
          driverLoc,
          state.destination,
          import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
        );
        setRouteGeo(res.geometry);
        const b = lineBounds(res.geometry);
        mapRef.current?.fitBounds(
          [
            [b.minLng, b.minLat],
            [b.maxLng, b.maxLat],
          ],
          { padding: 60, duration: 600 }
        );
      } catch (e) {
        console.error(e);
      }
    };
    run();
  }, [rideStatus, driverLoc, state]);

  // Si se cancela, volver al estado inicial (Home). Completado se maneja con rating.
  useEffect(() => {
    if (rideStatus === "cancelled") {
      setDriverLoc(null);
      navigate("/", { replace: true });
    }
  }, [rideStatus, navigate]);

  if (!state?.destination) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-4 text-center">
          <p>No hay destino seleccionado.</p>
          <Button onClick={() => navigate("/")}>Volver</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50">
      {!viewState ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <div className="text-gray-600">Preparando ruta…</div>
        </div>
      ) : (
        <Map
          ref={mapRef}
          {...viewState}
          onMove={(evt) => setViewState(evt.viewState)}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          mapboxAccessToken={import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}
          style={{ width: "100%", height: "100%" }}
        >
          {origin && (
            <Marker
              longitude={origin.lng}
              latitude={origin.lat}
              anchor="bottom"
            >
              <div className="text-xl drop-shadow">👤</div>
            </Marker>
          )}
          <Marker
            longitude={state.destination.lng}
            latitude={state.destination.lat}
            anchor="bottom"
          >
            <Pin size={28} className="drop-shadow" />
          </Marker>

          {routeGeo && (
            <Source
              id="route"
              type="geojson"
              data={{ type: "Feature", geometry: routeGeo }}
            >
              <Layer
                id="route-line"
                type="line"
                paint={{
                  "line-color": "#16a34a",
                  "line-width": 4,
                  "line-opacity": 0.9,
                }}
              />
            </Source>
          )}

          {driverLoc && (
            <Marker longitude={driverLoc.lng} latitude={driverLoc.lat} anchor="center">
              <div className="text-xl drop-shadow">🚗</div>
            </Marker>
          )}
        </Map>
      )}

      {/* Top bar info */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
        <Button
          variant="outline"
          className="bg-white"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver
        </Button>
        {summary && (
          <div className="bg-white rounded-lg shadow px-3 py-2 text-sm text-gray-800">
            <span className="mr-3">
              Distancia: {(summary.distanceMeters / 1609.34).toFixed(1)} mi
            </span>
            <span>Tiempo: {Math.round(summary.durationSeconds / 60)} min</span>
          </div>
        )}
      </div>

      {/* Ride options panel */}
      {summary && origin && (
        <RideOptionsPanel
          distanceMeters={summary.distanceMeters}
          durationSeconds={summary.durationSeconds}
          origin={origin}
          destination={{ lat: state.destination.lat, lng: state.destination.lng, address: state.destination.address }}
          onDriverLocUpdate={setDriverLoc}
          onStatusUpdate={setRideStatus}
          onCompleted={(rid) => {
            setDriverLoc(null);
            navigate(`/rate/${rid}`);
          }}
        />
      )}
    </div>
  );
};

export default RoutePreview;

// Panel de opciones de taxi (moto taxi)
interface RideOptionsProps {
  distanceMeters: number;
  durationSeconds: number;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number; address?: string };
  onDriverLocUpdate?: (loc: { lat: number; lng: number } | null) => void;
  onStatusUpdate?: (status: "searching"|"accepted"|"in_progress"|"completed"|"cancelled") => void;
  onCompleted?: (id: string) => void;
}

const RideOptionsPanel: React.FC<RideOptionsProps> = ({ distanceMeters, durationSeconds, origin, destination, onDriverLocUpdate, onStatusUpdate, onCompleted }) => {
  const distanceKm = distanceMeters / 1000;
  const durationMin = durationSeconds / 60;
  const { user } = useAuth();

  const rides = [
    {
      id: 'intutaxi',
      label: 'IntuTaxi',
      desc: 'Moto taxi estándar',
      rates: { base: 3.0, perKm: 1.5, perMin: 0.2 },
    },
    {
      id: 'intupremium',
      label: 'IntuPremium',
      desc: 'Moto taxi premium',
      rates: { base: 5.0, perKm: 2.2, perMin: 0.3 },
    },
    {
      id: 'intueco',
      label: 'IntuEco',
      desc: 'Moto taxi económico',
      rates: { base: 2.5, perKm: 1.2, perMin: 0.18 },
    },
  ];

  const estimate = (base: number, perKm: number, perMin: number) => {
    const price = base + distanceKm * perKm + durationMin * perMin;
    return Math.max(price, base);
  };

  const [selected, setSelected] = React.useState<string>('intutaxi');
  const [requestId, setRequestId] = React.useState<string | null>(null);
  const [searching, setSearching] = React.useState<boolean>(false);
  const [driverInfo, setDriverInfo] = React.useState<{ name?: string; phone?: string } | null>(null);
  const [pickupCode, setPickupCode] = React.useState<string | null>(null);
  const subRef = React.useRef<(() => void) | null>(null);
  const selectedRide = rides.find((r) => r.id === selected)!;
  const selectedPrice = estimate(
    selectedRide.rates.base,
    selectedRide.rates.perKm,
    selectedRide.rates.perMin
  );

  const createRideRequest = async () => {
    if (!user) return;
    const reqRef = push(ref(db, 'rides/requests'));
    // RTDB no acepta valores undefined; asegurar null o omitir
    const payload = {
      riderId: user.uid,
      riderPhone: user.phoneNumber ?? null,
      origin: { lat: origin.lat, lng: origin.lng },
      destination: {
        lat: destination.lat,
        lng: destination.lng,
        address: destination.address ?? null,
      },
      service: selected,
      priceEstimate: Number(selectedPrice.toFixed(2)),
      status: 'searching',
      createdAt: serverTimestamp(),
      driver: null,
    };
    await set(reqRef, payload);
    setRequestId(reqRef.key);
    setSearching(true);
    const unsub = onValue(reqRef, async (snap) => {
      const val = snap.val();
      if (!val) return;
      if (val.status) {
        onStatusUpdate?.(val.status);
      }
      if (val.status === 'accepted' && val.driver) {
        setDriverInfo({ name: val.driver.name, phone: val.driver.phone });
        setSearching(false);
        if (val.pickupCode) setPickupCode(String(val.pickupCode));
      }
      if (val.driverLoc && typeof val.driverLoc.lat === 'number' && typeof val.driverLoc.lng === 'number') {
        onDriverLocUpdate?.({ lat: val.driverLoc.lat, lng: val.driverLoc.lng });
      }
      if (val.status === 'completed') {
        const rid = reqRef.key;
        if (rid) {
          // Fallback: asegurar documento en Firestore para Trips y Rating
          try {
            await fsSetDoc(
              fsDoc(firestore, 'rides', rid),
              {
                riderId: user?.uid ?? null,
                origin: val.origin ?? null,
                destination: val.destination ?? null,
                service: val.service ?? null,
                price: typeof val.priceEstimate === 'number' ? val.priceEstimate : null,
                driverId: val.driver?.id ?? null,
                driverName: val.driver?.name ?? null,
                driverPhone: val.driver?.phone ?? null,
                status: 'completed',
                completedAt: fsServerTimestamp(),
              },
              { merge: true }
            );
          } catch (err) {
            console.debug('No se pudo crear/actualizar ride en Firestore (cliente)', err);
          }
          onDriverLocUpdate?.(null);
          onCompleted?.(rid);
        }
        subRef.current?.();
        subRef.current = null;
      }
      if (val.status === 'cancelled') {
        onDriverLocUpdate?.(null);
        subRef.current?.();
        subRef.current = null;
      }
    });
    subRef.current = unsub;
  };

  const cancelRequest = async () => {
    if (!requestId) return;
    await update(ref(db, `rides/requests/${requestId}`), { status: 'cancelled' });
    setSearching(false);
    setRequestId(null);
    onDriverLocUpdate?.(null);
    subRef.current?.();
    subRef.current = null;
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 pb-6 bg-white border-t border-green-100 shadow-lg">
      {requestId === null && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-green-700">Opciones de moto taxi (Perú)</p>
            <p className="text-sm text-gray-600">ETA ~ {Math.max(1, Math.round(durationMin))} min</p>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {rides.map((ride) => {
              const price = estimate(ride.rates.base, ride.rates.perKm, ride.rates.perMin);
              const isActive = selected === ride.id;
              return (
                <button
                  key={ride.id}
                  type="button"
                  onClick={() => setSelected(ride.id)}
                  className={`rounded-lg border px-3 py-2 text-left ${isActive ? 'border-green-600 bg-amber-50' : 'border-green-100 bg-white'}`}
                >
                  <p className="font-semibold text-green-800 text-sm">{ride.label}</p>
                  <p className="text-xs text-green-700">{ride.desc}</p>
                  <p className="mt-1 font-medium text-green-800">S/ {price.toFixed(2)}</p>
                </button>
              );
            })}
          </div>
        </>
      )}

      {requestId === null ? (
        <button
          type="button"
          className="w-full py-3 rounded-lg bg-green-700 hover:bg-green-800 text-white font-semibold"
          onClick={async () => {
            if (!user) return;
            try {
              const snap = await getDoc(fsDoc(firestore, "users", user.uid));
              const data = (snap.data() || {}) as {
                firstName?: string;
                lastName?: string;
                birthdate?: string;
                profilePhotoUrl?: string;
              };
              const ok = !!(data.firstName && data.lastName && data.birthdate && data.profilePhotoUrl);
              if (!ok) {
                alert("Completa tu perfil en Cuenta antes de solicitar un taxi.");
                return;
              }
            } catch (err) {
              console.debug("No se pudo validar el perfil del usuario", err);
            }
            await createRideRequest();
          }}
          disabled={!user}
        >
          Confirmar {selectedRide.label} (S/ {selectedPrice.toFixed(2)})
        </button>
      ) : searching ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-green-600 animate-pulse" />
            <span className="text-green-800 font-medium">Buscando conductor…</span>
          </div>
          <button
            type="button"
            className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white"
            onClick={cancelRequest}
          >
            Cancelar
          </button>
        </div>
      ) : null}

      <p className="mt-2 text-[11px] text-gray-500">Tarifas estimadas. Pueden variar por tráfico, clima y demanda.</p>

      {driverInfo && (
        <div className="mt-3 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800">
          Conductor asignado: {driverInfo.name} ({driverInfo.phone})
        </div>
      )}

      {pickupCode && (
        <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
          Código de seguridad: <span className="font-mono text-lg">{pickupCode}</span>
        </div>
      )}
    </div>
  );
};