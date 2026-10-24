// Checklist progress reflects the tasks saved in this browser.
export default function Overview({ tasks, toggleTask }) {
  const completed = ['range', 'practice', 'note'].filter(key => tasks[key] === true).length;
  return (
<section id="overview" className="page">
          <div className="page-title">
            <div>
              <p className="eyebrow">THE STUDY DESK</p>
              <h1>Welcome to the table<span>.</span></h1>
              <p>Pick one part of your game to work on today.</p>
            </div>
            <a href="#arena" className="button primary">Start practising <span>↗</span></a>
          </div>
          <div className="overview-top">
            <section className="hero-card">
              <div className="hero-copy">
                <span className="pill">01 / STARTING HANDS</span>
                <h2>Before you play,<br /><em>know your range.</em></h2>
                <p>Compare opening ranges by position, then take what you learn to the table.</p>
                <a href="#ranges" className="button light">Explore starting hands <span>→</span></a>
                <div className="hero-footnote">
                  <span className="mini-avatars">♠ ♥ ♣</span>
                  All 169 starting-hand categories.
                </div>
              </div>
              <div className="hero-art" aria-hidden="true">
                <div className="orbit orbit-one">
                </div>
                <div className="orbit orbit-two">
                </div>
                <div className="playing-card hero-card-one">
                  <span>A<small>♠</small></span>
                  <b>♠</b>
                  <span>A<small>♠</small></span>
                </div>
                <div className="playing-card hero-card-two">
                  <span>K<small>♠</small></span>
                  <b>♠</b>
                  <span>K<small>♠</small></span>
                </div>
                <div className="chip chip-one">
                  100
                </div>
                <div className="chip chip-two">
                  25
                </div>
                <span className="art-spark">✦</span>
              </div>
            </section>
            <section className="panel session-card">
              <div className="panel-title"><h2>Today’s study plan</h2><span className="tag">YOUR CHECKLIST</span></div>
              <div className="study-completion"><strong>{completed}<span>/ 3</span></strong><p>small steps completed</p></div>
              <div className="progress-track"><span style={{ width: `${completed / 3 * 100}%` }} /></div>
              <ol className="study-plan-list">{[['range', 'Compare two opening ranges'], ['practice', 'Play three decisions'], ['note', 'Save one takeaway']].map(([key, label]) => <li key={key} className={tasks[key] === true ? 'done' : ''}><span>{tasks[key] === true ? '✓' : '—'}</span>{label}</li>)}</ol>
              <a href="#notebook" className="text-link">Keep your notes together <span>↗</span></a>
            </section>
          </div>
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR TOOLS</p>
              <h2>What would you like to work on?</h2>
            </div>
            <span className="muted">Choose your focus</span>
          </div>
          <div className="focus-grid">
            <a href="#ranges" className="focus-card"><span className="focus-icon mint">▦</span><span className="card-index">01 / EXPLORE</span><h3>Know your range</h3><p>Get familiar with all 169 starting hands in an interactive matrix.</p><span className="text-link">Open range explorer <b>↗</b></span></a>
            <a href="#arena" className="focus-card"><span className="focus-icon lavender">◎</span><span className="card-index">02 / PRACTISE</span><h3>Make the decision</h3><p>Take a seat at the table. Pick your action and learn the reasoning.</p><span className="text-link">Enter AI Arena <b>↗</b></span></a>
            <a href="#notebook" className="focus-card"><span className="focus-icon peach">♧</span><span className="card-index">03 / REVIEW</span><h3>Keep a useful note</h3><p>Save the decisions you want to revisit and questions for your next session.</p><span className="text-link">Open study notebook <b>↗</b></span></a>
          </div>
          <div className="bottom-grid">
            <section className="panel">
              <div className="panel-title">
                <h2>Your study checklist</h2>
                <span className="tag">TODAY’S FOCUS</span>
              </div>
              <label className="check-row"><input type="checkbox" data-task="range" checked={tasks.range === true} onChange={event => toggleTask("range", event.target.checked)} /><span><strong>Explore a starting-hand range</strong><small>Compare early and late position</small></span><span className="task-duration">3 min</span></label>
              <label className="check-row"><input type="checkbox" data-task="practice" checked={tasks.practice === true} onChange={event => toggleTask("practice", event.target.checked)} /><span><strong>Complete three practice decisions</strong><small>Slow down and explain your reasoning</small></span><span className="task-duration">5 min</span></label>
              <label className="check-row"><input type="checkbox" data-task="note" checked={tasks.note === true} onChange={event => toggleTask("note", event.target.checked)} /><span><strong>Write down one takeaway</strong><small>Give your next session a clear focus</small></span><span className="task-duration">2 min</span></label>
            </section>
            <section className="quote-card">
              <span className="eyebrow">A NOTE FOR YOUR NEXT SESSION</span>
              <span className="quote-mark">“</span>
              <h3>Judge the decision.<br />Not just the result.</h3>
              <p>A good play can lose a pot. Focus on the information you had when you acted.</p>
              <span className="quote-footer">Keep this in mind when reviewing a hand.</span>
            </section>
          </div>
        </section>
  );
}
