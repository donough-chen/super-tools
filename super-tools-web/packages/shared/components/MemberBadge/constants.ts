// constants.ts
import { MemberLevel } from './types';

export interface LevelDefaultConfig {
  name: string;
  levelText: string;
  animationClass: string;
}

export const LEVEL_DEFAULT_CONFIG: Record<MemberLevel, LevelDefaultConfig> = {
  normal: {
    name: '普通会员',
    levelText: 'MEMBER',
    animationClass: '',
  },
  silver: {
    name: '银牌会员',
    levelText: 'SILVER',
    animationClass: '',
  },
  gold: {
    name: '金牌会员',
    levelText: 'GOLD',
    animationClass: 'glow-gold',
  },
  diamond: {
    name: '钻石会员',
    levelText: 'DIAMOND',
    animationClass: 'glow-diamond',
  },
  blackgold: {
    name: '黑金会员',
    levelText: 'BLACK GOLD',
    animationClass: 'glow-blackgold',
  },
};

export const ALL_LEVELS: MemberLevel[] = [
  'normal',
  'silver',
  'gold',
  'diamond',
  'blackgold',
];