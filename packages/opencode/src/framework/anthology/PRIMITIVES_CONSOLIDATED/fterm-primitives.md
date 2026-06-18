# FTerm.nvim TUI Primitives

## Overview
FTerm.nvim is a Neovim plugin for managing floating terminal windows. It provides a clean API for creating, controlling, and styling terminal sessions within the Neovim editor.

## Core Architecture

### 1. Window Management

**Floating Window Creation:**
```lua
local fterm = require('FTerm')

-- Create a new terminal instance
local term = fterm:new({
  cmd = 'bash',
  dimensions = {
    height = 0.9,
    width = 0.9,
    row = 0,
    col = 0
  },
  border = 'single',
  blend = 0,
  hl = 'Normal',
  ft = 'terminal'
})

-- Open the terminal
term:open()

-- Close the terminal
term:close()

-- Toggle visibility
term:toggle()
```

**Window Configuration:**
- `dimensions`: Window size and position (relative or absolute)
- `border`: Border style ('none', 'single', 'double', 'rounded')
- `blend`: Background transparency (0-100)
- `hl`: Highlight group for window
- `ft`: Filetype for syntax highlighting

### 2. Terminal Sessions

**Session Management:**
```lua
-- Create persistent session
local bash = fterm:new({
  cmd = 'bash',
  auto_close = false
})

-- Create one-off session
local scratch = fterm:new({
  cmd = 'echo "Hello"',
  auto_close = true
})

-- Check if session is running
if term:is_running() then
  -- Session is active
end

-- Get terminal output
local output = term:get_output()
```

**Environment Control:**
```lua
-- Set environment variables
term:set_env({
  TERM = 'xterm-256color',
  LANG = 'en_US.UTF-8'
})

-- Change working directory
term:cd('/path/to/dir')

-- Send commands to terminal
term:send('ls -la')
term:send_keys({ mode = 'n', keys = 'gg' })
```

### 3. Key Bindings

**Global Bindings:**
```lua
-- In your init.lua
vim.keymap.set('n', '<Leader>t', function()
  require('FTerm'):toggle()
end, { desc = 'Toggle terminal' })

vim.keymap.set('n', '<Leader>T', function()
  require('FTerm'):run('clear')
end, { desc = 'Clear terminal' })
```

**Custom Key Maps:**
```lua
local term = fterm:new({
  on_ready = function()
    vim.keymap.set('n', '<C-c>', function()
      term:exit()
    end, { buffer = term.buf })
    
    vim.keymap.set('n', '<C-l>', function()
      term:clear()
    end, { buffer = term.buf })
  end
})
```

### 4. Window Modes

**Open Mode:**
```lua
-- Standard open
term:open()

-- Open in specific position
term:open({
  dimensions = {
    row = 10,
    col = 10,
    height = 20,
    width = 40
  }
})

-- Open with custom command
term:open('vim')
```

**Close Mode:**
```lua
-- Close window but keep session
term:close()

-- Exit session and close
term:exit()

-- Hide window
term:hide()
```

**Scratch Mode:**
```lua
-- One-time command execution
term:scratch('grep -r "pattern" .')

-- With output capture
local result = term:scratch('git status')
print(result.stdout)
print(result.stderr)
```

### 5. Events and Callbacks

**Terminal Events:**
```lua
local term = fterm:new({
  on_open = function()
    print('Terminal opened')
  end,
  
  on_close = function()
    print('Terminal closed')
  end,
  
  on_exit = function(code)
    print('Exited with code:', code)
  end,
  
  on_stdout = function(data)
    print('Stdout:', data)
  end,
  
  on_stderr = function(data)
    print('Stderr:', data)
  end,
  
  on_resize = function(width, height)
    print('Resized to', width, 'x', height)
  end
})
```

**Buffer Events:**
```lua
term:on('BufWinEnter', function()
  -- Window entered
end)

term:on('BufWinLeave', function()
  -- Window left
end)

term:on('CursorMoved', function()
  -- Cursor moved
end)
```

### 6. Styling and Appearance

**Highlight Groups:**
```lua
-- Set window highlight
term:style({
  hl = 'FloatTitle',
  border_hl = 'FloatBorder',
  title_hl = 'FloatTitle',
  title_pos = 'center'
})

-- Customize colors
term:style({
  background = '#1a1b26',
  foreground = '#a9b1d6',
  border = '#414868'
})
```

**Layout Options:**
```lua
-- Window styles
term:style({
  style = 'minimal',  -- 'minimal', 'classic', 'popup', 'fullscreen'
  title = 'My Terminal',
  title_pos = 'center'  -- 'left', 'center', 'right'
})

-- Border styles
term:style({
  border = 'single',  -- 'none', 'single', 'double', 'rounded', 'shadow'
  corner = 'rounded',
  top = 'rounded',
  bottom = 'rounded'
})
```

### 7. Multi-Instance Support

**Create Multiple Terminals:**
```lua
local terminals = {
  shell = fterm:new({ cmd = 'bash', ft = 'bash' }),
  python = fterm:new({ cmd = 'python', ft = 'python' }),
  git = fterm:new({ cmd = 'gitui', ft = 'git' })
}

-- Switch between terminals
terminals.shell:open()
-- Later...
terminals.python:open()
terminals.shell:close()
```

**Session Persistence:**
```lua
-- Save session state
terminals.shell:save('my_session')

-- Restore session
terminals.shell:load('my_session')

-- List saved sessions
local sessions = fterm:list_sessions()
```

### 8. Integration with Neovim

**Buffer Management:**
```lua
-- Get buffer information
local buf = term:get_buffer()
local win = term:get_window()

-- Check if valid
if vim.api.nvim_buf_is_valid(buf) then
  -- Buffer is valid
end

if vim.api.nvim_win_is_valid(win) then
  -- Window is valid
end
```

