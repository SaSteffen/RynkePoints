# Feature Specification: Run the Daily Job on Demand

**Feature Branch**: `007-manual-daily-run`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "I want to trigger the daily worker right now, via a
script. This is needed more often."

## User Scenarios & Testing *(mandatory)*

The **daily job** is the work the app already does once a day at 03:17 UTC: club
membership checks, expiring riders who never reconnected, re-queueing failed work,
re-reading figures and re-evaluating riders. The **maintainer** is whoever holds the
production secrets. The **run token** is a secret only the maintainer knows.

### User Story 1 - Start the daily job from the command line (Priority: P1)

After a deploy, or to catch up without waiting for the next night, the maintainer
runs one script from their checkout. The production app starts the daily job right
away and the script says it was started.

**Why this priority**: This is the whole feature.

**Independent Test**: With the run token set, run the script against the local app
and see the daily job's work appear in the local log and queue.

**Acceptance Scenarios**:

1. **Given** the run token is set in the maintainer's environment, **When** they run
   the script, **Then** the production app starts the daily job and the script
   reports success within a few seconds, without waiting for the job to finish.
2. **Given** the run token is not set, **When** the maintainer runs the script,
   **Then** it stops with a message naming the missing setting and sends nothing.
3. **Given** the maintainer points the script at another address (e.g. the local
   app), **When** they run it, **Then** the job is started there instead of in
   production.

---

### User Story 2 - Nobody else can start it (Priority: P1)

Anyone on the internet who finds or guesses the address gets nothing: no job runs
and the answer doesn't reveal that the address exists.

**Why this priority**: The repository is public, so the address is public too.
Starting the job costs Strava requests, which all riders share (Principle II).

**Independent Test**: Call the address without a token and with a wrong one; both get
the same answer as an unknown page, and no work is started.

**Acceptance Scenarios**:

1. **Given** a request without a token or with a wrong token, **When** it reaches the
   app, **Then** the app answers exactly like an unknown address and starts nothing.
2. **Given** the run token is not configured on the app, **When** any request reaches
   the address, **Then** the app answers like an unknown address and starts nothing.

### Edge Cases

- The job is started manually while the nightly run (or another manual run) is still
  going: both runs finish without duplicate effects, because the daily job's work is
  already idempotent (Principle II).
- A step of the started job fails: the other steps still run and the failure shows in
  the app's logs, as with the nightly run. The script has already reported "started"
  and does not report the job's outcome.
- The script can't reach the app or gets an unexpected answer: it exits with an error
  showing what it got.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST offer a way to start the daily job on demand that runs
  exactly the same steps as the nightly run.
- **FR-002**: Starting it MUST require the run token; a missing, wrong or
  unconfigured token MUST get the same answer as an unknown address and start
  nothing. The token comparison MUST NOT leak the token through timing.
- **FR-003**: When the token is right, the app MUST acknowledge at once and run the
  job in the background.
- **FR-004**: The repository MUST contain a script that starts the job, reads the run
  token from the environment (never from a committed file), targets production by
  default and accepts another base address.
- **FR-005**: The run token MUST be a production secret like the others (constitution
  Principle I); setting it is a manual step the maintainer runs, documented next to
  the other secrets.
- **FR-006**: The token check and the "starts the same steps" behaviour MUST be
  covered by automated tests.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The maintainer starts the daily job with one command and gets an answer
  in under 5 seconds.
- **SC-002**: Requests without the right token start no work, in every case tested.

## Assumptions

- Only the maintainer uses this; there is no page, button or organiser access for it.
- The script runs on Linux or macOS with `curl` available, like the other scripts.
- The nightly schedule stays as it is; this adds a way to start the same job, it
  doesn't replace it.
- Running the job costs the same Strava requests as the nightly run; the existing
  request-budget handling applies, and how often to run it is the maintainer's call.
