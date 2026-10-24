import json
from pathlib import Path
from parser import parse_gg_hand_history
from analyzer import analyze_session_hands

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SAMPLE_FILE_PATH = PROJECT_ROOT / "hand_histories" / "GG20261015-2250 - Daily Hyper 2.txt"

def test_hand_auditor():
    with open(SAMPLE_FILE_PATH, "r", encoding="utf-8") as f:
        raw_text = f.read()

    # parse raw text logs
    parsed_hands = parse_gg_hand_history(raw_text)
    
    # run hand decision analysis
    analysis = analyze_session_hands(parsed_hands)

    print("=== SESSION LEAK AUDIT SUMMARY ===")
    print(f"Total Hands Analyzed: {analysis.get('total_hands_analyzed', 0)}")
    print(f"Total Strategic Mistakes: {analysis.get('total_mistakes_detected', 0)}")
    print(f"Critical Blunders: {analysis.get('critical_blunders_count', 0)}\n")

    leak_breakdown = analysis.get("leak_breakdown", {})
    print("=== LEAK BREAKDOWN ===")
    print(f"- Played Weak Hands (Should Fold): {leak_breakdown.get('played_weak_hands', 0)}")
    print(f"- Folded Playable Hands (Should Play): {leak_breakdown.get('folded_playable_hands', 0)}")
    print(f"- Passive Calls on Premiums (Should Raise): {leak_breakdown.get('passive_calls_on_premiums', 0)}\n")

    print("=== AUDITED HAND SAMPLES (First 4 Hands) ===")
    print(json.dumps(analysis.get("audited_hand_details", [])[:4], indent=2))

if __name__ == "__main__":
    test_hand_auditor()