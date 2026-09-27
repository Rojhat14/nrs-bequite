'use client';

import React from 'react';
import { motion } from 'framer-motion';

const CategoryMood = () => {
  const moods = [
    { name: 'Day Edit', image: 'https://images.unsplash.com/photo-1434389677669-7486e12638ce?q=80&w=2070&auto=format&fit=crop' },
    { name: 'Evening', image: 'https://images.unsplash.com/photo-1539008835757-a65767669e6b?q=80&w=2070&auto=format&fit=crop' },
    { name: 'Occasion', image: 'https://images.unsplash.com/photo-1566174053895-827e65767724?q=80&w=2070&auto=format&fit=crop' },
    { name: 'Signature', image: 'https://images.unsplash.com/photo-1485231183945-fffde7e1ca17?q=80&w=2070&auto=format&fit=crop' },
  ];

  return (
    <section className="py-32 bg-nrs-ivory">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20 space-y-4">
          <h2 className="text-4xl md:text-6xl font-serif text-nrs-black">Shop by Mood</h2>
          <div className="h-px w-20 bg-nrs-rosegold mx-auto"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {moods.map((mood, index) => (
            <motion.div
              key={mood.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="relative group cursor-pointer overflow-hidden aspect-[3/4]"
            >
              <img
                src={mood.image}
                alt={mood.name}
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-nrs-black/20 group-hover:bg-transparent transition-all duration-500"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <h3 className="text-white text-2xl font-serif tracking-widest transition-transform duration-500 group-hover:scale-110">
                  {mood.name}
                </h3>
              </div>
              <div className="absolute bottom-0 left-0 w-full h-1 bg-nrs-rosegold translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CategoryMood;
