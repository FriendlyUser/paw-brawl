// Effect and projectile textures, painted once at startup.
import { makeCanvas, shade, ellipse, star, volume, capsule } from './paint.js';

function tex(w, h, draw) {
  const c = makeCanvas(w, h);
  draw(c.getContext('2d'), w, h);
  return c;
}

export function paintFx() {
  const out = {};
  out.glow = tex(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
  out.spark = tex(128, 128, (ctx) => {
    ctx.fillStyle = '#fff';
    star(ctx, 64, 64, 4, 62, 9, 0);
    ctx.fill();
  });
  out.burst = tex(256, 256, (ctx) => {
    ctx.fillStyle = '#fff';
    star(ctx, 128, 128, 8, 124, 40, 0.2);
    ctx.fill();
  });
  out.ring = tex(256, 256, (ctx) => {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(128, 128, 112, 0, Math.PI * 2);
    ctx.stroke();
  });
  out.puff = tex(96, 96, (ctx) => {
    const g = ctx.createRadialGradient(40, 38, 4, 48, 48, 46);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.6, 'rgba(235,235,235,0.75)');
    g.addColorStop(1, 'rgba(220,220,220,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(48, 48, 46, 0, Math.PI * 2);
    ctx.fill();
  });
  out.streak = tex(256, 32, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.7, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0.2)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(128, 16, 128, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  out.star5 = tex(64, 64, (ctx) => {
    ctx.fillStyle = '#ffe14a';
    ctx.strokeStyle = '#a8650a';
    ctx.lineWidth = 4;
    star(ctx, 32, 33, 5, 28, 12);
    ctx.fill();
    ctx.stroke();
  });
  out.leaf = tex(48, 32, (ctx) => {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(4, 16);
    ctx.quadraticCurveTo(24, -4, 44, 16);
    ctx.quadraticCurveTo(24, 36, 4, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(6, 16);
    ctx.lineTo(42, 16);
    ctx.stroke();
  });
  out.snow = tex(32, 32, (ctx) => {
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
  });
  out.halo = tex(256, 64, (ctx) => {
    const g = ctx.createRadialGradient(128, 32, 4, 128, 32, 120);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.scale(1, 0.25);
    ctx.beginPath();
    ctx.arc(128, 128, 124, 0, Math.PI * 2);
    ctx.restore();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(128, 32, 96, 14, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
  out.shadow = tex(128, 32, (ctx) => {
    const g = ctx.createRadialGradient(64, 16, 2, 64, 16, 64);
    g.addColorStop(0, 'rgba(0,0,0,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.scale(1, 0.25);
    ctx.fillRect(0, 0, 128, 128);
    ctx.restore();
  });
  out.bubbleShield = tex(256, 256, (ctx) => {
    const g = ctx.createRadialGradient(100, 90, 10, 128, 128, 124);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.18)');
    g.addColorStop(0.9, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0.9)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(128, 128, 124, 0, Math.PI * 2);
    ctx.fill();
    ellipse(ctx, 92, 80, 30, 16, -0.6);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
  });
  out.arrow = tex(48, 40, (ctx) => {
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(6, 6);
    ctx.lineTo(42, 6);
    ctx.lineTo(24, 34);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
  // ---- projectiles
  out.proj_honey = tex(80, 80, (ctx) => {
    ctx.translate(40, 42);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#4a2a12';
    ctx.beginPath();
    ctx.moveTo(-26, -8);
    ctx.quadraticCurveTo(-30, 30, 0, 32);
    ctx.quadraticCurveTo(30, 30, 26, -8);
    ctx.closePath();
    ctx.fillStyle = volume(ctx, 0, 8, 30, '#c9772f');
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(-22, -20, 44, 14, 6);
    ctx.fillStyle = '#e8a25a';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffc928';
    ctx.beginPath();
    ctx.moveTo(-18, -8);
    ctx.quadraticCurveTo(-16, 12, -10, 4);
    ctx.quadraticCurveTo(-4, 14, 2, 0);
    ctx.quadraticCurveTo(10, 16, 18, -8);
    ctx.fill();
    ctx.fillStyle = '#4a2a12';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HONEY', 0, 22);
  });
  out.proj_yarn = tex(64, 64, (ctx) => {
    ctx.translate(32, 32);
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fillStyle = volume(ctx, 0, 0, 26, '#ff6fa8');
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#a3285e';
    ctx.stroke();
    ctx.strokeStyle = 'rgba(163,40,94,0.7)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, 24, 9 + i * 3, i * 0.7, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  out.proj_carrot = tex(80, 40, (ctx) => {
    ctx.translate(40, 20);
    ctx.fillStyle = '#4dbb4a';
    for (const a of [-0.5, 0, 0.5]) { ctx.save(); ctx.rotate(Math.PI + a); ellipse(ctx, 14, 0, 12, 5); ctx.fill(); ctx.restore(); }
    ctx.beginPath();
    ctx.moveTo(-14, -11);
    ctx.quadraticCurveTo(10, -8, 34, 0);
    ctx.quadraticCurveTo(10, 8, -14, 11);
    ctx.closePath();
    ctx.fillStyle = volume(ctx, 0, -4, 24, '#ff8a2a');
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#a8460c';
    ctx.stroke();
    ctx.lineWidth = 1.5;
    for (const x of [-4, 6, 16]) { ctx.beginPath(); ctx.moveTo(x, -6); ctx.lineTo(x + 3, -2); ctx.stroke(); }
  });
  out.proj_bubble = tex(80, 80, (ctx) => {
    const g = ctx.createRadialGradient(30, 28, 2, 40, 40, 38);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.3, 'rgba(170,240,255,0.25)');
    g.addColorStop(0.85, 'rgba(120,220,255,0.35)');
    g.addColorStop(1, 'rgba(200,250,255,0.95)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(40, 40, 37, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ellipse(ctx, 28, 24, 10, 5, -0.7);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();
  });
  out.proj_feather = tex(64, 24, (ctx) => {
    ctx.translate(32, 12);
    ctx.beginPath();
    ctx.moveTo(-28, 0);
    ctx.quadraticCurveTo(0, -12, 28, 0);
    ctx.quadraticCurveTo(0, 12, -28, 0);
    ctx.fillStyle = volume(ctx, 0, 0, 26, '#d9b98a');
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#5e4128';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    ctx.lineTo(26, 0);
    ctx.stroke();
  });
  out.tongue = tex(64, 24, (ctx) => {
    ctx.fillStyle = '#ff6f8e';
    ctx.strokeStyle = '#a3284a';
    ctx.lineWidth = 3;
    capsule(ctx, 32, 2, 18, 20);
    ctx.save();
    ctx.translate(32, 12);
    ctx.rotate(-Math.PI / 2);
    ctx.translate(-32, -12);
    ctx.restore();
    ctx.beginPath();
    ctx.roundRect(2, 4, 60, 16, 8);
    ctx.fill();
    ctx.stroke();
  });
  out.dizzy = out.star5;
  out.pixel = tex(4, 4, (ctx) => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 4, 4); });
  return out;
}

export const PLAYER_COLORS = ['#ff4d5e', '#3d8bff', '#ffc531', '#3ccf6e'];
export const PLAYER_LABELS = ['P1', 'P2', 'P3', 'P4'];
export { shade };
