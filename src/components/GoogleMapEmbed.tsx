import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet's default icon path issues in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface Props {
  latitude: number;
  longitude: number;
  height?: number;
}

// A simple component to re-center the map when coords change
function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, map, zoom]);
  return null;
}

// Drops-in as a replacement for the old Google Maps embed, using free OpenStreetMap.
export function GoogleMapEmbed({ latitude, longitude, height = 240 }: Props) {
  if (!latitude || !longitude) {
    return (
      <div className="rounded-lg border bg-muted flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
        Location unavailable
      </div>
    );
  }

  const position: [number, number] = [latitude, longitude];

  return (
    <div className="rounded-lg border overflow-hidden" style={{ height }}>
      <MapContainer center={position} zoom={16} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <ChangeView center={position} zoom={16} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position}>
          <Popup>
            Exact Location
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
