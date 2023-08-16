import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import BaseController from './BaseController'
import EventModel from 'App/Models/Event'

export default class EventsController extends BaseController {

  public async forToken ({ params, request }: HttpContextContract) {
    const {
      page = 1,
      limit = 40,
      filter = {},
      sort = ''
    } = request.qs()

    const query = EventModel.query()
      .where('tokenId', params.id)
      .preload('fromAccount')
      .preload('toAccount')

    this.applyFilters(query, filter)
    this.applySorts(query, sort)

    return query
      .orderByRaw('block_number::int desc')
      .orderByRaw('log_index::int desc')
      .paginate(page, limit)
  }

}
