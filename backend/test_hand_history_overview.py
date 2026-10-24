import unittest
from pathlib import Path

from backend.hand_history_overview import (
    _parse_hand,
    _split_hands,
    build_hand_history_overview,
)


PROJECT_ROOT = Path(__file__).resolve().parent.parent


POKERSTARS_HAND = """Betfair Hand #262405682762: Tournament #4039880417, $4.40+$0.60 USD Hold'em No Limit - Level I (10/20) - 2026/10/15
Table '1' 6-max Seat #1 is the button
Seat 1: Opponent (1,000 in chips)
Seat 2: bullets685 (1,000 in chips)
Seat 3: Player3 (1,000 in chips)
Seat 4: Player4 (1,000 in chips)
Seat 5: Player5 (1,000 in chips)
Seat 6: Player6 (1,000 in chips)
*** HOLE CARDS ***
Dealt to bullets685 [As Kd]
Opponent: folds
bullets685: raises 40 to 60
Player3: folds
Player4: calls 60
Player5: folds
Player6: folds
*** FLOP *** [2c 3d 4h]
Player4: checks
bullets685: bets 60
Player4: folds
*** SUMMARY ***
Board [2c 3d 4h]
bullets685 collected (120)
"""


class HandHistoryOverviewTests(unittest.TestCase):
    def test_splitter_handles_both_room_formats(self):
        history = POKERSTARS_HAND + "\n\n" + POKERSTARS_HAND.replace(
            "Betfair Hand #262405682762", "Poker Hand #TM123456"
        )
        self.assertEqual(len(_split_hands(history)), 2)

    def test_parses_legacy_room_hud_and_position(self):
        parsed = _parse_hand(
            POKERSTARS_HAND,
            "pokerstars/history.txt",
            "bullets685",
            "PokerStars / Betfair",
        )
        self.assertIsNotNone(parsed)
        assert parsed is not None
        self.assertEqual(parsed["position"], "SB")
        self.assertEqual(parsed["big_blind"], 20)
        self.assertTrue(parsed["vpip"])
        self.assertTrue(parsed["pfr"])
        self.assertTrue(parsed["cbet"])
        self.assertEqual(parsed["post_bets_raises"], 1)

    def test_blind_posts_do_not_hide_three_bet_opportunities(self):
        hand = POKERSTARS_HAND.replace(
            "*** HOLE CARDS ***",
            "bullets685: posts small blind 10\n*** HOLE CARDS ***",
        ).replace(
            "bullets685: raises 40 to 60",
            "Opponent: raises 40 to 60\nbullets685: raises 100 to 160",
        )
        parsed = _parse_hand(hand, "history.txt", "bullets685", "PokerStars / Betfair")
        self.assertIsNotNone(parsed)
        assert parsed is not None
        self.assertTrue(parsed["three_bet_opportunity"])
        self.assertTrue(parsed["three_bet"])

    def test_four_bet_spot_is_not_counted_as_three_bet_opportunity_or_action(self):
        hand = POKERSTARS_HAND.replace(
            "Opponent: folds\nbullets685: raises 40 to 60",
            "Opponent: raises 40 to 60\nPlayer3: raises 100 to 160\nbullets685: raises 300 to 360",
        )
        parsed = _parse_hand(hand, "history.txt", "bullets685", "PokerStars / Betfair")
        self.assertIsNotNone(parsed)
        assert parsed is not None
        self.assertFalse(parsed["three_bet_opportunity"])
        self.assertFalse(parsed["three_bet"])

    def test_preflop_all_in_reaching_board_counts_saw_flop_without_flop_action(self):
        hand = POKERSTARS_HAND.replace(
            "bullets685: raises 40 to 60",
            "bullets685: raises 940 to 1,000 and is all-in",
        ).replace(
            "bullets685: bets 60\nPlayer4: folds",
            "Player4: checks",
        ).replace(
            "*** SUMMARY ***",
            "*** SHOW DOWN ***\nbullets685: shows [As Kd]\n*** SUMMARY ***",
        ).replace(
            "bullets685 collected (120)",
            "Seat 2: bullets685 showed [As Kd] and won (120)",
        )
        parsed = _parse_hand(hand, "history.txt", "bullets685", "PokerStars / Betfair")
        self.assertIsNotNone(parsed)
        assert parsed is not None
        self.assertTrue(parsed["saw_flop"])
        self.assertFalse(parsed["cbet_opportunity"])

    def test_preflop_fold_does_not_count_saw_flop_when_other_players_run_board(self):
        hand = POKERSTARS_HAND.replace(
            "bullets685: raises 40 to 60",
            "bullets685: folds",
        ).replace(
            "bullets685 collected (120)",
            "Seat 2: bullets685 folded before Flop\nSeat 3: Opponent collected (120)",
        )
        parsed = _parse_hand(hand, "history.txt", "bullets685", "PokerStars / Betfair")
        self.assertIsNotNone(parsed)
        assert parsed is not None
        self.assertFalse(parsed["saw_flop"])

    def test_table_showdown_marker_does_not_count_when_hero_folded(self):
        hand = POKERSTARS_HAND.replace(
            "*** SUMMARY ***",
            "*** SHOW DOWN ***\n"
            "Opponent: shows [Qc Qd]\n"
            "*** SUMMARY ***",
        ).replace(
            "bullets685 collected (120)",
            "Seat 2: bullets685 folded on the Flop\n"
            "Seat 3: Opponent showed [Qc Qd] and won (120)",
        )
        parsed = _parse_hand(hand, "history.txt", "bullets685", "PokerStars / Betfair")
        self.assertIsNotNone(parsed)
        assert parsed is not None
        self.assertFalse(parsed["showdown"])
        self.assertFalse(parsed["won_showdown"])

    def test_hero_showdown_and_win_use_hero_summary_line(self):
        hand = POKERSTARS_HAND.replace(
            "*** SUMMARY ***",
            "*** SHOW DOWN ***\nbullets685: shows [As Kd]\n*** SUMMARY ***",
        ).replace(
            "bullets685 collected (120)",
            "Seat 2: bullets685 showed [As Kd] and won (120)",
        )
        parsed = _parse_hand(hand, "history.txt", "bullets685", "PokerStars / Betfair")
        self.assertIsNotNone(parsed)
        assert parsed is not None
        self.assertTrue(parsed["showdown"])
        self.assertTrue(parsed["won_hand"])
        self.assertTrue(parsed["won_showdown"])

    def test_hero_summary_without_showdown_section_is_not_a_showdown(self):
        hand = POKERSTARS_HAND.replace(
            "bullets685 collected (120)",
            "Seat 2: bullets685 showed [As Kd] and won (120)",
        )
        parsed = _parse_hand(hand, "history.txt", "bullets685", "PokerStars / Betfair")
        self.assertIsNotNone(parsed)
        assert parsed is not None
        self.assertFalse(parsed["showdown"])
        self.assertFalse(parsed["won_showdown"])

    def test_opponent_bet_before_hero_removes_cbet_opportunity(self):
        hand = POKERSTARS_HAND.replace(
            "Player4: checks\nbullets685: bets 60",
            "Player4: bets 60\nbullets685: calls 60",
        )
        parsed = _parse_hand(hand, "history.txt", "bullets685", "PokerStars / Betfair")
        self.assertIsNotNone(parsed)
        assert parsed is not None
        self.assertFalse(parsed["cbet_opportunity"])
        self.assertFalse(parsed["cbet"])

    def test_overview_includes_both_local_room_formats_and_legacy_metrics(self):
        overview = build_hand_history_overview(PROJECT_ROOT / "hand_histories")
        self.assertGreater(overview["total_hands"], 0)
        self.assertEqual(overview["total_hands"], len(overview["hands"]))
        self.assertGreaterEqual(overview["files_scanned"], 2)
        self.assertIn("GGPoker", overview["summary"]["rooms"])
        self.assertIn("PokerStars / Betfair", overview["summary"]["rooms"])
        self.assertIn("vpip_percent", overview["summary"])
        self.assertIn("three_bet_opportunities", overview["summary"])
        self.assertLess(overview["summary"]["showdown_hand_percent"], 20)
        self.assertEqual(
            overview["summary"]["went_to_showdown_percent"],
            round(overview["summary"]["showdowns"] / overview["summary"]["saw_flop_hands"] * 100, 1),
        )
        self.assertEqual(
            overview["summary"]["vpip_pfr_gap"],
            round(
                100 * (
                    sum(hand["vpip"] for hand in overview["hands"])
                    - sum(hand["pfr"] for hand in overview["hands"])
                ) / overview["total_hands"],
                1,
            ),
        )
        self.assertTrue(overview["position_stats"])
        self.assertTrue(overview["leak_flags"])


if __name__ == "__main__":
    unittest.main()
