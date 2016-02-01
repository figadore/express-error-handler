# Express Error Handler

Formats errors for the api-problem+json media-type

Error details (e.g. name, message, stack) will be included if the `showDetails` option is set. If the error already has a `detail` property, that is included as well, either as `description` if it is a string, or as the included properties if it is an object.

If `err.status`, `err.statusCode` or `err.output.statusCode` is set, that will set the HTTP status for the error response. It will also display the error's `message` property.

## Usage
Include  the module

`errorHandler = require('shiny-express-errors');`

---

Add middleware for error handling

`app.use(errorHandler.handleErrors(options));`

### options
* `showDetails`: boolean. whether to include error details (like stack) in response. Defaults to false

* `errorCallback`: function(err, req, responseSent). callback to run before sending error response (e.g. custom logging or whatever). responseSent is a boolean, `true` if response headers have already been sent, i.e. next(err) will not be called, so error is not indicated is response. Defaults to doing nothing

* `describedBy`: string|function(req). when string, value will be used in the `describedBy` field. when function, function will be run to generate field (with `req` as an argument). Defaults to `<host>/errors/error.html`

---

Add middleware for uncaught errors (uses domains). Attempts to send error response if response not already sent. Then it closes any open connections before shutting down the server. Server should be shut down after an uncaught exception: it always indicates a programmer error that should be fixed immediately.

`app.use(errorHandler.handleUncaughtErrors(options));`

### options
* `callback`: function(err, req). callback to run before closing

---
Send an error response to the client. Sends using api-problem media type.

`errorHandler.sendError(req, res, status, title, detail)`

## Bunyan serializer

`serializer = require('shiny-express-errors').serializer;
