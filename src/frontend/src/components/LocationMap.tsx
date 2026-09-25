import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import type { DashboardSummary } from "@surplus/shared";

type Point = DashboardSummary["mapPoints"][number];
export function haversineDistanceKm(from: Pick<Point, "latitude" | "longitude">, to: Pick<Point, "latitude" | "longitude">) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(to.latitude - from.latitude); const dLon = radians(to.longitude - from.longitude);
  const lat1 = radians(from.latitude); const lat2 = radians(to.latitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const markerIcon = (type: Point["type"]) => L.divIcon({
  className: "map-marker-wrap", html: `<span class="map-marker map-marker-${type.toLowerCase()}"></span>`,
  iconSize: [22, 22], iconAnchor: [11, 11],
});
function FitPoints({ points }: { points: Point[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) map.setView([points[0].latitude, points[0].longitude], 13);
    else map.fitBounds(points.map(({ latitude, longitude }) => [latitude, longitude] as [number, number]), { padding: [36, 36], maxZoom: 12 });
  }, [map, points]);
  return null;
}
export function LocationMap({ points, title = "Food rescue locations" }: { points: Point[]; title?: string }) {
  if (points.length === 0) return <section className="location-map-card"><div><p className="eyebrow">Location view</p><h2>{title}</h2><p className="field-note">Location coordinates unavailable.</p></div></section>;
  const pickup = points.find((point) => point.type === "DONATION" || point.type === "COMMUNITY");
  const recipient = points.find((point) => point.type === "RECIPIENT");
  const routePoints = pickup && recipient ? [pickup, recipient] : [];
  const distance = pickup && recipient ? haversineDistanceKm(pickup, recipient) : null;
  return <section className="location-map-card"><div className="location-map-heading"><div><p className="eyebrow">OpenStreetMap</p><h2>{title}</h2></div>
    {distance !== null && <span className="map-distance">Approx. distance: {distance.toFixed(1)} km straight-line</span>}</div>
    {pickup && recipient && <div className="map-route-label"><span>{pickup.label}</span><span aria-hidden="true">to</span><span>{recipient.label}</span></div>}
    <MapContainer className="location-map" center={[points[0].latitude, points[0].longitude]} zoom={11} scrollWheelZoom={false}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitPoints points={points} />
      {points.map((point) => <Marker key={`${point.type}:${point.id}`} position={[point.latitude, point.longitude]} icon={markerIcon(point.type)}>
        <Popup><strong>{point.label}</strong><br />{point.area}</Popup>
      </Marker>)}
      {routePoints.length === 2 && <Polyline positions={routePoints.map((point) => [point.latitude, point.longitude])} pathOptions={{ color: "#277551", dashArray: "7 8", weight: 3 }} />}
    </MapContainer>
    <div className="location-map-legend">{[...new Set(points.map((point) => point.type))].map((type) => <span key={type}><i className={`legend-dot legend-${type.toLowerCase()}`} />{type === "DONATION" ? "Pickup" : type === "COMMUNITY" ? "Community pickup" : "Recipient"}</span>)}</div>
  </section>;
}
