# DEV hidden manifest restore repair

Repair the develop/DEV publish blocker caused by legacy hidden files such as `.gitattributes` being retained in deployment-manifest entries even though GitHub Pages does not serve them.

Scope: deployment reconstruction only. Preserve visible-file integrity/hash checks, current environment retention policy, main, and Production.

Base: c5fb1963bea68fc380d5f2523cea8464c6d91481
