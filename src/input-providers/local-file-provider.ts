import glob from 'fast-glob'
import {InputProvider, ReportInput} from './input-provider'
import Zip from 'adm-zip'
import path from 'path'

export class LocalFileProvider implements InputProvider {
  constructor(
    readonly name: string,
    readonly pattern: string[]
  ) {}

  async load(): Promise<ReportInput> {
    const files: string[] = []
    for (const pat of this.pattern) {
      const paths = await glob(pat, {dot: true})
      files.push(...paths)
    }

    return {
      files,
      createZip: () => {
        const zip = new Zip()
        for (const file of files) {
          const dir = path.dirname(file)
          zip.addLocalFile(file, dir)
        }
        return zip
      }
    }
  }

  async listTrackedFiles(): Promise<string[]> {
    return []
  }
}
