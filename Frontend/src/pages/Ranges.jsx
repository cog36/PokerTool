import { useMemo, useState } from 'react';
import { chartForStack } from '../preflopCharts';
import './Ranges.css';

const RANKS = 'AKQJT98765432';
const STACK_OPTIONS = [
  { value: 5, label: '5 bb' },
  { value: 10, label: '10 bb' },
  { value: 20, label: '20 bb' },
  { value: 40, label: '40 bb' },
  { value: 100, label: '100 bb' },
];
const MODES = [
  { value: 'rfi', label: 'RFI / Unopened' },
  { value: 'vsOpen', label: 'Facing Open' },
  { value: 'vs3bet', label: 'Facing 3-Bet / Shove' },
];
const POSITION_LABELS = {
  EP1: 'UTG',
  EP2: 'UTG+1',
  EP3: 'UTG+2',
  LJ: 'LJ',
  HJ: 'HJ',
  CO: 'CO',
  BTN: 'BTN',
  SB: 'SB',
  BB: 'BB',
};
const TABLE_POSITIONS = {
  6: ['LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  8: ['EP2', 'EP3', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  9: ['EP1', 'EP2', 'EP3', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
};
const ACTIONS = {
  open: { label: 'Open / Raise', color: '#e97575', className: 'open' },
  threeBet: { label: '3-bet', color: '#d4566e', className: 'three-bet' },
  fourBet: { label: '4-bet', color: '#ba4d73', className: 'four-bet' },
  limp: { label: 'Limp', color: '#d6934f', className: 'limp' },
  call: { label: 'Call', color: '#4fa77d', className: 'call' },
  fold: { label: 'Fold', color: '#527b9b', className: 'fold' },
};
const HANDS = RANKS.split('').flatMap((rowRank, row) => RANKS.split('').map((columnRank, column) => {
  if (row === column) return `${rowRank}${columnRank}`;
  const [high, low] = row < column ? [rowRank, columnRank] : [columnRank, rowRank];
  return `${high}${low}${row < column ? 's' : 'o'}`;
}));
const COMBINATIONS = hand => hand.length === 2 ? 6 : hand.endsWith('s') ? 4 : 12;
const positionLabel = (position, tableSize) => {
  if (tableSize === 6 && position === 'LJ') return 'UTG';
  if (tableSize === 8 && position === 'EP2') return 'UTG1';
  if (tableSize === 8 && position === 'EP3') return 'UTG2';
  return POSITION_LABELS[position];
};

function tableKeys(mode, hero, villain) {
  if (mode === 'rfi') {
    return [
      { id: 'open', label: 'Open / Raise', action: 'open', key: `Open${hero}` },
      { id: 'limp', label: 'Limp', action: 'limp', key: `Limp${hero}` },
    ];
  }
  if (!villain) return [];
  if (mode === 'vsOpen') {
    return [
      { id: 'call', label: 'Call', action: 'call', key: `Call${hero}vs${villain}` },
      { id: 'raise', label: '3-bet', action: 'threeBet', key: `3Bet${hero}vs${villain}` },
    ];
  }
  return [
    { id: 'call', label: 'Call', action: 'call', key: `Call 3Bet${hero}vs${villain}` },
    { id: 'raise', label: '4-bet', action: 'fourBet', key: `4Bet${hero}vs${villain}` },
  ];
}

function frequency(value) {
  if (typeof value === 'number') return { frequency: value, ev: null };
  if (!value || typeof value !== 'object') return { frequency: 0, ev: null };
  const amount = value.frequency ?? value.freq ?? value.action_frequency ?? value.strategy ?? 0;
  return {
    frequency: Number.isFinite(Number(amount)) ? Number(amount) : 0,
    ev: value.ev != null && Number.isFinite(Number(value.ev)) ? Number(value.ev) : null,
  };
}

function gradientFor(actions, frequencies) {
  const stops = [];
  let start = 0;
  actions.forEach(action => {
    const end = Math.min(100, start + frequencies[action.id] * 100);
    if (end > start) {
      stops.push(`${ACTIONS[action.action].color} ${start}% ${end}%`);
      start = end;
    }
  });
  if (start < 100) stops.push(`${ACTIONS.fold.color} ${start}% 100%`);
  return `conic-gradient(${stops.join(', ')})`;
}

function RangeMatrix({ cells, selectedHand, onSelect, chartSupported }) {
  return <div className={`preflop-matrix${chartSupported ? '' : ' unsupported'}`} role="group" aria-label="169 starting-hand chart">
    {cells.map(cell => (
      <button
        type="button"
        key={cell.hand}
        className={`preflop-cell${selectedHand === cell.hand ? ' selected' : ''}`}
        style={{ '--cell-strategy': cell.background }}
        aria-pressed={selectedHand === cell.hand}
        aria-label={cell.ariaLabel}
        title={cell.ariaLabel}
        onClick={() => onSelect(cell.hand)}
      >{cell.hand}</button>
    ))}
  </div>;
}

export default function Ranges() {
  const tableSize = 8;
  const [stackDepth, setStackDepth] = useState(20);
  const [heroSelection, setHeroPosition] = useState('EP2');
  const [villainPosition, setVillainPosition] = useState('EP1');
  const [actionType, setActionType] = useState('rfi');
  const [selectedCell, setSelectedCell] = useState('AKs');
  const { chart, chartDepth } = chartForStack(stackDepth);
  const positions = TABLE_POSITIONS[8];
  const heroOptions = positions.filter(position => actionType === 'vsOpen' ? position !== 'EP2' : position !== 'BB');
  const heroPosition = heroOptions.includes(heroSelection) ? heroSelection : heroOptions[0];

  const villainOptions = useMemo(() => {
    if (actionType === 'rfi') return [];
    const heroIndex = positions.indexOf(heroPosition);
    return positions.filter((position, index) => (
      position !== heroPosition
      && (actionType === 'vsOpen' ? index < heroIndex : index > heroIndex)
    ));
  }, [actionType, heroPosition, positions]);

  const selectedVillain = villainOptions.includes(villainPosition)
    ? villainPosition
    : villainOptions[0];
  const requestedTables = tableKeys(actionType, heroPosition, selectedVillain);
  const chartSupported = requestedTables.length > 0 && requestedTables.every(table => chart[table.key]);

  const { cells, totals, selectedDetails } = useMemo(() => {
    const tables = requestedTables.filter(table => chart[table.key]);
    const values = HANDS.map(hand => {
      const actions = tables.map(table => ({
        ...table,
        ...frequency(chart[table.key]?.[hand]),
      }));
      const usedFrequency = actions.reduce((sum, action) => sum + action.frequency, 0);
      const frequencies = Object.fromEntries(actions.map(action => [action.id, action.frequency]));
      frequencies.fold = chartSupported ? Math.max(0, 1 - usedFrequency) : 0;
      const details = chartSupported ? [
        ...actions.map(action => ({ id: action.id, label: action.label, action: action.action, frequency: action.frequency, ev: action.ev })),
        { id: 'fold', label: 'Fold', action: 'fold', frequency: frequencies.fold, ev: null },
      ] : [];
      const breakdown = details.map(item => `${item.label} ${Math.round(item.frequency * 100)}%`).join(', ');
      return {
        hand,
        details,
        frequencies,
        background: chartSupported ? gradientFor(actions, frequencies) : '#46515a',
        ariaLabel: chartSupported ? `${hand}: ${breakdown}` : `${hand}: no chart data for this matchup`,
      };
    });

    const totalsByAction = {};
    let allCombos = 0;
    values.forEach(cell => {
      const combinations = COMBINATIONS(cell.hand);
      allCombos += combinations;
      cell.details.forEach(action => {
        totalsByAction[action.id] = (totalsByAction[action.id] || 0) + action.frequency * combinations;
      });
    });
    const totalRows = values.map(cell => ({
      ...cell,
      details: cell.details.map(action => ({
        ...action,
        percentage: action.frequency * 100,
      })),
    }));
    const selected = totalRows.find(cell => cell.hand === selectedCell);
    return {
      cells: totalRows,
      totals: chartSupported
        ? Object.fromEntries(Object.entries(totalsByAction).map(([action, value]) => [action, value / allCombos * 100]))
        : {},
      selectedDetails: selected,
    };
  }, [chart, chartSupported, requestedTables, selectedCell]);

  return <section className="page" id="ranges">
    <div className="page-title">
      <div><p className="eyebrow">MTT PREFLOP REFERENCE</p><h1>Preflop Range Chart<span>.</span></h1><p>Eight-player chart frequencies by stack depth, position and preflop action.</p></div>
      <span className="pill outlined">169 starting hands · MTT</span>
    </div>

    <section className="panel range-controls" aria-label="Range chart controls">
      <div className="range-fixed-size"><span>Table size</span><strong>8 players</strong></div>
      <label>Stack depth
        <select value={stackDepth} onChange={event => setStackDepth(Number(event.target.value))}>
          {STACK_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <div className="range-mode-control" role="group" aria-label="Preflop scenario">
        <span>Scenario</span>
        <div className="range-mode-options">{MODES.map(mode => (
          <button key={mode.value} type="button" aria-pressed={actionType === mode.value} className={actionType === mode.value ? 'selected' : ''} onClick={() => setActionType(mode.value)}>{mode.label}</button>
        ))}</div>
      </div>
      {stackDepth !== chartDepth && <p className="range-chart-notice" role="status">No {stackDepth}bb chart; showing the closest available chart at <strong>{chartDepth}bb</strong>.</p>}
      {actionType === 'vs3bet' && <p className="range-chart-notice">The charts include 3-bet response ranges, but do not provide a separate shove-specific chart.</p>}
    </section>

    <div className="range-position-bar">
      <div><span className="eyebrow">HERO POSITION</span><div className="range-position-options" role="group" aria-label="Hero position">
        {heroOptions.map(position => <button key={position} type="button" aria-pressed={heroPosition === position} className={heroPosition === position ? 'selected' : ''} onClick={() => setHeroPosition(position)}>{positionLabel(position, tableSize)}</button>)}
      </div></div>
      {actionType !== 'rfi' && (villainOptions.length
        ? <label>Villain position
          <select value={selectedVillain} onChange={event => setVillainPosition(event.target.value)}>
            {villainOptions.map(position => <option key={position} value={position}>{positionLabel(position, tableSize)}</option>)}
          </select>
        </label>
        : <p className="range-chart-notice">No opponent can act {actionType === 'vsOpen' ? 'before' : 'after'} this position.</p>)}
    </div>

    <div className="preflop-range-layout">
      <section className="panel preflop-chart-panel">
        <div className="preflop-chart-heading"><div><p className="eyebrow">STRATEGY MATRIX</p><h2>{actionType === 'rfi' ? `Unopened · ${positionLabel(heroPosition, tableSize)}` : selectedVillain ? `${positionLabel(heroPosition, tableSize)} vs ${positionLabel(selectedVillain, tableSize)}` : positionLabel(heroPosition, tableSize)}</h2></div><span className="tag">{chartDepth} BB CHART</span></div>
        {!chartSupported && <p className="range-chart-notice" role="status">No chart is available for this position and scenario combination. Change the positions or scenario to see chart data.</p>}
        <div className="preflop-matrix-scroll">
          <RangeMatrix cells={cells} selectedHand={selectedCell} onSelect={setSelectedCell} chartSupported={chartSupported} />
        </div>
        <div className="preflop-legend" aria-label="Action legend">
          {(actionType === 'rfi'
            ? [ACTIONS.open, ACTIONS.limp, ACTIONS.fold]
            : [ACTIONS[actionType === 'vsOpen' ? 'threeBet' : 'fourBet'], ACTIONS.call, ACTIONS.fold]
          ).map(action => <span key={action.className}><i className={action.className} />{action.label}</span>)}
          {actionType === 'rfi' && <span><i className="call" />Call (not charted)</span>}
        </div>
        <p className="preflop-chart-help">Pairs are on the diagonal, suited hands above it, and offsuit hands below. Colors show mixed action frequencies.</p>
      </section>

      <aside className="preflop-range-aside">
        <section className="panel preflop-hand-detail">
          <p className="eyebrow">SELECTED HAND</p><h2>{selectedDetails.hand}</h2>
          <p>{selectedDetails.hand.length === 2 ? 'Pocket pair' : selectedDetails.hand.endsWith('s') ? 'Suited hand' : 'Offsuit hand'} · {COMBINATIONS(selectedDetails.hand)} combinations</p>
          <div className="preflop-action-breakdown">
            {selectedDetails.details.map(action => (
              <div className="preflop-breakdown-row" key={action.id}>
                <span><i className={ACTIONS[action.action].className} />{action.label}</span><strong>{action.percentage.toFixed(1)}%</strong>
                <div className="preflop-frequency-track"><i className={ACTIONS[action.action].className} style={{ width: `${action.percentage}%` }} /></div>
                {action.ev !== null && <small>EV {action.ev.toFixed(2)}</small>}
              </div>
            ))}
          </div>
          {chartSupported
            ? <p className="preflop-combo-frequency">Displayed values are chart frequencies, not EV.</p>
            : <p className="preflop-combo-frequency">There are no chart frequencies for this selection.</p>}
        </section>
        <section className="panel preflop-range-summary">
          <p className="eyebrow">RANGE SUMMARY</p><h2>Combo-weighted frequency</h2>
          <p>Each hand category is weighted by its available combinations.</p>
          {Object.entries(totals).map(([action, percentage]) => {
            const displayAction = action === 'raise' ? (actionType === 'vsOpen' ? 'threeBet' : 'fourBet') : action;
            const label = action === 'open' ? 'Open / Raise'
              : action === 'raise' ? (actionType === 'vsOpen' ? '3-bet' : '4-bet')
                : action[0].toUpperCase() + action.slice(1);
            return <div className="preflop-summary-row" key={action}><span><i className={ACTIONS[displayAction].className} />{label}</span><strong>{percentage.toFixed(1)}%</strong></div>;
          })}
          {!chartSupported && <p className="preflop-combo-frequency">No range totals are available for this selection.</p>}
        </section>
      </aside>
    </div>
    <p className="preflop-data-disclaimer">Local MTT chart data. The supplied files contain action frequencies only (no EV values) and do not include dedicated shove charts. This view displays chart frequencies without grading bet sizing.</p>
  </section>;
}
