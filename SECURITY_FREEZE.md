# Legacy live-trading security freeze

This repository is a legacy prototype. It is not an approved execution service.
The active implementation is `capital-cipher-platform`, currently restricted to
PAPER mode.

## Controls implemented in source

- `trading-ai` is a tombstone Edge Function that returns HTTP 410.
- `bybit-api` is a tombstone Edge Function that returns HTTP 410.
- The frontend exchange hook never invokes Supabase or an exchange.
- The account mode is fixed to PAPER and cannot be toggled to real.
- The autonomous bot records simulated trades only.
- The downloadable Python mainnet bot was removed from the public bundle.
- JWT verification is enabled for every declared Edge Function.
- CI contains a regression test that fails if live order primitives return.

## Required deployment actions

Source changes alone do not disable already-deployed functions or revoke
credentials. An administrator of the existing Supabase and Bybit environments
must complete this checklist:

1. Deploy the frozen `trading-ai` and `bybit-api` Edge Functions.
2. Deploy the `verify_jwt = true` configuration for all functions.
3. Verify unauthenticated requests are rejected by the gateway.
4. Verify authenticated requests to both frozen functions return HTTP 410.
5. Revoke every Bybit API key ever used by this project.
6. Remove `BYBIT_API_KEY`, `BYBIT_API_SECRET`, `ENABLE_REAL_TRADING`, and any
   mainnet confirmation secrets from the Supabase project.
7. Review exchange audit logs and confirm no orders were emitted during the
   deployment window.
8. Rotate any other secret found in repository history or deployment settings.

Record the operator, timestamp, evidence links, and outcome for every item.

## Exit criteria

Do not archive this repository until:

- the hosted legacy endpoints are verified frozen;
- historical credentials are revoked and rotation evidence exists;
- approved visual components have moved to `capital-cipher-platform`;
- no production deployment references the legacy frontend or functions;
- the final repository disposition is recorded in
  `capital-cipher-specification`.
