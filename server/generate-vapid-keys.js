const webpush = require('web-push');

const keys = webpush.generateVAPIDKeys();
console.log('Add these to your server/.env (or environment) file:\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('\nKeep VAPID_PRIVATE_KEY secret. The public key is safe to expose to the client.');
