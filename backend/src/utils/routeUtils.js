export function handleResult(reply, result) {
  if (result.error) {
    return reply.status(result.status || 400).send({ success: false, error: result.error })
  }
  if (result.status) {
    return reply.status(result.status).send(result)
  }
  return reply.send(result)
}