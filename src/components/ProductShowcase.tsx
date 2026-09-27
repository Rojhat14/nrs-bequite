'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { PRODUCTS } from '@/data/products';

interface ProductShowcaseProps {
  introFinished?: boolean;
}

const ProductShowcase = ({ introFinished }: ProductShowcaseProps) => {
  // Duplicate products to create a seamless infinite loop
  const duplicatedProducts = [...PRODUCTS, ...PRODUCTS, ...PRODUCTS];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: introFinished ? 1 : 0 }}
      transition={{ duration: 2, ease: "easeInOut" }}
      className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
    >
      {/* Gradient Mask for Elegant Fade at Edges */}
      <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-r from-nrs-ivory via-transparent to-nrs-ivory opacity-70" />

      <div className="relative h-full w-full flex items-center">
        <motion.div
          className="flex gap-8 px-4"
          animate={{
            x: [0, -2000],
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
              <div
                className="w-full h-full bg-contain bg-no-repeat bg-center transition-all duration-500"
                style={{ backgroundImage: `url(${product.image})` }}
              />
            </div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
};

export default ProductShowcase;
