"""Manual existing-file deployment. No arbitrary URLs, commands, or artifact exports."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

SERVER = 'bcbd4181'
BASE = 'https://sillydev.co.uk/panel/api/client/servers/' + SERVER
MAX_FILE = 256 * 1024
MAX_TOTAL = 8 * 1024 * 1024
MAX_CHANGES = 12

SAFE_CATEGORIES = frozenset({
    'allowlist_invalid', 'path_rejected', 'symlink_rejected', 'local_file_invalid',
    'commit_rejected', 'workflow_context_rejected', 'mode_rejected', 'server_rejected',
    'secret_missing_or_invalid', 'read_response_invalid', 'read_size_invalid',
    'write_response_invalid', 'http_rejected', 'write_http_outcome_uncertain',
    'transport_outcome_uncertain', 'directory_response_invalid', 'remote_path_rejected',
    'total_size_exceeded', 'package_metadata_drift', 'backup_size_exceeded',
    'change_batch_too_large', 'concurrent_change_detected', 'readback_mismatch',
    'final_readback_mismatch', 'deployment_failed', 'restart_unconfirmed',
})

class Failure(Exception):
    def __init__(self, category, status=None):
        super().__init__(category)
        self.category = category if type(category) is str and category in SAFE_CATEGORIES else 'unexpected_failure'
        self.status = status if type(status) is int and 100 <= status <= 599 else None


def report_failure(error):
    category = 'unexpected_failure'
    status = None
    if isinstance(error, Failure):
        category = error.category if type(error.category) is str and error.category in SAFE_CATEGORIES else 'unexpected_failure'
        status = error.status if type(error.status) is int and 100 <= error.status <= 599 else None
    print('failure_category=' + category + ((' http_status=' + str(status)) if status is not None else ''))

class Uncertain(Failure):
    pass


def digest(data):
    return hashlib.sha256(data).hexdigest()


def validate_paths(paths):
    if not isinstance(paths, list) or not paths or len(paths) > 64 or any(not isinstance(p, str) for p in paths) or len(set(paths)) != len(paths):
        raise Failure('allowlist_invalid')
    for name in paths:
        if not isinstance(name, str) or not re.fullmatch(r'(?:index\.js|src/(?:[a-z0-9-]+/)*[a-z0-9-]+\.js)', name):
            raise Failure('path_rejected')
        if '/website/' in name or '/data/' in name:
            raise Failure('path_rejected')
    return paths


def read_local(root, name):
    path = root / name
    for part in [path, *path.parents]:
        if part == root.parent:
            break
        if part.is_symlink():
            raise Failure('symlink_rejected')
    if not path.is_file() or not 0 < path.stat().st_size <= MAX_FILE:
        raise Failure('local_file_invalid')
    return path.read_bytes()


def validate_context(env, head):
    sha = env.get('EXPECTED_SHA', '')
    if not re.fullmatch('[0-9a-f]{40}', sha) or sha != env.get('GITHUB_SHA') or sha != head:
        raise Failure('commit_rejected')
    if env.get('GITHUB_REPOSITORY') != 'hayness666/link-embedder' or env.get('GITHUB_REF') != 'refs/heads/main' or env.get('GITHUB_EVENT_NAME') != 'workflow_dispatch':
        raise Failure('workflow_context_rejected')
    if env.get('DEPLOY_MODE') not in ('verify', 'deploy'):
        raise Failure('mode_rejected')
    if env.get('SILLYDEV_SERVER_ID') != SERVER:
        raise Failure('server_rejected')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class API:
    def __init__(self, token):
        if not isinstance(token, str) or not token or any(c.isspace() for c in token):
            raise Failure('secret_missing_or_invalid')
        self.token = token
        self.opener = urllib.request.build_opener(NoRedirect())

    def request(self, suffix, method='GET', data=None, file=None, directory=None):
        url = BASE + suffix
        if file is not None:
            url += '?' + urllib.parse.urlencode({'file': '/' + file})
        if directory is not None:
            url += '?' + urllib.parse.urlencode({'directory': directory})
        headers = {'Authorization': 'Bearer ' + self.token, 'Accept': 'application/json'}
        if data is not None:
            headers['Content-Type'] = 'application/json' if suffix == '/power' else 'text/plain'
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with self.opener.open(req, timeout=15) as response:
                status = response.status
                content_type = response.headers.get('Content-Type', '').split(';')[0].strip().lower()
                if method == 'GET':
                    if status != 200 or content_type != ('application/json' if directory is not None else 'text/plain'):
                        raise Failure('read_response_invalid')
                    body = response.read(MAX_FILE + 1)
                    if not 0 < len(body) <= MAX_FILE:
                        raise Failure('read_size_invalid')
                    return body
                if status != 204:
                    raise Failure('write_response_invalid')
                return None
        except urllib.error.HTTPError as error:
            # Close without exposing exception text through resource cleanup warnings.
            try:
                error.close()
            except Exception:
                pass
            if method != 'GET':
                # Even an HTTP error can follow a forwarded or partially completed write.
                raise Uncertain('write_http_outcome_uncertain', error.code) from None
            raise Failure('http_rejected', error.code) from None
        except Failure:
            raise
        except Exception:
            # No retry: a failed/timeout POST may have reached the server.
            raise Uncertain('transport_outcome_uncertain') from None

    def check_paths(self, paths):
        listings = {}
        for path in paths:
            parts = path.split('/')
            directory = '/'
            for i, part in enumerate(parts):
                if directory not in listings:
                    raw = self.request('/files/list', directory=directory)
                    try:
                        payload = json.loads(raw)
                        if payload.get('object') != 'list' or not isinstance(payload.get('data'), list):
                            raise ValueError()
                        entries = [item['attributes'] for item in payload['data']]
                        listing = {}
                        for item in entries:
                            name = item['name']
                            if not isinstance(name, str) or name in listing:
                                raise ValueError()
                            listing[name] = item
                        listings[directory] = listing
                    except Exception:
                        raise Failure('directory_response_invalid') from None
                entry = listings[directory].get(part)
                leaf = i == len(parts) - 1
                if not entry or entry.get('is_symlink') is not False or entry.get('is_file') is not leaf:
                    raise Failure('remote_path_rejected')
                directory += part + '/'

    def read(self, path):
        return self.request('/files/contents', file=path)

    def write(self, path, data):
        return self.request('/files/write', 'POST', data, path)

    def restart(self):
        return self.request('/power', 'POST', b'{"signal":"restart"}')


def deploy(root, paths, api, mode, log=print):
    log('stage=local_source_validation')
    paths = validate_paths(paths)
    if mode not in ('verify', 'deploy'):
        raise Failure('mode_rejected')
    desired = {p: read_local(root, p) for p in paths}
    if sum(map(len, desired.values())) > MAX_TOTAL:
        raise Failure('total_size_exceeded')
    log('stage=remote_path_validation')
    api.check_paths([*paths, 'package.json', 'package-lock.json'])
    # Dependency changes need a separate reviewed install process; never run npm with a secret.
    log('stage=package_metadata_validation')
    for name in ('package.json', 'package-lock.json'):
        if api.read(name) != read_local(root, name):
            raise Failure('package_metadata_drift')
    log('stage=remote_source_read')
    originals = {p: api.read(p) for p in paths}  # All must exist; no delete permission needed.
    if sum(map(len, originals.values())) > MAX_TOTAL:
        raise Failure('backup_size_exceeded')
    changed = [p for p in paths if digest(originals[p]) != digest(desired[p])]
    log('preflight_complete changed_files=' + str(len(changed)))
    if mode == 'verify':
        log('read_only_complete')
        return
    if len(changed) > MAX_CHANGES:
        raise Failure('change_batch_too_large')
    log('stage=source_write_and_readback')
    attempted = []
    try:
        for p in changed:
            if api.read(p) != originals[p]:
                raise Failure('concurrent_change_detected')
            attempted.append(p)
            api.write(p, desired[p])
            if api.read(p) != desired[p]:
                raise Failure('readback_mismatch')
        # Check all approved source files, including unchanged dependencies, before restart.
        for p in paths:
            if api.read(p) != desired[p]:
                raise Failure('final_readback_mismatch')
    except Uncertain:
        # A timed-out write may complete later. Do not race it with blind rollback/restart.
        log('state_uncertain_no_restart_manual_recovery_required')
        raise
    except Exception:
        restored = True
        for p in reversed(attempted):
            try:
                current = api.read(p)
                if current == originals[p]:
                    continue
                # No CAS API: refuse to overwrite unrelated/concurrently changed bytes.
                if current != desired[p]:
                    restored = False
                    continue
                api.write(p, originals[p])
                if api.read(p) != originals[p]:
                    restored = False
            except Exception:
                restored = False
        log('rollback_verified_no_restart' if restored else 'rollback_unconfirmed_no_restart_manual_recovery_required')
        raise Failure('deployment_failed') from None
    if not changed:
        log('already_matches_no_restart')
        return
    log('stage=restart_request')
    try:
        api.restart()
    except Exception:
        log('restart_unconfirmed_no_retry_manual_check_required')
        raise Failure('restart_unconfirmed') from None
    log('files_verified_restart_accepted_live_health_not_verified')


def main():
    try:
        print('stage=context_validation')
        root = Path.cwd().resolve()
        head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True, stderr=subprocess.DEVNULL).strip()
        validate_context(os.environ, head)
        print('stage=allowlist_load')
        paths = json.loads((Path(__file__).parent / 'allowlist.json').read_text())
        print('stage=credential_presence_validation')
        api = API(os.environ.get('SILLYDEV_API_KEY'))
        deploy(root, paths, api, os.environ['DEPLOY_MODE'])
        return 0
    except Exception as error:
        # Never expose raw HTTP bodies, local file contents, environment, or exceptions.
        report_failure(error)
        return 1

if __name__ == '__main__':
    sys.exit(main())
