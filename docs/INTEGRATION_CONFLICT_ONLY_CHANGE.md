# Conflict-only routing change

The Fast Repair workflow now ends after mechanically safe branch reconciliation and wakes Fast Lane directly. The former `stack-fast` job that installed dependencies and ran DEV validation/build was removed from the repair executor.

Failures observed after reconciliation belong to a separate CI repair path. This does not weaken any independent merge or Production gate; it prevents conflict repair from recursively becoming CI repair.
