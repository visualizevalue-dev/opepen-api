import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import Opepen from 'App/Models/Opepen'
import axios from 'axios'

export default class OpepenMetadataImport extends BaseCommand {
  /**
   * Command name is used to run the command
   */
  public static commandName = 'opepen:import-metadata'

  /**
   * Command description is displayed in the "help" output
   */
  public static description = ''

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  @flags.number()
  public from: number = 1

  @flags.number()
  public to: number = 16_000

  public async run() {
    this.logger.info('Import Opepen Metadata')

    const opepens = await Opepen.query()
      .where('tokenId', '>=', this.from)
      .where('tokenId', '<=', this.to)
      .orderBy('tokenId')

    for (const opepen of opepens) {
      const { data: metadata } = await axios.get(`https://metadata.opepen.art/${opepen.tokenId}/metadata.json`)

      opepen.data = {
        ...opepen.data,
        edition: metadata.attributes.find(a => a.trait_type === 'Edition Size').value,
      }
      await opepen.save()

      this.logger.info(`Opepen ${opepen.tokenId} metadata saved`)
    }
  }
}
