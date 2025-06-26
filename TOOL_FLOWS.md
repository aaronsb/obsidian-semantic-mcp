# Obsidian Semantic MCP Tool Flows

This document provides comprehensive mermaid diagrams showing all the ways tools can flow and interact in the Obsidian Semantic MCP server.

## Overview: 5 Semantic Operations

```mermaid
graph TB
    subgraph "5 Semantic Operations"
        vault[vault<br/>File & Folder Operations]
        edit[edit<br/>Smart Editing]
        view[view<br/>Content Viewing]
        workflow[workflow<br/>Guidance & Suggestions]
        system[system<br/>System Operations]
    end
    
    User --> vault
    User --> edit
    User --> view
    User --> workflow
    User --> system
```

## 1. Vault Operation Flows

```mermaid
graph TD
    subgraph "Vault Operations"
        vault[vault]
        
        %% Actions
        list[list<br/>List files in directory]
        read[read<br/>Read file contents]
        create[create<br/>Create new file]
        update[update<br/>Update file content]
        delete[delete<br/>Delete file]
        search[search<br/>Search vault content]
        fragments[fragments<br/>Get file fragments]
        
        vault --> list
        vault --> read
        vault --> create
        vault --> update
        vault --> delete
        vault --> search
        vault --> fragments
    end
    
    %% List flow
    list -->|Success| read_file[Read specific file]
    list -->|Success| search_dir[Search in directory]
    list -->|404 Error| list_root[List root directory]
    list -->|404 Error| try_parent[Try parent directory]
    list -->|404 Error| search_instead[Search for files]
    list -->|Connection Error| check_system[Check system info]
    
    %% Read flow
    read -->|Has Links| follow_links[Read linked files]
    read -->|Has Tags| search_tags[Search by tags]
    read -->|Success| edit_file[Edit this file]
    read -->|Success| open_obsidian[Open in Obsidian]
    read -->|Large File| use_fragments[Switch to fragments]
    
    %% Create flow
    create -->|Success| add_content[Add content]
    create -->|Success| open_editor[Open in Obsidian]
    create -->|Success| link_from[Link from other notes]
    
    %% Search flow
    search -->|Results| read_result[Read specific result]
    search -->|Results| refine_search[Refine search]
    search -->|Results| create_synthesis[Create synthesis note]
    search -->|Too Many| use_fragments_search[Use fragments for results]
    
    %% Fragments flow
    fragments -->|Success| read_full[Read full file if needed]
    fragments -->|Success| search_specific[Search in specific fragments]
    fragments -->|Success| edit_fragment[Edit specific section]
```

## 2. Edit Operation Flows

```mermaid
graph TD
    subgraph "Edit Operations"
        edit[edit]
        
        %% Actions
        window[window<br/>Edit with fuzzy matching]
        append[append<br/>Add to end of file]
        patch[patch<br/>Structured edits]
        at_line[at_line<br/>Edit at specific line]
        from_buffer[from_buffer<br/>Apply buffered changes]
        
        edit --> window
        edit --> append
        edit --> patch
        edit --> at_line
        edit --> from_buffer
    end
    
    %% Window flow (with new hints)
    window -->|Success| verify_changes[Save and verify changes<br/>⚠️ IMPORTANT]
    verify_changes -->|Verified| small_edit[Make another small edit<br/>Keep incremental]
    verify_changes -->|Verified| open_full[Open in Obsidian]
    window -->|Large Edit Attempt| break_up[Break into smaller chunks<br/>Edit one section at a time]
    window -->|Fuzzy Match Failed| view_context[View file context]
    
    %% Append flow
    append -->|Success| continue_writing[Continue writing]
    append -->|Success| add_sections[Add more sections]
    append -->|Success| create_links[Add links to other notes]
    
    %% At line flow
    at_line -->|Before Mode| add_above[Add content above]
    at_line -->|After Mode| add_below[Add content below]  
    at_line -->|Replace Mode| replace_line[Replace line content]
    
    %% Patch flow
    patch -->|Heading| update_structure[Update document structure]
    patch -->|Link| update_connections[Update note connections]
    patch -->|Metadata| update_properties[Update file properties]
```

