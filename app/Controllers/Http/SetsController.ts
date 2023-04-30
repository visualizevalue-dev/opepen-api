import { ethers } from 'ethers'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import SetModel from 'App/Models/Set'
import Subscription from 'App/Models/Subscription'
import BaseController from './BaseController'

export default class SetsController extends BaseController {
  public async show ({ params }: HttpContextContract) {
    const set = await SetModel.query()
      .preload('edition1Image')
      .preload('edition4Image')
      .preload('edition5Image')
      .preload('edition10Image')
      .preload('edition20Image')
      .preload('edition40Image')
      .where('id', params.id)
      .firstOrFail()

    return set
  }

  public async subscribe ({ params, request }: HttpContextContract) {
    const set = await SetModel.findOrFail(params.id)

    const address = request.input('address')?.toLowerCase()
    const message = request.input('message')
    const signature = request.input('signature')
    const verifiedAddress = ethers.utils.verifyMessage(message, signature)

    if (! set.name) throw new Error(`Needs a valid set`)
    if (! message) throw new Error(`Needs a message`)
    if (address !== verifiedAddress.toLowerCase()) throw new Error(`Address needs to be accurate`)

    const subscription = await Subscription.updateOrCreate({
      setId: set.id,
      address,
    }, {
      message,
      signature,
      opepenIds: request.input('opepen'),
    })

    // Update opepen cache
    set.submittedOpepen = await set.opepensInSet()
    await set.save()

    return subscription
  }
}
