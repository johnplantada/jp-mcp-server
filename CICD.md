# CI/CD Pipeline Documentation

## Overview

This project uses GitHub Actions for continuous integration and deployment. The pipeline ensures code quality, automates testing, and streamlines the release process.

## Pipeline Architecture

```mermaid
graph TB
    subgraph "Development Flow"
        A[Developer Push] --> B{Branch Type?}
        B -->|feature/main| C[CI Workflow]
        B -->|PR| D[PR Validation]
        B -->|tag v*| E[Release Workflow]
    end
    
    subgraph "CI Workflow"
        C --> C1[Test Node 18.x]
        C --> C2[Test Node 20.x]
        C2 --> C3[Coverage Report]
        C1 --> C4[Build]
        C2 --> C4
        C4 --> C5[TypeScript Check]
    end
    
    subgraph "PR Validation"
        D --> D1[Run Tests]
        D1 --> D2[Coverage Analysis]
        D2 --> D3[Build Verification]
        D3 --> D4[Package Validation]
        D4 --> D5[Post PR Comment]
    end
    
    subgraph "Release Workflow"
        E --> E1[Run Tests]
        E1 --> E2[Build]
        E2 --> E3[Version Update]
        E3 --> E4[GitHub Release]
        E4 --> E5[NPM Publish]
        E5 --> E6[GitHub Packages]
    end
```

## Workflows

### 1. Continuous Integration (CI)

**File:** `.github/workflows/ci.yml`  
**Triggers:** Push to `main` or `feature-*` branches, Pull requests to `main`

```mermaid
flowchart LR
    A[Trigger] --> B[Checkout Code]
    B --> C[Setup Node.js]
    C --> D[Install Dependencies]
    D --> E[Run Tests]
    E --> F[Coverage Report]
    F --> G[Build Project]
    G --> H[Verify Artifacts]
    H --> I[TypeScript Check]
    
    style A fill:#f9f,stroke:#333,stroke-width:2px
    style F fill:#9f9,stroke:#333,stroke-width:2px
    style I fill:#9ff,stroke:#333,stroke-width:2px
```

#### Features:
- **Matrix Testing**: Tests on Node.js 18.x and 20.x
- **Coverage Reporting**: Displays test coverage in logs
- **Build Verification**: Ensures all artifacts are created
- **TypeScript Validation**: Checks for type errors

#### Configuration:
```yaml
strategy:
  matrix:
    node-version: [18.x, 20.x]
```

### 2. Pull Request Validation

**File:** `.github/workflows/pr-validation.yml`  
**Triggers:** PR opened, synchronized, or reopened

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant GH as GitHub
    participant Act as Actions
    participant PR as Pull Request
    
    Dev->>GH: Create/Update PR
    GH->>Act: Trigger Validation
    Act->>Act: Run Tests
    Act->>Act: Calculate Coverage
    Act->>Act: Build Project
    Act->>Act: Validate Package
    Act->>PR: Post Comment with Results
    PR-->>Dev: Validation Feedback
```

#### Features:
- **Comprehensive Testing**: Full test suite execution
- **Coverage Analysis**: Calculates and reports coverage percentages
- **Build Validation**: Verifies successful compilation
- **Automated Feedback**: Posts validation results as PR comment

#### PR Comment Format:
```markdown
## PR Validation Results

### ✅ Validation Passed
- Tests: All tests passing
- Build: Successfully built all artifacts
- Package: Valid package.json structure

### 📊 Code Coverage
- Statements: 88.75%
- Branches: 88.02%
- Functions: 83.54%
- Lines: 88.69%
```

### 3. Automated Code Review

**File:** `.github/workflows/code-review.yml`  
**Triggers:** PR opened or synchronized with code changes

```mermaid
flowchart LR
    A[PR Created/Updated] --> B[Code Quality Check]
    B --> C[ESLint Analysis]
    B --> D[Security Scan]
    B --> E[Complexity Analysis]
    C --> F[Generate Report]
    D --> F
    E --> F
    F --> G[Post Review Comment]
    G --> H[Add Labels]
    
    style A fill:#f9f,stroke:#333,stroke-width:2px
    style G fill:#9ff,stroke:#333,stroke-width:2px
