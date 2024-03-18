import { DateTime } from 'luxon'
import { BaseModel, BelongsTo, belongsTo, column } from '@ioc:Adonis/Lucid/Orm'
import Account from 'App/Models/Account'
import SetSubmission from 'App/Models/SetSubmission'
import { MaxReveal } from './types'
import Subscription from './Subscription'

export default class SubscriptionHistory extends BaseModel {
  public static table = 'set_subscription_history'

  @column({ isPrimary: true })
  public id: bigint

  @column()
  public submissionId: number

  @column()
  public subscriptionId: bigint

  @column()
  public address: string

  @column({
    prepare: value => JSON.stringify(value),
  })
  public opepenIds: string[]

  @column({
    prepare: value => JSON.stringify(value),
  })
  public maxReveals: MaxReveal

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @belongsTo(() => SetSubmission)
  public submission: BelongsTo<typeof SetSubmission>

  @belongsTo(() => Account, {
    foreignKey: 'address',
    localKey: 'address',
  })
  public account: BelongsTo<typeof Account>

  public static saveFor (subscription: Subscription) {
    return SubscriptionHistory.create({
      submissionId: subscription.submissionId,
      subscriptionId: subscription.id,
      address: subscription.address,
      opepenIds: subscription.opepenIds,
      maxReveals: subscription.maxReveals,
      createdAt: subscription.createdAt,
    })
  }
}
