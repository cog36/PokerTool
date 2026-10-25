import re
from collections import defaultdict
from pathlib import Path
from typing import Any

# constants for file paths and formatting
PROJECT_ROOT = Path(__file__).resolve().parent.parent
HAND_HISTORY_DIR = PROJECT_ROOT / "hand_histories"
HERO_BY_FORMAT = {
    "gg": "Hero",
    "pokerstars": "bullets685",
}
HAND_START = re.compile(r"(?=^(?:Poker Hand|PokerStars Hand|Betfair Hand) #)", re.MULTILINE)


def _split_hands(text: str) -> list[str]:
    return [
        part.strip()
        for part in HAND_START.split(text)
        if re.match(r"^(?:Poker Hand|PokerStars Hand|Betfair Hand) #", part.strip())
    ]

# extract player action from a line of hand history
def _action(line: str) -> tuple[str, str] | None:
    match = re.match(r"^(.+?):\s+(.*)$", line.strip())
    if not match:
        return None
    player, action_text = match.groups()
    action_text = action_text.lower()
    if action_text.startswith("posts "):
        action_type = "blind"
    elif action_text.startswith("folds"):
        action_type = "fold"
    elif action_text.startswith("checks"):
        action_type = "check"
    elif action_text.startswith("calls"):
        action_type = "call"
    elif action_text.startswith("bets"):
        action_type = "bet"
    elif action_text.startswith("raises"):
        action_type = "raise"
    elif "is all-in" in action_text:
        action_type = "allin"
    else:
        return None
    return player, action_type

# get the table position of hero based on hand history and hero name
def _table_position(hand: str, hero: str) -> str:
    table = re.search(r"Table .*?(\d+)-max Seat #(\d+) is the button", hand)
    if table:
        capacity, button = int(table.group(1)), int(table.group(2))
    else:
        button_match = re.search(r"Seat #(\d+) is the button", hand)
        if not button_match:
            return "Unknown"
        button = int(button_match.group(1))
        seat_numbers = [int(seat) for seat in re.findall(r"Seat (\d+):", hand)]
        capacity = max(seat_numbers + [button])

    seats = {
        match.group(2): int(match.group(1))
        for match in re.finditer(r"Seat (\d+):\s*(.+?)\s+\([\d,]+ in chips\)", hand)
    }
    hero_seat = seats.get(hero)
    if hero_seat is None or capacity <= 0:
        return "Unknown"

    clockwise = sorted(seats.values(), key=lambda seat: (seat - button) % capacity)
    if hero_seat not in clockwise:
        return "Unknown"
    index = clockwise.index(hero_seat)
    player_count = len(clockwise)
    if index == 0:
        return "BTN"
    if index == 1:
        return "SB"
    if index == 2:
        return "BB"
    if index == player_count - 1:
        return "CO"
    if index == player_count - 2:
        return "HJ"
    early_index = index - 3
    if early_index == 0:
        return "UTG"
    if player_count >= 8 and early_index == 1:
        return "UTG+1"
    if player_count >= 9 and early_index == 2:
        return "UTG+2"
    return "MP"


def _hero_summary_line(summary: str, hero: str) -> str:
    match = re.search(
        r"^\s*Seat\s+\d+:\s*" + re.escape(hero) + r"(?=\s|$).*$",
        summary,
        re.MULTILINE | re.IGNORECASE,
    )
    return match.group(0).strip() if match else ""

