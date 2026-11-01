export interface OperatorProfile {
  id: string;
  name: string;
  role: string;
  accent: string;
  image: string;
}

export interface ProfileOption {
  id: string;
  name: string;
  blurb: string;
}

export const OPERATORS: OperatorProfile[] = [
  { id: 'sol-vega', name: 'Sol Vega', role: 'Piloto de misión', accent: '#ff6573', image: '/art/profiles/sol-vega.webp' },
  { id: 'mara-ilyin', name: 'Mara Ilyin', role: 'Ingeniera de sistemas', accent: '#7566f5', image: '/art/profiles/mara-ilyin.webp' },
  { id: 'idris-okafor', name: 'Idris Okafor', role: 'Mecánico de campo', accent: '#ffad35', image: '/art/profiles/idris-okafor.webp' },
  { id: 'noa-herrera', name: 'Noa Herrera', role: 'Auditora de HELIOS', accent: '#e151a5', image: '/art/profiles/noa-herrera.webp' },
  { id: 'taro-sato', name: 'Taro Sato', role: 'Explorador de señales', accent: '#9bdc3c', image: '/art/profiles/taro-sato.webp' },
  { id: 'amara-keita', name: 'Amara Keita', role: 'Botánica planetaria', accent: '#53cc8c', image: '/art/profiles/amara-keita.webp' },
];

export const FRAMES: ProfileOption[] = [
  { id: 'ada', name: 'Enlace ADA', blurb: 'Cyan de auditoría' },
  { id: 'ares', name: 'ARES-IX', blurb: 'Coral de misión' },
  { id: 'helios', name: 'HELIOS', blurb: 'Ámbar orbital' },
  { id: 'relic', name: 'Reliquia', blurb: 'Violeta profundo' },
];

export const TITLES: ProfileOption[] = [
  { id: 'signal', name: 'Portador de la señal', blurb: 'Perfil predeterminado' },
  { id: 'survivor', name: 'Superviviente del Delta', blurb: 'Completa una expedición' },
  { id: 'archivist', name: 'Custodio del archivo', blurb: 'Recupera reliquias' },
  { id: 'gardener', name: 'Jardinero del mañana', blurb: 'Mantén viva la esperanza' },
];

export const BACKDROPS: ProfileOption[] = [
  { id: 'moon', name: 'Luna violeta', blurb: 'Sector Delta' },
  { id: 'rust', name: 'Horizonte oxidado', blurb: 'Meta, bajo el velo' },
  { id: 'signal', name: 'Señal profunda', blurb: 'Canal de ADA' },
  { id: 'garden', name: 'Brote orbital', blurb: 'Final jardinero' },
];

export const DEFAULT_PROFILE = {
  profileId: 'sol-vega',
  profileName: 'Sol Vega',
  profileFrame: 'ada',
  profileTitle: 'signal',
  profileBackdrop: 'moon',
} as const;

export function getOperator(id?: string): OperatorProfile {
  return OPERATORS.find((operator) => operator.id === id) ?? OPERATORS[0];
}

export function getProfileTitle(id?: string): ProfileOption {
  return TITLES.find((title) => title.id === id) ?? TITLES[0];
}
