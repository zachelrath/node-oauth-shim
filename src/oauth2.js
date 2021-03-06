//
// OAuth2
// Process OAuth2 exchange
//

var request = require('./utils/request');
var param = require('./utils/param');
var url = require('url');

module.exports = function(p, callback, options) {

	if (!options) options = {};

	// Make the OAuth2 request
	var post = null,
		extendRequestBody = options.extendRequestBody,
		extendRequestHeaders = options.extendRequestHeaders;

	if (p.code) {
		post = {
			code: p.code,
			client_id: p.client_id || p.id,
			client_secret: p.client_secret,
			grant_type: 'authorization_code',
			redirect_uri: p.redirect_uri
		};
	}
	else if (p.refresh_token) {
		post = {
			refresh_token: p.refresh_token,
			client_id: p.client_id || p.id,
			client_secret: p.client_secret,
			grant_type: 'refresh_token',
		};
	}

	if (extendRequestBody) {
		extendRequestBody(post,p);
	}

	// Get the grant_url
	var grant_url = p.oauth ? p.oauth.grant : false;

	if (!grant_url) {
		return callback({
			error: 'required_grant',
			error_message: 'Missing parameter state.oauth.grant url',
		});
	}

	// Convert the post object literal to a string
	post = param(post);

	// Create the request
	var r = url.parse(grant_url),
		requestHeaders = {
			'Content-length': post.length,
			'Content-type': 'application/x-www-form-urlencoded'
		};

	r.method = 'POST';

	// Workaround for Vimeo, which requires an extra Authorization header
	if (p.authorisation === 'header') {
		requestHeaders.Authorization = 'basic ' + new Buffer(p.client_id + ':' + p.client_secret).toString('base64');
	}

	if (extendRequestHeaders) {
		extendRequestHeaders(requestHeaders,p);
	}

	r.headers = requestHeaders;

	//opts.body = post;
	request(r, post, function(err, res, body, data) {

		// Check responses
		if (err || !body || (!('access_token' in data) && !('error' in data))) {
			if (!data || typeof(data) !== 'object') {
				data = {};
			}
			data.error = 'invalid_grant';
			data.error_message = (err
				? 'Could not find the authenticating server, '
				: 'Could not get a sensible response from the authenticating server, '
			) + grant_url;
		}
		else if ('access_token' in data && !('expires_in' in data)) {
			data.expires_in = 3600;
		}

		// If the refresh token was on the original request lets return it.
		if (p.refresh_token && !data.refresh_token) {
			data.refresh_token = p.refresh_token;
		}

		// Return to the handler
		callback(data);
	});
};
