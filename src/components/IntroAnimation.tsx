'use client';

import React, { useState, useEffect } from 'react';
import { m as motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';

interface IntroAnimationProps {
  onComplete: () => void;
}

export default function IntroAnimation({ onComplete }: IntroAnimationProps) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const reducedMotion = useReducedMotion();

  // Refined Sparkles: Jewelry-like, muted gold, minimal
  const sparkles = React.useMemo(() =>
    Array.from({ length: 10 }).map((_, i) => ({
      id: i,
      x: (i * 73 % 251) - 125,
      y: (i * 97 % 251) - 125,
      size: 1 + (i % 3) * 0.5,
      duration: 0.6 + (i % 4) * 0.15,
      delay: 0.5 + (i % 7) * 0.1,
    })), []
  );

  useEffect(() => {
    const ghostLogo = Array.from(document.querySelectorAll('[data-intro-target="logo"]')).find(logo => logo.getClientRects().length > 0);
    if (ghostLogo) {
      setTargetRect(ghostLogo.getBoundingClientRect());
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 3700);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (reducedMotion) {
    return (
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ delay: 0.8, duration: 0.4 }}
        className="fixed inset-0 z-[200] bg-nrs-canvas flex items-center justify-center pointer-events-none"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Image
            src="/Logo/Gemini_Generated_Image_fy30oqfy30oqfy30.png"
            alt="NRS Logo"
            width={300}
            height={120}
            priority
            className="h-auto w-[min(300px,80vw)] object-contain"
          />
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ delay: 3.4, duration: 0.4 }}
      className="fixed inset-0 z-[200] bg-nrs-canvas flex items-center justify-center pointer-events-none overflow-hidden"
    >
      {/* Jewelry Sparkles */}
      <div className="absolute inset-0 flex items-center justify-center">
        {sparkles.map((s) => (
          <motion.div
            key={s.id}
            className="absolute bg-nrs-champagne rounded-full blur-[0.5px]"
            style={{
              width: s.size,
              height: s.size,
              left: '50%',
              top: '50%',
            }}
            initial={{ opacity: 0, scale: 0, x: s.x, y: s.y }}
            animate={{
              opacity: [0, 0.5, 0],
              scale: [0, 1, 0],
            }}
            transition={{
              duration: s.duration,
              delay: s.delay,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>

      <div className="relative flex flex-col items-center justify-center">
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
            scale: [0.96, 1, 1, targetRect ? targetRect.width / Math.min(300, window.innerWidth * 0.8) : 1],
            x: [0, 0, 0, targetRect ? targetRect.left + targetRect.width / 2 - (window.innerWidth / 2) : 0],
            y: [0, 0, 0, targetRect ? targetRect.top + targetRect.height / 2 - (window.innerHeight / 2) : 0],
          }}
          transition={{
            opacity: { times: [0, 0.2, 0.5, 1], duration: 3.4 },
            scale: { times: [0, 0.2, 0.5, 1], duration: 3.4 },
            x: { times: [0, 0.5, 0.5, 1], duration: 3.4, ease: [0.45, 0, 0.55, 1] },
            y: { times: [0, 0.5, 0.5, 1], duration: 3.4, ease: [0.45, 0, 0.55, 1] },
          }}
          onAnimationComplete={() => {
            const ghostLogo = document.querySelector<HTMLElement>('[data-intro-target="logo"]');
            if (ghostLogo) {
              ghostLogo.style.opacity = '1';
            }
          }}
          className="relative z-10"
        >
          <Image
            src="/Logo/Gemini_Generated_Image_fy30oqfy30oqfy30.png"
            alt="NRS Logo"
            width={300}
            height={120}
            priority
            className="h-auto w-[min(300px,80vw)] object-contain"
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
