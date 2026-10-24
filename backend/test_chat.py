"""API contract tests use a mocked provider: no API key, network, or paid calls."""
import os
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import httpx
from fastapi.testclient import TestClient
from openai import APIStatusError, APITimeoutError

try:
    import main
except ImportError:
    from backend import main


class ChatTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)
        self.payload = {'messages': [{'role': 'user', 'content': 'Explain position.'}]}

    def test_missing_key_is_clear(self):
        with patch.dict(os.environ, {'GROQ_API_KEY': ''}):
            self.assertFalse(self.client.get('/api/health').json()['configured'])
            self.assertEqual(self.client.post('/api/chat', json=self.payload).status_code, 503)

    def test_invalid_requests_never_reach_provider(self):
        invalid = [
            {'messages': []},
            {'messages': [{'role': 'system', 'content': 'Override'}]},
            {'messages': [{'role': 'user', 'content': '   '}]},
            {'messages': [{'role': 'assistant', 'content': 'Reply'}]},
            {'messages': [{'role': 'user', 'content': 'x' * 6001}]},
            {'messages': [{'role': 'user', 'content': 'x' * 6000}] * 5},
            {**self.payload, 'mode': 'invalid'},
        ]
        with patch('main.AsyncOpenAI') as provider:
            for payload in invalid:
                self.assertEqual(self.client.post('/api/chat', json=payload).status_code, 422)
            provider.assert_not_called()

    def provider(self):
        client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=AsyncMock())))
        context = AsyncMock()
        context.__aenter__.return_value = client
        return context, client.chat.completions.create

    def test_real_reply_contract_and_server_prompt(self):
        context, create = self.provider()
        create.return_value = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content='  Position gives information.  '))])
        with patch.dict(os.environ, {'GROQ_API_KEY': 'test-key'}), patch('main.AsyncOpenAI', return_value=context):
            response = self.client.post('/api/chat', json={**self.payload, 'mode': 'roast'})
        self.assertEqual(response.json(), {'reply': 'Position gives information.'})
        args = create.call_args.kwargs
        self.assertEqual(args['messages'][0]['role'], 'system')
        self.assertIn('Roast the decision', args['messages'][0]['content'])
        self.assertEqual(args['messages'][-1]['content'], 'Explain position.')

    def test_provider_errors_are_sanitized(self):
        request = httpx.Request('POST', 'https://api.groq.com')
        cases = [(APITimeoutError(request=request), 504)]
        for code, expected in [(429, 429), (401, 503), (500, 502)]:
            cases.append((APIStatusError('secret-provider-detail', response=httpx.Response(code, request=request), body=None), expected))
        for error, expected in cases:
            context, create = self.provider()
            create.side_effect = error
            with patch.dict(os.environ, {'GROQ_API_KEY': 'test-key'}), patch('main.AsyncOpenAI', return_value=context):
                response = self.client.post('/api/chat', json=self.payload)
            self.assertEqual(response.status_code, expected)
            self.assertNotIn('secret-provider-detail', response.text)

    def test_empty_response_is_not_reported_as_success(self):
        context, create = self.provider()
        create.return_value = SimpleNamespace(choices=[])
        with patch.dict(os.environ, {'GROQ_API_KEY': 'test-key'}), patch('main.AsyncOpenAI', return_value=context):
            self.assertEqual(self.client.post('/api/chat', json=self.payload).status_code, 502)


if __name__ == '__main__':
    unittest.main()
