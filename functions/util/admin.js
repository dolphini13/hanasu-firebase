const admin = require('firebase-admin'); 
admin.initializeApp();

// init the db
const db = admin.firestore();

module.exports = { admin, db };