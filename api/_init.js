if (
  !process.env.GOOGLE_APPLICATION_CREDENTIALS &&
  process.env.SERVICE_ACCOUNT
) {
  // Write a service account key to the filesystem.
  require('fs').writeFileSync(
    '/tmp/service-account.json',
    process.env.SERVICE_ACCOUNT,
  )
  // Set the GOOGLE_APPLICATION_CREDENTIALS environment variable.
  process.env.GOOGLE_APPLICATION_CREDENTIALS = '/tmp/service-account.json'
}
