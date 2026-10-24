# ♠️ Interactive Poker Analysis & GTO Training App

## Run the React frontend

The browser-only frontend uses **React + Vite**, with the existing custom CSS and light/dark themes.
It includes the overview, interactive range explorer, sample practice decisions, AI Arena games, hand replays, and local study notes.
The range and training data are illustrative; no Python server, API key, or solver is required.

## Run the app

After installing dependencies once, run both the Python API and Vite frontend from the project root with:

```powershell
npm start
```

Open the **Local** URL printed by Vite (normally `http://127.0.0.1:5173/`). Keep the terminal open while using the app; press Ctrl+C to stop both services.
The launcher validates the Python app before starting either service, waits for the API to become ready, and stops both services together on Ctrl+C or a service failure. Port 5173 is preferred; if it is occupied, Vite selects the next available port and prints the correct Local URL. The Python API stays on port 8000 and is reused when already running.

First-time setup on macOS / Linux (from the project root):

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
npm install
npm start
```

On Windows, install Python dependencies with `.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt` (use `.venv`, not `venv`, for this project's environment).

`npm run dev` also starts both services. For the frontend alone, run `npm run dev:frontend` from the project root with Node.js 22.12+ (or 20.19+).

Open the local URL printed by Vite (usually `http://127.0.0.1:5173`). Both `/` and `/doc.html` load the React app.
Use Vite rather than opening the HTML file directly or using Live Server; JSX requires the build tool.

```bash
npm test          # Range generation, scoring, and persisted-data validation
npm run build    # Production assets in dist/
npm run preview  # Preview the production build
npm run test:browser # Browser flows; run npm run dev first (uses installed Chrome)
```

Frontend source:

- `Frontend/src/App.jsx`: navigation, shared practice results, and checklist state.
- `Frontend/src/pages/`: Home, Hand Overview, Session Analysis, Ranges, Practice, Hands, Notebook, and coaching components.
- `Frontend/src/components/`: shared cards and the theme switch.
- `Frontend/src/data.js`: curated teaching and replay examples.
- `Frontend/src/model.js`: pure range/scoring helpers and browser storage utilities.
- `Frontend/style.css`: responsive layouts, themes, and motion with reduced-motion support.

Existing `river.notes`, `river.tasks`, and `pokerttool.theme` storage keys are retained.
Browser storage is specific to the site origin; notes from a different port or a file URL remain on that origin.
Practice scores last for the current visit; notes, checklist choices, and theme preferences persist locally.

## Play the AI Arena

Open **AI Arena → Full-hand challenge** for **MTT/SNG chip-EV drills**. Each hand is an independent exercise at a randomly selected depth of **5, 10, 20, 40, or 100bb** with you and seven distinct types drawn from TAG, LAG, TP, LP, Nit, Maniac, Calling Station, Rock, Fit-or-Fold, ABC Player, Tricky / Deceptive, Exploitative Regular, and GTO-Oriented Regular.

Every new hand redraws the roster and randomizes physical seating and the dealer. The hero and retained archetypes move to different physical seats; the hero's poker position also changes. Identities and archetypes stay fixed during the hand. Blinds and action order follow the physical seat order, while the view keeps the hero bottom centre. Each fresh drill gives everyone the same randomly chosen starting depth; the session totals track actual chip gains/losses across drills rather than pretending this changing roster is one continuous tournament.

Hands start **preflop**, with 0.5bb / 1bb blinds and no ante, and continue through flop, turn, and river. Every seat has a persistent chip pile for its current street contribution, plus exact action text: for example **Raise to 3bb**, **3-bet to 8bb**, or **Call 5bb** with an 8bb total pile. A call label is the additional amount paid; a raise-to label is the total for that street. Chips stay in front of the player until the betting round closes, then sweep into the pot. The history retains every street and bet size.

Use Fold, Check / Call, a custom Bet / Raise-to size, or All-in when legal. The engine handles minimum raises, short all-ins and reopening, main / side pots, refunds, and split pots. Half-bb integer accounting prevents fractional-chip loss. All chips are virtual.

### Chip-EV model and its limits

The active Arena bots use deterministic Monte Carlo samples of unseen cards (40 trials per decision), drawn only from the bot's own cards and the public board. Opponents' real hole cards and the real undealt deck are excluded from their decision view. Call EV compares expected chip returns from the currently eligible pots with the call cost. The bet model estimates fold frequency and additional calls from public action statistics and covered stacks. It assumes uniform unknown holdings and simplified future play, so these are noisy baseline estimates, **not exact strategic EV or solver results**.

