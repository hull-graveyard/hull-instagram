export default function preflightHandler(req = {}, res, next) {
  const { body } = req;
  if (!body || !body.length) {
    return res.handleError(new Error('No payload in body'), 400);
  }
  next();
}
