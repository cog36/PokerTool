import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.main import app
from backend import library
from backend.test_tournaments import GG

class LibraryTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        root = Path(self.directory.name)
        roots = {'hands': root/'hands', 'tournaments': root/'summaries'}
        for path in roots.values(): path.mkdir()
        self.patch = patch.dict(library.LIBRARY_ROOTS, roots)
        self.patch.start(); self.addCleanup(self.patch.stop)
        self.client = TestClient(app)
        self.sample = next((Path(__file__).parent.parent/'hand_histories'/'ggpoker').glob('*.txt')).read_bytes()

    def test_import_lists_saved_games_and_analyzes_them(self):
        result = self.client.post('/api/library/hands', files={'file': ('game.txt', self.sample, 'text/plain')})
        self.assertEqual(result.status_code, 200)
        path = result.json()['file']
        self.assertTrue((library.LIBRARY_ROOTS['hands']/path).is_file())
        self.assertIn(path, [file['id'] for file in self.client.get('/api/hand-files').json()['files']])
        report = self.client.post('/api/analyze-saved', data={'file_id': path})
        self.assertEqual(report.status_code, 200)
        self.assertGreater(report.json()['total_hands_analyzed'], 0)
        repeat = self.client.post('/api/library/hands', files={'file': ('game.txt', self.sample, 'text/plain')})
        self.assertTrue(repeat.json()['already_imported'])
        self.assertEqual(len(list(library.LIBRARY_ROOTS['hands'].rglob('*.txt'))), 1)

    def test_validated_tournament_import_and_rejections(self):
        result = self.client.post('/api/library/tournaments', files={'file': ('summary.txt', GG.encode(), 'text/plain')})
        self.assertEqual(result.status_code, 200)
        duplicate = self.client.post(
            '/api/library/tournaments',
            files={'file': ('renamed-summary.txt', GG.encode(), 'text/plain')},
        )
        self.assertEqual(duplicate.status_code, 200)
        self.assertTrue(duplicate.json()['already_imported'])
        self.assertEqual(len(list(library.LIBRARY_ROOTS['tournaments'].rglob('*.txt'))), 1)
        for kind, name, body in [('hands', 'bad.txt', b'garbage'), ('tournaments', 'bad.txt', b'garbage'), ('hands', 'game.exe', self.sample), ('tournaments', 'wrong.txt', GG.replace('Hero', 'Other').encode())]:
            self.assertEqual(self.client.post(f'/api/library/{kind}', files={'file': (name, body, 'text/plain')}).status_code, 400)

    def test_paths_cannot_escape_library(self):
        for path in ['../secret.txt', '/etc/passwd', 'missing.txt']:
            self.assertEqual(self.client.post('/api/analyze-saved', data={'file_id': path}).status_code, 400)
        imported = self.client.post('/api/library/hands', files={'file': ('../../game.txt', self.sample, 'text/plain')})
        self.assertEqual(imported.status_code, 200)
        self.assertNotIn('..', imported.json()['file'])
