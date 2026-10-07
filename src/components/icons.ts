const defaults = import.meta.glob<string>('../../assets/png/default/ui/{controls,hud}/icon_*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});
const retina = import.meta.glob<string>('../../assets/png/retina/ui/{controls,hud}/icon_*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

export type IconName =
  | 'close'
  | 'fire_front'
  | 'fire_left'
  | 'fire_right'
  | 'forward'
  | 'heart'
  | 'home'
  | 'minus'
  | 'pause'
  | 'play'
  | 'plus'
  | 'restart'
  | 'score'
  | 'settings'
  | 'time'
  | 'turn_left'
  | 'turn_right';

function byIconName(modules: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(modules).map(([path, url]) => [path.replace(/^.*icon_(.+)\.png$/, '$1'), url]));
}

const defaultUrls = byIconName(defaults);
const retinaUrls = byIconName(retina);

export function iconSources(name: IconName): { src: string; srcSet: string } {
  const src = defaultUrls.get(name) ?? '';
  const src2x = retinaUrls.get(name) ?? src;
  return { src, srcSet: `${src} 1x, ${src2x} 2x` };
}
