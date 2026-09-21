# Autonomous Exoskeleton Doctrine

## Purpose

The autonomous development framework is a **capability-gap exoskeleton**. It exists to compensate for limitations of the model, tools, runtime visibility, or operational environment available **now**. It is not the product, not a permanent software architecture, and not a set of rituals that future models must inherit.

The desired direction is:

```
model/tool capability increases
        ↓
external scaffolding decreases
        ↓
same or better player outcome, reliability, and delivery speed
```

A future state with no autonomous scaffolding at all is valid.

## Nothing here is sacred

No present mechanism is assumed permanent. This explicitly includes:

- Observation First ordering
- Dense Iteration rules
- experiment schemas and hypothesis/falsifier forms
- focused tests and regression tests
- GitHub Actions validation
- immutable staging
- browser review / Before-After evidence
- receipts and experiment history
- telemetry
- freshness / reconciliation choreography

Tests are an evidence mechanism, not truth itself. If a future model/runtime can establish the intended outcome more directly and reliably, removing tests may be the correct simplification. The same rule applies to CI, browser review, evidence ledgers, and every other process layer.

## Current contract is still real

"Removable" does not mean "optional inside today's task."

While a scaffold is marked `required-currently`, agents must execute it. An agent must not self-declare that its model is now capable enough and silently skip a current gate. Detachment is a deliberate framework change that updates the contract and the machine-readable inventory together.

This distinction lets the repository be strict today without fossilizing today's constraints.

## Design rules

1. **Gap anchored**  
   Every scaffold must exist because of a named current capability or operational gap. "We always do this" is not a sufficient reason.

2. **Detachable by construction**  
   A scaffold must have an explicit detachment condition. Avoid hiding product/domain semantics inside validation, telemetry, receipts, or orchestration.

3. **No accidental mesh**  
   Unrelated scaffolds should not require each other's private artifacts. Dependencies must be explicit in `exoskeleton.json`. Prefer common inputs/outputs over chained ceremony.

4. **Native capability wins**  
   If a model/tool can perform the job natively with equal or better outcomes, prefer removing or replacing the external scaffold instead of duplicating the capability.

5. **Less process is better when outcomes hold**  
   Added steps are a cost. If quality, safety, player outcome, and delivery reliability remain equal or improve, the smaller exoskeleton is preferable.

6. **Deletion is a successful evolution**  
   Removing a once-useful contract, test suite, workflow, evidence format, or orchestration layer is not architectural loss when the compensated gap has disappeared.

7. **Do not invent a permanent kernel**  
   Even mechanisms that look fundamental today are only current requirements unless they are product or governance requirements independent of model capability. Re-evaluate rather than canonize.

## Adding a scaffold

A new scaffold must update `.autonomous/exoskeleton.json` and declare:

- `compensatesFor`: the observed capability/operational gap;
- `dependencies`: only the scaffolds it actually requires;
- `detachWhen`: a concrete condition under which removal/replacement should be considered;
- `state`: whether it is required, optional, or retired now;
- `removable: true`.

Do not add a scaffold merely to make the framework feel safer or more complete. Tie it to an observed failure mode.

## Removing or replacing a scaffold

When model/tool capability changes, evaluate whether a scaffold still buys anything. The evaluation method itself does **not** have to be a conventional test suite. Use the cheapest credible evidence appropriate to the capability being changed.

A framework contraction should:

1. identify the gap that is now covered natively or no longer relevant;
2. remove the scaffold and its unnecessary dependencies rather than leaving dead compatibility layers;
3. update this doctrine only if the philosophy changes, and always update `exoskeleton.json` state/inventory;
4. preserve current user/product/governance requirements that are independent of the removed scaffold.

The target is not maximum process. The target is maximum capability with minimum external constraint.
