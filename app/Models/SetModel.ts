import { BelongsTo, HasMany, belongsTo, hasMany } from '@ioc:Adonis/Lucid/Orm'
import Logger from '@ioc:Adonis/Core/Logger'
import Opepen from 'App/Models/Opepen'
import Subscription from 'App/Models/Subscription'
import SetSubmission from 'App/Models/SetSubmission'
import { Account } from 'App/Models'
import RichContentLink from 'App/Models/RichContentLink'
import { EditionGroups } from './types'
import SetDataModel from './SetDataModel'
import NotifyNewSetEmail from 'App/Mailers/NotifyNewSetEmail'

export default class SetModel extends SetDataModel {
  public static table = 'sets'

  // Note: In here and not the `SetBaseModel` bc of an import loop via Accounts.
  @belongsTo(() => Account, {
    foreignKey: 'creator',
    localKey: 'address',
  })
  public creatorAccount: BelongsTo<typeof Account>

  @belongsTo(() => SetSubmission, {
    foreignKey: 'replacedSubmissionId',
  })
  public replacedSubmission: BelongsTo<typeof SetSubmission>

  @hasMany(() => Opepen, {
    foreignKey: 'setId',
    localKey: 'id',
  })
  public opepen: HasMany<typeof Opepen>

  @hasMany(() => RichContentLink, {
    foreignKey: 'setId',
    localKey: 'id',
  })
  public richContentLinks: HasMany<typeof RichContentLink>

  public async opepensInSet () {
    const opepens = {
      1: new Set(),
      4: new Set(),
      5: new Set(),
      10: new Set(),
      20: new Set(),
      40: new Set(),
    }
    const subscriptions = await Subscription.query().where('set_id', this.id)
    for (const s of subscriptions) {
      for (const id of s.opepenIds) {
        const opepen = await Opepen.find(id)
        if (! opepen) continue

        opepens[opepen.data?.edition].add(opepen.tokenId)
      }
    }

    return {
      1: Array.from(opepens['1']),
      4: Array.from(opepens['4']),
      5: Array.from(opepens['5']),
      10: Array.from(opepens['10']),
      20: Array.from(opepens['20']),
      40: Array.from(opepens['40']),
    }
  }

  public async updateAndValidateOpepensInSet () {
    await this.cleanSubmissions()
    this.submittedOpepen = await this.opepensInSet()
    await this.computeTotalHoldersAtReveal()
    await this.save()
  }

  public async clearOptIns () {
    this.submissionStats = {
      "demand": {
        "1": 0,
        "4": 0,
        "5": 0,
        "10": 0,
        "20": 0,
        "40": 0,
        "total": 0
      },
      "holders": {
        "1": 0,
        "4": 0,
        "5": 0,
        "10": 0,
        "20": 0,
        "40": 0,
        "total": 0
      },
      "opepens": {
        "1": 0,
        "4": 0,
        "5": 0,
        "10": 0,
        "20": 0,
        "40": 0,
        "total": 0
      }
    }
    this.submittedOpepen = []

    await this.save()

    await Subscription.query().where('setId', this.id).update({ setId: null })
  }

  // FIXME: Clean up this ducking mess!
  public async cleanSubmissions () {
    const submissions = await Subscription.query().where('setId', this.id)

    const holders = { 1: 0, 4: 0, 5: 0, 10: 0, 20: 0, 40: 0, total: 0 }
    const opepens = { 1: 0, 4: 0, 5: 0, 10: 0, 20: 0, 40: 0, total: 0 }
    const demand = { 1: 0, 4: 0, 5: 0, 10: 0, 20: 0, 40: 0, total: 0 }

    for (const submission of submissions) {
      const submittedOpepen = await Opepen.query()
        .whereIn('token_id', submission.opepenIds)

      const groups = submittedOpepen.reduce((groups, opepen) => {
        groups[opepen.data.edition].push(opepen.tokenId)

        return groups
      }, { 1: [], 4: [], 5: [], 10: [], 20: [], 40: [] } as EditionGroups)

      for (const edition in groups) {
        if (! submission.maxReveals) {
          submission.maxReveals = {}
        }

        const opepenCount = groups[edition].length
        const overallocated = opepenCount >= submission.maxReveals[edition]
        const isOneOfOneOptIn = edition === '1' && opepenCount

        submission.maxReveals[edition] = (
          overallocated &&
          typeof submission.maxReveals[edition] === 'number'
        )
          ? submission.maxReveals[edition]
          : opepenCount

        if (isOneOfOneOptIn) {
          submission.maxReveals[edition] = 1
        }

        if (submission.maxReveals[edition] > 0) {
          holders[edition] ++
        }

        const actual = isOneOfOneOptIn
          ? opepenCount
          : Math.min(submission.maxReveals[edition], opepenCount)

        demand[edition] += actual
        demand.total += actual
        opepens[edition] += opepenCount
        opepens.total += opepenCount
      }

      holders.total ++

      await submission.save()
    }

    this.submissionStats = { ...this.submissionStats, holders, opepens, demand }
    await this.save()
  }

  public async computeTotalHoldersAtReveal () {
    const owners = await Opepen.holdersAtBlock(parseInt(this.revealBlockNumber) || 9999999999999999)

    this.submissionStats = { ...this.submissionStats, totalHolders: owners.size }
    await this.save()

    return owners.size
  }

  public async notifyPublished () {
    const users = await Account.query()
      .whereNotNull('email')
      .whereNotNull('emailVerifiedAt')
      .where('notificationNewSet', true)

    for (const user of users) {
      try {
        await new NotifyNewSetEmail(user, this).sendLater()
        Logger.info(`SetNotification email scheduled: ${user.email}`)
      } catch (e) {
        Logger.warn(`Error scheduling SetNotification email: ${user.email}`)
      }
    }
  }
}
