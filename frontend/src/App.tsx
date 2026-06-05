import Nav from './components/Nav';
import Hero from './components/Hero';
import TerminalSimulator from './components/TerminalSimulator';
import Architecture from './components/Architecture';
import Specifications from './components/Specifications';
import Footer from './components/Footer';
import './App.css';

function App() {
  return (
    <div className="app-container">
      <Nav />
      <Hero />
      <TerminalSimulator />
      <Architecture />
      <Specifications />
      <Footer />
    </div>
  );
}

export default App;
