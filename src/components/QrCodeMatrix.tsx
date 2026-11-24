/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.QRCODEMATRIX
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\components\QrCodeMatrix.tsx
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/components/QrCodeMatrix.tsx
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import { useMemo } from 'react';
import QRCode from 'qrcode';

interface QrCodeMatrixProps {
  value: string;
  label: string;
  size?: number;
}

export function QrCodeMatrix({ value, label, size = 184 }: QrCodeMatrixProps) {
  const matrix = useMemo(() => {
    try {
      const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
      const count = qr.modules.size;
      const cells: Array<{ x: number; y: number }> = [];
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (qr.modules.get(r, c)) {
            cells.push({ x: c, y: r });
          }
        }
      }
      return { count, cells };
    } catch {
      return null;
    }
  }, [value]);

  if (!matrix) {
    return (
      <div
        role="img"
        aria-label={label}
        className="w-44 h-44 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-xs text-slate-400 text-center p-4"
      >
        QR code unavailable
      </div>
    );
  }

  const quietZone = 2;
  const total = matrix.count + quietZone * 2;

  return (
    <div className="inline-flex p-3 rounded-2xl bg-white shadow-lg border border-white/15">
      <svg
        role="img"
        aria-label={label}
        width={size}
        height={size}
        viewBox={`0 0 ${total} ${total}`}
        shapeRendering="crispEdges"
        className="block"
      >
        <rect x={0} y={0} width={total} height={total} fill="#FFFFFF" />
        {matrix.cells.map((cell) => (
          <rect
            key={`${cell.x}-${cell.y}`}
            x={cell.x + quietZone}
            y={cell.y + quietZone}
            width={1}
            height={1}
            fill="#080B0F"
          />
        ))}
      </svg>
    </div>
  );
}
