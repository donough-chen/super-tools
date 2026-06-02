// types.ts
export type MemberLevel = 'normal' | 'silver' | 'gold' | 'diamond' | 'blackgold';

export type BadgeDirection = 'horizontal' | 'vertical';

export interface MemberConfig {
  /** 会员等级 */
  level: MemberLevel;
  /** 自定义名称（覆盖默认名称） */
  customName?: string;
  /** 自定义等级文案（覆盖默认文案） */
  customLevel?: string;
}

export interface MemberBadgeProps {
  /** 会员等级 */
  level: MemberLevel;
  /** 图标尺寸（px） */
  size?: number;
  /** 是否显示名称文字 */
  showName?: boolean;
  /** 是否显示等级文案 */
  showLevel?: boolean;
  /** 自定义名称 */
  customName?: string;
  /** 自定义等级文案 */
  customLevel?: string;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 点击回调 */
  onClick?: (level: MemberLevel) => void;
}

export interface MemberBadgeGroupProps {
  /** 要展示的等级列表，不传则展示全部 */
  levels?: MemberLevel[];
  /** 排列方向 */
  direction?: BadgeDirection;
  /** 图标尺寸（px） */
  size?: number;
  /** 间距（px） */
  gap?: number;
  /** 是否显示名称文字 */
  showName?: boolean;
  /** 是否显示等级文案 */
  showLevel?: boolean;
  /** 自定义各等级文案配置 */
  levelConfigs?: Partial<Record<MemberLevel, Pick<MemberBadgeProps, 'customName' | 'customLevel'>>>;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 点击回调 */
  onClick?: (level: MemberLevel) => void;
}