# parse a single hand and extract statistics and actions of hero
def _parse_hand(raw: str, source_file: str, hero: str, room: str) -> dict[str, Any] | None:
    header_match = re.search(
        r"^((?:Poker Hand|PokerStars Hand|Betfair Hand) #([^:\s]+):[^\r\n]*)",
        raw,
        re.MULTILINE,
    )
    if not header_match:
        return None
    header, hand_id = header_match.groups()
    tournament_match = re.search(r"Tournament #(\d+)", raw, re.IGNORECASE)
    tournament_id = tournament_match.group(1) if tournament_match else ""

    streets: dict[str, list[tuple[str, str]]] = {
        "preflop": [],
        "flop": [],
        "turn": [],
        "river": [],
    }
    current_street = "preflop"
    for line in raw.splitlines():
        stripped = line.strip()
        if stripped.startswith("*** FLOP ***"):
            current_street = "flop"
            continue
        if stripped.startswith("*** TURN ***"):
            current_street = "turn"
            continue
        if stripped.startswith("*** RIVER ***"):
            current_street = "river"
            continue
        if stripped.startswith(("*** SHOW DOWN ***", "*** SHOWDOWN ***", "*** SUMMARY ***")):
            continue
        event = _action(stripped)
        if event:
            streets[current_street].append(event)

    preflop = [
        (player, action)
        for player, action in streets["preflop"]
        if action != "blind"
    ]
    hero_preflop = [action for player, action in preflop if player == hero]
    first_hero_action = next(
        (index for index, (player, _) in enumerate(preflop) if player == hero),
        None,
    )
    prior_raises = (
        sum(action == "raise" for _, action in preflop[:first_hero_action])
        if first_hero_action is not None
        else 0
    )
    three_bet_opportunity = first_hero_action is not None and prior_raises == 1
    three_bet = bool(
        three_bet_opportunity
        and prior_raises == 1
        and preflop[first_hero_action][1] == "raise"
    )
    last_raiser = next(
        (player for player, action in reversed(preflop) if action == "raise"),
        None,
    )
    flop_actions = streets["flop"]
    first_flop_aggressor = next(
        (player for player, action in flop_actions if action in ("bet", "raise")),
        None,
    )
    summary = raw.split("*** SUMMARY ***")[-1] if "*** SUMMARY ***" in raw else raw
    hero_summary = _hero_summary_line(summary, hero)
    hero_folded_preflop = any(
        player == hero and action == "fold"
        for player, action in preflop
    )
    hero_folded_before_flop = bool(
        re.search(r"\bfolded before Flop\b", hero_summary, re.IGNORECASE)
    )
    saw_flop = bool(
        "*** FLOP ***" in raw
        and not hero_folded_preflop
        and not hero_folded_before_flop
    )
    first_hero_flop_action = next(
        (index for index, (player, _) in enumerate(flop_actions) if player == hero),
        None,
    )
    cbet_opportunity = bool(
        saw_flop
        and last_raiser == hero
        and first_hero_flop_action is not None
        and not any(
            action in ("bet", "raise")
            for _, action in flop_actions[:first_hero_flop_action]
        )
    )
    cbet = bool(cbet_opportunity and first_flop_aggressor == hero)
    has_showdown_section = bool(re.search(r"\*\*\* SHOW ?DOWN \*\*\*", raw))
    saw_showdown = bool(
        has_showdown_section
        and re.search(r"\b(?:showed|mucked)\b", hero_summary, re.IGNORECASE)
    )
    won_hand = bool(re.search(r"\b(?:collected|won)\s*\(", hero_summary, re.IGNORECASE))
    postflop_actions = [
        action
        for street in ("flop", "turn", "river")
        for player, action in streets[street]
        if player == hero
    ]
    place_match = re.search(
        re.escape(hero) + r" finished the tournament in (\d+)(?:st|nd|rd|th) place",
        raw,
        re.IGNORECASE,
    )
    blind_match = re.search(r"Level\s+[^()]+\(([\d,]+)[/,]([\d,]+)\)", header)
    if not blind_match:
        blind_match = re.search(r"Level\d+\(([\d,]+)[/,]([\d,]+)", header)
    small_blind = int(blind_match.group(1).replace(",", "")) if blind_match else None
    big_blind = int(blind_match.group(2).replace(",", "")) if blind_match else None

    return {
        "hand_id": hand_id,
        "tournament_id": tournament_id,
        "source_file": source_file,
        "room": room,
        "position": _table_position(raw, hero),
        "cards": (re.search(r"Dealt to " + re.escape(hero) + r" \[([^\]]+)\]", raw) or [None, ""])[1],
        "board": (re.search(r"Board \[([^\]]+)\]", summary) or [None, ""])[1],
        "small_blind": small_blind,
        "big_blind": big_blind,
        "vpip": any(action in ("call", "raise", "bet", "allin") for action in hero_preflop),
        "pfr": any(action == "raise" for action in hero_preflop),
        "three_bet_opportunity": bool(three_bet_opportunity),
        "three_bet": three_bet,
        "saw_flop": saw_flop,
        "cbet_opportunity": bool(cbet_opportunity),
        "cbet": cbet,
        "showdown": saw_showdown,
        "won_hand": won_hand,
        "won_showdown": saw_showdown and won_hand,
        "place": int(place_match.group(1)) if place_match else None,
        "post_bets_raises": sum(action in ("bet", "raise") for action in postflop_actions),
        "post_calls": sum(action == "call" for action in postflop_actions),
        "preflop_actions": " · ".join(f"{player} {action}" for player, action in preflop),
    }


