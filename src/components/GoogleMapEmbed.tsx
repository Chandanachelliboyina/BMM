interface Props {
  latitude: number;
  longitude: number;
  height?: number;
}

// Simple, reliable Google Maps embed (no JS API load required).
// Uses the browser-safe embed API key from the Google Maps connector.
export function GoogleMapEmbed({ latitude, longitude, height = 240 }: Props) {
  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
  if (!key) {
    return (
      <div className="rounded-lg border bg-muted flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
        Map unavailable
      </div>
    );
  }
  const src = `https://www.google.com/maps/embed/v1/place?key=${key}&q=${latitude},${longitude}&zoom=16`;
  return (
    <iframe
      title="Live location"
      src={src}
      className="w-full rounded-lg border"
      style={{ height }}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      allowFullScreen
    />
  );
}
