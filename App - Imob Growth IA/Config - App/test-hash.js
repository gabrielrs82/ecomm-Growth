const crypto = require('crypto');
const demoSalt = 'cc1b6d35597e379cda7b8d2e8db8a0c9';
const targetHash = 'e573d857890287c7cac4834181685c8ea677c1ff03edfbce6b3f371ae29d0f733f797a4d8281a62db26a0fcce93cb3adbc17388feccb156453aac0d56ff18d55';

const input = 'growth123';
const outputHash = crypto.pbkdf2Sync(input, demoSalt, 100000, 64, 'sha256').toString('hex');

console.log("Input: ", input);
console.log("Generated hash: ", outputHash);
console.log("Target hash:    ", targetHash);
console.log("Matches?        ", outputHash === targetHash);
