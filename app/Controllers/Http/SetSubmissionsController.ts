import { DateTime } from 'luxon'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import BotNotifications from 'App/Services/BotNotifications'
import BaseController from './BaseController'
import Account from 'App/Models/Account'
import Image from 'App/Models/Image'
import SetSubmission from 'App/Models/SetSubmission'
import { isAdmin } from 'App/Middleware/AdminAuth'
import NotAuthenticated from 'App/Exceptions/NotAuthenticated'
import InvalidInput from 'App/Exceptions/InvalidInput'
import DynamicSetImages from 'App/Models/DynamicSetImages'

export default class SetSubmissionsController extends BaseController {

  public async list ({ request, session }: HttpContextContract) {
    const {
      page = 1,
      limit = 10,
      filter = {},
      sort = '',
      status = '',
    } = request.qs()

    const query = SetSubmission.query()
      .preload('edition1Image')
      .preload('edition4Image')
      .preload('edition5Image')
      .preload('edition10Image')
      .preload('edition20Image')
      .preload('edition40Image')

    // Handle status filter
    switch (status) {
      case 'unapproved':
        if (isAdmin(session)) {
          query.withScopes(scopes => {
            scopes.published()
            scopes.unapproved()
            scopes.unstarred()
          })
          break;
        }
      case 'all':
        if (isAdmin(session)) {
          query.withScopes(scopes => {
            scopes.complete()
          })
          break;
        }
      case 'starred':
        query.withScopes(scopes => {
          scopes.active()
          scopes.starred()
        })
        query.orderByRaw('starred_at desc NULLS LAST')
        break;
      case 'unstarred':
        query.withScopes(scopes => {
          scopes.active()
          scopes.approved()
          scopes.published()
          scopes.unstarred()
        })
        query.orderByRaw('approved_at desc')
        break;
      case 'deleted':
        if (isAdmin(session)) {
          query.whereNotNull('deletedAt')
          break;
        }
      case 'revealed':
        query.whereNotNull('setId')
        break;
      default:
        query.withScopes(scopes => {
          scopes.published()
          scopes.approved()
        })
        break;
    }

    this.applyFilters(query, filter)
    this.applySorts(query, sort)

    return query
      .orderBy('createdAt', 'desc')
      .paginate(page, limit)
  }

  public async create ({ session, request }: HttpContextContract) {
    const creator = await Account.firstOrCreate({
      address: session.get('siwe')?.address?.toLowerCase()
    })

    const [
      image1,
      image4,
      image5,
      image10,
      image20,
      image40,
    ] = await Promise.all([
      Image.findBy('uuid', request.input('edition_1_image_id', null)),
      Image.findBy('uuid', request.input('edition_4_image_id', null)),
      Image.findBy('uuid', request.input('edition_5_image_id', null)),
      Image.findBy('uuid', request.input('edition_10_image_id', null)),
      Image.findBy('uuid', request.input('edition_20_image_id', null)),
      Image.findBy('uuid', request.input('edition_40_image_id', null)),
    ])

    return SetSubmission.create({
      creator: creator.address,
      name: request.input('name'),
      artist: request.input('artist'),
      description: request.input('description'),
      editionType: request.input('edition_type', 'PRINT'),
      edition_1Name: request.input('edition_1_name'),
      edition_4Name: request.input('edition_4_name'),
      edition_5Name: request.input('edition_5_name'),
      edition_10Name: request.input('edition_10_name'),
      edition_20Name: request.input('edition_20_name'),
      edition_40Name: request.input('edition_40_name'),
      edition_1ImageId: image1?.id,
      edition_4ImageId: image4?.id,
      edition_5ImageId: image5?.id,
      edition_10ImageId: image10?.id,
      edition_20ImageId: image20?.id,
      edition_40ImageId: image40?.id,
    })
  }

  public async show ({ params }: HttpContextContract) {
    const submission = await SetSubmission.query()
      .where('uuid', params.id)
      .preload('set')
      .preload('edition1Image')
      .preload('edition4Image')
      .preload('edition5Image')
      .preload('edition10Image')
      .preload('edition20Image')
      .preload('edition40Image')
      .preload('dynamicSetImages')
      .preload('creatorAccount')
      // TODO: Implement rich content links
      // .preload('richContentLinks', query => {
      //   query.preload('logo')
      //   query.preload('cover')
      //   query.orderBy('sortIndex')
      // })
      .firstOrFail()

    return submission
  }

