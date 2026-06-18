# Fig Terminal Autocomplete Primitives

## Overview
Fig (now part of Amazon Q) provides a sophisticated autocomplete overlay system for terminal applications. This analysis covers the key TUI primitives used in Fig's implementation.

## Core Primitives

### 1. Autocomplete Overlay System

**Positioning & Sizing:**
```typescript
// Overlay positioning relative to cursor
{
  x: number;      // Cursor column position
  y: number;      // Cursor row position  
  width: number;  // List width (dynamic or fixed)
  height: number; // List height (scrollable)
}
```

**Render Modes:**
- **Full-screen**: Complete terminal takeover
- **Overlay**: Floating list above/below cursor
- **Inline**: Replaces current line content
- **Dropdown**: Compact single-row selection

### 2. Command Line Parser

**Token Detection:**
```typescript
interface ParsedCommand {
  executable: string;
  args: string[];
  flags: Record<string, string | boolean>;
  position: number; // Current cursor position in string
  wordUnderCursor: string;
}
```

**Context Analysis:**
- Shell type detection (bash, zsh, fish, etc.)
- Command history integration
- Alias expansion
- Path completion (relative/absolute)

### 3. Suggestion Engine

**Ranking Algorithm:**
```typescript
interface Suggestion {
  label: string;
  description?: string;
  icon?: string;
  priority: number;      // Based on frequency, recency
  matches: MatchDetails; // Which parts matched
  metadata?: any;
}

interface MatchDetails {
  exact: boolean;
  prefix: boolean;
  substring: boolean;
  tokenIndex: number;
  characterPositions: number[];
}
```

**Scoring Factors:**
- Historical usage frequency
- Recent execution time
- User preferences
- Context relevance (directory, command type)

### 4. Visual Rendering

**Styling System:**
```typescript
interface RenderStyle {
  foreground: Color;
  background: Color;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  highlight: {
    match: { foreground, background };
    cursor: { foreground, background };
    selected: { foreground, background };
  };
}
```

**Layout Components:**
- **List**: Scrollable vertical list of suggestions
- **Details**: Hoverable information panel
- **Status**: Progress indicators, error messages
- **Divider**: Visual separation between groups

### 5. Interaction Handling

**Keyboard Events:**
```typescript
interface KeyboardHandler {
  up: () => void;
  down: () => void;
  enter: () => void;
  esc: () => void;
  tab: () => void;
  pageUp: () => void;
  pageDown: () => void;
  search: (query: string) => void;
  filter: (predicate: (s: Suggestion) => boolean) => void;
}
```

**Mouse Events:**
```typescript
interface MouseHandler {
  click: (index: number) => void;
  doubleClick: (index: number) => void;
  scroll: (delta: number) => void;
  move: (index: number) => void;
}
```

### 6. State Management

**Overlay State:**
```typescript
interface OverlayState {
  visible: boolean;
  position: { x: number; y: number };
  selectedIndex: number;
  filterQuery: string;
  suggestions: Suggestion[];
  isLoading: boolean;
  error: string | null;
  metadata: {
    commandHistory: string[];
    recentCommands: string[];
    userPreferences: any;
  };
}
```

**Persistence:**
- Local storage for preferences
- Server-synced command history
- User behavior modeling
- Context-aware caching

## Implementation Patterns

### Event-Driven Architecture
```typescript
class AutocompleteEngine {
  constructor(options: AutocompleteOptions) {
    this.state = new OverlayState();
    this.parser = new CommandParser();
    this.suggestionEngine = new SuggestionEngine();
    this.renderer = new TerminalRenderer();
    
    this.setupEventListeners();
  }
  
  private setupEventListeners() {
    // Capture all terminal keystrokes
    this.terminal.on('key', (key) => this.handleKey(key));
    this.terminal.on('cursor', (pos) => this.updatePosition(pos));
    this.terminal.on('resize', (size) => this.handleResize(size));
  }
  
  async handleKey(key: KeyboardEvent) {
    if (this.state.visible) {
      // Handle overlay navigation
      await this.handleOverlayKey(key);
    } else if (this.shouldShowAutocomplete(key)) {
      // Trigger autocomplete
      await this.showAutocomplete();
    }
  }
}
```

