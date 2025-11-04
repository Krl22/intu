import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Search, Navigation } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/useAuth";
import { firestore } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { searchPlaces, type GeocodeFeature } from "@/lib/geocoding";
import logo from "@/assets/logo.png";

const Home: React.FC = () => {
  const [destination, setDestination] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
    address?: string;
  } | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [suggestions, setSuggestions] = useState<GeocodeFeature[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const { user } = useAuth();
  const [isProfileComplete, setIsProfileComplete] = useState<boolean>(false);

  useEffect(() => {
    const checkProfile = async () => {
      if (!user) {
        setIsProfileComplete(false);
        return;
      }
      try {
        const snap = await getDoc(doc(firestore, "users", user.uid));
        const data = (snap.data() || {}) as {
          firstName?: string;
          lastName?: string;
          birthdate?: string;
          profilePhotoUrl?: string;
        };
        const ok = !!(data.firstName && data.lastName && data.birthdate && data.profilePhotoUrl);
        setIsProfileComplete(ok);
      } catch {
        setIsProfileComplete(false);
      }
    };
    checkProfile();
  }, [user]);

  const ensureProfileComplete = (): boolean => {
    if (!isProfileComplete) {
      alert("Completa tu perfil en Cuenta antes de buscar taxi.");
      navigate("/account");
      return false;
    }
    return true;
  };

  useEffect(() => {
    const state = location.state as {
      selectedLocation?: { lat: number; lng: number; address?: string };
    } | null;
    if (state?.selectedLocation) {
      const s = state.selectedLocation;
      setSelectedLocation(s);
      setDestination(s.address || `${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}`);
    }
  }, [location]);

  // Geolocalización para proximidad de sugerencias
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          // Fallback a una ubicación por defecto si falla (NYC)
          setUserLoc({ lat: 40.7128, lng: -74.006 });
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } else {
      setUserLoc({ lat: 40.7128, lng: -74.006 });
    }
  }, []);

  // Búsqueda con debounce y radio de 20 millas
  useEffect(() => {
    if (!userLoc) return;
    if (!destination || destination.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        setLoadingSuggestions(true);
        const feats = await searchPlaces(
          destination.trim(),
          userLoc,
          import.meta.env.VITE_MAPBOX_ACCESS_TOKEN,
          20,
          8
        );
        setSuggestions(feats);
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300);
  }, [destination, userLoc]);

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col">
      {/* Header con logo y colores de marca */}
      <div className="p-4 border-b border-amber-100 bg-amber-50">
        <div className="flex items-center space-x-3">
          <img src={logo} alt="Intu" className="w-10 h-10" />
          <div>
            <h1 className="text-2xl font-bold text-green-800">Intu</h1>
            <p className="text-green-700 text-sm">¿Adónde vas?</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 space-y-4">
        {/* Destination Input Card */}
        <Card className="shadow-md border-green-100">
          <CardContent className="p-4">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <MapPin className="h-5 w-5 text-green-700" />
                <span className="font-medium text-green-800">Destino</span>
              </div>

              <div className="relative">
                <Input
                  type="text"
                  placeholder="Ingresa tu destino..."
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="pl-10 pr-4 py-3 text-lg border-2 border-green-200 focus:border-amber-500 rounded-lg bg-white"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-600" />

                {/* Suggestions Dropdown */}
                {(suggestions.length > 0 || loadingSuggestions) && (
                  <div className="absolute left-0 right-0 mt-2 bg-white border border-green-100 rounded-lg shadow-lg z-30 max-h-64 overflow-auto">
                    {loadingSuggestions && (
                      <div className="p-3 text-sm text-green-700">
                        Buscando lugares cerca de ti…
                      </div>
                    )}
                    {!loadingSuggestions &&
                      suggestions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            if (!ensureProfileComplete()) return;
                            const [lng, lat] = s.center;
                            setSelectedLocation({
                              lat,
                              lng,
                              address: s.place_name,
                            });
                            setDestination(s.place_name);
                            setSuggestions([]);
                            navigate("/route", {
                              state: {
                                destination: {
                                  lat,
                                  lng,
                                  address: s.place_name,
                                },
                              },
                            });
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-amber-50 flex items-center space-x-2"
                        >
                          <MapPin className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-green-800">
                            {s.place_name}
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div>
                <Button
                  onClick={() => {
                    if (!ensureProfileComplete()) return;
                    navigate("/select-destination", { state: { userLoc } });
                  }}
                  disabled={!isProfileComplete}
                  className="w-full flex items-center justify-center space-x-2 py-3 bg-green-700 hover:bg-green-800 text-white"
                >
                  <Navigation className="h-4 w-4" />
                  <span>Elegir en mapa</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Destinations */}
        <Card className="shadow-md border-green-100">
          <CardContent className="p-4">
            <h3 className="font-medium text-gray-700 mb-3">
              Destinos recientes
            </h3>
            <div className="space-y-2">
              {[
                "Centro Comercial Plaza",
                "Aeropuerto Internacional",
                "Universidad Central",
              ].map((place, index) => (
                <div
                  key={index}
                  onClick={() => setDestination(place)}
                  className="flex items-center space-x-3 p-3 rounded-lg bg-white hover:bg-amber-50 cursor-pointer transition-colors border border-green-100"
                >
                  <MapPin className="h-4 w-4 text-green-600" />
                  <span className="text-green-800">{place}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Selected Location Info */}
        {selectedLocation && (
          <Card className="shadow-md border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <MapPin className="h-5 w-5 text-green-700" />
                <div>
                  <p className="font-medium text-green-800">
                    Ubicación seleccionada
                  </p>
                  <p className="text-sm text-green-600">
                    {selectedLocation.address ||
                      `${selectedLocation.lat.toFixed(
                        4
                      )}, ${selectedLocation.lng.toFixed(4)}`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Mapa ahora se selecciona en pantalla completa en otra página */}
    </div>
  );
};

export default Home;
