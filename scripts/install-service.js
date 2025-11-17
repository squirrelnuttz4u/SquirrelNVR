const Service = require('node-windows').Service;
const path = require('path');

// Create a new service object
const svc = new Service({
  name: 'SquirrelNVR',
  description: 'SquirrelNVR - Professional IP Camera NVR System with AI Detection',
  script: path.join(__dirname, '../dist/server/index.js'),
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ],
  env: [
    {
      name: 'NODE_ENV',
      value: 'production'
    }
  ]
});

// Listen for the "install" event
svc.on('install', function() {
  console.log('✓ SquirrelNVR service installed successfully');
  console.log('Starting service...');
  svc.start();
});

svc.on('start', function() {
  console.log('✓ SquirrelNVR service started');
  console.log('\nService Details:');
  console.log('  Name:', svc.name);
  console.log('  Description:', svc.description);
  console.log('  Script:', svc.script);
  console.log('\nThe service will now start automatically on system boot.');
});

svc.on('alreadyinstalled', function() {
  console.log('⚠ SquirrelNVR service is already installed');
});

svc.on('error', function(err) {
  console.error('✗ Error installing service:', err);
});

console.log('Installing SquirrelNVR as a Windows service...');
svc.install();
