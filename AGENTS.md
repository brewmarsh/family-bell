# Developer & Agent Instructions

## Repository Overview
This repository contains a Home Assistant custom component (`family_bell`).
It follows **Semantic Versioning** and uses **Conventional Commits** to automate versioning.

## Branching Strategy
We use a variation of **GitHub Flow** / **Trunk-Based Development**.

- **`main`**: The source of truth. It should always be deployable.
- **Feature Branches**: All changes (features, fixes) should be done in short-lived branches (e.g., `feat/my-feature`, `fix/bug-123`) and merged into `main` via Pull Request.
- **`beta`**: An optional long-lived branch used for testing changes on a "beta" deployment target before merging to `main`.
  - To test a feature: Merge your feature branch into `beta`. The `deploy-local` workflow will deploy it to the configured local Home Assistant instance.
  - Once verified: Merge the feature branch into `main`.

## Versioning & Releases
Versioning is **automated** based on commit messages.

1.  **Conventional Commits**: You MUST follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.
    - `feat: ...` -> Minor version bump.
    - `fix: ...` -> Patch version bump.
    - `BREAKING CHANGE: ...` or `feat!: ...` -> Major version bump.
    - `chore:`, `docs:`, etc. -> No version bump (unless configured otherwise).

2.  **Automation**:
    - The `.github/workflows/auto-bump.yaml` workflow runs on every push to `main`.
    - It calculates the next version based on new commits.
    - It updates `manifest.json`.
    - It pushes a commit `chore(release): bump version to X.Y.Z`.
    - It creates and pushes a git tag `vX.Y.Z`.

3.  **Manual Release**:
    - Use `.github/workflows/release.yaml` to manually prepare a release PR if needed (e.g., to force a specific version bump).
    - **Note**: Since `auto-bump` runs on every merge to `main`, merging a manual release PR might trigger a subsequent automated patch bump unless the merge commit message starts with `chore(release):`.

## Feature Promotion Workflow
1.  **Develop**: Create a branch `feat/cool-thing`. Write code and tests.
2.  **Verify**: Run tests locally (`pytest`).
3.  **Beta Test (Optional)**: Merge `feat/cool-thing` into `beta`. Verify on the local HA instance.
4.  **Review**: Open a PR to `main`. Ensure CI passes.
5.  **Merge**: Merge to `main`.
6.  **Release**: The system automatically bumps the version and deploys.

## Local Deployment
The `deploy-local.yml` workflow deploys code to a local Home Assistant instance via `rsync`.
- Triggers: Pushes to `main` and `beta`.
- Requirements: Self-hosted runner with access to the HA instance file system.

## Frontend Development
- Frontend code resides in `custom_components/family_bell/www/`.
- It uses **LitElement** and native ES modules.
- No build step (bundler) is used; files are served directly.
- **Verification**: Changes to frontend often require clearing the browser cache or bumping the version in `manifest.json` (handled by auto-bump) to force HA to reload assets.

## Testing
- **Unit Tests**: Run `pytest tests/`.
- **Pre-commit**: Ensure all pre-commit checks pass (linting, formatting).