  public async update (ctx: HttpContextContract) {
    const submission = await this.show(ctx)
    if (! submission) return ctx.response.badRequest()

    // Don't allow updates on published submissions
    if (submission.publishedAt && !isAdmin(ctx.session)) {
      return ctx.response.unauthorized(`Can't edit published set`)
    }

    const { request, session } = ctx

    await this.creatorOrAdmin({ creator: submission.creatorAccount, session })

    const [
      image1,
      image4,
      image5,
      image10,
      image20,
      image40,
    ] = await Promise.all([
      Image.findBy('uuid', request.input('edition_1_image_id', null)),
      Image.findBy('uuid', request.input('edition_4_image_id', null)),
      Image.findBy('uuid', request.input('edition_5_image_id', null)),
      Image.findBy('uuid', request.input('edition_10_image_id', null)),
      Image.findBy('uuid', request.input('edition_20_image_id', null)),
      Image.findBy('uuid', request.input('edition_40_image_id', null)),
    ])

    return submission
      .merge({
        name: request.input('name'),
        artist: request.input('artist'),
        description: request.input('description'),
        editionType: request.input('edition_type', 'PRINT'),
        edition_1Name: request.input('edition_1_name'),
        edition_4Name: request.input('edition_4_name'),
        edition_5Name: request.input('edition_5_name'),
        edition_10Name: request.input('edition_10_name'),
        edition_20Name: request.input('edition_20_name'),
        edition_40Name: request.input('edition_40_name'),
        edition_1ImageId: image1?.id,
        edition_4ImageId: image4?.id,
        edition_5ImageId: image5?.id,
        edition_10ImageId: image10?.id,
        edition_20ImageId: image20?.id,
        edition_40ImageId: image40?.id,
      })
      .save()
  }

  public async sign (ctx: HttpContextContract) {
    const { session, request, response } = ctx

    // Fetch our assets
    const submission = await this.show(ctx)
    const user = await Account.firstOrCreate({
      address: session.get('siwe')?.address?.toLowerCase()
    })

    // Only the creator may sign
    if (user.address !== submission?.creator) return response.unauthorized('Not authorized')

    // Save the signature
    submission.artistSignature = request.input('signature')

    return submission.save()
  }

  public async publish ({ params, session }: HttpContextContract) {
    const submission = await SetSubmission.query()
      .where('uuid', params.id)
      .withScopes(scopes => scopes.complete())
      .preload('creatorAccount')
      .firstOrFail()

    await this.creatorOrAdmin({ creator: submission.creatorAccount, session })

    submission.publishedAt = DateTime.now()

    return submission.save()
  }

  public async approve (ctx: HttpContextContract) {
    const submission = await this.show(ctx)
    if (! submission || submission.approvedAt) return ctx.response.badRequest()

    submission.approvedAt = DateTime.now()

    await submission.save()

    await submission.notify('NewSubmission')
    await BotNotifications?.newSubmission(submission)

    return submission
  }

  public async unapprove (ctx: HttpContextContract) {
    const submission = await this.show(ctx)
    if (! submission) return ctx.response.badRequest()

    submission.approvedAt = null

    await submission.save()

    return submission
  }

  public async star (ctx: HttpContextContract) {
    const submission = await this.show(ctx)
    if (! submission) return ctx.response.badRequest()

    submission.starredAt = submission.starredAt ? null : DateTime.now()

    if (! submission.approvedAt) {
      submission.approvedAt = DateTime.now()
    }

    await submission.save()

    await submission.notify('NewCuratedSubmission')

    return submission
  }

  public async delete (ctx: HttpContextContract) {
    const submission = await this.show(ctx)
    if (! submission) return ctx.response.badRequest()

    const { session } = ctx
    await this.creatorOrAdmin({ creator: submission.creatorAccount, session })

    if (submission.revealsAt) throw new InvalidInput(`Can't delete a live set`)

    submission.deletedAt = DateTime.now()
    await submission.save()

    return ctx.response.ok('')
  }

  public async forAccount ({ params, session, request }: HttpContextContract) {
    const creator = await Account.byId(params.account).firstOrFail()
    await this.creatorOrAdmin({ creator, session })

    const { page = 1, limit = 100 } = request.qs()
    return SetSubmission.query()
      .where('creator', creator.address)
      .withScopes((scopes) => scopes.active())
      .preload('edition1Image')
      .preload('edition4Image')
      .preload('edition5Image')
      .preload('edition10Image')
      .preload('edition20Image')
      .preload('edition40Image')
      .paginate(page, limit)
  }

  protected async creatorOrAdmin({ creator, session }) {
    const user = await Account.firstOrCreate({
      address: session.get('siwe')?.address?.toLowerCase()
    })

    // Make sure we're admin or creator
    if (user.address !== creator.address && !isAdmin(session)) {
      throw new NotAuthenticated(`Not authorized`)
    }

    return { user }
  }

}
