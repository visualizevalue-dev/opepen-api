import { BaseCommand } from '@adonisjs/core/build/standalone'
import provider from 'App/Services/RPCProvider'

export default class ExecuteReveal extends BaseCommand {
  /**
   * Command name is used to run the command
   */
  public static commandName = 'reveal:execute'

  /**
   * Command description is displayed in the "help" output
   */
  public static description = 'Execute pending reveals'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    const { default: SetSubmission } = await import('App/Models/SetSubmission')

    const currentBlock = await provider.getBlockNumber()

    const toReveal = await SetSubmission.query()
      .whereNotNull('revealBlockNumber')
      .where('revealBlockNumber', '<=', currentBlock.toString())
      .whereNull('setId')

    for (const submission of toReveal) {
      await submission.reveal()

      this.logger.info(`Executed reveal for submission ${submission.uuid}`)
    }
  }
}
