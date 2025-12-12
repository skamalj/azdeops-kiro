# Azure DevOps Power - Complete Installation Guide

## 🚀 **Quick Installation Steps**

### **1. Clone the Repository**
```bash
git clone https://github.com/skamalj/azdeops-kiro.git
cd azdeops-kiro
```

### **2. Install MCP Server Dependencies**
```bash
cd mcp-server
npm install
cd ..
```

### **3. Install the Power in Kiro**
1. Open Kiro IDE
2. Go to Powers panel
3. Click "Install from Folder"
4. Navigate to and select the `power/` directory
5. Kiro will install the power

### **4. Set Environment Variables**

**Windows (PowerShell):**
```powershell
$env:AZURE_DEVOPS_ORG_URL = "https://dev.azure.com/skamalj0630"
$env:AZURE_DEVOPS_PROJECT = "PartsUnlimited-CD"
$env:AZURE_DEVOPS_PAT = "your-personal-access-token"
```

**macOS/Linux:**
```bash
export AZURE_DEVOPS_ORG_URL="https://dev.azure.com/skamalj0630"
export AZURE_DEVOPS_PROJECT="PartsUnlimited-CD"
export AZURE_DEVOPS_PAT="your-personal-access-token"
```

### **5. Get Your Personal Access Token**
1. Go to: `https://dev.azure.com/skamalj0630`
2. Click your profile → Personal Access Tokens
3. Create new token with these permissions:
   - ✅ **Work Items**: Read & Write
   - ✅ **Test Management**: Read & Write
   - ✅ **Project and Team**: Read
4. Copy the token and use it as `AZURE_DEVOPS_PAT`

### **6. Restart Kiro**
Restart Kiro to load the new power and environment variables.

### **7. Test the Power**
Try these commands:
- "Show me all work items from Azure DevOps"
- "Create a user story called 'Test Integration'"
- "List all projects in my organization"

## 🔧 **Troubleshooting**

### **MCP Server Connection Issues**
If you get "Connection closed" errors:

1. **Check Dependencies**:
   ```bash
   cd mcp-server
   npm install
   ```

2. **Verify Environment Variables**:
   - Ensure all three variables are set
   - Restart Kiro after setting variables

3. **Test MCP Server Manually**:
   ```bash
   cd mcp-server
   node index.js
   ```

4. **Check Paths**:
   - Ensure the `mcp.json` path `../mcp-server/index.js` is correct
   - The power should be installed in a directory adjacent to `mcp-server/`

### **Authentication Issues**
- Verify PAT token has correct permissions
- Check organization URL format (include https://)
- Ensure project name matches exactly

### **Power Not Loading**
- Ensure power is installed from the correct `power/` directory
- Check that `POWER.md` has proper frontmatter
- Verify only allowed files are in the power directory

## 📁 **Expected Directory Structure**
After installation, your structure should look like:
```
azdeops-kiro/
├── power/              # Installed as Kiro Power
│   ├── POWER.md
│   ├── mcp.json
│   └── steering/
├── mcp-server/         # MCP Server with dependencies
│   ├── index.js
│   ├── package.json
│   └── node_modules/
└── extension/          # VS Code Extension (optional)
```

## 🎯 **Success Indicators**
- ✅ Power appears in Kiro Powers panel
- ✅ MCP server "azure-devops-core" shows as connected
- ✅ Commands like "Show me all work items" return results
- ✅ Can create user stories and tasks via natural language

## 📞 **Support**
If you encounter issues:
1. Check this troubleshooting guide
2. Verify all prerequisites are met
3. Test MCP server independently
4. Check Kiro's MCP server logs for detailed errors