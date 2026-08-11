const problemPoints = [
  'Every new session starts from zero — the AI re-reads files, re-learns your architecture, re-discovers your rules.',
  'Context rebuild burns 10-20 minutes of tokens per session, multiplied by every session per day.',
  'Rules and decisions drift: what was decided last sprint is forgotten by the next.',
  'No single source of truth that the model actually reads before answering.',
]

const solutionPoints = [
  'One command generates a dynamic briefing from your repo: state, backlog, rules, risks, and next actions.',
  'The briefing is computed from live project files — not a stale manual doc.',
  'Models load the briefing at session start, so they act with full context from the first message.',
  'Session close captures what changed, pruning the buffer so the next briefing is focused.',
]

const resultStats = [
  { value: '60-80%', label: 'less tokens spent rebuilding context', icon: '▽' },
  { value: '10-20 min', label: 'saved per session', icon: '◷' },
  { value: '0', label: 'questions repeated across sessions', icon: '∅' },
  { value: '1', label: 'command to restore full context', icon: '→' },
]

type Line = { text: string; type: 'prompt' | 'thinking' | 'answer' | 'system' | 'error' }

const demoLinesBefore: Line[] = [
  { text: 'user: what does this project do?', type: 'prompt' },
  { text: 'assistant: Let me explore the codebase...', type: 'thinking' },
  { text: 'user: what are the project rules?', type: 'prompt' },
  { text: 'assistant: Let me check the docs...', type: 'thinking' },
  { text: 'user: what is the current backlog?', type: 'prompt' },
  { text: 'assistant: Let me look for backlog files...', type: 'thinking' },
  { text: 'user: what did we decide last week?', type: 'prompt' },
  { text: 'assistant: I could not find a record of that.', type: 'error' },
]

const demoLinesAfter: Line[] = [
  { text: 'user: what is the state of the project?', type: 'prompt' },
  { text: 'briefing loaded: architecture, rules, backlog, risks, next steps', type: 'system' },
  { text: 'assistant: The project is a CLI (TypeScript). Architecture is layered. Backlog has 51 items, 0 P0 active. Next step: G1 landing page.', type: 'answer' },
]

