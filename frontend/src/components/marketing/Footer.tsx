export default function Footer() {
  return (
    <footer className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4 px-4 pt-8 pb-16 font-mono text-[0.7rem] text-steel items-end mt-auto">
      <div>
        designed &amp; engineered by<br/>
        shreyas k n
      </div>
      <div className="flex flex-col gap-1">
        <a href="https://linkedin.com/in/imshreyaskn" target="_blank" rel="noreferrer" className="text-inherit no-underline hover:underline hover:text-slate">linkedin</a>
        <a href="https://github.com/imshreyaskn" target="_blank" rel="noreferrer" className="text-inherit no-underline hover:underline hover:text-slate">github</a>
        <a href="mailto:imshreyaskn@gmail.com" className="text-inherit no-underline hover:underline hover:text-slate">imshreyaskn@gmail.com</a>
      </div>
      <div>
        updated on<br/>
        06/05/2026
      </div>
      <div className="font-sans text-[2.5rem] md:text-[3rem] font-bold text-slate leading-[0.8] tracking-[-0.05em] text-left md:text-right select-none">
        v.0.1.2
      </div>
    </footer>
  );
}
