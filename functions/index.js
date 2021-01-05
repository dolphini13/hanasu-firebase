const functions = require('firebase-functions');
const express = require('express');
const app = express();
const fbAuth = require('./util/fbAuth');

const { db } = require('./util/admin')
const { getAllPosts, postPost, getPost, commentPost, likePost, unlikePost, deletePost } = require('./routes/posts');
const { signUp, logIn, uploadImage, updateDetail, getAuthUser, getUserDetail, readNotification } = require('./routes/users');

// posts routes 
// allpost
app.get('/posts', getAllPosts);
app.post('/posts', fbAuth, postPost);
// one post
app.get('/posts/:postId', getPost);
// delete
app.delete('/posts/:postId', fbAuth, deletePost);
// like
app.get('/posts/:postId/like', fbAuth, likePost);
app.get('/posts/:postId/unlike', fbAuth, unlikePost);
// unlike
// comment on post
app.post('/posts/:postId/comment', fbAuth, commentPost);

// users routes
app.post('/signup', signUp);
app.post('/login', logIn);
app.post('/user/image', fbAuth, uploadImage);
app.post('/user', fbAuth, updateDetail);
app.get('/user', fbAuth, getAuthUser);
app.get('/user/:handle', getUserDetail);
app.post('/notifications', fbAuth, readNotification);

exports.api = functions.https.onRequest(app);

// when someone likes something, create notification to receiver 
exports.createNotificationOnLike = functions.firestore.document('likes/{id}')
    .onCreate((snapshot) => {
        return db.doc(`/posts/${snapshot.data().postId}`).get()
        .then(doc =>{
            if(doc.exists && doc.data().userHandle !== snapshot.data().userHandle) {
                return db.doc(`/notifications/${snapshot.id}`).set({
                    createdAt: new Date().toISOString(),
                    recipient: doc.data().userHandle,
                    sender: snapshot.data().userHandle,
                    type: 'like',
                    read: false,
                    postId: doc.id
                })
            }
        }).catch(err => {
            console.error(err);
            return;
        });
    });

// when someone unlike before noti is read, delete teh notification
exports.deleteNotificationOnUnLike = functions.firestore.document('likes/{id}')
    .onDelete((snapshot) => {
        return db.doc(`/notifications/${snapshot.id}`).delete()
        .catch(err => {
            console.error(err);
            return;
        });
    });

// when someone comments on something, create notification to receiver 
exports.createNotificationOnComment = functions.firestore.document('comments/{id}')
    .onCreate((snapshot) => {
        return db.doc(`/posts/${snapshot.data().postId}`).get()
        .then(doc =>{
            if(doc.exists && doc.data().userHandle !== snapshot.data().userHandle) {
                return db.doc(`/notifications/${snapshot.id}`).set({
                    createdAt: new Date().toISOString(),
                    recipient: doc.data().userHandle,
                    sender: snapshot.data().userHandle,
                    type: 'comment',
                    read: false,
                    postId: doc.id
                })
            }
        }).catch(err => {
            console.error(err);
            return;
        });
    });

// change user profile pics associated with all posts and comments
exports.onUserImageChange = functions.firestore.document('/users/{userId}')
    .onUpdate((change) => {
        if(change.before.data().imageUrl !== change.after.data().imageUrl) {
            const batch = db.batch();
            return db.collection('posts')
                .where('userHandle', '==', change.before.data().handle)
                .get()
                .then((data) => {
                    data.forEach((doc) => {
                        const post = db.doc(`/posts/${doc.id}`);
                        batch.update(post, { userImage: change.after.data().imageUrl })
                    });
                    return batch.commit();
                });
        } else return true;
    });

// when comment is delete, delete associated like, comment and notification
exports.onPostDelete = functions.firestore.document('/posts/{postId}')
    .onDelete((snapshot, context) => {
        const postId = context.params.postId;
        const batch = db.batch();
        return db.collection('comments').where('postId', '==', postId).get()
            .then(data => {
                data.forEach(doc => {
                    batch.delete(db.doc(`/comments/${doc.id}`));
                })
                return db.collection('likes').where('postId', '==', postId).get();
            }).then(data => {
                data.forEach(doc => {
                    batch.delete(db.doc(`/likes/${doc.id}`));
                })
                return db.collection('notifications').where('postId', '==', postId).get();    
            }).then(data => {
                data.forEach(doc => {
                    batch.delete(db.doc(`/notifications/${doc.id}`));
                })
                return batch.commit(); 
            }).catch(err => console.error(err));
    })