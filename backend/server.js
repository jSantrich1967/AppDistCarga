// Redirect to main server in parent directory
const path = require('path');
const parentDir = path.join(__dirname, '..');
process.chdir(parentDir);
require('../server.js');