### Lazy Loading & Caching
```typescript
class SuggestionEngine {
  private cache: Map<string, Suggestion[]> = new Map();
  
  async getSuggestions(query: string): Promise<Suggestion[]> {
    // Check cache first
    if (this.cache.has(query)) {
      return this.cache.get(query);
    }
    
    // Parse command context
    const parsed = this.parser.parse(query);
    
    // Fetch from multiple sources
    const suggestions = await Promise.all([
      this.historyProvider.getSuggestions(parsed),
      this.builtInProvider.getSuggestions(parsed),
      this.customProvider.getSuggestions(parsed),
    ]);
    
    // Merge and rank
    const merged = this.mergeAndRank(suggestions);
    
    // Cache result
    this.cache.set(query, merged);
    
    return merged;
  }
}
```

### Virtual DOM for Rendering
```typescript
class TerminalRenderer {
  render(state: OverlayState): string {
    const lines = [];
    
    // Header with query and stats
    lines.push(this.renderHeader(state));
    
    // Separator
    lines.push('');
    
    // Suggestion list (virtualized for performance)
    const visibleItems = this.getVisibleItems(state);
    for (const item of visibleItems) {
      lines.push(this.renderSuggestion(item, state.selectedIndex));
    }
    
    // Footer with status
    lines.push('');
    lines.push(this.renderFooter(state));
    
    return lines.join('\n');
  }
  
  private renderSuggestion(suggestion: Suggestion, selectedIndex: number): string {
    const isMatch = this.renderHighlight(
      suggestion.label,
      suggestion.matches
    );
    
    if (selectedIndex === suggestion.index) {
      return `> ${isMatch}`;
    }
    
    return `  ${isMatch}`;
  }
}
```

## Performance Optimizations

### 1. Debouncing
```typescript
class AutocompleteEngine {
  private debounceTimer: NodeJS.Timeout;
  
  triggerAutocomplete() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.showAutocomplete();
    }, 150); // 150ms delay
  }
}
```

### 2. Incremental Rendering
```typescript
class TerminalRenderer {
  private lastRender: string;
  private renderCount: number = 0;
  
  render(state: OverlayState): string {
    this.renderCount++;
    
    // Only re-render if state changed significantly
    if (this.isSignificantChange(this.lastRender, state)) {
      this.lastRender = this.doRender(state);
      this.cacheRenderSize(this.lastRender.length);
      return this.lastRender;
    }
    
    // Minimal update for small changes
    return this.incrementalUpdate(this.lastRender, state);
  }
}
```

### 3. Virtual Scrolling
```typescript
class OverlayList {
  private visibleRange: { start: number; end: number } = { start: 0, end: 20 };
  private itemHeight: number = 2;
  private containerHeight: number = 24;
  
  updateViewport(scrollOffset: number) {
    const startIndex = Math.floor(scrollOffset / this.itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(this.containerHeight / this.itemHeight),
      this.suggestions.length
    );
    
    this.visibleRange = { start: startIndex, end: endIndex };
  }
  
  renderVisibleItems(): string[] {
    const lines = [];
    for (let i = this.visibleRange.start; i < this.visibleRange.end; i++) {
      lines.push(this.renderSuggestion(this.suggestions[i]));
    }
    return lines;
  }
}
```

## Integration Patterns

### Shell Integration
```bash
# Add to .bashrc or .zshrc
export FIG_AGENT_ID="your-agent-id"
eval "$(fig activate)"

# This sets up:
# - Hook into readline for key capture
# - Register signal handlers for overlay
# - Initialize communication channel
```

### API Communication
```typescript
interface CommunicationChannel {
  // Client → Server
  send(message: AutocompleteRequest): Promise<AutocompleteResponse>;
  
  // Server → Client  
  onMessage(handler: (message: AutocompleteEvent) => void): void;
}

// Example messages
interface AutocompleteRequest {
  type: 'suggestions' | 'metadata' | 'preferences';
  payload: {
    command: string;
    position: number;
    context: {
      cwd: string;
      shell: string;
      user: string;
    };
  };
}

interface AutocompleteResponse {
  type: 'suggestions' | 'metadata' | 'preferences' | 'error';
  payload: {
    suggestions?: Suggestion[];
    error?: string;
    metadata?: any;
  };
}
```

## Error Handling

### Graceful Degradation
```typescript
class AutocompleteEngine {
  async handleAutocompleteRequest(): Promise<void> {
    try {
      const suggestions = await this.fetchSuggestions();
      this.updateState({ suggestions, isLoading: false });
    } catch (error) {
      // Log error but don't break the UI
      console.error('Autocomplete failed:', error);
      
      // Fall back to basic history
      const fallback = await this.getHistorySuggestions();
      this.updateState({ 
        suggestions: fallback, 
        error: 'Using cached suggestions',
        isLoading: false 
      });
    }
  }
}
```

