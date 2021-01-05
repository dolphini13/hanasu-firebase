const { admin, db } = require('./admin'); 

module.exports = (req, res, next) => {
    let idToken;
    if(req.headers.authorization) {
        idToken = req.headers.authorization
    } else {
        // unauthorisised error
        console.log("No token")
        return res.status(403).json({ error: 'Unorthorised' });
    }
    // verify token, decode and extract user data
    admin.auth().verifyIdToken(idToken)
        .then(decodedToken => {
            req.user = decodedToken;
            return db.collection('users')
                .where('userId', '==', req.user.uid)
                .limit(1)
                .get()
        }).then(data => {
            // assign req handle to the extracted handle
            req.user.handle = data.docs[0].data().handle;
            req.user.imageUrl = data.docs[0].data().imageUrl;
            return next();
        }).catch(err => {
            console.error('Error while verifying token ', err);
            return res.status(403).json(err);
        });
}