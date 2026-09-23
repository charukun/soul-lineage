"""Execute the real pinned state/profile boundary, never a mocked registry.

This verifies installation/resumption only. It is not reconstruction acceptance.
"""
import argparse
import json
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'packages/assets/forge'))
from upstream_workspace import install_boundary, environment


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, default=ROOT / '.cache/character-forge-upstream')
    args = parser.parse_args()
    cache = args.cache.resolve()
    with tempfile.TemporaryDirectory(prefix='forge-state-') as temp:
        temp = Path(temp)
        install = install_boundary(cache, temp / 'host')
        # Repeat installation must preserve exactly the same upstream tree.
        install_boundary(cache, temp / 'host')
        registry = json.loads((temp / 'host/plugins.json').read_text())
        assert registry['version'] == 1
        assert registry['plugins'][0]['id'] == 'character'
        env = environment(install)
        state = temp / '.img2threejs/state.json'
        def run(entry, *rest):
            result = subprocess.run([sys.executable, str(install['engine'] / entry), *rest],
                                    cwd=temp, env=env, capture_output=True, text=True)
            if result.returncode:
                raise RuntimeError(result.stdout + result.stderr)
            return result.stdout
        run('forge/state.py', 'init', '--state', str(state), '--reference', 'source/front.png',
            '--profile', 'animated-character', '--spec', 'object-sculpt-spec.json')
        status = json.loads(run('forge/state.py', 'status', '--state', str(state), '--json'))
        required = ['character-landmarks', 'mesh-freeze', 'rig-bind', 'mesh-parity-verify', 'rig-gates']
        for step in required:
            assert step in status['pending'], (step, status)
        skipped = subprocess.run([sys.executable, str(install['engine'] / 'forge/state.py'),
                                  'mark', 'rig-bind', '--state', str(state),
                                  '--evidence', 'not-a-reconstruction.json'],
                                 cwd=temp, env=env, capture_output=True, text=True)
        assert skipped.returncode == 2 and 'out-of-order' in skipped.stderr, skipped.stderr
        run('forge/next.py', '--state', str(state))
        resumed = json.loads(run('forge/state.py', 'status', '--state', str(state), '--json'))
        assert resumed['pending'] == status['pending'], 'next must not approve work'
        print(json.dumps({'profile': 'animated-character', 'requiredSteps': required,
                          'stateInitialization': 'passed', 'nextDoesNotApprove': True,
                          'outOfOrderRigBindingRejected': True,
                          'reconstructionValidated': False}))


if __name__ == '__main__':
    main()
