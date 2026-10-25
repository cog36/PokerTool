"""Hand-history analysis API tests use the checked-in sample file."""
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

try:
    import main
except ImportError:
    from backend import main


PROJECT_ROOT = Path(__file__).resolve().parent.parent
SAMPLE_FILE_PATH = (
    PROJECT_ROOT
    / 'hand_histories'
    / 'ggpoker'
    / 'GG20261015-2250 - Daily Hyper 2.txt'
)
POKERSTARS_FILE_PATH = next(
    (PROJECT_ROOT / 'hand_histories' / 'pokerstars').glob('*T4039880417*.txt')
)


class AnalysisApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)

    def test_hand_history_overview_counts_hero_showdowns_not_table_markers(self):
        response = self.client.get('/api/hand-history-overview')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['cache-control'], 'no-store')
        result = response.json()
        room_counts = {}
        for hand in result['hands']:
            room_counts[hand['room']] = room_counts.get(hand['room'], 0) + 1
        self.assertEqual(room_counts['PokerStars / Betfair'], 734)
        self.assertEqual(result['total_hands'], sum(room_counts.values()))
        hand_showdowns = sum(hand['showdown'] for hand in result['hands'])
        self.assertEqual(result['summary']['showdowns'], hand_showdowns)
        self.assertEqual(
            result['summary']['went_to_showdown_percent'],
            round(100 * hand_showdowns / result['summary']['saw_flop_hands'], 1),
        )
        self.assertEqual(
            result['summary']['showdown_hand_percent'],
            round(100 * hand_showdowns / result['total_hands'], 1),
        )
        self.assertLess(hand_showdowns, result['total_hands'])
        self.assertEqual(
            result['summary']['won_showdowns'],
            sum(hand['won_showdown'] for hand in result['hands']),
        )

    def test_pokerstars_overview_filter_has_only_its_own_hands_and_hud(self):
        response = self.client.get('/api/hand-history-overview?room=pokerstars')
        self.assertEqual(response.status_code, 200)
        result = response.json()
        hands = result['hands']
        self.assertEqual(result['total_hands'], 734)
        self.assertEqual(result['source_files'], 12)
        self.assertEqual(result['errors'], [])
        self.assertEqual({hand['room'] for hand in hands}, {'PokerStars / Betfair'})
        self.assertTrue(all(hand['source_file'].startswith('pokerstars/') for hand in hands))
        self.assertEqual(len({hand['hand_id'] for hand in hands}), 734)
        self.assertEqual(result['summary']['vpip_percent'], round(100 * sum(hand['vpip'] for hand in hands) / len(hands), 1))
        self.assertEqual(sum(row['hands'] for row in result['position_stats']), 734)
        gg = self.client.get('/api/hand-history-overview?room=ggpoker').json()
        self.assertEqual({hand['room'] for hand in gg['hands']}, {'GGPoker'})
        all_rooms = self.client.get('/api/hand-history-overview').json()
        self.assertEqual(all_rooms['total_hands'], len(hands) + gg['total_hands'])
        self.assertEqual(self.client.get('/api/hand-history-overview?room=unknown').status_code, 422)

    def test_upload_returns_session_summary_and_hand_context(self):
        with SAMPLE_FILE_PATH.open('rb') as history:
            response = self.client.post(
                '/api/analyze',
                files={'file': (SAMPLE_FILE_PATH.name, history, 'text/plain')},
            )

        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result['filename'], SAMPLE_FILE_PATH.name)
        self.assertGreater(result['total_hands_analyzed'], 0)
        self.assertEqual(result['total_hands_analyzed'], len(result['hands']))
        self.assertEqual(result['decisions_scored'] + result['decisions_unscored'], result['total_hands_analyzed'])
        self.assertIn('legacy_logic_hands', result)
        self.assertIn('played_weak_hands', result['leak_breakdown'])
        hand = result['hands'][0]
        self.assertTrue(hand['raw_cards'])
        self.assertIn('matrix_key', hand)
        self.assertIn('feedback', hand)
        self.assertIn(hand['decision_assessment'], {'CORRECT', 'INCORRECT', 'UNASSESSED'})
        self.assertIn(hand['analysis_source'], {'CHART', 'LEGACY_LOGIC'})
        self.assertIn('chart_stack_bb', hand)
        self.assertIn('actions_before_hero', hand)
        self.assertTrue(hand['action_timeline'])
        self.assertIn(hand['decision_action_index'], range(len(hand['action_timeline'])))
        self.assertTrue(hand['action_timeline'][hand['decision_action_index']]['is_decision'])

    def test_upload_analyzes_pokerstars_history(self):
        with POKERSTARS_FILE_PATH.open('rb') as history:
            response = self.client.post(
                '/api/analyze',
                files={'file': (POKERSTARS_FILE_PATH.name, history, 'text/plain')},
            )

        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result['room'], 'PokerStars / Betfair')
        self.assertEqual(result['total_hands_analyzed'], 74)
        self.assertEqual(result['total_hands_analyzed'], len(result['hands']))
        self.assertIn(result['hands'][0]['position'], {'EP1', 'EP2', 'EP3', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'})
        self.assertEqual(result['hands'][0]['matrix_key'], 'ATs')
        self.assertIn(result['hands'][0]['analysis_source'], {'CHART', 'LEGACY_LOGIC'})
        hand = result['hands'][0]
        decision = hand['action_timeline'][hand['decision_action_index']]
        self.assertEqual(decision['player'], 'bullets685')
        self.assertEqual(decision['street'], 'Preflop')
        self.assertEqual(decision['text'], 'raises 1.75bb to 2.75bb')
        self.assertIn('Flop', hand['street_boards'])
        self.assertEqual(len(hand['street_boards']['Turn'].split()), 4)
        self.assertEqual(len(hand['street_boards']['River'].split()), 5)
        self.assertEqual(hand['big_blind'], 20)

    def test_rejects_non_text_files(self):
        response = self.client.post(
            '/api/analyze',
            files={'file': ('history.phh', b'hand text', 'text/plain')},
        )
        self.assertEqual(response.status_code, 400)

    def test_rejects_empty_and_unsupported_histories(self):
        for content in (b'', b'not a hand history'):
            response = self.client.post(
                '/api/analyze',
                files={'file': ('history.txt', content, 'text/plain')},
            )
            self.assertEqual(response.status_code, 400)

    def test_rejects_invalid_utf8(self):
        response = self.client.post(
            '/api/analyze',
            files={'file': ('history.txt', b'\xff', 'text/plain')},
        )
        self.assertEqual(response.status_code, 400)

    def test_rejects_files_over_size_limit(self):
        response = self.client.post(
            '/api/analyze',
            files={'file': ('history.txt', b'x' * (main.MAX_HAND_HISTORY_BYTES + 1), 'text/plain')},
        )
        self.assertEqual(response.status_code, 413)


if __name__ == '__main__':
    unittest.main()
