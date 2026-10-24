import json
from functools import lru_cache
from pathlib import Path


CHART_STACKS = (5, 10, 20, 40, 100)
CHART_POSITIONS = {"EP1", "EP2", "EP3", "LJ", "HJ", "CO", "BTN", "SB", "BB"}
CHARTS_DIR = Path(__file__).resolve().parent.parent / "charts"

POSITIONAL_RANGES = {
    "UTG": {"AA", "KK", "QQ", "JJ", "TT", "99", "AKs", "AQs", "AJs", "ATs", "KQs", "AKo", "AQo"},
    "MP": {"AA", "KK", "QQ", "JJ", "TT", "99", "88", "AKs", "AQs", "AJs", "ATs", "KQs", "KJs", "QJs", "JTs", "AKo", "AQo", "AJo"},
    "CO": {"AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A5s", "KQs", "KJs", "KTs", "QJs", "QTs", "JTs", "98s", "AKo", "AQo", "AJo", "ATo", "KQo"},
    "BTN": {"AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33", "22", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "QJs", "QTs", "JTs", "T9s", "98s", "87s", "76s", "65s", "AKo", "AQo", "AJo", "ATo", "A9o", "KQo", "KJo", "QJo"},
    "SB": {"AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A5s", "A4s", "KQs", "KJs", "KTs", "QJs", "QTs", "JTs", "T9s", "98s", "87s", "AKo", "AQo", "AJo", "ATo", "KQo"},
    "BB": {"AA", "KK", "QQ", "JJ", "TT", "99", "88", "AKs", "AQs", "AJs", "ATs", "A5s", "KQs", "KJs", "QJs", "JTs", "AKo", "AQo", "AJo"},
}
SHORT_STACK_SHOVE_RANGE = {
    "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33", "22",
    "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A5s", "A4s", "KQs", "KJs", "KTs", "QJs", "QTs", "JTs", "T9s",
    "AKo", "AQo", "AJo", "ATo", "A9o", "KQo", "KJo",
}
CONTINUE_VS_EP_OPEN = {
    "AA", "KK", "QQ", "JJ", "TT", "99", "88",
    "AKs", "AQs", "AJs", "ATs", "KQs", "QJs", "JTs", "AKo", "AQo",
}
CONTINUE_VS_LP_OPEN = {
    "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55",
    "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A5s", "A4s", "KQs", "KJs", "KTs",
    "QJs", "QTs", "JTs", "T9s", "98s", "87s", "AKo", "AQo", "AJo", "ATo", "KQo", "KJo",
}
CALL_SHOVE_RANGE = {
    "AA", "KK", "QQ", "JJ", "TT", "99", "88", "AKs", "AQs", "AJs", "ATs", "AKo", "AQo", "AJo",
}
CONTINUE_VS_3BET = {"AA", "KK", "QQ", "JJ", "TT", "AKs", "AQs", "AKo"}
PREMIUM_HANDS = {"AA", "KK", "QQ", "AKs", "AKo"}


@lru_cache(maxsize=len(CHART_STACKS))
def _load_chart(stack_bb: int) -> dict[str, dict[str, float]]:
    chart_path = CHARTS_DIR / f"MTT_{stack_bb}_GTO.json"
    return json.loads(chart_path.read_text(encoding="utf-8"))


def _nearest_chart_stack(stack_bb: float) -> int:
    return min(CHART_STACKS, key=lambda chart_bb: (abs(chart_bb - stack_bb), -chart_bb))


def _chart_actions(hand: dict) -> list[tuple[str, str]] | None:
    position = hand.get("position")
    if position not in CHART_POSITIONS:
        return None
    if hand.get("num_callers_before_hero", 0) > 0:
        return None

    raises = [
        action for action in hand.get("actions_before_hero", [])
        if action.get("action") in ("raise", "bet")
    ]
    num_raises = hand.get("num_raises_before_hero", len(raises))
    if num_raises == 0:
        if hand.get("num_callers_before_hero", 0) > 0:
            return None
        return [("RAISE", f"Open{position}"), ("LIMP", f"Limp{position}")]

    if not raises:
        return None

    last_raiser_position = raises[-1].get("position")
    if last_raiser_position not in CHART_POSITIONS:
        return None

    if num_raises == 1:
        return [
            ("CALL", f"Call{position}vs{last_raiser_position}"),
            ("RAISE", f"3Bet{position}vs{last_raiser_position}"),
        ]
    if num_raises == 2:
        return [
            ("CALL", f"Call 3Bet{position}vs{last_raiser_position}"),
            ("RAISE", f"4Bet{position}vs{last_raiser_position}"),
        ]
    if num_raises == 3:
        return [
            ("CALL", f"Call 4Bet{position}vs{last_raiser_position}"),
            ("RAISE", f"5Bet{position}vs{last_raiser_position}"),
        ]
    if num_raises == 4:
        return [
            ("CALL", f"Call 5Bet{position}vs{last_raiser_position}"),
            ("RAISE", f"6Bet{position}vs{last_raiser_position}"),
        ]
    return None


