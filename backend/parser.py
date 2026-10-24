# parser.py
import re

RANKS = "23456789TJQKA"
CHART_POSITION_ORDER = ["BTN", "SB", "BB", "EP1", "EP2", "EP3", "LJ", "HJ", "CO"]

def convert_to_matrix_key(card_str: str) -> str:
    cards = card_str.strip().split()
    if len(cards) != 2:
        return ""
    c1, c2 = cards[0], cards[1]
    r1, s1 = c1[0], c1[1]
    r2, s2 = c2[0], c2[1]

    if RANKS.index(r1) < RANKS.index(r2):
        r1, r2 = r2, r1
        s1, s2 = s2, s1

    if r1 == r2:
        return f"{r1}{r2}"
    elif s1 == s2:
        return f"{r1}{r2}s"
    else:
        return f"{r1}{r2}o"

def get_player_positions(block: str) -> dict[str, str]:
    """Determine player positions using the position names found in preflop charts."""
    btn_match = re.search(r"Seat #(\d+) is the button", block)
    if not btn_match:
        return {}
    btn_seat = int(btn_match.group(1))

    # parse seat numbers and player names
    hole_cards_idx = block.find("*** HOLE CARDS ***")
    header = block[:hole_cards_idx] if hole_cards_idx != -1 else block
    seat_player_matches = re.findall(r"Seat (\d+):\s*([^(\n]+?)\s*\(\d+[\d,]* in chips\)", header)
    if not seat_player_matches:
        return {}

    seat_to_player = {int(s): p.strip() for s, p in seat_player_matches}
    active_seats = sorted(seat_to_player.keys())
    if btn_seat not in active_seats:
        return {}

    num_players = len(active_seats)
    btn_idx = active_seats.index(btn_seat)

    positions = {}
    if 3 <= num_players <= len(CHART_POSITION_ORDER):
        positions_by_button = ["BTN", "SB", "BB"]
        early_positions = CHART_POSITION_ORDER[3:]
        early_position_count = num_players - 3
        if early_position_count:
            positions_by_button.extend(early_positions[-early_position_count:])
    elif num_players == 2:
        positions_by_button = ["BTN", "BB"]
    else:
        positions_by_button = []

    for idx, seat in enumerate(active_seats):
        player = seat_to_player[seat]
        pos_offset = (idx - btn_idx) % num_players
        if positions_by_button:
            positions[player] = positions_by_button[pos_offset]
        elif pos_offset == 0:
            positions[player] = "BTN"
        elif pos_offset == 1:
            positions[player] = "SB"
        elif pos_offset == 2:
            positions[player] = "BB"
        elif pos_offset == 3:
            positions[player] = "UTG"
        elif pos_offset == num_players - 1:
            positions[player] = "CO"
        else:
            positions[player] = "MP"

    return positions

def determine_hero_position(block: str) -> str:
    """Convenience helper to extract Hero's position."""
    positions = get_player_positions(block)
    return positions.get("Hero", "UNKNOWN")

def parse_preflop_actions(block: str, player_positions: dict[str, str]) -> dict:
    """
    Parses preflop action lines occurring before Hero acts.
    Determines whether Hero faces an unopened pot, a limp, an open raise,
    or a 3-bet / all-in shove, along with the opener's table position.
    """
    hole_cards_idx = block.find("*** HOLE CARDS ***")
    if hole_cards_idx == -1:
        return {
            "actions_before_hero": [],
            "facing_action": "UNOPENED",
            "is_facing_raise": False,
            "is_facing_all_in": False,
            "opener_position": None,
            "num_raises_before_hero": 0,
            "num_callers_before_hero": 0,
            "hero_first_action": None,
            "hero_first_action_is_all_in": False
        }

    # preflop action is bounded by flop, showdown, or summary
    end_indices = [
        block.find(marker) for marker in ("*** FLOP ***", "*** SHOWDOWN ***", "*** SUMMARY ***")
        if block.find(marker) != -1
    ]
    end_idx = min(end_indices) if end_indices else len(block)
    preflop_text = block[hole_cards_idx:end_idx]

    actions_before_hero = []
    hero_first_action = None
    hero_first_action_is_all_in = False

    for line in preflop_text.split("\n"):
        line = line.strip()
        if not line or line.startswith("***") or line.startswith("Dealt to") or line.startswith("Uncalled bet"):
            continue

        match = re.match(r"^([^:]+):\s+(.*)$", line)
        if not match:
            continue

        player, act_text = match.group(1).strip(), match.group(2).strip()

        # stop when Hero acts for the first time
        if player == "Hero":
            if "folds" in act_text:
                hero_first_action = "fold"
            elif "calls" in act_text:
                hero_first_action = "call"
            elif "raises" in act_text:
                hero_first_action = "raise"
            elif "checks" in act_text:
                hero_first_action = "check"
            elif "bets" in act_text:
                hero_first_action = "bet"
            hero_first_action_is_all_in = "and is all-in" in act_text
            break

        # actions by other players prior to Hero
        action_type = "unknown"
        if "folds" in act_text:
            action_type = "fold"
        elif "calls" in act_text:
            action_type = "call"
        elif "raises" in act_text:
            action_type = "raise"
        elif "checks" in act_text:
            action_type = "check"
        elif "bets" in act_text:
            action_type = "bet"

        is_all_in = "and is all-in" in act_text
        amounts = re.findall(r"(\d+[\d,]*)", act_text)
        amount = float(amounts[-1].replace(",", "")) if amounts else 0.0

        pos = player_positions.get(player, "UNKNOWN")
        actions_before_hero.append({
            "player": player,
            "position": pos,
            "action": action_type,
            "amount": amount,
            "is_all_in": is_all_in,
            "text": act_text
        })

    raises = [a for a in actions_before_hero if a["action"] in ("raise", "bet")]
    calls = [a for a in actions_before_hero if a["action"] == "call"]

    num_raises = len(raises)
    num_callers = len(calls)
    is_facing_all_in = any(r["is_all_in"] for r in raises)
    opener_pos = raises[0]["position"] if raises else None

    if num_raises == 0:
        if num_callers == 0:
            facing_action = "UNOPENED"
        else:
            facing_action = "FACING_LIMP"
    elif num_raises == 1:
        facing_action = "FACING_OPEN_SHOVE" if is_facing_all_in else "FACING_OPEN_RAISE"
    else:
        facing_action = "FACING_3BET_SHOVE" if is_facing_all_in else "FACING_3BET"

    return {
        "actions_before_hero": actions_before_hero,
        "facing_action": facing_action,
        "is_facing_raise": num_raises > 0,
        "is_facing_all_in": is_facing_all_in,
        "opener_position": opener_pos,
        "num_raises_before_hero": num_raises,
        "num_callers_before_hero": num_callers,
        "hero_first_action": hero_first_action,
        "hero_first_action_is_all_in": hero_first_action_is_all_in
    }

