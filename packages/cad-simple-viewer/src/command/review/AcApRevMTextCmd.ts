import { AcApContext } from '../../app'
import { createMTextEntity } from '../draw/AcApMTextCmd'
import { AcApBaseRevCmd } from './AcApBaseRevCmd'

/** Command to create mtext on the drawing annotation layer. */
export class AcApRevMTextCmd extends AcApBaseRevCmd {
  async execute(context: AcApContext) {
    await createMTextEntity(context)
  }
}