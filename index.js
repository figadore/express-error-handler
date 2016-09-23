/* eslint-env node */
/* eslint valid-jsdoc:0 */

/**
 * This script uses some ideas from https://nodejs.org/api/domain.html
 */

// Include external dependencies
var domain = require('domain');

// Local variables
var uncaughtCallback;
var errorCallback;
var showDetails;
var showStack;
var describedBy;


function getHost(req) {
  var host = req.protocol + "://" + req.get('host');
  return host;
}


// Public
module.exports = {
  // Middleware for fatal errors
  handleUncaughtErrors: function handleUncaughtErrors(options) {
    // Set local variables based on options
    uncaughtCallback = options.callback || function empty() {};
    // For uncaught exceptions, let app try to do some cleanup. Also send the
    // error response to the client if this is still possible
    return function domainErrors(req, res, next) {
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

      // I think this attaches the domain to this request only
      appDomain.run(next);
    };
  },

  // Middleware for normal application errors
  handleErrors: function handleErrors(options) {
    // Set local variables based on options
    showDetails = options.showDetails || function showDetail(err, req) {
      // Show details for all but 500+
      if (module.exports.getStatusCode(err) >= 500) {
        return false;
      }
      return true;
    };
    showStack = options.showStack || false;
    errorCallback = options.callback || function empty() {};
    describedBy = options.describedBy || function describe(req) {
      return getHost(req) + "/errors/error.html";
    };
    // For errors thrown during app execution, catch them and send an error
    // response
    return function errorHandler(err, req, res, next) {
      var detail;

      var message = "Unknown Error";
      var statusCode = module.exports.getStatusCode(err);
      if (statusCode < 500) {
        message = err.message;
      }

      // Let the app do its own logging or whatever
      errorCallback(err, req);
      var includeDetail;
      if (typeof showDetails === "function") {
        includeDetail = showDetails(err, req);
      } else {
        includeDetail = showDetails;
      }
      if (includeDetail) {
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
      }
      var includeStack;
      if (typeof showStack === "function") {
        includeStack = showStack(err, req);
      } else {
        includeStack = showStack;
      }
      if (includeStack) {
        detail.stack = err.stack;
      }
      if (includeStack && includeDetail) {
        detail.fullError = module.exports.serializer(err);
      }
      module.exports.sendError(req, res, statusCode, message, detail);
    };
  },

  // Inspect Error object to try to determine appropriate http status code
  getStatusCode: function getStatusCode(err) {
    // Default to 500
    var statusCode = 500;
    // If error has statuscode property, use that, and its message
    if (err.hasOwnProperty('output') && err.output.hasOwnProperty('statusCode')) {
      statusCode = err.output.statusCode;
    }
    if (err.hasOwnProperty('status')) {
      statusCode = err.status;
    } else if (err.hasOwnProperty('statusCode')) {
      statusCode = err.statusCode;
    } else if (err.name === "NotFoundError") {
      statusCode = 404;
    }
    return statusCode;
  },

  // Format error as api-problem media-type
  sendError: function sendError(req, res, status, title, detail) {
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
  },

  // For VError lib, if err has `cause` function, call it recursively to get the original error
  getRootError: function getRootError(err) {
    if (err.cause && typeof err.cause === "function") {
      return getRootError(err);
    }
    return err;
  },

  serializer: function serialize(err) {
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
    if (err.cause && typeof err.cause === "function" && err.cause()) {
      // Prevent circular reference
      if (err !== err.cause()) {
        error.cause = module.exports.serializer(err.cause());
      }
    }
    if (err.detail) {
      error.detail = err.detail;
    }
    return error;
  }
};

