# Express Error Handler

## Usage
Include  the module

`errorHandler = require('shiny-express-errors');`

---

Add middleware for error handling

`app.use(errorHandler.handleErrors(options));`

### options
* `showDetails`: boolean. whether to include error details (like stack) in response

* `errorCallback`: function(err, req). callback to run before sending error response (e.g. custom logging or whatever)

* `describedBy`: string|function(req). when string, value will be used in the `describedBy` field. when function, function will be run to generate field

---

Add middleware for uncaught errors (uses domains). Attempts to send error response if response not already sent. Then it closes any open connections before shutting down the server. Server should be shut down after an uncaught exception: it always indicates a programmer error that should be fixed immediately.

`app.use(errorHandler.handleUncaughtErrors(options));`

### options
* `callback`: function(err, req). callback to run before closing

---
Send an error response to the client. Sends using api-problem media type.

`errorHandler.sendError(req, res, status, title, detail)`
