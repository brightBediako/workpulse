export const globalErrhandler = (err, req, res, next) => {
  //stack
  //message
  const stack = err?.stack;
  const statusCode = err?.statusCode ? err?.statusCode : 500;
  const message = err?.message;
  res.status(statusCode).json({
    stack,
    message,
  });
};

// Factory function for creating errors
export const createError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

//404 handler
export const notFound = (req, res, next) => {
  const err = new Error(`Route ${req.originalUrl} Not Found`);
  next(err);
};