function Terminal({
  title,
  lines,
  accent,
}: {
  title: string
  lines: Line[]
  accent: 'danger' | 'success'
}) {
  const palette: Record<string, string> = {
    prompt: 'text-text-primary',
    thinking: 'text-text-muted',
    answer: 'text-text-primary',
    system: accent === 'success' ? 'text-neon' : 'text-info',
    error: 'text-danger',
  }

  return (
    <div className="rounded-xl border border-border-default bg-surface-1 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
        <span className="w-3 h-3 rounded-full bg-danger/60" />
        <span className="w-3 h-3 rounded-full bg-warning/60" />
        <span className="w-3 h-3 rounded-full bg-success/60" />
        <span className="ml-3 font-mono text-xs text-text-muted">{title}</span>
      </div>
      <div className="p-4 font-mono text-sm space-y-2">
        {lines.map((line, i) => (
          <div key={i} className={palette[line.type]}>
            <span className="text-text-muted mr-2">{'>'}</span>
            {line.text}
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({ value, label, icon }: { value: string; label: string; icon: string }) {
  return (
    <div className="flex flex-col gap-1 items-center text-center px-6 py-8 rounded-xl border border-border-subtle bg-surface-1">
      <span className="text-2xl text-accent">{icon}</span>
      <span className="text-3xl font-bold text-text-primary">{value}</span>
      <span className="text-sm text-text-secondary">{label}</span>
    </div>
  )
}

function Section({ id, title, subtitle, children }: { id: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section id={id} className="px-6 py-20 max-w-6xl mx-auto">
      <div className="mb-10">
        <h2 className="text-3xl font-bold text-text-primary">{title}</h2>
        <p className="mt-2 text-text-secondary">{subtitle}</p>
      </div>
      {children}
    </section>
  )
}

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-surface-0/90 backdrop-blur border-b border-border-subtle">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-accent-subtle flex items-center justify-center font-bold text-accent">S</span>
            <span className="font-bold text-text-primary">Shitenno</span>
          </div>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-text-secondary">
            <a href="#problem" className="hover:text-text-primary">Problem</a>
            <a href="#solution" className="hover:text-text-primary">Solution</a>
            <a href="#result" className="hover:text-text-primary">Result</a>
          </nav>
          <a href="#waitlist" className="px-4 py-2 rounded-lg bg-accent text-surface-0 font-semibold text-sm hover:bg-accent-hover">
            Get early access
          </a>
        </div>
      </header>

      <section className="px-6 pt-24 pb-16 text-center">
        <p className="text-accent font-mono text-sm mb-4">shugo briefing — session context, restored</p>
        <h1 className="text-5xl md:text-6xl font-bold text-text-primary max-w-3xl mx-auto leading-tight">
          Never start a session <span className="text-accent">from zero</span> again
        </h1>
        <p className="mt-6 text-lg text-text-secondary max-w-2xl mx-auto">
          Shitenno generates a live briefing from your project before every session — state, rules, backlog, risks and next steps.
          Your AI works with full context from the first message.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <a href="#waitlist" className="px-8 py-3 rounded-lg bg-accent text-surface-0 font-semibold hover:bg-accent-hover">
            Join the waitlist
          </a>
          <a href="#solution" className="px-8 py-3 rounded-lg border border-border-default text-text-primary font-semibold hover:border-accent hover:text-accent">
            See how it works
          </a>
        </div>
      </section>

      <Section id="problem" title="The problem" subtitle="Every session without context is paid twice: once in tokens, once in quality.">
        <ul className="grid md:grid-cols-2 gap-4">
          {problemPoints.map((point) => (
            <li key={point} className="flex gap-3 items-start rounded-lg border border-border-subtle bg-surface-1 p-4 text-text-secondary">
              <span className="text-danger mt-1">✕</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
        <div className="mt-8 max-w-3xl mx-auto">
          <Terminal title="session without briefing" lines={demoLinesBefore} accent="danger" />
        </div>
      </Section>

      <Section id="solution" title="The solution" subtitle="A dynamic briefing, computed from your live project files — never stale, never manual.">
        <ul className="grid md:grid-cols-2 gap-4">
          {solutionPoints.map((point) => (
            <li key={point} className="flex gap-3 items-start rounded-lg border border-border-subtle bg-surface-1 p-4 text-text-secondary">
              <span className="text-success mt-1">✓</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
        <div className="mt-8 max-w-3xl mx-auto">
          <Terminal title="session with shugo briefing" lines={demoLinesAfter} accent="success" />
        </div>
      </Section>

      <Section id="result" title="The result" subtitle="Measured on real repositories.">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {resultStats.map((stat) => (
            <Stat key={stat.value} {...stat} />
          ))}
        </div>
      </Section>

      <section id="waitlist" className="px-6 py-20 border-t border-border-subtle">
        <div className="max-w-2xl mx-auto text-center rounded-2xl border border-border-default bg-surface-1 p-10">
          <h2 className="text-3xl font-bold text-text-primary">Get early access</h2>
          <p className="mt-3 text-text-secondary">
            Join the waitlist to be first in line when Shitenno opens to the public.
          </p>
          <form className="mt-8 flex flex-col sm:flex-row gap-3 justify-center" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              required
              placeholder="you@company.com"
              className="flex-1 px-4 py-3 rounded-lg bg-surface-0 border border-border-default text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
            <button type="submit" className="px-6 py-3 rounded-lg bg-accent text-surface-0 font-semibold hover:bg-accent-hover">
              Join waitlist
            </button>
          </form>
        </div>
      </section>

      <footer className="border-t border-border-subtle py-8 text-center text-sm text-text-muted">
        Shitenno — briefing-driven development · MIT license
      </footer>
    </div>
  )
}
