# 1. Unopened Pot Opening Ranges (Raise First In)
POSITIONAL_RANGES = {
    "UTG": {"AA", "KK", "QQ", "JJ", "TT", "99", "AKs", "AQs", "AJs", "ATs", "KQs", "AKo", "AQo"},
    "MP":  {"AA", "KK", "QQ", "JJ", "TT", "99", "88", "AKs", "AQs", "AJs", "ATs", "KQs", "KJs", "QJs", "JTs", "AKo", "AQo", "AJo"},
    "CO":  {"AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A5s", "KQs", "KJs", "KTs", "QJs", "QTs", "JTs", "98s", "AKo", "AQo", "AJo", "ATo", "KQo"},
    "BTN": {"AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33", "22", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "QJs", "QTs", "JTs", "T9s", "98s", "87s", "76s", "65s", "AKo", "AQo", "AJo", "ATo", "A9o", "KQo", "KJo", "QJo"},
    "SB":  {"AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A5s", "A4s", "KQs", "KJs", "KTs", "QJs", "QTs", "JTs", "T9s", "98s", "87s", "AKo", "AQo", "AJo", "ATo", "KQo"},
    "BB":  {"AA", "KK", "QQ", "JJ", "TT", "99", "88", "AKs", "AQs", "AJs", "ATs", "A5s", "KQs", "KJs", "QJs", "JTs", "AKo", "AQo", "AJo"}
}

# 2. Short-Stack Push/Fold Shove Range (< 15bb) for Unopened Pots
SHORT_STACK_SHOVE_RANGE = {
    "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33", "22",
    "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A5s", "A4s", "KQs", "KJs", "KTs", "QJs", "QTs", "JTs", "T9s",
    "AKo", "AQo", "AJo", "ATo", "A9o", "KQo", "KJo"
}

# 3. Facing Open Raise Continue Ranges (Call or 3-Bet)
CONTINUE_VS_EP_OPEN = {
    "AA", "KK", "QQ", "JJ", "TT", "99", "88",
    "AKs", "AQs", "AJs", "ATs", "KQs", "QJs", "JTs",
    "AKo", "AQo"
}

CONTINUE_VS_LP_OPEN = {
    "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55",
    "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A5s", "A4s",
    "KQs", "KJs", "KTs", "QJs", "QTs", "JTs", "T9s", "98s", "87s",
    "AKo", "AQo", "AJo", "ATo", "KQo", "KJo"
}

# 4. Facing All-In Shove Calling Range
CALL_SHOVE_RANGE = {
    "AA", "KK", "QQ", "JJ", "TT", "99", "88",
    "AKs", "AQs", "AJs", "ATs",
    "AKo", "AQo", "AJo"
}

# 5. Facing 3-Bet / Multi-Way Raise Continue Range
CONTINUE_VS_3BET = {
    "AA", "KK", "QQ", "JJ", "TT", "AKs", "AQs", "AKo"
}

PREMIUM_HANDS = {"AA", "KK", "QQ", "AKs", "AKo"}

