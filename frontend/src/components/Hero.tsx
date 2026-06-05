import { HERO_ASCII_ART } from '../constants/ascii';
import './Hero.css';

export default function Hero() {
  return (
    <section className="hero-section">
      <div className="hero-content">
        <pre className="ascii-art">{HERO_ASCII_ART}</pre>
        <h1 className="hero-title">VALERIE.</h1>
        <p className="hero-subtitle">
          Automated LLM Red-Teaming pipeline. Secure, self-hosted, domain-specific adversarial evaluations.
        </p>

        <a href="https://github.com/imshreyaskn/valerie" target="_blank" rel="noreferrer" className="github-button">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3-.3 6-1.5 6-6.5a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 5 3 6.2 6 6.5a4.8 4.8 0 0 0-1 3.2v4"></path><path d="M9 18c-4.5 1.6-5-2.5-7-3"></path></svg>
          <span>GET IT ON GITHUB</span>
        </a>
      </div>
    </section>
  );
}
