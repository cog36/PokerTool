# PokerTool

![Friends studying a poker hand together around a green felt table, with cards, chips and a notebook.](docs/images/pokertool-study-table.png)

**A place to play a hand, understand a decision, and come back a little better.**

Poker is easy to pick up and difficult to understand. You can make a good decision and lose, win with a bad decision, or finish a session unsure what you should have done differently. We wanted to make that learning process easier to approach.

We built PokerTool for a 24-hour university hackathon: a poker study space where you can practise against different personalities, explore starting hands, and ask questions without feeling you should already know the answer.

## Why we built it

For us, this project was a chance to bring an interest in poker together with what we are learning as developers. It meant working through the rules, making sense of real hand histories, and finding ways to explain decisions clearly. Getting a table to play is one challenge; making it useful to someone learning the game is another.

Our aim is to give people somewhere to make mistakes with virtual chips and learn from them. A newer player can get comfortable with positions and betting. Someone with more experience can review a session, explore a range, or notice a habit worth working on. The question we want to encourage is simple: *why did I make that move?*

## What you can do

- **Play the AI Arena.** Face seven opponents drawn from 13 poker personalities, from cautious Nits to aggressive Maniacs. Hands start preflop, with starting stacks of 5, 10, 20, 40 or 100 big blinds, animated dealing, and decision feedback.
- **Explore preflop charts.** Use an interactive 13 × 13 hand matrix to study different positions and stack depths.
- **Talk to the AI coach.** Ask about a concept or work through a hand, with constructive advice or a friendly roast.
- **Review your play.** Import supported GG Poker and PokerStars/Betfair hand histories to explore session statistics and preflop decisions.
- **Track tournament results.** See cash returns, buy-ins, profit, ROI, cash-based ITM and a cumulative profit graph, with incomplete or conflicting records flagged.
- **Keep a study notebook.** Save the lessons you want to remember. Use the responsive interface on a laptop or phone.

## The team

Built together by [Pritam Gurung](https://www.linkedin.com/in/pritamgurung1/), [Daniel Collings](https://www.linkedin.com/in/daniel-collings-701b13315/), and that one economics guy [Arthur Davies](https://www.linkedin.com/in/arthur-davies-66b3bb325/). We'd love to hear what you think, especially if you give it a try.

## Try it locally

You need Node.js 22.12+ and Python 3.11+. From the project root on macOS or Linux:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
npm install
npm start
```

Open the Local URL printed in the terminal. On Windows, use `.venv\Scripts\python.exe` for the Python installation step.

For AI coaching, create `backend/.env` and add your own key:

```env
GROQ_API_KEY=your_key_here
```

Keep this file private. The Arena and charts work without an AI key; coaching requires one.

For a phone demo, run `npm run dev:mobile`. Connect your phone and laptop to the same Wi-Fi. Open `/share.html` at the printed Local URL on your laptop to display the QR code, then scan it on your phone. Keep the laptop running. Home-screen installation and offline support require an HTTPS production build.

## How it works

React, Vite and custom CSS power the interface. Python and FastAPI handle parsing and analysis; Groq provides the AI coaching. Preflop decisions use the checked-in JSON charts where covered. Unsupported situations and postflop reviews use labelled heuristic feedback. **GTOpen is not connected, and AI explanations are not solver results.** The Arena practises tournament chip accumulation, without ICM or payout modelling.

Run `npm test` for frontend unit tests and `npm run build` for a production build. Backend tests run with `.venv/bin/python -m unittest discover -s backend -p 'test_*.py'`.

Built for a hackathon, with room to grow—and with the hope that each session leaves you with something you understand a little better.
