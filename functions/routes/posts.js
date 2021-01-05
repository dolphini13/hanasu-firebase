const { db } = require('../util/admin');

// retrieve all posts
exports.getAllPosts = (req, res) => {
    db.collection('posts')
        .orderBy('createdAt', 'desc')
        .get()
        .then(data => {
            let posts = [];
            data.forEach(doc => {
                posts.push({
                    postId: doc.id,
                    content: doc.data().content,
                    userHandle: doc.data().userHandle,
                    createdAt: doc.data().createdAt,
                    likeCount: doc.data().likeCount,
                    commentCount: doc.data().commentCount,
                    userImage: doc.data().userImage
                });
            });
            return res.json(posts);
        })
        .catch((err) => console.error(err));
};

// get one post 
exports.getPost = (req, res) => {
    let postData = {};
    db.doc(`/posts/${req.params.postId}`).get()
        .then((doc) => {
            // organise post data
            if(!doc.exists) {
                return res.status(404).json({ error: "Post not found "})
            }
            postData = doc.data();
            postData.postId = doc.id;
            // return comments of post
            return db.collection('comments').orderBy('createdAt', 'desc').where('postId', '==', req.params.postId).get();
        }).then((data) => {
            postData.comments = [];
            // put comments in postData
            data.forEach(doc => {
                postData.comments.push(doc.data())
            });
            return res.json(postData);
        }).catch((err) => {
            console.error(err);
            return res.status(500).json({ error: err.code })
        });
}

// comment on post
exports.commentPost = (req, res) => {
    if(req.body.body.trim() === '') return res.status(400).json({ error: "Must not be empty "});
    const comment = {
        body: req.body.body,
        createdAt: new Date().toISOString(),
        postId: req.params.postId,
        userImage: req.user.imageUrl,
        userHandle: req.user.handle
    };
    db.doc(`/posts/${req.params.postId}`).get()
        .then((doc) => {
            // organise post data
            if(!doc.exists) {
                return res.status(404).json({ error: "Post not found "})
            }
            return doc.ref.update({ commentCount: doc.data().commentCount+1 });           
        }).then(() => {
            return db.collection('comments').add(comment);
        }).then((data) => {
            res.json(comment);
        }).catch(err => {
            console.log(err);
            res.status(500).json({error:err.code});
        });
}

// post a post
exports.postPost = (req, res) => {
    // error if content  us empty
    if (req.body.content === "") {
        return res.status(400).json({body: "Your post must have contain words."});
    }

    // create new post
    const newPost = {
        userHandle: req.user.handle,
        userImage: req.user.imageUrl,
        content: req.body.content,
        // making time stamp with firestore...
        createdAt: new Date().toISOString(),
        likeCount: 0,
        commentCount: 0
    };
    // add to firebase
    db.collection('posts')
        .add(newPost)
        .then(data => {
            const resPost = newPost;
            resPost.postId = data.id;
            res.json(resPost)
        }).catch((err) => {
            // server error
            res.status(500).json({ error: 'something went wrong' });
            console.error(err)
        });
};

// like post
exports.likePost = (req, res) => {
    // retrieve like from collection
    const likeDoc = db.collection('likes').where('userHandle', '==', req.user.handle)
        .where('postId', '==', req.params.postId).limit(1);
    // retrieve the post itself
    const postDoc = db.doc(`/posts/${req.params.postId}`);
    let postData;

    postDoc.get()
        .then(doc => {
            if(doc.exists){
                // if post exists, we will use it
                postData = doc.data();
                postData.postId = doc.id;
                return likeDoc.get();
            } else {
                return res.status(404).json({ error: "Post does not exist"});
            }
        }).then(data => {
            // if user hasn't liked, add a like 
            if(data.empty) {
                return db.collection('likes').add({
                    postId: req.params.postId,
                    userHandle: req.user.handle
                }).then(() => {
                    // increase and save post like count
                    postData.likeCount++;
                    return postDoc.update({likeCount: postData.likeCount });
                }).then(() => {
                    return res.json(postData);
                })
            } else {
                return res.status(400).json({ error: "Post already liked"});
            }
        }).catch(err => {
            console.error(err)
            res.status(500).json({ error: err.code })
        });
}
// dislike post
exports.unlikePost = (req, res) => {
    // retrieve like from collection
    const likeDoc = db.collection('likes').where('userHandle', '==', req.user.handle)
        .where('postId', '==', req.params.postId).limit(1);
    // retrieve the post itself
    const postDoc = db.doc(`/posts/${req.params.postId}`);
    let postData;

    postDoc.get()
        .then(doc =>{
            if(doc.exists){
                // if post exists, we will use it
                postData = doc.data();
                postData.postId = doc.id;
                return likeDoc.get();
            } else {
                return res.status(404).json({ error: "Post does not exist"});
            }
        }).then(data => {
            // if user hasnt liked it, return an error
            if(data.empty) {
                return res.status(400).json({ error: "Post was not liked"});
            } else {
                return db.doc(`/likes/${data.docs[0].id}`).delete().then(() => {
                    postData.likeCount--;
                    return postDoc.update({likeCount: postData.likeCount });
                }).then(() => {
                    return res.json(postData);
                });
            }  
        }).catch(err => {
            console.error(err)
            res.status(500).json({ error: err.code })
        });
}

// delete post
exports.deletePost = (req, res) => {
    const postDoc = db.doc(`/posts/${req.params.postId}`);
    postDoc.get()
        .then(doc => {
            if(!doc.exists) {
                return res.status(404).json({ error: "Post is not found"});
            } 
            if(doc.data().userHandle !== req.user.handle) {
                // unauthorised - not owner
                return res.status(403).json({ error: "Unauthorised"});
            } else{
                return postDoc.delete();
            }
        }).then(() => {
            res.json({ message: "The post has been deleted successfully"});
        }).catch(err => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        });
}