```

#### Features:
- **ESLint Analysis**: Checks for code quality issues
- **Security Scanning**: Detects hardcoded secrets and vulnerabilities
- **Complexity Analysis**: Reports on code complexity metrics
- **Automated Comments**: Posts detailed review feedback
- **Label Management**: Adds review status labels
- **Copilot Integration**: Information about AI-powered reviews

### 4. Release Workflow

**File:** `.github/workflows/release.yml`  
**Triggers:** Push tags matching `v*` or manual workflow dispatch

```mermaid
flowchart TB
    A[Release Trigger] --> B{Trigger Type?}
    B -->|Tag Push| C[Extract Version from Tag]
    B -->|Manual| D[Use Input Version]
    C --> E[Run Tests]
    D --> E
    E --> F[Build Project]
    F --> G[Update package.json]
    G --> H[Create GitHub Release]
    H --> I{Pre-release?}
    I -->|No| J[Publish to NPM]
    I -->|Yes| K[Publish to NPM Beta]
    J --> L[Publish to GitHub Packages]
    K --> L
    
    style A fill:#f9f,stroke:#333,stroke-width:2px
    style H fill:#9f9,stroke:#333,stroke-width:2px
    style J fill:#ff9,stroke:#333,stroke-width:2px
    style L fill:#9ff,stroke:#333,stroke-width:2px
```

#### Features:
- **Version Management**: Automatic version extraction from tags
- **Dual Publishing**: Publishes to both NPM and GitHub Packages
- **Pre-release Support**: Beta versions with `-` in version number
- **GitHub Release Creation**: Automatic release notes generation

## Configuration Requirements

### 1. Repository Secrets

```mermaid
graph LR
    A[Repository Settings] --> B[Secrets & Variables]
    B --> C[Actions Secrets]
    C --> D[NPM_TOKEN]
    C --> E[GITHUB_TOKEN]
    
    style D fill:#ff9,stroke:#333,stroke-width:2px
    style E fill:#9f9,stroke:#333,stroke-width:2px
```

| Secret | Required | Description | How to Obtain |
|--------|----------|-------------|---------------|
| `NPM_TOKEN` | Yes (for releases) | NPM authentication token | `npm token create` |
| `GITHUB_TOKEN` | Auto-provided | GitHub authentication | Automatically available |

### 2. Setting Up NPM Token

```bash
# 1. Login to NPM
npm login

# 2. Create token
npm token create

# 3. Copy the token
# 4. Go to GitHub repo settings
# 5. Navigate to Secrets → Actions
# 6. Add new secret named NPM_TOKEN
```

### 3. Branch Protection Rules

Recommended settings for `main` branch:

```mermaid
graph TB
    A[Branch Protection] --> B[Require PR Reviews]
    A --> C[Require Status Checks]
    A --> D[Require Up-to-date Branch]
    
    C --> E[CI / test 18.x]
    C --> F[CI / test 20.x]
    C --> G[CI / build]
    C --> H[PR Validation]
```

## Usage Guide

### Running Workflows

#### 1. Automatic Triggers

```mermaid
flowchart LR
    A[git push] --> B{Where?}
    B -->|main| C[CI Workflow]
    B -->|feature-*| C
    B -->|PR| D[PR Validation]
    
    E[git tag v1.0.0] --> F[Release Workflow]
    G[git push --tags] --> F
```

#### 2. Manual Release

1. Go to Actions tab
2. Select "Release" workflow
3. Click "Run workflow"
4. Enter version (e.g., `1.0.0`)
5. Click "Run workflow" button

### Testing Locally

```bash
# Install act (GitHub Actions runner)
brew install act  # macOS
# or
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Test workflows locally
act push                # Test CI workflow
act pull_request       # Test PR workflow
act workflow_dispatch  # Test manual triggers
```

## Coverage Reporting

### Coverage Thresholds

Current project coverage:

```mermaid
pie title Code Coverage Distribution
    "Covered Lines" : 88.75
    "Uncovered Lines" : 11.25
