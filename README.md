# ♠️ Interactive Poker Analysis & GTO Training App

## Run the React frontend

The browser-only frontend uses **React + Vite**, with the existing custom CSS and light/dark themes.
It includes the overview, interactive range explorer, sample practice decisions, hand replays, and local study notes.
The range and training data are illustrative; no Python server, API key, or solver is required.

From the `Frontend/` folder, with Node.js 22.12+ (or 20.19+):

```bash
cd Frontend
npm install
npm run dev
```

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
- `Frontend/src/pages/`: Overview, Ranges, Practice, Hands, and Notebook components.
- `Frontend/src/components/`: shared cards and the theme switch.
- `Frontend/src/data.js`: curated teaching and replay examples.
- `Frontend/src/model.js`: pure range/scoring helpers and browser storage utilities.
- `Frontend/style.css`: responsive layouts, themes, and motion with reduced-motion support.

Existing `river.notes`, `river.tasks`, and `pokerttool.theme` storage keys are retained.
Browser storage is specific to the site origin; notes from a different port or a file URL remain on that origin.
Practice scores last for the current visit; notes, checklist choices, and theme preferences persist locally.

## Run the Python AI coach

The AI Coach screen calls a FastAPI endpoint backed by Groq. Range and training screens still use sample data; the chatbot does not have a solver or automatic access to your notebook or practice results.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cp .env.example .env
```

Edit `.env` and add your `GROQ_API_KEY` from [Groq Console](https://console.groq.com/keys).
`GROQ_MODEL` is configurable; its default is `llama-3.3-70b-versatile`. Choose a model available to your account.
Never put the key in frontend code or a `VITE_` variable.

Start the Python API in one terminal:

```bash
source .venv/bin/activate
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Start the frontend in another terminal with `npm run dev`, then open **AI Coach**.
Vite proxies `/api` requests to Python. Restart the API after changing `.env`.
`GET /api/health` reports whether a key is configured, not whether it is valid.
`POST /api/chat` accepts `{ "messages": [{ "role": "user", "content": "Explain position" }], "mode": "constructive" }`.

- The conversation stays in memory for this visit; submitting sends recent messages to Groq.
- Constructive and friendly-roast styles share the same server-side poker coaching instructions.
- No API key means a clear setup message, not a simulated AI response.
- The API is for local development. A public deployment needs authentication, abuse limits, and a same-origin `/api` proxy before exposing this paid-provider endpoint.
- Run API tests with `.venv/bin/python -m unittest discover -s backend -p 'test_*.py'` (mocked provider; no live AI calls).

The remaining GTO and parsing sections describe the proposed scope and are not implemented yet.

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