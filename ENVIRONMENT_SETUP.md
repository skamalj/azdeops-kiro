# Azure DevOps Power - Environment Variables Setup

## 🔐 **Setting Up Environment Variables**

The Azure DevOps Power uses environment variables for secure credential management. Here's how to set them up:

### **Required Environment Variables**

Based on your configuration, you need to set these environment variables:

```bash
AZURE_DEVOPS_ORG_URL=https://dev.azure.com/skamalj0630
AZURE_DEVOPS_PROJECT=PartsUnlimited-CD
AZURE_DEVOPS_PAT=your_actual_pat_token_here
```

## 🖥️ **Setting Environment Variables by Platform**

### **Windows (PowerShell)**
```powershell
# Set environment variables for current session
$env:AZURE_DEVOPS_ORG_URL = "https://dev.azure.com/skamalj0630"
$env:AZURE_DEVOPS_PROJECT = "PartsUnlimited-CD"
$env:AZURE_DEVOPS_PAT = "your_actual_pat_token_here"

# Set permanently (requires restart of applications)
[Environment]::SetEnvironmentVariable("AZURE_DEVOPS_ORG_URL", "https://dev.azure.com/skamalj0630", "User")
[Environment]::SetEnvironmentVariable("AZURE_DEVOPS_PROJECT", "PartsUnlimited-CD", "User")
[Environment]::SetEnvironmentVariable("AZURE_DEVOPS_PAT", "your_actual_pat_token_here", "User")
```

### **Windows (Command Prompt)**
```cmd
# Set environment variables for current session
set AZURE_DEVOPS_ORG_URL=https://dev.azure.com/skamalj0630
set AZURE_DEVOPS_PROJECT=PartsUnlimited-CD
set AZURE_DEVOPS_PAT=your_actual_pat_token_here

# Set permanently
setx AZURE_DEVOPS_ORG_URL "https://dev.azure.com/skamalj0630"
setx AZURE_DEVOPS_PROJECT "PartsUnlimited-CD"
setx AZURE_DEVOPS_PAT "your_actual_pat_token_here"
```

### **macOS/Linux (Bash/Zsh)**
```bash
# Set environment variables for current session
export AZURE_DEVOPS_ORG_URL="https://dev.azure.com/skamalj0630"
export AZURE_DEVOPS_PROJECT="PartsUnlimited-CD"
export AZURE_DEVOPS_PAT="your_actual_pat_token_here"

# Add to your shell profile for persistence (~/.bashrc, ~/.zshrc, etc.)
echo 'export AZURE_DEVOPS_ORG_URL="https://dev.azure.com/skamalj0630"' >> ~/.bashrc
echo 'export AZURE_DEVOPS_PROJECT="PartsUnlimited-CD"' >> ~/.bashrc
echo 'export AZURE_DEVOPS_PAT="your_actual_pat_token_here"' >> ~/.bashrc

# Reload your shell profile
source ~/.bashrc
```

## 🔑 **Getting Your Personal Access Token (PAT)**

1. **Go to Azure DevOps**: Navigate to `https://dev.azure.com/skamalj0630`
2. **User Settings**: Click your profile picture → Personal Access Tokens
3. **Create New Token**:
   - **Name**: "Kiro Azure DevOps Integration"
   - **Organization**: skamalj0630
   - **Expiration**: Choose appropriate duration
   - **Scopes**: Select these permissions:
     - ✅ **Work Items**: Read & Write
     - ✅ **Test Management**: Read & Write (for test cases)
     - ✅ **Project and Team**: Read (for multi-project support)
4. **Copy Token**: Save the generated token securely
5. **Set Environment Variable**: Use the token as `AZURE_DEVOPS_PAT`

## 🚀 **Starting Kiro with Environment Variables**

### **Option 1: Set Before Starting Kiro**
Set the environment variables in your terminal, then start Kiro from the same terminal:

```bash
# Windows PowerShell
$env:AZURE_DEVOPS_ORG_URL = "https://dev.azure.com/skamalj0630"
$env:AZURE_DEVOPS_PROJECT = "PartsUnlimited-CD"
$env:AZURE_DEVOPS_PAT = "your_actual_pat_token_here"
kiro  # or however you start Kiro

# macOS/Linux
export AZURE_DEVOPS_ORG_URL="https://dev.azure.com/skamalj0630"
export AZURE_DEVOPS_PROJECT="PartsUnlimited-CD"
export AZURE_DEVOPS_PAT="your_actual_pat_token_here"
kiro  # or however you start Kiro
```

### **Option 2: Use .env File (if Kiro supports it)**
Create a `.env` file in your Kiro workspace:

```env
AZURE_DEVOPS_ORG_URL=https://dev.azure.com/skamalj0630
AZURE_DEVOPS_PROJECT=PartsUnlimited-CD
AZURE_DEVOPS_PAT=your_actual_pat_token_here
```

## ✅ **Verify Configuration**

After setting up the environment variables:

1. **Restart Kiro** (if it was already running)
2. **Check MCP Server Status**:
   - Look for "azure-devops-core" in MCP servers panel
   - Status should show "Connected" or "Running"
3. **Test Basic Command**:
   - Try: "Show me all work items from Azure DevOps"
   - Should return work items from the PartsUnlimited-CD project

## 🔧 **Troubleshooting**

### **Environment Variables Not Working**
- Ensure Kiro was started AFTER setting the environment variables
- Check that variable names match exactly (case-sensitive)
- Verify the PAT token has correct permissions

### **Connection Issues**
- Verify organization URL format: `https://dev.azure.com/skamalj0630`
- Check project name matches exactly: `PartsUnlimited-CD`
- Ensure PAT token is valid and not expired

### **Debug Mode**
Add debug environment variable to see detailed logs:
```bash
export DEBUG=azure-devops-power:*
```

## 🎯 **Ready to Use!**

Once environment variables are set up, you can use these commands:

- **"Show me all work items from Azure DevOps"**
- **"Create a user story: As a user, I want to see project status"**
- **"List all projects in my organization"**
- **"Switch to project PartsUnlimited-CD"**
- **"Show me scrum metrics for the current project"**
- **"Create a test case for user login functionality"**

The power will automatically use your environment variables for secure authentication! 🎉