### Retry Logic
```typescript
class SuggestionEngine {
  async getSuggestionsWithRetry(
    query: string, 
    maxRetries: number = 3
  ): Promise<Suggestion[]> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.fetchSuggestions(query);
      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw error;
        }
        await this.delay(100 * Math.pow(2, attempt)); // Exponential backoff
      }
    }
  }
}
```

## Security Considerations

### Input Sanitization
```typescript
class CommandParser {
  sanitizeInput(input: string): string {
    // Remove potentially dangerous characters
    return input
      .replace(/[\x00-\x1f\x7f]/g, '') // Control characters
      .replace(/;|&|\||`|\$|\(/g, '')  // Shell metacharacters
      .trim();
  }
  
  validateCommand(command: string): boolean {
    const dangerousPatterns = [
      /rm\s+-(rf|fr)/,
      /dd\s+.*of=\/dev\/(hd|sd)/,
      /sudo\s+(rm|mv|cp)/,
    ];
    
    return !dangerousPatterns.some(pattern => pattern.test(command));
  }
}
```

### Privacy Protection
```typescript
class ContextProvider {
  getContext(): Context {
    return {
      cwd: this.sanitizePath(process.cwd()),
      shell: process.env.SHELL || 'bash',
      user: process.env.USER || 'anonymous',
      // Never include sensitive info
      // - No home directory paths
      // - No environment variables
      // - No command history content
    };
  }
  
  sanitizePath(path: string): string {
    // Replace sensitive portions with placeholders
    return path
      .replace(process.env.HOME, '~/')
      .replace(/\/[^/]+\/\.git/, '/<repo>/')
      .replace(/\/private\//, '/<private>/');
  }
}
```

## Testing Strategy

### Unit Tests
```typescript
describe('CommandParser', () => {
  it('should parse basic command', () => {
    const result = parser.parse('ls -la /tmp');
    expect(result.executable).toBe('ls');
    expect(result.args).toEqual(['-la', '/tmp']);
  });
  
  it('should handle quoted arguments', () => {
    const result = parser.parse('echo "hello world"');
    expect(result.args).toEqual(['"hello world"']);
  });
  
  it('should detect cursor position', () => {
    const result = parser.parse('ls -la | wc -l', 8);
    expect(result.position).toBe(8);
    expect(result.wordUnderCursor).toBe('-la');
  });
});
```

### Integration Tests
```typescript
describe('AutocompleteEngine', () => {
  let engine: AutocompleteEngine;
  let mockTerminal: MockTerminal;
  
  beforeEach(() => {
    mockTerminal = new MockTerminal();
    engine = new AutocompleteEngine({
      terminal: mockTerminal,
      sources: [new MockHistorySource()],
    });
  });
  
  it('should show suggestions on Tab key', async () => {
    mockTerminal.simulateKey('l', { ctrl: false, shift: false });
    mockTerminal.simulateKey('s', { ctrl: false, shift: false });
    mockTerminal.simulateKey(' ', { ctrl: false, shift: false });
    mockTerminal.simulateKey('Tab', { ctrl: false, shift: false });
    
    await waitUntil(() => engine.state.visible);
    expect(engine.state.suggestions.length).toBeGreaterThan(0);
  });
  
  it('should filter suggestions on typing', async () => {
    await engine.showAutocomplete();
    
    mockTerminal.simulateKey('l', { ctrl: false, shift: false });
    await waitUntil(() => engine.state.suggestions.length < 10);
    
    const allStartWithL = engine.state.suggestions.every(
      s => s.label.toLowerCase().startsWith('l')
    );
    expect(allStartWithL).toBe(true);
  });
});
```

### Performance Tests
```typescript
describe('Performance', () => {
  it('should render 100 suggestions in < 10ms', () => {
    const suggestions = generateTestSuggestions(100);
    const start = performance.now();
    
    renderer.render({
      visible: true,
      suggestions,
      selectedIndex: 0,
      filterQuery: '',
    });
    
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(10);
  });
  
  it('should handle 10 keystrokes per second', async () => {
    const keystrokes = generateRandomKeystrokes(100);
    const startTime = performance.now();
    
    for (const key of keystrokes) {
      engine.handleKey(key);
      await waitAnimationFrame();
    }
    
    const duration = performance.now() - startTime;
    const rate = 100 / (duration / 1000);
    expect(rate).toBeGreaterThanOrEqual(10);
  });
});
```

## Conclusion

Fig's autocomplete system demonstrates sophisticated TUI patterns including:
- Event-driven state management
- Virtual DOM rendering for performance
- Context-aware suggestion ranking
- Graceful error handling
- Security-conscious design

These primitives can be adapted for building custom terminal autocomplete systems with similar capabilities.
