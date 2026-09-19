
const fs = require('fs');
const filePath = 'app/app.js';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('Total lines before:', lines.length);
console.log('Line 6051:', JSON.stringify(lines[6050]));
console.log('Line 6052:', JSON.stringify(lines[6051]));
console.log('Line 6053:', JSON.stringify(lines[6052]));

// Remove line 6052 (index 6051) which is the spurious '        }'
if (lines[6051].trim() === '}' && lines[6051].startsWith('        ') && lines[6052].trim().startsWith('} else if')) {
    lines.splice(6051, 1);
    console.log('\nRemoved spurious line 6052!');
    console.log('New line 6051:', JSON.stringify(lines[6050]));
    console.log('New line 6052:', JSON.stringify(lines[6051]));
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log('Total lines after:', lines.length);
    console.log('File saved!');
} else {
    console.log('\nERROR: Expected conditions not met:');
    console.log('  lines[6051].trim() === "}":', lines[6051].trim() === '}');
    console.log('  starts with 8 spaces:', lines[6051].startsWith('        '));
    console.log('  next starts with } else if:', lines[6052].trim().startsWith('} else if'));
}
