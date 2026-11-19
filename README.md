# api-catalog

Onboarding catalog of the API platform (PoC, dummy data only). One file per API: `apis/<api_name>.json`.

## Flow
1. `sync-servicenow` (4x per hour or manually) pulls approved requests from ServiceNow, claims them and opens one PR per request with a GitHub App token
2. `validate` (required check) runs unit tests and validates every entry (names, reserved names, https URLs with DNS host names, data class, no unknown fields)
3. After the merge, `on-merge` reports "provisioning" to ServiceNow for newly added entries
4. The platform (OpenTofu in `api-platform`) creates the repository `api-<api_name>` from the template
5. `report-done` (manual in the PoC, input: api_name) reads the request number from the entry and closes the request in ServiceNow

## Configuration
| Name | Kind | Where |
|---|---|---|
| `SN_INSTANCE`, `SN_API_PATH` | variables | repository |
| `CATALOG_APP_CLIENT_ID` | variable | repository |
| `CATALOG_APP_PRIVATE_KEY` | secret | environment `servicenow` |
| `SN_USER`, `SN_PASSWORD` | secrets | environment `servicenow` (only the main branch may use it) |

The GitHub App has only `contents: write` and `pull_requests: write` on this repository. Failed requests are reported to ServiceNow as "failed"; to retry, set the request back to "ready" in ServiceNow (the branch is removed automatically).

Note: the schedule of a public repository is disabled by GitHub after 60 days without activity (`gh workflow enable sync-servicenow`). Production: ServiceNow triggers the run (`repository_dispatch`) instead of polling.
