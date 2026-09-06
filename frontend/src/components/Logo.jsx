import React from "react";

/**
 * Logo SVG para MS Soluções Financeiras.
 * Fundo preto com "MS" azul e brilho — usado no login, cadastro e header.
 * size = altura em pixels (mantém proporção quadrada).
 */
export default function Logo({ size = 44, variant = "square" }) {
  const id = React.useId();
  const s = size;
  const r = variant === "square" ? s * 0.24 : s * 0.5;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="MS Soluções Financeiras"
      role="img"
      style={{ display: "block" }}
    >
      <defs>
        <radialGradient id={`bg-${id}`} cx="30%" cy="25%" r="80%">
          <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.85" />
          <stop offset="45%" stopColor="#0b1424" stopOpacity="1" />
          <stop offset="100%" stopColor="#04070f" stopOpacity="1" />
        </radialGradient>
        <linearGradient id={`text-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#dbeafe" />
          <stop offset="45%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id={`bar-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <filter id={`glow-${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Fundo */}
      <rect
        x="1"
        y="1"
        width="98"
        height="98"
        rx={(r / s) * 100}
        ry={(r / s) * 100}
        fill={`url(#bg-${id})`}
        stroke="#1d4ed8"
        strokeOpacity="0.55"
        strokeWidth="1.2"
      />

      {/* Halo azul sutil canto superior esquerdo */}
      <circle cx="30" cy="26" r="30" fill="#2563eb" opacity="0.16" />

      {/* Texto MS com brilho */}
      <text
        x="50"
        y="63"
        textAnchor="middle"
        fontFamily="'Outfit', 'DM Sans', system-ui, sans-serif"
        fontWeight="800"
        fontSize="46"
        fill={`url(#text-${id})`}
        filter={`url(#glow-${id})`}
        letterSpacing="-2"
      >
        MS
      </text>

      {/* Barra ciano de destaque */}
      <rect
        x="24"
        y="80"
        width="52"
        height="3.5"
        rx="1.75"
        fill={`url(#bar-${id})`}
        opacity="0.9"
      />
    </svg>
  );
}
