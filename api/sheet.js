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

const serverId = require('uuid').v4()
const axios = require('axios')
const { google } = require('googleapis')
const sheets = google.sheets('v4')

const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

module.exports = async function (request, response) {
  if (!request.query.id) {
    const credentials = await auth.getCredentials()
    const email = credentials.client_email
    response.json({ email })
    return
  }

  response.setHeader('Access-Control-Allow-Origin', '*')
  if (process.env.GA_MEASUREMENT_ID) {
    axios.post(
      'https://www.google-analytics.com/mp/collect?api_secret=' +
        process.env.GA_SECRET +
        '&measurement_id=' +
        process.env.GA_MEASUREMENT_ID,
      {
        client_id: serverId,
        events: [
          {
            name: 'sheet_request',
            params: {},
          },
        ],
      },
    )
  }
  try {
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: request.query.id,
      range: `'${request.query.sheet}'`,
      auth,
    })
    response.setHeader(
      'Cache-Control',
      `public, s-maxage=20, stale-while-revalidate=20, max-age=15`,
    )
    // https://blogs.akamai.com/2021/06/targeted-cache-control.html
    // https://blog.cloudflare.com/cdn-cache-control/
    response.setHeader(
      'Cloudflare-CDN-Cache-Control',
      `public, s-maxage=30, stale-while-revalidate=30`,
    )
    response.json({ values: data.values })
  } catch (e) {
    if (e.code === 403) {
      const credentials = await auth.getCredentials()
      const email = credentials.client_email
      response.status(403).json({
        error:
          'Could not access the requested sheet. Make sure you shared the sheet to ' +
          email +
          ' or make it viewable by anyone with the link. Note that it may take up to 1 minute for the cache to be cleared.',
      })
    } else {
      console.error('ERROR!', e)
      response.status(500).json({ error: 'Internal server error.' })
    }
  }
}
