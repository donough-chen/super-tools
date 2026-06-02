// icons/SilverIcon.tsx
import React from 'react';

interface IconProps {
  size: number;
}

const SilverIcon: React.FC<IconProps> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="50" cy="50" r="48" fill="url(#silverBg)" stroke="#b0b8c8" strokeWidth="1.5" />
    <circle cx="50" cy="50" r="44" fill="none" stroke="url(#silverRing)" strokeWidth="1" opacity="0.6" />
    <polygon
      points="20,65 20,40 35,55 50,25 65,55 80,40 80,65"
      fill="url(#silverCrown)"
      stroke="#d0d8e8"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <rect x="18" y="63" width="64" height="10" rx="3" fill="url(#silverBar)" stroke="#c0c8d8" strokeWidth="1" />
    <polygon points="20,40 35,55 50,25 65,55 80,40 75,38 50,22 25,38" fill="white" opacity="0.15" />
    <circle cx="50" cy="27" r="4.5" fill="url(#silverGem)" />
    <circle cx="20" cy="42" r="3.5" fill="url(#silverGem2)" />
    <circle cx="80" cy="42" r="3.5" fill="url(#silverGem2)" />
    <path d="M50,20 L51,24 L55,25 L51,26 L50,30 L49,26 L45,25 L49,24 Z" fill="white" opacity="0.8" />
    <defs>
      <radialGradient id="silverBg" cx="40%" cy="35%">
        <stop offset="0%" stopColor="#4a5060" />
        <stop offset="100%" stopColor="#252830" />
      </radialGradient>
      <linearGradient id="silverRing" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
        <stop offset="50%" stopColor="#c0c8d8" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0.8" />
      </linearGradient>
      <linearGradient id="silverCrown" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#e0e8f0" />
        <stop offset="50%" stopColor="#b0b8c8" />
        <stop offset="100%" stopColor="#808898" />
      </linearGradient>
      <linearGradient id="silverBar" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#808898" />
        <stop offset="50%" stopColor="#d0d8e8" />
        <stop offset="100%" stopColor="#808898" />
      </linearGradient>
      <radialGradient id="silverGem" cx="35%" cy="35%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="60%" stopColor="#c0c8d8" />
        <stop offset="100%" stopColor="#8090a8" />
      </radialGradient>
      <radialGradient id="silverGem2" cx="35%" cy="35%">
        <stop offset="0%" stopColor="#e0e8f0" />
        <stop offset="100%" stopColor="#7080a0" />
      </radialGradient>
    </defs>
  </svg>
);

export default SilverIcon;