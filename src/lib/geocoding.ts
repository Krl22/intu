export type Coordinates = { lat: number; lng: number };

const milesToKm = (miles: number) => miles * 1.60934;

export function computeBbox(center: Coordinates, radiusMiles: number) {
  const radiusKm = milesToKm(radiusMiles);
  const latDeg = radiusKm / 111.32;
  const lonDeg = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));

  const minLat = center.lat - latDeg;
  const maxLat = center.lat + latDeg;
  const minLng = center.lng - lonDeg;
  const maxLng = center.lng + lonDeg;

  return [minLng, minLat, maxLng, maxLat] as [number, number, number, number];
}

export interface GeocodeFeature {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
}

export async function searchPlaces(
  query: string,
  center: Coordinates,
  token: string,
  radiusMiles = 20,
  limit = 8
) {
  const bbox = computeBbox(center, radiusMiles);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    query
  )}.json?access_token=${token}&autocomplete=true&proximity=${center.lng},${
    center.lat
  }&types=address,poi,place&limit=${limit}&bbox=${bbox.join(",")}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Geocoding request failed");
  const data = await res.json();
  return (data.features || []) as GeocodeFeature[];
}