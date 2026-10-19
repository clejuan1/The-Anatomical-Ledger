# HISTORY_SCRUB.md

This file documents step-by-step instructions to safely remove a public secret that appears in a tag or commit from your repository history. These are destructive operations (they rewrite history) — read everything before you run commands and coordinate with collaborators.

WARNING
- Rewriting history will change commit SHAs. Everyone with clones will need to re-clone or reset their local branches.
- Revoke and rotate the leaked credential in Google Cloud BEFORE or IMMEDIATELY AFTER cleaning history.
- Create backups of the repo (mirror clone) before making destructive changes.

Prerequisites
- Install git-filter-repo (recommended) or BFG.
  - git-filter-repo: pip install git-filter-repo
  - BFG: https://rtyley.github.io/bfg-repo-cleaner/
- Have push rights to the repository.
- Know the exact tag name (e.g., "Public Leak") and/or the secret string or a sufficiently long substring of it.

1) Quick: Remove a remote tag named exactly "Public Leak" (non-destructive)
If the secret is only present in a tag annotation or the tag points to a commit you do NOT need to preserve publicly:

```bash
# fetch tags
git fetch --tags
# list tags to confirm (case-insensitive search)
git tag -l | grep -i "Public Leak"

# delete local tag if present
git tag -d "Public Leak"

# delete the remote tag
git push origin --delete tag "Public Leak"
# alternative remote delete
# git push origin :refs/tags/"Public Leak"

# verify it's gone
git ls-remote --tags origin | grep -i "Public Leak" || echo "tag removed"
```

After deleting the tag, wait a minute and check the GitHub secret scanning alert again. If the alert still references a commit or branch, proceed to the next section.

2) Recommended: Scrub the secret from history using git-filter-repo (rewrites all commits that contain the secret)

Steps below operate on a mirror clone. This avoids accidental changes to your working copy.

```bash
# 1. Create a mirror clone (bare repository)
git clone --mirror git@github.com:clejuan1/The-Anatomical-Ledger.git The-Anatomical-Ledger.git
cd The-Anatomical-Ledger.git

# 2. Create a replacements file listing the secret(s) to remove.
# Each line: secret_to_remove==>REDACTED
# Example: the long API key string or a unique substring
cat > ../replacements.txt <<'EOF'
AQ.Ab8RN6KRGWiFaIpt3hOp1faGkCorK-hkBJKHns9cojYRnUGpXg==>REDACTED
# Add additional secrets on new lines if needed
EOF

# 3. Run git-filter-repo (will rewrite history and remove/replace secrets)
cd ..
# Move the replacements file into the mirror repo dir if needed
mv replacements.txt The-Anatomical-Ledger.git/
cd The-Anatomical-Ledger.git

# Run filter-repo using replace-text
git filter-repo --replace-text replacements.txt

# 4. Inspect the repository locally to ensure everything looks ok
# (You can browse the log and tree to ensure no secret remains.)

# 5. Force-push the cleaned repository back to GitHub (CAUTION)
git push --force --tags origin 'refs/heads/*'

# 6. Cleanup local clones (instruct collaborators):
# All contributors must either re-clone or run the following (destructive) sequence in their clones:
# git fetch origin
# git switch --detach
# git reset --hard origin/main  # or the branch you use
# git clean -fdx
# (or simply: re-clone the repo)
```

Notes and alternatives
- If you prefer BFG (simpler for single large secrets):
  1. Create a mirror: git clone --mirror ...
  2. Run: java -jar bfg.jar --replace-text replacements.txt repo.git
  3. Follow BFG cleanup steps and force-push.

- If the secret is relatively small and you only need to remove it from one commit that is not on any branches, consider deleting the offending tag/commit instead of rewriting all history.

- After pushing the cleaned repo, go to GitHub Settings -> Security -> Secret Scanning and verify the alert. You may need to dismiss or wait for re-scan.

Post-cleanup checklist
1. Revoke and rotate the leaked credential in Google Cloud (if you haven't already).
2. Ensure your running /api/liaison reads the new credential from an environment variable or Secret Manager, not source code.
3. Add a pre-commit hook and CI secret checks:
   - Install `git-secrets` or `pre-commit` with secret-detection hooks.
4. Communicate with all contributors: they must re-clone or reset their local repos to avoid reintroducing the secret.
5. Verify on GitHub that secret scanning no longer reports the exposure.

If you want, I can prepare and run the exact git-filter-repo commands for you, but I will need explicit permission to rewrite history and force-push the cleaned repo. I will also create a backup mirror before performing the rewrite.