def audit_single_hand(hand: dict) -> dict:
    matrix_key = hand.get("matrix_key", "")
    position = hand.get("position", "BTN")
    stack_bb = hand.get("starting_stack_bb", 20.0)
    invested = hand.get("hero_invested", 0.0)
    big_blind = hand.get("big_blind", 1.0)
    profit = hand.get("net_profit", 0.0)
    is_all_in = hand.get("is_all_in", False)

    # previous situational context parsed from action before Hero
    facing_action = hand.get("facing_action", "UNOPENED")
    is_facing_all_in = hand.get("is_facing_all_in", False)
    opener_pos = hand.get("opener_position")
    num_raises = hand.get("num_raises_before_hero", 0)
    hero_first_act = hand.get("hero_first_action")

    # Hero voluntarily put extra chips into pot beyond the blind/ante baseline
    voluntarily_played = (invested > big_blind * 1.1)

    deviation = "Optimal Action"
    recommendation = "Played correctly according to situational ranges."
    mistake_severity = "NONE"
    should_play = False

    # SCENARIO 1: Hero faces an All-In Shove
    if is_facing_all_in or facing_action in ("FACING_OPEN_SHOVE", "FACING_3BET_SHOVE"):
        should_play = matrix_key in CALL_SHOVE_RANGE
        if voluntarily_played or hero_first_act in ("call", "raise"):
            if not should_play:
                deviation = "Bad Call vs Shove"
                recommendation = f"At {stack_bb}bb facing an all-in shove from {opener_pos or 'villain'}, calling with {matrix_key} is -EV. Calling shoves requires premium holdings (88+, ATs+, AJo+)."
                mistake_severity = "CRITICAL"
            else:
                deviation = "Optimal Action"
                recommendation = f"Solid call with {matrix_key} facing an all-in shove."
        else:
            if matrix_key in PREMIUM_HANDS:
                deviation = "Folded Premium vs Shove"
                recommendation = f"You folded premium hand {matrix_key} facing an all-in shove."
                mistake_severity = "CRITICAL"
            else:
                deviation = "Optimal Action"
                recommendation = f"Correctly folded {matrix_key} facing an all-in shove from {opener_pos or 'villain'}."

    # SCENARIO 2: Hero faces a 3-Bet or Multi-Way Raise
    elif num_raises >= 2 or facing_action == "FACING_3BET":
        should_play = matrix_key in CONTINUE_VS_3BET
        if voluntarily_played:
            if not should_play:
                deviation = "Played Loose vs 3-Bet"
                recommendation = f"Entering the pot with {matrix_key} facing multiple raises is too loose."
                mistake_severity = "MAJOR" if not is_all_in else "CRITICAL"
            else:
                deviation = "Optimal Action"
                recommendation = f"Played correctly with premium {matrix_key} facing multiple raises."
        else:
            if matrix_key in {"AA", "KK"}:
                deviation = "Folded Premium Hand"
                recommendation = f"You folded monster hand {matrix_key} facing multiple raises."
                mistake_severity = "CRITICAL"
            else:
                deviation = "Optimal Action"
                recommendation = f"Correctly folded {matrix_key} facing multiple raises."

    # SCENARIO 3: Hero faces a Single Open Raise
    elif facing_action == "FACING_OPEN_RAISE":
        is_ep = opener_pos in ("UTG", "MP")
        continue_range = CONTINUE_VS_EP_OPEN if is_ep else CONTINUE_VS_LP_OPEN
        should_play = matrix_key in continue_range

        if voluntarily_played:
            if not should_play:
                deviation = f"Played Loose vs {opener_pos or 'Open'} Raise"
                recommendation = f"You played {matrix_key} from {position} facing an open from {opener_pos}. This hand is too weak to continue against an open from this position."
                mistake_severity = "MAJOR" if not is_all_in else "CRITICAL"
            elif matrix_key in PREMIUM_HANDS and hero_first_act == "call" and not is_all_in:
                deviation = "Passive Call on Premium"
                recommendation = f"You passively called with {matrix_key} facing an open from {opener_pos}. You should 3-bet for value."
                mistake_severity = "MAJOR"
            else:
                deviation = "Optimal Action"
                recommendation = f"Correctly continued with {matrix_key} from {position} facing an open from {opener_pos}."
        else:
            if matrix_key in PREMIUM_HANDS:
                deviation = "Folded Premium Hand"
                recommendation = f"You folded premium hand {matrix_key} from {position} facing an open from {opener_pos}."
                mistake_severity = "CRITICAL"
            else:
                deviation = "Optimal Action"
                recommendation = f"Correctly folded {matrix_key} from {position} facing an open raise from {opener_pos}."

    # SCENARIO 4: Hero faces Limpers
    elif facing_action == "FACING_LIMP":
        valid_range = POSITIONAL_RANGES.get(position, POSITIONAL_RANGES["BTN"])
        should_play = matrix_key in valid_range
        if voluntarily_played:
            if not should_play:
                deviation = "Loose Play vs Limp"
                recommendation = f"Entering the pot with {matrix_key} over limpers is too speculative."
                mistake_severity = "MAJOR"
            else:
                deviation = "Optimal Action"
                recommendation = f"Played correctly with {matrix_key} over limpers."
        else:
            if should_play and profit < 0:
                deviation = "Folded Playable Hand vs Limpers"
                recommendation = f"You folded {matrix_key} from {position} with limpers in the pot; this hand can isolate or over-limp."
                mistake_severity = "MINOR"
            else:
                deviation = "Optimal Action"
                recommendation = f"Correctly folded weak hand {matrix_key} over limpers."

    # SCENARIO 5: Unopened Pot (Folded to Hero or Hero is first to act)
    else:
        is_short_stacked = stack_bb <= 15.0
        valid_playable_range = SHORT_STACK_SHOVE_RANGE if is_short_stacked else POSITIONAL_RANGES.get(position, POSITIONAL_RANGES["BTN"])
        should_play = matrix_key in valid_playable_range

        if is_short_stacked:
            if is_all_in and not should_play:
                deviation = "Bad Short-Stack Shove"
                recommendation = f"At {stack_bb}bb in position {position}, shoving with {matrix_key} is too weak."
                mistake_severity = "CRITICAL"
            elif not voluntarily_played and should_play and profit < 0:
                deviation = "Passed Up Short-Stack Shove"
                recommendation = f"At {stack_bb}bb in position {position}, {matrix_key} is a profitable push/fold shove."
                mistake_severity = "MAJOR"
            elif voluntarily_played and not should_play:
                deviation = f"Played Loose in {position}"
                recommendation = f"You entered an unopened pot with {matrix_key} at {stack_bb}bb. Push/fold shove or fold."
                mistake_severity = "MAJOR"
            else:
                deviation = "Optimal Action"
                recommendation = f"Played correctly for position {position} at {stack_bb}bb stack depth in an unopened pot."
        else:
            if not voluntarily_played and should_play and profit < 0:
                deviation = f"Folded Playable Hand ({position})"
                recommendation = f"You folded {matrix_key} from {position} in an unopened pot. This hand is inside standard opening ranges."
                mistake_severity = "MINOR"
            elif voluntarily_played and not should_play:
                deviation = f"Played Loose in {position}"
                recommendation = f"You opened {matrix_key} from {position}. This hand is too weak for standard opening ranges."
                mistake_severity = "MAJOR" if not is_all_in else "CRITICAL"
            else:
                deviation = "Optimal Action"
                recommendation = f"Played correctly for position {position} in an unopened pot."

    return {
        "hand_id": hand.get("hand_id"),
        "matrix_key": matrix_key,
        "position": position,
        "stack_depth_bb": stack_bb,
        "facing_action": facing_action,
        "opener_position": opener_pos,
        "net_profit": profit,
        "voluntarily_played": voluntarily_played,
        "recommended_action": "PLAY/RAISE" if should_play else "FOLD",
        "deviation_type": deviation,
        "feedback": recommendation,
        "severity": mistake_severity
    }

