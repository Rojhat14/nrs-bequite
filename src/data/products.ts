export type Category = 'Dresses' | 'Tops' | 'Bottoms' | 'Bedding' | 'Accessories';

export type Product = {
  id: string;
  name: string;
  category: Category;
  description: string;
  image: string;
  hoverImage?: string;
  price: string;
  inStock: boolean;
  details: {
    fabric: string;
    care: string;
  };
};

export const PRODUCTS: Product[] = [
  {
    id: 'mavi-ceket-01',
    name: 'Azure Luminous Blazer',
    category: 'Tops',
    description: 'A sophisticated azure blue tailoring that combines modern cuts with timeless luxury. A centerpiece of the NRS Luminous collection.',
    image: '/images/products/tops/mavi-ceket.png',
    hoverImage: '/images/products/tops/mavi-ceket-2.png',
    price: '₺8,200',
    inStock: true,
    details: { fabric: 'Premium Wool Blend', care: 'Professional dry clean' },
  },
  {
    id: 'kirmizi-saten-01',
    name: 'Crimson Luminous Satin',
    category: 'Tops',
    description: 'Liquid crimson satin that reflects light with a luminous, high-fashion glow. A bold statement of femininity and power.',
    image: '/images/products/tops/kirmizi-saten.png',
    hoverImage: '/images/products/tops/kirmizi-saten.png',
    price: '₺5,400',
    inStock: true,
    details: { fabric: 'Pure Mulberry Silk Satin', care: 'Hand wash cold' },
  },
  {
    id: 'bordo-ceket-01',
    name: 'Bordeaux Structured Blazer',
    category: 'Tops',
    description: 'A bold statement of power and elegance. Deep bordeaux hue with precision tailoring and a luminous finish.',
    image: '/images/products/tops/bordo-ceket.png',
    hoverImage: '/images/products/tops/bordo-ceket.png',
    price: '₺8,500',
    inStock: true,
    details: { fabric: 'Premium Wool Blend', care: 'Professional dry clean' },
  },
  {
    id: 'bordo-detail-01',
    name: 'Bordeaux Detail Piece',
    category: 'Tops',
    description: 'Focusing on the intricate details of the bordeaux collection, where luxury meets art.',
    image: '/images/products/tops/ceket-kare.png',
    hoverImage: '/images/products/tops/ceket-kare.png',
    price: '₺7,900',
    inStock: true,
    details: { fabric: 'Premium Wool', care: 'Professional dry clean' },
  },
];