## 3. View Operation Flows

```mermaid
graph TD
    subgraph "View Operations"
        view[view]
        
        %% Actions
        file[file<br/>View full file]
        window_view[window<br/>View file section]
        active[active<br/>Get active file]
        open[open_in_obsidian<br/>Open in app]
        
        view --> file
        view --> window_view
        view --> active
        view --> open
    end
    
    %% File view flow
    file -->|Has Content| edit_content[Edit content]
    file -->|Has Links| explore_links[Explore linked notes]
    file -->|Has Tags| find_related[Find related by tags]
    file -->|Too Large| switch_window[Use window view]
    
    %% Window view flow
    window_view -->|Found Text| edit_section[Edit this section]
    window_view -->|Navigation| view_prev[View previous section]
    window_view -->|Navigation| view_next[View next section]
    
    %% Active file flow
    active -->|Success| read_active[Read active content]
    active -->|Success| edit_active[Edit active file]
    active -->|No Active| list_recent[List recent files]
    
    %% Open flow
    open -->|Success| file_opened[File opened in Obsidian]
    open -->|After Search| open_result[Open search result]
    open -->|After Edit| review_changes[Review changes visually]
```

## 4. Workflow Operation Flows

```mermaid
graph TD
    subgraph "Workflow Operations"
        workflow[workflow]
        
        %% Actions
        suggest[suggest<br/>Get suggestions]
        analyze[analyze<br/>Analyze context]
        
        workflow --> suggest
        workflow --> analyze
    end
    
    %% Suggestion flows based on context
    suggest -->|After List| suggest_read[Suggest files to read]
    suggest -->|After Read| suggest_edit[Suggest edits]
    suggest -->|After Edit| suggest_verify[Suggest verification]
    suggest -->|After Search| suggest_synthesis[Suggest synthesis]
    suggest -->|Multiple Edits| suggest_save[Suggest saving frequently]
    
    %% Analysis flows
    analyze -->|File Structure| analyze_links[Analyze connections]
    analyze -->|Edit History| analyze_patterns[Analyze edit patterns]
    analyze -->|Search Results| analyze_topics[Analyze topics]
```

## 5. System Operation Flows

```mermaid
graph TD
    subgraph "System Operations"
        system[system]
        
        %% Actions
        info[info<br/>Get system info]
        commands[commands<br/>List commands]
        fetch_web[fetch_web<br/>Fetch web content]
        
        system --> info
        system --> commands
        system --> fetch_web
    end
    
    %% Info flow
    info -->|Success| check_version[Check version]
    info -->|Success| verify_connection[Verify Obsidian connection]
    info -->|Error| troubleshoot[Troubleshoot setup]
    
    %% Fetch web flow
    fetch_web -->|Success| create_note[Create note from content]
    fetch_web -->|Success| append_note[Append to existing note]
    fetch_web -->|Success| analyze_content[Analyze and summarize]
```

## 6. Cross-Operation Flows

```mermaid
graph LR
    subgraph "Common Workflow Patterns"
        %% Search → Read → Edit flow
        search1[vault: search] -->|Find file| read1[vault: read]
        read1 -->|Understand| edit1[edit: window]
        edit1 -->|Verify| view1[view: window]
        
        %% List → Open flow
        list1[vault: list] -->|Browse| open1[view: open_in_obsidian]
        
        %% Create → Edit → Link flow
        create1[vault: create] -->|New file| edit2[edit: append]
        edit2 -->|Add content| link1[edit: patch links]
        
        %% Fragment → Edit flow
        fragments1[vault: fragments] -->|Find section| edit3[edit: window]
        edit3 -->|Small edit| verify1[view: window]
        
        %% Web → Note flow
        fetch1[system: fetch_web] -->|Import| create2[vault: create]
        create2 -->|Organize| edit4[edit: patch]
    end
```

