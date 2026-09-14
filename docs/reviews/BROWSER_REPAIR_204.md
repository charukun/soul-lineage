# Browser repair #204

The public DEV browser gate on develop `225b714671ede15d3570e2a73deca73fee29ba79` fails at the native `土の寝床` catalog tap. PR #173 cannot merge while this baseline fails.

Evidence: run 34809520991, artifact `dev-browser-225b714671ede15d3570e2a73deca73fee29ba79`, failure trace and screenshot. The embedded helper source matches current develop exactly; the displayed stack line number is misleading. The native pointer was moved to a valid card point, then no stable hit could be found within the unchanged 8 second budget. The final screenshot shows only the unlocked bed, while the accessibility snapshot intermittently includes every locked furnishing.

Code inspection found competing catalog writers: the renderer applies furniture unlock rules, while two facility UI intervals unconditionally unhide all furniture every 120/300ms. This changes the drawer geometry during native input. The repair will preserve facility editing and apply the existing unlock rule consistently. Native input, assertions and deadlines remain unchanged.

Ticket #204 is claimed by `chatgpt-integration-pr173-unblock` at attempt 1. Implementation and validation are pending.
