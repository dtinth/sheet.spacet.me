require('./_init')

const serverId = require('uuid').v4()
const axios = require('axios')
const crypto = require('crypto')
const { google } = require('googleapis')
const sheets = google.sheets('v4')

const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

const hash = (str) => {
  const hash = crypto.createHash('md5')
  return hash.update(str).digest('hex')
}

module.exports = async function (request, response) {
  if (!request.query.id) {
    const credentials = await auth.getCredentials()
    const email = credentials.client_email
    response.json({ email })
    return
  }

  response.setHeader('Access-Control-Allow-Origin', '*')

  const sheetHash = hash(String(request.query.id))
  if (process.env.GA_MEASUREMENT_ID) {
    axios.post(
      'https://www.google-analytics.com/mp/collect?api_secret=' +
        process.env.GA_SECRET +
        '&measurement_id=' +
        process.env.GA_MEASUREMENT_ID,
      {
        client_id: serverId,
        user_id: sheetHash,
        events: [
          {
            name: 'sheet_endpoint_request',
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
      `public, s-maxage=15, stale-while-revalidate=10, max-age=15`,
    )
    // https://blogs.akamai.com/2021/06/targeted-cache-control.html
    // https://blog.cloudflare.com/cdn-cache-control/
    response.setHeader(
      'Cloudflare-CDN-Cache-Control',
      `public, s-maxage=30, stale-while-revalidate=60`,
    )
    response.setHeader('Content-Type', `application/json; charset=utf-8`)
    response.write(`{"values":\n[`)
    response.write(data.values.map((row) => JSON.stringify(row)).join('\n,'))
    response.end(`]}`)
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
