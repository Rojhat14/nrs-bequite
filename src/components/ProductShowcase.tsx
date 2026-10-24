'use client';

import React, { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { HomepageShowcaseProduct } from '@/lib/products';
import Image from 'next/image';
import { canOptimizeImage } from '@/lib/imageOptimization';
import { getShowcaseItemCount, SHOWCASE_TRAVEL } from '@/lib/showcase';

interface ProductShowcaseProps {
  products: HomepageShowcaseProduct[];
}

const ProductShowcase = ({ products }: ProductShowcaseProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(() => getShowcaseItemCount(3840));
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () => setVisibleCount(getShowcaseItemCount(element.clientWidth));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  // Match the existing repeated sequence; omit only tiles beyond the travel range.
  const duplicatedProducts = Array.from(
    { length: Math.min(products.length * 3, visibleCount) },
    (_, index) => products[index % products.length],
  );

  return (
    <div
      ref={containerRef}
      className="nrs-fade-in absolute inset-0 z-0 overflow-hidden pointer-events-none"
    >
      {/* Gradient Mask for Elegant Fade at Edges */}
      <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-r from-nrs-canvas via-transparent to-nrs-canvas opacity-70" />

      <div className="relative h-full w-full flex items-center">
        {/* CSS marquee runs on the compositor, so it stays smooth while the
            page hydrates and does not wait for JavaScript to start. */}
        <div
          className="nrs-marquee flex gap-8 px-4"
          style={{ '--nrs-marquee-travel': `${SHOWCASE_TRAVEL}px` } as CSSProperties}
        >
          {duplicatedProducts.map((product, index) => (
            <div
              key={`${product.id}-${index}`}
              className="relative flex-shrink-0 w-[250px] h-[400px] opacity-30 transition-opacity duration-500"
            >
              {product.image && <Image
                src={product.image}
                alt=""
                aria-hidden="true"
                width={250}
                height={400}
                sizes="250px"
                // The first tiles are the largest paint on the homepage.
                priority={index < 3}
                loading={index < 3 ? undefined : 'lazy'}
                unoptimized={!canOptimizeImage(product.image)}
                className="h-full w-full object-contain transition-all duration-500"
              />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProductShowcase;
