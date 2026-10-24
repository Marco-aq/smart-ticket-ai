"""Check a running packaged API without writing data. Uses only Python stdlib."""
import argparse
import json
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def request(base, path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = Request(base.rstrip('/') + path, data=data, headers={'Content-Type': 'application/json'})
    try:
        with urlopen(req, timeout=5) as response:
            return response.status, json.load(response)
    except HTTPError as error:
        return error.code, None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:8200')
    args = parser.parse_args()
    for attempt in range(30):
        try:
            status, health = request(args.url, '/health')
            if status == 200 and health == {'status': 'ok'}:
                break
        except (URLError, TimeoutError, ConnectionError):
            pass
        time.sleep(1)
    else:
        raise SystemExit('API did not become healthy within the startup window')
    status, prediction = request(args.url, '/predict', {
        'subject': 'Fictional duplicate payment',
        'description': 'A synthetic account was billed twice for a fictional subscription. Please investigate this test transaction.',
    })
    assert status == 200, f'Prediction failed: HTTP {status}'
    for field in ['category_score', 'priority_score']:
        assert 0 <= prediction[field] <= 1, f'Invalid {field}'
    assert prediction['category'] and prediction['priority']
    for path in ['/tickets', '/analytics', '/auth/me']:
        assert request(args.url, path)[0] == 401, f'Unauthenticated access was not rejected: {path}'
    print('Packaged API passed: health, real-model prediction, and authentication boundary.')


if __name__ == '__main__':
    main()
