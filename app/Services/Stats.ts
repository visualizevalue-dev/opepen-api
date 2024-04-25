import { DateTime } from "luxon"
import { SetModel } from "App/Models"
import SetSubmission from "App/Models/SetSubmission"
import SubscriptionHistory from "App/Models/SubscriptionHistory"
import Opepen from "App/Models/Opepen"
import Database from "@ioc:Adonis/Lucid/Database"

export type Stats = {
  submissions: {
    sets: number
    images: number
  }
  users: {
    permanentArtists: number
    artists: number
    curators: number
  }
  optIns: number
  revealed: {
    opepen: number
    sets: number
  }
}

class StatsService {
  private stats: Stats
  private lastUpdated: number = 0

  public async show (): Promise<Stats> {
    // If last updated longer than 10 minutes ago // 60 * 10
    if (this.lastUpdated < (DateTime.now().toUnixInteger() - 10)) {
      await this.computeStats()
    }

    return this.stats
  }

  private async computeStats () {
    const [
      submissions,
      printSubmissions,
      optIns,
      sets,
      artists,
      permanentArtists,
      holders,
    ] = await Promise.all([
      SetSubmission.query().count('id'),
      SetSubmission.query().where('edition_type', 'PRINT').count('id'),
      SubscriptionHistory.query().sum('opepen_count'),
      SetModel.query().whereNotNull('submissionId').count('id'),
      SetSubmission.query().whereNotNull('approved_at').countDistinct('creator'),
      this.permanentArtistsQuery(),
      Opepen.query().countDistinct('owner'),
    ])

    const setsCount: number = parseInt(sets[0].$extras.count)
    const submissionsCount: number = parseInt(submissions[0].$extras.count)
    const printSubmissionsCount: number = parseInt(printSubmissions[0].$extras.count)
    const dynamicSubmissionsCount: number = submissionsCount - printSubmissionsCount
    const submittedImagesCount: number = dynamicSubmissionsCount * 80 + printSubmissionsCount * 6

    this.stats = {
      submissions: {
        sets: submissionsCount,
        images: submittedImagesCount,
      },
      optIns: parseInt(optIns[0].$extras.sum),
      users: {
        permanentArtists: parseInt(permanentArtists.rows[0].count),
        artists: parseInt(artists[0].$extras.count),
        curators: parseInt(holders[0].$extras.count),
      },
      revealed: {
        opepen: setsCount * 80,
        sets: setsCount,
      },
    }

    this.lastUpdated = DateTime.now().toUnixInteger()
  }

  private permanentArtistsQuery () {
    return Database.rawQuery(`
      SELECT COUNT(*) AS count
      FROM (
          SELECT creator FROM set_submissions WHERE set_id IS NOT NULL
          UNION
          SELECT co_creator_1 FROM set_submissions WHERE co_creator_1 IS NOT NULL AND set_id IS NOT NULL
          UNION
          SELECT co_creator_2 FROM set_submissions WHERE co_creator_2 IS NOT NULL AND set_id IS NOT NULL
          UNION
          SELECT co_creator_3 FROM set_submissions WHERE co_creator_3 IS NOT NULL AND set_id IS NOT NULL
          UNION
          SELECT co_creator_4 FROM set_submissions WHERE co_creator_4 IS NOT NULL AND set_id IS NOT NULL
          UNION
          SELECT co_creator_5 FROM set_submissions WHERE co_creator_5 IS NOT NULL AND set_id IS NOT NULL
      ) AS artist_addresses;
    `)
  }

}

export default new StatsService()
