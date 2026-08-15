import { HERO_ASCII_ART } from '../constants/ascii';

export default function Hero() {
  return (
    <section className="flex flex-col items-center justify-center pt-24 pb-8 px-4 w-full">
      <div className="flex flex-col items-center text-center max-w-full">
        {/* The ASCII Art - Block layout, top position, same as older design */}
        <pre 
          className="font-mono font-black text-slate whitespace-pre mb-8 overflow-hidden select-none max-w-[100vw] text-[0.4rem] md:text-[0.4rem] max-md:text-[0.2rem]"
          style={{ WebkitTextStroke: '0.5px var(--color-slate)', lineHeight: '1.1' }}
          aria-hidden="true"
        >
          {HERO_ASCII_ART}
        </pre>
        
        <h1 className="text-display uppercase mb-4 text-slate">
          VALERIE.
        </h1>
        
        <p className="text-steel text-sm max-w-[400px] leading-relaxed mb-8 px-4">
          Automated LLM adversarial testing pipeline. Secure BYOK architecture for rigorous domain focused evaluations.
        </p>

        <a 
          href="https://github.com/imshreyaskn/valerie" 
          target="_blank" 
          rel="noreferrer" 
          className="flex items-center justify-center gap-2 px-6 py-3 border border-hairline bg-cream text-slate font-mono text-xs font-bold uppercase transition-colors hover:bg-slate hover:text-parchment mt-4"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3-.3 6-1.5 6-6.5a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 5 3 6.2 6 6.5a4.8 4.8 0 0 0-1 3.2v4"></path><path d="M9 18c-4.5 1.6-5-2.5-7-3"></path></svg>
          <span>GET IT ON GITHUB</span>
        </a>
      </div>
    </section>
  );
}
