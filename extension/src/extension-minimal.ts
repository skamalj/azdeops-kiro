import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('=== MINIMAL Azure DevOps Extension Activated ===');
    
    // Register a simple test command
    const testCommand = vscode.commands.registerCommand('azureDevOps.test', () => {
        console.log('Test command executed successfully!');
        vscode.window.showInformationMessage('✅ Azure DevOps extension is working!');
    });
    
    // Register a simple connect command
    const connectCommand = vscode.commands.registerCommand('azureDevOps.connect', () => {
        console.log('Connect command executed!');
        vscode.window.showInformationMessage('Connect command works! Extension is properly loaded.');
    });
    
    context.subscriptions.push(testCommand, connectCommand);
    
    console.log('Commands registered successfully');
    
    // Show that extension is active
    vscode.window.showInformationMessage('Azure DevOps Extension Activated Successfully!');
}

export function deactivate() {
    console.log('Azure DevOps Extension Deactivated');
}