require('./_init')

const { google } = require('googleapis')
const analyticsData = google.analyticsdata('v1beta')

const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
})

module.exports = async function (request, response) {
  try {
    const daysAgo = (n) =>
      new Date(Date.now() - n * 86400e3).toJSON().split('T')[0]
    const { data: report } = await analyticsData.properties.runReport({
      auth,
      property: 'properties/279292385',
      requestBody: {
        dateRanges: [
          { startDate: daysAgo(28), endDate: daysAgo(0) },
          { startDate: daysAgo(7), endDate: daysAgo(0) },
        ],
        metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
        dimensions: [{ name: 'eventName' }],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            stringFilter: { value: 'sheet_endpoint_request' },
          },
        },
      },
    })
    response.setHeader(
      'Cache-Control',
      `public, s-maxage=3600, stale-while-revalidate=86400, max-age=3600`,
    )
    // https://blogs.akamai.com/2021/06/targeted-cache-control.html
    // https://blog.cloudflare.com/cdn-cache-control/
    response.setHeader(
      'Cloudflare-CDN-Cache-Control',
      `public, s-maxage=3600, stale-while-revalidate=86400`,
    )
    response.json({ report })
  } catch (e) {
    console.error('ERROR!', e)
    response.status(500).json({ error: 'Internal server error.' })
  }
}
