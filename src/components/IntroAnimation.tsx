'use client';

import React, { useState, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import Image from 'next/image';

interface IntroAnimationProps {
  onComplete: () => void;
}

export default function IntroAnimation({ onComplete }: IntroAnimationProps) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const reducedMotion = useReducedMotion();

  // Generate 10 particles with random relative offsets
  const particles = React.useMemo(() =>
    Array.from({ length: 10 }).map((_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 200,
      y: (Math.random() - 0.5) * 200,
      size: Math.random() * 3 + 2,
      duration: Math.random() * 0.5 + 0.3,
    })), []
  );

  useLayoutEffect(() => {
    // We look for the ghost logo in the Navigation component
    const ghostLogo = document.querySelector('[data-intro-target="logo"]');
    if (ghostLogo) {
      setTargetRect(ghostLogo.getBoundingClientRect());
    }
  }, []);

  useEffect(() => {
    // Total intro duration is ~2s
    const timer = setTimeout(() => {
      onComplete();
    }, 2100); // Slightly over 2s to ensure animations finish

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (reducedMotion) {
    return (
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ delay: 0.8, duration: 0.4 }}
        className="fixed inset-0 z-[200] bg-nrs-ivory flex items-center justify-center pointer-events-none"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Image
            src="/Logo/Gemini_Generated_Image_fy30oqfy30oqfy30.png"
            alt="NRS Logo"
            width={1680}
            height={672}
            priority
            className="h-72 md:h-96 w-auto object-contain"
          />
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ delay: 1.8, duration: 0.3 }}
      className="fixed inset-0 z-[200] bg-nrs-ivory flex items-center justify-center pointer-events-none overflow-hidden"
    >
      {/* Particle System */}
      <div className="absolute inset-0 flex items-center justify-center">
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute bg-nrs-champagne rounded-full blur-[1px]"
            style={{
              width: p.size,
              height: p.size,
              left: '50%',
              top: '50%',
            }}
            initial={{ opacity: 0, scale: 0, x: p.x, y: p.y }}
            animate={{
              opacity: [0, 0.6, 0],
              scale: [0, 1, 0],
              x: [p.x, p.x * 1.2],
              y: [p.y, p.y * 1.2],
            }}
            transition={{
              duration: p.duration,
              delay: 0.25,
              ease: "easeOut"
            }}
          />
        ))}
      </div>

      {/* Main Logo Journey */}
      <motion.div
        initial={{
          opacity: 0,
          scale: 0.96,
          x: 0,
          y: 0,
        }}
        animate={{
          opacity: [0, 1, 1, 1],
          scale: [0.96, 1, 1, targetRect ? targetRect.width / 1680 : 1],
          x: [0, 0, 0, targetRect ? targetRect.left + targetRect.width / 2 - (window.innerWidth / 2) : 0],
          y: [0, 0, 0, targetRect ? targetRect.top + targetRect.height / 2 - (window.innerHeight / 2) : 0],
        }}
        transition={{
          opacity: { times: [0, 0.3, 0.5, 1], duration: 1.75 },
          scale: { times: [0, 0.3, 0.5, 1], duration: 1.75 },
          x: { times: [0, 0.5, 0.5, 1], duration: 1.75, ease: "easeInOut" },
          y: { times: [0, 0.5, 0.5, 1], duration: 1.75, ease: "easeInOut" },
        }}
        className="relative z-10"
      >
        <div className="relative group overflow-hidden">
          <Image
            src="/Logo/Gemini_Generated_Image_fy30oqfy30oqfy30.png"
            alt="NRS Logo"
            width={1680}
            height={672}
            priority
            className="h-72 md:h-96 w-auto object-contain"
          />
          {/* Signature Shimmer */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ x: '-100%' }}
            animate={{ x: '200%' }}
            transition={{
              delay: 0.85,
              duration: 0.2,
              ease: "easeInOut"
            }}
            style={{
              width: '30%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
              transform: 'skewX(-20deg)',
            }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
