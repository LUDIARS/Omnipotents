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
