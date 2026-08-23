import Nav from '../components/marketing/Nav';
import Hero from '../components/marketing/Hero';
import TerminalSimulator from '../components/marketing/TerminalSimulator';
import Architecture from '../components/marketing/Architecture';
import Specifications from '../components/marketing/Specifications';
import Footer from '../components/marketing/Footer';

export default function Landing() {
  return (
    <div className="w-full max-w-7xl mx-auto px-6 md:px-12 lg:px-16 flex flex-col min-h-screen relative">
      <Nav />
      <Hero />
      <TerminalSimulator />
      <Architecture />
      <Specifications />
      <Footer />
    </div>
  );
}
