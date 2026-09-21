# Instructions for Claude Code

## Session handoff

Before running out of context or hitting a session limit, write (or update) `md_files/SESSION_HANDOFF.md`
summarizing:
- What's committed this session (commit hashes + one line each).
- What's uncommitted in the working tree right now, file by file, and exactly what's still needed to finish
  it (not just "in progress" - concrete next steps, e.g. "wire X into Y, then add a test for Z").
- Any feature that's fully unstarted but was discussed/planned, with a pointer to where its spec lives
  (usually `md_files/ROADMAP.md`).
- Anything discovered this session that isn't obvious from the code (a pre-existing bug worked around, a
  balance finding, a gotcha in the dev workflow) so it isn't silently rediscovered next time.

Do this every session that touches this repo, not just when explicitly asked - the goal is that any future
session (or the user) can run `git status`, read `SESSION_HANDOFF.md`, and continue with zero re-derivation.
Once a session's leftover work is finished and committed, fold anything still relevant into `ROADMAP.md`
(each feature there already has its own "Status: done" / "Resolved" / "Tests" structure - use it) and either
delete `SESSION_HANDOFF.md` or trim it back to just the next pending item, so it never grows into a second,
stale roadmap.
