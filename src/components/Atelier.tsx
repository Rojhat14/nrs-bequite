'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface FadeInUpProps {
  children: React.ReactNode;
  delay?: number;
}

interface SectionSpacingProps {
  children: React.ReactNode;
}

interface HeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
}

const FadeInUp = ({ children, delay = 0 }: FadeInUpProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 1, delay, ease: [0.22, 1, 0.32, 1] }}
  >
    {children}
  </motion.div>
);

const SectionSpacing = ({ children }: SectionSpacingProps) => (
  <div className="py-24 md:py-48">
    {children}
  </div>
);



const Header = ({ title, subtitle, description }: HeaderProps) => (
  <div className="max-w-4xl mx-auto text-center mb-24">
    <h2 className="text-5xl md:text-8xl font-serif text-nrs-charcoal mb-8 leading-tight">
      {title}
    </h2>
    {subtitle && <p className="text-nrs-charcoal/60 text-lg md:text-xl italic max-w-2xl mx-auto">{subtitle}</p>}
    {description && <p className="mt-4 text-nrs-charcoal/80 max-w-3xl mx-auto">{description}</p>}
  </div>
);

const AtelierContent = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-24 gap-y-20 max-w-6xl mx-auto">
    <div className="space-y-12">
      <FadeInUp>
        <p className="text-nrs-charcoal/80 text-lg md:text-xl leading-relaxed">
          NRS is not merely a label; it is a study of intention. We believe that objects, when crafted with devotion, possess a unique frequency—a resonance that alters the atmosphere of a space.
        </p>
      </FadeInUp>
      <FadeInUp delay={0.2}>
        <p className="text-nrs-charcoal/80 text-lg md:text-xl leading-relaxed">
          In our studio, the process is the destination. We work with raw textures, exploring how light interacts with surfaces. Each piece is a conversation between heritage and innovation, a search for the &apos;Luminous&apos; in the mundane.
        </p>
      </FadeInUp>
      <div className="pt-8">
        <span className="text-xs uppercase tracking-widest text-nrs-charcoal/40">Foundations</span>
        <p className="mt-2 text-nrs-charcoal/60 max-w-sm">
          We select materials that tell stories. From ethically sourced minerals to organic textures, every choice is deliberate.
        </p>
      </div>
    </div>
    <div className="space-y-12">
      <div className="relative aspect-[3/4] bg-nrs-charcoal/5 rounded-sm overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]"></div>
        <div className="flex items-center justify-center h-full">
          <span className="text-nrs-charcoal/20 font-serif text-sm">Visual Reference Only</span>
        </div>
      </div>
      <div className="space-y-4">
        <span className="text-xs uppercase tracking-widest text-nrs-charcoal/40">The Process</span>
        <p className="text-nrs-charcoal/60 text-sm italic">
          &ldquo;To create is to remember. We strive to capture the ephemeral beauty of light—the way it catches on a curve, the way it softens a shadow. Our work is an invitation to pause.&rdquo;
        </p>
      </div>
    </div>
  </div>
);

const AtelierPage = () => (
  <section className="bg-nrs-offwhite">
    <div className="container mx-auto px-4">
      <SectionSpacing>
        <Header
          title="A Study of Light and Matter"
          subtitle="Boutique Luminous"
        />
        <div className="max-w-6xl mx-auto">
          <AtelierContent />
          <div className="pt-32 pb-20 border-t border-nrs-charcoal/10 text-center">
            <h3 className="text-2xl font-serif text-nrs-charcoal mb-4">NRS Boutique Luminous</h3>
            <p className="text-nrs-charcoal/60 max-w-md mx-auto">
              A curated studio for those who find beauty in the quietest details.
            </p>
          </div>
        </div>
      </SectionSpacing>
    </div>
  </section>
);

export default AtelierPage;
