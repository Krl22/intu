import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Map, Marker, Source, Layer } from "react-map-gl";
import type { MapRef, ViewState } from "react-map-gl";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Pin from "@/components/Pin";
import { firestore } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, Timestamp } from "firebase/firestore";
import { getDrivingRoute, lineBounds } from "@/lib/directions";

type RideDoc = {
  destination?: { address?: string | null; lat: number; lng: number };
  origin?: { lat: number; lng: number };
  price?: number;
  driverName?: string | null;
  driverPhone?: string | null;
  service?: string | null;
  completedAt?: Timestamp | null;
  route?: {
    geometry?: GeoJSON.LineString;
    summary?: { distanceMeters: number; durationSeconds: number } | null;
    provider?: string | null;
  } | null;
};

interface RouteResult {
  geometry: GeoJSON.LineString;
  summary: { distanceMeters: number; durationSeconds: number };
}

async function getDrivingRouteOSRM(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }): Promise<RouteResult> {
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("OSRM request failed");
  const data = await res.json();
  const route = data.routes?.[0];
  if (!route || !route.geometry) throw new Error("No OSRM route found");
  return {
    geometry: route.geometry as GeoJSON.LineString,
    summary: { distanceMeters: route.distance, durationSeconds: route.duration },
  };
}

const TripDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const mapRef = React.useRef<MapRef | null>(null);
  const [ride, setRide] = React.useState<RideDoc | null>(null);
  const [routeGeo, setRouteGeo] = React.useState<GeoJSON.LineString | null>(null);
  const [summary, setSummary] = React.useState<{ distanceMeters: number; durationSeconds: number } | null>(null);
  const [viewState, setViewState] = React.useState<ViewState | null>(null);
  const [originLabel, setOriginLabel] = React.useState<string>("");
  const [destLabel, setDestLabel] = React.useState<string>("");

  React.useEffect(() => {
    if (!id) return;
    const d = doc(firestore, "rides", id);
    const unsub = onSnapshot(d, async (snap) => {
      const data = snap.data() as RideDoc | undefined;
      if (!data) return;
      setRide(data);
      const origin = data.origin;
      const dest = data.destination;
      if (!origin || !dest) return;

      // Inicializa el mapa centrado en destino
      if (!viewState) {
        setViewState({
          latitude: dest.lat,
          longitude: dest.lng,
          zoom: 13,
          bearing: 0,
          pitch: 0,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
        });
      }

      // Usa ruta cacheada si existe; si no, calcula y cachea
      if (data.route?.geometry) {
        setRouteGeo(data.route.geometry);
        if (data.route.summary) setSummary(data.route.summary);
        const b = lineBounds(data.route.geometry);
        mapRef.current?.fitBounds(
          [
            [b.minLng, b.minLat],
            [b.maxLng, b.maxLat],
          ],
          { padding: 60, duration: 600 }
        );
      } else {
        try {
          const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;
          const res = token
            ? await getDrivingRoute(origin, dest, token)
            : await getDrivingRouteOSRM(origin, dest);
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
          try {
            await updateDoc(d, {
              route: {
                geometry: res.geometry,
                summary: res.summary,
                provider: token ? "mapbox" : "osrm",
              },
            });
          } catch (err) {
            console.debug("No se pudo cachear ruta en Firestore (cliente)", err);
          }
        } catch (err) {
          console.debug("No se pudo calcular ruta del viaje (cliente)", err);
        }
      }
    });
    return () => unsub();
  }, [id, viewState]);

  const formatAddress = React.useCallback((addr?: string | null) => {
    if (!addr) return "(sin dirección)";
    const parts = addr.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 3) return `${parts[0]}, ${parts[1]}`;
    if (parts.length === 2) return `${parts[0]}, ${parts[1]}`;
    return parts[0] ?? addr;
  }, []);

  const reverseGeocode = React.useCallback(async (lat: number, lng: number): Promise<string | null> => {
    try {
      const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;
      if (token) {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&limit=1&types=address,place&language=es`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        const place = data.features?.[0]?.place_name as string | undefined;
        return place ? formatAddress(place) : null;
      } else {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14`;
        const res = await fetch(url, { headers: { "Accept": "application/json" } });
        if (!res.ok) return null;
        const data = await res.json();
        const name = (data.display_name as string | undefined) ?? null;
        return name ? formatAddress(name) : null;
      }
    } catch {
      return null;
    }
  }, [formatAddress]);

  React.useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!ride) return;
      // Origen
      if (typeof ride.origin?.lat === "number" && typeof ride.origin?.lng === "number") {
        const label = await reverseGeocode(ride.origin.lat, ride.origin.lng);
        if (mounted) setOriginLabel(label ?? `Lat ${ride.origin.lat.toFixed(4)}, Lng ${ride.origin.lng.toFixed(4)}`);
      } else {
        if (mounted) setOriginLabel("(sin datos)");
      }
      // Destino
      if (ride.destination?.address) {
        if (mounted) setDestLabel(formatAddress(ride.destination.address));
      } else if (typeof ride.destination?.lat === "number" && typeof ride.destination?.lng === "number") {
        const dlabel = await reverseGeocode(ride.destination.lat, ride.destination.lng);
        if (mounted) setDestLabel(dlabel ?? `Lat ${ride.destination.lat.toFixed(4)}, Lng ${ride.destination.lng.toFixed(4)}`);
      } else {
        if (mounted) setDestLabel("(sin datos)");
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [ride, reverseGeocode, formatAddress]);

  return (
    <div className="min-h-screen bg-amber-50">
      <div className="p-4 border-b border-amber-100 bg-amber-50 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-green-800">Detalle del viaje</h1>
        <Button variant="outline" className="bg-white" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver
        </Button>
      </div>

      <div className="relative">
        {!viewState ? (
          <div className="h-[60vh] flex items-center justify-center">Preparando mapa…</div>
        ) : (
          <Map
            ref={mapRef}
            {...viewState}
            onMove={(evt) => setViewState(evt.viewState)}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            mapboxAccessToken={import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}
            style={{ width: "100%", height: "60vh" }}
          >
            {ride?.origin && (
              <Marker longitude={ride.origin.lng} latitude={ride.origin.lat} anchor="bottom">
                <div className="text-xl drop-shadow">👤</div>
              </Marker>
            )}
            {ride?.destination && (
              <Marker longitude={ride.destination.lng} latitude={ride.destination.lat} anchor="bottom">
                <Pin size={28} className="drop-shadow" />
              </Marker>
            )}

            {routeGeo && (
              <Source id="route" type="geojson" data={{ type: "Feature", geometry: routeGeo }}>
                <Layer id="route-line" type="line" paint={{ "line-color": "#16a34a", "line-width": 4, "line-opacity": 0.9 }} />
              </Source>
            )}
          </Map>
        )}
      </div>

      <div className="p-4">
        {ride ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-white border border-green-100 p-4">
              <p className="text-sm text-green-700">Origen</p>
              <p className="text-green-800 font-medium">{originLabel}</p>
            </div>
            <div className="rounded-lg bg-white border border-green-100 p-4">
              <p className="text-sm text-green-700">Destino</p>
              <p className="text-green-800 font-medium">{destLabel}</p>
            </div>
            {summary && (
              <div className="rounded-lg bg-white border border-green-100 p-4">
                <p className="text-sm text-green-700">Resumen de ruta</p>
                <p className="text-green-800 font-medium">
                  {(summary.distanceMeters / 1000).toFixed(1)} km · {Math.round(summary.durationSeconds / 60)} min
                </p>
              </div>
            )}
            <div className="rounded-lg bg-white border border-green-100 p-4">
              <p className="text-sm text-green-700">Servicio y precio</p>
              <p className="text-green-800 font-medium">
                {ride.service ?? "(servicio)"} · S/ {(ride.price ?? 0).toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg bg-white border border-green-100 p-4">
              <p className="text-sm text-green-700">Conductor</p>
              <p className="text-green-800 font-medium">
                {ride.driverName ?? "(sin nombre)"}
                {ride.driverPhone ? ` · ${ride.driverPhone}` : ""}
              </p>
            </div>
            <div className="rounded-lg bg-white border border-green-100 p-4">
              <p className="text-sm text-green-700">Fecha</p>
              <p className="text-green-800 font-medium">
                {ride.completedAt ? ride.completedAt.toDate().toLocaleString() : "(sin fecha)"}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-green-700">Cargando viaje…</div>
        )}
      </div>
    </div>
  );
};

export default TripDetail;