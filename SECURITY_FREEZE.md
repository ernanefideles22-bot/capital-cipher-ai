# Legacy live-trading security freeze

This repository is a legacy prototype. It is not an approved execution service.
The active implementation is `capital-cipher-platform`, currently restricted to
PAPER mode.

## Controls implemented in source

- All six Edge Functions are tombstones that return HTTP 410.
- No legacy function reads exchange, AI, voice, or service-role secrets.
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

1. Deploy all six frozen Edge Functions.
2. Deploy the `verify_jwt = true` configuration for all functions.
3. Apply `20260717000000_harden_legacy_rls.sql`.
4. Verify unauthenticated requests are rejected by the gateway.
5. Verify authenticated requests to every frozen function return HTTP 410.
6. Revoke every historical Bybit, AI gateway, and ElevenLabs credential.
7. Remove legacy provider and service-role secrets from the Supabase project.
8. Review provider and exchange audit logs for unexpected activity.
9. Rotate any other secret found in repository history or deployment settings.

Record the operator, timestamp, evidence links, and outcome for every item.

## Exit criteria

Do not archive this repository until:

- the hosted legacy endpoints are verified frozen;
- the RLS hardening migration is applied;
- historical credentials are revoked and rotation evidence exists;
- approved visual components have moved to `capital-cipher-platform`;
- no production deployment references the legacy frontend or functions;
- the final repository disposition is recorded in
  `capital-cipher-specification`.
