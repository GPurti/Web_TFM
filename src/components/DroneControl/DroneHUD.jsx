import { useEffect, useRef } from 'react';

export default function DroneHUD({ telemetry = {} }) {
  const canvasRef = useRef(null);

  const pitch = telemetry?.pitch || 0;
  const roll = telemetry?.roll || 0;
  const heading = telemetry?.heading || 0;
  const altitude = telemetry?.altitude_ahl || 0;
  const airspeed = telemetry?.airSpeed || 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;

    ctx.clearRect(0, 0, W, H);

    // ── Clip rodons ──
    ctx.save();
    const radius = 12;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(W - radius, 0);
    ctx.quadraticCurveTo(W, 0, W, radius);
    ctx.lineTo(W, H - radius);
    ctx.quadraticCurveTo(W, H, W - radius, H);
    ctx.lineTo(radius, H);
    ctx.quadraticCurveTo(0, H, 0, H - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.clip();

    // ── Horitzó artificial ──
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((-roll * Math.PI) / 180);

    const pitchOffset = pitch * 3.5;

    // Gradient cel
    const skyGrad = ctx.createLinearGradient(0, -H + pitchOffset, 0, pitchOffset);
    skyGrad.addColorStop(0, '#0a1628');
    skyGrad.addColorStop(1, '#1e5fa8');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(-W, -H + pitchOffset, W * 2, H);

    // Gradient terra
    const groundGrad = ctx.createLinearGradient(0, pitchOffset, 0, H);
    groundGrad.addColorStop(0, '#2d5a1b');  // ← verd fosc
    groundGrad.addColorStop(1, '#1a3a0a');  // ← verd molt fosc
    ctx.fillStyle = groundGrad;
    ctx.fillRect(-W, pitchOffset, W * 2, H);

    // Línia horitzó
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-W, pitchOffset);
    ctx.lineTo(W, pitchOffset);
    ctx.stroke();

    // Línies de pitch
    for (let p = -30; p <= 30; p += 5) {
      if (p === 0) continue;
      const y = pitchOffset - p * 3.5;
      const len = p % 10 === 0 ? 35 : 18;
      ctx.strokeStyle = p % 10 === 0 ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)';
      ctx.lineWidth = p % 10 === 0 ? 1.2 : 0.8;
      ctx.beginPath();
      ctx.moveTo(-len, y);
      ctx.lineTo(len, y);
      ctx.stroke();

      if (p % 10 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '9px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(p, len + 5, y + 3);
        ctx.textAlign = 'right';
        ctx.fillText(p, -len - 5, y + 3);
      }
    }

    ctx.restore();

    // ── Avió central ──
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    // ala esquerra
    ctx.beginPath();
    ctx.moveTo(cx - 45, cy + 2);
    ctx.lineTo(cx - 18, cy + 2);
    ctx.lineTo(cx - 12, cy - 4);
    ctx.stroke();
    // ala dreta
    ctx.beginPath();
    ctx.moveTo(cx + 45, cy + 2);
    ctx.lineTo(cx + 18, cy + 2);
    ctx.lineTo(cx + 12, cy - 4);
    ctx.stroke();
    // fuselatge
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy + 2);
    ctx.lineTo(cx + 5, cy + 2);
    ctx.stroke();
    // punt central
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffcc00';
    ctx.fill();

    // ── Heading bar ──
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    roundRect(ctx, cx - 65, 5, 130, 22, 5);
    ctx.fill();

    // Punts cardinals
    const dirs = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]];
    dirs.forEach(([label, deg]) => {
      const diff = ((deg - heading + 540) % 360) - 180;
      if (Math.abs(diff) < 65) {
        const x = cx + diff * (130 / 130);
        const isCardinal = ['N', 'E', 'S', 'W'].includes(label);
        ctx.fillStyle = label === 'N' ? '#ff5555' : isCardinal ? 'white' : 'rgba(255,255,255,0.5)';
        ctx.font = `${isCardinal ? 'bold ' : ''}${isCardinal ? '11' : '9'}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(label, x, 18);
      }
    });

    // Heading actual
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    roundRect(ctx, cx - 22, 24, 44, 16, 4);  // ← era 27
    ctx.fill();
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(heading).toString().padStart(3, '0')}°`, cx, 36);  // ← era 39

    // ── Altitud (dreta) ──
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    roundRect(ctx, W - 58, cy - 28, 52, 40, 5);
    ctx.fill();
    ctx.strokeStyle = '#00e676';
    ctx.lineWidth = 1;
    roundRect(ctx, W - 58, cy - 28, 52, 40, 5);
    ctx.stroke();
    ctx.fillStyle = '#00e676';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${altitude.toFixed(1)}`, W - 10, cy - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '9px monospace';
    ctx.fillText('ALT m', W - 10, cy + 7);

    // ── Velocitat (esquerra) ──
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    roundRect(ctx, 6, cy - 28, 52, 40, 5);
    ctx.fill();
    ctx.strokeStyle = '#00e676';
    ctx.lineWidth = 1;
    roundRect(ctx, 6, cy - 28, 52, 40, 5);
    ctx.stroke();
    ctx.fillStyle = '#00e676';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${airspeed.toFixed(1)}`, 10, cy - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '9px monospace';
    ctx.fillText('SPD m/s', 10, cy + 7);

    // ── Roll indicator ──
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 70, (-150 * Math.PI) / 180, (-30 * Math.PI) / 180);
    ctx.stroke();

    [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60].forEach(angle => {
      ctx.save();
      ctx.rotate((angle * Math.PI) / 180);
      ctx.strokeStyle = angle === 0 ? 'white' : 'rgba(255,255,255,0.5)';
      ctx.lineWidth = angle % 30 === 0 ? 1.5 : 0.8;
      ctx.beginPath();
      ctx.moveTo(0, -70);
      ctx.lineTo(0, angle % 30 === 0 ? -62 : -65);
      ctx.stroke();
      ctx.restore();
    });

    // Indicador roll actual
    ctx.save();
    ctx.rotate((-roll * Math.PI) / 180);
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.moveTo(0, -70);
    ctx.lineTo(-5, -63);
    ctx.lineTo(5, -63);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();

    ctx.restore(); // clip

  }, [pitch, roll, heading, altitude, airspeed]);

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={180}
      style={{
        display: 'block',
        width: '100%',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    />
  );
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}