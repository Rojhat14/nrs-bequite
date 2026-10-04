'use client';

import React, { useEffect, useRef, useState } from 'react';
import { m as motion } from 'framer-motion';
import type { Product } from '@/data/products';
import Image from 'next/image';
import { canOptimizeImage } from '@/lib/imageOptimization';
import { getShowcaseItemCount, SHOWCASE_TRAVEL } from '@/lib/showcase';

interface ProductShowcaseProps {
  introFinished?: boolean;
  products: Product[];
}

const ProductShowcase = ({ introFinished, products }: ProductShowcaseProps) => {
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
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: introFinished ? 1 : 0 }}
      transition={{ duration: 2, ease: "easeInOut" }}
      className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
    >
      {/* Gradient Mask for Elegant Fade at Edges */}
      <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-r from-nrs-canvas via-transparent to-nrs-canvas opacity-70" />

      <div className="relative h-full w-full flex items-center">
        <motion.div
          className="flex gap-8 px-4"
          animate={{
            x: [0, -SHOWCASE_TRAVEL],
          }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: "loop",
              duration: 40,
              ease: "linear"
            }
          }}
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
                loading="lazy"
                unoptimized={!canOptimizeImage(product.image)}
                className="h-full w-full object-contain transition-all duration-500"
              />}
            </div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
};

export default ProductShowcase;
