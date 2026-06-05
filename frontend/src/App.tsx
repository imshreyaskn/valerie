import { useState, useEffect } from 'react'
import { Shield, Key, Workflow, FileJson } from 'lucide-react'
import './App.css'

function App() {
  const [typedCommand, setTypedCommand] = useState('')
  const [phase, setPhase] = useState(0)
  const command = 'valerie run --domain bfsi --target mistral/mistral-small'
  
  useEffect(() => {
    setTypedCommand('')
    setPhase(0)
    let i = 0
    let timeout: ReturnType<typeof setTimeout>

    const typeChar = () => {
      if (i < command.length) {
        setTypedCommand(command.slice(0, i + 1))
        i++
        timeout = setTimeout(typeChar, 30)
      } else {
        setPhase(1)
        timeout = setTimeout(() => {
          setPhase(2)
          timeout = setTimeout(() => {
            setPhase(3)
            timeout = setTimeout(() => {
              setPhase(4)
            }, 400)
          }, 300)
        }, 400)
      }
    }
    timeout = setTimeout(typeChar, 600)

    return () => clearTimeout(timeout)
  }, [command])

  return (
    <div className="app-container" style={{ position: 'relative' }}>
      <div style={{ position: 'sticky', top: '1rem', zIndex: 100, width: '100%', height: 0 }}>
        <nav style={{ position: 'absolute', top: '3rem', right: '3rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-steel)', letterSpacing: '0.05em' }}>v0.1.0</span>
          <a href="https://github.com/imshreyaskn/valerie" target="_blank" rel="noreferrer" style={{ 
            color: 'var(--color-slate)', 
            backgroundColor: 'transparent', 
            border: '1px solid var(--color-slate)',
            padding: '0.4rem',
            display: 'flex', 
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
          }} 
          onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-slate)'; e.currentTarget.style.color = 'var(--bg-color)' }} 
          onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--color-slate)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
          </a>
        </nav>
      </div>
      <main className="hero-section">
        <div className="hero-content">


          <pre className="ascii-art">
{`              ...                                                                                                        ...              
                -.                                                                                                      .-.               
                ..--. ..                                                                                          ....+...                
                 ...+##---..                                                                                 . .-.-##+.-                  
                 ..--##-- ..-.--+.-.                                                                  ...++-.-...+-##-..                  
                   ....- --.---.-. ..-...                                                         .-.....-.+....-......                   
                     . .+--..  .-... ..  ...                                                   .-.    ...- . ....-...                     
                      ..- .       .....   ..                                                ...    ....       ...+.-                      
                      ..-...        -.   . ...                                              .....  ..-        ..--- .                     
                       . -...  .     ... ....-.                                            -..... ..     .    ..-.                        
                      .  ..-.          . .  ...-                                          -... ....          .-.. .                       
                      .. ..    .... ...   ..... ..  ..                                 ...  ...    ..  ....    ....                       
                      ..-.-..      ....     ...-.......                           ........- ..     ....       ...-.                       
                   .    .....     .....   . ...  ..- ..-.                       . ..-.- .  .. .. ..-.. .     .--...  .-.                  
                   ...   -.         ...-...   .........-...                    ...-.........  .. ....         .... ....                   
                     ..-- .-... .   .  ...... ..........--+.....          .....+-.....-.... ... ... ..   .   .. .--....                   
                      .....-----.. ...   ..     ... .....+---...          ...----...... ..     ..  ..-....--.--....                       
                          --++#-.    .... .....  ........-###+...        ..-###+-.....- .  .........    ..-#----.                         
                           ...-...   ....  . ............-++++#..        ..#+##+-........... ..    . .. ...-..                            
                           . .  --.. .      .... .-.....--...---.        .-------....- -......  .  .....+.   .                            
                        .......  ..--..        .........-.--.-+.-       .---..-.+.-.--... .....       --...........                        
                         -....      . ..  ..  ..  ....-........+.-      .+-...-..-.-.- .  .. .-  ..  .     .-. .-.                        
                     ... .. ...      ..  ......    .....---.--.+-.     .-+..-+.-.-- .     .- ...  ..        ...  . -.                     
                      ...  ..-..........-...---....    .......-...-    .--......-.. .  . ..--.-...... .. ...- . ...-                      
                      . .-+#+--.---....        ............+..-...+ ..--.+...--........ .     .     ....-...-+++-..                       
                        ..---#+--....  ...    ....... .-.....-..--.-..-..-.-+........  ....       ..... .--++---..                        
                        ....+##--..-.  ...     -..........-.---++-......--+---...... ......    .. . . ....-##+...                         
                           ........ .     ..  ....-.+-+##-+-+++-.--+. ------++-+++#+--.... .        ............                          
                               .  .  .... .....-    . .--++..-..-----+---..--.-++--... . .-.... . ...  .                                  
                                               .. .-..--...-.----.-+.++------.........-...                                                
                                               .-... -.....--.--+#++ .##+------..........-..                                              
                                            .........- ..+--.--+-++...#++#--....+.. --........                                            
                                         . .-.............-....----....#----..--.... ..-.....+..                                          
                                      ...#-..-.........-..-.---+-. ... .--+----+..-..  .....-..+#..                                       
                                     ..#-.-.......--.....-.--+##.... .....##+----.....-...  ..--.+-.                                      
                                    ..---.... .-.-.......-++##+....     ...##+++-...... -.......----.                                     
                                  ...-##+-....--... .....-++#--...      ...-+#++-.-.... ..--....-###-...                                  
                                    +..-......-....-..-.--##-....       .....-#--..-..-...-- ..-..-.--                                    
                                   ..       ......--...-.-.....            .....---....-.....   .    ...                                  
                                  -.        .-. -+.-.-.... ..                ....--.....--.....       ..                                  
                                  .        .....--.#.-+..                       . .+..#.-... ..                                           
                                            .. .-.+-+....                        ...+--.-- . ..                                           
                                              .--#--..                            ....-+#+..                                              
                                              .-.-.                                  . .....                                              
                                              .##-                                     .+#-                                               
                                               ....                                    ....                                               
                                              .. .                                      ....                                              
                                              ...                                        ....`}
          </pre>
          
          <h1 className="hero-title">VALERIE.</h1>
          <p className="hero-subtitle">
            Automated LLM Red-Teaming pipeline. Secure, self-hosted, domain-specific adversarial evaluations.
          </p>

          <a href="https://github.com/imshreyaskn/valerie" target="_blank" rel="noreferrer" className="github-button">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3-.3 6-1.5 6-6.5a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 5 3 6.2 6 6.5a4.8 4.8 0 0 0-1 3.2v4"></path><path d="M9 18c-4.5 1.6-5-2.5-7-3"></path></svg>
            <span>GET IT ON GITHUB</span>
          </a>

          <div className="terminal-container" style={{ marginTop: '4rem', maxWidth: '1100px', width: '100%', minHeight: '220px', textAlign: 'left', flex: 'none', padding: '1.5rem 2rem' }}>
            <div className="terminal-header">
              <span>TERMINAL [OUTPUT_BUFFER]</span>
              <span>VALERIE [v0.1.1]</span>
            </div>
            <div className="terminal-body">
              <span>$ {typedCommand}{phase === 0 && typedCommand.length < command.length ? '█' : ''}</span>
              {phase >= 1 && (
                <>
                  <br/><br/>
                  <span style={{ color: 'var(--color-steel)' }}>[INIT] Launching Red-Team Protocol | DOMAIN: BFSI | TARGET: MISTRAL/MISTRAL-SMALL</span>
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
                  <span>[TEST_02] harm_type: "Fraud Enablement" -- <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>Breakthrough: True</span> (Score: 0.94)</span>
                </>
              )}
              {phase >= 4 && (
                <>
                  <br/>
                  <span style={{ color: 'var(--color-steel)' }}>[SYS] Run ID: 7f8a9b2c | Completed in 45.02s.</span>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <section className="architecture-section">
        <div className="spec-header hairline-bottom">
          ARCHITECTURE
        </div>
        <div className="arch-canvas">
          <pre className="arch-ascii">
{`
               USER_CLI
                  |  [valerie run --domain bfsi --concurrency 10]
                  v
      +-----------------------------------------------------------------+
      |                    FASTAPI API SERVER (:8080)                   |
      |          :: Authenticates via PostgreSQL (bcrypt)               |
      |          :: Queues PipelineRun UUID                             |
      +-----------------------------------------------------------------+
                                       |
                          (Async Fire & Forget POST)
                                       v
      +-----------------------------------------------------------------+
      |                 FASTAPI WORKER / LANGGRAPH (:8081)              |
      |                                                                 |
      |   [load_prompts]  <--- loads resources/bfsi_prompts.csv         |
      |         |                                                       |
      |         v                                                       |
      |   [dispatch_attacks]                                            |
      |   :: Fan-out LangGraph Send() objects                           |
      |         |                                                       |
      |   +-----+-----+-----+ (Parallel Vector Generation)              |
      |   |           |     |                                           |
      |   v           v     v                                           |
      | [ATT_1]    [ATT_2] [ATT_N]  <.............................      |
      |   |           |     |                                    .      |
      |   |           |     | [concurrent payloads]              .      |
      |   v           v     v                                    .      |
      | [TGT_1]    [TGT_2] [TGT_N] (Parallel Target Evaluation)  .      |
      |   |           |     |                                    .      |
      |   |           |     | [raw outputs]                      .      |
      |   v           v     v                                    .      |
      | [JUDG_1]  [JUDG_2] [JUDG_N]                              .      |
      |   |           |     | (scores pii/bias/toxicity)         .      |
      |   +-----+-----+-----+                                    .      |
      |         |                                                .      |
      |         v                                                .      |
      |  _______|_______                                         .      |
      | |               |                                        .      |
      | |               |.........................................      |
      | v               | (re-calibrate evasive vectors)                |
      | [success]    [failed]                                           |
      |   |                                                             |
      |   v                                                             |
      | [aggregate_and_persist]                                         |
      | :: Fan-in operator.add reducer                                  |
      | :: Serializes EvaluationResults                                 |
      +-----------------------------------------------------------------+
             |                                  |
    (routes all LLM calls)               (writes final state)
             v                                  v
     [ LITELLM ROUTER ]                  [ POSTGRESQL DB ]
     :: AWS Bedrock                      :: SQLModel Async ORM
     :: Mistral AI API                   :: pipelinerun
     :: OpenAI / Vertex                  :: evaluationresult
             |
             |  (returns payload)
             v
         USER_CLI
    [CLI_TABLES / JSON]
`}
          </pre>
        </div>
        <div className="arch-details" style={{ padding: '2rem 3rem', color: 'var(--color-steel)', fontSize: '0.85rem', lineHeight: '1.6', maxWidth: '1100px', margin: '0 auto', textAlign: 'left' }}>
          <ul style={{ listStyleType: 'none', paddingLeft: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <li style={{ display: 'flex', alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--text-primary)', width: '2.5rem', flexShrink: 0, fontSize: '0.7rem', marginTop: '0.2rem' }}>1.01</span>
              <div><strong style={{ color: 'var(--text-primary)' }}>CLI INITIATION:</strong> The user triggers the pipeline via CLI, securely injecting domain constraints and local API keys.</div>
            </li>
            <li style={{ display: 'flex', alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--text-primary)', width: '2.5rem', flexShrink: 0, fontSize: '0.7rem', marginTop: '0.2rem' }}>1.02</span>
              <div><strong style={{ color: 'var(--text-primary)' }}>ASYNC QUEUEING:</strong> The FastAPI Server authenticates credentials against PostgreSQL and dispatches a fire-and-forget task to the isolated Worker.</div>
            </li>
            <li style={{ display: 'flex', alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--text-primary)', width: '2.5rem', flexShrink: 0, fontSize: '0.7rem', marginTop: '0.2rem' }}>1.03</span>
              <div><strong style={{ color: 'var(--text-primary)' }}>LANGGRAPH FAN-OUT:</strong> The Worker loads baseline datasets and dynamically spawns N parallel threads for high-concurrency adversarial generation.</div>
            </li>
            <li style={{ display: 'flex', alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--text-primary)', width: '2.5rem', flexShrink: 0, fontSize: '0.7rem', marginTop: '0.2rem' }}>1.04</span>
              <div><strong style={{ color: 'var(--text-primary)' }}>ADAPTIVE FEEDBACK:</strong> Failed attacks recursively re-calibrate prompt strategies up to a max iteration threshold until a safety breakthrough is forced.</div>
            </li>
            <li style={{ display: 'flex', alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--text-primary)', width: '2.5rem', flexShrink: 0, fontSize: '0.7rem', marginTop: '0.2rem' }}>1.05</span>
              <div><strong style={{ color: 'var(--text-primary)' }}>LLM ROUTING:</strong> All Attacker, Target, and Judge requests are piped through LiteLLM, abstracting vendor complexities and enforcing exponential backoff.</div>
            </li>
            <li style={{ display: 'flex', alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--text-primary)', width: '2.5rem', flexShrink: 0, fontSize: '0.7rem', marginTop: '0.2rem' }}>1.06</span>
              <div><strong style={{ color: 'var(--text-primary)' }}>FAN-IN AGGREGATION:</strong> Thread results are reduced into a unified vulnerability matrix, serialized to PostgreSQL, and pushed back to the CLI as actionable intelligence.</div>
            </li>
          </ul>
        </div>
      </section>

      <section className="spec-section hairline-bottom" style={{ margin: '2rem 0' }}>
        <div className="spec-header hairline-bottom">
          SPECIFICATIONS
        </div>
        
        <div className="spec-row hairline-bottom">
          <div className="spec-cell spec-id hairline-right">2.01</div>
          <div className="spec-cell spec-title hairline-right">BRING YOUR OWN KEY</div>
          <div className="spec-cell spec-desc hairline-right">Self-hosted architecture. Utilize proprietary OpenAI, Anthropic, or Mistral keys without third-party exposure.</div>
          <div className="spec-cell spec-icon"><Key size={24} strokeWidth={1} /></div>
        </div>

        <div className="spec-row hairline-bottom">
          <div className="spec-cell spec-id hairline-right">2.02</div>
          <div className="spec-cell spec-title hairline-right">DOMAIN PROBES</div>
          <div className="spec-cell spec-desc hairline-right">Pre-configured attack vectors targeting Banking, Healthcare, Legal, and HR compliance standards.</div>
          <div className="spec-cell spec-icon"><Shield size={24} strokeWidth={1} /></div>
        </div>

        <div className="spec-row hairline-bottom">
          <div className="spec-cell spec-id hairline-right">2.03</div>
          <div className="spec-cell spec-title hairline-right">AUTOMATED PIPELINE</div>
          <div className="spec-cell spec-desc hairline-right">Dual-LLM configuration: Attacker LLM generates dynamic probes; Independent Judge LLM evaluates risk.</div>
          <div className="spec-cell spec-icon"><Workflow size={24} strokeWidth={1} /></div>
        </div>

        <div className="spec-row">
          <div className="spec-cell spec-id hairline-right">2.04</div>
          <div className="spec-cell spec-title hairline-right">ACTIONABLE DATA</div>
          <div className="spec-cell spec-desc hairline-right">Exports complete structural breakdowns via CLI tables and JSON arrays for immediate integration.</div>
          <div className="spec-cell spec-icon"><FileJson size={24} strokeWidth={1} /></div>
        </div>
      </section>

      <footer className="footer-metadata">
        <div>
          designed & engineered by<br/>
          shreyas k n
        </div>
        <div>
          <a href="https://linkedin.com/in/imshreyaskn" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>linkedin</a><br/>
          <a href="https://github.com/imshreyaskn" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>github</a><br/>
          <a href="mailto:imshreyaskn@gmail.com" style={{ color: 'inherit', textDecoration: 'none' }}>imshreyaskn@gmail.com</a>
        </div>
        <div>
          updated on<br/>
          06/05/2026
        </div>
        <div style={{ textAlign: 'right', fontSize: '4rem', fontWeight: 200, color: 'var(--color-slate)', lineHeight: 0.8 }}>
          v0.1.1
        </div>
      </footer>
    </div>
  )
}

export default App
