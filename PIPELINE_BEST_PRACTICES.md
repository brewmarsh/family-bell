# Pipeline Best Practices

This document outlines best practices for the CI/CD pipeline in this repository.

## General Principles

*   **Keep it Simple:** Pipelines should be easy to understand and maintain. Avoid over-complicating workflows.
*   **Fail Fast:** Design your pipeline to catch errors as early as possible. Run quick checks like linting and unit tests before longer-running tasks like integration or end-to-end tests.
*   **Idempotency:** Pipelines should be designed to be runnable multiple times with the same result.

## Action Versioning

*   **Pin Actions to a Specific SHA:** To ensure pipeline stability and security, always pin GitHub Actions to a specific commit SHA rather than a branch or tag (e.g., `v2`). This prevents unexpected changes from breaking your builds.

    ```yaml
    # Good
    - uses: actions/checkout@a12a3943b4bdde767164d792f336fc14de6c3df2 # v3.5.3

    # Avoid
    - uses: actions/checkout@v3
    - uses: actions/checkout@main
    ```

## Dependency Management

*   **Cache Dependencies:** Use caching mechanisms (like `actions/cache`) to speed up builds by storing and reusing dependencies.
*   **Lock Dependencies:** Always use a lock file (e.g., `requirements.txt`, `package-lock.json`) to ensure that the same versions of dependencies are used in every build.

## Security

*   **Use Secrets:** Store all sensitive information, such as API keys and tokens, as encrypted secrets in GitHub. Do not hardcode them in your workflow files.
*   **Limit Permissions:** Grant your workflows only the minimum permissions they need to perform their tasks.

## Testing

*   **Comprehensive Testing:** The pipeline should run a comprehensive suite of tests, including unit, integration, and end-to-end tests, to ensure code quality.
*   **Run on Pull Requests:** All tests should be automatically triggered on every pull request to the `main` branch to catch issues before they are merged.