def analyze_session_hands(parsed_hands: list[dict]) -> dict:
    audited_hands = [audit_single_hand(h) for h in parsed_hands]

    total_hands = len(audited_hands)
    mistakes = [h for h in audited_hands if h["severity"] != "NONE"]
    critical_blunders = [h for h in audited_hands if h["severity"] == "CRITICAL"]

    played_weak_hands = sum(
        1 for h in audited_hands
        if any(term in h["deviation_type"] for term in ("Played Loose", "Played Weak", "Bad Call", "Bad Short-Stack", "Loose Play"))
    )
    folded_playable_hands = sum(
        1 for h in audited_hands
        if any(term in h["deviation_type"] for term in ("Folded Playable", "Passed Up", "Folded Premium"))
    )
    passive_calls_on_premiums = sum(
        1 for h in audited_hands
        if any(term in h["deviation_type"] for term in ("Passive", "Called Instead"))
    )

    return {
        "total_hands_analyzed": total_hands,
        "total_mistakes_detected": len(mistakes),
        "critical_blunders_count": len(critical_blunders),
        "leak_breakdown": {
            "played_weak_hands": played_weak_hands,
            "folded_playable_hands": folded_playable_hands,
            "passive_calls_on_premiums": passive_calls_on_premiums
        },
        "audited_hand_details": audited_hands
    }