```

| Metric | Coverage | Target |
|--------|----------|--------|
| Statements | 88.75% | >85% |
| Branches | 88.02% | >80% |
| Functions | 83.54% | >80% |
| Lines | 88.69% | >85% |

### Coverage Reports Location

- **Local**: `./coverage/lcov-report/index.html`
- **CI Logs**: Available in GitHub Actions run logs
- **PR Comments**: Automatically posted on pull requests

## Troubleshooting

### Common Issues

#### 1. NPM Publish Fails

**Error:** `npm ERR! 401 Unauthorized`

**Solution:**
```bash
# Regenerate NPM token
npm token create

# Update GitHub secret
# Settings → Secrets → Actions → NPM_TOKEN → Update
```

#### 2. Coverage Report Missing

**Error:** Coverage not showing in logs

**Solution:**
```bash
# Ensure test:ci script includes coverage
npm run test:ci  # Should run: jest --coverage --watchAll=false
```

#### 3. Build Artifacts Not Found

**Error:** `test: dist/servers/persona.js: No such file`

**Solution:**
```bash
# Ensure build runs before verification
npm run build
# Check tsconfig.json outDir setting
```

## Maintenance

### Updating Node Versions

Edit `.github/workflows/ci.yml`:

```yaml
strategy:
  matrix:
    node-version: [18.x, 20.x, 22.x]  # Add new versions
```

### Adding New Checks

Add to PR validation workflow:

```yaml
- name: New Check
  run: |
    echo "Running new validation"
    npm run your-new-script
```

### Modifying Release Process

Edit `.github/workflows/release.yml` to add pre/post release steps:

```yaml
- name: Pre-release Hook
  run: npm run prerelease
  
# ... existing release steps ...

- name: Post-release Hook
  run: npm run postrelease
```

## Best Practices

1. **Commit Messages**: Use conventional commits for better release notes
   ```
   feat: add new feature
   fix: resolve bug
   docs: update documentation
   chore: maintenance tasks
   ```

2. **Version Tags**: Follow semantic versioning
   ```
   v1.0.0     # Major release
   v1.1.0     # Minor release
   v1.1.1     # Patch release
   v1.2.0-beta.1  # Pre-release
   ```

3. **PR Workflow**: 
   ```mermaid
   graph LR
       A[Feature Branch] --> B[Create PR]
       B --> C[Automated Checks]
       C --> D[Code Review]
       D --> E[Merge to Main]
       E --> F[CI Runs]
       F --> G[Ready for Release]
   ```

## GitHub Copilot Integration

### Enabling Copilot for Pull Requests

1. **Repository Settings**:
   - Go to Settings → GitHub Copilot
   - Enable "Copilot for Pull Requests"

2. **Copilot Features**:
   - **Automatic PR Reviews**: AI-powered code suggestions
   - **Security Scanning**: Identifies potential vulnerabilities
   - **Code Quality**: Suggests improvements and best practices
   - **Documentation**: Recommends missing documentation

3. **Copilot Comments**:
   ```markdown
   Copilot will automatically comment on:
   - Code smells and anti-patterns
   - Performance optimizations
   - Security vulnerabilities
   - Missing error handling
   - Suggested refactoring
   ```

### AI Review Workflow

```mermaid
graph TB
    A[PR Opened] --> B{Copilot Enabled?}
    B -->|Yes| C[Automatic Analysis]
    B -->|No| D[Manual Review Only]
    C --> E[Generate Suggestions]
    E --> F[Post Review Comments]
    F --> G[Developer Response]
    G --> H[Update Code]
    H --> C
```

## Security Considerations

1. **Never commit secrets** to the repository
2. **Use GitHub Secrets** for sensitive data
3. **Limit token permissions** to minimum required
4. **Rotate tokens regularly** (every 90 days recommended)
5. **Review workflow permissions** in repository settings
6. **Enable Copilot security scanning** for vulnerability detection

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [NPM Publishing Guide](https://docs.npmjs.com/cli/v8/commands/npm-publish)
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)