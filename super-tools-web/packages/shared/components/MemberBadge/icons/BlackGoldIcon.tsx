// icons/BlackGoldIcon.tsx
import React from 'react';

interface IconProps {
  size: number;
}

const BlackGoldIcon: React.FC<IconProps> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="50" cy="50" r="48" fill="url(#bgBg)" stroke="url(#bgStroke)" strokeWidth="2" />
    <circle cx="50" cy="50" r="44" fill="none" stroke="url(#bgInnerRing)" strokeWidth="1" opacity="0.8" />
    <circle cx="50" cy="50" r="41" fill="none" stroke="#c8a000" strokeWidth="0.3" opacity="0.4" />
    <polygon
      points="16,67 16,36 33,54 50,20 67,54 84,36 84,67"
      fill="url(#bgCrown)"
      stroke="url(#bgCrownStroke)"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <polygon points="16,36 33,54 50,20 50,67 16,67" fill="url(#bgLeft)" opacity="0.3" />
    <polygon points="50,20 67,54 84,36 84,67 50,67" fill="url(#bgRight)" opacity="0.2" />
    <line x1="16" y1="67" x2="33" y2="54" stroke="#ffd700" strokeWidth="0.8" opacity="0.6" />
    <line x1="33" y1="54" x2="50" y2="20" stroke="#ffd700" strokeWidth="0.8" opacity="0.6" />
    <line x1="50" y1="20" x2="67" y2="54" stroke="#ffd700" strokeWidth="0.8" opacity="0.6" />
    <line x1="67" y1="54" x2="84" y2="36" stroke="#ffd700" strokeWidth="0.8" opacity="0.6" />
    <rect x="14" y="65" width="72" height="12" rx="4" fill="url(#bgBar)" stroke="url(#bgBarStroke)" strokeWidth="1" />
    <line x1="14" y1="69" x2="86" y2="69" stroke="#ffd700" strokeWidth="0.5" opacity="0.4" />
    <line x1="14" y1="73" x2="86" y2="73" stroke="#ffd700" strokeWidth="0.5" opacity="0.4" />
    <polygon points="50,15 56,21 56,28 50,34 44,28 44,21" fill="url(#bgMainGem)" stroke="#ffd700" strokeWidth="1" />
    <line x1="44" y1="21" x2="56" y2="28" stroke="#ffd700" strokeWidth="0.6" opacity="0.7" />
    <line x1="56" y1="21" x2="44" y2="28" stroke="#ffd700" strokeWidth="0.6" opacity="0.7" />
    <line x1="50" y1="15" x2="50" y2="34" stroke="#ffd700" strokeWidth="0.6" opacity="0.5" />
    <polygon points="50,15 53,18 50,21 47,18" fill="white" opacity="0.3" />
    <circle cx="16" cy="38" r="4.5" fill="url(#bgSideGem)" stroke="#ffd700" strokeWidth="0.8" />
    <circle cx="84" cy="38" r="4.5" fill="url(#bgSideGem)" stroke="#ffd700" strokeWidth="0.8" />
    <circle cx="14.5" cy="36.5" r="1.5" fill="white" opacity="0.4" />
    <circle cx="82.5" cy="36.5" r="1.5" fill="white" opacity="0.4" />
    <polygon points="33,56 36,59 33,62 30,59" fill="#ffd700" opacity="0.9" />
    <polygon points="67,56 70,59 67,62 64,59" fill="#ffd700" opacity="0.9" />
    <polygon points="50,67 53,70 50,73 47,70" fill="#ffd700" opacity="0.7" />
    <path d="M50,8 L51.8,14 L58,15 L51.8,16 L50,22 L48.2,16 L42,15 L48.2,14 Z" fill="#ffd700" opacity="0.95" />
    <path d="M84,28 L85.2,32 L89,33 L85.2,34 L84,38 L82.8,34 L79,33 L82.8,32 Z" fill="#ffd700" opacity="0.8" />
    <path d="M16,28 L17.2,32 L21,33 L17.2,34 L16,38 L14.8,34 L11,33 L14.8,32 Z" fill="#ffd700" opacity="0.8" />
    <circle cx="50" cy="8" r="1.5" fill="white" opacity="0.8" />
    <circle cx="84" cy="28" r="1" fill="white" opacity="0.6" />
    <circle cx="16" cy="28" r="1" fill="white" opacity="0.6" />
    <defs>
      <radialGradient id="bgBg" cx="40%" cy="35%">
        <stop offset="0%" stopColor="#1a1500" />
        <stop offset="50%" stopColor="#0a0800" />
        <stop offset="100%" stopColor="#000000" />
      </radialGradient>
      <linearGradient id="bgStroke" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ffd700" />
        <stop offset="30%" stopColor="#c8a000" />
        <stop offset="60%" stopColor="#ffd700" />
        <stop offset="100%" stopColor="#a07800" />
      </linearGradient>
      <linearGradient id="bgInnerRing" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ffd700" stopOpacity="0.8" />
        <stop offset="25%" stopColor="#c8a000" stopOpacity="0.3" />
        <stop offset="50%" stopColor="#ffd700" stopOpacity="0.8" />
        <stop offset="75%" stopColor="#c8a000" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#ffd700" stopOpacity="0.8" />
      </linearGradient>
      <linearGradient id="bgCrown" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#3a2800" />
        <stop offset="30%" stopColor="#1a1200" />
        <stop offset="70%" stopColor="#0a0800" />
        <stop offset="100%" stopColor="#000000" />
      </linearGradient>
      <linearGradient id="bgCrownStroke" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ffd700" />
        <stop offset="100%" stopColor="#c8a000" />
      </linearGradient>
      <linearGradient id="bgLeft" x1="100%" y1="0%" x2="0%" y2="0%">
        <stop offset="0%" stopColor="#ffd700" />
        <stop offset="100%" stopColor="transparent" />
      </linearGradient>
      <linearGradient id="bgRight" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#ffd700" />
        <stop offset="100%" stopColor="transparent" />
      </linearGradient>
      <linearGradient id="bgBar" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#0a0800" />
        <stop offset="20%" stopColor="#2a1e00" />
        <stop offset="50%" stopColor="#3a2800" />
        <stop offset="80%" stopColor="#2a1e00" />
        <stop offset="100%" stopColor="#0a0800" />
      </linearGradient>
      <linearGradient id="bgBarStroke" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#c8a000" />
        <stop offset="50%" stopColor="#ffd700" />
        <stop offset="100%" stopColor="#c8a000" />
      </linearGradient>
      <radialGradient id="bgMainGem" cx="40%" cy="35%">
        <stop offset="0%" stopColor="#3a2800" />
        <stop offset="40%" stopColor="#1a1200" />
        <stop offset="100%" stopColor="#000000" />
      </radialGradient>
      <radialGradient id="bgSideGem" cx="35%" cy="35%">
        <stop offset="0%" stopColor="#2a2000" />
        <stop offset="60%" stopColor="#0a0800" />
        <stop offset="100%" stopColor="#000000" />
      </radialGradient>
    </defs>
  </svg>
);

export default BlackGoldIcon;