import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { firestore } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/context/useAuth";

type RideDoc = {
  riderId?: string | null;
  driverId?: string | null;
  destination?: { address?: string | null; lat: number; lng: number };
  origin?: { lat: number; lng: number };
  price?: number;
  riderRating?: number | null;
  riderComment?: string | null;
};

const RateDriver: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ride, setRide] = React.useState<RideDoc | null>(null);
  const [rating, setRating] = React.useState<number>(0);
  const [hover, setHover] = React.useState<number>(0);
  const [comment, setComment] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!id) return;
    const d = doc(firestore, "rides", id);
    const unsub = onSnapshot(d, (snap) => {
      const data = snap.data() as RideDoc | undefined;
      if (!data) return;
      setRide(data);
      if (typeof data.riderRating === "number" && data.riderRating > 0) {
        setRating(data.riderRating);
      }
    });
    return () => unsub();
  }, [id]);

  const canRate = React.useMemo(() => {
    if (!user || !ride) return false;
    return ride.riderId === user.uid;
  }, [user, ride]);

  const submit = async () => {
    if (!id || !user || !canRate) return;
    if (rating < 1 || rating > 5) {
      setError("Por favor selecciona entre 1 y 5 estrellas.");
      return;
    }
    try {
      setSubmitting(true);
      const d = doc(firestore, "rides", id);
      await updateDoc(d, {
        riderRating: rating,
        riderComment: comment.trim() ? comment.trim() : null,
        riderRatedAt: serverTimestamp(),
      });
      navigate("/trips", { replace: true });
    } catch {
      setError("No se pudo guardar tu calificación.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-amber-50">
      <div className="p-4 border-b border-amber-100 bg-amber-50">
        <div className="flex items-center space-x-3">
          <h1 className="text-2xl font-bold text-green-800">Calificar conductor</h1>
          <p className="text-green-700 text-sm">Tu opinión mejora el servicio</p>
        </div>
      </div>

      <div className="p-4">
        <Card className="border-green-100">
          <CardContent className="p-6 space-y-4">
            {ride ? (
              <div className="space-y-2">
                <p className="text-sm text-green-800">
                  Destino: {ride.destination?.address ?? "(sin dirección)"}
                </p>
                {typeof ride.price === "number" && (
                  <p className="text-sm text-green-800">Precio: S/ {ride.price.toFixed(2)}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-green-700">Cargando viaje…</p>
            )}

            <div className="flex items-center space-x-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(i)}
                  className="p-1"
                  disabled={!canRate}
                >
                  <Star
                    className={`h-7 w-7 ${i <= (hover || rating) ? "text-yellow-500 fill-yellow-400" : "text-gray-400"}`}
                  />
                </button>
              ))}
            </div>

            <div>
              <label className="block text-sm text-green-800 mb-1">Comentario (opcional)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="¿Algo que destacar?"
                className="w-full border rounded p-2 text-sm"
                rows={3}
                disabled={!canRate}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <Button
                className="bg-green-700 hover:bg-green-800 text-white"
                onClick={submit}
                disabled={!canRate || submitting}
              >
                Guardar calificación
              </Button>
              <Button
                variant="outline"
                className="border-green-200"
                onClick={() => navigate("/trips")}
              >
                Omitir
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RateDriver;