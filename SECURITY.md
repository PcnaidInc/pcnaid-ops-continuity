# Security Policy

## Reporting Security Vulnerabilities

If you identify a security issue or vulnerability in this repository, please report it privately through **GitHub Private Vulnerability Reporting** on this repository:

1. Navigate to the **Security** tab of this repository.
2. Under "Reporting", click **Report a vulnerability**.
3. Fill out the report with details, repro steps, and potential impact.

Do not file public issues or pull requests for security vulnerabilities. All reports are investigated privately before coordinated disclosure.

## Security Architecture

- **Local Execution**: This tool runs locally and performs offline static analysis.
- **No Inbound Services**: It does not listen on public network interfaces or accept remote requests.
- **Input Validation**: All JSON and CSV inputs are validated strictly, enforcing limits on file size, nesting depth, and string lengths. Prototype pollution properties (`__proto__`, `prototype`, `constructor`) are rejected.
- **Safe File Operations**: Output writers refuse to follow or overwrite symlinks. Files are created with restricted permissions.
- **Redaction**: Secret-bearing keys and token patterns are automatically sanitized in memory.
