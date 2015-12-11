/* eslint-env node */
/* eslint valid-jsdoc:0 */

/**
 * This script uses some ideas from https://nodejs.org/api/domain.html
 */

// Include external dependencies
var domain = require('domain');

var uncaughtCallback;
var errorCallback;
var showDetails;
var describedBy;

// Constructor
function handleUncaughtErrors(options) {
  uncaughtCallback = options.callback || function empty() {};
  return domainErrors;
}

/**
 * For uncaught exceptions, let app try to do some cleanup. Also send the error
 * response to the client if this is still possible
 */
function domainErrors(req, res, next) {
  var appDomain = domain.create();

  appDomain.on('error', function onDomainErrorCaught(err) {
    // make sure we close down within 30 seconds
    var killtimer = setTimeout(function fallbackKill() {
      process.exit(1);
    }, 30000);
    // But don't keep the process open just for that!
    killtimer.unref();

    // Let the app do its own logging/cleanup
    uncaughtCallback(err, req);
    appDomain.dispose();
    if (!res.headersSent) {
      // Respond with 500 error if response not already sent
      next(err);
    }
  });

  appDomain.enter();
  next();
}

// Constructor
function handleErrors(options) {
  showDetails = options.showDetails || false;
  errorCallback = options.callback || function empty() {};
  describedBy = options.describedBy || function describe(req) {
    return getHost(req) + "/errors/error.html";
  };
  return errorHandler;
}

function getHost(req) {
  var host = req.protocol + "://" + req.get('host');
  return host;
}

/**
 * For errors thrown during app execution, catch them and send an error
 * response
 */
function errorHandler(err, req, res, next) {
  var detail;
  if (err.name === "NotFoundError") {
    sendError(req, res, 404, err.message);
  } else {
    // Let the app do its own logging or whatever
    errorCallback(err, req);
    if (showDetails) {
      detail = {
        name: err.name,
        message: err.message,
        stack: err.stack
      };
    }
    sendError(req, res, 500, "Unknown Error", detail);
  }
}

// Format error as api-problem media-type
function sendError(req, res, status, title, detail) {
  res.status(status);
  res.setHeader('content-type', 'application/api-problem+json');
  var data = {
    title: title,
    httpStatus: res.statusCode,
    detail: detail
  };
  if (typeof describedBy === "function") {
    data.describedBy = describedBy(req);
  } else {
    data.describedBy = describedBy;
  }
  res.json(data);
}

exports.handleUncaughtErrors = handleUncaughtErrors;
exports.sendError = sendError;
exports.handleErrors = handleErrors;
