// Fixed teaching examples, kept separate from UI and any future solver integration.
export const scenarios = [
    { title: 'A strong start', cards: [['A', '♠'], ['A', '♥']], position: 'BTN', prompt: 'Everyone folds to you on the button. You have pocket aces and 100bb. What is your opening action?', answer: 'raise', explanation: 'Raise for value with a premium hand. You want to build a pot and give weaker hands a chance to continue. Your opening size depends on the game.' },
    { title: 'The discipline to pass', cards: [['7', '♣'], ['2', '♦']], position: 'UTG', prompt: 'You are first to act at a six-player table with 72 offsuit. Five players are still behind you. What is your default action?', answer: 'fold', explanation: 'Fold this weak offsuit hand from early position. It has poor connectivity and will often make weak pairs. You do not need to fight for every pot.' },
    { title: 'Build the pot', cards: [['K', '♠'], ['K', '♦']], position: 'CO', prompt: 'The action folds to you in the cutoff. You hold pocket kings with a 100bb stack. How do you enter the pot?', answer: 'raise', explanation: 'Raise with kings for value. A strong starting hand benefits from building the pot. These examples teach basic opening decisions, rather than calculated mixed strategies.' }
];

export const hands = [
    { title: 'Pressure on the turn', hand: 'K♠ Q♠', subtitle: 'BTN vs BB · Single-raised pot', question: 'What might change between the flop and turn that would make a second bet attractive — or a check preferable?', streets: [
            { name: 'Preflop', board: [], pot: '5.5 bb', events: ['Hero (BTN) raises to 2.5bb with K♠ Q♠.', 'Big Blind calls.'] },
            { name: 'Flop', board: [['A', '♠'], ['7', '♥'], ['3', '♣']], pot: '9.5 bb after action', events: ['Big Blind checks.', 'Hero bets 2bb. Big Blind calls.'] },
            { name: 'Turn', board: [['A', '♠'], ['7', '♥'], ['3', '♣'], ['8', '♦']], pot: '9.5 bb before the bet', events: ['Big Blind checks. Hero bets 6.5bb.', 'Big Blind folds. Hero nets 7.5bb before rake.'] }
        ] },
    { title: 'Value with an overpair', hand: 'Q♠ Q♥', subtitle: 'CO vs BB · Single-raised pot', question: 'Which weaker hands could call a bet on each street? How could that inform your choice of bet size?', streets: [
            { name: 'Preflop', board: [], pot: '5.5 bb', events: ['Hero (CO) raises to 2.5bb with Q♠ Q♥.', 'Big Blind calls.'] },
            { name: 'Flop', board: [['9', '♣'], ['5', '♦'], ['2', '♠']], pot: '9.5 bb after action', events: ['Big Blind checks.', 'Hero bets 2bb. Big Blind calls.'] },
            { name: 'Turn', board: [['9', '♣'], ['5', '♦'], ['2', '♠'], ['3', '♥']], pot: '21.5 bb after action', events: ['Big Blind checks.', 'Hero bets 6bb. Big Blind calls.'] },
            { name: 'River', board: [['9', '♣'], ['5', '♦'], ['2', '♠'], ['3', '♥'], ['J', '♣']], pot: '21.5 bb · showdown', events: ['Both players check.', 'Big Blind shows T♠ 9♥. Hero wins with queens.'] }
        ] }
];