def _percentage(numerator: int, denominator: int) -> float:
    return round(100 * numerator / denominator, 1) if denominator else 0.0

# leak detection based on collected hand stats
def _leak_flags(hands: list[dict[str, Any]]) -> list[dict[str, str]]:
    count = len(hands)
    vpip_count = sum(hand["vpip"] for hand in hands)
    pfr_count = sum(hand["pfr"] for hand in hands)
    vpip = 100 * vpip_count / count if count else 0.0
    pfr = 100 * pfr_count / count if count else 0.0
    gap = vpip - pfr
    three_bet_opportunities = sum(hand["three_bet_opportunity"] for hand in hands)
    three_bets = sum(hand["three_bet"] for hand in hands)
    cbet_opportunities = sum(hand["cbet_opportunity"] for hand in hands)
    cbets = sum(hand["cbet"] for hand in hands)
    flags = []
    if count < 500:
        flags.append({
            "title": "Small sample",
            "body": f"{count} hands is too small for confident conclusions. Use these stats as a starting point.",
        })
    if gap > 10:
        flags.append({
            "title": "Large VPIP–PFR gap",
            "body": f"{gap:.1f} percentage points. Review limps, cold calls and calls out of position.",
        })
    if vpip > 38 and count >= 100:
        flags.append({
            "title": "High VPIP",
            "body": f"{vpip:.1f}%. Check whether you enter too many pots, especially multiway or out of position.",
        })
    if pfr < 12 and count >= 100:
        flags.append({
            "title": "Low PFR",
            "body": f"{pfr:.1f}%. Review missed value raises and passive preflop entries.",
        })
    three_bet_rate = _percentage(three_bets, three_bet_opportunities)
    if three_bet_opportunities >= 20 and three_bet_rate < 3:
        flags.append({
            "title": "Low 3-bet frequency",
            "body": f"{three_bet_rate:.1f}% in {three_bet_opportunities} opportunities. Review value 3-bets and reshoves.",
        })
    cbet_rate = _percentage(cbets, cbet_opportunities)
    if cbet_opportunities >= 20 and cbet_rate > 80:
        flags.append({
            "title": "Very high c-bet frequency",
            "body": f"{cbet_rate:.1f}%. Check whether you c-bet automatically on multiway or poor boards.",
        })
    if not flags:
        flags.append({
            "title": "No automatic red flags",
            "body": "Thresholds did not trigger. This does not mean you have no leaks; review individual hands and stack/ICM context.",
        })
    return flags

