// icons/NormalIcon.tsx
import React from 'react';

interface IconProps {
  size: number;
}

const NormalIcon: React.FC<IconProps> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="50" cy="50" r="48" fill="url(#normalBg)" stroke="#5a5a7a" strokeWidth="1.5" />
    <polygon
      points="20,65 20,40 35,55 50,25 65,55 80,40 80,65"
      fill="url(#normalCrown)"
      stroke="#7a7a9a"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <rect x="18" y="63" width="64" height="10" rx="3" fill="url(#normalBar)" stroke="#7a7a9a" strokeWidth="1" />
    <circle cx="50" cy="27" r="4" fill="#9090b0" />
    <circle cx="20" cy="42" r="3" fill="#8080a0" />
    <circle cx="80" cy="42" r="3" fill="#8080a0" />
    <circle cx="35" cy="57" r="2" fill="#aaaacc" />
    <circle cx="65" cy="57" r="2" fill="#aaaacc" />
    <defs>
      <radialGradient id="normalBg" cx="40%" cy="35%">
        <stop offset="0%" stopColor="#2e2e45" />
        <stop offset="100%" stopColor="#16162a" />
      </radialGradient>
      <linearGradient id="normalCrown" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#8888aa" />
        <stop offset="100%" stopColor="#555570" />
      </linearGradient>
      <linearGradient id="normalBar" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#555570" />
        <stop offset="50%" stopColor="#7777aa" />
        <stop offset="100%" stopColor="#555570" />
      </linearGradient>
    </defs>
  </svg>
);

export default NormalIcon;