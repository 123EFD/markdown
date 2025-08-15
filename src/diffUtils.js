// Simple line-based diff for highlighting added/removed text
export function diffLines(oldStr, newStr) {
    const oldLines = oldStr.split('\n');
    const newLines = newStr.split('\n');
    let i = 0, j = 0;
    const result = [];
    while (i < oldLines.length || j < newLines.length) {
        if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
        result.push({ type: 'unchanged', text: oldLines[i] });
        i++; j++;
        } else if (j < newLines.length && (!oldLines.includes(newLines[j]) || i >= oldLines.length)) {
        result.push({ type: 'added', text: newLines[j] });
        j++;
        } else if (i < oldLines.length && (!newLines.includes(oldLines[i]) || j >= newLines.length)) {
        result.push({ type: 'removed', text: oldLines[i] });
        i++;
        } else {
        // fallback: treat as changed
        result.push({ type: 'removed', text: oldLines[i] });
        result.push({ type: 'added', text: newLines[j] });
        i++; j++;
        }
    }
    return result;
}
