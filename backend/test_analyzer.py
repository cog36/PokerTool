import unittest

from analyzer import _nearest_chart_stack, analyze_session_hands, audit_single_hand
from parser import get_player_positions


def make_hand(**overrides):
    hand = {
        "hand_id": "test-hand",
        "matrix_key": "AA",
        "position": "EP2",
        "starting_stack_bb": 20.0,
        "big_blind": 1.0,
        "net_profit": 0.0,
        "facing_action": "UNOPENED",
        "num_raises_before_hero": 0,
        "num_callers_before_hero": 0,
        "actions_before_hero": [],
        "hero_first_action": "raise",
        "is_all_in": False,
        "is_facing_all_in": False,
    }
    hand.update(overrides)
    return hand


class ChartAnalysisTests(unittest.TestCase):
    def test_nearest_chart_stack_uses_closest_depth_and_rounds_ties_up(self):
        self.assertEqual(_nearest_chart_stack(7.4), 5)
        self.assertEqual(_nearest_chart_stack(7.6), 10)
        self.assertEqual(_nearest_chart_stack(15), 20)
        self.assertEqual(_nearest_chart_stack(71), 100)

    def test_unopened_raise_is_checked_against_chart_frequency(self):
        approved = audit_single_hand(make_hand())
        rejected = audit_single_hand(make_hand(hero_first_action="fold"))

        self.assertEqual(approved["decision_assessment"], "CORRECT")
        self.assertEqual(approved["analysis_source"], "CHART")
        self.assertEqual(approved["chart_action_frequency"], 1.0)
        self.assertEqual(approved["chart_stack_bb"], 20)
        self.assertEqual(rejected["decision_assessment"], "INCORRECT")

    def test_facing_open_uses_call_and_three_bet_chart_ranges(self):
        before_hero = [{
            "position": "BTN",
            "action": "raise",
            "is_all_in": False,
        }]
        call = audit_single_hand(make_hand(
            matrix_key="A5s",
            position="BB",
            facing_action="FACING_OPEN_RAISE",
            num_raises_before_hero=1,
            actions_before_hero=before_hero,
            hero_first_action="call",
        ))
        raise_action = audit_single_hand(make_hand(
            matrix_key="A5s",
            position="BB",
            facing_action="FACING_OPEN_RAISE",
            num_raises_before_hero=1,
            actions_before_hero=before_hero,
            hero_first_action="raise",
        ))

        self.assertEqual(call["decision_assessment"], "CORRECT")
        self.assertEqual(call["chart_action_frequency"], 1.0)
        self.assertEqual(raise_action["decision_assessment"], "INCORRECT")

    def test_unsupported_limped_pot_uses_legacy_logic_and_is_marked(self):
        result = audit_single_hand(make_hand(
            facing_action="FACING_LIMP",
            num_callers_before_hero=1,
            hero_invested=2.0,
        ))

        self.assertEqual(result["decision_assessment"], "CORRECT")
        self.assertEqual(result["analysis_source"], "LEGACY_LOGIC")
        self.assertIsNone(result["chart_action_frequency"])
        self.assertIn("not chart-based", result["feedback"])

    def test_multiway_raise_uses_legacy_logic_not_heads_up_chart(self):
        result = audit_single_hand(make_hand(
            position="BB",
            facing_action="FACING_OPEN_RAISE",
            num_raises_before_hero=1,
            num_callers_before_hero=1,
            actions_before_hero=[{
                "position": "BTN",
                "action": "raise",
                "is_all_in": False,
            }],
            hero_first_action="call",
            hero_invested=2.0,
        ))

        self.assertEqual(result["analysis_source"], "LEGACY_LOGIC")

    def test_session_counts_legacy_fallback_hands(self):
        result = analyze_session_hands([
            make_hand(),
            make_hand(facing_action="FACING_LIMP", num_callers_before_hero=1),
        ])

        self.assertEqual(result["decisions_scored"], 2)
        self.assertEqual(result["decisions_unscored"], 0)
        self.assertEqual(result["legacy_logic_hands"], 1)
        self.assertEqual(result["total_mistakes_detected"], 0)

    def test_six_and_eight_player_positions_match_chart_names(self):
        for player_count, expected in ((6, "LJ"), (8, "EP2")):
            header = ["Seat #1 is the button"]
            header.extend(
                f"Seat {seat}: Player{seat} (100 in chips)"
                for seat in range(1, player_count + 1)
            )
            positions = get_player_positions("\n".join(header))
            self.assertEqual(positions[f"Player4"], expected)


if __name__ == "__main__":
    unittest.main()
