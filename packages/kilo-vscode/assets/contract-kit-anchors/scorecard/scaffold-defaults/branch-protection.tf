# =============================================================================
# Branch protection (Terraform) — Contract Kit Creator scaffold default
# -----------------------------------------------------------------------------
# OpenSSF Scorecard's `Branch-Protection` check requires that the repo's
# default branch (and any release branches) have:
#
#   - Required pull-request reviews (>= 1 approving review)
#   - Required status checks (CI must pass before merge)
#   - Linear history / no force pushes
#   - Conversation resolution before merge
#   - Restrictions on who can push (admins included)
#
# These settings cannot be reliably enforced from a workflow alone — they must
# be applied through GitHub's branch-protection API. This Terraform module is
# the recommended path: declarative, code-reviewed, replayable.
#
# Usage:
#
#   1. Install Terraform >= 1.5 and the GitHub provider:
#        cd compliance/branch-protection && terraform init
#   2. Set GITHUB_TOKEN to a token with `repo` + `admin:org` scopes.
#   3. Edit the locals { ... } block below for your repo + reviewer team.
#   4. terraform plan && terraform apply
#
# Re-run on every owner change. The plan is idempotent.
# =============================================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    github = {
      source  = "integrations/github"
      version = "~> 6.2"
    }
  }
}

provider "github" {
  # Reads GITHUB_TOKEN / GITHUB_OWNER from environment.
  owner = local.repo_owner
}

locals {
  repo_owner       = "REPLACE_WITH_OWNER"      # e.g. "kilo-org"
  repo_name        = "REPLACE_WITH_REPO"       # e.g. "my-project"
  reviewers_team   = "REPLACE_WITH_TEAM_SLUG"  # e.g. "security-reviewers"
  protected_branches = [
    "main",
    "release/*",
  ]

  required_status_checks = [
    "ci",
    "codeql",
    "openssf-scorecard",
  ]
}

resource "github_branch_protection" "protected" {
  for_each      = toset(local.protected_branches)
  repository_id = local.repo_name
  pattern       = each.value

  enforce_admins                  = true
  require_signed_commits          = true
  required_linear_history         = true
  allows_deletions                = false
  allows_force_pushes             = false
  require_conversation_resolution = true

  required_status_checks {
    strict   = true
    contexts = local.required_status_checks
  }

  required_pull_request_reviews {
    required_approving_review_count = 1
    dismiss_stale_reviews           = true
    require_code_owner_reviews      = true
    require_last_push_approval      = true
    pull_request_bypassers          = []
  }
}

# Recommended companion: enable secret scanning + push protection.
resource "github_repository" "settings" {
  name                   = local.repo_name
  vulnerability_alerts   = true
  delete_branch_on_merge = true

  security_and_analysis {
    secret_scanning {
      status = "enabled"
    }
    secret_scanning_push_protection {
      status = "enabled"
    }
  }
}
