# RRP thought synthesis: source register

Primary/authoritative sources used to distinguish prior art from residual claims. Listing a source does not claim its theorem applies outside its published premises or that its implementation was reproduced here.

- **K1 — Knowledge of Preconditions.** Yoram Moses, *Relating Knowledge and Coordinated Action: The Knowledge of Preconditions Principle*, EPTCS 215 (TARK 2015), 2016. https://arxiv.org/abs/1606.07525
- **K2 — Knowledge/common knowledge in distributed systems.** Joseph Y. Halpern and Yoram Moses, *Knowledge and Common Knowledge in a Distributed Environment*, JACM 37(3), 1990. Author publication abstract: https://www.cs.cornell.edu/home/halpern/abstract
- **A1 — Abstract interpretation.** Patrick Cousot and Radhia Cousot, *Abstract interpretation: a unified lattice model for static analysis of programs by construction or approximation of fixpoints*, POPL 1977. https://www.di.ens.fr/~cousot/COUSOTpapers/POPL77.shtml
- **A2 — CEGAR.** Edmund Clarke, Orna Grumberg, Somesh Jha, Yuan Lu and Helmut Veith, *Counterexample-guided Abstraction Refinement*, CAV 2000. CMU publication register: https://www.cs.cmu.edu/~emc/papers.htm
- **R1 — Escrow.** Patrick E. O'Neil, *The Escrow Transactional Method*, ACM TODS 11(4), 1986, DOI 10.1145/7239.7265.
- **R2 — Bounded counter / escrow rights.** Valter Balegas et al., *Extending Eventually Consistent Cloud Databases for Enforcing Numeric Invariants*, 2015. https://arxiv.org/abs/1503.09052
- **R3 — Separation logic and resources.** Peter W. O'Hearn, *Resources, concurrency, and local reasoning*, Theoretical Computer Science 375, 2007. https://doi.org/10.1016/j.tcs.2006.12.035
- **C1 — Local-to-global relational consistency.** Catriel Beeri, Ronald Fagin, David Maier and Mihalis Yannakakis, *On the Desirability of Acyclic Database Schemes*, JACM 30, 1983. IBM Research: https://research.ibm.com/publications/on-the-desirability-of-acyclic-database-schemes
- **C2 — Sheaf data integration.** Michael Robinson, *Sheaves are the canonical datastructure for sensor integration*, Information Fusion 36, 2017. https://arxiv.org/abs/1603.01446
- **C3 — Assume/guarantee composition.** Martín Abadi and Leslie Lamport, *Composing Specifications*, ACM TOPLAS 15(1), 1993. Microsoft Research: https://www.microsoft.com/en-us/research/publication/composing-specifications/
- **I1 — Rate distortion.** Claude E. Shannon, *Coding Theorems for a Discrete Source With a Fidelity Criterion*, 1959.
- **I2 — Data-rate-limited control.** Girish N. Nair, Fabio Fagnani, Sandro Zampieri and Robin J. Evans, *Feedback Control Under Data Rate Constraints: An Overview*, Proceedings of the IEEE 95(1), 2007, DOI 10.1109/JPROC.2006.887294. University of Padua record: https://www.research.unipd.it/handle/11577/2443718
- **I3 — Good Regulator theorem.** Roger C. Conant and W. Ross Ashby, *Every good regulator of a system must be a model of that system*, International Journal of Systems Science 1(2), 1970, DOI 10.1080/00207727008920220.
- **F1 — Unreliable failure detectors.** Tushar Deepak Chandra and Sam Toueg, *Unreliable Failure Detectors for Reliable Distributed Systems*, JACM 43(2), 1996. Cornell register: https://www.cs.cornell.edu/info/people/sam/FDpapers.html
- **T1 — Rational/Byzantine threat models.** Amitanand S. Aiyer et al., *BAR Fault Tolerance for Cooperative Services*, SOSP 2005. UT Austin: https://www.cs.utexas.edu/lasr/paper.php?uid=63

## Explicitly rejected authority shortcuts

- No philosopher or systems-theory slogan is treated as proof merely because it sounds compatible with the architecture.
- "Good regulator" does not imply full-state replication without mapping its optimization/model premises.
- Sheaf/category language does not prove network consistency without a concrete local-to-global model.
- Separation/linear logic does not make hostile network bits physically uncopyable.
- Rate-distortion does not relax discrete game invariants unless the game specification defines an appropriate distortion/loss contract.
- Common knowledge is not imposed on every commit; doing so can add an unnecessary coordination requirement.
