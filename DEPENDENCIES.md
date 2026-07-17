# Dependencies

Omnipotents uses the following repositories as Git submodules. The superproject records the exact commit used for every release; `.gitmodules` records each upstream URL.

| Dependency | Path | Role |
| --- | --- | --- |
| Anatomia | `dependencies/Anatomia` | Source-code graph, domain membership, and architecture-health analysis. |
| Ludus | `dependencies/Ludus` | Play-taxonomy and Open Knowledge Framework reference data. |

Clone with the exact dependency revisions:

```powershell
git clone --recurse-submodules https://github.com/LUDIARS/Omnipotents.git
```

For an existing clone, run `./scripts/Initialize-OmnipotensDependencies.ps1`, then `./scripts/Test-OmnipotensRepository.ps1` before using the skill.

Do not edit a dependency inside this repository. Make dependency changes in its own repository, merge them there, then update the submodule pointer here in a separate Omnipotents change.

## Runtime skill dependency

Stage 8 and stage 9 require a separately reviewed Vitia skill. Vitia is not a Git submodule of this repository: the operator must pass its exact skill root to `skills/omnipotens/scripts/vitia-source-manifest.mjs`. The generated manifest records the optional commit or package version and the SHA-256 of every UX reference and audit file used. This keeps Vitia as the source of truth without copying a stale snapshot into Omnipotents.

If the Vitia root, required files, or label-neutrality markers cannot be verified, stage 8 is `blocked`. Do not substitute another checkout, cached prose, or a generic UX review and report it as Vitia-backed analysis.
