// icons/GoldIcon.tsx
import React from 'react';

interface IconProps {
  size: number;
}

const GoldIcon: React.FC<IconProps> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="50" cy="50" r="48" fill="url(#goldBg)" stroke="#e8b800" strokeWidth="2" />
    <circle cx="50" cy="50" r="46" fill="none" stroke="#ffd700" strokeWidth="0.5" opacity="0.5" />
    <polygon
      points="18,66 18,38 34,54 50,22 66,54 82,38 82,66"
      fill="url(#goldCrown)"
      stroke="#ffd700"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <polygon points="18,38 34,54 50,22 66,54 82,38 76,35 50,18 24,35" fill="white" opacity="0.2" />
    <rect x="16" y="64" width="68" height="11" rx="4" fill="url(#goldBar)" stroke="#ffd700" strokeWidth="1" />
    <rect x="16" y="64" width="68" height="4" rx="4" fill="white" opacity="0.15" />
    <polygon
      points="50,19 53,25 59,25 54,29 56,35 50,31 44,35 46,29 41,25 47,25"
      fill="url(#goldStar)"
      stroke="#ffa000"
      strokeWidth="0.5"
    />
    <circle cx="18" cy="40" r="4" fill="url(#goldGem)" />
    <circle cx="82" cy="40" r="4" fill="url(#goldGem)" />
    <polygon points="34,56 37,59 34,62 31,59" fill="#ffd700" opacity="0.8" />
    <polygon points="66,56 69,59 66,62 63,59" fill="#ffd700" opacity="0.8" />
    <path d="M50,14 L51.5,19 L56,20 L51.5,21 L50,26 L48.5,21 L44,20 L48.5,19 Z" fill="white" opacity="0.9" />
    <defs>
      <radialGradient id="goldBg" cx="40%" cy="35%">
        <stop offset="0%" stopColor="#5a4000" />
        <stop offset="60%" stopColor="#2a1e00" />
        <stop offset="100%" stopColor="#1a1200" />
      </radialGradient>
      <linearGradient id="goldCrown" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ffe066" />
        <stop offset="30%" stopColor="#ffd700" />
        <stop offset="70%" stopColor="#e8a800" />
        <stop offset="100%" stopColor="#c07800" />
      </linearGradient>
      <linearGradient id="goldBar" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#c07800" />
        <stop offset="30%" stopColor="#ffd700" />
        <stop offset="50%" stopColor="#ffe566" />
        <stop offset="70%" stopColor="#ffd700" />
        <stop offset="100%" stopColor="#c07800" />
      </linearGradient>
      <radialGradient id="goldGem" cx="35%" cy="35%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="40%" stopColor="#ffe566" />
        <stop offset="100%" stopColor="#c07800" />
      </radialGradient>
      <radialGradient id="goldStar" cx="50%" cy="40%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="50%" stopColor="#ffd700" />
        <stop offset="100%" stopColor="#e8a000" />
      </radialGradient>
    </defs>
  </svg>
);

export default GoldIcon;