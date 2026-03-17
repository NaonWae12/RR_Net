import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, Pane, Circle } from "react-leaflet";
import L from "leaflet";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Satellite, Navigation, Map as MapIcon } from "lucide-react";

// Fix for default marker icons
import "leaflet/dist/leaflet.css";

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (lat: number, lng: number) => void;
  initialLocation?: { lat: number; lng: number; radius?: number };
}

function LocationMarker({ position, setPosition, radius }: { position: [number, number], setPosition: (p: [number, number]) => void, radius?: number }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });

  return (
    <>
      <Marker position={position} />
      {radius && (
        <Circle
          center={position}
          radius={radius}
          pathOptions={{
            fillColor: "#4f46e5",
            fillOpacity: 0.15,
            color: "#4f46e5",
            weight: 2,
            dashArray: "5, 10",
          }}
        />
      )}
    </>
  );
}

// Internal component to handle programmatic map movements
function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export function LocationPickerModal({
  isOpen,
  onClose,
  onConfirm,
  initialLocation,
}: LocationPickerModalProps) {
  const [position, setPosition] = useState<[number, number]>(
    initialLocation ? [initialLocation.lat, initialLocation.lng] : [-6.2088, 106.8456] // Jakarta default
  );
  const [baseMap, setBaseMap] = useState<"osm" | "satellite">("osm");
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    // Sync with initialLocation when it changes or modal opens
    if (initialLocation) {
      setPosition([initialLocation.lat, initialLocation.lng]);
    }
  }, [isOpen, initialLocation]);

  useEffect(() => {
    // Re-fix Leaflet icons every time map might be mounted
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    });
  }, [isOpen]);

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
        setLocating(false);
      },
      (err) => {
        console.error("Geolocation error:", err);
        alert("Failed to get your location. Please check permissions.");
        setLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleConfirm = () => {
    onConfirm(position[0], position[1]);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pick Location"
      subtitle="Click on the map or use 'Locate Me' to select a point"
      size="lg"
      footer={
        <>
          <Button 
            variant="outline" 
            onClick={onClose}
            className="border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc]"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            className="bg-[#4f46e5] hover:bg-[#4338ca] text-[#ffffff] font-bold px-6 shadow-[0_4px_12px_rgba(79,70,229,0.3)] transition-all"
          >
            Confirm Selection
          </Button>
        </>
      }
    >
      <div className="h-[450px] w-full rounded-xl overflow-hidden border border-[#e2e8f0] relative shadow-inner">
        {/* Customized Map Controls Overlay */}
        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-3">
          <Button
            size="icon"
            variant="secondary"
            className="bg-[#ffffff]/90 backdrop-blur-sm border border-[#e2e8f0] shadow-xl hover:bg-[#ffffff] text-[#334155] rounded-full transition-all hover:scale-110"
            onClick={() => setBaseMap(baseMap === "osm" ? "satellite" : "osm")}
            title={baseMap === "osm" ? "Switch to Satellite" : "Switch to Map"}
          >
            {baseMap === "osm" ? <Satellite className="w-5 h-5" /> : <MapIcon className="w-5 h-5" />}
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className={`bg-[#ffffff]/90 backdrop-blur-sm border border-[#e2e8f0] shadow-xl hover:bg-[#ffffff] text-[#4f46e5] rounded-full transition-all hover:scale-110 ${locating ? "animate-pulse" : ""}`}
            onClick={handleLocateMe}
            disabled={locating}
            title="Locate Me"
          >
            <Navigation className="w-5 h-5" />
          </Button>
        </div>

        <MapContainer
          center={position}
          zoom={15}
          style={{ height: "100%", width: "100%" }}
          className="z-0"
        >
          {baseMap === "osm" ? (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          ) : (
            <>
              <TileLayer
                attribution='Tiles &copy; Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
              <Pane name="labels" style={{ zIndex: 650, pointerEvents: "none" }}>
                <TileLayer
                  attribution='Labels &copy; Esri'
                  url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                />
              </Pane>
            </>
          )}
          <MapUpdater center={position} />
          <LocationMarker position={position} setPosition={setPosition} radius={initialLocation?.radius} />
        </MapContainer>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-6 p-4 bg-[#f8fafc] rounded-xl border border-[#e2e8f0]">
        <div>
          <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest mb-1.5 block">Latitude Target</label>
          <div className="p-3 bg-white border border-[#e2e8f0] rounded-lg text-sm font-bold font-mono text-[#0f172a] shadow-sm select-all">
            {position[0].toFixed(8)}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest mb-1.5 block">Longitude Target</label>
          <div className="p-3 bg-white border border-[#e2e8f0] rounded-lg text-sm font-bold font-mono text-[#0f172a] shadow-sm select-all">
            {position[1].toFixed(8)}
          </div>
        </div>
      </div>
    </Modal>
  );
}
