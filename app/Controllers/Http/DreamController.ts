import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import StableDiffusionShapeDetection from 'App/Services/Generators/StableDiffusionShapeDetection'
import { generateOpepenPNG } from 'App/Services/OpepenSVG/OpepenGenerator'

export default class DreamController {
  // TODO: Authenticate
  public async handle({ request }: HttpContextContract) {
    const input = {
      base_image: await generateOpepenPNG(request.input('opepen')),
      prompt: request.input('prompt'),
    }

    const Generator = StableDiffusionShapeDetection

    const image = await (new Generator(input)).generate()

    return image
  }
}