def _format_chart_options(frequencies: dict[str, float]) -> str:
    options = [f"{action} {frequency:.0%}" for action, frequency in frequencies.items() if frequency > 0]
    fold_frequency = max(0.0, 1.0 - sum(frequencies.values()))
    if fold_frequency > 0:
        options.append(f"FOLD {fold_frequency:.0%}")
    return " / ".join(options) or "FOLD 100%"


def _legacy_position(position: str) -> str:
    return {
        "EP1": "UTG",
        "EP2": "MP",
        "EP3": "MP",
        "LJ": "UTG",
        "HJ": "MP",
    }.get(position, position)


def _audit_with_legacy_logic(hand: dict) -> dict:
    matrix_key = hand.get("matrix_key", "")
    position = _legacy_position(hand.get("position", "BTN"))
    stack_bb = hand.get("starting_stack_bb", 20.0)
    invested = hand.get("hero_invested", 0.0)
    big_blind = hand.get("big_blind", 1.0)
    profit = hand.get("net_profit", 0.0)
    is_all_in = hand.get("is_all_in", False)
    facing_action = hand.get("facing_action", "UNOPENED")
    is_facing_all_in = hand.get("is_facing_all_in", False)
    opener_pos = _legacy_position(hand.get("opener_position") or "")
    num_raises = hand.get("num_raises_before_hero", 0)
    hero_first_act = hand.get("hero_first_action")
    voluntarily_played = hand.get(
        "voluntarily_played",
        invested > big_blind * 1.1,
    )

    deviation = "Optimal Action"
    recommendation = "Played correctly according to situational ranges."
    severity = "NONE"
    should_play = False

    if is_facing_all_in or facing_action in ("FACING_OPEN_SHOVE", "FACING_3BET_SHOVE"):
        should_play = matrix_key in CALL_SHOVE_RANGE
        if voluntarily_played or hero_first_act in ("call", "raise"):
            if not should_play:
                deviation = "Bad Call vs Shove"
                recommendation = f"At {stack_bb}bb facing an all-in shove from {opener_pos or 'villain'}, calling with {matrix_key} is -EV. Calling shoves requires premium holdings (88+, ATs+, AJo+)."
                severity = "CRITICAL"
            else:
                recommendation = f"Solid call with {matrix_key} facing an all-in shove."
        elif matrix_key in PREMIUM_HANDS:
            deviation = "Folded Premium vs Shove"
            recommendation = f"You folded premium hand {matrix_key} facing an all-in shove."
            severity = "CRITICAL"
        else:
            recommendation = f"Correctly folded {matrix_key} facing an all-in shove from {opener_pos or 'villain'}."
    elif num_raises >= 2 or facing_action == "FACING_3BET":
        should_play = matrix_key in CONTINUE_VS_3BET
        if voluntarily_played:
            if not should_play:
                deviation = "Played Loose vs 3-Bet"
                recommendation = f"Entering the pot with {matrix_key} facing multiple raises is too loose."
                severity = "CRITICAL" if is_all_in else "MAJOR"
            else:
                recommendation = f"Played correctly with premium {matrix_key} facing multiple raises."
        elif matrix_key in {"AA", "KK"}:
            deviation = "Folded Premium Hand"
            recommendation = f"You folded monster hand {matrix_key} facing multiple raises."
            severity = "CRITICAL"
        else:
            recommendation = f"Correctly folded {matrix_key} facing multiple raises."
    elif facing_action == "FACING_OPEN_RAISE":
        continue_range = CONTINUE_VS_EP_OPEN if opener_pos in ("UTG", "MP") else CONTINUE_VS_LP_OPEN
        should_play = matrix_key in continue_range
        if voluntarily_played:
            if not should_play:
                deviation = f"Played Loose vs {opener_pos or 'Open'} Raise"
                recommendation = f"You played {matrix_key} from {position} facing an open from {opener_pos}. This hand is too weak to continue against an open from this position."
                severity = "CRITICAL" if is_all_in else "MAJOR"
            elif matrix_key in PREMIUM_HANDS and hero_first_act == "call" and not is_all_in:
                deviation = "Passive Call on Premium"
                recommendation = f"You passively called with {matrix_key} facing an open from {opener_pos}. You should 3-bet for value."
                severity = "MAJOR"
            else:
                recommendation = f"Correctly continued with {matrix_key} from {position} facing an open from {opener_pos}."
        elif matrix_key in PREMIUM_HANDS:
            deviation = "Folded Premium Hand"
            recommendation = f"You folded premium hand {matrix_key} from {position} facing an open from {opener_pos}."
            severity = "CRITICAL"
        else:
            recommendation = f"Correctly folded {matrix_key} from {position} facing an open raise from {opener_pos}."
    elif facing_action == "FACING_LIMP":
        should_play = matrix_key in POSITIONAL_RANGES.get(position, POSITIONAL_RANGES["BTN"])
        if voluntarily_played and not should_play:
            deviation = "Loose Play vs Limp"
            recommendation = f"Entering the pot with {matrix_key} over limpers is too speculative."
            severity = "MAJOR"
        elif voluntarily_played:
            recommendation = f"Played correctly with {matrix_key} over limpers."
        elif should_play and profit < 0:
            deviation = "Folded Playable Hand vs Limpers"
            recommendation = f"You folded {matrix_key} from {position} with limpers in the pot; this hand can isolate or over-limp."
            severity = "MINOR"
        else:
            recommendation = f"Correctly folded weak hand {matrix_key} over limpers."
    else:
        is_short_stacked = stack_bb <= 15.0
        valid_range = SHORT_STACK_SHOVE_RANGE if is_short_stacked else POSITIONAL_RANGES.get(position, POSITIONAL_RANGES["BTN"])
        should_play = matrix_key in valid_range
        if is_short_stacked:
            if is_all_in and not should_play:
                deviation = "Bad Short-Stack Shove"
                recommendation = f"At {stack_bb}bb in position {position}, shoving with {matrix_key} is too weak."
                severity = "CRITICAL"
            elif not voluntarily_played and should_play and profit < 0:
                deviation = "Passed Up Short-Stack Shove"
                recommendation = f"At {stack_bb}bb in position {position}, {matrix_key} is a profitable push/fold shove."
                severity = "MAJOR"
            elif voluntarily_played and not should_play:
                deviation = f"Played Loose in {position}"
                recommendation = f"You entered an unopened pot with {matrix_key} at {stack_bb}bb. Push/fold shove or fold."
                severity = "MAJOR"
            else:
                recommendation = f"Played correctly for position {position} at {stack_bb}bb stack depth in an unopened pot."
        elif not voluntarily_played and should_play and profit < 0:
            deviation = f"Folded Playable Hand ({position})"
            recommendation = f"You folded {matrix_key} from {position} in an unopened pot. This hand is inside standard opening ranges."
            severity = "MINOR"
        elif voluntarily_played and not should_play:
            deviation = f"Played Loose in {position}"
            recommendation = f"You opened {matrix_key} from {position}. This hand is too weak for standard opening ranges."
            severity = "CRITICAL" if is_all_in else "MAJOR"
        else:
            recommendation = f"Played correctly for position {position} in an unopened pot."

    return {
        "hand_id": hand.get("hand_id"),
        "matrix_key": matrix_key,
        "position": hand.get("position", "UNKNOWN"),
        "stack_depth_bb": stack_bb,
        "facing_action": facing_action,
        "opener_position": hand.get("opener_position"),
        "net_profit": profit,
        "decision_assessment": "CORRECT" if severity == "NONE" else "INCORRECT",
        "analysis_source": "LEGACY_LOGIC",
        "chart_action_frequency": None,
        "voluntarily_played": voluntarily_played,
        "recommended_action": "PLAY/RAISE" if should_play else "FOLD",
        "deviation_type": deviation,
        "feedback": f"Legacy heuristic (not chart-based): {recommendation}",
        "severity": severity,
    }


