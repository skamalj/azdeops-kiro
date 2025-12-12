# Distribution Strategy for Azure DevOps Integration

## Overview

This project provides Azure DevOps integration for both VS Code and Kiro IDE through two separate but related packages:

- **VS Code Extension**: Traditional GUI-based extension
- **Kiro Power**: MCP-based conversational interface

## Distribution Channels

### VS Code Extension

#### 1. Visual Studio Marketplace (Production)
```bash
# Setup publisher account
npx vsce create-publisher your-publisher-name

# Publish extension
cd extension
npx vsce publish
```

**Benefits:**
- Automatic discovery in VS Code
- Built-in update mechanism
- User reviews and ratings
- Download analytics

#### 2. GitHub Releases (Beta/Enterprise)
```bash
# Create release package
cd extension
npx vsce package
# Upload azure-devops-integration-1.0.0.vsix to GitHub releases
```

**Use cases:**
- Beta testing
- Enterprise internal distribution
- Custom/modified versions

#### 3. Private Extension Gallery (Enterprise)
- Azure DevOps Extensions marketplace
- Internal company galleries
- Custom deployment systems

### Kiro Power

#### 1. Kiro Powers Registry (Future)
- Official Kiro marketplace (when available)
- One-click installation
- Automatic updates

#### 2. GitHub Repository (Current Recommended)
```bash
# Users install via:
# Kiro Powers Panel → Custom Power → GitHub
# Repository: https://github.com/username/azure-devops-integration
# Subfolder: power
```

#### 3. NPM Package (Advanced)
```bash
# Publish to NPM
cd power
npm publish @yourorg/azure-devops-power

# Users install via:
npm install -g @yourorg/azure-devops-power
```

#### 4. Direct Distribution
```bash
# Create distribution package
node package-release.js
# Distributes: azure-devops-power-1.0.0.zip
```

## Release Process

### Automated Release Pipeline

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      # Build Extension
      - name: Build VS Code Extension
        run: |
          cd extension
          npm ci
          npm run compile
          npx vsce package
          
      # Build Power
      - name: Build Kiro Power
        run: |
          cd power
          npm ci
          npm run build
          
      # Create Release
      - name: Create Release
        uses: actions/create-release@v1
        with:
          tag_name: ${{ github.ref }}
          release_name: Release ${{ github.ref }}
          files: |
            extension/*.vsix
            releases/azure-devops-power-1.0.0.zip
```

### Manual Release Steps

1. **Version Bump**
   ```bash
   # Update version in both package.json files
   cd extension && npm version patch
   cd ../power && npm version patch
   ```

2. **Build & Test**
   ```bash
   # Test extension
   cd extension
   npm test
   npx vsce package
   
   # Test power
   cd ../power
   npm run build
   npm test
   ```

3. **Create Release Packages**
   ```bash
   node package-release.js
   ```

4. **Publish**
   ```bash
   # VS Code Marketplace
   cd extension
   npx vsce publish
   
   # GitHub Release
   gh release create v1.0.0 releases/* --title "Azure DevOps Integration v1.0.0"
   ```

## Distribution Metadata

### VS Code Extension Marketplace

Required files:
- `extension/package.json` - Extension manifest
- `extension/README.md` - Marketplace description
- `extension/CHANGELOG.md` - Version history
- `extension/icon.png` - Extension icon (128x128)
- `extension/LICENSE` - License file

### Kiro Power

Required files:
- `power/POWER.md` - Power documentation
- `power/package.json` - Power manifest
- `power/steering/*.md` - Usage guides
- `power/dist/` - Compiled MCP servers

## Installation Documentation

### For End Users

**VS Code Extension:**
1. Open VS Code Extensions panel
2. Search "Azure DevOps Integration"
3. Click Install
4. Configure in Settings

**Kiro Power:**
1. Open Kiro Powers panel
2. Add Custom Power from GitHub
3. Repository: `username/azure-devops-integration`
4. Subfolder: `power`
5. Configure MCP server in `.kiro/settings/mcp.json`

### For Developers

**Development Setup:**
```bash
git clone https://github.com/username/azure-devops-integration
cd azure-devops-integration

# Extension development
cd extension
npm install
npm run dev

# Power development  
cd ../power
npm install
npm run dev
```

## Licensing & Legal

- **License**: MIT (permissive for both commercial and open source use)
- **Dependencies**: All dependencies use compatible licenses
- **Trademarks**: Respect Azure DevOps and VS Code trademarks
- **Privacy**: Document data handling in privacy policy

## Support & Maintenance

### Issue Tracking
- GitHub Issues for bug reports
- Feature requests via GitHub Discussions
- Documentation updates via pull requests

### Update Strategy
- **Patch releases**: Bug fixes, security updates
- **Minor releases**: New features, API additions
- **Major releases**: Breaking changes, architecture updates

### Compatibility Matrix
| Extension Version | VS Code Version | Kiro Version | Azure DevOps API |
|------------------|-----------------|--------------|------------------|
| 1.0.x            | ^1.103.0       | Latest       | 7.0              |

This distribution strategy ensures wide availability while maintaining quality and security standards for both VS Code and Kiro users.