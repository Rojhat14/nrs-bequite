export type Category = 'Elbiseler' | 'Üst Giyim' | 'Alt Giyim' | 'Bedding' | 'Aksesuar';

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
    name: 'Mavi Işıltılı Blazer',
    category: 'Üst Giyim',
    description: 'Modern terziliğin zarif bir yorumu olan Mavi Işıltılı Blazer, yapılandırılmış silueti ve ışığı yakalayan dokusuyla dikkat çeker. Günlük şıklığın bir parçası olarak kullanılabileceği gibi, özel akşam görünümlerine de sofistike bir dokunuş kazandırır. Zamansız kesimi sayesinde sezonun ötesine geçen bir gardırop parçası olarak tasarlanmıştır.',
    image: '/images/products/tops/mavi-ceket.png',
    hoverImage: '/images/products/tops/mavi-ceket-2.png',
    price: '₺8,200',
    inStock: true,
    details: { fabric: 'Premium Yün Karışımı', care: 'Kuru Temizleme' },
  },
  {
    id: 'kirmizi-saten-01',
    name: 'Kızıl Saten Siluet',
    category: 'Üst Giyim',
    description: 'Işığı yüksek moda bir parıltıyla yansıtan, akışkan ve güçlü bir kadınsılık ifadesi. Modern zarafetin en cesur hali olan Kızıl Saten Siluet, her detayında lüksü hissettirir.',
    image: '/images/products/tops/kirmizi-saten.png',
    hoverImage: '/images/products/tops/kirmizi-saten.png',
    price: '₺5,400',
    inStock: true,
    details: { fabric: 'Saf Mulberry İpek Saten', care: 'Soğuk Elde Yıkama' },
  },
  {
    id: 'bordo-ceket-01',
    name: 'Bordo Yapılandırılmış Blazer',
    category: 'Üst Giyim',
    description: 'Güç ve zarafetin iddialı bir dışa vurumu. Derin bordo tonu, hassas terzilik detayları ve ışıltılı bitişiyle modern kadının gardırobunda zamansız bir imza parça.',
    image: '/images/products/tops/bordo-ceket.png',
    hoverImage: '/images/products/tops/bordo-ceket.png',
    price: '₺8,500',
    inStock: true,
    details: { fabric: 'Premium Yün Karışımı', care: 'Kuru Temizleme' },
  },
  {
    id: 'bordo-detail-01',
    name: 'Bordo Detay Parça',
    category: 'Üst Giyim',
    description: 'Lüksün sanatla buluştuğu noktada, bordo koleksiyonun karmaşık detaylarına odaklanan özel bir tasarım. Rafine çizgileriyle modern bir duruş sergiler.',
    image: '/images/products/tops/ceket-kare.png',
    hoverImage: '/images/products/tops/ceket-kare.png',
    price: '₺7,900',
    inStock: true,
    details: { fabric: 'Premium Yün', care: 'Kuru Temizleme' },
  },
];
