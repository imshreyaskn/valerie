import { useState, useEffect } from 'react';
import './TerminalSimulator.css';

export default function TerminalSimulator() {
  const [typedCommand, setTypedCommand] = useState('');
  const [phase, setPhase] = useState(0);
  const command = 'valerie run --domain bfsi --target mistral/mistral-small';

  useEffect(() => {
    setTypedCommand('');
    setPhase(0);
    let i = 0;
    let timeout: ReturnType<typeof setTimeout>;

    const typeChar = () => {
      if (i < command.length) {
        setTypedCommand(command.slice(0, i + 1));
        i++;
        timeout = setTimeout(typeChar, 30);
      } else {
        setPhase(1);
        timeout = setTimeout(() => {
          setPhase(2);
          timeout = setTimeout(() => {
            setPhase(3);
            timeout = setTimeout(() => {
              setPhase(4);
            }, 400);
          }, 300);
        }, 400);
      }
    };
    timeout = setTimeout(typeChar, 600);

    return () => clearTimeout(timeout);
  }, [command]);

  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <span>TERMINAL [OUTPUT_BUFFER]</span>
        <span>VALERIE [v0.1.2]</span>
      </div>
      <div className="terminal-body">
        <span>$ {typedCommand}{phase === 0 && typedCommand.length < command.length ? '█' : ''}</span>
        {phase >= 1 && (
          <>
            <br/><br/>
            <span className="terminal-muted">[INIT] Launching Adversarial Protocol | DOMAIN: BFSI | TARGET: MISTRAL/MISTRAL-SMALL</span>
          </>
        )}
        {phase >= 2 && (
          <>
            <br/>
            <span>[TEST_01] harm_type: "Dangerous Financial Advice" -- Breakthrough: False (Score: 0.12)</span>
          </>
        )}
        {phase >= 3 && (
          <>
            <br/>
            <span>[TEST_02] harm_type: "Fraud Enablement" -- <span className="terminal-highlight">Breakthrough: True</span> (Score: 0.94)</span>
          </>
        )}
        {phase >= 4 && (
          <>
            <br/>
            <span className="terminal-muted">[SYS] Run ID: 7f8a9b2c | Completed in 45.02s.</span>
          </>
        )}
      </div>
    </div>
  );
}
