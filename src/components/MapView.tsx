import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { Circle, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import type { LatLng } from '../lib/feasibility'

export interface MapPin extends LatLng {
  id: string
  label: string
  status: 'easy' | 'tight'
}

interface MapViewProps {
  start: LatLng
  pins: MapPin[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  /** Light reachability ring around the start, in meters. */
  radius?: number
  /** Draws a dashed line from the start to this pin (results screen). */
  routeTo?: string | null
  className?: string
}

// Custom HTML markers styled with our palette (Leaflet's default PNG pins look out of place).
const pinIcon = (status: 'easy' | 'tight', selected: boolean) =>
  L.divIcon({
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `<span class="lr-pin lr-pin-${status}${selected ? ' lr-pin-selected' : ''}"></span>`,
  })

const startIcon = L.divIcon({
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  html: '<span class="lr-start"><span></span></span>',
})

/** Fits the view to the start + all pins whenever they change. */
function FitBounds({ start, pins }: { start: LatLng; pins: MapPin[] }) {
  const map = useMap()
  // Only refit when the actual set of points changes (not on every re-render),
  // so the map doesn't jump while someone is panning it.
  const key = [start, ...pins].map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|')
  useEffect(() => {
    const points = [start, ...pins].map((p) => [p.lat, p.lng] as [number, number])
    if (points.length === 1) map.setView(points[0], 15)
    else map.fitBounds(points, { padding: [36, 36], maxZoom: 17 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key])
  return null
}

/**
 * Dark-themed Leaflet map (OpenStreetMap tiles, darkened with a CSS filter).
 * Pins are colored by Easy (lime) / Tight (amber); the start pulses in ember.
 */
export function MapView({ start, pins, selectedId, onSelect, radius, routeTo, className = '' }: MapViewProps) {
  const target = routeTo ? pins.find((p) => p.id === routeTo) : null
  return (
    <div className={`overflow-hidden rounded-2xl ring-1 ring-cream/10 ${className}`}>
      <MapContainer
        center={[start.lat, start.lng]}
        zoom={16}
        zoomControl={false}
        attributionControl
        className="size-full bg-ink"
      >
        {/* Standard OSM tiles (free, no key), turned dark with a CSS filter — see .lr-tiles in index.css */}
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          className="lr-tiles"
          maxZoom={19}
        />
        {radius && (
          <Circle
            center={[start.lat, start.lng]}
            radius={radius}
            pathOptions={{ color: '#ff6a3d', weight: 1, opacity: 0.35, fillColor: '#ff6a3d', fillOpacity: 0.04, dashArray: '4 6' }}
          />
        )}
        {target && (
          <Polyline
            positions={[
              [start.lat, start.lng],
              [target.lat, target.lng],
            ]}
            pathOptions={{ color: '#ff6a3d', weight: 4, opacity: 0.9, dashArray: '2 10', lineCap: 'round' }}
          />
        )}
        <Marker position={[start.lat, start.lng]} icon={startIcon} zIndexOffset={1000} />
        {pins.map((p) => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={pinIcon(p.status, p.id === selectedId)}
            zIndexOffset={p.id === selectedId ? 500 : 0}
            eventHandlers={{ click: () => onSelect?.(p.id) }}
          >
            <Tooltip direction="top" offset={[0, -10]} className="lr-tooltip">
              {p.label}
            </Tooltip>
          </Marker>
        ))}
        <FitBounds start={start} pins={pins} />
      </MapContainer>
    </div>
  )
}
