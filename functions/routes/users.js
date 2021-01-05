const { admin, db } = require('../util/admin');
const config = require('../util/config')
const { isEmpty, isEmail, reduceUserDetails } = require('../util/validators')
const firebase = require('firebase');
const BusBoy = require('busboy');
const path = require('path');
const os = require('os');
const fs = require('fs');

firebase.initializeApp(config)

// signup
exports.signUp = (req, res) => {
    // default picture
    const noimg = 'no-image.jpg';
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirm_pass: req.body.confirm_pass,
        handle: req.body.handle
    };
    
    // errors array
    let errors = {};
    if(isEmpty(newUser.email)) {
        errors.email = 'Must not be empty'
    } else if (!isEmail(newUser.email)) {
        errors.email = "Email is invalid"
    }
    if(isEmpty(newUser.password)) errors.password = "Must not be empty";
    if(isEmpty(newUser.password !== newUser.confirm_pass)) errors.confirm_pass = "Passwords must match";
    if(isEmpty(newUser.handle)) errors.handle = "Must not be empty";

    if(Object.keys(errors).length > 0) return res.status(400).json(errors);

    let token, userId;
    // validate user before saving
    db.doc(`/users/${newUser.handle}`).get()
        .then((data) => {
            // if someone is already using the handle
            if(data.exists) {
                return res.status(400).json({ handle: "Handle is already taken."})
            } else {
                return firebase.auth().createUserWithEmailAndPassword(newUser.email, newUser.password)
            }
        }).then(info => {
            // assign id and token
            userId = info.user.uid;
            return info.user.getIdToken();
        }).then(idToken => {
            // use token to make user credentials (password)
            token = idToken
            const userCreds = {
                handle: newUser.handle,
                email: newUser.email,
                createdAt: new Date().toISOString(),
                imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noimg}?alt=media`,
                userId
            };
            return db.doc(`/users/${newUser.handle}`).set(userCreds);
        }).then(() => {
            // return success once token is saved!
            return res.status(201).json({ token });
        }).catch(err => {
            console.log(err)
            if (err.code === "auth/email-already-in-use") {
                return res.status(400).json({ email: "Email is already taken."})
            }
            return res.status(500).json({ error: err.code })
        });
}

// login
exports.logIn = (req, res) => {
    const user = {
        email: req.body.email,
        password: req.body.password
    };
    //validation
    let errors = {};
    if(isEmpty(user.email)) errors.email = 'Must not be empty';
    if(isEmpty(user.password)) errors.password = "Must not be empty";

    if(Object.keys(errors).length > 0) return res.status(400).json(errors);

    firebase.auth().signInWithEmailAndPassword(user.email, user.password)
        .then(data => {
            return data.user.getIdToken();
        }).then(token => {
            return res.json({token});
        }).catch(err => {
            console.error(err);
            if (err.code === "auth/wrong-password") {
                return res.status(403).json({ general: "Wrong credentials, please try again."})
            }
            if (err.code === "auth/user-not-found") {
                return res.status(403).json({ general: "Wrong credentials, please try again."})
            }
            return res.status(500).json({ error: err.code });
        });
};

// upload profile pic
exports.uploadImage = (req, res) => {
    const busboy = new BusBoy({ headers: req.headers });
    let fileName;
    let imageUploaded = {};
    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
        if(mimetype !== 'image/jpeg' && mimetype !== 'image/png' && mimetype !== 'image/gif') {
            return res.status(400).json({ error: "Wrong file type."})
        }
        // extract pic via busboy
        // get file type (index of last split)
        const extension = filename.split('.')[filename.split('.').length-1];
        fileName = `${Math.round(Math.random()*100000000)}.${extension}`;
        const filePath = path.join(os.tmpdir(), fileName);
        imageUploaded = {filePath, mimetype };
        file.pipe(fs.createWriteStream(filePath));
    })
    // update url and upload here...
    busboy.on('finish', () => {
        admin.storage().bucket().upload(imageUploaded.filePath, {
            resumable: false,
            metadata: {
                metadata: {
                    contentType: imageUploaded.mimetype
                }
            }
        }).then(() => {
            const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${fileName}?alt=media`
            return db.doc(`/users/${req.user.handle}`).update({ imageUrl });
        }).then(() => {
            return res.json({ message: 'image has been uploaded'})
        }).catch(err => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        });
    });
    busboy.end(req.rawBody);
};

// update users detail
exports.updateDetail = (req, res) => {
    let details = reduceUserDetails(req.body);
    console.log(details);
    db.doc(`/users/${req.user.handle}`).update(details)
        .then(() => {
            return res.json({ message: 'Details added successfully'});
        }).catch(err => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        });
};

// get current authenticated user 
exports.getAuthUser = (req, res) => {
    let userData = {};
    db.doc(`/users/${req.user.handle}`).get()
        .then(doc => {
            if(doc.exists) {
                userData.credentials = doc.data();
                // return if users liked a status or not
                return db.collection('likes').where('userHandle', '==', req.user.handle).get()
            }
        }).then(data =>{
            // put likes into the data
            userData.likes = [];
            data.forEach(doc => {
                userData.likes.push(doc.data());
            });
            return db.collection('notifications').where('recipient', '==', req.user.handle)
                .orderBy('createdAt', 'desc').get();
        }).then(data => {
            userData.notifications = [];
            data.forEach(doc => {
                userData.notifications.push({
                    recipient: doc.data().recipient,
                    sender: doc.data().sender,
                    createdAt: doc.data().createdAt,
                    postId: doc.data().postId,
                    type: doc.data().type,
                    read: doc.data().read,
                    notificationId: doc.id
                })
            });
            return res.json(userData);
        }).catch((err) => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        });
}

exports.getUserDetail = (req, res) => {
    let userData = {};
    db.doc(`/users/${req.params.handle}`).get()
        .then(doc => {
            if(doc.exists) {
                userData.user = doc.data();
                return db.collection('posts').where('userHandle', '==', req.params.handle).orderBy('createdAt', "desc")
                    .get();
            } else {
                return res.status(404).json({ error: "User not found..."})
            }
        }).then(data => {
            userData.posts = [];
            data.forEach(doc => {
                userData.posts.push({
                    body: doc.data().body,
                    createdAt: doc.data().createdAt,
                    userHandle: doc.data().userHandle,
                    userImage: doc.data().userImage,
                    likeCount: doc.data().likeCount,
                    commentCount: doc.data().commentCount,
                    postId: doc.id
                })
            });
            return res.json(userData);
        }).catch(err => {
            console.error(err);
            return res.stats(500).json({ error: err.code });
        });
}

exports.readNotification = (req, res) => {
    let batch = db.batch()
    req.body.forEach(notificationId => {
        const notification = db.doc(`/notifications/${notificationId}`)
        batch.update(notification, { read: true });
    })
    batch.commit()
        .then(() => {
            return res.json({ message: "Notifications are marked read"});
        }).catch(err => {
            console.error(err);
            return res.status(500).json({error: err.code})
        });
}