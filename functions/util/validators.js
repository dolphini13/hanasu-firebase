// helper for user checks
exports.isEmpty = (string) => {
    if(string === '') return true;
    else return false;
}

exports.isEmail = (email) => {
    const emailRegEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if(email.match(emailRegEx)) return true;
    else return false;
}

// reduce details for user detail update
exports.reduceUserDetails = (data) => {
    let details = {};
    // check if it's empty
    if((data.bio.trim()) !== '') details.bio = data.bio;
    // website gonna be sanitised too...
    if((data.link.trim()) !== '') {
        // if https...
        if(data.link.trim().substring(0, 4) !== 'http') {
            details.link = `http://${data.link.trim()}`;
        } else details.link = data.link;
    }
    if((data.location.trim()) !== '') details.location = data.location;

    return details;
}