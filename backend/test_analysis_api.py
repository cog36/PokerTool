"""Hand-history analysis API tests use the checked-in sample file."""
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

try:
    import main
except ImportError:
    from backend import main


PROJECT_ROOT = Path(__file__).resolve().parent.parent
SAMPLE_FILE_PATH = PROJECT_ROOT / 'hand_histories' / 'GG20261015-2250 - Daily Hyper 2.txt'


class AnalysisApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)

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