TAG, ABC, exploitative, and GTO-oriented bots use that baseline to filter negative estimated chip-EV calls/bets while retaining their profile's entry ranges and mixed actions. Loose/passive and overly aggressive archetypes intentionally deviate: a Calling Station can make a losing call, and a Maniac can make an excessive bluff. GTO-oriented describes a mixed heuristic profile, not an equilibrium solver.

This is **chip accumulation practice**, not payout-equity training. There is no ICM, bubble risk premium, payout structure, blind clock, or progressive tournament field. It should not be treated as bubble/final-table advice; [chip EV and ICM differ](https://www.pokerstars.com/poker/learn/lesson/icm-and-its-impact-on-tournaments/). Starting depths are sampled equally from 5, 10, 20, 40 and 100bb each hand; repeats are possible. Advanced tournament settings remain deferred.

Dealer animations, thinking bubbles, chip movements and showdown reveals are retained. Cinematic / Quick play and Skip animations control pacing. Leaving the Arena pauses playback; reduced-motion preferences disable decorative movement. The **Read the opponent** quiz remains available as the second game.

## Run the Python AI coach

The AI Coach screen calls a FastAPI endpoint backed by Groq. Range and training screens still use sample data; the chatbot does not have a solver or automatic access to your notebook or practice results.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
```

Edit `backend/.env` and add your `GROQ_API_KEY` from [Groq Console](https://console.groq.com/keys).
`GROQ_MODEL` is configurable; its default is `openai/gpt-oss-120b`. The older Llama model is retired for free/developer accounts. Choose a model available to your account.
Never put the key in frontend code or a `VITE_` variable.

To start the Python API by itself:

```bash
source .venv/bin/activate
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

If you started Python separately, run `npm run dev:frontend` in another terminal, then open **AI Coach**. Otherwise use `npm start` or `npm run dev` to start both services together.
Vite proxies `/api` requests to Python. The API reads saved settings on every request. `backend/.env` takes priority over the legacy root `.env`; explicit shell environment variables take priority over both.
`GET /api/health` reports whether a key is configured, not whether it is valid.
`POST /api/chat` accepts `{ "messages": [{ "role": "user", "content": "Explain position" }], "mode": "constructive" }`.

- The conversation stays in memory for this visit; submitting sends recent messages to Groq.
- Constructive and friendly-roast styles share the same server-side poker coaching instructions.
- No API key means a clear setup message, not a simulated AI response.
- The API is for local development. A public deployment needs authentication, abuse limits, and a same-origin `/api` proxy before exposing this paid-provider endpoint.
- Run API tests with `.venv/bin/python -m unittest discover -s backend -p 'test_*.py'` (mocked provider; no live AI calls).

The Hand Overview screen reads `.txt`, `.log`, and `.hh` files recursively from the local `hand_histories/` directory through `GET /api/hand-history-overview`. It aggregates GG Poker hands dealt to `Hero` and PokerStars/Betfair hands dealt to `bullets685`, with overall HUD metrics, position statistics, heuristic flags, and searchable hand details. Went-to-showdown (WTSD) is showdowns divided by hands that saw a flop; showdown frequency per all dealt hands is shown separately. Three-bet opportunities require exactly one prior raise, and c-bet opportunities require the preflop aggressor to reach a flop without facing a bet before acting. The files are read locally and are not modified. Tournament ROI is not calculated because hand histories alone do not provide a complete results ledger.

The Session Analysis screen accepts UTF-8 GG Poker `.txt` histories dealt to `Hero` and PokerStars/Betfair `.txt` histories dealt to `bullets685`. The API detects the format, normalizes positions, cards, stacks, and preflop actions, then audits the hands in memory; files are not saved. The response includes session totals, leak counts, and per-hand feedback. These findings use the supplied preflop charts with a legacy heuristic fallback, not a solver or verified GTO output.

Install the backend dependencies, including `python-multipart`, from `backend/requirements.txt` before starting the API. Run the upload and analysis API tests with `.venv\\Scripts\\python -m unittest discover -s backend -p "test_*.py"` on Windows (or the corresponding activated-environment command on macOS/Linux).

The remaining GTO solver and advanced statistical-analysis sections describe proposed scope and are not implemented yet.

---


[![Python](https://img.shields.io/badge/Backend-Python_3.11+-3776AB?logo=python&logoColor=white)](#tech-stack-breakdown)
[![FastAPI](https://img.shields.io/badge/API-FastAPI-009688?logo=fastapi&logoColor=white)](#tech-stack-breakdown)
[![Engine](https://img.shields.io/badge/Solver-GTOpen_C%2B%2B%2FRust-FF6F00)](#2-preflop--postflop-gto-solver-gtopen-integration)
[![Groq](https://img.shields.io/badge/AI-Groq_Llama_3.3_70B-F34B21)](#3-ai-chatbot--persona-analyst)

An interactive, full-stack poker analysis and training platform that transforms raw hand history data into real-time GTO (Game Theory Optimal) strategy heatmaps, gamified training scenarios, and AI-powered player roasting.

---

## 📌 Project Overview

This application bridges raw online poker hand history parsing with high-performance GTO solving and gamified player analytics. It converts complex mathematical strategy trees and postflop Counterfactual Regret Minimization (CFR) solvers into an intuitive, visually appealing web interface. 

By pairing data analysis with an LLM personality coach and interactive training minigames, the platform turns dry statistical audits into an engaging, educational experience.

---

## 🏗️ Core Architecture & Features

### 1. Data Ingestion & Game Parsing
* **Hand History Importer:** Ingests exported `.txt` or standard `.phh` (Poker Hand History) log files from standard online poker clients and tracking software.
* **169 Hand Matrix Normalization:** Converts raw hole cards down into canonical $13 \times 13$ matrix keys (e.g., $AKs$, $AKo$, $77$).
* **Performance Tracking:** Programmatically measures player metrics, including EV/bb (expected value per big blind), positional frequencies, street-by-street aggression, and net win/loss distributions.

### 2. Preflop & Postflop GTO Solver (GTOpen Integration)
* **Preflop Multiway Engine:** Leverages GTOpen’s **Preflop Lab** to compute multiway preflop strategy trees ($2$ to $9$ players across opens, limps, 3-bets, and calls) using coupled-deck equity abstractions.
* **Postflop CFR Solver:** Automatically feeds heads-up postflop scenarios (Flop, Turn, River) into GTOpen’s Rust/C++ Counterfactual Regret Minimization engine with CPU or NVIDIA CUDA hardware acceleration.
* **Dynamic Strategy Heatmaps:** Renders interactive, color-coded $13 \times 13$ strategy matrix grids displaying exact action probabilities ($\text{Fold}$, $\text{Call}$, $\text{Raise}$) and expected values ($EV$).

### 3. AI Chatbot & Persona Analyst
* **Automated Gameplay Roaster:** Integrated with Groq's `llama-3.3-70b-versatile` model to deliver near-instant, sarcastic, or constructive critiques of sub-optimal plays (e.g., triple-barrel bluffing into multiway calling stations).
* **Dynamic "Tilt Meter":** Detects erratic post-loss betting behaviors and updates a visual emotional state gauge ($\text{Calm} \rightarrow \text{Annoyed} \rightarrow \text{Steaming} \rightarrow \text{Tilt}$).
* **Player Archetype Badges:** Evaluates player stats ($VPIP$, $PFR$, $3\text{-Bet}\%$) to assign funny badges like *"The Nit"*, *"The Calling Station"*, or *"The Maniac"*.

### 4. Gamified "GTO Scenario" Minigame
* **Interactive Scenario Mode:** Drops players into randomized, high-stakes situations (e.g., facing a 3-bet in the Cutoff on a $A\spades K\spades 7\heartsuit$ board).
* **Instant GTO Evaluation:** Compares user actions directly against GTOpen’s calculated optimal strategy distribution in real time.
* **Scoring System:** Tracks player accuracy with score multipliers, GTO streak counters, and immediate strategic feedback.

---

## 🛠️ Tech Stack Breakdown

* **Backend API:** Python 3.11+ via **FastAPI** / **Uvicorn**
* **Solver Engine:** **GTOpen** (C++/Rust CFR Solver with optional CUDA GPU support)
* **AI / LLM Engine:** **Groq API** (`llama-3.3-70b-versatile`) using standard OpenAI SDK
* **Frontend UI:** React + Vite with custom CSS, responsive layouts, and light/dark themes
* **Data Processing:** `pandas`, `numpy`, `eval7`

---

## ⚡ Quick Start & Installation

### Prerequisites
* Python 3.11 or higher
* Compiled GTOpen binary in your system path or project root

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/poker-gto-app.git
   cd poker-gto-app
   ```

2. **Set up virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Variables:**
   Create a `.env` file in the project root:
   ```env
   GROQ_API_KEY="your-groq-api-key-here"
   GTOPEN_BIN_PATH="./bin/gtoopen"
   ```

5. **Run the Application:**
   ```bash
   uvicorn main:app --reload
   ```
   Open `http://localhost:8000` in your web browser.

---

## 📊 Matrix Key Normalization Reference

The $13 \times 13$ strategy grid maps all 1,326 starting hand combinations into 169 canonical keys:
* **Pairs ($AA - 22$):** Represented along the main diagonal ($i = j$).
* **Suited Hands ($AKs, T9s$):** Represented in the upper-right triangle ($i < j$).
* **Offsuit Hands ($AKo, 72o$):** Represented in the lower-left triangle ($i > j$).

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
### Arena controls and decision reviews

The human stays at the bottom centre of the table; the view rotates around their shuffled physical seat, so poker position and the yellow D button still change between hands. Player types and wager amounts use larger text. Enter a custom raise-to amount in bb or select 33%, 50%, 75%, or 100% of the current pot. Presets round to 0.5bb and clamp to legal raise limits; facing a bet they represent a raise-to total, not an extra raise after calling.

The separate Practice Room has been removed from navigation. After each Arena move, a decision-time snapshot (hero cards, visible board, stacks, opponent archetypes, and recent action history) is sent to the existing Python `/api/chat` coach. Future board cards and opponents' hidden cards are excluded. Feedback appears beneath the controls, with retry for failures. It is AI coaching, not a solver verdict.

GTOpen is **not installed or connected**. Its [official API documentation](https://github.com/MatthewPDingle/GTOpen/blob/master/docs/technical_reference.md) exposes multiway preflop and heads-up postflop solving. A full trainer integration still needs a local engine, configured ranges/trees, mapping each Arena action to a solver node (including custom sizes), convergence checks and persisted solutions. No frequencies or EV losses are fabricated when these are unavailable. Multiway postflop remains outside its supported solve scope.

### Live table insights

Every played action now includes a short public-information explanation, displayed as its animation plays. Calls show the immediate price/equity threshold (capped for side-pot coverage); raises explain the extra risk, and checks/folds explain their tradeoff. This is heuristic commentary, not an evaluation against solved ranges or proof a move is correct. Skipping animations retains the skipped actions in the collapsed recent-action list.

Hero moves also request a two-sentence AI review; the table keeps updating while it loads, and works if the coach is offline. Only the latest insight and latest hero review remain expanded. Older actions are capped at twelve entries. Initial avatars replace Arena emoji characters, and table talk starts muted to keep the felt uncluttered.

### Gradual coaching replies

Coach replies are fetched from the Python API as before, then displayed progressively word by word. This is a frontend reveal, not token streaming from the provider. Use **Show full response** to finish immediately, or **New chat** to clear it. The complete reply is retained for conversation context and copying. Arena AI notes use the same reveal; immediate local table insights remain instant. Hand Library has been removed from navigation and the overview links to Study Notebook instead.

### Arena Hero preflop chart evaluation

Hero preflop reviews read the checked-in `charts/MTT_{5,10,20,40,100}_GTO.json` files at the hand's exact starting depth. Cards become canonical pair/suited/offsuit keys. Position mapping follows the chart's nine-seat naming with earliest positions removed for shorter tables (eight-handed UTG → EP2, UTG+1 → EP3). The structured action history selects open/limp, call/3-bet, call-3-bet/4-bet and later matching tables.

Any positive-frequency action is chart-approved, including mixed actions; zero-frequency actions are outside the chart. Fold frequency is the residual after the listed alternatives. Limped/calling multiway sequences, unsupported cold reraises, missing tables/depths and inconsistent frequency totals are marked as a clearly labelled **Legacy fallback**: the chart remains unassessed and the prior heuristic feedback is used instead. The coverage reason is displayed and passed to AI coaching. Charts evaluate action category, not the chosen bet amount, exact EV, or ICM.

The chart verdict remains visible in **Your preflop review** and is included in the AI explanation request. Opponent action selection and feedback are unchanged. Hero postflop reviews continue using the existing legacy feedback and AI coaching. No live GTO solver is added.
