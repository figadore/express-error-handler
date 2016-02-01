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
    var responseSent = res.headersSent;
    uncaughtCallback(err, req, responseSent);
    appDomain.dispose();
    if (!responseSent) {
      // Respond with 500 error if response not already sent
      next(err);
    }
  });

  //make sure to leave domain at end of request
  var oldEnd = res.end;
  res.end = function end(chunk, encoding) {
    // Set `end` back to its original value and call it
    res.end = oldEnd;
    res.end(chunk, encoding);
    appDomain.dispose();
  }

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

  // Default to 500
  var statusCode = 500;
  var message = "Unknown Error";

  // If error has statuscode property, use that, and its message
  if (err.hasOwnProperty('output') && err.output.hasOwnProperty('statusCode')) {
    statusCode = err.output.statusCode;
    message = err.message;
  }
  if (err.hasOwnProperty('status')) {
    statusCode = err['status'];
    message = err.message;
  } else if (err.hasOwnProperty('statusCode')) {
    statusCode = err['statusCode'];
    message = err.message;
  } else if (err.name === "NotFoundError") {
    statusCode = 404;
    message = err.message;
  }
  // Let the app do its own logging or whatever
  errorCallback(err, req);
  if (showDetails) {
    detail = {};
    // Include original details if included
    if (err.detail && typeof err.detail === "object") {
      detail = err.detail;
    } else if (err.detail && typeof err.detail === "string") {
      detail.description = err.detail;
    }
    // Include error specific details
    detail.name = err.name;
    detail.message = err.message;
    detail.stack = err.stack;
  }

  sendError(req, res, statusCode, message, detail);
}

/**
 * For VError lib, if err has `cause` function, call it recursively to get the original error
 */
function getRootError(err) {
  if (err.cause && typeof err.cause === "function") {
    return getRootError(err);
  }
  return err;
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

function serialize(err) {
  var error = {};
  if (err.name) {
    error.name = err.name;
  }
  if (err.message) {
    error.message = err.message;
  }
  if (err.stack) {
    error.stack = err.stack;
  }
  if (err.cause && typeof err.cause === "function") {
    error.cause = serialize(err.cause());
  }
  if (err.detail) {
    error.detail = err.detail;
  }
  return error;
}

exports.handleUncaughtErrors = handleUncaughtErrors;
exports.sendError = sendError;
exports.handleErrors = handleErrors;

exports.serializer = serialize;