**Integration Functions:**
```lua
-- Send to background
term:background()

-- Bring to foreground
term:foreground()

-- Resize window
term:resize(80, 24)

-- Move window
term:move(10, 10)
```

### 9. Advanced Features

**Pseudo-terminal Control:**
```lua
-- Set terminal size
term:set_size(80, 24)

-- Get terminal info
local info = term:get_info()
print('PID:', info.pid)
print('TTY:', info.tty)

-- Control terminal
term:control('SIGINT')
term:control('SIGQUIT')
```

**Input Handling:**
```lua
-- Send keystrokes
term:send_keys({ mode = 'n', keys = 'gg' })
term:send_keys({ mode = 'i', keys = 'hello' })
term:send_keys({ mode = 'c', keys = 'C-c' })

-- Send raw bytes
term:send_bytes({ 0x1b, 0x5b, 0x41 })  -- Arrow up
```

**Output Capture:**
```lua
-- Capture output
local result = term:run('echo "hello"; echo "world" >&2')
print('stdout:', result.stdout)
print('stderr:', result.stderr)
print('exit_code:', result.exit_code)
```

### 10. Configuration

**Default Settings:**
```lua
require('FTerm').setup({
  -- Window defaults
  border = 'single',
  style = 'minimal',
  title = 'FTerm',
  title_pos = 'center',
  
  -- Size and position
  dimensions = {
    height = 0.9,
    width = 0.9,
    row = 0,
    col = 0
  },
  
  -- Terminal settings
  cmd = vim.fn.shell,
  env = {},
  cwd = nil,
  
  -- Styling
  hl = 'Normal',
  background = nil,
  foreground = nil,
  blend = 0,
  
  -- Behavior
  auto_close = false,
  clear_env = false,
  
  -- Callbacks
  on_open = nil,
  on_close = nil,
  on_exit = nil,
  on_stdout = nil,
  on_stderr = nil,
  on_resize = nil,
  on_ready = nil
})
```

**Per-Instance Configuration:**
```lua
local term = fterm:new({
  cmd = 'python',
  dimensions = { height = 0.8, width = 0.8 },
  border = 'rounded',
  on_ready = function()
    vim.cmd('terminal! source ~/.pythonrc')
  end
})
```

## Key Design Patterns

### 1. Builder Pattern
```lua
local term = fterm:new()
  :with_cmd('bash')
  :with_dimensions(80, 24)
  :with_border('double')
  :with_on_exit(function()
    print('Done')
  end)
  :open()
```

### 2. Factory Pattern
```lua
-- Create different terminal types
local types = {
  shell = fterm.factory('bash'),
  python = fterm.factory('python'),
  node = fterm.factory('node'),
  git = fterm.factory('gitui')
}
```

### 3. Observer Pattern
```lua
term:subscribe('output', function(data)
  print('Received:', data)
end)

term:subscribe('state', function(state)
  print('State changed:', state)
end)
```

### 4. Command Pattern
```lua
local commands = {
  clear = function(term)
    term:send_keys({ mode = 'n', keys = 'ggdG' })
  end,
  restart = function(term)
    term:exit()
    term:open()
  end,
  send_command = function(term, cmd)
    term:send(cmd .. '\n')
  end
}
```

## Implementation Guide

### Creating a Custom Terminal Widget

```lua
local M = {}

M.new = function(opts)
  local term = require('FTerm').new(opts)
  
  -- Add custom functionality
  term.clear = function()
    term:send_keys({ mode = 'n', keys = 'ggdG' })
  end
  
  term.restart = function()
    term:exit()
    term:open()
  end
  
  return term
end

return M
```

### Extending with Plugins

```lua
-- Plugin example
local plugin = {
  name = 'my-terminal-plugin',
  init = function(term)
    -- Setup plugin
    vim.keymap.set('n', '<leader>c', function()
      term:clear()
    end, { buffer = term.buf })
  end
}

-- Load plugin
require('FTerm').load_plugin(plugin)
```

### Custom Event Handlers

```lua
local term = fterm:new({
  on_stdout = function(data)
    -- Process output
    if string.match(data, 'error') then
      vim.notify('Error in terminal', 'error')
    end
  end,
  
  on_resize = function(width, height)
    -- Adjust terminal size
    term:resize(width, height)
  end
})
```

## Best Practices

1. **Always cleanup**: Close terminals when done
2. **Use auto_close**: For one-off commands
3. **Set appropriate size**: Don't make terminals too large
4. **Use distinct filetypes**: For syntax highlighting
5. **Handle events**: For better UX
6. **Persist sessions**: For long-running tasks
7. **Clear environment**: When needed for security
8. **Test on resize**: Ensure windows resize properly
9. **Use callbacks**: For async operations
10. **Document config**: Make it easy to understand

## Common Pitfalls

1. **Not closing**: Terminals left open consume resources
2. **Wrong size**: Terminals too big/small for content
3. **No error handling**: Silent failures are hard to debug
4. **Missing callbacks**: Can't respond to events
5. **Poor styling**: Hard to read or distinguish
6. **No persistence**: Lose state on restart
7. **Environment issues**: Missing variables cause errors
8. **Path problems**: Relative paths don't work as expected
9. **Encoding issues**: Wrong charset causes display problems
10. **Timing issues**: Race conditions with async operations

## Conclusion

FTerm.nvim provides a robust foundation for terminal management in Neovim. Its clean API, flexible configuration, and event system make it easy to build custom terminal workflows. By understanding these primitives, you can create powerful terminal integration for your development environment.
