import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer-metadata">
      <div>
        designed & engineered by<br/>
        shreyas k n
      </div>
      <div>
        <a href="https://linkedin.com/in/imshreyaskn" target="_blank" rel="noreferrer" className="footer-link">linkedin</a><br/>
        <a href="https://github.com/imshreyaskn" target="_blank" rel="noreferrer" className="footer-link">github</a><br/>
        <a href="mailto:imshreyaskn@gmail.com" className="footer-link">imshreyaskn@gmail.com</a>
      </div>
      <div>
        updated on<br/>
        06/05/2026
      </div>
      <div className="oversized-footer-version">
        v.0.1.2
      </div>
    </footer>
  );
}
