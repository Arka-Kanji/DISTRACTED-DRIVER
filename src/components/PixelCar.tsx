export function PixelCar({ color, facingLeft, className, isPlayer }: { color: string, facingLeft?: boolean, className?: string, isPlayer?: boolean }) {
  return (
    <div className={`relative ${className}`} style={{ transform: facingLeft ? 'scaleX(-1)' : 'none' }}>
      <svg viewBox="0 0 100 50" className="w-full h-auto drop-shadow-lg" shapeRendering="crispEdges">
        {/* Tires */}
        <rect x="12" y="4" width="16" height="8" fill="#111" />
        <rect x="72" y="4" width="16" height="8" fill="#111" />
        <rect x="12" y="38" width="16" height="8" fill="#111" />
        <rect x="72" y="38" width="16" height="8" fill="#111" />
        
        {/* Car Body Base */}
        <rect x="4" y="10" width="92" height="30" fill={color} rx={isPlayer ? "4" : "0"} />
        
        {/* Darker styling accent for depth */}
        <rect x="10" y="12" width="80" height="26" fill="rgba(0,0,0,0.15)" />
        
        {/* Roof / Windows Block */}
        <rect x="25" y="14" width="46" height="22" fill="#222" />
        <rect x="30" y="16" width="36" height="18" fill={color} rx="2" />
        
        {/* Windshields */}
        {/* Front */}
        <rect x="70" y="15" width="8" height="20" fill="#60a5fa" opacity="0.8" />
        {/* Rear */}
        <rect x="20" y="15" width="6" height="20" fill="#60a5fa" opacity="0.8" />
        
        {/* Headlights (Front, Right) */}
        <rect x="92" y="12" width="4" height="6" fill="#fde047" />
        <rect x="92" y="32" width="4" height="6" fill="#fde047" />
        
        {/* Taillights (Rear, Left) */}
        <rect x="0" y="12" width="4" height="6" fill="#ef4444" />
        <rect x="0" y="32" width="4" height="6" fill="#ef4444" />
      </svg>
    </div>
  )
}
