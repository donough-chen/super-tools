declare module '*.css';
declare module '*.less';
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.svg' {
  export function ReactComponent(
    props: React.SVGProps<SVGSVGElement>,
  ): React.ReactElement;
  const url: string;
  export default url;
}
declare module '*.mp4';
declare module '*.webm';
declare module '*.ogg';
declare module '*.mp3';
declare module '*.wav';
declare module 'autoprefixer';
declare module 'postcss-pxtorem';
