import type { Food, ModifierGroup } from '../types'

/** Modifier grup dipakai layar detail menu (PRD bab 02). */
const SPICE: ModifierGroup = {
  id: 'spice',
  name: 'TINGKAT PEDAS',
  type: 'single',
  options: [
    { id: 'mild', label: 'Tidak Pedas', extraPrice: 0 },
    { id: 'medium', label: 'Sedang', extraPrice: 0 },
    { id: 'hot', label: 'Pedas', extraPrice: 0 },
  ],
}

const ADDONS: ModifierGroup = {
  id: 'addons',
  name: 'TAMBAHAN',
  type: 'multi',
  options: [
    { id: 'lontong', label: 'Lontong', extraPrice: 8000 },
    { id: 'sambal', label: 'Sambal Extra', extraPrice: 5000 },
  ],
}


const TEMPERATURE: ModifierGroup = {
  id: 'temperature',
  name: 'PILIHAN',
  type: 'single',
  options: [
    { id: 'ice', label: 'Es', extraPrice: 0 },
    { id: 'hot', label: 'Panas', extraPrice: 0 },
  ],
}

const SUGAR: ModifierGroup = {
  id: 'sugar',
  name: 'GULA',
  type: 'single',
  options: [
    { id: 'normal', label: 'Normal', extraPrice: 0 },
    { id: 'less', label: 'Sedikit', extraPrice: 0 },
    { id: 'none', label: 'Tanpa Gula', extraPrice: 0 },
  ],
}

const PORTION: ModifierGroup = {
  id: 'portion',
  name: 'PORSI',
  type: 'single',
  options: [
    { id: 'one', label: '1 Bungkus', extraPrice: 0 },
    { id: 'two', label: '2 Bungkus', extraPrice: 8000 },
  ],
}

const MENU: Array<Omit<Food, 'modifierGroups'> & { modifierGroups?: ModifierGroup[] }> = [
  {
    id: '1',
    name: 'Sate Ayam',
    price: 28000,
    rating: 4.7,
    reviewCount: 92,
    deliveryTime: '15-30 menit',
    distance: '420 m',
    discountPercent: 10,
    category: 'makanan',
    image: '/assets/img/menu/sate-ayam.webp',
    description:
      'Sate ayam kampung dibakar arang, disajikan dengan bumbu kacang dan lontong. Dibuat segar per porsi.',
    isPopular: true,
    modifierGroups: [SPICE, ADDONS],
  },
  {
    id: '2',
    name: 'Sate Kambing',
    price: 32000,
    rating: 4.6,
    reviewCount: 58,
    deliveryTime: '20-35 menit',
    distance: '420 m',
    category: 'makanan',
    image: '/assets/img/menu/sate-kambing.webp',
    description: 'Sate kambing muda tanpa prengus, dibakar dengan arang dan bumbu kecap.',
    modifierGroups: [SPICE, ADDONS],
  },
  {
    id: '3',
    name: 'Nasi Goreng',
    price: 25000,
    rating: 4.5,
    reviewCount: 74,
    deliveryTime: '15-30 menit',
    distance: '420 m',
    discountPercent: 15,
    category: 'makanan',
    image: '/assets/img/menu/nasi-goreng.webp',
    description: 'Nasi goreng kampung dengan telur, ayam, dan kerupuk. Level pedas bisa dipilih.',
    isPopular: true,
    modifierGroups: [SPICE],
  },
  {
    id: '4',
    name: 'Lontong',
    price: 8000,
    rating: 4.4,
    reviewCount: 31,
    deliveryTime: '10-20 menit',
    distance: '420 m',
    category: 'makanan',
    image: '/assets/img/menu/lontong.webp',
    description: 'Lontong daun pisang, pendamping sate.',
    discountPercent: 20,
    modifierGroups: [PORTION],
  },
  {
    id: '5',
    name: 'Es Teh Manis',
    price: 6000,
    rating: 4.8,
    reviewCount: 120,
    deliveryTime: '10-20 menit',
    distance: '420 m',
    category: 'minuman',
    image: '/assets/img/menu/es-teh-manis.webp',
    description: 'Teh tubruk manis dengan es batu, disajikan dingin.',
    discountPercent: 5,
    modifierGroups: [TEMPERATURE, SUGAR],
  },
]

export const foods: Food[] = MENU

/**
 * Estimasi waktu masak per menu (menit). Pakai `cookMinutes` bila ada (nilai
 * dari DB), jika tidak diturunkan dari nama hidangan. Dipakai UI customer
 * (kartu menu & profil toko) — satu tempat, bukan disalin ke tiap layar.
 */
export function cookMinutesFor(food: Pick<Food, 'name' | 'cookMinutes'>): number {
  if (typeof food.cookMinutes === 'number') return food.cookMinutes
  const name = food.name.toLowerCase()
  if (name.includes('nasi goreng')) return 15
  if (name.includes('sate')) return 20
  if (name.includes('lontong')) return 10
  if (name.includes('es ') || name.includes('teh') || name.includes('kopi') || name.includes('jus')) return 3
  return 15
}

/** Ringkasan pilihan modifier, mis. "Sedang, Lontong". */
export function modifierSummary(groups: ModifierGroup[] | undefined, chosen: string[]): string {
  if (!groups || chosen.length === 0) return ''
  const labels = groups
    .flatMap((g) => g.options)
    .filter((o) => chosen.includes(o.id))
    .map((o) => o.label)
  return labels.join(', ')
}

export function modifierExtra(groups: ModifierGroup[] | undefined, chosen: string[]): number {
  if (!groups) return 0
  return groups
    .flatMap((g) => g.options)
    .filter((o) => chosen.includes(o.id))
    .reduce((sum, o) => sum + o.extraPrice, 0)
}
