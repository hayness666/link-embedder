import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
import urllib.error
from contextlib import redirect_stdout
from unittest.mock import patch

SPEC=importlib.util.spec_from_file_location('sillydev',Path(__file__).resolve().parents[2]/'scripts/deploy/sillydev.py')
m=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(m)

class Fake:
    def __init__(self, files):
        self.files=dict(files);self.writes=[];self.restarts=0;self.fail=None
    def check_paths(self,paths):pass
    def read(self,p):
        if p not in self.files:raise m.Failure('missing')
        return self.files[p]
    def write(self,p,data):
        self.writes.append((p,data));self.files[p]=data
        if self.fail:self.fail(self,p,data)
    def restart(self):self.restarts+=1

class Tests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name);(self.root/'src').mkdir()
        self.paths=['src/a.js','src/b.js']
        self.files={'package.json':b'{}','package-lock.json':b'{}','src/a.js':b'new-a','src/b.js':b'new-b'}
        for p,d in self.files.items():(self.root/p).write_bytes(d)
        self.old={**self.files,'src/a.js':b'old-a','src/b.js':b'old-b'}
        self.api=Fake(self.old);self.logs=[]
    def run_deploy(self,mode='deploy'):
        return m.deploy(self.root,self.paths,self.api,mode,self.logs.append)
    def test_read_only(self):
        self.run_deploy('verify');self.assertEqual(self.api.writes,[]);self.assertEqual(self.api.restarts,0)
    def test_verified_success(self):
        self.run_deploy();self.assertEqual(self.api.files,self.files);self.assertEqual(self.api.restarts,1)
        self.assertIn('files_verified_restart_accepted_live_health_not_verified',self.logs)
    def test_noop(self):
        self.api.files=dict(self.files);self.run_deploy();self.assertEqual(self.api.restarts,0)
    def test_partial_batch_failure_verified_rollback(self):
        def fail(api,p,data):
            if p=='src/b.js' and data==b'new-b':raise m.Failure('server_error')
        self.api.fail=fail
        with self.assertRaises(m.Failure):self.run_deploy()
        self.assertEqual(self.api.files,self.old);self.assertEqual(self.api.restarts,0)
        self.assertIn('rollback_verified_no_restart',self.logs)
    def test_rollback_failure_not_claimed_success(self):
        def fail(api,p,data):
            if data.startswith(b'old'):api.files[p]=b'partial';raise m.Failure('rollback_error')
            if p=='src/b.js':raise m.Failure('original_error')
        self.api.fail=fail
        with self.assertRaises(m.Failure):self.run_deploy()
        self.assertIn('rollback_unconfirmed_no_restart_manual_recovery_required',self.logs)
        self.assertEqual(self.api.restarts,0)
    def test_partial_bytes_not_overwritten_as_if_owned(self):
        def fail(api,p,data):api.files[p]=b'concurrent-or-partial';raise m.Failure('write_error')
        self.api.fail=fail
        with self.assertRaises(m.Failure):self.run_deploy()
        self.assertEqual(len(self.api.writes),1);self.assertIn('rollback_unconfirmed_no_restart_manual_recovery_required',self.logs)
    def test_timeout_no_blind_retry(self):
        self.api.fail=lambda *args:(_ for _ in ()).throw(m.Uncertain('token=SECRET'))
        with self.assertRaises(m.Uncertain):self.run_deploy()
        self.assertEqual(len(self.api.writes),1);self.assertEqual(self.api.restarts,0)
        self.assertNotIn('SECRET',' '.join(self.logs))
    def test_package_drift_blocks_before_writes(self):
        self.api.files['package.json']=b'{"version":"old"}'
        with self.assertRaisesRegex(m.Failure,'package_metadata_drift'):self.run_deploy()
        self.assertFalse(self.api.writes)
    def test_missing_remote_no_creation(self):
        del self.api.files['src/b.js']
        with self.assertRaises(m.Failure):self.run_deploy()
        self.assertFalse(self.api.writes)
    def test_path_traversal_and_state_rejected(self):
        for p in ['../.env','/src/a.js','src/../a.js','src/a.js?x=1','src/website/a.js','src/data/a.js','.env','data/repost-owners.json','src/a.js%00']:
            with self.subTest(path=p),self.assertRaises(m.Failure):m.validate_paths([p])
    def test_symlink_rejected(self):
        (self.root/'src/a.js').unlink();(self.root/'src/a.js').symlink_to(self.root/'package.json')
        with self.assertRaisesRegex(m.Failure,'symlink'):self.run_deploy()
    def test_context_exact_commit_main_and_manual(self):
        sha='a'*40;e={'EXPECTED_SHA':sha,'GITHUB_SHA':sha,'GITHUB_REPOSITORY':'hayness666/link-embedder','GITHUB_REF':'refs/heads/main','GITHUB_EVENT_NAME':'workflow_dispatch','DEPLOY_MODE':'verify','SILLYDEV_SERVER_ID':m.SERVER}
        m.validate_context(e,sha)
        for k,v in [('EXPECTED_SHA','b'*40),('GITHUB_REF','refs/pull/1/merge'),('GITHUB_REPOSITORY','fork/repo'),('GITHUB_EVENT_NAME','push'),('DEPLOY_MODE','shell'),('SILLYDEV_SERVER_ID','other')]:
            with self.subTest(key=k),self.assertRaises(m.Failure):m.validate_context({**e,k:v},sha)
    def test_missing_secret(self):
        for token in [None,'','bad\nvalue']:
            with self.assertRaises(m.Failure):m.API(token)
    def test_restart_failure_no_repeated_restart_or_rollback(self):
        def restart():self.api.restarts+=1;raise m.Uncertain('secret')
        self.api.restart=restart
        with self.assertRaises(m.Failure):self.run_deploy()
        self.assertEqual(self.api.restarts,1);self.assertEqual(self.api.files,self.files)
        self.assertIn('restart_unconfirmed_no_retry_manual_check_required',self.logs)
    def test_http_raw_error_not_returned(self):
        api=m.API('TOKEN_SECRET')
        with patch.object(api.opener,'open',side_effect=urllib.error.HTTPError('url',403,'TOKEN_SECRET',{},None)):
            with self.assertRaises(m.Failure) as caught:api.read('src/a.js')
        self.assertEqual(str(caught.exception),'http_rejected')
    def test_http_write_error_is_uncertain(self):
        api=m.API('TOKEN_SECRET')
        for code in [400,403,500,502,504]:
            with self.subTest(code=code):
                error=urllib.error.HTTPError('url',code,'TOKEN_SECRET',{},None)
                with patch.object(api.opener,'open',side_effect=error),self.assertRaises(m.Uncertain) as caught:
                    api.write('src/a.js',b'new')
                self.assertEqual(str(caught.exception),'write_http_outcome_uncertain')
    def test_invalid_allowlist_types_fail_closed(self):
        for paths in [[{}],[None],['src/a.js','src/a.js']]:
            with self.assertRaises(m.Failure):m.validate_paths(paths)
    def test_read_only_failure_never_mutates(self):
        del self.api.files['src/b.js']
        with self.assertRaises(m.Failure):self.run_deploy('verify')
        self.assertEqual(self.api.writes,[]);self.assertEqual(self.api.restarts,0)
    def test_malformed_read_response(self):
        class Response:
            status=200;headers={'Content-Type':'application/json'}
            def __enter__(self):return self
            def __exit__(self,*a):pass
        api=m.API('TOKEN_SECRET')
        with patch.object(api.opener,'open',return_value=Response()),self.assertRaisesRegex(m.Failure,'read_response_invalid'):api.read('src/a.js')
    def test_redirect_handler_rejects(self):
        self.assertIsNone(m.NoRedirect().redirect_request(None,None,302,'',{},'https://evil.example'))
    def test_source_and_secret_never_in_logs(self):
        self.run_deploy();joined=' '.join(self.logs)
        for value in [*self.files.values(),*self.old.values()]:self.assertNotIn(value.decode(),joined)
    def test_concurrent_change_before_write_is_preserved(self):
        original_read=self.api.read;count=0
        def read(p):
            nonlocal count
            if p=='src/a.js':
                count+=1
                if count==2:self.api.files[p]=b'external-change'
            return original_read(p)
        self.api.read=read
        with self.assertRaises(m.Failure):self.run_deploy()
        self.assertEqual(self.api.files['src/a.js'],b'external-change');self.assertFalse(self.api.writes)
    def test_readback_mismatch_prevents_restart(self):
        def alter(api,p,data):api.files[p]=b'truncated'
        self.api.fail=alter
        with self.assertRaises(m.Failure):self.run_deploy()
        self.assertEqual(self.api.restarts,0);self.assertIn('rollback_unconfirmed_no_restart_manual_recovery_required',self.logs)
    def test_exact_request_target_and_no_token_in_url(self):
        class Response:
            status=200;headers={'Content-Type':'text/plain; charset=utf-8'}
            def __enter__(self):return self
            def __exit__(self,*a):pass
            def read(self,n):return b'source'
        api=m.API('TOKEN_SECRET')
        with patch.object(api.opener,'open',return_value=Response()) as opened:
            self.assertEqual(api.read('src/a.js'),b'source')
        req=opened.call_args.args[0]
        self.assertEqual(req.full_url,m.BASE+'/files/contents?file=%2Fsrc%2Fa.js')
        self.assertNotIn('TOKEN_SECRET',req.full_url);self.assertEqual(opened.call_args.kwargs['timeout'],15)
    def test_oversized_body_rejected(self):
        class Response:
            status=200;headers={'Content-Type':'text/plain'}
            def __enter__(self):return self
            def __exit__(self,*a):pass
            def read(self,n):return b'x'*(m.MAX_FILE+1)
        api=m.API('TOKEN_SECRET')
        with patch.object(api.opener,'open',return_value=Response()),self.assertRaises(m.Failure):api.read('src/a.js')
    def test_unexpected_write_status_rejected(self):
        class Response:
            status=200;headers={}
            def __enter__(self):return self
            def __exit__(self,*a):pass
        api=m.API('TOKEN_SECRET')
        with patch.object(api.opener,'open',return_value=Response()),self.assertRaises(m.Failure):api.write('src/a.js',b'new')
    def test_remote_symlink_is_rejected(self):
        api=m.API('TOKEN_SECRET')
        listing={'object':'list','data':[{'attributes':{'name':'src','is_file':False,'is_symlink':True}}]}
        with patch.object(api,'request',return_value=json.dumps(listing).encode()),self.assertRaisesRegex(m.Failure,'remote_path_rejected'):
            api.check_paths(['src/a.js'])
    def test_malformed_directory_response(self):
        api=m.API('TOKEN_SECRET')
        with patch.object(api,'request',return_value=b'{"data":"SECRET"}'),self.assertRaisesRegex(m.Failure,'directory_response_invalid'):
            api.check_paths(['src/a.js'])
    def test_workflow_no_automatic_trigger_and_secret_job_separate(self):
        text=(Path(__file__).resolve().parents[2]/'.github/workflows/deploy-bot.yml').read_text()
        self.assertIn('workflow_dispatch:',text);self.assertNotIn('pull_request',text);self.assertNotIn('  push:',text)
        first,second=text.split('  transfer:');self.assertNotIn('secrets.',first);self.assertNotIn('run: npm',second)
        self.assertIn('cancel-in-progress: false',text);self.assertIn('persist-credentials: false',second)

if __name__=='__main__':unittest.main()
