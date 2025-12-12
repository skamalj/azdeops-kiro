# Advanced Usage of Azure DevOps Power

This guide covers advanced features and patterns for using the Azure DevOps Power effectively.

## Advanced Work Item Management

### Bulk Operations

**Create multiple related tasks:**
```
Create the following tasks for user story #456:
1. "Design login UI mockups" - 4 hours
2. "Implement login form validation" - 6 hours  
3. "Add authentication service" - 8 hours
4. "Write integration tests" - 4 hours
```

### Complex Updates

**Update multiple fields at once:**
```
Update work item #789:
- Set state to "In Progress"
- Assign to john.doe@company.com
- Add tags: "frontend", "urgent"
- Set remaining work to 12 hours
```

## Query Patterns

### Advanced Filtering

**Complex queries:**
```
Show me all user stories assigned to sarah.smith@company.com that are in "Active" state
```

**Multi-criteria filtering:**
```
Find all tasks with more than 10 hours remaining work that are not assigned
```

### Reporting Queries

**Sprint progress:**
```
Show me all work items for the current sprint grouped by state
```

**Team workload:**
```
List all active work items grouped by assigned person
```

## Integration Patterns

### With Development Workflow

1. **Feature Branch Creation:**
   - Create user story
   - Create associated tasks
   - Use work item IDs in branch names

2. **Commit Linking:**
   - Reference work item IDs in commit messages
   - Update task progress as you work

3. **Pull Request Integration:**
   - Link PRs to work items
   - Update work item state when PR is merged

### With Project Management

1. **Capacity Planning:**
   - Use story points for estimation
   - Track remaining work for tasks
   - Monitor team velocity

2. **Progress Tracking:**
   - Regular work item updates
   - State transitions
   - Burndown tracking

## Error Handling

### Common Issues

**Authentication Errors:**
- Verify PAT is valid and has correct permissions
- Check organization URL format
- Ensure project name is correct

**Permission Errors:**
- Verify PAT has "Work Items (Read & Write)" scope
- Check project access permissions
- Confirm organization membership

**Network Issues:**
- Check internet connectivity
- Verify Azure DevOps service status
- Try with different network if behind firewall

### Troubleshooting Commands

**Test connection:**
```
Get work item #1 to test connectivity
```

**Verify permissions:**
```
Create a simple test task to verify write permissions
```

## Best Practices

### Work Item Organization

1. **Hierarchical Structure:**
   - Use user stories for features
   - Break down into specific tasks
   - Maintain clear parent-child relationships

2. **Consistent Naming:**
   - Use clear, descriptive titles
   - Follow team naming conventions
   - Include context when needed

3. **Proper Estimation:**
   - Use story points for user stories
   - Estimate remaining work for tasks
   - Update estimates as work progresses

### Team Collaboration

1. **Assignment Strategy:**
   - Assign work items to specific team members
   - Use unassigned items for backlog
   - Reassign when priorities change

2. **State Management:**
   - Keep work item states current
   - Use consistent state transitions
   - Update states during daily standups

3. **Communication:**
   - Use work item comments for updates
   - Reference work items in discussions
   - Link related work items

## Performance Optimization

### Efficient Queries

- Use specific filters to reduce result sets
- Limit results with maxResults parameter
- Cache frequently accessed work items

### Batch Operations

- Group related operations together
- Use bulk update patterns when possible
- Minimize API calls for better performance