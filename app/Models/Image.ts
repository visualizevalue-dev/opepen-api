import { DateTime } from 'luxon'
import { v4 as uuid } from 'uuid'
import sharp from 'sharp'
import Application from '@ioc:Adonis/Core/Application'
import { BaseModel, BelongsTo, beforeCreate, belongsTo, column, computed } from '@ioc:Adonis/Lucid/Orm'
import Drive from '@ioc:Adonis/Core/Drive'
import Env from '@ioc:Adonis/Core/Env'
import { toDriveFromURI } from 'App/Helpers/drive'
import { execute } from 'App/Helpers/execute'
import Account from './Account'

type ImageVersions = {
  sm?: boolean, // 512
  lg?: boolean, // 1024
  xl?: boolean, // 2048
}

export default class Image extends BaseModel {
  @column({ isPrimary: true, serializeAs: null })
  public id: bigint

  @column()
  public uuid: string

  @beforeCreate()
  public static async createUUID (model: Image) {
    model.uuid = uuid()
  }

  @column()
  public type: string

  @column({
    consume: value => value || {},
  })
  public versions: ImageVersions

  @column()
  public creator: string

  @column.dateTime({ autoCreate: true, serializeAs: null })
  public createdAt: DateTime

  @column.dateTime({ serializeAs: null })
  public featuredAt: DateTime

  @column()
  public points: number

  @computed()
  public get cdn (): string {
    return Env.get('CDN_URL')
  }

  @computed()
  public get path (): string {
    return `images`
  }

  @computed()
  public get isVideo (): boolean {
    return ['webm', 'mp4'].includes(this.type)
  }

  @computed()
  public get isAnimated (): boolean {
    return this.isVideo || ['apng', 'gif'].includes(this.type)
  }

  public get staticType (): string {
    return this.isAnimated ? 'png' : this.type
  }

  public get staticURI (): string {
    return `${this.cdn}/${this.path}/${this.uuid}@sm.${this.staticType}`
  }

  @belongsTo(() => Account, {
    foreignKey: 'creator',
    localKey: 'address',
  })
  public creatorAccount: BelongsTo<typeof Account>

  async fillImageFromURI (url: string): Promise<Image> {
    const file = await toDriveFromURI(url, this.uuid)
    this.type = file?.fileType || 'png'
    await this.save()
    return this
  }

  async generateScaledVersions (): Promise<void> {
    try {
      console.log(`GENERATING SCALED VERSION`)
      let key = `images/${this.uuid}.${this.type}`

      // Generate still
      if (this.isAnimated) {
        await this.generateStill()

        key += '.png'
      }

      const original = await Drive.get(key)
      const imageProcessor = await sharp(original)
      const metadata = await imageProcessor.metadata()
      const distType = this.isAnimated ? (metadata.format || this.type) : this.type

      if (! metadata.width || !['png', 'jpeg', 'webp'].includes(distType)) return

      if (metadata.width > 2048) {
        const v2048 = await imageProcessor.resize({ width: 2048 }).toBuffer()
        await Drive.put(`images/${this.uuid}@xl.${distType}`, v2048, { contentType: `image/${distType}` })
        this.versions.xl = true
      }

      if (metadata.width > 1024) {
        const v1024 = await imageProcessor.resize({ width: 1024 }).toBuffer()
        await Drive.put(`images/${this.uuid}@lg.${distType}`, v1024, { contentType: `image/${distType}` })
        this.versions.lg = true
      }

      const v512 = await imageProcessor.resize({ width: 512 }).toBuffer()
      await Drive.put(`images/${this.uuid}@sm.${distType}`, v512, { contentType: `image/${distType}` })
      this.versions.sm = true

      await this.save()
    } catch (e) {
      // ...
      console.log(e)
    }
  }

  async generateStill (): Promise<void> {
    // Download video
    const key = `images/${this.uuid}.${this.type}`
    const pngKey = `${key}.png`
    const file = await Drive.get(key)
    await Drive.use('local').put(key, file)
    const tmp = await Application.tmpPath(`uploads`)

    // Generate video
    try {
      await execute(`ffmpeg -i ${tmp}/${key} -frames:v 1 ${tmp}/${pngKey} -threads 4 -y`)
    } catch (e) {
      // ...
      console.log(e)
    }

    // Upload to CDN
    await Drive.put(pngKey, await Drive.use('local').get(pngKey))

    // Delete local data
    await Promise.all([
      Drive.use('local').delete(key),
      Drive.use('local').delete(pngKey),
    ])
  }

  static async fromURI (url: string, data: object = { versions: {} }): Promise<Image> {
    const image = await Image.create(data)

    await image.fillImageFromURI(url)

    return image
  }
}
