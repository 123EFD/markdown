

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';

// Custom plugin for superscript, subscript, and highlight
import { visit } from 'unist-util-visit';
function customMarkdownPlugins() {
  return (tree) => {
    visit(tree, 'text', (node, index, parent) => {
      let value = node.value;
      let nodes = [];
      let lastIndex = 0;
      // Regex for highlight ==text==
      const highlightRegex = /==([^=]+)==/g;
      // Regex for superscript ^text^
      const supRegex = /\^([^\^]+)\^/g;
      // Regex for subscript ~text~
      const subRegex = /~([^~]+)~/g;
      while (true) {
        let h = highlightRegex.exec(value);
        let s = supRegex.exec(value);
        let sub = subRegex.exec(value);
        let matches = [h, s, sub].filter(Boolean);
        if (matches.length === 0) break;
        // Find the earliest match
        let first = matches.reduce((a, b) => (a.index < b.index ? a : b));
        if (first.index > lastIndex) {
          nodes.push({ type: 'text', value: value.slice(lastIndex, first.index) });
        }
        if (first === h) {
          nodes.push({ type: 'element', tagName: 'mark', children: [{ type: 'text', value: h[1] }] });
          lastIndex = h.index + h[0].length;
        } else if (first === s) {
          nodes.push({ type: 'element', tagName: 'sup', children: [{ type: 'text', value: s[1] }] });
          lastIndex = s.index + s[0].length;
        } else if (first === sub) {
          nodes.push({ type: 'element', tagName: 'sub', children: [{ type: 'text', value: sub[1] }] });
          lastIndex = sub.index + sub[0].length;
        }
        // Reset regex lastIndex for next search
        highlightRegex.lastIndex = lastIndex;
        supRegex.lastIndex = lastIndex;
        subRegex.lastIndex = lastIndex;
      }
      if (lastIndex < value.length) {
        nodes.push({ type: 'text', value: value.slice(lastIndex) });
      }
      if (nodes.length > 0) {
        parent.children.splice(index, 1, ...nodes);
        return [visit.SKIP, index + nodes.length];
      }
    });
  };
}
import './App.css';

const STORAGE_KEY = 'markdown-files';

function getFiles() {
  const files = localStorage.getItem(STORAGE_KEY);
  return files ? JSON.parse(files) : {};
}

function saveFiles(files) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
}

function App() {
  const [markdown, setMarkdown] = useState('');
  const [files, setFiles] = useState({});
  const [currentFile, setCurrentFile] = useState('');
  const [filename, setFilename] = useState('');
  const [theme, setTheme] = useState('light');
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    const stored = getFiles();
    setFiles(stored);
    const first = Object.keys(stored)[0];
    if (first) {
      setCurrentFile(first);
      setMarkdown(stored[first]);
      setFilename(first);
    } else {
      setMarkdown(`# Welcome to the Markdown Editor!\n\nType your *markdown* on the left.\n\n- Live preview on the right\n- **Enjoy!**`);
      setFilename('Untitled.md');
    }
  }, []);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  const handleSave = () => {
    if (!filename.trim()) return;
    const updated = { ...files, [filename]: markdown };
    setFiles(updated);
    saveFiles(updated);
    setCurrentFile(filename);
    alert('File saved!');
  };

  const handleLoad = (name) => {
    setMarkdown(files[name]);
    setCurrentFile(name);
    setFilename(name);
  };

  const handleDelete = (name) => {
    if (!window.confirm(`Delete file '${name}'?`)) return;
    const updated = { ...files };
    delete updated[name];
    setFiles(updated);
    saveFiles(updated);
    if (currentFile === name) {
      const next = Object.keys(updated)[0];
      if (next) {
        setMarkdown(updated[next]);
        setCurrentFile(next);
        setFilename(next);
      } else {
        setMarkdown('');
        setCurrentFile('');
        setFilename('Untitled.md');
      }
    }
  };

  const handleRename = (oldName, newName) => {
    if (!newName.trim() || files[newName]) return alert('Invalid or duplicate filename!');
    const updated = { ...files };
    updated[newName] = updated[oldName];
    delete updated[oldName];
    setFiles(updated);
    saveFiles(updated);
    setCurrentFile(newName);
    setFilename(newName);
    setRenaming(false);
  };

  const handleExport = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleThemeSwitch = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="markdown-editor-container">
      <div className="toolbar">
        <button onClick={handleSave}>💾 Save</button>
        <button onClick={handleExport}>⬇️ Export</button>
        <button onClick={handleThemeSwitch}>
          {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>
        <input
          value={filename}
          onChange={e => setFilename(e.target.value)}
          onBlur={() => setRenaming(false)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleRename(currentFile, filename);
          }}
          className="filename-input"
          style={{ width: Math.max(10, filename.length) + 'ch' }}
          disabled={!renaming && currentFile === filename}
        />
        {currentFile !== filename && (
          <button onClick={() => handleRename(currentFile, filename)}>Rename</button>
        )}
      </div>
      <div className="file-list">
        {Object.keys(files).map(name => (
          <div key={name} className={`file-item${name === currentFile ? ' active' : ''}`}>
            <span onClick={() => handleLoad(name)}>{name}</span>
            <button onClick={() => handleDelete(name)} title="Delete">🗑️</button>
          </div>
        ))}
      </div>
      <div className="editor-preview-wrapper">
        <textarea
          className="markdown-input"
          value={markdown}
          onChange={e => setMarkdown(e.target.value)}
          placeholder="Type your markdown here..."
        />
        <div className="markdown-preview">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, customMarkdownPlugins]}
            rehypePlugins={[rehypeHighlight]}
            components={{
              // Checklist rendering
              li({ children, checked, ...props }) {
                if (typeof checked === 'boolean') {
                  return (
                    <li {...props} className="checklist-item">
                      <input type="checkbox" checked={checked} readOnly />{' '}
                      {children}
                    </li>
                  );
                }
                return <li {...props}>{children}</li>;
              },
            }}
          >
            {markdown}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

export default App;
