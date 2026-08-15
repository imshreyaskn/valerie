import Nav from '../components/Nav';
import Hero from '../components/Hero';
import TerminalSimulator from '../components/TerminalSimulator';
import Architecture from '../components/Architecture';
import Specifications from '../components/Specifications';
import Footer from '../components/Footer';

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
