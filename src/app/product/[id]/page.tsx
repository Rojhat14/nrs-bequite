'use client';

import React, { useState, useEffect } from 'react';
import { PRODUCTS } from '@/data/products';
import ProductDetail from '@/components/ProductDetail';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface ProductPageProps {
  params: {
    id: string;
  };
}

export default function ProductPage({ params }: ProductPageProps) {
  const { id } = params;
  const product = PRODUCTS.find(p => p.id === id);
  const router = useRouter();

  if (!product) {
    return (
      <div className="min-h-screen bg-[#F7F3EE] flex items-center justify-center">
        <h1 className="text-3xl font-serif text-center">Product not found</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F3EE] text-[#050505]">
      <ProductDetail
        product={product}
        onBack={() => router.back()}
      />
    </div>
  );
}
