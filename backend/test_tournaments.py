import tempfile
import unittest
from pathlib import Path
from fastapi.testclient import TestClient
from backend.main import app
from backend.tournaments import build_tournaments, parse_summary

GG = '''Tournament #123, Daily Test, Hold'em No Limit
Buy-in: $1.84+$0.16
100 Players
Tournament started 2026/10/15 12:00:00
50th : Hero, $3.50
You finished the tournament in 50th place.
You made 2 re-entries and received a total of $3.50.
'''
PS = '''Betfair Tournament #456, No Limit Hold'em
Buy-In: $4.40/$0.60 USD
9 players
Tournament started 2026/10/15 12:00:00 CUST
  4: bullets685 (United Kingdom),
  5: other (Canada), $9.00
You finished in 4th place (eliminated at hand #1).
'''


class TournamentTests(unittest.TestCase):
    def test_entry_fees_and_reentries_are_exact_cents(self):
        row = parse_summary(GG, 'gg.txt')
        self.assertEqual(row['unit_buyin_cents'], 200)
        self.assertEqual(row['buyin_cents'], 600)
        self.assertEqual(row['entries'], 3)
        self.assertEqual(row['cash_return_cents'], 350)
        self.assertTrue(row['entered'])
        self.assertTrue(row['itm'])

    def test_losing_row_does_not_capture_next_players_prize(self):
        row = parse_summary(PS, 'ps.txt')
        self.assertEqual(row['cash_return_cents'], 0)
        self.assertEqual(row['buyin_cents'], 500)
        self.assertFalse(row['itm'])

    def test_positive_bounty_cash_counts_as_cashed(self):
        row = parse_summary(GG.replace('Daily Test', 'Bounty Hunters'), 'bounty.txt')
        self.assertEqual(row['cash_return_cents'], 350)
        self.assertTrue(row['itm'])

    def test_satellite_ticket_value_is_not_cash_or_prize_pool(self):
        text = PS.replace('9 players', '323 players\nTarget Tournament #999 Buy-In: $11.00 USD').replace('4: bullets685 (United Kingdom),', '20: bullets685 (United Kingdom), (qualified for the target tournament)').replace('4th place', '1st place')
        row = parse_summary(text, 'satellite.txt')
        self.assertEqual(row['cash_return_cents'], 0)
        self.assertEqual(row['place'], 1)
        self.assertFalse(row['itm'])

    def test_ticket_text_dollars_are_non_cash(self):
        row = parse_summary(PS.replace('4: bullets685 (United Kingdom),', '1: bullets685 (United Kingdom), $1.50 Power Path Ticket'), 'ticket.txt')
        self.assertEqual(row['cash_return_cents'], 0)

    def test_unknown_player_and_unfinished_result_are_excluded(self):
        absent = parse_summary(PS.replace('bullets685', 'someone_else'), 'absent.txt')
        self.assertFalse(absent['entered'])
        pending = parse_summary(PS.replace('bullets685 (United Kingdom),', 'bullets685 (United Kingdom), still playing'), 'pending.txt')
        self.assertFalse(pending['final'])
        self.assertIsNone(pending['cash_return_cents'])

    def test_duplicates_count_once_and_conflicting_duplicates_are_not_trusted(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root/'a.txt').write_text(GG)
            (root/'b.txt').write_text(GG)
            data = build_tournaments(root)
            self.assertEqual(data['quality']['duplicates_removed'], 1)
            self.assertEqual(data['summary']['buyin_cents'], 600)
            (root/'b.txt').write_text(GG.replace('total of $3.50', 'total of $5.00'))
            data = build_tournaments(root)
            self.assertEqual(data['quality']['conflicts'], 1)
            self.assertEqual(data['summary']['accounted_tournaments'], 0)
            self.assertEqual(data['summary']['buyin_cents'], 0)

    def test_missing_money_is_not_converted_to_zero(self):
        row = parse_summary(GG.replace(' and received a total of $3.50.', '.'), 'missing.txt')
        self.assertIsNone(row['cash_return_cents'])
        row = parse_summary(GG.replace('$1.84+$0.16', '€2.00 EUR'), 'eur.txt')
        self.assertIsNone(row['buyin_cents'])

    def test_real_files_reconcile_to_manually_checked_totals(self):
        data = build_tournaments()
        s = data['summary']
        self.assertEqual(data['quality']['files_scanned'], 24)
        self.assertEqual(data['quality']['duplicates_removed'], 1)
        self.assertEqual(data['history_crosscheck']['missing_summaries'], [{'room': 'PokerStars / Betfair', 'id': '4040099699'}])
        self.assertEqual(s['tournaments'], 23)
        self.assertEqual(s['entries'], 29)
        self.assertEqual(s['reentries'], 6)
        self.assertEqual(s['buyin_cents'], 7760)
        self.assertEqual(s['cash_return_cents'], 14265)
        self.assertEqual(s['net_profit_cents'], 6505)
        self.assertEqual(s['roi_percent'], 83.83)
        self.assertEqual((s['itm_count'], s['itm_assessed'], s['itm_unknown']), (16, 23, 0))
        self.assertEqual(s['itm_percent'], 69.57)
        self.assertEqual(data['curve'][-1]['cumulative_cents'], 6505)
        self.assertEqual(sum(row['profit_cents'] for row in data['tournaments']), 6505)

    def test_empty_or_unreadable_summaries_do_not_fabricate_results(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root/'bad.txt').write_text('not a supported summary')
            data = build_tournaments(root)
            self.assertEqual(data['summary']['tournaments'], 0)
            self.assertIsNone(data['summary']['roi_percent'])
            self.assertIsNone(data['summary']['itm_percent'])
            self.assertEqual(data['curve'], [])
            self.assertEqual(data['quality']['parse_errors'], 1)

    def test_api_is_not_cached(self):
        response = TestClient(app).get('/api/tournaments')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['cache-control'], 'no-store')
        self.assertEqual(response.json()['summary']['tournaments'], 23)
