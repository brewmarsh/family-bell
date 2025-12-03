import os
import sys
import json
import subprocess
import re

def get_commit_messages(from_sha, to_sha):
    # Handle the case where from_sha is 0000000 (first commit or forced push)
    # git log from_sha..to_sha
    if from_sha == '0000000000000000000000000000000000000000':
        # If no history, just check the to_sha
        cmd = ['git', 'log', '--pretty=format:%s', '-n', '1', to_sha]
    else:
        cmd = ['git', 'log', '--pretty=format:%s', f'{from_sha}..{to_sha}']

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return result.stdout.strip().split('\n')
    except subprocess.CalledProcessError as e:
        print(f"Error getting commit messages: {e}")
        # Fallback to checking just the HEAD commit if range fails
        return []

def determine_bump(messages):
    bump = None
    print(f"Commit messages: {messages}")
    for msg in messages:
        msg = msg.strip()
        if not msg:
            continue
        # Conventional Commits: BREAKING CHANGE or <type>!:
        if 'BREAKING CHANGE' in msg or re.search(r'^(\w+)!:', msg):
            return 'major'

        if msg.startswith('feat'):
            if bump != 'major':
                bump = 'minor'

        if msg.startswith('fix'):
            if bump is None:
                bump = 'patch'

    return bump

def main():
    manifest_path = 'custom_components/family_bell/manifest.json'

    # Read manifest
    try:
        with open(manifest_path, 'r') as f:
            manifest = json.load(f)
    except FileNotFoundError:
        print(f"Error: {manifest_path} not found.")
        sys.exit(1)

    current_version = manifest.get('version', '0.0.0')
    print(f"Current version: {current_version}")

    if len(sys.argv) < 3:
        print("Usage: python bump_version.py <from_sha> <to_sha>")
        # Fallback for testing or manual runs
        sys.exit(1)

    from_sha = sys.argv[1]
    to_sha = sys.argv[2]

    print(f"Checking commits from {from_sha} to {to_sha}")
    messages = get_commit_messages(from_sha, to_sha)

    if not messages:
        print("No messages found.")
        # If we can't find messages (e.g. shallow clone issue), assume patch if strictly requested?
        # But safest is to exit or fail.
        # Let's default to patch as requested "every merge".
        bump_type = 'patch'
    else:
        bump_type = determine_bump(messages)

    if not bump_type:
        print("No semantic changes found. Defaulting to patch bump.")
        bump_type = 'patch'

    print(f"Bump type: {bump_type}")

    try:
        parts = list(map(int, current_version.split('.')))
        while len(parts) < 3:
            parts.append(0)
        major, minor, patch = parts[:3]
    except ValueError:
        print(f"Invalid version format: {current_version}")
        sys.exit(1)

    if bump_type == 'major':
        major += 1
        minor = 0
        patch = 0
    elif bump_type == 'minor':
        minor += 1
        patch = 0
    elif bump_type == 'patch':
        patch += 1

    new_version = f"{major}.{minor}.{patch}"
    print(f"New version: {new_version}")

    if new_version == current_version:
        print("Version unchanged.")
        sys.exit(0)

    manifest['version'] = new_version

    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)
        f.write('\n')

    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a') as f:
            f.write(f"new_version={new_version}\n")
            f.write(f"bump_occurred=true\n")

if __name__ == "__main__":
    main()