def audit_single_hand(hand: dict) -> dict:
    matrix_key = hand.get("matrix_key", "")
    position = hand.get("position", "UNKNOWN")
    stack_bb = hand.get("starting_stack_bb", 20.0)
    chart_stack_bb = _nearest_chart_stack(stack_bb)
    facing_action = hand.get("facing_action", "UNOPENED")
    profit = hand.get("net_profit", 0.0)
    hero_action = hand.get("hero_first_action")
    chart_actions = _chart_actions(hand)

    decision_assessment = "UNASSESSED"
    severity = "UNASSESSED"
    deviation = "Chart spot unavailable"
    recommended_action = "No chart for this spot"
    action_frequency = None
    feedback = (
        f"No matching preflop chart spot is available for {position} at "
        f"{chart_stack_bb}bb in this situation."
    )
    assessment_available = False

    if chart_actions:
        chart = _load_chart(chart_stack_bb)
        available_actions = [(action, key) for action, key in chart_actions if key in chart]
        if available_actions:
            frequencies = {
                action: float(chart[key].get(matrix_key, 0.0))
                for action, key in available_actions
            }
            recommended_action = _format_chart_options(frequencies)
            action_map = {
                "fold": "FOLD",
                "call": "CALL",
                "raise": "RAISE",
                "bet": "RAISE",
                "limp": "LIMP",
            }
            actual_action = action_map.get(hero_action)
            if actual_action == "FOLD":
                action_frequency = max(0.0, 1.0 - sum(frequencies.values()))
            elif actual_action:
                action_frequency = frequencies.get(actual_action, 0.0)

            if action_frequency is not None:
                assessment_available = True
                decision_assessment = "CORRECT" if action_frequency > 0 else "INCORRECT"
                severity = "NONE" if decision_assessment == "CORRECT" else (
                    "CRITICAL" if hand.get("is_all_in") or hand.get("is_facing_all_in") else
                    "MINOR" if actual_action == "FOLD" else
                    "MAJOR"
                )
                deviation = (
                    "Chart-approved action"
                    if decision_assessment == "CORRECT"
                    else f"Action not recommended by chart ({actual_action})"
                )
                feedback = (
                    f"The {chart_stack_bb}bb chart gives {actual_action} "
                    f"{action_frequency:.0%} frequency for {matrix_key} from {position} "
                    f"in this spot; this decision is "
                    f"{'chart-approved' if decision_assessment == 'CORRECT' else 'not chart-approved'}."
                )
            else:
                action_description = hero_action or "no action"
                feedback = (
                    f"A {chart_stack_bb}bb chart is available for this spot, but "
                    f"Hero's {action_description} action cannot be assessed from the recorded hand."
                )

    if not assessment_available:
        legacy_result = _audit_with_legacy_logic(hand)
        legacy_result["chart_stack_bb"] = chart_stack_bb
        return legacy_result

    return {
        "hand_id": hand.get("hand_id"),
        "matrix_key": matrix_key,
        "position": position,
        "stack_depth_bb": stack_bb,
        "chart_stack_bb": chart_stack_bb,
        "facing_action": facing_action,
        "opener_position": hand.get("opener_position"),
        "net_profit": profit,
        "decision_assessment": decision_assessment,
        "analysis_source": "CHART",
        "chart_action_frequency": action_frequency,
        "voluntarily_played": hero_action in ("call", "raise", "bet", "limp"),
        "recommended_action": recommended_action,
        "deviation_type": deviation,
        "feedback": feedback,
        "severity": severity,
    }


