import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import logo from "@/assets/logo.png";
import { firestore } from "@/lib/firebase";
import { useAuth } from "@/context/useAuth";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  Timestamp,
  getDocs,
} from "firebase/firestore";

type RideDoc = {
  destination?: { address?: string | null; lat: number; lng: number };
  origin?: { lat: number; lng: number };
  price?: number;
  driverName?: string | null;
  completedAt?: Timestamp | null;
};

const Trips: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rides, setRides] = React.useState<
    Array<{ id: string; data: RideDoc }>
  >([]);
  const [labels, setLabels] = React.useState<Record<string, string>>({});
  const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as
    | string
    | undefined;

  React.useEffect(() => {
    if (!user) return;
    const q = query(
      collection(firestore, "rides"),
      where("riderId", "==", user.uid),
      orderBy("completedAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Array<{ id: string; data: RideDoc }> = snap.docs.map(
          (d) => ({ id: d.id, data: d.data() as RideDoc })
        );
        setRides(list);
      },
      async (err) => {
        // Si falta el índice compuesto, usar fallback sin orderBy y ordenar en cliente
        try {
          console.debug(
            "Fallo consulta con índice en Trips; usando fallback",
            err
          );
          const q2 = query(
            collection(firestore, "rides"),
            where("riderId", "==", user.uid)
          );
          const snap2 = await getDocs(q2);
          const list2: Array<{ id: string; data: RideDoc }> = snap2.docs.map(
            (d) => ({ id: d.id, data: d.data() as RideDoc })
          );
          list2.sort((a, b) => {
            const ta = a.data.completedAt ? a.data.completedAt.toMillis() : 0;
            const tb = b.data.completedAt ? b.data.completedAt.toMillis() : 0;
            return tb - ta;
          });
          setRides(list2);
        } catch (err2) {
          console.debug(
            "No se pudo cargar historial desde Firestore (fallback)",
            err2
          );
          setRides([]);
        }
      }
    );
    return () => unsub();
  }, [user]);

  // Utilidad para recortar dirección en formato corto
  const formatAddress = React.useCallback((addr: string): string => {
    const parts = addr
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 3) return `${parts[0]}, ${parts[1]}`; // vía y distrito/ciudad
    if (parts.length === 2) return `${parts[0]}, ${parts[1]}`;
    return parts[0] ?? addr;
  }, []);

  // Geocodificación inversa para obtener ciudad/dirección si falta
  const reverseGeocode = React.useCallback(
    async (lat: number, lng: number): Promise<string | null> => {
      if (!mapboxToken) return null;
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}&language=es&limit=1&types=place,locality,address`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = (await res.json()) as {
          features?: Array<{ place_name?: string }>;
        };
        const place = data?.features?.[0]?.place_name;
        if (typeof place === "string") return formatAddress(place);
        return null;
      } catch {
        return null;
      }
    },
    [mapboxToken, formatAddress]
  );

  // Resolver etiquetas amigables para cada ride
  React.useEffect(() => {
    let mounted = true;
    const run = async () => {
      const next: Record<string, string> = { ...labels };
      const tasks: Promise<void>[] = [];
      for (const r of rides) {
        const id = r.id;
        const dest = r.data.destination;
        if (dest?.address) {
          next[id] = formatAddress(dest.address);
        } else if (
          typeof dest?.lat === "number" &&
          typeof dest?.lng === "number" &&
          !next[id]
        ) {
          tasks.push(
            reverseGeocode(dest.lat, dest.lng).then((label) => {
              if (mounted && label) next[id] = label;
            })
          );
        }
      }
      if (tasks.length > 0) await Promise.all(tasks);
      if (mounted) setLabels(next);
    };
    run();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rides]);

  return (
    <div className="min-h-screen bg-amber-50 pb-20">
      {/* Header con logo y branding */}
      <div className="p-4 border-b border-amber-100 bg-amber-50">
        <div className="flex items-center space-x-3">
          <img src={logo} alt="Intu" className="w-10 h-10" />
          <div>
            <h1 className="text-2xl font-bold text-green-800">Tus viajes</h1>
            <p className="text-green-700 text-sm">Historial y viajes activos</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {rides.length === 0 ? (
          <Card className="border-green-100">
            <CardContent className="p-6 text-center text-green-700">
              <p>No tienes viajes registrados aún.</p>
              <Button className="mt-4 bg-green-700 hover:bg-green-800 text-white">
                Explorar destinos
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rides.map((r) => {
              const destLabel =
                labels[r.id] ??
                (r.data.destination?.address
                  ? formatAddress(r.data.destination.address!)
                  : `Lat ${r.data.destination?.lat?.toFixed(
                      4
                    )}, Lng ${r.data.destination?.lng?.toFixed(4)}`);
              const price = r.data.price ?? 0;
              const time = r.data.completedAt
                ? r.data.completedAt.toDate()
                : null;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => navigate(`/trips/${r.id}`)}
                  className="w-full flex items-center space-x-3 p-3 rounded-lg bg-white border border-green-100 hover:bg-amber-50 transition-colors"
                >
                  <MapPin className="h-5 w-5 text-green-600" />
                  <div className="flex-1">
                    <p className="text-green-800">{destLabel}</p>
                    <p className="text-xs text-green-700">
                      {time ? time.toLocaleString() : ""}
                    </p>
                  </div>
                  <div className="text-green-800 font-semibold">
                    S/ {price.toFixed(2)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Trips;
