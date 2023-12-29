import { BaseCommand } from '@adonisjs/core/build/standalone'
import Opepen from 'App/Models/Opepen'
import { Wallet } from 'ethers'

type Seed = { mnemonic: string, timestamp: number, privk: string, pubk: string }

export default class ExportSet26Seeds extends BaseCommand {
  /**
   * Command name is used to run the command
   */
  public static commandName = 'export:set26_seeds'

  /**
   * Command description is displayed in the "help" output
   */
  public static description = ''

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    const opepen = await Opepen.query().where('setId', 26)

    let globalSeedCount = 0
    let globalSeeds: Seed[] = []

    for (const o of opepen) {
      globalSeedCount += o.data.setConfig?.counts?.seeds || 0
      const history = o.data.setConfig?.history || []

      globalSeeds = globalSeeds.concat(this.getSeeds(history))

    }

    globalSeeds = globalSeeds.sort((a, b) => a.timestamp > b.timestamp ? 1 : -1)

    console.log(globalSeedCount, globalSeeds.length, globalSeeds)
  }

  private getSeeds (history) {
    if (history.length < 12) return []

    let start = history.length - 12
    const possibleSeeds = start
    const seeds: Seed[] = []

    for (let index = 0; index < possibleSeeds; index++) {
      const mnemonic = history.slice(start, start + 12).map(({ word }) => word).join(' ')
      const timestamp = history[start].timestamp

      try {
        const wallet = Wallet.fromMnemonic(mnemonic)

        seeds.push({
          mnemonic,
          privk: wallet.privateKey,
          pubk: wallet.address,
          timestamp,
        })
      } catch (e) {
        // Invalid seed
      }

      start --
    }

    return seeds
  }
}