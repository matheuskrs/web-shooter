import { iconSources, type IconName } from './icons';

/** Official icon art. Decorative by default: the surrounding control carries the accessible name. */
export function Icon({ name, size = 24, className }: { name: IconName; size?: number; className?: string }) {
  return <img {...iconSources(name)} alt="" width={size} height={size} className={className} draggable={false} />;
}