def parse_gg_hand_history(text_content: str) -> list[dict]:
    raw_hands = text_content.strip().split("\n\n\n")
    if len(raw_hands) == 1:
        raw_hands = re.split(r"(?=Poker Hand #)", text_content)

    parsed_hands = []

    for block in raw_hands:
        if not block.strip():
            continue

        hand_id_match = re.search(r"Poker Hand #(TM\d+):", block)
        hand_id = hand_id_match.group(1) if hand_id_match else "Unknown"

        bb_match = re.search(r"Level\d+\(\d+[\d,]*/(\d+[\d,]*)", block)
        big_blind = float(bb_match.group(1).replace(",", "")) if bb_match else 1.0

        # extract Hero starting stack
        hero_stack_match = re.search(r"Seat \d+: Hero \((\d+[\d,]*) in chips\)", block)
        hero_stack = float(hero_stack_match.group(1).replace(",", "")) if hero_stack_match else 0.0
        stack_depth_bb = round(hero_stack / big_blind, 1) if big_blind > 0 else 0.0

        hero_cards_match = re.search(r"Dealt to Hero \[([2-9TJQKA][shdc] [2-9TJQKA][shdc])\]", block)
        if not hero_cards_match:
            continue
            
        raw_cards = hero_cards_match.group(1)
        matrix_key = convert_to_matrix_key(raw_cards)

        # parse position and previous actions
        positions = get_player_positions(block)
        hero_pos = positions.get("Hero", determine_hero_position(block))
        preflop_info = parse_preflop_actions(block, positions)

        board_match = re.search(r"Board \[([^\]]+)\]", block)
        board = board_match.group(1) if board_match else ""

        pot_match = re.search(r"Total pot (\d+[\d,]*)", block)
        total_pot = float(pot_match.group(1).replace(",", "")) if pot_match else 0.0

        hero_win_match = re.search(r"Seat \d+: Hero .* collected \((\d+[\d,]*)\)", block) or \
                         re.search(r"Seat \d+: Hero .* won \((\d+[\d,]*)\)", block) or \
                         re.search(r"Hero collected (\d+[\d,]*) from pot", block)
        
        hero_invested = 0.0
        for line in block.split("\n"):
            if line.startswith("Hero:") or line.startswith("Hero posts"):
                amounts = re.findall(r"(\d+[\d,]*)", line)
                if amounts:
                    hero_invested += float(amounts[-1].replace(",", ""))

        if hero_win_match:
            win_amount = float(hero_win_match.group(1).replace(",", ""))
            net_profit = win_amount - hero_invested
        else:
            net_profit = -hero_invested

        hero_all_in = "and is all-in" in block and ("Hero: raises" in block or "Hero: calls" in block)

        parsed_hands.append({
            "hand_id": hand_id,
            "raw_cards": raw_cards,
            "matrix_key": matrix_key,
            "position": hero_pos,
            "starting_stack_bb": stack_depth_bb,
            "big_blind": big_blind,
            "board": board,
            "total_pot": total_pot,
            "hero_invested": hero_invested,
            "net_profit": net_profit,
            "saw_showdown": "*** SHOWDOWN ***" in block,
            "is_all_in": hero_all_in,
            "facing_action": preflop_info["facing_action"],
            "is_facing_raise": preflop_info["is_facing_raise"],
            "is_facing_all_in": preflop_info["is_facing_all_in"],
            "opener_position": preflop_info["opener_position"],
            "num_raises_before_hero": preflop_info["num_raises_before_hero"],
            "num_callers_before_hero": preflop_info["num_callers_before_hero"],
            "actions_before_hero": preflop_info["actions_before_hero"],
            "hero_first_action": preflop_info["hero_first_action"],
            "hero_first_action_is_all_in": preflop_info["hero_first_action_is_all_in"]
        })

    return parsed_hands

    return parsed_hands