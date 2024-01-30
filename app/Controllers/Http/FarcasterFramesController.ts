import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Env from '@ioc:Adonis/Core/Env'
import BaseController from './BaseController'
import pad from 'App/Helpers/pad'

type Action = string|{text:string, action:'submit'|'redirect'|'txn'}

export default class FarcasterFramesController extends BaseController {
  public async setsEntry (_: HttpContextContract) {
    return this.setOverview()
  }

  public async sets ({ request, response }: HttpContextContract) {
    const data = request.body().untrustedData
    const buttonIndex = parseInt(data.buttonIndex)

    if (buttonIndex == 1) {
      return response.redirect('https://opepen.art/sets')
    }

    return this.setResponse(1)
  }

  public async set ({ request, params, response }: HttpContextContract) {
    const data = request.body().untrustedData
    const buttonIndex = parseInt(data.buttonIndex)
    const set = parseInt(params.id)
    const previous = buttonIndex === 1
    const browse = buttonIndex === 2
    const next = buttonIndex === 3

    const toOverview = (next && set >= 200) || (previous && set <= 1)
    if (toOverview) return this.setOverview()

    const newSetId = next ? set + 1 : set - 1

    if (browse) return response.redirect(`https://opepen.art/sets/${pad(newSetId, 3)}`)

    return this.setResponse(newSetId)
  }

  private setOverview () {
    return this.response({
      imageUrl: `https://opepen.nyc3.cdn.digitaloceanspaces.com/OG/sets@frame.png`,
      postUrl: `${Env.get('APP_URL')}/v1/frames/sets`,
      actions: [
        { text: 'View Website', action: 'redirect' },
        'Browse Sets',
      ],
    })
  }

  private setResponse (id) {
    return this.response({
      imageUrl: `https://opepen.nyc3.cdn.digitaloceanspaces.com/OG/sets/${pad(id, 3)}.png`,
      postUrl: `${Env.get('APP_URL')}/v1/frames/sets/${id}`,
      actions: [
        id <= 1 ? '← Overview' : `← Previous`,
        `Browse Set #${pad(id, 3)}`,
        id >= 200 ? '↺ Overview' : `Next →`,
      ]
    })
  }

  private response (
    {
      imageUrl,
      postUrl,
      actions,
    }: {
      imageUrl: string,
      postUrl: string,
      actions?: Action[],
    })
  {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta property="og:title" content="Opepen Set Frame">
          <meta property="og:image" content="https://opepen.nyc3.cdn.digitaloceanspaces.com/OG/sets.png">

          <meta property="fc:frame" content="vNext" />
          <meta property="fc:frame:image" content="${imageUrl}" />
          ${
            actions
              ?.map(
                (a, i) => typeof a === 'string'
                  ? `<meta property="fc:frame:button:${i + 1}" content="${a}" />`
                  : `
                    <meta property="fc:frame:button:${i + 1}" content="${a.text}" />
                    <meta property="fc:frame:button:${i + 1}:action" content="${a.action}" />
                  `
              ).join('')
          }
          <meta property="fc:frame:post_url" content="${postUrl}" />
        </head>
      </html>
    `
  }
}
