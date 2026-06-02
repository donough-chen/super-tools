// icons/DiamondIcon.tsx
import React from 'react';

interface IconProps {
  size: number;
}

const DiamondIcon: React.FC<IconProps> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="50" cy="50" r="48" fill="url(#diamondBg)" stroke="#60a0ff" strokeWidth="2" />
    <circle
      cx="50" cy="50" r="44"
      fill="none"
      stroke="url(#diamondRing)"
      strokeWidth="1.5"
      strokeDasharray="8,4"
      opacity="0.7"
    />
    <polygon
      points="18,66 18,38 34,54 50,22 66,54 82,38 82,66"
      fill="url(#diamondCrown)"
      stroke="#80c0ff"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <polygon points="34,54 50,22 50,66 18,66 18,38" fill="url(#diamondLeft)" opacity="0.4" />
    <polygon points="50,22 66,54 82,66 50,66" fill="url(#diamondRight)" opacity="0.3" />
    <polygon points="18,38 34,54 50,22 66,54 82,38 76,34 50,18 24,34" fill="white" opacity="0.25" />
    <rect x="16" y="64" width="68" height="11" rx="4" fill="url(#diamondBar)" stroke="#80c0ff" strokeWidth="1" />
    <polygon points="50,17 55,22 55,28 50,33 45,28 45,22" fill="url(#mainGem)" stroke="#a0d0ff" strokeWidth="0.8" />
    <line x1="45" y1="22" x2="55" y2="28" stroke="white" strokeWidth="0.5" opacity="0.6" />
    <line x1="55" y1="22" x2="45" y2="28" stroke="white" strokeWidth="0.5" opacity="0.6" />
    <line x1="50" y1="17" x2="50" y2="33" stroke="white" strokeWidth="0.5" opacity="0.4" />
    <polygon points="18,37 22,40 22,44 18,47 14,44 14,40" fill="url(#sideGem)" stroke="#80c0ff" strokeWidth="0.8" />
    <polygon points="82,37 86,40 86,44 82,47 78,44 78,40" fill="url(#sideGem)" stroke="#80c0ff" strokeWidth="0.8" />
    <path d="M50,10 L51.5,15 L56,16 L51.5,17 L50,22 L48.5,17 L44,16 L48.5,15 Z" fill="white" opacity="0.95" />
    <path d="M82,30 L83,33 L86,34 L83,35 L82,38 L81,35 L78,34 L81,33 Z" fill="#80c0ff" opacity="0.9" />
    <path d="M18,30 L19,33 L22,34 L19,35 L18,38 L17,35 L14,34 L17,33 Z" fill="#80c0ff" opacity="0.9" />
    <defs>
      <radialGradient id="diamondBg" cx="40%" cy="35%">
        <stop offset="0%" stopColor="#1a3060" />
        <stop offset="60%" stopColor="#0a1830" />
        <stop offset="100%" stopColor="#050e20" />
      </radialGradient>
      <linearGradient id="diamondRing" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#80c0ff" />
        <stop offset="50%" stopColor="#a060ff" />
        <stop offset="100%" stopColor="#80c0ff" />
      </linearGradient>
      <linearGradient id="diamondCrown" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#c0e0ff" />
        <stop offset="30%" stopColor="#60a0ff" />
        <stop offset="60%" stopColor="#8060ff" />
        <stop offset="100%" stopColor="#2040a0" />
      </linearGradient>
      <linearGradient id="diamondLeft" x1="100%" y1="0%" x2="0%" y2="0%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="transparent" />
      </linearGradient>
      <linearGradient id="diamondRight" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="transparent" />
      </linearGradient>
      <linearGradient id="diamondBar" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#2040a0" />
        <stop offset="30%" stopColor="#60a0ff" />
        <stop offset="50%" stopColor="#a0d0ff" />
        <stop offset="70%" stopColor="#8060ff" />
        <stop offset="100%" stopColor="#2040a0" />
      </linearGradient>
      <radialGradient id="mainGem" cx="35%" cy="30%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="30%" stopColor="#c0e0ff" />
        <stop offset="70%" stopColor="#6090ff" />
        <stop offset="100%" stopColor="#2040c0" />
      </radialGradient>
      <radialGradient id="sideGem" cx="35%" cy="30%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="50%" stopColor="#80c0ff" />
        <stop offset="100%" stopColor="#3060c0" />
      </radialGradient>
    </defs>
  </svg>
);

export default DiamondIcon;