# builds an overview of hand history statistics and errors for a given poker room
def build_hand_history_overview(history_dir: Path = HAND_HISTORY_DIR, room: str = "all") -> dict[str, Any]:
    selected_room = {"all": None, "pokerstars": "PokerStars / Betfair", "ggpoker": "GGPoker"}
    if room not in selected_room:
        raise ValueError("Unknown poker room")
    room_filter = selected_room[room]
    hands: list[dict[str, Any]] = []
    file_errors: list[dict[str, str]] = []
    total_files = 0
    supported_files = sorted(
        path for path in history_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in {".txt", ".log", ".hh"}
    )
    seen_ids: set[tuple[str, str]] = set()

    for path in supported_files:
        total_files += 1
        try:
            text = path.read_text(encoding="utf-8-sig")
        except UnicodeDecodeError as error:
            file_errors.append({
                "file": str(path.relative_to(history_dir)),
                "message": f"Could not decode UTF-8 text at byte {error.start}.",
            })
            continue
        except OSError as error:
            file_errors.append({
                "file": str(path.relative_to(history_dir)),
                "message": str(error),
            })
            continue

        relative_file = str(path.relative_to(history_dir))
        raw_hands = _split_hands(text)
        if not raw_hands:
            file_errors.append({
                "file": relative_file,
                "message": "No supported Poker Hand, PokerStars Hand, or Betfair Hand records were found.",
            })
            continue
        hero_hands_in_file = 0
        for raw_hand in raw_hands:
            hand_room = "GGPoker" if raw_hand.startswith("Poker Hand #") else "PokerStars / Betfair"
            if room_filter and hand_room != room_filter:
                continue
            hero = HERO_BY_FORMAT["gg"] if hand_room == "GGPoker" else HERO_BY_FORMAT["pokerstars"]
            if not re.search(r"Dealt to " + re.escape(hero) + r"\s+\[", raw_hand):
                continue
            hero_hands_in_file += 1
            try:
                hand = _parse_hand(raw_hand, relative_file, hero, hand_room)
            except (TypeError, ValueError, IndexError) as error:
                file_errors.append({
                    "file": relative_file,
                    "message": f"Skipped a hand that could not be parsed: {error}",
                })
                continue
            if not hand:
                continue
            unique_id = (hand_room, hand["hand_id"])
            if unique_id in seen_ids:
                continue
            seen_ids.add(unique_id)
            hands.append(hand)
        if not hero_hands_in_file and (not room_filter or any(("GGPoker" if raw.startswith("Poker Hand #") else "PokerStars / Betfair") == room_filter for raw in raw_hands)):
            file_errors.append({
                "file": relative_file,
                "message": "No hands dealt to the configured player name were found in this file.",
            })

    hands.sort(key=lambda hand: (hand["tournament_id"], hand["hand_id"]))
    hand_count = len(hands)
    vpip_count = sum(hand["vpip"] for hand in hands)
    pfr_count = sum(hand["pfr"] for hand in hands)
    three_bet_opportunities = sum(hand["three_bet_opportunity"] for hand in hands)
    three_bets = sum(hand["three_bet"] for hand in hands)
    flop_count = sum(hand["saw_flop"] for hand in hands)
    cbet_opportunities = sum(hand["cbet_opportunity"] for hand in hands)
    cbets = sum(hand["cbet"] for hand in hands)
    showdowns = sum(hand["showdown"] for hand in hands)
    won_showdowns = sum(hand["won_showdown"] for hand in hands)
    postflop_aggression = sum(hand["post_bets_raises"] for hand in hands)
    postflop_calls = sum(hand["post_calls"] for hand in hands)

    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for hand in hands:
        grouped[hand["position"]].append(hand)
    position_stats = []
    for position, position_hands in sorted(grouped.items()):
        opportunities = sum(hand["three_bet_opportunity"] for hand in position_hands)
        bets = sum(hand["three_bet"] for hand in position_hands)
        position_stats.append({
            "position": position,
            "hands": len(position_hands),
            "vpip_percent": _percentage(sum(hand["vpip"] for hand in position_hands), len(position_hands)),
            "pfr_percent": _percentage(sum(hand["pfr"] for hand in position_hands), len(position_hands)),
            "three_bet_opportunities": opportunities,
            "three_bets": bets,
            "three_bet_percent": _percentage(bets, opportunities) if opportunities else None,
            "saw_flop_percent": _percentage(sum(hand["saw_flop"] for hand in position_hands), len(position_hands)),
        })

    return {
        "room_filter": room,
        "total_hands": hand_count,
        "files_scanned": total_files,
        "source_files": len({hand["source_file"] for hand in hands}),
        "errors": file_errors,
        "summary": {
            "vpip_percent": _percentage(vpip_count, hand_count),
            "pfr_percent": _percentage(pfr_count, hand_count),
            "vpip_pfr_gap": round(
                100 * (vpip_count - pfr_count) / hand_count,
                1,
            ) if hand_count else 0.0,
            "three_bets": three_bets,
            "three_bet_opportunities": three_bet_opportunities,
            "three_bet_percent": _percentage(three_bets, three_bet_opportunities),
            "saw_flop_percent": _percentage(flop_count, hand_count),
            "c_bets": cbets,
            "c_bet_opportunities": cbet_opportunities,
            "c_bet_percent": _percentage(cbets, cbet_opportunities),
            "saw_flop_hands": flop_count,
            "showdowns": showdowns,
            "won_showdowns": won_showdowns,
            "went_to_showdown_percent": _percentage(showdowns, flop_count),
            "showdown_hand_percent": _percentage(showdowns, hand_count),
            "won_at_showdown_percent": _percentage(won_showdowns, showdowns),
            "postflop_bets_raises": postflop_aggression,
            "postflop_calls": postflop_calls,
            "postflop_aggression_ratio": round(postflop_aggression / max(1, postflop_calls), 2),
            "tournaments": len({hand["tournament_id"] for hand in hands if hand["tournament_id"]}),
            "rooms": sorted({hand["room"] for hand in hands}),
        },
        "position_stats": position_stats,
        "leak_flags": _leak_flags(hands) if hands else [],
        "hands": hands,
    }