## 7. Error Recovery Flows

```mermaid
graph TD
    subgraph "Error Recovery Patterns"
        %% 404 Directory Error
        dir_error[Directory Not Found] -->|Recovery 1| list_root[vault: list root]
        dir_error -->|Recovery 2| search_name[vault: search by name]
        dir_error -->|Recovery 3| check_connection[system: info]
        
        %% Large File Error
        large_file[File Too Large] -->|Recovery| use_fragments[vault: fragments]
        use_fragments -->|Success| read_sections[Read specific sections]
        
        %% Edit Failure
        edit_fail[Edit Failed] -->|Recovery 1| view_context[view: window]
        edit_fail -->|Recovery 2| smaller_edit[edit: smaller chunks]
        edit_fail -->|Recovery 3| fuzzy_adjust[edit: adjust threshold]
        
        %% Connection Error
        conn_error[Connection Failed] -->|Check 1| obsidian_running[Is Obsidian running?]
        conn_error -->|Check 2| plugin_enabled[Is REST API enabled?]
        conn_error -->|Check 3| correct_port[Check API port]
    end
```

## 8. Efficiency Patterns

```mermaid
graph TD
    subgraph "Efficient Usage Patterns"
        %% Batch operations
        batch[Batch Similar Operations] -->|Multiple Reads| fragment_strategy[Use fragments for large files]
        batch -->|Multiple Edits| incremental[Make incremental changes]
        batch -->|Multiple Searches| refine_query[Refine search terms]
        
        %% Token optimization
        optimize[Optimize Token Usage] -->|Large Files| fragments_only[Request fragments only]
        optimize -->|Multiple Files| selective_read[Read selectively]
        optimize -->|Search Results| limit_results[Limit result count]
        
        %% Workflow optimization  
        workflow_opt[Optimize Workflow] -->|Verify Often| small_changes[Keep changes small]
        workflow_opt -->|Save Progress| buffer_edits[Use buffer for complex edits]
        workflow_opt -->|Navigate Smart| use_links[Follow note connections]
    end
```

## 9. State and Context Flow

```mermaid
stateDiagram-v2
    [*] --> NoContext: Initial State
    
    NoContext --> FileContext: vault operations
    NoContext --> SearchContext: search operations
    NoContext --> SystemContext: system operations
    
    FileContext --> EditContext: edit operations
    FileContext --> ViewContext: view operations
    FileContext --> LinkedContext: follow links
    
    EditContext --> ModifiedContext: successful edit
    ModifiedContext --> SavedContext: verify changes
    SavedContext --> FileContext: continue editing
    
    SearchContext --> ResultsContext: search complete
    ResultsContext --> FileContext: read result
    ResultsContext --> RefineContext: refine search
    
    LinkedContext --> FileContext: navigate to link
    ViewContext --> EditContext: start editing
    
    state StateTokens {
        current_file
        buffer_content
        search_history
        file_history
        edit_history
        has_links
        has_tags
        search_results_available
    }
```

## Usage Guide

### For AI Agents

1. **Always verify edits**: After using `edit`, use `view` to verify changes
2. **Keep edits small**: Make incremental changes, save frequently
3. **Use fragments for large files**: Prevents token overflow
4. **Follow workflow hints**: The system provides context-aware suggestions
5. **Handle errors gracefully**: Use recovery hints when operations fail

### For Developers

1. **Semantic operations**: Think in terms of the 5 main operations
2. **Context awareness**: The system maintains state across operations
3. **Efficiency rules**: Built-in patterns prevent common inefficiencies
4. **Error recovery**: Every error includes actionable recovery steps
5. **Fragment retrieval**: Automatic for large files, configurable strategies

### Best Practices

1. **Search before reading**: Use search to find relevant files first
2. **Fragment before full read**: For files >5000 tokens, use fragments
3. **Incremental editing**: Make small changes and verify each one
4. **Follow the hints**: Workflow suggestions are context-aware
5. **Use the right tool**: Each operation has an optimal use case