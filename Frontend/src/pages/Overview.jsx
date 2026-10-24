// The overview shares live session results with the practice room.
export default function Overview({ session, tasks, toggleTask }) {
  const accuracy = session.attempts ? `${Math.round(session.correct / session.attempts * 100)}%` : '—';
  return (
<section id="overview" className="page">
          <div className="page-title">
            <div>
              <p className="eyebrow">A LITTLE BETTER, EVERY SESSION</p>
              <h1>Welcome to the table<span>.</span></h1>
              <p>Your next good decision starts here.</p>
            </div>
            <a href="#arena" className="button primary">Start practising <span>↗</span></a>
          </div>
          <div className="overview-top">
            <section className="hero-card">
              <div className="hero-copy">
                <span className="pill">THE DAILY WARM-UP</span>
                <h2>Good poker starts<br />before the flop.</h2>
                <p>Find your range. Trust your reasoning.<br />Build better habits, one hand at a time.</p>
                <a href="#ranges" className="button light">Explore starting hands <span>→</span></a>
                <div className="hero-footnote">
                  <span className="mini-avatars">♠ ♥ ♣</span>
                  169 starting hands. A world of decisions.
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
              <div className="panel-title">
                <h2>Your practice session</h2>
                <span className="subtle-icon">↗</span>
              </div>
              <div className="session-score">
                <strong id="overview-accuracy">{accuracy}</strong>
                <span>decision accuracy</span>
              </div>
              <div className="progress-track">
                <span id="accuracy-progress" style={{ width: accuracy === "—" ? "0%" : accuracy }}></span>
              </div>
              <div className="session-metrics">
                <div>
                  <strong id="overview-attempts">{session.attempts}</strong>
                  <span>Hands practised</span>
                </div>
                <div>
                  <strong id="overview-streak">{session.streak}</strong>
                  <span>Current streak</span>
                </div>
              </div>
              <p className="caption">Your live practice results for this visit.</p>
            </section>
          </div>
          <div className="section-heading">
            <div>
              <p className="eyebrow">MAKE YOUR NEXT MOVE</p>
              <h2>A seat for every kind of study.</h2>
            </div>
            <span className="muted">Choose your focus</span>
          </div>
          <div className="focus-grid">
            <a href="#ranges" className="focus-card"><span className="focus-icon mint">▦</span><span className="card-index">01 / EXPLORE</span><h3>Know your range</h3><p>Get familiar with all 169 starting hands in an interactive matrix.</p><span className="text-link">Open range explorer <b>↗</b></span></a>
            <a href="#arena" className="focus-card"><span className="focus-icon lavender">◎</span><span className="card-index">02 / PRACTISE</span><h3>Make the decision</h3><p>Take a seat at the table. Pick your action and learn the reasoning.</p><span className="text-link">Enter AI Arena <b>↗</b></span></a>
            <a href="#hands" className="focus-card"><span className="focus-icon peach">♧</span><span className="card-index">03 / REVIEW</span><h3>See the whole hand</h3><p>Walk through a sample hand, from the first raise to the final fold.</p><span className="text-link">Browse hand library <b>↗</b></span></a>
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
              <span className="eyebrow">THE STUDY MINDSET</span>
              <span className="quote-mark">“</span>
              <h3>Judge the decision.<br />Not just the result.</h3>
              <p>A good play can lose a pot. Focus on the information you had when you acted.</p>
              <span className="quote-footer">PROCESS OVER OUTCOME <span>✦</span></span>
            </section>
          </div>
        </section>
  );
}