def analyze_session_hands(parsed_hands: list[dict]) -> dict:
    audited_hands = [audit_single_hand(hand) for hand in parsed_hands]
    mistakes = [hand for hand in audited_hands if hand["decision_assessment"] == "INCORRECT"]
    critical_blunders = [hand for hand in mistakes if hand["severity"] == "CRITICAL"]

    played_weak_hands = sum(
        1 for hand in mistakes if hand["voluntarily_played"]
    )
    folded_playable_hands = sum(
        1 for hand in mistakes if hand["deviation_type"].endswith("(FOLD)")
    )
    passive_calls_on_premiums = sum(
        1 for hand in mistakes
        if hand["deviation_type"].endswith("(CALL)")
        and "RAISE" in hand["recommended_action"]
    )
    decisions_scored = sum(
        1 for hand in audited_hands if hand["decision_assessment"] != "UNASSESSED"
    )

    return {
        "total_hands_analyzed": len(audited_hands),
        "total_mistakes_detected": len(mistakes),
        "critical_blunders_count": len(critical_blunders),
        "decisions_scored": decisions_scored,
        "decisions_unscored": len(audited_hands) - decisions_scored,
        "legacy_logic_hands": sum(1 for hand in audited_hands if hand["analysis_source"] == "LEGACY_LOGIC"),
        "leak_breakdown": {
            "played_weak_hands": played_weak_hands,
            "folded_playable_hands": folded_playable_hands,
            "passive_calls_on_premiums": passive_calls_on_premiums,
        },
        "audited_hand_details": audited_hands,
    }
