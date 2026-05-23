## OpenCode Alloy Overlay

This GSD agent is distributed by OpenCode Alloy from a locked upstream snapshot.

Alloy policy:

- GSD owns `.planning` state, phase artifacts, reviews, and verification.
- Alloy owns repo profile selection, model role mapping, and vendored skill distribution.
- Use `alloy-tdd` for implementation cards that change behavior.
- Use `alloy-debug` for unexpected failures before proposing fixes.
- Use `alloy-reviewer` and `alloy-verifier` concepts when judging claims outside built-in GSD review/verify artifacts.
- Do not call OMO-only APIs. OMO Slim is experimental and does not own GSD state.
