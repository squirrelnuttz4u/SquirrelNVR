const Service = require('node-windows').Service;
const path = require('path');

// Create a new service object
const svc = new Service({
  name: 'SquirrelNVR',
  script: path.join(__dirname, '../dist/server/index.js')
});

// Listen for the "uninstall" event
svc.on('uninstall', function() {
  console.log('✓ SquirrelNVR service uninstalled successfully');
});

svc.on('error', function(err) {
  console.error('✗ Error uninstalling service:', err);
});

console.log('Uninstalling SquirrelNVR service...');
svc.uninstall();
